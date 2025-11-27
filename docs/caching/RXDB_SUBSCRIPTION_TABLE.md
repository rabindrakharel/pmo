# RxDB Subscription Table Design

> Database-backed subscription tracking for multi-pod WebSocket sync

**Version**: 1.0
**Date**: 2025-11-27

---

## Why Database Instead of In-Memory?

| Aspect | In-Memory Map | Database Table |
|--------|---------------|----------------|
| **Multi-pod** | Needs Redis to sync | Works natively |
| **Server restart** | Lost | Survives (with cleanup) |
| **Complexity** | Simpler code | More queries |
| **Latency** | ~0ms | ~1-5ms |
| **Memory** | Uses RAM | Uses disk |

**Decision**: Use database table - eliminates need for Redis entirely.

---

## Architecture with Database Subscriptions

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DATABASE-BACKED SUBSCRIPTIONS                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Client                 API Pod 1              API Pod 2                   │
│   ┌─────┐               ┌─────────┐            ┌─────────┐                  │
│   │     │──SUBSCRIBE───►│   WS    │            │   WS    │                  │
│   │     │               │ Handler │            │ Handler │                  │
│   └─────┘               └────┬────┘            └────┬────┘                  │
│                              │                      │                       │
│                              │ INSERT               │                       │
│                              ▼                      ▼                       │
│                    ┌─────────────────────────────────────┐                  │
│                    │         app.rxdb_subscription        │                  │
│                    │                                      │                  │
│                    │  user_id │ entity_code │ entity_id  │                  │
│                    │  ────────┼─────────────┼─────────── │                  │
│                    │  user-A  │ project     │ uuid-1     │                  │
│                    │  user-A  │ project     │ uuid-2     │                  │
│                    │  user-B  │ project     │ uuid-1     │                  │
│                    │  user-B  │ task        │ uuid-100   │                  │
│                    │                                      │                  │
│                    └─────────────────────────────────────┘                  │
│                                       ▲                                     │
│                                       │ SELECT subscribers                  │
│                    ┌──────────────────┴──────────────────┐                  │
│                    │           Log Watcher               │                  │
│                    │                                     │                  │
│                    │  1. Poll app.logging for changes    │                  │
│                    │  2. Query rxdb_subscription:        │                  │
│                    │     "Who subscribes to uuid-1?"     │                  │
│                    │  3. Push INVALIDATE to those users  │                  │
│                    │                                     │                  │
│                    └─────────────────────────────────────┘                  │
│                                                                              │
│   ✅ No Redis needed - database handles cross-pod coordination              │
│   ✅ Survives pod restarts (with stale cleanup)                             │
│   ✅ Single source of truth for subscriptions                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Table Schema

```sql
CREATE TABLE app.rxdb_subscription (
    user_id UUID NOT NULL,
    entity_code VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    connection_id VARCHAR(50) NOT NULL,
    subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (user_id, entity_code, entity_id)
);
```

### Columns

| Column | Type | Purpose |
|--------|------|---------|
| `user_id` | UUID | The subscribed user (FK to employee) |
| `entity_code` | VARCHAR | Entity type: 'project', 'task', etc. |
| `entity_id` | UUID | Specific entity instance |
| `connection_id` | VARCHAR | WebSocket connection ID for cleanup |
| `subscribed_at` | TIMESTAMPTZ | When subscription was created |

### Indexes

```sql
-- For LogWatcher: "Who subscribes to this entity?"
CREATE INDEX idx_rxdb_subscription_entity
    ON app.rxdb_subscription(entity_code, entity_id);

-- For disconnect cleanup: "Remove all for this user"
CREATE INDEX idx_rxdb_subscription_user
    ON app.rxdb_subscription(user_id);

-- For connection cleanup: "Remove all for this connection"
CREATE INDEX idx_rxdb_subscription_connection
    ON app.rxdb_subscription(connection_id);
```

---

## Key Operations

