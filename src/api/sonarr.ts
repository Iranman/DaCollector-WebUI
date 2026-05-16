import { api } from './client';

export interface QualityProfile {
  Id: number;
  Name: string;
}

export interface RootFolder {
  Id: number;
  Path: string;
}

export const sonarrApi = {
  test: () => api.get<string>('/api/v3/Sonarr/Test'),
  getQualityProfiles: () => api.get<QualityProfile[]>('/api/v3/Sonarr/QualityProfile'),
  getRootFolders: () => api.get<RootFolder[]>('/api/v3/Sonarr/RootFolder'),
  requestShow: (tvdbId: number) =>
    api.post<void>('/api/v3/Sonarr/Request', { TvdbId: tvdbId }),
};
