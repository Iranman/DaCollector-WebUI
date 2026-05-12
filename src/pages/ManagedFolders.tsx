import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, Plus, RefreshCw, ScanLine, Pencil, Trash2, X, Check } from 'lucide-react';
import {
  CreateManagedFolderBody,
  DropFolderType,
  ManagedFolder,
  managedFoldersApi,
} from '../api/managedFolders';
import { ApiError } from '../api/client';
import Button from '../components/ui/Button';
import TextInput from '../components/ui/TextInput';
import Toggle from '../components/ui/Toggle';
import Select from '../components/ui/Select';
import SettingsRow from '../components/ui/SettingsRow';

type FormMode = { kind: 'add' } | { kind: 'edit'; folder: ManagedFolder };

interface FolderDraft {
  Name: string;
  Path: string;
  WatchForNewFiles: boolean;
  DropFolderType: DropFolderType;
}

const emptyDraft: FolderDraft = {
  Name: '',
  Path: '',
  WatchForNewFiles: false,
  DropFolderType: 'None',
};

function fmtBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default function ManagedFolders() {
  const navigate = useNavigate();
  const [folders, setFolders] = useState<ManagedFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [draft, setDraft] = useState<FolderDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [scanningID, setScanningID] = useState<number | null>(null);
  const [deletingID, setDeletingID] = useState<number | null>(null);
  const [confirmDeleteID, setConfirmDeleteID] = useState<number | null>(null);
  const [scanToast, setScanToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setFolders(await managedFoldersApi.list());
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) navigate('/login');
      else setError(err instanceof Error ? err.message : 'Failed to load folders.');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setFormMode({ kind: 'add' });
    setDraft(emptyDraft);
    setFormError(null);
  }

  function openEdit(folder: ManagedFolder) {
    setFormMode({ kind: 'edit', folder });
    setDraft({
      Name: folder.Name,
      Path: folder.Path,
      WatchForNewFiles: folder.WatchForNewFiles,
      DropFolderType: folder.DropFolderType,
    });
    setFormError(null);
  }

  function closeForm() {
    setFormMode(null);
    setFormError(null);
  }

  async function handleSave() {
    if (!draft.Name.trim()) { setFormError('Name is required.'); return; }
    if (!draft.Path.trim()) { setFormError('Path is required.'); return; }
    setSaving(true);
    setFormError(null);
    try {
      if (formMode?.kind === 'add') {
        const body: CreateManagedFolderBody = {
          Name: draft.Name.trim(),
          Path: draft.Path.trim(),
          WatchForNewFiles: draft.WatchForNewFiles,
          DropFolderType: draft.DropFolderType,
        };
        const created = await managedFoldersApi.create(body);
        setFolders(prev => [...prev, created]);
      } else if (formMode?.kind === 'edit') {
        const updated: ManagedFolder = {
          ...formMode.folder,
          Name: draft.Name.trim(),
          Path: draft.Path.trim(),
          WatchForNewFiles: draft.WatchForNewFiles,
          DropFolderType: draft.DropFolderType,
        };
        await managedFoldersApi.update(updated);
        setFolders(prev => prev.map(f => f.ID === updated.ID ? updated : f));
      }
      closeForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleScan(folder: ManagedFolder) {
    setScanningID(folder.ID);
    try {
      await managedFoldersApi.scan(folder.ID);
      setScanToast(`Scan queued for "${folder.Name}"`);
      setTimeout(() => setScanToast(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed.');
    } finally {
      setScanningID(null);
    }
  }

  async function handleDelete(folderID: number) {
    setDeletingID(folderID);
    try {
      await managedFoldersApi.delete(folderID);
      setFolders(prev => prev.filter(f => f.ID !== folderID));
      setConfirmDeleteID(null);
      if (formMode?.kind === 'edit' && formMode.folder.ID === folderID) closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setDeletingID(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Managed Folders</h1>
          <p className="mt-0.5 text-xs text-gray-500">
            Folders on the server that DaCollector scans for media files.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <Button onClick={openAdd} disabled={formMode?.kind === 'add'}>
            <Plus size={14} className="mr-1" />
            Add Folder
          </Button>
        </div>
      </div>

      {/* Toast */}
      {scanToast && (
        <div className="rounded-md border border-emerald-500/50 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">
          {scanToast}
        </div>
      )}

      {/* Page error */}
      {error && (
        <div className="rounded-md border border-red-500/50 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Add form */}
      {formMode?.kind === 'add' && (
        <FolderForm
          title="Add Managed Folder"
          draft={draft}
          setDraft={setDraft}
          error={formError}
          saving={saving}
          onSave={handleSave}
          onCancel={closeForm}
        />
      )}

      {/* Folder list */}
      {loading && folders.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        </div>
      ) : folders.length === 0 && !loading ? (
        <div className="app-card rounded-md px-5 py-12 text-center">
          <FolderOpen size={32} className="mx-auto mb-3 text-gray-600" />
          <p className="text-sm text-gray-400">No managed folders yet.</p>
          <p className="mt-1 text-xs text-gray-600">Add a folder to start scanning for media files.</p>
        </div>
      ) : (
        <div className="app-card rounded-md divide-y divide-gray-800/50">
          {folders.map(folder => (
            <div key={folder.ID}>
              <div className="flex items-start gap-4 px-5 py-4">
                <FolderOpen size={18} className="mt-0.5 shrink-0 text-blue-400" />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-gray-100">{folder.Name}</span>
                    {folder.WatchForNewFiles && (
                      <Badge color="blue">Watching</Badge>
                    )}
                    {folder.DropFolderType !== 'None' && (
                      <Badge color="gray">{folder.DropFolderType}</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-gray-500" title={folder.Path}>
                    {folder.Path}
                  </p>
                  <p className="mt-1 text-xs text-gray-600">{fmtBytes(folder.FileSize)}</p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    disabled={scanningID === folder.ID}
                    onClick={() => handleScan(folder)}
                    title="Scan folder"
                    className="flex items-center gap-1 rounded px-2 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors disabled:opacity-40"
                  >
                    <ScanLine size={12} />
                    {scanningID === folder.ID ? 'Queuing…' : 'Scan'}
                  </button>
                  <button
                    onClick={() => formMode?.kind === 'edit' && formMode.folder.ID === folder.ID ? closeForm() : openEdit(folder)}
                    title="Edit folder"
                    className="rounded p-1.5 text-gray-400 hover:text-blue-400 transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  {confirmDeleteID === folder.ID ? (
                    <div className="flex items-center gap-1">
                      <button
                        disabled={deletingID === folder.ID}
                        onClick={() => handleDelete(folder.ID)}
                        title="Confirm delete"
                        className="rounded p-1.5 text-red-400 hover:text-red-300 transition-colors disabled:opacity-40"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteID(null)}
                        title="Cancel"
                        className="rounded p-1.5 text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteID(folder.ID)}
                      title="Delete folder"
                      className="rounded p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Inline edit form */}
              {formMode?.kind === 'edit' && formMode.folder.ID === folder.ID && (
                <div className="border-t border-gray-700/50 bg-gray-900/30 px-5 py-5">
                  <FolderForm
                    title="Edit Managed Folder"
                    draft={draft}
                    setDraft={setDraft}
                    error={formError}
                    saving={saving}
                    onSave={handleSave}
                    onCancel={closeForm}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FolderForm({
  title,
  draft,
  setDraft,
  error,
  saving,
  onSave,
  onCancel,
}: {
  title: string;
  draft: FolderDraft;
  setDraft: (d: FolderDraft) => void;
  error: string | null;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="app-card rounded-md p-5 space-y-4">
      <h2 className="text-sm font-semibold text-gray-200">{title}</h2>

      {error && (
        <div className="rounded border border-red-500/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="space-y-1">
        <SettingsRow label="Name">
          <TextInput
            value={draft.Name}
            onChange={e => setDraft({ ...draft, Name: e.target.value })}
            placeholder="My Movies"
          />
        </SettingsRow>
        <SettingsRow label="Path">
          <TextInput
            value={draft.Path}
            onChange={e => setDraft({ ...draft, Path: e.target.value })}
            placeholder="/media/movies"
          />
        </SettingsRow>
        <SettingsRow label="Watch for New Files">
          <div className="flex justify-end">
            <Toggle
              checked={draft.WatchForNewFiles}
              onChange={v => setDraft({ ...draft, WatchForNewFiles: v })}
            />
          </div>
        </SettingsRow>
        <SettingsRow label="Drop Folder Type">
          <Select
            value={draft.DropFolderType}
            onChange={e => setDraft({ ...draft, DropFolderType: e.target.value as DropFolderType })}
          >
            <option value="None">None</option>
            <option value="Source">Source</option>
            <option value="Destination">Destination</option>
            <option value="Both">Both</option>
          </Select>
        </SettingsRow>
      </div>

      <p className="text-xs text-gray-600">
        The path must exist on the server. Changes take effect immediately.
      </p>

      <div className="flex justify-end gap-3 pt-1">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

function Badge({ color, children }: { color: 'blue' | 'gray'; children: React.ReactNode }) {
  const cls = color === 'blue'
    ? 'bg-blue-600/20 text-blue-400'
    : 'bg-gray-700/50 text-gray-400';
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {children}
    </span>
  );
}
