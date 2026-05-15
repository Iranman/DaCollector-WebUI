import { api } from './client';
import { ConfigurationInfo } from './configuration';
import { PluginInfo, VersionValue } from './plugins';

export interface ReleaseInfoSummary {
  ParallelMode: boolean;
  ProviderCount: number;
}

export interface ReleaseInfoProvider {
  ID: string;
  Version: VersionValue;
  Name: string;
  Description?: string;
  Priority: number;
  IsEnabled: boolean;
  Configuration?: ConfigurationInfo;
  Plugin: PluginInfo;
}

export const releaseInfoApi = {
  summary: () => api.get<ReleaseInfoSummary>('/api/v3/ReleaseInfo/Summary'),
  providers: () => api.get<ReleaseInfoProvider[]>('/api/v3/ReleaseInfo/Provider'),
  provider: (providerID: string) => api.get<ReleaseInfoProvider>(`/api/v3/ReleaseInfo/Provider/${encodeURIComponent(providerID)}`),
};
