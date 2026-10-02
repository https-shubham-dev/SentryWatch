import { apiClient } from './apiClient';

export type IncidentStatus = 'detected' | 'investigating' | 'mitigated' | 'resolved';
export type IncidentSeverity = 'medium' | 'high';

export interface IncidentEvent {
  status: IncidentStatus;
  timestamp: string;
  triggeredBy: 'system' | string;
}

export interface IncidentItem {
  _id: string;
  apiId: string;
  organizationId: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  reason: string;
  detectedAt: string;
  lastAnomalyAt?: string;
  anomalyCount?: number;
  resolvedAt: string | null;
  events: IncidentEvent[];
}

export const incidentsApi = {
  getIncidents: async (
    status?: string,
    severity?: string,
    page?: number,
    limit?: number,
  ): Promise<IncidentItem[]> => {
    const res = await apiClient.get<IncidentItem[]>('/incidents', {
      params: { status, severity, page, limit },
    });
    return res.data;
  },

  getIncidentById: async (id: string): Promise<IncidentItem> => {
    const res = await apiClient.get<IncidentItem>(`/incidents/${id}`);
    return res.data;
  },

  updateStatus: async (id: string, status: IncidentStatus): Promise<IncidentItem> => {
    const res = await apiClient.patch<IncidentItem>(`/incidents/${id}/status`, { status });
    return res.data;
  },
};
