# State Management Architecture

**Version:** 8.5.0 | **Location:** `apps/web/src/db/rxdb/` | **Updated:** 2025-11-27

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STATE MANAGEMENT (v8.5.0)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐   │
│  │  RxDB - Offline-First Data Cache + Real-Time Sync                     │   │
│  │  ─────────────────────────────────────────────────────────────────    │   │
│  │  • Stores RAW entity data in IndexedDB (persistent)                   │   │
│  │  • Survives page refresh and browser restart                          │   │
│  │  • Multi-tab sync via LeaderElection                                  │   │
│  │  • Reactive queries auto-update on data changes                       │   │
│  │  • ref_data_entityInstance lookup tables for entity references        │   │
│  │  • WebSocket replication for real-time sync                           │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐   │
│  │  DRAFT PERSISTENCE - Survives Page Refresh!                           │   │
│  │  ─────────────────────────────────────────────────────────────────    │   │
│  │  • Unsaved edits stored in RxDB drafts collection                     │   │
│  │  • Undo/redo stacks persisted                                         │   │
│  │  • Auto-recovery on page reload                                       │   │
│  │  • Field-level dirty tracking                                         │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐   │
│  │  ReplicationManager - WebSocket Real-Time Sync                        │   │
│  │  ─────────────────────────────────────────────────────────────────    │   │
│  │  • Connects to PubSub service (port 4001)                             │   │
│  │  • Auto-subscribe to loaded entity IDs                                │   │
│  │  • INVALIDATE → fetchEntity() → RxDB upsert → reactive update         │   │
│  │  • Automatic reconnection with exponential backoff                    │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  BENEFITS:                                                                   │
│  ✓ OFFLINE-FIRST: Works without network connection                          │
│  ✓ PERSISTENT: Data survives browser restart (IndexedDB)                    │
│  ✓ MULTI-TAB: Changes sync across browser tabs automatically                │
│  ✓ DRAFT PERSISTENCE: Unsaved edits survive page refresh!                   │
│  ✓ REACTIVE: Queries auto-update when data changes                          │
│  ✓ REAL-TIME: WebSocket push for instant updates from other users           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## End-to-End Data Request Flow

### 1. Initial Page Load (Cold Start)

