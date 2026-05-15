import { api } from './client';
import { ConfigurationInfo } from './configuration';
import { PluginInfo, VersionValue } from './plugins';

export interface HashingSummary {
  ParallelMode: boolean;
  ProviderCount: number;
  AllAvailableHashTypes: string[];
  AllEnabledHashTypes: string[];
}

export interface HashProvider {
  ID: string;
  Version: VersionValue;
  Name: string;
  Description?: string;
  AvailableHashTypes: string[];
  EnabledHashTypes: string[];
  Configuration?: ConfigurationInfo;
  Plugin: PluginInfo;
}

export const hashingApi = {
  summary: () => api.get<HashingSummary>('/api/v3/Hashing/Summary'),
  providers: () => api.get<HashProvider[]>('/api/v3/Hashing/Provider'),
  provider: (providerID: string) => api.get<HashProvider>(`/api/v3/Hashing/Provider/${encodeURIComponent(providerID)}`),
};
