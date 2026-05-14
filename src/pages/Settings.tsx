import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Image as ImageIcon, KeyRound, Link2, Palette, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { ApiError } from '../api/client';
import { configurationApi, ConfigurationInfo } from '../api/configuration';
import { ComponentVersion } from '../api/init';
import { settingsApi, ServerSettings } from '../api/settings';
import { tagsApi, Tag } from '../api/tags';
import { ApiToken, tokensApi } from '../api/tokens';
import { User, CreateOrUpdateUserBody, CreateUserBody, usersApi } from '../api/users';
import { ReleaseChannel, webuiApi, WebUITheme } from '../api/webui';
import { plexTargetApi, PlexLibrarySection, PlexServerIdentity } from '../api/plexTarget';
import Button from '../components/ui/Button';
import SectionHeader from '../components/ui/SectionHeader';
import Select from '../components/ui/Select';
import SettingsRow from '../components/ui/SettingsRow';
import TextInput from '../components/ui/TextInput';
import Toggle from '../components/ui/Toggle';

type SectionId =
  | 'general'
  | 'profile'
  | 'web-ui'
  | 'import'
  | 'tvdb'
  | 'metadata-sites'
  | 'collection'
  | 'integrations'
  | 'user-management'
  | 'api-keys'
  | 'hashing'
  | 'release-info'
  | 'relocation'
  | 'database';

type SettingValue = string | number | boolean | string[] | undefined;

const sections: Array<{ id: SectionId; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'profile', label: 'Profile' },
  { id: 'web-ui', label: 'Web UI' },
  { id: 'import', label: 'Import' },
  { id: 'tvdb', label: 'TVDB' },
  { id: 'metadata-sites', label: 'Metadata Sites' },
  { id: 'collection', label: 'Collection' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'user-management', label: 'User Management' },
  { id: 'api-keys', label: 'API Keys' },
  { id: 'hashing', label: 'Hashing' },
  { id: 'release-info', label: 'Release Info' },
  { id: 'relocation', label: 'Relocation' },
  { id: 'database', label: 'Database' },
];

const standaloneSections: SectionId[] = ['profile', 'web-ui', 'user-management', 'api-keys', 'hashing', 'release-info', 'relocation', 'database'];

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
              {activeSection === 'profile' && (
                <ProfileSection />
              )}
              {activeSection === 'web-ui' && (
                <WebUISettingsSection />
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
              {activeSection === 'hashing' && (
                <ConfigurationSummarySection
                  title="Hashing"
                  description="Review hashing-related server configuration exposed by the generic configuration API."
                  queries={['hash', 'avdump', 'file']}
                />
              )}
              {activeSection === 'release-info' && (
                <ConfigurationSummarySection
                  title="Release Info"
                  description="Review release parser and release metadata configuration that the server exposes."
                  queries={['release', 'parser']}
                />
              )}
              {activeSection === 'relocation' && (
                <ConfigurationSummarySection
                  title="Relocation"
                  description="Review rename, relocation, and file move configuration without adding browser-side file operations."
                  queries={['relocation', 'rename', 'move']}
                />
              )}
              {activeSection === 'database' && (
                <ConfigurationSummarySection
                  title="Database"
                  description="Review database and backup configuration visibility, restart requirements, and validation status."
                  queries={['database', 'backup', 'core']}
                />
              )}
            </div>

            {!standaloneSections.includes(activeSection) && (
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
  const [releaseChannel, setReleaseChannel] = useState<ReleaseChannel>('Auto');
  const [allowIncompatible, setAllowIncompatible] = useState(false);
  const [themeUrl, setThemeUrl] = useState('');
  const [previewTheme, setPreviewTheme] = useState(false);
  const [loading, setLoading] = useState(true);
  const [versionLoading, setVersionLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    try {
      const [latestWeb, latestServer] = await Promise.all([
        webuiApi.latestVersion(channel, force, allowIncompatible),
        webuiApi.latestServerVersion(channel, force),
      ]);
      setWebVersion(latestWeb);
      setServerVersion(latestServer);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check WebUI versions.');
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

  return (
    <div className="space-y-7">
      <SectionHeader title="Web UI" description="Manage WebUI themes and server-backed update checks." />
      {error && <Alert tone="error">{error}</Alert>}
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
  title,
  description,
  queries,
}: {
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
      <SectionHeader title={title} description={description} />
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
