import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Archive, Check, Info, Image as ImageIcon, KeyRound, Link2, Palette, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { ApiError } from '../api/client';
import { configurationApi, ConfigurationInfo } from '../api/configuration';
import { databaseApi, DatabaseBackupFile } from '../api/database';
import { ComponentVersion, ComponentVersionSet, initApi } from '../api/init';
import { managedFoldersApi, ManagedFolder, CreateManagedFolderBody } from '../api/managedFolders';
import { releaseInfoApi, ReleaseInfoProvider, ReleaseInfoSummary } from '../api/releaseInfo';
import { settingsApi, ServerSettings } from '../api/settings';
import { tagsApi, Tag } from '../api/tags';
import { ApiToken, tokensApi } from '../api/tokens';
import { User, CreateOrUpdateUserBody, CreateUserBody, usersApi } from '../api/users';
import { ReleaseChannel, webuiApi, WebUIBuildMetadata, WebUITheme } from '../api/webui';
import { plexTargetApi, PlexLibrarySection, PlexServerIdentity } from '../api/plexTarget';
import Button from '../components/ui/Button';
import { useConfirm } from '../components/ui/ConfirmProvider';
import SectionHeader from '../components/ui/SectionHeader';
import Select from '../components/ui/Select';
import SettingsRow from '../components/ui/SettingsRow';
import TextInput from '../components/ui/TextInput';
import Toggle from '../components/ui/Toggle';
import { useToast } from '../components/ui/ToastProvider';

type SectionId =
  | 'general'
  | 'profile'
  | 'web-ui'
  | 'import'
  | 'metadata'
  | 'collection'
  | 'integrations'
  | 'users'
  | 'api-keys'
  | 'advanced'
  | 'release-info'
  | 'database';

type SettingValue = string | number | boolean | string[] | undefined;

const sections: Array<{ id: SectionId; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'profile', label: 'Profile' },
  { id: 'web-ui', label: 'Web UI' },
  { id: 'import', label: 'Import' },
  { id: 'metadata', label: 'Metadata' },
  { id: 'collection', label: 'Collection' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'users', label: 'Users' },
  { id: 'api-keys', label: 'API Keys' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'release-info', label: 'Release Info' },
  { id: 'database', label: 'Database' },
];

const standaloneSections: SectionId[] = ['profile', 'web-ui', 'users', 'api-keys', 'advanced', 'release-info', 'database'];

const relationTypes = [
  'Dissimilar Titles',
  'Prequel',
  'Sequel',
  'OVA',
  'Movie',
  'Same Setting',
  'Alternative Setting',
  'Alternative Version',
  'Parent Story',
  'Side Story',
  'Full Story',
  'Summary',
  'Character',
  'Other',
];

const defaultExcludedRelations = ['Same Setting', 'Character', 'Other'];

