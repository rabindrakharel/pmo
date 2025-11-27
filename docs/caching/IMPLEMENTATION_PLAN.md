# RxDB Real-Time Sync - Implementation Plan

> Complete implementation plan for local-first RxDB with client-side subscription sync

**Version**: 1.0
**Date**: 2025-11-27
**Estimated Duration**: 6-8 weeks

---

## Executive Summary

This plan implements a local-first architecture using RxDB for client-side storage with real-time sync via WebSocket invalidation signals. Clients subscribe to specific entities they have locally; when those entities change, the server pushes invalidation signals, and clients refetch via REST API.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SYSTEM OVERVIEW                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                          FRONTEND                                    │   │
│   │                                                                      │   │
│   │   ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │   │
│   │   │    RxDB      │    │   Sync       │    │   React Components   │  │   │
│   │   │  (IndexedDB) │◄──►│   Provider   │◄──►│   (Auto-subscribe)   │  │   │
│   │   └──────────────┘    └──────┬───────┘    └──────────────────────┘  │   │
│   │                              │                                       │   │
│   └──────────────────────────────┼───────────────────────────────────────┘   │
│                                  │ WebSocket                                 │
│                                  │ + REST API                                │
│   ┌──────────────────────────────┼───────────────────────────────────────┐   │
│   │                          BACKEND                                     │   │
│   │                              │                                       │   │
│   │   ┌──────────────┐    ┌─────────────────────────────────────────┐  │   │
│   │   │  REST API    │    │              PubSub Service              │  │   │
│   │   │  (Fastify)   │    │  ┌─────────────┐  ┌──────────────────┐   │  │   │
│   │   └──────┬───────┘    │  │  WebSocket  │  │   Log Watcher    │   │  │   │
│   │          │            │  │  Handler    │  │   (60s poll)     │   │  │   │
│   │          │            │  └──────┬──────┘  └────────┬─────────┘   │  │   │
│   │          │            │         │ Subscriptions    │ Changes     │  │   │
│   │          │            └─────────┼──────────────────┼─────────────┘  │   │
│   │          │                      │                  │                │   │
│   └──────────┼──────────────────────┼──────────────────┼────────────────┘   │
│              │                      │                  │                     │
│   ┌──────────▼───────────────────────────────────────────▼──────────────┐   │
│   │                         POSTGRESQL                                   │   │
│   │                                                                      │   │
│   │   app.project    app.logging    app.rxdb_subscription               │   │
│   │   app.task       (changes)      (live subscriptions)                │   │
│   │   app.employee                                                       │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         IMPLEMENTATION TIMELINE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Phase 1: Database Schema (Week 1)                                         │
│   ████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░     │
│                                                                              │
│   Phase 2: Backend Services (Weeks 2-3)                                     │
│   ░░░░░░░░░░░░░░░░████████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░     │
│                                                                              │
│   Phase 3: Frontend RxDB (Weeks 3-5)                                        │
│   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░████████████████████████████████░░░░░░░░     │
│                                                                              │
│   Phase 4: Integration & Testing (Weeks 5-6)                                │
│   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░████████████████████     │
│                                                                              │
│   Week:  1    2    3    4    5    6    7    8                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Database Schema (Week 1)

### Objectives
- Create logging table with sync status tracking
- Create subscription table for live connections
- Add triggers for automatic change logging

### Tasks

| Task | File | Priority | Est. Hours |
|------|------|----------|------------|
| 1.1 Create logging table | `db/XXXV_logging.ddl` | High | 2 |
| 1.2 Create subscription table | `db/XXXVI_rxdb_subscription.ddl` | High | 2 |
| 1.3 Create logging triggers | `db/triggers/entity_logging.sql` | High | 4 |
| 1.4 Run db-import, verify | - | High | 1 |
| 1.5 Write migration script | `db/migrations/` | Medium | 2 |

### Deliverables

#### 1.1 Logging Table (`db/XXXV_logging.ddl`)

