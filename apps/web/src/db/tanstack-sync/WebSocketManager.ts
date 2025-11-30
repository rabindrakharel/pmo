// ============================================================================
// WebSocket Manager for Cache Invalidation
// ============================================================================
// Connects to PubSub service (port 4001) for real-time sync
// Triggers TanStack Query cache invalidation on INVALIDATE messages
// ============================================================================

import { queryClient, invalidateEntityQueries } from '../query/queryClient';
import { db, createEntityInstanceKey } from '../dexie/database';
import {
  cacheAdapter,
  createInvalidationHandler,
  QUERY_KEYS,
  type WebSocketInvalidation,
  type EntityLink,
  invalidateEntityLinks,
  addLinkToCache,
  removeLinkFromCache,
} from '../normalized-cache';

// ============================================================================
// Constants
// ============================================================================

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4001';
const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;
const PING_INTERVAL = 30000;

// ============================================================================
// Types
// ============================================================================

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface InvalidatePayload {
  entityCode: string;
  changes: Array<{
    entityId: string;
    action: 'INSERT' | 'UPDATE' | 'DELETE';
    version: number;
  }>;
}

/**
 * Payload for normalized cache table invalidations
 */
interface NormalizedInvalidatePayload {
  table: 'entity' | 'entity_instance' | 'entity_instance_link';
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  entity_code?: string;
  entity_instance_id?: string;
  child_entity_code?: string;
  child_entity_instance_id?: string;
  relationship_type?: string;
}

interface WebSocketMessage {
  type: 'INVALIDATE' | 'NORMALIZED_INVALIDATE' | 'LINK_CHANGE' | 'SUBSCRIBED' | 'PONG' | 'TOKEN_EXPIRING_SOON' | 'ERROR';
  payload?: unknown;
}

type StatusListener = (status: ConnectionStatus) => void;
type TokenExpiryListener = (expiresIn: number) => void;

// ============================================================================
// WebSocket Manager Class
// ============================================================================

class WebSocketManager {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private status: ConnectionStatus = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  // Subscription tracking
  private pendingSubscriptions = new Map<string, Set<string>>();
  private activeSubscriptions = new Map<string, Set<string>>();

  // Version tracking for out-of-order message handling
  private processedVersions = new Map<string, number>();

  // Event listeners
  private statusListeners = new Set<StatusListener>();
  private tokenExpiryListeners = new Set<TokenExpiryListener>();

  // ========================================
  // Connection Management
  // ========================================

  /**
   * Connect to WebSocket server
   */
  connect(token: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Already connected');
      return;
    }

    this.token = token;
    this.setStatus('connecting');

    try {
      this.ws = new WebSocket(`${WS_URL}?token=${token}`);
      this.setupEventHandlers();
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      this.setStatus('error');
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.cleanup();
    this.token = null;
    this.activeSubscriptions.clear();
    this.pendingSubscriptions.clear();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.setStatus('disconnected');
  }

  /**
   * Refresh token for existing connection
   */
  refreshToken(newToken: string): void {
    this.token = newToken;
    this.send({
      type: 'TOKEN_REFRESH',
      payload: { token: newToken },
    });
  }

  // ========================================
  // Subscription Management
  // ========================================

  /**
   * Subscribe to entity updates
   */
  subscribe(entityCode: string, entityIds: string[]): void {
    if (entityIds.length === 0) return;

    if (this.status !== 'connected') {
      // Queue for later
      const pending = this.pendingSubscriptions.get(entityCode) || new Set();
      entityIds.forEach((id) => pending.add(id));
      this.pendingSubscriptions.set(entityCode, pending);
      return;
    }

    // Track active subscriptions
    const active = this.activeSubscriptions.get(entityCode) || new Set();
    const newIds = entityIds.filter((id) => !active.has(id));

    if (newIds.length === 0) return;

    newIds.forEach((id) => active.add(id));
    this.activeSubscriptions.set(entityCode, active);

    this.send({
      type: 'SUBSCRIBE',
      payload: { entityCode, entityIds: newIds },
    });
  }

