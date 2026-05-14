import { api } from './client';

export interface QueueItem {
  Key: string;
  Type: string;
  Title: string;
  Details: Record<string, unknown>;
  IsRunning: boolean;
  IsBlocked: boolean;
  StartTime?: string;
}

export interface QueueStatus {
  Running?: boolean;
  WaitingCount: number;
  BlockedCount: number;
  TotalCount: number;
  ThreadCount: number;
  CurrentlyExecuting: QueueItem[];
}

export interface QueueListResult {
  Total: number;
  List: QueueItem[];
}

export interface QueueItemsOptions {
  page?: number;
  pageSize?: number;
  showAll?: boolean;
}

export const queueApi = {
  get: () => api.get<QueueStatus>('/api/v3/Queue'),
  getItems: ({ page = 1, pageSize = 50, showAll = true }: QueueItemsOptions = {}) =>
    api.get<QueueListResult>(`/api/v3/Queue/Items?page=${page}&pageSize=${pageSize}&showAll=${showAll}`),
  getTypes: () => api.get<Record<string, number>>('/api/v3/Queue/Types'),
  pause: () => api.post<void>('/api/v3/Queue/Pause'),
  resume: () => api.post<void>('/api/v3/Queue/Resume'),
  clear: () => api.post<void>('/api/v3/Queue/Clear'),
};
