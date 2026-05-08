import { api } from './client';

export interface QueueItem {
  Key: string;
  Type: string;
  Title: string;
  Details: string;
  IsRunning: boolean;
  StartTime?: string;
}

export interface QueueStatus {
  WaitingCount: number;
  BlockedCount: number;
  TotalCount: number;
  ThreadCount: number;
  CurrentlyExecuting: QueueItem[];
}

export const queueApi = {
  get: () => api.get<QueueStatus>('/api/v3/Queue'),
  pause: () => api.post<void>('/api/v3/Queue/Pause'),
  resume: () => api.post<void>('/api/v3/Queue/Resume'),
  clear: () => api.post<void>('/api/v3/Queue/Clear'),
};
