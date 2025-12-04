# Cache Lifecycle

**Version:** 12.1.0 | **Updated:** 2025-12-03

---

## Overview

This document describes the complete cache implementation including TTL configuration, prefetch strategies, key structures, Dexie (IndexedDB) persistence, component interaction patterns, and cache chain flow.

The PMO frontend uses a two-tier caching architecture:

1. **TanStack Query (In-Memory)** - Single source of truth for all cache access
2. **Dexie (IndexedDB)** - Persistent storage that survives browser restart

---

## Cache Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         PMO FRONTEND CACHE ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                     REACT COMPONENTS                                     │    │
│  │  EntityListOfInstancesPage, EntitySpecificInstancePage, Forms, etc.     │    │
│  └─────────────────────────┬───────────────────────────────────────────────┘    │
│                            │                                                     │
│                            ▼                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                     CUSTOM HOOKS LAYER                                   │    │
│  │  useDatalabel(), useEntityCodes(), useEntityInstanceData()              │    │
│  │  useEntityInstanceMetadata(), useDraft(), useOptimisticMutation()       │    │
│  │  useInlineAddRow()                                                      │    │
│  └─────────────────────────┬───────────────────────────────────────────────┘    │
│                            │                                                     │
│                            ▼                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │              TANSTACK QUERY (IN-MEMORY CACHE)                            │    │
│  │  • queryClient.getQueryData() - sync reads                               │    │
│  │  • queryClient.setQueryData() - sync writes                              │    │
│  │  • useQuery() - async fetches with background refresh                    │    │
│  │  • Stale-while-revalidate pattern                                        │    │
│  └──────────────┬──────────────────────────────────────────┬────────────────┘    │
│                 │                                          │                     │
│        ┌────────▼────────┐                        ┌────────▼────────┐           │
│        │  SYNC ACCESSORS │                        │     PERSIST     │           │
│        │ getDatalabelSync│                        │   persistTo*()  │           │
│        │ getEntityCodeSync                        │                 │           │
│        │ getEntityInstanceNameSync                │                 │           │
│        └─────────────────┘                        └────────┬────────┘           │
│                                                            │                     │
│                                                            ▼                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                    DEXIE (INDEXEDDB PERSISTENCE)                         │    │
│  │  • 9 tables: globalSettings, datalabel, entityCodes, entityInstanceNames │    │
│  │             entityLinkForward, entityLinkReverse, entityInstanceMetadata │    │
│  │             entityInstanceData, draft                                    │    │
│  │  • Survives browser restart                                              │    │
│  │  • Hydrated to TanStack Query on app start (if <30 min old)             │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│                            ▲                                                     │
│                            │ WebSocket INVALIDATE                                │
│                            │                                                     │
│  ┌─────────────────────────┴───────────────────────────────────────────────┐    │
│  │                    PUBSUB SERVICE (:4001)                                │    │
│  │  • Real-time cache invalidation                                          │    │
│  │  • queryClient.invalidateQueries() triggers refetch                      │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## TTL Configuration (constants.ts)

All cache timing is centralized in `apps/web/src/db/cache/constants.ts`.

### Session-Level Stores (6 stores)

Prefetched on login, background refresh enabled.

```typescript
export const SESSION_STORE_CONFIG = {
  staleTime: 10 * 60 * 1000,           // 10 minutes - triggers background refetch
  gcTime: 60 * 60 * 1000,              // 1 hour - garbage collection
  backgroundRefreshInterval: 10 * 60 * 1000,  // 10 minutes
  persistMaxAge: 24 * 60 * 60 * 1000,  // 24 hours - Dexie TTL
};
```

### On-Demand Store (entityInstanceData only)

Never prefetched, fetched when component mounts.

```typescript
export const ONDEMAND_STORE_CONFIG = {
  staleTime: 1 * 60 * 1000,            // 1 minute
  gcTime: 30 * 60 * 1000,              // 30 minutes
  persistMaxAge: 30 * 60 * 1000,       // 30 minutes - Dexie TTL
};
```

### Hydration Configuration

Controls what data is loaded from IndexedDB on app startup.

```typescript
export const HYDRATION_CONFIG = {
  maxAge: 30 * 60 * 1000,  // 30 minutes - older data is skipped
};
```

### Per-Store Stale Times

Fine-grained control for specific stores:

