import { api } from './client';

export type IntegrityScanStatus = 'Standby' | 'Running' | 'Finished';
export type IntegrityFileStatus =
  | 'Waiting'
  | 'ProcessedOK'
  | 'ErrorFileNotFound'
  | 'ErrorInvalidSize'
  | 'ErrorInvalidHash'
  | 'ErrorMissingHash'
  | 'ErrorIOError';

export interface IntegrityCheck {
  ID: number;
  ManagedFolderIDs: number[];
  Status: IntegrityScanStatus;
  CreatedAt: string;
  TotalFiles: number;
  WaitingFiles: number;
  ErrorFiles: number;
  CompletedFiles: number;
}

export interface IntegrityCheckFile {
  ID: number;
  ScanID: number;
  ManagedFolderID: number;
  VideoLocalPlaceID: number;
  FullName: string;
  FileSize: number;
  Status: IntegrityFileStatus;
  CheckDate?: string;
  Hash?: string;
  HashResult?: string;
}

export interface CreateIntegrityCheckBody {
  ID: number;
  ManagedFolderIDs: number[];
  Status: IntegrityScanStatus;
  CreatedAt: string;
}

export type IntegrityFileFilter = IntegrityFileStatus | 'all' | 'errors';

export const integrityApi = {
  listScans: () => api.get<IntegrityCheck[]>('/api/v3/IntegrityCheck'),
  getScanFiles: (scanID: number, status?: IntegrityFileStatus) => {
    const suffix = status ? `?status=${status}` : '';
    return api.get<IntegrityCheckFile[]>(`/api/v3/IntegrityCheck/${scanID}/File${suffix}`);
  },
  createScan: (managedFolderIDs: number[]) =>
    api.post<IntegrityCheck>('/api/v3/IntegrityCheck', {
      ID: 0,
      ManagedFolderIDs: managedFolderIDs,
      Status: 'Standby',
      CreatedAt: new Date().toISOString(),
    } satisfies CreateIntegrityCheckBody),
  startScan: (scanID: number, checkHash = false) =>
    api.post<void>(`/api/v3/IntegrityCheck/${scanID}/Start?checkHash=${checkHash}`),
  deleteScan: (scanID: number) =>
    api.del<void>(`/api/v3/IntegrityCheck/${scanID}`),
};
