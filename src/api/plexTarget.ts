import { api } from './client';

export interface PlexServerIdentity {
  BaseUrl: string;
  Reachable: boolean;
  StatusCode?: number;
  Status: string;
  MachineIdentifier?: string;
  Version?: string;
  Claimed?: boolean;
}

export interface PlexLibrarySection {
  Key: string;
  Title: string;
  Type: string;
  Scanner?: string;
  Agent?: string;
}

export const plexTargetApi = {
  getIdentity: () => api.get<PlexServerIdentity>('/api/v3/PlexTarget/Identity'),
  getLibraries: () => api.get<PlexLibrarySection[]>('/api/v3/PlexTarget/Library'),
};