```
User → RxDB → API → PostgreSQL → RxDB → UI

User visits /project
        │
        ▼
┌──────────────────┐
│ ProjectListPage  │
│                  │
│ useRxEntityList('project')
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ useRxEntityList Hook (db/rxdb/hooks/useRxEntity.ts)                               │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  1. getDatabase() → RxDB (IndexedDB)                                             │
│                                                                                   │
│  2. db.entities.find({ entityCode: 'project' }).$ → Observable                   │
│     └── Subscribe to reactive query                                              │
│                                                                                   │
│  3. RxDB query result: [] (empty - first load)                                   │
│     └── isLoading = true                                                         │
│                                                                                   │
│  4. Trigger fetch from server:                                                   │
│     getReplicationManager().fetchEntityList('project', params)                   │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ReplicationManager.fetchEntityList()                                              │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  1. apiClient.get('/api/v1/project', { params })                                 │
│     ─────────────────────────────────────────────────────────────────────►       │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
         │
         │  HTTP GET /api/v1/project?limit=50
         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ Fastify API Server (Port 4000)                                                    │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  1. JWT Auth middleware → Extract userId                                         │
│                                                                                   │
│  2. RBAC Check:                                                                  │
│     entityInfra.get_entity_rbac_where_condition(userId, 'project', VIEW)         │
│                                                                                   │
│  3. Query PostgreSQL:                                                            │
│     SELECT * FROM app.project WHERE {rbacCondition} LIMIT 50                     │
│                                                                                   │
│  4. Build ref_data_entityInstance:                                               │
│     entityInfra.build_ref_data_entityInstance(data, 'project')                   │
│     → { employee: { "uuid-1": "James Miller" } }                                 │
│                                                                                   │
│  5. Generate metadata:                                                           │
│     getEntityMetadata('project', data[0])                                        │
│     → { viewType: {...}, editType: {...} }                                       │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
         │
         │  HTTP 200 Response
         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ API Response                                                                      │
├──────────────────────────────────────────────────────────────────────────────────┤
│  {                                                                                │
│    "data": [                                                                      │
│      { "id": "uuid-1", "name": "Kitchen Renovation", "budget_allocated_amt": 50000 }
│    ],                                                                             │
│    "ref_data_entityInstance": {                                                  │
│      "employee": { "uuid-james": "James Miller" }                                │
│    },                                                                             │
│    "metadata": {                                                                  │
│      "entityDataTable": {                                                        │
│        "viewType": { "budget_allocated_amt": { "renderType": "currency" } },     │
│        "editType": { ... }                                                       │
│      }                                                                            │
│    },                                                                             │
│    "total": 25, "limit": 50, "offset": 0                                         │
│  }                                                                                │
└──────────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ReplicationManager.fetchEntityList() (continued)                                  │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  2. For each entity in response.data:                                            │
│     ┌─────────────────────────────────────────────────────────────────────────┐  │
│     │ const doc = {                                                            │  │
│     │   _id: 'project:uuid-1',           // Composite key                      │  │
│     │   entityCode: 'project',                                                 │  │
│     │   id: 'uuid-1',                                                          │  │
│     │   data: { name: 'Kitchen...', budget_allocated_amt: 50000 },             │  │
│     │   refData: { employee: { 'uuid-james': 'James Miller' } },               │  │
│     │   metadata: { viewType: {...}, editType: {...} },                        │  │
│     │   _version: 1,                                                           │  │
│     │   _syncedAt: 1732789200000,        // Date.now()                         │  │
│     │   _deleted: false                                                        │  │
│     │ };                                                                       │  │
│     │                                                                          │  │
│     │ await db.entities.upsert(doc);     // Store in IndexedDB                │  │
│     └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                   │
│  3. Auto-subscribe to WebSocket updates:                                         │
│     this.subscribe('project', ['uuid-1', 'uuid-2', ...])                         │
│     ─────────────────────────────────────────────────────────────────────►       │
│     WebSocket: { type: 'SUBSCRIBE', payload: { entityCode, entityIds } }         │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ RxDB Reactive Query Update                                                        │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  db.entities.find({ entityCode: 'project' }).$ emits new value!                  │
│                                                                                   │
│  useRxEntityList receives:                                                       │
│  └── docs = [RxDocument, RxDocument, ...]                                        │
│  └── setDocs(docs)                                                               │
│  └── setIsLoading(false)                                                         │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────┐
│ Component        │
│ re-renders with  │
│ data: [...]      │
│ isLoading: false │
└──────────────────┘
```

### 2. Subsequent Load (Warm Cache - Instant!)

```
User → RxDB (IndexedDB) → UI (instant)

User navigates back to /project (or refreshes page!)
        │
        ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ RxDB Query (IndexedDB)                                                            │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  db.entities.find({ entityCode: 'project' }).$                                   │
│                                                                                   │
│  IMMEDIATE result from IndexedDB:                                                │
│  └── docs = [{ id: 'uuid-1', data: {...} }, { id: 'uuid-2', ... }]              │
│  └── isLoading = false                                                           │
│                                                                                   │
│  Check staleness:                                                                │
│  └── isStale = (Date.now() - doc._syncedAt) > 30000                             │
│                                                                                   │
│  If stale → Background refresh (non-blocking)                                    │
│  └── getReplicationManager().fetchEntityList('project', params)                  │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────┐
│ UI renders       │
│ IMMEDIATELY      │ ◄─── No loading spinner! Data from IndexedDB
│ with cached data │     (survives page refresh!)
└──────────────────┘
```

### 3. Real-Time Update (WebSocket Push)

