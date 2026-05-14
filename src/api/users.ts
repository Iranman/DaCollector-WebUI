import { api } from './client';

export interface User {
  ID: number;
  Username: string;
  IsAdmin: boolean;
  CommunitySites: string[];
  PlexUsernames: string;
  Avatar?: string;
  RestrictedTags: number[];
}

export interface CreateOrUpdateUserBody {
  Username?: string;
  IsAdmin?: boolean;
  CommunitySites?: string[];
  PlexUsernames?: string;
  Avatar?: string;
  RestrictedTags?: number[];
}

export interface CreateUserBody extends CreateOrUpdateUserBody {
  Password: string;
}

export const usersApi = {
  list: () => api.get<User[]>('/api/v3/User'),
  current: () => api.get<User>('/api/v3/User/Current'),
  updateCurrent: (body: CreateOrUpdateUserBody) => api.put<User>('/api/v3/User/Current', body),
  get: (id: number) => api.get<User>(`/api/v3/User/${id}`),
  create: (body: CreateUserBody) => api.post<User>('/api/v3/User', body),
  update: (id: number, body: CreateOrUpdateUserBody) => api.put<User>(`/api/v3/User/${id}`, body),
  delete: (id: number) => api.del<void>(`/api/v3/User/${id}`),
  changeCurrentPassword: (password: string, revokeAPIKeys = true) =>
    api.post<void>('/api/v3/User/Current/ChangePassword', { Password: password, RevokeAPIKeys: revokeAPIKeys }),
  changePassword: (id: number, password: string, revokeAPIKeys = true) =>
    api.post<void>(`/api/v3/User/${id}/ChangePassword`, { Password: password, RevokeAPIKeys: revokeAPIKeys }),
};
