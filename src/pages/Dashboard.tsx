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
          navigate('/setup');
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load data.');
        }
      }
    }
    load();
  }, [navigate]);

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Dashboard</h1>
        {version && <p className="text-sm text-gray-500 mt-1">Server {version}</p>}
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Status" value={status?.State ?? '—'} />
        <StatCard label="Uptime" value={status?.Uptime ?? '—'} />
        <StatCard label="Collections" value={String(collections.length)} />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-200 mb-4">Collections</h2>
        {collections.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No collections yet.{' '}
            <button
              onClick={() => navigate('/collections')}
              className="text-indigo-400 hover:underline"
            >
              Create one
            </button>
          </p>
        ) : (
          <div className="space-y-2">
            {collections.map(c => (
              <div
                key={c.ID}
                className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 flex items-center justify-between"
              >
                <div>
                  <span className="font-medium text-gray-100">{c.Name}</span>
                  <span className="ml-3 text-xs text-gray-500">{c.SyncMode}</span>
                </div>
                <div className="flex items-center gap-3">
                  {c.ItemCount != null && (
                    <span className="text-sm text-gray-400">{c.ItemCount} items</span>
                  )}
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      c.Enabled
                        ? 'bg-green-900/50 text-green-400'
                        : 'bg-gray-800 text-gray-500'
                    }`}
                  >
                    {c.Enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-xl font-semibold text-gray-100">{value}</p>
    </div>
  );
}
