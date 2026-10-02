import React, { useState, useEffect } from 'react';
import { ApiItem, apisApi } from '../api/apisApi';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { X, Activity, AlertTriangle, ChevronLeft, ChevronRight, Download } from 'lucide-react';

interface ApiDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  api: ApiItem | null;
}

export const ApiDetailModal: React.FC<ApiDetailModalProps> = ({ isOpen, onClose, api }) => {
  const [stats, setStats] = useState<{
    avgLatencyMs: number;
    failureRate: number;
    totalChecks: number;
    recentChecks: { executedAt: string; latencyMs: number; passed: boolean }[];
  } | null>(null);

  const [checks, setChecks] = useState<any[]>([]);
  const [totalChecksCount, setTotalChecksCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !api) return;

    const fetchApiDetail = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [statsData, checksData] = await Promise.all([
          apisApi.getApiStats(api.id),
          apisApi.getApiChecks(api.id, page, 10),
        ]);
        setStats(statsData);
        setChecks(checksData.data || []);
        setTotalChecksCount(checksData.total || 0);
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'response' in err) {
          const resErr = err as { response?: { data?: { error?: { message?: string } } } };
          setError(resErr.response?.data?.error?.message || 'Failed to load API details.');
        } else {
          setError('Network error loading API stats.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchApiDetail();
  }, [isOpen, api, page]);

  if (!isOpen || !api) return null;

  const chartData = (stats?.recentChecks || []).map((c) => ({
    time: new Date(c.executedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    latencyMs: c.latencyMs,
    passed: c.passed,
  }));

  const totalPages = Math.ceil(totalChecksCount / 10) || 1;

  const handleDownloadPdf = async () => {
    if (!api) return;
    setIsExporting(true);
    setError(null);
    try {
      const blob = await apisApi.exportApiChecksPdf(api.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sentrywatch-${api.name.replace(/[^a-zA-Z0-9-_]+/g, '_').slice(0, 40)}-checks.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Failed to export PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-ink-900 border border-ink-700 w-full max-w-3xl p-5 space-y-5 font-sans max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start pb-3 border-b border-ink-700">
          <div>
            <div className="flex items-center space-x-2">
              <span
                className={`w-1 h-1 rounded-full ${
                  api.currentStatus === 'ok'
                    ? 'bg-status-ok'
                    : api.currentStatus === 'warn'
                    ? 'bg-status-warn'
                    : api.currentStatus === 'critical'
                    ? 'bg-status-critical'
                    : 'bg-mist-400'
                }`}
              />
              <h2 className="text-[15px] font-semibold text-mist-100">{api.name}</h2>
              <span className="px-1.5 py-0.5 text-[11px] font-mono border border-ink-700 text-mist-100">
                {api.method}
              </span>
            </div>
            <p className="text-[12px] text-mist-400 mt-1 font-mono">{api.url}</p>
          </div>

          <button
            onClick={onClose}
            className="text-mist-400 hover:text-mist-100 p-1"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-2.5 border border-status-critical text-status-critical text-[13px] flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Stats Strip */}
        <div className="grid grid-cols-3 gap-4 bg-ink-950 p-3 border border-ink-700 text-[13px]">
          <div>
            <span className="text-mist-400 block text-[12px]">Rolling avg latency</span>
            <span className="text-[15px] font-semibold text-mist-100 font-mono">
              {stats ? `${stats.avgLatencyMs}ms` : '—'}
            </span>
          </div>
          <div>
            <span className="text-mist-400 block text-[12px]">Recent failure rate</span>
            <span className="text-[15px] font-semibold text-mist-100 font-mono">
              {stats ? `${Math.round(stats.failureRate * 100)}%` : '—'}
            </span>
          </div>
          <div>
            <span className="text-mist-400 block text-[12px]">Check interval</span>
            <span className="text-[15px] font-semibold text-mist-100 font-mono">
              {api.checkIntervalSeconds}s
            </span>
          </div>
        </div>

        {/* Latency Chart — ink/mist/signal tokens only */}
        <div className="bg-ink-950 p-3 border border-ink-700">
          <h3 className="text-[13px] font-semibold text-mist-100 mb-3 flex items-center space-x-2">
            <Activity className="w-3.5 h-3.5 text-signal-blue" />
            <span>Latency trend (recent 20 checks)</span>
          </h3>

          {chartData.length > 0 ? (
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#293241" />
                  <XAxis dataKey="time" stroke="#8B96A5" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#8B96A5" tick={{ fontSize: 10 }} unit="ms" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#121821',
                      borderColor: '#293241',
                      fontSize: '11px',
                      color: '#E8ECF1',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="latencyMs"
                    stroke="#4C8DFF"
                    strokeWidth={2}
                    dot={{ fill: '#4C8DFF', r: 2 }}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-[13px] text-mist-400">
              No check latency metrics recorded yet.
            </div>
          )}
        </div>

        {/* Check History */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-[13px] font-semibold text-mist-100">
              Health check log ({totalChecksCount})
            </h3>
            <div className="flex items-center space-x-2 text-[12px]">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isExporting || isLoading}
                className="inline-flex items-center space-x-1.5 px-2.5 py-1 border border-ink-700 text-mist-400 hover:border-signal-blue hover:text-signal-blue disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isExporting ? 'Exporting…' : 'Download PDF'}</span>
              </button>
              <button
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1 bg-ink-950 border border-ink-700 disabled:opacity-30 hover:border-mist-400 text-mist-400"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-mist-400 font-mono">
                {page}/{totalPages}
              </span>
              <button
                disabled={page >= totalPages || isLoading}
                onClick={() => setPage((p) => p + 1)}
                className="p-1 bg-ink-950 border border-ink-700 disabled:opacity-30 hover:border-mist-400 text-mist-400"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="bg-ink-950 border border-ink-700 overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-ink-900 border-b border-ink-700 text-mist-400">
                <tr>
                  <th className="py-2 px-3 font-normal text-[12px]">Status</th>
                  <th className="py-2 px-3 font-normal text-[12px]">HTTP</th>
                  <th className="py-2 px-3 font-normal text-[12px]">Latency</th>
                  <th className="py-2 px-3 font-normal text-[12px]">Executed at</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {checks.length > 0 ? (
                  checks.map((chk: any) => (
                    <tr key={chk._id}>
                      <td className="py-2 px-3">
                        <span className="inline-flex items-center space-x-1.5 text-[12px]">
                          <span
                            className={`w-1 h-1 rounded-full ${
                              chk.passed ? 'bg-status-ok' : 'bg-status-critical'
                            }`}
                          />
                          <span className={chk.passed ? 'text-status-ok' : 'text-status-critical'}>
                            {chk.passed ? 'Passed' : 'Failed'}
                          </span>
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono text-mist-100">
                        {chk.statusCode ?? (chk.errorType || 'ERR')}
                      </td>
                      <td className="py-2 px-3 font-mono text-mist-400">
                        {chk.latencyMs !== null ? `${chk.latencyMs}ms` : '—'}
                      </td>
                      <td className="py-2 px-3 text-mist-400 font-mono text-[12px]">
                        {new Date(chk.executedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-mist-400">
                      No health check records found for this API.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
