import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Film, ListChecks, RefreshCw, Tv, X } from 'lucide-react';
import { mediaApi, MediaMovieDto, MediaShowDto } from '../api/media';
import { ApiError } from '../api/client';
import { ProviderMatchCandidate, providerMatchApi } from '../api/providerMatch';

type Tab = 'movies' | 'shows' | 'matches';
type Provider = 'all' | 'tmdb' | 'tvdb';

const PAGE_SIZE = 50;

export default function Media() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('movies');
  const [provider, setProvider] = useState<Provider>('tmdb');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [movies, setMovies] = useState<MediaMovieDto[]>([]);
  const [shows, setShows] = useState<MediaShowDto[]>([]);
  const [candidates, setCandidates] = useState<ProviderMatchCandidate[]>([]);
  const [totalMovies, setTotalMovies] = useState(0);
  const [totalShows, setTotalShows] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busyCandidate, setBusyCandidate] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [tab, provider, debouncedSearch]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setActionMessage(null);
    try {
      if (tab === 'movies') {
        const r = await mediaApi.getMovies(provider, debouncedSearch || undefined, page, PAGE_SIZE);
        setMovies(r.List);
        setTotalMovies(r.Total);
      } else if (tab === 'matches') {
        const r = await providerMatchApi.getCandidates();
        setCandidates(r);
      } else {
        const r = await mediaApi.getShows(provider, debouncedSearch || undefined, page, PAGE_SIZE);
        setShows(r.List);
        setTotalShows(r.Total);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) navigate('/login');
      else setError(err instanceof Error ? err.message : 'Failed to load media.');
    } finally {
      setLoading(false);
    }
  }, [navigate, tab, provider, debouncedSearch, page]);

  useEffect(() => { load(); }, [load]);

  const total = tab === 'movies' ? totalMovies : tab === 'shows' ? totalShows : candidates.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function scanAllMatches() {
    setLoading(true);
    setError(null);
    setActionMessage(null);
    try {
      const result = await providerMatchApi.scanAll(true);
      setActionMessage(`Scanned ${result.ScannedSeriesCount} series and found ${result.CandidateCount} candidates.`);
      const next = await providerMatchApi.getCandidates();
      setCandidates(next);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) navigate('/login');
      else setError(err instanceof Error ? err.message : 'Failed to scan provider matches.');
    } finally {
      setLoading(false);
    }
  }

  async function resolveCandidate(candidate: ProviderMatchCandidate, approve: boolean) {
    setBusyCandidate(candidate.ProviderMatchCandidateID);
    setError(null);
    setActionMessage(null);
    try {
      if (approve) await providerMatchApi.approve(candidate.ProviderMatchCandidateID);
      else await providerMatchApi.reject(candidate.ProviderMatchCandidateID);
      setActionMessage(approve ? 'Provider match approved.' : 'Provider match rejected.');
      const next = await providerMatchApi.getCandidates();
      setCandidates(next);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) navigate('/login');
      else setError(err instanceof Error ? err.message : 'Failed to update provider match.');
    } finally {
      setBusyCandidate(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <h1 className="text-xl font-semibold text-white">Library</h1>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-700/50 pb-0">
        <TabBtn active={tab === 'movies'} onClick={() => setTab('movies')}>
          <Film size={14} /> Movies
        </TabBtn>
        <TabBtn active={tab === 'shows'} onClick={() => setTab('shows')}>
          <Tv size={14} /> Shows
        </TabBtn>
        <TabBtn active={tab === 'matches'} onClick={() => setTab('matches')}>
          <ListChecks size={14} /> Matches
        </TabBtn>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {tab !== 'matches' ? (
          <>
            <input
              className="w-56 rounded-md border border-gray-700 bg-gray-900/70 px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 outline-none app-focus"
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select
              className="rounded-md border border-gray-700 bg-gray-900/70 px-3 py-1.5 text-sm text-gray-100 outline-none app-focus"
              value={provider}
              onChange={e => setProvider(e.target.value as Provider)}
            >
              <option value="all">All providers</option>
              <option value="tmdb">TMDB</option>
              <option value="tvdb">TVDB</option>
            </select>
          </>
        ) : (
          <button
            type="button"
            onClick={scanAllMatches}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-400 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Scan unmatched
          </button>
        )}
        <span className="ml-auto text-xs text-gray-500">
          {loading ? 'Loading…' : `${total} item${total !== 1 ? 's' : ''}`}
        </span>
      </div>

      {actionMessage && (
        <div className="app-card px-4 py-3 text-sm text-blue-300">{actionMessage}</div>
      )}

      {error && (
        <div className="app-card rounded-md border-red-700/50 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {/* List */}
      <div className="app-card rounded-md divide-y divide-gray-800/50">
        {loading && !movies.length && !shows.length ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          </div>
        ) : tab === 'movies' ? (
          movies.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-500">No movies found.</div>
          ) : (
            movies.map(m => <MovieRow key={`${m.Provider}-${m.ProviderID}`} movie={m} onOpen={() => navigate(`/media/movies/${m.Provider}/${m.ProviderID}`)} />)
          )
        ) : tab === 'matches' ? (
          candidates.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-500">No pending provider matches.</div>
          ) : (
            candidates.map(candidate => (
              <CandidateRow
                key={candidate.ProviderMatchCandidateID}
                candidate={candidate}
                busy={busyCandidate === candidate.ProviderMatchCandidateID}
                onApprove={() => resolveCandidate(candidate, true)}
                onReject={() => resolveCandidate(candidate, false)}
              />
            ))
          )
        ) : shows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-500">No shows found.</div>
        ) : (
          shows.map(s => <ShowRow key={`${s.Provider}-${s.ProviderID}`} show={s} onOpen={() => navigate(`/media/shows/${s.Provider}/${s.ProviderID}`)} />)
        )}
      </div>

      {/* Pagination */}
      {tab !== 'matches' && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="rounded px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 disabled:opacity-40 transition-colors"
          >
            ← Prev
          </button>
          <span className="text-xs text-gray-400">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="rounded px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 disabled:opacity-40 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
        active
          ? 'border-blue-500 text-white'
          : 'border-transparent text-gray-400 hover:text-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

function ProviderBadge({ provider }: { provider: string }) {
  const cls =
    provider === 'tmdb'
      ? 'bg-green-600/20 text-green-400'
      : provider === 'tvdb'
      ? 'bg-orange-600/20 text-orange-400'
      : 'bg-gray-700/50 text-gray-400';
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {provider}
    </span>
  );
}

