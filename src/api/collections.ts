import { api } from './client';

export interface CollectionDefinition {
  ID: string;
  Name: string;
  Description?: string;
  SyncMode: string;
  Enabled: boolean;
}

export interface CollectionSummary {
  ID: string;
  Name: string;
  Enabled: boolean;
  SyncMode: string;
  LastSynced?: string;
  ItemCount?: number;
}

export const collectionsApi = {
  list: () => api.get<CollectionSummary[]>('/api/v3/Collection'),
  get: (id: string) => api.get<CollectionDefinition>(`/api/v3/Collection/${id}`),
  create: (body: Partial<CollectionDefinition>) => api.post<CollectionDefinition>('/api/v3/Collection', body),
  update: (id: string, body: Partial<CollectionDefinition>) => api.put<CollectionDefinition>(`/api/v3/Collection/${id}`, body),
  delete: (id: string) => api.del<void>(`/api/v3/Collection/${id}`),
  sync: (id: string) => api.post<void>(`/api/v3/Collection/${id}/Sync`),
};
