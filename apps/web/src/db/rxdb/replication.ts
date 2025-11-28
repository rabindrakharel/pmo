// ============================================================================
// RxDB Replication with WebSocket Sync
// ============================================================================
// Connects RxDB to the PubSub WebSocket service for real-time sync
// ============================================================================

import { Subject, type Subscription } from 'rxjs';
import { apiClient } from '../../lib/api';
import { getDatabase, type PMODatabase } from './database';
import { createEntityId, type EntityDocType } from './schemas/entity.schema';
import { cacheComponentMetadata } from './hooks/useRxMetadata';

// Get WebSocket URL from environment
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4001';

// Reconnection settings
const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

// ============================================================================
// Types
// ============================================================================

interface InvalidatePayload {
  entityCode: string;
  changes: Array<{
    entityId: string;
    action: 'INSERT' | 'UPDATE' | 'DELETE';
    version: number;
  }>;
}

interface ServerMessage {
  type: 'INVALIDATE' | 'SUBSCRIBED' | 'PONG' | 'ERROR' | 'TOKEN_EXPIRING_SOON';
  payload: unknown;
}

export type ReplicationStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// ============================================================================
// Replication Manager
// ============================================================================

export class ReplicationManager {
  private db: PMODatabase | null = null;
  private ws: WebSocket | null = null;
  private status: ReplicationStatus = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private processedVersions = new Map<string, number>();
  private pendingSubscriptions = new Map<string, Set<string>>();
  private subscriptions: Subscription[] = [];

  // Observable status stream
  public status$ = new Subject<ReplicationStatus>();

  /**
   * Initialize replication with database
   */
  async initialize(): Promise<void> {
    this.db = await getDatabase();
    console.log('[Replication] Initialized with database');
  }

  /**
   * Connect to WebSocket server
   */
  connect(token: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[Replication] Already connected');
      return;
    }

    this.setStatus('connecting');
    console.log('[Replication] Connecting to PubSub service...');

