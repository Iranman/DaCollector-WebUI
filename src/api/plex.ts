import { api } from './client';

export interface PlexTarget {
  ID: string;
  Name: string;
  BaseUrl: string;
  SectionKey: string;
}

export interface PlexPreviewResult {
  Collection: { Name: string; SyncMode: string };
  Items: unknown[];
}

export const plexApi = {
  listTargets: () => api.get<PlexTarget[]>('/api/v3/PlexTarget'),
  getTarget: (id: string) => api.get<PlexTarget>(`/api/v3/PlexTarget/${id}`),
  createTarget: (body: Partial<PlexTarget>) => api.post<PlexTarget>('/api/v3/PlexTarget', body),
  updateTarget: (id: string, body: Partial<PlexTarget>) => api.put<PlexTarget>(`/api/v3/PlexTarget/${id}`, body),
  deleteTarget: (id: string) => api.del<void>(`/api/v3/PlexTarget/${id}`),
  preview: (id: string, collectionId: string) =>
    api.post<PlexPreviewResult>(`/api/v3/PlexTarget/${id}/Preview`, { collectionId }),
  apply: (id: string, collectionId: string) =>
    api.post<void>(`/api/v3/PlexTarget/${id}/Apply`, { collectionId }),
};