export default function Settings() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { notify } = useToast();
  const { section } = useParams();
  const activeSection = normalizeSection(section);
  const [settings, setSettings] = useState<ServerSettings>({});
  const [originalSettings, setOriginalSettings] = useState<ServerSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [tokensError, setTokensError] = useState<string | null>(null);
  const [newTokenName, setNewTokenName] = useState('');
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const dirty = useMemo(
    () => !standaloneSections.includes(activeSection) && JSON.stringify(settings) !== JSON.stringify(originalSettings),
    [activeSection, originalSettings, settings]
  );

  useEffect(() => {
    settingsApi.get()
      .then(s => {
        setSettings(s);
        setOriginalSettings(s);
        setLoading(false);
      })
      .catch(err => {
        if (err instanceof ApiError && err.status === 401) {
          navigate('/login');
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load settings.');
          setLoading(false);
        }
      });
  }, [navigate]);

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (activeSection === 'api-keys') {
      loadTokens();
    }
  }, [activeSection]);

  async function loadTokens() {
    setTokensLoading(true);
    setTokensError(null);
    try {
      setTokens(await tokensApi.list());
    } catch (err) {
      setTokensError(err instanceof Error ? err.message : 'Failed to load API keys.');
    } finally {
      setTokensLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await settingsApi.update(settings);
      setOriginalSettings(settings);
      setSaved(true);
      notify({ message: 'Settings saved.', tone: 'success' });
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Save failed.';
      setError(message);
      notify({ message, title: 'Settings save failed', tone: 'error' });
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setSettings(originalSettings);
    setSaved(false);
    setError(null);
    notify({ message: 'Unsaved settings were discarded.', tone: 'info' });
  }

  async function navigateSection(sectionId: SectionId) {
    if (sectionId === activeSection) return;
    if (dirty) {
      const discard = await confirm({
        confirmLabel: 'Discard Changes',
        message: 'You have unsaved core settings changes. Discard them and switch sections?',
        title: 'Unsaved Settings',
        tone: 'warning',
      });
      if (!discard) return;
      setSettings(originalSettings);
      setSaved(false);
      setError(null);
    }
    navigate(`/settings/${sectionId}`);
  }

  async function handleGenerateToken() {
    const name = newTokenName.trim();
    if (!name) {
      setTokensError('Enter a name for the new API key.');
      return;
    }
    setTokensError(null);
    setGeneratedToken(null);
    try {
      const response = await tokensApi.create(name);
      setGeneratedToken(response.apikey ?? response.ApiKey ?? response.Token ?? null);
      setNewTokenName('');
      await loadTokens();
    } catch (err) {
      setTokensError(err instanceof Error ? err.message : 'Failed to generate API key.');
    }
  }

  async function handleDeleteToken(token?: string) {
    if (!token) {
      setTokensError('This API key response did not include a token value to delete.');
      return;
    }
    setTokensError(null);
    try {
      await tokensApi.delete(token);
      await loadTokens();
    } catch (err) {
      setTokensError(err instanceof Error ? err.message : 'Failed to delete API key.');
    }
  }

  function updateSetting(path: string[], value: SettingValue) {
    setSettings(prev => {
      const next = structuredClone(prev) as Record<string, unknown>;
      let current = next;
      for (let i = 0; i < path.length - 1; i += 1) {
        const key = path[i];
        const branch = current[key];
        if (typeof branch !== 'object' || branch === null || Array.isArray(branch)) {
          current[key] = {};
        }
        current = current[key] as Record<string, unknown>;
      }
      current[path[path.length - 1]] = value;
      return next as ServerSettings;
    });
  }

  function toggleRelation(type: string, checked: boolean) {
    const current = settings.AutoGroupSeriesRelationExclusions ?? defaultExcludedRelations;
    const next = checked ? Array.from(new Set([...current, type])) : current.filter(item => item !== type);
    updateSetting(['AutoGroupSeriesRelationExclusions'], next);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="overflow-x-hidden py-6 sm:py-8">
      <div className="mx-auto w-full min-w-0" style={{ maxWidth: 'min(64rem, calc(100vw - 5rem))' }}>
        <form onSubmit={handleSave} className="app-surface flex w-full max-w-full flex-col overflow-hidden rounded-none md:min-h-[42rem] md:flex-row">
          <aside className="w-full shrink-0 border-b border-gray-700/50 bg-[#0d0d1a]/70 py-5 md:w-52 md:border-b-0 md:border-r">
            <h1 className="px-4 pb-5 text-xl font-semibold text-white sm:px-6">Settings</h1>
            <nav className="grid grid-cols-2 gap-1 sm:grid-cols-4 md:block md:space-y-1">
              {sections.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void navigateSection(item.id)}
                  className={`block w-full border-l-2 px-4 py-2.5 text-left text-sm transition-colors sm:px-6 ${
                    activeSection === item.id
                      ? 'border-blue-500 bg-blue-600/20 text-white'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>

          <section className="flex min-w-0 flex-1 flex-col bg-[#0d0d1a]/55 p-4 sm:p-8">
            {error && <Alert tone="error">{error}</Alert>}
            {saved && <Alert tone="success">Settings saved.</Alert>}
            {dirty && (
              <Alert tone="warning">
                Unsaved changes in this settings section. Save or cancel before switching workflows.
              </Alert>
            )}

            <div className="flex-1">
              {activeSection === 'general' && (
                <GeneralSection settings={settings} />
              )}
              {activeSection === 'profile' && (
                <ProfileSection />
              )}
              {activeSection === 'web-ui' && (
                <WebUISettingsSection />
              )}
              {activeSection === 'import' && (
                <ImportSection settings={settings} updateSetting={updateSetting} />
              )}
              {activeSection === 'metadata' && (
                <MetadataSection settings={settings} updateSetting={updateSetting} />
              )}
              {activeSection === 'collection' && (
                <CollectionSection settings={settings} updateSetting={updateSetting} toggleRelation={toggleRelation} />
              )}
              {activeSection === 'integrations' && (
                <IntegrationsSection settings={settings} updateSetting={updateSetting} />
              )}
              {activeSection === 'users' && (
                <UserManagementSection />
              )}
              {activeSection === 'api-keys' && (
                <ApiKeysSection
                  tokens={tokens}
                  loading={tokensLoading}
                  error={tokensError}
                  newTokenName={newTokenName}
                  generatedToken={generatedToken}
                  setNewTokenName={setNewTokenName}
                  onGenerate={handleGenerateToken}
                  onDelete={handleDeleteToken}
                />
              )}
              {activeSection === 'advanced' && (
                <ConfigurationSummarySection
                  title="Advanced"
                  description="Review server configuration for hashing, file operations, and relocation exposed by the configuration API."
                  queries={['hash', 'avdump', 'file', 'relocation', 'rename', 'move']}
                />
              )}
              {activeSection === 'release-info' && (
                <ReleaseInfoSection />
              )}
              {activeSection === 'database' && (
                <DatabaseSection />
              )}
            </div>

            {!standaloneSections.includes(activeSection) && (
              <div className="mt-8 flex flex-wrap justify-start gap-3 border-t border-gray-700/50 pt-5 sm:justify-end">
                <Button variant="secondary" onClick={handleCancel} disabled={!dirty || saving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving || !dirty}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            )}
          </section>
        </form>
      </div>
    </div>
  );
}

function GeneralSection({
  settings,
}: {
  settings: ServerSettings;
}) {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { notify } = useToast();
  const [resetting, setResetting] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  async function pollForServerUp() {
    for (let i = 0; i < 90; i++) {
      await new Promise<void>(r => setTimeout(r, 2000));
      try {
        const status = await initApi.getStatus();
        if (status.State === 'Waiting') { navigate('/setup'); return; }
        if (status.State === 'Started') { navigate('/dashboard'); return; }
      } catch { /* server still down */ }
    }
    setReconnecting(false);
    notify({ message: 'Server did not come back in time. Refresh the page manually.', tone: 'warning' });
  }

  async function handleRestoreSetup() {
    const ok = await confirm({
      title: 'Restore Setup Wizard',
      message: 'This will save the first-run flag and restart the server into setup mode. Continue?',
      confirmLabel: 'Restore & Restart',
      tone: 'danger',
    });
    if (!ok) return;
    setResetting(true);
    try {
      const result = await initApi.resetSetup();
      if (result.Restarting) {
        setReconnecting(true);
        void pollForServerUp();
      } else {
        notify({
          message: 'Setup mode enabled. Restart the server manually to enter the setup wizard.',
          tone: 'warning',
        });
      }
    } catch (err) {
      notify({ message: err instanceof Error ? err.message : 'Reset failed.', title: 'Reset failed', tone: 'error' });
    } finally {
      setResetting(false);
    }
  }

  return (
    <>
      {reconnecting && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm">
          <div className="h-14 w-14 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="mt-6 text-xl font-semibold text-white">Server Restarting</p>
          <p className="mt-2 text-sm text-gray-400">Waiting for the setup wizard to become available…</p>
        </div>
      )}
      <div className="space-y-7">
        <SectionHeader title="General" description="Here you can find settings for version details, theme customization, notification management, and log configurations." />
        <SettingGroup title="Database Settings">
          <SettingsRow label="Database Type">
            <TextInput value={settings.Database?.Type ?? 'SQLite'} readOnly />
          </SettingsRow>
        </SettingGroup>
        <SettingGroup title="Setup">
          <SettingsRow label="Restore Setup Wizard" description="Reset the server back to first-run setup mode and restart. Use this if initial setup was skipped or needs to be re-run.">
            <Button variant="destructive" size="sm" onClick={() => void handleRestoreSetup()} disabled={resetting || reconnecting}>
              {resetting ? 'Saving…' : 'Restore'}
            </Button>
          </SettingsRow>
        </SettingGroup>
      </div>
    </>
  );
}

function ImportSection({
  settings,
  updateSetting,
}: {
  settings: ServerSettings;
  updateSetting: (path: string[], value: SettingValue) => void;
}) {
  return (
    <div className="space-y-7">
      <SectionHeader title="Import" description="Configure how DaCollector imports files into your collection, including startup scans and quality checks." />
      <SettingGroup title="Import Options">
        <ToggleRow label="Run on Start" checked={toBool(settings.Import?.RunOnStart)} onChange={v => updateSetting(['Import', 'RunOnStart'], v)} />
        <ToggleRow label="Scan Drop Folders on Start" checked={toBool(settings.Import?.ScanDropFoldersOnStart)} onChange={v => updateSetting(['Import', 'ScanDropFoldersOnStart'], v)} />
        <ToggleRow label="File Quality Check" checked={toBool(settings.FileQualityFilterEnabled)} onChange={v => updateSetting(['FileQualityFilterEnabled'], v)} />
        <SettingsRow label="Max Auto-Scan Attempts per File">
          <TextInput type="number" min={0} value={settings.Import?.MaxAutoScanAttemptsPerFile ?? 15} onChange={e => updateSetting(['Import', 'MaxAutoScanAttemptsPerFile'], Number(e.target.value))} />
        </SettingsRow>
      </SettingGroup>
      <ManagedFolderQuickAdd />
    </div>
  );
}

function ManagedFolderQuickAdd() {
  const { notify } = useToast();
  const [folders, setFolders] = useState<ManagedFolder[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newPath, setNewPath] = useState('');
  const [newName, setNewName] = useState('');
  const [watchForNew, setWatchForNew] = useState(true);

  useEffect(() => {
    managedFoldersApi.list()
      .then(setFolders)
      .catch(err => setLoadError(err instanceof Error ? err.message : 'Failed to load folders.'));
  }, []);

  async function handleAdd() {
    const path = newPath.trim();
    if (!path) {
      setAddError('Path is required.');
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      const fallbackName = path.split(/[\\/]/).filter(Boolean).pop() ?? path;
      const body: CreateManagedFolderBody = {
        Name: newName.trim() || fallbackName,
        Path: path,
        WatchForNewFiles: watchForNew,
        DropFolderType: 'None',
      };
      const created = await managedFoldersApi.create(body);
      setFolders(prev => [...prev, created]);
      setNewPath('');
      setNewName('');
      setWatchForNew(true);
      setShowForm(false);
      notify({ message: `Import folder "${created.Name}" added.`, tone: 'success' });
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add folder.');
    } finally {
      setAdding(false);
    }
  }

  return (
    <SettingGroup title="Import Folders">
      {loadError && <Alert tone="error">{loadError}</Alert>}
      {folders.length === 0 && !loadError && (
        <p className="px-1 py-2 text-sm text-gray-500">No import folders configured yet.</p>
      )}
      {folders.map(f => (
        <SettingsRow key={f.ID} label={f.Name}>
          <span className="truncate text-right text-xs text-gray-400" title={f.Path}>{f.Path}</span>
        </SettingsRow>
      ))}
      {showForm ? (
        <div className="space-y-3 rounded-md border border-gray-700/60 bg-gray-900/40 p-4">
          {addError && <Alert tone="error">{addError}</Alert>}
          <SettingsRow label="Path">
            <TextInput
              value={newPath}
              onChange={e => setNewPath(e.target.value)}
              placeholder="/media/movies"
              autoFocus
            />
          </SettingsRow>
          <SettingsRow label="Name (optional)">
            <TextInput
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Auto-detected from path"
            />
          </SettingsRow>
          <SettingsRow label="Watch for New Files">
            <Toggle checked={watchForNew} onChange={setWatchForNew} />
          </SettingsRow>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={() => { setShowForm(false); setAddError(null); setNewPath(''); setNewName(''); }}>Cancel</Button>
            <Button size="sm" disabled={adding} onClick={() => void handleAdd()}>
              {adding ? 'Adding…' : 'Add Folder'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="pt-1">
          <Button variant="secondary" size="sm" onClick={() => setShowForm(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Import Folder
          </Button>
        </div>
      )}
    </SettingGroup>
  );
}

function ProviderTestButton({
  label,
  onTest,
}: {
  label: string;
  onTest: () => Promise<void>;
}) {
  const [state, setState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const run = async () => {
    setState('testing');
    setErrorMsg(null);
    try {
      await onTest();
      setState('ok');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorMsg(msg);
      setState('fail');
    }
    setTimeout(() => setState('idle'), 4000);
  };

  return (
    <div className="flex items-center gap-3">
      <Button onClick={run} disabled={state === 'testing'} className="shrink-0">
        {state === 'testing' ? 'Testing…' : label}
      </Button>
      {state === 'ok' && <span className="text-sm text-green-400">Connected successfully</span>}
      {state === 'fail' && <span className="text-sm text-red-400">{errorMsg ?? 'Connection failed'}</span>}
    </div>
  );
}

function MetadataSection({
  settings,
  updateSetting,
}: {
  settings: ServerSettings;
  updateSetting: (path: string[], value: SettingValue) => void;
}) {
  return (
    <div className="space-y-7">
      <SectionHeader title="Metadata" description="Configure the metadata providers that DaCollector uses to download information and images for your collection." />

      <SettingGroup title="TMDB">
        <SettingsRow label="API Key">
          <TextInput type="password" value={settings.TMDB?.UserApiKey ?? ''} onChange={e => updateSetting(['TMDB', 'UserApiKey'], e.target.value)} placeholder="Required — get your key at themoviedb.org" />
        </SettingsRow>
        <SettingsRow label="Test Connection">
          <ProviderTestButton
            label="Test TMDB"
            onTest={async () => {
              const key = settings.TMDB?.UserApiKey ?? '';
              if (!key.trim()) throw new Error('Enter an API key first.');
              const result = await initApi.testTmdbKey(key);
              if (!result.Success) throw new Error(result.Error ?? 'Connection failed');
            }}
          />
        </SettingsRow>
        <ToggleRow label="Auto Link" checked={toBool(settings.TMDB?.AutoLink, true)} onChange={v => updateSetting(['TMDB', 'AutoLink'], v)} />
        <ToggleRow label="Auto Link Restricted" checked={toBool(settings.TMDB?.AutoLinkRestricted, true)} onChange={v => updateSetting(['TMDB', 'AutoLinkRestricted'], v)} />
      </SettingGroup>

      <SettingGroup title="TMDB Downloads">
        <ToggleRow label="Crew and Cast" checked={toBool(settings.TMDB?.AutoDownloadCrewAndCast)} onChange={v => updateSetting(['TMDB', 'AutoDownloadCrewAndCast'], v)} />
        <ToggleRow label="Movie Collections" checked={toBool(settings.TMDB?.AutoDownloadCollections)} onChange={v => updateSetting(['TMDB', 'AutoDownloadCollections'], v)} />
        <ToggleRow label="Alternate Ordering" checked={toBool(settings.TMDB?.AutoDownloadAlternateOrdering)} onChange={v => updateSetting(['TMDB', 'AutoDownloadAlternateOrdering'], v)} />
        <DownloadLimitRow label="Backdrops" togglePath="AutoDownloadBackdrops" maxPath="MaxAutoBackdrops" defaultMax={10} settings={settings} updateSetting={updateSetting} />
        <DownloadLimitRow label="Posters" togglePath="AutoDownloadPosters" maxPath="MaxAutoPosters" defaultMax={10} settings={settings} updateSetting={updateSetting} />
        <DownloadLimitRow label="Logos" togglePath="AutoDownloadLogos" maxPath="MaxAutoLogos" defaultMax={10} settings={settings} updateSetting={updateSetting} />
        <DownloadLimitRow label="Episode Thumbnails" togglePath="AutoDownloadThumbnails" maxPath="MaxAutoThumbnails" defaultMax={1} settings={settings} updateSetting={updateSetting} />
        <DownloadLimitRow label="Staff Images" togglePath="AutoDownloadStaffImages" maxPath="MaxAutoStaffImages" defaultMax={10} settings={settings} updateSetting={updateSetting} />
        <ToggleRow label="Studio Images" checked={toBool(settings.TMDB?.AutoDownloadStudioImages, true)} onChange={v => updateSetting(['TMDB', 'AutoDownloadStudioImages'], v)} />
      </SettingGroup>

      <SettingGroup title="TVDB">
        <ToggleRow label="Enabled" checked={toBool(settings.TVDB?.Enabled)} onChange={v => updateSetting(['TVDB', 'Enabled'], v)} />
        <SettingsRow label="API Key">
          <TextInput type="password" value={settings.TVDB?.ApiKey ?? ''} onChange={e => updateSetting(['TVDB', 'ApiKey'], e.target.value)} />
        </SettingsRow>
        <SettingsRow label="Subscriber PIN">
          <TextInput type="password" value={settings.TVDB?.Pin ?? ''} onChange={e => updateSetting(['TVDB', 'Pin'], e.target.value)} />
        </SettingsRow>
        <SettingsRow label="Cache Expiration Days">
          <TextInput type="number" min={1} max={365} value={settings.TVDB?.CacheExpirationDays ?? 7} onChange={e => updateSetting(['TVDB', 'CacheExpirationDays'], Number(e.target.value))} />
        </SettingsRow>
        <SettingsRow label="Test Connection">
          <ProviderTestButton
            label="Test TVDB"
            onTest={async () => {
              const key = settings.TVDB?.ApiKey ?? '';
              if (!key.trim()) throw new Error('Enter an API key first.');
              const result = await initApi.testTvdbKey(key, settings.TVDB?.Pin ?? undefined);
              if (!result.Success) throw new Error(result.Error ?? 'Connection failed');
            }}
          />
        </SettingsRow>
      </SettingGroup>
    </div>
  );
}

function CollectionSection({
  settings,
  updateSetting,
  toggleRelation,
}: {
  settings: ServerSettings;
  updateSetting: (path: string[], value: SettingValue) => void;
  toggleRelation: (type: string, checked: boolean) => void;
}) {
  const excluded = settings.AutoGroupSeriesRelationExclusions ?? defaultExcludedRelations;
  return (
    <div className="space-y-7">
      <SectionHeader title="Collection" description="Set your preferred language for movies and TV series, and determine how DaCollector groups related titles within your collection." />
      <SettingGroup title="Language Options">
        <SettingsRow label="Series Title Language Order">
          <TextInput
            value={(settings.Language?.SeriesTitleLanguageOrder ?? ['x-main']).join(', ')}
            onChange={e => updateSetting(['Language', 'SeriesTitleLanguageOrder'], e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            placeholder="x-main, en, ja"
          />
        </SettingsRow>
        <SettingsRow label="Episode Title Language Order">
          <TextInput
            value={(settings.Language?.EpisodeTitleLanguageOrder ?? ['en']).join(', ')}
            onChange={e => updateSetting(['Language', 'EpisodeTitleLanguageOrder'], e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            placeholder="en, ja"
          />
        </SettingsRow>
      </SettingGroup>
      <SettingGroup title="Relation Options">
        <ToggleRow label="Auto Group Series" checked={toBool(settings.AutoGroupSeries, true)} onChange={v => updateSetting(['AutoGroupSeries'], v)} />
        <ToggleRow label="Determine Main Series Using Relation Weighing" checked={toBool(settings.AutoGroupSeriesUseScoreAlgorithm)} onChange={v => updateSetting(['AutoGroupSeriesUseScoreAlgorithm'], v)} />
        <div className="pt-2 text-sm text-gray-400">Exclude following relations</div>
        <div className="rounded-md bg-gray-950/60 p-3">
          {relationTypes.map(type => (
            <ToggleRow key={type} label={type} checked={excluded.includes(type)} onChange={v => toggleRelation(type, v)} />
          ))}
        </div>
      </SettingGroup>
    </div>
  );
}

function IntegrationsSection({
  settings,
  updateSetting,
}: {
  settings: ServerSettings;
  updateSetting: (path: string[], value: SettingValue) => void;
}) {
  const [unlinking, setUnlinking] = useState(false);
  const [unlinkError, setUnlinkError] = useState<string | null>(null);

  const [plexTesting, setPlexTesting] = useState(false);
  const [plexIdentity, setPlexIdentity] = useState<PlexServerIdentity | null>(null);
  const [plexError, setPlexError] = useState<string | null>(null);
  const [libraries, setLibraries] = useState<PlexLibrarySection[]>([]);

  useEffect(() => {
    if (settings.Plex?.TargetBaseUrl && settings.Plex?.TargetToken) {
      plexTargetApi.getLibraries()
        .then(setLibraries)
        .catch(() => undefined);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleTraktUnlink() {
    setUnlinking(true);
    setUnlinkError(null);
    try {
      await settingsApi.update({ TraktTv: { AuthToken: '', RefreshToken: '', TokenExpirationDate: '' } });
      updateSetting(['TraktTv', 'TokenExpirationDate'], '');
    } catch (err) {
      setUnlinkError(err instanceof Error ? err.message : 'Unlink failed.');
    } finally {
      setUnlinking(false);
    }
  }

  async function handlePlexTest() {
    setPlexTesting(true);
    setPlexError(null);
    setPlexIdentity(null);
    try {
      const identity = await plexTargetApi.getIdentity();
      setPlexIdentity(identity);
      if (identity.Reachable) {
        const libs = await plexTargetApi.getLibraries();
        setLibraries(libs);
      }
    } catch (err) {
      setPlexError(err instanceof Error ? err.message : 'Connection test failed.');
    } finally {
      setPlexTesting(false);
    }
  }

  const traktLinked = Boolean(settings.TraktTv?.TokenExpirationDate);

  return (
    <div className="space-y-7">
      <SectionHeader title="Integrations" description="Customize integrations that DaCollector uses to scrobble media and connect to Plex." />

      <SettingGroup title="Trakt">
        {unlinkError && <Alert tone="error">{unlinkError}</Alert>}
        <SettingsRow label="Status">
          <div className="flex items-center justify-end gap-3">
            {traktLinked ? (
              <>
                <span className="text-xs text-emerald-400">
                  Linked · expires {settings.TraktTv?.TokenExpirationDate}
                </span>
                <Button variant="destructive" size="sm" disabled={unlinking} onClick={handleTraktUnlink}>
                  {unlinking ? 'Unlinking…' : 'Unlink'}
                </Button>
              </>
            ) : (
              <span className="text-xs text-gray-500">Not linked</span>
            )}
          </div>
        </SettingsRow>
        <ToggleRow label="Enabled" checked={toBool(settings.TraktTv?.Enabled)} onChange={v => updateSetting(['TraktTv', 'Enabled'], v)} />
        <SettingsRow label="Sync Frequency">
          <Select value={settings.TraktTv?.SyncFrequency ?? 'Daily'} onChange={e => updateSetting(['TraktTv', 'SyncFrequency'], e.target.value)}>
            <option value="SixHours">Every 6 Hours</option>
            <option value="TwelveHours">Every 12 Hours</option>
            <option value="Daily">Every 24 Hours</option>
            <option value="Weekly">Every Week</option>
          </Select>
        </SettingsRow>
      </SettingGroup>

      <SettingGroup title="Plex Target">
        {plexError && <Alert tone="error">{plexError}</Alert>}
        <SettingsRow label="Server URL">
          <TextInput
            value={settings.Plex?.TargetBaseUrl ?? ''}
            onChange={e => updateSetting(['Plex', 'TargetBaseUrl'], e.target.value)}
            placeholder="http://127.0.0.1:32400"
          />
        </SettingsRow>
        <SettingsRow label="Token">
          <TextInput
            type="password"
            value={settings.Plex?.TargetToken ?? ''}
            onChange={e => updateSetting(['Plex', 'TargetToken'], e.target.value)}
            placeholder="Plex token"
          />
        </SettingsRow>
        <SettingsRow label="Connection">
          <div className="flex items-center justify-end gap-3">
            {plexIdentity && (
              <span className={`text-xs ${plexIdentity.Reachable ? 'text-emerald-400' : 'text-red-400'}`}>
                {plexIdentity.Reachable
                  ? `Connected${plexIdentity.Version ? ` · v${plexIdentity.Version}` : ''}`
                  : plexIdentity.Status}
              </span>
            )}
            <Button size="sm" variant="secondary" disabled={plexTesting} onClick={handlePlexTest}>
              {plexTesting ? 'Testing…' : 'Test'}
            </Button>
          </div>
        </SettingsRow>
        <SettingsRow label="Library Section">
          <Select
            value={settings.Plex?.TargetSectionKey ?? ''}
            onChange={e => updateSetting(['Plex', 'TargetSectionKey'], e.target.value)}
          >
            <option value="">— Select Section —</option>
            {libraries.map(lib => (
              <option key={lib.Key} value={lib.Key}>
                {lib.Title} ({lib.Type})
              </option>
            ))}
          </Select>
        </SettingsRow>
      </SettingGroup>
    </div>
  );
}

type ProfileDraft = { Username: string; PlexUsernames: string; Avatar: string };

function ProfileSection() {
  const [profile, setProfile] = useState<User | null>(null);
  const [draft, setDraft] = useState<ProfileDraft>({ Username: '', PlexUsernames: '', Avatar: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [revokeKeys, setRevokeKeys] = useState(true);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const current = await usersApi.current();
      setProfile(current);
      setDraft({
        Username: current.Username,
        PlexUsernames: current.PlexUsernames ?? '',
        Avatar: current.Avatar ?? '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProfile() {
    if (!draft.Username.trim()) {
      setError('Username is required.');
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await usersApi.updateCurrent({
        Username: draft.Username.trim(),
        PlexUsernames: draft.PlexUsernames.trim(),
        Avatar: draft.Avatar,
      });
      setProfile(updated);
      setDraft({
        Username: updated.Username,
        PlexUsernames: updated.PlexUsernames ?? '',
        Avatar: updated.Avatar ?? '',
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Profile save failed.');
    } finally {
      setSaving(false);
    }
  }

  function handleAvatarFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setDraft(prev => ({ ...prev, Avatar: reader.result as string }));
      }
    };
    reader.onerror = () => setError('Failed to read avatar file.');
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  async function handleChangeCurrentPassword() {
    if (!password) {
      setPasswordError('Password cannot be empty.');
      return;
    }
    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordSaved(false);
    try {
      await usersApi.changeCurrentPassword(password, revokeKeys);
      setPassword('');
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 3000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Password change failed.');
    } finally {
      setPasswordSaving(false);
    }
  }

  if (loading) return <InlineSpinner />;

  return (
    <div className="space-y-7">
      <SectionHeader title="Profile" description="Manage the current user's profile, avatar, Plex usernames, and password." />
      {error && <Alert tone="error">{error}</Alert>}
      {saved && <Alert tone="success">Profile saved.</Alert>}

      <SettingGroup title="Current User">
        <div className="mb-4 flex items-center gap-4">
          <AvatarPreview user={profile} avatar={draft.Avatar} size="lg" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-100">{profile?.Username ?? 'Current user'}</div>
            <div className="text-xs text-gray-500">{profile?.IsAdmin ? 'Administrator' : 'User'}</div>
          </div>
        </div>
        <SettingsRow label="Avatar">
          <div className="flex flex-wrap justify-end gap-2">
            <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-gray-600 bg-gray-800/70 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-gray-500 hover:text-gray-100">
              <ImageIcon size={13} className="mr-1.5" />
              Pick
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
            </label>
            <Button variant="secondary" size="sm" onClick={() => setDraft({ ...draft, Avatar: '' })}>
              Remove
            </Button>
          </div>
        </SettingsRow>
        <SettingsRow label="Display Name">
          <TextInput value={draft.Username} onChange={e => setDraft({ ...draft, Username: e.target.value })} />
        </SettingsRow>
        <SettingsRow label="Plex Usernames">
          <TextInput value={draft.PlexUsernames} onChange={e => setDraft({ ...draft, PlexUsernames: e.target.value })} placeholder="comma-separated" />
        </SettingsRow>
      </SettingGroup>

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={() => load()} disabled={saving}>Cancel</Button>
        <Button onClick={handleSaveProfile} disabled={saving}>{saving ? 'Saving...' : 'Save Profile'}</Button>
      </div>

      <SettingGroup title="Password">
        {passwordError && <Alert tone="error">{passwordError}</Alert>}
        {passwordSaved && <Alert tone="success">Password changed.</Alert>}
        <SettingsRow label="New Password">
          <TextInput type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
        </SettingsRow>
        <SettingsRow label="Revoke API Keys">
          <div className="flex justify-end">
            <Toggle checked={revokeKeys} onChange={setRevokeKeys} />
          </div>
        </SettingsRow>
        <div className="flex justify-end pt-3">
          <Button onClick={handleChangeCurrentPassword} disabled={passwordSaving}>
            {passwordSaving ? 'Changing...' : 'Change Password'}
          </Button>
        </div>
      </SettingGroup>
    </div>
  );
}

function WebUISettingsSection() {
  const [themes, setThemes] = useState<WebUITheme[]>([]);
  const [webVersion, setWebVersion] = useState<ComponentVersion | null>(null);
  const [serverVersion, setServerVersion] = useState<ComponentVersion | null>(null);
  const [currentVersions, setCurrentVersions] = useState<ComponentVersionSet | null>(null);
  const [buildMetadata, setBuildMetadata] = useState<WebUIBuildMetadata | null>(null);
  const [releaseChannel, setReleaseChannel] = useState<ReleaseChannel>('Auto');
  const [allowIncompatible, setAllowIncompatible] = useState(false);
  const [themeUrl, setThemeUrl] = useState('');
  const [previewTheme, setPreviewTheme] = useState(false);
  const [loading, setLoading] = useState(true);
  const [versionLoading, setVersionLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [versionError, setVersionError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load(forceRefresh = false) {
    setLoading(true);
    setError(null);
    try {
      setThemes(await webuiApi.listThemes(forceRefresh));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load WebUI themes.');
    } finally {
      setLoading(false);
    }
    await loadVersions(releaseChannel);
  }

  async function loadVersions(channel = releaseChannel, force = false) {
    setVersionLoading(true);
    setVersionError(null);
    try {
      const [latestWeb, latestServer, installedVersions, metadata] = await Promise.allSettled([
        webuiApi.latestVersion(channel, force, allowIncompatible),
        webuiApi.latestServerVersion(channel, force),
        initApi.getVersion(),
        webuiApi.buildMetadata(),
      ]);

      const failures: string[] = [];
      if (latestWeb.status === 'fulfilled') setWebVersion(latestWeb.value);
      else failures.push(`latest WebUI: ${formatError(latestWeb.reason)}`);

      if (latestServer.status === 'fulfilled') setServerVersion(latestServer.value);
      else failures.push(`latest Server: ${formatError(latestServer.reason)}`);

      if (installedVersions.status === 'fulfilled') setCurrentVersions(installedVersions.value);
      else failures.push(`installed versions: ${formatError(installedVersions.reason)}`);

      if (metadata.status === 'fulfilled') setBuildMetadata(metadata.value);
      else failures.push(`bundled metadata: ${formatError(metadata.reason)}`);

      setVersionError(failures.length > 0 ? `Some version checks failed (${failures.join('; ')}).` : null);
    } finally {
      setVersionLoading(false);
    }
  }

  async function handleAddTheme() {
    const url = themeUrl.trim();
    if (!url) {
      setError('Enter a theme URL.');
      return;
    }
    setActionLoading('add-theme');
    setError(null);
    setMessage(null);
    try {
      const theme = await webuiApi.addThemeFromUrl(url, previewTheme);
      setMessage(previewTheme ? `Theme preview loaded: ${theme.Name}` : `Theme added: ${theme.Name}`);
      setThemeUrl('');
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Theme add failed.');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeleteTheme(theme: WebUITheme) {
    setActionLoading(`delete-${theme.ID}`);
    setError(null);
    setMessage(null);
    try {
      await webuiApi.deleteTheme(theme.ID);
      setMessage(`Theme removed: ${theme.Name}`);
      setThemes(prev => prev.filter(item => item.ID !== theme.ID));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Theme remove failed.');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUpdateTheme(theme: WebUITheme) {
    setActionLoading(`update-${theme.ID}`);
    setError(null);
    setMessage(null);
    try {
      const updated = await webuiApi.updateTheme(theme.ID);
      setMessage(`Theme updated: ${updated.Name}`);
      setThemes(prev => prev.map(item => item.ID === theme.ID ? updated : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Theme update failed.');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUpdateWebUI() {
    setActionLoading('webui-update');
    setError(null);
    setMessage(null);
    try {
      await webuiApi.update(releaseChannel, allowIncompatible);
      setMessage('WebUI update started.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'WebUI update failed.');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReportManualUpdate() {
    setActionLoading('manual-update');
    setError(null);
    setMessage(null);
    try {
      await webuiApi.reportManualUpdate();
      setMessage('Manual WebUI update reported.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Manual update report failed.');
    } finally {
      setActionLoading(null);
    }
  }

  const installedWebUI = currentVersions?.WebUI ?? null;
  const installedServer = currentVersions?.Server ?? null;
  const bundleState = describeBundledWebUIState(installedWebUI, buildMetadata);
  const updateState = describeWebUIUpdateState(installedWebUI, webVersion, buildMetadata);

  return (
    <div className="space-y-7">
      <SectionHeader title="Web UI" description="Manage WebUI themes and server-backed update checks." />
      {error && <Alert tone="error">{error}</Alert>}
      {versionError && <Alert tone="warning">{versionError}</Alert>}
      {message && <Alert tone="success">{message}</Alert>}

      <SettingGroup title="Versions">
        <SettingsRow label="Release Channel">
          <Select
            value={releaseChannel}
            onChange={e => {
              const channel = e.target.value as ReleaseChannel;
              setReleaseChannel(channel);
              void loadVersions(channel);
            }}
          >
            <option value="Auto">Auto</option>
            <option value="Stable">Stable</option>
            <option value="Dev">Dev</option>
            <option value="Debug">Debug</option>
          </Select>
        </SettingsRow>
        <ToggleRow label="Allow Incompatible WebUI" checked={allowIncompatible} onChange={setAllowIncompatible} />
        <SettingsRow label="Latest WebUI">
          <ReadonlyValue loading={versionLoading} value={formatComponentVersion(webVersion)} />
        </SettingsRow>
        <SettingsRow label="Latest Server">
          <ReadonlyValue loading={versionLoading} value={formatComponentVersion(serverVersion)} />
        </SettingsRow>
        <div className="flex flex-wrap justify-end gap-3 pt-3">
          <Button variant="secondary" onClick={() => loadVersions(releaseChannel, true)} disabled={versionLoading}>
            <RefreshCw size={13} className="mr-1.5" />
            Check
          </Button>
          <Button variant="secondary" onClick={handleReportManualUpdate} disabled={Boolean(actionLoading)}>
            Report Manual Update
          </Button>
          <Button onClick={handleUpdateWebUI} disabled={Boolean(actionLoading)}>
            {actionLoading === 'webui-update' ? 'Updating...' : 'Update WebUI'}
          </Button>
        </div>
      </SettingGroup>

      <SettingGroup title="Diagnostics">
        <div className="mb-3 grid gap-3 md:grid-cols-2">
          <DiagnosticStatusCard title="Bundle Status" status={bundleState} loading={versionLoading} />
          <DiagnosticStatusCard title="Update State" status={updateState} loading={versionLoading} />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <DiagnosticBlock
            title="Current Install"
            rows={[
              ['Server', formatComponentVersion(installedServer)],
              ['Server Commit', shortCommit(installedServer?.Commit)],
              ['Server Built', formatDateTime(installedServer?.ReleaseDate)],
              ['WebUI', formatComponentVersion(installedWebUI)],
              ['WebUI Commit', shortCommit(installedWebUI?.Commit)],
              ['WebUI Built', formatDateTime(installedWebUI?.ReleaseDate)],
            ]}
            loading={versionLoading}
          />
          <DiagnosticBlock
            title="Bundled WebUI"
            rows={[
              ['Package', buildMetadata?.package ?? 'Unknown'],
              ['Minimum Server', buildMetadata?.minimumServerVersion ?? 'Unknown'],
              ['Tag', buildMetadata?.tag ?? 'Unknown'],
              ['Channel', buildMetadata?.channel ?? 'Unknown'],
              ['Commit', shortCommit(buildMetadata?.git)],
              ['Built', formatDateTime(buildMetadata?.date)],
            ]}
            loading={versionLoading}
          />
          <DiagnosticBlock
            title="Latest Release"
            rows={[
              ['WebUI', formatComponentVersion(webVersion)],
              ['WebUI Commit', shortCommit(webVersion?.Commit)],
              ['Server', formatComponentVersion(serverVersion)],
              ['Server Commit', shortCommit(serverVersion?.Commit)],
            ]}
            loading={versionLoading}
          />
        </div>
      </SettingGroup>

      <SettingGroup title="Themes">
        <SettingsRow label="Add Theme URL">
          <TextInput value={themeUrl} onChange={e => setThemeUrl(e.target.value)} placeholder="https://example.com/theme.json" />
        </SettingsRow>
        <ToggleRow label="Preview Only" checked={previewTheme} onChange={setPreviewTheme} />
        <div className="flex justify-end pt-3">
          <Button onClick={handleAddTheme} disabled={actionLoading === 'add-theme'}>
            <Link2 size={13} className="mr-1.5" />
            {actionLoading === 'add-theme' ? 'Loading...' : previewTheme ? 'Preview Theme' : 'Add Theme'}
          </Button>
        </div>

        {loading ? (
          <InlineSpinner />
        ) : themes.length === 0 ? (
          <p className="py-2 text-sm text-gray-500">No themes found.</p>
        ) : (
          <div className="mt-4 divide-y divide-gray-800/60 rounded-md border border-gray-800/70 bg-gray-950/40">
            {themes.map(theme => (
              <div key={theme.ID} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Palette size={14} className="text-blue-400" />
                    <span className="text-sm font-medium text-gray-100">{theme.Name}</span>
                    {theme.IsInstalled && <UserBadge color="blue">Installed</UserBadge>}
                    {theme.IsPreview && <UserBadge color="gray">Preview</UserBadge>}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {theme.Author} · {formatThemeVersion(theme.Version)} · {theme.ID}
                  </div>
                  {theme.Description && <p className="mt-1 text-xs text-gray-400">{theme.Description}</p>}
                  {(theme.Tags?.length ?? 0) > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {theme.Tags.slice(0, 5).map(tag => <InfoPill key={`${theme.ID}-${tag}`}>{tag}</InfoPill>)}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                  {theme.URL && (
                    <Button size="sm" variant="secondary" onClick={() => handleUpdateTheme(theme)} disabled={Boolean(actionLoading)}>
                      {actionLoading === `update-${theme.ID}` ? 'Updating...' : 'Update'}
                    </Button>
                  )}
                  {theme.IsInstalled && (
                    <Button size="sm" variant="destructive" onClick={() => handleDeleteTheme(theme)} disabled={Boolean(actionLoading)}>
                      {actionLoading === `delete-${theme.ID}` ? 'Removing...' : 'Remove'}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-gray-500">Theme apply is omitted because the server exposes theme install/update/remove, but not a dedicated active-theme field.</p>
      </SettingGroup>
    </div>
  );
}

function ConfigurationSummarySection({
  showHeader = true,
  title,
  description,
  queries,
}: {
  showHeader?: boolean;
  title: string;
  description: string;
  queries: string[];
}) {
  const [configs, setConfigs] = useState<ConfigurationInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [validationMessages, setValidationMessages] = useState<Record<string, string>>({});

  useEffect(() => { load(); }, [queries.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(queries.map(query => configurationApi.list(query)));
      const deduped = new Map<string, ConfigurationInfo>();
      results.flat().forEach(config => deduped.set(config.ID, config));
      setConfigs(Array.from(deduped.values()).sort((a, b) => a.Name.localeCompare(b.Name)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load server configuration.');
    } finally {
      setLoading(false);
    }
  }

  async function validateConfig(config: ConfigurationInfo) {
    setValidatingId(config.ID);
    setError(null);
    try {
      const current = await configurationApi.get(config.ID);
      const result = await configurationApi.validate(config.ID, current);
      const validationErrors = Object.values(result.ValidationErrors ?? {}).flat();
      const messages = Object.values(result.Messages ?? {}).flat();
      const text = [...validationErrors, ...messages].join(' ');
      setValidationMessages(prev => ({
        ...prev,
        [config.ID]: text || 'Configuration is valid.',
      }));
    } catch (err) {
      setValidationMessages(prev => ({
        ...prev,
        [config.ID]: err instanceof Error ? err.message : 'Validation failed.',
      }));
    } finally {
      setValidatingId(null);
    }
  }

  return (
    <div className="space-y-7">
      {showHeader && <SectionHeader title={title} description={description} />}
      {error && <Alert tone="error">{error}</Alert>}
      <SettingGroup title="Server Configuration">
        {loading ? (
          <InlineSpinner />
        ) : configs.length === 0 ? (
          <p className="py-2 text-sm text-gray-500">No matching server configuration is currently registered.</p>
        ) : (
          <div className="space-y-3">
            {configs.map(config => (
              <div key={config.ID} className="rounded-md border border-gray-800/70 bg-gray-950/40 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-100">{config.Name}</div>
                    {config.Description && <p className="mt-1 text-xs text-gray-400">{config.Description}</p>}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {config.IsBase && <InfoPill>Base</InfoPill>}
                      {config.IsHidden && <InfoPill>Hidden</InfoPill>}
                      {config.HasCustomValidation && <InfoPill>Validation</InfoPill>}
                      {config.HasLiveEdit && <InfoPill>Live Edit</InfoPill>}
                      {config.HasCustomActions && <InfoPill>Actions</InfoPill>}
                    </div>
                  </div>
                  <Button size="sm" variant="secondary" disabled={validatingId === config.ID} onClick={() => validateConfig(config)}>
                    {validatingId === config.ID ? 'Validating...' : 'Validate'}
                  </Button>
                </div>
                <div className="mt-3 grid gap-3 text-xs text-gray-500 sm:grid-cols-2">
                  <div>
                    <span className="text-gray-400">Plugin:</span> {config.Plugin?.Name ?? 'Core'}
                  </div>
                  <div>
                    <span className="text-gray-400">Restart pending:</span> {config.RestartPendingFor.length || 0}
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-gray-400">Environment:</span> {config.LoadedEnvironmentVariables.length > 0 ? config.LoadedEnvironmentVariables.join(', ') : 'None'}
                  </div>
                </div>
                {validationMessages[config.ID] && (
                  <div className="mt-3 rounded border border-gray-700/60 bg-gray-900/60 px-3 py-2 text-xs text-gray-300">
                    {validationMessages[config.ID]}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SettingGroup>
    </div>
  );
}

type EditDraft = {
  Username: string;
  IsAdmin: boolean;
  IsTrkt: boolean;
  PlexUsernames: string;
  Avatar: string;
  RestrictedTags: number[];
};
type AddDraft = { Username: string; Password: string; IsAdmin: boolean };

function UserManagementSection() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [tagsError, setTagsError] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [addDraft, setAddDraft] = useState<AddDraft>({ Username: '', Password: '', IsAdmin: false });
  const [addError, setAddError] = useState<string | null>(null);
  const [addSaving, setAddSaving] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({ Username: '', IsAdmin: false, IsTrkt: false, PlexUsernames: '', Avatar: '', RestrictedTags: [] });
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [pwUserId, setPwUserId] = useState<number | null>(null);
  const [newPw, setNewPw] = useState('');
  const [revokeKeys, setRevokeKeys] = useState(true);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    load();
    loadTags();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setUsers(await usersApi.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }

  async function loadTags() {
    setTagsLoading(true);
    setTagsError(null);
    try {
      const response = await tagsApi.listAniDb();
      setTags(response.List);
    } catch (err) {
      setTagsError(err instanceof Error ? err.message : 'Failed to load tags.');
    } finally {
      setTagsLoading(false);
    }
  }

  function openEdit(user: User) {
    setEditingId(user.ID);
    setEditDraft({
      Username: user.Username,
      IsAdmin: user.IsAdmin,
      IsTrkt: user.CommunitySites.includes('Trakt'),
      PlexUsernames: user.PlexUsernames ?? '',
      Avatar: user.Avatar ?? '',
      RestrictedTags: user.RestrictedTags ?? [],
    });
    setEditError(null);
    setPwUserId(null);
    setPwError(null);
  }

  function closeEdit() {
    setEditingId(null);
    setEditError(null);
    setPwUserId(null);
    setPwError(null);
  }

  async function handleSaveEdit() {
    if (!editDraft.Username.trim()) { setEditError('Username is required.'); return; }
    setEditSaving(true);
    setEditError(null);
    try {
      const body: CreateOrUpdateUserBody = {
        Username: editDraft.Username.trim(),
        IsAdmin: editDraft.IsAdmin,
        CommunitySites: editDraft.IsTrkt ? ['Trakt'] : [],
        PlexUsernames: editDraft.PlexUsernames.trim() || undefined,
        Avatar: editDraft.Avatar,
        RestrictedTags: editDraft.RestrictedTags,
      };
      const updated = await usersApi.update(editingId!, body);
      setUsers(prev => prev.map(u => u.ID === editingId ? updated : u));
      closeEdit();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setEditSaving(false);
    }
  }

  function openAdd() {
    setShowAdd(true);
    setAddDraft({ Username: '', Password: '', IsAdmin: false });
    setAddError(null);
    closeEdit();
  }

  function handleEditAvatarFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setEditDraft(prev => ({ ...prev, Avatar: reader.result as string }));
      }
    };
    reader.onerror = () => setEditError('Failed to read avatar file.');
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  function toggleRestrictedTag(tagId: number, checked: boolean) {
    setEditDraft(prev => ({
      ...prev,
      RestrictedTags: checked
        ? Array.from(new Set([...prev.RestrictedTags, tagId]))
        : prev.RestrictedTags.filter(id => id !== tagId),
    }));
  }

  async function handleCreate() {
    if (!addDraft.Username.trim()) { setAddError('Username is required.'); return; }
    if (!addDraft.Password) { setAddError('Password is required.'); return; }
    setAddSaving(true);
    setAddError(null);
    try {
      const body: CreateUserBody = {
        Username: addDraft.Username.trim(),
        Password: addDraft.Password,
        IsAdmin: addDraft.IsAdmin,
      };
      const created = await usersApi.create(body);
      setUsers(prev => [...prev, created]);
      setShowAdd(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Create failed.');
    } finally {
      setAddSaving(false);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      await usersApi.delete(id);
      setUsers(prev => prev.filter(u => u.ID !== id));
      setConfirmDeleteId(null);
      if (editingId === id) closeEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setDeletingId(null);
    }
  }

  function openPasswordChange(userId: number) {
    const user = users.find(u => u.ID === userId);
    if (user && editingId !== userId) openEdit(user);
    setPwUserId(userId);
    setNewPw('');
    setRevokeKeys(true);
    setPwError(null);
  }

  async function handleChangePassword() {
    if (!newPw) { setPwError('Password cannot be empty.'); return; }
    setPwSaving(true);
    setPwError(null);
    try {
      await usersApi.changePassword(pwUserId!, newPw, revokeKeys);
      setPwUserId(null);
      setNewPw('');
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Password change failed.');
    } finally {
      setPwSaving(false);
    }
  }

  const filteredTags = tags
    .filter(tag => !tagFilter.trim() || tag.Name.toLowerCase().includes(tagFilter.trim().toLowerCase()))
    .slice(0, 50);

  return (
    <div className="space-y-6">
      <SectionHeader title="User Management" description="Manage DaCollector user accounts — usernames, permissions, Trakt integration, and passwords." />
      {error && <Alert tone="error">{error}</Alert>}

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-200">Users</h2>
        <Button size="sm" onClick={openAdd} disabled={showAdd}>
          <Plus size={13} className="mr-1" />
          Add User
        </Button>
      </div>

      {showAdd && (
        <div className="app-card rounded-md p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-200">New User</h3>
          {addError && <Alert tone="error">{addError}</Alert>}
          <div className="space-y-1">
            <SettingsRow label="Username">
              <TextInput
                value={addDraft.Username}
                onChange={e => setAddDraft({ ...addDraft, Username: e.target.value })}
                placeholder="username"
              />
            </SettingsRow>
            <SettingsRow label="Password">
              <TextInput
                type="password"
                value={addDraft.Password}
                onChange={e => setAddDraft({ ...addDraft, Password: e.target.value })}
                placeholder="••••••••"
              />
            </SettingsRow>
            <SettingsRow label="Administrator">
              <div className="flex justify-end">
                <Toggle checked={addDraft.IsAdmin} onChange={v => setAddDraft({ ...addDraft, IsAdmin: v })} />
              </div>
            </SettingsRow>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowAdd(false)} disabled={addSaving}>Cancel</Button>
            <Button onClick={handleCreate} disabled={addSaving}>{addSaving ? 'Creating…' : 'Create'}</Button>
          </div>
        </div>
      )}

      {loading ? (
        <InlineSpinner />
      ) : users.length === 0 ? (
        <p className="py-2 text-sm text-gray-500">No users found.</p>
      ) : (
        <div className="app-card rounded-md divide-y divide-gray-800/50">
          {users.map(user => (
            <div key={user.ID}>
              <div className="flex items-center gap-3 px-5 py-3">
                <AvatarPreview user={user} avatar={user.Avatar} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-gray-100">{user.Username}</span>
                    {user.IsAdmin && <UserBadge color="blue">Admin</UserBadge>}
                    {user.CommunitySites.includes('Trakt') && <UserBadge color="gray">Trakt</UserBadge>}
                    {(user.RestrictedTags?.length ?? 0) > 0 && <UserBadge color="gray">{user.RestrictedTags.length} Restricted</UserBadge>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openPasswordChange(user.ID)}
                    title="Change password"
                    className="rounded p-1.5 text-gray-400 hover:text-blue-400 transition-colors"
                  >
                    <KeyRound size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => editingId === user.ID ? closeEdit() : openEdit(user)}
                    title="Edit user"
                    className="rounded p-1.5 text-gray-400 hover:text-blue-400 transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  {confirmDeleteId === user.ID ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={deletingId === user.ID}
                        onClick={() => handleDelete(user.ID)}
                        title="Confirm delete"
                        className="rounded p-1.5 text-red-400 hover:text-red-300 transition-colors disabled:opacity-40"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        title="Cancel"
                        className="rounded p-1.5 text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(user.ID)}
                      title="Delete user"
                      className="rounded p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {editingId === user.ID && (
                <div className="border-t border-gray-700/50 bg-gray-900/30 px-5 py-5 space-y-4">
                  {editError && <Alert tone="error">{editError}</Alert>}
                  <div className="space-y-1">
                    <SettingsRow label="Avatar">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <AvatarPreview user={user} avatar={editDraft.Avatar} size="sm" />
                        <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-gray-600 bg-gray-800/70 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-gray-500 hover:text-gray-100">
                          <ImageIcon size={13} className="mr-1.5" />
                          Pick
                          <input type="file" accept="image/*" className="hidden" onChange={handleEditAvatarFile} />
                        </label>
                        <Button variant="secondary" size="sm" onClick={() => setEditDraft({ ...editDraft, Avatar: '' })}>
                          Remove
                        </Button>
                      </div>
                    </SettingsRow>
                    <SettingsRow label="Username">
                      <TextInput
                        value={editDraft.Username}
                        onChange={e => setEditDraft({ ...editDraft, Username: e.target.value })}
                      />
                    </SettingsRow>
                    <SettingsRow label="Administrator">
                      <div className="flex justify-end">
                        <Toggle checked={editDraft.IsAdmin} onChange={v => setEditDraft({ ...editDraft, IsAdmin: v })} />
                      </div>
                    </SettingsRow>
                    <SettingsRow label="Trakt User">
                      <div className="flex justify-end">
                        <Toggle checked={editDraft.IsTrkt} onChange={v => setEditDraft({ ...editDraft, IsTrkt: v })} />
                      </div>
                    </SettingsRow>
                    <SettingsRow label="Plex Usernames">
                      <TextInput
                        value={editDraft.PlexUsernames}
                        onChange={e => setEditDraft({ ...editDraft, PlexUsernames: e.target.value })}
                        placeholder="comma-separated"
                      />
                    </SettingsRow>
                  </div>
                  <div className="border-t border-gray-700/50 pt-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Tag Restrictions</h3>
                    {tagsError && <Alert tone="error">{tagsError}</Alert>}
                    <div className="mt-3 space-y-3">
                      <TextInput
                        value={tagFilter}
                        onChange={e => setTagFilter(e.target.value)}
                        placeholder="Filter tags"
                      />
                      {tagsLoading ? (
                        <InlineSpinner />
                      ) : tags.length === 0 ? (
                        <p className="text-sm text-gray-500">No tags available from the server.</p>
                      ) : (
                        <>
                          <div className="text-xs text-gray-500">{editDraft.RestrictedTags.length} selected</div>
                          <div className="max-h-52 overflow-y-auto rounded-md border border-gray-800/70 bg-gray-950/40 p-2">
                            {filteredTags.length === 0 ? (
                              <p className="px-2 py-1 text-xs text-gray-500">No matching tags.</p>
                            ) : filteredTags.map(tag => (
                              <ToggleRow
                                key={tag.ID}
                                label={tag.Name}
                                checked={editDraft.RestrictedTags.includes(tag.ID)}
                                onChange={checked => toggleRestrictedTag(tag.ID, checked)}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button variant="secondary" onClick={closeEdit} disabled={editSaving}>Cancel</Button>
                    <Button onClick={handleSaveEdit} disabled={editSaving}>{editSaving ? 'Saving…' : 'Save'}</Button>
                  </div>

                  {pwUserId === user.ID && (
                    <div className="border-t border-gray-700/50 pt-4 space-y-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Change Password</h3>
                      {pwError && <Alert tone="error">{pwError}</Alert>}
                      <div className="space-y-1">
                        <SettingsRow label="New Password">
                          <TextInput
                            type="password"
                            value={newPw}
                            onChange={e => setNewPw(e.target.value)}
                            placeholder="••••••••"
                          />
                        </SettingsRow>
                        <SettingsRow label="Revoke API Keys">
                          <div className="flex justify-end">
                            <Toggle checked={revokeKeys} onChange={setRevokeKeys} />
                          </div>
                        </SettingsRow>
                      </div>
                      <div className="flex justify-end gap-3">
                        <Button variant="secondary" onClick={() => { setPwUserId(null); setPwError(null); }} disabled={pwSaving}>Cancel</Button>
                        <Button onClick={handleChangePassword} disabled={pwSaving}>{pwSaving ? 'Changing…' : 'Change Password'}</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UserBadge({ color, children }: { color: 'blue' | 'gray'; children: React.ReactNode }) {
  const cls = color === 'blue'
    ? 'bg-blue-600/20 text-blue-400'
    : 'bg-gray-700/50 text-gray-400';
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {children}
    </span>
  );
}

function AvatarPreview({
  user,
  avatar,
  size,
}: {
  user?: User | null;
  avatar?: string;
  size: 'sm' | 'lg';
}) {
  const classes = size === 'lg'
    ? 'h-16 w-16 text-xl'
    : 'h-8 w-8 text-sm';
  const fallback = user?.Username?.charAt(0).toUpperCase() || 'D';
  if (avatar) {
    return (
      <img
        src={avatar}
        alt=""
        className={`${classes} shrink-0 rounded-full border border-gray-700 object-cover`}
      />
    );
  }
  return (
    <span className={`grid ${classes} shrink-0 place-items-center rounded-full bg-blue-500/20 font-semibold text-blue-400`}>
      {fallback}
    </span>
  );
}

function ReadonlyValue({ loading, value }: { loading: boolean; value: string }) {
  return (
    <div className="min-h-[2.375rem] rounded-md border border-gray-800 bg-gray-950/50 px-3 py-2 text-sm text-gray-300">
      {loading ? 'Checking...' : value}
    </div>
  );
}

function ReleaseInfoSection() {
  return (
    <div className="space-y-7">
      <SectionHeader
        title="Release Info"
        description="Review release metadata provider status and release-related server configuration."
      />
      <ReleaseInfoProvidersPanel />
      <ConfigurationSummarySection
        title="Release Info"
        description="Review release parser and release metadata configuration that the server exposes."
        queries={['release', 'parser']}
        showHeader={false}
      />
    </div>
  );
}

function ReleaseInfoProvidersPanel() {
  const [summary, setSummary] = useState<ReleaseInfoSummary | null>(null);
  const [providers, setProviders] = useState<ReleaseInfoProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadReleaseInfo() {
    setLoading(true);
    setError(null);
    try {
      const [summaryResult, providerResult] = await Promise.all([
        releaseInfoApi.summary(),
        releaseInfoApi.providers(),
      ]);
      setSummary(summaryResult);
      setProviders([...providerResult].sort((a, b) => a.Priority - b.Priority || a.Name.localeCompare(b.Name)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load release provider status.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReleaseInfo();
  }, []);

  const enabledCount = providers.filter(provider => provider.IsEnabled).length;
  const configuredCount = providers.filter(provider => Boolean(provider.Configuration)).length;

  return (
    <SettingGroup title="Release Providers">
      <div className="rounded-md border border-gray-800/70 bg-gray-950/40">
        <div className="flex flex-col gap-3 border-b border-gray-800/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Info size={16} className="text-blue-400" />
            <div>
              <div className="text-sm font-medium text-gray-100">Release metadata providers</div>
              <div className="text-xs text-gray-500">Read-only service status from ReleaseInfoController.</div>
            </div>
          </div>
          <Button size="sm" variant="secondary" onClick={loadReleaseInfo} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'mr-1.5 animate-spin' : 'mr-1.5'} />
            Refresh
          </Button>
        </div>

        {error ? (
          <div className="px-4 py-4 text-sm text-yellow-200">{error}</div>
        ) : loading && !summary ? (
          <InlineSpinner />
        ) : (
          <div>
            <div className="grid gap-3 border-b border-gray-800/70 p-4 sm:grid-cols-4">
              <BackupStat label="Mode" value={summary?.ParallelMode ? 'Parallel' : 'Serial'} />
              <BackupStat label="Providers" value={summary?.ProviderCount ?? providers.length} />
              <BackupStat label="Enabled" value={enabledCount} />
              <BackupStat label="Configured" value={configuredCount} />
            </div>

            {providers.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-500">No release metadata providers are currently registered.</div>
            ) : (
              <div className="divide-y divide-gray-800/70">
                {providers.map(provider => (
                  <div key={provider.ID} className="px-4 py-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="break-words text-sm font-medium text-gray-100">{provider.Name}</span>
                          <ReleaseProviderPill tone={provider.IsEnabled ? 'blue' : 'yellow'}>
                            {provider.IsEnabled ? 'Enabled' : 'Disabled'}
                          </ReleaseProviderPill>
                          <ReleaseProviderPill tone="gray">Priority {provider.Priority}</ReleaseProviderPill>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          {provider.Plugin?.Name ?? 'Core'} · v{formatReleaseVersion(provider.Version)}
                        </p>
                        {provider.Description && (
                          <p className="mt-2 line-clamp-2 text-xs text-gray-400">{provider.Description}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-1.5">
                        {provider.Configuration && <InfoPill>Configuration</InfoPill>}
                        {provider.Plugin?.RestartPending && <InfoPill>Restart Pending</InfoPill>}
                        {provider.Plugin?.IsActive === false && <InfoPill>Inactive Plugin</InfoPill>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </SettingGroup>
  );
}

function ReleaseProviderPill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: 'blue' | 'gray' | 'yellow';
}) {
  const cls = {
    blue: 'border-blue-500/40 bg-blue-500/10 text-blue-300',
    gray: 'border-gray-700/70 bg-gray-900/80 text-gray-400',
    yellow: 'border-yellow-500/40 bg-yellow-950/30 text-yellow-200',
  }[tone];
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cls}`}>
      {children}
    </span>
  );
}

