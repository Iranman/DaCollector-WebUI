import { api } from './client';
import { ListResult } from './media';

export interface CollectionStats {
  FileCount: number;
  FileSize: number;
  SeriesCount: number;
  GroupCount: number;
  FinishedSeries: number;
  WatchedEpisodes: number;
  WatchedHours: number;
  PercentDuplicate: number;
  MissingEpisodes: number;
  MissingEpisodesCollecting: number;
  UnrecognizedFiles: number;
  SeriesWithMissingLinks: number;
  EpisodesWithMultipleFiles: number;
  FilesWithDuplicateLocations: number;
}

export interface DashboardSeriesSummary {
  Series: number;
  OVA: number;
  Movie: number;
  Special: number;
  Web: number;
  Other: number;
  MusicVideo: number;
  Unknown: number;
  None: number;
}

export interface DashboardTag {
  ID?: number;
  Name: string;
  Description?: string;
  Weight?: number;
  Source?: string;
}

export interface DashboardImage {
  ID: number;
  Type: string;
  Source: string;
  Available: boolean;
  Preferred: boolean;
  Disabled: boolean;
  RelativeFilepath?: string;
  Width?: number;
  Height?: number;
}

export interface DashboardEpisodeIDs {
  ID: number;
  Series: number;
  DaCollectorFile?: number;
  DaCollectorEpisode?: number;
  DaCollectorSeries?: number;
}

export interface DashboardEpisode {
  IDs: DashboardEpisodeIDs;
  Title: string;
  Number: number;
  Type: string;
  AirDate?: string;
  Duration: string;
  ResumePosition?: string;
  Watched?: string;
  SeriesTitle: string;
  SeriesPoster: DashboardImage;
  Thumbnail?: DashboardImage;
}

export interface DashboardSeries {
  IDs?: {
    ID?: number;
    ParentGroup?: number;
    TopLevelGroup?: number;
    SourceID?: number;
    TvDB?: number[];
    IMDB?: string[];
    TMDB?: {
      Movie?: number[];
      Show?: number[];
    };
    MAL?: number[];
  };
  ID?: number;
  Name?: string;
  Title?: string;
  Description?: string;
  Size?: number;
  EpisodeCount?: number;
  Created?: string;
  Updated?: string;
}

export const dashboardApi = {
  stats: () => api.get<CollectionStats>('/api/v3/Dashboard/Stats'),
  seriesSummary: () => api.get<DashboardSeriesSummary>('/api/v3/Dashboard/SeriesSummary'),
  topTags: (pageSize = 10) => api.get<DashboardTag[]>(`/api/v3/Dashboard/TopTags?pageSize=${pageSize}`),
  recentlyAddedEpisodes: (pageSize = 8) =>
    api.get<ListResult<DashboardEpisode>>(`/api/v3/Dashboard/RecentlyAddedEpisodes?pageSize=${pageSize}`),
  recentlyAddedSeries: (pageSize = 8) =>
    api.get<ListResult<DashboardSeries>>(`/api/v3/Dashboard/RecentlyAddedSeries?pageSize=${pageSize}`),
  continueWatchingEpisodes: (pageSize = 8) =>
    api.get<ListResult<DashboardEpisode>>(`/api/v3/Dashboard/ContinueWatchingEpisodes?pageSize=${pageSize}`),
  nextUpEpisodes: (pageSize = 8) =>
    api.get<ListResult<DashboardEpisode>>(`/api/v3/Dashboard/NextUpEpisodes?pageSize=${pageSize}`),
};
