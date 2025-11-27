// ============================================================================
// Sync Provider - WebSocket Connection for Real-time Entity Sync
// ============================================================================
// Manages WebSocket connection to PubSub service for real-time invalidation
// ============================================================================

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { SyncContextValue, SyncStatus, ServerMessage, InvalidateMessage } from './types';

// Get WebSocket URL from environment or default
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4001';

// Reconnection settings
const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000;     // 30 seconds

// Create context with null default
const SyncContext = createContext<SyncContextValue | null>(null);

interface SyncProviderProps {
  children: ReactNode;
}

export function SyncProvider({ children }: SyncProviderProps) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<SyncStatus>('disconnected');
  const reconnectAttempts = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track processed versions to prevent duplicate processing
  const processedVersions = useRef(new Map<string, number>());

  // Pending subscriptions queue (for when connection isn't ready)
  const pendingSubscriptions = useRef<Map<string, Set<string>>>(new Map());

  /**
   * Get auth token from localStorage
   */
  const getToken = useCallback(() => {
    return localStorage.getItem('auth_token');
  }, []);

  /**
   * Handle INVALIDATE message from server
   */
  const handleInvalidate = useCallback((payload: InvalidateMessage['payload']) => {
    console.log(
      `%c[Sync] INVALIDATE: ${payload.entityCode} (${payload.changes.length} changes)`,
      'color: #845ef7; font-weight: bold',
      payload.changes.map(c => `${c.entityId.slice(0, 8)}... ${c.action}`)
    );

    for (const change of payload.changes) {
      const key = `${payload.entityCode}:${change.entityId}`;
      const lastVersion = processedVersions.current.get(key) || 0;

      // Skip if we've already processed a newer version (out-of-order protection)
      if (change.version <= lastVersion) {
        console.log(`[Sync] Skipping stale update for ${key} (v${change.version} <= v${lastVersion})`);
        continue;
      }
      processedVersions.current.set(key, change.version);

      // Invalidate React Query cache - triggers refetch
      queryClient.invalidateQueries({
        queryKey: ['entity-instance', payload.entityCode, change.entityId],
      });

      // Also invalidate list queries for this entity type
      queryClient.invalidateQueries({
        queryKey: ['entity-instance-list', payload.entityCode],
        exact: false,
      });
    }
  }, [queryClient]);

  /**
   * Handle server messages
   */
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: ServerMessage = JSON.parse(event.data);

      switch (message.type) {
        case 'INVALIDATE':
          handleInvalidate(message.payload);
          break;

        case 'TOKEN_EXPIRING_SOON':
          console.log(`[Sync] Token expiring in ${message.payload.expiresIn}s`);
          // TODO: Implement token refresh when auth supports it
          break;

        case 'SUBSCRIBED':
          console.log(`[Sync] Subscribed to ${message.payload.count} entities`);
          break;

        case 'PONG':
          // Heartbeat response - connection is alive
          break;

        case 'ERROR':
          console.error('[Sync] Server error:', message.payload.message);
          break;

        default:
          console.warn('[Sync] Unknown message type:', (message as { type: string }).type);
      }
    } catch (error) {
      console.error('[Sync] Failed to parse message:', error);
    }
  }, [handleInvalidate]);

  /**
   * Flush pending subscriptions after connection
   */
  const flushPendingSubscriptions = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    for (const [entityCode, entityIds] of pendingSubscriptions.current.entries()) {
      if (entityIds.size > 0) {
        wsRef.current.send(JSON.stringify({
          type: 'SUBSCRIBE',
          payload: {
            entityCode,
            entityIds: Array.from(entityIds),
          },
        }));
        console.log(`[Sync] Flushed pending subscription: ${entityCode} (${entityIds.size} entities)`);
      }
    }
    pendingSubscriptions.current.clear();
  }, []);

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(() => {
    const token = getToken();
    if (!token) {
      console.log('[Sync] No auth token, skipping connection');
      setStatus('disconnected');
      return;
    }

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
    }

    setStatus('connecting');
    console.log('[Sync] Connecting to PubSub service...');

    try {
      const ws = new WebSocket(`${WS_URL}?token=${token}`);

      ws.onopen = () => {
        console.log('%c[Sync] Connected to PubSub service', 'color: #51cf66; font-weight: bold');
        setStatus('connected');
        reconnectAttempts.current = 0;

        // Flush any pending subscriptions
        flushPendingSubscriptions();
      };

      ws.onmessage = handleMessage;

      ws.onclose = (event) => {
        console.log(`[Sync] Disconnected (code: ${event.code})`);
        setStatus('disconnected');
        wsRef.current = null;

        // Don't reconnect if closed intentionally (4001-4002 are auth errors)
        if (event.code === 4001 || event.code === 4002) {
          console.log('[Sync] Auth error, not reconnecting');
          return;
        }

        // Exponential backoff reconnect
        if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(
            INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts.current),
            MAX_RECONNECT_DELAY
          );
          reconnectAttempts.current++;

          console.log(`[Sync] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        } else {
          console.error('[Sync] Max reconnect attempts reached');
          setStatus('error');
        }
      };

      ws.onerror = (error) => {
        console.error('[Sync] WebSocket error:', error);
        setStatus('error');
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('[Sync] Failed to create WebSocket:', error);
      setStatus('error');
    }
  }, [getToken, handleMessage, flushPendingSubscriptions]);

  /**
   * Subscribe to entity updates
   */
  const subscribe = useCallback((entityCode: string, entityIds: string[]) => {
    if (entityIds.length === 0) return;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'SUBSCRIBE',
        payload: { entityCode, entityIds },
      }));
    } else {
      // Queue for later if not connected
      if (!pendingSubscriptions.current.has(entityCode)) {
        pendingSubscriptions.current.set(entityCode, new Set());
      }
      entityIds.forEach(id => pendingSubscriptions.current.get(entityCode)!.add(id));
    }
  }, []);

  /**
   * Unsubscribe from entity updates
   */
  const unsubscribe = useCallback((entityCode: string, entityIds?: string[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'UNSUBSCRIBE',
        payload: { entityCode, entityIds },
      }));
    }

    // Also remove from pending subscriptions
    if (entityIds) {
      const pending = pendingSubscriptions.current.get(entityCode);
      if (pending) {
        entityIds.forEach(id => pending.delete(id));
      }
    } else {
      pendingSubscriptions.current.delete(entityCode);
    }
  }, []);

  /**
   * Unsubscribe from all entities
   */
  const unsubscribeAll = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'UNSUBSCRIBE_ALL' }));
    }
    pendingSubscriptions.current.clear();
  }, []);

  // Connect when component mounts (if we have a token)
  useEffect(() => {
    const token = getToken();
    if (token) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect, getToken]);

  // Reconnect when token changes (login/logout)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth_token') {
        if (e.newValue) {
          // Token added - connect
          reconnectAttempts.current = 0;
          connect();
        } else {
          // Token removed - disconnect
          if (wsRef.current) {
            wsRef.current.close();
          }
          setStatus('disconnected');
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [connect]);

  // Heartbeat ping every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'PING' }));
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const value: SyncContextValue = {
    status,
    subscribe,
    unsubscribe,
    unsubscribeAll,
  };

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  );
}

/**
 * Hook to access sync context (required)
 * Must be used within SyncProvider - throws if not found
 */
export function useSync(): SyncContextValue {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error(
      '[Sync] useSync must be used within SyncProvider. ' +
      'Make sure SyncProvider is in your component tree.'
    );
  }
  return context;
}

/**
 * Hook to get just the sync status
 */
export function useSyncStatus(): SyncStatus {
  const { status } = useSync();
  return status;
}
