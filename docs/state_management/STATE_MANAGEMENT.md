# State Management Architecture

**Version:** 11.1.0 | **Updated:** 2025-12-02

---

## Overview

The PMO frontend uses **TanStack Query + Dexie** for state management. TanStack Query manages server state with automatic background refetching, while Dexie (IndexedDB) provides offline-first persistent storage.

### v11.1.0 Key Changes

**Flat Metadata Format:** Both `EntityListOfInstancesTable` and `EntityInstanceFormContainer` now use the same flat metadata format: `{ viewType, editType }`. This standardizes how metadata flows from hooks to components.

### v11.0.0 Key Change: Single In-Memory Cache

**Removed redundant sync stores.** TanStack Query cache is now the single source of truth for all in-memory cache access. Sync accessors (`getDatalabelSync`, `getEntityInstanceNameSync`, etc.) now read directly from `queryClient.getQueryData()` instead of separate Map-based stores.

```
+-------------------------------------------------------------------------+
|               STATE MANAGEMENT (v11.1.0 - TanStack Query + Dexie)        |
+-------------------------------------------------------------------------+
|                                                                          |
|   TanStack Query (In-Memory - SINGLE SOURCE OF TRUTH)                   |
|   ---------------------------------------------------                   |
|   - Server state management                                             |
|   - Automatic background refetch                                        |
|   - Stale-while-revalidate                                              |
|   - Cache invalidation                                                  |
|   - Sync accessor reads (getQueryData)                                  |
|                                                                          |
|   Dexie (IndexedDB)                                                     |
|   -----------------                                                     |
|   - Persistent storage                                                  |
|   - Survives browser restart                                            |
|   - Offline-first access                                                |
|   - Hydrates TanStack on startup                                        |
|                                                                          |
|   +-----------------------+         +------------------------+          |
|   |  useEntity()         |<------->|  entityInstanceData    |          |
|   |  useEntityList()     |         |  entityInstanceNames   |          |
|   |  useDatalabel()      |         |  datalabel             |          |
|   |  useDraft()          |         |  draft                 |          |
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
3. DB trigger -> INSERT app.system_logging (sync_status='pending')
4. Return 200 OK to User B
    |
    | (up to 60s later)
    v
PubSub LogWatcher polls app.system_logging
    |
    +-- Query app.system_cache_subscription for subscribers
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
+-- Provider.tsx                     # CacheProvider - React context provider
+-- index.ts                         # Public API exports
+-- tanstack-index.ts                # Additional exports
+-- cache/
|   +-- client.ts                    # TanStack Query config
|   +-- stores.ts                    # Sync accessors (getEntityInstanceNameSync, etc.)
|   +-- keys.ts                      # Query key factories
|   +-- hooks/                       # All data hooks
+-- persistence/
|   +-- schema.ts                    # Dexie schema
|   +-- hydrate.ts                   # IndexedDB hydration
+-- realtime/
    +-- manager.ts                   # WebSocket + cache invalidation
```

---

## Unified Cache Architecture (v11.1.0)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        v11.1.0 UNIFIED CACHE ARCHITECTURE                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         CacheProvider                                 │   │
│  │  • Wraps QueryClientProvider (single source of truth)                │   │
│  │  • Hydrates from IndexedDB on mount                                  │   │
│  │  • Manages WebSocket connection                                      │   │
│  │  • Context: { syncStatus, isHydrated, connect, disconnect, prefetch }│   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│           ┌────────────────────────┼────────────────────────┐               │
│           ▼                        ▼                        ▼               │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐       │
│  │  TanStack Query │     │   Dexie v4      │     │   WebSocket     │       │
│  │  (In-Memory)    │◄───►│  (IndexedDB)    │     │  (Real-time)    │       │
│  └─────────────────┘     └─────────────────┘     └─────────────────┘       │
│         │                        │                        │                 │
│         │ queryClient            │ Persistence            │ Invalidation    │
│         │ .getQueryData()        │ Tables                 │ wsManager       │
│         │ .setQueryData()        │                        │                 │
│         ▼                        ▼                        ▼                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     UNIFIED QUERY KEYS                               │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  ['globalSettings']                    → GlobalSettings              │   │
│  │  ['datalabel', key]                    → DatalabelOption[]           │   │
│  │  ['entityCodes']                       → EntityCode[]                │   │
│  │  ['entityInstanceNames', entityCode]   → { uuid: name }              │   │
│  │  ['entityInstanceData', code, id]      → EntityInstance              │   │
│  │  ['entityInstanceMetadata', code]      → ViewType/EditType           │   │
│  │  ['entityLinks', parentCode, parentId] → LinkForwardIndex            │   │
│  │  ['draft', entityCode, entityId]       → Draft                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Sync Accessors (v11.0.0)