  /**
   * Unsubscribe from entity updates
   */
  unsubscribe(entityCode: string, entityIds?: string[]): void {
    if (entityIds) {
      const active = this.activeSubscriptions.get(entityCode);
      if (active) {
        entityIds.forEach((id) => active.delete(id));
      }
    } else {
      this.activeSubscriptions.delete(entityCode);
    }

    this.send({
      type: entityIds ? 'UNSUBSCRIBE' : 'UNSUBSCRIBE_ALL',
      payload: entityIds ? { entityCode, entityIds } : undefined,
    });
  }

  // ========================================
  // Status & Event Listeners
  // ========================================

  getStatus(): ConnectionStatus {
    return this.status;
  }

  onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status); // Immediately call with current status
    return () => this.statusListeners.delete(listener);
  }

  onTokenExpiring(listener: TokenExpiryListener): () => void {
    this.tokenExpiryListeners.add(listener);
    return () => this.tokenExpiryListeners.delete(listener);
  }

  // ========================================
  // Private Methods
  // ========================================

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log(
        '%c[WebSocket] Connected to PubSub service',
        'color: #51cf66; font-weight: bold'
      );
      this.setStatus('connected');
      this.reconnectAttempts = 0;
      this.startPingInterval();
      this.flushPendingSubscriptions();
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error);
      }
    };

    this.ws.onclose = (event) => {
      console.log(`[WebSocket] Disconnected (code: ${event.code})`);
      this.cleanup();
      this.setStatus('disconnected');

      // Don't reconnect on auth errors
      if (event.code === 4001 || event.code === 4002) {
        console.log('[WebSocket] Auth error, not reconnecting');
        return;
      }

      if (this.token) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
      this.setStatus('error');
    };
  }

  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'INVALIDATE':
        this.handleInvalidate(message.payload as InvalidatePayload);
        break;

      case 'NORMALIZED_INVALIDATE':
        this.handleNormalizedInvalidate(message.payload as NormalizedInvalidatePayload);
        break;

      case 'LINK_CHANGE':
        this.handleLinkChange(message.payload as NormalizedInvalidatePayload);
        break;

      case 'SUBSCRIBED':
        console.log('[WebSocket] Subscription confirmed:', message.payload);
        break;

      case 'PONG':
        // Heartbeat received
        break;

      case 'TOKEN_EXPIRING_SOON':
        const expiresIn = (message.payload as { expiresIn?: number })?.expiresIn || 300;
        this.tokenExpiryListeners.forEach((l) => l(expiresIn));
        break;

      case 'ERROR':
        console.error('[WebSocket] Server error:', message.payload);
        break;
    }
  }

  /**
   * Handle invalidation messages for 4-layer normalized cache
   * Uses granular invalidation per entity_instance_id for efficiency
   */
  private async handleNormalizedInvalidate(payload: NormalizedInvalidatePayload): Promise<void> {
    const { table, action, entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, relationship_type } = payload;

    console.log(
      `%c[WebSocket] NORMALIZED_INVALIDATE: ${table} (${action})`,
      'color: #ff922b; font-weight: bold',
      entity_code ? `entity_code=${entity_code}` : '',
      entity_instance_id ? `entity_instance_id=${entity_instance_id}` : ''
    );

    // Use the adapter's granular invalidation handler
    const invalidation: WebSocketInvalidation = {
      action,
      table: table as WebSocketInvalidation['table'],
      entity_code: entity_code || '',
      entity_instance_id,
      child_entity_code,
      child_entity_instance_id,
      relationship_type,
      timestamp: Date.now(),
    };

    // Create handler and invoke
    const handler = createInvalidationHandler(cacheAdapter);
    handler(invalidation);

    // Additional Dexie cleanup for DELETE
    if (table === 'entity_instance' && action === 'DELETE' && entity_code && entity_instance_id) {
      const key = createEntityInstanceKey(entity_code, entity_instance_id);
      try {
        // Hard delete from entityInstance table (no isDeleted flag in new schema)
        await db.entityInstance.delete(key);
      } catch {
        // May not exist
      }
    }
  }

  /**
   * Handle link change events for optimistic updates
   */
  private handleLinkChange(payload: NormalizedInvalidatePayload): void {
    const {
      action,
      entity_code,
      entity_instance_id,
      child_entity_code,
      child_entity_instance_id,
      relationship_type,
    } = payload;

    if (!entity_code || !entity_instance_id || !child_entity_code || !child_entity_instance_id) {
      console.warn('[WebSocket] LINK_CHANGE missing required fields:', payload);
      return;
    }

    console.log(
      `%c[WebSocket] LINK_CHANGE: ${action}`,
      'color: #20c997; font-weight: bold',
      `${entity_code}:${entity_instance_id} → ${child_entity_code}:${child_entity_instance_id}`
    );

    const link: EntityLink = {
      id: '', // Not needed for cache operations
      entity_code,
      entity_instance_id,
      child_entity_code,
      child_entity_instance_id,
      relationship_type: relationship_type || 'contains',
    };

    if (action === 'INSERT') {
      addLinkToCache(link);
    } else if (action === 'DELETE') {
      removeLinkFromCache(link);
    }

    // Also invalidate to ensure consistency with server
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ENTITY_LINKS });
  }

  private async handleInvalidate(payload: InvalidatePayload): Promise<void> {
    const { entityCode, changes } = payload;
    console.log(
      `%c[WebSocket] INVALIDATE: ${entityCode} (${changes.length} changes)`,
      'color: #845ef7; font-weight: bold'
    );

    const entitiesToRefetch: string[] = [];
    const entitiesToDelete: string[] = [];

    for (const change of changes) {
      const versionKey = `${entityCode}:${change.entityId}`;
      const lastVersion = this.processedVersions.get(versionKey) || 0;

      // Skip stale updates (version tracking)
      if (change.version <= lastVersion) {
        console.log(`[WebSocket] Skipping stale update: ${versionKey}`);
        continue;
      }

      this.processedVersions.set(versionKey, change.version);

      if (change.action === 'DELETE') {
        entitiesToDelete.push(change.entityId);
      } else {
        entitiesToRefetch.push(change.entityId);
      }
    }

    // Handle deletions
    for (const entityId of entitiesToDelete) {
      await this.handleDelete(entityCode, entityId);
    }

    // Handle updates/creates - invalidate TanStack Query cache
    // TanStack Query will auto-refetch if there are active observers
    if (entitiesToRefetch.length > 0) {
      // Invalidate individual entity queries
      for (const entityId of entitiesToRefetch) {
        invalidateEntityQueries(entityCode, entityId);
      }

      // Invalidate list queries for this entity type
      invalidateEntityQueries(entityCode);
    }
  }

  private async handleDelete(entityCode: string, entityId: string): Promise<void> {
    const cacheKey = createEntityInstanceKey(entityCode, entityId);

    // Hard delete from Dexie entityInstance table (name lookup)
    try {
      await db.entityInstance.delete(cacheKey);
    } catch {
      // Entity might not exist in Dexie
    }

    // Remove from TanStack Query cache
    queryClient.removeQueries({
      queryKey: ['entityInstance', entityCode, entityId],
    });

    // Invalidate list queries (uses new unified key)
    invalidateEntityQueries(entityCode);
  }

  private flushPendingSubscriptions(): void {
    for (const [entityCode, entityIds] of this.pendingSubscriptions) {
      if (entityIds.size > 0) {
        this.subscribe(entityCode, Array.from(entityIds));
      }
    }
    this.pendingSubscriptions.clear();
  }

  private send(message: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.statusListeners.forEach((l) => l(status));
  }

  private startPingInterval(): void {
    this.stopPingInterval();
    this.pingInterval = setInterval(() => {
      this.send({ type: 'PING' });
    }, PING_INTERVAL);
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('[WebSocket] Max reconnect attempts reached');
      this.setStatus('error');
      return;
    }

    const delay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts),
      MAX_RECONNECT_DELAY
    );
    this.reconnectAttempts++;

    console.log(
      `[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.token) {
        this.connect(this.token);
      }
    }, delay);
  }

  private cleanup(): void {
    this.stopPingInterval();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const wsManager = new WebSocketManager();
