import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, RefreshCw, Wifi, WifiOff, XCircle } from 'lucide-react';
import { initApi, ServerStatus } from '../api/init';
import { api, ApiError } from '../api/client';
import { QueueStatus } from '../api/queue';
import { managedFoldersApi } from '../api/managedFolders';
import {
  dacollectorStatusApi,
  DaCollectorStatus,
  ProviderConnectionStatus,
  PlexTargetConnectionStatus,
  ServerCapabilityStatus,
} from '../api/dacollectorStatus';
import { buildConnection } from '../lib/signalr';

interface CollectionStats {
  FileCount: number;
  FileSize: number;
  SeriesCount: number;
  GroupCount: number;
  FinishedSeries: number;
  WatchedEpisodes: number;
  WatchedHours: number;
  PercentDuplicate: number;
  MissingEpisodes: number;
  MissingEpisodesCollecting: number;
  UnrecognizedFiles: number;
  SeriesWithMissingLinks: number;
  EpisodesWithMultipleFiles: number;
  FilesWithDuplicateLocations: number;
}

interface WarningItem {
  key: string;
  title: string;
  detail: string;
  to?: string;
}

function fmtBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [readiness, setReadiness] = useState<DaCollectorStatus | null>(null);
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [webuiVersion, setWebuiVersion] = useState<string | null>(null);
  const [managedFolderCount, setManagedFolderCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [readinessError, setReadinessError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueStatus | null>(null);
  const [queueConn, setQueueConn] = useState<'connecting' | 'live' | 'offline'>('connecting');

  useEffect(() => {
    let stopped = false;
    const conn = buildConnection('/signalr/aggregate');

    function applyQueue(state: QueueStatus) {
      if (!stopped) setQueue(state);
    }

    conn.on('queue:connected', applyQueue);
    conn.on('queue:state.changed', applyQueue);
    conn.onreconnected(() => {
      if (!stopped) {
        setQueueConn('live');
        conn.invoke('feed.join_single', 'queue').catch(() => {});
      }
    });
    conn.onclose(() => { if (!stopped) setQueueConn('offline'); });

    conn.start()
      .then(() => {
        if (stopped) return;
        setQueueConn('live');
        return conn.invoke('feed.join_single', 'queue');
      })
      .catch(() => { if (!stopped) setQueueConn('offline'); });

    return () => {
      stopped = true;
      conn.stop();
    };
  }, []);

  useEffect(() => {
    let stopped = false;

    async function load() {
      try {
        const [s, v] = await Promise.all([
          initApi.getStatus(),
          initApi.getVersion(),
        ]);
        if (stopped) return;
        setStatus(s);
        setVersion(v.Server.Version ?? null);
        setWebuiVersion(v.WebUI?.Version ?? null);

        if (s.State !== 'Started') return;

        const [statsResult, readinessResult, foldersResult] = await Promise.allSettled([
          api.get<CollectionStats>('/api/v3/Dashboard/Stats'),
          dacollectorStatusApi.get(),
          managedFoldersApi.list(),
        ]);
        if (stopped) return;

        if (statsResult.status === 'fulfilled') setStats(statsResult.value);

        if (readinessResult.status === 'fulfilled') {
          setReadiness(readinessResult.value);
          setReadinessError(null);
        } else {
          handleOptionalError(readinessResult.reason, 'Failed to load DaCollector readiness.');
        }

        if (foldersResult.status === 'fulfilled') {
          setManagedFolderCount(foldersResult.value.length);
        } else if (foldersResult.reason instanceof ApiError && foldersResult.reason.status === 401) {
          navigate('/login');
        }
      } catch (err) {
        if (stopped) return;
        if (err instanceof ApiError && err.status === 401) {
          navigate('/login');
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load data.');
        }
      }
    }

    function handleOptionalError(err: unknown, fallback: string) {
      if (err instanceof ApiError && err.status === 401) {
        navigate('/login');
        return;
      }
      setReadinessError(err instanceof Error ? err.message : fallback);
    }

    load();

    return () => { stopped = true; };
  }, [navigate]);

  const warnings = useMemo(
    () => buildWarnings(readiness, managedFolderCount, status),
    [readiness, managedFolderCount, status]
  );

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Dashboard</h1>
          <p className="mt-0.5 text-xs text-gray-500">Server readiness, queue activity, provider status, and collection health.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
          {version && <span>Server {version}</span>}
          {webuiVersion && <span>WebUI {webuiVersion}</span>}
        </div>
      </div>

      {error && (
        <div className="app-card rounded-md border-red-700/50 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Status" value={status?.State ?? '—'} />
        <StatCard label="Uptime" value={status?.Uptime ?? '—'} />
        <StatCard label="Folders" value={managedFolderCount == null ? '—' : String(managedFolderCount)} />
        <StatCard label="Series" value={stats ? String(stats.SeriesCount) : '—'} />
        <StatCard label="Files" value={stats ? String(stats.FileCount) : '—'} />
      </div>

      {warnings.length > 0 && <WarningPanel warnings={warnings} />}

      {readinessError && (
        <div className="app-card rounded-md border-yellow-700/50 px-4 py-3 text-sm text-yellow-400">
          {readinessError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.8fr)]">
        <QueueWidget queue={queue} connState={queueConn} />
        {readiness ? (
          <PlexPanel plex={readiness.PlexTarget} />
        ) : (
          <SkeletonPanel title="Plex Target" message="Waiting for readiness data…" />
        )}
      </div>

      {readiness && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ProviderPanel providers={readiness.Providers} />
          <CollectionManagerPanel status={readiness.CollectionManager} />
        </div>
      )}

      {stats && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Groups" value={String(stats.GroupCount)} />
            <StatCard label="Watched" value={`${stats.WatchedHours}h`} />
            <StatCard label="File Size" value={fmtBytes(stats.FileSize)} />
            <StatCard label="Duplicates" value={`${stats.PercentDuplicate}%`} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="app-card rounded-md xl:col-span-2">
              <div className="border-b border-gray-700/50 px-5 py-3">
                <h2 className="text-sm font-semibold text-gray-200">Collection Health</h2>
              </div>
              <div className="divide-y divide-gray-800/50">
                <HealthRow label="Missing Episodes" value={stats.MissingEpisodes} warn={stats.MissingEpisodes > 0} />
                <HealthRow label="Missing Episodes (Collecting)" value={stats.MissingEpisodesCollecting} warn={stats.MissingEpisodesCollecting > 0} />
                <HealthRow label="Unrecognized Files" value={stats.UnrecognizedFiles} warn={stats.UnrecognizedFiles > 0} />
                <HealthRow label="Series Missing Links" value={stats.SeriesWithMissingLinks} warn={stats.SeriesWithMissingLinks > 0} />
                <HealthRow label="Episodes w/ Multiple Files" value={stats.EpisodesWithMultipleFiles} warn={stats.EpisodesWithMultipleFiles > 0} />
                <HealthRow label="Duplicate File Locations" value={stats.FilesWithDuplicateLocations} warn={stats.FilesWithDuplicateLocations > 0} />
              </div>
            </div>

            <div className="app-card rounded-md">
              <div className="border-b border-gray-700/50 px-5 py-3">
                <h2 className="text-sm font-semibold text-gray-200">Watch Progress</h2>
              </div>
              <div className="divide-y divide-gray-800/50">
                <HealthRow label="Finished Series" value={stats.FinishedSeries} />
                <HealthRow label="Watched Episodes" value={stats.WatchedEpisodes} />
                <HealthRow label="Watch Hours" value={`${stats.WatchedHours}h`} />
              </div>
            </div>
          </div>
        </>
      )}

      {readiness && <CapabilitiesPanel capabilities={readiness.ServerCapabilities} />}
    </div>
  );
}

function buildWarnings(
  readiness: DaCollectorStatus | null,
  managedFolderCount: number | null,
  status: ServerStatus | null
): WarningItem[] {
  const warnings: WarningItem[] = [];

  if (status?.State === 'Waiting') {
    warnings.push({
      key: 'setup',
      title: 'First-run setup is waiting',
      detail: 'Create the administrator account before using protected workflows.',
      to: '/setup',
    });
  }

  if (status?.State === 'Failed') {
    warnings.push({
      key: 'startup-failed',
      title: 'Server startup failed',
      detail: status.StartupMessage ?? 'Open logs for the startup failure details.',
      to: '/log',
    });
  }

  if (managedFolderCount === 0) {
    warnings.push({
      key: 'folders',
      title: 'No managed folders configured',
      detail: 'Add server-mounted media folders before scanning local media.',
      to: '/folders',
    });
  }

  readiness?.Providers.forEach(provider => {
    provider.Warnings.forEach((warning, index) => {
      warnings.push({
        key: `provider-${provider.Name}-${index}`,
        title: `${provider.Name} needs attention`,
        detail: warning,
        to: '/settings/metadata-sites',
      });
    });
  });

  readiness?.PlexTarget.Warnings.forEach((warning, index) => {
    warnings.push({
      key: `plex-${index}`,
      title: 'Plex target needs attention',
      detail: warning,
      to: '/settings/integrations',
    });
  });

  return warnings;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="app-card rounded-md px-5 py-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 truncate text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

function WarningPanel({ warnings }: { warnings: WarningItem[] }) {
  return (
    <div className="app-card rounded-md border-yellow-700/50">
      <div className="flex items-center gap-2 border-b border-yellow-800/40 px-5 py-3">
        <AlertTriangle size={15} className="text-yellow-400" />
        <h2 className="text-sm font-semibold text-gray-200">Readiness Warnings</h2>
        <span className="ml-auto rounded-full bg-yellow-900/40 px-2 py-0.5 text-xs text-yellow-400">{warnings.length}</span>
      </div>
      <ul className="divide-y divide-gray-800/50">
        {warnings.map(warning => (
          <li key={warning.key} className="px-5 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-yellow-200">{warning.title}</p>
                <p className="mt-0.5 text-xs text-gray-500">{warning.detail}</p>
              </div>
              {warning.to && (
                <Link to={warning.to} className="shrink-0 text-xs font-medium text-blue-400 hover:text-blue-300">
                  Open
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProviderPanel({ providers }: { providers: ProviderConnectionStatus[] }) {
  return (
    <div className="app-card rounded-md">
      <div className="border-b border-gray-700/50 px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-200">Providers</h2>
      </div>
      <ul className="divide-y divide-gray-800/50">
        {providers.map(provider => (
          <li key={provider.Name} className="px-5 py-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-gray-100">{provider.Name}</p>
                  <StatusPill state={provider.Ready ? 'ready' : provider.Enabled ? 'warning' : 'off'} label={provider.Ready ? 'Ready' : provider.Enabled ? 'Needs setup' : 'Disabled'} />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {provider.CollectionBuilders.length} collection builder{provider.CollectionBuilders.length === 1 ? '' : 's'}
                  {provider.ConfigurationSource ? ` · ${provider.ConfigurationSource}` : ''}
                </p>
                {provider.Warnings.length > 0 && (
                  <p className="mt-1 text-xs text-yellow-400">{provider.Warnings[0]}</p>
                )}
              </div>
              <div className="text-right text-xs text-gray-500">
                <p>Credential {provider.CredentialConfigured ? 'set' : 'missing'}</p>
                {provider.CacheExpirationDays != null && <p>{provider.CacheExpirationDays}d cache</p>}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CollectionManagerPanel({ status }: { status: DaCollectorStatus['CollectionManager'] }) {
  return (
    <div className="app-card rounded-md">
      <div className="border-b border-gray-700/50 px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-200">Collection Manager</h2>
      </div>
      <div className="grid grid-cols-2 gap-4 p-5">
        <MiniStat label="Collections" value={String(status.CollectionCount)} />
        <MiniStat label="Enabled" value={String(status.EnabledCollectionCount)} />
        <MiniStat label="Builders" value={String(status.CollectionBuilderCount)} />
        <MiniStat label="Sync" value={status.ScheduledSyncEnabled ? `${status.SyncIntervalMinutes}m` : 'Manual'} />
      </div>
      <div className="border-t border-gray-800/50 px-5 py-3">
        <Link to="/collections" className="text-xs font-medium text-blue-400 hover:text-blue-300">
          Manage collections
        </Link>
      </div>
    </div>
  );
}

function PlexPanel({ plex }: { plex: PlexTargetConnectionStatus }) {
  return (
    <div className="app-card rounded-md">
      <div className="flex items-center justify-between border-b border-gray-700/50 px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-200">Plex Target</h2>
        <StatusPill state={plex.Ready ? 'ready' : plex.Reachable ? 'warning' : 'off'} label={plex.Ready ? 'Ready' : plex.Reachable ? 'Partial' : 'Offline'} />
      </div>
      <div className="space-y-3 p-5">
        <HealthRow label="Base URL" value={plex.BaseUrl || '—'} />
        <HealthRow label="Identity" value={plex.Identity?.Version ? `v${plex.Identity.Version}` : plex.Identity?.Status ?? '—'} warn={!plex.Reachable} />
        <HealthRow label="Libraries" value={plex.LibraryCount == null ? plex.LibraryStatus : plex.LibraryCount} warn={plex.LibraryStatus !== 'OK'} />
        <HealthRow label="Section" value={plex.SectionKey ?? 'Not configured'} warn={!plex.SectionKeyConfigured} />
      </div>
      <div className="border-t border-gray-800/50 px-5 py-3">
        <Link to="/settings/integrations" className="text-xs font-medium text-blue-400 hover:text-blue-300">
          Configure Plex
        </Link>
      </div>
    </div>
  );
}

function CapabilitiesPanel({ capabilities }: { capabilities: ServerCapabilityStatus[] }) {
  const completed = capabilities.filter(capability => capability.Completed).length;

  return (
    <div className="app-card rounded-md">
      <div className="flex items-center justify-between border-b border-gray-700/50 px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-200">Server Capabilities</h2>
        <span className="text-xs text-gray-500">{completed}/{capabilities.length} complete</span>
      </div>
      <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
        {capabilities.map(capability => (
          <div key={capability.Key} className="rounded-md border border-gray-800/70 bg-gray-950/30 p-4">
            <div className="mb-2 flex items-center gap-2">
              {capability.Completed ? (
                <CheckCircle2 size={15} className="text-emerald-400" />
              ) : (
                <XCircle size={15} className="text-yellow-400" />
              )}
              <h3 className="truncate text-sm font-medium text-gray-100">{capability.Name}</h3>
            </div>
            <p className="line-clamp-2 text-xs text-gray-500">{capability.Summary}</p>
            {capability.ApiRoutes.length > 0 && (
              <p className="mt-2 text-[11px] text-gray-600">{capability.ApiRoutes.length} API route{capability.ApiRoutes.length === 1 ? '' : 's'}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonPanel({ title, message }: { title: string; message: string }) {
  return (
    <div className="app-card rounded-md">
      <div className="border-b border-gray-700/50 px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-200">{title}</h2>
      </div>
      <div className="px-5 py-8 text-center text-sm text-gray-600">{message}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-600">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-gray-100">{value}</p>
    </div>
  );
}

function HealthRow({ label, value, warn }: { label: string; value: number | string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <span className="text-gray-400">{label}</span>
      <span className={`truncate text-right ${warn ? 'font-medium text-yellow-400' : 'text-gray-300'}`}>{value}</span>
    </div>
  );
}

function StatusPill({ state, label }: { state: 'ready' | 'warning' | 'off'; label: string }) {
  const classes = {
    ready: 'bg-emerald-600/20 text-emerald-400',
    warning: 'bg-yellow-900/30 text-yellow-400',
    off: 'bg-gray-800 text-gray-500',
  }[state];

  return <span className={`rounded-full px-2 py-0.5 text-xs ${classes}`}>{label}</span>;
}

function QueueWidget({ queue, connState }: { queue: QueueStatus | null; connState: 'connecting' | 'live' | 'offline' }) {
  const idle = queue && queue.TotalCount === 0 && !queue.CurrentlyExecuting.length;

  return (
    <div className="app-card rounded-md">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-700/50 px-5 py-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-200">Queue</h2>
          {queue != null && (
            <StatusPill state={queue.Running ? 'ready' : 'warning'} label={queue.Running ? 'Running' : 'Paused'} />
          )}
        </div>
        <div className="flex items-center gap-3">
          {queue != null && (
            <span className="text-xs text-gray-500">
              {queue.WaitingCount} waiting · {queue.BlockedCount} blocked · {queue.TotalCount} total
            </span>
          )}
          {connState === 'live' && (
            <span className="flex items-center gap-1 text-xs text-emerald-400"><Wifi size={11} /> Live</span>
          )}
          {connState === 'connecting' && (
            <span className="flex items-center gap-1 text-xs text-gray-500"><RefreshCw size={11} className="animate-spin" /> Connecting</span>
          )}
          {connState === 'offline' && (
            <span className="flex items-center gap-1 text-xs text-gray-500"><WifiOff size={11} /> Offline</span>
          )}
        </div>
      </div>

      {queue == null ? (
        <div className="px-5 py-5 text-center text-sm text-gray-600">Waiting for queue data…</div>
      ) : idle ? (
        <div className="px-5 py-5 text-center text-sm text-gray-500">Queue is idle.</div>
      ) : (
        <ul className="divide-y divide-gray-800/50 max-h-48 overflow-y-auto">
          {queue.CurrentlyExecuting.map(item => (
            <li key={item.Key} className="flex items-center justify-between gap-4 px-5 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm text-gray-200">{item.Title}</p>
                {formatQueueDetails(item.Details) && (
                  <p className="truncate text-xs text-gray-500">{formatQueueDetails(item.Details)}</p>
                )}
              </div>
              <span className="shrink-0 text-xs text-gray-500">{item.Type}</span>
            </li>
          ))}
          {queue.WaitingCount > 0 && (
            <li className="px-5 py-2 text-xs text-gray-600">
              +{queue.WaitingCount} job{queue.WaitingCount !== 1 ? 's' : ''} waiting
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function formatQueueDetails(details: Record<string, unknown> | undefined) {
  if (!details) return '';
  return Object.entries(details)
    .map(([key, value]) => `${key}: ${formatQueueValue(value)}`)
    .join(' · ');
}

function formatQueueValue(value: unknown) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
