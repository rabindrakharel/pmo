# Invalidation-Based Sync Architecture

> Poll `app.logging` table → Push invalidation signals → RxDB refetches only affected entities

**Version**: 1.0
**Date**: 2025-11-27

---

## Overview

Instead of pushing full entity data via WebSocket, we push **invalidation signals** that tell the client's RxDB to refetch specific entities it already has locally.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    INVALIDATION-BASED SYNC FLOW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. User A edits Project-123                                                │
│     │                                                                        │
│     ▼                                                                        │
│  2. API writes to app.project + app.logging                                 │
│     │                                                                        │
│     ▼                                                                        │
│  3. LogWatcher service (runs every 60s)                                     │
│     │  - SELECT * FROM app.logging WHERE created_ts > last_check            │
│     │  - Groups changes by entity_code + entity_id                          │
│     │                                                                        │
│     ▼                                                                        │
│  4. WebSocket broadcast: "INVALIDATE project/uuid-123"                      │
│     │                                                                        │
│     ├──────────────────────┬──────────────────────┐                         │
│     ▼                      ▼                      ▼                         │
│  User B (has project-123)  User C (no project-123)  User D (has project-123)│
│     │                      │                      │                         │
│     ▼                      ▼                      ▼                         │
│  RxDB checks local      Ignores (not local)    RxDB checks local            │
│  → EXISTS → Refetch     → No action            → EXISTS → Refetch           │
│     │                                             │                         │
│     ▼                                             ▼                         │
│  GET /api/v1/project/123                      GET /api/v1/project/123       │
│  → Update local RxDB                          → Update local RxDB           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Logging Table (Enhanced)

```sql
-- db/XXXV_logging.ddl

CREATE TABLE app.logging (
    -- Primary Identifier
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Actor (WHO performed the action)
    person_id UUID,                     -- FK to employee/customer
    fname VARCHAR(100),
    lname VARCHAR(100),
    username VARCHAR(255),
    person_type VARCHAR(50) CHECK (person_type IN ('employee', 'customer', 'system', 'guest')),

    -- Request Context
    api_endpoint VARCHAR(500),
    http_method VARCHAR(10),

    -- Target Entity (WHAT was acted upon)
    entity_code VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,

    -- Action Type
    action SMALLINT NOT NULL CHECK (action >= 0 AND action <= 5),
    -- 0=View, 1=Edit, 2=Share, 3=Delete, 4=Create, 5=Owner

    -- Versioning (State Snapshots)
    entity_from_version JSONB,
    entity_to_version JSONB,

    -- Security Context
    user_agent TEXT,
    ip INET,
    device_name VARCHAR(255),

    -- Timestamps
    created_ts TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Sync Tracking
    log_source VARCHAR(50) DEFAULT 'api',
    broadcast_ts TIMESTAMPTZ,           -- When this was broadcast to clients
    broadcast_status VARCHAR(20) DEFAULT 'pending'  -- 'pending', 'sent', 'failed'
);

-- Index for the LogWatcher query
CREATE INDEX idx_logging_pending_broadcast
    ON app.logging(created_ts)
    WHERE broadcast_status = 'pending';

-- Index for entity lookups
CREATE INDEX idx_logging_entity
    ON app.logging(entity_code, entity_id, created_ts DESC);

-- Exclude VIEW actions from broadcast (optional - views don't change data)
CREATE INDEX idx_logging_changes_only
    ON app.logging(created_ts)
    WHERE broadcast_status = 'pending' AND action != 0;
```

---

## Backend Implementation

### 1. Log Watcher Service

