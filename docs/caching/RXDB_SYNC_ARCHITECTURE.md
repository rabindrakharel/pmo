# RxDB Real-Time Sync Architecture

> Single-pod architecture for local-first RxDB with PubSub-based invalidation sync

**Version**: 2.1
**Date**: 2025-11-27
**Status**: Final Design
**Deployment**: Single-pod (<500 concurrent users)

---

## Executive Summary

This architecture implements a local-first application using RxDB for client-side storage with real-time sync via WebSocket invalidation signals. The PubSub Service manages subscriptions and pushes lightweight "refetch" signals when entities change.

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Deployment | Single-pod | <500 concurrent users, simple architecture |
| Sync Strategy | Invalidation-based | Reuse existing REST API, RBAC checked on refetch |
| Subscription Storage | PostgreSQL table | Persistent across restarts, easy debugging |
| Change Detection | Polling (60s) | Simple, reliable, low overhead |
| WebSocket Protocol | Custom simple JSON | Lighter than RxDB's full replication protocol |

### Flow Summary

```
1. Client loads entities via REST API
2. Client subscribes to loaded entity IDs via WebSocket
3. PubSub Service stores subscriptions in database
4. Entity changes are logged to app.logging table
5. LogWatcher polls every 60s, finds subscribers
6. PubSub pushes INVALIDATE to subscribed clients
7. Client refetches via REST API (RBAC checked)
8. Client updates local RxDB
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                        │
│                                                                              │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐          │
│   │    RxDB      │    │   Sync       │    │   React Components   │          │
│   │  (IndexedDB) │◄──►│   Provider   │◄──►│   (Auto-subscribe)   │          │
│   └──────────────┘    └──────┬───────┘    └──────────────────────┘          │
│                              │                                               │
└──────────────────────────────┼───────────────────────────────────────────────┘
                               │
              ┌────────────────┴────────────────┐
              │ REST API                        │ WebSocket
              ▼                                 ▼
┌─────────────────────────────┐   ┌─────────────────────────────────────────┐
│         REST API            │   │           PubSub Service                 │
│        (Fastify)            │   │         (Separate Process)               │
│                             │   │                                          │
│   GET/POST/PATCH/DELETE     │   │   ┌─────────────┐  ┌─────────────────┐  │
│   /api/v1/*                 │   │   │  WebSocket  │  │   LogWatcher    │  │
│                             │   │   │   Server    │  │  (60s polling)  │  │
│   Port: 4000                │   │   │  Port: 4001 │  │                 │  │
│                             │   │   └──────┬──────┘  └────────┬────────┘  │
└─────────────┬───────────────┘   │          │                  │           │
              │                   │          ▼                  │           │
              │                   │   ┌─────────────────┐       │           │
              │                   │   │  Subscription   │◄──────┘           │
              │                   │   │    Manager      │                   │
              │                   │   └────────┬────────┘                   │
              │                   └────────────┼────────────────────────────┘
              │                                │
┌─────────────▼────────────────────────────────▼──────────────────────────────┐
│                           POSTGRESQL                                         │
│                                                                              │
│   ┌────────────────┐  ┌────────────────┐  ┌─────────────────────────┐       │
│   │  app.project   │  │  app.logging   │  │  app.rxdb_subscription  │       │
│   │  app.task      │  │  (changes)     │  │  (live subscriptions)   │       │
│   │  app.employee  │  │                │  │                         │       │
│   └────────────────┘  └────────────────┘  └─────────────────────────┘       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Key Architecture Points:**
- **REST API (Port 4000)**: Existing Fastify server, handles CRUD operations
- **PubSub Service (Port 4001)**: Separate Node.js process for WebSocket + sync
- **Shared Database**: Both services connect to same PostgreSQL instance
- **No Inter-Process Communication**: PubSub reads `app.logging` table that REST API writes to

---

## 1. Database Schema

### 1.1 Logging Table (`db/XXXV_logging.ddl`)

Captures all entity changes for sync processing.

```sql
CREATE TABLE app.logging (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Actor (WHO)
    person_id UUID,
    fname VARCHAR(100),
    lname VARCHAR(100),
    username VARCHAR(255),
    person_type VARCHAR(50),

    -- Request Context
    api_endpoint VARCHAR(500),
    http_method VARCHAR(10),

    -- Target Entity (WHAT) - Required for sync
    entity_code VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    action SMALLINT NOT NULL CHECK (action BETWEEN 0 AND 5),
    -- 0=VIEW, 1=EDIT, 2=SHARE, 3=DELETE, 4=CREATE, 5=OWNER

    -- State Snapshots (optional, for audit)
    entity_from_version JSONB,
    entity_to_version JSONB,

    -- Security
    user_agent TEXT,
    ip INET,

    -- Timestamps
    created_ts TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Sync Status
    sync_status VARCHAR(20) DEFAULT 'pending',
    sync_processed_ts TIMESTAMPTZ
);

