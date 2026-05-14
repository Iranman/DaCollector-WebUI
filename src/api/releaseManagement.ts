import { api } from './client';
import { DaCollectorFileDto } from './tmdb';
import { ListResult } from './media';

export interface DaCollectorSeriesSummary {
  IDs: {
    ID: number;
    ParentGroup: number;
    TopLevelGroup: number;
    SourceID: number;
    TvDB: number[];
    IMDB: string[];
    TMDB: {
      Movie: number[];
      Show: number[];
    };
    MAL: number[];
  };
  Name: string;
  Size: number;
  EpisodeCount: number;
  Description: string;
  Created: string;
  Updated: string;
}

export interface DaCollectorEpisode {
  IDs: {
    ID: number;
    ParentSeries: number;
    SourceID: number;
    TvDB: number[];
    IMDB: string[];
    TMDB: {
      Episode: number[];
      Movie: number[];
      Show: number[];
    };
  };
  Name: string;
  Size: number;
  Description: string;
  Duration: string;
  IsHidden: boolean;
  WatchCount: number;
  Files?: DaCollectorFileDto[];
  Created: string;
  Updated: string;
}

export interface MissingFilters {
  collecting?: boolean;
  onlyFinishedSeries?: boolean;
}

function missingQuery(filters: MissingFilters, page: number, pageSize: number) {
  const params = new URLSearchParams();
  params.set('collecting', String(filters.collecting ?? false));
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  return params;
}

export const releaseManagementApi = {
  getDuplicateSeries: (page = 1, pageSize = 50, onlyFinishedSeries = false) =>
    api.get<ListResult<DaCollectorSeriesSummary>>(
      `/api/v3/ReleaseManagement/DuplicateFiles/Series?onlyFinishedSeries=${onlyFinishedSeries}&page=${page}&pageSize=${pageSize}`
    ),
  getDuplicateEpisodes: (page = 1, pageSize = 25) =>
    api.get<ListResult<DaCollectorEpisode>>(
      `/api/v3/ReleaseManagement/DuplicateFiles/Episodes?includeMediaInfo=false&includeXRefs=false&includeReleaseInfo=false&page=${page}&pageSize=${pageSize}`
    ),
  getMissingSeries: (filters: MissingFilters = {}, page = 1, pageSize = 50) => {
    const params = missingQuery(filters, page, pageSize);
    params.set('onlyFinishedSeries', String(filters.onlyFinishedSeries ?? false));
    return api.get<ListResult<DaCollectorSeriesSummary>>(`/api/v3/ReleaseManagement/MissingEpisodes/Series?${params}`);
  },
  getMissingEpisodes: (filters: MissingFilters = {}, page = 1, pageSize = 50) => {
    const params = missingQuery(filters, page, pageSize);
    params.set('includeFiles', 'false');
    params.set('includeMediaInfo', 'false');
    params.set('includeAbsolutePaths', 'false');
    params.set('includeXRefs', 'false');
    return api.get<ListResult<DaCollectorEpisode>>(`/api/v3/ReleaseManagement/MissingEpisodes/Episodes?${params}`);
  },
};
