# TanStack Query + Dexie Offline-First Cache & WebSocket Sync Architecture

> Comprehensive guide to offline-first storage with WebSocket real-time synchronization

**Version**: 9.1.0
**Date**: 2025-11-28
**Status**: Production (v9.1.0 - TanStack Query + Dexie)
**Deployment**: Single-pod (<500 concurrent users)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Database Tables](#3-database-tables)
4. [PubSub WebSocket Service](#4-pubsub-websocket-service)
5. [Frontend Caching (TanStack Query + Dexie)](#5-frontend-caching-tanstack-query--dexie)
6. [Cache Invalidation Flow](#6-cache-invalidation-flow)
7. [End-to-End Sequence Diagrams](#7-end-to-end-sequence-diagrams)
8. [WebSocket Protocol](#8-websocket-protocol)
9. [Code Implementation](#9-code-implementation)
10. [Deployment](#10-deployment)

---

## 1. Executive Summary

This architecture implements **offline-first, persistent storage** using **TanStack Query + Dexie (IndexedDB)**, combined with **WebSocket-based real-time sync** via a dedicated **PubSub service**.

### Design Pattern: Invalidation-Based Sync

```
+---------------------------------------------------------------------------+
|                         DESIGN PATTERN                                     |
+---------------------------------------------------------------------------+
|                                                                            |
|   Pattern: INVALIDATION-BASED SYNC (not full replication)                 |
|                                                                            |
|   1. Client caches data in Dexie (IndexedDB)                              |
|   2. TanStack Query manages in-memory cache + server state                |
|   3. Server pushes INVALIDATE messages when data changes                  |
|   4. Client invalidates TanStack Query cache -> auto-refetches            |
|   5. Dexie updated -> persists across browser restart                     |
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
| In-Memory Cache | TanStack Query | Automatic background refetch, stale-while-revalidate |
| Persistent Storage | Dexie (IndexedDB) | Offline-first, survives browser restart |
| Sync Strategy | Invalidation-based | Reuse REST API, RBAC checked on refetch |
| Subscription Storage | PostgreSQL table | Persistent, multi-pod support, no Redis |
| Change Detection | Polling (60s) via `app.system_logging` | Simple, reliable, low overhead |
| Bundle Size | ~25KB | TanStack Query + Dexie vs ~150KB RxDB |

### Key Benefits

| Benefit | Description |
|---------|-------------|
| **Offline-First** | Data persists in IndexedDB, works without network |
| **Instant Load** | Dexie hydrates TanStack Query cache on startup |
| **Multi-Tab Sync** | Changes sync via shared IndexedDB |
| **Real-Time** | WebSocket push for instant updates |
| **Reactive** | TanStack Query auto-refetches on invalidation |
| **Draft Persistence** | Unsaved edits survive page refresh (Dexie) |

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
|  |   |   TanStack    |<-->| WebSocketManager|<-->|    React      |    |   |
|  |   |   Query +     |    |  (invalidation) |    |  Components   |    |   |
|  |   |   Dexie       |    |                 |    |               |    |   |
|  |   |               |    |  * connect()    |    |  useEntity    |    |   |
|  |   |  +---------+  |    |  * subscribe()  |    |  useEntityList|    |   |
|  |   |  | IndexedDB| |    |  * handleMsg()  |    |  useDraft     |    |   |
|  |   |  | entities | |    +--------+--------+    +---------------+    |   |
|  |   |  | drafts   | |             |                                  |   |
|  |   |  | metadata | |             |                                  |   |
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
|  |  * Writes app.system_logging|   |  | (connections)|  | (60s poll)|   |       |
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
|  |  |  Entity Tables|  |  app.system_logging  |  | app.system_cache_subscription|     |   |
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
| **REST API** | 4000 | CRUD operations, business logic, writes to `app.system_logging` |
| **PubSub Service** | 4001 | WebSocket connections, subscription management, push notifications |
| **PostgreSQL** | 5434 | Data storage, shared by both services |

---

## 3. Database Tables

### 3.1 Logging Table (`app.system_logging`)

**Purpose**: Audit trail of all entity changes. LogWatcher polls this for sync.

**DDL**: `db/04_logging.ddl`

```sql
CREATE TABLE app.system_logging (
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

    -- PubSub Sync Tracking
    sync_status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'sent', 'failed'
    sync_processed_ts TIMESTAMPTZ
);

-- Index for LogWatcher polling
CREATE INDEX idx_logging_sync_status
    ON app.system_logging(sync_status)
    WHERE sync_status = 'pending';
```

### 3.2 Subscription Table (`app.system_cache_subscription`)

**Purpose**: Track live WebSocket subscriptions. Database-backed (no Redis needed).

```sql
CREATE TABLE app.system_cache_subscription (
    user_id UUID NOT NULL,
    entity_code VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    connection_id VARCHAR(50) NOT NULL,
    subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (user_id, entity_code, entity_id)
);

-- LogWatcher query: "Who subscribes to this entity?"
CREATE INDEX idx_system_cache_subscription_entity
    ON app.system_cache_subscription(entity_code, entity_id);

-- Cleanup on disconnect
CREATE INDEX idx_system_cache_subscription_connection
    ON app.system_cache_subscription(connection_id);
```

---

## 4. PubSub WebSocket Service

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
        +-- log-watcher.ts           # Polls app.system_logging, pushes INVALIDATE
```

### LogWatcher Flow (Every 60s)

```
1. Poll app.system_logging for pending changes
   SELECT DISTINCT ON (entity_code, entity_id)
     id, entity_code, entity_id, action
   FROM app.system_logging
   WHERE sync_status = 'pending' AND action != 0
   ORDER BY entity_code, entity_id, created_ts DESC
   LIMIT 1000

2. Group changes by entity_code
   { 'project': ['uuid-1', 'uuid-5'], 'task': ['uuid-100'] }

3. Query subscribers: SELECT * FROM app.get_batch_subscribers(...)

4. Push INVALIDATE via WebSocket (filtered per user)

5. Mark logs as processed: UPDATE app.system_logging SET sync_status = 'sent'
```

---

## 5. Frontend Caching (TanStack Query + Dexie)

### 5.1 Dexie Schema (IndexedDB)

**Location**: `apps/web/src/db/dexie/database.ts`

```typescript
export interface CachedEntity {
  _id: string;              // Composite: "entityCode:entityId"
  entityCode: string;       // 'project', 'task', etc.
  entityId: string;         // Entity UUID
  data: Record<string, unknown>;           // Raw entity data
  metadata?: Record<string, unknown>;      // Field metadata
  refData?: Record<string, Record<string, string>>;  // Reference lookups
  version: number;          // Server version for conflict detection
  syncedAt: number;         // Last sync timestamp (ms)
  isDeleted?: boolean;      // Soft delete flag
}

export interface CachedDraft {
  _id: string;              // "draft:entityCode:entityId"
  entityCode: string;
  entityId: string;
  originalData: Record<string, unknown>;
  currentData: Record<string, unknown>;
  undoStack: Record<string, unknown>[];   // For undo
  redoStack: Record<string, unknown>[];   // For redo
  updatedAt: number;
}

// Database tables
class PMODatabase extends Dexie {
  entities!: Table<CachedEntity>;
  entityLists!: Table<CachedEntityList>;
  metadata!: Table<CachedMetadata>;
  drafts!: Table<CachedDraft>;

  constructor() {
    super('pmo-cache-v2');
    this.version(1).stores({
      entities: '_id, entityCode, entityId, syncedAt, isDeleted',
      entityLists: '_id, entityCode, queryHash, syncedAt',
      metadata: '_id, type, key',
      drafts: '_id, entityCode, entityId, updatedAt',
    });
  }
}
```

### 5.2 TanStack Query Configuration

**Location**: `apps/web/src/db/query/queryClient.ts`

```typescript
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,     // 5 minutes
      gcTime: 30 * 60 * 1000,       // 30 minutes garbage collection
      retry: 3,
      refetchOnWindowFocus: false,
    },
  },
});

// Hydrate from Dexie on startup
export async function hydrateQueryCache(): Promise<void> {
  const cached = await db.entities.toArray();
  for (const entity of cached) {
    queryClient.setQueryData(
      ['entity', entity.entityCode, entity.entityId],
      entity
    );
  }
}

// Invalidate entity queries (triggers refetch)
export function invalidateEntityQueries(
  entityCode: string,
  entityId?: string
): void {
  if (entityId) {
    queryClient.invalidateQueries({
      queryKey: ['entity', entityCode, entityId],
    });
  }
  queryClient.invalidateQueries({
    queryKey: ['entity-list', entityCode],
  });
}
```

### 5.3 Hooks

```typescript
// apps/web/src/db/tanstack-hooks/

// Single entity (reactive, auto-refetches on invalidation)
const { data, isLoading, refetch } = useEntity<Project>('project', projectId);

// Entity list with pagination
const { data: projects, total } = useEntityList<Project>('project', { limit: 20 });

// Mutations
const { updateEntity, deleteEntity } = useEntityMutation('project');

// Draft persistence (survives page refresh)
const {
  hasDraft, currentData, hasChanges,
  startEdit, updateField, discardDraft,
  undo, redo, canUndo, canRedo
} = useDraft('project', projectId);

// Metadata (with sync cache for non-hook access)
const { options } = useDatalabel('project_stage');
const stages = getDatalabelSync('project_stage');  // For formatters
```

### 5.4 Data Flow

```
Component mounts
    |
    v
useEntity('project', id)
    |
    +-- Check TanStack Query cache (in-memory)
    |   |
    |   +-- HIT & fresh -> Return immediately
    |   |
    |   +-- MISS -> Check Dexie (IndexedDB)
    |       |
    |       +-- HIT -> Return, mark stale, background refetch
    |       |
    |       +-- MISS -> Fetch from API
    |
    v
API Response
    |
    +-- Store in TanStack Query cache
    +-- Persist to Dexie (IndexedDB)
    +-- WebSocket SUBSCRIBE for entity
    |
    v
Component re-renders with data
```

---

## 6. Cache Invalidation Flow

### WebSocket INVALIDATE Handling

**Location**: `apps/web/src/db/tanstack-sync/WebSocketManager.ts`

```typescript
private async handleInvalidate(payload: InvalidatePayload): Promise<void> {
  const { entityCode, changes } = payload;

  for (const change of changes) {
    // Skip stale updates (version tracking)
    if (change.version <= lastProcessedVersion) continue;

    if (change.action === 'DELETE') {
      // Mark as deleted in Dexie
      await db.entities.update(cacheKey, { isDeleted: true });
      // Remove from TanStack Query cache
      queryClient.removeQueries({ queryKey: ['entity', entityCode, entityId] });
    } else {
      // Invalidate TanStack Query cache -> triggers auto-refetch
      invalidateEntityQueries(entityCode, change.entityId);
    }
  }

  // Invalidate list queries for this entity type
  invalidateEntityQueries(entityCode);
}
```

### Complete Flow

```
User A (Editor)                                     User B (Viewer)
----------------                                    ----------------

1. PATCH /api/v1/project/123
   |
2. API updates app.project
   |
3. DB trigger inserts to app.system_logging
   { entity_code: 'project', entity_id: '123',
     action: 1, sync_status: 'pending' }
   |
4. API returns 200 OK to User A

--------------- 60 seconds later ---------------

5. LogWatcher polls app.system_logging
   |
6. Queries app.system_cache_subscription:
   "Who subscribes to project/123?"
   |
7. Finds User B is subscribed                      <-
   |
8. Pushes INVALIDATE via WebSocket                 ->  User B receives
   { type: 'INVALIDATE',                              INVALIDATE
     payload: { entityCode: 'project',                     |
                changes: [{ entityId: '123',          9. WebSocketManager
                           action: 'UPDATE' }] }}         invalidates cache
   |                                                       |
10. Marks logs as 'sent'                              10. TanStack Query
                                                          auto-refetches
                                                          GET /project/123
                                                              |
                                                          11. Updates Dexie
                                                              UI re-renders
```

---

## 7. End-to-End Sequence Diagrams

### Complete Session Lifecycle

```
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
  |  6. Store in      |                    |                   |
  |  TanStack + Dexie |                    |                   |
  |  ----------------  |                    |                   |
  |                   |                    |                   |
  |  7. SUBSCRIBE     |                    |                   |
  |  {project,        |                    |                   |
  |   [id1,id2,id3]}  |                    |                   |
  |------------------>|                    |                   |
  |                   |                    |                   |
  |                   |  8. bulk_subscribe |                   |
  |                   |  INSERT INTO       |                   |
  |                   |  system_cache_subscription |                   |
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
  |                   |  11. LogWatcher    |                   |
  |                   |  polls (60s)       |                   |
  |                   |<-------------------|                   |
  |                   |                    |                   |
  |  12. INVALIDATE   |                    |                   |
  |  {project, id1}   |                    |                   |
  |<------------------|                    |                   |
  |                   |                    |                   |
  |  13. queryClient  |                    |                   |
  |  .invalidate()    |                    |                   |
  |  -> auto-refetch  |                    |                   |
  |  GET /project/id1 |                    |                   |
  |---------------------------------------------------------->|
  |                   |                    |                   |
  |  14. Fresh data   |                    |                   |
  |<----------------------------------------------------------|
  |                   |                    |                   |
  |  15. Update Dexie |                    |                   |
  |  -> UI re-renders |                    |                   |
```

### Reconnection with Exponential Backoff

```
Max 10 reconnection attempts:
- Attempt 1: Wait 1s
- Attempt 2: Wait 2s
- Attempt 3: Wait 4s
- ...
- Attempt 10: Wait 30s (capped)

Auth errors (code 4001/4002): No retry, stay disconnected
```

---

## 8. WebSocket Protocol

### Client -> Server Messages

| Type | Payload | Purpose |
|------|---------|---------|
| `SUBSCRIBE` | `{ entityCode, entityIds[] }` | Subscribe to entity changes |
| `UNSUBSCRIBE` | `{ entityCode, entityIds? }` | Unsubscribe from entities |
| `UNSUBSCRIBE_ALL` | - | Clear all subscriptions |
| `PING` | - | Heartbeat (30s interval) |
| `TOKEN_REFRESH` | `{ token }` | Update JWT before expiry |

### Server -> Client Messages

| Type | Payload | Purpose |
|------|---------|---------|
| `INVALIDATE` | `{ entityCode, changes[], timestamp }` | Entity changed, refetch required |
| `SUBSCRIBED` | `{ count }` | Subscription confirmed |
| `PONG` | - | Heartbeat response |
| `TOKEN_EXPIRING_SOON` | `{ expiresIn }` | Warning 5 min before expiry |
| `ERROR` | `{ message }` | Error notification |

### Sample INVALIDATE Message

```json
{
  "type": "INVALIDATE",
  "payload": {
    "entityCode": "project",
    "changes": [
      { "entityId": "550e8400-...", "action": "UPDATE", "version": 42 }
    ],
    "timestamp": "2025-11-28T10:30:00.000Z"
  }
}
```

---

## 9. Code Implementation

### 9.1 TanstackCacheProvider (App Integration)

**Location**: `apps/web/src/db/TanstackCacheProvider.tsx`

```tsx
import { TanstackCacheProvider } from '@/db/tanstack-index';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TanstackCacheProvider>
        <AuthProvider>
          <Router>{/* App routes */}</Router>
        </AuthProvider>
      </TanstackCacheProvider>
    </QueryClientProvider>
  );
}
```

### 9.2 WebSocketManager

**Location**: `apps/web/src/db/tanstack-sync/WebSocketManager.ts`

Key methods:
- `connect(token)` - Establish WebSocket connection
- `disconnect()` - Close connection
- `subscribe(entityCode, entityIds)` - Subscribe to entities
- `refreshToken(newToken)` - Update JWT

### 9.3 Key File Locations

```
apps/web/src/db/
+-- TanstackCacheProvider.tsx     # React context provider
+-- tanstack-index.ts             # Public API exports
+-- dexie/
|   +-- database.ts               # Dexie schema + helpers
+-- query/
|   +-- queryClient.ts            # TanStack Query config
+-- tanstack-hooks/
|   +-- useEntity.ts              # Single entity + mutations
|   +-- useEntityList.ts          # Paginated list queries
|   +-- useDatalabel.ts           # Dropdown options + sync cache
|   +-- useEntityCodes.ts         # Entity type definitions
|   +-- useGlobalSettings.ts      # App settings
|   +-- useDraft.ts               # Draft persistence + undo/redo
|   +-- useOfflineEntity.ts       # Dexie-only access
+-- tanstack-sync/
    +-- WebSocketManager.ts       # WebSocket + cache invalidation
```

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

---

## Related Documents

| Document | Purpose |
|----------|---------|
| `docs/state_management/STATE_MANAGEMENT.md` | TanStack Query + Dexie state architecture |
| `docs/services/entity-infrastructure.service.md` | Entity CRUD patterns |
| `CLAUDE.md` | Main codebase reference |

---

**Version**: 9.1.0 | **Updated**: 2025-11-28 | **Status**: Production (TanStack Query + Dexie)