function MovieRow({ movie, onOpen }: { movie: MediaMovieDto; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-white/5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-100">{movie.Title}</span>
          {movie.Year && <span className="text-xs text-gray-500">{movie.Year}</span>}
          <ProviderBadge provider={movie.Provider} />
        </div>
        {movie.Genres.length > 0 && (
          <p className="mt-0.5 text-xs text-gray-500">{movie.Genres.slice(0, 4).join(' · ')}</p>
        )}
      </div>
      {movie.RuntimeMinutes != null && (
        <span className="shrink-0 text-xs text-gray-600">{movie.RuntimeMinutes}m</span>
      )}
    </button>
  );
}

function ShowRow({ show, onOpen }: { show: MediaShowDto; onOpen: () => void }) {
  const meta = [
    show.SeasonCount != null ? `${show.SeasonCount}S` : null,
    show.EpisodeCount != null ? `${show.EpisodeCount}ep` : null,
    show.Network ?? null,
    show.Status ?? null,
  ].filter(Boolean).join(' · ');

  return (
    <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-white/5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-100">{show.Title}</span>
          {show.Year && <span className="text-xs text-gray-500">{show.Year}</span>}
          <ProviderBadge provider={show.Provider} />
        </div>
        {(meta || show.Genres.length > 0) && (
          <p className="mt-0.5 text-xs text-gray-500">
            {[meta, show.Genres.slice(0, 3).join(' · ')].filter(Boolean).join(' — ')}
          </p>
        )}
      </div>
    </button>
  );
}

function CandidateRow({
  candidate,
  busy,
  onApprove,
  onReject,
}: {
  candidate: ProviderMatchCandidate;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const confidence = Math.max(0, Math.min(100, Math.round(candidate.ConfidenceScore * 100)));

  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-100">{candidate.Title}</span>
            {candidate.Year && <span className="text-xs text-gray-500">{candidate.Year}</span>}
            <ProviderBadge provider={candidate.Provider} />
            <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-400">
              {candidate.ProviderType}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            MediaSeries {candidate.MediaSeriesID} · Provider item {candidate.ProviderItemID} · {confidence}% confidence
          </p>
          {candidate.Reasons && candidate.Reasons.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {candidate.Reasons.slice(0, 4).map(reason => (
                <span key={reason} className="rounded bg-gray-800/80 px-1.5 py-0.5 text-[11px] text-gray-400">{reason}</span>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onApprove}
            disabled={busy}
            className="rounded bg-blue-500 p-2 text-white transition-colors hover:bg-blue-400 disabled:opacity-50"
            title="Approve match"
          >
            <Check size={15} />
          </button>
          <button
            type="button"
            onClick={onReject}
            disabled={busy}
            className="rounded bg-red-500/90 p-2 text-white transition-colors hover:bg-red-400 disabled:opacity-50"
            title="Reject match"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
