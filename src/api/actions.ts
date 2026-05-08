import { api } from './client';

export const actionsApi = {
  runImport: () => api.get<void>('/api/v3/Action/RunImport'),
  importNewFiles: () => api.get<void>('/api/v3/Action/ImportNewFiles'),
  updateAllImages: () => api.get<void>('/api/v3/Action/UpdateAllImages'),
  validateAllImages: () => api.get<void>('/api/v3/Action/ValidateAllImages'),
  searchForTmdbMatches: () => api.get<void>('/api/v3/Action/SearchForTmdbMatches'),
  updateAllTmdbShows: () => api.get<void>('/api/v3/Action/UpdateAllTmdbShows'),
  updateAllTmdbMovies: () => api.get<void>('/api/v3/Action/UpdateAllTmdbMovies'),
  removeMissingFiles: (removeFromMyList = true) =>
    api.get<void>(`/api/v3/Action/RemoveMissingFiles/${removeFromMyList}`),
  syncMyList: () => api.get<void>('/api/v3/Action/SyncMyList'),
  updateAllAniDBInfo: () => api.get<void>('/api/v3/Action/UpdateAllAniDBInfo'),
  updateAllMediaInfo: () => api.get<void>('/api/v3/Action/UpdateAllMediaInfo'),
  updateSeriesStats: () => api.get<void>('/api/v3/Action/UpdateSeriesStats'),
  recreateAllGroups: () => api.get<void>('/api/v3/Action/RecreateAllGroups'),
  downloadMissingTmdbPeople: () => api.get<void>('/api/v3/Action/DownloadMissingTmdbPeople'),
};
