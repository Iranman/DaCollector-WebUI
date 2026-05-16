import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock3,
  Fingerprint,
  Info,
  Pause,
  Play,
  RefreshCw,
  Trash2,
  Wifi,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { queueApi, QueueItem, QueueStatus } from '../api/queue';
import { ApiError } from '../api/client';
import { hashingApi, HashingSummary, HashProvider } from '../api/hashing';
import { buildConnection } from '../lib/signalr';
import { useConfirm } from '../components/ui/ConfirmProvider';
import { useToast } from '../components/ui/ToastProvider';

type ConnState = 'connecting' | 'live' | 'reconnecting' | 'offline';
type QueueSection = 'running' | 'waiting' | 'blocked';

export default function Utilities() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { notify } = useToast();
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [types, setTypes] = useState<Record<string, number>>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('All');
  const [sectionFilter, setSectionFilter] = useState<QueueSection | 'all'>('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connState, setConnState] = useState<ConnState>('connecting');
  const [hashingSummary, setHashingSummary] = useState<HashingSummary | null>(null);
  const [hashProviders, setHashProviders] = useState<HashProvider[]>([]);
  const [hashingLoading, setHashingLoading] = useState(true);
  const [hashingError, setHashingError] = useState<string | null>(null);

  const loadHashing = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setHashingLoading(true);
      const [summary, providers] = await Promise.all([
        hashingApi.summary(),
        hashingApi.providers(),
      ]);
      setHashingSummary(summary);
      setHashProviders(providers);
      setHashingError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) navigate('/login');
      else setHashingError(err instanceof Error ? err.message : 'Failed to load hashing status.');
    } finally {
      if (showLoader) setHashingLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void loadHashing();
  }, [loadHashing]);

  useEffect(() => {
    let stopped = false;
    const conn = buildConnection('/signalr/aggregate');

    function applyState(state: QueueStatus) {
      if (!stopped) {
        setStatus(state);
        refreshItems(false);
      }
    }

    async function refreshItems(showLoader: boolean) {
      try {
        if (showLoader) setLoading(true);
        const [itemResult, typeResult] = await Promise.all([
          queueApi.getItems({ page: 1, pageSize: 250, showAll: true }),
          queueApi.getTypes(),
        ]);
        if (!stopped) {
          setItems(itemResult.List);
          setTypes(typeResult);
          setError(null);
        }
      } catch (err) {
        if (stopped) return;
        if (err instanceof ApiError && err.status === 401) navigate('/login');
        else setError(err instanceof Error ? err.message : 'Failed to load queue details.');
      } finally {
        if (!stopped && showLoader) setLoading(false);
      }
    }

    async function loadInitial() {
      try {
        setLoading(true);
        const [queueStatus] = await Promise.all([
          queueApi.get().then(result => {
            if (!stopped) setStatus(result);
            return result;
          }),
          refreshItems(false),
        ]);
        if (!stopped) setStatus(queueStatus);
      } catch (err) {
        if (stopped) return;
        if (err instanceof ApiError && err.status === 401) navigate('/login');
        else setError(err instanceof Error ? err.message : 'Failed to load queue status.');
      } finally {
        if (!stopped) setLoading(false);
      }
    }

    loadInitial();

    conn.on('queue:connected', applyState);
    conn.on('queue:state.changed', applyState);

    conn.onreconnecting(() => { if (!stopped) setConnState('reconnecting'); });
    conn.onreconnected(() => {
      if (!stopped) {
        setConnState('live');
        conn.invoke('feed.join_single', 'queue').catch(() => undefined);
      }
    });
    conn.onclose(() => { if (!stopped) setConnState('offline'); });

    conn.start()
      .then(() => {
        if (stopped) return;
        setConnState('live');
        return conn.invoke('feed.join_single', 'queue');
      })
      .catch(() => { if (!stopped) setConnState('offline'); });

    return () => {
      stopped = true;
      conn.stop();
    };
  }, [navigate]);

  async function handleRefresh() {
    try {
      setLoading(true);
      const hashingRefresh = loadHashing(false);
      const [queueStatus, itemResult, typeResult] = await Promise.all([
        queueApi.get(),
        queueApi.getItems({ page: 1, pageSize: 250, showAll: true }),
        queueApi.getTypes(),
      ]);
      await hashingRefresh;
      setStatus(queueStatus);
      setItems(itemResult.List);
      setTypes(typeResult);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) navigate('/login');
      else setError(err instanceof Error ? err.message : 'Failed to load queue status.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(id: string, label: string, fn: () => Promise<void>, confirmMessage?: string) {
    if (confirmMessage && !await confirm({
      confirmLabel: label,
      message: confirmMessage,
      title: `${label} Queue`,
      tone: label === 'Clear' ? 'danger' : 'warning',
    })) return;
    setActionPending(id);
    try {
      await fn();
      await handleRefresh();
      setError(null);
      notify({ message: `${label} completed.`, tone: 'success' });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) navigate('/login');
      else {
        const message = err instanceof Error ? err.message : `${label} failed.`;
        setError(message);
        notify({ message, title: `${label} failed`, tone: 'error' });
      }
    } finally {
      setActionPending(null);
    }
  }

  const sectioned = useMemo(() => {
    const lowered = search.trim().toLowerCase();
    const matches = (item: QueueItem) => {
      if (typeFilter !== 'All' && item.Type !== typeFilter) return false;
      if (!lowered) return true;
      return [
        item.Key,
        item.Type,
        item.Title,
        detailsText(item.Details),
      ].some(value => value.toLowerCase().includes(lowered));
    };

    const running = items.filter(item => item.IsRunning).filter(matches);
    const blocked = items.filter(item => !item.IsRunning && item.IsBlocked).filter(matches);
    const waiting = items.filter(item => !item.IsRunning && !item.IsBlocked).filter(matches);
    return { running, waiting, blocked };
  }, [items, search, typeFilter]);

  const displayedSections = [
    { id: 'running' as const, title: 'Running', items: sectioned.running, Icon: Play },
    { id: 'waiting' as const, title: 'Waiting', items: sectioned.waiting, Icon: Clock3 },
    { id: 'blocked' as const, title: 'Blocked', items: sectioned.blocked, Icon: Ban },
  ].filter(section => sectionFilter === 'all' || section.id === sectionFilter);

  const selected = selectedKey ? items.find(item => item.Key === selectedKey) ?? null : null;
  const queueRunning = status?.Running ?? true;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Utilities</h1>
          <p className="mt-1 text-sm text-gray-500">Queue operations and server task visibility.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ConnectionBadge state={connState} />
          <button
            onClick={handleRefresh}
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

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Waiting" value={status?.WaitingCount ?? '-'} tone="text-gray-100" />
        <StatCard label="Blocked" value={status?.BlockedCount ?? '-'} tone="text-yellow-300" />
        <StatCard label="Total" value={status?.TotalCount ?? '-'} tone="text-shoko-accent" />
        <StatCard label="Threads" value={status?.ThreadCount ?? '-'} tone="text-gray-100" />
        <StatCard label="State" value={queueRunning ? 'Running' : 'Paused'} tone={queueRunning ? 'text-emerald-300' : 'text-yellow-300'} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <div className="rounded-md border border-gray-700/50 bg-gray-900/40">
            <div className="flex flex-col gap-3 border-b border-gray-700/50 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_160px] lg:flex-1">
                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Search jobs..."
                  className="rounded-md border border-gray-700/50 bg-gray-800/70 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-shoko-accent focus:outline-none"
                />
                <select
                  value={typeFilter}
                  onChange={event => setTypeFilter(event.target.value)}
                  className="rounded-md border border-gray-700/50 bg-gray-800/70 px-3 py-2 text-sm text-gray-100 focus:border-shoko-accent focus:outline-none"
                >
                  <option>All</option>
                  {Object.keys(types).sort().map(type => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
                <select
                  value={sectionFilter}
                  onChange={event => setSectionFilter(event.target.value as QueueSection | 'all')}
                  className="rounded-md border border-gray-700/50 bg-gray-800/70 px-3 py-2 text-sm text-gray-100 focus:border-shoko-accent focus:outline-none"
                >
                  <option value="all">All sections</option>
                  <option value="running">Running</option>
                  <option value="waiting">Waiting</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
            </div>

            <div className="divide-y divide-gray-800/70">
              {displayedSections.map(section => (
                <QueueGroup
                  key={section.id}
                  title={section.title}
                  Icon={section.Icon}
                  items={section.items}
                  selectedKey={selectedKey}
                  onSelect={setSelectedKey}
                />
              ))}
            </div>
          </div>

          <div className="rounded-md border border-yellow-700/40 bg-yellow-950/10 px-4 py-3">
            <div className="flex items-start gap-2">
              <Info size={16} className="mt-0.5 shrink-0 text-yellow-400" />
              <p className="text-sm text-yellow-100/80">
                Job-level retry and cancel controls are not exposed by the server queue API. This page shows job details and supports the global queue controls available to admin users.
              </p>
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-md border border-gray-700/50 bg-gray-900/40">
            <div className="border-b border-gray-700/50 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-200">Admin Queue Controls</h2>
            </div>
            <div className="grid gap-2 p-4">
              <AdminButton
                label="Pause Queue"
                icon={<Pause size={14} />}
                pending={actionPending === 'pause'}
                disabled={Boolean(actionPending)}
                onClick={() => handleAction('pause', 'Pause queue', queueApi.pause)}
              />
              <AdminButton
                label="Resume Queue"
                icon={<Play size={14} />}
                pending={actionPending === 'resume'}
                disabled={Boolean(actionPending)}
                onClick={() => handleAction('resume', 'Resume queue', queueApi.resume)}
              />
              <AdminButton
                label="Clear Queue"
                icon={<Trash2 size={14} />}
                pending={actionPending === 'clear'}
                disabled={Boolean(actionPending)}
                destructive
                onClick={() => handleAction(
                  'clear',
                  'Clear queue',
                  queueApi.clear,
                  'Clear all queued jobs and reschedule recurring jobs? Running jobs and future scheduling can be affected.'
                )}
              />
            </div>
          </div>

          <HashingPanel
            error={hashingError}
            loading={hashingLoading}
            providers={hashProviders}
            summary={hashingSummary}
          />

          <JobDetails item={selected} />
        </aside>
      </div>
    </div>
  );
}