```
User B edits → PostgreSQL trigger → LogWatcher → WebSocket → User A's RxDB → UI

User B edits project (while User A is viewing)
        │
        ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ User B's Browser                                                                  │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  PATCH /api/v1/project/uuid-1                                                    │
│  Body: { "budget_allocated_amt": 75000 }                                         │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ Fastify API Server                                                                │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  1. RBAC Check (EDIT permission)                                                 │
│  2. UPDATE app.project SET budget_allocated_amt = 75000 WHERE id = 'uuid-1'      │
│                                                                                   │
│  3. Database TRIGGER fires:                                                      │
│     INSERT INTO app.logging (entity_code, entity_id, action, sync_status)        │
│     VALUES ('project', 'uuid-1', 1, 'pending')  -- action=1 is EDIT             │
│                                                                                   │
│  4. Return 200 OK to User B                                                      │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
         │
         │ (up to 60 seconds later)
         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ PubSub Service - LogWatcher (Port 4001)                                           │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  1. Poll app.logging (every 60s):                                                │
│     SELECT * FROM app.logging WHERE sync_status = 'pending'                      │
│     → Found: { entity_code: 'project', entity_id: 'uuid-1' }                     │
│                                                                                   │
│  2. Query subscribers:                                                           │
│     SELECT * FROM app.rxdb_subscription                                          │
│     WHERE entity_code = 'project' AND entity_id = 'uuid-1'                       │
│     → Found: User A (connection_id: 'conn-abc')                                  │
│                                                                                   │
│  3. Push INVALIDATE via WebSocket:                                               │
│     connectionManager.getSocket('conn-abc').send(...)                            │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
         │
         │  WebSocket message
         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ User A's Browser - ReplicationManager                                             │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  WebSocket receives:                                                             │
│  {                                                                                │
│    "type": "INVALIDATE",                                                         │
│    "payload": {                                                                   │
│      "entityCode": "project",                                                    │
│      "changes": [{ "entityId": "uuid-1", "action": "UPDATE", "version": 2 }]    │
│    }                                                                              │
│  }                                                                                │
│                                                                                   │
│  handleInvalidate():                                                             │
│  1. Check version (skip if stale)                                                │
│  2. Re-fetch from server:                                                        │
│     await this.fetchEntity('project', 'uuid-1')                                  │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
         │
         │  GET /api/v1/project/uuid-1
         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ API Response (Fresh Data)                                                         │
├──────────────────────────────────────────────────────────────────────────────────┤
│  {                                                                                │
│    "data": {                                                                      │
│      "id": "uuid-1",                                                             │
│      "name": "Kitchen Renovation",                                               │
│      "budget_allocated_amt": 75000  ◄─── Updated value!                          │
│    },                                                                             │
│    ...                                                                            │
│  }                                                                                │
└──────────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ RxDB Update                                                                       │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  db.entities.upsert({                                                            │
│    _id: 'project:uuid-1',                                                        │
│    data: { budget_allocated_amt: 75000, ... },                                   │
│    _version: 2,                                                                  │
│    _syncedAt: Date.now()                                                         │
│  });                                                                              │
│                                                                                   │
│  Reactive query emits new value automatically!                                   │
│  └── db.entities.find({ entityCode: 'project' }).$ → new docs                   │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────┐
│ User A's UI      │
│ auto-updates!    │ ◄─── Budget now shows $75,000
│ No refresh needed│
└──────────────────┘
```

### 4. Draft Persistence (Edit Mode)