```sql
CREATE TABLE app.logging (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Actor
    person_id UUID,
    fname VARCHAR(100),
    lname VARCHAR(100),
    username VARCHAR(255),
    person_type VARCHAR(50),

    -- Request
    api_endpoint VARCHAR(500),
    http_method VARCHAR(10),

    -- Target (required)
    entity_code VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    action SMALLINT NOT NULL CHECK (action BETWEEN 0 AND 5),

    -- State snapshots
    entity_from_version JSONB,
    entity_to_version JSONB,

    -- Security
    user_agent TEXT,
    ip INET,

    -- Timestamps
    created_ts TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Sync tracking
    sync_status VARCHAR(20) DEFAULT 'pending',
    sync_processed_ts TIMESTAMPTZ
);

CREATE INDEX idx_logging_sync_pending
    ON app.logging(created_ts)
    WHERE sync_status = 'pending' AND action != 0;
```

#### 1.2 Subscription Table (`db/XXXVI_rxdb_subscription.ddl`)

```sql
CREATE TABLE app.rxdb_subscription (
    user_id UUID NOT NULL,
    entity_code VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    connection_id VARCHAR(50) NOT NULL,
    subscribed_at TIMESTAMPTZ DEFAULT now(),

    PRIMARY KEY (user_id, entity_code, entity_id)
);

CREATE INDEX idx_rxdb_sub_entity ON app.rxdb_subscription(entity_code, entity_id);
CREATE INDEX idx_rxdb_sub_connection ON app.rxdb_subscription(connection_id);
```

#### 1.3 Entity Change Triggers

```sql
-- Apply to each entity table
CREATE TRIGGER log_project_changes
    AFTER INSERT OR UPDATE OR DELETE ON app.project
    FOR EACH ROW EXECUTE FUNCTION app.log_entity_change('project');

CREATE TRIGGER log_task_changes
    AFTER INSERT OR UPDATE OR DELETE ON app.task
    FOR EACH ROW EXECUTE FUNCTION app.log_entity_change('task');

-- ... repeat for all 27+ entities
```

### Verification

```bash
# Import schema
./tools/db-import.sh

# Verify tables exist
psql -c "SELECT * FROM app.logging LIMIT 1;"
psql -c "SELECT * FROM app.rxdb_subscription LIMIT 1;"

# Test trigger
./tools/test-api.sh PATCH /api/v1/project/{id} '{"name": "Test"}'
psql -c "SELECT * FROM app.logging WHERE entity_code = 'project' ORDER BY created_ts DESC LIMIT 1;"
```

---

## Phase 2: Backend PubSub Service (Weeks 2-3)

### Objectives
- Implement unified PubSub Service that:
  - Manages WebSocket connections for real-time communication
  - Tracks subscriptions in `app.rxdb_subscription` table
  - Polls `app.logging` table for changes (LogWatcher)
  - Pushes INVALIDATE signals to subscribed clients
- Integrate with existing JWT auth

### File Structure

```
apps/api/src/
├── services/
│   └── pubsub/                        # NEW: PubSub Service module
│       ├── index.ts                   # Service exports
│       ├── pubsub.service.ts          # Main PubSub service orchestrator
│       ├── websocket.plugin.ts        # Fastify WebSocket plugin
│       ├── connection-manager.ts      # Track WS connections
│       ├── subscription-manager.ts    # DB subscription ops
│       ├── log-watcher.ts             # Poll & notify
│       └── types.ts                   # Type definitions
└── index.ts                           # MODIFY: Register pubsub plugin
```

### Tasks

| Task | File | Priority | Est. Hours |
|------|------|----------|------------|
| 2.1 Add dependencies | `package.json` | High | 0.5 |
| 2.2 Create types | `services/pubsub/types.ts` | High | 1 |
| 2.3 Connection manager | `services/pubsub/connection-manager.ts` | High | 3 |
| 2.4 Subscription manager | `services/pubsub/subscription-manager.ts` | High | 4 |
| 2.5 Log watcher | `services/pubsub/log-watcher.ts` | High | 6 |
| 2.6 WebSocket plugin | `services/pubsub/websocket.plugin.ts` | High | 4 |
| 2.7 PubSub service orchestrator | `services/pubsub/pubsub.service.ts` | High | 3 |
| 2.8 Register pubsub plugin | `index.ts` | High | 1 |
| 2.9 Unit tests | `services/pubsub/__tests__/` | Medium | 4 |

