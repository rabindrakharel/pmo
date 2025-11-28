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

// ============================================================================
// Context Types
// ============================================================================

interface RxDBContextValue {
  // Database instance
  db: PMODatabase | null;
  isReady: boolean;

  // Replication status
  replicationStatus: ReplicationStatus;

  // Actions
  connect: () => void;
  disconnect: () => void;
  clearAllData: () => Promise<void>;
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
        } else {
          replicationManager.disconnect();
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
    await clearDatabase();
    setDb(null);
    setIsReady(false);

    // Re-initialize
    const database = await getDatabase();
    setDb(database);
    setIsReady(true);
    console.log('[RxDBProvider] Data cleared, database re-initialized');
  }, [replicationManager]);

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
    connect,
    disconnect,
    clearAllData,
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
