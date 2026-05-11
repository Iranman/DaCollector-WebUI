import { api } from './client';

export interface MediaExternalIdDto {
  Source: string;
  Value: string;
}

export interface MediaMovieDto {
  Provider: string;
  ProviderID: number;
  Title: string;
  OriginalTitle: string;
  Overview?: string;
  Year?: number;
  ReleasedAt?: string;
  RuntimeMinutes?: number;
  Genres: string[];
  PosterPath?: string;
  BackdropPath?: string;
  ExternalIDs: MediaExternalIdDto[];
  CreatedAt: string;
  LastUpdatedAt: string;
}

export interface MediaShowDto {
  Provider: string;
  ProviderID: number;
  Title: string;
  OriginalTitle: string;
  Overview?: string;
  Year?: number;
  FirstAiredAt?: string;
  LastAiredAt?: string;
  Status?: string;
  Network?: string;
  SeasonCount?: number;
  EpisodeCount?: number;
  Genres: string[];
  PosterPath?: string;
  BackdropPath?: string;
  ExternalIDs: MediaExternalIdDto[];
  CreatedAt: string;
  LastUpdatedAt: string;
}

export interface ListResult<T> {
  Total: number;
  List: T[];
}

export const mediaApi = {
  getMovies: (provider = 'tmdb', search?: string, page = 1, pageSize = 50) => {
    let url = `/api/v3/Media/Movies?provider=${provider}&page=${page}&pageSize=${pageSize}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    return api.get<ListResult<MediaMovieDto>>(url);
  },
  getShows: (provider = 'all', search?: string, page = 1, pageSize = 50) => {
    let url = `/api/v3/Media/Shows?provider=${provider}&page=${page}&pageSize=${pageSize}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    return api.get<ListResult<MediaShowDto>>(url);
  },
};