function formatReleaseVersion(value: ReleaseInfoProvider['Version']) {
  if (typeof value === 'string') return value;
  const parts = [value.Major, value.Minor, value.Build, value.Revision]
    .filter((part): part is number => typeof part === 'number' && part >= 0);
  return parts.length > 0 ? parts.join('.') : 'unknown';
}

function DatabaseSection() {
  return (
    <div className="space-y-7">
      <SectionHeader
        title="Database"
        description="Review database backup files and database-related configuration exposed by the server."
      />
      <DatabaseBackupsPanel />
      <ConfigurationSummarySection
        title="Database"
        description="Review database and backup configuration visibility, restart requirements, and validation status."
        queries={['database', 'backup', 'core']}
        showHeader={false}
      />
    </div>
  );
}

function DatabaseBackupsPanel() {
  const [backups, setBackups] = useState<DatabaseBackupFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadBackups() {
    setLoading(true);
    setError(null);
    try {
      const result = await databaseApi.backups();
      setBackups([...result].sort((a, b) => new Date(b.CreatedAt).getTime() - new Date(a.CreatedAt).getTime()));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError('Database backup visibility requires an administrator account.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load database backups.');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBackups();
  }, []);

  const totalSize = backups.reduce((sum, backup) => sum + backup.SizeBytes, 0);
  const latest = backups[0];

  return (
    <SettingGroup title="Backup Files">
      <div className="rounded-md border border-gray-800/70 bg-gray-950/40">
        <div className="flex flex-col gap-3 border-b border-gray-800/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Archive size={16} className="text-blue-400" />
            <div>
              <div className="text-sm font-medium text-gray-100">Database backups</div>
              <div className="text-xs text-gray-500">Read-only list from the server backup directory.</div>
            </div>
          </div>
          <Button size="sm" variant="secondary" onClick={loadBackups} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'mr-1.5 animate-spin' : 'mr-1.5'} />
            Refresh
          </Button>
        </div>

        {error ? (
          <div className="px-4 py-4 text-sm text-yellow-200">{error}</div>
        ) : loading ? (
          <InlineSpinner />
        ) : backups.length === 0 ? (
          <div className="px-4 py-6 text-sm text-gray-500">No database backup files were reported.</div>
        ) : (
          <div>
            <div className="grid gap-3 border-b border-gray-800/70 p-4 sm:grid-cols-3">
              <BackupStat label="Files" value={backups.length} />
              <BackupStat label="Total Size" value={formatBytes(totalSize)} />
              <BackupStat label="Latest" value={formatDateTime(latest?.CreatedAt)} />
            </div>
            <div className="divide-y divide-gray-800/70">
              {backups.map(backup => (
                <div key={backup.FileName} className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_7rem_11rem] sm:items-center">
                  <div className="min-w-0 break-words font-medium text-gray-100">{backup.FileName}</div>
                  <div className="text-gray-400">{formatBytes(backup.SizeBytes)}</div>
                  <div className="text-gray-500">{formatDateTime(backup.CreatedAt)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SettingGroup>
  );
}

function BackupStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-gray-800/80 bg-black/20 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-gray-100">{value}</p>
    </div>
  );
}

function DiagnosticStatusCard({
  title,
  status,
  loading,
}: {
  title: string;
  status: { tone: 'success' | 'warning' | 'neutral'; text: string; detail: string };
  loading: boolean;
}) {
  const classes = {
    success: 'border-emerald-500/40 bg-emerald-950/20 text-emerald-200',
    warning: 'border-yellow-500/40 bg-yellow-950/20 text-yellow-200',
    neutral: 'border-gray-800/70 bg-gray-950/40 text-gray-300',
  }[status.tone];

  return (
    <div className={`rounded-md border px-4 py-3 ${classes}`}>
      <div className="text-xs font-semibold uppercase tracking-wide opacity-70">{title}</div>
      <div className="mt-1 text-sm font-medium">{loading ? 'Checking...' : status.text}</div>
      <p className="mt-1 text-xs opacity-75">{loading ? 'Refreshing metadata from server and bundled client.' : status.detail}</p>
    </div>
  );
}

function DiagnosticBlock({
  title,
  rows,
  loading,
}: {
  title: string;
  rows: Array<[string, string]>;
  loading: boolean;
}) {
  return (
    <div className="rounded-md border border-gray-800/70 bg-gray-950/40 p-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</div>
      <dl className="space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 text-xs">
            <dt className="text-gray-500">{label}</dt>
            <dd className="min-w-0 break-words font-mono text-gray-300">{loading ? 'Checking...' : value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function InfoPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-gray-700/70 bg-gray-900/80 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
      {children}
    </span>
  );
}

function formatComponentVersion(version: ComponentVersion | null) {
  if (!version) return 'Unknown';
  const parts = [
    version.Version,
    version.Tag ? `tag ${version.Tag}` : '',
    version.ReleaseChannel ? String(version.ReleaseChannel) : '',
    version.ReleaseDate ? new Date(version.ReleaseDate).toLocaleDateString() : '',
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'Unknown';
}

function shortCommit(value?: string) {
  if (!value) return 'Unknown';
  return value.length > 12 ? value.slice(0, 12) : value;
}

function formatDateTime(value?: string) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatError(reason: unknown) {
  return reason instanceof Error ? reason.message : String(reason);
}

function normalizeCommit(value?: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed !== '0000000' && trimmed.toLowerCase() !== 'unknown'
    ? trimmed.toLowerCase()
    : '';
}

function sameCommit(left?: string, right?: string) {
  const leftCommit = normalizeCommit(left);
  const rightCommit = normalizeCommit(right);
  if (!leftCommit || !rightCommit) return false;
  return leftCommit === rightCommit || leftCommit.startsWith(rightCommit) || rightCommit.startsWith(leftCommit);
}

function sameVersion(left?: string, right?: string) {
  return Boolean(left && right && left.trim().toLowerCase() === right.trim().toLowerCase());
}

function describeBundledWebUIState(installed: ComponentVersion | null, bundled: WebUIBuildMetadata | null) {
  if (!installed && !bundled) {
    return {
      tone: 'neutral' as const,
      text: 'Metadata unavailable',
      detail: 'The server has not returned installed WebUI data and the bundled version file was not loaded.',
    };
  }

  if (!bundled) {
    return {
      tone: 'warning' as const,
      text: 'Bundled metadata missing',
      detail: 'The installed WebUI version is visible, but /webui/version.json could not be loaded.',
    };
  }

  if (!installed) {
    return {
      tone: 'neutral' as const,
      text: 'Bundled metadata available',
      detail: 'The bundled WebUI version is visible, but the server has not reported an installed WebUI version yet.',
    };
  }

  if (sameCommit(installed.Commit, bundled.git)) {
    return {
      tone: 'success' as const,
      text: 'Bundled and installed match',
      detail: 'The installed WebUI commit matches the WebUI bundled in the running container image.',
    };
  }

  if (sameVersion(installed.Version, bundled.package)) {
    return {
      tone: 'warning' as const,
      text: 'Same version, different build',
      detail: 'The installed WebUI semantic version matches the bundle, but the build commit differs.',
    };
  }

  return {
    tone: 'warning' as const,
    text: 'Bundled and installed differ',
    detail: 'The installed WebUI version differs from the WebUI bundled in the running container image.',
  };
}

function describeWebUIUpdateState(
  installed: ComponentVersion | null,
  latest: ComponentVersion | null,
  bundled: WebUIBuildMetadata | null
) {
  if (installed && bundled && !sameCommit(installed.Commit, bundled.git)) {
    return {
      tone: 'warning' as const,
      text: 'Container bundle differs',
      detail: 'Restart or repair may be needed for the installed WebUI to match the bundled container build.',
    };
  }

  if (!installed || !latest) {
    return {
      tone: 'neutral' as const,
      text: 'Latest check incomplete',
      detail: 'Installed or latest WebUI metadata is not available. Local bundled diagnostics can still be used.',
    };
  }

  if (
    sameVersion(installed.Version, latest.Version) &&
    (!latest.Commit || sameCommit(installed.Commit, latest.Commit)) &&
    (!latest.Tag || sameVersion(installed.Tag, latest.Tag))
  ) {
    return {
      tone: 'success' as const,
      text: 'No WebUI update indicated',
      detail: 'Installed metadata matches the latest WebUI metadata returned by the server.',
    };
  }

  return {
    tone: 'warning' as const,
    text: 'Latest WebUI differs',
    detail: 'The latest WebUI metadata returned by the server differs from the installed WebUI metadata.',
  };
}

function formatThemeVersion(version: WebUITheme['Version']) {
  if (!version) return 'unknown version';
  if (typeof version === 'string') return version;
  const parts = [version.Major, version.Minor, version.Build]
    .filter((part): part is number => typeof part === 'number' && part >= 0);
  return parts.length > 0 ? parts.join('.') : 'unknown version';
}

function ApiKeysSection({
  tokens,
  loading,
  error,
  newTokenName,
  generatedToken,
  setNewTokenName,
  onGenerate,
  onDelete,
}: {
  tokens: ApiToken[];
  loading: boolean;
  error: string | null;
  newTokenName: string;
  generatedToken: string | null;
  setNewTokenName: (value: string) => void;
  onGenerate: () => void;
  onDelete: (token?: string) => void;
}) {
  return (
    <div className="space-y-7">
      <SectionHeader title="API Keys" description="Below are all the API keys used by DaCollector and other programs or plugins. You can create new ones or remove existing ones as needed." />
      {error && <Alert tone="error">{error}</Alert>}
      {generatedToken && <Alert tone="success">Generated key: {generatedToken}</Alert>}
      <SettingGroup title="Generate API Key">
        <div className="flex gap-4">
          <TextInput value={newTokenName} onChange={e => setNewTokenName(e.target.value)} placeholder="Type a name for your new API key" />
          <Button onClick={onGenerate}>Generate</Button>
        </div>
      </SettingGroup>
      <SettingGroup title="Issued API Keys">
        {loading ? (
          <InlineSpinner />
        ) : tokens.length === 0 ? (
          <p className="py-2 text-sm text-gray-500">No API keys have been issued.</p>
        ) : (
          tokens.map(token => (
            <div key={`${token.Name ?? 'key'}-${token.Token ?? ''}`} className="flex items-center justify-between py-2 text-sm text-gray-300">
              <span>{token.Name ?? token.Token ?? 'Unnamed key'}</span>
              <Button variant="destructive" size="sm" onClick={() => onDelete(token.Token)}>
                Delete
              </Button>
            </div>
          ))
        )}
      </SettingGroup>
    </div>
  );
}

function DownloadLimitRow({
  label,
  togglePath,
  maxPath,
  defaultMax,
  settings,
  updateSetting,
}: {
  label: string;
  togglePath: keyof NonNullable<ServerSettings['TMDB']>;
  maxPath: keyof NonNullable<ServerSettings['TMDB']>;
  defaultMax: number;
  settings: ServerSettings;
  updateSetting: (path: string[], value: SettingValue) => void;
}) {
  const tmdb = settings.TMDB as Record<string, unknown> | undefined;
  return (
    <SettingsRow label={label}>
      <div className="ml-auto flex items-center justify-end gap-3">
        <Toggle checked={toBool(tmdb?.[togglePath], true)} onChange={v => updateSetting(['TMDB', String(togglePath)], v)} />
        <TextInput className="w-16 text-center" type="number" min={0} value={Number(tmdb?.[maxPath] ?? defaultMax)} onChange={e => updateSetting(['TMDB', String(maxPath)], Number(e.target.value))} />
      </div>
    </SettingsRow>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <SettingsRow label={label}>
      <div className="flex justify-end">
        <Toggle checked={checked} onChange={onChange} />
      </div>
    </SettingsRow>
  );
}

function SettingGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-gray-200">{title}</h2>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function Alert({ tone, children }: { tone: 'error' | 'success' | 'warning'; children: React.ReactNode }) {
  const classes = {
    error: 'border-red-500/50 bg-red-950/40 text-red-200',
    success: 'border-emerald-500/50 bg-emerald-950/40 text-emerald-200',
    warning: 'border-yellow-500/50 bg-yellow-950/30 text-yellow-200',
  }[tone];
  return <div className={`mb-5 rounded-md border px-4 py-3 text-sm ${classes}`}>{children}</div>;
}

function InlineSpinner() {
  return (
    <div className="flex justify-center py-5">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
    </div>
  );
}

const _legacySectionMap: Record<string, SectionId> = {
  'tvdb': 'metadata',
  'metadata-sites': 'metadata',
  'user-management': 'users',
  'hashing': 'advanced',
  'relocation': 'advanced',
};

function normalizeSection(value?: string): SectionId {
  if (!value) return 'general';
  if (sections.some(section => section.id === value)) return value as SectionId;
  return _legacySectionMap[value] ?? 'general';
}

function toBool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return fallback;
}
