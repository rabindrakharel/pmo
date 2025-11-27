# RxDB Real-Time Sync Architecture

> Offline-first, persistent storage with WebSocket real-time sync

**Version**: 4.0
**Date**: 2025-11-27
**Status**: Implemented
**Deployment**: Single-pod (<500 concurrent users)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Component Architecture](#component-architecture)
4. [Interface Definitions](#interface-definitions)
5. [End-to-End Flow](#end-to-end-flow)
6. [Sequence Diagrams](#sequence-diagrams)
7. [Database Schema](#database-schema)
8. [Code Implementation](#code-implementation)
9. [Sample Payloads](#sample-payloads)
10. [Deployment](#deployment)

---

## 1. Executive Summary

This architecture implements **offline-first, persistent storage** using **RxDB with IndexedDB**, combined with **WebSocket-based real-time sync**. Data survives page refresh and browser restart. Unsaved edits persist through refreshes.

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Client Storage | RxDB + IndexedDB | Offline-first, persistent, multi-tab sync |
| Sync Strategy | Invalidation-based | Reuse existing REST API, RBAC checked on refetch |
| Subscription Storage | PostgreSQL table | Persistent across restarts, easy debugging |
| Change Detection | Polling (60s) | Simple, reliable, low overhead |
| WebSocket Protocol | Custom JSON | Lighter than full replication protocol |
| Draft Persistence | RxDB drafts collection | Unsaved edits survive page refresh |

### Key Benefits

| Benefit | Description |
|---------|-------------|
| **Offline-First** | Works without network connection |
| **Persistent** | Data survives browser restart (IndexedDB) |
| **Multi-Tab** | Changes sync across browser tabs automatically |
| **Draft Persistence** | Unsaved edits survive page refresh |
| **Real-Time** | WebSocket push for instant updates |
| **Reactive** | Queries auto-update when data changes |

### Architecture Summary

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              SYSTEM FLOW                                  │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│   1. Client loads entities via REST API → stores in RxDB (IndexedDB)     │
│   2. ReplicationManager subscribes via WebSocket                          │
│   3. Entity changes logged to app.logging table (database triggers)       │
│   4. LogWatcher polls every 60s, finds subscribers in app.rxdb_subscription│
│   5. PubSub pushes INVALIDATE to subscribed WebSocket connections         │
│   6. ReplicationManager re-fetches → updates RxDB → UI auto-updates      │
│   7. All tabs see changes via RxDB's shared IndexedDB storage             │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Browser)                              │
│                                                                              │
│   ┌──────────────────┐    ┌─────────────────┐    ┌──────────────────────┐   │
│   │   RxDB           │◄──►│ ReplicationMgr  │◄──►│  React Components    │   │
│   │   (IndexedDB)    │    │   (WebSocket)   │    │  (reactive queries)  │   │
│   │                  │    │                 │    │                      │   │
│   │  ┌────────────┐  │    └────────┬────────┘    └──────────────────────┘   │
│   │  │ entities   │  │             │                                         │
│   │  │ drafts     │  │             │ subscribe/unsubscribe                   │
│   │  │ metadata   │  │             │ INVALIDATE messages                     │
│   │  └────────────┘  │             │                                         │
│   └────────┬─────────┘             │                                         │
│            │                       │                                         │
│            │ persistent            │                                         │
│            │ (survives refresh)    │                                         │
└────────────┼───────────────────────┼─────────────────────────────────────────┘
             │                       │
             │ REST API              │ WebSocket
             │ (HTTPS)               │ (WSS)
             ▼                       ▼
┌─────────────────────────────┐   ┌─────────────────────────────────────────┐
│         REST API            │   │           PubSub Service                 │
│        (Fastify)            │   │         (Separate Process)               │
│                             │   │                                          │
│   GET/POST/PATCH/DELETE     │   │   ┌─────────────┐  ┌─────────────────┐  │
│   /api/v1/*                 │   │   │  WebSocket  │  │   LogWatcher    │  │
│                             │   │   │   Server    │  │  (60s polling)  │  │
│   Port: 4000                │   │   │  Port: 4001 │  │                 │  │
│                             │   │   └──────┬──────┘  └────────┬────────┘  │
│   Writes to app.logging     │   │          │                  │           │
│   via database triggers     │   │          ▼                  │           │
└─────────────┬───────────────┘   │   ┌─────────────────┐       │           │
              │                   │   │  Connection     │◄──────┘           │
              │                   │   │  Manager        │                   │
              │                   │   └────────┬────────┘                   │
              │                   └────────────┼────────────────────────────┘
              │                                │
              │                                │
┌─────────────▼────────────────────────────────▼──────────────────────────────┐
│                           POSTGRESQL (Shared Database)                       │
│                                                                              │
│   ┌────────────────┐  ┌────────────────┐  ┌─────────────────────────┐       │
│   │  app.project   │  │  app.logging   │  │  app.rxdb_subscription  │       │
│   │  app.task      │  │  (changes)     │  │  (live subscriptions)   │       │
│   │  app.employee  │  │                │  │                         │       │
│   │  ... 27 more   │  │                │  │                         │       │
│   └────────────────┘  └────────────────┘  └─────────────────────────┘       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Key Points

- **REST API (Port 4000)**: Existing Fastify server, handles all CRUD operations
- **PubSub Service (Port 4001)**: Separate Node.js process for WebSocket connections
- **Shared Database**: Both services connect to the same PostgreSQL instance
- **No IPC Required**: PubSub reads `app.logging` table written by REST API triggers

---

## 3. Component Architecture

### 3.1 Backend Components

```
apps/pubsub/
├── package.json                     # Dependencies: ws, pg, jsonwebtoken
├── tsconfig.json
├── .env.example                     # Environment template
├── Dockerfile
└── src/
    ├── index.ts                     # Entry point
    ├── server.ts                    # WebSocket server setup
    ├── db.ts                        # Database connection (shared with REST API)
    ├── auth.ts                      # JWT verification (same secret as REST API)
    ├── types.ts                     # TypeScript interfaces
    └── services/
        ├── connection-manager.ts    # In-memory WebSocket tracking
        ├── subscription-manager.ts  # Database subscription CRUD
        └── log-watcher.ts           # Polls app.logging, pushes invalidations
```

### 3.2 Frontend Components

```
apps/web/src/db/sync/
├── index.ts                         # Module exports
├── SyncProvider.tsx                 # React context + WebSocket lifecycle
├── useAutoSubscribe.ts              # Automatic subscription management
├── useAutoSubscribeSingle.ts        # Single entity subscription
└── types.ts                         # TypeScript interfaces

Integration Points:
├── App.tsx                          # SyncProvider wraps application
└── lib/hooks/useEntityQuery.ts      # Hooks call useAutoSubscribe
```

### 3.3 Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| **SyncProvider** | WebSocket connection lifecycle, message routing, cache invalidation |
| **useAutoSubscribe** | Subscribe/unsubscribe based on entity IDs in view |
| **ConnectionManager** | Track WebSocket connections in memory (pod-local) |
| **SubscriptionManager** | CRUD operations on `app.rxdb_subscription` table |
| **LogWatcher** | Poll `app.logging`, find subscribers, push INVALIDATE messages |

---

## 4. Interface Definitions

### 4.1 Client → Server Messages

```typescript
// SUBSCRIBE - Subscribe to entity changes
interface SubscribeMessage {
  type: 'SUBSCRIBE';
  payload: {
    entityCode: string;      // e.g., 'project', 'task', 'employee'
    entityIds: string[];     // Array of UUIDs
  };
}

// UNSUBSCRIBE - Unsubscribe from specific entities
interface UnsubscribeMessage {
  type: 'UNSUBSCRIBE';
  payload: {
    entityCode: string;
    entityIds?: string[];    // If omitted, unsubscribe from all of this type
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

type ClientMessage =
  | SubscribeMessage
  | UnsubscribeMessage
  | UnsubscribeAllMessage
  | PingMessage
  | TokenRefreshMessage;
```

### 4.2 Server → Client Messages

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

// SUBSCRIBED - Confirmation of subscription
interface SubscribedMessage {
  type: 'SUBSCRIBED';
  payload: {
    count: number;           // Number of entities subscribed
  };
}

// PONG - Heartbeat response
interface PongMessage {
  type: 'PONG';
}

// TOKEN_EXPIRING_SOON - Warning before JWT expires
interface TokenExpiringSoonMessage {
  type: 'TOKEN_EXPIRING_SOON';
  payload: {
    expiresIn: number;       // Seconds until expiry
  };
}

// ERROR - Error message
interface ErrorMessage {
  type: 'ERROR';
  payload: {
    message: string;
    code?: string;
  };
}

type ServerMessage =
  | InvalidateMessage
  | SubscribedMessage
  | PongMessage
  | TokenExpiringSoonMessage
  | ErrorMessage;
```

### 4.3 React Context Interface

```typescript
// SyncProvider exports this context value
interface SyncContextValue {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  subscribe: (entityCode: string, entityIds: string[]) => void;
  unsubscribe: (entityCode: string, entityIds?: string[]) => void;
  unsubscribeAll: () => void;
}

// Hook usage (REQUIRED - throws if not in SyncProvider)
const { status, subscribe, unsubscribe } = useSync();
```

### 4.4 Database Interfaces

```typescript
// Subscription record (app.rxdb_subscription)
interface Subscription {
  user_id: string;           // UUID of subscribed user
  entity_code: string;       // Entity type code
  entity_id: string;         // Entity instance UUID
  connection_id: string;     // WebSocket connection ID
  subscribed_at: Date;
}

// Log entry (app.logging)
interface LogEntry {
  id: string;
  entity_code: string;
  entity_id: string;
  action: number;            // 0=VIEW, 1=EDIT, 3=DELETE, 4=CREATE
  sync_status: 'pending' | 'sent' | 'failed';
  sync_processed_ts?: Date;
  created_ts: Date;
}
```

---

## 5. End-to-End Flow

### 5.1 Connection Establishment Flow

```
┌────────┐          ┌────────────┐          ┌──────────┐
│ Client │          │  PubSub    │          │ Database │
└───┬────┘          └─────┬──────┘          └────┬─────┘
    │                     │                      │
    │  1. WebSocket       │                      │
    │  connect with       │                      │
    │  JWT token          │                      │
    │────────────────────>│                      │
    │                     │                      │
    │                     │  2. Verify JWT       │
    │                     │  (same secret        │
    │                     │   as REST API)       │
    │                     │                      │
    │                     │  3. Store connection │
    │                     │  in memory map       │
    │                     │                      │
    │  4. Connection      │                      │
    │  established        │                      │
    │<────────────────────│                      │
    │                     │                      │
```

### 5.2 Subscription Flow

```
┌────────┐          ┌────────────┐          ┌──────────┐
│ Client │          │  PubSub    │          │ Database │
└───┬────┘          └─────┬──────┘          └────┬─────┘
    │                     │                      │
    │  1. SUBSCRIBE       │                      │
    │  {project, [id1,    │                      │
    │   id2, id3]}        │                      │
    │────────────────────>│                      │
    │                     │                      │
    │                     │  2. bulk_subscribe() │
    │                     │  (upsert to          │
    │                     │   rxdb_subscription) │
    │                     │─────────────────────>│
    │                     │                      │
    │                     │  3. Rows affected    │
    │                     │<─────────────────────│
    │                     │                      │
    │  4. SUBSCRIBED      │                      │
    │  {count: 3}         │                      │
    │<────────────────────│                      │
    │                     │                      │
```

### 5.3 Entity Change Detection & Notification Flow

```
┌────────┐     ┌──────────┐     ┌──────────┐     ┌────────────┐     ┌────────┐
│ User A │     │ REST API │     │ Database │     │  PubSub    │     │ User B │
└───┬────┘     └────┬─────┘     └────┬─────┘     └─────┬──────┘     └───┬────┘
    │               │                │                 │                │
    │  1. PATCH     │                │                 │                │
    │  /project/123 │                │                 │                │
    │──────────────>│                │                 │                │
    │               │                │                 │                │
    │               │  2. UPDATE     │                 │                │
    │               │  project       │                 │                │
    │               │───────────────>│                 │                │
    │               │                │                 │                │
    │               │                │  3. TRIGGER     │                │
    │               │                │  inserts to     │                │
    │               │                │  app.logging    │                │
    │               │                │                 │                │
    │  4. 200 OK    │                │                 │                │
    │<──────────────│                │                 │                │
    │               │                │                 │                │
    │               │                │                 │  5. LogWatcher │
    │               │                │                 │  polls (60s)   │
    │               │                │                 │<───────────────│
    │               │                │                 │                │
    │               │                │  6. Query       │                │
    │               │                │  pending logs   │                │
    │               │                │<────────────────│                │
    │               │                │                 │                │
    │               │                │  7. Query       │                │
    │               │                │  subscribers    │                │
    │               │                │<────────────────│                │
    │               │                │                 │                │
    │               │                │                 │  8. INVALIDATE │
    │               │                │                 │  to User B     │
    │               │                │                 │────────────────>│
    │               │                │                 │                │
    │               │                │  9. Mark logs   │                │
    │               │                │  as 'sent'      │                │
    │               │                │<────────────────│                │
    │               │                │                 │                │
```

### 5.4 Client Cache Invalidation Flow

```
┌──────────────┐     ┌────────────┐     ┌─────────────┐     ┌──────────┐
│ SyncProvider │     │ React Query│     │ Component   │     │ REST API │
└──────┬───────┘     └─────┬──────┘     └──────┬──────┘     └────┬─────┘
       │                   │                   │                  │
       │  1. INVALIDATE    │                   │                  │
       │  received         │                   │                  │
       │                   │                   │                  │
       │  2. Check version │                   │                  │
       │  (skip if stale)  │                   │                  │
       │                   │                   │                  │
       │  3. invalidate    │                   │                  │
       │  Queries()        │                   │                  │
       │──────────────────>│                   │                  │
       │                   │                   │                  │
       │                   │  4. Mark query    │                  │
       │                   │  as stale         │                  │
       │                   │                   │                  │
       │                   │  5. If component  │                  │
       │                   │  mounted, refetch │                  │
       │                   │──────────────────>│                  │
       │                   │                   │                  │
       │                   │                   │  6. GET /project │
       │                   │                   │────────────────>│
       │                   │                   │                  │
       │                   │                   │  7. Fresh data   │
       │                   │                   │<────────────────│
       │                   │                   │                  │
       │                   │  8. Update cache  │                  │
       │                   │<──────────────────│                  │
       │                   │                   │                  │
       │                   │  9. Re-render     │                  │
       │                   │  with new data    │                  │
       │                   │──────────────────>│                  │
       │                   │                   │                  │
```

---

## 6. Sequence Diagrams

### 6.1 Complete Session Lifecycle

```
                    ┌─────────────────────────────────────────────────────┐
                    │                  SESSION LIFECYCLE                   │
                    └─────────────────────────────────────────────────────┘

Time ─────────────────────────────────────────────────────────────────────────>

CLIENT              PUBSUB              DATABASE            REST API
  │                   │                    │                   │
  │ ══════════════════════════════════════════════════════════════════════════
  │                   PHASE 1: CONNECTION
  │ ══════════════════════════════════════════════════════════════════════════
  │                   │                    │                   │
  │  1. Connect       │                    │                   │
  │  ws://host:4001   │                    │                   │
  │  ?token=JWT       │                    │                   │
  │──────────────────>│                    │                   │
  │                   │                    │                   │
  │                   │  2. Verify JWT     │                   │
  │                   │  Store connId      │                   │
  │                   │                    │                   │
  │  3. Connected     │                    │                   │
  │<──────────────────│                    │                   │
  │                   │                    │                   │
  │ ══════════════════════════════════════════════════════════════════════════
  │                   PHASE 2: LOAD + SUBSCRIBE
  │ ══════════════════════════════════════════════════════════════════════════
  │                   │                    │                   │
  │  4. GET /project  │                    │                   │
  │─────────────────────────────────────────────────────────────>│
  │                   │                    │                   │
  │  5. Data [id1,    │                    │                   │
  │     id2, id3]     │                    │                   │
  │<─────────────────────────────────────────────────────────────│
  │                   │                    │                   │
  │  6. SUBSCRIBE     │                    │                   │
  │  {project,        │                    │                   │
  │   [id1,id2,id3]}  │                    │                   │
  │──────────────────>│                    │                   │
  │                   │                    │                   │
  │                   │  7. INSERT to      │                   │
  │                   │  rxdb_subscription │                   │
  │                   │───────────────────>│                   │
  │                   │                    │                   │
  │  8. SUBSCRIBED    │                    │                   │
  │  {count: 3}       │                    │                   │
  │<──────────────────│                    │                   │
  │                   │                    │                   │
  │ ══════════════════════════════════════════════════════════════════════════
  │                   PHASE 3: REAL-TIME SYNC (repeats)
  │ ══════════════════════════════════════════════════════════════════════════
  │                   │                    │                   │
  │                   │                    │  9. Another user  │
  │                   │                    │  updates id1      │
  │                   │                    │<──────────────────│
  │                   │                    │                   │
  │                   │                    │  10. TRIGGER      │
  │                   │                    │  logs to          │
  │                   │                    │  app.logging      │
  │                   │                    │                   │
  │                   │  11. LogWatcher    │                   │
  │                   │  polls (60s)       │                   │
  │                   │<───────────────────│                   │
  │                   │                    │                   │
  │  12. INVALIDATE   │                    │                   │
  │  {project, id1}   │                    │                   │
  │<──────────────────│                    │                   │
  │                   │                    │                   │
  │  13. Invalidate   │                    │                   │
  │  React Query      │                    │                   │
  │  ────────         │                    │                   │
  │                   │                    │                   │
  │  14. Refetch      │                    │                   │
  │  GET /project/id1 │                    │                   │
  │─────────────────────────────────────────────────────────────>│
  │                   │                    │                   │
  │  15. Fresh data   │                    │                   │
  │<─────────────────────────────────────────────────────────────│
  │                   │                    │                   │
  │ ══════════════════════════════════════════════════════════════════════════
  │                   PHASE 4: HEARTBEAT (every 30s)
  │ ══════════════════════════════════════════════════════════════════════════
  │                   │                    │                   │
  │  16. PING         │                    │                   │
  │──────────────────>│                    │                   │
  │                   │                    │                   │
  │  17. PONG         │                    │                   │
  │<──────────────────│                    │                   │
  │                   │                    │                   │
  │ ══════════════════════════════════════════════════════════════════════════
  │                   PHASE 5: DISCONNECT
  │ ══════════════════════════════════════════════════════════════════════════
  │                   │                    │                   │
  │  18. Close        │                    │                   │
  │──────────────────>│                    │                   │
  │                   │                    │                   │
  │                   │  19. DELETE from   │                   │
  │                   │  rxdb_subscription │                   │
  │                   │  WHERE conn_id=X   │                   │
  │                   │───────────────────>│                   │
  │                   │                    │                   │
  │                   │  20. Remove from   │                   │
  │                   │  in-memory map     │                   │
  │                   │                    │                   │
```

### 6.2 Reconnection with Exponential Backoff

```
CLIENT                                PUBSUB
  │                                     │
  │  Connection lost                    │
  │  ────────────────                   │
  │                                     │
  │  Wait 1s                            │
  │  ─────────                          │
  │                                     │
  │  Attempt 1                          │
  │────────────────────────────────────>│ FAIL
  │                                     │
  │  Wait 2s                            │
  │  ─────────                          │
  │                                     │
  │  Attempt 2                          │
  │────────────────────────────────────>│ FAIL
  │                                     │
  │  Wait 4s                            │
  │  ─────────                          │
  │                                     │
  │  Attempt 3                          │
  │────────────────────────────────────>│ SUCCESS
  │                                     │
  │  Flush pending subscriptions        │
  │────────────────────────────────────>│
  │                                     │
  │  SUBSCRIBED                         │
  │<────────────────────────────────────│
  │                                     │
```

---

## 7. Database Schema

### 7.1 Logging Table (`db/XXXV_logging.ddl`)

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

-- Index for LogWatcher polling
CREATE INDEX idx_logging_sync_pending
    ON app.logging(created_ts)
    WHERE sync_status = 'pending' AND action != 0;
```

### 7.2 Subscription Table (`db/XXXVI_rxdb_subscription.ddl`)

```sql
CREATE TABLE app.rxdb_subscription (
    user_id UUID NOT NULL,
    entity_code VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    connection_id VARCHAR(50) NOT NULL,
    subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (user_id, entity_code, entity_id)
);

-- LogWatcher query index
CREATE INDEX idx_rxdb_subscription_entity
    ON app.rxdb_subscription(entity_code, entity_id);

-- Disconnect cleanup index
CREATE INDEX idx_rxdb_subscription_connection
    ON app.rxdb_subscription(connection_id);
```

### 7.3 Entity Change Triggers

```sql
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
        entity_from_version, entity_to_version
    ) VALUES (
        v_person_id,
        TG_ARGV[0],  -- entity_code
        COALESCE(NEW.id, OLD.id),
        v_action,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply to each entity table
CREATE TRIGGER log_project_changes
    AFTER INSERT OR UPDATE OR DELETE ON app.project
    FOR EACH ROW EXECUTE FUNCTION app.log_entity_change('project');
```

---

## 8. Code Implementation

### 8.1 SyncProvider (Frontend)

**Location**: `apps/web/src/db/sync/SyncProvider.tsx`

```typescript
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

type SyncStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface SyncContextValue {
  status: SyncStatus;
  subscribe: (entityCode: string, entityIds: string[]) => void;
  unsubscribe: (entityCode: string, entityIds?: string[]) => void;
  unsubscribeAll: () => void;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<SyncStatus>('disconnected');
  const processedVersions = useRef(new Map<string, number>());
  const pendingSubscriptions = useRef(new Map<string, Set<string>>());

  // Handle INVALIDATE message
  const handleInvalidate = useCallback((payload: InvalidateMessage['payload']) => {
    for (const change of payload.changes) {
      const key = `${payload.entityCode}:${change.entityId}`;
      const lastVersion = processedVersions.current.get(key) || 0;

      // Skip stale updates
      if (change.version <= lastVersion) continue;
      processedVersions.current.set(key, change.version);

      // Invalidate React Query cache
      queryClient.invalidateQueries({
        queryKey: ['entity-instance', payload.entityCode, change.entityId],
      });
      queryClient.invalidateQueries({
        queryKey: ['entity-instance-list', payload.entityCode],
        exact: false,
      });
    }
  }, [queryClient]);

  // ... connection logic, subscribe/unsubscribe methods

  return (
    <SyncContext.Provider value={{ status, subscribe, unsubscribe, unsubscribeAll }}>
      {children}
    </SyncContext.Provider>
  );
}

// REQUIRED - throws if not in SyncProvider
export function useSync(): SyncContextValue {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within SyncProvider');
  }
  return context;
}
```

### 8.2 useAutoSubscribe Hook

**Location**: `apps/web/src/db/sync/useAutoSubscribe.ts`

```typescript
import { useEffect, useRef } from 'react';
import { useSync } from './SyncProvider';

export function useAutoSubscribe(entityCode: string, entityIds: string[]) {
  const { subscribe, unsubscribe } = useSync();
  const previousIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentIds = new Set(entityIds);
    const previousIds = previousIdsRef.current;

    // Subscribe to new IDs
    const newIds = entityIds.filter(id => !previousIds.has(id));
    if (newIds.length > 0) {
      subscribe(entityCode, newIds);
    }

    // Unsubscribe from removed IDs
    const removedIds = [...previousIds].filter(id => !currentIds.has(id));
    if (removedIds.length > 0) {
      unsubscribe(entityCode, removedIds);
    }

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

### 8.3 Integration with useEntityQuery

**Location**: `apps/web/src/lib/hooks/useEntityQuery.ts`

```typescript
import { useAutoSubscribe, useAutoSubscribeSingle } from '../../db/sync';

export function useEntityInstanceList(entityCode: string, params: QueryParams) {
  const query = useQuery({
    queryKey: ['entity-instance-list', entityCode, params],
    queryFn: () => api.get(`/api/v1/${entityCode}`, { params }),
  });

  // Auto-subscribe to all loaded entity IDs
  const entityIds = useMemo(
    () => query.data?.data?.map((item: { id: string }) => item.id) ?? [],
    [query.data?.data]
  );
  useAutoSubscribe(entityCode, entityIds);

  return query;
}

export function useEntityInstance(entityCode: string, id: string) {
  const query = useQuery({
    queryKey: ['entity-instance', entityCode, id],
    queryFn: () => api.get(`/api/v1/${entityCode}/${id}`),
    enabled: !!id,
  });

  // Auto-subscribe to this single entity
  useAutoSubscribeSingle(entityCode, id);

  return query;
}
```

---

## 9. Sample Payloads

### 9.1 WebSocket Connection

**URL**: `ws://localhost:4001?token=<JWT>`

### 9.2 SUBSCRIBE Request

```json
{
  "type": "SUBSCRIBE",
  "payload": {
    "entityCode": "project",
    "entityIds": [
      "550e8400-e29b-41d4-a716-446655440001",
      "550e8400-e29b-41d4-a716-446655440002",
      "550e8400-e29b-41d4-a716-446655440003"
    ]
  }
}
```

### 9.3 SUBSCRIBED Response

```json
{
  "type": "SUBSCRIBED",
  "payload": {
    "count": 3
  }
}
```

### 9.4 INVALIDATE Message

```json
{
  "type": "INVALIDATE",
  "payload": {
    "entityCode": "project",
    "changes": [
      {
        "entityId": "550e8400-e29b-41d4-a716-446655440001",
        "action": "UPDATE",
        "version": 42
      }
    ],
    "timestamp": "2025-11-27T10:30:00.000Z"
  }
}
```

### 9.5 UNSUBSCRIBE Request

```json
{
  "type": "UNSUBSCRIBE",
  "payload": {
    "entityCode": "project",
    "entityIds": ["550e8400-e29b-41d4-a716-446655440001"]
  }
}
```

### 9.6 PING/PONG Heartbeat

```json
// Client sends
{ "type": "PING" }

// Server responds
{ "type": "PONG" }
```

### 9.7 TOKEN_EXPIRING_SOON Warning

```json
{
  "type": "TOKEN_EXPIRING_SOON",
  "payload": {
    "expiresIn": 300
  }
}
```

### 9.8 TOKEN_REFRESH Request

```json
{
  "type": "TOKEN_REFRESH",
  "payload": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 9.9 ERROR Response

```json
{
  "type": "ERROR",
  "payload": {
    "message": "Invalid token",
    "code": "AUTH_FAILED"
  }
}
```

---

## 10. Deployment

### 10.1 Environment Variables

```bash
# apps/pubsub/.env
DATABASE_URL=postgresql://app:app@localhost:5434/app  # Same as REST API
JWT_SECRET=your-jwt-secret-here                       # Same as REST API
PUBSUB_PORT=4001

# apps/web/.env
VITE_WS_URL=ws://localhost:4001        # Development
VITE_WS_URL=wss://pubsub.yourapp.com   # Production
```

### 10.2 Starting Services

```bash
# Start REST API (existing)
pnpm --filter @pmo/api dev

# Start PubSub Service
pnpm --filter @pmo/pubsub dev

# Or with Docker Compose
docker-compose up -d api pubsub
```

### 10.3 Infrastructure Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    EC2 Instance                          │
│                                                          │
│   ┌─────────────────┐    ┌─────────────────┐            │
│   │   REST API      │    │  PubSub Service │            │
│   │   (Port 4000)   │    │   (Port 4001)   │            │
│   └────────┬────────┘    └────────┬────────┘            │
│            │                      │                      │
│            └──────────┬───────────┘                      │
│                       ▼                                  │
│            ┌─────────────────┐                           │
│            │   PostgreSQL    │                           │
│            │   (Port 5432)   │                           │
│            └─────────────────┘                           │
└─────────────────────────────────────────────────────────┘
```

### 10.4 Health Check

```bash
# PubSub health endpoint
curl http://localhost:4001/health

# Response
{
  "status": "ok",
  "connections": {
    "connections": 42,
    "users": 35
  }
}
```

---

## Related Documents

| Document | Purpose |
|----------|---------|
| `STATE_MANAGEMENT.md` | React Query + Zustand architecture |
| `CLAUDE.md` | Main codebase reference |
| `README.md` | Caching overview |

---

**Version**: 3.0 | **Updated**: 2025-11-27 | **Status**: Implemented
