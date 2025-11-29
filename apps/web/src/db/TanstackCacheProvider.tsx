// ============================================================================
// TanStack Cache Provider
// ============================================================================
// Main provider component for TanStack Query + Dexie caching
// Handles initialization, WebSocket connection, and metadata prefetch
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
import { queryClient, hydrateQueryCache, clearAllCaches } from './query/queryClient';
import { wsManager, type ConnectionStatus } from './tanstack-sync/WebSocketManager';
import {
  prefetchAllDatalabels,
  clearDatalabelCache,
} from './tanstack-hooks/useDatalabel';
import {
  prefetchGlobalSettings,
  clearGlobalSettingsCache,
} from './tanstack-hooks/useGlobalSettings';
import {
  hydrateNormalizedCache,
  prefetchNormalizedCache,
  clearNormalizedCacheMemory,
  prefetchEntityCodes,
} from './normalized-cache';
import { clearNormalizedCache as clearNormalizedCacheDexie } from './dexie/database';

// ============================================================================
// Context
// ============================================================================

interface CacheContextValue {
  /** WebSocket connection status */
  syncStatus: ConnectionStatus;
  /** IndexedDB hydration complete */
  isHydrated: boolean;
  /** Metadata prefetch complete */
  isMetadataLoaded: boolean;
  /** App is ready to render */
  isReady: boolean;
  /** Clear all caches (for logout) */
  clearCache: () => Promise<void>;
}

const CacheContext = createContext<CacheContextValue>({
  syncStatus: 'disconnected',
  isHydrated: false,
  isMetadataLoaded: false,
  isReady: false,
  clearCache: async () => {},
});

// ============================================================================
// Provider Component
// ============================================================================

interface TanstackCacheProviderProps {
  children: ReactNode;
}

/**
 * Main provider for TanStack Query + Dexie caching system
 *
 * Features:
 * - Initializes TanStack Query client
 * - Hydrates cache from IndexedDB on startup
 * - Connects WebSocket when authenticated
 * - Prefetches metadata on login
 * - Provides React Query DevTools in development
 *
 * @example
 * // In App.tsx
 * function App() {
 *   return (
 *     <TanstackCacheProvider>
 *       <AuthProvider>
 *         <Router>...</Router>
 *       </AuthProvider>
 *     </TanstackCacheProvider>
 *   );
 * }
 */
export function TanstackCacheProvider({ children }: TanstackCacheProviderProps) {
  const [syncStatus, setSyncStatus] = useState<ConnectionStatus>('disconnected');
  const [isHydrated, setIsHydrated] = useState(false);
  const [isMetadataLoaded, setIsMetadataLoaded] = useState(false);

  // Hydrate from Dexie on mount
  useEffect(() => {
    Promise.all([
      hydrateQueryCache(),
      hydrateNormalizedCache(),
    ])
      .then(([legacyCount]) => {
        setIsHydrated(true);
        console.log(
          `[CacheProvider] Hydrated from IndexedDB: ${legacyCount} legacy entities`
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

  // Clear all caches (for logout)
  const clearCache = useCallback(async () => {
    wsManager.disconnect();
    clearDatalabelCache();
    clearGlobalSettingsCache();
    clearNormalizedCacheMemory(); // Clears entity codes + all normalized cache layers
    await Promise.all([
      clearAllCaches(),
      clearNormalizedCacheDexie(),
    ]);
    setIsMetadataLoaded(false);
  }, []);

  const isReady = isHydrated;

  const contextValue: CacheContextValue = {
    syncStatus,
    isHydrated,
    isMetadataLoaded,
    isReady,
    clearCache,
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
// Hooks
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

// ============================================================================
// Auth Integration Helpers
// ============================================================================

/**
 * Connect WebSocket with auth token
 * Call this after successful login
 *
 * @param token - JWT token
 */
export function connectWebSocket(token: string): void {
  wsManager.connect(token);
}

/**
 * Disconnect WebSocket
 * Call this on logout
 */
export function disconnectWebSocket(): void {
  wsManager.disconnect();
}

/**
 * Prefetch all metadata after login
 * Call this after successful authentication
 *
 * Includes:
 * - 4-layer normalized cache (entity types, instances, links, names)
 * - Datalabels (dropdowns)
 * - Entity codes (legacy - for backward compatibility)
 * - Global settings
 *
 * @returns Promise that resolves when all metadata is loaded
 */
export async function prefetchAllMetadata(): Promise<void> {
  console.log('%c[CacheProvider] Prefetching all metadata...', 'color: #74c0fc');

  try {
    await Promise.all([
      // 4-Layer Normalized Cache (NEW)
      prefetchNormalizedCache(),
      // Legacy metadata
      prefetchAllDatalabels(),
      prefetchEntityCodes(),
      prefetchGlobalSettings(),
    ]);

    console.log(
      '%c[CacheProvider] Metadata prefetch complete',
      'color: #51cf66; font-weight: bold'
    );
  } catch (error) {
    console.error('[CacheProvider] Metadata prefetch failed:', error);
    // Don't throw - app can continue with partial metadata
  }
}