| Store | Stale Time | GC Time | Dexie TTL |
|-------|------------|---------|-----------|
| `globalSettings` | 10 min | 1 hour | 24 hours |
| `datalabel` | 10 min | 1 hour | 24 hours |
| `entityCodes` | 30 min | 1 hour | 24 hours |
| `entityInstanceNames` | 10 min | 1 hour | 24 hours |
| `entityLinks` | 5 min | 1 hour | 24 hours |
| `entityInstanceMetadata` | 1 min | 1 hour | 24 hours |
| `entityInstanceData` | 1 min | 30 min | 30 min |

---

## Query Keys (QUERY_KEYS)

TanStack Query uses tuple-based keys for cache management. Defined in `apps/web/src/db/cache/keys.ts`.

### Key Factory Examples

```typescript
export const QUERY_KEYS = {
  // Session-Level Stores
  globalSettings: () => ['globalSettings'] as const,
  datalabel: (key: string) => ['datalabel', key] as const,
  datalabelAll: () => ['datalabel', '__all__'] as const,
  entityCodes: () => ['entityCodes'] as const,
  entityInstanceNames: (entityCode: string) => ['entityInstanceNames', entityCode] as const,
  entityInstanceMetadata: (entityCode: string, component: string) =>
    ['entityInstanceMetadata', entityCode, component] as const,

  // On-Demand Store
  entityInstanceData: (entityCode: string, params: Record<string, unknown>) =>
    ['entityInstanceData', entityCode, params] as const,
  entityInstance: (entityCode: string, entityId: string) =>
    ['entityInstance', entityCode, entityId] as const,

  // Draft Store
  draft: (entityCode: string, entityId: string) =>
    ['draft', entityCode, entityId] as const,
};
```

### Cache Key Examples (Actual Storage)

| Data Type | Query Key | Example |
|-----------|-----------|---------|
| Datalabel | `['datalabel', 'dl__project_stage']` | Project stage options |
| Entity Codes | `['entityCodes']` | All entity type definitions |
| Entity Instance Names | `['entityInstanceNames', 'employee']` | Employee UUID→Name map |
| Entity Instance Data | `['entityInstanceData', 'project', { limit: 20, offset: 0 }]` | Project list results |
| Entity Metadata | `['entityInstanceMetadata', 'project', 'entityListOfInstancesTable']` | Project field definitions |
| Draft | `['draft', 'project', 'uuid-123']` | Unsaved project edits |

---

## Dexie Keys (DEXIE_KEYS)

IndexedDB uses string-based primary keys. Defined in `apps/web/src/db/cache/keys.ts`.

```typescript
export const DEXIE_KEYS = {
  globalSettings: () => 'settings',
  datalabel: (key: string) => (key.startsWith('dl__') ? key.slice(4) : key),
  entityCodes: () => 'all',
  entityInstanceName: (entityCode: string, entityInstanceId: string) =>
    `${entityCode}:${entityInstanceId}`,
  entityLinkForward: (parentCode: string, parentId: string, childCode: string) =>
    `${parentCode}:${parentId}:${childCode}`,
  entityInstanceMetadata: (entityCode: string, component: string) =>
    `${entityCode}:${component}`,
  entityInstanceData: (entityCode: string, params: Record<string, unknown>) =>
    `${entityCode}:${createQueryHash(params)}`,
  draft: (entityCode: string, entityId: string) =>
    `draft:${entityCode}:${entityId}`,
};
```

### Dexie Key Examples

| Data Type | Dexie Key | Example |
|-----------|-----------|---------|
| Global Settings | `'settings'` | Single record |
| Datalabel | `'project_stage'` | Stripped of `dl__` prefix |
| Entity Codes | `'all'` | Single record with all codes |
| Entity Instance Name | `'employee:uuid-123'` | Composite key |
| Entity Link Forward | `'project:uuid-1:task'` | Parent→Child index |
| Entity Metadata | `'project:entityListOfInstancesTable'` | Per entity per component |
| Draft | `'draft:project:uuid-123'` | Prefixed for identification |

---

## Dexie Schema (v5)

Database schema defined in `apps/web/src/db/persistence/schema.ts`.

