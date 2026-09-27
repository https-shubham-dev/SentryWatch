import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Building, User, ShieldCheck } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user, organization, logout } = useAuth();

  return (
    <div className="min-h-screen bg-ink-950 text-mist-100 flex flex-col font-sans">
      {/* Top Header Bar per gen-design.md layout */}
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

      {/* Main Container Shell */}
      <main className="flex-1 p-6 max-w-5xl w-full mx-auto">
        <div className="mb-6 pb-4 border-b border-ink-700 flex justify-between items-center">
          <div>
            <h1 className="text-lg font-semibold text-mist-100">Auth & Organization Verification</h1>
            <p className="text-xs text-mist-400 font-mono mt-0.5">Step 2 Checkpoint Active</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-ink-900 border border-ink-700 p-4">
            <div className="flex items-center space-x-2 text-xs font-semibold text-mist-400 mb-3 font-mono">
              <ShieldCheck className="w-4 h-4 text-status-ok" />
              <span>User Profile (JWT Context)</span>
            </div>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-ink-700/50">
                <span className="text-mist-400">User ID:</span>
                <span className="text-mist-100">{user?.id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-ink-700/50">
                <span className="text-mist-400">Email:</span>
                <span className="text-mist-100">{user?.email}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-ink-700/50">
                <span className="text-mist-400">Role:</span>
                <span className="text-status-ok font-semibold">{user?.role}</span>
              </div>
            </div>
          </div>

          <div className="bg-ink-900 border border-ink-700 p-4">
            <div className="flex items-center space-x-2 text-xs font-semibold text-mist-400 mb-3 font-mono">
              <Building className="w-4 h-4 text-signal-blue" />
              <span>Organization Context</span>
            </div>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-ink-700/50">
                <span className="text-mist-400">Org ID:</span>
                <span className="text-mist-100">{organization?.id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-ink-700/50">
                <span className="text-mist-400">Org Name:</span>
                <span className="text-mist-100">{organization?.name}</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