```typescript
// apps/api/src/services/log-watcher.service.ts

import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { connectionManager } from './connection-manager.service.js';

interface LogEntry {
  id: string;
  entity_code: string;
  entity_id: string;
  action: number;
  person_id: string | null;
  created_ts: Date;
}

interface InvalidationBatch {
  entityCode: string;
  entityIds: string[];
  action: 'UPDATE' | 'DELETE' | 'CREATE';
}

// Configuration
const POLL_INTERVAL_MS = 60_000;  // 1 minute
const BATCH_SIZE = 1000;

// State
let lastCheckTime: Date = new Date();
let isRunning = false;
let pollTimer: NodeJS.Timeout | null = null;

/**
 * Start the log watcher polling loop
 */
export function startLogWatcher(): void {
  if (isRunning) {
    console.warn('[LogWatcher] Already running');
    return;
  }

  isRunning = true;
  lastCheckTime = new Date(Date.now() - POLL_INTERVAL_MS); // Start from 1 min ago

  console.log('%c[LogWatcher] Started (polling every %ds)', 'color: #7c3aed', POLL_INTERVAL_MS / 1000);

  // Initial check
  checkForChanges();

  // Schedule periodic checks
  pollTimer = setInterval(checkForChanges, POLL_INTERVAL_MS);
}

/**
 * Stop the log watcher
 */
export function stopLogWatcher(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  isRunning = false;
  console.log('[LogWatcher] Stopped');
}

/**
 * Check for new log entries and broadcast invalidations
 */
async function checkForChanges(): Promise<void> {
  const checkStartTime = new Date();

  try {
    // 1. Fetch pending log entries (exclude VIEW actions - they don't change data)
    const logs = await db.execute<LogEntry>(sql`
      SELECT id, entity_code, entity_id, action, person_id, created_ts
      FROM app.logging
      WHERE created_ts > ${lastCheckTime}
        AND broadcast_status = 'pending'
        AND action != 0  -- Exclude VIEW
      ORDER BY created_ts ASC
      LIMIT ${BATCH_SIZE}
    `);

    if (logs.length === 0) {
      lastCheckTime = checkStartTime;
      return;
    }

    console.log(`[LogWatcher] Found ${logs.length} changes to broadcast`);

    // 2. Group by entity_code for efficient broadcasting
    const batches = groupLogsByEntity(logs);

    // 3. Broadcast invalidations
    for (const batch of batches) {
      await broadcastInvalidation(batch);
    }

    // 4. Mark logs as broadcast
    const logIds = logs.map(l => l.id);
    await db.execute(sql`
      UPDATE app.logging
      SET broadcast_status = 'sent',
          broadcast_ts = now()
      WHERE id = ANY(${logIds}::uuid[])
    `);

    lastCheckTime = checkStartTime;

    console.log(`[LogWatcher] Broadcast ${batches.length} batches, ${logs.length} total changes`);

  } catch (error) {
    console.error('[LogWatcher] Error checking for changes:', error);
  }
}

/**
 * Group log entries by entity_code for batch broadcasting
 */
function groupLogsByEntity(logs: LogEntry[]): InvalidationBatch[] {
  const groups = new Map<string, { ids: Set<string>; actions: Set<number> }>();

  for (const log of logs) {
    const key = log.entity_code;

    if (!groups.has(key)) {
      groups.set(key, { ids: new Set(), actions: new Set() });
    }

    const group = groups.get(key)!;
    group.ids.add(log.entity_id);
    group.actions.add(log.action);
  }

  return Array.from(groups.entries()).map(([entityCode, { ids, actions }]) => ({
    entityCode,
    entityIds: Array.from(ids),
    // Determine action type (DELETE takes precedence, then CREATE, then UPDATE)
    action: actions.has(3) ? 'DELETE' : actions.has(4) ? 'CREATE' : 'UPDATE'
  }));
}

/**
 * Broadcast invalidation to connected WebSocket clients
 */
async function broadcastInvalidation(batch: InvalidationBatch): Promise<void> {
  const message = JSON.stringify({
    type: 'INVALIDATE',
    payload: {
      entityCode: batch.entityCode,
      entityIds: batch.entityIds,
      action: batch.action,
      timestamp: new Date().toISOString()
    }
  });

  // Get all connections subscribed to this entity type
  const connections = connectionManager.getSubscribedConnections(batch.entityCode);

  let sentCount = 0;
  for (const conn of connections) {
    try {
      if (conn.socket.readyState === 1) { // WebSocket.OPEN
        conn.socket.send(message);
        sentCount++;
      }
    } catch (error) {
      console.error(`[LogWatcher] Failed to send to ${conn.userId}:`, error);
    }
  }

  console.log(
    `[LogWatcher] Broadcast INVALIDATE ${batch.entityCode} (${batch.entityIds.length} ids) to ${sentCount} clients`
  );
}

/**
 * Force immediate check (for testing or manual trigger)
 */
export async function forceCheck(): Promise<void> {
  await checkForChanges();
}

/**
 * Get watcher status
 */
export function getWatcherStatus(): { isRunning: boolean; lastCheck: Date; interval: number } {
  return {
    isRunning,
    lastCheck: lastCheckTime,
    interval: POLL_INTERVAL_MS
  };
}
```

