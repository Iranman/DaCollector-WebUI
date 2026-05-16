import { api } from './client';

export interface QualityProfile {
  Id: number;
  Name: string;
}

export interface RootFolder {
  Id: number;
  Path: string;
}

export const radarrApi = {
  test: () => api.get<string>('/api/v3/Radarr/Test'),
  getQualityProfiles: () => api.get<QualityProfile[]>('/api/v3/Radarr/QualityProfile'),
  getRootFolders: () => api.get<RootFolder[]>('/api/v3/Radarr/RootFolder'),
  requestMovie: (tmdbId: number) =>
    api.post<void>('/api/v3/Radarr/Request', { TmdbId: tmdbId }),
};