Sync accessors provide **synchronous cache access** for formatters and utilities that can't use React hooks:

```
┌────────────────────────────────────────────────────────────┐
│           TanStack Query Cache                              │
│  queryClient.getQueryData(['entityInstanceNames', code])    │
│                      │                                      │
│         ┌───────────┴───────────┐                          │
│         ▼                       ▼                          │
│  useEntityInstanceNames()   getEntityInstanceNameSync()     │
│  (React hook)               (sync wrapper function)         │
│                                                             │
│  SAME DATA - just different access patterns                 │
└────────────────────────────────────────────────────────────┘
```

| Sync Accessor | Usage | Returns |
|---------------|-------|---------|
| `getEntityInstanceNameSync(code, uuid)` | Formatters resolving UUIDs to names | `string \| null` |
| `getDatalabelSync(key)` | Badge colors, dropdown options | `DatalabelOption[] \| null` |
| `getEntityCodesSync()` | Entity type metadata | `EntityCode[] \| null` |
| `getGlobalSettingsSync()` | Currency, date formats | `GlobalSettings \| null` |

**Key Point**: These are NOT separate stores. They just wrap `queryClient.getQueryData()`.

---

## App Integration

```tsx
// App.tsx
import { CacheProvider } from '@/db';

function App() {
  return (
    // CacheProvider includes QueryClientProvider - single source of truth
    <CacheProvider>
      <AuthProvider>
        <Router>
          {/* App routes */}
        </Router>
      </AuthProvider>
    </CacheProvider>
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

## Data Flow (v11.1.0)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA FLOW (v11.1.0)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. APP START                                                               │
│     ─────────────                                                           │
│     CacheProvider mounts                                                    │
│         │                                                                   │
│         ▼                                                                   │
│     hydrateFromDexie() ─────► Load IndexedDB → TanStack Query cache         │
│         │                                                                   │
│         ▼                                                                   │
│     isHydrated = true                                                       │
│                                                                             │
│  2. LOGIN                                                                   │
│     ─────────                                                               │
│     AuthContext.login() ────► context.prefetch()                            │
│         │                         │                                         │
│         │                         ├── prefetchGlobalSettings()              │
│         │                         ├── prefetchAllDatalabels()               │
│         │                         └── prefetchEntityCodes()                 │
│         │                                                                   │
│         └──────────────────► context.connect(token)                         │
│                                   │                                         │
│                                   └── wsManager.connect()                   │
│                                                                             │
│  3. ENTITY FETCH                                                            │
│     ─────────────                                                           │
│     useEntityInstanceData('project', { limit: 20 })                         │
│         │                                                                   │
│         ▼                                                                   │
│     API Response: { data, ref_data_entityInstance, metadata }               │
│         │                                                                   │
│         ├── data → queryClient.setQueryData(['entityInstanceData',...])     │
│         │                                                                   │
│         ├── ref_data_entityInstance ──► upsertRefDataEntityInstance()       │
│         │       │                                                           │
│         │       └── queryClient.setQueryData(['entityInstanceNames',...])   │
│         │                                                                   │
│         └── metadata → queryClient.setQueryData(['entityInstanceMetadata']) │
│                                                                             │
│  4. RENDER                                                                  │
│     ──────                                                                  │
│     formatDataset(data, metadata)                                           │
│         │                                                                   │
│         ▼                                                                   │
│     formatReference(uuid, { lookupEntity: 'employee' })                     │
│         │                                                                   │
│         ▼                                                                   │
│     getEntityInstanceNameSync('employee', uuid) ────► 'John Smith'          │
│                                                                             │
│  5. WEBSOCKET INVALIDATION                                                  │
│     ──────────────────────                                                  │
│     wsManager receives { type: 'INVALIDATE', entity_code: 'project' }       │
│         │                                                                   │
│         ▼                                                                   │
│     queryClient.invalidateQueries(['entityInstanceData', 'project'])        │
│         │                                                                   │
│         ▼                                                                   │
│     TanStack Query auto-refetches → UI updates                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Sync Cache Pattern (Non-Hook Access) - v11.0.0

For non-hook contexts (formatters, utilities), use sync accessor functions that read directly from `queryClient.getQueryData()`:

```typescript
import {
  getDatalabelSync,
  getEntityCodesSync,
  getGlobalSettingsSync,
  getEntityCodeSync,
  getEntityInstanceNameSync,
} from '@/db/tanstack-index';