---

### 2. Connection Manager (Updated)

```typescript
// apps/api/src/services/connection-manager.service.ts

import type { WebSocket } from 'ws';

interface UserConnection {
  socket: WebSocket;
  userId: string;
  subscribedEntities: Set<string>;
  connectedAt: Date;
}

class ConnectionManager {
  private connections: Map<string, Set<UserConnection>> = new Map();
  private socketToConnection: WeakMap<WebSocket, UserConnection> = new WeakMap();

  /**
   * Add a new WebSocket connection
   */
  addConnection(userId: string, socket: WebSocket): void {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }

    const connection: UserConnection = {
      socket,
      userId,
      subscribedEntities: new Set(),
      connectedAt: new Date()
    };

    this.connections.get(userId)!.add(connection);
    this.socketToConnection.set(socket, connection);

    console.log(`[ConnectionManager] User ${userId} connected. Total: ${this.getTotalConnections()}`);
  }

  /**
   * Remove a WebSocket connection
   */
  removeConnection(userId: string, socket: WebSocket): void {
    const userConnections = this.connections.get(userId);
    if (userConnections) {
      const connection = this.socketToConnection.get(socket);
      if (connection) {
        userConnections.delete(connection);
      }

      if (userConnections.size === 0) {
        this.connections.delete(userId);
      }
    }

    console.log(`[ConnectionManager] User ${userId} disconnected. Total: ${this.getTotalConnections()}`);
  }

  /**
   * Subscribe a connection to entity type updates
   */
  subscribe(socket: WebSocket, entityCodes: string[]): void {
    const connection = this.socketToConnection.get(socket);
    if (!connection) return;

    for (const code of entityCodes) {
      connection.subscribedEntities.add(code);
    }

    console.log(`[ConnectionManager] User ${connection.userId} subscribed to: ${entityCodes.join(', ')}`);
  }

  /**
   * Unsubscribe from entity type updates
   */
  unsubscribe(socket: WebSocket, entityCodes: string[]): void {
    const connection = this.socketToConnection.get(socket);
    if (!connection) return;

    for (const code of entityCodes) {
      connection.subscribedEntities.delete(code);
    }
  }

  /**
   * Get all connections subscribed to a specific entity type
   */
  getSubscribedConnections(entityCode: string): UserConnection[] {
    const result: UserConnection[] = [];

    for (const userConnections of this.connections.values()) {
      for (const conn of userConnections) {
        if (conn.subscribedEntities.has(entityCode) || conn.subscribedEntities.has('*')) {
          result.push(conn);
        }
      }
    }

    return result;
  }

  /**
   * Get all active connections
   */
  getAllConnections(): UserConnection[] {
    const result: UserConnection[] = [];
    for (const userConnections of this.connections.values()) {
      result.push(...userConnections);
    }
    return result;
  }

  /**
   * Broadcast to all connections
   */
  broadcastToAll(message: string): number {
    let sent = 0;
    for (const conn of this.getAllConnections()) {
      try {
        if (conn.socket.readyState === 1) {
          conn.socket.send(message);
          sent++;
        }
      } catch (e) {
        // Ignore send errors
      }
    }
    return sent;
  }

  getTotalConnections(): number {
    let total = 0;
    for (const conns of this.connections.values()) {
      total += conns.size;
    }
    return total;
  }

  getConnectionStats(): { totalUsers: number; totalConnections: number; subscriptions: Record<string, number> } {
    const subscriptions: Record<string, number> = {};

    for (const userConnections of this.connections.values()) {
      for (const conn of userConnections) {
        for (const entity of conn.subscribedEntities) {
          subscriptions[entity] = (subscriptions[entity] || 0) + 1;
        }
      }
    }

    return {
      totalUsers: this.connections.size,
      totalConnections: this.getTotalConnections(),
      subscriptions
    };
  }
}

export const connectionManager = new ConnectionManager();
```

