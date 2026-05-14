import { api } from './client';

export const actionsApi = {
  runImport: () => api.get<void>('/api/v3/Action/RunImport'),
  importNewFiles: () => api.get<void>('/api/v3/Action/ImportNewFiles'),
  sendWatchStatesToTrakt: () => api.get<void>('/api/v3/Action/SendWatchStatesToTrakt'),
  getWatchStatesFromTrakt: () => api.get<void>('/api/v3/Action/GetWatchStatesFromTrakt'),
  updateAllImages: () => api.get<void>('/api/v3/Action/UpdateAllImages'),
  validateAllImages: () => api.get<void>('/api/v3/Action/ValidateAllImages'),
  searchForTmdbMatches: () => api.get<void>('/api/v3/Action/SearchForTmdbMatches'),
  updateAllTmdbShows: () => api.get<void>('/api/v3/Action/UpdateAllTmdbShows'),
  updateAllTmdbMovies: () => api.get<void>('/api/v3/Action/UpdateAllTmdbMovies'),
  purgeAllUnusedTmdbMovies: () => api.get<void>('/api/v3/Action/PurgeAllUnusedTmdbMovies'),
  purgeAllTmdbMovieCollections: () => api.get<void>('/api/v3/Action/PurgeAllTmdbMovieCollections'),
  purgeAllUnusedTmdbImages: () => api.get<void>('/api/v3/Action/PurgeAllUnusedTmdbImages'),
  purgeAllUnusedTmdbShows: () => api.get<void>('/api/v3/Action/PurgeAllUnusedTmdbShows'),
  purgeAllTmdbShowAlternateOrderings: () => api.get<void>('/api/v3/Action/PurgeAllTmdbShowAlternateOrderings'),
  purgeAllTmdbLinks: (removeShowLinks = true, removeMovieLinks = true, resetAutoLinkingState?: boolean) => {
    let url = `/api/v3/Action/PurgeAllTmdbLinks?removeShowLinks=${removeShowLinks}&removeMovieLinks=${removeMovieLinks}`;
    if (resetAutoLinkingState != null) url += `&resetAutoLinkingState=${resetAutoLinkingState}`;
    return api.get<void>(url);
  },
  removeMissingFiles: (removeFromMyList = true) =>
    api.get<void>(`/api/v3/Action/RemoveMissingFiles/${removeFromMyList}`),
  purgeAllUsedReleases: (removeFromMyList = true) =>
    api.get<void>(`/api/v3/Action/PurgeAllUsedReleases?removeFromMylist=${removeFromMyList}`),
  purgeAllUnusedReleases: (removeFromMyList = true) =>
    api.get<void>(`/api/v3/Action/PurgeAllUnusedReleases?removeFromMylist=${removeFromMyList}`),
  updateAllMediaInfo: () => api.get<void>('/api/v3/Action/UpdateAllMediaInfo'),
  updateSeriesStats: () => api.get<void>('/api/v3/Action/UpdateSeriesStats'),
  recreateAllGroups: () => api.get<void>('/api/v3/Action/RecreateAllGroups'),
  renameAllGroups: () => api.get<void>('/api/v3/Action/RenameAllGroups'),
  plexSyncAll: () => api.get<void>('/api/v3/Action/PlexSyncAll'),
  downloadMissingTmdbPeople: () => api.get<void>('/api/v3/Action/DownloadMissingTmdbPeople'),
};
