import { useEffect, useState } from 'react';
import { initApi, ServerStatus } from '../api/init';
import { collectionsApi, CollectionSummary } from '../api/collections';
import { ApiError } from '../api/client';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [version, setVersion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [s, c, v] = await Promise.all([
          initApi.getStatus(),
          collectionsApi.list(),
          initApi.getVersion(),
        ]);
        setStatus(s);
        setCollections(c);
        setVersion(v.Server.Version);
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Status" value={status?.State ?? '—'} />
        <StatCard label="Uptime" value={status?.Uptime ?? '—'} />
        <StatCard label="Collections" value={String(collections.length)} />
      </div>

      <div className="app-card rounded-md">
        <div className="flex items-center justify-between border-b border-gray-700/50 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-200">Collections</h2>
          <button
            onClick={() => navigate('/collections')}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            View all
          </button>
        </div>

        {collections.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-gray-500">No collections configured.</p>
            <button
              onClick={() => navigate('/collections')}
              className="mt-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Go to Collections
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-800/50">
            {collections.map(c => (
              <li key={c.ID} className="flex items-center justify-between px-5 py-3">
                <div>
                  <span className="text-sm font-medium text-gray-100">{c.Name}</span>
                  <span className="ml-3 text-xs text-gray-500">{c.SyncMode}</span>
                </div>
                <div className="flex items-center gap-3">
                  {c.ItemCount != null && (
                    <span className="text-xs text-gray-400">{c.ItemCount} items</span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      c.Enabled
                        ? 'bg-blue-600/20 text-blue-400'
                        : 'bg-gray-800 text-gray-500'
                    }`}
                  >
                    {c.Enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
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