---

### 3. WebSocket Plugin

```typescript
// apps/api/src/plugins/websocket.ts

import fastifyWebsocket from '@fastify/websocket';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import { connectionManager } from '@/services/connection-manager.service.js';
import { startLogWatcher, stopLogWatcher, getWatcherStatus } from '@/services/log-watcher.service.js';

interface WSMessage {
  type: 'SUBSCRIBE' | 'UNSUBSCRIBE' | 'PING' | 'GET_STATUS';
  payload?: {
    entityCodes?: string[];
  };
}

export async function websocketPlugin(fastify: FastifyInstance): Promise<void> {
  // Register WebSocket plugin
  await fastify.register(fastifyWebsocket, {
    options: {
      maxPayload: 65536, // 64KB
      clientTracking: true
    }
  });

  // Start the log watcher when server starts
  fastify.addHook('onReady', async () => {
    startLogWatcher();
  });

  // Stop when server closes
  fastify.addHook('onClose', async () => {
    stopLogWatcher();
  });

  // WebSocket endpoint
  fastify.get('/ws/sync', {
    websocket: true,
    preHandler: fastify.auth([fastify.verifyJWT])  // Auth required
  }, (socket: WebSocket, request: FastifyRequest) => {
    const userId = (request as any).user?.sub;

    if (!userId) {
      socket.close(4001, 'Unauthorized');
      return;
    }

    // Register connection
    connectionManager.addConnection(userId, socket);

    // Send welcome message
    socket.send(JSON.stringify({
      type: 'CONNECTED',
      payload: {
        userId,
        serverTime: new Date().toISOString(),
        pollInterval: getWatcherStatus().interval
      }
    }));

    // Handle incoming messages
    socket.on('message', (data) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());
        handleMessage(socket, userId, message);
      } catch (error) {
        socket.send(JSON.stringify({
          type: 'ERROR',
          payload: { message: 'Invalid message format' }
        }));
      }
    });

    // Handle disconnect
    socket.on('close', () => {
      connectionManager.removeConnection(userId, socket);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`[WebSocket] Error for user ${userId}:`, error);
      connectionManager.removeConnection(userId, socket);
    });

    // Heartbeat
    const heartbeat = setInterval(() => {
      if (socket.readyState === 1) {
        socket.ping();
      } else {
        clearInterval(heartbeat);
      }
    }, 30000);

    socket.on('close', () => clearInterval(heartbeat));
  });

  // Status endpoint (REST)
  fastify.get('/api/v1/sync/status', {
    preHandler: fastify.auth([fastify.verifyJWT])
  }, async (request, reply) => {
    return {
      watcher: getWatcherStatus(),
      connections: connectionManager.getConnectionStats()
    };
  });
}

function handleMessage(socket: WebSocket, userId: string, message: WSMessage): void {
  switch (message.type) {
    case 'SUBSCRIBE':
      if (message.payload?.entityCodes) {
        connectionManager.subscribe(socket, message.payload.entityCodes);
        socket.send(JSON.stringify({
          type: 'SUBSCRIBED',
          payload: { entityCodes: message.payload.entityCodes }
        }));
      }
      break;

    case 'UNSUBSCRIBE':
      if (message.payload?.entityCodes) {
        connectionManager.unsubscribe(socket, message.payload.entityCodes);
        socket.send(JSON.stringify({
          type: 'UNSUBSCRIBED',
          payload: { entityCodes: message.payload.entityCodes }
        }));
      }
      break;

    case 'PING':
      socket.send(JSON.stringify({ type: 'PONG', payload: { timestamp: Date.now() } }));
      break;

    case 'GET_STATUS':
      socket.send(JSON.stringify({
        type: 'STATUS',
        payload: getWatcherStatus()
      }));
      break;

    default:
      socket.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: `Unknown message type: ${message.type}` }
      }));
  }
}
```

