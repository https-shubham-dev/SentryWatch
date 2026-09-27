import { HttpMethod, ApiStatus, AllowedIntervalSeconds } from '../models/Api.js';

export interface CreateApiDto {
  name: string;
  method: HttpMethod;
  url: string;
  expectedStatus?: number;
  headers?: Record<string, string>;
  checkIntervalSeconds: AllowedIntervalSeconds;
  enabled?: boolean;
}

export interface UpdateApiDto {
  name?: string;
  method?: HttpMethod;
  url?: string;
  expectedStatus?: number;
  headers?: Record<string, string>;
  checkIntervalSeconds?: AllowedIntervalSeconds;
  enabled?: boolean;
}

export interface ApiResponse {
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
