import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, Trash2, RefreshCw } from 'lucide-react';
import { queueApi, QueueStatus, QueueItem } from '../api/queue';
import { ApiError } from '../api/client';

export default function Utilities() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await queueApi.get();
      setStatus(s);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate('/login');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load queue status.');
      }
    }
  }, [navigate]);

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  async function handleAction(fn: () => Promise<void>) {
    setActionPending(true);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setActionPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Utilities</h1>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="app-card rounded-md px-4 py-3 text-sm text-red-400 border-red-700/50">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Waiting" value={status?.WaitingCount ?? '—'} />
        <StatCard label="Blocked" value={status?.BlockedCount ?? '—'} />
        <StatCard label="Total" value={status?.TotalCount ?? '—'} />
        <StatCard label="Threads" value={status?.ThreadCount ?? '—'} />
      </div>

      <div className="app-card rounded-md">
        <div className="flex items-center justify-between border-b border-gray-700/50 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-200">Queue Controls</h2>
          <div className="flex gap-2">
            <button
              disabled={actionPending}
              onClick={() => handleAction(queueApi.pause)}
              className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors disabled:opacity-50"
            >
              <Pause size={12} />
              Pause
            </button>
            <button
              disabled={actionPending}
              onClick={() => handleAction(queueApi.resume)}
              className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50"
            >
              <Play size={12} />
              Resume
            </button>
            <button
              disabled={actionPending}
              onClick={() => handleAction(queueApi.clear)}
              className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs bg-red-700 hover:bg-red-600 text-white transition-colors disabled:opacity-50"
            >
              <Trash2 size={12} />
              Clear
            </button>
          </div>
        </div>

        {!status?.CurrentlyExecuting?.length ? (
          <div className="px-5 py-8 text-center text-sm text-gray-500">
            No jobs currently executing.
          </div>
        ) : (
          <ul className="divide-y divide-gray-800/50">
            {status.CurrentlyExecuting.map(item => (
              <ExecutingItem key={item.Key} item={item} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="app-card rounded-md px-5 py-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

function ExecutingItem({ item }: { item: QueueItem }) {
  return (
    <li className="px-5 py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-100 truncate">{item.Title}</p>
          {item.Details && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">{item.Details}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-500">{item.Type}</span>
          {item.IsRunning && (
            <span className="rounded-full px-2 py-0.5 text-xs bg-blue-600/20 text-blue-400">
              Running
            </span>
          )}
          {item.StartTime && (
            <span className="text-xs text-gray-600">
              {new Date(item.StartTime).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