-- Index for LogWatcher polling (only pending, non-VIEW actions)
CREATE INDEX idx_logging_sync_pending
    ON app.logging(created_ts)
    WHERE sync_status = 'pending' AND action != 0;

-- Index for audit queries
CREATE INDEX idx_logging_entity
    ON app.logging(entity_code, entity_id, created_ts DESC);

COMMENT ON TABLE app.logging IS 'Audit log with sync status tracking for PubSub';
```

### 1.2 Subscription Table (`db/XXXVI_rxdb_subscription.ddl`)

Tracks which entity instances each connected user is subscribed to.

```sql
CREATE TABLE app.rxdb_subscription (
    user_id UUID NOT NULL,
    entity_code VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    connection_id VARCHAR(50) NOT NULL,
    subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (user_id, entity_code, entity_id)
);

-- LogWatcher query: "Who is subscribed to these entities?"
CREATE INDEX idx_rxdb_subscription_entity
    ON app.rxdb_subscription(entity_code, entity_id);

-- Cleanup query: "Remove all subscriptions for this connection"
CREATE INDEX idx_rxdb_subscription_connection
    ON app.rxdb_subscription(connection_id);

COMMENT ON TABLE app.rxdb_subscription IS
    'Ephemeral table tracking live WebSocket subscriptions. Cleared on disconnect.';
```

### 1.3 Entity Change Triggers

```sql
-- Generic trigger function
CREATE OR REPLACE FUNCTION app.log_entity_change()
RETURNS TRIGGER AS $$
DECLARE
    v_action SMALLINT;
    v_person_id UUID;
