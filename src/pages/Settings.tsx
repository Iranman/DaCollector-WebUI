import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { settingsApi, ServerSettings } from '../api/settings';
import { ApiToken, tokensApi } from '../api/tokens';
import { User, usersApi } from '../api/users';
import Button from '../components/ui/Button';
import SectionHeader from '../components/ui/SectionHeader';
import Select from '../components/ui/Select';
import SettingsRow from '../components/ui/SettingsRow';
import TextInput from '../components/ui/TextInput';
import Toggle from '../components/ui/Toggle';

type SectionId =
  | 'general'
  | 'import'
  | 'anidb'
  | 'metadata-sites'
  | 'collection'
  | 'integrations'
  | 'user-management'
  | 'api-keys';

type SettingValue = string | number | boolean | string[] | undefined;

const sections: Array<{ id: SectionId; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'import', label: 'Import' },
  { id: 'anidb', label: 'AniDB' },
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

  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

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
    if (activeSection === 'user-management') {
      loadUsers();
    }
    if (activeSection === 'api-keys') {
      loadTokens();
    }
  }, [activeSection]);

  async function loadUsers() {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const data = await usersApi.list();
      setUsers(data);
      setSelectedUserId(current => current ?? getUserId(data[0]) ?? null);
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : 'Failed to load users.');
    } finally {
      setUsersLoading(false);
    }
  }

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
    const current = settings.Collection?.ExcludeRelationTypes ?? defaultExcludedRelations;
    const next = checked ? Array.from(new Set([...current, type])) : current.filter(item => item !== type);
    updateSetting(['Collection', 'ExcludeRelationTypes'], next);
  }

  const selectedUser = users.find(user => getUserId(user) === selectedUserId);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <form onSubmit={handleSave} className="app-surface flex min-h-[42rem] overflow-hidden rounded-none">
          <aside className="w-52 shrink-0 border-r border-gray-700/50 bg-[#0d0d1a]/70 py-5">
            <h1 className="px-6 pb-5 text-xl font-semibold text-white">Settings</h1>
            <nav className="space-y-1">
              {sections.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.id === 'general' ? '/settings' : `/settings/${item.id}`)}
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

          <section className="flex min-w-0 flex-1 flex-col bg-[#0d0d1a]/55 p-8">
            {error && <Alert tone="error">{error}</Alert>}
            {saved && <Alert tone="success">Settings saved.</Alert>}

            <div className="flex-1">
              {activeSection === 'general' && (
                <GeneralSection settings={settings} updateSetting={updateSetting} />
              )}
              {activeSection === 'import' && (
                <ImportSection settings={settings} updateSetting={updateSetting} />
              )}
              {activeSection === 'anidb' && (
                <AniDBSection settings={settings} updateSetting={updateSetting} />
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
                <UserManagementSection
                  users={users}
                  loading={usersLoading}
                  error={usersError}
                  selectedUser={selectedUser}
                  selectedUserId={selectedUserId}
                  setSelectedUserId={setSelectedUserId}
                />
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
              <div className="mt-8 flex justify-end gap-3 border-t border-gray-700/50 pt-5">
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
  updateSetting,
}: {
  settings: ServerSettings;
  updateSetting: (path: string[], value: SettingValue) => void;
}) {
  return (
    <div className="space-y-7">
      <SectionHeader title="General" description="Here you can find settings for version details, theme customization, notification management, and log configurations." />
      <SettingGroup title="Database Settings">
        <SettingsRow label="SQLite Path">
          <TextInput value={settings.Database?.SQLitePath ?? 'Default application data directory'} readOnly />
        </SettingsRow>
      </SettingGroup>
      <SettingGroup title="Server Settings">
        <SettingsRow label="Server Name">
          <TextInput value={settings.Server?.Name ?? ''} onChange={e => updateSetting(['Server', 'Name'], e.target.value)} placeholder="DaCollector" />
        </SettingsRow>
        <SettingsRow label="Auto Update">
          <div className="flex justify-end">
            <Toggle checked={toBool(settings.Server?.AutoUpdate)} onChange={v => updateSetting(['Server', 'AutoUpdate'], v)} />
          </div>
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
        <ToggleRow label="Run on Start" checked={toBool(settings.Import?.RunOnStart, true)} onChange={v => updateSetting(['Import', 'RunOnStart'], v)} />
        <ToggleRow label="Scan Drop Folders on Start" checked={toBool(settings.Import?.ScanDropFoldersOnStart)} onChange={v => updateSetting(['Import', 'ScanDropFoldersOnStart'], v)} />
        <ToggleRow label="File Quality Check" checked={toBool(settings.Import?.FileQualityCheck)} onChange={v => updateSetting(['Import', 'FileQualityCheck'], v)} />
        <SettingsRow label="Max Auto-Import per Cycle">
          <TextInput type="number" min={0} value={settings.Import?.MaxAutoScanFiles ?? 0} onChange={e => updateSetting(['Import', 'MaxAutoScanFiles'], Number(e.target.value))} />
        </SettingsRow>
      </SettingGroup>
    </div>
  );
}