```
User edits → RxDB drafts collection → survives refresh!

User starts editing entity
        │
        ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ useRxDraft('project', 'uuid-1')                                                   │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  Creates draft in RxDB:                                                          │
│  {                                                                                │
│    _id: 'project:uuid-1',                                                        │
│    originalData: { name: 'Kitchen', budget: 50000 },  // Snapshot at edit start │
│    currentData: { name: 'Kitchen', budget: 50000 },   // Current values         │
│    dirtyFields: [],                                   // Modified fields         │
│    undoStack: [],                                     // For undo/redo          │
│    redoStack: [],                                                                │
│    createdAt: Date.now()                                                         │
│  }                                                                                │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
         │
         │  User changes budget to 75000
         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ draft.updateField('budget_allocated_amt', 75000)                                  │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  Update draft in RxDB (persisted to IndexedDB immediately!):                     │
│  {                                                                                │
│    currentData: { name: 'Kitchen', budget: 75000 },                              │
│    dirtyFields: ['budget_allocated_amt'],                                        │
│    undoStack: [{ field: 'budget_allocated_amt', oldValue: 50000 }],              │
│  }                                                                                │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
         │
         │  User refreshes page!
         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ useRecoverDraft() on page load                                                    │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  Query RxDB for existing draft:                                                  │
│  db.drafts.findOne('project:uuid-1').$                                           │
│                                                                                   │
│  Found draft! → Prompt user:                                                     │
│  "You have unsaved changes. Recover?"                                            │
│                                                                                   │
│  If recover → draft.currentData is restored                                      │
│  If discard → draft.discardDraft() deletes from RxDB                             │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
         │
         │  User clicks Save
         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ draft.getChanges() → PATCH only dirty fields                                      │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  Only sends changed fields:                                                      │
│  PATCH /api/v1/project/uuid-1                                                    │
│  Body: { "budget_allocated_amt": 75000 }  ◄── Only dirty field!                 │
│                                                                                   │
│  On success → draft.discardDraft()                                               │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              COMPLETE DATA FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
    │   User A    │         │   User B    │         │   User C    │
    │  (Browser)  │         │  (Browser)  │         │  (Browser)  │
    └──────┬──────┘         └──────┬──────┘         └──────┬──────┘
           │                       │                       │
    ┌──────▼──────┐         ┌──────▼──────┐         ┌──────▼──────┐
    │   RxDB      │         │   RxDB      │         │   RxDB      │
    │ (IndexedDB) │         │ (IndexedDB) │         │ (IndexedDB) │
    │             │         │             │         │             │
    │ • entities  │         │ • entities  │         │ • entities  │
    │ • drafts    │         │ • drafts    │         │ • drafts    │
    │ • metadata  │         │ • metadata  │         │ • metadata  │
    └──────┬──────┘         └──────┬──────┘         └──────┬──────┘
           │                       │                       │
           │ WebSocket             │ REST API              │ WebSocket
           │                       │                       │
           ▼                       ▼                       ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │                     PubSub Service (4001)                        │
    │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
    │  │ Connection  │    │ Subscription│    │ LogWatcher  │          │
    │  │ Manager     │◄──►│ Manager     │◄──►│ (60s poll)  │          │
    │  └─────────────┘    └─────────────┘    └──────┬──────┘          │
    └─────────────────────────────────────────────────┼────────────────┘
                                                      │
    ┌─────────────────────────────────────────────────┼────────────────┐
    │                      REST API (4000)            │                │
    │  ┌─────────────┐    ┌─────────────┐    ┌───────▼───────┐        │
    │  │ Auth        │───►│ RBAC Check  │───►│ Entity Routes │        │
    │  │ Middleware  │    │             │    │               │        │
    │  └─────────────┘    └─────────────┘    └───────┬───────┘        │
    └─────────────────────────────────────────────────┼────────────────┘
                                                      │
    ┌─────────────────────────────────────────────────▼────────────────┐
    │                        PostgreSQL                                 │
    │  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐   │
    │  │ app.project │    │ app.logging │    │ app.rxdb_subscription│   │
    │  │ app.task    │    │ (triggers)  │    │ (live subscriptions) │   │
    │  │ app.employee│    │             │    │                      │   │
    │  └─────────────┘    └─────────────┘    └─────────────────────┘   │
    └──────────────────────────────────────────────────────────────────┘
```

---

## Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Offline-First** | RxDB with IndexedDB storage (Dexie) |
| **Persistent Storage** | Data survives browser restart |
| **Multi-Tab Sync** | RxDB LeaderElection plugin |
| **Draft Persistence** | Unsaved edits in `drafts` collection |
| **Real-Time Sync** | WebSocket replication with PubSub service |
| **Reactive Queries** | RxDB observables auto-update UI |
| **Backend Metadata** | viewType/editType/lookupEntity from backend |

