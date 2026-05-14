import { api } from './client';

export type VersionValue = string | {
  Major?: number;
  Minor?: number;
  Build?: number;
  Revision?: number;
};

export interface PackageThumbnailInfo {
  Url?: string;
  MimeType?: string;
}

export interface PluginInfo {
  ID: string;
  Name: string;
  Description: string;
  Version: VersionValue;
  RuntimeIdentifier: string;
  AbstractionVersion: VersionValue;
  SourceRevision?: string;
  ReleaseTag?: string;
  Channel: string;
  ReleasedAt: string;
  Authors?: string;
  LoadOrder: number;
  Thumbnail?: PackageThumbnailInfo;
  InstalledAt: string;
  IsInstalled: boolean;
  IsEnabled: boolean;
  IsActive: boolean;
  RestartPending: boolean;
  CanLoad: boolean;
  CanUninstall: boolean;
  ContainingDirectory?: string;
  DLLs: string[];
}

export interface PackageArchiveInfo {
  RuntimeIdentifier: string;
  AbstractionVersion: VersionValue;
  ArchiveUrl: string;
  ArchiveChecksum: string;
}

export interface PackageReleaseInfo {
  RepositoryID: string;
  Version: VersionValue;
  Tag?: string;
  SourceRevision?: string;
  ReleasedAt: string;
  Channel: string;
  ReleaseNotes?: string;
  Archives: PackageArchiveInfo[];
}

export interface PackageManifestInfo {
  PackageID: string;
  Name: string;
  Overview: string;
  Authors: string;
  Tags: string[];
  Thumbnail?: PackageThumbnailInfo;
  Releases: PackageReleaseInfo[];
  LastFetchedAt: string;
}

export interface PackageRepositoryInfo {
  ID: string;
  Name: string;
  Url: string;
  LastFetchedAt?: string;
  StaleTime?: string;
}

export interface PackageInfo {
  Repository?: PackageRepositoryInfo;
  Manifest: PackageManifestInfo;
  Release: PackageReleaseInfo;
  Archive: PackageArchiveInfo;
  Plugin?: PluginInfo;
}

export interface ListResult<T> {
  Total: number;
  List: T[];
}

export interface PackageQuery {
  query?: string;
  page?: number;
  pageSize?: number;
  onlyCompatible?: boolean;
  onlyLatest?: boolean;
  allowSync?: boolean;
  forceSyncNow?: boolean;
}

function packageQueryString(options: PackageQuery = {}) {
  const params = new URLSearchParams();
  params.set('page', String(options.page ?? 1));
  params.set('pageSize', String(options.pageSize ?? 20));
  params.set('onlyCompatible', String(options.onlyCompatible ?? true));
  params.set('onlyLatest', String(options.onlyLatest ?? true));
  params.set('allowSync', String(options.allowSync ?? false));
  params.set('forceSyncNow', String(options.forceSyncNow ?? false));
  if (options.query) params.set('query', options.query);
  return params.toString();
}

export const pluginsApi = {
  listPlugins: (query = '') => {
    const suffix = query ? `?query=${encodeURIComponent(query)}` : '';
    return api.get<PluginInfo[]>(`/api/v3/Plugin${suffix}`);
  },
  setEnabled: (pluginID: string, isEnabled: boolean) =>
    api.put<PluginInfo>(`/api/v3/Plugin/${encodeURIComponent(pluginID)}`, { IsEnabled: isEnabled }),
  uninstall: (pluginID: string, purgeConfiguration = true) =>
    api.del<void>(`/api/v3/Plugin/${encodeURIComponent(pluginID)}?purgeConfiguration=${purgeConfiguration}`),
  listPackages: (options: PackageQuery = {}) =>
    api.get<ListResult<PackageInfo>>(`/api/v3/Plugin/Package?${packageQueryString(options)}`),
  listLocalPackages: (query = '', page = 1, pageSize = 20) => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (query) params.set('query', query);
    return api.get<ListResult<PackageInfo>>(`/api/v3/Plugin/Package/Local?${params.toString()}`);
  },
  listRepositories: () => api.get<PackageRepositoryInfo[]>('/api/v3/Plugin/Package/Repository'),
  syncRepositories: (forceSync = true) =>
    api.post<PackageRepositoryInfo[]>(`/api/v3/Plugin/Package/Repository/Sync?forceSync=${forceSync}`),
  installPackage: (packageID: string, releaseVersion?: string, abstractionVersion?: string, runtimeIdentifier?: string) => {
    const params = new URLSearchParams();
    if (releaseVersion) params.set('releaseVersion', releaseVersion);
    if (abstractionVersion) params.set('abstractionVersion', abstractionVersion);
    if (runtimeIdentifier) params.set('runtimeIdentifier', runtimeIdentifier);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return api.post<PluginInfo>(`/api/v3/Plugin/Package/${encodeURIComponent(packageID)}/Install${suffix}`);
  },
  scheduleUpdateCheck: (forceSync = true, performUpgrade = false) =>
    api.post<void>('/api/v3/Plugin/Package/ScheduleCheckForUpdates', {
      ForceSync: forceSync,
      PerformUpgrade: performUpgrade,
    }),
};
