import { useEffect, useState } from 'react';
import { collectionsApi, CollectionSummary } from '../api/collections';
import { ApiError } from '../api/client';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';

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
        navigate('/login');
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
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Collection</h1>
        <Button size="sm" variant="secondary" onClick={load}>Refresh</Button>
      </div>

      {error && (
        <div className="app-card rounded-md px-4 py-3 text-sm text-red-400 border-red-700/50">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        </div>
      ) : collections.length === 0 ? (
        <div className="app-card rounded-md px-5 py-16 text-center">
          <p className="text-sm text-gray-500">No collections configured.</p>
          <p className="mt-1 text-xs text-gray-600">Collections are managed via the server configuration.</p>
        </div>
      ) : (
        <div className="app-card rounded-md divide-y divide-gray-800/50">
          {collections.map(c => (
            <div key={c.ID} className="flex items-start justify-between gap-4 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="truncate text-sm font-medium text-gray-100">{c.Name}</h3>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                      c.Enabled
                        ? 'bg-blue-600/20 text-blue-400'
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
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  disabled={syncing === c.ID}
                  onClick={() => handleSync(c.ID)}
                >
                  {syncing === c.ID ? 'Syncing…' : 'Sync'}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(c.ID, c.Name)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
