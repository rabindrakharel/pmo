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
│  │  • WebSocket replication for real-time sync (v8.5.0)                  │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐   │
│  │  WEBSOCKET SYNC - Real-Time Replication (v8.5.0)                      │   │
│  │  ─────────────────────────────────────────────────────────────────    │   │
│  │  • ReplicationManager connects to PubSub service (port 4001)          │   │
│  │  • Auto-subscribe to loaded entity IDs                                │   │
│  │  • INVALIDATE messages trigger re-fetch and RxDB update               │   │
│  │  • Automatic reconnection with exponential backoff                    │   │
│  │  • Version tracking prevents stale update processing                  │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐   │
│  │  DRAFT PERSISTENCE - Survives Page Refresh! (v8.5.0)                  │   │
│  │  ─────────────────────────────────────────────────────────────────    │   │
│  │  • Unsaved edits stored in RxDB drafts collection                     │   │
│  │  • Undo/redo stacks persisted                                         │   │
│  │  • Auto-recovery on page reload                                       │   │
│  │  • Field-level dirty tracking                                         │   │
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

## Architecture

### RxDB Collections

| Collection | Purpose | Schema |
|------------|---------|--------|
| `entities` | Entity instances (all types) | `{ entityCode, id, data, refData, metadata, _version }` |
| `drafts` | Unsaved edits | `{ entityCode, entityId, originalData, currentData, dirtyFields }` |
| `metadata` | Cached settings | `{ type, key, data, cachedAt, ttl }` |

### File Structure

```
apps/web/src/db/rxdb/
├── database.ts              # RxDB database configuration
├── replication.ts           # WebSocket sync with PubSub
├── RxDBProvider.tsx         # React context provider
├── index.ts                 # Module exports
├── schemas/
│   ├── entity.schema.ts     # Entity collection schema
│   ├── draft.schema.ts      # Draft collection schema
│   └── metadata.schema.ts   # Metadata collection schema
└── hooks/
    ├── useRxEntity.ts       # Entity query hooks
    └── useRxDraft.ts        # Draft persistence hooks
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

## Real-Time Sync Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  REAL-TIME SYNC FLOW (v8.5.0)                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Client loads entities via REST API                                       │
│     GET /api/v1/project → ReplicationManager fetches → RxDB stores          │
│                                                                              │
│  2. ReplicationManager sends SUBSCRIBE message                               │
│     WebSocket → { type: 'SUBSCRIBE', payload: { entityCode, entityIds } }   │
│                                                                              │
│  3. PubSub stores subscriptions in database                                  │
│     INSERT INTO app.rxdb_subscription (user_id, entity_code, entity_id)     │
│                                                                              │
│  4. Another user modifies entity via REST API                                │
│     PATCH /api/v1/project/123 → Database trigger logs to app.logging        │
│                                                                              │
│  5. LogWatcher polls app.logging (60s), finds subscribers                    │
│     SELECT * FROM app.rxdb_subscription WHERE entity_code = 'project'       │
│                                                                              │
│  6. PubSub pushes INVALIDATE to subscribed clients                           │
│     WebSocket ← { type: 'INVALIDATE', payload: { entityCode, changes } }    │
│                                                                              │
│  7. ReplicationManager handles INVALIDATE                                    │
│     Re-fetches entity from server → Updates RxDB                            │
│                                                                              │
│  8. RxDB reactive query triggers UI update                                   │
│     Component automatically re-renders with fresh data                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

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

## Offline Behavior

### When Offline

1. **Reads**: Served from IndexedDB cache
2. **Writes**: Queued for later sync (TODO: implement write queue)
3. **UI**: Shows cached data with "offline" indicator

### When Online

1. **Background sync**: Stale data refreshed automatically
2. **Real-time updates**: WebSocket push from other users
3. **Conflict resolution**: Server version wins (last-write-wins)

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

## Migration from React Query

| React Query | RxDB Equivalent |
|-------------|-----------------|
| `useQuery` | `useRxEntity` / `useRxEntityList` |
| `useMutation` | `useRxEntityMutation` |
| `queryClient.invalidateQueries` | Automatic via replication |
| `staleTime` / `cacheTime` | Data persists indefinitely (IndexedDB) |
| `select` transform | Apply in component or create custom hook |

---

## File Reference

| File | Purpose |
|------|---------|
| `db/rxdb/database.ts` | RxDB database configuration |
| `db/rxdb/replication.ts` | WebSocket sync with PubSub |
| `db/rxdb/RxDBProvider.tsx` | React context provider |
| `db/rxdb/schemas/entity.schema.ts` | Entity collection schema |
| `db/rxdb/schemas/draft.schema.ts` | Draft collection schema |
| `db/rxdb/schemas/metadata.schema.ts` | Metadata collection schema |
| `db/rxdb/hooks/useRxEntity.ts` | Entity query hooks |
| `db/rxdb/hooks/useRxDraft.ts` | Draft persistence hooks |

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
