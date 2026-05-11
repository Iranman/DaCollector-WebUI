import { api } from './client';
import type { ExternalIdGuess } from './parser';

export type { ExternalIdGuess };

export interface MediaFileReviewLocation {
  ID: number;
  ManagedFolderID: number;
  RelativePath: string;
  Path?: string;
  FileName: string;
  IsAvailable: boolean;
}

export interface MediaFileReviewStateDto {
  ReviewStateID: number;
  Status: 'Pending' | 'Ignored' | 'ManualMatch';
  ParsedKind: string;
  ParsedTitle?: string;
  ParsedYear?: number;
  ParsedShowTitle?: string;
  ParsedSeasonNumber?: number;
  ParsedEpisodeNumbers: number[];
  ParsedAirDate?: string;
  ParsedExternalIds: ExternalIdGuess[];
  ParsedQuality?: string;
  ParsedSource?: string;
  ParsedEdition?: string;
  ParsedVideoCodec?: string;
  ParsedAudioCodec?: string;
  ParsedAudioChannels?: string;
  ParsedHdrFormats: string[];
  ParsedWarnings: string[];
  ManualEntityType?: string;
  ManualEntityID?: number;
  ManualProvider?: string;
  ManualProviderID?: string;
  ManualTitle?: string;
  Locked: boolean;
  IgnoredReason?: string;
  CreatedAt: string;
  UpdatedAt: string;
  LastParsedAt: string;
}

export interface MediaFileReviewItem {
  FileID: number;
  Hash: string;
  FileSize: number;
  IsIgnored: boolean;
  PrimaryPath: string;
  Locations: MediaFileReviewLocation[];
  Review: MediaFileReviewStateDto;
}

export interface MediaFileMatchCandidate {
  MediaFileMatchCandidateID: number;
  VideoLocalID: number;
  Provider: string;
  ProviderItemID: number;
  ProviderType: string;
  Title: string;
  Year?: number;
  ConfidenceScore: number;
  Reasons: string[];
  Status: 'Pending' | 'Approved' | 'Rejected';
  ReviewedAt?: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface MediaFileMatchScanResult {
  VideoLocalID: number;
  QueryTitle?: string;
  QueryYear?: number;
  ParsedKind?: string;
  IncludeOnlineSearch: boolean;
  RefreshExplicitIds: boolean;
  CandidateCount: number;
  Scanned: boolean;
  Message: string;
}

export interface MediaFileMatchBatchScanResult {
  IncludeIgnored: boolean;
  RefreshParse: boolean;
  IncludeOnlineSearch: boolean;
  RefreshExplicitIds: boolean;
  ScannedFileCount: number;
  CandidateCount: number;
  Results: MediaFileMatchScanResult[];
}

export interface ListResult<T> {
  Total: number;
  List: T[];
}

export const fileReviewApi = {
  getUnmatched: (page = 1, pageSize = 50, includeIgnored = false) =>
    api.get<ListResult<MediaFileReviewItem>>(
      `/api/v3/MediaFileReview/Files/Unmatched?page=${page}&pageSize=${pageSize}&includeIgnored=${includeIgnored}`
    ),
  getFile: (fileID: number) =>
    api.get<MediaFileReviewItem>(`/api/v3/MediaFileReview/Files/${fileID}`),
  refreshParse: (fileID: number) =>
    api.post<MediaFileReviewItem>(`/api/v3/MediaFileReview/Files/${fileID}/RefreshParse`),
  ignoreFile: (fileID: number, reason?: string) =>
    api.post<MediaFileReviewItem>(
      `/api/v3/MediaFileReview/Files/${fileID}/Ignore`,
      reason ? { Reason: reason } : undefined
    ),
  unignoreFile: (fileID: number) =>
    api.post<MediaFileReviewItem>(`/api/v3/MediaFileReview/Files/${fileID}/Unignore`),
  scanMatches: (fileID: number, includeOnlineSearch = false, refreshExplicitIds = false) =>
    api.post<MediaFileMatchScanResult>(
      `/api/v3/MediaFileReview/Files/${fileID}/ScanMatches?includeOnlineSearch=${includeOnlineSearch}&refreshExplicitIds=${refreshExplicitIds}`
    ),
  scanAllMatches: (includeIgnored = false, includeOnlineSearch = false) =>
    api.post<MediaFileMatchBatchScanResult>(
      `/api/v3/MediaFileReview/Files/ScanMatches?includeIgnored=${includeIgnored}&includeOnlineSearch=${includeOnlineSearch}`
    ),
  getFileCandidates: (fileID: number) =>
    api.get<MediaFileMatchCandidate[]>(`/api/v3/MediaFileReview/Files/${fileID}/Candidates`),
  approveCandidate: (candidateID: number) =>
    api.post<MediaFileReviewItem>(`/api/v3/MediaFileReview/Candidates/${candidateID}/Approve`),
  rejectCandidate: (candidateID: number) =>
    api.del<void>(`/api/v3/MediaFileReview/Candidates/${candidateID}`),
  clearManualMatch: (fileID: number) =>
    api.del<MediaFileReviewItem>(`/api/v3/MediaFileReview/Files/${fileID}/ManualMatch`),
};
