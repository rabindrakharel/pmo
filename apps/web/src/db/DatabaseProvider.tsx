/**
 * DatabaseProvider - React Context for RxDB Access
 *
 * Provides the RxDB database instance to all child components.
 *
 * REPLACES: QueryClientProvider from React Query
 *
 * Features:
 * - Lazy database initialization after authentication
 * - Loading state during initialization
 * - Error handling for database failures
 * - Online/offline status tracking
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode
} from 'react';
import {
  PMODatabase,
  getDatabase,
  destroyDatabase,
  getDatabaseStats
} from './index';
import { setupReplication, stopAllReplications } from './replication';
import { initializeSyncBridge, resetSyncBridge } from './syncBridge';

// ============================================================================
// Context Types
// ============================================================================

interface DatabaseContextValue {
  /** RxDB database instance (null before initialization) */
  db: PMODatabase | null;

  /** True while database is being created */
  isLoading: boolean;

  /** Error if database initialization failed */
  error: Error | null;

  /** True if browser is online */
  isOnline: boolean;

  /** True if replication is active */
  isSyncing: boolean;

  /** Reinitialize database (e.g., after re-login) */
  reinitialize: () => Promise<void>;

  /** Get database statistics */
  getStats: () => Promise<{ collections: Record<string, number>; totalDocuments: number }>;
}

const DatabaseContext = createContext<DatabaseContextValue>({
  db: null,
  isLoading: true,
  error: null,
  isOnline: true,
  isSyncing: false,
  reinitialize: async () => {},
  getStats: async () => ({ collections: {}, totalDocuments: 0 })
});

// ============================================================================
// Provider Component
// ============================================================================

interface DatabaseProviderProps {
  children: ReactNode;
  /** Auth token for replication (optional - skip if not authenticated) */
  authToken?: string | null;
  /** Skip database initialization entirely (for unauthenticated routes) */
  skip?: boolean;
}

/**
 * DatabaseProvider - Initializes and provides RxDB database to children
 *
 * @example
 * function App() {
 *   const { token, isAuthenticated } = useAuth();
 *
 *   return (
 *     <DatabaseProvider authToken={token} skip={!isAuthenticated}>
 *       <AppRoutes />
 *     </DatabaseProvider>
 *   );
 * }
 */
