import { apiClient } from './apiClient';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
export type ApiStatus = 'ok' | 'warn' | 'critical' | 'unknown';
export type AllowedIntervalSeconds = 60 | 300 | 900;

export interface ApiItem {
  id: string;
  organizationId: string;
  name: string;
  method: HttpMethod;
  url: string;
  expectedStatus: number;
  headers?: Record<string, string>;
  checkIntervalSeconds: AllowedIntervalSeconds;
  enabled: boolean;
  currentStatus: ApiStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApiPayload {
  name: string;
  method: HttpMethod;
  url: string;
  expectedStatus?: number;
  headers?: Record<string, string>;
  checkIntervalSeconds: AllowedIntervalSeconds;
  enabled?: boolean;
}

export interface UpdateApiPayload {
  name?: string;
  method?: HttpMethod;
  url?: string;
  expectedStatus?: number;
  headers?: Record<string, string>;
  checkIntervalSeconds?: AllowedIntervalSeconds;
  enabled?: boolean;
}

export const apisApi = {
  getApis: async (): Promise<ApiItem[]> => {
    const res = await apiClient.get<ApiItem[]>('/apis');
    return res.data;
  },

  getApiById: async (id: string): Promise<ApiItem> => {
    const res = await apiClient.get<ApiItem>(`/apis/${id}`);
    return res.data;
  },

  createApi: async (payload: CreateApiPayload): Promise<ApiItem> => {
    const res = await apiClient.post<ApiItem>('/apis', payload);
    return res.data;
  },

  updateApi: async (id: string, payload: UpdateApiPayload): Promise<ApiItem> => {
    const res = await apiClient.patch<ApiItem>(`/apis/${id}`, payload);
    return res.data;
  },

  deleteApi: async (id: string): Promise<void> => {
    await apiClient.delete(`/apis/${id}`);
  },

  getApiChecks: async (id: string, page: number = 1, limit: number = 20): Promise<any> => {
    const res = await apiClient.get(`/apis/${id}/checks`, { params: { page, limit } });
    return res.data;
  },

  getApiStats: async (id: string): Promise<{
    avgLatencyMs: number;
    failureRate: number;
    totalChecks: number;
    recentChecks: { executedAt: string; latencyMs: number; passed: boolean }[];
  }> => {
    const res = await apiClient.get(`/apis/${id}/stats`);
    return res.data;
  },

  exportApiChecksPdf: async (id: string, params?: { from?: string; to?: string }): Promise<Blob> => {
    const res = await apiClient.get(`/apis/${id}/checks/export`, {
      params,
      responseType: 'blob',
    });
    return res.data;
  },
};
