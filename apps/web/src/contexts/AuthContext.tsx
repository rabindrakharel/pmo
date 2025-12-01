import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi, User } from '../lib/api';
import { clearNormalizedStore } from '../lib/cache/normalizedCache';
import { prefetchEntityInstances } from '../lib/hooks';
// v10.0.0: Unified 7-store cache architecture
import {
  clearAllCaches,
  prefetchSessionStores,
  useCacheContext,
} from '../db';

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

  // v10.0.0: Unified cache handles session store prefetching
  const loadMetadata = async () => {
    try {
      console.log('%c[Auth] Prefetching session stores...', 'color: #845ef7; font-weight: bold');
      await prefetchSessionStores(queryClient);
      console.log('%c[Auth] ✓ Session stores loaded', 'color: #51cf66; font-weight: bold');
    } catch (error) {
      console.error('[Auth] Failed to load session stores:', error);
      // Don't throw - metadata is enhancement, not critical for auth
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

      // v9.0.0: Load and cache all metadata after successful login (Dexie + TanStack Query)
      await loadMetadata();

      // v8.3.2: Prefetch common entity instances for dropdown caches
      // This populates the unified ref_data_entityInstance cache
      // v9.1.1: Await prefetch to prevent race condition with API upserts
      await prefetchEntityInstances(queryClient, [
        'employee',
        'project',
        'business',
        'office',
        'role',
        'cust',
      ]);
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

      // v10.0.0: Clear all caches on logout
      await clearAllCaches(queryClient);     // Unified cache + Dexie + TanStack Query
      clearNormalizedStore(queryClient);     // Legacy normalized entity cache

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

      // v9.0.0: Load and cache metadata (Dexie + TanStack Query - will use cache if valid)
      await loadMetadata();

      // v8.3.2: Prefetch common entity instances for dropdown caches
      // v9.1.1: Await prefetch to prevent race condition with API upserts
      await prefetchEntityInstances(queryClient, [
        'employee',
        'project',
        'business',
        'office',
        'role',
        'cust',
      ]);
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
