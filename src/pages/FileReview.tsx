import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw, ChevronRight, ChevronDown,
  EyeOff, Eye, Search, CheckCircle2, XCircle, RotateCcw,
} from 'lucide-react';
import {
  fileReviewApi,
  MediaFileReviewItem,
  MediaFileMatchCandidate,
} from '../api/fileReview';
import { ApiError } from '../api/client';

const PAGE_SIZE = 50;

interface FileState {
  expanded: boolean;
  candidates: MediaFileMatchCandidate[] | null;
  loadingCandidates: boolean;
  scanning: boolean;
  refreshing: boolean;
  acting: boolean;
  error: string | null;
}

function defaultFileState(): FileState {
  return { expanded: false, candidates: null, loadingCandidates: false, scanning: false, refreshing: false, acting: false, error: null };
}

export default function FileReview() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<MediaFileReviewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [includeIgnored, setIncludeIgnored] = useState(false);
  const [scanOnline, setScanOnline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchScanning, setBatchScanning] = useState(false);
  const [fileStates, setFileStates] = useState<Record<number, FileState>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fileReviewApi.getUnmatched(page, PAGE_SIZE, includeIgnored);
      setFiles(r.List);
      setTotal(r.Total);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) navigate('/login');
      else setError(err instanceof Error ? err.message : 'Failed to load files.');
    } finally {
      setLoading(false);
    }
  }, [navigate, page, includeIgnored]);

  useEffect(() => { load(); }, [load]);

  function getState(fileID: number): FileState {
    return fileStates[fileID] ?? defaultFileState();
  }

  function patchState(fileID: number, patch: Partial<FileState>) {
    setFileStates(prev => ({
      ...prev,
      [fileID]: { ...(prev[fileID] ?? defaultFileState()), ...patch },
    }));
  }

  async function toggleExpand(fileID: number) {
    const s = getState(fileID);
    const expanded = !s.expanded;
    patchState(fileID, { expanded });
    if (expanded && s.candidates === null) {
      patchState(fileID, { loadingCandidates: true });
      try {
        const candidates = await fileReviewApi.getFileCandidates(fileID);
        patchState(fileID, { candidates, loadingCandidates: false });
      } catch {
        patchState(fileID, { loadingCandidates: false });
      }
    }
  }

  async function handleIgnore(fileID: number) {
    patchState(fileID, { acting: true, error: null });
    try {
      const updated = await fileReviewApi.ignoreFile(fileID);
      setFiles(prev => prev.map(f => f.FileID === fileID ? updated : f));
    } catch (err) {
      patchState(fileID, { error: err instanceof Error ? err.message : 'Action failed.' });
    } finally {
      patchState(fileID, { acting: false });
    }
  }

  async function handleUnignore(fileID: number) {
    patchState(fileID, { acting: true, error: null });
    try {
      const updated = await fileReviewApi.unignoreFile(fileID);
      setFiles(prev => prev.map(f => f.FileID === fileID ? updated : f));
      if (!includeIgnored) {
        setFiles(prev => prev.filter(f => f.FileID !== fileID));
        setTotal(t => t - 1);
      }
    } catch (err) {
      patchState(fileID, { error: err instanceof Error ? err.message : 'Action failed.' });
    } finally {
      patchState(fileID, { acting: false });
    }
  }

  async function handleRefreshParse(fileID: number) {
    patchState(fileID, { refreshing: true, error: null });
    try {
      const updated = await fileReviewApi.refreshParse(fileID);
      setFiles(prev => prev.map(f => f.FileID === fileID ? updated : f));
      patchState(fileID, { candidates: null }); // force candidate reload on next expand
    } catch (err) {
      patchState(fileID, { error: err instanceof Error ? err.message : 'Refresh failed.' });
    } finally {
      patchState(fileID, { refreshing: false });
    }
  }

  async function handleScanMatches(fileID: number) {
    patchState(fileID, { scanning: true, error: null });
    try {
      await fileReviewApi.scanMatches(fileID, scanOnline);
      const candidates = await fileReviewApi.getFileCandidates(fileID);
      patchState(fileID, { candidates, expanded: true });
    } catch (err) {
      patchState(fileID, { error: err instanceof Error ? err.message : 'Scan failed.' });
    } finally {
      patchState(fileID, { scanning: false });
    }
  }

  async function handleClearMatch(fileID: number) {
    patchState(fileID, { acting: true, error: null });
    try {
      const updated = await fileReviewApi.clearManualMatch(fileID);
      setFiles(prev => prev.map(f => f.FileID === fileID ? updated : f));
      patchState(fileID, { candidates: null });
    } catch (err) {
      patchState(fileID, { error: err instanceof Error ? err.message : 'Failed to clear match.' });
    } finally {
      patchState(fileID, { acting: false });
    }
  }

  async function handleApprove(candidateID: number, fileID: number) {
    patchState(fileID, { acting: true, error: null });
    try {
      const updated = await fileReviewApi.approveCandidate(candidateID);
      setFiles(prev => prev.map(f => f.FileID === fileID ? updated : f));
      const candidates = await fileReviewApi.getFileCandidates(fileID);
      patchState(fileID, { candidates });
    } catch (err) {
      patchState(fileID, { error: err instanceof Error ? err.message : 'Action failed.' });
    } finally {
      patchState(fileID, { acting: false });
    }
  }

  async function handleReject(candidateID: number, fileID: number) {
    patchState(fileID, { acting: true, error: null });
    try {
      await fileReviewApi.rejectCandidate(candidateID);
      const candidates = await fileReviewApi.getFileCandidates(fileID);
      patchState(fileID, { candidates });
    } catch (err) {
      patchState(fileID, { error: err instanceof Error ? err.message : 'Action failed.' });
    } finally {
      patchState(fileID, { acting: false });
    }
  }

  async function handleBatchScan() {
    setBatchScanning(true);
    setError(null);
    try {
      await fileReviewApi.scanAllMatches(includeIgnored, scanOnline);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Batch scan failed.');
    } finally {
      setBatchScanning(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">File Review</h1>
          <p className="text-xs text-gray-500 mt-0.5">{total} unmatched file{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={scanOnline}
              onChange={e => setScanOnline(e.target.checked)}
              className="rounded border-gray-600 bg-gray-900 accent-blue-500"
            />
            Online search
          </label>
          <button
            disabled={batchScanning}
            onClick={handleBatchScan}
            className="flex items-center gap-1.5 rounded-md bg-gray-800 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <Search size={12} />
            {batchScanning ? 'Scanning…' : 'Scan All'}
          </button>
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter */}
      <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer w-fit">
        <input
          type="checkbox"
          checked={includeIgnored}
          onChange={e => { setIncludeIgnored(e.target.checked); setPage(1); }}
          className="rounded border-gray-600 bg-gray-900 accent-blue-500"
        />
        Show ignored files
      </label>

      {error && (
        <div className="app-card rounded-md border-red-700/50 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {/* File list */}
      <div className="app-card rounded-md divide-y divide-gray-800/50">
        {loading && files.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          </div>
        ) : files.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-500">No unmatched files.</div>
        ) : (
          files.map(file => {
            const fs = getState(file.FileID);
            return (
              <FileRow
                key={file.FileID}
                file={file}
                state={fs}
                onToggle={() => toggleExpand(file.FileID)}
                onIgnore={() => handleIgnore(file.FileID)}
                onUnignore={() => handleUnignore(file.FileID)}
                onRefreshParse={() => handleRefreshParse(file.FileID)}
                onScan={() => handleScanMatches(file.FileID)}
                onClearMatch={() => handleClearMatch(file.FileID)}
                onApprove={id => handleApprove(id, file.FileID)}
                onReject={id => handleReject(id, file.FileID)}
              />
            );
          })
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
          <span className="text-xs text-gray-400">Page {page} of {totalPages}</span>
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

interface FileRowProps {
  file: MediaFileReviewItem;
  state: FileState;
  onToggle: () => void;
  onIgnore: () => void;
  onUnignore: () => void;
  onRefreshParse: () => void;
  onScan: () => void;
  onClearMatch: () => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
}

function FileRow({ file, state, onToggle, onIgnore, onUnignore, onRefreshParse, onScan, onClearMatch, onApprove, onReject }: FileRowProps) {
  const rev = file.Review;
  const fileName = file.PrimaryPath.split(/[/\\]/).pop() ?? file.PrimaryPath;
  const sizeMB = (file.FileSize / 1_048_576).toFixed(0);

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={onToggle}
          className="shrink-0 text-gray-500 hover:text-gray-300 transition-colors"
        >
          {state.expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-100" title={file.PrimaryPath}>
            {fileName}
          </p>
          <p className="truncate text-xs text-gray-500">{file.PrimaryPath}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-600">{sizeMB} MB</span>
          <StatusBadge status={rev.Status} />

          {rev.Status === 'ManualMatch' && (
            <ActionBtn disabled={state.acting} onClick={onClearMatch} title="Clear match">
              <RotateCcw size={13} />
            </ActionBtn>
          )}

          {rev.Status === 'Ignored' ? (
            <ActionBtn disabled={state.acting} onClick={onUnignore} title="Unignore">
              <Eye size={13} />
            </ActionBtn>
          ) : (
            <ActionBtn disabled={state.acting} onClick={onIgnore} title="Ignore">
              <EyeOff size={13} />
            </ActionBtn>
          )}

          <button
            disabled={state.scanning || state.acting}
            onClick={onScan}
            title="Scan for matches"
            className="flex items-center gap-1 rounded px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors disabled:opacity-40"
          >
            <Search size={12} />
            {state.scanning ? 'Scanning…' : 'Scan'}
          </button>
        </div>
      </div>

      {/* Expanded body */}
      {state.expanded && (
        <div className="border-t border-gray-800/50 bg-gray-900/30 px-5 py-4 space-y-4">
          {state.error && (
            <p className="text-xs text-red-400">{state.error}</p>
          )}

          {/* Parsed info */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 sm:grid-cols-3 text-xs">
            <InfoCell label="Kind" value={rev.ParsedKind} />
            {rev.ParsedTitle && <InfoCell label="Title" value={rev.ParsedTitle} />}
            {rev.ParsedShowTitle && <InfoCell label="Show" value={rev.ParsedShowTitle} />}
            {rev.ParsedYear != null && <InfoCell label="Year" value={String(rev.ParsedYear)} />}
            {rev.ParsedSeasonNumber != null && <InfoCell label="Season" value={String(rev.ParsedSeasonNumber)} />}
            {rev.ParsedEpisodeNumbers.length > 0 && (
              <InfoCell label="Episode(s)" value={rev.ParsedEpisodeNumbers.join(', ')} />
            )}
            {rev.ParsedQuality && <InfoCell label="Quality" value={rev.ParsedQuality} />}
            {rev.ParsedSource && <InfoCell label="Source" value={rev.ParsedSource} />}
            {rev.ParsedEdition && <InfoCell label="Edition" value={rev.ParsedEdition} />}
            {rev.ParsedVideoCodec && <InfoCell label="Video" value={rev.ParsedVideoCodec} />}
            {rev.ParsedAudioCodec && (
              <InfoCell label="Audio" value={rev.ParsedAudioCodec + (rev.ParsedAudioChannels ? ` ${rev.ParsedAudioChannels}` : '')} />
            )}
            {rev.ParsedHdrFormats.length > 0 && (
              <InfoCell label="HDR" value={rev.ParsedHdrFormats.join(', ')} />
            )}
            {rev.ParsedExternalIds.length > 0 && (
              <InfoCell label="IDs" value={rev.ParsedExternalIds.map(id => `${id.Source}:${id.Id}`).join(', ')} />
            )}
            {rev.ManualTitle && (
              <InfoCell label="Matched" value={`${rev.ManualProvider}:${rev.ManualProviderID} — ${rev.ManualTitle}`} />
            )}
          </div>

          {rev.ParsedWarnings.length > 0 && (
            <div className="space-y-0.5">
              {rev.ParsedWarnings.map((w, i) => (
                <p key={i} className="text-xs text-yellow-400">⚠ {w}</p>
              ))}
            </div>
          )}

          {/* Refresh parse */}
          <div>
            <button
              disabled={state.refreshing}
              onClick={onRefreshParse}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors disabled:opacity-40"
            >
              <RefreshCw size={11} className={state.refreshing ? 'animate-spin' : ''} />
              {state.refreshing ? 'Refreshing…' : 'Refresh parse'}
            </button>
          </div>

          {/* Candidates */}
          {state.loadingCandidates ? (
            <p className="text-xs text-gray-500">Loading candidates…</p>
          ) : state.candidates !== null && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Candidates ({state.candidates.length})
              </p>
              {state.candidates.length === 0 ? (
                <p className="text-xs text-gray-600">No candidates yet. Use Scan to search.</p>
              ) : (
                state.candidates.map(c => (
                  <CandidateRow
                    key={c.MediaFileMatchCandidateID}
                    candidate={c}
                    disabled={state.acting}
                    onApprove={() => onApprove(c.MediaFileMatchCandidateID)}
                    onReject={() => onReject(c.MediaFileMatchCandidateID)}
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CandidateRow({
  candidate,
  disabled,
  onApprove,
  onReject,
}: {
  candidate: MediaFileMatchCandidate;
  disabled: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const pct = Math.round(candidate.ConfidenceScore * 100);
  const barColor =
    pct >= 85 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="flex items-start gap-3 rounded-md border border-gray-700/50 bg-gray-900/50 px-3 py-2.5">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-100">{candidate.Title}</span>
          {candidate.Year && <span className="text-xs text-gray-500">{candidate.Year}</span>}
          <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-gray-700/50 text-gray-400">
            {candidate.Provider} · {candidate.ProviderType}
          </span>
          {candidate.Status !== 'Pending' && (
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
              candidate.Status === 'Approved' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'
            }`}>
              {candidate.Status}
            </span>
          )}
        </div>

        {/* Confidence bar */}
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-24 rounded-full bg-gray-800 overflow-hidden">
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-gray-500">{pct}%</span>
        </div>

        {candidate.Reasons.length > 0 && (
          <p className="text-xs text-gray-600">{candidate.Reasons.join(' · ')}</p>
        )}
      </div>

      {candidate.Status === 'Pending' && (
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            disabled={disabled}
            onClick={onApprove}
            title="Approve"
            className="text-green-500 hover:text-green-400 transition-colors disabled:opacity-40"
          >
            <CheckCircle2 size={18} />
          </button>
          <button
            disabled={disabled}
            onClick={onReject}
            title="Reject"
            className="text-red-500 hover:text-red-400 transition-colors disabled:opacity-40"
          >
            <XCircle size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'ManualMatch'
      ? 'bg-green-600/20 text-green-400'
      : status === 'Ignored'
      ? 'bg-gray-700/50 text-gray-500'
      : 'bg-yellow-600/20 text-yellow-400';
  const label = status === 'ManualMatch' ? 'Matched' : status;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

function ActionBtn({ disabled, onClick, title, children }: {
  disabled: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      title={title}
      className="text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-gray-500">{label}: </span>
      <span className="text-gray-300">{value}</span>
    </div>
  );
}
