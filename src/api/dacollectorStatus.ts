import { api } from './client';
import type { PlexLibrarySection, PlexServerIdentity } from './plexTarget';

export interface ProviderConnectionStatus {
  Provider: string | number;
  Name: string;
  Enabled: boolean;
  Configured: boolean;
  Ready: boolean;
  CredentialConfigured: boolean;
  SecondaryCredentialConfigured?: boolean;
  ConfigurationSource?: string;
  CacheExpirationDays?: number;
  CollectionBuilders: string[];
  Warnings: string[];
}

export interface CollectionManagerConnectionStatus {
  ScheduledSyncEnabled: boolean;
  SyncIntervalMinutes: number;
  CollectionCount: number;
  EnabledCollectionCount: number;
  CollectionBuilderCount: number;
}

export interface PlexTargetConnectionStatus {
  BaseUrl: string;
  SectionKey?: string;
  Configured: boolean;
  Ready: boolean;
  TokenConfigured: boolean;
  SectionKeyConfigured: boolean;
  Reachable: boolean;
  Identity: PlexServerIdentity;
  LibraryStatus: string;
  LibraryCount?: number;
  Libraries: PlexLibrarySection[];
  Warnings: string[];
}

export interface ServerCapabilityStatus {
  Key: string;
  Name: string;
  Completed: boolean;
  Status: string;
  Summary: string;
  Components: string[];
  ApiRoutes: string[];
  Notes: string[];
}

export interface DaCollectorStatus {
  Providers: ProviderConnectionStatus[];
  CollectionManager: CollectionManagerConnectionStatus;
  PlexTarget: PlexTargetConnectionStatus;
  ServerCapabilities: ServerCapabilityStatus[];
}

export const dacollectorStatusApi = {
  get: () => api.get<DaCollectorStatus>('/api/v3/DaCollectorStatus'),
  getProviders: () => api.get<ProviderConnectionStatus[]>('/api/v3/DaCollectorStatus/Providers'),
  getCapabilities: () => api.get<ServerCapabilityStatus[]>('/api/v3/DaCollectorStatus/Capabilities'),
  getPlex: () => api.get<PlexTargetConnectionStatus>('/api/v3/DaCollectorStatus/Plex'),
};
