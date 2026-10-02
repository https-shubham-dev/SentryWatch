import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="sw-atmosphere min-h-screen flex flex-col justify-center items-center">
        <div className="flex items-center space-x-3 text-mist-400 text-[13px] sw-enter">
          <span className="w-1 h-1 rounded-full bg-signal-blue" />
          <span>Authenticating session…</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