### Deliverables

#### 2.1 Dependencies

```bash
pnpm add @fastify/websocket ws
pnpm add -D @types/ws
```

#### 2.2 Types (`services/pubsub/types.ts`)

```typescript
// Client → Server
export interface SubscribeMessage {
  type: 'SUBSCRIBE';
  payload: { entityCode: string; entityIds: string[] };
}

export interface UnsubscribeMessage {
  type: 'UNSUBSCRIBE';
  payload: { entityCode: string; entityIds?: string[] };
}

export type ClientMessage =
  | SubscribeMessage
  | UnsubscribeMessage
  | { type: 'UNSUBSCRIBE_ALL' }
  | { type: 'PING' };

// Server → Client
export interface InvalidateMessage {
  type: 'INVALIDATE';
  payload: {
    entityCode: string;
    changes: Array<{ entityId: string; action: 'CREATE' | 'UPDATE' | 'DELETE' }>;
    timestamp: string;
  };
}
```

#### 2.3 Connection Manager

```typescript
// services/pubsub/connection-manager.ts
export class ConnectionManager {
  private connections = new Map<string, WebSocket>();      // connId → socket
  private userConnections = new Map<string, string>();     // userId → connId

  connect(userId: string, socket: WebSocket): string;
  disconnect(connectionId: string): void;
  getSocket(connectionId: string): WebSocket | undefined;
  getSocketByUserId(userId: string): WebSocket | undefined;
  broadcast(connectionIds: string[], message: object): void;
}
```

#### 2.4 Subscription Manager

```typescript
// services/pubsub/subscription-manager.ts
export class SubscriptionManager {
  async subscribe(userId: string, connectionId: string, entityCode: string, entityIds: string[]): Promise<number>;
  async unsubscribe(userId: string, entityCode: string, entityIds?: string[]): Promise<number>;
  async cleanupConnection(connectionId: string): Promise<number>;
  async getBatchSubscribers(entityCode: string, entityIds: string[]): Promise<Subscriber[]>;
}
```

#### 2.5 Log Watcher

```typescript
// services/pubsub/log-watcher.ts
const POLL_INTERVAL = 60_000; // 60 seconds

export class LogWatcher {
  private intervalId: NodeJS.Timeout | null = null;

  start(): void;
  stop(): void;

  private async pollAndNotify(): Promise<void> {
    // 1. SELECT pending from app.logging WHERE sync_status = 'pending'
    // 2. Group by entity_code
    // 3. Query app.rxdb_subscription for subscribers
    // 4. Push INVALIDATE via ConnectionManager.broadcast()
    // 5. UPDATE app.logging SET sync_status = 'sent'
  }
}
```

#### 2.6 WebSocket Plugin

```typescript
// services/pubsub/websocket.plugin.ts
export async function websocketPlugin(fastify: FastifyInstance) {
  await fastify.register(fastifyWebsocket);

  fastify.get('/ws/sync', { websocket: true }, (socket, request) => {
    // Auth check via JWT
    // Register connection with ConnectionManager
    // Handle SUBSCRIBE/UNSUBSCRIBE messages via SubscriptionManager
    // Cleanup on disconnect
  });
}
```

#### 2.7 PubSub Service (Orchestrator)

```typescript
// services/pubsub/pubsub.service.ts
export class PubSubService {
  private connectionManager: ConnectionManager;
  private subscriptionManager: SubscriptionManager;
  private logWatcher: LogWatcher;

  constructor(db: Database) {
    this.connectionManager = new ConnectionManager();
    this.subscriptionManager = new SubscriptionManager(db);
    this.logWatcher = new LogWatcher(db, this.connectionManager, this.subscriptionManager);
  }

  start(): void { this.logWatcher.start(); }
  stop(): void { this.logWatcher.stop(); }

  // Expose for WebSocket plugin
  get connections() { return this.connectionManager; }
  get subscriptions() { return this.subscriptionManager; }
}

// Singleton instance
let pubsubService: PubSubService | null = null;
export function getPubSubService(db?: Database): PubSubService;
```

### Verification