```typescript
export class CacheDatabase extends Dexie {
  // Session-Level Stores
  globalSettings!: Table<GlobalSettingsRecord, string>;
  datalabel!: Table<DatalabelRecord, string>;
  entityCodes!: Table<EntityCodesRecord, string>;
  entityInstanceNames!: Table<EntityInstanceNameRecord, string>;
  entityLinkForward!: Table<EntityLinkForwardRecord, string>;
  entityLinkReverse!: Table<EntityLinkReverseRecord, string>;
  entityInstanceMetadata!: Table<EntityInstanceMetadataRecord, string>;

  // On-Demand Store
  entityInstanceData!: Table<EntityInstanceDataRecord, string>;

  // Special Store (survives logout)
  draft!: Table<DraftRecord, string>;

  constructor() {
    super('pmo-cache-v5');

    this.version(1).stores({
      globalSettings: '_id',
      datalabel: '_id, key',
      entityCodes: '_id',
      entityInstanceNames: '_id, entityCode, entityInstanceId, [entityCode+entityInstanceId]',
      entityLinkForward: '_id, parentCode, parentId, childCode, [parentCode+parentId+childCode]',
      entityLinkReverse: '_id, childCode, childId, [childCode+childId]',
      entityInstanceMetadata: '_id, entityCode',
      entityInstanceData: '_id, entityCode, queryHash, syncedAt',
      draft: '_id, entityCode, entityId, updatedAt',
    });
  }
}
```

### Dexie Record Structures

```typescript
// Datalabel Record
interface DatalabelRecord {
  _id: string;              // 'project_stage'
  key: string;              // 'project_stage'
  options: DatalabelOption[];
  syncedAt: number;         // Unix timestamp
}

// Entity Instance Data Record
interface EntityInstanceDataRecord {
  _id: string;              // 'project:{"limit":20,"offset":0}'
  entityCode: string;       // 'project'
  queryHash: string;        // '{"limit":20,"offset":0}'
  params: Record<string, unknown>;
  data: Record<string, unknown>[];
  total: number;
  metadata?: EntityInstanceMetadata;
  refData?: Record<string, Record<string, string>>;
  syncedAt: number;
}

// Draft Record
interface DraftRecord {
  _id: string;              // 'draft:project:uuid-123'
  entityCode: string;
  entityId: string;
  originalData: Record<string, unknown>;
  currentData: Record<string, unknown>;
  undoStack: Record<string, unknown>[];
  redoStack: Record<string, unknown>[];
  updatedAt: number;
}
```

---

## Cache Chain Flow

