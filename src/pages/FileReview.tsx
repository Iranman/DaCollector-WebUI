import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  FileWarning,
  FolderOpen,
  HardDrive,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  fileReviewApi,
  MediaFileMatchCandidate,
  MediaFileReviewItem,
} from '../api/fileReview';
import {
  duplicatesApi,
  ExactDuplicateCleanupPlan,
  ExactDuplicateFilters,
  ExactDuplicateLocation,
  ExactDuplicateSummary,
} from '../api/duplicates';
import {
  DaCollectorEpisode,
  DaCollectorSeriesSummary,
  MissingFilters,
  releaseManagementApi,
} from '../api/releaseManagement';
import {
  IntegrityCheck,
  IntegrityCheckFile,
  IntegrityFileFilter,
  IntegrityFileStatus,
  integrityApi,
} from '../api/integrity';
import { mediaApi, MediaFileDto } from '../api/media';
import {
  relocationApi,
  RelocationPipe,
  RelocationResult,
  RelocationSummary,
} from '../api/relocation';
import { managedFoldersApi, ManagedFolder } from '../api/managedFolders';
import { ApiError } from '../api/client';
import { useConfirm } from '../components/ui/ConfirmProvider';
import { useToast } from '../components/ui/ToastProvider';

type ReviewTab = 'unmatched' | 'duplicates' | 'missing' | 'integrity' | 'relocation';
type ReviewStatusFilter = 'all' | 'Pending' | 'Ignored' | 'ManualMatch';
type ProviderFilter = 'all' | 'tmdb' | 'tvdb';
type DuplicateMode = 'exact' | 'series' | 'episodes';
type MissingMode = 'series' | 'episodes';

const UNMATCHED_PAGE_SIZE = 50;
const DUPLICATE_PAGE_SIZE = 25;
const REVIEW_PAGE_SIZE = 50;
const RELOCATION_PAGE_SIZE = 25;

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
  return {
    expanded: false,
    candidates: null,
    loadingCandidates: false,
    scanning: false,
    refreshing: false,
    acting: false,
    error: null,
  };
}

