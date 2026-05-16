import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock3, FolderPlus, FolderSearch, RefreshCw, Settings2, Wifi, WifiOff, XCircle } from 'lucide-react';
import { ServerStatus } from '../api/init';
import { ApiError } from '../api/client';
import { QueueStatus } from '../api/queue';
import { managedFoldersApi, ManagedFolder } from '../api/managedFolders';
import {
  CollectionStats,
  DashboardEpisode,
  dashboardApi,
  DashboardSeries,
  DashboardSeriesSummary,
} from '../api/dashboard';
import {
  DaCollectorStatus,
  ProviderConnectionStatus,
  PlexTargetConnectionStatus,
  ServerCapabilityStatus,
} from '../api/dacollectorStatus';
import { fileReviewApi, MediaFileReviewItem } from '../api/fileReview';
import { useLiveState } from '../lib/liveState';

interface WarningItem {
  key: string;
  title: string;
  detail: string;
  to?: string;
}

type DashboardPanelId =
  | 'summary'
  | 'activity'
  | 'watch-state'
  | 'warnings'
  | 'queue-plex'
  | 'import-folders'
  | 'providers'
  | 'collection-health'
  | 'composition'
  | 'capabilities';

const dashboardPanelLabels: Record<DashboardPanelId, string> = {
  summary: 'Collection statistics',
  activity: 'Recently imported',
  'watch-state': 'Watch state',
  warnings: 'Readiness warnings',
  'queue-plex': 'Queue and unrecognized files',
  'import-folders': 'Import folders',
  providers: 'Providers and collections',
  'collection-health': 'Collection health',
  composition: 'Media type',
  capabilities: 'Server capabilities',
};

const defaultDashboardPanelOrder: DashboardPanelId[] = [
  'queue-plex',
  'activity',
  'summary',
  'composition',
  'import-folders',
  'warnings',
  'watch-state',
  'providers',
  'collection-health',
  'capabilities',
];

const dashboardPrefsKey = 'dacollector_dashboard_panels';
const dashboardPrefsVersion = 4;
const defaultVisibleDashboardPanels = new Set<DashboardPanelId>(['queue-plex', 'activity', 'summary', 'composition', 'import-folders']);
const legacyDefaultDashboardPanelOrders: DashboardPanelId[][] = [
  ['summary', 'activity', 'watch-state', 'warnings', 'queue-plex', 'providers', 'collection-health', 'composition', 'capabilities'],
  ['summary', 'warnings', 'queue-plex', 'activity', 'watch-state', 'providers', 'collection-health', 'composition', 'capabilities'],
  ['queue-plex', 'warnings', 'activity', 'summary', 'watch-state', 'providers', 'collection-health', 'composition', 'capabilities'],
];

function fmtBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    error: liveError,
    queue,
    queueConnection,
    readiness,
    refresh,
    status,
    versions,
  } = useLiveState();
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [seriesSummary, setSeriesSummary] = useState<DashboardSeriesSummary | null>(null);
  const [recentEpisodes, setRecentEpisodes] = useState<DashboardEpisode[]>([]);
  const [recentSeries, setRecentSeries] = useState<DashboardSeries[]>([]);
  const [continueWatching, setContinueWatching] = useState<DashboardEpisode[]>([]);
  const [nextUp, setNextUp] = useState<DashboardEpisode[]>([]);
  const [unmatchedFiles, setUnmatchedFiles] = useState<MediaFileReviewItem[]>([]);
  const [unmatchedTotal, setUnmatchedTotal] = useState(0);
  const [managedFolders, setManagedFolders] = useState<ManagedFolder[]>([]);
  const [managedFolderCount, setManagedFolderCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extrasError, setExtrasError] = useState<string | null>(null);
  const [recentlyImportedTab, setRecentlyImportedTab] = useState<'episodes' | 'series'>('episodes');
  const [panelSettingsOpen, setPanelSettingsOpen] = useState(false);
  const [panelOrder, setPanelOrder] = useState<DashboardPanelId[]>(() => loadDashboardPrefs().order);
  const [panelVisibility, setPanelVisibility] = useState<Record<DashboardPanelId, boolean>>(() => loadDashboardPrefs().visibility);

  useEffect(() => {
    let stopped = false;

    async function load() {
      if (status?.State !== 'Started') return;

      const shouldLoadActivity = panelVisibility.activity !== false;
      const shouldLoadWatchState = panelVisibility['watch-state'] !== false;
      const shouldLoadComposition = panelVisibility.composition !== false;
      const shouldLoadReview = panelVisibility['queue-plex'] !== false;

      try {
        const [
          statsResult,
          foldersResult,
          unmatchedResult,
          seriesSummaryResult,
          recentEpisodesResult,
          recentSeriesResult,
          continueWatchingResult,
          nextUpResult,
        ] = await Promise.allSettled([
          dashboardApi.stats(),
          managedFoldersApi.list(),
          shouldLoadReview ? fileReviewApi.getUnmatched(1, 4, false) : Promise.resolve({ Total: 0, List: [] as MediaFileReviewItem[] }),
          shouldLoadComposition ? dashboardApi.seriesSummary() : Promise.resolve(null),
          shouldLoadActivity ? dashboardApi.recentlyAddedEpisodes(12) : Promise.resolve({ Total: 0, List: [] as DashboardEpisode[] }),
          shouldLoadActivity ? dashboardApi.recentlyAddedSeries(12) : Promise.resolve({ Total: 0, List: [] as DashboardSeries[] }),
          shouldLoadWatchState ? dashboardApi.continueWatchingEpisodes(8) : Promise.resolve({ Total: 0, List: [] as DashboardEpisode[] }),
          shouldLoadWatchState ? dashboardApi.nextUpEpisodes(8) : Promise.resolve({ Total: 0, List: [] as DashboardEpisode[] }),
        ]);
        if (stopped) return;

        setError(null);
        setExtrasError(null);

        if (hasUnauthorized([
          statsResult,
          foldersResult,
          unmatchedResult,
          seriesSummaryResult,
          recentEpisodesResult,
          recentSeriesResult,
          continueWatchingResult,
          nextUpResult,
        ])) {
          navigate('/login');
          return;
        }

        if (statsResult.status === 'fulfilled') {
          setStats(statsResult.value);
        } else {
          setError(toErrorMessage(statsResult.reason, 'Failed to load dashboard stats.'));
        }

        if (foldersResult.status === 'fulfilled') {
          setManagedFolders(foldersResult.value);
          setManagedFolderCount(foldersResult.value.length);
        }

        if (unmatchedResult.status === 'fulfilled') {
          setUnmatchedTotal(unmatchedResult.value.Total);
          setUnmatchedFiles(unmatchedResult.value.List);
        }

        const extraFailure = [
          shouldLoadReview ? unmatchedResult : null,
          shouldLoadComposition ? seriesSummaryResult : null,
          shouldLoadActivity ? recentEpisodesResult : null,
          shouldLoadActivity ? recentSeriesResult : null,
          shouldLoadWatchState ? continueWatchingResult : null,
          shouldLoadWatchState ? nextUpResult : null,
        ].find(result => result?.status === 'rejected');
        if (extraFailure?.status === 'rejected') {
          setExtrasError(toErrorMessage(extraFailure.reason, 'Some dashboard panels could not be loaded.'));
        }

        if (seriesSummaryResult.status === 'fulfilled') setSeriesSummary(seriesSummaryResult.value);
        if (recentEpisodesResult.status === 'fulfilled') setRecentEpisodes(recentEpisodesResult.value.List);
        if (recentSeriesResult.status === 'fulfilled') setRecentSeries(recentSeriesResult.value.List);
        if (continueWatchingResult.status === 'fulfilled') setContinueWatching(continueWatchingResult.value.List);
        if (nextUpResult.status === 'fulfilled') setNextUp(nextUpResult.value.List);
      } catch (err) {
        if (stopped) return;
        if (err instanceof ApiError && err.status === 401) {
          navigate('/login');
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load data.');
        }
      }
    }

    load();

    return () => { stopped = true; };
  }, [navigate, panelVisibility, status?.State]);

  const warnings = useMemo(
    () => buildWarnings(readiness, managedFolderCount, status),
    [readiness, managedFolderCount, status]
  );

  useEffect(() => {
    localStorage.setItem(dashboardPrefsKey, JSON.stringify({
      version: dashboardPrefsVersion,
      order: panelOrder,
      visibility: panelVisibility,
    }));
  }, [panelOrder, panelVisibility]);

  function movePanel(panelId: DashboardPanelId, direction: -1 | 1) {
    setPanelOrder(current => {
      const index = current.indexOf(panelId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function resetPanelSettings() {
    setPanelOrder(defaultDashboardPanelOrder);
    setPanelVisibility(defaultDashboardPanelVisibility());
  }

  function renderDashboardPanel(panelId: DashboardPanelId) {
    if (panelVisibility[panelId] === false) return null;

    if (panelId === 'summary') {
      return <CollectionStatisticsPanel key={panelId} stats={stats} />;
    }

    if (panelId === 'activity') {
      return (
        <div key={panelId} className="xl:col-span-3">
          <RecentlyImportedPanel
            activeTab={recentlyImportedTab}
            episodes={recentEpisodes}
            series={recentSeries}
            onTabChange={setRecentlyImportedTab}
          />
        </div>
      );
    }

    if (panelId === 'watch-state') {
      return (
        <div key={panelId} className="grid grid-cols-1 gap-4 xl:col-span-3 xl:grid-cols-2">
          <EpisodeListPanel title="Continue Watching" episodes={continueWatching} emptyText="No active watch-state entries." />
          <EpisodeListPanel title="Next Up" episodes={nextUp} emptyText="No next-up episodes reported." />
        </div>
      );
    }

    if (panelId === 'warnings') {
      return warnings.length > 0 ? (
        <div key={panelId} className="xl:col-span-3">
          <WarningPanel warnings={warnings} />
        </div>
      ) : null;
    }

    if (panelId === 'queue-plex') {
      return (
        <div key={panelId} className="grid grid-cols-1 gap-4 xl:col-span-3 xl:grid-cols-2">
          <QueueWidget queue={queue} connState={queueConnection} />
          <UnrecognizedFilesPanel files={unmatchedFiles} total={unmatchedTotal} />
        </div>
      );
    }

    if (panelId === 'providers') {
      return readiness ? (
        <div key={panelId} className="grid grid-cols-1 gap-4 xl:col-span-3 xl:grid-cols-3">
          <ProviderPanel providers={readiness.Providers} />
          <PlexPanel plex={readiness.PlexTarget} />
          <CollectionManagerPanel status={readiness.CollectionManager} />
        </div>
      ) : null;
    }

    if (panelId === 'import-folders') {
      return <ImportFoldersPanel key={panelId} folders={managedFolders} />;
    }

    if (panelId === 'collection-health') {
      return stats ? (
        <div key={panelId} className="space-y-4 xl:col-span-3">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        </div>
      ) : null;
    }

    if (panelId === 'composition') {
      return <MediaTypePanel key={panelId} summary={seriesSummary} />;
    }

    if (panelId === 'capabilities') {
      return readiness ? (
        <div key={panelId} className="xl:col-span-3">
          <CapabilitiesPanel capabilities={readiness.ServerCapabilities} />
        </div>
      ) : null;
    }

    return null;
  }

  return (
    <div className="w-full space-y-4 px-3 py-4 sm:px-5 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800/70 pb-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
          <h1 className="text-sm font-semibold text-gray-200">Dashboard</h1>
          <span className="text-gray-700">|</span>
          <span className="truncate">Server {status?.State ?? 'Unknown'}</span>
          {versions?.Server.Version && <span className="truncate">Server {versions.Server.Version}</span>}
          {versions?.WebUI?.Version && <span className="truncate">WebUI {versions.WebUI.Version}</span>}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setPanelSettingsOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-700/70 bg-gray-900/50 px-3 py-1.5 text-gray-300 transition-colors hover:border-blue-500/70 hover:text-white"
          >
            <Settings2 size={13} />
            Dashboard Settings
          </button>
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-700/70 bg-gray-900/50 px-3 py-1.5 text-gray-300 transition-colors hover:border-blue-500/70 hover:text-white"
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="app-card rounded-md border-red-700/50 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {liveError && (
        <div className="app-card rounded-md border-yellow-700/50 px-4 py-3 text-sm text-yellow-400">
          {liveError}
        </div>
      )}

      {extrasError && (
        <div className="app-card rounded-md border-yellow-700/50 px-4 py-3 text-sm text-yellow-400">
          {extrasError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {panelOrder.map(panelId => renderDashboardPanel(panelId))}
      </div>

      {panelSettingsOpen && (
        <DashboardPanelSettings
          order={panelOrder}
          visibility={panelVisibility}
          onClose={() => setPanelSettingsOpen(false)}
          onMove={movePanel}
          onReset={resetPanelSettings}
          onToggle={(panelId, checked) => setPanelVisibility(current => ({ ...current, [panelId]: checked }))}
        />
      )}
    </div>
  );
}

function hasUnauthorized(results: PromiseSettledResult<unknown>[]) {
  return results.some(result => result.status === 'rejected' && result.reason instanceof ApiError && result.reason.status === 401);
}

function toErrorMessage(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
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
    <div className="app-card min-w-0 rounded-md px-5 py-4">
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
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-yellow-200">{warning.title}</p>
                <p className="mt-0.5 max-w-xs break-words text-xs text-gray-500 sm:max-w-none">{warning.detail}</p>
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

function EpisodeListPanel({ emptyText, episodes, title }: { emptyText: string; episodes: DashboardEpisode[]; title: string }) {
  return (
    <div className="app-card rounded-md">
      <PanelHeader icon={<Clock3 size={15} className="text-blue-400" />} title={title} count={episodes.length} />
      {episodes.length === 0 ? (
        <EmptyPanel text={emptyText} />
      ) : (
        <ul className="divide-y divide-gray-800/50">
          {episodes.map((episode, index) => (
            <li key={`${episode.IDs.DaCollectorEpisode ?? episode.IDs.ID}-${episode.IDs.DaCollectorFile ?? index}`} className="flex items-center gap-3 px-5 py-3">
              <EpisodeArtwork episode={episode} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-100">{episode.Title || `Episode ${episode.Number}`}</p>
                <p className="truncate text-xs text-gray-500">{episode.SeriesTitle}</p>
                <p className="mt-1 truncate text-[11px] text-gray-600">{episodeMeta(episode)}</p>
              </div>
              {episode.IDs.DaCollectorFile != null && (
                <Link to={`/files?search=${episode.IDs.DaCollectorFile}`} className="shrink-0 text-xs font-medium text-blue-400 hover:text-blue-300">
                  File
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
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
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-gray-200">Recently Imported</h2>
        <div className="inline-flex overflow-hidden rounded-md border border-gray-800 bg-gray-950/30 p-0.5">
          <button
            type="button"
            onClick={() => onTabChange('episodes')}
            className={`min-w-24 px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'episodes' ? 'rounded bg-gray-800 text-gray-100' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Episodes
          </button>
          <button
            type="button"
            onClick={() => onTabChange('series')}
            className={`min-w-24 px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'series' ? 'rounded bg-gray-800 text-gray-100' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Series
          </button>
        </div>
      </div>

      {count === 0 ? (
        <EmptyPanel text="No recently imported media reported." />
      ) : (
        <div className="overflow-x-auto px-4 pb-5 sm:px-5">
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

function RecentEpisodeCard({ episode }: { episode: DashboardEpisode }) {
  const thumbnail = imageUrl(episode.Thumbnail) ?? imageUrl(episode.SeriesPoster);

  return (
    <Link to={episode.IDs.DaCollectorFile != null ? `/files?search=${episode.IDs.DaCollectorFile}` : '/media'} className="group block w-32 shrink-0">
      {thumbnail ? (
        <img
          src={thumbnail}
          alt=""
          className="aspect-[2/3] w-full rounded-md border border-gray-800/80 object-cover shadow-lg transition group-hover:border-blue-500/60"
          loading="lazy"
        />
      ) : (
        <div className="grid aspect-[2/3] w-full place-items-center rounded-md border border-gray-800/80 bg-gray-950/50 text-xl font-semibold text-gray-700">
          {episode.Number}
        </div>
      )}
      <p className="mt-2 line-clamp-2 min-h-10 text-xs font-medium text-gray-200">{episode.Title || `Episode ${episode.Number}`}</p>
      <p className="mt-0.5 truncate text-[11px] text-gray-500">{episode.SeriesTitle}</p>
    </Link>
  );
}

function RecentSeriesCard({ series }: { series: DashboardSeries }) {
  return (
    <Link to="/media" className="group block w-32 shrink-0">
      <div className="flex aspect-[2/3] w-full items-end rounded-md border border-gray-800/80 bg-gradient-to-b from-gray-800/80 to-gray-950/90 p-3 shadow-lg transition group-hover:border-blue-500/60">
        <span className="line-clamp-3 text-sm font-semibold text-gray-200">{seriesTitle(series)}</span>
      </div>
      <p className="mt-2 line-clamp-2 min-h-10 text-xs font-medium text-gray-200">{seriesTitle(series)}</p>
      <p className="mt-0.5 truncate text-[11px] text-gray-500">
        {[series.EpisodeCount != null ? `${series.EpisodeCount} episodes` : undefined, series.Size != null ? `${series.Size} files` : undefined].filter(Boolean).join(' · ') || 'Series'}
      </p>
    </Link>
  );
}

function CollectionStatisticsPanel({ stats }: { stats: CollectionStats | null }) {
  const rows = stats ? [
    ['Series', stats.SeriesCount],
    ['Series Completed', stats.FinishedSeries],
    ['Episodes Watched', stats.WatchedEpisodes],
    ['Hours Watched', `${stats.WatchedHours} H`],
    ['Collection Size', fmtBytes(stats.FileSize)],
    ['Files', stats.FileCount],
    ['Unknown Files', stats.UnrecognizedFiles, 'text-blue-400'],
    ['Duplicate Episodes', stats.EpisodesWithMultipleFiles],
    ['Duplicate Hashes', stats.FilesWithDuplicateLocations],
    ['Missing TVDB/TMDB Links', stats.SeriesWithMissingLinks],
    ['Missing Episodes (Collecting)', stats.MissingEpisodesCollecting],
    ['Missing Episodes (Total)', stats.MissingEpisodes],
  ] as const : [];

  return (
    <section className="app-card rounded-md p-6 sm:p-8">
      <h2 className="text-xl font-semibold text-gray-200">Collection Statistics</h2>
      {stats == null ? (
        <EmptyPanel text="Collection statistics are not available." />
      ) : (
        <dl className="mt-7 space-y-1 text-lg">
          {rows.map(([label, value, valueClass]) => (
            <div key={label} className={`flex items-baseline justify-between gap-6 ${label === 'Collection Size' || label === 'Missing TVDB/TMDB Links' ? 'pt-4' : ''}`}>
              <dt className="min-w-0 text-gray-300">{label}</dt>
              <dd className={`shrink-0 text-right font-medium ${valueClass ?? 'text-gray-300'}`}>{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function MediaTypePanel({ summary }: { summary: DashboardSeriesSummary | null }) {
  const total = summary
    ? summary.Series + summary.Movie + summary.Web + summary.OVA + summary.Special + summary.MusicVideo + summary.Other + summary.Unknown + summary.None
    : 0;
  const rows = summary ? [
    { label: 'TV Series', value: summary.Series, color: 'bg-blue-400', text: 'text-blue-400' },
    { label: 'Movie', value: summary.Movie, color: 'bg-emerald-500', text: 'text-emerald-400' },
    { label: 'Web', value: summary.Web, color: 'bg-red-400', text: 'text-red-400' },
    { label: 'Other', value: summary.Other + summary.Unknown + summary.None, color: 'bg-purple-400', text: 'text-purple-400' },
    { label: 'OVA', value: summary.OVA, color: 'bg-yellow-400', text: 'text-yellow-300' },
    { label: 'Special', value: summary.Special, color: 'bg-cyan-400', text: 'text-cyan-300' },
    { label: 'Music Video', value: summary.MusicVideo, color: 'bg-pink-400', text: 'text-pink-300' },
  ].filter(row => row.value > 0) : [];

  return (
    <section className="app-card rounded-md p-6 sm:p-8">
      <h2 className="text-xl font-semibold text-gray-200">Media Type</h2>
      {summary == null || total === 0 || rows.length === 0 ? (
        <EmptyPanel text="No media type data reported." />
      ) : (
        <div className="mt-7 space-y-5">
          {rows.map(row => {
            const percent = total > 0 ? (row.value / total) * 100 : 0;
            return (
              <div key={row.label}>
                <div className="mb-2 flex items-baseline justify-between gap-4 text-lg">
                  <span className="text-gray-300">{row.label} - {row.value}</span>
                  <span className={`text-base font-semibold ${row.text}`}>{percent.toFixed(2)}%</span>
                </div>
                <div className="h-4 overflow-hidden rounded-md bg-gray-950/70">
                  <div className={`h-full rounded-md ${row.color}`} style={{ width: `${Math.max(3, percent)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ImportFoldersPanel({ folders }: { folders: ManagedFolder[] }) {
  return (
    <section className="app-card rounded-md p-6 sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-gray-200">Import Folders</h2>
        <Link to="/folders" title="Manage import folders" className="text-blue-400 hover:text-blue-300">
          <FolderPlus size={23} />
        </Link>
      </div>

      {folders.length === 0 ? (
        <EmptyPanel text="No import folders configured." />
      ) : (
        <div className="mt-7 space-y-8">
          {folders.map(folder => (
            <div key={folder.ID} className="min-w-0">
              <div className="mb-4 flex items-start justify-between gap-4">
                <h3 className="min-w-0 truncate text-lg font-semibold text-gray-300">{folder.Name}</h3>
                <div className="flex shrink-0 items-center gap-3">
                  {folder.WatchForNewFiles && <FolderSearch size={19} className="text-blue-400" />}
                </div>
              </div>
              <dl className="space-y-2 text-lg">
                <ImportFolderRow label="Location" value={folder.Path} />
                <ImportFolderRow label="Type" value={folder.WatchForNewFiles ? 'Watch' : formatDropFolderType(folder.DropFolderType)} />
                <ImportFolderRow
                  label="Size"
                  value={`${fmtBytes(folder.FileSize)}${folder.Size > 0 ? ` (${folder.Size} item${folder.Size === 1 ? '' : 's'})` : ''}`}
                />
              </dl>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ImportFolderRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <dt className="text-gray-300">{label}</dt>
      <dd className="min-w-0 max-w-[70%] break-words text-right text-gray-300">{value || '-'}</dd>
    </div>
  );
}

function formatDropFolderType(type: ManagedFolder['DropFolderType']) {
  return type === 'None' ? 'Manual' : type;
}

function PanelHeader({ count, icon, title }: { count?: number; icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-gray-700/50 px-5 py-3">
      {icon}
      <h2 className="text-sm font-semibold text-gray-200">{title}</h2>
      {count != null && <span className="ml-auto rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-500">{count}</span>}
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return <div className="px-5 py-8 text-center text-sm text-gray-600">{text}</div>;
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
      <div className="divide-y divide-gray-800/50">
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
    <div className="flex items-start justify-between gap-4 px-5 py-2 text-sm">
      <span className="min-w-0 break-words text-gray-400">{label}</span>
      <span className={`min-w-0 max-w-[65%] break-words text-right ${warn ? 'font-medium text-yellow-400' : 'text-gray-300'}`}>{value}</span>
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
  const runningItems = queue?.CurrentlyExecuting ?? [];

  return (
    <section className="app-card overflow-hidden rounded-md">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
          <h2 className="font-semibold text-gray-200">Queue Processor</h2>
          {queue != null && (
            <>
              <span className="text-gray-600">|</span>
              <span className="font-semibold text-emerald-400">{queue.ThreadCount} Worker{queue.ThreadCount === 1 ? '' : 's'}</span>
              <span className="text-gray-600">|</span>
              <span className="font-semibold text-emerald-400">{queue.TotalCount} Task{queue.TotalCount === 1 ? '' : 's'}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs">
          {queue != null && <StatusPill state={queue.Running ? 'ready' : 'warning'} label={queue.Running ? 'Running' : 'Paused'} />}
          {queue != null && (
            <span className="hidden text-gray-500 sm:inline">
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
        <div className="px-5 py-12 text-center text-sm text-gray-600">Waiting for queue data…</div>
      ) : idle ? (
        <div className="px-5 py-12 text-center text-sm text-gray-500">Queue is idle.</div>
      ) : (
        <ul className="max-h-64 divide-y divide-gray-800/50 overflow-y-auto px-3 pb-3 sm:px-4">
          {runningItems.map(item => (
            <li key={item.Key} className="rounded-md px-3 py-2.5 transition-colors odd:bg-gray-950/30">
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
            <li className="px-3 py-2 text-xs text-gray-600">
              +{queue.WaitingCount} job{queue.WaitingCount !== 1 ? 's' : ''} waiting
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

function UnrecognizedFilesPanel({ files, total }: { files: MediaFileReviewItem[]; total: number }) {
  return (
    <section className="app-card overflow-hidden rounded-md">
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-gray-200">Unrecognized Files</h2>
        <Link to="/utilities/unrecognized/files" className="text-xs font-semibold text-emerald-400 hover:text-emerald-300">
          {total} File{total === 1 ? '' : 's'}
        </Link>
      </div>

      {files.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-gray-500">No unrecognized files.</div>
      ) : (
        <ul className="max-h-64 divide-y divide-gray-800/50 overflow-y-auto px-3 pb-3 sm:px-4">
          {files.map(file => (
            <li key={file.FileID}>
              <Link to="/utilities/unrecognized/files" className="flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors odd:bg-gray-950/30 hover:bg-white/5">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-gray-500">{formatDateTime(file.Review.UpdatedAt ?? file.Review.LastParsedAt ?? file.Review.CreatedAt)}</p>
                  <p className="truncate text-sm text-gray-200">{fileDisplayName(file)}</p>
                  <p className="truncate text-xs text-gray-600">{file.PrimaryPath}</p>
                </div>
                <FolderSearch size={16} className="shrink-0 text-blue-400" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {total > files.length && (
        <div className="border-t border-gray-800/50 px-5 py-3 text-right">
          <Link to="/utilities/unrecognized/files" className="text-xs font-medium text-blue-400 hover:text-blue-300">
            Review all
          </Link>
        </div>
      )}
    </section>
  );
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

function EpisodeArtwork({ episode }: { episode: DashboardEpisode }) {
  const thumbnail = imageUrl(episode.Thumbnail) ?? imageUrl(episode.SeriesPoster);

  if (!thumbnail) {
    return (
      <div className="grid h-14 w-10 shrink-0 place-items-center rounded-md border border-gray-800/70 bg-gray-950/40 text-[10px] text-gray-600">
        {episode.Number}
      </div>
    );
  }

  return (
    <img
      src={thumbnail}
      alt=""
      className="h-14 w-10 shrink-0 rounded-md border border-gray-800/70 object-cover"
      loading="lazy"
    />
  );
}

function imageUrl(image?: { ID: number; Source: string; Type: string; Available?: boolean } | null) {
  if (!image || image.ID <= 0 || image.Available === false) return undefined;
  return `/api/v3/Image/${encodeURIComponent(image.Source)}/${encodeURIComponent(image.Type)}/${image.ID}`;
}

function episodeMeta(episode: DashboardEpisode) {
  return [
    `${episode.Type} ${episode.Number}`,
    formatDate(episode.AirDate),
    episode.Duration,
    episode.Watched ? `Watched ${formatDate(episode.Watched)}` : undefined,
  ].filter(Boolean).join(' · ');
}

function formatDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
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

function defaultDashboardPanelVisibility(): Record<DashboardPanelId, boolean> {
  return defaultDashboardPanelOrder.reduce((acc, panelId) => {
    acc[panelId] = defaultVisibleDashboardPanels.has(panelId);
    return acc;
  }, {} as Record<DashboardPanelId, boolean>);
}

function loadDashboardPrefs() {
  const fallback = {
    order: defaultDashboardPanelOrder,
    visibility: defaultDashboardPanelVisibility(),
  };

  try {
    const raw = localStorage.getItem(dashboardPrefsKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<{
      version: number;
      order: DashboardPanelId[];
      visibility: Partial<Record<DashboardPanelId, boolean>>;
    }>;
    const parsedOrder = parsed.order?.filter(panelId => defaultDashboardPanelOrder.includes(panelId)) ?? [];
    const order = [
      ...parsedOrder,
      ...defaultDashboardPanelOrder.filter(panelId => !parsedOrder.includes(panelId)),
    ];

    if (shouldResetLegacyDashboardPrefs(parsed, parsedOrder)) {
      return fallback;
    }

    return {
      order,
      visibility: {
        ...defaultDashboardPanelVisibility(),
        ...parsed.visibility,
      },
    };
  } catch {
    return fallback;
  }
}

function shouldResetLegacyDashboardPrefs(
  parsed: Partial<{
    version: number;
    order: DashboardPanelId[];
    visibility: Partial<Record<DashboardPanelId, boolean>>;
  }>,
  parsedOrder: DashboardPanelId[]
) {
  if (parsed.version === dashboardPrefsVersion) return false;

  const hasDefaultOrder = parsedOrder.length === 0 ||
    [defaultDashboardPanelOrder, ...legacyDefaultDashboardPanelOrders].some(order =>
      parsedOrder.length === order.length && parsedOrder.every((panelId, index) => panelId === order[index])
    );
  const visibility = parsed.visibility ?? {};
  const allPanelsVisible = defaultDashboardPanelOrder.every(panelId => visibility[panelId] !== false);

  return hasDefaultOrder && allPanelsVisible;
}

function DashboardPanelSettings({
  onClose,
  onMove,
  onReset,
  onToggle,
  order,
  visibility,
}: {
  onClose: () => void;
  onMove: (panelId: DashboardPanelId, direction: -1 | 1) => void;
  onReset: () => void;
  onToggle: (panelId: DashboardPanelId, checked: boolean) => void;
  order: DashboardPanelId[];
  visibility: Record<DashboardPanelId, boolean>;
}) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="app-surface w-full max-w-lg rounded-md p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Dashboard Panels</h2>
            <p className="mt-1 text-sm text-gray-500">Show, hide, and reorder dashboard panels for this browser.</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-200">Close</button>
        </div>

        <div className="mt-5 divide-y divide-gray-800/70 rounded-md border border-gray-800/70">
          {order.map((panelId, index) => (
            <div key={panelId} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <label className="flex min-w-0 flex-1 items-center gap-3 text-sm text-gray-200">
                <input
                  type="checkbox"
                  checked={visibility[panelId] !== false}
                  onChange={event => onToggle(panelId, event.target.checked)}
                  className="rounded border-gray-600 bg-gray-900 accent-blue-500"
                />
                <span>{dashboardPanelLabels[panelId]}</span>
              </label>
              <button
                type="button"
                disabled={index === 0}
                onClick={() => onMove(panelId, -1)}
                className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-300 disabled:opacity-40"
              >
                Up
              </button>
              <button
                type="button"
                disabled={index === order.length - 1}
                onClick={() => onMove(panelId, 1)}
                className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-300 disabled:opacity-40"
              >
                Down
              </button>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onReset} className="rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-300 hover:text-white">
            Reset
          </button>
          <button type="button" onClick={onClose} className="rounded-md bg-blue-500 px-3 py-2 text-sm font-medium text-black hover:bg-blue-400">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