    try {
      this.ws = new WebSocket(`${WS_URL}?token=${token}`);

      this.ws.onopen = () => {
        console.log('%c[Replication] Connected to PubSub service', 'color: #51cf66; font-weight: bold');
        this.setStatus('connected');
        this.reconnectAttempts = 0;
        this.flushPendingSubscriptions();
      };

      this.ws.onmessage = (event) => this.handleMessage(event);

      this.ws.onclose = (event) => {
        console.log(`[Replication] Disconnected (code: ${event.code})`);
        this.setStatus('disconnected');

        // Don't reconnect on auth errors
        if (event.code === 4001 || event.code === 4002) {
          console.log('[Replication] Auth error, not reconnecting');
          return;
        }

        // Exponential backoff reconnect
        if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(
            INITIAL_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts),
            MAX_RECONNECT_DELAY
          );
          this.reconnectAttempts++;
          console.log(`[Replication] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
          this.reconnectTimeout = setTimeout(() => this.connect(token), delay);
        } else {
          this.setStatus('error');
        }
      };

      this.ws.onerror = (error) => {
        console.error('[Replication] WebSocket error:', error);
        this.setStatus('error');
      };
    } catch (error) {
      console.error('[Replication] Failed to create WebSocket:', error);
      this.setStatus('error');
    }
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
  }

  /**
   * Subscribe to entity updates
   */
  subscribe(entityCode: string, entityIds: string[]): void {
    if (entityIds.length === 0) return;

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'SUBSCRIBE',
        payload: { entityCode, entityIds },
      }));
    } else {
      // Queue for later
      if (!this.pendingSubscriptions.has(entityCode)) {
        this.pendingSubscriptions.set(entityCode, new Set());
      }
      entityIds.forEach(id => this.pendingSubscriptions.get(entityCode)!.add(id));
    }
  }

  /**
   * Unsubscribe from entity updates
   */
  unsubscribe(entityCode: string, entityIds?: string[]): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'UNSUBSCRIBE',
        payload: { entityCode, entityIds },
      }));
    }

    // Remove from pending
    if (entityIds) {
      const pending = this.pendingSubscriptions.get(entityCode);
      if (pending) {
        entityIds.forEach(id => pending.delete(id));
      }
    } else {
      this.pendingSubscriptions.delete(entityCode);
    }
  }

  /**
   * Fetch entity from server and store in RxDB
   */
  async fetchEntity(entityCode: string, entityId: string): Promise<EntityDocType | null> {
    if (!this.db) {
      throw new Error('[Replication] Database not initialized');
    }

    try {
      const response = await apiClient.get(`/api/v1/${entityCode}/${entityId}`);
      // apiClient.get returns AxiosResponse, data is in response.data
      const apiResponse = response.data;
      const { data, metadata, ref_data_entityInstance } = apiResponse;

      // Store full metadata structure (API sends { entityListOfInstancesTable: { viewType, editType } })
      // Downstream consumers expect metadata.entityListOfInstancesTable.viewType format
      const doc: EntityDocType = {
        _id: createEntityId(entityCode, entityId),
        entityCode,
        id: entityId,
        data: data || apiResponse,
        refData: ref_data_entityInstance,
        metadata: metadata,
        version: data?.version || 1,
        syncedAt: Date.now(),
        _deleted: false,
      };

      // Upsert into RxDB
      await this.db.entities.upsert(doc);

      // Cache component metadata from raw API response (before any Proxy wrapping)
      if (metadata) {
        const componentName = 'entityInstanceFormContainer'; // Single entity uses form view
        const componentMetadata = metadata[componentName];
        if (componentMetadata && typeof componentMetadata === 'object') {
          cacheComponentMetadata(entityCode, componentName, componentMetadata).catch(console.error);
        }
      }

      // Auto-subscribe to updates
      this.subscribe(entityCode, [entityId]);

      return doc;
    } catch (error) {
      console.error(`[Replication] Failed to fetch ${entityCode}/${entityId}:`, error);
      return null;
    }
  }

  /**
   * Fetch entity list from server and store in RxDB
   */
  async fetchEntityList(
    entityCode: string,
    params: Record<string, unknown> = {}
  ): Promise<EntityDocType[]> {
    if (!this.db) {
      throw new Error('[Replication] Database not initialized');
    }

    try {
      const response = await apiClient.get(`/api/v1/${entityCode}`, { params });
      // apiClient.get returns AxiosResponse, data is in response.data
      const apiResponse = response.data;
      const { data, metadata, ref_data_entityInstance } = apiResponse;

      // Store full metadata structure (API sends { entityListOfInstancesTable: { viewType, editType } })
      // Downstream consumers expect metadata.entityListOfInstancesTable.viewType format
      const docs: EntityDocType[] = [];
      const entityIds: string[] = [];

      for (const item of data || []) {
        const entityId = item.id;
        entityIds.push(entityId);

        const doc: EntityDocType = {
          _id: createEntityId(entityCode, entityId),
          entityCode,
          id: entityId,
          data: item,
          refData: ref_data_entityInstance,
          metadata: metadata,
          version: item.version || 1,
          syncedAt: Date.now(),
          _deleted: false,
        };

        docs.push(doc);
        await this.db.entities.upsert(doc);
      }

      // Cache component metadata from raw API response (before any Proxy wrapping)
      if (metadata) {
        const viewParam = params.view as string | undefined;
        const componentName = viewParam || 'entityListOfInstancesTable';
        const componentMetadata = metadata[componentName];
        if (componentMetadata && typeof componentMetadata === 'object') {
          cacheComponentMetadata(entityCode, componentName, componentMetadata).catch(console.error);
        }
      }

      // Auto-subscribe to all loaded entities
      if (entityIds.length > 0) {
        this.subscribe(entityCode, entityIds);
      }

      return docs;
    } catch (error) {
      console.error(`[Replication] Failed to fetch ${entityCode} list:`, error);
      return [];
    }
  }

  /**
   * Push local changes to server
   */
  async pushChanges(
    entityCode: string,
    entityId: string,
    changes: Record<string, unknown>
  ): Promise<EntityDocType | null> {
    if (!this.db) {
      throw new Error('[Replication] Database not initialized');
    }

    try {
      const response = await apiClient.patch(
        `/api/v1/${entityCode}/${entityId}`,
        changes
      );

      const updatedData = response.data || response;

      // Update RxDB with server response
      const doc: EntityDocType = {
        _id: createEntityId(entityCode, entityId),
        entityCode,
        id: entityId,
        data: updatedData,
        version: updatedData.version || 1,
        syncedAt: Date.now(),
        _deleted: false,
      };

      await this.db.entities.upsert(doc);
      return doc;
    } catch (error) {
      console.error(`[Replication] Failed to push changes for ${entityCode}/${entityId}:`, error);
      throw error;
    }
  }

  /**
   * Get current status
   */
  getStatus(): ReplicationStatus {
    return this.status;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.disconnect();
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
    this.status$.complete();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private setStatus(status: ReplicationStatus): void {
    this.status = status;
    this.status$.next(status);
  }

  private flushPendingSubscriptions(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    for (const [entityCode, entityIds] of this.pendingSubscriptions.entries()) {
      if (entityIds.size > 0) {
        this.ws.send(JSON.stringify({
          type: 'SUBSCRIBE',
          payload: { entityCode, entityIds: Array.from(entityIds) },
        }));
        console.log(`[Replication] Flushed pending: ${entityCode} (${entityIds.size})`);
      }
    }
    this.pendingSubscriptions.clear();
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message: ServerMessage = JSON.parse(event.data);

      switch (message.type) {
        case 'INVALIDATE':
          this.handleInvalidate(message.payload as InvalidatePayload);
          break;
        case 'SUBSCRIBED':
          console.log('[Replication] Subscribed:', message.payload);
          break;
        case 'PONG':
          // Heartbeat response
          break;
        case 'ERROR':
          console.error('[Replication] Server error:', message.payload);
          break;
      }
    } catch (error) {
      console.error('[Replication] Failed to parse message:', error);
    }
  }

  private async handleInvalidate(payload: InvalidatePayload): Promise<void> {
    console.log(
      `%c[Replication] INVALIDATE: ${payload.entityCode} (${payload.changes.length} changes)`,
      'color: #845ef7; font-weight: bold'
    );

    for (const change of payload.changes) {
      const key = `${payload.entityCode}:${change.entityId}`;
      const lastVersion = this.processedVersions.get(key) || 0;

      // Skip stale updates
      if (change.version <= lastVersion) {
        console.log(`[Replication] Skipping stale: ${key} v${change.version}`);
        continue;
      }
      this.processedVersions.set(key, change.version);

      // Re-fetch from server to get fresh data
      if (change.action === 'DELETE') {
        // Mark as deleted in RxDB
        await this.markDeleted(payload.entityCode, change.entityId);
      } else {
        // Fetch fresh data
        await this.fetchEntity(payload.entityCode, change.entityId);
      }
    }
  }

  private async markDeleted(entityCode: string, entityId: string): Promise<void> {
    if (!this.db) return;

    const docId = createEntityId(entityCode, entityId);
    const doc = await this.db.entities.findOne(docId).exec();

    if (doc) {
      await doc.patch({ _deleted: true });
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let replicationManager: ReplicationManager | null = null;

export function getReplicationManager(): ReplicationManager {
  if (!replicationManager) {
    replicationManager = new ReplicationManager();
  }
  return replicationManager;
}

export async function initializeReplication(): Promise<ReplicationManager> {
  const manager = getReplicationManager();
  await manager.initialize();
  return manager;
}
