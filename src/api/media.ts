import { api } from './client';

export type MediaProvider = 'tmdb' | 'tvdb';
export type MediaProviderFilter = MediaProvider | 'all';

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

export interface MediaSeasonDto {
  Provider: string;
  ProviderID: number;
  ShowProviderID: number;
  SeasonNumber: number;
  SeasonType?: string;
  Title: string;
  Overview?: string;
  EpisodeCount: number;
  Year?: number;
  PosterPath?: string;
  CreatedAt: string;
  LastUpdatedAt: string;
}

export interface MediaEpisodeDto {
  Provider: string;
  ProviderID: number;
  ShowProviderID: number;
  SeasonProviderID?: number;
  SeasonNumber: number;
  EpisodeNumber: number;
  Title: string;
  Overview?: string;
  RuntimeMinutes?: number;
  AiredAt?: string;
  ThumbnailPath?: string;
  IsHidden?: boolean;
  CreatedAt: string;
  LastUpdatedAt: string;
}

export interface MediaFileHashDto {
  Type: string;
  Value: string;
}

export interface MediaFileLocationDto {
  LocationID: number;
  ManagedFolderID: number;
  RelativePath: string;
  AbsolutePath?: string;
  IsAvailable: boolean;
}

export interface MediaFileDto {
  FileID: number;
  SizeBytes: number;
  IsIgnored: boolean;
  IsVariation: boolean;
  Resolution?: string;
  Duration: string;
  Hashes: MediaFileHashDto[];
  Locations: MediaFileLocationDto[];
  Review?: Record<string, unknown>;
  CreatedAt: string;
  UpdatedAt: string;
  ImportedAt?: string;
}

export interface ListResult<T> {
  Total: number;
  List: T[];
}

export const mediaApi = {
  getMovies: (provider: MediaProviderFilter = 'tmdb', search?: string, page = 1, pageSize = 50) => {
    let url = `/api/v3/Media/Movies?provider=${provider}&page=${page}&pageSize=${pageSize}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    return api.get<ListResult<MediaMovieDto>>(url);
  },
  getMovie: (provider: MediaProvider, providerID: number) =>
    api.get<MediaMovieDto>(`/api/v3/Media/Movies/${provider}/${providerID}`),
  getShows: (provider: MediaProviderFilter = 'all', search?: string, page = 1, pageSize = 50) => {
    let url = `/api/v3/Media/Shows?provider=${provider}&page=${page}&pageSize=${pageSize}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    return api.get<ListResult<MediaShowDto>>(url);
  },
  getShow: (provider: MediaProvider, providerID: number) =>
    api.get<MediaShowDto>(`/api/v3/Media/Shows/${provider}/${providerID}`),
  getShowSeasons: (provider: MediaProvider, providerID: number) =>
    api.get<MediaSeasonDto[]>(`/api/v3/Media/Shows/${provider}/${providerID}/Seasons`),
  getShowEpisodes: (provider: MediaProvider, providerID: number, seasonNumber?: number) => {
    let url = `/api/v3/Media/Shows/${provider}/${providerID}/Episodes`;
    if (seasonNumber != null) url += `?seasonNumber=${seasonNumber}`;
    return api.get<MediaEpisodeDto[]>(url);
  },
  getFiles: (search?: string, page = 1, pageSize = 50, includeReview = true, includeAbsolutePaths = false) => {
    let url = `/api/v3/Media/Files?page=${page}&pageSize=${pageSize}&includeReview=${includeReview}&includeAbsolutePaths=${includeAbsolutePaths}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    return api.get<ListResult<MediaFileDto>>(url);
  },
  getFile: (fileID: number, includeReview = true, includeAbsolutePaths = false) =>
    api.get<MediaFileDto>(`/api/v3/Media/Files/${fileID}?includeReview=${includeReview}&includeAbsolutePaths=${includeAbsolutePaths}`),
};
