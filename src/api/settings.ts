import { api } from './client';

export interface ServerSettings {
  AutoGroupSeries?: boolean;
  AutoGroupSeriesRelationExclusions?: string[];
  AutoGroupSeriesUseScoreAlgorithm?: boolean;
  FileQualityFilterEnabled?: boolean;
  TMDB?: {
    UserApiKey?: string;
    AutoLink?: boolean;
    AutoLinkRestricted?: boolean;
    AutoDownloadCrewAndCast?: boolean;
    AutoDownloadCollections?: boolean;
    AutoDownloadAlternateOrdering?: boolean;
    AutoDownloadBackdrops?: boolean;
    MaxAutoBackdrops?: number;
    AutoDownloadPosters?: boolean;
    MaxAutoPosters?: number;
    AutoDownloadLogos?: boolean;
    MaxAutoLogos?: number;
    AutoDownloadThumbnails?: boolean;
    MaxAutoThumbnails?: number;
    AutoDownloadStaffImages?: boolean;
    MaxAutoStaffImages?: number;
    AutoDownloadStudioImages?: boolean;
  };
  TVDB?: {
    Enabled?: boolean;
    ApiKey?: string;
    Pin?: string;
    CacheExpirationDays?: number;
  };
  Import?: {
    RunOnStart?: boolean;
    ScanDropFoldersOnStart?: boolean;
    MaxAutoScanAttemptsPerFile?: number;
  };
  Language?: {
    SeriesTitleLanguageOrder?: string[];
    EpisodeTitleLanguageOrder?: string[];
  };
  Plex?: {
    Token?: string;
  };
  TraktTv?: {
    Enabled?: boolean;
    TokenExpirationDate?: string;
    SyncFrequency?: string;
  };
  Database?: {
    Type?: string;
  };
}

type PatchOp = { op: 'replace'; path: string; value: unknown };

function toPatch(obj: Record<string, unknown>, prefix = ''): PatchOp[] {
  const ops: PatchOp[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = `${prefix}/${key}`;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      ops.push(...toPatch(value as Record<string, unknown>, path));
    } else {
      ops.push({ op: 'replace', path, value });
    }
  }
  return ops;
}

export const settingsApi = {
  get: () => api.get<ServerSettings>('/api/v3/Settings'),
  update: (settings: Partial<ServerSettings>) =>
    api.patch<void>('/api/v3/Settings', toPatch(settings as Record<string, unknown>)),
};