### 1. Subscribe (Bulk)

```sql
-- Subscribe user to 50 entities at once
SELECT app.bulk_subscribe(
    'user-uuid'::UUID,
    'conn-123',
    'project',
    ARRAY['uuid-1', 'uuid-2', ...]::UUID[]
);
```

```typescript
// Backend service
async subscribe(userId: string, connectionId: string, entityCode: string, entityIds: string[]) {
  await db.execute(sql`
    SELECT app.bulk_subscribe(
      ${userId}::UUID,
      ${connectionId},
      ${entityCode},
      ${entityIds}::UUID[]
    )
  `);
}
```

### 2. Unsubscribe

```sql
-- Unsubscribe from specific entities
SELECT app.bulk_unsubscribe(
    'user-uuid'::UUID,
    'project',
    ARRAY['uuid-1', 'uuid-2']::UUID[]
);

-- Unsubscribe from ALL (disconnect)
SELECT app.cleanup_connection_subscriptions('conn-123');
```

### 3. Find Subscribers (LogWatcher)

```sql
-- Single entity
SELECT user_id, connection_id
FROM app.rxdb_subscription
WHERE entity_code = 'project'
  AND entity_id = 'uuid-1';

-- Batch (multiple changed entities)
SELECT * FROM app.get_batch_subscribers(
    'project',
    ARRAY['uuid-1', 'uuid-2', 'uuid-3']::UUID[]
);

-- Returns:
-- user_id  | connection_id | subscribed_entity_ids
-- ---------+---------------+----------------------
-- user-A   | conn-123      | {uuid-1, uuid-2}
-- user-B   | conn-456      | {uuid-1, uuid-3}
```

---

## Updated Log Watcher Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LOG WATCHER FLOW (Updated)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Every 60 seconds:                                                         │
│                                                                              │
│   1. Poll app.logging for pending changes                                   │
│      ┌────────────────────────────────────────────────────────────────┐    │
│      │ SELECT entity_code, entity_id, action                          │    │
│      │ FROM app.logging                                               │    │
│      │ WHERE sync_status = 'pending' AND action != 0                  │    │
│      │ LIMIT 500                                                      │    │
│      └────────────────────────────────────────────────────────────────┘    │
│      Result: [                                                              │
│        { entity_code: 'project', entity_id: 'uuid-1', action: 1 },         │
│        { entity_code: 'project', entity_id: 'uuid-5', action: 1 },         │
│        { entity_code: 'task', entity_id: 'uuid-100', action: 4 },          │
│      ]                                                                      │
│                                                                              │
│   2. Group by entity_code                                                   │
│      {                                                                       │
│        'project': ['uuid-1', 'uuid-5'],                                     │
│        'task': ['uuid-100']                                                 │
│      }                                                                       │
│                                                                              │
│   3. For each entity_code, batch query subscribers                          │
│      ┌────────────────────────────────────────────────────────────────┐    │
│      │ SELECT * FROM app.get_batch_subscribers(                       │    │
│      │   'project',                                                   │    │
│      │   ARRAY['uuid-1', 'uuid-5']::UUID[]                           │    │
│      │ )                                                              │    │
│      └────────────────────────────────────────────────────────────────┘    │
│      Result: [                                                              │
│        { user_id: 'user-A', connection_id: 'conn-1',                       │
│          subscribed_entity_ids: ['uuid-1'] },                              │
│        { user_id: 'user-B', connection_id: 'conn-2',                       │
│          subscribed_entity_ids: ['uuid-1', 'uuid-5'] },                    │
│      ]                                                                      │
│                                                                              │
│   4. Send INVALIDATE to each user (only their subscribed IDs)              │
│      → user-A: INVALIDATE { project: ['uuid-1'] }                          │
│      → user-B: INVALIDATE { project: ['uuid-1', 'uuid-5'] }                │
│                                                                              │
│   5. Mark logs as sent                                                      │
│      UPDATE app.logging SET sync_status = 'sent' WHERE ...                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Connection Manager (Simplified)

