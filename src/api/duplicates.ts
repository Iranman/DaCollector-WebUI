import { api } from './client';
import { ListResult } from './media';

export interface ExactDuplicateFilters {
  includeIgnored?: boolean;
  onlyAvailable?: boolean;
  preferredManagedFolderID?: number | null;
  preferredPathContains?: string;
}

export interface ExactDuplicateSummary {
  SetCount: number;
  LocationCount: number;
  SuggestedRemoveLocationCount: number;
  PotentialReclaimBytes: number;
  AvailablePotentialReclaimBytes: number;
  AvailableLocationCount: number;
  UnavailableRemoveLocationCount: number;
}

export interface ExactDuplicateLocation {
  VideoID: number;
  LocationID: number;
  ManagedFolderID: number;
  ManagedFolderName: string;
  RelativePath: string;
  Path?: string;
  FileName: string;
  IsAvailable: boolean;
  IsIgnored: boolean;
  SuggestedKeep: boolean;
  SuggestedRemove: boolean;
  SelectionReason: string;
  ImportedAt?: string;
  CreatedAt: string;
}

export interface ExactDuplicateCleanupPlan {
  DuplicateKey: string;
  HashType: string;
  Hash: string;
  FileSize: number;
  LocationCount: number;
  AvailableLocationCount: number;
  KeepLocation?: ExactDuplicateLocation;
  RemoveCandidates: ExactDuplicateLocation[];
  RemoveCandidateCount: number;
  AvailableRemoveCandidateCount: number;
  PotentialReclaimBytes: number;
  Warnings: string[];
}

export interface ExactDuplicateDeleteResult {
  DryRun: boolean;
  Deleted: boolean;
  DeleteFile: boolean;
  DeleteEmptyFolders: boolean;
  Message: string;
  Location: ExactDuplicateLocation;
  Plan: ExactDuplicateCleanupPlan;
  PotentialReclaimBytes: number;
}

function buildQuery(filters: ExactDuplicateFilters = {}, page?: number, pageSize?: number) {
  const params = new URLSearchParams();
  params.set('includeIgnored', String(filters.includeIgnored ?? false));
  params.set('onlyAvailable', String(filters.onlyAvailable ?? false));
  if (filters.preferredManagedFolderID != null) params.set('preferredManagedFolderID', String(filters.preferredManagedFolderID));
  if (filters.preferredPathContains?.trim()) params.set('preferredPathContains', filters.preferredPathContains.trim());
  if (page != null) params.set('page', String(page));
  if (pageSize != null) params.set('pageSize', String(pageSize));
  return params.toString();
}

function buildDeleteQuery(
  filters: ExactDuplicateFilters = {},
  confirm: boolean,
  deleteFile: boolean,
  deleteEmptyFolders: boolean
) {
  const params = new URLSearchParams(buildQuery(filters));
  params.set('confirm', String(confirm));
  params.set('deleteFile', String(deleteFile));
  params.set('deleteEmptyFolders', String(deleteEmptyFolders));
  return params.toString();
}

export const duplicatesApi = {
  getExactSummary: (filters: ExactDuplicateFilters = {}) =>
    api.get<ExactDuplicateSummary>(`/api/v3/Duplicates/Exact/Summary?${buildQuery(filters)}`),
  getExactCleanupPlans: (filters: ExactDuplicateFilters = {}, page = 1, pageSize = 25) =>
    api.get<ListResult<ExactDuplicateCleanupPlan>>(
      `/api/v3/Duplicates/Exact/CleanupPlan?${buildQuery(filters, page, pageSize)}`
    ),
  previewDeleteLocation: (
    locationID: number,
    filters: ExactDuplicateFilters = {},
    deleteFile = true,
    deleteEmptyFolders = true
  ) =>
    api.del<ExactDuplicateDeleteResult>(
      `/api/v3/Duplicates/Exact/Location/${locationID}?${buildDeleteQuery(filters, false, deleteFile, deleteEmptyFolders)}`
    ),
  deleteLocation: (
    locationID: number,
    filters: ExactDuplicateFilters = {},
    deleteFile = true,
    deleteEmptyFolders = true
  ) =>
    api.del<ExactDuplicateDeleteResult>(
      `/api/v3/Duplicates/Exact/Location/${locationID}?${buildDeleteQuery(filters, true, deleteFile, deleteEmptyFolders)}`
    ),
};