---

## RxDB Collections

| Collection | Purpose | Schema |
|------------|---------|--------|
| `entities` | Entity instances (all types) | `{ entityCode, id, data, refData, metadata, _version }` |
| `drafts` | Unsaved edits | `{ entityCode, entityId, originalData, currentData, dirtyFields }` |
| `metadata` | Cached settings | `{ type, key, data, cachedAt, ttl }` |

---

## File Structure

```
apps/web/src/db/rxdb/
├── database.ts              # RxDB database configuration
├── replication.ts           # WebSocket sync with PubSub (ReplicationManager)
├── RxDBProvider.tsx         # React context provider
├── index.ts                 # Module exports
├── schemas/
│   ├── entity.schema.ts     # Entity collection schema
│   ├── draft.schema.ts      # Draft collection schema
│   └── metadata.schema.ts   # Metadata collection schema
└── hooks/
    ├── useRxEntity.ts       # useRxEntity, useRxEntityList, useRxEntityMutation
    └── useRxDraft.ts        # useRxDraft, useRecoverDraft
```

---

## RxDB Hooks

### Entity Hooks

| Hook | Purpose | Returns |
|------|---------|---------|
| `useRxEntity` | Single entity with auto-sync | `{ data, refData, metadata, isLoading, isStale, refetch }` |
| `useRxEntityList` | Entity list with auto-sync | `{ data[], refData, metadata, isLoading, total, refetch }` |
| `useRxEntityMutation` | Create/Update/Delete | `{ updateEntity, createEntity, deleteEntity }` |

### Draft Hooks

| Hook | Purpose | Returns |
|------|---------|---------|
| `useRxDraft` | Edit with persistence | `{ hasDraft, currentData, updateField, undo, redo }` |
| `useRecoverDraft` | Check for existing draft | `{ hasDraft, isChecking }` |

---

## Usage Examples

### Basic Entity Query

```typescript
import { useRxEntity, useRxEntityList } from '@/db/rxdb';

// Single entity
function ProjectDetail({ projectId }: { projectId: string }) {
  const { data, isLoading, isStale, refetch } = useRxEntity<Project>(
    'project',
    projectId
  );

  if (isLoading) return <Loading />;

  return (
    <div>
      <h1>{data?.name}</h1>
      {isStale && <button onClick={refetch}>Refresh</button>}
    </div>
  );
}

// Entity list
function ProjectList() {
  const { data, isLoading, refetch } = useRxEntityList<Project>(
    'project',
    { limit: 50 }
  );

  return (
    <ul>
      {data.map(project => (
        <li key={project.id}>{project.name}</li>
      ))}
    </ul>
  );
}
```

### Draft Persistence (Edit Mode)

```typescript
import { useRxEntity, useRxDraft, useRecoverDraft } from '@/db/rxdb';

function ProjectEditor({ projectId }: { projectId: string }) {
  const { data } = useRxEntity<Project>('project', projectId);
  const draft = useRxDraft('project', projectId);
  const recovery = useRecoverDraft('project', projectId);

  // Check for existing draft on mount
  useEffect(() => {
    if (recovery.hasDraft) {
      // Prompt user to recover unsaved changes
      if (confirm('You have unsaved changes. Recover?')) {
        // Draft is already loaded
      } else {
        draft.discardDraft();
      }
    }
  }, [recovery.hasDraft]);

  // Start editing
  const handleStartEdit = () => {
    if (data) draft.startEdit(data);
  };

  // Field change (persisted to IndexedDB!)
  const handleFieldChange = (field: string, value: unknown) => {
    draft.updateField(field, value);
  };

  // Save changes
  const handleSave = async () => {
    const changes = draft.getChanges();
    await mutation.updateEntity(projectId, changes);
    draft.discardDraft();
  };

  return (
    <form>
      <input
        value={draft.currentData?.name || ''}
        onChange={e => handleFieldChange('name', e.target.value)}
      />
      <button onClick={draft.undo} disabled={!draft.canUndo}>Undo</button>
      <button onClick={draft.redo} disabled={!draft.canRedo}>Redo</button>
      <button onClick={handleSave} disabled={!draft.hasChanges}>Save</button>
    </form>
  );
}
```

