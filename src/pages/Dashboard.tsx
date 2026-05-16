import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Film, FolderPlus, FolderSearch, RefreshCw, Tv, Wifi, WifiOff } from 'lucide-react';
import { ServerStatus } from '../api/init';
import { ApiError } from '../api/client';
import { QueueStatus } from '../api/queue';
import { managedFoldersApi, ManagedFolder } from '../api/managedFolders';
import { CollectionStats, DashboardEpisode, dashboardApi, DashboardSeries } from '../api/dashboard';
import { DaCollectorStatus } from '../api/dacollectorStatus';
import { fileReviewApi, MediaFileReviewItem } from '../api/fileReview';
import { useLiveState } from '../lib/liveState';

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
  const { error: liveError, queue, queueConnection, readiness, refresh, status, versions } = useLiveState();
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [recentEpisodes, setRecentEpisodes] = useState<DashboardEpisode[]>([]);
  const [recentSeries, setRecentSeries] = useState<DashboardSeries[]>([]);
  const [unmatchedFiles, setUnmatchedFiles] = useState<MediaFileReviewItem[]>([]);
  const [unmatchedTotal, setUnmatchedTotal] = useState(0);
  const [managedFolders, setManagedFolders] = useState<ManagedFolder[]>([]);
  const [managedFolderCount, setManagedFolderCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentlyImportedTab, setRecentlyImportedTab] = useState<'episodes' | 'series'>('episodes');

  useEffect(() => {
    let stopped = false;

    async function load() {
      if (status?.State !== 'Started') return;
      try {
        const [statsResult, foldersResult, unmatchedResult, recentEpisodesResult, recentSeriesResult] =
          await Promise.allSettled([
            dashboardApi.stats(),
            managedFoldersApi.list(),
            fileReviewApi.getUnmatched(1, 4, false),
            dashboardApi.recentlyAddedEpisodes(12),
            dashboardApi.recentlyAddedSeries(12),
          ]);
        if (stopped) return;

        if ([statsResult, foldersResult, unmatchedResult, recentEpisodesResult, recentSeriesResult]
          .some(r => r.status === 'rejected' && r.reason instanceof ApiError && r.reason.status === 401)) {
          navigate('/login');
          return;
        }

        setError(null);
        if (statsResult.status === 'fulfilled') setStats(statsResult.value);
        else setError(statsResult.reason instanceof Error ? statsResult.reason.message : 'Failed to load stats.');

        if (foldersResult.status === 'fulfilled') {
          setManagedFolders(foldersResult.value);
          setManagedFolderCount(foldersResult.value.length);
        }
        if (unmatchedResult.status === 'fulfilled') {
          setUnmatchedTotal(unmatchedResult.value.Total);
          setUnmatchedFiles(unmatchedResult.value.List);
        }
        if (recentEpisodesResult.status === 'fulfilled') setRecentEpisodes(recentEpisodesResult.value.List);
        if (recentSeriesResult.status === 'fulfilled') setRecentSeries(recentSeriesResult.value.List);
      } catch (err) {
        if (stopped) return;
        if (err instanceof ApiError && err.status === 401) navigate('/login');
        else setError(err instanceof Error ? err.message : 'Failed to load data.');
      }
    }

    load();
    return () => { stopped = true; };
  }, [navigate, status?.State]);

  const warnings = useMemo(
    () => buildWarnings(readiness, managedFolderCount, status),
    [readiness, managedFolderCount, status]
  );

  return (
    <div className="w-full space-y-5 px-4 py-5 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800/70 pb-4">
        <div>
          <h1 className="text-base font-semibold text-gray-200">Dashboard</h1>
          <p className="mt-0.5 text-xs text-gray-500">
            {status?.State ?? 'Unknown'}{versions?.Server.Version ? ` · Server ${versions.Server.Version}` : ''}
            {versions?.WebUI?.Version ? ` · WebUI ${versions.WebUI.Version}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-700/70 bg-gray-900/50 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-shoko-accent/70 hover:text-white"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {(error || liveError) && (
        <div className="app-card rounded-md border-red-700/50 px-4 py-3 text-sm text-red-400">
          {error || liveError}
        </div>
      )}

      {warnings.length > 0 && <WarningsPanel warnings={warnings} />}

      {/* Key stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Series" value={stats ? String(stats.SeriesCount) : '—'} />
        <StatCard label="Files" value={stats ? String(stats.FileCount) : '—'} />
        <StatCard label="Unrecognized" value={stats ? String(stats.UnrecognizedFiles) : '—'} accent={stats?.UnrecognizedFiles ? stats.UnrecognizedFiles > 0 : false} />
        <StatCard label="Library Size" value={stats ? fmtBytes(stats.FileSize) : '—'} />
      </div>

      {/* Queue + Unrecognized files */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <QueueWidget queue={queue} connState={queueConnection} />
        <UnrecognizedFilesPanel files={unmatchedFiles} total={unmatchedTotal} />
      </div>

      {/* Recently imported */}
      <RecentlyImportedPanel
        activeTab={recentlyImportedTab}
        episodes={recentEpisodes}
        series={recentSeries}
        onTabChange={setRecentlyImportedTab}
      />

      {/* Import folders */}
      <ImportFoldersPanel folders={managedFolders} />
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
    warnings.push({ key: 'setup', title: 'First-run setup is waiting', detail: 'Create the administrator account before using protected workflows.', to: '/setup' });
  }
  if (status?.State === 'Failed') {
    warnings.push({ key: 'startup-failed', title: 'Server startup failed', detail: status.StartupMessage ?? 'Open logs for the startup failure details.', to: '/log' });
  }
  if (managedFolderCount === 0) {
    warnings.push({ key: 'folders', title: 'No managed folders configured', detail: 'Add server-mounted media folders before scanning local media.', to: '/folders' });
  }

  readiness?.Providers.forEach(provider => {
    provider.Warnings.forEach((warning, index) => {
      warnings.push({ key: `provider-${provider.Name}-${index}`, title: `${provider.Name} needs attention`, detail: warning, to: '/settings/metadata-sites' });
    });
  });

  readiness?.PlexTarget.Warnings.forEach((warning, index) => {
    warnings.push({ key: `plex-${index}`, title: 'Plex target needs attention', detail: warning, to: '/settings/integrations' });
  });

  return warnings;
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="app-card rounded-md px-5 py-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 truncate text-2xl font-semibold ${accent ? 'text-yellow-400' : 'text-gray-100'}`}>{value}</p>
    </div>
  );
}