// v11.0.0: These read directly from queryClient.getQueryData()
// Returns cached data or null
// (populated at login via prefetchAllMetadata)
const options = getDatalabelSync('project_stage');
const entityCodes = getEntityCodesSync();
const settings = getGlobalSettingsSync();
const projectDef = getEntityCodeSync('project');
const employeeName = getEntityInstanceNameSync('employee', uuid);
```

### How Sync Accessors Work (v11.0.0)

```typescript
// db/cache/stores.ts
export function getDatalabelSync(key: string): DatalabelOption[] | null {
  const normalizedKey = key.startsWith('dl__') ? key.slice(4) : key;
  return queryClient.getQueryData<DatalabelOption[]>(
    QUERY_KEYS.datalabel(normalizedKey)
  ) ?? null;
}

export function getEntityInstanceNameSync(
  entityCode: string,
  entityInstanceId: string
): string | null {
  const names = queryClient.getQueryData<Record<string, string>>(
    QUERY_KEYS.entityInstanceNames(entityCode)
  );
  return names?.[entityInstanceId] ?? null;
}
```

**Key insight:** `queryClient.getQueryData()` is **synchronous** - it reads directly from TanStack Query's in-memory cache. No promises, no async. This enables formatters to resolve UUIDs to names without async/await.

---

## Initialization Flow

```
App Start
    |
    v
CacheProvider mounts
    |
    +-- hydrateFromDexie()
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
| `docs/caching-frontend/NORMALIZED_CACHE_ARCHITECTURE.md` | TanStack Query + Dexie cache architecture |
| `docs/caching-frontend/ref_data_entityInstance.md` | Entity reference resolution pattern |
| `docs/ui_page/PAGE_LAYOUT_COMPONENT_ARCHITECTURE.md` | Page components and routing |
| `docs/services/entity-infrastructure.service.md` | Entity CRUD patterns |
| `CLAUDE.md` | Main codebase reference |

---

**Version:** 11.1.0 | **Updated:** 2025-12-02 | **Status:** Production

---

## Design Pattern Summary (Bullet Points)

### Core Architecture (v11.1.0)

- **Single QueryClient**: One `QueryClient` instance from `db/cache/client.ts` shared across entire app
- **TanStack Query**: In-memory server state cache with auto-refetch and stale-while-revalidate
- **Dexie (IndexedDB)**: Persistent offline storage that survives browser restart
- **WebSocket Sync**: Real-time cache invalidation via PubSub service (port 4001)
- **Sync Accessors**: Read directly from `queryClient.getQueryData()` (no separate Map stores)
- **Flat Metadata Format**: Both table and form components receive `{ viewType, editType }` directly

