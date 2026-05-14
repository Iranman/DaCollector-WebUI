import { api } from './client';
import type { ComponentVersion } from './init';

export type ReleaseChannel = 'Auto' | 'Debug' | 'Stable' | 'Dev';

export interface DotNetVersion {
  Major?: number;
  Minor?: number;
  Build?: number;
  Revision?: number;
}

export interface WebUITheme {
  ID: string;
  Name: string;
  Description?: string;
  Author: string;
  IsPreview: boolean;
  IsInstalled: boolean;
  Version?: string | DotNetVersion;
  Tags: string[];
  URL?: string;
  CSS?: string;
}

function releaseQuery(channel: ReleaseChannel, force = false, allowIncompatible = false) {
  return `channel=${channel}&force=${force}&allowIncompatible=${allowIncompatible}`;
}

export const webuiApi = {
  listThemes: (forceRefresh = false) => api.get<WebUITheme[]>(`/api/v3/WebUI/Theme?forceRefresh=${forceRefresh}`),
  addThemeFromUrl: (url: string, preview = false) =>
    api.post<WebUITheme>('/api/v3/WebUI/Theme/AddFromURL', { URL: url, Preview: preview }),
  deleteTheme: (themeId: string) => api.del<void>(`/api/v3/WebUI/Theme/${encodeURIComponent(themeId)}`),
  updateTheme: (themeId: string) => api.post<WebUITheme>(`/api/v3/WebUI/Theme/${encodeURIComponent(themeId)}/Update`),
  latestVersion: (channel: ReleaseChannel = 'Auto', force = false, allowIncompatible = false) =>
    api.get<ComponentVersion>(`/api/v3/WebUI/LatestVersion?${releaseQuery(channel, force, allowIncompatible)}`),
  latestServerVersion: (channel: ReleaseChannel = 'Auto', force = false) =>
    api.get<ComponentVersion>(`/api/v3/WebUI/LatestServerVersion?channel=${channel}&force=${force}`),
  update: (channel: ReleaseChannel = 'Auto', allowIncompatible = false) =>
    api.post<void>(`/api/v3/WebUI/Update?channel=${channel}&allowIncompatible=${allowIncompatible}`),
  reportManualUpdate: () => api.post<void>('/api/v3/WebUI/Update/ReportManualUpdate'),
};
