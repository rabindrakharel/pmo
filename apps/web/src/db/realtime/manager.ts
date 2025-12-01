// ============================================================================
// WebSocket Manager for Cache Invalidation
// ============================================================================
// Connects to PubSub service (port 4001) for real-time sync
// Triggers TanStack Query cache invalidation on INVALIDATE messages
// ============================================================================

import { queryClient, invalidateEntityQueries } from '../cache/client';
import { WEBSOCKET_CONFIG } from '../cache/constants';
import { DEXIE_KEYS } from '../cache/keys';
import { entityLinksStore } from '../cache/stores';
import type {
  ConnectionStatus,
  InvalidatePayload,
  NormalizedInvalidatePayload,
  EntityLink,
} from '../cache/types';
import { db } from '../persistence/schema';
import { clearEntityInstanceData } from '../persistence/operations';

// ============================================================================
// Constants
// ============================================================================

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4001';

// ============================================================================
// Types
// ============================================================================

type StatusListener = (status: ConnectionStatus) => void;
type TokenExpiryListener = (expiresIn: number) => void;

interface WebSocketMessage {
  type:
    | 'INVALIDATE'
    | 'NORMALIZED_INVALIDATE'
    | 'LINK_CHANGE'
    | 'SUBSCRIBED'
    | 'PONG'
    | 'TOKEN_EXPIRING_SOON'
    | 'ERROR';
  payload?: unknown;
}

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
  private processedVersions = new Map<
    string,
    { version: number; timestamp: number }
  >();

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
    this.processedVersions.clear();

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
   *
   * Pass empty entityIds array to subscribe to ALL updates for an entity type.
   * This is useful for pre-subscribing before data is loaded.
   */
  subscribe(entityCode: string, entityIds: string[]): void {
    if (this.status !== 'connected') {
      // Queue for later
      const pending =
        this.pendingSubscriptions.get(entityCode) || new Set<string>();
      if (entityIds.length === 0) {
        pending.add('__TYPE_LEVEL__');
      } else {
        entityIds.forEach((id) => pending.add(id));
      }
      this.pendingSubscriptions.set(entityCode, pending);
      return;
    }

    // Track active subscriptions
    const active =
      this.activeSubscriptions.get(entityCode) || new Set<string>();

    // Handle type-level subscription (empty array = all updates for this type)
    if (entityIds.length === 0) {
      if (!active.has('__TYPE_LEVEL__')) {
        active.add('__TYPE_LEVEL__');
        this.activeSubscriptions.set(entityCode, active);
        this.send({
          type: 'SUBSCRIBE',
          payload: { entityCode, entityIds: [] },
        });
      }
      return;
    }

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
        this.handleNormalizedInvalidate(
          message.payload as NormalizedInvalidatePayload
        );
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
        const expiresIn =
          (message.payload as { expiresIn?: number })?.expiresIn || 300;
        this.tokenExpiryListeners.forEach((l) => l(expiresIn));
        break;

      case 'ERROR':
        console.error('[WebSocket] Server error:', message.payload);
        break;
    }
  }

  private async handleInvalidate(payload: InvalidatePayload): Promise<void> {
    const { entityCode, changes } = payload;
    console.log(
      `%c[WebSocket] INVALIDATE: ${entityCode} (${changes.length} changes)`,
      'color: #845ef7; font-weight: bold'
    );

    const entitiesToRefetch: string[] = [];
    const entitiesToDelete: string[] = [];
    const now = Date.now();

    for (const change of changes) {
      const versionKey = `${entityCode}:${change.entityId}`;
      const entry = this.processedVersions.get(versionKey);
      const lastVersion = entry?.version || 0;

      // Skip stale updates (version tracking)
      if (change.version <= lastVersion) {
        console.log(`[WebSocket] Skipping stale update: ${versionKey}`);
        continue;
      }

      // Store version with timestamp for cleanup
      this.processedVersions.set(versionKey, {
        version: change.version,
        timestamp: now,
      });

      if (change.action === 'DELETE') {
        entitiesToDelete.push(change.entityId);
      } else {
        entitiesToRefetch.push(change.entityId);
      }
    }

    // Cleanup old version entries to prevent memory leak
    this.cleanupVersionEntries();

    // Handle deletions
    for (const entityId of entitiesToDelete) {
      await this.handleDelete(entityCode, entityId);
    }

    // Handle updates/creates - invalidate TanStack Query cache
    if (entitiesToRefetch.length > 0) {
      for (const entityId of entitiesToRefetch) {
        await invalidateEntityQueries(entityCode, entityId);
      }
      await invalidateEntityQueries(entityCode);
    }

    // Clear Dexie cache for this entity type
    try {
      await clearEntityInstanceData(entityCode);
    } catch (error) {
      console.warn(
        `[WebSocket] Failed to clear Dexie cache for ${entityCode}:`,
        error
      );
    }
  }

  private async handleNormalizedInvalidate(
    payload: NormalizedInvalidatePayload
  ): Promise<void> {
    const {
      table,
      action,
      entity_code,
      entity_instance_id,
    } = payload;

    console.log(
      `%c[WebSocket] NORMALIZED_INVALIDATE: ${table} (${action})`,
      'color: #ff922b; font-weight: bold',
      entity_code ? `entity_code=${entity_code}` : '',
      entity_instance_id ? `entity_instance_id=${entity_instance_id}` : ''
    );

    // Clear entity codes if entity table changed
    if (table === 'entity') {
      await queryClient.invalidateQueries({
        queryKey: ['entityCodes'],
        refetchType: 'active',
      });
    }

    // Clear entity instance data if entity_instance changed
    if (table === 'entity_instance' && entity_code) {
      await invalidateEntityQueries(entity_code, entity_instance_id);

      // Hard delete from Dexie on DELETE action
      if (action === 'DELETE' && entity_instance_id) {
        const key = DEXIE_KEYS.entityInstance(entity_code, entity_instance_id);
        try {
          await db.entityInstanceNames.delete(key);
        } catch {
          // May not exist
        }
      }
    }

    // Clear entity links if entity_instance_link changed
    if (table === 'entity_instance_link') {
      await queryClient.invalidateQueries({
        queryKey: ['entityLinks'],
        refetchType: 'active',
      });
    }
  }

  private handleLinkChange(payload: NormalizedInvalidatePayload): void {
    const {
      action,
      entity_code,
      entity_instance_id,
      child_entity_code,
      child_entity_instance_id,
      relationship_type,
    } = payload;

    if (
      !entity_code ||
      !entity_instance_id ||
      !child_entity_code ||
      !child_entity_instance_id
    ) {
      console.warn('[WebSocket] LINK_CHANGE missing required fields:', payload);
      return;
    }

    console.log(
      `%c[WebSocket] LINK_CHANGE: ${action}`,
      'color: #20c997; font-weight: bold',
      `${entity_code}:${entity_instance_id} -> ${child_entity_code}:${child_entity_instance_id}`
    );

    if (action === 'INSERT') {
      entityLinksStore.addLink(
        entity_code,
        entity_instance_id,
        child_entity_code,
        child_entity_instance_id,
        relationship_type || 'contains'
      );
    } else if (action === 'DELETE') {
      entityLinksStore.removeLink(
        entity_code,
        entity_instance_id,
        child_entity_code,
        child_entity_instance_id
      );
    }

    // Also invalidate to ensure consistency with server
    queryClient.invalidateQueries({ queryKey: ['entityLinks'] });
  }

  private async handleDelete(
    entityCode: string,
    entityId: string
  ): Promise<void> {
    const cacheKey = DEXIE_KEYS.entityInstance(entityCode, entityId);

    // Hard delete from Dexie entityInstanceNames table
    try {
      await db.entityInstanceNames.delete(cacheKey);
    } catch {
      // Entity might not exist in Dexie
    }

    // Remove from TanStack Query cache
    queryClient.removeQueries({
      queryKey: ['entityInstance', entityCode, entityId],
    });

    // Invalidate list queries
    await invalidateEntityQueries(entityCode);
  }

  private cleanupVersionEntries(): void {
    const now = Date.now();

    // Remove expired entries
    for (const [key, entry] of this.processedVersions.entries()) {
      if (now - entry.timestamp > WEBSOCKET_CONFIG.versionEntryTtl) {
        this.processedVersions.delete(key);
      }
    }

    // If still over limit, remove oldest entries
    if (this.processedVersions.size > WEBSOCKET_CONFIG.maxVersionEntries) {
      const entries = Array.from(this.processedVersions.entries()).sort(
        (a, b) => a[1].timestamp - b[1].timestamp
      );

      const toRemove = entries.slice(
        0,
        entries.length - WEBSOCKET_CONFIG.maxVersionEntries
      );
      for (const [key] of toRemove) {
        this.processedVersions.delete(key);
      }

      console.log(
        `[WebSocket] Cleaned up ${toRemove.length} version entries (max: ${WEBSOCKET_CONFIG.maxVersionEntries})`
      );
    }
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
    }, WEBSOCKET_CONFIG.pingInterval);
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    if (this.reconnectAttempts >= WEBSOCKET_CONFIG.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnect attempts reached');
      this.setStatus('error');
      return;
    }

    const delay = Math.min(
      WEBSOCKET_CONFIG.initialReconnectDelay *
        Math.pow(2, this.reconnectAttempts),
      WEBSOCKET_CONFIG.maxReconnectDelay
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
