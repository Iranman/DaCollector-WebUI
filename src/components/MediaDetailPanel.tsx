import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  Check,
  Film,
  HardDrive,
  Image,
  MinusCircle,
  PlusCircle,
  RefreshCw,
  Search,
  Tv,
  X,
} from 'lucide-react';
import { ApiError } from '../api/client';
import { MediaMovieDto, MediaProvider, MediaShowDto, mediaApi } from '../api/media';
import { DaCollectorFileDto, TmdbMediaKind, tmdbApi } from '../api/tmdb';
import { tvdbApi } from '../api/tvdb';
import { CollectionDefinition, CollectionRule, CollectionSummary, collectionsApi } from '../api/collections';
import { RelocationResult, relocationApi } from '../api/relocation';

export type PanelKind = 'movies' | 'shows';

export interface PanelItem {
  kind: PanelKind;
  provider: MediaProvider;
  providerID: number;
}

type PanelTab = 'overview' | 'rematch' | 'collections' | 'files';

function mediaImage(provider: MediaProvider, path?: string, size = 'w185') {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  if (provider === 'tmdb' && path.startsWith('/')) return `https://image.tmdb.org/t/p/${size}${path}`;
  return undefined;
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

function ProviderBadge({ provider }: { provider: string }) {
  const cls =
    provider === 'tmdb'
      ? 'bg-green-600/20 text-green-400'
      : 'bg-orange-600/20 text-orange-400';
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {provider}
    </span>
  );
}

// ─── Root panel ──────────────────────────────────────────────────────────────

