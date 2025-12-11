// ============================================================================
// Cache Provider - Unified Provider Component
// ============================================================================
// Main provider for the unified cache architecture
// Handles initialization, hydration, WebSocket, and prefetch
//
// v13.0.0: Hydration Gate Pattern
// - isMetadataLoaded is the gate signal for MetadataGate component
// - AuthContext calls setMetadataLoaded(true) after prefetch completes
// - MetadataGate blocks rendering until isMetadataLoaded === true
//
// v14.2.0: Logout Gate Pattern
// - isLoggingOut is the gate signal for LogoutGate component
// - AuthContext calls setLoggingOut(true) to start logout flow
// - LogoutGate shows stepper UI during cache clearing
// ============================================================================

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { queryClient, clearQueryCache } from './cache/client';
// v11.0.0: Removed clearAllSyncStores - TanStack Query cache is the single source of truth
import { hydrateFromDexie, type HydrationResult } from './persistence/hydrate';
import { clearAllExceptDrafts } from './persistence/operations';
import { wsManager } from './realtime/manager';
import type { ConnectionStatus } from './cache/types';
import {
  prefetchGlobalSettings,
  prefetchAllDatalabels,
  prefetchEntityCodes,
} from './cache/hooks';

// ============================================================================
// Context
// ============================================================================

interface CacheContextValue {
  /** WebSocket connection status */
  syncStatus: ConnectionStatus;
  /** IndexedDB hydration complete */
  isHydrated: boolean;
  /** Hydration result details */
  hydrationResult: HydrationResult | null;
  /**
   * v13.0.0: Metadata prefetch complete - GATE SIGNAL
   * When true, all session-level metadata is guaranteed available:
   * - getDatalabelSync() will return data (not null)
   * - getEntityCodesSync() will return data (not null)
   * - getEntityInstanceNameSync() will return names for prefetched entities
   */
  isMetadataLoaded: boolean;
  /**
   * v14.2.0: Logout in progress - GATE SIGNAL
   * When true, LogoutGate shows stepper UI while cache clears
   */
  isLoggingOut: boolean;
  /** App is ready to render (hydration complete) */
  isReady: boolean;
  /** Clear all caches (for logout) */
  clearCache: () => Promise<void>;
  /** Connect WebSocket with token */
  connect: (token: string) => void;
  /** Disconnect WebSocket */
  disconnect: () => void;
  /** Prefetch all metadata (used internally) */
  prefetch: () => Promise<void>;
  /**
   * v13.0.0: Set metadata loaded state
   * Called by AuthContext after all prefetch operations complete
   */
  setMetadataLoaded: (loaded: boolean) => void;
  /**
   * v14.2.0: Set logging out state
   * Called by AuthContext to trigger logout stepper UI
   */
  setLoggingOut: (loggingOut: boolean) => void;
}

const CacheContext = createContext<CacheContextValue>({
  syncStatus: 'disconnected',
  isHydrated: false,
  hydrationResult: null,
  isMetadataLoaded: false,
  isLoggingOut: false,
  isReady: false,
  clearCache: async () => {},
  connect: () => {},
  disconnect: () => {},
  prefetch: async () => {},
  setMetadataLoaded: () => {},
  setLoggingOut: () => {},
});

// ============================================================================
// Provider Component
// ============================================================================

interface CacheProviderProps {
  children: ReactNode;
  /** Show React Query DevTools in development */
  showDevTools?: boolean;
}

