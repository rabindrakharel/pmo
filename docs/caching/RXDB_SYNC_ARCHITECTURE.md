# RxDB Offline-First Cache & PubSub Real-Time Sync Architecture

> Comprehensive guide to offline-first storage with WebSocket real-time synchronization

**Version**: 5.1
**Date**: 2025-11-28
**Status**: Implemented (v8.6.0 - RxDB Unified State)
**Deployment**: Single-pod (<500 concurrent users)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Database Tables](#3-database-tables)
4. [PubSub WebSocket Service](#4-pubsub-websocket-service)
5. [Frontend Caching (RxDB)](#5-frontend-caching-rxdb)
6. [Cache Invalidation Flow](#6-cache-invalidation-flow)
7. [End-to-End Sequence Diagrams](#7-end-to-end-sequence-diagrams)
8. [WebSocket Protocol](#8-websocket-protocol)
9. [Code Implementation](#9-code-implementation)
10. [Deployment](#10-deployment)

---

## 1. Executive Summary

This architecture implements **offline-first, persistent storage** using **RxDB with IndexedDB**, combined with **WebSocket-based real-time sync** via a dedicated **PubSub service**.

### Design Pattern: Invalidation-Based Sync

```
+---------------------------------------------------------------------------+
|                         DESIGN PATTERN                                     |
+---------------------------------------------------------------------------+
|                                                                            |
|   Pattern: INVALIDATION-BASED SYNC (not full replication)                 |
|                                                                            |
|   1. Client caches data in RxDB (IndexedDB)                               |
|   2. Server pushes INVALIDATE messages when data changes                  |
|   3. Client re-fetches via REST API (RBAC re-validated)                   |
|   4. RxDB updates -> UI auto-refreshes (reactive queries)                 |
|                                                                            |
|   Why Invalidation vs Full Replication?                                   |
|   +-- Simpler: Reuses existing REST API endpoints                         |
|   +-- Secure: RBAC checked on every refetch                               |
|   +-- Efficient: Only changed entities fetched                            |
|   +-- Offline-first: IndexedDB persists across browser restart            |
|                                                                            |
+---------------------------------------------------------------------------+
```

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Client Storage | RxDB + IndexedDB | Offline-first, persistent, multi-tab sync |
| Sync Strategy | Invalidation-based | Reuse REST API, RBAC checked on refetch |
| Subscription Storage | PostgreSQL table (`app.rxdb_subscription`) | Persistent, multi-pod support, no Redis |
| Change Detection | Polling (60s) via `app.logging` | Simple, reliable, low overhead |
| WebSocket Protocol | Custom JSON messages | Lighter than full replication protocol |

### Key Benefits

| Benefit | Description |
|---------|-------------|
| **Offline-First** | Data persists in IndexedDB, works without network |
| **Multi-Tab Sync** | Changes sync across browser tabs via shared IndexedDB |
| **Real-Time** | WebSocket push for instant updates |
| **Reactive** | RxDB queries auto-update when data changes |
| **Draft Persistence** | Unsaved edits survive page refresh |

---

## 2. System Architecture

```
+---------------------------------------------------------------------------+
|                              SYSTEM OVERVIEW                               |
+---------------------------------------------------------------------------+
|                                                                            |
|  +--------------------------------------------------------------------+   |
|  |                     BROWSER (Frontend)                              |   |
|  |                                                                     |   |
|  |   +---------------+    +-----------------+    +---------------+    |   |
|  |   |     RxDB      |<-->|  ReplicationMgr |<-->|    React      |    |   |
|  |   |  (IndexedDB)  |    |   (WebSocket)   |    |  Components   |    |   |
|  |   |               |    |                 |    |               |    |   |
|  |   |  +---------+  |    |  * connect()    |    |  useRxEntity  |    |   |
|  |   |  | entities|  |    |  * subscribe()  |    |  useRxDraft   |    |   |
|  |   |  | drafts  |  |    |  * handleMsg()  |    |               |    |   |
|  |   |  | metadata|  |    +--------+--------+    +---------------+    |   |
|  |   |  +---------+  |             |                                  |   |
|  |   +-------+-------+             |                                  |   |
|  |           |                     |                                  |   |
|  |           | Persists across     | WebSocket (WSS)                  |   |
|  |           | browser restart     | port 4001                        |   |
|  |           |                     |                                  |   |
|  +-----------|---------------------|----------------------------------+   |
|              |                     |                                      |
|              | REST API (HTTPS)    |                                      |
|              | port 4000           |                                      |
|              v                     v                                      |
|  +----------------------+   +-------------------------------------+       |
|  |       REST API       |   |         PubSub Service              |       |
|  |      (Fastify)       |   |     (Standalone Node.js)            |       |
|  |                      |   |                                     |       |
|  |  * GET/POST/PATCH/DEL|   |  +--------------+  +-----------+   |       |
|  |  * /api/v1/*         |   |  | WebSocket Srv|  | LogWatcher|   |       |
|  |  * Writes app.logging|   |  | (connections)|  | (60s poll)|   |       |
|  |    via DB triggers   |   |  +------+-------+  +-----+-----+   |       |
|  |                      |   |         |               |          |       |
|  |  Port: 4000          |   |         v               |          |       |
|  |                      |   |  +--------------+       |          |       |
|  +----------+-----------+   |  | Connection   |<------+          |       |
|             |               |  | Manager      |                  |       |
|             |               |  +--------------+                  |       |
|             |               |                                     |       |
|             |               |  Port: 4001                         |       |
|             |               +-------------+-----------------------+       |
|             |                             |                               |
|             +-------------+---------------+                               |
|                           v                                               |
|  +--------------------------------------------------------------------+   |
|  |                     POSTGRESQL (Shared Database)                    |   |
|  |                                                                     |   |
|  |  +---------------+  +---------------+  +---------------------+     |   |
|  |  |  Entity Tables|  |  app.logging  |  | app.rxdb_subscription|     |   |
|  |  |               |  |               |  |                     |     |   |
|  |  |  app.project  |  |  * entity_code|  |  * user_id          |     |   |
|  |  |  app.task     |  |  * entity_id  |  |  * entity_code      |     |   |
|  |  |  app.employee |  |  * action     |  |  * entity_id        |     |   |
|  |  |  ... 27 more  |  |  * sync_status|  |  * connection_id    |     |   |
|  |  |               |  |               |  |                     |     |   |
|  |  +---------------+  +---------------+  +---------------------+     |   |
|  |                                                                     |   |
|  |  Port: 5434                                                         |   |
|  +--------------------------------------------------------------------+   |
|                                                                            |
+---------------------------------------------------------------------------+
```

### Process Boundaries

| Process | Port | Responsibility |
|---------|------|----------------|
| **REST API** | 4000 | CRUD operations, business logic, writes to `app.logging` |
| **PubSub Service** | 4001 | WebSocket connections, subscription management, push notifications |
| **PostgreSQL** | 5434 | Data storage, shared by both services |

---

## 3. Database Tables

### 3.1 Logging Table (`app.logging`)

**Purpose**: Audit trail of all entity changes. LogWatcher polls this for sync.

**DDL**: `db/04_logging.ddl`

```sql
CREATE TABLE app.logging (
    id UUID DEFAULT gen_random_uuid(),

    -- Actor (WHO)
    fname VARCHAR(100),
    lname VARCHAR(100),
    username VARCHAR(255),
    person_type VARCHAR(50),  -- 'employee', 'customer', 'system', 'guest'

    -- Target Entity (WHAT)
    entity_code VARCHAR(100),  -- 'project', 'task', 'employee', etc.
    entity_id UUID,

    -- Action (HOW)
    action SMALLINT CHECK (action >= 0 AND action <= 7),
    -- 0=VIEW, 1=COMMENT, 2=CONTRIBUTE, 3=EDIT, 4=SHARE, 5=DELETE, 6=CREATE, 7=OWNER

    -- Timestamps
    updated TIMESTAMPTZ DEFAULT now(),
    created_ts TIMESTAMPTZ DEFAULT now(),

    -- State Snapshots (optional, for audit)
    entity_from_version JSONB,
    entity_to_version JSONB,

    -- Security Context
    user_agent TEXT,
    ip INET,
    device_name VARCHAR(255),
    log_source VARCHAR(50) DEFAULT 'api',

    -- PubSub Sync Tracking
    sync_status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'sent', 'failed'
    sync_processed_ts TIMESTAMPTZ
);

-- Index for LogWatcher polling
CREATE INDEX idx_logging_sync_status
    ON app.logging(sync_status)
    WHERE sync_status = 'pending';

-- Index for entity-based lookups
CREATE INDEX idx_logging_entity
    ON app.logging(entity_code, entity_id);
```

### 3.2 Subscription Table (`app.rxdb_subscription`)

**Purpose**: Track live WebSocket subscriptions. Database-backed (no Redis needed).

**DDL**: `db/XXXVI_rxdb_subscription.ddl`

```sql
CREATE TABLE app.rxdb_subscription (
    user_id UUID NOT NULL,
    entity_code VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    connection_id VARCHAR(50) NOT NULL,
    subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (user_id, entity_code, entity_id)
);

-- LogWatcher query: "Who subscribes to this entity?"
CREATE INDEX idx_rxdb_subscription_entity
    ON app.rxdb_subscription(entity_code, entity_id);

-- Cleanup on disconnect
CREATE INDEX idx_rxdb_subscription_connection
    ON app.rxdb_subscription(connection_id);
```

### Why Database Instead of In-Memory?

| Aspect | In-Memory Map | Database Table |
|--------|---------------|----------------|
| **Multi-pod** | Needs Redis to sync | Works natively |
| **Server restart** | Lost | Survives (with cleanup) |
| **Debugging** | Console logs only | SQL queries |
| **Latency** | ~0ms | ~1-5ms |

**Decision**: Database table eliminates Redis entirely.

### 3.3 Subscription SQL Functions

```sql
-- Subscribe to multiple entities at once (bulk operation)
SELECT app.bulk_subscribe(
    'user-uuid'::UUID,
    'conn-123',
    'project',
    ARRAY['uuid-1', 'uuid-2', ...]::UUID[]
);

-- Find subscribers for changed entities (LogWatcher uses this)
SELECT * FROM app.get_batch_subscribers(
    'project',
    ARRAY['uuid-1', 'uuid-2', 'uuid-3']::UUID[]
);
-- Returns: user_id | connection_id | subscribed_entity_ids[]

-- Cleanup on disconnect
SELECT app.cleanup_connection_subscriptions('conn-123');

-- Cleanup stale subscriptions (daily cron)
SELECT app.cleanup_stale_subscriptions(24);  -- Remove >24h old
```

---

## 4. PubSub WebSocket Service

### 4.1 Service Architecture

**Location**: `apps/pubsub/`

```
apps/pubsub/
+-- package.json
+-- src/
    +-- index.ts                     # Entry point
    +-- server.ts                    # WebSocket server + HTTP health check
    +-- db.ts                        # PostgreSQL connection
    +-- auth.ts                      # JWT verification (same secret as API)
    +-- types.ts                     # TypeScript interfaces
    +-- services/
        +-- connection-manager.ts    # In-memory WebSocket tracking
        +-- subscription-manager.ts  # Database subscription CRUD
        +-- log-watcher.ts           # Polls app.logging, pushes INVALIDATE
```

### 4.2 Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| **ConnectionManager** | In-memory map of `connectionId -> WebSocket` |
| **SubscriptionManager** | CRUD on `app.rxdb_subscription` table |
| **LogWatcher** | Poll `app.logging` every 60s, push INVALIDATE to subscribers |

### 4.3 LogWatcher Flow

```
+---------------------------------------------------------------------------+
|                         LOG WATCHER FLOW (Every 60s)                       |
+---------------------------------------------------------------------------+
|                                                                            |
|   1. Poll app.logging for pending changes                                 |
|      +----------------------------------------------------------------+   |
|      | SELECT DISTINCT ON (entity_code, entity_id)                    |   |
|      |   id, entity_code, entity_id, action                           |   |
|      | FROM app.logging                                               |   |
|      | WHERE sync_status = 'pending' AND action != 0                  |   |
|      | ORDER BY entity_code, entity_id, created_ts DESC               |   |
|      | LIMIT 1000                                                     |   |
|      +----------------------------------------------------------------+   |
|                                                                            |
|   2. Group changes by entity_code                                         |
|      { 'project': ['uuid-1', 'uuid-5'], 'task': ['uuid-100'] }           |
|                                                                            |
|   3. Query subscribers from database                                      |
|      +----------------------------------------------------------------+   |
|      | SELECT * FROM app.get_batch_subscribers('project',             |   |
|      |   ARRAY['uuid-1', 'uuid-5']::UUID[])                          |   |
|      +----------------------------------------------------------------+   |
|                                                                            |
|   4. Push INVALIDATE via WebSocket (filtered per user)                    |
|      -> user-A: INVALIDATE { project: ['uuid-1'] }                       |
|      -> user-B: INVALIDATE { project: ['uuid-1', 'uuid-5'] }             |
|                                                                            |
|   5. Mark logs as processed                                               |
|      UPDATE app.logging SET sync_status = 'sent' WHERE ...               |
|                                                                            |
+---------------------------------------------------------------------------+
```

---

## 5. Frontend Caching (RxDB)

### 5.1 RxDB Collections

**Location**: `apps/web/src/db/rxdb/`

```typescript
// Entity storage (persistent across browser restart)
interface EntityDocType {
  _id: string;              // Composite: "entityCode:entityId"
  entityCode: string;       // 'project', 'task', etc.
  id: string;               // Entity UUID
  data: Record<string, unknown>;           // Raw entity data
  refData?: Record<string, Record<string, string>>;  // Reference lookups
  metadata?: Record<string, unknown>;      // Field metadata for rendering
  version: number;          // Server version for conflict detection
  syncedAt: number;         // Last sync timestamp (ms)
  _deleted: boolean;        // Soft delete flag
}

// Draft storage (unsaved edits survive page refresh)
interface DraftDocType {
  _id: string;              // "draft:entityCode:entityId"
  entityCode: string;
  entityId: string;
  originalData: Record<string, unknown>;
  currentData: Record<string, unknown>;
  undoStack: UndoEntry[];   // For undo/redo
  redoStack: UndoEntry[];
  updatedAt: number;
}
```

### 5.2 Schema Version

```typescript
// apps/web/src/db/rxdb/database.ts
const SCHEMA_VERSION = 'v4';

// Bumping this forces IndexedDB reset (used for schema migrations)
// v4: Store full metadata structure (metadata.entityListOfInstancesTable.viewType)
```

### 5.3 RxDB Hooks

```typescript
// Single entity (reactive, auto-refetches on INVALIDATE)
const { data, isLoading, refetch } = useRxEntity<Project>('project', projectId);

// Entity list
const { data: projects, total } = useRxEntityList<Project>('project', { limit: 20 });

// Draft persistence (survives page refresh)
const {
  hasDraft, currentData, hasChanges,
  startEdit, updateField, discardDraft,
  undo, redo, canUndo, canRedo
} = useRxDraft('project', projectId);
```

### 5.4 Metadata Caching (v8.6.0)

**Location**: `apps/web/src/db/rxdb/hooks/useRxMetadata.ts`

v8.6.0 unified all metadata storage in RxDB, replacing 4 Zustand stores:

```typescript
// Metadata collection schema
interface MetadataDocType {
  _id: string;              // Composite: "type:key" (e.g., "datalabel:project_stage")
  type: 'datalabel' | 'entity' | 'settings' | 'component';
  key: string | null;       // Key within type (e.g., "project_stage")
  data: unknown;            // Cached data
  cachedAt: number;         // Cache timestamp (ms)
  ttl: number;              // TTL in milliseconds
}

// TTL values
const METADATA_TTL = {
  datalabel: 60 * 60 * 1000,    // 1 hour
  entity: 60 * 60 * 1000,       // 1 hour
  settings: 60 * 60 * 1000,     // 1 hour
  component: 15 * 60 * 1000,    // 15 minutes
};
```

**React Hooks** (for components):
```typescript
const { options, isLoading } = useRxDatalabel('project_stage');
const { entityCodes, getEntityByCode } = useRxEntityCodes();
const { settings } = useRxGlobalSettings();
const { metadata } = useRxComponentMetadata('project');
```

**Sync Cache** (for non-hook access - formatters, utilities):
```typescript
import { getDatalabelSync, getEntityCodesSync, getGlobalSettingsSync } from '@/db/rxdb';

// Returns cached data or null (populated at login via prefetchAllMetadata)
const options = getDatalabelSync('project_stage');
const entityCodes = getEntityCodesSync();
const settings = getGlobalSettingsSync();
```

**Initialization Flow**:
```
Login → prefetchAllMetadata() → {
  1. Fetch datalabels from API
  2. Fetch entity types from API
  3. Fetch global settings from API
  4. Store in RxDB metadata collection
  5. Populate sync cache (in-memory Map)
}
```

---

## 6. Cache Invalidation Flow

### 6.1 How Invalidation Works

```
+---------------------------------------------------------------------------+
|                      CACHE INVALIDATION FLOW                               |
+---------------------------------------------------------------------------+
|                                                                            |
|   User A (Editor)                                     User B (Viewer)      |
|   ----------------                                    ----------------     |
|                                                                            |
|   1. PATCH /api/v1/project/123                                            |
|      |                                                                     |
|   2. API updates app.project                                              |
|      |                                                                     |
|   3. DB trigger inserts to app.logging                                    |
|      { entity_code: 'project', entity_id: '123',                          |
|        action: 1, sync_status: 'pending' }                                |
|      |                                                                     |
|   4. API returns 200 OK to User A                                         |
|                                                                            |
|   --------------- 60 seconds later ---------------                        |
|                                                                            |
|   5. LogWatcher polls app.logging                                         |
|      |                                                                     |
|   6. Queries app.rxdb_subscription:                                       |
|      "Who subscribes to project/123?"                                     |
|      |                                                                     |
|   7. Finds User B is subscribed                      <-                   |
|      |                                                                     |
|   8. Pushes INVALIDATE via WebSocket                 ->  User B receives  |
|      { type: 'INVALIDATE',                              INVALIDATE        |
|        payload: { entityCode: 'project',                     |            |
|                   changes: [{ entityId: '123',          9. RxDB marks     |
|                              action: 'UPDATE' }] }}        entity stale   |
|      |                                                       |            |
|   10. Marks logs as 'sent'                              10. Re-fetches    |
|                                                             GET /project/123
|                                                              |            |
|                                                          11. RxDB updates |
|                                                              UI re-renders|
|                                                                            |
+---------------------------------------------------------------------------+
```

### 6.2 ReplicationManager Handling

```typescript
// apps/web/src/db/rxdb/replication.ts

private handleMessage(event: MessageEvent): void {
  const message = JSON.parse(event.data);

  switch (message.type) {
    case 'INVALIDATE':
      this.handleInvalidate(message.payload);
      break;
    case 'PONG':
      // Heartbeat response
      break;
    case 'ERROR':
      console.error('[Replication] Server error:', message.payload);
      break;
  }
}

private async handleInvalidate(payload: InvalidatePayload): Promise<void> {
  const { entityCode, changes } = payload;

  for (const change of changes) {
    if (change.action === 'DELETE') {
      // Mark as deleted in RxDB
      await this.markDeleted(entityCode, change.entityId);
    } else {
      // Re-fetch from server and update RxDB
      await this.fetchEntity(entityCode, change.entityId);
    }
  }
}
```

---

## 7. End-to-End Sequence Diagrams

### 7.1 Complete Session Lifecycle

```
                    +-----------------------------------------------------+
                    |                  SESSION LIFECYCLE                   |
                    +-----------------------------------------------------+

Time -------------------------------------------------------------------------->

CLIENT              PUBSUB              DATABASE            REST API
  |                   |                    |                   |
  | ============================================================================
  |                   PHASE 1: CONNECTION
  | ============================================================================
  |                   |                    |                   |
  |  1. WebSocket     |                    |                   |
  |  ws://host:4001   |                    |                   |
  |  ?token=JWT       |                    |                   |
  |------------------>|                    |                   |
  |                   |                    |                   |
  |                   |  2. Verify JWT     |                   |
  |                   |  Store in          |                   |
  |                   |  ConnectionManager |                   |
  |                   |                    |                   |
  |  3. Connected     |                    |                   |
  |<------------------|                    |                   |
  |                   |                    |                   |
  | ============================================================================
  |                   PHASE 2: LOAD + SUBSCRIBE
  | ============================================================================
  |                   |                    |                   |
  |  4. GET /project  |                    |                   |
  |---------------------------------------------------------->|
  |                   |                    |                   |
  |  5. Data [id1,    |                    |                   |
  |     id2, id3]     |                    |                   |
  |<----------------------------------------------------------|
  |                   |                    |                   |
  |  6. Store in RxDB |                    |                   |
  |  ----------------  |                    |                   |
  |                   |                    |                   |
  |  7. SUBSCRIBE     |                    |                   |
  |  {project,        |                    |                   |
  |   [id1,id2,id3]}  |                    |                   |
  |------------------>|                    |                   |
  |                   |                    |                   |
  |                   |  8. bulk_subscribe |                   |
  |                   |  INSERT INTO       |                   |
  |                   |  rxdb_subscription |                   |
  |                   |------------------->|                   |
  |                   |                    |                   |
  |  9. SUBSCRIBED    |                    |                   |
  |  {count: 3}       |                    |                   |
  |<------------------|                    |                   |
  |                   |                    |                   |
  | ============================================================================
  |                   PHASE 3: REAL-TIME SYNC (repeats)
  | ============================================================================
  |                   |                    |                   |
  |                   |                    |  10. Another user |
  |                   |                    |  updates id1      |
  |                   |                    |<------------------|
  |                   |                    |                   |
  |                   |                    |  11. DB trigger   |
  |                   |                    |  inserts to       |
  |                   |                    |  app.logging      |
  |                   |                    |                   |
  |                   |  12. LogWatcher    |                   |
  |                   |  polls (60s)       |                   |
  |                   |<-------------------|                   |
  |                   |                    |                   |
  |                   |  13. Query         |                   |
  |                   |  get_batch_        |                   |
  |                   |  subscribers()     |                   |
  |                   |<-------------------|                   |
  |                   |                    |                   |
  |  14. INVALIDATE   |                    |                   |
  |  {project, id1}   |                    |                   |
  |<------------------|                    |                   |
  |                   |                    |                   |
  |  15. Re-fetch     |                    |                   |
  |  GET /project/id1 |                    |                   |
  |---------------------------------------------------------->|
  |                   |                    |                   |
  |  16. Fresh data   |                    |                   |
  |<----------------------------------------------------------|
  |                   |                    |                   |
  |  17. Update RxDB  |                    |                   |
  |  -> UI re-renders |                    |                   |
  |                   |                    |                   |
  | ============================================================================
  |                   PHASE 4: HEARTBEAT (every 30s)
  | ============================================================================
  |                   |                    |                   |
  |  18. PING         |                    |                   |
  |------------------>|                    |                   |
  |                   |                    |                   |
  |  19. PONG         |                    |                   |
  |<------------------|                    |                   |
  |                   |                    |                   |
  | ============================================================================
  |                   PHASE 5: DISCONNECT
  | ============================================================================
  |                   |                    |                   |
  |  20. Close        |                    |                   |
  |------------------>|                    |                   |
  |                   |                    |                   |
  |                   |  21. DELETE FROM   |                   |
  |                   |  rxdb_subscription |                   |
  |                   |  WHERE conn_id=X   |                   |
  |                   |------------------->|                   |
  |                   |                    |                   |
```

### 7.2 Reconnection with Exponential Backoff

```
CLIENT                                PUBSUB
  |                                     |
  |  Connection lost                    |
  |  ----------------                   |
  |                                     |
  |  Wait 1s                            |
  |  ---------                          |
  |                                     |
  |  Attempt 1                          |
  |------------------------------------>| FAIL
  |                                     |
  |  Wait 2s (x2 backoff)               |
  |  ---------                          |
  |                                     |
  |  Attempt 2                          |
  |------------------------------------>| FAIL
  |                                     |
  |  Wait 4s (x2 backoff)               |
  |  ---------                          |
  |                                     |
  |  Attempt 3                          |
  |------------------------------------>| SUCCESS
  |                                     |
  |  Re-subscribe to tracked entities   |
  |------------------------------------>|
  |                                     |
  |  SUBSCRIBED                         |
  |<------------------------------------|
  |                                     |
```

---

## 8. WebSocket Protocol

### 8.1 Client -> Server Messages

```typescript
// SUBSCRIBE - Subscribe to entity changes
interface SubscribeMessage {
  type: 'SUBSCRIBE';
  payload: {
    entityCode: string;      // 'project', 'task', 'employee'
    entityIds: string[];     // Array of UUIDs
  };
}

// UNSUBSCRIBE - Unsubscribe from specific entities
interface UnsubscribeMessage {
  type: 'UNSUBSCRIBE';
  payload: {
    entityCode: string;
    entityIds?: string[];    // If omitted, unsubscribe all of this type
  };
}

// UNSUBSCRIBE_ALL - Clear all subscriptions
interface UnsubscribeAllMessage {
  type: 'UNSUBSCRIBE_ALL';
}

// PING - Heartbeat (30s interval)
interface PingMessage {
  type: 'PING';
}

// TOKEN_REFRESH - Update JWT before expiry
interface TokenRefreshMessage {
  type: 'TOKEN_REFRESH';
  payload: {
    token: string;           // New JWT token
  };
}
```

### 8.2 Server -> Client Messages

```typescript
// INVALIDATE - Entity has changed, refetch required
interface InvalidateMessage {
  type: 'INVALIDATE';
  payload: {
    entityCode: string;
    changes: Array<{
      entityId: string;
      action: 'CREATE' | 'UPDATE' | 'DELETE';
      version: number;       // For out-of-order protection
    }>;
    timestamp: string;       // ISO 8601
  };
}

// SUBSCRIBED - Confirmation
interface SubscribedMessage {
  type: 'SUBSCRIBED';
  payload: { count: number };
}

// PONG - Heartbeat response
interface PongMessage {
  type: 'PONG';
}

// TOKEN_EXPIRING_SOON - Warning (5 min before expiry)
interface TokenExpiringSoonMessage {
  type: 'TOKEN_EXPIRING_SOON';
  payload: { expiresIn: number };  // Seconds
}

// ERROR - Error message
interface ErrorMessage {
  type: 'ERROR';
  payload: { message: string; code?: string };
}
```

### 8.3 Sample Payloads

```json
// SUBSCRIBE Request
{
  "type": "SUBSCRIBE",
  "payload": {
    "entityCode": "project",
    "entityIds": ["550e8400-e29b-41d4-a716-446655440001", "550e8400-e29b-41d4-a716-446655440002"]
  }
}

// INVALIDATE Message
{
  "type": "INVALIDATE",
  "payload": {
    "entityCode": "project",
    "changes": [
      { "entityId": "550e8400-e29b-41d4-a716-446655440001", "action": "UPDATE", "version": 42 }
    ],
    "timestamp": "2025-11-28T10:30:00.000Z"
  }
}
```

---

## 9. Code Implementation

### 9.1 RxDBProvider (App Integration)

**Location**: `apps/web/src/db/rxdb/RxDBProvider.tsx`

```tsx
import { RxDBProvider } from '@/db/rxdb';

function App() {
  return (
    <RxDBProvider>
      <AuthProvider>
        <Router>{/* App routes */}</Router>
      </AuthProvider>
    </RxDBProvider>
  );
}
```

### 9.2 ReplicationManager (WebSocket Client)

**Location**: `apps/web/src/db/rxdb/replication.ts`

Key methods:
- `connect(token)` - Establish WebSocket connection
- `disconnect()` - Close connection
- `subscribe(entityCode, entityIds)` - Subscribe to entities
- `fetchEntity(entityCode, entityId)` - Fetch from API, store in RxDB
- `fetchEntityList(entityCode, params)` - Fetch list, store all in RxDB

### 9.3 PubSub Server

**Location**: `apps/pubsub/src/server.ts`

Key components:
- WebSocket server on port 4001
- JWT verification (same secret as REST API)
- Message handling (SUBSCRIBE, UNSUBSCRIBE, PING, TOKEN_REFRESH)
- LogWatcher integration

---

## 10. Deployment

### 10.1 Environment Variables

```bash
# apps/pubsub/.env
DATABASE_URL=postgresql://app:app@localhost:5434/app
JWT_SECRET=your-jwt-secret-here  # Same as REST API!
PUBSUB_PORT=4001

# apps/web/.env
VITE_WS_URL=ws://localhost:4001        # Development
VITE_WS_URL=wss://pubsub.yourapp.com   # Production
```

### 10.2 Starting Services

```bash
# Using tools
./tools/start-all.sh  # Starts Docker + API + Web + PubSub

# Or manually
pnpm --filter @pmo/api dev      # Port 4000
pnpm --filter @pmo/pubsub dev   # Port 4001
pnpm --filter @pmo/web dev      # Port 5173
```

### 10.3 Health Checks

```bash
# PubSub health endpoint
curl http://localhost:4001/health

# Response
{
  "status": "ok",
  "uptime": 3600,
  "connections": 42,
  "users": 35,
  "logWatcherRunning": true
}
```

### 10.4 Monitoring Queries

```sql
-- Subscription statistics
SELECT * FROM app.get_subscription_stats();

-- Pending log entries
SELECT COUNT(*) FROM app.logging WHERE sync_status = 'pending';

-- Table size
SELECT pg_size_pretty(pg_total_relation_size('app.rxdb_subscription'));
```

---

## Related Documents

| Document | Purpose |
|----------|---------|
| `docs/state_management/STATE_MANAGEMENT.md` | RxDB unified state architecture (v8.6.0) |
| `docs/services/entity-infrastructure.service.md` | Entity CRUD patterns |
| `CLAUDE.md` | Main codebase reference |

---

**Version**: 5.1 | **Updated**: 2025-11-28 | **Status**: Implemented (v8.6.0 - RxDB Unified State)
