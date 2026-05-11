import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Film, Tv } from 'lucide-react';
import { mediaApi, MediaMovieDto, MediaShowDto } from '../api/media';
import { ApiError } from '../api/client';

type Tab = 'movies' | 'shows';
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
  const [totalMovies, setTotalMovies] = useState(0);
  const [totalShows, setTotalShows] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    try {
      if (tab === 'movies') {
        const r = await mediaApi.getMovies(provider === 'all' ? 'tmdb' : provider, debouncedSearch || undefined, page, PAGE_SIZE);
        setMovies(r.List);
        setTotalMovies(r.Total);
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

  const total = tab === 'movies' ? totalMovies : totalShows;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="rounded-md border border-gray-700 bg-gray-900/70 px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 outline-none app-focus w-56"
          placeholder="Search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="rounded-md border border-gray-700 bg-gray-900/70 px-3 py-1.5 text-sm text-gray-100 outline-none app-focus"
          value={provider}
          onChange={e => setProvider(e.target.value as Provider)}
        >
          {tab === 'shows' && <option value="all">All providers</option>}
          <option value="tmdb">TMDB</option>
          <option value="tvdb">TVDB</option>
        </select>
        <span className="ml-auto text-xs text-gray-500">
          {loading ? 'Loading…' : `${total} item${total !== 1 ? 's' : ''}`}
        </span>
      </div>

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
            movies.map(m => <MovieRow key={`${m.Provider}-${m.ProviderID}`} movie={m} />)
          )
        ) : shows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-500">No shows found.</div>
        ) : (
          shows.map(s => <ShowRow key={`${s.Provider}-${s.ProviderID}`} show={s} />)
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
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

function MovieRow({ movie }: { movie: MediaMovieDto }) {
  return (
    <div className="flex items-start gap-3 px-5 py-3">
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
    </div>
  );
}

function ShowRow({ show }: { show: MediaShowDto }) {
  const meta = [
    show.SeasonCount != null ? `${show.SeasonCount}S` : null,
    show.EpisodeCount != null ? `${show.EpisodeCount}ep` : null,
    show.Network ?? null,
    show.Status ?? null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="flex items-start gap-3 px-5 py-3">
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
    </div>
  );
}
