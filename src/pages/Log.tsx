import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { loggingApi, LogEntry } from '../api/logging';
import { ApiError } from '../api/client';

const LEVEL_STYLES: Record<string, string> = {
  Trace: 'text-gray-600',
  Debug: 'text-gray-400',
  Info: 'text-gray-200',
  Warn: 'text-yellow-400',
  Error: 'text-red-400',
  Fatal: 'text-red-500 font-semibold',
};

const LEVEL_BADGE: Record<string, string> = {
  Trace: 'bg-gray-800 text-gray-500',
  Debug: 'bg-gray-700 text-gray-400',
  Info: 'bg-blue-900/40 text-blue-300',
  Warn: 'bg-yellow-900/40 text-yellow-400',
  Error: 'bg-red-900/40 text-red-400',
  Fatal: 'bg-red-800/60 text-red-300',
};

function levelStyle(level: string) {
  return LEVEL_STYLES[level] ?? 'text-gray-300';
}

function levelBadge(level: string) {
  return LEVEL_BADGE[level] ?? 'bg-gray-800 text-gray-400';
}

export default function Log() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('All');
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const result = await loggingApi.read(0, 500, true);
      setEntries(result.Entries);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate('/login');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load logs.');
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const levels = ['All', 'Trace', 'Debug', 'Info', 'Warn', 'Error', 'Fatal'];

  const filtered = entries.filter(e => {
    if (levelFilter !== 'All' && e.Level !== levelFilter) return false;
    if (filter && !e.Message.toLowerCase().includes(filter.toLowerCase()) &&
        !e.Logger.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Log</h1>
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

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Filter messages..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="flex-1 min-w-40 rounded bg-gray-800/60 border border-gray-700/50 px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500"
        />
        <div className="flex gap-1">
          {levels.map(lvl => (
            <button
              key={lvl}
              onClick={() => setLevelFilter(lvl)}
              className={`rounded px-2.5 py-1 text-xs transition-colors ${
                levelFilter === lvl
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      <div className="app-card rounded-md overflow-hidden">
        <div className="border-b border-gray-700/50 px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs text-gray-500">{filtered.length} entries</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-500">No log entries found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800/50">
                  <th className="px-4 py-2 text-left text-gray-500 font-normal whitespace-nowrap">Time</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-normal">Level</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-normal">Logger</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-normal w-full">Message</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry, i) => (
                  <LogRow key={i} entry={entry} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function LogRow({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const time = new Date(entry.TimeStamp).toLocaleTimeString();

  return (
    <>
      <tr
        className={`border-b border-gray-800/30 hover:bg-white/5 cursor-pointer ${levelStyle(entry.Level)}`}
        onClick={() => entry.Exception ? setExpanded(v => !v) : undefined}
      >
        <td className="px-4 py-1.5 whitespace-nowrap text-gray-600 font-mono">{time}</td>
        <td className="px-3 py-1.5 whitespace-nowrap">
          <span className={`rounded px-1.5 py-0.5 text-[10px] ${levelBadge(entry.Level)}`}>
            {entry.Level}
          </span>
        </td>
        <td className="px-3 py-1.5 whitespace-nowrap text-gray-500 max-w-[200px] truncate">
          {entry.Logger.split('.').pop()}
        </td>
        <td className="px-3 py-1.5 break-all">{entry.Message}</td>
      </tr>
      {expanded && entry.Exception && (
        <tr className="bg-red-950/20">
          <td colSpan={4} className="px-4 py-2">
            <pre className="text-xs text-red-300 whitespace-pre-wrap font-mono">{entry.Exception}</pre>
          </td>
        </tr>
      )}
    </>
  );
}
