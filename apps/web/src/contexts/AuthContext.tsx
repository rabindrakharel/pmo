import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi, settingApi, User } from '../lib/api';
import { clearAllMetadataStores } from '../lib/cache/garbageCollection';
import { clearNormalizedStore } from '../lib/cache/normalizedCache';
import { useDatalabelMetadataStore } from '../stores/datalabelMetadataStore';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

type AuthContextType = AuthState & AuthActions;

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Helper function to load and cache datalabels
  const loadDatalabels = async () => {
    try {
      const store = useDatalabelMetadataStore.getState();

      // Check if we have valid cached datalabels
      const cachedDatalabels = store.getAllDatalabels();

      if (cachedDatalabels && Object.keys(cachedDatalabels).length > 0) {
        console.log(
          `%c[Auth] ✓ Using cached datalabels (${Object.keys(cachedDatalabels).length} items)`,
          'color: #51cf66; font-weight: bold'
        );
        return;
      }

      // Cache is empty or expired - fetch fresh data
      console.log('%c[Auth] Fetching all datalabels...', 'color: #845ef7; font-weight: bold');
      const response = await settingApi.getAll();
      const datalabels = response.data || [];

      // Cache all datalabels in the store (persisted to localStorage)
      store.setAllDatalabels(datalabels);

      console.log(
        `%c[Auth] ✓ Cached ${datalabels.length} datalabels`,
        'color: #51cf66; font-weight: bold',
        { count: datalabels.length }
      );
    } catch (error) {
      console.error('[Auth] Failed to load datalabels:', error);
      // Don't throw - datalabels are enhancement, not critical for auth
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await authApi.login({ email, password });
      const { token, employee } = response;

      localStorage.setItem('auth_token', token);
      if (employee?.name) localStorage.setItem('user_name', employee.name);
      setState({
        user: employee,
        token,
        isLoading: false,
        isAuthenticated: true,
      });

      // Load and cache all datalabels after successful login
      await loadDatalabels();
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (state.token) {
        await authApi.logout();
      }
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      localStorage.removeItem('auth_token');

      // Clear all caches on logout for security and memory hygiene
      clearAllMetadataStores();           // Zustand metadata stores
      clearNormalizedStore(queryClient);   // Normalized entity cache
      queryClient.clear();                 // React Query cache

      setState({
        user: null,
        token: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  };

  const refreshUser = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setState(prev => ({ ...prev, isLoading: false, isAuthenticated: false }));
      return;
    }

    try {
      const user = await authApi.getProfile();
      if ((user as any)?.name) localStorage.setItem('user_name', (user as any).name);
      setState({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      });

      // Load and cache datalabels (will use cache if valid)
      await loadDatalabels();
    } catch (error) {
      console.error('Failed to refresh user:', error);
      localStorage.removeItem('auth_token');
      setState({
        user: null,
        token: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  };

  useEffect(() => {
    // Check for stored authentication on app load
    refreshUser();
  }, []);

  const value: AuthContextType = {
    ...state,
    login,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