With database subscriptions, the connection manager only tracks WebSocket connections:

```typescript
// apps/api/src/services/connection-manager.service.ts

import type { WebSocket } from 'ws';

class ConnectionManager {
  // Only track live connections - subscriptions are in database
  private connections: Map<string, WebSocket> = new Map();  // connectionId → socket
  private userConnections: Map<string, string> = new Map(); // userId → connectionId

  connect(userId: string, socket: WebSocket): string {
    const connectionId = crypto.randomUUID();

    // Close existing connection for this user
    const existingConnId = this.userConnections.get(userId);
    if (existingConnId) {
      this.connections.get(existingConnId)?.close(4000, 'New connection');
      this.connections.delete(existingConnId);
    }

    this.connections.set(connectionId, socket);
    this.userConnections.set(userId, connectionId);

    return connectionId;
  }

  disconnect(connectionId: string): void {
    this.connections.delete(connectionId);

    // Remove from userConnections
    for (const [userId, connId] of this.userConnections) {
      if (connId === connectionId) {
        this.userConnections.delete(userId);
        break;
      }
    }
  }

  getSocket(connectionId: string): WebSocket | undefined {
    return this.connections.get(connectionId);
  }

  getSocketByUserId(userId: string): WebSocket | undefined {
    const connId = this.userConnections.get(userId);
    return connId ? this.connections.get(connId) : undefined;
  }

  isConnected(userId: string): boolean {
    return this.userConnections.has(userId);
  }

  getAllConnectionIds(): string[] {
    return Array.from(this.connections.keys());
  }
}

export const connectionManager = new ConnectionManager();
```

---

## Subscription Service (Database-Backed)

```typescript
// apps/api/src/services/subscription.service.ts

import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

export class SubscriptionService {
  /**
   * Subscribe user to entities (bulk)
   */
  async subscribe(
    userId: string,
    connectionId: string,
    entityCode: string,
    entityIds: string[]
  ): Promise<number> {
    if (entityIds.length === 0) return 0;

    const result = await db.execute<{ bulk_subscribe: number }>(sql`
      SELECT app.bulk_subscribe(
        ${userId}::UUID,
        ${connectionId},
        ${entityCode},
        ${entityIds}::UUID[]
      ) as bulk_subscribe
    `);

    return result[0]?.bulk_subscribe || 0;
  }

  /**
   * Unsubscribe user from specific entities
   */
  async unsubscribe(
    userId: string,
    entityCode: string,
    entityIds?: string[]
  ): Promise<number> {
    if (entityIds && entityIds.length > 0) {
      const result = await db.execute<{ bulk_unsubscribe: number }>(sql`
        SELECT app.bulk_unsubscribe(
          ${userId}::UUID,
          ${entityCode},
          ${entityIds}::UUID[]
        ) as bulk_unsubscribe
      `);
      return result[0]?.bulk_unsubscribe || 0;
    } else {
      // Unsubscribe all of this entity type
      const result = await db.execute(sql`
        DELETE FROM app.rxdb_subscription
        WHERE user_id = ${userId}::UUID
          AND entity_code = ${entityCode}
      `);
      return result.rowCount || 0;
    }
  }

  /**
   * Cleanup all subscriptions for a connection (on disconnect)
   */
  async cleanupConnection(connectionId: string): Promise<number> {
    const result = await db.execute<{ cleanup_connection_subscriptions: number }>(sql`
      SELECT app.cleanup_connection_subscriptions(${connectionId})
        as cleanup_connection_subscriptions
    `);
    return result[0]?.cleanup_connection_subscriptions || 0;
  }

  /**
   * Get subscribers for a batch of changed entities
   * Used by LogWatcher
   */
  async getBatchSubscribers(
    entityCode: string,
    entityIds: string[]
  ): Promise<Array<{
    user_id: string;
    connection_id: string;
    subscribed_entity_ids: string[];
  }>> {
    if (entityIds.length === 0) return [];

    return await db.execute(sql`
      SELECT * FROM app.get_batch_subscribers(
        ${entityCode},
        ${entityIds}::UUID[]
      )
    `);
  }

  /**
   * Get user's subscription stats
   */
  async getUserStats(userId: string): Promise<Record<string, number>> {
    const result = await db.execute<{ entity_code: string; count: number }>(sql`
      SELECT entity_code, COUNT(*)::int as count
      FROM app.rxdb_subscription
      WHERE user_id = ${userId}::UUID
      GROUP BY entity_code
    `);

    const stats: Record<string, number> = {};
    for (const row of result) {
      stats[row.entity_code] = row.count;
    }
    return stats;
  }

  /**
   * Cleanup stale subscriptions (run periodically)
   */
  async cleanupStale(hours: number = 24): Promise<number> {
    const result = await db.execute<{ cleanup_stale_subscriptions: number }>(sql`
      SELECT app.cleanup_stale_subscriptions(${hours})
        as cleanup_stale_subscriptions
    `);
    return result[0]?.cleanup_stale_subscriptions || 0;
  }
}

export const subscriptionService = new SubscriptionService();
```

