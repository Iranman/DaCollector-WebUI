import { useEffect, useState } from 'react';
import { collectionsApi, CollectionSummary } from '../api/collections';
import { ApiError } from '../api/client';
import { useNavigate } from 'react-router-dom';

export default function Collections() {
  const navigate = useNavigate();
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setCollections(await collectionsApi.list());
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate('/setup');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load collections.');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSync(id: string) {
    setSyncing(id);
    try {
      await collectionsApi.sync(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed.');
    } finally {
      setSyncing(null);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete collection "${name}"?`)) return;
    try {
      await collectionsApi.delete(id);
      setCollections(prev => prev.filter(c => c.ID !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">Collections</h1>
        <button
          onClick={load}
          className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : collections.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500">No collections configured.</p>
          <p className="text-gray-600 text-sm mt-1">Collections are managed via the server configuration.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {collections.map(c => (
            <div
              key={c.ID}
              className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-100 truncate">{c.Name}</h3>
                    <span
                      className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${
                        c.Enabled
                          ? 'bg-green-900/50 text-green-400'
                          : 'bg-gray-800 text-gray-500'
                      }`}
                    >
                      {c.Enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="mt-1 flex gap-4 text-xs text-gray-500">
                    <span>Mode: {c.SyncMode}</span>
                    {c.ItemCount != null && <span>{c.ItemCount} items</span>}
                    {c.LastSynced && (
                      <span>Last sync: {new Date(c.LastSynced).toLocaleString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleSync(c.ID)}
                    disabled={syncing === c.ID}
                    className="text-xs px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 rounded-md text-white transition-colors"
                  >
                    {syncing === c.ID ? 'Syncing…' : 'Sync'}
                  </button>
                  <button
                    onClick={() => handleDelete(c.ID, c.Name)}
                    className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-red-900/50 hover:text-red-400 rounded-md text-gray-400 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
