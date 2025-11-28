# State Management Architecture

**Version:** 9.1.0 | **Updated:** 2025-11-28

---

## Overview

The PMO frontend uses **TanStack Query + Dexie** for state management. TanStack Query manages server state with automatic background refetching, while Dexie (IndexedDB) provides offline-first persistent storage.

```
+-------------------------------------------------------------------------+
|               STATE MANAGEMENT (v9.1.0 - TanStack Query + Dexie)         |
+-------------------------------------------------------------------------+
|                                                                          |
|   TanStack Query (In-Memory)         Dexie (IndexedDB)                  |
|   -------------------------          ------------------                  |
|   - Server state management          - Persistent storage               |
|   - Automatic background refetch     - Survives browser restart         |
|   - Stale-while-revalidate          - Offline-first access             |
|   - Cache invalidation              - Multi-tab sync                    |
|                                                                          |
|   +-----------------------+         +------------------------+          |
|   |  useEntity()         |<------->|  entities table        |          |
|   |  useEntityList()     |         |  entityLists table     |          |
|   |  useDatalabel()      |         |  metadata table        |          |
|   |  useDraft()          |         |  drafts table          |          |
|   +-----------------------+         +------------------------+          |
|                                                                          |
|   WebSocket Manager                                                     |
|   -----------------                                                     |
|   - Receives INVALIDATE messages from PubSub (port 4001)               |
|   - Triggers queryClient.invalidateQueries()                            |
|   - TanStack Query auto-refetches -> Updates Dexie                     |
|                                                                          |
+-------------------------------------------------------------------------+
```

---

## Data Storage Summary

| Data Type | Storage | TTL | Persists Refresh | Multi-Tab |
|-----------|---------|-----|------------------|-----------|
| **Entity instances** | TanStack Query + Dexie | 5 min stale | Yes | Yes |
| **Entity lists** | TanStack Query + Dexie | 2 min stale | Yes | Yes |
| **Drafts (unsaved edits)** | Dexie only | Until saved | Yes | Yes |
| **Datalabels** | TanStack Query + Dexie | 10 min | Yes | Yes |
| **Entity codes** | TanStack Query + Dexie | 30 min | Yes | Yes |
| **Global settings** | TanStack Query + Dexie | 30 min | Yes | Yes |

---

## Dexie Tables (IndexedDB)

| Table | Purpose | Primary Key | Indexes |
|-------|---------|-------------|---------|
| `entities` | Cached entity data | `_id` (entityCode:entityId) | entityCode, syncedAt, isDeleted |
| `entityLists` | Cached list query results | `_id` (entityCode:queryHash) | entityCode, syncedAt |
| `metadata` | Datalabels, entity codes, settings | `_id` (type:key) | type, key |
| `drafts` | Unsaved form edits | `_id` (draft:entityCode:entityId) | entityCode, entityId, updatedAt |

---

## Hooks

### Entity Data Hooks

```typescript
import {
  useEntity,           // Single entity with auto-refetch
  useEntityList,       // Paginated list
  useEntityMutation,   // Create/Update/Delete
  useOfflineEntity,    // Dexie-only (no network)
} from '@/db/tanstack-index';
```

### Metadata Hooks

```typescript
import {
  useDatalabel,        // Dropdown options
  useEntityCodes,      // Entity type definitions
  useGlobalSettings,   // App settings
} from '@/db/tanstack-index';

// Sync cache for non-hook access (formatters, utilities)
import {
  getDatalabelSync,
  getEntityCodesSync,
  getGlobalSettingsSync,
} from '@/db/tanstack-index';
```

### Draft Persistence Hook

```typescript
import { useDraft, useRecoverDrafts } from '@/db/tanstack-index';
```

---

## useEntityList Example

```typescript
function ProjectList() {
  const {
    data,           // Project[] from TanStack Query
    metadata,       // Field definitions for rendering
    refData,        // Reference lookups (entity names)
    isLoading,      // True during initial fetch
    isFetching,     // True during any fetch (including background)
    isStale,        // True if data needs refresh
    total,          // Total count from API
    refetch,        // Manual refresh function
  } = useEntityList<Project>('project', { limit: 50 });

  // Data available immediately from Dexie (if cached)
  // TanStack Query handles background refresh automatically
  return (
    <ul>
      {data?.map(project => (
        <li key={project.id}>{project.name}</li>
      ))}
    </ul>
  );
}
```

