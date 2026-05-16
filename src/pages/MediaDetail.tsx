import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Database,
  Film,
  HardDrive,
  Image,
  Info,
  Layers,
  Link2,
  ListChecks,
  RefreshCw,
  Search,
  Tv,
  Unlink,
  X,
} from 'lucide-react';
import { ApiError } from '../api/client';
import {
  MediaEpisodeDto,
  MediaMovieDto,
  MediaProvider,
  MediaSeasonDto,
  MediaShowDto,
  mediaApi,
} from '../api/media';
import {
  DaCollectorFileDto,
  DaCollectorSeriesDto,
  RemoteSearchMovie,
  RemoteSearchShow,
  TmdbOrderingInformation,
  tmdbApi,
} from '../api/tmdb';
import { tvdbApi } from '../api/tvdb';
import { ProviderMatchCandidate, providerMatchApi } from '../api/providerMatch';

type RouteKind = 'movies' | 'shows';
type MediaKind = 'movie' | 'show';
type RemoteResult = RemoteSearchMovie | RemoteSearchShow;
type LoadState = 'idle' | 'loading' | 'ready' | 'error';

const FILE_PAGE_SIZE = 100;

export default function MediaDetail() {
  const navigate = useNavigate();
  const params = useParams();
  const routeKind = params.kind as RouteKind | undefined;
  const provider = params.provider as MediaProvider | undefined;
  const providerID = Number(params.providerID);
  const mediaKind: MediaKind = routeKind === 'movies' ? 'movie' : 'show';

  const [movie, setMovie] = useState<MediaMovieDto | null>(null);
  const [show, setShow] = useState<MediaShowDto | null>(null);
  const [seasons, setSeasons] = useState<MediaSeasonDto[]>([]);
  const [episodes, setEpisodes] = useState<MediaEpisodeDto[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [linkedSeries, setLinkedSeries] = useState<DaCollectorSeriesDto[]>([]);
  const [files, setFiles] = useState<DaCollectorFileDto[]>([]);
  const [fileTotal, setFileTotal] = useState(0);
  const [ordering, setOrdering] = useState<TmdbOrderingInformation[]>([]);
  const [seriesCandidates, setSeriesCandidates] = useState<Record<number, ProviderMatchCandidate[]>>({});
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RemoteResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [tvdbSeriesID, setTvdbSeriesID] = useState('');

  const valid =
    (routeKind === 'movies' || routeKind === 'shows') &&
    (provider === 'tmdb' || provider === 'tvdb') &&
    Number.isInteger(providerID) &&
    providerID > 0;

  const detail = movie ?? show;
  const title = detail?.Title ?? '';
  const originalTitle = detail?.OriginalTitle ?? '';
  const poster = provider ? mediaImage(provider, detail?.PosterPath, 'w342') : undefined;
  const backdrop = provider ? mediaImage(provider, detail?.BackdropPath, 'original') : undefined;
  const selectedEpisodes = useMemo(() => {
    if (selectedSeason == null) return episodes;
    return episodes.filter(episode => episode.SeasonNumber === selectedSeason);
  }, [episodes, selectedSeason]);

  const loadSeriesCandidates = useCallback(async (series: DaCollectorSeriesDto[]) => {
    if (series.length === 0) {
      setSeriesCandidates({});
      return;
    }

    const entries = await Promise.all(
      series.map(async item => {
        const candidates = await providerMatchApi.getCandidatesForSeries(item.IDs.ID);
        return [item.IDs.ID, candidates] as const;
      })
    );
    setSeriesCandidates(Object.fromEntries(entries));
  }, []);

  const load = useCallback(async () => {
    if (!valid || provider == null) return;

    setLoadState('loading');
    setError(null);
    setContextError(null);
    setActionMessage(null);

    try {
      if (routeKind === 'movies') {
        const loadedMovie = await mediaApi.getMovie(provider, providerID);
        setMovie(loadedMovie);
        setShow(null);
        setSeasons([]);
        setEpisodes([]);
        setSelectedSeason(null);
        setSearchQuery(current => current || loadedMovie.Title);
      } else {
        const [loadedShow, loadedSeasons, loadedEpisodes] = await Promise.all([
          mediaApi.getShow(provider, providerID),
          mediaApi.getShowSeasons(provider, providerID),
          mediaApi.getShowEpisodes(provider, providerID),
        ]);
        setShow(loadedShow);
        setMovie(null);
        setSeasons(loadedSeasons);
        setEpisodes(loadedEpisodes);
        setSelectedSeason(current => current ?? loadedSeasons[0]?.SeasonNumber ?? null);
        setSearchQuery(current => current || loadedShow.Title);
      }

      if (provider === 'tmdb') {
        const [series, fileResult, orderingResult] = await Promise.all([
          tmdbApi.getLinkedSeries(mediaKind, providerID),
          tmdbApi.getLinkedFiles(mediaKind, providerID, 1, FILE_PAGE_SIZE),
          mediaKind === 'show' ? tmdbApi.getShowOrdering(providerID) : Promise.resolve([]),
        ]);
        setLinkedSeries(series);
        setFiles(fileResult.List);
        setFileTotal(fileResult.Total);
        setOrdering(orderingResult);
        await loadSeriesCandidates(series);
      } else {
        setLinkedSeries([]);
        setFiles([]);
        setFileTotal(0);
        setOrdering([]);
        setSeriesCandidates({});
      }

      setLoadState('ready');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) navigate('/login');
      else {
        setLoadState('error');
        setError(err instanceof Error ? err.message : 'Failed to load media details.');
      }
    }
  }, [loadSeriesCandidates, mediaKind, navigate, provider, providerID, routeKind, valid]);

  useEffect(() => {
    load();
  }, [load]);

  async function runAction(label: string, action: () => Promise<void>, after?: () => Promise<void>) {
    setBusyAction(label);
    setActionError(null);
    setActionMessage(null);
    try {
      await action();
      if (after) await after();
      setActionMessage(label);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) navigate('/login');
      else setActionError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setBusyAction(null);
    }
  }

  async function refreshProvider() {
    if (!provider) return;
    const done = `${provider.toUpperCase()} refresh queued.`;
    await runAction(done, async () => {
      if (provider === 'tmdb') {
        if (mediaKind === 'movie') await tmdbApi.refreshMovie(providerID, { Force: true, DownloadImages: true });
        else await tmdbApi.refreshShow(providerID, { Force: true, DownloadImages: true });
      } else {
        await tvdbApi.refresh(mediaKind, providerID);
      }
    });
  }

  async function downloadImages() {
    if (provider !== 'tmdb') return;
    await runAction('TMDB image download queued.', async () => {
      if (mediaKind === 'movie') await tmdbApi.downloadMovieImages(providerID);
      else await tmdbApi.downloadShowImages(providerID);
    });
  }

  async function runTmdbSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setActionError(null);
    try {
      const result = mediaKind === 'movie'
        ? await tmdbApi.searchMovies(searchQuery.trim())
        : await tmdbApi.searchShows(searchQuery.trim());
      setSearchResults(result.List);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) navigate('/login');
      else setActionError(err instanceof Error ? err.message : 'TMDB search failed.');
    } finally {
      setSearching(false);
    }
  }

  async function cacheSearchResult(resultID: number) {
    await runAction('TMDB metadata refresh queued.', async () => {
      if (mediaKind === 'movie') await tmdbApi.refreshMovie(resultID, { Force: true, DownloadImages: true });
      else await tmdbApi.refreshShow(resultID, { Force: true, DownloadImages: true });
    });
  }

  async function scanSeries(seriesID: number) {
    await runAction('Provider match scan completed.', async () => {
      await providerMatchApi.scanSeries(seriesID);
      const candidates = await providerMatchApi.getCandidatesForSeries(seriesID);
      setSeriesCandidates(current => ({ ...current, [seriesID]: candidates }));
    });
  }

  async function approveCandidate(candidate: ProviderMatchCandidate) {
    await runAction('Provider match approved.', async () => {
      await providerMatchApi.approve(candidate.ProviderMatchCandidateID);
      const candidates = await providerMatchApi.getCandidatesForSeries(candidate.MediaSeriesID);
      setSeriesCandidates(current => ({ ...current, [candidate.MediaSeriesID]: candidates }));
    }, provider === 'tmdb' ? load : undefined);
  }

  async function rejectCandidate(candidate: ProviderMatchCandidate) {
    await runAction('Provider match rejected.', async () => {
      await providerMatchApi.reject(candidate.ProviderMatchCandidateID);
      const candidates = await providerMatchApi.getCandidatesForSeries(candidate.MediaSeriesID);
      setSeriesCandidates(current => ({ ...current, [candidate.MediaSeriesID]: candidates }));
    });
  }

  async function setPreferredOrdering(orderingID: string) {
    if (provider !== 'tmdb' || mediaKind !== 'show') return;
    await runAction('Preferred ordering updated.', async () => {
      await tmdbApi.setPreferredShowOrdering(providerID, orderingID);
      const next = await tmdbApi.getShowOrdering(providerID);
      setOrdering(next);
    });
  }

  async function linkTvdbSeries(unlink = false) {
    const seriesID = Number(tvdbSeriesID);
    if (!Number.isInteger(seriesID) || seriesID <= 0 || provider !== 'tvdb') {
      setActionError('Enter a valid MediaSeries ID.');
      return;
    }
    await runAction(unlink ? 'TVDB link removed.' : 'TVDB link saved.', async () => {
      if (unlink) await tvdbApi.unlink(mediaKind, providerID, seriesID);
      else await tvdbApi.link(mediaKind, providerID, seriesID);
    });
  }

  if (!valid) return <Navigate to="/media" replace />;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RouterLink to="/media" className="inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white">
          <ArrowLeft size={15} />
          Library
        </RouterLink>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 transition-colors hover:text-white"
        >
          <RefreshCw size={13} className={loadState === 'loading' ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {loadState === 'loading' && !detail ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-shoko-accent border-t-transparent" />
        </div>
      ) : error ? (
        <div className="app-card px-4 py-3 text-sm text-red-400">{error}</div>
      ) : detail ? (
        <>
          <section className="overflow-hidden rounded-md border border-gray-700/50 bg-[#0d0d1a]/85 shadow-panel">
            <div
              className="relative min-h-80 bg-cover bg-center"
              style={backdrop ? { backgroundImage: `linear-gradient(90deg, rgba(13,13,26,0.96), rgba(13,13,26,0.78)), url(${backdrop})` } : undefined}
            >
              <div className="grid gap-6 p-6 md:grid-cols-[11rem_1fr]">
                <div className="aspect-[2/3] overflow-hidden rounded-md border border-gray-700/60 bg-gray-900/80">
                  {poster ? (
                    <img src={poster} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-gray-600">
                      {mediaKind === 'movie' ? <Film size={34} /> : <Tv size={34} />}
                    </div>
                  )}
                </div>
                <div className="min-w-0 space-y-5">
                  <div>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <ProviderBadge provider={provider} />
                      <span className="rounded bg-gray-800/80 px-2 py-0.5 text-[11px] font-semibold uppercase text-gray-300">
                        {mediaKind}
                      </span>
                      {detail.Year && <span className="text-xs text-gray-400">{detail.Year}</span>}
                    </div>
                    <h1 className="text-3xl font-semibold text-white">{title}</h1>
                    {originalTitle && originalTitle !== title && (
                      <p className="mt-1 text-sm text-gray-400">{originalTitle}</p>
                    )}
                  </div>

                  <div className="grid gap-3 text-sm text-gray-300 sm:grid-cols-2 lg:grid-cols-4">
                    <Fact icon={<Database size={15} />} label="Provider ID" value={String(detail.ProviderID)} />
                    <Fact icon={<CalendarDays size={15} />} label="Released" value={dateValue(detailDate(detail))} />
                    {movie ? (
                      <Fact icon={<Info size={15} />} label="Runtime" value={movie.RuntimeMinutes ? `${movie.RuntimeMinutes}m` : 'Unknown'} />
                    ) : (
                      <Fact icon={<Info size={15} />} label="Status" value={show?.Status ?? 'Unknown'} />
                    )}
                    {show ? (
                      <Fact icon={<Layers size={15} />} label="Episodes" value={countLabel(show.EpisodeCount, 'episode')} />
                    ) : (
                      <Fact icon={<HardDrive size={15} />} label="Files" value={provider === 'tmdb' ? String(fileTotal) : 'Provider limited'} />
                    )}
                  </div>

                  {detail.Overview ? (
                    <p className="max-w-3xl text-sm leading-6 text-gray-300">{detail.Overview}</p>
                  ) : (
                    <p className="text-sm text-gray-500">No overview is available for this item.</p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {detail.Genres.map(genre => (
                      <span key={genre} className="rounded bg-gray-800/80 px-2 py-1 text-xs text-gray-300">{genre}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <StatusMessages actionMessage={actionMessage} actionError={actionError} contextError={contextError} />

          <section className="grid gap-6 lg:grid-cols-[1fr_22rem]">
            <div className="space-y-6">
              <ExternalIds ids={detail.ExternalIDs} />
              {mediaKind === 'show' && (
                <ShowEpisodes
                  seasons={seasons}
                  episodes={selectedEpisodes}
                  selectedSeason={selectedSeason}
                  onSelectSeason={setSelectedSeason}
                />
              )}
              <LinkedFiles provider={provider} files={files} total={fileTotal} />
              <LinkedSeries
                provider={provider}
                series={linkedSeries}
                candidates={seriesCandidates}
                busyAction={busyAction}
                onScan={scanSeries}
                onApprove={approveCandidate}
                onReject={rejectCandidate}
              />
            </div>

            <div className="space-y-6">
              <ProviderActions
                provider={provider}
                mediaKind={mediaKind}
                busyAction={busyAction}
                onRefresh={refreshProvider}
                onDownloadImages={downloadImages}
              />
              {provider === 'tmdb' && (
                <TmdbSearchPanel
                  mediaKind={mediaKind}
                  query={searchQuery}
                  results={searchResults}
                  searching={searching}
                  busyAction={busyAction}
                  onQueryChange={setSearchQuery}
                  onSearch={runTmdbSearch}
                  onCache={cacheSearchResult}
                />
              )}
              {provider === 'tmdb' && mediaKind === 'show' && (
                <OrderingPanel
                  ordering={ordering}
                  busyAction={busyAction}
                  onSetPreferred={setPreferredOrdering}
                />
              )}
              {provider === 'tvdb' && (
                <TvdbLinkPanel
                  mediaKind={mediaKind}
                  value={tvdbSeriesID}
                  busyAction={busyAction}
                  onChange={setTvdbSeriesID}
                  onLink={() => linkTvdbSeries(false)}
                  onUnlink={() => linkTvdbSeries(true)}
                />
              )}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function ProviderActions({
  provider,
  mediaKind,
  busyAction,
  onRefresh,
  onDownloadImages,
}: {
  provider: MediaProvider;
  mediaKind: MediaKind;
  busyAction: string | null;
  onRefresh: () => void;
  onDownloadImages: () => void;
}) {
  return (
    <section className="app-card p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">Provider Actions</h2>
      <div className="grid gap-3">
        <ActionButton icon={<RefreshCw size={14} />} disabled={busyAction != null} onClick={onRefresh}>
          Refresh {provider.toUpperCase()} {mediaKind}
        </ActionButton>
        {provider === 'tmdb' && (
          <ActionButton icon={<Image size={14} />} disabled={busyAction != null} onClick={onDownloadImages}>
            Download TMDB images
          </ActionButton>
        )}
      </div>
    </section>
  );
}

function TmdbSearchPanel({
  mediaKind,
  query,
  results,
  searching,
  busyAction,
  onQueryChange,
  onSearch,
  onCache,
}: {
  mediaKind: MediaKind;
  query: string;
  results: RemoteResult[];
  searching: boolean;
  busyAction: string | null;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onCache: (id: number) => void;
}) {
  return (
    <section className="app-card p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
        <Search size={14} />
        TMDB Search
      </h2>
      <div className="flex gap-2">
        <input
          value={query}
          onChange={event => onQueryChange(event.target.value)}
          className="min-w-0 flex-1 rounded-md border border-gray-700 bg-gray-900/70 px-3 py-2 text-sm text-gray-100 outline-none app-focus"
          placeholder={`Search ${mediaKind}s`}
        />
        <button
          type="button"
          onClick={onSearch}
          disabled={searching || !query.trim()}
          className="rounded-md bg-shoko-accent px-3 py-2 text-sm font-medium text-black transition-colors hover:bg-shoko-accent/85 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {searching ? '…' : 'Go'}
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {results.map(result => (
          <div key={result.ID} className="rounded-md border border-gray-800/80 bg-gray-950/35 p-3">
            <div className="flex gap-3">
              {result.Poster ? (
                <img src={result.Poster} alt="" className="h-20 w-14 shrink-0 rounded object-cover" />
              ) : (
                <div className="grid h-20 w-14 shrink-0 place-items-center rounded bg-gray-900 text-gray-600">
                  {mediaKind === 'movie' ? <Film size={18} /> : <Tv size={18} />}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-gray-100">{result.Title}</div>
                <div className="mt-0.5 text-xs text-gray-500">
                  ID {result.ID}{'ReleasedAt' in result && result.ReleasedAt ? ` · ${formatYear(result.ReleasedAt)}` : ''}
                  {'FirstAiredAt' in result && result.FirstAiredAt ? ` · ${formatYear(result.FirstAiredAt)}` : ''}
                </div>
                <button
                  type="button"
                  disabled={busyAction != null}
                  onClick={() => onCache(result.ID)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded bg-gray-800 px-2 py-1 text-xs text-gray-300 transition-colors hover:bg-gray-700 hover:text-white disabled:opacity-50"
                >
                  <RefreshCw size={12} />
                  Cache
                </button>
              </div>
            </div>
          </div>
        ))}
        {results.length === 0 && !searching && (
          <p className="text-xs leading-5 text-gray-500">
            Search TMDB, cache the metadata, then run provider-match scans for the local series that should link to it.
          </p>
        )}
      </div>
    </section>
  );
}

function OrderingPanel({
  ordering,
  busyAction,
  onSetPreferred,
}: {
  ordering: TmdbOrderingInformation[];
  busyAction: string | null;
  onSetPreferred: (orderingID: string) => void;
}) {
  return (
    <section className="app-card p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">Preferred Ordering</h2>
      <div className="space-y-2">
        {ordering.map(item => (
          <button
            key={item.OrderingID}
            type="button"
            disabled={busyAction != null || item.IsPreferred}
            onClick={() => onSetPreferred(item.IsDefault ? 'default' : item.OrderingID)}
            className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed ${
              item.IsPreferred
                ? 'border-shoko-accent/60 bg-shoko-accent/15 text-white'
                : 'border-gray-800 bg-gray-950/35 text-gray-300 hover:border-gray-700 hover:bg-gray-900/80'
            }`}
          >
            <span className="block font-medium">{item.OrderingName}</span>
            <span className="text-xs text-gray-500">
              {item.SeasonCount} season{item.SeasonCount === 1 ? '' : 's'} · {item.EpisodeCount} episodes
            </span>
          </button>
        ))}
        {ordering.length === 0 && (
          <p className="text-xs text-gray-500">No alternate ordering data is cached for this show.</p>
        )}
      </div>
    </section>
  );
}

function TvdbLinkPanel({
  mediaKind,
  value,
  busyAction,
  onChange,
  onLink,
  onUnlink,
}: {
  mediaKind: MediaKind;
  value: string;
  busyAction: string | null;
  onChange: (value: string) => void;
  onLink: () => void;
  onUnlink: () => void;
}) {
  return (
    <section className="app-card p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
        <Link2 size={14} />
        TVDB Link
      </h2>
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        inputMode="numeric"
        className="w-full rounded-md border border-gray-700 bg-gray-900/70 px-3 py-2 text-sm text-gray-100 outline-none app-focus"
        placeholder="MediaSeries ID"
      />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busyAction != null}
          onClick={onLink}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-shoko-accent px-3 py-2 text-sm font-medium text-black transition-colors hover:bg-shoko-accent/85 disabled:opacity-50"
        >
          <Link2 size={14} />
          Link
        </button>
        <button
          type="button"
          disabled={busyAction != null}
          onClick={onUnlink}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-red-500/90 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-400 disabled:opacity-50"
        >
          <Unlink size={14} />
          Unlink
        </button>
      </div>
      <p className="mt-3 text-xs leading-5 text-gray-500">
        TVDB exposes direct {mediaKind} link endpoints, but the server does not expose a TVDB linked-series lookup here.
      </p>
    </section>
  );
}

function ExternalIds({ ids }: { ids: Array<{ Source: string; Value: string }> }) {
  return (
    <section className="app-card p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">External IDs</h2>
      {ids.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {ids.map(id => (
            <span key={`${id.Source}-${id.Value}`} className="rounded bg-gray-800/80 px-2.5 py-1 text-xs text-gray-300">
              <span className="font-semibold uppercase text-gray-400">{id.Source}</span> {id.Value}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">No external IDs are cached.</p>
      )}
    </section>
  );
}

function ShowEpisodes({
  seasons,
  episodes,
  selectedSeason,
  onSelectSeason,
}: {
  seasons: MediaSeasonDto[];
  episodes: MediaEpisodeDto[];
  selectedSeason: number | null;
  onSelectSeason: (season: number | null) => void;
}) {
  return (
    <section className="app-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Seasons and Episodes</h2>
        <select
          value={selectedSeason ?? ''}
          onChange={event => onSelectSeason(event.target.value ? Number(event.target.value) : null)}
          className="rounded-md border border-gray-700 bg-gray-900/70 px-3 py-1.5 text-sm text-gray-100 outline-none app-focus"
        >
          <option value="">All seasons</option>
          {seasons.map(season => (
            <option key={season.ProviderID} value={season.SeasonNumber}>
              Season {season.SeasonNumber} ({season.EpisodeCount})
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        {episodes.map(episode => (
          <div key={episode.ProviderID} className="rounded-md border border-gray-800/80 bg-gray-950/30 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-shoko-accent">
                S{episode.SeasonNumber} E{episode.EpisodeNumber}
              </span>
              <span className="text-sm font-medium text-gray-100">{episode.Title}</span>
              {episode.AiredAt && <span className="text-xs text-gray-500">{formatDate(episode.AiredAt)}</span>}
              {episode.RuntimeMinutes != null && <span className="text-xs text-gray-500">{episode.RuntimeMinutes}m</span>}
            </div>
            {episode.Overview && <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">{episode.Overview}</p>}
          </div>
        ))}
        {episodes.length === 0 && (
          <p className="py-6 text-center text-sm text-gray-500">No episodes are cached for this selection.</p>
        )}
      </div>
    </section>
  );
}

function LinkedFiles({ provider, files, total }: { provider: MediaProvider; files: DaCollectorFileDto[]; total: number }) {
  return (
    <section className="app-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
          <HardDrive size={14} />
          Files
        </h2>
        {provider === 'tmdb' && <span className="text-xs text-gray-500">{total} linked</span>}
      </div>
      {provider !== 'tmdb' ? (
        <p className="text-sm text-gray-500">The server currently exposes linked-file lookup for TMDB items only.</p>
      ) : files.length > 0 ? (
        <div className="space-y-3">
          {files.map(file => (
            <div key={file.ID} className="rounded-md border border-gray-800/80 bg-gray-950/30 p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-gray-100">File {file.ID}</span>
                {file.Resolution && <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[11px] text-gray-300">{file.Resolution}</span>}
                <span className="text-xs text-gray-500">{formatBytes(file.Size)}</span>
                {file.IsIgnored && <span className="text-xs text-red-400">Ignored</span>}
                {file.IsVariation && <span className="text-xs text-yellow-400">Variation</span>}
              </div>
              <div className="space-y-1">
                {file.Locations.map(location => (
                  <div key={location.ID} className="truncate text-xs text-gray-500" title={location.AbsolutePath ?? location.RelativePath}>
                    {location.IsAccessible ? 'Available' : 'Missing'} · {location.RelativePath}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">No local files are linked to this TMDB item.</p>
      )}
    </section>
  );
}

function LinkedSeries({
  provider,
  series,
  candidates,
  busyAction,
  onScan,
  onApprove,
  onReject,
}: {
  provider: MediaProvider;
  series: DaCollectorSeriesDto[];
  candidates: Record<number, ProviderMatchCandidate[]>;
  busyAction: string | null;
  onScan: (seriesID: number) => void;
  onApprove: (candidate: ProviderMatchCandidate) => void;
  onReject: (candidate: ProviderMatchCandidate) => void;
}) {
  return (
    <section className="app-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
          <ListChecks size={14} />
          DaCollector Series
        </h2>
        {provider === 'tmdb' && <span className="text-xs text-gray-500">{series.length} linked</span>}
      </div>
      {provider !== 'tmdb' ? (
        <p className="text-sm text-gray-500">Use the provider-match queue or the TVDB direct link control to manage TVDB series links.</p>
      ) : series.length > 0 ? (
        <div className="space-y-3">
          {series.map(item => (
            <div key={item.IDs.ID} className="rounded-md border border-gray-800/80 bg-gray-950/30 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-gray-100">{item.Name}</div>
                  <div className="mt-0.5 text-xs text-gray-500">MediaSeries {item.IDs.ID} · {item.Size} local items</div>
                </div>
                <button
                  type="button"
                  disabled={busyAction != null}
                  onClick={() => onScan(item.IDs.ID)}
                  className="inline-flex items-center gap-1.5 rounded bg-gray-800 px-2.5 py-1.5 text-xs text-gray-300 transition-colors hover:bg-gray-700 hover:text-white disabled:opacity-50"
                >
                  <RefreshCw size={12} />
                  Scan
                </button>
              </div>
              <CandidateList
                candidates={candidates[item.IDs.ID] ?? []}
                busyAction={busyAction}
                onApprove={onApprove}
                onReject={onReject}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">No DaCollector series links are exposed for this TMDB item.</p>
      )}
    </section>
  );
}

function CandidateList({
  candidates,
  busyAction,
  onApprove,
  onReject,
}: {
  candidates: ProviderMatchCandidate[];
  busyAction: string | null;
  onApprove: (candidate: ProviderMatchCandidate) => void;
  onReject: (candidate: ProviderMatchCandidate) => void;
}) {
  const pending = candidates.filter(candidate => candidate.Status === 'Pending');
  if (pending.length === 0) {
    return <p className="mt-3 text-xs text-gray-500">No pending candidates for this series.</p>;
  }

  return (
    <div className="mt-3 space-y-2">
      {pending.map(candidate => (
        <div key={candidate.ProviderMatchCandidateID} className="rounded border border-gray-800 bg-gray-950/40 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm text-gray-100">
                {candidate.Title} {candidate.Year ? <span className="text-xs text-gray-500">({candidate.Year})</span> : null}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {candidate.Provider.toUpperCase()} {candidate.ProviderType} {candidate.ProviderItemID} · {Math.round(candidate.ConfidenceScore * 100)}%
              </div>
              {candidate.Reasons && candidate.Reasons.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {candidate.Reasons.slice(0, 3).map(reason => (
                    <span key={reason} className="rounded bg-gray-800 px-1.5 py-0.5 text-[11px] text-gray-400">{reason}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                disabled={busyAction != null}
                onClick={() => onApprove(candidate)}
                className="rounded bg-shoko-accent p-1.5 text-black transition-colors hover:bg-shoko-accent/85 disabled:opacity-50"
                title="Approve"
              >
                <Check size={14} />
              </button>
              <button
                type="button"
                disabled={busyAction != null}
                onClick={() => onReject(candidate)}
                className="rounded bg-red-500/90 p-1.5 text-white transition-colors hover:bg-red-400 disabled:opacity-50"
                title="Reject"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-gray-800/80 bg-gray-950/30 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wide text-gray-500">
        {icon}
        {label}
      </div>
      <div className="truncate text-sm font-medium text-gray-100">{value}</div>
    </div>
  );
}

function ActionButton({
  icon,
  disabled,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-md bg-gray-800 px-3 py-2 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
    >
      {icon}
      {children}
    </button>
  );
}

function ProviderBadge({ provider }: { provider: string }) {
  const cls = provider === 'tmdb'
    ? 'bg-green-600/20 text-green-400'
    : 'bg-orange-600/20 text-orange-400';
  return (
    <span className={`rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${cls}`}>
      {provider}
    </span>
  );
}

function StatusMessages({
  actionMessage,
  actionError,
  contextError,
}: {
  actionMessage: string | null;
  actionError: string | null;
  contextError: string | null;
}) {
  if (!actionMessage && !actionError && !contextError) return null;
  return (
    <div className="space-y-2">
      {actionMessage && <div className="app-card px-4 py-3 text-sm text-shoko-accent">{actionMessage}</div>}
      {actionError && <div className="app-card px-4 py-3 text-sm text-red-400">{actionError}</div>}
      {contextError && <div className="app-card px-4 py-3 text-sm text-yellow-300">{contextError}</div>}
    </div>
  );
}

function mediaImage(provider: MediaProvider, path?: string, size = 'w342') {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  if (provider === 'tmdb' && path.startsWith('/')) return `https://image.tmdb.org/t/p/${size}${path}`;
  return undefined;
}

function detailDate(detail: MediaMovieDto | MediaShowDto) {
  return (detail as Partial<MediaMovieDto>).ReleasedAt ?? (detail as Partial<MediaShowDto>).FirstAiredAt;
}

function dateValue(value?: string) {
  return value ? formatDate(value) : 'Unknown';
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function formatYear(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 4);
  return String(date.getFullYear());
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 10 || unit === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unit]}`;
}

function countLabel(value: number | undefined, label: string) {
  if (value == null) return 'Unknown';
  return `${value} ${label}${value === 1 ? '' : 's'}`;
}
