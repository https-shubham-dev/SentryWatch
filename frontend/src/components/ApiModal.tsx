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
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-ink-900 border border-ink-700 w-full max-w-lg p-5">
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-ink-700">
          <h2 className="text-[15px] font-semibold text-mist-100">
            {initialData ? 'Edit API monitor' : 'Register new API monitor'}
          </h2>
          <button
            onClick={onClose}
            className="text-mist-400 hover:text-mist-100 p-1"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-2.5 border border-status-critical text-status-critical text-[13px] flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-[13px] font-sans">
          <div>
            <label className="block text-mist-400 mb-1 text-[12px]">API name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Payment Gateway Health"
              className="w-full bg-ink-950 border border-ink-700 px-3 py-1.5 text-mist-100 focus:outline-none focus:border-signal-blue"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-mist-400 mb-1 text-[12px]">Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as HttpMethod)}
                className="w-full bg-ink-950 border border-ink-700 px-3 py-1.5 text-mist-100 font-mono focus:outline-none focus:border-signal-blue"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-mist-400 mb-1 text-[12px]">Target URL</label>
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://api.acme.com/v1/health"
                className="w-full bg-ink-950 border border-ink-700 px-3 py-1.5 text-mist-100 font-mono focus:outline-none focus:border-signal-blue"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-mist-400 mb-1 text-[12px]">Expected HTTP code</label>
              <input
                type="number"
                required
                min={100}
                max={599}
                value={expectedStatus}
                onChange={(e) => setExpectedStatus(parseInt(e.target.value, 10))}
                className="w-full bg-ink-950 border border-ink-700 px-3 py-1.5 text-mist-100 font-mono focus:outline-none focus:border-signal-blue"
              />
            </div>

            <div>
              <label className="block text-mist-400 mb-1 text-[12px]">Check interval</label>
              <select
                value={checkIntervalSeconds}
                onChange={(e) =>
                  setCheckIntervalSeconds(parseInt(e.target.value, 10) as AllowedIntervalSeconds)
                }
                className="w-full bg-ink-950 border border-ink-700 px-3 py-1.5 text-mist-100 focus:outline-none focus:border-signal-blue"
              >
                <option value={60}>60s (1 min)</option>
                <option value={300}>300s (5 min)</option>
                <option value={900}>900s (15 min)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-1">
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

          <div className="flex justify-end space-x-2 pt-3 border-t border-ink-700">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-ink-950 border border-ink-700 text-mist-400 hover:text-mist-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-signal-blue hover:bg-blue-600 text-white font-medium disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : initialData ? 'Update API' : 'Register API'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