---

## Updated Log Watcher

```typescript
// apps/api/src/services/log-watcher.service.ts (updated)

import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { subscriptionService } from './subscription.service.js';
import { connectionManager } from './connection-manager.service.js';

const POLL_INTERVAL_MS = 60_000;
let lastPollTime = new Date();

export async function pollAndNotify(): Promise<void> {
  const pollStartTime = new Date();

  // 1. Fetch pending changes
  const logs = await db.execute<{
    id: string;
    entity_code: string;
    entity_id: string;
    action: number;
  }>(sql`
    UPDATE app.logging
    SET sync_status = 'processing'
    WHERE id IN (
      SELECT id FROM app.logging
      WHERE created_ts > ${lastPollTime}
        AND sync_status = 'pending'
        AND action != 0
      ORDER BY created_ts
      LIMIT 500
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, entity_code, entity_id, action
  `);

  if (logs.length === 0) {
    lastPollTime = pollStartTime;
    return;
  }

  // 2. Group by entity_code
  const byEntityCode = new Map<string, Map<string, number>>();
  for (const log of logs) {
    if (!byEntityCode.has(log.entity_code)) {
      byEntityCode.set(log.entity_code, new Map());
    }
    byEntityCode.get(log.entity_code)!.set(log.entity_id, log.action);
  }

  // 3. For each entity type, get subscribers from DATABASE
  const notifications = new Map<string, { connectionId: string; changes: any[] }>();

  for (const [entityCode, entityChanges] of byEntityCode) {
    const entityIds = Array.from(entityChanges.keys());

    // Query database for subscribers
    const subscribers = await subscriptionService.getBatchSubscribers(entityCode, entityIds);

    for (const sub of subscribers) {
      if (!notifications.has(sub.connection_id)) {
        notifications.set(sub.connection_id, { connectionId: sub.connection_id, changes: [] });
      }

      // Only include entity IDs this user is subscribed to
      const userChanges = sub.subscribed_entity_ids.map(entityId => ({
        entityId,
        action: actionToString(entityChanges.get(entityId) || 1)
      }));

      notifications.get(sub.connection_id)!.changes.push({
        entityCode,
        changes: userChanges
      });
    }
  }

  // 4. Send notifications via WebSocket
  let sentCount = 0;
  for (const [connectionId, notification] of notifications) {
    const socket = connectionManager.getSocket(connectionId);

    if (socket?.readyState === 1) {
      for (const payload of notification.changes) {
        socket.send(JSON.stringify({ type: 'INVALIDATE', payload }));
        sentCount++;
      }
    }
  }

  // 5. Mark logs as sent
  const logIds = logs.map(l => l.id);
  await db.execute(sql`
    UPDATE app.logging
    SET sync_status = 'sent', sync_processed_ts = now()
    WHERE id = ANY(${logIds}::UUID[])
  `);

  lastPollTime = pollStartTime;
  console.log(`[LogWatcher] Sent ${sentCount} notifications for ${logs.length} changes`);
}

function actionToString(action: number): string {
  return action === 3 ? 'DELETE' : action === 4 ? 'CREATE' : 'UPDATE';
}
```

---

## Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SUBSCRIPTION LIFECYCLE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   1. USER CONNECTS                                                          │
│      └─► connectionManager.connect(userId, socket)                          │
│          Returns: connectionId                                              │
│                                                                              │
│   2. USER LOADS PAGE (50 projects)                                          │
│      └─► Client sends: SUBSCRIBE { entityCode: 'project', entityIds: [...] }│
│      └─► Server: subscriptionService.subscribe(userId, connId, ...)        │
│      └─► Database: INSERT INTO app.rxdb_subscription ...                    │
│                                                                              │
│   3. USER NAVIGATES TO ANOTHER PAGE                                         │
│      └─► Client sends: UNSUBSCRIBE { entityCode: 'project', entityIds }    │
│      └─► Client sends: SUBSCRIBE { entityCode: 'task', entityIds: [...] }  │
│      └─► Database: DELETE old, INSERT new                                   │
│                                                                              │
│   4. ANOTHER USER EDITS project-uuid-5                                      │
│      └─► app.logging gets new entry                                         │
│      └─► LogWatcher polls, finds change                                     │
│      └─► LogWatcher queries: SELECT FROM app.rxdb_subscription              │
│          WHERE entity_code='project' AND entity_id='uuid-5'                 │
│      └─► LogWatcher pushes INVALIDATE to subscribed connections             │
│                                                                              │
│   5. USER DISCONNECTS                                                       │
│      └─► connectionManager.disconnect(connectionId)                         │
│      └─► subscriptionService.cleanupConnection(connectionId)                │
│      └─► Database: DELETE FROM app.rxdb_subscription WHERE connection_id=...│
│                                                                              │
│   6. SERVER RESTARTS (Safety net)                                           │
│      └─► On startup: subscriptionService.cleanupStale(24)                   │
│      └─► Removes subscriptions older than 24 hours                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Performance Considerations

### Query Performance

| Operation | Query | Expected Time |
|-----------|-------|---------------|
| Subscribe (50 entities) | `bulk_subscribe()` | ~5ms |
| Unsubscribe (50 entities) | `bulk_unsubscribe()` | ~3ms |
| Find subscribers (1 entity) | Index scan | ~1ms |
| Find subscribers (100 entities) | `get_batch_subscribers()` | ~10ms |
| Cleanup connection | Index scan + delete | ~5ms |

### Table Size Estimate

| Users | Avg subscriptions/user | Total rows | Table size |
|-------|------------------------|------------|------------|
| 100 | 100 | 10,000 | ~1 MB |
| 1,000 | 100 | 100,000 | ~10 MB |
| 10,000 | 100 | 1,000,000 | ~100 MB |

### Maintenance

```sql
-- Run daily to clean stale subscriptions
SELECT app.cleanup_stale_subscriptions(24);

-- Monitor table size
SELECT pg_size_pretty(pg_total_relation_size('app.rxdb_subscription'));

-- Check subscription distribution
SELECT * FROM app.get_subscription_stats();
```

---

## Summary

| Aspect | Value |
|--------|-------|
| **Table** | `app.rxdb_subscription` |
| **Primary Key** | `(user_id, entity_code, entity_id)` |
| **Purpose** | Track live WebSocket subscriptions |
| **Lifecycle** | Created on SUBSCRIBE, deleted on UNSUBSCRIBE/disconnect |
| **Benefits** | No Redis needed, survives restarts, single source of truth |
| **Cleanup** | On disconnect + daily stale cleanup |