### Flow 1: Component Reads Data

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    COMPONENT DATA READ FLOW                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  EntityListOfInstancesPage                                                    │
│       │                                                                       │
│       ▼                                                                       │
│  useEntityInstanceData('project', { limit: 20 })                             │
│       │                                                                       │
│       ▼                                                                       │
│  useQuery({                                                                   │
│    queryKey: ['entityInstanceData', 'project', { limit: 20 }],               │
│    queryFn: async () => {                                                     │
│      // 1. Check Dexie cache first                                           │
│      const cached = await getEntityInstanceData('project', params);          │
│      if (cached && !isStale(cached.syncedAt)) return cached;                 │
│                                                                               │
│      // 2. Fetch from API                                                     │
│      const response = await apiClient.get('/api/v1/project', { params });    │
│                                                                               │
│      // 3. Persist to Dexie                                                   │
│      await setEntityInstanceData('project', params, response.data);          │
│                                                                               │
│      // 4. Upsert ref_data_entityInstance to TanStack Query cache            │
│      upsertRefDataEntityInstance(response.ref_data_entityInstance);          │
│                                                                               │
│      return response;                                                         │
│    },                                                                         │
│    staleTime: 1 * 60 * 1000,  // 1 minute                                    │
│  })                                                                           │
│       │                                                                       │
│       ▼                                                                       │
│  Component renders with { data, isLoading, refetch }                         │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Flow 2: Sync Accessor (Formatters)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    SYNC ACCESSOR FLOW (for formatters)                        │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  formatBadge(value, { lookupField: 'dl__project_stage' })                    │
│       │                                                                       │
│       ▼                                                                       │
│  getDatalabelSync('dl__project_stage')                                       │
│       │                                                                       │
│       ▼                                                                       │
│  queryClient.getQueryData(['datalabel', 'dl__project_stage'])                │
│       │                                                                       │
│       ├── Cache HIT → DatalabelOption[]                                      │
│       │       │                                                               │
│       │       ▼                                                               │
│       │   Find option by name → get color_code → Tailwind class              │
│       │                                                                       │
│       └── Cache MISS → null                                                   │
│               │                                                               │
│               ▼                                                               │
│           Return default gray: 'bg-gray-100 text-gray-600'                   │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Flow 3: Prefetch on Login

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    PREFETCH ON LOGIN FLOW                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  AuthContext.login()                                                          │
│       │                                                                       │
│       ▼                                                                       │
│  await Promise.all([                                                          │
│    prefetchAllDatalabels(),    ◄── GET /api/v1/datalabel/all                 │
│    prefetchEntityCodes(),      ◄── GET /api/v1/entity/types                  │
│    prefetchGlobalSettings(),   ◄── GET /api/v1/settings                      │
│  ])                                                                           │
│       │                                                                       │
│       ▼                                                                       │
│  For each datalabel:                                                          │
│    queryClient.setQueryData(['datalabel', key], options)  ◄── TanStack      │
│    await setDatalabel(key, options)                       ◄── Dexie          │
│       │                                                                       │
│       ▼                                                                       │
│  await prefetchRefDataEntityInstances([                                       │
│    'employee', 'project', 'business', 'office', 'role', 'cust'               │
│  ])                                                                           │
│       │                                                                       │
│       ▼                                                                       │
│  queryClient.setQueryData(['entityInstanceNames', entityCode], names)        │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Flow 4: Hydration on App Start

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    HYDRATION ON APP START                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  CacheProvider.useEffect()                                                    │
│       │                                                                       │
│       ▼                                                                       │
│  hydrateFromDexie()                                                           │
│       │                                                                       │
│       ▼                                                                       │
│  await Promise.allSettled([                                                   │
│    hydrateGlobalSettings(now, maxAge),                                        │
│    hydrateDatalabels(now, maxAge),        ◄── Only if syncedAt < 30 min      │
│    hydrateEntityCodes(now, maxAge),                                          │
│    hydrateEntityInstanceNames(now, maxAge),                                  │
│    hydrateEntityInstanceMetadata(now, maxAge),                               │
│  ])                                                                           │
│       │                                                                       │
│       ▼                                                                       │
│  For each fresh record:                                                       │
│    queryClient.setQueryData(queryKey, data)   ◄── Populate TanStack cache   │
│       │                                                                       │
│       ▼                                                                       │
│  Result: Instant render with cached data, then background refresh            │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Flow 5: WebSocket Invalidation

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    WEBSOCKET INVALIDATION FLOW                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  PubSub Service (:4001)                                                       │
│       │                                                                       │
│       ▼                                                                       │
│  WebSocket message: { type: 'INVALIDATE', payload: { entityCode: 'project' }}│
│       │                                                                       │
│       ▼                                                                       │
│  WebSocketManager.handleInvalidate(payload)                                   │
│       │                                                                       │
│       ▼                                                                       │
│  queryClient.invalidateQueries({                                              │
│    queryKey: ['entityInstanceData', 'project']                               │
│  })                                                                           │
│       │                                                                       │
│       ▼                                                                       │
│  TanStack Query marks queries as stale                                        │
│       │                                                                       │
│       ▼                                                                       │
│  Active queries auto-refetch → API → Update cache → Component re-renders     │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Flow 6: Inline Add Row Cache Operations (v11.3.1)

