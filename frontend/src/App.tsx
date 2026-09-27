import { useEffect, useState } from 'react';

export default function App() {
  const [healthStatus, setHealthStatus] = useState<string>('checking...');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setHealthStatus(data.status))
      .catch(() => setHealthStatus('disconnected'));
  }, []);

  return (
    <div className="min-h-screen bg-ink-950 text-mist-100 flex flex-col justify-center items-center p-6">
      <div className="bg-ink-900 border border-ink-700 rounded p-6 max-w-md w-full shadow-lg">
        <div className="flex items-center space-x-3 mb-4">
          <span
            className={`w-3 h-3 rounded-full ${
              healthStatus === 'ok' ? 'bg-status-ok animate-pulse' : 'bg-status-critical'
            }`}
          />
          <h1 className="text-xl font-semibold text-mist-100">SentryWatch</h1>
        </div>
        <p className="text-sm text-mist-400 mb-4">
          Developer Observability Platform Scaffold
        </p>
        <div className="bg-ink-950 border border-ink-700 p-3 rounded font-mono text-xs text-mist-100 flex justify-between items-center">
          <span className="text-mist-400">Backend Health:</span>
          <span className={healthStatus === 'ok' ? 'text-status-ok' : 'text-status-critical'}>
            {healthStatus}
          </span>
        </div>
      </div>
    </div>
  );
}
