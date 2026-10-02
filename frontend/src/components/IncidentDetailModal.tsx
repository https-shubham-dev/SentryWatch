import React, { useState, useEffect } from 'react';
import { IncidentItem, IncidentStatus, incidentsApi } from '../api/incidentsApi';
import { ApiItem } from '../api/apisApi';
import { useSocket } from '../context/SocketContext';
import { X, AlertTriangle, CheckCircle, Clock, ShieldAlert, Activity, Server } from 'lucide-react';

interface IncidentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  incident: IncidentItem | null;
  api?: ApiItem | null;
  onStatusUpdated?: (updated: IncidentItem) => void;
}

const LIFECYCLE_STEPS: IncidentStatus[] = ['detected', 'investigating', 'mitigated', 'resolved'];

export const IncidentDetailModal: React.FC<IncidentDetailModalProps> = ({
  isOpen,
  onClose,
  incident,
  api,
  onStatusUpdated,
}) => {
  const { socket } = useSocket();
  const [currentIncident, setCurrentIncident] = useState<IncidentItem | null>(incident);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setCurrentIncident(incident);
    setError(null);
  }, [incident, isOpen]);

  useEffect(() => {
    if (!socket || !incident) return;

    const handleIncidentUpdated = (payload: IncidentItem) => {
      if (payload._id === incident._id) {
        setCurrentIncident(payload);
      }
    };

    socket.on('incident:updated', handleIncidentUpdated);
    return () => {
      socket.off('incident:updated', handleIncidentUpdated);
    };
  }, [socket, incident]);

  if (!isOpen || !currentIncident) return null;

  const currentStepIndex = LIFECYCLE_STEPS.indexOf(currentIncident.status);

  const handleTransition = async (nextStatus: IncidentStatus) => {
    setError(null);
    setIsSubmitting(true);
    try {
      const updated = await incidentsApi.updateStatus(currentIncident._id, nextStatus);
      setCurrentIncident(updated);
      if (onStatusUpdated) {
        onStatusUpdated(updated);
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const resErr = err as { response?: { data?: { error?: { message?: string } } } };
        setError(
          resErr.response?.data?.error?.message || 'Failed to transition incident status.',
        );
      } else {
        setError('Network error occurred while updating status.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStepColor = (index: number) => {
    if (index < currentStepIndex) return 'bg-status-ok border-status-ok text-ink-950';
    if (index === currentStepIndex) {
      switch (currentIncident.status) {
        case 'detected':
          return 'bg-status-critical border-status-critical text-white';
        case 'investigating':
          return 'bg-status-warn border-status-warn text-ink-950';
        case 'mitigated':
          return 'bg-signal-blue border-signal-blue text-white';
        case 'resolved':
          return 'bg-status-ok border-status-ok text-ink-950';
        default:
          return 'bg-ink-700 border-ink-700 text-mist-100';
      }
    }
    return 'bg-ink-950 border-ink-700 text-mist-400';
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-ink-900 border border-ink-700 w-full max-w-2xl p-5 space-y-5 font-sans max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start pb-3 border-b border-ink-700">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <ShieldAlert
                className={`w-4 h-4 ${
                  currentIncident.severity === 'high' ? 'text-status-critical' : 'text-status-warn'
                }`}
              />
              <h2 className="text-[15px] font-semibold text-mist-100">
                Incident — {api ? api.name : `API (${currentIncident.apiId})`}
              </h2>
            </div>
            <p className="text-[12px] text-mist-400 font-mono">ID: {currentIncident._id}</p>
          </div>

          <div className="flex items-center space-x-2">
            <span
              className={`text-[12px] capitalize ${
                currentIncident.severity === 'high' ? 'text-status-critical' : 'text-status-warn'
              }`}
            >
              {currentIncident.severity} severity
            </span>
            <button
              onClick={onClose}
              className="text-mist-400 hover:text-mist-100 p-1"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {error && (
          <div className="p-2.5 border border-status-critical text-status-critical text-[13px] flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Lifecycle stepper — earned structural device (§5) */}
        <div className="bg-ink-950 p-4 border border-ink-700">
          <h3 className="text-[13px] text-mist-100 font-semibold mb-4">Lifecycle</h3>
          <div className="relative flex items-center justify-between">
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-ink-700 z-0" />
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-px bg-signal-blue z-0"
              style={{
                width: `${(currentStepIndex / (LIFECYCLE_STEPS.length - 1)) * 100}%`,
              }}
            />

            {LIFECYCLE_STEPS.map((step, idx) => {
              const isPassed = idx < currentStepIndex;
              const isCurrent = idx === currentStepIndex;

              return (
                <div key={step} className="relative z-10 flex flex-col items-center">
                  <div
                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-[12px] font-semibold ${getStepColor(
                      idx,
                    )}`}
                  >
                    {isPassed ? <CheckCircle className="w-4 h-4" /> : idx + 1}
                  </div>
                  <span
                    className={`mt-2 text-[11px] capitalize ${
                      isCurrent
                        ? 'text-mist-100 font-semibold'
                        : isPassed
                        ? 'text-mist-400'
                        : 'text-mist-400'
                    }`}
                  >
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-4 text-[13px] bg-ink-950 p-4 border border-ink-700">
          <div className="space-y-2">
            <div>
              <span className="text-mist-400 block text-[12px]">Affected endpoint</span>
              <span className="text-mist-100 flex items-center space-x-1 font-mono text-[12px]">
                <Server className="w-3 h-3 text-mist-400 shrink-0" />
                <span className="truncate">
                  {api ? `${api.method} ${api.url}` : currentIncident.apiId}
                </span>
              </span>
            </div>
            <div>
              <span className="text-mist-400 block text-[12px]">Reason</span>
              <span className="text-mist-100">{currentIncident.reason}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <span className="text-mist-400 block text-[12px]">Anomaly cycles</span>
              <span className="text-mist-100 flex items-center space-x-1 font-mono">
                <Activity className="w-3 h-3 text-status-warn" />
                <span>{currentIncident.anomalyCount ?? 1}</span>
              </span>
            </div>
            <div>
              <span className="text-mist-400 block text-[12px]">Last anomaly</span>
              <span className="text-mist-100 flex items-center space-x-1 font-mono text-[12px]">
                <Clock className="w-3 h-3 text-mist-400" />
                <span>
                  {currentIncident.lastAnomalyAt
                    ? new Date(currentIncident.lastAnomalyAt).toLocaleString()
                    : new Date(currentIncident.detectedAt).toLocaleString()}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Actions — border + text, light fill only on primary action hover */}
        <div className="p-3 bg-ink-950 border border-ink-700 flex justify-between items-center gap-3">
          <div>
            <span className="text-[13px] text-mist-400 block">
              Status:{' '}
              <span className="capitalize text-mist-100 font-semibold">{currentIncident.status}</span>
            </span>
            <span className="text-[12px] text-mist-400">
              Only legal next transitions are shown. Resolve requires a passing check.
            </span>
          </div>

          <div className="flex space-x-2 shrink-0">
            {currentIncident.status === 'detected' && (
              <button
                onClick={() => handleTransition('investigating')}
                disabled={isSubmitting}
                className="px-3 py-1.5 border border-status-warn text-status-warn hover:bg-status-warn hover:text-ink-950 text-[12px] font-medium disabled:opacity-50"
              >
                Investigate
              </button>
            )}

            {currentIncident.status === 'investigating' && (
              <>
                <button
                  onClick={() => handleTransition('mitigated')}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 border border-signal-blue text-signal-blue hover:bg-signal-blue hover:text-white text-[12px] font-medium disabled:opacity-50"
                >
                  Mitigate
                </button>
                <button
                  onClick={() => handleTransition('resolved')}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 border border-status-ok text-status-ok hover:bg-status-ok hover:text-ink-950 text-[12px] font-medium disabled:opacity-50"
                >
                  Resolve
                </button>
              </>
            )}

            {currentIncident.status === 'mitigated' && (
              <button
                onClick={() => handleTransition('resolved')}
                disabled={isSubmitting}
                className="px-3 py-1.5 border border-status-ok text-status-ok hover:bg-status-ok hover:text-ink-950 text-[12px] font-medium disabled:opacity-50"
              >
                Resolve
              </button>
            )}

            {currentIncident.status === 'resolved' && (
              <span className="px-3 py-1.5 border border-status-resolved text-status-resolved text-[12px] flex items-center space-x-1">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Resolved</span>
              </span>
            )}
          </div>
        </div>

        {/* Event timeline */}
        <div>
          <h3 className="text-[13px] font-semibold text-mist-100 mb-2">
            Event timeline ({currentIncident.events?.length || 0})
          </h3>
          <div className="bg-ink-950 border border-ink-700 p-2 max-h-48 overflow-y-auto space-y-1.5">
            {currentIncident.events && currentIncident.events.length > 0 ? (
              currentIncident.events.map((evt, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center px-2 py-1.5 border border-ink-700 text-[13px]"
                >
                  <div className="flex items-center space-x-2">
                    <span
                      className={`w-1 h-1 rounded-full ${
                        evt.status === 'resolved'
                          ? 'bg-status-ok'
                          : evt.status === 'mitigated'
                          ? 'bg-signal-blue'
                          : evt.status === 'investigating'
                          ? 'bg-status-warn'
                          : 'bg-status-critical'
                      }`}
                    />
                    <span className="text-mist-100 capitalize">{evt.status}</span>
                    <span className="text-mist-400 text-[12px]">
                      by {evt.triggeredBy === 'system' ? 'system' : `user (${evt.triggeredBy})`}
                    </span>
                  </div>
                  <span className="text-[12px] text-mist-400 font-mono">
                    {new Date(evt.timestamp).toLocaleString()}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-[13px] text-mist-400 text-center py-2">
                No timeline events recorded.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
