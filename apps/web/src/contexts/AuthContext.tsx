import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi, User } from '../lib/api';
import { clearNormalizedStore } from '../lib/cache/normalizedCache';
import { prefetchRefDataEntityInstances } from '../lib/hooks';
// v9.0.0: TanStack Query + Dexie handles metadata caching
import {
  clearAllCaches,
  resetDatabase,
  prefetchAllDatalabels,
  prefetchEntityCodes,
  prefetchGlobalSettings,
} from '../db/tanstack-index';
// v13.0.0: Hydration Gate Pattern - signal when metadata is loaded
import { useCacheContext } from '../db/Provider';

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
  // v13.0.0: Access cache context for metadata gate
  const { setMetadataLoaded, clearCache } = useCacheContext();
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // v13.0.0: Unified metadata loading with gate signal
  // This function loads ALL session-level metadata and signals the gate when complete
  const loadAllMetadata = async () => {
    try {
      // Step 1: Prefetch core metadata in parallel
      await Promise.all([
        prefetchAllDatalabels(),
        prefetchEntityCodes(),
        prefetchGlobalSettings(),
      ]);

      // Step 2: Prefetch entity instance names for dropdown caches
      await prefetchRefDataEntityInstances(queryClient, [
        'employee',
        'project',
        'business',
        'office',
        'role',
        'customer',
      ]);

      // v13.0.0: Signal gate - ALL metadata is now loaded
      // After this, getDatalabelSync() and other sync accessors are guaranteed to return data
      setMetadataLoaded(true);
    } catch (error) {
      console.error('[AuthContext] Metadata prefetch failed:', error);
      // Still signal gate - partial data is better than blocking forever
      setMetadataLoaded(true);
    }
  };

  const login = async (email: string, password: string) => {
    // v13.0.0: Close the gate while loading new session
    setMetadataLoaded(false);

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

      // v9.2.0: Reset Dexie database on login for fresh state (delete + recreate)
      queryClient.clear();
      await resetDatabase();

      // v13.0.0: Load ALL metadata and signal gate when complete
      await loadAllMetadata();
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    // v13.0.0: Close the gate on logout
    setMetadataLoaded(false);

    try {
      if (state.token) {
        await authApi.logout();
      }
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      localStorage.removeItem('auth_token');

      // v13.0.0: Use unified cache clearing from CacheProvider
      await clearCache();
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

      // v13.0.0: Load ALL metadata and signal gate when complete
      await loadAllMetadata();
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
