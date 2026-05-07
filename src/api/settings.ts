import { api } from './client';

export interface ServerSettings {
  AniDB?: {
    Username?: string;
    Password?: string;
    ClientPort?: number;
    MaxRelationDepth?: number;
  };
  TMDB?: {
    ApiKey?: string;
    AutoLink?: boolean;
    AutoLinkRestricted?: boolean;
    IncludeRestricted?: boolean;
    DownloadCrewAndCast?: boolean;
    DownloadMovieCollections?: boolean;
    DownloadAlternateOrdering?: boolean;
    DownloadBackdrops?: boolean;
    MaxBackdrops?: number;
    DownloadPosters?: boolean;
    MaxPosters?: number;
    DownloadLogos?: boolean;
    MaxLogos?: number;
    DownloadEpisodeThumbnails?: boolean;
    MaxEpisodeThumbnails?: number;
    DownloadStaffImages?: boolean;
    MaxStaffImages?: number;
    DownloadStudioImages?: boolean;
  };
  Plex?: {
    Token?: string;
  };
  Import?: {
    RunOnStart?: boolean;
    ScanDropFoldersOnStart?: boolean;
    FileQualityCheck?: boolean;
    MaxAutoScanFiles?: number;
  };
  Collection?: {
    AutoGroupSeries?: boolean;
    UseSeriesRelationGrouping?: boolean;
    ExcludeRelationTypes?: string[];
    PreferredSeriesLanguage?: string;
    PreferredEpisodeLanguage?: string;
  };
  Server?: {
    Name?: string;
    AutoUpdate?: boolean;
  };
  Database?: {
    SQLitePath?: string;
  };
  Trakt?: {
    Enabled?: boolean;
    TokenValidUntil?: string;
    SyncFrequency?: string;
  };
}

export const settingsApi = {
  get: () => api.get<ServerSettings>('/api/v3/Settings'),
  update: (body: Partial<ServerSettings>) => api.patch<ServerSettings>('/api/v3/Settings', body),
};
