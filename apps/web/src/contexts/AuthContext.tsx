import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi, User } from '../lib/api';
import { clearNormalizedStore } from '../lib/cache/normalizedCache';
import { prefetchEntityInstances } from '../lib/hooks';
// v9.0.0: TanStack Query + Dexie handles metadata caching
import { clearAllCaches, hydrateQueryCache } from '../db/query/queryClient';
import {
  prefetchAllDatalabels,
  prefetchEntityCodes,
  prefetchGlobalSettings,
} from '../db/tanstack-hooks';

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

  // v9.0.0: TanStack Query + Dexie handles metadata caching
  // Prefetch all metadata (datalabels, entity codes, global settings)
  const loadMetadata = async () => {
    try {
      console.log('%c[Auth] Prefetching metadata...', 'color: #845ef7; font-weight: bold');

      // Prefetch all metadata in parallel
      const [datalabelCount, entityCodeCount, settingsOk] = await Promise.all([
        prefetchAllDatalabels(),
        prefetchEntityCodes(),
        prefetchGlobalSettings(),
      ]);

      console.log(
        '%c[Auth] ✓ Metadata loaded: %d datalabels, %d entity codes, settings: %s',
        'color: #51cf66; font-weight: bold',
        datalabelCount,
        entityCodeCount,
        settingsOk ? 'OK' : 'cached'
      );
    } catch (error) {
      console.error('[Auth] Failed to load metadata:', error);
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

      // v9.0.0: Clear all caches on logout for security and memory hygiene
      await clearAllCaches();               // Dexie IndexedDB + TanStack Query cache
      clearNormalizedStore(queryClient);    // Normalized entity cache
      queryClient.clear();                  // React Query cache (redundant but safe)

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
