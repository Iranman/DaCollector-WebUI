import { api } from './client';

export interface User {
  ID?: number;
  JMMUserID?: number;
  Username?: string;
  DisplayName?: string;
  IsAdmin?: boolean | number;
  IsTraktUser?: boolean | number;
  PlexUsers?: string;
}

export interface UserUpdate {
  Username?: string;
  DisplayName?: string;
  Password?: string;
  IsAdmin?: boolean;
  IsTraktUser?: boolean;
  PlexUsers?: string;
}

export const usersApi = {
  list: () => api.get<User[]>('/api/v3/User'),
  get: (id: number) => api.get<User>(`/api/v3/User/${id}`),
  create: (body: UserUpdate) => api.post<User>('/api/v3/User', body),
  update: (id: number, body: UserUpdate) => api.put<User>(`/api/v3/User/${id}`, body),
  delete: (id: number) => api.del<void>(`/api/v3/User/${id}`),
};
