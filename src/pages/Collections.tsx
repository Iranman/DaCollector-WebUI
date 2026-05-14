import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Eye,
  Library,
  ListChecks,
  Play,
  Plus,
  RefreshCw,
  Save,
  Server,
  Trash2,
  X,
} from 'lucide-react';
import {
  collectionBuilderApi,
  CollectionBuilderDescriptor,
  CollectionDefinition,
  CollectionPreview,
  CollectionPreviewItem,
  CollectionRule,
  CollectionSummary,
  CollectionSyncMode,
  CollectionSyncResult,
  collectionsApi,
  MediaKind,
} from '../api/collections';
import { dacollectorStatusApi, PlexTargetConnectionStatus } from '../api/dacollectorStatus';
import { ApiError } from '../api/client';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import TextInput from '../components/ui/TextInput';
import Toggle from '../components/ui/Toggle';

interface CollectionRuleDraft {
  DraftID: string;
  Builder: string;
  Kind: MediaKind;
  Options: Record<string, string>;
}

interface CollectionDraft {
  id?: string;
  name: string;
  enabled: boolean;
  syncMode: CollectionSyncMode;
  rules: CollectionRuleDraft[];
}

interface BuilderOptionField {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'number' | 'textarea';
  required?: boolean;
}

const syncModeLabels: Record<CollectionSyncMode, string> = {
  0: 'Preview',
  1: 'Append',
  2: 'Sync',
};

const mediaKinds: Array<{ value: MediaKind; label: string }> = [
  { value: 0, label: 'Auto' },
  { value: 1, label: 'Movies' },
  { value: 2, label: 'Shows' },
  { value: 5, label: 'Collection' },
];

const defaultOptionFields: BuilderOptionField[] = [
  { key: 'limit', label: 'Limit', type: 'number', placeholder: '20' },
];

function makeDraftID() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emptyRule(builders: CollectionBuilderDescriptor[]): CollectionRuleDraft {
  const builder = builders[0];
  return {
    DraftID: makeDraftID(),
    Builder: builder?.Name ?? '',
    Kind: normalizeMediaKind(builder?.Kind ?? 0),
    Options: defaultOptionsForBuilder(builder?.Name ?? ''),
  };
}

function emptyDraft(builders: CollectionBuilderDescriptor[]): CollectionDraft {
  return {
    name: '',
    enabled: true,
    syncMode: 0,
    rules: [emptyRule(builders)],
  };
}

