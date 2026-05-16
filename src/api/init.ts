import { api } from './client';

export type StartupState = 'Waiting' | 'Starting' | 'Started' | 'Failed';

export interface ServerStatus {
  State: StartupState;
  StartupMessage?: string;
  BootstrappedAt?: string;
  StartedAt?: string;
  Uptime?: string;
  StartupTime?: string;
  CanShutdown?: boolean;
  CanRestart?: boolean;
}

export interface Credentials {
  Username: string;
  Password: string;
}

export interface ComponentVersion {
  Version?: string;
  MinimumServerVersion?: string;
  Commit?: string;
  ReleaseChannel?: string | number;
  ReleaseDate?: string;
  Tag?: string;
  Description?: string;
}

export interface ComponentVersionSet {
  Server: ComponentVersion;
  MediaInfo?: ComponentVersion;
  WebUI?: ComponentVersion;
}

export interface ProviderTestResult {
  Success: boolean;
  Error?: string | null;
}

export const initApi = {
  getStatus: () => api.get<ServerStatus>('/api/v3/Init/Status'),
  setDefaultUser: (creds: Credentials) => api.post<void>('/api/v3/Init/DefaultUser', creds),
  completeSetup: () => api.post<void>('/api/v3/Init/CompleteSetup'),
  resetSetup: () => api.post<void>('/api/v3/Init/ResetSetup'),
  getVersion: () => api.get<ComponentVersionSet>('/api/v3/Init/Version'),
  testTmdbKey: (apiKey: string) =>
    api.post<ProviderTestResult>('/api/v3/Init/Provider/TMDB/Test', { ApiKey: apiKey }),
  testTvdbKey: (apiKey: string, pin?: string) =>
    api.post<ProviderTestResult>('/api/v3/Init/Provider/TVDB/Test', { Enabled: true, ApiKey: apiKey, Pin: pin ?? null }),
};
