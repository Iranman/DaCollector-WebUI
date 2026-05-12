import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { initApi, ServerStatus } from '../api/init';
import { api, ApiError } from '../api/client';
import { QueueStatus } from '../api/queue';
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

function fmtBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    async function load() {
      try {
        const [s, v] = await Promise.all([
          initApi.getStatus(),
          initApi.getVersion(),
        ]);
        setStatus(s);
        setVersion(v.Server.Version);

        if (s.State === 'Started') {
          try {
            const st = await api.get<CollectionStats>('/api/v3/Dashboard/Stats');
            setStats(st);
          } catch {
            // Stats are unavailable if the collection is empty or during startup — not a hard error
          }
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          navigate('/login');
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load data.');
        }
      }
    }
    load();
  }, [navigate]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold text-white">Dashboard</h1>
        {version && <span className="text-xs text-gray-500">Server {version}</span>}
      </div>

      {error && (
        <div className="app-card rounded-md px-4 py-3 text-sm text-red-400 border-red-700/50">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Status" value={status?.State ?? '—'} />
        <StatCard label="Uptime" value={status?.Uptime ?? '—'} />
        <StatCard label="Series" value={stats ? String(stats.SeriesCount) : '—'} />
        <StatCard label="Files" value={stats ? String(stats.FileCount) : '—'} />
      </div>

      <QueueWidget queue={queue} connState={queueConn} />

      {stats && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Groups" value={String(stats.GroupCount)} />
            <StatCard label="Watched" value={`${stats.WatchedHours}h`} />
            <StatCard label="File Size" value={fmtBytes(stats.FileSize)} />
            <StatCard label="Duplicates" value={`${stats.PercentDuplicate}%`} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="app-card rounded-md">
              <div className="border-b border-gray-700/50 px-5 py-3">
                <h2 className="text-sm font-semibold text-gray-200">Collection Health</h2>
              </div>
              <ul className="divide-y divide-gray-800/50">
                <HealthRow label="Missing Episodes" value={stats.MissingEpisodes} warn={stats.MissingEpisodes > 0} />
                <HealthRow label="Missing Episodes (Collecting)" value={stats.MissingEpisodesCollecting} warn={stats.MissingEpisodesCollecting > 0} />
                <HealthRow label="Unrecognized Files" value={stats.UnrecognizedFiles} warn={stats.UnrecognizedFiles > 0} />
                <HealthRow label="Series Missing Links" value={stats.SeriesWithMissingLinks} warn={stats.SeriesWithMissingLinks > 0} />
                <HealthRow label="Episodes w/ Multiple Files" value={stats.EpisodesWithMultipleFiles} warn={stats.EpisodesWithMultipleFiles > 0} />
                <HealthRow label="Duplicate File Locations" value={stats.FilesWithDuplicateLocations} warn={stats.FilesWithDuplicateLocations > 0} />
              </ul>
            </div>

            <div className="app-card rounded-md">
              <div className="border-b border-gray-700/50 px-5 py-3">
                <h2 className="text-sm font-semibold text-gray-200">Watch Progress</h2>
              </div>
              <ul className="divide-y divide-gray-800/50">
                <HealthRow label="Finished Series" value={stats.FinishedSeries} />
                <HealthRow label="Watched Episodes" value={stats.WatchedEpisodes} />
                <HealthRow label="Watch Hours" value={`${stats.WatchedHours}h`} />
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="app-card rounded-md px-5 py-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

function HealthRow({ label, value, warn }: { label: string; value: number | string; warn?: boolean }) {
  return (
    <li className="flex items-center justify-between px-5 py-2.5 text-sm">
      <span className="text-gray-400">{label}</span>
      <span className={warn ? 'text-yellow-400 font-medium' : 'text-gray-300'}>{value}</span>
    </li>
  );
}

function QueueWidget({ queue, connState }: { queue: QueueStatus | null; connState: 'connecting' | 'live' | 'offline' }) {
  const idle = queue && queue.TotalCount === 0 && !queue.CurrentlyExecuting.length;

  return (
    <div className="app-card rounded-md">
      <div className="flex items-center justify-between border-b border-gray-700/50 px-5 py-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-200">Queue</h2>
          {queue != null && (
            <span className={`rounded-full px-2 py-0.5 text-xs ${
              queue.Running ? 'bg-blue-600/20 text-blue-400' : 'bg-yellow-900/30 text-yellow-500'
            }`}>
              {queue.Running ? 'Running' : 'Paused'}
            </span>
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
                <p className="text-sm text-gray-200 truncate">{item.Title}</p>
                {item.Details && <p className="text-xs text-gray-500 truncate">{item.Details}</p>}
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
