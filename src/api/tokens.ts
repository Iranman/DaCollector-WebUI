import { api } from './client';

export interface ApiToken {
  Name?: string;
  Token?: string;
}

export interface CreateTokenResponse {
  apikey?: string;
  ApiKey?: string;
  Token?: string;
}

export const tokensApi = {
  list: () => api.get<ApiToken[]>('/api/v3/Auth/Tokens'),
  create: (name: string) => api.post<CreateTokenResponse>('/api/v3/Auth/Token', { Name: name }),
  delete: (token: string) => api.del<void>(`/api/v3/Auth/Token/${encodeURIComponent(token)}`),
};