export default function Collections() {
  const navigate = useNavigate();
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [builders, setBuilders] = useState<CollectionBuilderDescriptor[]>([]);
  const [plexStatus, setPlexStatus] = useState<PlexTargetConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [applying, setApplying] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [preview, setPreview] = useState<CollectionPreview | null>(null);
  const [syncResult, setSyncResult] = useState<CollectionSyncResult | null>(null);
  const [lastDryRun, setLastDryRun] = useState<CollectionSyncResult | null>(null);
  const [draft, setDraft] = useState<CollectionDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [collectionResult, builderResult, plexResult] = await Promise.all([
        collectionsApi.list(),
        collectionBuilderApi.list(),
        dacollectorStatusApi.getPlex(),
      ]);
      setCollections(collectionResult);
      setBuilders(builderResult);
      setPlexStatus(plexResult);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate('/login');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load collections.');
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  const builderMap = useMemo(
    () => new Map(builders.map(builder => [builder.Name, builder])),
    [builders]
  );

  async function handlePreview(collection: CollectionSummary) {
    setPreviewing(collection.ID);
    setError(null);
    setNotice(null);
    try {
      setPreview(await collectionsApi.preview(collection.ID));
      setSyncResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed.');
    } finally {
      setPreviewing(null);
    }
  }

  async function handleDryRun(collection: CollectionSummary) {
    setSyncing(collection.ID);
    setError(null);
    setNotice(null);
    try {
      const result = await collectionsApi.sync(collection.ID, false);
      setSyncResult(result);
      setLastDryRun(result);
      setPreview(null);
      setNotice(`Dry run finished for ${result.Collection.Name}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync dry run failed.');
    } finally {
      setSyncing(null);
    }
  }

  async function handleApply(collection: CollectionSummary) {
    if (lastDryRun?.Collection.ID !== collection.ID) {
      setError('Run a dry run before applying this collection.');
      return;
    }

    const message = [
      `Apply ${collection.Name} to the configured Plex library?`,
      `Dry run: ${lastDryRun.AddedItemCount} add, ${lastDryRun.RemovedItemCount} remove, ${lastDryRun.MissingItemCount} missing.`,
      'Continue?',
    ].join('\n');
    if (!window.confirm(message)) return;

    setApplying(collection.ID);
    setError(null);
    setNotice(null);
    try {
      const result = await collectionsApi.sync(collection.ID, true);
      setSyncResult(result);
      setLastDryRun(null);
      setPreview(null);
      setNotice(`Apply finished for ${result.Collection.Name}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Apply failed.');
    } finally {
      setApplying(null);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    setError(null);
    try {
      await collectionsApi.delete(id);
      setCollections(prev => prev.filter(collection => collection.ID !== id));
      setPreview(current => current?.Collection.ID === id ? null : current);
      setSyncResult(current => current?.Collection.ID === id ? null : current);
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
    setDraft(emptyDraft(builders));
  }

  function closeForm() {
    setDraft(null);
    setFormError(null);
  }

  function updateDraft(update: Partial<CollectionDraft>) {
    setDraft(current => current ? { ...current, ...update } : current);
  }

  function updateRule(draftID: string, update: Partial<CollectionRuleDraft>) {
    setDraft(current => current ? {
      ...current,
      rules: current.rules.map(rule => {
        if (rule.DraftID !== draftID) return rule;
        if (update.Builder && update.Builder !== rule.Builder) {
          const descriptor = builderMap.get(update.Builder);
          return {
            ...rule,
            ...update,
            Kind: normalizeMediaKind(descriptor?.Kind ?? 0),
            Options: defaultOptionsForBuilder(update.Builder),
          };
        }
        return { ...rule, ...update };
      }),
    } : current);
  }

  function updateRuleOption(draftID: string, key: string, value: string) {
    setDraft(current => current ? {
      ...current,
      rules: current.rules.map(rule => rule.DraftID === draftID
        ? { ...rule, Options: { ...rule.Options, [key]: value } }
        : rule
      ),
    } : current);
  }

  function addRule() {
    setDraft(current => current ? { ...current, rules: [...current.rules, emptyRule(builders)] } : current);
  }

  function removeRule(draftID: string) {
    setDraft(current => current ? { ...current, rules: current.rules.filter(rule => rule.DraftID !== draftID) } : current);
  }

  function buildPayload(current: CollectionDraft): Partial<CollectionDefinition> {
    const errors = validateDraft(current, builderMap);
    if (errors.length > 0) throw new Error(errors.join(' '));
    return {
      Name: current.name.trim(),
      Enabled: current.enabled,
      SyncMode: current.syncMode,
      Rules: current.rules.map(toCollectionRule),
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
      setNotice('Collection saved.');
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
      setSyncResult(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Preview failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Collections</h1>
          <p className="mt-0.5 text-xs text-gray-500">Manage provider-built collections and Plex sync previews.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={load}>
            <RefreshCw size={13} className="mr-1.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreate} disabled={builders.length === 0}>
            <Plus size={13} className="mr-1.5" />
            Add Collection
          </Button>
        </div>
      </div>

      {notice && (
        <div className="app-card px-4 py-3 text-sm text-blue-300">{notice}</div>
      )}
      {error && (
        <div className="app-card rounded-md border-red-700/50 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <PlexReadinessPanel plexStatus={plexStatus} />

      {preview && <PreviewPanel preview={preview} onClose={() => setPreview(null)} />}
      {syncResult && <SyncResultPanel result={syncResult} onClose={() => setSyncResult(null)} />}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        </div>
      ) : collections.length === 0 ? (
        <div className="app-card rounded-md px-5 py-16 text-center">
          <Library size={32} className="mx-auto mb-3 text-gray-700" />
          <p className="text-sm text-gray-500">No collections configured.</p>
          <p className="mt-1 text-xs text-gray-600">Create a collection from provider-backed builder rules.</p>
        </div>
      ) : (
        <div className="app-card divide-y divide-gray-800/50 rounded-md">
          {collections.map(collection => {
            const canApply = collection.SyncMode !== 0 && lastDryRun?.Collection.ID === collection.ID && plexStatus?.Ready;
            return (
              <div key={collection.ID} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="truncate text-sm font-medium text-gray-100">{collection.Name}</h3>
                      <StatePill active={collection.Enabled}>{collection.Enabled ? 'Enabled' : 'Disabled'}</StatePill>
                      <span className="rounded bg-gray-800 px-2 py-1 text-xs text-gray-400">
                        {syncModeLabel(collection.SyncMode)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                      <span>{collection.Rules?.length ?? 0} rules</span>
                      {collection.ItemCount != null && <span>{collection.ItemCount} items</span>}
                      {collection.LastSynced && <span>Last sync: {formatDateTime(collection.LastSynced)}</span>}
                    </div>
                    <RuleSummaryList rules={collection.Rules ?? []} builders={builderMap} />
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    <Button size="sm" variant="secondary" onClick={() => openEdit(collection)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="secondary" disabled={previewing === collection.ID} onClick={() => handlePreview(collection)}>
                      <Eye size={13} className="mr-1.5" />
                      {previewing === collection.ID ? 'Previewing...' : 'Preview'}
                    </Button>
                    <Button size="sm" variant="secondary" disabled={syncing === collection.ID} onClick={() => handleDryRun(collection)}>
                      <ListChecks size={13} className="mr-1.5" />
                      {syncing === collection.ID ? 'Running...' : 'Dry Run'}
                    </Button>
                    <Button size="sm" disabled={applying === collection.ID || !canApply} onClick={() => handleApply(collection)}>
                      <Play size={13} className="mr-1.5" />
                      {applying === collection.ID ? 'Applying...' : 'Apply'}
                    </Button>
                    {confirmDeleteId === collection.ID ? (
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="destructive" disabled={deleting === collection.ID} onClick={() => handleDelete(collection.ID)}>
                          <Check size={13} className="mr-1" />
                          {deleting === collection.ID ? 'Deleting...' : 'Confirm'}
                        </Button>
                        <button type="button" onClick={() => setConfirmDeleteId(null)} className="rounded p-1.5 text-gray-500 transition-colors hover:text-gray-300" title="Cancel">
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <Button size="sm" variant="destructive" onClick={() => setConfirmDeleteId(collection.ID)}>
                        <Trash2 size={13} className="mr-1.5" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {draft && (
        <CollectionModal
          draft={draft}
          builders={builders}
          builderMap={builderMap}
          error={formError}
          saving={saving}
          updateDraft={updateDraft}
          updateRule={updateRule}
          updateRuleOption={updateRuleOption}
          addRule={addRule}
          removeRule={removeRule}
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
  builders,
  builderMap,
  error,
  saving,
  updateDraft,
  updateRule,
  updateRuleOption,
  addRule,
  removeRule,
  onClose,
  onPreview,
  onSave,
}: {
  draft: CollectionDraft;
  builders: CollectionBuilderDescriptor[];
  builderMap: Map<string, CollectionBuilderDescriptor>;
  error: string | null;
  saving: boolean;
  updateDraft: (update: Partial<CollectionDraft>) => void;
  updateRule: (draftID: string, update: Partial<CollectionRuleDraft>) => void;
  updateRuleOption: (draftID: string, key: string, value: string) => void;
  addRule: () => void;
  removeRule: (draftID: string) => void;
  onClose: () => void;
  onPreview: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="app-surface max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-md p-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-white">{draft.id ? 'Edit Collection' : 'Add Collection'}</h2>
          <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
        </div>

        {error && (
          <div className="mb-5 rounded-md border border-red-500/50 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[18rem_1fr]">
          <div className="space-y-5">
            <label className="block">
              <span className="mb-1 block text-sm text-gray-300">Name</span>
              <TextInput value={draft.name} onChange={event => updateDraft({ name: event.target.value })} />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm text-gray-300">Sync Mode</span>
              <Select
                value={String(draft.syncMode)}
                onChange={event => updateDraft({ syncMode: Number(event.target.value) as CollectionSyncMode })}
              >
                <option value="0">Preview</option>
                <option value="1">Append</option>
                <option value="2">Sync</option>
              </Select>
            </label>

            <div className="flex items-center justify-between rounded-md border border-gray-700/50 bg-gray-950/40 px-3 py-2">
              <span className="text-sm text-gray-300">Enabled</span>
              <Toggle checked={draft.enabled} onChange={enabled => updateDraft({ enabled })} />
            </div>

            <div className="rounded-md border border-gray-800 bg-gray-950/30 p-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Rules</div>
              <div className="mt-1 text-lg font-semibold text-white">{draft.rules.length}</div>
            </div>
          </div>

          <div className="space-y-4">
            {draft.rules.map((rule, index) => (
              <CollectionRuleEditor
                key={rule.DraftID}
                rule={rule}
                index={index}
                builders={builders}
                builder={builderMap.get(rule.Builder)}
                canRemove={draft.rules.length > 1}
                updateRule={update => updateRule(rule.DraftID, update)}
                updateOption={(key, value) => updateRuleOption(rule.DraftID, key, value)}
                removeRule={() => removeRule(rule.DraftID)}
              />
            ))}

            <Button size="sm" variant="secondary" onClick={addRule}>
              <Plus size={13} className="mr-1.5" />
              Add Rule
            </Button>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-gray-700/50 pt-5">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="secondary" disabled={saving} onClick={onPreview}>
            <Eye size={14} className="mr-1.5" />
            {saving ? 'Working...' : 'Preview'}
          </Button>
          <Button disabled={saving} onClick={onSave}>
            <Save size={14} className="mr-1.5" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CollectionRuleEditor({
  rule,
  index,
  builders,
  builder,
  canRemove,
  updateRule,
  updateOption,
  removeRule,
}: {
  rule: CollectionRuleDraft;
  index: number;
  builders: CollectionBuilderDescriptor[];
  builder?: CollectionBuilderDescriptor;
  canRemove: boolean;
  updateRule: (update: Partial<CollectionRuleDraft>) => void;
  updateOption: (key: string, value: string) => void;
  removeRule: () => void;
}) {
  const fields = getBuilderFields(rule.Builder);
  const allowKindSelection = builder?.Kind === 0 || rule.Builder === 'tvdb_list' || rule.Builder === 'tmdb_discover';

  return (
    <section className="rounded-md border border-gray-800 bg-gray-950/30">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-800 px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-gray-100">Rule {index + 1}</h3>
          <p className="mt-0.5 text-xs text-gray-500">{builder?.Description ?? 'Choose a builder.'}</p>
        </div>
        {canRemove && (
          <button type="button" onClick={removeRule} className="text-gray-500 transition-colors hover:text-red-400" title="Remove rule">
            <Trash2 size={15} />
          </button>
        )}
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm text-gray-300">Builder</span>
          <Select value={rule.Builder} onChange={event => updateRule({ Builder: event.target.value })}>
            {builders.map(item => (
              <option key={item.Name} value={item.Name}>{builderLabel(item)}</option>
            ))}
          </Select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-gray-300">Media</span>
          <Select
            value={String(rule.Kind)}
            disabled={!allowKindSelection}
            onChange={event => updateRule({ Kind: Number(event.target.value) as MediaKind })}
          >
            {mediaKinds.map(kind => (
              <option key={kind.value} value={String(kind.value)}>{kind.label}</option>
            ))}
          </Select>
        </label>

        {fields.map(field => (
          <OptionInput
            key={field.key}
            field={field}
            value={rule.Options[field.key] ?? ''}
            updateOption={updateOption}
          />
        ))}
      </div>
      <div className="border-t border-gray-800 px-4 py-3 text-xs text-gray-500">
        {describeRule(toCollectionRule(rule), builder)}
      </div>
    </section>
  );
}

function OptionInput({
  field,
  value,
  updateOption,
}: {
  field: BuilderOptionField;
  value: string;
  updateOption: (key: string, value: string) => void;
}) {
  return (
    <label className={field.type === 'textarea' ? 'block md:col-span-2' : 'block'}>
      <span className="mb-1 block text-sm text-gray-300">
        {field.label}{field.required ? ' *' : ''}
      </span>
      {field.type === 'textarea' ? (
        <textarea
          value={value}
          onChange={event => updateOption(field.key, event.target.value)}
          rows={3}
          placeholder={field.placeholder}
          className="app-focus w-full rounded-md border border-gray-700 bg-gray-900/70 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500"
        />
      ) : (
        <TextInput
          value={value}
          type={field.type ?? 'text'}
          onChange={event => updateOption(field.key, event.target.value)}
          placeholder={field.placeholder}
        />
      )}
    </label>
  );
}

function PlexReadinessPanel({ plexStatus }: { plexStatus: PlexTargetConnectionStatus | null }) {
  if (!plexStatus) return null;
  const configuredSection = plexStatus.SectionKey
    ? plexStatus.Libraries.find(section => section.Key === plexStatus.SectionKey)
    : undefined;

  return (
    <section className="app-card grid gap-4 p-5 md:grid-cols-[1fr_1fr_1fr]">
      <StatusMetric icon={<Server size={16} />} label="Plex" value={plexStatus.Reachable ? 'Reachable' : 'Unavailable'} active={plexStatus.Reachable} />
      <StatusMetric icon={<Library size={16} />} label="Library" value={configuredSection?.Title ?? plexStatus.SectionKey ?? 'Not configured'} active={Boolean(configuredSection)} />
      <StatusMetric icon={<CheckCircle2 size={16} />} label="Sync Target" value={plexStatus.Ready ? 'Ready' : 'Blocked'} active={plexStatus.Ready} />
      {plexStatus.Warnings.length > 0 && (
        <div className="md:col-span-3">
          {plexStatus.Warnings.map(warning => (
            <p key={warning} className="flex items-center gap-1.5 text-xs text-yellow-300">
              <AlertTriangle size={12} />
              {warning}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

function StatusMetric({
  icon,
  label,
  value,
  active,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  active: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={active ? 'text-blue-400' : 'text-gray-600'}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-xs uppercase tracking-wide text-gray-500">{label}</span>
        <span className="block truncate text-sm font-medium text-gray-100">{value}</span>
      </span>
    </div>
  );
}

function PreviewPanel({ preview, onClose }: { preview: CollectionPreview; onClose: () => void }) {
  return (
    <section className="app-card rounded-md">
      <div className="flex items-start justify-between gap-4 border-b border-gray-700/50 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-100">{preview.Collection.Name}</h2>
          <p className="mt-1 text-xs text-gray-500">
            {preview.Items.length} matched items - {preview.Warnings.length} warnings
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
      </div>
      <WarningList warnings={preview.Warnings} />
      <PreviewItemList items={preview.Items} />
    </section>
  );
}

function SyncResultPanel({ result, onClose }: { result: CollectionSyncResult; onClose: () => void }) {
  return (
    <section className="app-card rounded-md">
      <div className="flex items-start justify-between gap-4 border-b border-gray-700/50 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-100">{result.Collection.Name}</h2>
          <p className="mt-1 text-xs text-gray-500">
            {syncModeLabel(result.EffectiveSyncMode)} on {result.Target} - {result.Applied ? 'applied' : 'dry run'}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
      </div>
      <div className="grid gap-4 border-b border-gray-800/70 px-5 py-4 md:grid-cols-4">
        <SummaryCard label="Items" value={result.Items.length} />
        <SummaryCard label="Matched" value={result.MatchedItemCount} />
        <SummaryCard label="Missing" value={result.MissingItemCount} />
        <SummaryCard label="Diff" value={`+${result.AddedItemCount} / -${result.RemovedItemCount}`} />
      </div>
      <WarningList warnings={result.Warnings} />
      {result.PlexDiff && (
        <div className="grid gap-4 border-b border-gray-800/70 px-5 py-4 md:grid-cols-3">
          <SummaryCard label="Existing" value={result.PlexDiff.ExistingItemCount} />
          <SummaryCard label="Unchanged" value={result.PlexDiff.UnchangedItemCount} />
          <SummaryCard label="Plex Missing" value={result.PlexDiff.Match.Missing.length} />
        </div>
      )}
      <PreviewItemList items={result.Items} />
    </section>
  );
}

function PreviewItemList({ items }: { items: CollectionPreviewItem[] }) {
  return (
    <div className="max-h-80 divide-y divide-gray-800/50 overflow-y-auto">
      {items.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-gray-500">No items matched.</p>
      ) : (
        items.slice(0, 75).map((item, index) => (
          <div key={`${item.Title}-${index}`} className="px-5 py-3">
            <p className="text-sm text-gray-200">{item.Title || 'Untitled'}</p>
            <p className="mt-1 text-xs text-gray-500">
              {externalIdLabel(item.ExternalID)}{item.Summary ? ` - ${item.Summary}` : ''}
            </p>
          </div>
        ))
      )}
      {items.length > 75 && (
        <p className="px-5 py-3 text-xs text-gray-500">{items.length - 75} more items not shown.</p>
      )}
    </div>
  );
}

function WarningList({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="space-y-1 border-b border-gray-700/50 px-5 py-3">
      {warnings.map(warning => (
        <p key={warning} className="flex items-center gap-1.5 text-xs text-yellow-300">
          <AlertTriangle size={12} />
          {warning}
        </p>
      ))}
    </div>
  );
}

function RuleSummaryList({
  rules,
  builders,
}: {
  rules: CollectionRule[];
  builders: Map<string, CollectionBuilderDescriptor>;
}) {
  if (rules.length === 0) {
    return <p className="text-xs text-gray-600">No rules configured.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {rules.slice(0, 4).map((rule, index) => (
        <span key={`${rule.Builder}-${index}`} className="rounded bg-gray-900/70 px-2 py-1 text-xs text-gray-400">
          {describeRule(rule, builders.get(rule.Builder))}
        </span>
      ))}
      {rules.length > 4 && <span className="rounded bg-gray-900/70 px-2 py-1 text-xs text-gray-500">+{rules.length - 4} more</span>}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-gray-800 bg-gray-950/30 p-3">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function StatePill({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${active ? 'bg-blue-600/20 text-blue-400' : 'bg-gray-800 text-gray-500'}`}>
      {children}
    </span>
  );
}

function fromCollection(collection: CollectionDefinition): CollectionDraft {
  return {
    id: collection.ID,
    name: collection.Name,
    enabled: collection.Enabled,
    syncMode: normalizeSyncMode(collection.SyncMode),
    rules: (collection.Rules ?? []).map(rule => ({
      DraftID: makeDraftID(),
      Builder: rule.Builder,
      Kind: normalizeMediaKind(rule.Kind ?? 0),
      Options: { ...(rule.Options ?? {}) },
    })),
  };
}

function toCollectionRule(rule: CollectionRuleDraft): CollectionRule {
  return {
    Builder: rule.Builder,
    Kind: normalizeMediaKind(rule.Kind),
    Options: cleanupOptions(rule.Options),
  };
}

function cleanupOptions(options: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(options)
      .map(([key, value]) => [key, value.trim()] as const)
      .filter(([, value]) => value.length > 0)
  );
}

function validateDraft(draft: CollectionDraft, builders: Map<string, CollectionBuilderDescriptor>) {
  const errors: string[] = [];
  if (!draft.name.trim()) errors.push('Collection name is required.');
  if (draft.rules.length === 0) errors.push('At least one rule is required.');
  draft.rules.forEach((rule, index) => {
    const builder = builders.get(rule.Builder);
    if (!builder) errors.push(`Rule ${index + 1} must choose a valid builder.`);
    if (builderNeedsIds(rule.Builder) && !hasOptionValue(rule.Options, 'ids')) {
      errors.push(`Rule ${index + 1} requires provider IDs.`);
    }
    for (const key of ['limit', 'page', 'year', 'min_vote_count']) {
      const value = rule.Options[key];
      if (value && (!Number.isInteger(Number(value)) || Number(value) <= 0)) {
        errors.push(`Rule ${index + 1} has an invalid ${key}.`);
      }
    }
    const minVote = rule.Options.min_vote_average;
    if (minVote && Number.isNaN(Number(minVote))) {
      errors.push(`Rule ${index + 1} has an invalid minimum vote average.`);
    }
  });
  return errors;
}

function hasOptionValue(options: Record<string, string>, key: string) {
  return Boolean(options[key]?.trim());
}

function getBuilderFields(builderName: string): BuilderOptionField[] {
  const fields: BuilderOptionField[] = [];
  if (builderNeedsIds(builderName)) {
    fields.push({
      key: 'ids',
      label: idLabel(builderName),
      placeholder: 'Comma-separated provider IDs',
      type: 'textarea',
      required: true,
    });
  }

  if (!isSpecificIdBuilder(builderName)) {
    fields.push(...defaultOptionFields);
  }

  if (builderName.startsWith('tmdb_') && !isSpecificIdBuilder(builderName)) {
    fields.push(
      { key: 'page', label: 'Page', type: 'number', placeholder: '1' },
      { key: 'language', label: 'Language', placeholder: 'en-US' },
      { key: 'region', label: 'Region', placeholder: 'US' }
    );
  }

  if (builderName === 'tmdb_discover') {
    fields.push(
      { key: 'year', label: 'Year', type: 'number' },
      { key: 'genres', label: 'Genres', placeholder: '28, 878' },
      { key: 'min_vote_average', label: 'Min Vote', type: 'number', placeholder: '7.0' },
      { key: 'min_vote_count', label: 'Min Votes', type: 'number', placeholder: '100' },
      { key: 'original_language', label: 'Original Language', placeholder: 'en' },
      { key: 'sort_by', label: 'Sort', placeholder: 'popularity.desc' }
    );
  }

  return fields;
}

function defaultOptionsForBuilder(builderName: string) {
  const options: Record<string, string> = {};
  if (!isSpecificIdBuilder(builderName)) options.limit = '20';
  if (builderName.startsWith('tmdb_') && !isSpecificIdBuilder(builderName)) {
    options.page = '1';
    options.language = 'en-US';
  }
  return options;
}

function builderNeedsIds(builderName: string) {
  return isSpecificIdBuilder(builderName) || builderName === 'tvdb_list';
}

function isSpecificIdBuilder(builderName: string) {
  return ['tmdb_movie', 'tmdb_show', 'tmdb_collection', 'tvdb_movie', 'tvdb_show'].includes(builderName);
}

function idLabel(builderName: string) {
  if (builderName === 'tmdb_collection') return 'TMDB Collection IDs';
  if (builderName.startsWith('tmdb_')) return 'TMDB IDs';
  if (builderName === 'tvdb_list') return 'TVDB List IDs';
  return 'TVDB IDs';
}

function builderLabel(builder: CollectionBuilderDescriptor) {
  return `${providerLabel(builder.Provider)} - ${builder.Name.replace(/_/g, ' ')}`;
}

function describeRule(rule: CollectionRule, builder?: CollectionBuilderDescriptor) {
  const parts = [(builder?.Name ?? rule.Builder) || 'Unknown builder'];
  if (rule.Kind != null && rule.Kind !== 0) parts.push(mediaKindLabel(rule.Kind));
  const options = rule.Options ?? {};
  if (options.ids) parts.push(`IDs ${compactValue(options.ids)}`);
  if (options.limit) parts.push(`limit ${options.limit}`);
  if (options.year) parts.push(String(options.year));
  if (options.genres) parts.push(`genres ${compactValue(options.genres)}`);
  return parts.join(' - ');
}

function compactValue(value: string) {
  return value.length > 28 ? `${value.slice(0, 25)}...` : value;
}

function providerLabel(provider: number | string) {
  if (provider === 2 || provider === 'TMDB') return 'TMDB';
  if (provider === 4 || provider === 'TVDB') return 'TVDB';
  if (provider === 3 || provider === 'IMDb') return 'IMDb';
  return String(provider || 'Provider');
}

function mediaKindLabel(kind: number | string) {
  if (kind === 1 || kind === 'Movie') return 'Movies';
  if (kind === 2 || kind === 'Show') return 'Shows';
  if (kind === 5 || kind === 'Collection') return 'Collections';
  return 'Auto';
}

function normalizeMediaKind(value: number): MediaKind {
  return value === 1 || value === 2 || value === 5 ? value : 0;
}

function normalizeSyncMode(value: number): CollectionSyncMode {
  return value === 1 || value === 2 ? value : 0;
}

function syncModeLabel(value: number): string {
  return syncModeLabels[normalizeSyncMode(value)];
}

function externalIdLabel(value?: CollectionPreviewItem['ExternalID']) {
  if (!value) return 'Provider ID unavailable';
  const provider = value.Provider != null ? providerLabel(value.Provider) : 'Provider';
  const kind = value.Kind != null ? mediaKindLabel(value.Kind) : 'Media';
  return `${provider} ${kind}${value.Value ? ` ${value.Value}` : ''}`;
}

function formatDateTime(value?: string) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