export default function MediaDetailPanel({
  item,
  onClose,
}: {
  item: PanelItem;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<PanelTab>('overview');
  const [detail, setDetail] = useState<MediaMovieDto | MediaShowDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const mediaKind: TmdbMediaKind = item.kind === 'movies' ? 'movie' : 'show';
  const poster = detail ? mediaImage(item.provider, detail.PosterPath, 'w185') : undefined;
  const backdrop = detail ? mediaImage(item.provider, detail.BackdropPath, 'original') : undefined;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data =
        item.kind === 'movies'
          ? await mediaApi.getMovie(item.provider, item.providerID)
          : await mediaApi.getShow(item.provider, item.providerID);
      setDetail(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) navigate('/login');
      else setError(err instanceof Error ? err.message : 'Failed to load details.');
    } finally {
      setLoading(false);
    }
  }, [item.kind, item.provider, item.providerID, navigate]);

  useEffect(() => {
    setDetail(null);
    setTab('overview');
    load();
  }, [load]);

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const tabs: { id: PanelTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'rematch', label: 'Re-match' },
    { id: 'collections', label: 'Collections' },
    { id: 'files', label: 'Files' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div
        ref={panelRef}
        className="flex w-full max-w-[620px] flex-col overflow-hidden border-l border-gray-800 bg-[#0d0d0d] shadow-2xl"
      >
        {/* Header */}
        <div
          className="shrink-0 bg-cover bg-center"
          style={
            backdrop
              ? {
                  backgroundImage: `linear-gradient(90deg, rgba(13,13,13,0.97), rgba(13,13,13,0.85)), url(${backdrop})`,
                }
              : undefined
          }
        >
          <div className="flex items-start gap-3 p-4">
            <div className="aspect-[2/3] w-14 shrink-0 overflow-hidden rounded border border-gray-700/60 bg-gray-900">
              {poster ? (
                <img src={poster} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center text-gray-700">
                  {mediaKind === 'movie' ? <Film size={18} /> : <Tv size={18} />}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                <ProviderBadge provider={item.provider} />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  {mediaKind}
                </span>
              </div>
              {loading && !detail ? (
                <div className="h-4 w-36 animate-pulse rounded bg-gray-800" />
              ) : (
                <h2 className="text-base font-semibold leading-snug text-white">
                  {detail?.Title ?? '—'}
                  {detail?.Year ? (
                    <span className="ml-2 text-sm font-normal text-gray-400">{detail.Year}</span>
                  ) : null}
                </h2>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-0.5">
              <button
                onClick={() => navigate(`/media/${item.kind}/${item.provider}/${item.providerID}`)}
                className="rounded p-1.5 text-gray-500 transition-colors hover:text-white"
                title="Open full detail page"
              >
                <ArrowUpRight size={15} />
              </button>
              <button
                onClick={onClose}
                className="rounded p-1.5 text-gray-500 transition-colors hover:text-white"
                title="Close"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex shrink-0 border-b border-gray-800 bg-[#0d0d0d]">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-xs font-medium uppercase tracking-wide transition-colors ${
                tab === t.id
                  ? 'border-shoko-accent text-white'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="m-4 rounded border border-red-700/50 bg-red-900/20 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {tab === 'overview' && (
            loading && !detail ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-7 w-7 animate-spin rounded-full border-4 border-shoko-accent border-t-transparent" />
              </div>
            ) : detail ? (
              <OverviewTab
                detail={detail}
                mediaKind={mediaKind}
                provider={item.provider}
                providerID={item.providerID}
              />
            ) : null
          )}

          {tab === 'rematch' && (
            <RematchTab
              mediaKind={mediaKind}
              initialQuery={detail?.Title ?? ''}
            />
          )}

          {tab === 'collections' && (
            <CollectionsTab
              mediaKind={mediaKind}
              providerID={item.providerID}
            />
          )}

          {tab === 'files' && (
            <FilesTab
              mediaKind={mediaKind}
              provider={item.provider}
              providerID={item.providerID}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  detail,
  mediaKind,
  provider,
  providerID,
}: {
  detail: MediaMovieDto | MediaShowDto;
  mediaKind: TmdbMediaKind;
  provider: MediaProvider;
  providerID: number;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function runAction(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setMsg(null);
    setErr(null);
    try {
      await fn();
      setMsg(label);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) navigate('/login');
      else setErr(error instanceof Error ? error.message : 'Action failed.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5 p-4">
      {detail.Overview ? (
        <p className="text-sm leading-6 text-gray-300">{detail.Overview}</p>
      ) : (
        <p className="text-sm text-gray-500">No overview available.</p>
      )}

      {detail.Genres.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {detail.Genres.map(g => (
            <span key={g} className="rounded bg-gray-800/80 px-2 py-0.5 text-xs text-gray-300">
              {g}
            </span>
          ))}
        </div>
      )}

      {detail.ExternalIDs.length > 0 && (
        <div>
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            External IDs
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {detail.ExternalIDs.map(id => (
              <span
                key={`${id.Source}-${id.Value}`}
                className="rounded bg-gray-800/60 px-2 py-0.5 text-xs text-gray-400"
              >
                <span className="font-semibold uppercase text-gray-300">{id.Source}</span>{' '}
                {id.Value}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-gray-800/80 pt-4">
        <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          Actions
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={busy != null}
            onClick={() =>
              runAction('Refresh queued.', async () => {
                if (provider === 'tmdb') {
                  if (mediaKind === 'movie')
                    await tmdbApi.refreshMovie(providerID, { Force: true, DownloadImages: true });
                  else await tmdbApi.refreshShow(providerID, { Force: true, DownloadImages: true });
                } else {
                  await tvdbApi.refresh(mediaKind, providerID);
                }
              })
            }
            className="inline-flex items-center gap-1.5 rounded bg-gray-800 px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-700 hover:text-white disabled:opacity-50"
          >
            <RefreshCw size={13} className={busy === 'Refresh queued.' ? 'animate-spin' : ''} />
            Refresh {provider.toUpperCase()}
          </button>
          {provider === 'tmdb' && (
            <button
              disabled={busy != null}
              onClick={() =>
                runAction('Image download queued.', async () => {
                  if (mediaKind === 'movie') await tmdbApi.downloadMovieImages(providerID);
                  else await tmdbApi.downloadShowImages(providerID);
                })
              }
              className="inline-flex items-center gap-1.5 rounded bg-gray-800 px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-700 hover:text-white disabled:opacity-50"
            >
              <Image size={13} />
              Download images
            </button>
          )}
        </div>
        {msg && <p className="mt-2 text-xs text-shoko-accent">{msg}</p>}
        {err && <p className="mt-2 text-xs text-red-400">{err}</p>}
      </div>
    </div>
  );
}

// ─── Re-match Tab ─────────────────────────────────────────────────────────────

function RematchTab({
  mediaKind,
  initialQuery,
}: {
  mediaKind: TmdbMediaKind;
  initialQuery: string;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ ID: number; Title: string; Overview: string; Poster?: string; ReleasedAt?: string; FirstAiredAt?: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (initialQuery && !query) setQuery(initialQuery);
  }, [initialQuery]);  // eslint-disable-line react-hooks/exhaustive-deps

  async function search() {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setErr(null);
    try {
      const result =
        mediaKind === 'movie'
          ? await tmdbApi.searchMovies(q)
          : await tmdbApi.searchShows(q);
      setResults(result.List);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) navigate('/login');
      else setErr(error instanceof Error ? error.message : 'Search failed.');
    } finally {
      setSearching(false);
    }
  }

  async function cacheEntry(resultID: number) {
    setBusy(resultID);
    setMsg(null);
    setErr(null);
    try {
      if (mediaKind === 'movie')
        await tmdbApi.refreshMovie(resultID, { Force: true, DownloadImages: true });
      else await tmdbApi.refreshShow(resultID, { Force: true, DownloadImages: true });
      setMsg('Metadata refresh queued. Run a provider-match scan to link local files.');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) navigate('/login');
      else setErr(error instanceof Error ? error.message : 'Failed to cache metadata.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4 p-4">
      <p className="text-xs leading-5 text-gray-500">
        Search TMDB to find the correct metadata entry and cache it locally. After caching, use the
        Matches tab on the Library page to link local files.
      </p>

      <div className="flex gap-2">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          className="min-w-0 flex-1 rounded-md border border-gray-700 bg-gray-900/70 px-3 py-2 text-sm text-gray-100 outline-none app-focus"
          placeholder={`Search ${mediaKind}s on TMDB…`}
        />
        <button
          type="button"
          onClick={search}
          disabled={searching || !query.trim()}
          className="rounded-md bg-shoko-accent px-3 py-2 text-sm font-medium text-black transition-colors hover:bg-shoko-accent/85 disabled:opacity-50"
        >
          {searching ? '…' : <Search size={14} />}
        </button>
      </div>

      {msg && <p className="text-xs text-shoko-accent">{msg}</p>}
      {err && <p className="text-xs text-red-400">{err}</p>}

      <div className="space-y-2">
        {results.map(result => (
          <div
            key={result.ID}
            className="flex gap-3 rounded-md border border-gray-800/80 bg-gray-950/35 p-3"
          >
            {result.Poster ? (
              <img
                src={result.Poster}
                alt=""
                className="h-16 w-11 shrink-0 rounded object-cover"
              />
            ) : (
              <div className="grid h-16 w-11 shrink-0 place-items-center rounded bg-gray-900 text-gray-700">
                {mediaKind === 'movie' ? <Film size={16} /> : <Tv size={16} />}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-gray-100">{result.Title}</div>
              <div className="mt-0.5 text-xs text-gray-500">
                ID {result.ID}
                {result.ReleasedAt ? ` · ${new Date(result.ReleasedAt).getFullYear()}` : ''}
                {result.FirstAiredAt ? ` · ${new Date(result.FirstAiredAt).getFullYear()}` : ''}
              </div>
              {result.Overview && (
                <p className="mt-1 line-clamp-2 text-xs leading-4 text-gray-600">
                  {result.Overview}
                </p>
              )}
              <button
                type="button"
                disabled={busy != null}
                onClick={() => cacheEntry(result.ID)}
                className="mt-2 inline-flex items-center gap-1.5 rounded bg-gray-800 px-2 py-1 text-xs text-gray-300 transition-colors hover:bg-gray-700 hover:text-white disabled:opacity-50"
              >
                {busy === result.ID ? (
                  <RefreshCw size={11} className="animate-spin" />
                ) : (
                  <RefreshCw size={11} />
                )}
                Cache this entry
              </button>
            </div>
          </div>
        ))}
        {results.length === 0 && !searching && (
          <p className="py-4 text-center text-xs text-gray-600">
            No results yet — search to find the correct {mediaKind}.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Collections Tab ──────────────────────────────────────────────────────────

function hasExplicitRule(
  rules: CollectionRule[],
  builderName: string,
  providerID: number
): boolean {
  return rules.some(
    r =>
      r.Builder === builderName &&
      r.Options?.ids
        ?.split(',')
        .map(id => id.trim())
        .includes(String(providerID))
  );
}

function CollectionsTab({
  mediaKind,
  providerID,
}: {
  mediaKind: TmdbMediaKind;
  providerID: number;
}) {
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const builderName = mediaKind === 'movie' ? 'tmdb_movie' : 'tmdb_show';

  const loadCollections = useCallback(async () => {
    setLoading(true);
    try {
      setCollections(await collectionsApi.list());
    } catch {
      // silent — collections are a secondary concern
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCollections(); }, [loadCollections]);

  async function toggleCollection(collection: CollectionSummary) {
    setBusy(collection.ID);
    setMsg(null);
    setErr(null);
    try {
      const full: CollectionDefinition = await collectionsApi.get(collection.ID);
      const inIt = hasExplicitRule(full.Rules, builderName, providerID);
      const idStr = String(providerID);
      let updatedRules: CollectionRule[];

      if (inIt) {
        updatedRules = full.Rules
          .map(r => {
            if (r.Builder !== builderName || !r.Options?.ids) return r;
            const ids = r.Options.ids
              .split(',')
              .map(id => id.trim())
              .filter(id => id !== idStr);
            if (ids.length === 0) return null;
            return { ...r, Options: { ...r.Options, ids: ids.join(', ') } };
          })
          .filter((r): r is CollectionRule => r != null);
      } else {
        const existing = full.Rules.find(r => r.Builder === builderName && r.Options?.ids);
        if (existing && existing.Options) {
          updatedRules = full.Rules.map(r =>
            r === existing
              ? {
                  ...r,
                  Options: {
                    ...r.Options,
                    ids: [
                      ...(r.Options?.ids?.split(',').map(id => id.trim()) ?? []),
                      idStr,
                    ].join(', '),
                  },
                }
              : r
          );
        } else {
          updatedRules = [...full.Rules, { Builder: builderName, Options: { ids: idStr } }];
        }
      }

      await collectionsApi.update(collection.ID, {
        ID: full.ID,
        Name: full.Name,
        Enabled: full.Enabled,
        SyncMode: full.SyncMode,
        Rules: updatedRules,
      });

      await loadCollections();
      setMsg(inIt ? `Removed from "${collection.Name}".` : `Added to "${collection.Name}".`);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to update collection.');
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-shoko-accent border-t-transparent" />
      </div>
    );
  }

  const memberCollections = collections.filter(c =>
    hasExplicitRule(c.Rules, builderName, providerID)
  );
  const otherCollections = collections.filter(
    c => !hasExplicitRule(c.Rules, builderName, providerID)
  );

  return (
    <div className="space-y-4 p-4">
      <p className="text-xs leading-5 text-gray-500">
        Manage which managed collections this {mediaKind} is explicitly included in. Only explicit
        ID-based rules are shown here — items included via other builder rules are not listed.
      </p>

      {msg && <p className="text-xs text-shoko-accent">{msg}</p>}
      {err && <p className="text-xs text-red-400">{err}</p>}

      {memberCollections.length > 0 && (
        <div>
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            In these collections
          </h3>
          <div className="space-y-1.5">
            {memberCollections.map(c => (
              <div
                key={c.ID}
                className="flex items-center justify-between gap-3 rounded-md border border-green-700/30 bg-green-900/10 px-3 py-2"
              >
                <div className="min-w-0">
                  <span className="text-sm font-medium text-gray-200">{c.Name}</span>
                  {c.ItemCount != null && (
                    <span className="ml-2 text-xs text-gray-500">{c.ItemCount} items</span>
                  )}
                </div>
                <button
                  disabled={busy != null}
                  onClick={() => toggleCollection(c)}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded bg-red-500/80 px-2.5 py-1 text-xs text-white transition-colors hover:bg-red-500 disabled:opacity-50"
                >
                  <MinusCircle size={12} />
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {otherCollections.length > 0 && (
        <div>
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            Add to a collection
          </h3>
          <div className="space-y-1.5">
            {otherCollections.map(c => (
              <div
                key={c.ID}
                className="flex items-center justify-between gap-3 rounded-md border border-gray-800/60 bg-gray-950/30 px-3 py-2"
              >
                <div className="min-w-0">
                  <span className="text-sm text-gray-400">{c.Name}</span>
                  {c.ItemCount != null && (
                    <span className="ml-2 text-xs text-gray-600">{c.ItemCount} items</span>
                  )}
                </div>
                <button
                  disabled={busy != null}
                  onClick={() => toggleCollection(c)}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded bg-gray-800 px-2.5 py-1 text-xs text-gray-300 transition-colors hover:bg-gray-700 hover:text-white disabled:opacity-50"
                >
                  <PlusCircle size={12} />
                  Add
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {collections.length === 0 && (
        <p className="py-6 text-center text-sm text-gray-500">
          No managed collections found. Create collections in Settings → Collections.
        </p>
      )}
    </div>
  );
}

// ─── Files Tab ────────────────────────────────────────────────────────────────

function FilesTab({
  mediaKind,
  provider,
  providerID,
}: {
  mediaKind: TmdbMediaKind;
  provider: MediaProvider;
  providerID: number;
}) {
  const navigate = useNavigate();
  const [files, setFiles] = useState<DaCollectorFileDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [previews, setPreviews] = useState<Record<number, RelocationResult | null>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const r = await tmdbApi.getLinkedFiles(mediaKind, providerID, 1, 100);
      setFiles(r.List);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [mediaKind, providerID]);

  useEffect(() => {
    if (provider !== 'tmdb') {
      setLoading(false);
      return;
    }
    loadFiles();
  }, [provider, loadFiles]);

  async function previewRename(fileID: number) {
    setBusy(fileID);
    setErr(null);
    try {
      const results = await relocationApi.preview([fileID], { rename: true });
      setPreviews(p => ({ ...p, [fileID]: results[0] ?? null }));
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Preview failed.');
    } finally {
      setBusy(null);
    }
  }

  async function applyRename(fileID: number) {
    setBusy(fileID);
    setMsg(null);
    setErr(null);
    try {
      await relocationApi.relocate([fileID], { rename: true });
      setMsg('File renamed.');
      setPreviews(p => ({ ...p, [fileID]: null }));
      await loadFiles();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) navigate('/login');
      else setErr(error instanceof Error ? error.message : 'Rename failed.');
    } finally {
      setBusy(null);
    }
  }

  if (provider !== 'tmdb') {
    return (
      <div className="p-4">
        <p className="text-sm text-gray-500">File lookup is available for TMDB items only.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-shoko-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {msg && <p className="text-xs text-shoko-accent">{msg}</p>}
      {err && <p className="text-xs text-red-400">{err}</p>}

      {files.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">
          No local files are linked to this TMDB item.
        </p>
      ) : (
        <div className="space-y-3">
          {files.map(file => (
            <div
              key={file.ID}
              className="rounded-md border border-gray-800/80 bg-gray-950/30 p-3"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <HardDrive size={13} className="text-gray-500" />
                <span className="text-sm font-medium text-gray-100">File {file.ID}</span>
                {file.Resolution && (
                  <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[11px] text-gray-300">
                    {file.Resolution}
                  </span>
                )}
                <span className="text-xs text-gray-500">{formatBytes(file.Size)}</span>
                {file.IsIgnored && <span className="text-xs text-red-400">Ignored</span>}
              </div>

              {file.Locations.map(loc => (
                <div
                  key={loc.ID}
                  className="mb-1 truncate text-xs text-gray-500"
                  title={loc.AbsolutePath ?? loc.RelativePath}
                >
                  <span
                    className={`mr-1.5 font-medium ${
                      loc.IsAccessible ? 'text-green-500' : 'text-red-500'
                    }`}
                  >
                    ●
                  </span>
                  {loc.RelativePath}
                </div>
              ))}

              {previews[file.ID] && (
                <div className="mt-2 rounded bg-gray-900/60 px-2.5 py-2 text-xs">
                  <span className="font-medium text-gray-400">Preview: </span>
                  <span className="text-gray-300">
                    {previews[file.ID]?.RelativePath ?? 'No change needed'}
                  </span>
                </div>
              )}

              <div className="mt-2 flex gap-2">
                <button
                  disabled={busy != null}
                  onClick={() => previewRename(file.ID)}
                  className="inline-flex items-center gap-1.5 rounded bg-gray-800 px-2.5 py-1 text-xs text-gray-300 transition-colors hover:bg-gray-700 hover:text-white disabled:opacity-50"
                >
                  <Search size={11} />
                  Preview rename
                </button>
                {previews[file.ID] && (
                  <button
                    disabled={busy != null}
                    onClick={() => applyRename(file.ID)}
                    className="inline-flex items-center gap-1.5 rounded bg-shoko-accent px-2.5 py-1 text-xs text-black transition-colors hover:bg-shoko-accent/85 disabled:opacity-50"
                  >
                    <Check size={11} />
                    Apply rename
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