### Data Flow Pattern

1. **App Start** → `hydrateQueryCache()` loads Dexie → TanStack Query
2. **Login** → `prefetchAllMetadata()` populates all caches
3. **Component Mount** → `useQuery` checks TanStack cache → Dexie → API
4. **API Response** → Store in TanStack → Persist to Dexie → Upsert ref_data
5. **WebSocket INVALIDATE** → `invalidateQueries()` → Auto-refetch → Update Dexie

### Cache Types & TTLs (v11.1.0)

| Cache | Query Key | Stale Time | GC Time | Persistence |
|-------|-----------|------------|---------|-------------|
| Entity Instance Names | `['entityInstanceNames', code]` | 10 min | 30 min | TanStack + Dexie |
| Datalabel | `['datalabel', key]` | 10 min | 1 hour | TanStack + Dexie |
| Entity Codes | `['entityCodes']` | 30 min | 1 hour | TanStack + Dexie |
| Global Settings | `['globalSettings']` | 30 min | 1 hour | TanStack + Dexie |
| Entity Instance Data | `['entityInstanceData', code, params]` | 5 min | 30 min | TanStack + Dexie |
| Entity Instance Metadata | `['entityInstanceMetadata', code]` | 30 min | 1 hour | TanStack + Dexie |
| Draft | `['draft', code, id]` | N/A | N/A | Dexie only |

---

## Page & Component Caching Patterns

### EntityListOfInstancesPage (List View)

```
/project, /employee, /task, etc.
```

**Cache Pattern (v11.1.0 - Two-Query Architecture):**
- **DATA Query Key**: `['entityInstanceData', entityCode, { limit, offset, filters }]`
- **METADATA Query Key**: `['entityInstanceMetadata', entityCode, 'entityListOfInstancesTable']`
- **Data Source**: `useEntityInstanceData(entityCode, params)` + `useEntityInstanceMetadata(entityCode, componentType)`
- **Metadata Format**: Flat `{ viewType, editType }` passed to `EntityListOfInstancesTable`
- **Format**: Format-at-read via `formatDataset(data, metadata)` in `useMemo`
- **Upsert**: API response `ref_data_entityInstance` merged into TanStack Query cache

**Flow:**
1. Component mounts → `useEntityInstanceData('project', { limit: 50 })` + `useEntityInstanceMetadata('project', 'entityListOfInstancesTable')`
2. TanStack checks cache → HIT (instant) or MISS (fetch)
3. Page constructs flat metadata: `{ viewType, editType }`
4. API response `ref_data_entityInstance` merged via `queryClient.setQueryData(['entityInstanceNames', code], ...)`
5. `formatDataset()` transforms to `FormattedRow[]`, entity references resolved via `getEntityInstanceNameSync()`
6. Table receives flat metadata and FormattedRow[]

### EntitySpecificInstancePage (Detail View)

```
/project/:id, /employee/:id, etc.
```

**Cache Pattern (v11.1.0 - Two-Query Architecture):**
- **DATA Query Key**: `['entityInstance', entityCode, entityId]`
- **METADATA Query Key**: `['entityInstanceMetadata', entityCode, 'entityInstanceFormContainer']`
- **Data Source**: `useEntity(entityCode, entityId)` + `useEntityInstanceMetadata(entityCode, 'entityInstanceFormContainer')`
- **Metadata Format**: Flat `{ viewType, editType }` passed to `EntityInstanceFormContainer`
- **Child Tabs**: Each tab uses `['entityInstanceData', childCode, { parent_entity_code, parent_entity_instance_id }]`

**Flow:**
1. Component mounts → `useEntity('project', 'uuid-123')` + `useEntityInstanceMetadata('project', 'entityInstanceFormContainer')`
2. Page constructs flat metadata: `const formMetadata = { viewType: formViewType, editType: formEditType }`
3. `formatRow(rawData, formMetadata, refData)` transforms for view mode
4. `EntityInstanceFormContainer` receives flat metadata (same format as `EntityListOfInstancesTable`)
5. Child tabs lazy-load on click with parent filtering params