```bash
# Start server
pnpm dev:api

# Test WebSocket connection
wscat -c "ws://localhost:4000/ws/sync?token=JWT_HERE"

# Send subscribe
> {"type":"SUBSCRIBE","payload":{"entityCode":"project","entityIds":["uuid-1"]}}

# Check database
psql -c "SELECT * FROM app.rxdb_subscription;"

# Trigger a change and watch for INVALIDATE message
./tools/test-api.sh PATCH /api/v1/project/uuid-1 '{"name":"Test"}'
```

---

## Phase 3: Frontend RxDB (Weeks 3-5)

### Objectives
- Complete RxDB migration (infrastructure already exists)
- Add SyncProvider for WebSocket management
- Implement auto-subscription on data load
- Update hooks to use RxDB + sync

### File Structure

```
apps/web/src/
├── db/
│   ├── index.ts                     # EXISTS: Database init
│   ├── DatabaseProvider.tsx         # EXISTS: React provider
│   ├── sync/                        # NEW: Sync module
│   │   ├── index.ts
│   │   ├── SyncProvider.tsx         # WebSocket + subscription context
│   │   ├── useAutoSubscribe.ts      # Auto-subscribe hook
│   │   └── useSyncStatus.ts         # Connection status hook
│   ├── hooks/
│   │   ├── useEntityQuery.ts        # MODIFY: Add auto-subscribe
│   │   └── ...
│   └── schemas/
│       └── ...                      # EXISTS: Entity schemas
└── App.tsx                          # MODIFY: Add SyncProvider
```

### Tasks

| Task | File | Priority | Est. Hours |
|------|------|----------|------------|
| 3.1 Create SyncProvider | `db/sync/SyncProvider.tsx` | High | 6 |
| 3.2 Create useAutoSubscribe | `db/sync/useAutoSubscribe.ts` | High | 3 |
| 3.3 Create useSyncStatus | `db/sync/useSyncStatus.ts` | Medium | 1 |
| 3.4 Update useEntityQuery | `db/hooks/useEntityQuery.ts` | High | 4 |
| 3.5 Add SyncProvider to App | `App.tsx` | High | 1 |
| 3.6 Add sync status UI | `components/SyncStatusIndicator.tsx` | Low | 2 |
| 3.7 Handle offline mode | `db/sync/offlineHandler.ts` | Medium | 3 |
| 3.8 Complete RxDB hooks | `db/hooks/*.ts` | High | 8 |
| 3.9 Remove old stores | `stores/` | Medium | 2 |

### Deliverables

#### 3.1 SyncProvider

```typescript
// db/sync/SyncProvider.tsx
export function SyncProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);

  // Connect on auth
  // Handle messages (INVALIDATE → refetch from API → update RxDB)
  // Auto-reconnect with exponential backoff
  // Subscribe/unsubscribe methods

  return (
    <SyncContext.Provider value={{ status, subscribe, unsubscribe }}>
      {children}
    </SyncContext.Provider>
  );
}
```

#### 3.2 useAutoSubscribe

```typescript
// db/sync/useAutoSubscribe.ts
export function useAutoSubscribe(entityCode: string, entityIds: string[]) {
  const { subscribe, unsubscribe } = useSync();
  const previousIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Diff current vs previous
    // Subscribe to new IDs
    // Unsubscribe from removed IDs
    // Cleanup on unmount
  }, [entityCode, entityIds]);
}
```

#### 3.3 Updated useEntityQuery

```typescript
// db/hooks/useEntityQuery.ts
export function useEntityList(entityCode: string, params: QueryParams) {
  const { data, isLoading, ... } = useRxQuery(entityCode, params);

  // Auto-subscribe to loaded entities
  useAutoSubscribe(entityCode, data?.map(d => d.id) || []);

  return { data, isLoading, ... };
}
```

#### 3.4 App Integration

```typescript
// App.tsx
import { SyncProvider } from '@/db/sync/SyncProvider';

function App() {
  return (
    <AuthProvider>
      <DatabaseProvider>
        <SyncProvider>
          <Router>...</Router>
          <SyncStatusIndicator />
        </SyncProvider>
      </DatabaseProvider>
    </AuthProvider>
  );
}
```

