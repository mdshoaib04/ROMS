import React, { createContext, useContext, useEffect, useState } from 'react';
import { useGetMe, User, setAuthTokenGetter } from '@workspace/api-client-react';
import { useLocation } from 'wouter';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (token: string) => void;
  logout: () => void;
  role: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));

  // Wire up token getter so all API calls include Authorization header
  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem('token'));
    return () => setAuthTokenGetter(null);
  }, []);
  
  const { data: user, isLoading, error } = useGetMe({
    query: {
      enabled: !!token,
      retry: false,
    } as any
  });

  useEffect(() => {
    if (error) {
      setToken(null);
      localStorage.removeItem('token');
      setLocation('/login');
    }
  }, [error, setLocation]);

  const login = (newToken: string) => {
    setToken(newToken);
    localStorage.setItem('token', newToken);
  };

  const logout = () => {
    setToken(null);
    localStorage.removeItem('token');
    setLocation('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading: isLoading && !!token,
        login,
        logout,
        role: user?.role || null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
