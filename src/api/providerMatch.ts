import { api } from './client';

export type ProviderMatchProvider = 'tmdb' | 'tvdb' | string;
export type ProviderMatchType = 'movie' | 'show' | string;
export type ProviderMatchStatus = 'Pending' | 'Approved' | 'Rejected' | string;

export interface ProviderMatchCandidate {
  ProviderMatchCandidateID: number;
  MediaSeriesID: number;
  Provider: ProviderMatchProvider;
  ProviderItemID: number;
  ProviderType: ProviderMatchType;
  Title: string;
  Year?: number;
  ConfidenceScore: number;
  ReasonsJson?: string;
  Reasons?: string[];
  Status: ProviderMatchStatus;
  ReviewedAt?: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface ProviderMatchScanResult {
  MediaSeriesID: number;
  Title?: string;
  CandidateCount: number;
  Scanned: boolean;
  Message?: string;
}

export interface ProviderMatchBatchScanResult {
  OnlyUnmatched: boolean;
  ScannedSeriesCount: number;
  CandidateCount: number;
  Results: ProviderMatchScanResult[];
}

export const providerMatchApi = {
  getCandidates: () =>
    api.get<ProviderMatchCandidate[]>('/api/v3/ProviderMatch/Candidates'),
  getCandidatesForSeries: (mediaSeriesID: number) =>
    api.get<ProviderMatchCandidate[]>(`/api/v3/ProviderMatch/Candidates/Series/${mediaSeriesID}`),
  scanSeries: (mediaSeriesID: number) =>
    api.post<ProviderMatchScanResult>(`/api/v3/ProviderMatch/Series/${mediaSeriesID}/Scan`),
  scanAll: (onlyUnmatched = true) =>
    api.post<ProviderMatchBatchScanResult>(`/api/v3/ProviderMatch/Scan?onlyUnmatched=${onlyUnmatched}`),
  approve: (candidateID: number) =>
    api.post<void>(`/api/v3/ProviderMatch/Candidates/${candidateID}/Approve`),
  reject: (candidateID: number) =>
    api.del<void>(`/api/v3/ProviderMatch/Candidates/${candidateID}`),
};
