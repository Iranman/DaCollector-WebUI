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

export const initApi = {
  getStatus: () => api.get<ServerStatus>('/api/v3/Init/Status'),
  setDefaultUser: (creds: Credentials) => api.post<void>('/api/v3/Init/DefaultUser', creds),
  completeSetup: () => api.post<void>('/api/v3/Init/CompleteSetup'),
  getVersion: () => api.get<{ Server: { Version: string; Commit?: string } }>('/api/v3/Init/Version'),
};
