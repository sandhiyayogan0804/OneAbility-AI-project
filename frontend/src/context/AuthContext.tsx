import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (identifier: string, password: string) => Promise<void>;
  register: (payload: {
    full_name: string;
    phone_number: string;
    password: string;
    email?: string;
    upi_id?: string;
  }) => Promise<void>;
  demoLogin: () => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('oneability_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('oneability_token');
      if (storedToken) {
        try {
          const profile = await api.getMe();
          setUser(profile);
          setToken(storedToken);
        } catch {
          // Token expired or invalid
          api.removeToken();
          setUser(null);
          setToken(null);
        }
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (identifier: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const authData = await api.login(identifier, password);
      setUser(authData.user);
      setToken(authData.access_token);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify your credentials.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: {
    full_name: string;
    phone_number: string;
    password: string;
    email?: string;
    upi_id?: string;
  }) => {
    setIsLoading(true);
    setError(null);
    try {
      await api.register(payload);
      // Auto login after registration
      await login(payload.phone_number, payload.password);
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const demoLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // First attempt login with test demo account
      try {
        await login('9876543210', 'SecurePassword@123');
        return;
      } catch {
        // If demo user does not exist, register then log in
        await register({
          full_name: 'Alex Johnson',
          phone_number: '9876543210',
          email: 'testuser@oneability.ai',
          password: 'SecurePassword@123',
          upi_id: 'alex@oneability',
        });
      }
    } catch (err: any) {
      setError(err.message || 'Demo login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    api.removeToken();
    setUser(null);
    setToken(null);
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        error,
        login,
        register,
        demoLogin,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