The `useInlineAddRow` hook implements TanStack Query's single source of truth pattern
for inline editing. The cache is the ONLY data store - no local state copying.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    INLINE ADD ROW CACHE FLOW                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  User clicks "Add new row"                                                    │
│       │                                                                       │
│       ▼                                                                       │
│  handleAddRow(newRow)                                                         │
│       │                                                                       │
│       ▼                                                                       │
│  queryClient.getQueryCache().findAll({                                        │
│    queryKey: ['entityInstanceData', entityCode]                               │
│  })                                                                           │
│       │                                                                       │
│       ▼                                                                       │
│  For each matching query:                                                     │
│    queryClient.setQueryData(query.queryKey, (oldData) => ({                  │
│      ...oldData,                                                              │
│      data: [...oldData.data, { id: 'temp_123', _isNew: true, ...newRow }],   │
│      total: oldData.total + 1,                                                │
│    }))                                                                        │
│       │                                                                       │
│       ▼                                                                       │
│  Component re-renders with temp row visible in table                          │
│       │                                                                       │
│       ▼                                                                       │
│  User fills fields, clicks Save                                               │
│       │                                                                       │
│       ▼                                                                       │
│  handleSave() → createEntity(data, { existingTempId: 'temp_123' })           │
│       │                                                                       │
│       ▼                                                                       │
│  useOptimisticMutation.onMutate():                                            │
│    • SKIPS adding temp row (existingTempId provided)                          │
│    • Captures allPreviousListData for rollback                                │
│       │                                                                       │
│       ▼                                                                       │
│  API POST → Server returns { id: 'real-uuid-456', ... }                       │
│       │                                                                       │
│       ▼                                                                       │
│  useOptimisticMutation.onSuccess():                                           │
│    • REPLACES temp_123 with real-uuid-456 in all list caches                  │
│    • Updates Dexie with new entity                                            │
│    • Skips refetch (skipRefetch: true when existingTempId used)               │
│       │                                                                       │
│       ▼                                                                       │
│  Component re-renders with real entity data                                   │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Cancel Flow:**
```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    INLINE ADD ROW CANCEL FLOW                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  User clicks Cancel (while editing temp row)                                  │
│       │                                                                       │
│       ▼                                                                       │
│  handleCancel()                                                               │
│       │                                                                       │
│       ▼                                                                       │
│  if (isAddingRow && editingRow) {                                             │
│    removeRowFromCache(editingRow)  // 'temp_123'                              │
│  }                                                                            │
│       │                                                                       │
│       ▼                                                                       │
│  For each matching query:                                                     │
│    queryClient.setQueryData(query.queryKey, (oldData) => ({                  │
│      ...oldData,                                                              │
│      data: oldData.data.filter(item => item.id !== 'temp_123'),              │
│      total: oldData.total - 1,                                                │
│    }))                                                                        │
│       │                                                                       │
│       ▼                                                                       │
│  Component re-renders without temp row                                        │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Error Flow:**
```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    INLINE ADD ROW ERROR FLOW                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  API POST fails with error                                                    │
│       │                                                                       │
│       ▼                                                                       │
│  useOptimisticMutation.onError():                                             │
│    • Removes temp row from all list caches                                    │
│    • Shows error toast                                                        │
│       │                                                                       │
│       ▼                                                                       │
│  For each query in allPreviousListData:                                       │
│    queryClient.setQueryData(queryKey, previousData)                          │
│       │                                                                       │
│       ▼                                                                       │
│  Component re-renders with original data (temp row removed)                   │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Key Implementation Details:**

| Aspect | Implementation |
|--------|----------------|
| Temp row ID | `temp_${Date.now()}` - always starts with `temp_` |
| Cache manipulation | `queryClient.setQueryData()` - direct sync writes |
| Query discovery | `queryClient.getQueryCache().findAll()` - finds all matching caches |
| Duplicate prevention | `existingTempId` option skips `onMutate` temp row creation |
| Navigation blocking | `shouldBlockNavigation(rowId)` - blocks clicks on temp rows |

---

## Component ↔ Cache Interaction

### Hook Usage Examples

