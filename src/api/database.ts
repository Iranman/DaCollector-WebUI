import { api } from './client';

export interface DatabaseBackupFile {
  FileName: string;
  SizeBytes: number;
  CreatedAt: string;
}

export const databaseApi = {
  backups: () => api.get<DatabaseBackupFile[]>('/api/v3/Database/Backups'),
};