function HashingPanel({
  error,
  loading,
  providers,
  summary,
}: {
  error: string | null;
  loading: boolean;
  providers: HashProvider[];
  summary: HashingSummary | null;
}) {
  return (
    <div className="rounded-md border border-gray-700/50 bg-gray-900/40">
      <div className="flex items-center justify-between gap-3 border-b border-gray-700/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Fingerprint size={15} className="text-shoko-accent" />
          <h2 className="text-sm font-semibold text-gray-200">Hashing Status</h2>
        </div>
        {loading && <RefreshCw size={13} className="animate-spin text-gray-500" />}
      </div>

      {error ? (
        <div className="px-4 py-4 text-sm text-red-300">{error}</div>
      ) : loading && !summary ? (
        <div className="px-4 py-8 text-center text-sm text-gray-500">Loading hashing status...</div>
      ) : (
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3">
            <MiniMetric label="Mode" value={summary?.ParallelMode ? 'Parallel' : 'Serial'} />
            <MiniMetric label="Providers" value={summary?.ProviderCount ?? providers.length} />
            <MiniMetric label="Enabled Types" value={summary?.AllEnabledHashTypes.length ?? 0} />
            <MiniMetric label="Available Types" value={summary?.AllAvailableHashTypes.length ?? 0} />
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Enabled hashes</p>
            <HashTypeList types={summary?.AllEnabledHashTypes ?? []} emptyText="No hash types are enabled." />
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Providers</p>
            {providers.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">No hash providers are currently registered.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {providers.map(provider => (
                  <div key={provider.ID} className="rounded-md border border-gray-800/80 bg-black/20 px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-100">{provider.Name}</p>
                        <p className="mt-0.5 truncate text-xs text-gray-500">{provider.Plugin?.Name ?? 'Core'} · v{formatVersion(provider.Version)}</p>
                      </div>
                      <StatusPill label={`${provider.EnabledHashTypes.length}/${provider.AvailableHashTypes.length}`} tone={provider.EnabledHashTypes.length > 0 ? 'blue' : 'yellow'} />
                    </div>
                    {provider.Description && <p className="mt-2 line-clamp-2 text-xs text-gray-500">{provider.Description}</p>}
                    <div className="mt-2">
                      <HashTypeList types={provider.EnabledHashTypes} emptyText="Disabled" compact />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-gray-800/80 bg-black/20 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-gray-100">{value}</p>
    </div>
  );
}

function HashTypeList({ compact, emptyText, types }: { compact?: boolean; emptyText: string; types: string[] }) {
  if (types.length === 0) {
    return <p className="mt-2 text-xs text-gray-500">{emptyText}</p>;
  }
  return (
    <div className={`mt-2 flex flex-wrap gap-1.5 ${compact ? '' : 'gap-y-2'}`}>
      {types.map(type => (
        <span key={type} className="rounded border border-gray-700/60 bg-gray-950/60 px-2 py-0.5 text-[11px] uppercase tracking-wide text-gray-300">
          {type}
        </span>
      ))}
    </div>
  );
}

function formatVersion(value: HashProvider['Version']) {
  if (typeof value === 'string') return value;
  const parts = [value.Major, value.Minor, value.Build, value.Revision].filter(part => part != null && part >= 0);
  return parts.length > 0 ? parts.join('.') : 'unknown';
}

function ConnectionBadge({ state }: { state: ConnState }) {
  if (state === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
        <Wifi size={12} /> Live
      </span>
    );
  }
  if (state === 'reconnecting') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-yellow-400">
        <RefreshCw size={12} className="animate-spin" /> Reconnecting
      </span>
    );
  }
  if (state === 'offline') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
        <WifiOff size={12} /> Offline
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
      <RefreshCw size={12} className="animate-spin" /> Connecting
    </span>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div className="rounded-md border border-gray-700/50 bg-gray-900/40 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function QueueGroup({
  title,
  Icon,
  items,
  selectedKey,
  onSelect,
}: {
  title: string;
  Icon: LucideIcon;
  items: QueueItem[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  return (
    <section>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon size={15} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-200">{title}</h2>
        </div>
        <span className="text-xs text-gray-500">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="px-4 pb-4 text-sm text-gray-600">No jobs in this section.</div>
      ) : (
        <ul className="divide-y divide-gray-800/60">
          {items.map(item => (
            <li key={item.Key}>
              <button
                type="button"
                onClick={() => onSelect(item.Key)}
                className={`block w-full px-4 py-3 text-left transition-colors ${
                  selectedKey === item.Key ? 'bg-shoko-accent/10' : 'hover:bg-white/5'
                }`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-100">{item.Title || item.Type}</p>
                    <p className="mt-0.5 truncate text-xs text-gray-500">{item.Key}</p>
                    {detailsText(item.Details) && (
                      <p className="mt-1 line-clamp-2 text-xs text-gray-400">{detailsText(item.Details)}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <span className="rounded bg-gray-800 px-2 py-0.5 text-[11px] text-gray-400">{item.Type}</span>
                    {item.IsRunning && <StatusPill label="Running" tone="blue" />}
                    {item.IsBlocked && <StatusPill label="Blocked" tone="yellow" />}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function JobDetails({ item }: { item: QueueItem | null }) {
  return (
    <div className="rounded-md border border-gray-700/50 bg-gray-900/40">
      <div className="border-b border-gray-700/50 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-200">Job Details</h2>
      </div>
      {!item ? (
        <div className="px-4 py-8 text-center text-sm text-gray-500">Select a queue job to inspect details.</div>
      ) : (
        <div className="space-y-4 p-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Title</p>
            <p className="mt-1 text-sm text-gray-100">{item.Title || item.Type}</p>
          </div>
          <DetailRow label="Key" value={item.Key} />
          <DetailRow label="Type" value={item.Type} />
          <DetailRow label="State" value={item.IsRunning ? 'Running' : item.IsBlocked ? 'Blocked' : 'Waiting'} />
          {item.StartTime && <DetailRow label="Started" value={new Date(item.StartTime).toLocaleString()} />}
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Details</p>
            {Object.keys(item.Details ?? {}).length === 0 ? (
              <p className="mt-1 text-sm text-gray-500">No detail fields reported.</p>
            ) : (
              <dl className="mt-2 space-y-2">
                {Object.entries(item.Details).map(([key, value]) => (
                  <div key={key} className="rounded border border-gray-800/80 bg-black/20 px-3 py-2">
                    <dt className="text-[11px] uppercase tracking-wide text-gray-500">{key}</dt>
                    <dd className="mt-1 break-words text-sm text-gray-200">{formatDetailValue(value)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 break-words text-sm text-gray-200">{value}</p>
    </div>
  );
}

function AdminButton({
  label,
  icon,
  pending,
  disabled,
  destructive,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  pending: boolean;
  disabled: boolean;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        destructive
          ? 'border-red-500/70 bg-red-600 text-white hover:bg-red-500'
          : 'border-gray-600 bg-gray-800/70 text-gray-200 hover:border-gray-500 hover:text-white'
      }`}
    >
      {pending ? <span className="h-3.5 w-3.5 animate-spin rounded-full border border-current border-t-transparent" /> : icon}
      {label}
    </button>
  );
}

function StatusPill({ label, tone }: { label: string; tone: 'blue' | 'yellow' }) {
  const classes = tone === 'blue'
    ? 'bg-shoko-accent/15 text-shoko-accent'
    : 'bg-yellow-900/40 text-yellow-300';
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] ${classes}`}>
      {tone === 'blue' ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
      {label}
    </span>
  );
}

function detailsText(details: Record<string, unknown> | undefined) {
  if (!details) return '';
  return Object.entries(details)
    .map(([key, value]) => `${key}: ${formatDetailValue(value)}`)
    .join(' · ');
}

function formatDetailValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