```typescript
// ============================================================================
// DATALABEL - Session-level, prefetched on login
// ============================================================================
function ProjectForm() {
  // Hook access (reactive)
  const { options, isLoading, getByName } = useDatalabel('dl__project_stage');

  // Sync access (non-reactive, for formatters)
  const options = getDatalabelSync('dl__project_stage');
}

// ============================================================================
// ENTITY INSTANCE DATA - On-demand, fetched when component mounts
// ============================================================================
function ProjectListPage() {
  const {
    data,           // Project[]
    total,          // Total count
    isLoading,      // Initial load
    isFetching,     // Background refetch
    isStale,        // Data older than staleTime
    refetch,        // Manual refetch
  } = useEntityInstanceData('project', { limit: 20, offset: 0 });
}

// ============================================================================
// ENTITY INSTANCE METADATA - On-demand with longer TTL
// ============================================================================
function ProjectTable() {
  const {
    viewType,       // { code: { renderType: 'text', ... }, ... }
    editType,       // { code: { inputType: 'text', ... }, ... }
    fields,         // ['code', 'name', 'dl__project_stage', ...]
    isLoading,
  } = useEntityInstanceMetadata('project', 'entityListOfInstancesTable');
}

// ============================================================================
// DRAFT - Persists across page refresh, survives logout
// ============================================================================
function ProjectEditForm({ projectId }) {
  const {
    currentData,    // Current edited values
    originalData,   // Original values before edits
    hasChanges,     // currentData !== originalData
    updateField,    // (field, value) => void
    undo,           // Revert last change
    redo,           // Restore undone change
    save,           // Persist to server
    discard,        // Reset to original
  } = useDraft('project', projectId);
}

// ============================================================================
// ENTITY INSTANCE NAMES - For resolving UUIDs to display names
// ============================================================================
function EmployeeDropdown() {
  const { names, getName } = useEntityInstanceNames('employee');
  // names = { 'uuid-1': 'James Miller', 'uuid-2': 'Sarah Connor', ... }

  // Sync access (for formatters)
  const name = getEntityInstanceNameSync('employee', 'uuid-1');
}

// ============================================================================
// INLINE ADD ROW - Reusable inline editing with cache as single source (v11.3.1)
// ============================================================================
function EntityTableWithInlineEdit() {
  const { createEntity, updateEntity } = useOptimisticMutation('project');

  const {
    editingRow,       // Currently editing row ID (null if not editing)
    editedData,       // Accumulated field changes
    isAddingRow,      // True if adding new row (vs editing existing)
    isSaving,         // Save in progress
    handleAddRow,     // Add temp row to cache + enter edit mode
    handleEditRow,    // Enter edit mode for existing row
    handleFieldChange,// Update field in editedData
    handleSave,       // Save to server (uses existingTempId for new rows)
    handleCancel,     // Cancel edit + remove temp row from cache
    isRowEditing,     // Check if specific row is being edited
    isTempRow,        // Check if row ID is temp (not saved yet)
  } = useInlineAddRow({
    entityCode: 'project',
    createEntity,
    updateEntity,
    debug: false,
  });

  // Add new row button
  const handleAddClick = () => {
    const newRow = createTempRow<Project>({
      defaults: { dl__project_stage: 'planning' },
      generateName: () => 'New Project',
    });
    handleAddRow(newRow);
  };

  // Block navigation to temp rows
  const handleRowClick = (row: Project) => {
    if (shouldBlockNavigation(row.id)) return; // temp_ rows can't navigate
    navigate(`/project/${row.id}`);
  };
}
```

### Sync Accessor Methods

For non-React code (formatters, utilities), use sync accessors:

```typescript
import {
  getDatalabelSync,
  getEntityCodesSync,
  getEntityCodeSync,
  getEntityInstanceNameSync,
  getGlobalSettingsSync,
  getSettingSync,
} from '@/db/tanstack-index';

// In formatter (called during render, must be sync)
export function formatBadge(value: any, metadata?: FieldMetadata): FormattedValue {
  if (metadata?.lookupField) {
    const options = getDatalabelSync(metadata.lookupField);
    if (options) {
      const match = options.find(opt => opt.name === value);
      if (match?.color_code) {
        return { display: value, style: colorCodeToTailwindClass(match.color_code) };
      }
    }
  }
  return { display: value, style: 'bg-gray-100 text-gray-600' };
}
```

---

## Cache Storage Examples

### Example: Datalabel Cache

**TanStack Query:**
```
queryKey: ['datalabel', 'dl__project_stage']
data: [
  { id: 0, name: 'Initiation', color_code: 'blue', sort_order: 0, ... },
  { id: 1, name: 'Planning', color_code: 'purple', sort_order: 1, ... },
  { id: 2, name: 'Execution', color_code: 'yellow', sort_order: 2, ... },
  { id: 3, name: 'Closure', color_code: 'green', sort_order: 3, ... },
]
```

**Dexie IndexedDB:**
```
Table: datalabel
Record: {
  _id: 'dl__project_stage',
  key: 'dl__project_stage',
  options: [
    { id: 0, name: 'Initiation', color_code: 'blue', sort_order: 0, ... },
    { id: 1, name: 'Planning', color_code: 'purple', sort_order: 1, ... },
    ...
  ],
  syncedAt: 1701475200000
}
```

### Example: Entity Instance Data Cache