---

## useDraft Example (Draft Persistence)

```typescript
function ProjectEditor({ projectId }: { projectId: string }) {
  const { data } = useEntity<Project>('project', projectId);
  const draft = useDraft<Project>('project', projectId);

  // Start editing - creates draft in Dexie
  const handleStartEdit = () => {
    if (data) draft.startEdit(data);
  };

  // Field change - persisted to Dexie immediately!
  const handleFieldChange = (field: string, value: unknown) => {
    draft.updateField(field, value);
    // Survives page refresh!
  };

  // Save changes - only dirty fields sent
  const handleSave = async () => {
    const changes = draft.getChanges();  // { budget_amt: 75000 }
    await api.patch(projectId, changes);
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

---

## Data Flow Patterns

### Pattern 1: Initial Load (Cold Cache)

```
User visits /project
    |
    v
useEntityList('project')
    |
    +-- TanStack Query: check memory cache
    |   Result: MISS
    |
    +-- hydrateQueryCache(): check Dexie
    |   Result: [] (empty IndexedDB)
    |
    +-- Fetch from API: GET /api/v1/project?limit=50
    |       |
    |       v
    |   API Response:
    |   { data: [...], ref_data_entityInstance: {...}, metadata: {...} }
    |       |
    |       v
    |   1. Set TanStack Query cache
    |   2. Persist to Dexie (db.entities.bulkPut)
    |   3. WebSocket SUBSCRIBE for loaded entity IDs
    |
    +-- TanStack Query cache updated
    |
    v
Component re-renders with data
```

### Pattern 2: Warm Cache (Instant Load)

```
User returns to /project
    |
    v
useEntityList('project')
    |
    +-- App startup: hydrateQueryCache()
    |   -> Loads Dexie -> TanStack Query
    |
    +-- TanStack Query: check memory cache
    |   Result: HIT (hydrated from Dexie)
    |   isLoading = false (instant!)
    |
    +-- Check staleness: staleTime > 2 min?
    |   If stale -> isFetching=true, background refetch
    |
    v
Component renders IMMEDIATELY with cached data
```

### Pattern 3: Real-Time Update (WebSocket)

```
User B edits project
    |
    v
API Server:
1. RBAC check (EDIT permission)
2. UPDATE app.project SET ...
3. DB trigger -> INSERT app.logging (sync_status='pending')
4. Return 200 OK to User B
    |
    | (up to 60s later)
    v
PubSub LogWatcher polls app.logging
    |
    +-- Query app.rxdb_subscription for subscribers
    +-- Push INVALIDATE via WebSocket to User A
    |
    v
User A's WebSocketManager receives INVALIDATE
    |
    +-- queryClient.invalidateQueries(['entity', 'project', id])
    +-- TanStack Query auto-refetches (if observers mounted)
    +-- GET /api/v1/project/:id
    +-- Update Dexie with fresh data
    |
    v
Component auto-updates (TanStack Query reactivity)
```

### Pattern 4: Draft Persistence

```
User starts editing
    |
    v
useDraft('project', projectId)
    |
    +-- Create draft in Dexie drafts table
    |   { originalData, currentData, undoStack: [], redoStack: [] }
    |
    v
User modifies field
    |
    +-- draft.updateField('budget_amt', 75000)
    +-- Dexie upsert (persisted to IndexedDB immediately!)
    |
    v
User refreshes page (or browser restarts!)
    |
    v
useRecoverDrafts()
    |
    +-- Query Dexie: db.drafts.toArray()
    +-- Found! hasDrafts = true
    +-- Show: "Recover unsaved changes?"
    |
    +-- Yes: Navigate to draft entity
    +-- No: discardAllDrafts()