export default function FileReview() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const confirm = useConfirm();
  const { notify } = useToast();
  const [activeTab, setActiveTab] = useState<ReviewTab>('unmatched');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (isReviewTab(tab) && tab !== activeTab) {
      setActiveTab(tab);
    }
    if (searchParams.get('ignored') === 'true') {
      setIncludeIgnored(true);
    }
  }, [activeTab, searchParams]);

  function selectTab(tab: ReviewTab) {
    setActiveTab(tab);
    setSearchParams(tab === 'unmatched' ? {} : { tab });
  }

  const [files, setFiles] = useState<MediaFileReviewItem[]>([]);
  const [unmatchedTotal, setUnmatchedTotal] = useState(0);
  const [unmatchedPage, setUnmatchedPage] = useState(1);
  const [includeIgnored, setIncludeIgnored] = useState(false);
  const [scanOnline, setScanOnline] = useState(false);
  const [reviewStatusFilter, setReviewStatusFilter] = useState<ReviewStatusFilter>('all');
  const [candidateProviderFilter, setCandidateProviderFilter] = useState<ProviderFilter>('all');
  const [loadingUnmatched, setLoadingUnmatched] = useState(false);
  const [batchScanning, setBatchScanning] = useState(false);
  const [fileStates, setFileStates] = useState<Record<number, FileState>>({});

  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>('exact');
  const [duplicateSummary, setDuplicateSummary] = useState<ExactDuplicateSummary | null>(null);
  const [duplicatePlans, setDuplicatePlans] = useState<ExactDuplicateCleanupPlan[]>([]);
  const [duplicatePlanTotal, setDuplicatePlanTotal] = useState(0);
  const [duplicatePlanPage, setDuplicatePlanPage] = useState(1);
  const [duplicateSeries, setDuplicateSeries] = useState<DaCollectorSeriesSummary[]>([]);
  const [duplicateSeriesTotal, setDuplicateSeriesTotal] = useState(0);
  const [duplicateSeriesPage, setDuplicateSeriesPage] = useState(1);
  const [duplicateEpisodes, setDuplicateEpisodes] = useState<DaCollectorEpisode[]>([]);
  const [duplicateEpisodeTotal, setDuplicateEpisodeTotal] = useState(0);
  const [duplicateEpisodePage, setDuplicateEpisodePage] = useState(1);
  const [duplicateIncludeIgnored, setDuplicateIncludeIgnored] = useState(false);
  const [duplicateOnlyAvailable, setDuplicateOnlyAvailable] = useState(false);
  const [duplicatePreferredPath, setDuplicatePreferredPath] = useState('');
  const [deletePhysicalFile, setDeletePhysicalFile] = useState(true);
  const [deleteEmptyFolders, setDeleteEmptyFolders] = useState(true);
  const [loadingDuplicates, setLoadingDuplicates] = useState(false);
  const [deletingLocationID, setDeletingLocationID] = useState<number | null>(null);

  const [missingMode, setMissingMode] = useState<MissingMode>('series');
  const [missingSeries, setMissingSeries] = useState<DaCollectorSeriesSummary[]>([]);
  const [missingSeriesTotal, setMissingSeriesTotal] = useState(0);
  const [missingSeriesPage, setMissingSeriesPage] = useState(1);
  const [missingEpisodes, setMissingEpisodes] = useState<DaCollectorEpisode[]>([]);
  const [missingEpisodeTotal, setMissingEpisodeTotal] = useState(0);
  const [missingEpisodePage, setMissingEpisodePage] = useState(1);
  const [missingCollecting, setMissingCollecting] = useState(false);
  const [missingFinishedOnly, setMissingFinishedOnly] = useState(false);
  const [loadingMissing, setLoadingMissing] = useState(false);

  const [folders, setFolders] = useState<ManagedFolder[]>([]);
  const [selectedFolderIDs, setSelectedFolderIDs] = useState<number[]>([]);
  const [checkHash, setCheckHash] = useState(false);
  const [integrityScans, setIntegrityScans] = useState<IntegrityCheck[]>([]);
  const [selectedScanID, setSelectedScanID] = useState<number | null>(null);
  const [integrityFiles, setIntegrityFiles] = useState<IntegrityCheckFile[]>([]);
  const [integrityFileFilter, setIntegrityFileFilter] = useState<IntegrityFileFilter>('errors');
  const [loadingIntegrity, setLoadingIntegrity] = useState(false);
  const [runningIntegrity, setRunningIntegrity] = useState(false);
  const [deletingScanID, setDeletingScanID] = useState<number | null>(null);

  const [relocationSummary, setRelocationSummary] = useState<RelocationSummary | null>(null);
  const [relocationPipes, setRelocationPipes] = useState<RelocationPipe[]>([]);
  const [relocationFiles, setRelocationFiles] = useState<MediaFileDto[]>([]);
  const [relocationTotal, setRelocationTotal] = useState(0);
  const [relocationPage, setRelocationPage] = useState(1);
  const [relocationSearch, setRelocationSearch] = useState('');
  const [selectedRelocationFileIDs, setSelectedRelocationFileIDs] = useState<number[]>([]);
  const [selectedRelocationPipeID, setSelectedRelocationPipeID] = useState('default');
  const [relocationMove, setRelocationMove] = useState(true);
  const [relocationRename, setRelocationRename] = useState(true);
  const [relocationAllowInsideDestination, setRelocationAllowInsideDestination] = useState(false);
  const [relocationDeleteEmptyDirectories, setRelocationDeleteEmptyDirectories] = useState(true);
  const [relocationPreviewResults, setRelocationPreviewResults] = useState<RelocationResult[] | null>(null);
  const [relocationApplyResults, setRelocationApplyResults] = useState<RelocationResult[] | null>(null);
  const [loadingRelocation, setLoadingRelocation] = useState(false);
  const [previewingRelocation, setPreviewingRelocation] = useState(false);
  const [applyingRelocation, setApplyingRelocation] = useState(false);

  const handleError = useCallback((err: unknown, fallback: string) => {
    if (err instanceof ApiError && err.status === 401) navigate('/login');
    else setError(err instanceof Error ? err.message : fallback);
  }, [navigate]);

  const loadUnmatched = useCallback(async () => {
    setLoadingUnmatched(true);
    setError(null);
    try {
      const result = await fileReviewApi.getUnmatched(unmatchedPage, UNMATCHED_PAGE_SIZE, includeIgnored);
      setFiles(result.List);
      setUnmatchedTotal(result.Total);
    } catch (err) {
      handleError(err, 'Failed to load files.');
    } finally {
      setLoadingUnmatched(false);
    }
  }, [handleError, includeIgnored, unmatchedPage]);

  const duplicateFilters = useMemo<ExactDuplicateFilters>(() => ({
    includeIgnored: duplicateIncludeIgnored,
    onlyAvailable: duplicateOnlyAvailable,
    preferredPathContains: duplicatePreferredPath,
  }), [duplicateIncludeIgnored, duplicateOnlyAvailable, duplicatePreferredPath]);

  const loadDuplicates = useCallback(async () => {
    setLoadingDuplicates(true);
    setError(null);
    try {
      if (duplicateMode === 'exact') {
        const [summary, plans] = await Promise.all([
          duplicatesApi.getExactSummary(duplicateFilters),
          duplicatesApi.getExactCleanupPlans(duplicateFilters, duplicatePlanPage, DUPLICATE_PAGE_SIZE),
        ]);
        setDuplicateSummary(summary);
        setDuplicatePlans(plans.List);
        setDuplicatePlanTotal(plans.Total);
      } else if (duplicateMode === 'series') {
        const result = await releaseManagementApi.getDuplicateSeries(duplicateSeriesPage, REVIEW_PAGE_SIZE);
        setDuplicateSeries(result.List);
        setDuplicateSeriesTotal(result.Total);
      } else {
        const result = await releaseManagementApi.getDuplicateEpisodes(duplicateEpisodePage, DUPLICATE_PAGE_SIZE);
        setDuplicateEpisodes(result.List);
        setDuplicateEpisodeTotal(result.Total);
      }
    } catch (err) {
      handleError(err, 'Failed to load duplicate review data.');
    } finally {
      setLoadingDuplicates(false);
    }
  }, [duplicateEpisodePage, duplicateFilters, duplicateMode, duplicatePlanPage, duplicateSeriesPage, handleError]);

  const missingFilters = useMemo<MissingFilters>(() => ({
    collecting: missingCollecting,
    onlyFinishedSeries: missingFinishedOnly,
  }), [missingCollecting, missingFinishedOnly]);

  const loadMissing = useCallback(async () => {
    setLoadingMissing(true);
    setError(null);
    try {
      if (missingMode === 'series') {
        const result = await releaseManagementApi.getMissingSeries(missingFilters, missingSeriesPage, REVIEW_PAGE_SIZE);
        setMissingSeries(result.List);
        setMissingSeriesTotal(result.Total);
      } else {
        const result = await releaseManagementApi.getMissingEpisodes(missingFilters, missingEpisodePage, REVIEW_PAGE_SIZE);
        setMissingEpisodes(result.List);
        setMissingEpisodeTotal(result.Total);
      }
    } catch (err) {
      handleError(err, 'Failed to load missing episode review data.');
    } finally {
      setLoadingMissing(false);
    }
  }, [handleError, missingEpisodePage, missingFilters, missingMode, missingSeriesPage]);

  const loadIntegrityFiles = useCallback(async (scanID: number, filter: IntegrityFileFilter) => {
    try {
      const status = isConcreteIntegrityStatus(filter) ? filter : undefined;
      const result = await integrityApi.getScanFiles(scanID, status);
      setIntegrityFiles(result);
    } catch (err) {
      handleError(err, 'Failed to load integrity scan files.');
    }
  }, [handleError]);

  const loadIntegrity = useCallback(async () => {
    setLoadingIntegrity(true);
    setError(null);
    try {
      const [scanResult, folderResult] = await Promise.all([
        integrityApi.listScans(),
        managedFoldersApi.list(),
      ]);
      const sorted = [...scanResult].sort((a, b) => new Date(b.CreatedAt).getTime() - new Date(a.CreatedAt).getTime());
      setIntegrityScans(sorted);
      setFolders(folderResult);
      setSelectedFolderIDs(current => current.length > 0 ? current : folderResult.map(folder => folder.ID));
      const selectedStillExists = selectedScanID != null && sorted.some(scan => scan.ID === selectedScanID);
      const nextSelected = selectedStillExists ? selectedScanID : sorted[0]?.ID ?? null;
      setSelectedScanID(nextSelected);
      if (nextSelected != null) await loadIntegrityFiles(nextSelected, integrityFileFilter);
      else setIntegrityFiles([]);
    } catch (err) {
      handleError(err, 'Failed to load integrity checks.');
    } finally {
      setLoadingIntegrity(false);
    }
  }, [handleError, integrityFileFilter, loadIntegrityFiles, selectedScanID]);

  const relocationRunOptions = useMemo(() => ({
    pipeID: selectedRelocationPipeID === 'default' ? undefined : selectedRelocationPipeID,
    move: relocationMove,
    rename: relocationRename,
    allowRelocationInsideDestination: relocationAllowInsideDestination,
    deleteEmptyDirectories: relocationDeleteEmptyDirectories,
  }), [
    relocationAllowInsideDestination,
    relocationDeleteEmptyDirectories,
    relocationMove,
    relocationRename,
    selectedRelocationPipeID,
  ]);

  const loadRelocation = useCallback(async () => {
    setLoadingRelocation(true);
    setError(null);
    try {
      const [summary, pipes, fileResult] = await Promise.all([
        relocationApi.getSummary(),
        relocationApi.getPipes(),
        mediaApi.getFiles(relocationSearch.trim() || undefined, relocationPage, RELOCATION_PAGE_SIZE, true, false),
      ]);
      setRelocationSummary(summary);
      setRelocationPipes(pipes);
      setRelocationFiles(fileResult.List);
      setRelocationTotal(fileResult.Total);
      setSelectedRelocationFileIDs(current => {
        const retained = current.filter(fileID => fileResult.List.some(file => file.FileID === fileID));
        return retained.length === current.length ? current : retained;
      });
      if (selectedRelocationPipeID !== 'default' && !pipes.some(pipe => pipe.ID === selectedRelocationPipeID)) {
        setSelectedRelocationPipeID('default');
      }
    } catch (err) {
      handleError(err, 'Failed to load relocation review data.');
    } finally {
      setLoadingRelocation(false);
    }
  }, [handleError, relocationPage, relocationSearch, selectedRelocationPipeID]);

  useEffect(() => {
    if (activeTab === 'unmatched') void loadUnmatched();
  }, [activeTab, loadUnmatched]);

  useEffect(() => {
    if (activeTab === 'duplicates') void loadDuplicates();
  }, [activeTab, loadDuplicates]);

  useEffect(() => {
    if (activeTab === 'missing') void loadMissing();
  }, [activeTab, loadMissing]);

  useEffect(() => {
    if (activeTab === 'integrity') void loadIntegrity();
  }, [activeTab, loadIntegrity]);

  useEffect(() => {
    if (activeTab === 'relocation') void loadRelocation();
  }, [activeTab, loadRelocation]);

  useEffect(() => {
    setUnmatchedPage(1);
  }, [includeIgnored, reviewStatusFilter]);

  useEffect(() => {
    setDuplicatePlanPage(1);
  }, [duplicateFilters]);

  useEffect(() => {
    setMissingSeriesPage(1);
    setMissingEpisodePage(1);
  }, [missingFilters]);

  useEffect(() => {
    setRelocationPage(1);
  }, [relocationSearch]);

  useEffect(() => {
    setRelocationPreviewResults(null);
    setRelocationApplyResults(null);
  }, [relocationRunOptions, selectedRelocationFileIDs]);

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
    const state = getState(fileID);
    const expanded = !state.expanded;
    patchState(fileID, { expanded });
    if (expanded && state.candidates === null) {
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
      setFiles(prev => prev.map(file => file.FileID === fileID ? updated : file));
      setNotice('File marked ignored.');
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
      setFiles(prev => prev.map(file => file.FileID === fileID ? updated : file));
      if (!includeIgnored) {
        setFiles(prev => prev.filter(file => file.FileID !== fileID));
        setUnmatchedTotal(total => Math.max(0, total - 1));
      }
      setNotice('File restored to review queue.');
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
      setFiles(prev => prev.map(file => file.FileID === fileID ? updated : file));
      patchState(fileID, { candidates: null });
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
      setFiles(prev => prev.map(file => file.FileID === fileID ? updated : file));
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
      setFiles(prev => prev.map(file => file.FileID === fileID ? updated : file));
      const candidates = await fileReviewApi.getFileCandidates(fileID);
      patchState(fileID, { candidates });
      setNotice('Candidate approved.');
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
      setNotice('Candidate rejected.');
    } catch (err) {
      patchState(fileID, { error: err instanceof Error ? err.message : 'Action failed.' });
    } finally {
      patchState(fileID, { acting: false });
    }
  }

  async function handleBatchScan() {
    const prompt = scanOnline
      ? 'Scan unmatched files and allow online provider lookup? This may contact provider APIs.'
      : 'Scan unmatched files against cached provider records?';
    if (!await confirm({ message: prompt, title: 'Scan Unmatched Files', tone: scanOnline ? 'warning' : 'default' })) return;

    setBatchScanning(true);
    setError(null);
    try {
      const result = await fileReviewApi.scanAllMatches(includeIgnored, scanOnline);
      setNotice(`Scanned ${result.ScannedFileCount} files and found ${result.CandidateCount} candidates.`);
      notify({ message: `Scanned ${result.ScannedFileCount} files and found ${result.CandidateCount} candidates.`, tone: 'success' });
      await loadUnmatched();
    } catch (err) {
      handleError(err, 'Batch scan failed.');
    } finally {
      setBatchScanning(false);
    }
  }

  async function handleDeleteDuplicateLocation(location: ExactDuplicateLocation) {
    setDeletingLocationID(location.LocationID);
    setError(null);
    setNotice(null);
    try {
      const preview = await duplicatesApi.previewDeleteLocation(
        location.LocationID,
        duplicateFilters,
        deletePhysicalFile,
        deleteEmptyFolders
      );
      const message = [
        preview.Message,
        `Location: ${location.RelativePath}`,
        `Potential reclaim: ${formatBytes(preview.PotentialReclaimBytes)}`,
        deletePhysicalFile ? 'Physical file deletion is enabled.' : 'Only the duplicate location record will be deleted.',
        'Continue?',
      ].join('\n');
      if (!await confirm({
        confirmLabel: deletePhysicalFile ? 'Delete' : 'Remove Record',
        message,
        title: 'Delete Duplicate Location',
        tone: deletePhysicalFile ? 'danger' : 'warning',
      })) return;

      const result = await duplicatesApi.deleteLocation(
        location.LocationID,
        duplicateFilters,
        deletePhysicalFile,
        deleteEmptyFolders
      );
      setNotice(result.Message || 'Duplicate remove candidate deleted.');
      notify({ message: result.Message || 'Duplicate remove candidate deleted.', tone: 'success' });
      await loadDuplicates();
    } catch (err) {
      handleError(err, 'Duplicate delete failed.');
    } finally {
      setDeletingLocationID(null);
    }
  }

  async function handleRunIntegrityScan() {
    if (selectedFolderIDs.length === 0) {
      setError('Select at least one managed folder.');
      return;
    }
    const folderList = selectedFolderIDs
      .map(id => folders.find(folder => folder.ID === id)?.Name ?? `Folder ${id}`)
      .join(', ');
    const prompt = `Start an integrity scan for ${selectedFolderIDs.length} folder(s): ${folderList}?`;
    if (!await confirm({ confirmLabel: 'Start Scan', message: prompt, title: 'Start Integrity Scan' })) return;

    setRunningIntegrity(true);
    setError(null);
    setNotice(null);
    try {
      const scan = await integrityApi.createScan(selectedFolderIDs);
      await integrityApi.startScan(scan.ID, checkHash);
      setNotice(`Integrity scan ${scan.ID} started.`);
      notify({ message: `Integrity scan ${scan.ID} started.`, tone: 'success' });
      setSelectedScanID(scan.ID);
      await loadIntegrity();
    } catch (err) {
      handleError(err, 'Failed to start integrity scan.');
    } finally {
      setRunningIntegrity(false);
    }
  }

  async function handleStartExistingScan(scanID: number) {
    if (!await confirm({ confirmLabel: 'Start Scan', message: `Start integrity scan ${scanID}?`, title: 'Start Integrity Scan' })) return;
    setRunningIntegrity(true);
    setError(null);
    try {
      await integrityApi.startScan(scanID, checkHash);
      setNotice(`Integrity scan ${scanID} started.`);
      notify({ message: `Integrity scan ${scanID} started.`, tone: 'success' });
      await loadIntegrity();
    } catch (err) {
      handleError(err, 'Failed to start integrity scan.');
    } finally {
      setRunningIntegrity(false);
    }
  }

  async function handleDeleteIntegrityScan(scanID: number) {
    if (!await confirm({
      confirmLabel: 'Delete Scan',
      message: `Delete integrity scan ${scanID} and its file results?`,
      title: 'Delete Integrity Scan',
      tone: 'danger',
    })) return;
    setDeletingScanID(scanID);
    setError(null);
    try {
      await integrityApi.deleteScan(scanID);
      setNotice(`Integrity scan ${scanID} deleted.`);
      notify({ message: `Integrity scan ${scanID} deleted.`, tone: 'success' });
      if (selectedScanID === scanID) setSelectedScanID(null);
      await loadIntegrity();
    } catch (err) {
      handleError(err, 'Failed to delete integrity scan.');
    } finally {
      setDeletingScanID(null);
    }
  }

  async function handleSelectIntegrityScan(scanID: number) {
    setSelectedScanID(scanID);
    await loadIntegrityFiles(scanID, integrityFileFilter);
  }

  async function handleIntegrityFilter(filter: IntegrityFileFilter) {
    setIntegrityFileFilter(filter);
    if (selectedScanID != null) await loadIntegrityFiles(selectedScanID, filter);
  }

  function toggleRelocationFile(fileID: number) {
    setSelectedRelocationFileIDs(current =>
      current.includes(fileID)
        ? current.filter(id => id !== fileID)
        : [...current, fileID]
    );
  }

  function toggleRelocationPageSelection() {
    const pageIDs = relocationFiles.map(file => file.FileID);
    const allSelected = pageIDs.length > 0 && pageIDs.every(fileID => selectedRelocationFileIDs.includes(fileID));
    setSelectedRelocationFileIDs(current =>
      allSelected
        ? current.filter(fileID => !pageIDs.includes(fileID))
        : [...current, ...pageIDs.filter(fileID => !current.includes(fileID))]
    );
  }

  async function handlePreviewRelocation() {
    if (selectedRelocationFileIDs.length === 0) {
      setError('Select at least one file to preview.');
      return;
    }

    setPreviewingRelocation(true);
    setError(null);
    setNotice(null);
    setRelocationApplyResults(null);
    try {
      const results = await relocationApi.preview(selectedRelocationFileIDs, relocationRunOptions);
      const successCount = results.filter(result => result.IsSuccess).length;
      const moveCount = results.filter(result => result.IsSuccess && result.IsRelocated).length;
      setRelocationPreviewResults(results);
      setNotice(`Previewed ${results.length} file(s): ${moveCount} relocation change(s), ${successCount} successful result(s).`);
    } catch (err) {
      handleError(err, 'Relocation preview failed.');
    } finally {
      setPreviewingRelocation(false);
    }
  }

  async function handleApplyRelocation() {
    if (!relocationPreviewResults || relocationPreviewResults.length === 0) {
      setError('Preview relocation before applying changes.');
      return;
    }

    const successCount = relocationPreviewResults.filter(result => result.IsSuccess).length;
    const changeCount = relocationPreviewResults.filter(result => result.IsSuccess && result.IsRelocated).length;
    const failureCount = relocationPreviewResults.length - successCount;
    const prompt = [
      `Apply server-side relocation to ${selectedRelocationFileIDs.length} selected file(s)?`,
      `Preview showed ${changeCount} rename/move change(s) and ${failureCount} warning/error result(s).`,
      relocationDeleteEmptyDirectories ? 'Empty source directories may be deleted by the server when applicable.' : 'Empty source directories will be left in place.',
      'Continue?',
    ].join('\n');
    if (!await confirm({
      confirmLabel: 'Apply Relocation',
      message: prompt,
      title: 'Apply Relocation',
      tone: relocationDeleteEmptyDirectories ? 'warning' : 'default',
    })) return;

    setApplyingRelocation(true);
    setError(null);
    setNotice(null);
    try {
      const results = await relocationApi.relocate(selectedRelocationFileIDs, relocationRunOptions);
      const appliedCount = results.filter(result => result.IsSuccess && result.IsRelocated).length;
      const appliedFailures = results.filter(result => !result.IsSuccess).length;
      setRelocationApplyResults(results);
      setNotice(`Relocation applied: ${appliedCount} changed, ${appliedFailures} failed or warned.`);
      notify({ message: `Relocation applied: ${appliedCount} changed, ${appliedFailures} failed or warned.`, tone: appliedFailures > 0 ? 'warning' : 'success' });
      await loadRelocation();
    } catch (err) {
      handleError(err, 'Relocation apply failed.');
    } finally {
      setApplyingRelocation(false);
    }
  }

  function refreshActiveTab() {
    if (activeTab === 'unmatched') void loadUnmatched();
    else if (activeTab === 'duplicates') void loadDuplicates();
    else if (activeTab === 'missing') void loadMissing();
    else if (activeTab === 'integrity') void loadIntegrity();
    else void loadRelocation();
  }

  const visibleFiles = useMemo(() => files.filter(file =>
    reviewStatusFilter === 'all' || file.Review.Status === reviewStatusFilter
  ), [files, reviewStatusFilter]);

  const selectedScan = integrityScans.find(scan => scan.ID === selectedScanID) ?? null;
  const visibleIntegrityFiles = useMemo(() => {
    if (integrityFileFilter === 'all' || isConcreteIntegrityStatus(integrityFileFilter)) return integrityFiles;
    return integrityFiles.filter(file => isIntegrityError(file.Status));
  }, [integrityFileFilter, integrityFiles]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">File Review</h1>
          <p className="mt-0.5 text-xs text-gray-500">Review unmatched files, duplicates, missing episodes, integrity scans, and relocation previews.</p>
        </div>
        <button
          type="button"
          onClick={refreshActiveTab}
          className="flex items-center gap-1.5 text-xs text-gray-400 transition-colors hover:text-white"
        >
          <RefreshCw
            size={13}
            className={
              loadingUnmatched || loadingDuplicates || loadingMissing || loadingIntegrity || loadingRelocation ? 'animate-spin' : ''
            }
          />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-gray-700/50">
        <TabButton active={activeTab === 'unmatched'} onClick={() => selectTab('unmatched')} icon={<Search size={14} />}>
          Unmatched
        </TabButton>
        <TabButton active={activeTab === 'duplicates'} onClick={() => selectTab('duplicates')} icon={<Copy size={14} />}>
          Duplicates
        </TabButton>
        <TabButton active={activeTab === 'missing'} onClick={() => selectTab('missing')} icon={<FileWarning size={14} />}>
          Missing
        </TabButton>
        <TabButton active={activeTab === 'integrity'} onClick={() => selectTab('integrity')} icon={<ShieldCheck size={14} />}>
          Integrity
        </TabButton>
        <TabButton active={activeTab === 'relocation'} onClick={() => selectTab('relocation')} icon={<FolderOpen size={14} />}>
          Relocation
        </TabButton>
      </div>

      {notice && (
        <div className="app-card px-4 py-3 text-sm text-shoko-accent">{notice}</div>
      )}
      {error && (
        <div className="app-card rounded-md border-red-700/50 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {activeTab === 'unmatched' && (
        <UnmatchedPanel
          files={visibleFiles}
          total={unmatchedTotal}
          page={unmatchedPage}
          includeIgnored={includeIgnored}
          scanOnline={scanOnline}
          statusFilter={reviewStatusFilter}
          providerFilter={candidateProviderFilter}
          loading={loadingUnmatched}
          batchScanning={batchScanning}
          totalPages={Math.max(1, Math.ceil(unmatchedTotal / UNMATCHED_PAGE_SIZE))}
          getState={getState}
          setIncludeIgnored={setIncludeIgnored}
          setScanOnline={setScanOnline}
          setStatusFilter={setReviewStatusFilter}
          setProviderFilter={setCandidateProviderFilter}
          setPage={setUnmatchedPage}
          onBatchScan={handleBatchScan}
          onToggle={toggleExpand}
          onIgnore={handleIgnore}
          onUnignore={handleUnignore}
          onRefreshParse={handleRefreshParse}
          onScan={handleScanMatches}
          onClearMatch={handleClearMatch}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}

      {activeTab === 'duplicates' && (
        <DuplicatesPanel
          mode={duplicateMode}
          setMode={setDuplicateMode}
          summary={duplicateSummary}
          plans={duplicatePlans}
          planTotal={duplicatePlanTotal}
          planPage={duplicatePlanPage}
          planTotalPages={Math.max(1, Math.ceil(duplicatePlanTotal / DUPLICATE_PAGE_SIZE))}
          duplicateSeries={duplicateSeries}
          duplicateSeriesTotal={duplicateSeriesTotal}
          duplicateSeriesPage={duplicateSeriesPage}
          duplicateSeriesTotalPages={Math.max(1, Math.ceil(duplicateSeriesTotal / REVIEW_PAGE_SIZE))}
          duplicateEpisodes={duplicateEpisodes}
          duplicateEpisodeTotal={duplicateEpisodeTotal}
          duplicateEpisodePage={duplicateEpisodePage}
          duplicateEpisodeTotalPages={Math.max(1, Math.ceil(duplicateEpisodeTotal / DUPLICATE_PAGE_SIZE))}
          includeIgnored={duplicateIncludeIgnored}
          onlyAvailable={duplicateOnlyAvailable}
          preferredPath={duplicatePreferredPath}
          deletePhysicalFile={deletePhysicalFile}
          deleteEmptyFolders={deleteEmptyFolders}
          loading={loadingDuplicates}
          deletingLocationID={deletingLocationID}
          setIncludeIgnored={setDuplicateIncludeIgnored}
          setOnlyAvailable={setDuplicateOnlyAvailable}
          setPreferredPath={setDuplicatePreferredPath}
          setDeletePhysicalFile={setDeletePhysicalFile}
          setDeleteEmptyFolders={setDeleteEmptyFolders}
          setPlanPage={setDuplicatePlanPage}
          setDuplicateSeriesPage={setDuplicateSeriesPage}
          setDuplicateEpisodePage={setDuplicateEpisodePage}
          onDeleteLocation={handleDeleteDuplicateLocation}
        />
      )}

      {activeTab === 'missing' && (
        <MissingPanel
          mode={missingMode}
          setMode={setMissingMode}
          collecting={missingCollecting}
          finishedOnly={missingFinishedOnly}
          setCollecting={setMissingCollecting}
          setFinishedOnly={setMissingFinishedOnly}
          loading={loadingMissing}
          series={missingSeries}
          seriesTotal={missingSeriesTotal}
          seriesPage={missingSeriesPage}
          seriesTotalPages={Math.max(1, Math.ceil(missingSeriesTotal / REVIEW_PAGE_SIZE))}
          episodes={missingEpisodes}
          episodeTotal={missingEpisodeTotal}
          episodePage={missingEpisodePage}
          episodeTotalPages={Math.max(1, Math.ceil(missingEpisodeTotal / REVIEW_PAGE_SIZE))}
          setSeriesPage={setMissingSeriesPage}
          setEpisodePage={setMissingEpisodePage}
        />
      )}

      {activeTab === 'integrity' && (
        <IntegrityPanel
          folders={folders}
          selectedFolderIDs={selectedFolderIDs}
          checkHash={checkHash}
          scans={integrityScans}
          selectedScan={selectedScan}
          files={visibleIntegrityFiles}
          fileFilter={integrityFileFilter}
          loading={loadingIntegrity}
          running={runningIntegrity}
          deletingScanID={deletingScanID}
          setSelectedFolderIDs={setSelectedFolderIDs}
          setCheckHash={setCheckHash}
          onRunScan={handleRunIntegrityScan}
          onSelectScan={handleSelectIntegrityScan}
          onStartScan={handleStartExistingScan}
          onDeleteScan={handleDeleteIntegrityScan}
          onFileFilter={handleIntegrityFilter}
        />
      )}

      {activeTab === 'relocation' && (
        <RelocationPanel
          summary={relocationSummary}
          pipes={relocationPipes}
          files={relocationFiles}
          total={relocationTotal}
          page={relocationPage}
          totalPages={Math.max(1, Math.ceil(relocationTotal / RELOCATION_PAGE_SIZE))}
          search={relocationSearch}
          selectedFileIDs={selectedRelocationFileIDs}
          selectedPipeID={selectedRelocationPipeID}
          move={relocationMove}
          rename={relocationRename}
          allowInsideDestination={relocationAllowInsideDestination}
          deleteEmptyDirectories={relocationDeleteEmptyDirectories}
          previewResults={relocationPreviewResults}
          applyResults={relocationApplyResults}
          loading={loadingRelocation}
          previewing={previewingRelocation}
          applying={applyingRelocation}
          setPage={setRelocationPage}
          setSearch={setRelocationSearch}
          setSelectedPipeID={setSelectedRelocationPipeID}
          setMove={setRelocationMove}
          setRename={setRelocationRename}
          setAllowInsideDestination={setRelocationAllowInsideDestination}
          setDeleteEmptyDirectories={setRelocationDeleteEmptyDirectories}
          onToggleFile={toggleRelocationFile}
          onTogglePage={toggleRelocationPageSelection}
          onPreview={handlePreviewRelocation}
          onApply={handleApplyRelocation}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? 'border-shoko-accent text-gray-100'
          : 'border-transparent text-gray-400 hover:text-gray-200'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function SegmentButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'border-shoko-accent/70 bg-shoko-accent/15 text-gray-100'
          : 'border-gray-700 bg-gray-900/50 text-gray-400 hover:text-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

function UnmatchedPanel({
  files,
  total,
  page,
  includeIgnored,
  scanOnline,
  statusFilter,
  providerFilter,
  loading,
  batchScanning,
  totalPages,
  getState,
  setIncludeIgnored,
  setScanOnline,
  setStatusFilter,
  setProviderFilter,
  setPage,
  onBatchScan,
  onToggle,
  onIgnore,
  onUnignore,
  onRefreshParse,
  onScan,
  onClearMatch,
  onApprove,
  onReject,
}: {
  files: MediaFileReviewItem[];
  total: number;
  page: number;
  includeIgnored: boolean;
  scanOnline: boolean;
  statusFilter: ReviewStatusFilter;
  providerFilter: ProviderFilter;
  loading: boolean;
  batchScanning: boolean;
  totalPages: number;
  getState: (fileID: number) => FileState;
  setIncludeIgnored: (value: boolean) => void;
  setScanOnline: (value: boolean) => void;
  setStatusFilter: (value: ReviewStatusFilter) => void;
  setProviderFilter: (value: ProviderFilter) => void;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  onBatchScan: () => void;
  onToggle: (fileID: number) => void;
  onIgnore: (fileID: number) => void;
  onUnignore: (fileID: number) => void;
  onRefreshParse: (fileID: number) => void;
  onScan: (fileID: number) => void;
  onClearMatch: (fileID: number) => void;
  onApprove: (candidateID: number, fileID: number) => void;
  onReject: (candidateID: number, fileID: number) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="app-card flex flex-wrap items-center gap-3 p-4">
        <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-gray-400">
          <input
            type="checkbox"
            checked={includeIgnored}
            onChange={event => setIncludeIgnored(event.target.checked)}
            className="rounded border-gray-600 bg-gray-900 accent-blue-500"
          />
          Show ignored
        </label>
        <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-gray-400">
          <input
            type="checkbox"
            checked={scanOnline}
            onChange={event => setScanOnline(event.target.checked)}
            className="rounded border-gray-600 bg-gray-900 accent-blue-500"
          />
          Online search
        </label>
        <select
          value={statusFilter}
          onChange={event => setStatusFilter(event.target.value as ReviewStatusFilter)}
          className="rounded-md border border-gray-700 bg-gray-900/70 px-3 py-1.5 text-sm text-gray-100 outline-none app-focus"
        >
          <option value="all">All states</option>
          <option value="Pending">Pending</option>
          <option value="Ignored">Ignored</option>
          <option value="ManualMatch">Manual match</option>
        </select>
        <select
          value={providerFilter}
          onChange={event => setProviderFilter(event.target.value as ProviderFilter)}
          className="rounded-md border border-gray-700 bg-gray-900/70 px-3 py-1.5 text-sm text-gray-100 outline-none app-focus"
        >
          <option value="all">All providers</option>
          <option value="tmdb">TMDB candidates</option>
          <option value="tvdb">TVDB candidates</option>
        </select>
        <button
          type="button"
          disabled={batchScanning}
          onClick={onBatchScan}
          className="ml-auto flex items-center gap-1.5 rounded-md bg-gray-800 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:bg-gray-700 disabled:opacity-50"
        >
          <Search size={12} />
          {batchScanning ? 'Scanning...' : 'Scan All'}
        </button>
        <span className="text-xs text-gray-500">{total} unmatched</span>
      </div>

      <div className="app-card divide-y divide-gray-800/50 rounded-md">
        {loading && files.length === 0 ? (
          <SpinnerBlock />
        ) : files.length === 0 ? (
          <EmptyState title="No unmatched files." detail="Adjust filters or scan managed folders to populate review records." />
        ) : (
          files.map(file => {
            const state = getState(file.FileID);
            return (
              <FileRow
                key={file.FileID}
                file={file}
                state={state}
                providerFilter={providerFilter}
                onToggle={() => onToggle(file.FileID)}
                onIgnore={() => onIgnore(file.FileID)}
                onUnignore={() => onUnignore(file.FileID)}
                onRefreshParse={() => onRefreshParse(file.FileID)}
                onScan={() => onScan(file.FileID)}
                onClearMatch={() => onClearMatch(file.FileID)}
                onApprove={id => onApprove(id, file.FileID)}
                onReject={id => onReject(id, file.FileID)}
              />
            );
          })
        )}
      </div>

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} setPage={setPage} />
      )}
    </div>
  );
}

function FileRow({
  file,
  state,
  providerFilter,
  onToggle,
  onIgnore,
  onUnignore,
  onRefreshParse,
  onScan,
  onClearMatch,
  onApprove,
  onReject,
}: {
  file: MediaFileReviewItem;
  state: FileState;
  providerFilter: ProviderFilter;
  onToggle: () => void;
  onIgnore: () => void;
  onUnignore: () => void;
  onRefreshParse: () => void;
  onScan: () => void;
  onClearMatch: () => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
}) {
  const review = file.Review;
  const fileName = file.PrimaryPath.split(/[/\\]/).pop() ?? file.PrimaryPath;
  const candidates = state.candidates?.filter(candidate =>
    providerFilter === 'all' || candidate.Provider.toLowerCase() === providerFilter
  ) ?? null;

  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          className="shrink-0 text-gray-500 transition-colors hover:text-gray-300"
          title={state.expanded ? 'Collapse' : 'Expand'}
        >
          {state.expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-100" title={file.PrimaryPath}>{fileName}</p>
          <p className="truncate text-xs text-gray-500">{file.PrimaryPath}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-gray-600">{formatBytes(file.FileSize)}</span>
          <StatusBadge status={review.Status} />
          {review.Status === 'ManualMatch' && (
            <IconButton disabled={state.acting} onClick={onClearMatch} title="Clear match">
              <RotateCcw size={13} />
            </IconButton>
          )}
          {review.Status === 'Ignored' ? (
            <IconButton disabled={state.acting} onClick={onUnignore} title="Unignore">
              <Eye size={13} />
            </IconButton>
          ) : (
            <IconButton disabled={state.acting} onClick={onIgnore} title="Ignore">
              <EyeOff size={13} />
            </IconButton>
          )}
          <button
            type="button"
            disabled={state.scanning || state.acting}
            onClick={onScan}
            title="Scan for matches"
            className="flex items-center gap-1 rounded bg-gray-800 px-2 py-1 text-xs text-gray-300 transition-colors hover:bg-gray-700 disabled:opacity-40"
          >
            <Search size={12} />
            {state.scanning ? 'Scanning...' : 'Scan'}
          </button>
        </div>
      </div>

      {state.expanded && (
        <div className="space-y-4 border-t border-gray-800/50 bg-gray-900/30 px-5 py-4">
          {state.error && <p className="text-xs text-red-400">{state.error}</p>}
          <ParsedInfo review={review} />
          <button
            type="button"
            disabled={state.refreshing}
            onClick={onRefreshParse}
            className="flex items-center gap-1 rounded bg-gray-800 px-2 py-1 text-xs text-gray-300 transition-colors hover:bg-gray-700 disabled:opacity-40"
          >
            <RefreshCw size={11} className={state.refreshing ? 'animate-spin' : ''} />
            {state.refreshing ? 'Refreshing...' : 'Refresh parse'}
          </button>

          {state.loadingCandidates ? (
            <p className="text-xs text-gray-500">Loading candidates...</p>
          ) : candidates !== null && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Candidates ({candidates.length})
              </p>
              {candidates.length === 0 ? (
                <p className="text-xs text-gray-600">No candidates match the current provider filter.</p>
              ) : (
                candidates.map(candidate => (
                  <CandidateRow
                    key={candidate.MediaFileMatchCandidateID}
                    candidate={candidate}
                    disabled={state.acting}
                    onApprove={() => onApprove(candidate.MediaFileMatchCandidateID)}
                    onReject={() => onReject(candidate.MediaFileMatchCandidateID)}
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

function ParsedInfo({ review }: { review: MediaFileReviewItem['Review'] }) {
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs sm:grid-cols-3">
      <InfoCell label="Kind" value={review.ParsedKind} />
      {review.ParsedTitle && <InfoCell label="Title" value={review.ParsedTitle} />}
      {review.ParsedShowTitle && <InfoCell label="Show" value={review.ParsedShowTitle} />}
      {review.ParsedYear != null && <InfoCell label="Year" value={String(review.ParsedYear)} />}
      {review.ParsedSeasonNumber != null && <InfoCell label="Season" value={String(review.ParsedSeasonNumber)} />}
      {review.ParsedEpisodeNumbers.length > 0 && <InfoCell label="Episode(s)" value={review.ParsedEpisodeNumbers.join(', ')} />}
      {review.ParsedQuality && <InfoCell label="Quality" value={review.ParsedQuality} />}
      {review.ParsedSource && <InfoCell label="Source" value={review.ParsedSource} />}
      {review.ParsedEdition && <InfoCell label="Edition" value={review.ParsedEdition} />}
      {review.ParsedVideoCodec && <InfoCell label="Video" value={review.ParsedVideoCodec} />}
      {review.ParsedAudioCodec && (
        <InfoCell label="Audio" value={review.ParsedAudioCodec + (review.ParsedAudioChannels ? ` ${review.ParsedAudioChannels}` : '')} />
      )}
      {review.ParsedHdrFormats.length > 0 && <InfoCell label="HDR" value={review.ParsedHdrFormats.join(', ')} />}
      {review.ParsedExternalIds.length > 0 && (
        <InfoCell label="IDs" value={review.ParsedExternalIds.map(id => `${id.Source}:${id.Id}`).join(', ')} />
      )}
      {review.ManualTitle && (
        <InfoCell label="Matched" value={`${review.ManualProvider}:${review.ManualProviderID} - ${review.ManualTitle}`} />
      )}
      {review.ParsedWarnings.length > 0 && (
        <div className="col-span-full mt-2 space-y-1">
          {review.ParsedWarnings.map((warning, index) => (
            <p key={`${warning}-${index}`} className="text-xs text-yellow-400">{warning}</p>
          ))}
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
  const percent = Math.round(candidate.ConfidenceScore * 100);
  const barColor = percent >= 85 ? 'bg-green-500' : percent >= 60 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="flex items-start gap-3 rounded-md border border-gray-700/50 bg-gray-900/50 px-3 py-2.5">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-100">{candidate.Title}</span>
          {candidate.Year && <span className="text-xs text-gray-500">{candidate.Year}</span>}
          <span className="rounded bg-gray-700/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            {candidate.Provider} - {candidate.ProviderType}
          </span>
          {candidate.Status !== 'Pending' && (
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
              candidate.Status === 'Approved' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'
            }`}>
              {candidate.Status}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-800">
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${percent}%` }} />
          </div>
          <span className="text-xs text-gray-500">{percent}%</span>
        </div>
        {candidate.Reasons.length > 0 && <p className="text-xs text-gray-600">{candidate.Reasons.join(' - ')}</p>}
      </div>
      {candidate.Status === 'Pending' && (
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" disabled={disabled} onClick={onApprove} title="Approve" className="text-green-500 transition-colors hover:text-green-400 disabled:opacity-40">
            <CheckCircle2 size={18} />
          </button>
          <button type="button" disabled={disabled} onClick={onReject} title="Reject" className="text-red-500 transition-colors hover:text-red-400 disabled:opacity-40">
            <XCircle size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

function DuplicatesPanel({
  mode,
  setMode,
  summary,
  plans,
  planTotal,
  planPage,
  planTotalPages,
  duplicateSeries,
  duplicateSeriesTotal,
  duplicateSeriesPage,
  duplicateSeriesTotalPages,
  duplicateEpisodes,
  duplicateEpisodeTotal,
  duplicateEpisodePage,
  duplicateEpisodeTotalPages,
  includeIgnored,
  onlyAvailable,
  preferredPath,
  deletePhysicalFile,
  deleteEmptyFolders,
  loading,
  deletingLocationID,
  setIncludeIgnored,
  setOnlyAvailable,
  setPreferredPath,
  setDeletePhysicalFile,
  setDeleteEmptyFolders,
  setPlanPage,
  setDuplicateSeriesPage,
  setDuplicateEpisodePage,
  onDeleteLocation,
}: {
  mode: DuplicateMode;
  setMode: (value: DuplicateMode) => void;
  summary: ExactDuplicateSummary | null;
  plans: ExactDuplicateCleanupPlan[];
  planTotal: number;
  planPage: number;
  planTotalPages: number;
  duplicateSeries: DaCollectorSeriesSummary[];
  duplicateSeriesTotal: number;
  duplicateSeriesPage: number;
  duplicateSeriesTotalPages: number;
  duplicateEpisodes: DaCollectorEpisode[];
  duplicateEpisodeTotal: number;
  duplicateEpisodePage: number;
  duplicateEpisodeTotalPages: number;
  includeIgnored: boolean;
  onlyAvailable: boolean;
  preferredPath: string;
  deletePhysicalFile: boolean;
  deleteEmptyFolders: boolean;
  loading: boolean;
  deletingLocationID: number | null;
  setIncludeIgnored: (value: boolean) => void;
  setOnlyAvailable: (value: boolean) => void;
  setPreferredPath: (value: string) => void;
  setDeletePhysicalFile: (value: boolean) => void;
  setDeleteEmptyFolders: (value: boolean) => void;
  setPlanPage: React.Dispatch<React.SetStateAction<number>>;
  setDuplicateSeriesPage: React.Dispatch<React.SetStateAction<number>>;
  setDuplicateEpisodePage: React.Dispatch<React.SetStateAction<number>>;
  onDeleteLocation: (location: ExactDuplicateLocation) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentButton active={mode === 'exact'} onClick={() => setMode('exact')}>Exact locations</SegmentButton>
        <SegmentButton active={mode === 'series'} onClick={() => setMode('series')}>Series with duplicate files</SegmentButton>
        <SegmentButton active={mode === 'episodes'} onClick={() => setMode('episodes')}>Episodes with duplicate files</SegmentButton>
      </div>

      {mode === 'exact' && (
        <>
          <div className="app-card grid gap-4 p-4 md:grid-cols-4">
            <SummaryCard label="Duplicate Sets" value={summary?.SetCount ?? 0} />
            <SummaryCard label="Locations" value={summary?.LocationCount ?? 0} />
            <SummaryCard label="Remove Candidates" value={summary?.SuggestedRemoveLocationCount ?? 0} />
            <SummaryCard label="Available Reclaim" value={formatBytes(summary?.AvailablePotentialReclaimBytes ?? 0)} />
          </div>
          <div className="app-card flex flex-wrap items-center gap-3 p-4">
            <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-gray-400">
              <input type="checkbox" checked={includeIgnored} onChange={event => setIncludeIgnored(event.target.checked)} className="rounded border-gray-600 bg-gray-900 accent-blue-500" />
              Include ignored
            </label>
            <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-gray-400">
              <input type="checkbox" checked={onlyAvailable} onChange={event => setOnlyAvailable(event.target.checked)} className="rounded border-gray-600 bg-gray-900 accent-blue-500" />
              Only available
            </label>
            <input
              value={preferredPath}
              onChange={event => setPreferredPath(event.target.value)}
              className="min-w-56 rounded-md border border-gray-700 bg-gray-900/70 px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 outline-none app-focus"
              placeholder="Preferred path contains"
            />
            <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-gray-400">
              <input type="checkbox" checked={deletePhysicalFile} onChange={event => setDeletePhysicalFile(event.target.checked)} className="rounded border-gray-600 bg-gray-900 accent-blue-500" />
              Delete physical files
            </label>
            <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-gray-400">
              <input type="checkbox" checked={deleteEmptyFolders} onChange={event => setDeleteEmptyFolders(event.target.checked)} className="rounded border-gray-600 bg-gray-900 accent-blue-500" />
              Delete empty folders
            </label>
          </div>
          <div className="space-y-3">
            {loading && plans.length === 0 ? (
              <SpinnerBlock />
            ) : plans.length === 0 ? (
              <EmptyState title="No exact duplicates found." detail="Exact duplicates require matching hash and file size across file locations." />
            ) : (
              plans.map(plan => (
                <ExactPlanCard
                  key={plan.DuplicateKey}
                  plan={plan}
                  deletingLocationID={deletingLocationID}
                  onDeleteLocation={onDeleteLocation}
                />
              ))
            )}
          </div>
          {planTotalPages > 1 && <Pagination page={planPage} totalPages={planTotalPages} setPage={setPlanPage} label={`${planTotal} plans`} />}
        </>
      )}

      {mode === 'series' && (
        <SeriesSummaryList
          loading={loading}
          series={duplicateSeries}
          emptyTitle="No series with duplicate files."
          total={duplicateSeriesTotal}
          page={duplicateSeriesPage}
          totalPages={duplicateSeriesTotalPages}
          setPage={setDuplicateSeriesPage}
        />
      )}

      {mode === 'episodes' && (
        <EpisodeList
          loading={loading}
          episodes={duplicateEpisodes}
          emptyTitle="No episodes with duplicate files."
          total={duplicateEpisodeTotal}
          page={duplicateEpisodePage}
          totalPages={duplicateEpisodeTotalPages}
          setPage={setDuplicateEpisodePage}
          showFiles
        />
      )}
    </div>
  );
}

function ExactPlanCard({
  plan,
  deletingLocationID,
  onDeleteLocation,
}: {
  plan: ExactDuplicateCleanupPlan;
  deletingLocationID: number | null;
  onDeleteLocation: (location: ExactDuplicateLocation) => void;
}) {
  return (
    <section className="app-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800/70 px-5 py-4">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-gray-100">{plan.HashType} {plan.Hash}</div>
          <p className="mt-0.5 text-xs text-gray-500">
            {plan.LocationCount} locations - {formatBytes(plan.FileSize)} each - {formatBytes(plan.PotentialReclaimBytes)} reclaimable
          </p>
        </div>
        {plan.Warnings.length > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded bg-yellow-600/20 px-2 py-1 text-xs text-yellow-300">
            <AlertTriangle size={12} />
            {plan.Warnings.length} warning{plan.Warnings.length === 1 ? '' : 's'}
          </span>
        )}
      </div>
      <div className="divide-y divide-gray-800/60">
        {plan.KeepLocation && <DuplicateLocationRow location={plan.KeepLocation} keep />}
        {plan.RemoveCandidates.map(location => (
          <DuplicateLocationRow
            key={location.LocationID}
            location={location}
            keep={false}
            deleting={deletingLocationID === location.LocationID}
            onDelete={() => onDeleteLocation(location)}
          />
        ))}
      </div>
    </section>
  );
}

function DuplicateLocationRow({
  location,
  keep,
  deleting,
  onDelete,
}: {
  location: ExactDuplicateLocation;
  keep: boolean;
  deleting?: boolean;
  onDelete?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start gap-3 px-5 py-3">
      <span className={`rounded px-2 py-1 text-[11px] font-semibold uppercase ${keep ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
        {keep ? 'Keep' : 'Remove'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-gray-100" title={location.Path ?? location.RelativePath}>{location.RelativePath}</p>
        <p className="mt-0.5 text-xs text-gray-500">
          Location {location.LocationID} - Video {location.VideoID} - {location.ManagedFolderName || `Folder ${location.ManagedFolderID}`} - {location.IsAvailable ? 'Available' : 'Unavailable'}
        </p>
        <p className="mt-1 text-xs text-gray-600">{location.SelectionReason}</p>
      </div>
      {!keep && (
        <button
          type="button"
          disabled={deleting}
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 rounded-md bg-red-600/90 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-50"
        >
          <Trash2 size={12} />
          {deleting ? 'Deleting...' : 'Delete'}
        </button>
      )}
    </div>
  );
}

function MissingPanel({
  mode,
  setMode,
  collecting,
  finishedOnly,
  setCollecting,
  setFinishedOnly,
  loading,
  series,
  seriesTotal,
  seriesPage,
  seriesTotalPages,
  episodes,
  episodeTotal,
  episodePage,
  episodeTotalPages,
  setSeriesPage,
  setEpisodePage,
}: {
  mode: MissingMode;
  setMode: (value: MissingMode) => void;
  collecting: boolean;
  finishedOnly: boolean;
  setCollecting: (value: boolean) => void;
  setFinishedOnly: (value: boolean) => void;
  loading: boolean;
  series: DaCollectorSeriesSummary[];
  seriesTotal: number;
  seriesPage: number;
  seriesTotalPages: number;
  episodes: DaCollectorEpisode[];
  episodeTotal: number;
  episodePage: number;
  episodeTotalPages: number;
  setSeriesPage: React.Dispatch<React.SetStateAction<number>>;
  setEpisodePage: React.Dispatch<React.SetStateAction<number>>;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentButton active={mode === 'series'} onClick={() => setMode('series')}>Series</SegmentButton>
        <SegmentButton active={mode === 'episodes'} onClick={() => setMode('episodes')}>Episodes</SegmentButton>
      </div>
      <div className="app-card flex flex-wrap items-center gap-3 p-4">
        <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-gray-400">
          <input type="checkbox" checked={collecting} onChange={event => setCollecting(event.target.checked)} className="rounded border-gray-600 bg-gray-900 accent-blue-500" />
          Collecting only
        </label>
        <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-gray-400">
          <input type="checkbox" checked={finishedOnly} onChange={event => setFinishedOnly(event.target.checked)} className="rounded border-gray-600 bg-gray-900 accent-blue-500" />
          Finished series only
        </label>
      </div>

      {mode === 'series' ? (
        <SeriesSummaryList
          loading={loading}
          series={series}
          emptyTitle="No series with missing episodes."
          total={seriesTotal}
          page={seriesPage}
          totalPages={seriesTotalPages}
          setPage={setSeriesPage}
        />
      ) : (
        <EpisodeList
          loading={loading}
          episodes={episodes}
          emptyTitle="No missing episodes."
          total={episodeTotal}
          page={episodePage}
          totalPages={episodeTotalPages}
          setPage={setEpisodePage}
        />
      )}
    </div>
  );
}

function SeriesSummaryList({
  loading,
  series,
  emptyTitle,
  total,
  page,
  totalPages,
  setPage,
}: {
  loading: boolean;
  series: DaCollectorSeriesSummary[];
  emptyTitle: string;
  total: number;
  page: number;
  totalPages: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
}) {
  return (
    <div className="space-y-4">
      <div className="app-card divide-y divide-gray-800/50 rounded-md">
        {loading && series.length === 0 ? (
          <SpinnerBlock />
        ) : series.length === 0 ? (
          <EmptyState title={emptyTitle} detail="This review queue is empty for the current filters." />
        ) : (
          series.map(item => (
            <div key={item.IDs.ID} className="flex items-start gap-3 px-5 py-4">
              <FolderOpen size={17} className="mt-0.5 shrink-0 text-shoko-accent" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-gray-100">{item.Name}</div>
                <p className="mt-0.5 text-xs text-gray-500">
                  MediaSeries {item.IDs.ID} - Source {item.IDs.SourceID || 'none'} - {item.EpisodeCount} episode{item.EpisodeCount === 1 ? '' : 's'}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} setPage={setPage} label={`${total} series`} />}
    </div>
  );
}

function EpisodeList({
  loading,
  episodes,
  emptyTitle,
  total,
  page,
  totalPages,
  setPage,
  showFiles = false,
}: {
  loading: boolean;
  episodes: DaCollectorEpisode[];
  emptyTitle: string;
  total: number;
  page: number;
  totalPages: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  showFiles?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="app-card divide-y divide-gray-800/50 rounded-md">
        {loading && episodes.length === 0 ? (
          <SpinnerBlock />
        ) : episodes.length === 0 ? (
          <EmptyState title={emptyTitle} detail="This review queue is empty for the current filters." />
        ) : (
          episodes.map(episode => (
            <div key={episode.IDs.ID} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-gray-100">{episode.Name}</div>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Episode {episode.IDs.ID} - Series {episode.IDs.ParentSeries} - Source {episode.IDs.SourceID || 'none'}
                  </p>
                </div>
                <span className="rounded bg-gray-800 px-2 py-1 text-xs text-gray-400">
                  {episode.Size} file{episode.Size === 1 ? '' : 's'}
                </span>
              </div>
              {showFiles && episode.Files && episode.Files.length > 0 && (
                <div className="mt-3 space-y-2">
                  {episode.Files.map(file => (
                    <div key={file.ID} className="rounded border border-gray-800 bg-gray-950/30 px-3 py-2">
                      <div className="text-xs text-gray-300">File {file.ID} - {formatBytes(file.Size)} {file.Resolution ? `- ${file.Resolution}` : ''}</div>
                      {file.Locations.map(location => (
                        <div key={location.ID} className="truncate text-xs text-gray-600" title={location.AbsolutePath ?? location.RelativePath}>
                          {location.IsAccessible ? 'Available' : 'Missing'} - {location.RelativePath}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} setPage={setPage} label={`${total} episodes`} />}
    </div>
  );
}

function IntegrityPanel({
  folders,
  selectedFolderIDs,
  checkHash,
  scans,
  selectedScan,
  files,
  fileFilter,
  loading,
  running,
  deletingScanID,
  setSelectedFolderIDs,
  setCheckHash,
  onRunScan,
  onSelectScan,
  onStartScan,
  onDeleteScan,
  onFileFilter,
}: {
  folders: ManagedFolder[];
  selectedFolderIDs: number[];
  checkHash: boolean;
  scans: IntegrityCheck[];
  selectedScan: IntegrityCheck | null;
  files: IntegrityCheckFile[];
  fileFilter: IntegrityFileFilter;
  loading: boolean;
  running: boolean;
  deletingScanID: number | null;
  setSelectedFolderIDs: (value: number[]) => void;
  setCheckHash: (value: boolean) => void;
  onRunScan: () => void;
  onSelectScan: (scanID: number) => void;
  onStartScan: (scanID: number) => void;
  onDeleteScan: (scanID: number) => void;
  onFileFilter: (filter: IntegrityFileFilter) => void;
}) {
  function toggleFolder(folderID: number) {
    setSelectedFolderIDs(
      selectedFolderIDs.includes(folderID)
        ? selectedFolderIDs.filter(id => id !== folderID)
        : [...selectedFolderIDs, folderID]
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
      <div className="space-y-5">
        <section className="app-card p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">Run Integrity Check</h2>
          <div className="max-h-64 space-y-2 overflow-auto pr-1">
            {folders.length === 0 ? (
              <p className="text-sm text-gray-500">No managed folders are configured.</p>
            ) : (
              folders.map(folder => (
                <label key={folder.ID} className="flex cursor-pointer items-start gap-2 rounded border border-gray-800 bg-gray-950/30 px-3 py-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={selectedFolderIDs.includes(folder.ID)}
                    onChange={() => toggleFolder(folder.ID)}
                    className="mt-1 rounded border-gray-600 bg-gray-900 accent-blue-500"
                  />
                  <span className="min-w-0">
                    <span className="block truncate">{folder.Name}</span>
                    <span className="block truncate text-xs text-gray-600">{folder.Path}</span>
                  </span>
                </label>
              ))
            )}
          </div>
          <label className="mt-4 flex cursor-pointer select-none items-center gap-2 text-sm text-gray-400">
            <input type="checkbox" checked={checkHash} onChange={event => setCheckHash(event.target.checked)} className="rounded border-gray-600 bg-gray-900 accent-shoko-accent" />
            Verify hashes
          </label>
          <button
            type="button"
            disabled={running || selectedFolderIDs.length === 0}
            onClick={onRunScan}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-shoko-accent px-3 py-2 text-sm font-medium text-black transition-colors hover:bg-shoko-accent/85 disabled:opacity-50"
          >
            <Play size={14} />
            {running ? 'Starting...' : 'Create and Start'}
          </button>
        </section>

        <section className="app-card overflow-hidden">
          <div className="border-b border-gray-800/70 px-5 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Scans</h2>
          </div>
          <div className="divide-y divide-gray-800/60">
            {loading && scans.length === 0 ? (
              <SpinnerBlock />
            ) : scans.length === 0 ? (
              <EmptyState title="No integrity scans." detail="Create a scan to review corrupt, missing, or hash-mismatched files." />
            ) : (
              scans.map(scan => (
                <IntegrityScanRow
                  key={scan.ID}
                  scan={scan}
                  active={selectedScan?.ID === scan.ID}
                  deleting={deletingScanID === scan.ID}
                  running={running}
                  onSelect={() => onSelectScan(scan.ID)}
                  onStart={() => onStartScan(scan.ID)}
                  onDelete={() => onDeleteScan(scan.ID)}
                />
              ))
            )}
          </div>
        </section>
      </div>

      <section className="app-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800/70 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
              {selectedScan ? `Scan ${selectedScan.ID} Results` : 'Scan Results'}
            </h2>
            {selectedScan && (
              <p className="mt-1 text-xs text-gray-500">
                {selectedScan.TotalFiles} total - {selectedScan.CompletedFiles} complete - {selectedScan.ErrorFiles} errors
              </p>
            )}
          </div>
          <select
            value={fileFilter}
            onChange={event => onFileFilter(event.target.value as IntegrityFileFilter)}
            className="rounded-md border border-gray-700 bg-gray-900/70 px-3 py-1.5 text-sm text-gray-100 outline-none app-focus"
          >
            <option value="errors">Errors</option>
            <option value="all">All files</option>
            <option value="Waiting">Waiting</option>
            <option value="ProcessedOK">OK</option>
            <option value="ErrorFileNotFound">Missing file</option>
            <option value="ErrorInvalidSize">Invalid size</option>
            <option value="ErrorInvalidHash">Invalid hash</option>
            <option value="ErrorMissingHash">Missing hash</option>
            <option value="ErrorIOError">IO error</option>
          </select>
        </div>
        <div className="divide-y divide-gray-800/60">
          {!selectedScan ? (
            <EmptyState title="No scan selected." detail="Select a scan to review file results." />
          ) : files.length === 0 ? (
            <EmptyState title="No files for this filter." detail="Try another status filter or refresh the scan." />
          ) : (
            files.map(file => <IntegrityFileRow key={file.ID} file={file} />)
          )}
        </div>
      </section>
    </div>
  );
}

function IntegrityScanRow({
  scan,
  active,
  deleting,
  running,
  onSelect,
  onStart,
  onDelete,
}: {
  scan: IntegrityCheck;
  active: boolean;
  deleting: boolean;
  running: boolean;
  onSelect: () => void;
  onStart: () => void;
  onDelete: () => void;
}) {
  const progress = scan.TotalFiles > 0 ? Math.round(((scan.TotalFiles - scan.WaitingFiles) / scan.TotalFiles) * 100) : 0;
  return (
    <div className={`px-4 py-3 ${active ? 'bg-shoko-accent/10' : ''}`}>
      <button type="button" onClick={onSelect} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-100">Scan {scan.ID}</div>
            <p className="mt-0.5 text-xs text-gray-500">{formatDateTime(scan.CreatedAt)}</p>
          </div>
          <ScanStatusBadge status={scan.Status} />
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-800">
          <div className="h-full rounded-full bg-shoko-accent" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {scan.CompletedFiles} complete - {scan.ErrorFiles} errors - {scan.WaitingFiles} waiting
        </p>
      </button>
      <div className="mt-3 flex gap-2">
        {scan.Status === 'Standby' && (
          <button type="button" disabled={running} onClick={onStart} className="inline-flex items-center gap-1.5 rounded bg-gray-800 px-2 py-1 text-xs text-gray-300 transition-colors hover:bg-gray-700 disabled:opacity-50">
            <Play size={12} />
            Start
          </button>
        )}
        <button type="button" disabled={deleting} onClick={onDelete} className="inline-flex items-center gap-1.5 rounded bg-red-600/90 px-2 py-1 text-xs text-white transition-colors hover:bg-red-500 disabled:opacity-50">
          <Trash2 size={12} />
          {deleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  );
}

function IntegrityFileRow({ file }: { file: IntegrityCheckFile }) {
  return (
    <div className="px-5 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-gray-100" title={file.FullName}>{file.FullName}</div>
          <p className="mt-0.5 text-xs text-gray-500">
            Folder {file.ManagedFolderID} - Location {file.VideoLocalPlaceID} - {formatBytes(file.FileSize)}
          </p>
          {file.Status === 'ErrorInvalidHash' && (
            <p className="mt-1 text-xs text-red-300">
              Expected {file.Hash ?? 'unknown'} - got {file.HashResult ?? 'unknown'}
            </p>
          )}
        </div>
        <FileStatusBadge status={file.Status} />
      </div>
    </div>
  );
}

function RelocationPanel({
  summary,
  pipes,
  files,
  total,
  page,
  totalPages,
  search,
  selectedFileIDs,
  selectedPipeID,
  move,
  rename,
  allowInsideDestination,
  deleteEmptyDirectories,
  previewResults,
  applyResults,
  loading,
  previewing,
  applying,
  setPage,
  setSearch,
  setSelectedPipeID,
  setMove,
  setRename,
  setAllowInsideDestination,
  setDeleteEmptyDirectories,
  onToggleFile,
  onTogglePage,
  onPreview,
  onApply,
}: {
  summary: RelocationSummary | null;
  pipes: RelocationPipe[];
  files: MediaFileDto[];
  total: number;
  page: number;
  totalPages: number;
  search: string;
  selectedFileIDs: number[];
  selectedPipeID: string;
  move: boolean;
  rename: boolean;
  allowInsideDestination: boolean;
  deleteEmptyDirectories: boolean;
  previewResults: RelocationResult[] | null;
  applyResults: RelocationResult[] | null;
  loading: boolean;
  previewing: boolean;
  applying: boolean;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  setSearch: (value: string) => void;
  setSelectedPipeID: (value: string) => void;
  setMove: (value: boolean) => void;
  setRename: (value: boolean) => void;
  setAllowInsideDestination: (value: boolean) => void;
  setDeleteEmptyDirectories: (value: boolean) => void;
  onToggleFile: (fileID: number) => void;
  onTogglePage: () => void;
  onPreview: () => void;
  onApply: () => void;
}) {
  const allVisibleSelected = files.length > 0 && files.every(file => selectedFileIDs.includes(file.FileID));
  const fileLookup = useMemo(() => new Map(files.map(file => [file.FileID, file])), [files]);
  const defaultPipe = pipes.find(pipe => pipe.IsDefault);
  const successfulPreviewCount = previewResults?.filter(result => result.IsSuccess).length ?? 0;
  const changedPreviewCount = previewResults?.filter(result => result.IsSuccess && result.IsRelocated).length ?? 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
      <div className="space-y-5">
        <section className="app-card p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">Relocation Options</h2>
          <div className="grid gap-3">
            <SummaryCard label="Providers" value={summary?.ProviderCount ?? 0} />
            <SummaryCard label="Move Default" value={summary?.MoveOnImport ? 'Enabled' : 'Off'} />
            <SummaryCard label="Rename Default" value={summary?.RenameOnImport ? 'Enabled' : 'Off'} />
          </div>

          <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-gray-500">Pipe</label>
          <select
            value={selectedPipeID}
            onChange={event => setSelectedPipeID(event.target.value)}
            className="mt-1 w-full rounded-md border border-gray-700 bg-gray-900/70 px-3 py-2 text-sm text-gray-100 outline-none app-focus"
          >
            <option value="default">Default pipe{defaultPipe ? ` - ${defaultPipe.Name}` : ''}</option>
            {pipes.map(pipe => (
              <option key={pipe.ID} value={pipe.ID} disabled={!pipe.IsUsable}>
                {pipe.Name}{pipe.IsDefault ? ' (default)' : ''}{pipe.IsUsable ? '' : ' (unusable)'}
              </option>
            ))}
          </select>

          <div className="mt-4 space-y-3">
            <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-gray-400">
              <input type="checkbox" checked={move} onChange={event => setMove(event.target.checked)} className="rounded border-gray-600 bg-gray-900 accent-blue-500" />
              Move
            </label>
            <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-gray-400">
              <input type="checkbox" checked={rename} onChange={event => setRename(event.target.checked)} className="rounded border-gray-600 bg-gray-900 accent-blue-500" />
              Rename
            </label>
            <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-gray-400">
              <input type="checkbox" checked={allowInsideDestination} onChange={event => setAllowInsideDestination(event.target.checked)} className="rounded border-gray-600 bg-gray-900 accent-blue-500" />
              Allow destination folders
            </label>
            <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-gray-400">
              <input type="checkbox" checked={deleteEmptyDirectories} onChange={event => setDeleteEmptyDirectories(event.target.checked)} className="rounded border-gray-600 bg-gray-900 accent-blue-500" />
              Delete empty folders
            </label>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={previewing || applying || selectedFileIDs.length === 0 || (!move && !rename)}
              onClick={onPreview}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-gray-800 px-3 py-2 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-700 disabled:opacity-50"
            >
              <Eye size={14} />
              {previewing ? 'Previewing...' : 'Preview'}
            </button>
            <button
              type="button"
              disabled={applying || previewing || !previewResults || previewResults.length === 0}
              onClick={onApply}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-shoko-accent px-3 py-2 text-sm font-medium text-black transition-colors hover:bg-shoko-accent/85 disabled:opacity-50"
            >
              <Play size={14} />
              {applying ? 'Applying...' : 'Apply'}
            </button>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            {selectedFileIDs.length} selected - {changedPreviewCount} previewed change{changedPreviewCount === 1 ? '' : 's'} - {successfulPreviewCount} successful
          </p>
        </section>

        <section className="app-card p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Find Files</h2>
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            className="w-full rounded-md border border-gray-700 bg-gray-900/70 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 outline-none app-focus"
            placeholder="Search path or file ID"
          />
          <button
            type="button"
            onClick={onTogglePage}
            disabled={files.length === 0}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-gray-800 px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-700 disabled:opacity-50"
          >
            <CheckCircle2 size={14} />
            {allVisibleSelected ? 'Clear Page' : 'Select Page'}
          </button>
          <p className="mt-3 text-xs text-gray-500">{total} files</p>
        </section>
      </div>

      <div className="space-y-5">
        <section className="app-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800/70 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Files</h2>
              <p className="mt-1 text-xs text-gray-500">Page {page} of {totalPages}</p>
            </div>
          </div>
          <div className="divide-y divide-gray-800/60">
            {loading && files.length === 0 ? (
              <SpinnerBlock />
            ) : files.length === 0 ? (
              <EmptyState title="No files found." detail="Adjust the search to find files eligible for relocation preview." />
            ) : (
              files.map(file => (
                <RelocationFileRow
                  key={file.FileID}
                  file={file}
                  selected={selectedFileIDs.includes(file.FileID)}
                  onToggle={() => onToggleFile(file.FileID)}
                />
              ))
            )}
          </div>
        </section>

        {totalPages > 1 && <Pagination page={page} totalPages={totalPages} setPage={setPage} label={`${total} files`} />}

        {previewResults && (
          <RelocationResultList
            title="Preview"
            results={previewResults}
            fileLookup={fileLookup}
          />
        )}

        {applyResults && (
          <RelocationResultList
            title="Applied"
            results={applyResults}
            fileLookup={fileLookup}
          />
        )}
      </div>
    </div>
  );
}

function RelocationFileRow({
  file,
  selected,
  onToggle,
}: {
  file: MediaFileDto;
  selected: boolean;
  onToggle: () => void;
}) {
  const primaryLocation = getPrimaryLocation(file);

  return (
    <label className="flex cursor-pointer items-start gap-3 px-5 py-3 transition-colors hover:bg-gray-900/30">
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="mt-1 rounded border-gray-600 bg-gray-900 accent-blue-500"
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-gray-100" title={primaryLocation}>
          {primaryLocation}
        </div>
        <p className="mt-0.5 text-xs text-gray-500">
          File {file.FileID} - {formatBytes(file.SizeBytes)} - {file.Locations.length} location{file.Locations.length === 1 ? '' : 's'}
        </p>
      </div>
      <span className={`rounded px-2 py-1 text-[11px] font-semibold uppercase ${file.Locations.some(location => location.IsAvailable) ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
        {file.Locations.some(location => location.IsAvailable) ? 'Available' : 'Missing'}
      </span>
    </label>
  );
}

function RelocationResultList({
  title,
  results,
  fileLookup,
}: {
  title: string;
  results: RelocationResult[];
  fileLookup: Map<number, MediaFileDto>;
}) {
  const successCount = results.filter(result => result.IsSuccess).length;
  const changedCount = results.filter(result => result.IsSuccess && result.IsRelocated).length;

  return (
    <section className="app-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800/70 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">{title} Results</h2>
          <p className="mt-1 text-xs text-gray-500">
            {results.length} result{results.length === 1 ? '' : 's'} - {changedCount} changed - {successCount} successful
          </p>
        </div>
      </div>
      <div className="divide-y divide-gray-800/60">
        {results.map(result => (
          <RelocationResultRow
            key={`${title}-${result.FileID}-${result.FileLocationID ?? 'none'}`}
            result={result}
            file={fileLookup.get(result.FileID)}
          />
        ))}
      </div>
    </section>
  );
}

function RelocationResultRow({
  result,
  file,
}: {
  result: RelocationResult;
  file?: MediaFileDto;
}) {
  const source = file ? getPrimaryLocation(file) : `File ${result.FileID}`;
  const destination = result.RelativePath ?? result.AbsolutePath ?? 'No destination returned';
  const warnings = getRelocationWarnings(result);

  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-100">File {result.FileID}</span>
            <RelocationStatusBadge result={result} />
            {result.PipeName && <span className="rounded bg-gray-800 px-2 py-1 text-xs text-gray-400">{result.PipeName}</span>}
          </div>
          <div className="grid gap-2 text-xs md:grid-cols-2">
            <div className="min-w-0">
              <div className="uppercase tracking-wide text-gray-600">Source</div>
              <div className="truncate text-gray-300" title={source}>{source}</div>
            </div>
            <div className="min-w-0">
              <div className="uppercase tracking-wide text-gray-600">Destination</div>
              <div className="truncate text-gray-300" title={result.AbsolutePath ?? destination}>{destination}</div>
            </div>
          </div>
          {warnings.length > 0 && (
            <div className="space-y-1">
              {warnings.map(warning => (
                <p key={warning} className="flex items-center gap-1.5 text-xs text-yellow-300">
                  <AlertTriangle size={12} />
                  {warning}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RelocationStatusBadge({ result }: { result: RelocationResult }) {
  let label = 'Blocked';
  let className = 'bg-red-600/20 text-red-400';
  if (result.IsSuccess && result.IsRelocated) {
    label = result.IsPreview ? 'Will Change' : 'Changed';
    className = 'bg-shoko-accent/15 text-shoko-accent';
  } else if (result.IsSuccess) {
    label = 'No Change';
    className = 'bg-gray-700/50 text-gray-400';
  }

  return <span className={`rounded px-2 py-1 text-[11px] font-semibold uppercase ${className}`}>{label}</span>;
}

function getRelocationWarnings(result: RelocationResult) {
  const warnings: string[] = [];
  if (result.ErrorMessage) warnings.push(result.ErrorMessage);
  if (result.IsSuccess && result.IsRelocated === false) warnings.push('Already at the target location.');
  if (result.IsSuccess && !result.RelativePath && !result.AbsolutePath) warnings.push('The server did not return a destination path.');
  return warnings;
}

function getPrimaryLocation(file: MediaFileDto) {
  const location = file.Locations.find(item => item.IsAvailable) ?? file.Locations[0];
  return location?.RelativePath ?? location?.AbsolutePath ?? `File ${file.FileID}`;
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-gray-800 bg-gray-950/30 p-3">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-gray-100">{value}</div>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  setPage,
  label,
}: {
  page: number;
  totalPages: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  label?: string;
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => setPage(value => value - 1)}
        className="rounded bg-gray-800 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:bg-gray-700 disabled:opacity-40"
      >
        Prev
      </button>
      <span className="text-xs text-gray-400">
        Page {page} of {totalPages}{label ? ` - ${label}` : ''}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => setPage(value => value + 1)}
        className="rounded bg-gray-800 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:bg-gray-700 disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === 'ManualMatch'
      ? 'bg-green-600/20 text-green-400'
      : status === 'Ignored'
        ? 'bg-gray-700/50 text-gray-500'
        : 'bg-yellow-600/20 text-yellow-400';
  const label = status === 'ManualMatch' ? 'Matched' : status;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${className}`}>
      {label}
    </span>
  );
}

function ScanStatusBadge({ status }: { status: string }) {
  const className =
    status === 'Running'
      ? 'bg-shoko-accent/15 text-shoko-accent'
      : status === 'Finished'
        ? 'bg-green-600/20 text-green-400'
        : 'bg-gray-700/50 text-gray-400';
  return <span className={`rounded px-2 py-1 text-[11px] font-semibold uppercase ${className}`}>{status}</span>;
}

function FileStatusBadge({ status }: { status: IntegrityFileStatus }) {
  const className =
    status === 'ProcessedOK'
      ? 'bg-green-600/20 text-green-400'
      : status === 'Waiting'
        ? 'bg-gray-700/50 text-gray-400'
        : 'bg-red-600/20 text-red-400';
  return <span className={`rounded px-2 py-1 text-[11px] font-semibold uppercase ${className}`}>{status}</span>;
}

function IconButton({
  disabled,
  onClick,
  title,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      className="text-gray-500 transition-colors hover:text-gray-300 disabled:opacity-40"
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

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="px-5 py-10 text-center">
      <HardDrive size={30} className="mx-auto mb-3 text-gray-700" />
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-1 text-xs text-gray-600">{detail}</p>
    </div>
  );
}

function SpinnerBlock() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-shoko-accent border-t-transparent" />
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

function formatDateTime(value?: string) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function isIntegrityError(status: IntegrityFileStatus) {
  return status !== 'Waiting' && status !== 'ProcessedOK';
}

function isConcreteIntegrityStatus(filter: IntegrityFileFilter): filter is IntegrityFileStatus {
  return filter !== 'all' && filter !== 'errors';
}

function isReviewTab(value: string | null): value is ReviewTab {
  return value === 'unmatched'
    || value === 'duplicates'
    || value === 'missing'
    || value === 'integrity'
    || value === 'relocation';
}