**TanStack Query:**
```
queryKey: ['entityInstanceData', 'project', { limit: 20, offset: 0 }]
data: {
  data: [
    { id: 'uuid-1', code: 'PROJ-001', name: 'Kitchen Renovation', dl__project_stage: 'Planning', ... },
    { id: 'uuid-2', code: 'PROJ-002', name: 'Bathroom Update', dl__project_stage: 'Execution', ... },
  ],
  total: 42,
  metadata: { viewType: {...}, editType: {...} },
  ref_data_entityInstance: {
    employee: { 'uuid-james': 'James Miller', 'uuid-sarah': 'Sarah Connor' }
  }
}
```

**Dexie IndexedDB:**
```
Table: entityInstanceData
Record: {
  _id: 'project:{"limit":20,"offset":0}',
  entityCode: 'project',
  queryHash: '{"limit":20,"offset":0}',
  params: { limit: 20, offset: 0 },
  data: [...],
  total: 42,
  metadata: {...},
  refData: { employee: {...} },
  syncedAt: 1701475200000
}
```

### Example: Entity Instance Names Cache

**TanStack Query:**
```
queryKey: ['entityInstanceNames', 'employee']
data: {
  'uuid-james': 'James Miller',
  'uuid-sarah': 'Sarah Connor',
  'uuid-john': 'John Smith',
  ...
}
```

**Dexie IndexedDB:**
```
Table: entityInstanceNames
Records: [
  { _id: 'employee:uuid-james', entityCode: 'employee', entityInstanceId: 'uuid-james', name: 'James Miller', syncedAt: ... },
  { _id: 'employee:uuid-sarah', entityCode: 'employee', entityInstanceId: 'uuid-sarah', name: 'Sarah Connor', syncedAt: ... },
  ...
]
```

---

## Sign-Out: Cache Flush

All caches are flushed during sign-out (except drafts).

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    SIGN-OUT FLOW                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  AuthContext.logout()                                                         │
│     1. authApi.logout()               → API call to server                   │
│     2. localStorage.removeItem('auth_token')                                 │
│     3. clearAllCaches()               → Dexie + TanStack Query               │
│            queryClient.clear()        → In-memory cache                      │
│            clearAllExceptDrafts()     → IndexedDB tables                     │
│     4. queryClient.clear()            → Redundant but safe                   │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### What Gets Cleared on Sign-Out

| Cache Layer | Cleared? | Details |
|-------------|----------|---------|
| TanStack Query (in-memory) | Yes | `queryClient.clear()` |
| Dexie - globalSettings | Yes | `db.globalSettings.clear()` |
| Dexie - datalabel | Yes | `db.datalabel.clear()` |
| Dexie - entityCodes | Yes | `db.entityCodes.clear()` |
| Dexie - entityInstanceNames | Yes | `db.entityInstanceNames.clear()` |
| Dexie - entityLinkForward | Yes | `db.entityLinkForward.clear()` |
| Dexie - entityLinkReverse | Yes | `db.entityLinkReverse.clear()` |
| Dexie - entityInstanceMetadata | Yes | `db.entityInstanceMetadata.clear()` |
| Dexie - entityInstanceData | Yes | `db.entityInstanceData.clear()` |
| Dexie - **draft** | **No** | Survives logout intentionally |
| localStorage auth_token | Yes | Removed |

---

## Sign-In: Cache Build-Up

All session-level caches are built up during sign-in.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    SIGN-IN FLOW                                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  CacheProvider (on mount)                                                     │
│     hydrateFromDexie()          → Load IndexedDB → TanStack                  │
│          hydrateGlobalSettings()                                              │
│          hydrateDatalabels()                                                  │
│          hydrateEntityCodes()                                                 │
│          hydrateEntityInstanceNames()                                         │
│          hydrateEntityInstanceMetadata()                                      │
│       (Only hydrates data < 30 min old)                                       │
│                                                                               │
│  AuthContext.login()                                                          │
│     1. authApi.login()                                                        │
│     2. localStorage.setItem('auth_token')                                     │
│     3. loadMetadata() (parallel)                                              │
│            prefetchAllDatalabels()  → API → TanStack + Dexie                 │
│            prefetchEntityCodes()    → API → TanStack + Dexie                 │
│            prefetchGlobalSettings() → API → TanStack + Dexie                 │
│     4. prefetchRefDataEntityInstances() (awaited)                             │
│             Prefetch: employee, project, business, office, role, cust        │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Method Reference

