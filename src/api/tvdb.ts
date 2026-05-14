import { api } from './client';

export type TvdbMediaKind = 'movie' | 'show';

function segment(kind: TvdbMediaKind) {
  return kind === 'movie' ? 'Movie' : 'Show';
}

export const tvdbApi = {
  refresh: (kind: TvdbMediaKind, providerID: number) =>
    api.post<void>(`/api/v3/Tvdb/${segment(kind)}/${providerID}/Refresh`),
  link: (kind: TvdbMediaKind, providerID: number, seriesID: number) =>
    api.post<void>(`/api/v3/Tvdb/${segment(kind)}/${providerID}/Link/${seriesID}`),
  unlink: (kind: TvdbMediaKind, providerID: number, seriesID: number) =>
    api.del<void>(`/api/v3/Tvdb/${segment(kind)}/${providerID}/Link/${seriesID}`),
};
