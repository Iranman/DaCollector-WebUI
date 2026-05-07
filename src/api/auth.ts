import { api } from './client';

export interface LoginRequest {
  user: string;
  pass: string;
  device: string;
}

export interface LoginResponse {
  apikey: string;
}

export const authApi = {
  login: (req: LoginRequest) => api.post<LoginResponse>('/api/auth', req),
};
