import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clipboard,
  Download,
  FileText,
  RefreshCw,
  Save,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { loggingApi, LogEntry, LogFile, LogReadOptions } from '../api/logging';
import { ApiError } from '../api/client';
import { buildConnection } from '../lib/signalr';
import { useConfirm } from '../components/ui/ConfirmProvider';
import { useToast } from '../components/ui/ToastProvider';

const MAX_ENTRIES = 500;
const SAVED_FILTERS_KEY = 'dacollector_log_filters';

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
  Info: 'bg-shoko-accent/10 text-shoko-accent',
  Warn: 'bg-yellow-900/40 text-yellow-400',
  Error: 'bg-red-900/40 text-red-400',
  Fatal: 'bg-red-800/60 text-red-300',
};

const levels = ['All', 'Trace', 'Debug', 'Info', 'Warn', 'Error', 'Fatal'];

type ConnState = 'connecting' | 'live' | 'reconnecting' | 'offline';

interface Filters {
  text: string;
  logger: string;
  level: string;
  exceptionOnly: boolean;
}

interface SavedFilter extends Filters {
  id: string;
  name: string;
}

const emptyFilters: Filters = {
  text: '',
  logger: '',
  level: 'All',
  exceptionOnly: false,
};

export default function Log() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { notify } = useToast();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [files, setFiles] = useState<LogFile[]>([]);
  const [selectedFileID, setSelectedFileID] = useState<string>('current');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(loadSavedFilters);
  const [connState, setConnState] = useState<ConnState>('connecting');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let stopped = false;

    async function loadFiles() {
      try {
        const result = await loggingApi.listFiles();
        if (stopped) return;
        setFiles(result);
        const current = result.find(file => file.IsCurrent);
        if (current) setSelectedFileID(current.ID);
      } catch (err) {
        if (stopped) return;
        if (err instanceof ApiError && err.status === 401) navigate('/login');
        else setError(err instanceof Error ? err.message : 'Failed to load log files.');
      }
    }

    loadFiles();
    return () => { stopped = true; };
  }, [navigate]);

  useEffect(() => {
    const conn = buildConnection('/signalr/logging');
    let stopped = false;

    conn.on('GetBacklog', (_backlog: LogEntry[]) => {
      // History is loaded from the REST log endpoint to keep filters consistent.
    });

    conn.on('Log', (entry: LogEntry) => {
      const normalized = normalizeEntry(entry);
      setEntries(prev => {
        if (!matchesFilters(normalized, filters)) return prev;
        const next = [...prev, normalized];
        return next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next;
      });
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      });
    });

    conn.onreconnecting(() => { if (!stopped) setConnState('reconnecting'); });
    conn.onreconnected(() => { if (!stopped) setConnState('live'); });
    conn.onclose(() => { if (!stopped) setConnState('offline'); });

    conn.start()
      .then(() => { if (!stopped) setConnState('live'); })
      .catch(() => { if (!stopped) setConnState('offline'); });

    return () => {
      stopped = true;
      conn.stop();
    };
  }, [filters]);

  useEffect(() => {
    loadEntries();
  }, [selectedFileID, filters]);

  const selectedFile = useMemo(
    () => files.find(file => file.ID === selectedFileID) ?? files.find(file => file.IsCurrent) ?? null,
    [files, selectedFileID]
  );

  async function loadEntries() {
    setLoading(true);
    setMessage(null);
    try {
      const options: LogReadOptions = {
        fileID: selectedFileID === 'current' ? undefined : selectedFileID,
        offset: 0,
        limit: MAX_ENTRIES,
        descending: true,
        level: apiLevel(filters.level),
        logger: dslContains(filters.logger),
        message: dslContains(filters.text),
        exception: filters.exceptionOnly ? '=!:' : undefined,
      };
      const result = await loggingApi.readWithFilters(options);
      setEntries(result.Entries.map(normalizeEntry).slice().reverse());
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) navigate('/login');
      else setError(err instanceof Error ? err.message : 'Failed to load logs.');
    } finally {
      setLoading(false);
    }
  }

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters(prev => ({ ...prev, [key]: value }));
  }

  function applySavedFilter(id: string) {
    const saved = savedFilters.find(filter => filter.id === id);
    if (saved) {
      setFilters({
        text: saved.text,
        logger: saved.logger,
        level: saved.level,
        exceptionOnly: saved.exceptionOnly,
      });
    }
  }

  function saveFilter() {
    const name = window.prompt('Filter name');
    if (!name?.trim()) return;
    const next = [
      ...savedFilters.filter(filter => filter.name.toLowerCase() !== name.trim().toLowerCase()),
      { ...filters, id: String(Date.now()), name: name.trim() },
    ];
    setSavedFilters(next);
    localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(next));
  }

  async function copyVisibleEntries() {
    const text = entries.map(entry => formatEntry(entry)).join('\n');
    await navigator.clipboard.writeText(text);
    setMessage(`Copied ${entries.length} visible log entries.`);
    notify({ message: `Copied ${entries.length} visible log entries.`, tone: 'success' });
  }

  async function downloadSelected(format: 'simple' | 'full' | 'json' = 'full') {
    try {
      const download = await loggingApi.download({
        fileID: selectedFileID === 'current' ? undefined : selectedFileID,
        format,
        level: apiLevel(filters.level),
        logger: dslContains(filters.logger),
        message: dslContains(filters.text),
        exception: filters.exceptionOnly ? '=!:' : undefined,
      });
      const url = URL.createObjectURL(download.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = download.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage('Log download started.');
      notify({ message: 'Log download started.', tone: 'success' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download log.');
    }
  }

  async function deleteSelectedFile() {
    if (!selectedFile || selectedFile.IsCurrent) return;
    if (!await confirm({
      confirmLabel: 'Delete Log',
      message: `Delete log file ${selectedFile.Name}? This cannot be undone.`,
      title: 'Delete Log File',
      tone: 'danger',
    })) return;
    try {
      await loggingApi.deleteFile(selectedFile.ID);
      const nextFiles = await loggingApi.listFiles();
      setFiles(nextFiles);
      const current = nextFiles.find(file => file.IsCurrent);
      setSelectedFileID(current?.ID ?? 'current');
      setMessage(`Deleted ${selectedFile.Name}.`);
      notify({ message: `Deleted ${selectedFile.Name}.`, tone: 'success' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete log file.');
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Log</h1>
          <p className="mt-1 text-sm text-gray-500">Filtered server logs with file-level admin controls.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ConnectionBadge state={connState} />
          <button
            onClick={loadEntries}
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
      {message && (
        <div className="mt-5 rounded-md border border-emerald-700/40 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-300">
          {message}
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-md border border-gray-700/50 bg-gray-900/40">
          <div className="grid gap-3 border-b border-gray-700/50 px-4 py-4 md:grid-cols-[minmax(0,1fr)_180px_180px]">
            <input
              type="text"
              placeholder="Filter messages..."
              value={filters.text}
              onChange={event => updateFilter('text', event.target.value)}
              className="rounded-md border border-gray-700/50 bg-gray-800/70 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-shoko-accent focus:outline-none"
            />
            <input
              type="text"
              placeholder="Logger..."
              value={filters.logger}
              onChange={event => updateFilter('logger', event.target.value)}
              className="rounded-md border border-gray-700/50 bg-gray-800/70 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-shoko-accent focus:outline-none"
            />
            <select
              value={filters.level}
              onChange={event => updateFilter('level', event.target.value)}
              className="rounded-md border border-gray-700/50 bg-gray-800/70 px-3 py-2 text-sm text-gray-200 focus:border-shoko-accent focus:outline-none"
            >
              {levels.map(level => (
                <option key={level}>{level}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-b border-gray-800/70 px-4 py-3">
            <label className="inline-flex items-center gap-2 text-sm text-gray-400">
              <input
                type="checkbox"
                checked={filters.exceptionOnly}
                onChange={event => updateFilter('exceptionOnly', event.target.checked)}
                className="h-4 w-4 rounded border-gray-600 bg-gray-800 accent-shoko-accent"
              />
              Exceptions only
            </label>
            <button
              onClick={saveFilter}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-700/60 bg-gray-800/70 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:text-white"
            >
              <Save size={13} />
              Save Filter
            </button>
            <select
              value=""
              onChange={event => applySavedFilter(event.target.value)}
              className="rounded-md border border-gray-700/50 bg-gray-800/70 px-3 py-1.5 text-xs text-gray-300 focus:border-shoko-accent focus:outline-none"
            >
              <option value="">Saved filters</option>
              {savedFilters.map(filter => (
                <option key={filter.id} value={filter.id}>{filter.name}</option>
              ))}
            </select>
            <button
              onClick={() => setFilters(emptyFilters)}
              className="text-xs text-gray-500 transition-colors hover:text-white"
            >
              Clear
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-700/50 px-4 py-2.5">
            <span className="text-xs text-gray-500">{entries.length} entries</span>
            <div className="flex flex-wrap gap-2">
              <button onClick={copyVisibleEntries} className="inline-flex items-center gap-1.5 text-xs text-gray-400 transition-colors hover:text-white">
                <Clipboard size={13} />
                Copy Visible
              </button>
              <button onClick={() => downloadSelected('full')} className="inline-flex items-center gap-1.5 text-xs text-gray-400 transition-colors hover:text-white">
                <Download size={13} />
                Download
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-shoko-accent border-t-transparent" />
            </div>
          ) : entries.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-500">No log entries found.</div>
          ) : (
            <div ref={scrollRef} className="max-h-[70vh] overflow-y-auto">
              <div className="hidden min-w-[900px] overflow-x-auto md:block">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-shoko-surface">
                    <tr className="border-b border-gray-800/50">
                      <th className="px-4 py-2 text-left font-normal text-gray-500">Time</th>
                      <th className="px-3 py-2 text-left font-normal text-gray-500">Level</th>
                      <th className="px-3 py-2 text-left font-normal text-gray-500">Logger</th>
                      <th className="px-3 py-2 text-left font-normal text-gray-500">Message</th>
                      <th className="px-3 py-2 text-right font-normal text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry, index) => (
                      <LogRow key={`${entry.TimeStamp}-${index}`} entry={entry} />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="divide-y divide-gray-800/70 md:hidden">
                {entries.map((entry, index) => (
                  <LogCard key={`${entry.TimeStamp}-${index}`} entry={entry} />
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-md border border-gray-700/50 bg-gray-900/40">
            <div className="border-b border-gray-700/50 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-200">Log Files</h2>
            </div>
            <div className="space-y-3 p-4">
              <select
                value={selectedFileID}
                onChange={event => setSelectedFileID(event.target.value)}
                className="w-full rounded-md border border-gray-700/50 bg-gray-800/70 px-3 py-2 text-sm text-gray-200 focus:border-shoko-accent focus:outline-none"
              >
                {files.map(file => (
                  <option key={file.ID} value={file.ID}>
                    {file.IsCurrent ? 'Current - ' : ''}{file.Name}
                  </option>
                ))}
              </select>
              {selectedFile ? (
                <div className="space-y-2 text-sm text-gray-400">
                  <FileMeta label="Name" value={selectedFile.Name} />
                  <FileMeta label="Format" value={selectedFile.Format} />
                  <FileMeta label="Size" value={formatBytes(selectedFile.Size)} />
                  <FileMeta label="Modified" value={new Date(selectedFile.LastModifiedAt).toLocaleString()} />
                </div>
              ) : (
                <p className="text-sm text-gray-500">No log files reported.</p>
              )}
              <div className="grid gap-2">
                <button
                  onClick={() => downloadSelected('full')}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-600 bg-gray-800/70 px-3 py-2 text-sm text-gray-200 transition-colors hover:border-gray-500 hover:text-white"
                >
                  <Download size={14} />
                  Download Selected
                </button>
                <button
                  disabled={!selectedFile || selectedFile.IsCurrent}
                  onClick={deleteSelectedFile}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-red-500/70 bg-red-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  Delete File
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-gray-700/50 bg-gray-900/40 p-4">
            <div className="flex items-start gap-2">
              <FileText size={16} className="mt-0.5 shrink-0 text-gray-400" />
              <p className="text-sm text-gray-500">
                Current log files cannot be deleted. Deleting archived files is an admin action and is confirmed before it runs.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function LogRow({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <tr className={`border-b border-gray-800/30 hover:bg-white/5 ${levelStyle(entry.Level)}`}>
        <td className="whitespace-nowrap px-4 py-2 font-mono text-gray-600">{new Date(entry.TimeStamp).toLocaleTimeString()}</td>
        <td className="whitespace-nowrap px-3 py-2">
          <LevelBadge level={entry.Level} />
        </td>
        <td className="max-w-[220px] truncate whitespace-nowrap px-3 py-2 text-gray-500" title={entry.Logger}>
          {shortLogger(entry.Logger)}
        </td>
        <td className="px-3 py-2">
          <button type="button" onClick={() => setExpanded(value => !value)} className="break-all text-left hover:text-white">
            {entry.Message}
          </button>
        </td>
        <td className="whitespace-nowrap px-3 py-2 text-right">
          <CopyButton entry={entry} />
        </td>
      </tr>
      {expanded && (
        <tr className="bg-black/20">
          <td colSpan={5} className="px-4 py-3">
            <ExpandedEntry entry={entry} />
          </td>
        </tr>
      )}
    </>
  );
}

function LogCard({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`px-4 py-3 ${levelStyle(entry.Level)}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <LevelBadge level={entry.Level} />
            <span className="text-xs text-gray-600">{new Date(entry.TimeStamp).toLocaleTimeString()}</span>
            <span className="truncate text-xs text-gray-500">{shortLogger(entry.Logger)}</span>
          </div>
          <button type="button" onClick={() => setExpanded(value => !value)} className="mt-2 break-words text-left text-sm">
            {entry.Message}
          </button>
        </div>
        <CopyButton entry={entry} />
      </div>
      {expanded && <ExpandedEntry entry={entry} />}
    </div>
  );
}

function ExpandedEntry({ entry }: { entry: LogEntry }) {
  return (
    <div className="mt-2 space-y-3 rounded-md border border-gray-800/80 bg-black/20 p-3">
      <div className="grid gap-2 text-xs text-gray-400 sm:grid-cols-2">
        <span>Logger: {entry.Logger}</span>
        <span>Caller: {entry.Caller || 'n/a'}</span>
        <span>Process: {entry.ProcessId}</span>
        <span>Thread: {entry.ThreadId}</span>
      </div>
      {entry.Exception && (
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded bg-red-950/20 p-3 font-mono text-xs text-red-300">
          {entry.Exception}
        </pre>
      )}
    </div>
  );
}

function CopyButton({ entry }: { entry: LogEntry }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(formatEntry(entry));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }
  return (
    <button type="button" onClick={copy} className="inline-flex items-center gap-1 text-xs text-gray-500 transition-colors hover:text-white">
      <Clipboard size={12} />
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function ConnectionBadge({ state }: { state: ConnState }) {
  if (state === 'live') {
    return <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400"><Wifi size={12} /> Live</span>;
  }
  if (state === 'reconnecting') {
    return <span className="inline-flex items-center gap-1.5 text-xs text-yellow-400"><RefreshCw size={12} className="animate-spin" /> Reconnecting</span>;
  }
  if (state === 'offline') {
    return <span className="inline-flex items-center gap-1.5 text-xs text-gray-500"><WifiOff size={12} /> Offline</span>;
  }
  return <span className="inline-flex items-center gap-1.5 text-xs text-gray-500"><RefreshCw size={12} className="animate-spin" /> Connecting</span>;
}

function LevelBadge({ level }: { level: string }) {
  return <span className={`rounded px-1.5 py-0.5 text-[10px] ${levelBadge(level)}`}>{level}</span>;
}

function FileMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-600">{label}</p>
      <p className="mt-0.5 break-words text-gray-300">{value}</p>
    </div>
  );
}

function levelStyle(level: string) {
  return LEVEL_STYLES[level] ?? 'text-gray-300';
}

function levelBadge(level: string) {
  return LEVEL_BADGE[level] ?? 'bg-gray-800 text-gray-400';
}

function normalizeEntry(entry: LogEntry): LogEntry {
  return { ...entry, Level: normalizeLevel(entry.Level) };
}

function normalizeLevel(level: string): string {
  if (level === 'Information') return 'Info';
  if (level === 'Warning') return 'Warn';
  if (level === 'Critical') return 'Fatal';
  return level;
}

function apiLevel(level: string) {
  if (level === 'All') return undefined;
  if (level === 'Info') return 'Information';
  if (level === 'Warn') return 'Warning';
  if (level === 'Fatal') return 'Critical';
  return level;
}

function dslContains(value: string) {
  const trimmed = value.trim();
  return trimmed ? `c#:${trimmed}` : undefined;
}

function matchesFilters(entry: LogEntry, filters: Filters) {
  if (filters.level !== 'All' && entry.Level !== filters.level) return false;
  if (filters.exceptionOnly && !entry.Exception) return false;
  const text = filters.text.trim().toLowerCase();
  if (text && !entry.Message.toLowerCase().includes(text) && !(entry.Exception ?? '').toLowerCase().includes(text)) return false;
  const logger = filters.logger.trim().toLowerCase();
  if (logger && !entry.Logger.toLowerCase().includes(logger)) return false;
  return true;
}

function shortLogger(logger: string) {
  return logger.split('.').pop() || logger;
}

function formatEntry(entry: LogEntry) {
  const base = `[${entry.TimeStamp}] ${entry.Level} ${entry.Logger}: ${entry.Message}`;
  return entry.Exception ? `${base}\n${entry.Exception}` : base;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[index]}`;
}

function loadSavedFilters(): SavedFilter[] {
  try {
    const raw = localStorage.getItem(SAVED_FILTERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