---

### 4. Integrate with API Server

```typescript
// apps/api/src/index.ts (add to existing)

import { websocketPlugin } from '@/plugins/websocket.js';

// Register WebSocket plugin
await fastify.register(websocketPlugin);
```

---

## Frontend Implementation

### 5. Invalidation Sync Handler

```typescript
// apps/web/src/db/replication/invalidationSync.ts

import type { PMODatabase } from '../index';

interface InvalidationMessage {
  type: 'INVALIDATE';
  payload: {
    entityCode: string;
    entityIds: string[];
    action: 'UPDATE' | 'DELETE' | 'CREATE';
    timestamp: string;
  };
}

interface WSMessage {
  type: string;
  payload?: any;
}

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4000/ws/sync';
const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000]; // Exponential backoff

/**
 * Setup WebSocket connection for invalidation-based sync
 */
export function setupInvalidationSync(
  db: PMODatabase,
  authToken: string,
  onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void
): {
  subscribe: (entityCodes: string[]) => void;
  unsubscribe: (entityCodes: string[]) => void;
  disconnect: () => void;
  getStatus: () => 'connecting' | 'connected' | 'disconnected';
} {
  let ws: WebSocket | null = null;
  let reconnectAttempt = 0;
  let reconnectTimer: number | null = null;
  let status: 'connecting' | 'connected' | 'disconnected' = 'disconnected';
  let subscribedEntities: Set<string> = new Set();

  function connect() {
    if (ws?.readyState === WebSocket.OPEN) return;

    status = 'connecting';
    onStatusChange?.(status);

    ws = new WebSocket(`${WS_URL}?token=${authToken}`);

    ws.onopen = () => {
      console.log('%c[InvalidationSync] Connected', 'color: #22c55e');
      status = 'connected';
      reconnectAttempt = 0;
      onStatusChange?.(status);

      // Re-subscribe to entities
      if (subscribedEntities.size > 0) {
        ws?.send(JSON.stringify({
          type: 'SUBSCRIBE',
          payload: { entityCodes: Array.from(subscribedEntities) }
        }));
      }
    };

    ws.onmessage = async (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        await handleMessage(message, db);
      } catch (error) {
        console.error('[InvalidationSync] Error handling message:', error);
      }
    };

    ws.onclose = () => {
      console.log('%c[InvalidationSync] Disconnected', 'color: #f97316');
      status = 'disconnected';
      onStatusChange?.(status);
      scheduleReconnect();
    };

    ws.onerror = (error) => {
      console.error('[InvalidationSync] Error:', error);
      onStatusChange?.('error');
    };
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;

    const delay = RECONNECT_DELAYS[Math.min(reconnectAttempt, RECONNECT_DELAYS.length - 1)];
    console.log(`[InvalidationSync] Reconnecting in ${delay}ms (attempt ${reconnectAttempt + 1})`);

    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      reconnectAttempt++;
      connect();
    }, delay);
  }

  function subscribe(entityCodes: string[]) {
    entityCodes.forEach(code => subscribedEntities.add(code));

    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'SUBSCRIBE',
        payload: { entityCodes }
      }));
    }
  }

  function unsubscribe(entityCodes: string[]) {
    entityCodes.forEach(code => subscribedEntities.delete(code));

    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'UNSUBSCRIBE',
        payload: { entityCodes }
      }));
    }
  }

  function disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    ws?.close();
    ws = null;
    status = 'disconnected';
  }

  // Start connection
  connect();

  return {
    subscribe,
    unsubscribe,
    disconnect,
    getStatus: () => status
  };
}

/**
 * Handle incoming WebSocket messages
 */
async function handleMessage(message: WSMessage, db: PMODatabase): Promise<void> {
  switch (message.type) {
    case 'INVALIDATE':
      await handleInvalidation(message as InvalidationMessage, db);
      break;

    case 'CONNECTED':
      console.log('[InvalidationSync] Server info:', message.payload);
      break;

    case 'SUBSCRIBED':
      console.log('[InvalidationSync] Subscribed to:', message.payload?.entityCodes);
      break;

    case 'PONG':
      // Heartbeat response
      break;

    default:
      console.log('[InvalidationSync] Unknown message:', message);
  }
}

/**
 * Handle invalidation message - refetch only entities that exist locally
 */
async function handleInvalidation(
  message: InvalidationMessage,
  db: PMODatabase
): Promise<void> {
  const { entityCode, entityIds, action } = message.payload;

  console.log(
    `%c[InvalidationSync] Received INVALIDATE: ${entityCode} (${entityIds.length} ids, action=${action})`,
    'color: #7c3aed'
  );

  const collection = db.collections[entityCode];
  if (!collection) {
    console.warn(`[InvalidationSync] Unknown collection: ${entityCode}`);
    return;
  }

  // Process each entity ID
  let refetchCount = 0;
  let deleteCount = 0;
  let skipCount = 0;

  for (const entityId of entityIds) {
    // Check if we have this entity locally
    const localDoc = await collection.findOne(entityId).exec();

    if (action === 'DELETE') {
      // Remove from local if exists
      if (localDoc) {
        await localDoc.remove();
        deleteCount++;
      } else {
        skipCount++;
      }
    } else if (localDoc) {
      // UPDATE or CREATE - only refetch if we have it locally
      await refetchEntity(collection, entityCode, entityId);
      refetchCount++;
    } else {
      // Don't have it locally - skip (unless user navigates to it later)
      skipCount++;
    }
  }

  console.log(
    `[InvalidationSync] Processed: refetched=${refetchCount}, deleted=${deleteCount}, skipped=${skipCount}`
  );
}

/**
 * Refetch a single entity from the API
 */
async function refetchEntity(
  collection: any,
  entityCode: string,
  entityId: string
): Promise<void> {
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
  const token = localStorage.getItem('auth_token'); // Or get from auth context

  try {
    const response = await fetch(`${API_URL}/api/v1/${entityCode}/${entityId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404 || response.status === 403) {
        // Entity deleted or access revoked - remove locally
        const doc = await collection.findOne(entityId).exec();
        if (doc) {
          await doc.remove();
        }
        return;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    // Upsert into RxDB
    await collection.upsert({
      ...data,
      _deleted: data.active_flag === false
    });

    console.log(`[InvalidationSync] Refetched ${entityCode}/${entityId}`);

  } catch (error) {
    console.error(`[InvalidationSync] Failed to refetch ${entityCode}/${entityId}:`, error);
  }
}
```

---

### 6. React Hook for Sync Status

```typescript
// apps/web/src/db/hooks/useInvalidationSync.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDatabase } from './useDatabase';
import { useAuth } from '@/contexts/AuthContext';
import { setupInvalidationSync } from '../replication/invalidationSync';

type SyncStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseInvalidationSyncResult {
  status: SyncStatus;
  subscribe: (entityCodes: string[]) => void;
  unsubscribe: (entityCodes: string[]) => void;
  isConnected: boolean;
}

/**
 * Hook to manage WebSocket invalidation sync
 *
 * Automatically:
 * - Connects when authenticated
 * - Reconnects on disconnect
 * - Cleans up on unmount/logout
 */
export function useInvalidationSync(
  defaultSubscriptions: string[] = []
): UseInvalidationSyncResult {
  const db = useDatabase();
  const { token, isAuthenticated } = useAuth();
  const [status, setStatus] = useState<SyncStatus>('disconnected');
  const syncRef = useRef<ReturnType<typeof setupInvalidationSync> | null>(null);

  // Setup sync when authenticated
  useEffect(() => {
    if (!isAuthenticated || !token || !db) {
      syncRef.current?.disconnect();
      syncRef.current = null;
      setStatus('disconnected');
      return;
    }

    // Setup invalidation sync
    syncRef.current = setupInvalidationSync(db, token, setStatus);

    // Subscribe to default entities
    if (defaultSubscriptions.length > 0) {
      syncRef.current.subscribe(defaultSubscriptions);
    }

    return () => {
      syncRef.current?.disconnect();
      syncRef.current = null;
    };
  }, [isAuthenticated, token, db, defaultSubscriptions.join(',')]);

  const subscribe = useCallback((entityCodes: string[]) => {
    syncRef.current?.subscribe(entityCodes);
  }, []);

  const unsubscribe = useCallback((entityCodes: string[]) => {
    syncRef.current?.unsubscribe(entityCodes);
  }, []);

  return {
    status,
    subscribe,
    unsubscribe,
    isConnected: status === 'connected'
  };
}
```

---

### 7. Usage in App

```typescript
// apps/web/src/App.tsx

