import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Download,
  PackageCheck,
  Plug,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import {
  PackageInfo,
  PackageRepositoryInfo,
  PluginInfo,
  pluginsApi,
  VersionValue,
} from '../api/plugins';
import { ApiError } from '../api/client';
import { usersApi, User } from '../api/users';
import { useConfirm } from '../components/ui/ConfirmProvider';
import { useToast } from '../components/ui/ToastProvider';

type Tab = 'plugins' | 'packages' | 'repositories';

export default function Plugins() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { notify } = useToast();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>('plugins');
  const [pluginSearch, setPluginSearch] = useState('');
  const [packageSearch, setPackageSearch] = useState('');
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [packages, setPackages] = useState<PackageInfo[]>([]);
  const [packageTotal, setPackageTotal] = useState(0);
  const [repositories, setRepositories] = useState<PackageRepositoryInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    usersApi.current()
      .then(user => { if (!stopped) setCurrentUser(user); })
      .catch(err => {
        if (err instanceof ApiError && err.status === 401) navigate('/login');
      });
    return () => { stopped = true; };
  }, [navigate]);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [pluginResult, packageResult, repositoryResult] = await Promise.all([
        pluginsApi.listPlugins(pluginSearch),
        pluginsApi.listPackages({ query: packageSearch, pageSize: 50 }),
        pluginsApi.listRepositories(),
      ]);
      setPlugins(pluginResult);
      setPackages(packageResult.List);
      setPackageTotal(packageResult.Total);
      setRepositories(repositoryResult);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) navigate('/login');
      else setError(err instanceof Error ? err.message : 'Failed to load plugin data.');
    } finally {
      setLoading(false);
    }
  }

  async function refreshPlugins() {
    setError(null);
    try {
      setPlugins(await pluginsApi.listPlugins(pluginSearch));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh plugins.');
    }
  }

  async function refreshPackages(forceSyncNow = false) {
    setError(null);
    try {
      const result = await pluginsApi.listPackages({ query: packageSearch, pageSize: 50, allowSync: forceSyncNow, forceSyncNow });
      setPackages(result.List);
      setPackageTotal(result.Total);
      if (forceSyncNow) setMessage('Package repositories synced.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh packages.');
    }
  }

  async function refreshRepositories() {
    setError(null);
    try {
      setRepositories(await pluginsApi.listRepositories());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh repositories.');
    }
  }

  async function setPluginEnabled(plugin: PluginInfo, enabled: boolean) {
    if (!currentUser?.IsAdmin) return;
    const verb = enabled ? 'enable' : 'disable';
    if (!await confirm({
      confirmLabel: enabled ? 'Enable' : 'Disable',
      message: `${verb[0].toUpperCase()}${verb.slice(1)} ${plugin.Name}? A restart may be required.`,
      title: `${enabled ? 'Enable' : 'Disable'} Plugin`,
      tone: 'warning',
    })) return;
    setBusy(`${verb}-${plugin.ID}`);
    setError(null);
    try {
      const updated = await pluginsApi.setEnabled(plugin.ID, enabled);
      setPlugins(items => items.map(item => item.ID === updated.ID ? updated : item));
      setMessage(`${plugin.Name} ${enabled ? 'enabled' : 'disabled'}.`);
      notify({ message: `${plugin.Name} ${enabled ? 'enabled' : 'disabled'}.`, tone: 'success' });
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${verb} plugin.`);
    } finally {
      setBusy(null);
    }
  }

  async function uninstallPlugin(plugin: PluginInfo) {
    if (!currentUser?.IsAdmin || !plugin.CanUninstall) return;
    if (!await confirm({
      confirmLabel: 'Uninstall',
      message: `Uninstall ${plugin.Name} and purge its configuration?`,
      title: 'Uninstall Plugin',
      tone: 'danger',
    })) return;
    setBusy(`uninstall-${plugin.ID}`);
    setError(null);
    try {
      await pluginsApi.uninstall(plugin.ID, true);
      await refreshPlugins();
      setMessage(`${plugin.Name} uninstalled.`);
      notify({ message: `${plugin.Name} uninstalled.`, tone: 'success' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to uninstall plugin.');
    } finally {
      setBusy(null);
    }
  }

  async function installPackage(pkg: PackageInfo) {
    if (!currentUser?.IsAdmin) return;
    if (!await confirm({
      confirmLabel: 'Install',
      message: `Install ${pkg.Manifest.Name} ${formatVersion(pkg.Release.Version)} for ${pkg.Archive.RuntimeIdentifier}?`,
      title: 'Install Plugin Package',
    })) return;
    setBusy(`install-${pkg.Manifest.PackageID}-${formatVersion(pkg.Release.Version)}-${pkg.Archive.RuntimeIdentifier}`);
    setError(null);
    try {
      const plugin = await pluginsApi.installPackage(
        pkg.Manifest.PackageID,
        formatVersion(pkg.Release.Version),
        formatVersion(pkg.Archive.AbstractionVersion),
        pkg.Archive.RuntimeIdentifier
      );
      await Promise.all([refreshPlugins(), refreshPackages(false)]);
      setMessage(`${plugin.Name} installed.`);
      notify({ message: `${plugin.Name} installed.`, tone: 'success' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to install package.');
    } finally {
      setBusy(null);
    }
  }

  async function syncRepositories() {
    if (!currentUser?.IsAdmin) return;
    setBusy('sync-repositories');
    setError(null);
    try {
      setRepositories(await pluginsApi.syncRepositories(true));
      await refreshPackages(false);
      setMessage('Repositories synced.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync repositories.');
    } finally {
      setBusy(null);
    }
  }

  async function scheduleUpdateCheck(performUpgrade: boolean) {
    if (!currentUser?.IsAdmin) return;
    if (performUpgrade && !await confirm({
      confirmLabel: 'Schedule Upgrades',
      message: 'Schedule plugin update checks and perform upgrades for enabled plugins?',
      title: 'Schedule Plugin Upgrades',
      tone: 'warning',
    })) return;
    setBusy(performUpgrade ? 'upgrade-check' : 'update-check');
    setError(null);
    try {
      await pluginsApi.scheduleUpdateCheck(true, performUpgrade);
      setMessage(performUpgrade ? 'Plugin update and upgrade check scheduled.' : 'Plugin update check scheduled.');
      notify({ message: performUpgrade ? 'Plugin update and upgrade check scheduled.' : 'Plugin update check scheduled.', tone: 'success' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule plugin update check.');
    } finally {
      setBusy(null);
    }
  }

  const installedIDs = useMemo(
    () => new Set(plugins.filter(plugin => plugin.IsInstalled).map(plugin => plugin.ID)),
    [plugins]
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Plugins</h1>
          <p className="mt-1 text-sm text-gray-500">Admin plugin inventory, packages, repositories, and update checks.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SessionBadge isAdmin={Boolean(currentUser?.IsAdmin)} />
          <button
            onClick={loadAll}
            className="inline-flex items-center gap-1.5 text-xs text-gray-400 transition-colors hover:text-white"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-5 rounded-md border border-red-700/50 bg-red-950/20 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {message && (
        <div className="mt-5 rounded-md border border-emerald-700/40 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-300">
          {message}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <TabButton active={tab === 'plugins'} onClick={() => setTab('plugins')}>Installed Plugins</TabButton>
        <TabButton active={tab === 'packages'} onClick={() => setTab('packages')}>Packages</TabButton>
        <TabButton active={tab === 'repositories'} onClick={() => setTab('repositories')}>Repositories</TabButton>
      </div>

      <div className="mt-5">
        {tab === 'plugins' && (
          <PluginsPanel
            plugins={plugins}
            search={pluginSearch}
            setSearch={setPluginSearch}
            onSearch={refreshPlugins}
            isAdmin={Boolean(currentUser?.IsAdmin)}
            busy={busy}
            onToggle={setPluginEnabled}
            onUninstall={uninstallPlugin}
            onUpdateCheck={scheduleUpdateCheck}
          />
        )}
        {tab === 'packages' && (
          <PackagesPanel
            packages={packages}
            total={packageTotal}
            search={packageSearch}
            setSearch={setPackageSearch}
            onSearch={() => refreshPackages(false)}
            onSync={() => refreshPackages(true)}
            installedIDs={installedIDs}
            isAdmin={Boolean(currentUser?.IsAdmin)}
            busy={busy}
            onInstall={installPackage}
          />
        )}
        {tab === 'repositories' && (
          <RepositoriesPanel
            repositories={repositories}
            isAdmin={Boolean(currentUser?.IsAdmin)}
            busy={busy}
            onRefresh={refreshRepositories}
            onSync={syncRepositories}
          />
        )}
      </div>
    </div>
  );
}

function PluginsPanel({
  plugins,
  search,
  setSearch,
  onSearch,
  isAdmin,
  busy,
  onToggle,
  onUninstall,
  onUpdateCheck,
}: {
  plugins: PluginInfo[];
  search: string;
  setSearch: (value: string) => void;
  onSearch: () => void;
  isAdmin: boolean;
  busy: string | null;
  onToggle: (plugin: PluginInfo, enabled: boolean) => void;
  onUninstall: (plugin: PluginInfo) => void;
  onUpdateCheck: (performUpgrade: boolean) => void;
}) {
  return (
    <section className="rounded-md border border-gray-700/50 bg-gray-900/40">
      <div className="flex flex-col gap-3 border-b border-gray-700/50 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <SearchBox value={search} onChange={setSearch} onSearch={onSearch} placeholder="Search plugins..." />
        <div className="flex flex-wrap gap-2">
          <button onClick={() => onUpdateCheck(false)} disabled={!isAdmin || Boolean(busy)} className="admin-secondary-button">
            <RefreshCw size={14} />
            Check Updates
          </button>
          <button onClick={() => onUpdateCheck(true)} disabled={!isAdmin || Boolean(busy)} className="admin-warning-button">
            <Download size={14} />
            Upgrade Enabled
          </button>
        </div>
      </div>
      {plugins.length === 0 ? (
        <EmptyState text="No plugins reported by the server." />
      ) : (
        <div className="divide-y divide-gray-800/70">
          {plugins.map(plugin => (
            <PluginRow
              key={`${plugin.ID}-${formatVersion(plugin.Version)}`}
              plugin={plugin}
              isAdmin={isAdmin}
              busy={busy}
              onToggle={onToggle}
              onUninstall={onUninstall}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PluginRow({
  plugin,
  isAdmin,
  busy,
  onToggle,
  onUninstall,
}: {
  plugin: PluginInfo;
  isAdmin: boolean;
  busy: string | null;
  onToggle: (plugin: PluginInfo, enabled: boolean) => void;
  onUninstall: (plugin: PluginInfo) => void;
}) {
  return (
    <div className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Plug size={15} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-100">{plugin.Name}</h2>
          <StatusPill label={plugin.IsEnabled ? 'Enabled' : 'Disabled'} tone={plugin.IsEnabled ? 'green' : 'gray'} />
          {plugin.IsActive && <StatusPill label="Active" tone="blue" />}
          {plugin.RestartPending && <StatusPill label="Restart pending" tone="yellow" />}
          {!plugin.CanLoad && <StatusPill label="Cannot load" tone="red" />}
        </div>
        <p className="mt-1 text-sm text-gray-500">{plugin.Description || 'No description provided.'}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
          <span>Version {formatVersion(plugin.Version)}</span>
          <span>Runtime {plugin.RuntimeIdentifier}</span>
          <span>ABI {formatVersion(plugin.AbstractionVersion)}</span>
          {plugin.Authors && <span>{plugin.Authors}</span>}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <button
          disabled={!isAdmin || Boolean(busy)}
          onClick={() => onToggle(plugin, !plugin.IsEnabled)}
          className="admin-secondary-button"
        >
          {busy === `${plugin.IsEnabled ? 'disable' : 'enable'}-${plugin.ID}` ? <Spinner /> : <CheckCircle2 size={14} />}
          {plugin.IsEnabled ? 'Disable' : 'Enable'}
        </button>
        <button
          disabled={!isAdmin || !plugin.CanUninstall || Boolean(busy)}
          onClick={() => onUninstall(plugin)}
          className="admin-danger-button"
        >
          {busy === `uninstall-${plugin.ID}` ? <Spinner /> : <Trash2 size={14} />}
          Uninstall
        </button>
      </div>
    </div>
  );
}

function PackagesPanel({
  packages,
  total,
  search,
  setSearch,
  onSearch,
  onSync,
  installedIDs,
  isAdmin,
  busy,
  onInstall,
}: {
  packages: PackageInfo[];
  total: number;
  search: string;
  setSearch: (value: string) => void;
  onSearch: () => void;
  onSync: () => void;
  installedIDs: Set<string>;
  isAdmin: boolean;
  busy: string | null;
  onInstall: (pkg: PackageInfo) => void;
}) {
  return (
    <section className="rounded-md border border-gray-700/50 bg-gray-900/40">
      <div className="flex flex-col gap-3 border-b border-gray-700/50 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <SearchBox value={search} onChange={setSearch} onSearch={onSearch} placeholder="Search packages..." />
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{packages.length} of {total}</span>
          <button onClick={onSync} disabled={!isAdmin || Boolean(busy)} className="admin-secondary-button">
            <RefreshCw size={14} />
            Sync
          </button>
        </div>
      </div>
      {packages.length === 0 ? (
        <EmptyState text="No compatible packages reported by repositories." />
      ) : (
        <div className="divide-y divide-gray-800/70">
          {packages.map(pkg => {
            const installID = `install-${pkg.Manifest.PackageID}-${formatVersion(pkg.Release.Version)}-${pkg.Archive.RuntimeIdentifier}`;
            const installed = installedIDs.has(pkg.Manifest.PackageID) || Boolean(pkg.Plugin);
            return (
              <div key={installID} className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <PackageCheck size={15} className="text-gray-400" />
                    <h2 className="text-sm font-semibold text-gray-100">{pkg.Manifest.Name}</h2>
                    <StatusPill label={pkg.Release.Channel} tone="blue" />
                    {installed && <StatusPill label="Installed" tone="green" />}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">{pkg.Manifest.Overview}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span>Version {formatVersion(pkg.Release.Version)}</span>
                    <span>Runtime {pkg.Archive.RuntimeIdentifier}</span>
                    <span>ABI {formatVersion(pkg.Archive.AbstractionVersion)}</span>
                    {pkg.Repository && <span>{pkg.Repository.Name}</span>}
                  </div>
                </div>
                <button
                  disabled={!isAdmin || Boolean(busy) || installed}
                  onClick={() => onInstall(pkg)}
                  className="admin-secondary-button shrink-0"
                >
                  {busy === installID ? <Spinner /> : <Download size={14} />}
                  Install
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function RepositoriesPanel({
  repositories,
  isAdmin,
  busy,
  onRefresh,
  onSync,
}: {
  repositories: PackageRepositoryInfo[];
  isAdmin: boolean;
  busy: string | null;
  onRefresh: () => void;
  onSync: () => void;
}) {
  return (
    <section className="rounded-md border border-gray-700/50 bg-gray-900/40">
      <div className="flex items-center justify-between border-b border-gray-700/50 px-4 py-4">
        <h2 className="text-sm font-semibold text-gray-200">Repositories</h2>
        <div className="flex gap-2">
          <button onClick={onRefresh} className="admin-secondary-button">
            <RefreshCw size={14} />
            Refresh
          </button>
          <button onClick={onSync} disabled={!isAdmin || Boolean(busy)} className="admin-secondary-button">
            {busy === 'sync-repositories' ? <Spinner /> : <RefreshCw size={14} />}
            Sync All
          </button>
        </div>
      </div>
      {repositories.length === 0 ? (
        <EmptyState text="No package repositories configured." />
      ) : (
        <div className="divide-y divide-gray-800/70">
          {repositories.map(repository => (
            <div key={repository.ID} className="px-4 py-4">
              <h3 className="text-sm font-semibold text-gray-100">{repository.Name}</h3>
              <p className="mt-1 break-all text-sm text-gray-500">{repository.Url}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                <span>ID {repository.ID}</span>
                <span>Fetched {repository.LastFetchedAt ? new Date(repository.LastFetchedAt).toLocaleString() : 'never'}</span>
                {repository.StaleTime && <span>Stale after {repository.StaleTime}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SearchBox({
  value,
  onChange,
  onSearch,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  placeholder: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 gap-2">
      <div className="relative min-w-0 flex-1">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          value={value}
          onChange={event => onChange(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') onSearch(); }}
          placeholder={placeholder}
          className="w-full rounded-md border border-gray-700/50 bg-gray-800/70 py-2 pl-9 pr-3 text-sm text-gray-200 placeholder-gray-600 focus:border-shoko-accent focus:outline-none"
        />
      </div>
      <button onClick={onSearch} className="admin-secondary-button">
        Search
      </button>
    </div>
  );
}

function SessionBadge({ isAdmin }: { isAdmin: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-gray-700/50 bg-gray-900/40 px-3 py-2 text-xs text-gray-400">
      <ShieldAlert size={14} className={isAdmin ? 'text-emerald-400' : 'text-yellow-400'} />
      {isAdmin ? 'Admin session' : 'Admin required'}
    </span>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-3 py-2 text-sm transition-colors ${
        active
          ? 'border-shoko-accent bg-shoko-accent text-black'
          : 'border-gray-700/50 bg-gray-900/40 text-gray-400 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function StatusPill({ label, tone }: { label: string; tone: 'blue' | 'green' | 'yellow' | 'red' | 'gray' }) {
  const classes = {
    blue: 'bg-shoko-accent/15 text-shoko-accent',
    green: 'bg-emerald-600/20 text-emerald-300',
    yellow: 'bg-yellow-900/40 text-yellow-300',
    red: 'bg-red-900/40 text-red-300',
    gray: 'bg-gray-800 text-gray-400',
  }[tone];
  return <span className={`rounded px-2 py-0.5 text-[11px] ${classes}`}>{label}</span>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="px-5 py-8 text-center text-sm text-gray-500">{text}</div>;
}

function Spinner() {
  return <span className="h-3.5 w-3.5 animate-spin rounded-full border border-current border-t-transparent" />;
}

function formatVersion(version: VersionValue): string {
  if (typeof version === 'string') return version;
  const parts = [version.Major, version.Minor, version.Build, version.Revision]
    .filter((part): part is number => typeof part === 'number' && part >= 0);
  return parts.length > 0 ? parts.join('.') : '0.0.0';
}
