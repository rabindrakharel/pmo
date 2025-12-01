// ============================================================================
// WebSocket Manager for Cache Invalidation
// ============================================================================
// Connects to PubSub service for real-time sync
// Triggers cache invalidation on INVALIDATE messages
// ============================================================================

import { WS_CONFIG } from '../cache/constants';
import type { InvalidationHandler } from './handlers';

// ============================================================================
// TYPES
// ============================================================================

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface InvalidatePayload {
  entityCode: string;
  changes: Array<{
    entityId: string;
    action: 'INSERT' | 'UPDATE' | 'DELETE';
    version: number;
  }>;
}

export interface NormalizedInvalidatePayload {
  table: 'entity' | 'entity_instance' | 'entity_instance_link';
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  entity_code?: string;
  entity_instance_id?: string;
  child_entity_code?: string;
  child_entity_instance_id?: string;
  relationship_type?: string;
}

export interface LinkChangePayload {
  action: 'INSERT' | 'DELETE';
  entity_code: string;
  entity_instance_id: string;
  child_entity_code: string;
  child_entity_instance_id: string;
  relationship_type?: string;
}

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

type StatusListener = (status: ConnectionStatus) => void;
type TokenExpiryListener = (expiresIn: number) => void;

// ============================================================================
// WEBSOCKET MANAGER CLASS
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

  // Version tracking with cleanup (prevents memory leak)
  private processedVersions = new Map<string, { version: number; timestamp: number }>();

  // Event listeners
  private statusListeners = new Set<StatusListener>();
  private tokenExpiryListeners = new Set<TokenExpiryListener>();

  // Invalidation handler (injected)
  private invalidationHandler: InvalidationHandler | null = null;

  // ========================================
  // Configuration
  // ========================================

  /**
   * Set the invalidation handler
   * Must be called before processing messages
   */
  setInvalidationHandler(handler: InvalidationHandler): void {
    this.invalidationHandler = handler;
  }

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
      this.ws = new WebSocket(`${WS_CONFIG.url}?token=${token}`);
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
   * Pass empty entityIds array to subscribe to ALL updates for an entity type
   */
  subscribe(entityCode: string, entityIds: string[]): void {
    if (this.status !== 'connected') {
      // Queue for later
      const pending = this.pendingSubscriptions.get(entityCode) || new Set();
      if (entityIds.length === 0) {
        pending.add('__TYPE_LEVEL__');
      } else {
        entityIds.forEach((id) => pending.add(id));
      }
      this.pendingSubscriptions.set(entityCode, pending);
      return;
    }

    const active = this.activeSubscriptions.get(entityCode) || new Set();

    // Type-level subscription
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
    listener(this.status);
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
        this.handleLinkChange(message.payload as LinkChangePayload);
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

  private handleInvalidate(payload: InvalidatePayload): void {
    if (!this.invalidationHandler) {
      console.warn('[WebSocket] No invalidation handler set');
      return;
    }

    const { entityCode, changes } = payload;
    console.log(
      `%c[WebSocket] INVALIDATE: ${entityCode} (${changes.length} changes)`,
      'color: #845ef7; font-weight: bold'
    );

    const now = Date.now();

    for (const change of changes) {
      const versionKey = `${entityCode}:${change.entityId}`;
      const entry = this.processedVersions.get(versionKey);
      const lastVersion = entry?.version || 0;

      // Skip stale updates
      if (change.version <= lastVersion) {
        console.log(`[WebSocket] Skipping stale update: ${versionKey}`);
        continue;
      }

      this.processedVersions.set(versionKey, { version: change.version, timestamp: now });

      // Delegate to handler
      this.invalidationHandler.onEntityChange({
        entityCode,
        entityId: change.entityId,
        action: change.action,
      });
    }

    this.cleanupVersionEntries();
  }

  private handleNormalizedInvalidate(payload: NormalizedInvalidatePayload): void {
    if (!this.invalidationHandler) return;

    console.log(
      `%c[WebSocket] NORMALIZED_INVALIDATE: ${payload.table} (${payload.action})`,
      'color: #ff922b; font-weight: bold'
    );

    this.invalidationHandler.onNormalizedChange(payload);
  }

  private handleLinkChange(payload: LinkChangePayload): void {
    if (!this.invalidationHandler) return;

    if (
      !payload.entity_code ||
      !payload.entity_instance_id ||
      !payload.child_entity_code ||
      !payload.child_entity_instance_id
    ) {
      console.warn('[WebSocket] LINK_CHANGE missing required fields:', payload);
      return;
    }

    console.log(
      `%c[WebSocket] LINK_CHANGE: ${payload.action}`,
      'color: #20c997; font-weight: bold',
      `${payload.entity_code}:${payload.entity_instance_id} → ${payload.child_entity_code}:${payload.child_entity_instance_id}`
    );

    this.invalidationHandler.onLinkChange({
      action: payload.action,
      parentCode: payload.entity_code,
      parentId: payload.entity_instance_id,
      childCode: payload.child_entity_code,
      childId: payload.child_entity_instance_id,
      relationshipType: payload.relationship_type || 'contains',
    });
  }

  private cleanupVersionEntries(): void {
    const now = Date.now();

    // Remove expired entries
    for (const [key, entry] of this.processedVersions.entries()) {
      if (now - entry.timestamp > WS_CONFIG.versionEntryTTL) {
        this.processedVersions.delete(key);
      }
    }

    // Enforce max size
    if (this.processedVersions.size > WS_CONFIG.maxVersionEntries) {
      const entries = Array.from(this.processedVersions.entries()).sort(
        (a, b) => a[1].timestamp - b[1].timestamp
      );

      const toRemove = entries.slice(0, entries.length - WS_CONFIG.maxVersionEntries);
      for (const [key] of toRemove) {
        this.processedVersions.delete(key);
      }

      console.log(
        `[WebSocket] Cleaned up ${toRemove.length} version entries (max: ${WS_CONFIG.maxVersionEntries})`
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
    }, WS_CONFIG.pingInterval);
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    if (this.reconnectAttempts >= WS_CONFIG.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnect attempts reached');
      this.setStatus('error');
      return;
    }

    const delay = Math.min(
      WS_CONFIG.initialReconnectDelay * Math.pow(2, this.reconnectAttempts),
      WS_CONFIG.maxReconnectDelay
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
// SINGLETON INSTANCE
// ============================================================================

export const wsManager = new WebSocketManager();
