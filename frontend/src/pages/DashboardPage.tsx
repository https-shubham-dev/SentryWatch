import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { apisApi, ApiItem, CreateApiPayload } from '../api/apisApi';
import { incidentsApi, IncidentItem, IncidentStatus } from '../api/incidentsApi';
import { ApiModal } from '../components/ApiModal';
import { IncidentDetailModal } from '../components/IncidentDetailModal';
import { ApiDetailModal } from '../components/ApiDetailModal';
import {
  LogOut,
  Building,
  User,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  RefreshCw,
  Activity,
  AlertTriangle,
  Radio,
  CheckCircle,
  Clock,
  Filter,
  Eye,
  BarChart2,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user, organization, logout } = useAuth();
  const { socket, isConnected } = useSocket();

  const [apis, setApis] = useState<ApiItem[]>([]);
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedApi, setSelectedApi] = useState<ApiItem | null>(null);
  const [newIncidentFlashId, setNewIncidentFlashId] = useState<string | null>(null);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('');

  // Modal detail states
  const [selectedDetailIncident, setSelectedDetailIncident] = useState<IncidentItem | null>(null);
  const [selectedDetailApi, setSelectedDetailApi] = useState<ApiItem | null>(null);

  const isAdmin = user?.role === 'admin';

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [apisData, incidentsData] = await Promise.all([
        apisApi.getApis(),
        incidentsApi.getIncidents(
          statusFilter || undefined,
          severityFilter || undefined,
        ),
      ]);
      setApis(apisData);
      setIncidents(incidentsData);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const resErr = err as { response?: { data?: { error?: { message?: string } } } };
        setError(resErr.response?.data?.error?.message || 'Failed to load dashboard data.');
      } else {
        setError('Network error loading dashboard.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, severityFilter]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Real-Time Socket.IO Event Listener & Auto-Reconcile on Reconnect (requirements.md §6)
  useEffect(() => {
    if (!socket) return;

    // 1. api:status_changed event listener
    const handleApiStatusChanged = (payload: { id: string; currentStatus: any; updatedAt: string }) => {
      setApis((prevApis) =>
        prevApis.map((api) =>
          api.id === payload.id ? { ...api, currentStatus: payload.currentStatus } : api,
        ),
      );
    };

    // 2. incident:created event listener (with 200ms left-border flash animation per gen-design.md §6)
    const handleIncidentCreated = (payload: IncidentItem) => {
      setIncidents((prev) => [payload, ...prev.filter((inc) => inc._id !== payload._id)]);
      setNewIncidentFlashId(payload._id);
      setTimeout(() => setNewIncidentFlashId(null), 200);
    };

    // 3. incident:updated event listener
    const handleIncidentUpdated = (payload: IncidentItem) => {
      setIncidents((prev) =>
        prev.map((inc) => (inc._id === payload._id ? payload : inc)),
      );
    };

    // 4. Reconnect listener: REST refetch to reconcile missed events
    const handleReconnect = () => {
      console.info('[Socket.IO] Reconnected: Reconciling missed events via REST');
      fetchDashboardData();
    };

    socket.on('api:status_changed', handleApiStatusChanged);
    socket.on('incident:created', handleIncidentCreated);
    socket.on('incident:updated', handleIncidentUpdated);
    socket.io.on('reconnect', handleReconnect);

    return () => {
      socket.off('api:status_changed', handleApiStatusChanged);
      socket.off('incident:created', handleIncidentCreated);
      socket.off('incident:updated', handleIncidentUpdated);
      socket.io.off('reconnect', handleReconnect);
    };
  }, [socket, fetchDashboardData]);

  const handleCreateOrUpdate = async (payload: CreateApiPayload) => {
    if (selectedApi) {
      await apisApi.updateApi(selectedApi.id, payload);
    } else {
      await apisApi.createApi(payload);
    }
    await fetchDashboardData();
  };

  const handleDelete = async (apiId: string) => {
    if (!window.confirm('Are you sure you want to remove this API from active monitoring?')) {
      return;
    }
    try {
      await apisApi.deleteApi(apiId);
      await fetchDashboardData();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const resErr = err as { response?: { data?: { error?: { message?: string } } } };
        alert(resErr.response?.data?.error?.message || 'Action forbidden');
      }
    }
  };

  const handleStatusTransition = async (incidentId: string, nextStatus: IncidentStatus) => {
    try {
      await incidentsApi.updateStatus(incidentId, nextStatus);
      await fetchDashboardData();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const resErr = err as { response?: { data?: { error?: { message?: string } } } };
        alert(resErr.response?.data?.error?.message || 'Failed to update incident status.');
      }
    }
  };

  const openCreateModal = () => {
    setSelectedApi(null);
    setIsModalOpen(true);
  };

  const openEditModal = (api: ApiItem) => {
    setSelectedApi(api);
    setIsModalOpen(true);
  };

  const okCount = apis.filter((a) => a.currentStatus === 'ok').length;
  const warnCount = apis.filter((a) => a.currentStatus === 'warn').length;
  const criticalCount = apis.filter((a) => a.currentStatus === 'critical').length;
  const unknownCount = apis.filter((a) => a.currentStatus === 'unknown').length;

  const getStatusDotColor = (status: string) => {
    switch (status) {
      case 'ok':
        return 'bg-status-ok';
      case 'warn':
        return 'bg-status-warn';
      case 'critical':
        return 'bg-status-critical';
      default:
        return 'bg-mist-400';
    }
  };

  return (
    <div className="sw-atmosphere min-h-screen text-mist-100 flex flex-col font-sans">
      {/* Top Header Bar */}
      <header className="bg-ink-900/90 backdrop-blur-sm border-b border-ink-700 px-4 py-3 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2.5">
            <div className="sw-brand-mark !w-7 !h-7">
              <Activity className="w-3.5 h-3.5" strokeWidth={2.5} />
            </div>
            <span className="font-semibold text-[20px] leading-none text-mist-100 tracking-tight">
              SentryWatch
            </span>
          </div>
          <span className="text-ink-700 hidden sm:inline">|</span>
          <div className="hidden sm:flex items-center space-x-1.5 text-[13px] text-mist-400">
            <Building className="w-3.5 h-3.5" />
            <span>{organization?.name || 'Organization'}</span>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-[13px]">
          <div
            className={`flex items-center space-x-1.5 px-2 py-0.5 border text-[11px] ${
              isConnected
                ? 'border-status-ok text-status-ok'
                : 'border-status-critical text-status-critical'
            }`}
          >
            <Radio className="w-3 h-3" />
            <span>{isConnected ? 'Live' : 'Disconnected'}</span>
          </div>

          <div className="hidden md:flex items-center space-x-2 text-mist-400">
            <User className="w-3.5 h-3.5" />
            <span className="font-mono text-[12px]">{user?.email}</span>
            <span className="px-1.5 py-0.5 border border-ink-700 text-mist-400 text-[11px] capitalize">
              {user?.role}
            </span>
          </div>

          <button onClick={logout} className="sw-btn-ghost flex items-center space-x-1 text-[12px] !py-1">
            <LogOut className="w-3 h-3" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-4 max-w-6xl w-full mx-auto space-y-4">
        {/* Overview Status Summary Strip */}
        <div className="sw-panel p-3 grid grid-cols-2 sm:grid-cols-4 gap-4 text-[13px]">
          <div className="flex items-center space-x-3">
            <span className="w-1 h-1 rounded-full bg-status-ok" />
            <div>
              <span className="text-mist-400 block text-[12px]">Healthy APIs</span>
              <span className="text-[15px] font-semibold text-mist-100 font-mono">{okCount}</span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className="w-1 h-1 rounded-full bg-status-warn" />
            <div>
              <span className="text-mist-400 block text-[12px]">Degraded</span>
              <span className="text-[15px] font-semibold text-mist-100 font-mono">{warnCount}</span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className="w-1 h-1 rounded-full bg-status-critical" />
            <div>
              <span className="text-mist-400 block text-[12px]">Failing</span>
              <span className="text-[15px] font-semibold text-mist-100 font-mono">{criticalCount}</span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className="w-1 h-1 rounded-full bg-mist-400" />
            <div>
              <span className="text-mist-400 block text-[12px]">Pending / Unknown</span>
              <span className="text-[15px] font-semibold text-mist-100 font-mono">{unknownCount}</span>
            </div>
          </div>
        </div>

        {/* API Registry Section */}
        <div className="sw-panel">
          <div className="px-4 py-3 border-b border-ink-700 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-signal-blue" />
              <h2 className="text-[15px] font-semibold text-mist-100">API Registry</h2>
              <span className="text-[12px] text-mist-400 font-mono">({apis.length})</span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={fetchDashboardData}
                className="p-1.5 text-mist-400 hover:text-mist-100 border border-transparent hover:border-ink-700"
                title="Refresh dashboard data"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              {isAdmin && (
                <button
                  onClick={openCreateModal}
                  className="sw-btn-primary flex items-center space-x-1 !py-1.5 !text-[12px]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add API</span>
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="m-4 p-3 border border-status-critical text-status-critical text-[13px] flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isLoading ? (
            <div className="p-8 text-center text-[13px] text-mist-400">
              Loading registered API monitors...
            </div>
          ) : apis.length === 0 ? (
            <div className="p-8 text-center text-[13px] text-mist-400 space-y-2">
              <p className="text-mist-100">No APIs registered yet — add one to start monitoring.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-ink-950/60 text-mist-400 border-b border-ink-700">
                  <tr>
                    <th className="py-2 px-4 font-normal text-[12px]">Status</th>
                    <th className="py-2 px-4 font-normal text-[12px]">Name</th>
                    <th className="py-2 px-4 font-normal text-[12px]">Method</th>
                    <th className="py-2 px-4 font-normal text-[12px]">Target URL</th>
                    <th className="py-2 px-4 font-normal text-[12px]">Expected</th>
                    <th className="py-2 px-4 font-normal text-[12px]">Interval</th>
                    <th className="py-2 px-4 font-normal text-[12px]">State</th>
                    {isAdmin && <th className="py-2 px-4 font-normal text-[12px] text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-700">
                  {apis.map((api) => (
                    <tr key={api.id}>
                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-block w-1 h-1 rounded-full ${getStatusDotColor(api.currentStatus)}`}
                        />
                      </td>
                      <td className="py-2.5 px-4 font-medium text-mist-100">{api.name}</td>
                      <td className="py-2.5 px-4">
                        <span className="px-1.5 py-0.5 border border-ink-700 text-mist-100 font-mono text-[12px] font-medium">
                          {api.method}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-mist-400 font-mono text-[12px] max-w-xs truncate" title={api.url}>
                        {api.url}
                      </td>
                      <td className="py-2.5 px-4 text-mist-400 font-mono">{api.expectedStatus}</td>
                      <td className="py-2.5 px-4 text-mist-400 font-mono">
                        {api.checkIntervalSeconds === 60
                          ? '60s'
                          : `${api.checkIntervalSeconds / 60}m`}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`text-[12px] ${
                            api.enabled ? 'text-status-ok' : 'text-mist-400'
                          }`}
                        >
                          {api.enabled ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => setSelectedDetailApi(api)}
                            className="p-1 text-mist-400 hover:text-signal-blue"
                            title="View Stats & Latency Chart"
                          >
                            <BarChart2 className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => openEditModal(api)}
                                className="p-1 text-mist-400 hover:text-signal-blue"
                                title="Edit API"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(api.id)}
                                className="p-1 text-mist-400 hover:text-status-critical"
                                title="Delete API"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Live Incident Feed Section per gen-design.md §4 */}
        <div className="sw-panel">
          <div className="px-4 py-3 border-b border-ink-700 flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-status-warn" />
              <h2 className="text-[15px] font-semibold text-mist-100">Live Incident Feed</h2>
              <span className="text-[12px] text-mist-400 font-mono">({incidents.length})</span>
            </div>

            {/* Incident Filters */}
            <div className="flex items-center space-x-3 text-[12px]">
              <div className="flex items-center space-x-1.5">
                <Filter className="w-3.5 h-3.5 text-mist-400" />
                <span className="text-mist-400">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-ink-950 border border-ink-700 text-mist-100 px-2 py-1 text-[12px] focus:outline-none focus:border-signal-blue"
                >
                  <option value="">All Statuses</option>
                  <option value="detected">Detected</option>
                  <option value="investigating">Investigating</option>
                  <option value="mitigated">Mitigated</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>

              <div className="flex items-center space-x-1.5">
                <span className="text-mist-400">Severity:</span>
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="bg-ink-950 border border-ink-700 text-mist-100 px-2 py-1 text-[12px] focus:outline-none focus:border-signal-blue"
                >
                  <option value="">All Severities</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                </select>
              </div>
            </div>
          </div>

          {incidents.length === 0 ? (
            <div className="p-6 text-center text-[13px] text-mist-400 flex items-center justify-center space-x-2">
              <CheckCircle className="w-4 h-4 text-status-ok" />
              <span>No open incidents matching filter criteria.</span>
            </div>
          ) : (
            <div className="divide-y divide-ink-700">
              {incidents.map((inc) => {
                const targetApi = apis.find((a) => a.id === inc.apiId);
                const isFlashing = newIncidentFlashId === inc._id;

                return (
                  <div
                    key={inc._id}
                    className={`px-4 py-2.5 border-l-2 ${
                      isFlashing
                        ? 'border-l-status-critical sw-incident-flash'
                        : 'border-l-transparent'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1.5">
                      <div className="flex items-center space-x-2 text-[13px]">
                        <span
                          className={`w-1 h-1 rounded-full ${
                            inc.status === 'resolved'
                              ? 'bg-status-resolved'
                              : inc.severity === 'high'
                              ? 'bg-status-critical'
                              : 'bg-status-warn'
                          }`}
                        />
                        <span className="font-medium text-mist-100">
                          {targetApi ? targetApi.name : `API (${inc.apiId})`}
                        </span>
                        <span
                          className={`text-[11px] capitalize ${
                            inc.severity === 'high'
                              ? 'text-status-critical'
                              : 'text-status-warn'
                          }`}
                        >
                          {inc.severity}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 text-[12px]">
                        <button
                          onClick={() => setSelectedDetailIncident(inc)}
                          className="px-2 py-1 bg-ink-950 border border-ink-700 hover:border-mist-100 text-mist-400 flex items-center space-x-1"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View detail</span>
                        </button>

                        <span
                          className={`text-[11px] capitalize ${
                            inc.status === 'detected'
                              ? 'text-status-critical'
                              : inc.status === 'investigating'
                              ? 'text-status-warn'
                              : inc.status === 'mitigated'
                              ? 'text-signal-blue'
                              : 'text-status-resolved'
                          }`}
                        >
                          {inc.status}
                        </span>

                        {inc.status === 'detected' && (
                          <button
                            onClick={() => handleStatusTransition(inc._id, 'investigating')}
                            className="px-2 py-1 bg-ink-950 border border-ink-700 hover:border-status-warn text-status-warn"
                          >
                            Investigate
                          </button>
                        )}

                        {inc.status === 'investigating' && (
                          <div className="flex space-x-1">
                            <button
                              onClick={() => handleStatusTransition(inc._id, 'mitigated')}
                              className="px-2 py-1 bg-ink-950 border border-ink-700 hover:border-signal-blue text-signal-blue"
                            >
                              Mitigate
                            </button>
                            <button
                              onClick={() => handleStatusTransition(inc._id, 'resolved')}
                              className="px-2 py-1 bg-ink-950 border border-ink-700 hover:border-status-ok text-status-ok"
                            >
                              Resolve
                            </button>
                          </div>
                        )}

                        {inc.status === 'mitigated' && (
                          <button
                            onClick={() => handleStatusTransition(inc._id, 'resolved')}
                            className="px-2 py-1 bg-ink-950 border border-ink-700 hover:border-status-ok text-status-ok"
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-[13px] text-mist-400 mb-1.5">{inc.reason}</p>

                    <div className="flex items-center space-x-4 text-[12px] text-mist-400">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span className="font-mono">
                          Detected: {new Date(inc.detectedAt).toLocaleTimeString()}
                        </span>
                      </div>
                      {inc.anomalyCount && inc.anomalyCount > 1 && (
                        <span className="font-mono">Cycles: {inc.anomalyCount}</span>
                      )}
                      {inc.events && inc.events.length > 0 && (
                        <span className="font-mono">Events: {inc.events.length}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Modal Form for Create/Edit API */}
      <ApiModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateOrUpdate}
        initialData={selectedApi}
      />

      {/* Modal for Incident Detail & Lifecycle Stepper */}
      <IncidentDetailModal
        isOpen={!!selectedDetailIncident}
        onClose={() => setSelectedDetailIncident(null)}
        incident={selectedDetailIncident}
        api={apis.find((a) => a.id === selectedDetailIncident?.apiId)}
        onStatusUpdated={fetchDashboardData}
      />

      {/* Modal for API Stats & Latency Chart */}
      <ApiDetailModal
        isOpen={!!selectedDetailApi}
        onClose={() => setSelectedDetailApi(null)}
        api={selectedDetailApi}
      />
    </div>
  );
};