function WarningsPanel({ warnings }: { warnings: WarningItem[] }) {
  return (
    <div className="app-card rounded-md border-yellow-700/50">
      <div className="flex items-center gap-2 border-b border-yellow-800/40 px-5 py-3">
        <AlertTriangle size={14} className="text-yellow-400" />
        <h2 className="text-sm font-semibold text-gray-200">Readiness Warnings</h2>
        <span className="ml-auto rounded-full bg-yellow-900/40 px-2 py-0.5 text-xs text-yellow-400">{warnings.length}</span>
      </div>
      <ul className="divide-y divide-gray-800/50">
        {warnings.map(warning => (
          <li key={warning.key} className="flex items-start justify-between gap-4 px-5 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-yellow-200">{warning.title}</p>
              <p className="mt-0.5 text-xs text-gray-500">{warning.detail}</p>
            </div>
            {warning.to && (
              <Link to={warning.to} className="shrink-0 text-xs font-medium text-shoko-accent hover:text-shoko-accent/80">Open</Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function QueueWidget({ queue, connState }: { queue: QueueStatus | null; connState: 'connecting' | 'live' | 'offline' }) {
  const idle = queue && queue.TotalCount === 0 && !queue.CurrentlyExecuting.length;
  const runningItems = queue?.CurrentlyExecuting ?? [];

  return (
    <section className="app-card overflow-hidden rounded-md">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <h2 className="font-semibold text-gray-200">Queue</h2>
          {queue != null && (
            <>
              <span className="text-gray-600">·</span>
              <span className="font-semibold text-emerald-400">{queue.ThreadCount} workers</span>
              <span className="text-gray-600">·</span>
              <span className="text-gray-400">{queue.TotalCount} tasks</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs">
          {queue != null && (
            <span className={`rounded-full px-2 py-0.5 text-xs ${queue.Running ? 'bg-emerald-600/20 text-emerald-400' : 'bg-yellow-900/30 text-yellow-400'}`}>
              {queue.Running ? 'Running' : 'Paused'}
            </span>
          )}
          {connState === 'live' && <span className="flex items-center gap-1 text-xs text-emerald-400"><Wifi size={11} /> Live</span>}
          {connState === 'connecting' && <span className="flex items-center gap-1 text-xs text-gray-500"><RefreshCw size={11} className="animate-spin" /> Connecting</span>}
          {connState === 'offline' && <span className="flex items-center gap-1 text-xs text-gray-500"><WifiOff size={11} /> Offline</span>}
        </div>
      </div>

      {queue == null ? (
        <div className="px-5 py-12 text-center text-sm text-gray-600">Waiting for queue data…</div>
      ) : idle ? (
        <div className="px-5 py-12 text-center text-sm text-gray-500">Queue is idle.</div>
      ) : (
        <ul className="max-h-56 divide-y divide-gray-800/50 overflow-y-auto px-3 pb-3">
          {runningItems.map(item => (
            <li key={item.Key} className="rounded-md px-3 py-2.5 odd:bg-gray-950/30">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm text-gray-200">{item.Title || item.Type}</p>
                  {formatQueueDetails(item.Details) && (
                    <p className="truncate text-xs text-gray-500">{formatQueueDetails(item.Details)}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-gray-500">{item.Type}</span>
              </div>
            </li>
          ))}
          {queue.WaitingCount > 0 && (
            <li className="px-3 py-2 text-xs text-gray-600">+{queue.WaitingCount} more waiting</li>
          )}
        </ul>
      )}
    </section>
  );
}

function UnrecognizedFilesPanel({ files, total }: { files: MediaFileReviewItem[]; total: number }) {
  return (
    <section className="app-card overflow-hidden rounded-md">
      <div className="flex items-center justify-between gap-3 px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-200">Unrecognized Files</h2>
        <Link to="/files?tab=unmatched" className="text-xs font-semibold text-shoko-accent hover:text-shoko-accent/80">
          {total} file{total !== 1 ? 's' : ''}
        </Link>
      </div>

      {files.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-gray-500">No unrecognized files.</div>
      ) : (
        <ul className="max-h-56 divide-y divide-gray-800/50 overflow-y-auto px-3 pb-3">
          {files.map(file => (
            <li key={file.FileID}>
              <Link to="/files?tab=unmatched" className="flex items-center gap-3 rounded-md px-3 py-2.5 odd:bg-gray-950/30 hover:bg-white/5">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-gray-500">{formatDateTime(file.Review.UpdatedAt ?? file.Review.LastParsedAt ?? file.Review.CreatedAt)}</p>
                  <p className="truncate text-sm text-gray-200">{fileDisplayName(file)}</p>
                </div>
                <FolderSearch size={15} className="shrink-0 text-shoko-accent" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {total > files.length && (
        <div className="border-t border-gray-800/50 px-5 py-3 text-right">
          <Link to="/files?tab=unmatched" className="text-xs font-medium text-shoko-accent hover:text-shoko-accent/80">Review all</Link>
        </div>
      )}
    </section>
  );
}

function RecentlyImportedPanel({
  activeTab,
  episodes,
  onTabChange,
  series,
}: {
  activeTab: 'episodes' | 'series';
  episodes: DashboardEpisode[];
  onTabChange: (tab: 'episodes' | 'series') => void;
  series: DashboardSeries[];
}) {
  const count = activeTab === 'episodes' ? episodes.length : series.length;

  return (
    <section className="app-card overflow-hidden rounded-md">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-200">Recently Imported</h2>
        <div className="inline-flex overflow-hidden rounded border border-gray-800 bg-gray-950/30 p-0.5">
          <TabButton active={activeTab === 'episodes'} onClick={() => onTabChange('episodes')}>
            <Film size={11} /> Episodes
          </TabButton>
          <TabButton active={activeTab === 'series'} onClick={() => onTabChange('series')}>
            <Tv size={11} /> Series
          </TabButton>
        </div>
      </div>

      {count === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-gray-600">No recently imported media.</div>
      ) : (
        <div className="overflow-x-auto px-5 pb-5">
          <div className="flex min-w-max gap-4">
            {activeTab === 'episodes'
              ? episodes.map((episode, index) => <RecentEpisodeCard key={`${episode.IDs.DaCollectorEpisode ?? episode.IDs.ID}-${index}`} episode={episode} />)
              : series.map((item, index) => <RecentSeriesCard key={`${seriesID(item) ?? index}-${seriesTitle(item)}`} series={item} />)}
          </div>
        </div>
      )}
    </section>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 min-w-20 px-3 py-1.5 text-xs font-medium transition-colors ${active ? 'rounded bg-gray-800 text-gray-100' : 'text-gray-500 hover:text-gray-300'}`}
    >
      {children}
    </button>
  );
}

function RecentEpisodeCard({ episode }: { episode: DashboardEpisode }) {
  const thumbnail = imageUrl(episode.Thumbnail) ?? imageUrl(episode.SeriesPoster);
  return (
    <Link to={episode.IDs.DaCollectorFile != null ? `/files?search=${episode.IDs.DaCollectorFile}` : '/media'} className="group block w-28 shrink-0">
      {thumbnail ? (
        <img
          src={thumbnail}
          alt=""
          className="aspect-[2/3] w-full rounded border border-gray-800/80 object-cover shadow-lg transition group-hover:border-shoko-accent/60"
          loading="lazy"
        />
      ) : (
        <div className="grid aspect-[2/3] w-full place-items-center rounded border border-gray-800/80 bg-gray-950/50 text-xl font-semibold text-gray-700">
          {episode.Number}
        </div>
      )}
      <p className="mt-2 line-clamp-2 min-h-9 text-xs font-medium text-gray-200">{episode.Title || `Episode ${episode.Number}`}</p>
      <p className="mt-0.5 truncate text-[11px] text-gray-500">{episode.SeriesTitle}</p>
    </Link>
  );
}

function RecentSeriesCard({ series }: { series: DashboardSeries }) {
  return (
    <Link to="/media" className="group block w-28 shrink-0">
      <div className="flex aspect-[2/3] w-full items-end rounded border border-gray-800/80 bg-gradient-to-b from-gray-800/80 to-gray-950/90 p-2.5 shadow-lg transition group-hover:border-shoko-accent/60">
        <span className="line-clamp-3 text-sm font-semibold text-gray-200">{seriesTitle(series)}</span>
      </div>
      <p className="mt-2 line-clamp-2 min-h-9 text-xs font-medium text-gray-200">{seriesTitle(series)}</p>
      <p className="mt-0.5 truncate text-[11px] text-gray-500">
        {series.EpisodeCount != null ? `${series.EpisodeCount} episodes` : 'Series'}
      </p>
    </Link>
  );
}

function ImportFoldersPanel({ folders }: { folders: ManagedFolder[] }) {
  return (
    <section className="app-card rounded-md">
      <div className="flex items-center justify-between border-b border-gray-700/50 px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-200">Import Folders</h2>
        <Link to="/folders" className="text-shoko-accent hover:text-shoko-accent/80">
          <FolderPlus size={18} />
        </Link>
      </div>

      {folders.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-gray-600">No import folders configured.</div>
      ) : (
        <div className="divide-y divide-gray-800/50">
          {folders.map(folder => (
            <div key={folder.ID} className="flex items-center gap-4 px-5 py-3">
              <FolderSearch size={15} className={`shrink-0 ${folder.WatchForNewFiles ? 'text-shoko-accent' : 'text-gray-600'}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-200">{folder.Name}</p>
                <p className="truncate text-xs text-gray-500">{folder.Path}</p>
              </div>
              <div className="shrink-0 text-right text-xs text-gray-500">
                <p>{fmtBytes(folder.FileSize)}</p>
                {folder.Size > 0 && <p>{folder.Size} items</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function imageUrl(image?: { ID: number; Source: string; Type: string; Available?: boolean } | null) {
  if (!image || image.ID <= 0 || image.Available === false) return undefined;
  return `/api/v3/Image/${encodeURIComponent(image.Source)}/${encodeURIComponent(image.Type)}/${image.ID}`;
}

function fileDisplayName(file: MediaFileReviewItem) {
  const primary = file.Locations.find(location => location.FileName)?.FileName;
  return primary || file.PrimaryPath.split(/[\\/]/).pop() || `File ${file.FileID}`;
}

function formatDateTime(value?: string) {
  if (!value) return 'Unknown time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function seriesTitle(series: DashboardSeries) {
  return series.Name ?? series.Title ?? `Series ${seriesID(series) ?? 'unknown'}`;
}

function seriesID(series: DashboardSeries) {
  return series.ID ?? series.IDs?.ID;
}

function formatQueueDetails(details: Record<string, unknown> | undefined) {
  if (!details) return '';
  return Object.entries(details)
    .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join(' · ');
}
