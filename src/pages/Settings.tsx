import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, KeyRound, Pencil, Plus, Trash2, X } from 'lucide-react';
import { ApiError } from '../api/client';
import { settingsApi, ServerSettings } from '../api/settings';
import { ApiToken, tokensApi } from '../api/tokens';
import { User, CreateOrUpdateUserBody, CreateUserBody, usersApi } from '../api/users';
import { plexTargetApi, PlexLibrarySection, PlexServerIdentity } from '../api/plexTarget';
import Button from '../components/ui/Button';
import SectionHeader from '../components/ui/SectionHeader';
import Select from '../components/ui/Select';
import SettingsRow from '../components/ui/SettingsRow';
import TextInput from '../components/ui/TextInput';
import Toggle from '../components/ui/Toggle';

type SectionId =
  | 'general'
  | 'import'
  | 'tvdb'
  | 'metadata-sites'
  | 'collection'
  | 'integrations'
  | 'user-management'
  | 'api-keys';

type SettingValue = string | number | boolean | string[] | undefined;

const sections: Array<{ id: SectionId; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'import', label: 'Import' },
  { id: 'tvdb', label: 'TVDB' },
  { id: 'metadata-sites', label: 'Metadata Sites' },
  { id: 'collection', label: 'Collection' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'user-management', label: 'User Management' },
  { id: 'api-keys', label: 'API Keys' },
];

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
  const { section } = useParams();
  const activeSection = normalizeSection(section);
  const [settings, setSettings] = useState<ServerSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [tokensError, setTokensError] = useState<string | null>(null);
  const [newTokenName, setNewTokenName] = useState('');
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  useEffect(() => {
    settingsApi.get()
      .then(s => {
        setSettings(s);
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
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
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
    <div className="px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <form onSubmit={handleSave} className="app-surface flex flex-col overflow-hidden rounded-none md:min-h-[42rem] md:flex-row">
          <aside className="w-full shrink-0 border-b border-gray-700/50 bg-[#0d0d1a]/70 py-5 md:w-52 md:border-b-0 md:border-r">
            <h1 className="px-6 pb-5 text-xl font-semibold text-white">Settings</h1>
            <nav className="grid grid-cols-2 gap-1 sm:grid-cols-4 md:block md:space-y-1">
              {sections.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(`/settings/${item.id}`)}
                  className={`block w-full border-l-2 px-6 py-2.5 text-left text-sm transition-colors ${
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

          <section className="flex min-w-0 flex-1 flex-col bg-[#0d0d1a]/55 p-5 sm:p-8">
            {error && <Alert tone="error">{error}</Alert>}
            {saved && <Alert tone="success">Settings saved.</Alert>}

            <div className="flex-1">
              {activeSection === 'general' && (
                <GeneralSection settings={settings} />
              )}
              {activeSection === 'import' && (
                <ImportSection settings={settings} updateSetting={updateSetting} />
              )}
              {activeSection === 'tvdb' && (
                <TVDBSection settings={settings} updateSetting={updateSetting} />
              )}
              {activeSection === 'metadata-sites' && (
                <MetadataSitesSection settings={settings} updateSetting={updateSetting} />
              )}
              {activeSection === 'collection' && (
                <CollectionSection settings={settings} updateSetting={updateSetting} toggleRelation={toggleRelation} />
              )}
              {activeSection === 'integrations' && (
                <IntegrationsSection settings={settings} updateSetting={updateSetting} />
              )}
              {activeSection === 'user-management' && (
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
            </div>

            {!['api-keys', 'user-management'].includes(activeSection) && (
              <div className="mt-8 flex flex-wrap justify-end gap-3 border-t border-gray-700/50 pt-5">
                <Button variant="secondary" onClick={() => window.location.reload()}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
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
  return (
    <div className="space-y-7">
      <SectionHeader title="General" description="Here you can find settings for version details, theme customization, notification management, and log configurations." />
      <SettingGroup title="Database Settings">
        <SettingsRow label="Database Type">
          <TextInput value={settings.Database?.Type ?? 'SQLite'} readOnly />
        </SettingsRow>
      </SettingGroup>
    </div>
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
    </div>
  );
}

function TVDBSection({
  settings,
  updateSetting,
}: {
  settings: ServerSettings;
  updateSetting: (path: string[], value: SettingValue) => void;
}) {
  return (
    <div className="space-y-7">
      <SectionHeader title="TVDB" description="Configure TVDB lookup for movie and TV collection builders." />
      <SettingGroup title="Provider Options">
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
      </SettingGroup>
      <p className="text-sm text-gray-500">TVDB requires an API key before TVDB collection builders can fetch provider data.</p>
    </div>
  );
}

function MetadataSitesSection({
  settings,
  updateSetting,
}: {
  settings: ServerSettings;
  updateSetting: (path: string[], value: SettingValue) => void;
}) {
  return (
    <div className="space-y-7">
      <SectionHeader title="Metadata Sites" description="Customize the information and images that DaCollector downloads for movies and TV series in your collection." />
      <SettingGroup title="TMDB Options">
        <SettingsRow label="API Key">
          <TextInput type="password" value={settings.TMDB?.UserApiKey ?? ''} onChange={e => updateSetting(['TMDB', 'UserApiKey'], e.target.value)} placeholder="Optional — uses shared key if blank" />
        </SettingsRow>
        <ToggleRow label="Auto Link" checked={toBool(settings.TMDB?.AutoLink, true)} onChange={v => updateSetting(['TMDB', 'AutoLink'], v)} />
        <ToggleRow label="Auto Link Restricted" checked={toBool(settings.TMDB?.AutoLinkRestricted, true)} onChange={v => updateSetting(['TMDB', 'AutoLinkRestricted'], v)} />
      </SettingGroup>
      <SettingGroup title="TMDB Download Options">
        <ToggleRow label="Download Crew And Cast" checked={toBool(settings.TMDB?.AutoDownloadCrewAndCast)} onChange={v => updateSetting(['TMDB', 'AutoDownloadCrewAndCast'], v)} />
        <ToggleRow label="Download Movie Collections" checked={toBool(settings.TMDB?.AutoDownloadCollections)} onChange={v => updateSetting(['TMDB', 'AutoDownloadCollections'], v)} />
        <ToggleRow label="Download Alternate Ordering" checked={toBool(settings.TMDB?.AutoDownloadAlternateOrdering)} onChange={v => updateSetting(['TMDB', 'AutoDownloadAlternateOrdering'], v)} />
        <DownloadLimitRow label="Download Backdrops" togglePath="AutoDownloadBackdrops" maxPath="MaxAutoBackdrops" defaultMax={10} settings={settings} updateSetting={updateSetting} />
        <DownloadLimitRow label="Download Posters" togglePath="AutoDownloadPosters" maxPath="MaxAutoPosters" defaultMax={10} settings={settings} updateSetting={updateSetting} />
        <DownloadLimitRow label="Download Logos" togglePath="AutoDownloadLogos" maxPath="MaxAutoLogos" defaultMax={10} settings={settings} updateSetting={updateSetting} />
        <DownloadLimitRow label="Download Episode Thumbnails" togglePath="AutoDownloadThumbnails" maxPath="MaxAutoThumbnails" defaultMax={1} settings={settings} updateSetting={updateSetting} />
        <DownloadLimitRow label="Download Staff Images" togglePath="AutoDownloadStaffImages" maxPath="MaxAutoStaffImages" defaultMax={10} settings={settings} updateSetting={updateSetting} />
        <ToggleRow label="Download Studio Images" checked={toBool(settings.TMDB?.AutoDownloadStudioImages, true)} onChange={v => updateSetting(['TMDB', 'AutoDownloadStudioImages'], v)} />
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

type EditDraft = { Username: string; IsAdmin: boolean; IsTrkt: boolean; PlexUsernames: string };
type AddDraft = { Username: string; Password: string; IsAdmin: boolean };

function UserManagementSection() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [addDraft, setAddDraft] = useState<AddDraft>({ Username: '', Password: '', IsAdmin: false });
  const [addError, setAddError] = useState<string | null>(null);
  const [addSaving, setAddSaving] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({ Username: '', IsAdmin: false, IsTrkt: false, PlexUsernames: '' });
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [pwUserId, setPwUserId] = useState<number | null>(null);
  const [newPw, setNewPw] = useState('');
  const [revokeKeys, setRevokeKeys] = useState(true);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => { load(); }, []);

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

  function openEdit(user: User) {
    setEditingId(user.ID);
    setEditDraft({
      Username: user.Username,
      IsAdmin: user.IsAdmin,
      IsTrkt: user.CommunitySites.includes('Trakt'),
      PlexUsernames: user.PlexUsernames ?? '',
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
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-500/20 text-sm font-semibold text-blue-400">
                  {user.Username.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-gray-100">{user.Username}</span>
                    {user.IsAdmin && <UserBadge color="blue">Admin</UserBadge>}
                    {user.CommunitySites.includes('Trakt') && <UserBadge color="gray">Trakt</UserBadge>}
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

function Alert({ tone, children }: { tone: 'error' | 'success'; children: React.ReactNode }) {
  const classes = tone === 'error'
    ? 'border-red-500/50 bg-red-950/40 text-red-200'
    : 'border-emerald-500/50 bg-emerald-950/40 text-emerald-200';
  return <div className={`mb-5 rounded-md border px-4 py-3 text-sm ${classes}`}>{children}</div>;
}

function InlineSpinner() {
  return (
    <div className="flex justify-center py-5">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
    </div>
  );
}

function normalizeSection(value?: string): SectionId {
  return sections.some(section => section.id === value) ? value as SectionId : 'general';
}

function toBool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return fallback;
}