import { useInvalidationSync } from '@/db/hooks/useInvalidationSync';

function App() {
  // Subscribe to core entities app-wide
  const { status, isConnected } = useInvalidationSync([
    'project',
    'task',
    'employee',
    'datalabel'
  ]);

  return (
    <div>
      {/* Optional: Show sync status indicator */}
      <SyncStatusIndicator status={status} />

      {/* Rest of app */}
      <AppRoutes />
    </div>
  );
}

// Optional status indicator component
function SyncStatusIndicator({ status }: { status: string }) {
  const colors = {
    connected: 'bg-green-500',
    connecting: 'bg-yellow-500',
    disconnected: 'bg-gray-500',
    error: 'bg-red-500'
  };

  return (
    <div className="fixed bottom-4 right-4 flex items-center gap-2 text-xs text-muted-foreground">
      <div className={`w-2 h-2 rounded-full ${colors[status] || 'bg-gray-500'}`} />
      <span>Sync: {status}</span>
    </div>
  );
}
```

---

## Message Protocol

### Server → Client

```typescript
// Connection established
{ type: 'CONNECTED', payload: { userId, serverTime, pollInterval } }

// Subscription confirmed
{ type: 'SUBSCRIBED', payload: { entityCodes: ['project', 'task'] } }

// Invalidation signal (THE KEY MESSAGE)
{
  type: 'INVALIDATE',
  payload: {
    entityCode: 'project',
    entityIds: ['uuid-1', 'uuid-2', 'uuid-3'],
    action: 'UPDATE',  // or 'DELETE', 'CREATE'
    timestamp: '2025-11-27T10:30:00Z'
  }
}

// Heartbeat
{ type: 'PONG', payload: { timestamp: 1732704600000 } }
```

### Client → Server

```typescript
// Subscribe to entity types
{ type: 'SUBSCRIBE', payload: { entityCodes: ['project', 'task'] } }

// Unsubscribe
{ type: 'UNSUBSCRIBE', payload: { entityCodes: ['project'] } }

