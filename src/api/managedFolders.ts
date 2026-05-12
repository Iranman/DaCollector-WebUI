import { api } from './client';

export type DropFolderType = 'None' | 'Source' | 'Destination' | 'Both';

export interface ManagedFolder {
  ID: number;
  Name: string;
  Path: string;
  WatchForNewFiles: boolean;
  DropFolderType: DropFolderType;
  FileSize: number;
  Size: number;
}

export interface CreateManagedFolderBody {
  Name: string;
  Path: string;
  WatchForNewFiles: boolean;
  DropFolderType: DropFolderType;
}

export const managedFoldersApi = {
  list: () => api.get<ManagedFolder[]>('/api/v3/ManagedFolder'),
  create: (body: CreateManagedFolderBody) =>
    api.post<ManagedFolder>('/api/v3/ManagedFolder', body),
  update: (folder: ManagedFolder) =>
    api.put<void>('/api/v3/ManagedFolder', folder),
  delete: (folderID: number, removeRecords = true) =>
    api.del<void>(`/api/v3/ManagedFolder/${folderID}?removeRecords=${removeRecords}`),
  scan: (folderID: number) =>
    api.get<void>(`/api/v3/ManagedFolder/${folderID}/Scan`),
};
