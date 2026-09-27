import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-ink-950 flex flex-col justify-center items-center">
        <div className="flex items-center space-x-3 text-mist-400 font-mono text-xs">
          <span className="w-2 h-2 rounded-full bg-signal-blue animate-ping" />
          <span>Authenticating session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
