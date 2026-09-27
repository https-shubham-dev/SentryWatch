import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { apisApi, ApiItem, CreateApiPayload } from '../api/apisApi';
import { ApiModal } from '../components/ApiModal';
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
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user, organization, logout } = useAuth();
  const [apis, setApis] = useState<ApiItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedApi, setSelectedApi] = useState<ApiItem | null>(null);

  const isAdmin = user?.role === 'admin';

  const fetchApis = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apisApi.getApis();
      setApis(data);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const resErr = err as { response?: { data?: { error?: { message?: string } } } };
        setError(resErr.response?.data?.error?.message || 'Failed to load APIs.');
      } else {
        setError('Network error loading API registry.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApis();
  }, [fetchApis]);

  const handleCreateOrUpdate = async (payload: CreateApiPayload) => {
    if (selectedApi) {
      await apisApi.updateApi(selectedApi.id, payload);
    } else {
      await apisApi.createApi(payload);
    }
    await fetchApis();
  };

  const handleDelete = async (apiId: string) => {
    if (!window.confirm('Are you sure you want to remove this API from active monitoring?')) {
      return;
    }
    try {
      await apisApi.deleteApi(apiId);
      await fetchApis();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const resErr = err as { response?: { data?: { error?: { message?: string } } } };
        alert(resErr.response?.data?.error?.message || 'Action forbidden');
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

  // Status metrics summary counts
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

  const getMethodBadgeColor = (method: string) => {
    switch (method) {
      case 'GET':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'POST':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'PUT':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'DELETE':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default:
        return 'bg-ink-700 text-mist-400 border-ink-700';
    }
  };

  return (
    <div className="min-h-screen bg-ink-950 text-mist-100 flex flex-col font-sans">
      {/* Top Header Bar */}
      <header className="bg-ink-900 border-b border-ink-700 px-6 py-3 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-status-ok" />
            <span className="font-semibold text-sm text-mist-100">SentryWatch</span>
          </div>
          <span className="text-ink-700">|</span>
          <div className="flex items-center space-x-1.5 text-xs text-mist-400 font-mono">
            <Building className="w-3.5 h-3.5" />
            <span>{organization?.name || 'Organization'}</span>
          </div>
        </div>

        <div className="flex items-center space-x-4 text-xs">
          <div className="flex items-center space-x-2 font-mono text-mist-400">
            <User className="w-3.5 h-3.5" />
            <span>{user?.email}</span>
            <span className="px-1.5 py-0.5 bg-signal-blue/10 border border-signal-blue/30 text-signal-blue text-[10px] font-semibold uppercase tracking-wider">
              {user?.role}
            </span>
          </div>

          <button
            onClick={logout}
            className="flex items-center space-x-1 px-2.5 py-1 bg-ink-950 border border-ink-700 hover:border-mist-400 text-mist-400 hover:text-mist-100 text-xs transition-colors"
          >
            <LogOut className="w-3 h-3" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-6 max-w-6xl w-full mx-auto space-y-6">
        {/* Overview Status Summary Strip per gen-design.md §4 */}
        <div className="bg-ink-900 border border-ink-700 p-4 grid grid-cols-4 gap-4 text-xs font-mono">
          <div className="flex items-center space-x-3">
            <span className="w-3 h-3 rounded-full bg-status-ok" />
            <div>
              <span className="text-mist-400 block text-[11px]">Healthy APIs</span>
              <span className="text-base font-semibold text-mist-100">{okCount}</span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className="w-3 h-3 rounded-full bg-status-warn" />
            <div>
              <span className="text-mist-400 block text-[11px]">Degraded</span>
              <span className="text-base font-semibold text-mist-100">{warnCount}</span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className="w-3 h-3 rounded-full bg-status-critical" />
            <div>
              <span className="text-mist-400 block text-[11px]">Failing</span>
              <span className="text-base font-semibold text-mist-100">{criticalCount}</span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className="w-3 h-3 rounded-full bg-mist-400" />
            <div>
              <span className="text-mist-400 block text-[11px]">Pending / Unknown</span>
              <span className="text-base font-semibold text-mist-100">{unknownCount}</span>
            </div>
          </div>
        </div>

        {/* API Registry Section */}
        <div className="bg-ink-900 border border-ink-700">
          <div className="p-4 border-b border-ink-700 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-signal-blue" />
              <h2 className="text-sm font-semibold text-mist-100 font-mono">API Registry</h2>
              <span className="text-xs text-mist-400 font-mono">({apis.length} monitored endpoints)</span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={fetchApis}
                className="p-1.5 text-mist-400 hover:text-mist-100 hover:bg-ink-950 border border-transparent hover:border-ink-700 transition-colors"
                title="Refresh list"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              {isAdmin && (
                <button
                  onClick={openCreateModal}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-signal-blue hover:bg-blue-600 text-white font-medium text-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add API Endpoint</span>
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="m-4 p-3 bg-status-critical/10 border border-status-critical/30 text-status-critical text-xs flex items-center space-x-2 font-mono">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isLoading ? (
            <div className="p-8 text-center text-xs text-mist-400 font-mono">
              Loading registered API monitors...
            </div>
          ) : apis.length === 0 ? (
            /* Instructive empty state per gen-design.md §7 */
            <div className="p-10 text-center text-xs text-mist-400 font-mono space-y-2">
              <p className="text-mist-100">No APIs registered yet — add one to start monitoring.</p>
              {!isAdmin && (
                <p className="text-mist-400 text-[11px]">
                  (Note: Only Organization Admins can register or configure API endpoints)
                </p>
              )}
            </div>
          ) : (
            /* Dense Data Table per gen-design.md §4 */
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-ink-950/60 text-mist-400 border-b border-ink-700">
                  <tr>
                    <th className="py-2.5 px-4 font-normal">Status</th>
                    <th className="py-2.5 px-4 font-normal">Name</th>
                    <th className="py-2.5 px-4 font-normal">Method</th>
                    <th className="py-2.5 px-4 font-normal">Target URL</th>
                    <th className="py-2.5 px-4 font-normal">Expected</th>
                    <th className="py-2.5 px-4 font-normal">Interval</th>
                    <th className="py-2.5 px-4 font-normal">State</th>
                    {isAdmin && <th className="py-2.5 px-4 font-normal text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-700/50">
                  {apis.map((api) => (
                    <tr key={api.id} className="hover:bg-ink-950/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${getStatusDotColor(api.currentStatus)}`}
                          />
                        </div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-mist-100">{api.name}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-1.5 py-0.5 border text-[10px] font-bold ${getMethodBadgeColor(api.method)}`}
                        >
                          {api.method}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-mist-400 max-w-xs truncate" title={api.url}>
                        {api.url}
                      </td>
                      <td className="py-3 px-4 text-mist-400">{api.expectedStatus}</td>
                      <td className="py-3 px-4 text-mist-400">
                        {api.checkIntervalSeconds === 60
                          ? '60s'
                          : `${api.checkIntervalSeconds / 60}m`}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 text-[11px] font-semibold uppercase ${
                            api.enabled
                              ? 'text-status-ok bg-status-ok/10'
                              : 'text-mist-400 bg-ink-950'
                          }`}
                        >
                          {api.enabled ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4 text-right">
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => openEditModal(api)}
                              className="p-1 text-mist-400 hover:text-signal-blue transition-colors"
                              title="Edit API"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(api.id)}
                              className="p-1 text-mist-400 hover:text-status-critical transition-colors"
                              title="Delete API"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal Form */}
      <ApiModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateOrUpdate}
        initialData={selectedApi}
      />
    </div>
  );
};