### Verification

```bash
# Start frontend
pnpm dev:web

# Open browser console, check for:
# [Sync] Connected
# [Sync] Subscribed: project (50)

# In another tab, edit a project
# Watch for:
# [Sync] INVALIDATE: project (1 changes)
# [Sync] Refetched project/uuid-123

# Check first tab updates automatically
```

---

## Phase 4: Integration & Testing (Weeks 5-6)

### Objectives
- End-to-end testing of complete flow
- Performance testing
- Error handling and edge cases
- Documentation

### Tasks

| Task | Priority | Est. Hours |
|------|----------|------------|
| 4.1 E2E test: subscribe/unsubscribe | High | 4 |
| 4.2 E2E test: change detection | High | 4 |
| 4.3 E2E test: multi-user scenario | High | 4 |
| 4.4 Test: offline → online sync | High | 3 |
| 4.5 Test: reconnection handling | Medium | 2 |
| 4.6 Test: subscription limits | Medium | 2 |
| 4.7 Performance: 1000 subscriptions | Medium | 3 |
| 4.8 Performance: 100 concurrent users | Medium | 4 |
| 4.9 Load test: LogWatcher throughput | Medium | 3 |
| 4.10 Documentation updates | Medium | 4 |
| 4.11 CLAUDE.md updates | Medium | 2 |

### Test Scenarios

#### 4.1 Subscribe/Unsubscribe Flow

```typescript
// Test script
async function testSubscribeFlow() {
  // 1. Connect WebSocket
  const ws = new WebSocket('ws://localhost:4000/ws/sync?token=...');

  // 2. Subscribe to 50 projects
  ws.send(JSON.stringify({
    type: 'SUBSCRIBE',
    payload: { entityCode: 'project', entityIds: [...50 uuids] }
  }));

  // 3. Verify database
  const subs = await db.query('SELECT COUNT(*) FROM app.rxdb_subscription');
  assert(subs.count === 50);

  // 4. Unsubscribe
  ws.send(JSON.stringify({ type: 'UNSUBSCRIBE_ALL' }));

  // 5. Verify cleanup
  const afterSubs = await db.query('SELECT COUNT(*) FROM app.rxdb_subscription');
  assert(afterSubs.count === 0);
}
```

#### 4.2 Change Detection Flow

```typescript
async function testChangeDetection() {
  // 1. User A subscribes to project-123
  wsA.send({ type: 'SUBSCRIBE', payload: { entityCode: 'project', entityIds: ['uuid-123'] }});

  // 2. User B edits project-123
  await fetch('/api/v1/project/uuid-123', {
    method: 'PATCH',
    body: JSON.stringify({ name: 'Updated' })
  });

  // 3. Wait for LogWatcher poll (or force poll)
  await forceLogWatcherPoll();

  // 4. Verify User A received INVALIDATE
  const message = await waitForMessage(wsA, 'INVALIDATE');
  assert(message.payload.entityCode === 'project');
  assert(message.payload.changes[0].entityId === 'uuid-123');
}
```

#### 4.3 Multi-User Scenario

```typescript
async function testMultiUser() {
  // Setup: 3 users, each subscribes to different projects
  // User A: [p1, p2, p3]
  // User B: [p2, p3, p4]
  // User C: [p3, p4, p5]

  // Edit p3 (all 3 should get notified)
  await editProject('p3');
  await forceLogWatcherPoll();

  // Verify: All 3 users received INVALIDATE for p3
  assert(await receivedInvalidate(wsA, 'p3'));
  assert(await receivedInvalidate(wsB, 'p3'));
  assert(await receivedInvalidate(wsC, 'p3'));

  // Edit p1 (only User A should get notified)
  await editProject('p1');
  await forceLogWatcherPoll();

  assert(await receivedInvalidate(wsA, 'p1'));
  assert(!(await receivedInvalidate(wsB, 'p1', 1000)));
  assert(!(await receivedInvalidate(wsC, 'p1', 1000)));
}
```

---

## Complete File Inventory

### New Files (Backend - PubSub Service)

