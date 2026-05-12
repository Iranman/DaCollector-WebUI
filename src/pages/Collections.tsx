import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import {
  CollectionDefinition,
  CollectionPreview,
  CollectionRule,
  CollectionSummary,
  CollectionSyncMode,
  collectionsApi,
} from '../api/collections';
import { ApiError } from '../api/client';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import TextInput from '../components/ui/TextInput';
import Toggle from '../components/ui/Toggle';

interface CollectionDraft {
  id?: string;
  name: string;
  enabled: boolean;
  syncMode: CollectionSyncMode;
  rulesText: string;
}

const syncModeLabels: Record<CollectionSyncMode, string> = {
  0: 'Preview',
  1: 'Append',
  2: 'Sync',
};

const emptyDraft: CollectionDraft = {
  name: '',
  enabled: true,
  syncMode: 0,
  rulesText: '[\n  {\n    "Builder": "",\n    "Kind": 0,\n    "Options": {}\n  }\n]',
};

export default function Collections() {
  const navigate = useNavigate();
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [preview, setPreview] = useState<CollectionPreview | null>(null);
  const [draft, setDraft] = useState<CollectionDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setCollections(await collectionsApi.list());
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate('/login');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load collections.');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handlePreview(collection: CollectionSummary) {
    setPreviewing(collection.ID);
    setError(null);
    try {
      setPreview(await collectionsApi.preview(collection.ID));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed.');
    } finally {
      setPreviewing(null);
    }
  }

  async function handleSync(id: string) {
    setSyncing(id);
    setError(null);
    try {
      await collectionsApi.sync(id, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync dry run failed.');
    } finally {
      setSyncing(null);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    setError(null);
    try {
      await collectionsApi.delete(id);
      setCollections(prev => prev.filter(c => c.ID !== id));
      setPreview(current => current?.Collection.ID === id ? null : current);
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setDeleting(null);
    }
  }

  async function openEdit(collection: CollectionSummary) {
    setFormError(null);
    try {
      const full = await collectionsApi.get(collection.ID);
      setDraft(fromCollection(full));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load collection.');
    }
  }

  function openCreate() {
    setFormError(null);
    setDraft(emptyDraft);
  }

  function closeForm() {
    setDraft(null);
    setFormError(null);
  }

  function updateDraft(update: Partial<CollectionDraft>) {
    setDraft(current => current ? { ...current, ...update } : current);
  }

  function buildPayload(current: CollectionDraft): Partial<CollectionDefinition> {
    const rules = parseRules(current.rulesText);
    return {
      Name: current.name.trim(),
      Enabled: current.enabled,
      SyncMode: current.syncMode,
      Rules: rules,
    };
  }

  async function handleSaveDraft() {
    if (!draft) return;
    setSaving(true);
    setFormError(null);
    try {
      const payload = buildPayload(draft);
      if (draft.id) {
        await collectionsApi.update(draft.id, payload);
      } else {
        await collectionsApi.create(payload);
      }
      closeForm();
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePreviewDraft() {
    if (!draft) return;
    setSaving(true);
    setFormError(null);
    try {
      setPreview(await collectionsApi.previewDefinition(buildPayload(draft)));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Preview failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Collection</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={load}>Refresh</Button>
          <Button size="sm" onClick={openCreate}>Add Collection</Button>
        </div>
      </div>

      {error && (
        <div className="app-card rounded-md border-red-700/50 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {preview && <PreviewPanel preview={preview} onClose={() => setPreview(null)} />}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        </div>
      ) : collections.length === 0 ? (
        <div className="app-card rounded-md px-5 py-16 text-center">
          <p className="text-sm text-gray-500">No collections configured.</p>
          <p className="mt-1 text-xs text-gray-600">Collections are managed via the server configuration.</p>
        </div>
      ) : (
        <div className="app-card divide-y divide-gray-800/50 rounded-md">
          {collections.map(c => (
            <div key={c.ID} className="flex items-start justify-between gap-4 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="truncate text-sm font-medium text-gray-100">{c.Name}</h3>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                      c.Enabled
                        ? 'bg-blue-600/20 text-blue-400'
                        : 'bg-gray-800 text-gray-500'
                    }`}
                  >
                    {c.Enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-4 text-xs text-gray-500">
                  <span>Mode: {syncModeLabel(c.SyncMode)}</span>
                  <span>{c.Rules?.length ?? 0} rules</span>
                  {c.ItemCount != null && <span>{c.ItemCount} items</span>}
                  {c.LastSynced && (
                    <span>Last sync: {new Date(c.LastSynced).toLocaleString()}</span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => openEdit(c)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={previewing === c.ID}
                  onClick={() => handlePreview(c)}
                >
                  {previewing === c.ID ? 'Previewing...' : 'Preview'}
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={syncing === c.ID}
                  onClick={() => handleSync(c.ID)}
                >
                  {syncing === c.ID ? 'Running...' : 'Sync Dry Run'}
                </Button>
                {confirmDeleteId === c.ID ? (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={deleting === c.ID}
                      onClick={() => handleDelete(c.ID)}
                    >
                      <Check size={13} className="mr-1" />
                      {deleting === c.ID ? 'Deleting…' : 'Confirm'}
                    </Button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="rounded p-1.5 text-gray-500 hover:text-gray-300 transition-colors"
                      title="Cancel"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setConfirmDeleteId(c.ID)}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {draft && (
        <CollectionModal
          draft={draft}
          error={formError}
          saving={saving}
          updateDraft={updateDraft}
          onClose={closeForm}
          onPreview={handlePreviewDraft}
          onSave={handleSaveDraft}
        />
      )}
    </div>
  );
}

function CollectionModal({
  draft,
  error,
  saving,
  updateDraft,
  onClose,
  onPreview,
  onSave,
}: {
  draft: CollectionDraft;
  error: string | null;
  saving: boolean;
  updateDraft: (update: Partial<CollectionDraft>) => void;
  onClose: () => void;
  onPreview: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="app-surface max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-md p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">{draft.id ? 'Edit Collection' : 'Add Collection'}</h2>
          <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
        </div>

        {error && (
          <div className="mb-5 rounded-md border border-red-500/50 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="space-y-5">
          <label className="block">
            <span className="mb-1 block text-sm text-gray-300">Name</span>
            <TextInput value={draft.name} onChange={e => updateDraft({ name: e.target.value })} />
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm text-gray-300">Sync Mode</span>
              <Select
                value={String(draft.syncMode)}
                onChange={e => updateDraft({ syncMode: Number(e.target.value) as CollectionSyncMode })}
              >
                <option value="0">Preview</option>
                <option value="1">Append</option>
                <option value="2">Sync</option>
              </Select>
            </label>

            <div className="flex items-end justify-between rounded-md border border-gray-700/50 bg-gray-950/40 px-3 py-2">
              <span className="text-sm text-gray-300">Enabled</span>
              <Toggle checked={draft.enabled} onChange={enabled => updateDraft({ enabled })} />
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm text-gray-300">Rules JSON</span>
            <textarea
              value={draft.rulesText}
              onChange={e => updateDraft({ rulesText: e.target.value })}
              rows={10}
              className="app-focus w-full rounded-md border border-gray-700 bg-gray-900/70 px-3 py-2 font-mono text-xs text-gray-100 placeholder:text-gray-500"
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-gray-700/50 pt-5">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="secondary" disabled={saving} onClick={onPreview}>
            {saving ? 'Working...' : 'Preview'}
          </Button>
          <Button disabled={saving} onClick={onSave}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PreviewPanel({ preview, onClose }: { preview: CollectionPreview; onClose: () => void }) {
  return (
    <div className="app-card rounded-md">
      <div className="flex items-start justify-between gap-4 border-b border-gray-700/50 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-100">{preview.Collection.Name}</h2>
          <p className="mt-1 text-xs text-gray-500">
            {preview.Items.length} matched items · {preview.Warnings.length} warnings
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
      </div>
      {preview.Warnings.length > 0 && (
        <div className="border-b border-gray-700/50 px-5 py-3">
          {preview.Warnings.map(warning => (
            <p key={warning} className="text-xs text-yellow-400">{warning}</p>
          ))}
        </div>
      )}
      <div className="max-h-80 divide-y divide-gray-800/50 overflow-y-auto">
        {preview.Items.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-gray-500">No items matched.</p>
        ) : (
          preview.Items.slice(0, 50).map((item, index) => (
            <div key={`${item.Title}-${index}`} className="px-5 py-3">
              <p className="text-sm text-gray-200">{item.Title || 'Untitled'}</p>
              {item.Summary && <p className="mt-1 text-xs text-gray-500">{item.Summary}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function fromCollection(collection: CollectionDefinition): CollectionDraft {
  return {
    id: collection.ID,
    name: collection.Name,
    enabled: collection.Enabled,
    syncMode: normalizeSyncMode(collection.SyncMode),
    rulesText: JSON.stringify(collection.Rules ?? [], null, 2),
  };
}

function parseRules(value: string): CollectionRule[] {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('Rules JSON must be an array.');
  }
  return parsed.map((rule, index) => {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
      throw new Error(`Rule ${index + 1} must be an object.`);
    }
    const record = rule as Record<string, unknown>;
    if (typeof record.Builder !== 'string') {
      throw new Error(`Rule ${index + 1} must include a Builder string.`);
    }
    const options = record.Options;
    return {
      Builder: record.Builder,
      Kind: typeof record.Kind === 'number' ? record.Kind : 0,
      Options: isStringRecord(options) ? options : {},
    };
  });
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every(item => typeof item === 'string');
}

function normalizeSyncMode(value: number): CollectionSyncMode {
  return value === 1 || value === 2 ? value : 0;
}

function syncModeLabel(value: number): string {
  return syncModeLabels[normalizeSyncMode(value)];
}