export function DatabaseProvider({
  children,
  authToken,
  skip = false
}: DatabaseProviderProps) {
  const [db, setDb] = useState<PMODatabase | null>(null);
  const [isLoading, setIsLoading] = useState(!skip);
  const [error, setError] = useState<Error | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  // ========================================
  // Online/Offline Status Tracking
  // ========================================
  useEffect(() => {
    const handleOnline = () => {
      console.log('%c[DatabaseProvider] 📶 Online', 'color: #22c55e');
      setIsOnline(true);
    };

    const handleOffline = () => {
      console.log('%c[DatabaseProvider] 📴 Offline', 'color: #f97316');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ========================================
  // Database Initialization
  // ========================================
  const initDatabase = useCallback(async () => {
    if (skip) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('%c[DatabaseProvider] Initializing database...', 'color: #7c3aed; font-weight: bold');

      const database = await getDatabase();
      setDb(database);

      // Initialize sync bridge (loads RxDB data into Zustand for sync access)
      console.log('%c[DatabaseProvider] Initializing sync bridge...', 'color: #7c3aed');
      await initializeSyncBridge(database);

      // Start replication if we have an auth token
      if (authToken) {
        console.log('%c[DatabaseProvider] Starting replication...', 'color: #7c3aed');
        setIsSyncing(true);
        await setupReplication(database, authToken);
        console.log('%c[DatabaseProvider] ✅ Replication started', 'color: #22c55e');
      }

      console.log('%c[DatabaseProvider] ✅ Database ready', 'color: #22c55e; font-weight: bold');
    } catch (err) {
      console.error('[DatabaseProvider] Failed to initialize database:', err);
      setError(err instanceof Error ? err : new Error('Database initialization failed'));
    } finally {
      setIsLoading(false);
    }
  }, [authToken, skip]);

  // Initialize on mount or when auth changes
  useEffect(() => {
    initDatabase();

    // Cleanup on unmount
    return () => {
      stopAllReplications().catch(console.error);
    };
  }, [initDatabase]);

  // ========================================
  // Handle Auth Token Changes
  // ========================================
  useEffect(() => {
    // If auth token changes (re-login), restart replication
    if (db && authToken && isOnline) {
      console.log('%c[DatabaseProvider] Auth token changed, restarting replication', 'color: #7c3aed');
      stopAllReplications()
        .then(() => setupReplication(db, authToken))
        .then(() => setIsSyncing(true))
        .catch(console.error);
    }
  }, [authToken, db, isOnline]);

  // ========================================
  // Handle Online/Offline Sync
  // ========================================
  useEffect(() => {
    if (db && authToken) {
      if (isOnline && !isSyncing) {
        // Coming back online - restart replication
        console.log('%c[DatabaseProvider] Back online, restarting sync', 'color: #22c55e');
        setupReplication(db, authToken)
          .then(() => setIsSyncing(true))
          .catch(console.error);
      } else if (!isOnline && isSyncing) {
        // Going offline - stop replication
        console.log('%c[DatabaseProvider] Going offline, stopping sync', 'color: #f97316');
        stopAllReplications()
          .then(() => setIsSyncing(false))
          .catch(console.error);
      }
    }
  }, [isOnline, db, authToken, isSyncing]);

  // ========================================
  // Reinitialize Function
  // ========================================
  const reinitialize = useCallback(async () => {
    await stopAllReplications();
    resetSyncBridge();
    await destroyDatabase();
    setDb(null);
    await initDatabase();
  }, [initDatabase]);

  // ========================================
  // Get Stats Function
  // ========================================
  const getStats = useCallback(async () => {
    return getDatabaseStats();
  }, []);

  // ========================================
  // Context Value
  // ========================================
  const contextValue = useMemo<DatabaseContextValue>(() => ({
    db,
    isLoading,
    error,
    isOnline,
    isSyncing,
    reinitialize,
    getStats
  }), [db, isLoading, error, isOnline, isSyncing, reinitialize, getStats]);

  // ========================================
  // Render
  // ========================================

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Initializing local database...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-6">
          <div className="text-destructive text-4xl mb-4">⚠️</div>
          <h2 className="font-semibold text-lg mb-2">Database Error</h2>
          <p className="text-muted-foreground text-sm mb-4">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <DatabaseContext.Provider value={contextValue}>
      {children}
    </DatabaseContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Access the database instance
 *
 * @throws Error if used outside DatabaseProvider or before initialization
 *
 * @example
 * function ProjectList() {
 *   const db = useDatabase();
 *   const projects = useRxQuery('project', { selector: { active_flag: true } });
 *   // ...
 * }
 */
export function useDatabase(): PMODatabase {
  const context = useContext(DatabaseContext);

  if (!context.db) {
    throw new Error(
      'useDatabase must be used within DatabaseProvider and after initialization'
    );
  }

  return context.db;
}

/**
 * Safely access database (returns null if not ready)
 *
 * @example
 * const db = useDatabaseSafe();
 * if (!db) return <Loading />;
 */
export function useDatabaseSafe(): PMODatabase | null {
  const context = useContext(DatabaseContext);
  return context.db;
}

/**
 * Get database loading/error state
 *
 * @example
 * const { isLoading, error } = useDatabaseState();
 * if (isLoading) return <Loading />;
 * if (error) return <Error message={error.message} />;
 */
export function useDatabaseState() {
  const context = useContext(DatabaseContext);
  return {
    isLoading: context.isLoading,
    error: context.error,
    isOnline: context.isOnline,
    isSyncing: context.isSyncing
  };
}

/**
 * Check if browser is online
 */
export function useOnlineStatus(): boolean {
  const context = useContext(DatabaseContext);
  return context.isOnline;
}

/**
 * Check if replication is active
 */
export function useSyncStatus(): boolean {
  const context = useContext(DatabaseContext);
  return context.isSyncing;
}