```

---

## File Structure

```
apps/web/src/db/
+-- TanstackCacheProvider.tsx        # React context provider
+-- tanstack-index.ts                # Public API exports
+-- dexie/
|   +-- database.ts                  # Dexie schema + helpers
+-- query/
|   +-- queryClient.ts               # TanStack Query config + hydration
+-- tanstack-hooks/
|   +-- index.ts                     # Hook exports
|   +-- useEntity.ts                 # Single entity + mutations
|   +-- useEntityList.ts             # Paginated list queries
|   +-- useDatalabel.ts              # Dropdown options + sync cache
|   +-- useEntityCodes.ts            # Entity type definitions
|   +-- useGlobalSettings.ts         # App settings
|   +-- useDraft.ts                  # Draft persistence + undo/redo
|   +-- useOfflineEntity.ts          # Dexie-only access
+-- tanstack-sync/
    +-- WebSocketManager.ts          # WebSocket + cache invalidation
```

---

## App Integration

```tsx
// App.tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient, TanstackCacheProvider } from '@/db/tanstack-index';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TanstackCacheProvider>
        <AuthProvider>
          <Router>
            {/* App routes */}
          </Router>
        </AuthProvider>
      </TanstackCacheProvider>
    </QueryClientProvider>
  );
}
```

---

## Multi-Tab Sync

Dexie uses shared IndexedDB storage for multi-tab sync:

```
Tab 1                                 Tab 2
-----                                 -----
+---------------+                     +---------------+
| TanStack Query|                     | TanStack Query|
|   + Dexie     |<---IndexedDB--->   |   + Dexie     |
+---------------+                     +---------------+
       |                                    |
       |  WebSocket (leader tab)            |
       +---> wsManager receives INVALIDATE  |
       |     invalidates both tabs' caches  |
       |                                    |
       +-------- Both see same data --------+
```

- Any tab can fetch and update Dexie
- TanStack Query cache is per-tab (in-memory)
- Hydration from Dexie syncs state on startup

---

## Sync Cache Pattern (Non-Hook Access)

For non-hook contexts (formatters, utilities), use sync cache functions:

```typescript
import {
  getDatalabelSync,
  getEntityCodesSync,
  getGlobalSettingsSync,
  getEntityByCodeSync,
} from '@/db/tanstack-index';

// Returns cached data or null
// (populated at login via prefetchAllMetadata)
const options = getDatalabelSync('project_stage');
const entityCodes = getEntityCodesSync();
const settings = getGlobalSettingsSync();
const projectDef = getEntityByCodeSync('project');
```

---

## Initialization Flow

```
App Start
    |
    v
TanstackCacheProvider mounts
    |
    +-- hydrateQueryCache()
    |   -> Load entities from Dexie
    |   -> Set TanStack Query cache
    |   -> isHydrated = true
    |
    v
User logs in (AuthContext)
    |
    +-- connectWebSocket(token)
    |   -> wsManager.connect(token)
    |   -> Flush pending subscriptions
    |
    +-- prefetchAllMetadata()
        +-- prefetchAllDatalabels()  -> Dexie + sync cache
        +-- prefetchEntityCodes()    -> Dexie + sync cache
        +-- prefetchGlobalSettings() -> Dexie + sync cache
        -> isMetadataLoaded = true
    |
    v
App ready for use
```

---

## Cache Invalidation Strategies

| Trigger | Action | Result |
|---------|--------|--------|
| WebSocket INVALIDATE | `invalidateEntityQueries()` | Auto-refetch if observers mounted |
| Manual refetch | `refetch()` from hook | Immediate fetch + cache update |
| Mutation success | `invalidateQueries()` in onSuccess | Related queries refetched |
| Logout | `clearAllCaches()` | TanStack + Dexie cleared |
| Stale timeout | Automatic | Background refetch on next access |

---

## Bundle Size Comparison

| Solution | Bundle Size | Notes |
|----------|-------------|-------|
| TanStack Query + Dexie | ~25KB | Production (v9.1.0) |
| RxDB | ~150KB | Previous (v8.x) |
| Redux + RTK Query | ~30KB | Alternative considered |

---

## Related Documents

| Document | Purpose |
|----------|---------|
| `docs/caching/TANSTACK_DEXIE_SYNC_ARCHITECTURE.md` | WebSocket sync + PubSub architecture |
| `docs/services/entity-infrastructure.service.md` | Entity CRUD patterns |
| `CLAUDE.md` | Main codebase reference |

---

**Version:** 9.1.0 | **Updated:** 2025-11-28 | **Status:** Production