function AniDBSection({
  settings,
  updateSetting,
}: {
  settings: ServerSettings;
  updateSetting: (path: string[], value: SettingValue) => void;
}) {
  return (
    <div className="space-y-7">
      <SectionHeader title="AniDB" description="Configure inherited AniDB metadata and relation lookup settings used while the movie and TV conversion is completed." />
      <SettingGroup title="Login Options">
        <SettingsRow label="Username">
          <TextInput value={settings.AniDB?.Username ?? ''} onChange={e => updateSetting(['AniDB', 'Username'], e.target.value)} />
        </SettingsRow>
        <SettingsRow label="Password">
          <TextInput type="password" value={settings.AniDB?.Password ?? ''} onChange={e => updateSetting(['AniDB', 'Password'], e.target.value)} />
        </SettingsRow>
        <SettingsRow label="Client Port">
          <TextInput type="number" min={1} value={settings.AniDB?.ClientPort ?? 4556} onChange={e => updateSetting(['AniDB', 'ClientPort'], Number(e.target.value))} />
        </SettingsRow>
        <SettingsRow label="Max Relations Depth">
          <TextInput type="number" min={0} value={settings.AniDB?.MaxRelationDepth ?? 1} onChange={e => updateSetting(['AniDB', 'MaxRelationDepth'], Number(e.target.value))} />
        </SettingsRow>
      </SettingGroup>
      <p className="text-sm text-gray-500">AniDB credentials are required for inherited metadata lookup.</p>
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
        <ToggleRow label="Auto Link" checked={toBool(settings.TMDB?.AutoLink, true)} onChange={v => updateSetting(['TMDB', 'AutoLink'], v)} />
        <ToggleRow label="Auto Link Restricted" checked={toBool(settings.TMDB?.AutoLinkRestricted, true)} onChange={v => updateSetting(['TMDB', 'AutoLinkRestricted'], v)} />
        <ToggleRow label="Include Restricted in Search" checked={toBool(settings.TMDB?.IncludeRestricted)} onChange={v => updateSetting(['TMDB', 'IncludeRestricted'], v)} />
      </SettingGroup>
      <SettingGroup title="TMDB Download Options">
        <ToggleRow label="Download Crew And Cast" checked={toBool(settings.TMDB?.DownloadCrewAndCast, true)} onChange={v => updateSetting(['TMDB', 'DownloadCrewAndCast'], v)} />
        <ToggleRow label="Download Movie Collections" checked={toBool(settings.TMDB?.DownloadMovieCollections, true)} onChange={v => updateSetting(['TMDB', 'DownloadMovieCollections'], v)} />
        <ToggleRow label="Download Alternate Ordering" checked={toBool(settings.TMDB?.DownloadAlternateOrdering, true)} onChange={v => updateSetting(['TMDB', 'DownloadAlternateOrdering'], v)} />
        <DownloadLimitRow label="Download Backdrops" togglePath="DownloadBackdrops" maxPath="MaxBackdrops" defaultMax={10} settings={settings} updateSetting={updateSetting} />
        <DownloadLimitRow label="Download Posters" togglePath="DownloadPosters" maxPath="MaxPosters" defaultMax={10} settings={settings} updateSetting={updateSetting} />
        <DownloadLimitRow label="Download Logos" togglePath="DownloadLogos" maxPath="MaxLogos" defaultMax={10} settings={settings} updateSetting={updateSetting} />
        <DownloadLimitRow label="Download Episode Thumbnails" togglePath="DownloadEpisodeThumbnails" maxPath="MaxEpisodeThumbnails" defaultMax={1} settings={settings} updateSetting={updateSetting} />
        <DownloadLimitRow label="Download Staff Images" togglePath="DownloadStaffImages" maxPath="MaxStaffImages" defaultMax={10} settings={settings} updateSetting={updateSetting} />
        <ToggleRow label="Download Studio Images" checked={toBool(settings.TMDB?.DownloadStudioImages, true)} onChange={v => updateSetting(['TMDB', 'DownloadStudioImages'], v)} />
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
  const excluded = settings.Collection?.ExcludeRelationTypes ?? defaultExcludedRelations;
  return (
    <div className="space-y-7">
      <SectionHeader title="Collection" description="Set your preferred language for movies and TV series, and determine how DaCollector groups related titles within your collection." />
      <SettingGroup title="Language Options">
        <SettingsRow label="Preferred Series Language">
          <Select value={settings.Collection?.PreferredSeriesLanguage ?? 'English'} onChange={e => updateSetting(['Collection', 'PreferredSeriesLanguage'], e.target.value)}>
            <option>English</option>
            <option>Japanese</option>
            <option>Spanish</option>
            <option>French</option>
          </Select>
        </SettingsRow>
        <SettingsRow label="Preferred Episode Language">
          <Select value={settings.Collection?.PreferredEpisodeLanguage ?? 'English'} onChange={e => updateSetting(['Collection', 'PreferredEpisodeLanguage'], e.target.value)}>
            <option>English</option>
            <option>Japanese</option>
            <option>Spanish</option>
            <option>French</option>
          </Select>
        </SettingsRow>
      </SettingGroup>
      <SettingGroup title="Relation Options">
        <ToggleRow label="Auto Group Series" checked={toBool(settings.Collection?.AutoGroupSeries, true)} onChange={v => updateSetting(['Collection', 'AutoGroupSeries'], v)} />
        <ToggleRow label="Determine Main Series Using Relation Weighing" checked={toBool(settings.Collection?.UseSeriesRelationGrouping, true)} onChange={v => updateSetting(['Collection', 'UseSeriesRelationGrouping'], v)} />
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
  return (
    <div className="space-y-7">
      <SectionHeader title="Integrations" description="Customize integrations that DaCollector uses to scrobble media and connect to Plex." />
      <SettingGroup title="Trakt Options">
        <SettingsRow label="Linked Account">
          <div className="flex justify-end">
            <Button variant="destructive" size="sm">Unlink</Button>
          </div>
        </SettingsRow>
        <ToggleRow label="Enabled" checked={toBool(settings.Trakt?.Enabled)} onChange={v => updateSetting(['Trakt', 'Enabled'], v)} />
        <SettingsRow label="Token valid until">
          <div className="text-right text-sm text-gray-400">{settings.Trakt?.TokenValidUntil ?? 'Not linked'}</div>
        </SettingsRow>
        <SettingsRow label="Sync Frequency">
          <Select value={settings.Trakt?.SyncFrequency ?? 'Every 24 Hours'} onChange={e => updateSetting(['Trakt', 'SyncFrequency'], e.target.value)}>
            <option>Every 6 Hours</option>
            <option>Every 12 Hours</option>
            <option>Every 24 Hours</option>
            <option>Every 48 Hours</option>
          </Select>
        </SettingsRow>
      </SettingGroup>
      <SettingGroup title="Plex Options">
        <SettingsRow label="Authenticate">
          <div className="flex justify-end">
            <Button size="sm">Authenticate</Button>
          </div>
        </SettingsRow>
        <SettingsRow label="Server">
          <Select defaultValue="">
            <option value="">--Select Server--</option>
          </Select>
        </SettingsRow>
      </SettingGroup>
    </div>
  );
}

function UserManagementSection({
  users,
  loading,
  error,
  selectedUser,
  selectedUserId,
  setSelectedUserId,
}: {
  users: User[];
  loading: boolean;
  error: string | null;
  selectedUser?: User;
  selectedUserId: number | null;
  setSelectedUserId: (id: number | null) => void;
}) {
  return (
    <div className="space-y-7">
      <SectionHeader title="User Management" description="Configure DaCollector user accounts by changing usernames, passwords, avatars, and integration mappings." />
      {error && <Alert tone="error">{error}</Alert>}
      <SettingGroup title="Current Users">
        {loading ? (
          <InlineSpinner />
        ) : users.length === 0 ? (
          <p className="py-2 text-sm text-gray-500">No users returned by the API.</p>
        ) : (
          users.map(user => {
            const id = getUserId(user);
            return (
              <button
                key={id ?? user.Username ?? 'unknown'}
                type="button"
                onClick={() => setSelectedUserId(id ?? null)}
                className={`flex w-full items-center justify-between py-2 text-left text-sm transition-colors ${
                  selectedUserId === id ? 'text-white' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <span>{user.DisplayName ?? user.Username ?? `User ${id ?? ''}`}</span>
                <span className="flex gap-3 text-lg">
                  <span className="text-blue-500">◌</span>
                  <span className="text-red-500">⊖</span>
                </span>
              </button>
            );
          })
        )}
      </SettingGroup>
      <SettingGroup title="User Options">
        <SettingsRow label="Pick Avatar">
          <div className="flex justify-end">
            <Button variant="secondary" size="sm">Pick Avatar</Button>
          </div>
        </SettingsRow>
        <ReadOnlyUserRow label="Display Name" value={selectedUser?.DisplayName ?? selectedUser?.Username ?? ''} />
        <ReadOnlyToggleRow label="Administrator" value={selectedUser?.IsAdmin} />
        <ReadOnlyToggleRow label="AniDB User" value={selectedUser?.IsAniDBUser} />
        <ReadOnlyToggleRow label="Trakt User" value={selectedUser?.IsTraktUser} />
        <ReadOnlyUserRow label="Plex Users" value={selectedUser?.PlexUsers ?? ''} />
      </SettingGroup>
      <SettingGroup title="Password">
        <SettingsRow label="Password">
          <div className="flex justify-end">
            <Button size="sm">Change</Button>
          </div>
        </SettingsRow>
        <SettingsRow label="New Password">
          <TextInput type="password" value="" readOnly />
        </SettingsRow>
        <ReadOnlyToggleRow label="Logout all sessions" value={false} />
      </SettingGroup>
    </div>
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

function ReadOnlyUserRow({ label, value }: { label: string; value: string }) {
  return (
    <SettingsRow label={label}>
      <TextInput value={value} readOnly />
    </SettingsRow>
  );
}

function ReadOnlyToggleRow({ label, value }: { label: string; value?: boolean | number }) {
  return (
    <SettingsRow label={label}>
      <div className="flex justify-end">
        <Toggle checked={toBool(value)} disabled onChange={() => undefined} />
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

function getUserId(user?: User): number | undefined {
  return user?.ID ?? user?.JMMUserID;
}

function toBool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return fallback;
}