### Prefetch Methods

| Method | Source | Destination | Triggered |
|--------|--------|-------------|-----------|
| `prefetchAllDatalabels()` | `/api/v1/datalabel/all` | TanStack + Dexie | Login |
| `prefetchEntityCodes()` | `/api/v1/entity/types` | TanStack + Dexie | Login |
| `prefetchGlobalSettings()` | `/api/v1/settings` | TanStack + Dexie | Login |
| `prefetchRefDataEntityInstances()` | `/api/v1/{entity}?fields=id,name` | TanStack + Dexie | Login |

### Hydration Methods

| Method | Source | Destination | Triggered |
|--------|--------|-------------|-----------|
| `hydrateFromDexie()` | Dexie (all tables) | TanStack Query | App start |
| `hydrateGlobalSettings()` | `db.globalSettings` | `queryClient` | App start |
| `hydrateDatalabels()` | `db.datalabel` | `queryClient` | App start |
| `hydrateEntityCodes()` | `db.entityCodes` | `queryClient` | App start |
| `hydrateEntityInstanceNames()` | `db.entityInstanceNames` | `queryClient` | App start |
| `hydrateEntityInstanceMetadata()` | `db.entityInstanceMetadata` | `queryClient` | App start |

### Sync Accessor Methods

| Method | Query Key | Returns |
|--------|-----------|---------|
| `getDatalabelSync(key)` | `['datalabel', key]` | `DatalabelOption[] \| null` |
| `getEntityCodesSync()` | `['entityCodes']` | `EntityCode[] \| null` |
| `getEntityCodeSync(code)` | `['entityCodes']` | `EntityCode \| null` |
| `getEntityInstanceNameSync(entityCode, id)` | `['entityInstanceNames', entityCode]` | `string \| null` |
| `getGlobalSettingsSync()` | `['globalSettings']` | `GlobalSettings \| null` |
| `getSettingSync(key)` | `['globalSettings']` | `value \| null` |

### Clear Methods

| Method | Clears |
|--------|--------|
| `clearAllCaches()` | All TanStack + Dexie (except drafts) |
| `clearDatalabelCache(key?)` | Specific or all datalabels |
| `clearEntityInstanceData(entityCode?)` | Specific or all entity data |
| `clearEntityInstanceMetadata(entityCode?)` | Specific or all metadata |
| `clearDraft(entityCode, entityId)` | Specific draft |

---

## Optimistic Update Rollback (v11.2.0)

When an optimistic update fails, the cache is restored without network access.

```typescript
// useOptimisticMutation.ts

onMutate: async ({ entityId, changes }) => {
  // 1. Cancel outgoing queries
  await queryClient.cancelQueries({ queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode) });

  // 2. Capture ALL previous states
  const allPreviousListData = captureAllListCaches(queryClient, entityCode);
  const previousEntityData = queryClient.getQueryData(QUERY_KEYS.entityInstance(entityCode, entityId));

  // 3. Apply optimistic update
  updateAllListCaches(queryClient, entityCode, changes);

  // 4. Return context for rollback
  return { allPreviousListData, previousEntityData, entityId };
},

onError: (error, { entityId }, context) => {
  // Direct rollback (NO network required)
  if (context?.allPreviousListData) {
    for (const [queryKeyString, previousData] of context.allPreviousListData) {
      queryClient.setQueryData(JSON.parse(queryKeyString), previousData);
    }
  }
  if (context?.previousEntityData) {
    queryClient.setQueryData(QUERY_KEYS.entityInstance(entityCode, entityId), context.previousEntityData);
  }
},
```

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [STATE_MANAGEMENT.md](../state_management/STATE_MANAGEMENT.md) | Full state architecture |
| [NORMALIZED_CACHE_ARCHITECTURE.md](./NORMALIZED_CACHE_ARCHITECTURE.md) | TanStack Query + Dexie details |
| [ref_data_entityInstance.md](./ref_data_entityInstance.md) | Entity reference resolution |
| [TANSTACK_DEXIE_SYNC_ARCHITECTURE.md](../caching/TANSTACK_DEXIE_SYNC_ARCHITECTURE.md) | WebSocket sync |

---

**Version:** 12.0.0 | **Updated:** 2025-12-02 | **Status:** Production
