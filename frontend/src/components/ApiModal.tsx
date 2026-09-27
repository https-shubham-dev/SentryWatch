import React, { useState, useEffect } from 'react';
import { ApiItem, HttpMethod, AllowedIntervalSeconds, CreateApiPayload } from '../api/apisApi';
import { X, AlertCircle } from 'lucide-react';

interface ApiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateApiPayload) => Promise<void>;
  initialData?: ApiItem | null;
}

export const ApiModal: React.FC<ApiModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}) => {
  const [name, setName] = useState('');
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [url, setUrl] = useState('');
  const [expectedStatus, setExpectedStatus] = useState(200);
  const [checkIntervalSeconds, setCheckIntervalSeconds] = useState<AllowedIntervalSeconds>(60);
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setMethod(initialData.method);
      setUrl(initialData.url);
      setExpectedStatus(initialData.expectedStatus);
      setCheckIntervalSeconds(initialData.checkIntervalSeconds);
      setEnabled(initialData.enabled);
    } else {
      setName('');
      setMethod('GET');
      setUrl('https://');
      setExpectedStatus(200);
      setCheckIntervalSeconds(60);
      setEnabled(true);
    }
    setError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await onSubmit({
        name,
        method,
        url,
        expectedStatus,
        checkIntervalSeconds,
        enabled,
      });
      onClose();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const resErr = err as { response?: { data?: { error?: { message?: string } } } };
        setError(resErr.response?.data?.error?.message || 'Failed to save API registry entry.');
      } else {
        setError('Network error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-ink-900 border border-ink-700 w-full max-w-lg p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-ink-700">
          <h2 className="text-sm font-semibold text-mist-100 font-mono">
            {initialData ? 'Edit API Monitor' : 'Register New API Monitor'}
          </h2>
          <button
            onClick={onClose}
            className="text-mist-400 hover:text-mist-100 p-1 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-2.5 bg-status-critical/10 border border-status-critical/30 text-status-critical text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
          <div>
            <label className="block text-mist-400 mb-1">API Name / Label</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Payment Gateway Health"
              className="w-full bg-ink-950 border border-ink-700 px-3 py-1.5 text-mist-100 focus:outline-none focus:border-signal-blue transition-colors"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-mist-400 mb-1">HTTP Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as HttpMethod)}
                className="w-full bg-ink-950 border border-ink-700 px-3 py-1.5 text-mist-100 focus:outline-none focus:border-signal-blue transition-colors"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-mist-400 mb-1">Target Endpoint URL</label>
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://api.acme.com/v1/health"
                className="w-full bg-ink-950 border border-ink-700 px-3 py-1.5 text-mist-100 focus:outline-none focus:border-signal-blue transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-mist-400 mb-1">Expected HTTP Code</label>
              <input
                type="number"
                required
                min={100}
                max={599}
                value={expectedStatus}
                onChange={(e) => setExpectedStatus(parseInt(e.target.value, 10))}
                className="w-full bg-ink-950 border border-ink-700 px-3 py-1.5 text-mist-100 focus:outline-none focus:border-signal-blue transition-colors"
              />
            </div>

            <div>
              <label className="block text-mist-400 mb-1">Check Interval</label>
              <select
                value={checkIntervalSeconds}
                onChange={(e) => setCheckIntervalSeconds(parseInt(e.target.value, 10) as AllowedIntervalSeconds)}
                className="w-full bg-ink-950 border border-ink-700 px-3 py-1.5 text-mist-100 focus:outline-none focus:border-signal-blue transition-colors"
              >
                <option value={60}>60s (1 min)</option>
                <option value={300}>300s (5 min)</option>
                <option value={900}>900s (15 min)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="accent-signal-blue"
            />
            <label htmlFor="enabled" className="text-mist-100 cursor-pointer">
              Enable active scheduled monitoring
            </label>
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t border-ink-700">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-ink-950 border border-ink-700 text-mist-400 hover:text-mist-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-signal-blue hover:bg-blue-600 text-white font-medium transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : initialData ? 'Update API' : 'Register API'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