| File | Lines | Description |
|------|-------|-------------|
| `services/pubsub/index.ts` | ~20 | Module exports |
| `services/pubsub/pubsub.service.ts` | ~80 | Main orchestrator |
| `services/pubsub/websocket.plugin.ts` | ~100 | Fastify WebSocket plugin |
| `services/pubsub/connection-manager.ts` | ~80 | Track live WS connections |
| `services/pubsub/subscription-manager.ts` | ~100 | Database subscription ops |
| `services/pubsub/log-watcher.ts` | ~120 | Poll logs & push invalidations |
| `services/pubsub/types.ts` | ~50 | TypeScript types |
| **Total Backend** | **~550** | |

### New Files (Frontend)

| File | Lines | Description |
|------|-------|-------------|
| `db/sync/SyncProvider.tsx` | ~200 | WebSocket context |
| `db/sync/useAutoSubscribe.ts` | ~60 | Auto-subscription hook |
| `db/sync/useSyncStatus.ts` | ~20 | Status hook |
| `db/sync/index.ts` | ~10 | Barrel export |
| `components/SyncStatusIndicator.tsx` | ~30 | UI indicator |
| **Total Frontend** | **~320** | |

### New Files (Database)

| File | Lines | Description |
|------|-------|-------------|
| `db/XXXV_logging.ddl` | ~80 | Logging table |
| `db/XXXVI_rxdb_subscription.ddl` | ~120 | Subscription table |
| `db/triggers/entity_logging.sql` | ~60 | Change triggers |
| **Total Database** | **~260** | |

### Modified Files

| File | Changes |
|------|---------|
| `apps/api/src/index.ts` | Register PubSub service & WebSocket plugin |
| `apps/api/package.json` | Add @fastify/websocket, ws |
| `apps/web/src/App.tsx` | Add SyncProvider |
| `apps/web/src/db/hooks/useEntityQuery.ts` | Add auto-subscribe |

---

## Deployment Checklist

### Pre-Deployment

- [ ] Run database migrations
- [ ] Verify triggers are active on all entity tables
- [ ] Test WebSocket connection in staging
- [ ] Load test with expected concurrent users
- [ ] Update environment variables

### Environment Variables

```bash
# Backend (no new vars needed - uses existing DB and auth)

# Frontend
VITE_WS_URL=wss://api.yourapp.com/ws/sync
```

### Infrastructure

```
For <1000 users:
  - Single EC2 instance (existing)
  - No additional infrastructure needed

For 1000-10000 users:
  - ALB with sticky sessions (WebSocket affinity)
  - Multiple API pods (database handles subscription sync)
```

---

## Rollback Plan

### If Issues Occur

1. **Disable PubSub Service**
   ```typescript
   // Comment out in index.ts
   // import { pubsubPlugin } from '@/services/pubsub';
   // await fastify.register(pubsubPlugin);
   ```

2. **Frontend graceful degradation**
   - SyncProvider falls back to disconnected state
   - REST replication continues working
   - Users just don't get real-time updates

3. **Database cleanup**
   ```sql
   TRUNCATE app.rxdb_subscription;
   UPDATE app.logging SET sync_status = 'pending' WHERE sync_status = 'processing';
   ```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| WebSocket connection success rate | >99% |
| INVALIDATE delivery latency | <2s from change |
| Subscription cleanup on disconnect | 100% |
| Log processing throughput | >1000/minute |
| Client resubscription on reconnect | 100% |

---

## Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| **Phase 1** | Week 1 | Database tables (logging, subscription), triggers |
| **Phase 2** | Weeks 2-3 | PubSub Service (WebSocket, LogWatcher, SubscriptionManager) |
| **Phase 3** | Weeks 3-5 | Frontend sync (SyncProvider, auto-subscribe hooks) |
| **Phase 4** | Weeks 5-6 | Integration testing, documentation |
| **Total** | **6 weeks** | **~1130 lines of new code** |

### Dependencies

```
Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4
  │           │           │
  └───────────┴───────────┴── Can be parallelized partially
```

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| WebSocket complexity | REST fallback always works |
| Database subscription load | Indexes + cleanup functions |
| LogWatcher bottleneck | Batch processing, skip processing |
| Memory pressure | Database-backed (not in-memory) |
