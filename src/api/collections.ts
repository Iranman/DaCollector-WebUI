import { api } from './client';

export type CollectionSyncMode = 0 | 1 | 2;

export interface CollectionRule {
  Builder: string;
  Kind?: number;
  Options?: Record<string, string>;
}

export interface CollectionDefinition {
  ID: string;
  Name: string;
  Enabled: boolean;
  SyncMode: CollectionSyncMode;
  Rules: CollectionRule[];
}

export interface CollectionSummary extends CollectionDefinition {
  LastSynced?: string;
  ItemCount?: number;
}

export interface CollectionPreviewItem {
  ExternalID?: unknown;
  Title: string;
  Summary?: string;
}

export interface CollectionPreview {
  Collection: CollectionDefinition;
  Items: CollectionPreviewItem[];
  Warnings: string[];
}

export const collectionsApi = {
  list: () => api.get<CollectionSummary[]>('/api/v3/ManagedCollection'),
  get: (id: string) => api.get<CollectionDefinition>(`/api/v3/ManagedCollection/${id}`),
  create: (body: Partial<CollectionDefinition>) => api.post<CollectionDefinition>('/api/v3/ManagedCollection', body),
  update: (id: string, body: Partial<CollectionDefinition>) => api.put<CollectionDefinition>(`/api/v3/ManagedCollection/${id}`, body),
  delete: (id: string) => api.del<void>(`/api/v3/ManagedCollection/${id}`),
  preview: (id: string) => api.post<CollectionPreview>(`/api/v3/ManagedCollection/${id}/Preview`),
  previewDefinition: (body: Partial<CollectionDefinition>) => api.post<CollectionPreview>('/api/v3/ManagedCollection/Preview', body),
  sync: (id: string, apply = false) => api.post<void>(`/api/v3/ManagedCollection/${id}/Sync?apply=${apply}`),
};