### App Setup

```typescript
// App.tsx
import { RxDBProvider } from '@/db/rxdb/RxDBProvider';

function App() {
  return (
    <RxDBProvider>
      <AuthProvider>
        <Router>
          {/* App routes */}
        </Router>
      </AuthProvider>
    </RxDBProvider>
  );
}
```

---

## Component Summary

| Layer | Component | Responsibility |
|-------|-----------|----------------|
| Browser | `useRxEntity` / `useRxEntityList` | Query RxDB, trigger fetch if missing |
| Browser | RxDB (IndexedDB) | Persistent cache, reactive queries |
| Browser | `ReplicationManager` | WebSocket connection, fetch & upsert |
| Browser | `useRxDraft` | Draft persistence with undo/redo |
| Server | REST API (4000) | CRUD, RBAC, metadata generation |
| Server | PubSub (4001) | WebSocket, LogWatcher, subscriptions |
| Database | PostgreSQL | Entity data, triggers → `app.logging` |
| Database | `app.rxdb_subscription` | Who subscribes to what |

---

## WebSocket Protocol

### Client → Server Messages

```typescript
// SUBSCRIBE - Subscribe to entity changes
{ type: 'SUBSCRIBE', payload: { entityCode: string, entityIds: string[] } }

// UNSUBSCRIBE - Unsubscribe from entities
{ type: 'UNSUBSCRIBE', payload: { entityCode: string, entityIds?: string[] } }

// PING - Heartbeat (30s interval)
{ type: 'PING' }
```

### Server → Client Messages

```typescript
// INVALIDATE - Entity has changed, refetch required
{
  type: 'INVALIDATE',
  payload: {
    entityCode: string,
    changes: Array<{ entityId: string, action: 'CREATE' | 'UPDATE' | 'DELETE', version: number }>,
    timestamp: string
  }
}

// PONG - Heartbeat response
{ type: 'PONG' }
```

---

## Multi-Tab Sync

RxDB's LeaderElection plugin ensures only one tab manages replication:

```
Tab 1 (Leader)                    Tab 2 (Follower)
─────────────────────────────────────────────────────
┌──────────────┐                  ┌──────────────┐
│ RxDB + WS    │ ───IndexedDB───► │    RxDB      │
│ Replication  │                  │  (reactive)  │
└──────────────┘                  └──────────────┘
       │                                 │
       └──── Both see same data ─────────┘
```

- Leader tab handles WebSocket connection
- All tabs share IndexedDB storage
- Changes in one tab instantly visible in others

---

**Version:** 8.5.0 | **Updated:** 2025-11-27

**Recent Updates:**
- v8.5.0 (2025-11-27): **RxDB Offline-First Architecture**
  - Added RxDB with IndexedDB storage (Dexie)
  - Added `useRxEntity`, `useRxEntityList`, `useRxEntityMutation` hooks
  - Added `useRxDraft`, `useRecoverDraft` for draft persistence
  - Added `RxDBProvider` for app-wide state management
  - Added `ReplicationManager` for WebSocket sync
  - Multi-tab sync via LeaderElection plugin
  - Draft edits persist through page refresh
  - Offline-first: works without network connection
- v8.4.0 (2025-11-27): WebSocket Real-Time Sync (SyncProvider)
- v8.3.2 (2025-11-27): Component-Driven Rendering + BadgeDropdownSelect
- v8.3.1 (2025-11-26): Metadata-Based Reference Resolution
- v8.3.0 (2025-11-26): ref_data_entityInstance Pattern
