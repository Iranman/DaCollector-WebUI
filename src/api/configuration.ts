import { api } from './client';

export interface PluginInfo {
  ID?: string;
  Name?: string;
  Version?: string;
  IsActive?: boolean;
}

export interface ConfigurationInfo {
  ID: string;
  Name: string;
  RestartPendingFor: string[];
  LoadedEnvironmentVariables: string[];
  Description?: string;
  IsHidden: boolean;
  IsBase: boolean;
  HasCustomActions: boolean;
  HasCustomNewFactory: boolean;
  HasCustomValidation: boolean;
  HasCustomSave: boolean;
  HasCustomLoad: boolean;
  HasLiveEdit: boolean;
  Plugin: PluginInfo;
}

export interface ConfigurationActionResult {
  ShowSaveMessage?: boolean;
  Refresh?: boolean;
  PatchOperations?: unknown[];
  Messages?: Record<string, string[]>;
  ValidationErrors?: Record<string, string[]>;
  KeepExistingValidationErrors?: boolean;
  Redirect?: string;
}

export const configurationApi = {
  list: (query?: string) =>
    api.get<ConfigurationInfo[]>(`/api/v3/Configuration${query ? `?query=${encodeURIComponent(query)}` : ''}`),
  get: (id: string) => api.get<unknown>(`/api/v3/Configuration/${encodeURIComponent(id)}`),
  schema: (id: string) => api.get<unknown>(`/api/v3/Configuration/${encodeURIComponent(id)}/Schema`),
  validate: (id: string, body: unknown) =>
    api.post<ConfigurationActionResult>(`/api/v3/Configuration/${encodeURIComponent(id)}/Validate`, body),
};