// Heartbeat
{ type: 'PING' }
```

---

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         COMPLETE FLOW                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────┐        ┌────────────┐        ┌────────────┐                 │
│  │   User A   │        │  API Pod   │        │ PostgreSQL │                 │
│  │  (Editor)  │        │            │        │            │                 │
│  └─────┬──────┘        └─────┬──────┘        └─────┬──────┘                 │
│        │                     │                     │                         │
│        │ PATCH /project/123  │                     │                         │
│        ├────────────────────►│                     │                         │
│        │                     │ UPDATE + INSERT log │                         │
│        │                     ├────────────────────►│                         │
│        │                     │                     │                         │
│        │    200 OK           │                     │                         │
│        │◄────────────────────┤                     │                         │
│        │                     │                     │                         │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        (Every 60 seconds)                              │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                              │                     │                         │
│                              │ SELECT pending logs │                         │
│                              ├────────────────────►│                         │
│                              │◄────────────────────┤                         │
│                              │                     │                         │
│                                                                              │
│  ┌────────────┐        ┌─────┴──────┐                                       │
│  │   User B   │        │ LogWatcher │                                       │
│  │ (Viewer)   │◄───────┤  Service   │                                       │
│  └────────────┘  WS    └─────┬──────┘                                       │
│                  INVALIDATE  │                                               │
│  ┌────────────┐              │                                               │
│  │   User C   │◄─────────────┘                                               │
│  │ (Viewer)   │  WS INVALIDATE                                              │
│  └─────┬──────┘                                                              │
│        │                                                                     │
│        │ Check: Do I have project/123 locally?                              │
│        │ YES → GET /api/v1/project/123                                      │
│        │ NO  → Ignore (will fetch when needed)                              │
│        │                                                                     │
│        │                     ┌─────────────┐                                │
│        │ Fetch fresh data    │  API Pod    │                                │
│        ├────────────────────►│             │                                │
│        │◄────────────────────┤             │                                │
│        │                     └─────────────┘                                │
│        │                                                                     │
│        │ Update local RxDB                                                  │
│        │ UI auto-updates (reactive)                                         │
│        ▼                                                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Comparison with Full Push

| Aspect | Invalidation-Based (This) | Full Data Push |
|--------|---------------------------|----------------|
| **Bandwidth** | Lower (just IDs) | Higher (full entities) |
| **Latency** | +1 API call | Immediate |
| **Complexity** | Simpler | More complex |
| **RBAC** | Checked on refetch | Must filter push |
| **Partial data** | Natural (only refetch what you have) | Complex filtering |
| **Offline** | Works (REST fallback) | Requires queue |
| **Debugging** | Easier (see logs) | Harder |

**Recommendation**: Invalidation-based is better for your use case because:
1. RBAC is enforced naturally on refetch
2. Users only refetch entities they actually have
3. Simpler to implement and debug
4. Logs provide audit trail

---

## Files to Create

```
apps/api/
├── src/
│   ├── plugins/
│   │   └── websocket.ts                    # NEW
│   ├── services/
│   │   ├── connection-manager.service.ts   # NEW
│   │   └── log-watcher.service.ts          # NEW
│   └── index.ts                            # MODIFY: register plugin
├── package.json                            # ADD: @fastify/websocket

apps/web/src/
├── db/
│   ├── replication/
│   │   └── invalidationSync.ts             # NEW
│   └── hooks/
│       └── useInvalidationSync.ts          # NEW

db/
└── XXXV_logging.ddl                        # NEW (your table + indexes)
```

---

## Summary

| Question | Answer |
|----------|--------|
| **How often to check?** | Every 60 seconds (configurable) |
| **What to send?** | Just entity_code + entity_ids (not full data) |
| **Who receives?** | Only users subscribed to that entity type |
| **What does client do?** | Check if entity exists locally → refetch if yes |
| **What about RBAC?** | Enforced on the refetch API call |
| **What if offline?** | REST replication still works as fallback |
