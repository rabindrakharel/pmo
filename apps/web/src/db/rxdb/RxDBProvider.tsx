// ============================================================================
// RxDB Provider - Application State Management
// ============================================================================
// Provides offline-first, persistent storage with real-time sync
// ============================================================================

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { type PMODatabase, getDatabase, clearDatabase } from './database';
import {
  getReplicationManager,
  initializeReplication,
  type ReplicationStatus,
  type ReplicationManager,
} from './replication';
import { prefetchAllMetadata, clearAllMetadataCache } from './hooks/useRxMetadata';

// ============================================================================
// Context Types
// ============================================================================

interface RxDBContextValue {
  // Database instance
  db: PMODatabase | null;
  isReady: boolean;

  // Replication status
  replicationStatus: ReplicationStatus;

  // Metadata status (v8.6.0)
  isMetadataLoaded: boolean;

  // Actions
  connect: () => void;
  disconnect: () => void;
  clearAllData: () => Promise<void>;
  refreshMetadata: () => Promise<void>;
}

// ============================================================================
// Context
// ============================================================================

const RxDBContext = createContext<RxDBContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface RxDBProviderProps {
  children: ReactNode;
}

export function RxDBProvider({ children }: RxDBProviderProps) {
  const [db, setDb] = useState<PMODatabase | null>(null);
  const [replicationManager, setReplicationManager] = useState<ReplicationManager | null>(null);
  const [replicationStatus, setReplicationStatus] = useState<ReplicationStatus>('disconnected');
  const [isReady, setIsReady] = useState(false);
  const [isMetadataLoaded, setIsMetadataLoaded] = useState(false);

  // Initialize database and replication
  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        console.log('[RxDBProvider] Initializing...');

        // Initialize database
        const database = await getDatabase();
        if (!mounted) return;
        setDb(database);

        // Initialize replication manager
        const manager = await initializeReplication();
        if (!mounted) return;
        setReplicationManager(manager);

        // Subscribe to status changes
        const subscription = manager.status$.subscribe(status => {
          if (mounted) setReplicationStatus(status);
        });

        // Auto-connect if we have a token
        const token = localStorage.getItem('auth_token');
        if (token) {
          manager.connect(token);

          // v8.6.0: Prefetch all metadata (datalabels, entity codes, settings)
          prefetchAllMetadata()
            .then(() => {
              if (mounted) setIsMetadataLoaded(true);
            })
            .catch(err => {
              console.warn('[RxDBProvider] Metadata prefetch failed:', err);
              // Don't block - metadata will be fetched on demand
              if (mounted) setIsMetadataLoaded(true);
            });
        }

        setIsReady(true);
        console.log('[RxDBProvider] Ready');

        return () => {
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error('[RxDBProvider] Initialization failed:', error);
      }
    }

    initialize();

    return () => {
      mounted = false;
    };
  }, []);

  // Listen for auth token changes
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth_token' && replicationManager) {
        if (e.newValue) {
          replicationManager.connect(e.newValue);
          // Prefetch metadata on token change (login from another tab)
          setIsMetadataLoaded(false);
          prefetchAllMetadata()
            .then(() => setIsMetadataLoaded(true))
            .catch(() => setIsMetadataLoaded(true));
        } else {
          replicationManager.disconnect();
          setIsMetadataLoaded(false);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [replicationManager]);

  // Connect to replication
  const connect = useCallback(() => {
    const token = localStorage.getItem('auth_token');
    if (token && replicationManager) {
      replicationManager.connect(token);
    }
  }, [replicationManager]);

  // Disconnect from replication
  const disconnect = useCallback(() => {
    replicationManager?.disconnect();
  }, [replicationManager]);

  // Clear all data (logout)
  const clearAllData = useCallback(async () => {
    console.log('[RxDBProvider] Clearing all data...');
    replicationManager?.disconnect();
    setIsMetadataLoaded(false);

    // Clear metadata cache first (v8.6.0)
    await clearAllMetadataCache();
    await clearDatabase();
    setDb(null);
    setIsReady(false);

    // Re-initialize
    const database = await getDatabase();
    setDb(database);
    setIsReady(true);
    console.log('[RxDBProvider] Data cleared, database re-initialized');
  }, [replicationManager]);

  // Refresh metadata (v8.6.0)
  const refreshMetadata = useCallback(async () => {
    console.log('[RxDBProvider] Refreshing metadata...');
    setIsMetadataLoaded(false);
    await clearAllMetadataCache();
    await prefetchAllMetadata();
    setIsMetadataLoaded(true);
    console.log('[RxDBProvider] Metadata refreshed');
  }, []);

  // Cleanup replication on unmount (but keep database open for persistence)
  useEffect(() => {
    return () => {
      // Only disconnect replication, don't destroy the database
      // Database should persist across component unmounts for offline-first behavior
      replicationManager?.disconnect();
    };
  }, [replicationManager]);

  const value: RxDBContextValue = {
    db,
    isReady,
    replicationStatus,
    isMetadataLoaded,
    connect,
    disconnect,
    clearAllData,
    refreshMetadata,
  };

  return (
    <RxDBContext.Provider value={value}>
      {children}
    </RxDBContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Access RxDB context
 */
export function useRxDB(): RxDBContextValue {
  const context = useContext(RxDBContext);
  if (!context) {
    throw new Error('[RxDB] useRxDB must be used within RxDBProvider');
  }
  return context;
}

/**
 * Get just the replication status
 */
export function useReplicationStatus(): ReplicationStatus {
  const { replicationStatus } = useRxDB();
  return replicationStatus;
}

/**
 * Check if database is ready
 */
export function useRxDBReady(): boolean {
  const { isReady } = useRxDB();
  return isReady;
}

/**
 * Check if metadata is loaded (v8.6.0)
 */
export function useMetadataLoaded(): boolean {
  const { isMetadataLoaded } = useRxDB();
  return isMetadataLoaded;
}