/**
 * Unified Cache Provider
 *
 * Features:
 * - Initializes TanStack Query client
 * - Hydrates cache from IndexedDB on startup
 * - Manages WebSocket connection
 * - Provides prefetch functions
 * - Handles cache clearing on logout
 *
 * @example
 * // In App.tsx
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
export function CacheProvider({
  children,
  showDevTools = import.meta.env.DEV,
}: CacheProviderProps) {
  const [syncStatus, setSyncStatus] = useState<ConnectionStatus>('disconnected');
  const [isHydrated, setIsHydrated] = useState(false);
  const [hydrationResult, setHydrationResult] = useState<HydrationResult | null>(
    null
  );
  const [isMetadataLoaded, setIsMetadataLoaded] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Hydrate from Dexie on mount
  useEffect(() => {
    console.log('%c[CacheProvider] MOUNTING - Starting hydration from Dexie...', 'color: #fcc419; font-weight: bold');
    hydrateFromDexie()
      .then((result) => {
        setHydrationResult(result);
        setIsHydrated(true);
        console.log(
          `%c[CacheProvider] Hydrated from IndexedDB: ${result.counts.total} records`,
          'color: #51cf66; font-weight: bold',
          result.counts
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

  // Connect WebSocket
  const connect = useCallback((token: string) => {
    wsManager.connect(token);
  }, []);

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    wsManager.disconnect();
  }, []);

  // Prefetch all metadata (internal use - AuthContext uses this)
  const prefetch = useCallback(async () => {
    console.log('%c[CacheProvider] Prefetching all metadata...', 'color: #74c0fc');

    try {
      await Promise.all([
        prefetchGlobalSettings(),
        prefetchAllDatalabels(),
        prefetchEntityCodes(),
      ]);

      // v13.0.0: Don't set isMetadataLoaded here - AuthContext will call setMetadataLoaded
      // after ALL prefetch operations complete (including prefetchRefDataEntityInstances)
      console.log(
        '%c[CacheProvider] Core metadata prefetch complete',
        'color: #51cf66; font-weight: bold'
      );
    } catch (error) {
      console.error('[CacheProvider] Metadata prefetch failed:', error);
      // Don't throw - app can continue with partial metadata
    }
  }, []);

  // v13.0.0: Setter for metadata loaded state - called by AuthContext
  const setMetadataLoaded = useCallback((loaded: boolean) => {
    setIsMetadataLoaded(loaded);
    if (loaded) {
      console.log(
        '%c[CacheProvider] ✓ Metadata gate opened - all session data loaded',
        'color: #51cf66; font-weight: bold'
      );
    }
  }, []);

  // v14.2.0: Setter for logging out state - called by AuthContext
  const setLoggingOut = useCallback((loggingOut: boolean) => {
    setIsLoggingOut(loggingOut);
    if (loggingOut) {
      console.log(
        '%c[CacheProvider] Logout started - showing stepper UI',
        'color: #fcc419; font-weight: bold'
      );
    }
  }, []);

  // Clear all caches (for logout)
  // v11.0.0: Removed clearAllSyncStores - TanStack Query cache is the single source of truth
  const clearCache = useCallback(async () => {
    wsManager.disconnect();
    clearQueryCache();
    await clearAllExceptDrafts();
    setIsMetadataLoaded(false);
    console.log('[CacheProvider] All caches cleared');
  }, []);

  const isReady = isHydrated;

  const contextValue: CacheContextValue = {
    syncStatus,
    isHydrated,
    hydrationResult,
    isMetadataLoaded,
    isLoggingOut,
    isReady,
    clearCache,
    connect,
    disconnect,
    prefetch,
    setMetadataLoaded,
    setLoggingOut,
  };

  return (
    <QueryClientProvider client={queryClient}>
      <CacheContext.Provider value={contextValue}>
        {children}
      </CacheContext.Provider>
      {showDevTools && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

// ============================================================================
// Context Hooks
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
 * Check if app is ready to render
 */
export function useIsAppReady(): boolean {
  return useContext(CacheContext).isReady;
}

/**
 * Check if metadata is loaded
 */
export function useIsMetadataLoaded(): boolean {
  return useContext(CacheContext).isMetadataLoaded;
}

/**
 * Get hydration result
 */
export function useHydrationResult(): HydrationResult | null {
  return useContext(CacheContext).hydrationResult;
}

/**
 * v14.2.0: Check if logout is in progress
 */
export function useIsLoggingOut(): boolean {
  return useContext(CacheContext).isLoggingOut;
}

