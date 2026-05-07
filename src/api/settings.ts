import { api } from './client';

export interface ServerSettings {
  AniDB?: {
    Username?: string;
    Password?: string;
  };
  TMDB?: {
    ApiKey?: string;
  };
  Plex?: {
    Token?: string;
  };
}

export const settingsApi = {
  get: () => api.get<ServerSettings>('/api/v3/Settings'),
  update: (body: Partial<ServerSettings>) => api.patch<ServerSettings>('/api/v3/Settings', body),
};
