// ============================================================================
// Cache Provider
// ============================================================================
// Main provider component for the unified cache system
// Handles initialization, WebSocket connection, and session prefetch
// ============================================================================

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';

import { STORE_CONFIG, SESSION_STORE_CONFIG } from './cache/constants';
import { clearAllStores } from './cache/stores';
import { clearAllData } from './persistence/schema';
import { hydrateFromDexie, hydrateQueryCacheFromStores } from './persistence/hydrate';
import { wsManager, type ConnectionStatus } from './realtime/manager';
import { createInvalidationHandler, clearAllCaches } from './realtime/handlers';
import { prefetchSessionStores } from './hooks';

// ============================================================================
// QUERY CLIENT
// ============================================================================

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STORE_CONFIG.entityInstanceData.staleTime,
      gcTime: STORE_CONFIG.entityInstanceData.gcTime,
      refetchOnWindowFocus: false,
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      placeholderData: (previousData: unknown) => previousData,
    },
    mutations: {
      retry: 1,
    },
  },
});

// ============================================================================
// CONTEXT
// ============================================================================

interface CacheContextValue {
  /** WebSocket connection status */
  syncStatus: ConnectionStatus;
  /** IndexedDB hydration complete */
  isHydrated: boolean;
  /** Session stores prefetched */
  isSessionLoaded: boolean;
  /** App is ready to render */
  isReady: boolean;
  /** Clear all caches (for logout) */
  clearCache: () => Promise<void>;
  /** Prefetch session stores (for login) */
  prefetchSession: () => Promise<void>;
  /** Connect WebSocket (for login) */
  connectWebSocket: (token: string) => void;
  /** Disconnect WebSocket (for logout) */
  disconnectWebSocket: () => void;
}

const CacheContext = createContext<CacheContextValue>({
  syncStatus: 'disconnected',
  isHydrated: false,
  isSessionLoaded: false,
  isReady: false,
  clearCache: async () => {},
  prefetchSession: async () => {},
  connectWebSocket: () => {},
  disconnectWebSocket: () => {},
});

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

interface CacheProviderProps {
  children: ReactNode;
}

/**
 * Main provider for the unified cache system
 *
 * Features:
 * - Initializes TanStack Query client
 * - Hydrates sync stores from IndexedDB on startup
 * - Connects WebSocket with invalidation handler
 * - Prefetches session stores on login
 * - Background refresh every 10 minutes
 * - React Query DevTools in development
 *
 * @example
 * function App() {
 *   return (
 *     <CacheProvider>
 *       <AuthProvider>
 *         <Router>...</Router>
 *       </AuthProvider>
 *     </CacheProvider>
 *   );
 * }
 */
export function CacheProvider({ children }: CacheProviderProps) {
  const [syncStatus, setSyncStatus] = useState<ConnectionStatus>('disconnected');
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSessionLoaded, setIsSessionLoaded] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  // Hydrate from Dexie on mount
  useEffect(() => {
    hydrateFromDexie()
      .then((stats) => {
        // Also hydrate TanStack Query cache from sync stores
        hydrateQueryCacheFromStores(queryClient);
        setIsHydrated(true);
        console.log(
          `%c[CacheProvider] Hydrated from IndexedDB: ${stats.total} records`,
          'color: #51cf66; font-weight: bold'
        );
      })
      .catch((error) => {
        console.error('[CacheProvider] Hydration failed:', error);
        setIsHydrated(true); // Continue anyway
      });
  }, []);

  // Track WebSocket connection status
  useEffect(() => {
    return wsManager.onStatusChange(setSyncStatus);
  }, []);

  // Handle token expiry warnings
  useEffect(() => {
    return wsManager.onTokenExpiring((expiresIn) => {
      console.log(`[CacheProvider] Token expiring in ${expiresIn}s`);
      // Could trigger token refresh here
    });
  }, []);

  // Set up invalidation handler when WebSocket connects
  useEffect(() => {
    if (syncStatus === 'connected') {
      wsManager.setInvalidationHandler(createInvalidationHandler(queryClient));
    }
  }, [syncStatus]);

  // Connect WebSocket with auth token
  const connectWebSocket = useCallback((token: string) => {
    wsManager.connect(token);
  }, []);

  // Disconnect WebSocket
  const disconnectWebSocket = useCallback(() => {
    wsManager.disconnect();
  }, []);

  // Prefetch session stores
  const prefetchSession = useCallback(async () => {
    try {
      await prefetchSessionStores(queryClient);
      setIsSessionLoaded(true);

      // Start background refresh interval
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
      const interval = setInterval(() => {
        console.log('%c[CacheProvider] Background refresh...', 'color: #74c0fc');
        prefetchSessionStores(queryClient).catch((error) => {
          console.error('[CacheProvider] Background refresh failed:', error);
        });
      }, SESSION_STORE_CONFIG.refreshInterval);
      setRefreshInterval(interval);
    } catch (error) {
      console.error('[CacheProvider] Session prefetch failed:', error);
      // Continue anyway - hooks will fetch on demand
      setIsSessionLoaded(true);
    }
  }, [refreshInterval]);

  // Clear all caches (for logout)
  const clearCache = useCallback(async () => {
    // Stop background refresh
    if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }

    // Disconnect WebSocket
    disconnectWebSocket();

    // Clear sync stores
    clearAllStores();

    // Clear TanStack Query and Dexie
    await clearAllCaches(queryClient);

    setIsSessionLoaded(false);
  }, [refreshInterval, disconnectWebSocket]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [refreshInterval]);

  const isReady = isHydrated;

  const contextValue: CacheContextValue = {
    syncStatus,
    isHydrated,
    isSessionLoaded,
    isReady,
    clearCache,
    prefetchSession,
    connectWebSocket,
    disconnectWebSocket,
  };

  return (
    <QueryClientProvider client={queryClient}>
      <CacheContext.Provider value={contextValue}>
        {children}
      </CacheContext.Provider>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Access full cache context
 */
export function useCacheContext(): CacheContextValue {
  return useContext(CacheContext);
}

/**
 * Get WebSocket sync status
 */
export function useSyncStatus(): ConnectionStatus {
  return useContext(CacheContext).syncStatus;
}

/**
 * Check if app is ready to render (hydration complete)
 */
export function useIsAppReady(): boolean {
  return useContext(CacheContext).isReady;
}

/**
 * Check if session stores are loaded
 */
export function useIsSessionLoaded(): boolean {
  return useContext(CacheContext).isSessionLoaded;
}
