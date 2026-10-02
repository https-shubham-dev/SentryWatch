import React from 'react';
import { Activity } from 'lucide-react';

interface AuthShellProps {
  title: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

/**
 * Brand-first auth composition — one viewport, ink atmosphere, no card-kit chrome.
 */
export const AuthShell: React.FC<AuthShellProps> = ({ title, children, footer }) => {
  return (
    <div className="sw-atmosphere min-h-screen flex flex-col justify-center items-center px-4 py-10">
      <div className="w-full max-w-md sw-enter">
        {/* Brand as hero signal */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center sw-brand-mark mb-4">
            <Activity className="w-5 h-5" strokeWidth={2.25} />
          </div>
          <h1 className="text-[28px] font-semibold tracking-tight text-mist-100 leading-none">
            SentryWatch
          </h1>
          <p className="mt-2 text-[13px] text-mist-400">
            API health monitoring for engineering teams
          </p>
        </div>

        <div className="sw-panel p-6 sw-enter-delay">
          <h2 className="text-[15px] font-semibold text-mist-100 mb-5 pb-3 border-b border-ink-700">
            {title}
          </h2>
          {children}
          <div className="mt-5 pt-4 border-t border-ink-700 text-center text-[13px] text-mist-400">
            {footer}
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-mist-400/70 font-mono">
          status · latency · incidents — live
        </p>
      </div>
    </div>
  );
};