### EntityCreatePage (Create Form)

```
/project/new, /employee/new, etc.
```

**Cache Pattern:**
- **Query Key**: None (new entity)
- **Data Source**: Empty form with field metadata
- **Draft Storage**: `useDraft(entityCode, 'new')` → Dexie `drafts` table
- **Dropdown Data**: `useRefDataEntityInstanceOptions(entityCode)` from unified cache

**Flow:**
1. Component mounts → Load field metadata from `['entityCodes']`
2. Dropdowns populated from `['entityInstanceNames', lookupEntity]`
3. User edits → Draft persisted to Dexie (survives refresh)
4. Submit → POST API → Invalidate list queries → Navigate to detail

### EntitySelect / EntityMultiSelect (Dropdowns)

```
<EntitySelect entityCode="employee" value={uuid} onChange={...} />
```

**Cache Pattern:**
- **Query Key**: `['entityInstanceNames', entityCode]`
- **Data Source**: `useRefDataEntityInstanceOptions(entityCode)`
- **Data Structure**: `{ uuid: name }` lookup table
- **Population**: Login prefetch (250+) + API upserts (incremental)

**Flow:**
1. Dropdown renders → `useRefDataEntityInstanceOptions('employee')`
2. Cache HIT (from login prefetch) → 250 options instantly
3. No loading spinner (data already cached)

### BadgeDropdownSelect (Status Fields)

```
<BadgeDropdownSelect datalabelKey="project_stage" value={id} onChange={...} />
```

**Cache Pattern:**
- **Query Key**: `['datalabel', key]`
- **Data Source**: `useDatalabel(key)`
- **Data Structure**: `[{ id, name, color_code, sort_order }]`
- **Population**: Login prefetch via `prefetchAllDatalabels()`

**Flow:**
1. Dropdown renders → `useDatalabel('project_stage')`
2. Cache HIT → Options with colors displayed
3. Non-hook access: `getDatalabelSync('project_stage')` for formatters

### DynamicChildEntityTabs (Child Entity Tabs)

```
Project detail page with Task, Employee, Artifact tabs
```

**Cache Pattern:**
- **Tab List**: From `entity.child_entity_codes` via `['entityCodes']`
- **Tab Content**: `['entity-list', childCode, { parent_id, parent_code }]`
- **Lazy Loading**: Each tab fetches on first click

**Flow:**
1. Parent detail loads → Get `child_entity_codes` from entity metadata
2. Render tab headers with counts (parallel count queries)
3. User clicks tab → Fetch child list with parent filter
4. Child data cached independently

### SettingsDataTable (Datalabel Editor)

```
/settings/data-labels, /setting/:category
```

**Cache Pattern:**
- **Query Key**: `['datalabel', category]` or `['datalabel', 'all']`
- **Data Source**: `useDatalabel(category)` or `useAllDatalabels()`
- **Mutations**: Invalidate `['datalabel', key]` on save

**Flow:**
1. Settings page loads → `useAllDatalabels()` fetches all
2. User edits → Local state (not draft, immediate save expected)
3. Save → API PATCH → `invalidateQueries(['datalabel', key])`
4. TanStack Query cache auto-updated via invalidation → refetch

---

## Key Design Principles

### 1. Single QueryClient (CRITICAL)

- **ONE QueryClient** from `db/cache/client.ts`
- `CacheProvider` wraps with `QueryClientProvider`
- All hooks read/write to SAME cache
- **Anti-pattern**: Creating multiple `QueryClient` instances causes cache isolation

### 2. Upsert Always Merges

```typescript
// CORRECT: Merge pattern
queryClient.setQueryData(key, (old) => ({ ...(old || {}), ...new }));

// WRONG: Replace pattern (loses existing data)
queryClient.setQueryData(key, newData);
```

### 3. Prefetch is Awaited