BEGIN
    v_action := CASE TG_OP
        WHEN 'INSERT' THEN 4  -- CREATE
        WHEN 'UPDATE' THEN 1  -- EDIT
        WHEN 'DELETE' THEN 3  -- DELETE
    END;

    v_person_id := NULLIF(current_setting('app.current_user_id', true), '')::UUID;

    INSERT INTO app.logging (
        person_id, entity_code, entity_id, action,
        entity_from_version, entity_to_version,
        api_endpoint, http_method
    ) VALUES (
        v_person_id,
        TG_ARGV[0],  -- entity_code passed as trigger argument
        COALESCE(NEW.id, OLD.id),
        v_action,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END,
        NULLIF(current_setting('app.current_endpoint', true), ''),
        NULLIF(current_setting('app.current_method', true), '')
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply to each entity table
CREATE TRIGGER log_project_changes
    AFTER INSERT OR UPDATE OR DELETE ON app.project
    FOR EACH ROW EXECUTE FUNCTION app.log_entity_change('project');

CREATE TRIGGER log_task_changes
    AFTER INSERT OR UPDATE OR DELETE ON app.task
    FOR EACH ROW EXECUTE FUNCTION app.log_entity_change('task');

CREATE TRIGGER log_employee_changes
    AFTER INSERT OR UPDATE OR DELETE ON app.employee
    FOR EACH ROW EXECUTE FUNCTION app.log_entity_change('employee');

-- Add triggers for all 27+ entity tables...
```

### 1.4 Subscription Helper Functions

```sql
-- Bulk subscribe (called when client sends SUBSCRIBE message)
CREATE OR REPLACE FUNCTION app.bulk_subscribe(
    p_user_id UUID,
    p_connection_id VARCHAR,
    p_entity_code VARCHAR,
    p_entity_ids UUID[]
) RETURNS INTEGER AS $$
DECLARE
    affected INTEGER;
BEGIN
    INSERT INTO app.rxdb_subscription (user_id, entity_code, entity_id, connection_id)
    SELECT p_user_id, p_entity_code, unnest(p_entity_ids), p_connection_id
    ON CONFLICT (user_id, entity_code, entity_id)
    DO UPDATE SET connection_id = EXCLUDED.connection_id, subscribed_at = now();

    GET DIAGNOSTICS affected = ROW_COUNT;
    RETURN affected;
END;
$$ LANGUAGE plpgsql;

-- Get subscribers for batch of entity IDs (called by LogWatcher)
CREATE OR REPLACE FUNCTION app.get_batch_subscribers(
    p_entity_code VARCHAR,
    p_entity_ids UUID[]
) RETURNS TABLE(
    user_id UUID,
    connection_id VARCHAR,
    subscribed_entity_ids UUID[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT s.user_id, s.connection_id, array_agg(s.entity_id)
    FROM app.rxdb_subscription s
    WHERE s.entity_code = p_entity_code
      AND s.entity_id = ANY(p_entity_ids)
    GROUP BY s.user_id, s.connection_id;
END;
$$ LANGUAGE plpgsql;

-- Cleanup stale subscriptions (safety net)
CREATE OR REPLACE FUNCTION app.cleanup_stale_subscriptions(p_hours INTEGER DEFAULT 24)
RETURNS INTEGER AS $$
DECLARE
    deleted INTEGER;
BEGIN
    DELETE FROM app.rxdb_subscription
    WHERE subscribed_at < now() - (p_hours || ' hours')::INTERVAL;

    GET DIAGNOSTICS deleted = ROW_COUNT;
    RETURN deleted;
END;
$$ LANGUAGE plpgsql;
```

---

## 2. Backend PubSub Service

The PubSub Service runs as a **separate Node.js process** from the REST API.

### 2.1 File Structure

```
apps/pubsub/                         # NEW: Separate service
├── package.json                     # Dependencies: ws, pg, dotenv
├── tsconfig.json
├── src/
│   ├── index.ts                     # Entry point, starts server
│   ├── server.ts                    # WebSocket server setup
│   ├── db.ts                        # Database connection
│   ├── services/
│   │   ├── connection-manager.ts    # Track WS connections (in-memory)
│   │   ├── subscription-manager.ts  # Database subscription ops
│   │   └── log-watcher.ts           # Poll logs, push invalidations
│   ├── handlers/
│   │   └── message-handler.ts       # Handle client messages
│   └── types.ts                     # Type definitions
└── Dockerfile                       # Container deployment
```

### 2.2 Message Protocol

```typescript
// services/pubsub/types.ts

// ============================================================================
// Client → Server Messages
// ============================================================================

export interface SubscribeMessage {
  type: 'SUBSCRIBE';
  payload: {
    entityCode: string;
    entityIds: string[];
  };
}

export interface UnsubscribeMessage {
  type: 'UNSUBSCRIBE';
  payload: {
    entityCode: string;
    entityIds?: string[];  // If empty, unsubscribe from all of this entity type
  };
}

export interface TokenRefreshMessage {
  type: 'TOKEN_REFRESH';
  payload: { token: string };
}

export type ClientMessage =
  | SubscribeMessage
  | UnsubscribeMessage
  | TokenRefreshMessage
  | { type: 'UNSUBSCRIBE_ALL' }
  | { type: 'PING' };

// ============================================================================
// Server → Client Messages
// ============================================================================

export interface InvalidateMessage {
  type: 'INVALIDATE';
  payload: {
    entityCode: string;
    changes: Array<{
      entityId: string;
      action: 'CREATE' | 'UPDATE' | 'DELETE';
      version: number;
    }>;
    timestamp: string;
  };
}

export interface TokenExpiringSoonMessage {
  type: 'TOKEN_EXPIRING_SOON';
  payload: { expiresIn: number };  // seconds until expiry
}

export type ServerMessage =
  | InvalidateMessage
  | TokenExpiringSoonMessage
  | { type: 'PONG' }
  | { type: 'SUBSCRIBED'; payload: { count: number } }
  | { type: 'ERROR'; payload: { message: string } };
```

### 2.3 Connection Manager

```typescript
// services/pubsub/connection-manager.ts
import { WebSocket } from 'ws';
import { randomUUID } from 'crypto';

export class ConnectionManager {
  // In-memory maps (pod-local)
  private connections = new Map<string, WebSocket>();      // connId → socket
  private userConnections = new Map<string, Set<string>>(); // userId → connIds
  private connectionUsers = new Map<string, string>();      // connId → userId

  connect(userId: string, socket: WebSocket): string {
    const connectionId = randomUUID();

    this.connections.set(connectionId, socket);
    this.connectionUsers.set(connectionId, userId);

    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(connectionId);

    return connectionId;
  }

  disconnect(connectionId: string): string | undefined {
    const userId = this.connectionUsers.get(connectionId);

    this.connections.delete(connectionId);
    this.connectionUsers.delete(connectionId);

    if (userId) {
      this.userConnections.get(userId)?.delete(connectionId);
      if (this.userConnections.get(userId)?.size === 0) {
        this.userConnections.delete(userId);
      }
    }

    return userId;
  }

  hasConnection(connectionId: string): boolean {
    return this.connections.has(connectionId);
  }

  send(connectionId: string, message: object): boolean {
    const socket = this.connections.get(connectionId);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  broadcast(connectionIds: string[], message: object): number {
    let sent = 0;
    const payload = JSON.stringify(message);

    for (const connId of connectionIds) {
      const socket = this.connections.get(connId);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
        sent++;
      }
    }

    return sent;
  }

  getStats(): { connections: number; users: number } {
    return {
      connections: this.connections.size,
      users: this.userConnections.size
    };
  }
}
```

### 2.4 Subscription Manager

```typescript
// services/pubsub/subscription-manager.ts
import { sql } from 'drizzle-orm';
import type { Database } from '@/db';

export interface Subscriber {
  userId: string;
  connectionId: string;
  subscribedEntityIds: string[];
}

export class SubscriptionManager {
  constructor(private db: Database) {}

  async subscribe(
    userId: string,
    connectionId: string,
    entityCode: string,
    entityIds: string[]
  ): Promise<number> {
    if (entityIds.length === 0) return 0;

    const result = await this.db.execute(sql`
      SELECT app.bulk_subscribe(
        ${userId}::uuid,
        ${connectionId},
        ${entityCode},
        ${sql.raw(`ARRAY[${entityIds.map(id => `'${id}'::uuid`).join(',')}]`)}
      ) as count
    `);

    return result[0]?.count ?? 0;
  }

  async unsubscribe(
    userId: string,
    entityCode: string,
    entityIds?: string[]
  ): Promise<number> {
    if (entityIds && entityIds.length > 0) {
      const result = await this.db.execute(sql`
        DELETE FROM app.rxdb_subscription
        WHERE user_id = ${userId}::uuid
          AND entity_code = ${entityCode}
          AND entity_id = ANY(${sql.raw(`ARRAY[${entityIds.map(id => `'${id}'::uuid`).join(',')}]`)})
      `);
      return result.rowCount ?? 0;
    } else {
      const result = await this.db.execute(sql`
        DELETE FROM app.rxdb_subscription
        WHERE user_id = ${userId}::uuid
          AND entity_code = ${entityCode}
      `);
      return result.rowCount ?? 0;
    }
  }

  async unsubscribeAll(userId: string): Promise<number> {
    const result = await this.db.execute(sql`
      DELETE FROM app.rxdb_subscription
      WHERE user_id = ${userId}::uuid
    `);
    return result.rowCount ?? 0;
  }

  async cleanupConnection(connectionId: string): Promise<number> {
    const result = await this.db.execute(sql`
      DELETE FROM app.rxdb_subscription
      WHERE connection_id = ${connectionId}
    `);
    return result.rowCount ?? 0;
  }

  async getBatchSubscribers(
    entityCode: string,
    entityIds: string[]
  ): Promise<Subscriber[]> {
    if (entityIds.length === 0) return [];

    const result = await this.db.execute(sql`
      SELECT * FROM app.get_batch_subscribers(
        ${entityCode},
        ${sql.raw(`ARRAY[${entityIds.map(id => `'${id}'::uuid`).join(',')}]`)}
      )
    `);

    return result.map(row => ({
      userId: row.user_id,
      connectionId: row.connection_id,
      subscribedEntityIds: row.subscribed_entity_ids
    }));
  }
}
```

### 2.5 Log Watcher

```typescript
// services/pubsub/log-watcher.ts
import { sql } from 'drizzle-orm';
import type { Database } from '@/db';
import type { ConnectionManager } from './connection-manager';
import type { SubscriptionManager } from './subscription-manager';
import type { InvalidateMessage } from './types';

const POLL_INTERVAL = 60_000; // 60 seconds

interface LogEntry {
  id: string;
  entity_code: string;
  entity_id: string;
  action: number;
  version?: number;
}

export class LogWatcher {
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(
    private db: Database,
    private connectionManager: ConnectionManager,
    private subscriptionManager: SubscriptionManager
  ) {}

  start(): void {
    if (this.intervalId) return;

    console.log('[LogWatcher] Starting with interval:', POLL_INTERVAL, 'ms');
    this.intervalId = setInterval(() => this.poll(), POLL_INTERVAL);

    // Initial poll
    this.poll();
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[LogWatcher] Stopped');
    }
  }

  private async poll(): Promise<void> {
    if (this.isProcessing) {
      console.log('[LogWatcher] Skipping poll, previous still processing');
      return;
    }

    this.isProcessing = true;

    try {
      // 1. Fetch pending logs (deduplicated - only latest per entity)
      const logs = await this.db.execute<LogEntry>(sql`
        SELECT DISTINCT ON (entity_code, entity_id)
          id, entity_code, entity_id, action
        FROM app.logging
        WHERE sync_status = 'pending'
          AND action != 0  -- Skip VIEW actions
        ORDER BY entity_code, entity_id, created_ts DESC
        LIMIT 1000
      `);

      if (logs.length === 0) {
        this.isProcessing = false;
        return;
      }

      console.log('[LogWatcher] Processing', logs.length, 'changes');

      // 2. Group by entity_code
      const changesByEntity = new Map<string, LogEntry[]>();
      for (const log of logs) {
        if (!changesByEntity.has(log.entity_code)) {
          changesByEntity.set(log.entity_code, []);
        }
        changesByEntity.get(log.entity_code)!.push(log);
      }

      // 3. For each entity type, find subscribers and push
      for (const [entityCode, changes] of changesByEntity) {
        const entityIds = changes.map(c => c.entity_id);
        const subscribers = await this.subscriptionManager.getBatchSubscribers(
          entityCode,
          entityIds
        );

        // Filter to only local connections
        const localSubscribers = subscribers.filter(sub =>
          this.connectionManager.hasConnection(sub.connectionId)
        );

        // Push INVALIDATE to each subscriber
        for (const sub of localSubscribers) {
          const relevantChanges = changes.filter(c =>
            sub.subscribedEntityIds.includes(c.entity_id)
          );

          if (relevantChanges.length > 0) {
            const message: InvalidateMessage = {
              type: 'INVALIDATE',
              payload: {
                entityCode,
                changes: relevantChanges.map(c => ({
                  entityId: c.entity_id,
                  action: this.actionToString(c.action),
                  version: c.version ?? 0
                })),
                timestamp: new Date().toISOString()
              }
            };

            this.connectionManager.send(sub.connectionId, message);
          }
        }
      }

      // 4. Mark logs as processed
      const logIds = logs.map(l => l.id);
      await this.db.execute(sql`
        UPDATE app.logging
        SET sync_status = 'sent', sync_processed_ts = now()
        WHERE id = ANY(${sql.raw(`ARRAY[${logIds.map(id => `'${id}'::uuid`).join(',')}]`)})
      `);

      console.log('[LogWatcher] Processed', logs.length, 'changes');

    } catch (error) {
      console.error('[LogWatcher] Error:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private actionToString(action: number): 'CREATE' | 'UPDATE' | 'DELETE' {
    switch (action) {
      case 4: return 'CREATE';
      case 3: return 'DELETE';
      default: return 'UPDATE';
    }
  }
}
```

### 2.6 WebSocket Server (Standalone)

```typescript
// src/server.ts
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { URL } from 'url';
import { verifyJwt } from './auth';
import { ConnectionManager } from './services/connection-manager';
import { SubscriptionManager } from './services/subscription-manager';
import { LogWatcher } from './services/log-watcher';
import { db } from './db';
import type { ClientMessage } from './types';

const PORT = process.env.PUBSUB_PORT || 4001;

// Initialize services
const connectionManager = new ConnectionManager();
const subscriptionManager = new SubscriptionManager(db);
const logWatcher = new LogWatcher(db, connectionManager, subscriptionManager);

// Create HTTP server for WebSocket upgrade
const server = createServer((req, res) => {
  // Health check endpoint
  if (req.url === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', connections: connectionManager.getStats() }));
    return;
  }
  res.writeHead(404);
  res.end();
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', async (socket: WebSocket, request) => {
  // 1. Auth check
  const url = new URL(request.url || '', `http://localhost:${PORT}`);
  const token = url.searchParams.get('token');

  if (!token) {
    socket.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Missing token' } }));
    socket.close();
    return;
  }

  const decoded = verifyJwt(token);
  if (!decoded) {
    socket.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Invalid token' } }));
    socket.close();
    return;
  }

  const userId = decoded.sub;

  // 2. Register connection
  const connectionId = connectionManager.connect(userId, socket);
  console.log('[PubSub] Connected:', userId, connectionId);

  // 3. Handle messages
  socket.on('message', async (data) => {
    try {
      const message: ClientMessage = JSON.parse(data.toString());

      switch (message.type) {
        case 'SUBSCRIBE': {
          const count = await subscriptionManager.subscribe(
            userId,
            connectionId,
            message.payload.entityCode,
            message.payload.entityIds
          );
          socket.send(JSON.stringify({ type: 'SUBSCRIBED', payload: { count } }));
          break;
        }

        case 'UNSUBSCRIBE': {
          await subscriptionManager.unsubscribe(
            userId,
            message.payload.entityCode,
            message.payload.entityIds
          );
          break;
        }

        case 'UNSUBSCRIBE_ALL': {
          await subscriptionManager.unsubscribeAll(userId);
          break;
        }

        case 'PING': {
          socket.send(JSON.stringify({ type: 'PONG' }));
          break;
        }
      }
    } catch (error) {
      console.error('[PubSub] Message error:', error);
    }
  });

  // 4. Cleanup on disconnect
  socket.on('close', async () => {
    console.log('[PubSub] Disconnected:', userId, connectionId);
    connectionManager.disconnect(connectionId);
    await subscriptionManager.cleanupConnection(connectionId);
  });
});

// Start server and log watcher
server.listen(PORT, () => {
  console.log(`[PubSub] WebSocket server running on port ${PORT}`);
  logWatcher.start();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[PubSub] Shutting down...');
  logWatcher.stop();
  wss.close();
  server.close();
  process.exit(0);
});
```

### 2.7 Entry Point

```typescript
// src/index.ts
import './server';
```

### 2.8 Database Connection

```typescript
// src/db.ts
import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = {
  async execute<T>(query: string, params?: any[]): Promise<T[]> {
    const result = await pool.query(query, params);
    return result.rows;
  }
};
```

---

## 3. Frontend Sync Integration

### 3.1 File Structure

```
apps/web/src/
├── db/
│   └── sync/
│       ├── index.ts                 # Module exports
│       ├── SyncProvider.tsx         # WebSocket context provider
│       ├── useAutoSubscribe.ts      # Auto-subscription hook
│       ├── useSyncStatus.ts         # Connection status hook
│       └── types.ts                 # Type definitions
├── App.tsx                          # Add SyncProvider
└── components/
    └── SyncStatusIndicator.tsx      # UI indicator
```

### 3.2 Sync Provider

```typescript
// db/sync/SyncProvider.tsx
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useQueryClient } from '@tanstack/react-query';

type SyncStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface SyncContextValue {
  status: SyncStatus;
  subscribe: (entityCode: string, entityIds: string[]) => void;
  unsubscribe: (entityCode: string, entityIds?: string[]) => void;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { token, refreshToken } = useAuth();
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<SyncStatus>('disconnected');
  const reconnectAttempts = useRef(0);
  const processedVersions = useRef(new Map<string, number>());

  // Connect WebSocket
  useEffect(() => {
    if (!token) {
      setStatus('disconnected');
      return;
    }

    const connect = () => {
      setStatus('connecting');

      const wsUrl = `${import.meta.env.VITE_WS_URL || 'ws://localhost:4000'}/ws/sync?token=${token}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setStatus('connected');
        reconnectAttempts.current = 0;
        console.log('[Sync] Connected');
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case 'INVALIDATE':
            handleInvalidate(message.payload);
            break;

          case 'TOKEN_EXPIRING_SOON':
            handleTokenExpiring();
            break;

          case 'SUBSCRIBED':
            console.log('[Sync] Subscribed:', message.payload.count, 'entities');
            break;
        }
      };

      ws.onclose = () => {
        setStatus('disconnected');
        wsRef.current = null;

        // Exponential backoff reconnect
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current++;

        console.log('[Sync] Reconnecting in', delay, 'ms');
        setTimeout(connect, delay);
      };

      ws.onerror = () => {
        setStatus('error');
      };

      wsRef.current = ws;
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [token]);

  // Handle INVALIDATE message
  const handleInvalidate = useCallback((payload: {
    entityCode: string;
    changes: Array<{ entityId: string; action: string; version: number }>;
  }) => {
    console.log('[Sync] INVALIDATE:', payload.entityCode, payload.changes.length, 'changes');

    for (const change of payload.changes) {
      const key = `${payload.entityCode}:${change.entityId}`;
      const lastVersion = processedVersions.current.get(key) || 0;

      // Skip if we've already processed a newer version
      if (change.version <= lastVersion) continue;
      processedVersions.current.set(key, change.version);

      // Invalidate React Query cache - triggers refetch
      queryClient.invalidateQueries({
        queryKey: ['entity', payload.entityCode, change.entityId]
      });

      // Also invalidate list queries for this entity type
      queryClient.invalidateQueries({
        queryKey: ['entity-list', payload.entityCode],
        exact: false
      });
    }
  }, [queryClient]);

  // Handle token expiring
  const handleTokenExpiring = useCallback(async () => {
    console.log('[Sync] Token expiring, refreshing...');
    const newToken = await refreshToken();

    if (newToken && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'TOKEN_REFRESH',
        payload: { token: newToken }
      }));
    }
  }, [refreshToken]);

  // Subscribe to entities
  const subscribe = useCallback((entityCode: string, entityIds: string[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && entityIds.length > 0) {
      wsRef.current.send(JSON.stringify({
        type: 'SUBSCRIBE',
        payload: { entityCode, entityIds }
      }));
    }
  }, []);

  // Unsubscribe from entities
  const unsubscribe = useCallback((entityCode: string, entityIds?: string[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'UNSUBSCRIBE',
        payload: { entityCode, entityIds }
      }));
    }
  }, []);

  return (
    <SyncContext.Provider value={{ status, subscribe, unsubscribe }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within SyncProvider');
  }
  return context;
}
```

### 3.3 Auto-Subscribe Hook

```typescript
// db/sync/useAutoSubscribe.ts
import { useEffect, useRef } from 'react';
import { useSync } from './SyncProvider';

export function useAutoSubscribe(entityCode: string, entityIds: string[]) {
  const { subscribe, unsubscribe } = useSync();
  const previousIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentIds = new Set(entityIds);
    const previousIds = previousIdsRef.current;

    // Find new IDs to subscribe
    const newIds = entityIds.filter(id => !previousIds.has(id));

    // Find removed IDs to unsubscribe
    const removedIds = [...previousIds].filter(id => !currentIds.has(id));

    // Subscribe to new
    if (newIds.length > 0) {
      subscribe(entityCode, newIds);
    }

    // Unsubscribe from removed
    if (removedIds.length > 0) {
      unsubscribe(entityCode, removedIds);
    }

    // Update ref
    previousIdsRef.current = currentIds;

    // Cleanup on unmount
    return () => {
      if (entityIds.length > 0) {
        unsubscribe(entityCode, entityIds);
      }
    };
  }, [entityCode, entityIds, subscribe, unsubscribe]);
}
```

### 3.4 Updated Entity Query Hook

```typescript
// Update existing useEntityQuery.ts

import { useAutoSubscribe } from '@/db/sync';

export function useEntityList(entityCode: string, params: QueryParams) {
  const query = useQuery({
    queryKey: ['entity-list', entityCode, params],
    queryFn: () => api.get(`/api/v1/${entityCode}`, { params }),
  });

  // Auto-subscribe to loaded entities
  const entityIds = query.data?.data?.map((item: { id: string }) => item.id) || [];
  useAutoSubscribe(entityCode, entityIds);

  return query;
}

export function useEntityDetail(entityCode: string, entityId: string) {
  const query = useQuery({
    queryKey: ['entity', entityCode, entityId],
    queryFn: () => api.get(`/api/v1/${entityCode}/${entityId}`),
    enabled: !!entityId,
  });

  // Auto-subscribe to this entity
  useAutoSubscribe(entityCode, entityId ? [entityId] : []);

  return query;
}
```

### 3.5 App Integration

```typescript
// App.tsx
import { SyncProvider } from '@/db/sync';

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <SyncProvider>
          <Router>
            {/* ... routes ... */}
          </Router>
          <SyncStatusIndicator />
        </SyncProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}
```

---

## 4. Edge Case Handling

### 4.1 Deduplication

LogWatcher uses `DISTINCT ON` to ensure only the latest change per entity is processed:

```sql
SELECT DISTINCT ON (entity_code, entity_id)
  id, entity_code, entity_id, action
FROM app.logging
WHERE sync_status = 'pending'
ORDER BY entity_code, entity_id, created_ts DESC
```

### 4.2 Out-of-Order Messages

Frontend tracks version numbers per entity:

```typescript
const processedVersions = new Map<string, number>();

if (change.version <= processedVersions.get(key)) {
  return; // Skip stale message
}
```

### 4.3 JWT Token Refresh

Server sends `TOKEN_EXPIRING_SOON` 5 minutes before expiry. Client responds with `TOKEN_REFRESH`:

```typescript
// Server schedules warning
setTimeout(() => {
  socket.send({ type: 'TOKEN_EXPIRING_SOON', payload: { expiresIn: 300 } });
}, tokenExp - 5 * 60 * 1000 - Date.now());

// Client handles
ws.onmessage = (msg) => {
  if (msg.type === 'TOKEN_EXPIRING_SOON') {
    const newToken = await refreshToken();
    ws.send({ type: 'TOKEN_REFRESH', payload: { token: newToken } });
  }
};
```

### 4.4 Single-Pod Architecture

This deployment uses a single API pod, which simplifies the architecture:

- **ConnectionManager**: In-memory Map of WebSocket connections
- **SubscriptionManager**: PostgreSQL table (persists across restarts)
- **LogWatcher**: Polls database, pushes to all local connections

No inter-pod coordination needed. All WebSocket connections are on the same pod.

---

## 5. Implementation Phases

### Phase 1: Database Schema (Week 1)

| Task | File | Est. Hours |
|------|------|------------|
| Create logging table | `db/XXXV_logging.ddl` | 2 |
| Create subscription table | `db/XXXVI_rxdb_subscription.ddl` | 1 |
| Create change triggers | `db/triggers/entity_logging.sql` | 4 |
| Import and verify | `./tools/db-import.sh` | 1 |

### Phase 2: Backend PubSub Service (Weeks 2-3)

| Task | File | Est. Hours |
|------|------|------------|
| Initialize `apps/pubsub` package | `apps/pubsub/package.json` | 1 |
| Database connection | `apps/pubsub/src/db.ts` | 1 |
| JWT auth helper | `apps/pubsub/src/auth.ts` | 1 |
| Types | `apps/pubsub/src/types.ts` | 1 |
| Connection manager | `apps/pubsub/src/services/connection-manager.ts` | 3 |
| Subscription manager | `apps/pubsub/src/services/subscription-manager.ts` | 4 |
| Log watcher | `apps/pubsub/src/services/log-watcher.ts` | 6 |
| WebSocket server | `apps/pubsub/src/server.ts` | 4 |
| Dockerfile | `apps/pubsub/Dockerfile` | 1 |
| Unit tests | `apps/pubsub/src/__tests__/` | 4 |

### Phase 3: Frontend Sync (Weeks 3-5)

| Task | File | Est. Hours |
|------|------|------------|
| SyncProvider | `db/sync/SyncProvider.tsx` | 6 |
| useAutoSubscribe | `db/sync/useAutoSubscribe.ts` | 3 |
| Update entity hooks | `db/hooks/useEntityQuery.ts` | 4 |
| Sync status indicator | `components/SyncStatusIndicator.tsx` | 2 |
| App integration | `App.tsx` | 1 |

### Phase 4: Integration Testing (Weeks 5-6)

| Task | Est. Hours |
|------|------------|
| E2E subscribe/unsubscribe flow | 4 |
| E2E change detection | 4 |
| Multi-user scenario | 4 |
| Offline → online sync | 3 |
| Reconnection handling | 2 |
| Performance testing | 4 |
| Documentation updates | 4 |

---

## 6. File Inventory

### PubSub Service (`apps/pubsub/`) - ~450 lines

| File | Lines |
|------|-------|
| `src/index.ts` | ~5 |
| `src/server.ts` | ~100 |
| `src/db.ts` | ~20 |
| `src/auth.ts` | ~30 |
| `src/types.ts` | ~50 |
| `src/services/connection-manager.ts` | ~80 |
| `src/services/subscription-manager.ts` | ~100 |
| `src/services/log-watcher.ts` | ~120 |
| `package.json` | ~30 |
| `Dockerfile` | ~15 |

### Frontend (`apps/web/`) - ~320 lines

| File | Lines |
|------|-------|
| `db/sync/SyncProvider.tsx` | ~200 |
| `db/sync/useAutoSubscribe.ts` | ~60 |
| `db/sync/useSyncStatus.ts` | ~20 |
| `db/sync/index.ts` | ~10 |
| `components/SyncStatusIndicator.tsx` | ~30 |

### Database - ~260 lines

| File | Lines |
|------|-------|
| `db/XXXV_logging.ddl` | ~80 |
| `db/XXXVI_rxdb_subscription.ddl` | ~120 |
| `db/triggers/entity_logging.sql` | ~60 |

**Total: ~1030 lines of new code**

---

## 7. Success Metrics

| Metric | Target | Notes |
|--------|--------|-------|
| WebSocket connection success | >99% | With auto-reconnect |
| INVALIDATE delivery latency | <60s | Polling-based (avg 30s) |
| Subscription cleanup on disconnect | 100% | Database cleanup |
| Log processing throughput | >1000/minute | Batch processing |
| Client resubscription on reconnect | 100% | Auto-subscribe hooks |

---

## 8. Deployment

### Environment Variables

```bash
# PubSub Service
DATABASE_URL=postgresql://user:pass@localhost:5432/app
PUBSUB_PORT=4001
JWT_SECRET=your-jwt-secret

# Frontend
VITE_WS_URL=ws://localhost:4001          # Development
VITE_WS_URL=wss://pubsub.yourapp.com     # Production
```

### Infrastructure

```
Single-Pod Deployment (<500 concurrent users):

┌─────────────────────────────────────────────────────┐
│                    EC2 Instance                      │
│                                                      │
│   ┌─────────────────┐    ┌─────────────────┐        │
│   │   REST API      │    │  PubSub Service │        │
│   │   (Port 4000)   │    │   (Port 4001)   │        │
│   └────────┬────────┘    └────────┬────────┘        │
│            │                      │                  │
│            └──────────┬───────────┘                  │
│                       ▼                              │
│            ┌─────────────────┐                       │
│            │   PostgreSQL    │                       │
│            │   (Port 5432)   │                       │
│            └─────────────────┘                       │
└─────────────────────────────────────────────────────┘
```

### Starting the Services

```bash
# Start REST API (existing)
pnpm --filter @pmo/api dev

# Start PubSub Service (new)
pnpm --filter @pmo/pubsub dev

# Or with Docker
docker-compose up -d api pubsub
```

### Rollback Plan

1. **Stop PubSub Service**
   ```bash
   # Just stop the pubsub container/process
   docker stop pmo-pubsub
   # or
   pm2 stop pubsub
   ```

2. **Frontend graceful degradation**
   - SyncProvider falls back to disconnected state
   - Manual refresh still works
   - No real-time updates

3. **Database cleanup**
   ```sql
   TRUNCATE app.rxdb_subscription;
   UPDATE app.logging SET sync_status = 'pending' WHERE sync_status = 'processing';
   ```

---

## 9. Related Documents

| Document | Purpose |
|----------|---------|
| `RXDB_SUBSCRIPTION_TABLE.md` | Detailed subscription table design |
| `README.md` | General caching documentation |

---

**Version**: 2.1 | **Updated**: 2025-11-27 | **Status**: Final Design (Single-Pod)
