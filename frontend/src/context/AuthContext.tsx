import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Organization } from '../types/auth';
import { apiClient, setAccessToken } from '../api/apiClient';

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signup: (email: string, password: string, orgName: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore session on app load via /auth/refresh + /auth/me
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Attempt silent refresh using httpOnly cookie
        const refreshRes = await apiClient.post<{ accessToken: string }>('/auth/refresh');
        const token = refreshRes.data.accessToken;
        setAccessToken(token);

        // Fetch user and org profile
        const meRes = await apiClient.get<{ user: User; organization: Organization }>('/auth/me');
        setUser(meRes.data.user);
        setOrganization(meRes.data.organization);
      } catch (_err) {
        // Not logged in or session expired
        setAccessToken(null);
        setUser(null);
        setOrganization(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const signup = async (email: string, password: string, orgName: string) => {
    const res = await apiClient.post<{
      accessToken: string;
      user: User;
      organization: Organization;
    }>('/auth/signup', { email, password, orgName });

    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
    setOrganization(res.data.organization);
  };

  const login = async (email: string, password: string) => {
    const res = await apiClient.post<{
      accessToken: string;
      user: User;
      organization: Organization;
    }>('/auth/login', { email, password });

    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
    setOrganization(res.data.organization);
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (_err) {
      // Ignore logout API error
    } finally {
      setAccessToken(null);
      setUser(null);
      setOrganization(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        isAuthenticated: !!user,
        isLoading,
        signup,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