```typescript
// AuthContext.tsx
await prefetchRefDataEntityInstances(queryClient, ['employee', 'project', ...]);
// Page renders AFTER cache is populated
```

### 4. Format-at-Read, Not Format-at-Fetch

- Cache stores RAW data (small, canonical)
- Formatting happens via TanStack Query's `select` option
- Memoized by React Query

### 5. Sync Cache for Non-Hook Access

```typescript
// Inside React component (hook)
const { options } = useDatalabel('project_stage');

// Outside React (formatter, utility)
const options = getDatalabelSync('project_stage');
```

### 6. Cache-First, Network-Second

```
1. Check TanStack Query memory cache
2. Check Dexie IndexedDB (if hydrated)
3. Fetch from API (last resort)
4. Store in both caches
```

---

## Component → Cache Mapping (v11.1.0)

| Component | Cache Query Key | Hook | Metadata Format |
|-----------|-----------------|------|-----------------|
| `EntityListOfInstancesPage` | `['entityInstanceData', code, params]` + `['entityInstanceMetadata', code, 'entityListOfInstancesTable']` | `useEntityInstanceData` + `useEntityInstanceMetadata` | Flat `{ viewType, editType }` |
| `EntitySpecificInstancePage` | `['entityInstance', code, id]` + `['entityInstanceMetadata', code, 'entityInstanceFormContainer']` | `useEntity` + `useEntityInstanceMetadata` | Flat `{ viewType, editType }` |
| `EntityCreatePage` | Dexie `draft` table | `useDraft` | - |
| `EntitySelect` | `['entityInstanceNames', code]` | `useRefDataEntityInstanceOptions` | - |
| `BadgeDropdownSelect` | `['datalabel', key]` | `useDatalabel` | - |
| `DynamicChildEntityTabs` | `['entityInstanceData', childCode, ...]` + `['entityInstanceMetadata', childCode, 'entityListOfInstancesTable']` | `useEntityInstanceData` + `useEntityInstanceMetadata` | Flat `{ viewType, editType }` |
| `SettingsDataTable` | `['datalabel', category]` | `useDatalabel` | - |
| `EntityDetailView` | `['entityInstance', code, id]` | `useEntity` | - |
| `EntityInstanceFormContainer` | `['entityInstance', code, id]` + draft | `useEntity` + `useDraft` | Flat `{ viewType, editType }` |

---

## Login Prefetch Sequence (v11.1.0)

```
1. User logs in
   │
2. Store token in localStorage
   │
3. await Promise.all([
   │   prefetchAllDatalabels(),      // ['datalabel', *] → TanStack + Dexie
   │   prefetchEntityCodes(),        // ['entityCodes'] → TanStack + Dexie
   │   prefetchGlobalSettings(),     // ['globalSettings'] → TanStack + Dexie
   │ ])
   │
4. await prefetchRefDataEntityInstances(queryClient, [
   │   'employee', 'project', 'business', 'office', 'role', 'cust'
   │ ])
   │   // ['entityInstanceNames', code] → TanStack + Dexie (250+ per entity)
   │
5. setState({ isAuthenticated: true })
   │
6. Page renders with ALL CACHES POPULATED
   │
   (v11.1.0: Single in-memory cache - TanStack Query only, flat metadata format)
```

---

## Console Debugging (v11.1.0)

```javascript
// Check cache statistics
import { getCacheStats } from '@/db/tanstack-index';
getCacheStats();  // { globalSettings: true, datalabelKeys: [...], ... }

// Debug ref_data_entityInstance cache
window.__debugRefDataEntityInstance();

// React Query DevTools (in development)
// Shows all cached queries, stale state, fetch status

// Check Dexie tables
const { db } = await import('@/db/persistence/schema');
await db.datalabel.toArray();           // All datalabels
await db.entityInstanceNames.toArray(); // All entity names
await db.draft.toArray();               // All drafts
await db.entityInstanceData.toArray();  // All cached entity data
```
