import { api } from './client';

export type CollectionSyncMode = 0 | 1 | 2;
export type MediaKind = 0 | 1 | 2 | 5;

export interface CollectionBuilderDescriptor {
  Name: string;
  Provider: number;
  Kind: MediaKind;
  Description: string;
}

export interface CollectionRule {
  Builder: string;
  Kind?: MediaKind;
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
  ExternalID?: {
    Provider?: number | string;
    Kind?: number | string;
    Value?: string;
  };
  Title: string;
  Summary?: string;
}

export interface CollectionBuilderPreview {
  Builder: CollectionBuilderDescriptor;
  Items: CollectionPreviewItem[];
  Warnings: string[];
}

export interface CollectionPreview {
  Collection: CollectionDefinition;
  Items: CollectionPreviewItem[];
  Warnings: string[];
}

export interface PlexMediaItem {
  RatingKey: string;
  Title: string;
  Type: string;
  Year?: number;
  Guid?: string;
}

export interface PlexCollectionMatch {
  SectionKey: string;
  Matched: Array<{
    Target: CollectionPreviewItem;
    PlexItem: PlexMediaItem;
  }>;
  Missing: CollectionPreviewItem[];
  TargetItemCount: number;
  Warnings: string[];
}

export interface PlexCollectionApplyResult {
  SectionKey: string;
  CollectionName: string;
  SyncMode: CollectionSyncMode;
  Applied: boolean;
  DryRun: boolean;
  Match: PlexCollectionMatch;
  ExistingItemCount: number;
  AddedItemCount: number;
  RemovedItemCount: number;
  UnchangedItemCount: number;
  Added: PlexMediaItem[];
  Removed: PlexMediaItem[];
  Warnings: string[];
}

export interface CollectionSyncResult {
  Collection: CollectionDefinition;
  RequestedSyncMode: CollectionSyncMode;
  EffectiveSyncMode: CollectionSyncMode;
  Applied: boolean;
  Target: string;
  Items: CollectionPreviewItem[];
  MatchedItemCount: number;
  MissingItemCount: number;
  AddedItemCount: number;
  RemovedItemCount: number;
  PlexDiff?: PlexCollectionApplyResult;
  Warnings: string[];
}

export interface CollectionSyncRunResult {
  RunID: string;
  StartedAt: string;
  FinishedAt: string;
  EnabledCollectionCount: number;
  DisabledCollectionCount: number;
  TotalItemCount: number;
  Collections: CollectionSyncResult[];
  Warnings: string[];
}

export const collectionBuilderApi = {
  list: () => api.get<CollectionBuilderDescriptor[]>('/api/v3/CollectionBuilder'),
  preview: (rule: CollectionRule) =>
    api.post<CollectionBuilderPreview>('/api/v3/CollectionBuilder/Preview', rule),
};

export const collectionsApi = {
  list: () => api.get<CollectionSummary[]>('/api/v3/ManagedCollection'),
  get: (id: string) => api.get<CollectionDefinition>(`/api/v3/ManagedCollection/${id}`),
  create: (body: Partial<CollectionDefinition>) => api.post<CollectionDefinition>('/api/v3/ManagedCollection', body),
  update: (id: string, body: Partial<CollectionDefinition>) => api.put<CollectionDefinition>(`/api/v3/ManagedCollection/${id}`, body),
  delete: (id: string) => api.del<void>(`/api/v3/ManagedCollection/${id}`),
  preview: (id: string) => api.post<CollectionPreview>(`/api/v3/ManagedCollection/${id}/Preview`),
  previewDefinition: (body: Partial<CollectionDefinition>) => api.post<CollectionPreview>('/api/v3/ManagedCollection/Preview', body),
  sync: (id: string, apply = false) => api.post<CollectionSyncResult>(`/api/v3/ManagedCollection/${id}/Sync?apply=${apply}`),
  syncAll: (apply = false) => api.post<CollectionSyncRunResult>(`/api/v3/ManagedCollection/Sync?apply=${apply}`),
};
