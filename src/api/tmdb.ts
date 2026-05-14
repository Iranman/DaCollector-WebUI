import { api } from './client';
import { ListResult } from './media';

export type TmdbMediaKind = 'movie' | 'show';

export interface RatingDto {
  Value: number;
  MaxValue: number;
  Source: string;
  Type?: string;
  Votes?: number;
}

export interface RemoteSearchMovie {
  ID: number;
  Title: string;
  OriginalTitle: string;
  OriginalLanguage: string;
  Overview: string;
  IsRestricted: boolean;
  IsVideo: boolean;
  ReleasedAt?: string;
  Poster?: string;
  Backdrop?: string;
  UserRating: RatingDto;
  Genres: string[];
}

export interface RemoteSearchShow {
  ID: number;
  Title: string;
  OriginalTitle: string;
  OriginalLanguage: string;
  Overview: string;
  FirstAiredAt?: string;
  Poster?: string;
  Backdrop?: string;
  UserRating: RatingDto;
  Genres: string[];
}

export interface DaCollectorSeriesDto {
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
  Description: string;
  HasCustomName: boolean;
  IsFavorite: boolean;
  Sizes?: {
    ManualLinks?: number;
    Local?: Record<string, number>;
    Missing?: Record<string, number>;
    Total?: Record<string, number>;
  };
  Created: string;
  Updated: string;
}

export interface DaCollectorFileLocationDto {
  ID: number;
  FileID: number;
  ManagedFolderID: number;
  RelativePath: string;
  AbsolutePath?: string;
  IsAccessible: boolean;
}

export interface DaCollectorFileHashDto {
  Type: string;
  Value: string;
}

export interface DaCollectorFileDto {
  ID: number;
  Size: number;
  IsVariation: boolean;
  IsIgnored: boolean;
  Hashes: DaCollectorFileHashDto[];
  Locations: DaCollectorFileLocationDto[];
  Resolution?: string;
  Duration: string;
  Imported?: string;
  Created: string;
  Updated: string;
}

export interface TmdbRefreshMovieBody {
  Force: boolean;
  DownloadImages: boolean;
  DownloadCrewAndCast?: boolean | null;
  DownloadCollections?: boolean | null;
  Immediate: boolean;
  SkipIfExists: boolean;
}

export interface TmdbRefreshShowBody {
  Force: boolean;
  DownloadImages: boolean;
  DownloadCrewAndCast?: boolean | null;
  DownloadAlternateOrdering?: boolean | null;
  DownloadNetworks?: boolean | null;
  Immediate: boolean;
  QuickRefresh: boolean;
}

export interface TmdbDownloadImagesBody {
  Force: boolean;
  Immediate: boolean;
}

export interface TmdbOrderingInformation {
  OrderingID: string;
  OrderingType?: string;
  OrderingName: string;
  EpisodeCount: number;
  HiddenEpisodeCount: number;
  SeasonCount: number;
  IsDefault: boolean;
  IsPreferred: boolean;
  InUse: boolean;
}

function segment(kind: TmdbMediaKind) {
  return kind === 'movie' ? 'Movie' : 'Show';
}

function query(parts: Record<string, string | number | boolean | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(parts)) {
    if (value != null && value !== '') params.set(key, String(value));
  }
  return params.toString();
}

export const tmdbApi = {
  searchMovies: (search: string, year = 0, page = 1, pageSize = 6, includeRestricted = false) =>
    api.get<ListResult<RemoteSearchMovie>>(
      `/api/v3/Tmdb/Movie/Online/Search?${query({ query: search, includeRestricted, year, page, pageSize })}`
    ),
  searchShows: (search: string, year = 0, page = 1, pageSize = 6, includeRestricted = false) =>
    api.get<ListResult<RemoteSearchShow>>(
      `/api/v3/Tmdb/Show/Online/Search?${query({ query: search, includeRestricted, year, page, pageSize })}`
    ),
  getLinkedSeries: (kind: TmdbMediaKind, providerID: number) =>
    api.get<DaCollectorSeriesDto[]>(`/api/v3/Tmdb/${segment(kind)}/${providerID}/DaCollector/Series`),
  getLinkedFiles: (kind: TmdbMediaKind, providerID: number, page = 1, pageSize = 100) =>
    api.get<ListResult<DaCollectorFileDto>>(
      `/api/v3/Tmdb/${segment(kind)}/${providerID}/DaCollector/File?page=${page}&pageSize=${pageSize}`
    ),
  refreshMovie: (movieID: number, body: Partial<TmdbRefreshMovieBody> = {}) =>
    api.post<void>(`/api/v3/Tmdb/Movie/${movieID}/Action/Refresh`, {
      Force: false,
      DownloadImages: true,
      DownloadCrewAndCast: null,
      DownloadCollections: null,
      Immediate: false,
      SkipIfExists: false,
      ...body,
    }),
  refreshShow: (showID: number, body: Partial<TmdbRefreshShowBody> = {}) =>
    api.post<void>(`/api/v3/Tmdb/Show/${showID}/Action/Refresh`, {
      Force: false,
      DownloadImages: true,
      DownloadCrewAndCast: null,
      DownloadAlternateOrdering: null,
      DownloadNetworks: null,
      Immediate: false,
      QuickRefresh: false,
      ...body,
    }),
  downloadMovieImages: (movieID: number, body: Partial<TmdbDownloadImagesBody> = {}) =>
    api.post<void>(`/api/v3/Tmdb/Movie/${movieID}/Action/DownloadImages`, {
      Force: false,
      Immediate: false,
      ...body,
    }),
  downloadShowImages: (showID: number, body: Partial<TmdbDownloadImagesBody> = {}) =>
    api.post<void>(`/api/v3/Tmdb/Show/${showID}/Action/DownloadImages`, {
      Force: false,
      Immediate: false,
      ...body,
    }),
  getShowOrdering: (showID: number) =>
    api.get<TmdbOrderingInformation[]>(`/api/v3/Tmdb/Show/${showID}/Ordering`),
  setPreferredShowOrdering: (showID: number, alternateOrderingID: string) =>
    api.post<void>(`/api/v3/Tmdb/Show/${showID}/Ordering/SetPreferred`, {
      AlternateOrderingID: alternateOrderingID,
    }),
};
