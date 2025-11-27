# State Management Architecture

**Version:** 8.4.0 | **Location:** `apps/web/src/stores/` | **Updated:** 2025-11-27

---

## Overview (v9.0.0 - RxDB + RxState)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STATE MANAGEMENT (v8.4.0)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐   │
│  │  REACT QUERY - Sole Data Cache + Real-Time Sync                       │   │
│  │  ─────────────────────────────────────────────────────────────────    │   │
│  │  • Stores RAW entity data only (no formatted strings)                 │   │
│  │  • Format-at-read via `select` option (memoized)                      │   │
│  │  • Stale-while-revalidate pattern                                     │   │
│  │  • Optimistic updates with automatic rollback                         │   │
│  │  • ref_data_entityInstance lookup tables for entity references        │   │
│  │  • WebSocket-triggered cache invalidation (v8.4.0)                    │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐   │
│  │  WEBSOCKET SYNC - Real-Time Invalidation (v8.4.0)                     │   │
│  │  ─────────────────────────────────────────────────────────────────    │   │
│  │  • SyncProvider manages WebSocket connection to PubSub service        │   │
│  │  • Auto-subscribe to loaded entity IDs via useAutoSubscribe hook      │   │
│  │  • INVALIDATE messages trigger queryClient.invalidateQueries()        │   │
│  │  • Automatic reconnection with exponential backoff                    │   │
│  │  • Version tracking prevents stale update processing                  │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  BENEFITS:                                                                   │
│  ✓ OFFLINE-FIRST: Works without network connection                          │
│  ✓ PERSISTENT: Data survives browser restart (IndexedDB)                    │
│  ✓ MULTI-TAB: Changes sync across browser tabs automatically                │
│  ✓ DRAFT PERSISTENCE: Unsaved edits survive page refresh!                   │
│  ✓ REACTIVE: Queries auto-update when data changes                          │
│  ✓ UNIFIED: Single library replaces Zustand + React Query                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Single Source of Truth** | React Query caches RAW data only |
| **Format-at-Read** | `select` option transforms on read (memoized) |
| **Backend Metadata** | viewType/editType/lookupEntity from backend (v8.3.1) |
| **ref_data_entityInstance Pattern** | Entity references resolved via lookup table (v8.3.0) |
| **Real-Time Sync** | WebSocket invalidation triggers React Query refetch (v8.4.0) |
| **Separation of Concerns** | Data (React Query) vs Metadata (Zustand) vs Sync (SyncProvider) |
| **Stale-While-Revalidate** | Show cached, refetch in background |
| **Tiered TTL** | Reference (2h) > Metadata (15m) > Lists (30s) > Details (10s) |

---

## File Structure

```
apps/web/src/db/
├── index.ts                      # Database initialization + getDatabase()
├── DatabaseProvider.tsx          # React context provider
├── schemas/
│   ├── index.ts                  # Barrel export
│   ├── entity.schema.ts          # Base entity schema factory
│   ├── project.schema.ts         # Project collection schema
│   ├── task.schema.ts            # Task collection schema
│   ├── employee.schema.ts        # Employee collection schema
│   ├── datalabel.schema.ts       # Datalabel collection schema
│   ├── entityType.schema.ts      # Entity type collection schema
│   └── localDocuments.ts         # RxState type definitions
├── hooks/
│   ├── index.ts                  # Barrel export
│   ├── useDatabase.ts            # Database access hooks
│   ├── useRxQuery.ts             # Collection query hook
│   ├── useRxDocument.ts          # Single document hook
│   ├── useRxMutation.ts          # Mutation hook
│   ├── useRxState.ts             # Local document state hook
│   ├── useGlobalSettings.ts      # → Replaces globalSettingsMetadataStore
│   ├── useDatalabels.ts          # → Replaces datalabelMetadataStore
│   ├── useEntityTypes.ts         # → Replaces entityCodeMetadataStore
│   ├── useComponentMetadata.ts   # → Replaces entityComponentMetadataStore
│   ├── useEntityQuery.ts         # High-level entity queries
│   └── useEntityEditState.ts     # → Replaces useEntityEditStore
└── replication/
    ├── index.ts                  # Replication setup
    ├── entityReplication.ts      # Entity sync (bidirectional)
    └── metadataReplication.ts    # Metadata sync (pull-only)
```

---

## Real-Time Sync Architecture (v8.4.0)

### WebSocket Invalidation Pattern

The frontend uses a WebSocket connection to the PubSub service (port 4001) for real-time cache invalidation. When entities change on the server, the PubSub service pushes INVALIDATE messages that trigger React Query cache invalidation.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  REAL-TIME SYNC FLOW (v8.4.0)                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Client loads entities via REST API                                       │
│     GET /api/v1/project → React Query caches data                           │
│                                                                              │
│  2. useAutoSubscribe sends SUBSCRIBE message                                 │
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
│  7. SyncProvider handles INVALIDATE                                          │
│     queryClient.invalidateQueries(['entity-instance', 'project', '123'])    │
│                                                                              │
│  8. React Query automatically refetches (if component is mounted)            │
│     GET /api/v1/project/123 → Fresh data with RBAC enforced                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Sync Provider

Location: `apps/web/src/db/sync/SyncProvider.tsx`

```typescript
// SyncProvider wraps the application (in App.tsx)
<QueryClientProvider client={queryClient}>
  <AuthProvider>
    <SyncProvider>  {/* WebSocket connection manager */}
      <EntityMetadataProvider>
        <Router>
          {/* App routes */}
        </Router>
      </EntityMetadataProvider>
    </SyncProvider>
  </AuthProvider>
</QueryClientProvider>
```

### useAutoSubscribe Hook

Location: `apps/web/src/db/sync/useAutoSubscribe.ts`

Automatically subscribes to entity IDs when data is loaded:

```typescript
// Inside useEntityInstanceList hook
const entityIds = useMemo(
  () => query.data?.data?.map((item: { id: string }) => item.id) ?? [],
  [query.data?.data]
);
useAutoSubscribe(entityCode, entityIds);  // Subscribe to all loaded IDs
```

### SyncContextValue Interface

```typescript
interface SyncContextValue {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  subscribe: (entityCode: string, entityIds: string[]) => void;
  unsubscribe: (entityCode: string, entityIds?: string[]) => void;
  unsubscribeAll: () => void;
}

// Hook usage (REQUIRED - throws if not in SyncProvider)
const { status, subscribe, unsubscribe } = useSync();
```

### Version Tracking (Out-of-Order Protection)

```typescript
// SyncProvider tracks processed versions to prevent stale updates
const processedVersions = useRef(new Map<string, number>());

const handleInvalidate = (payload) => {
  for (const change of payload.changes) {
    const key = `${payload.entityCode}:${change.entityId}`;
    const lastVersion = processedVersions.current.get(key) || 0;

    // Skip if we've already processed a newer version
    if (change.version <= lastVersion) continue;
    processedVersions.current.set(key, change.version);

    // Invalidate React Query cache
    queryClient.invalidateQueries({
      queryKey: ['entity-instance', payload.entityCode, change.entityId],
    });
  }
};
```

---

## Entity Reference Resolution (v8.3.0)

### Core RxDB Hooks

| Hook | Purpose | Returns |
|------|---------|---------|
| `useRxQuery(collection, options)` | Query collection with filters/sort | `{ data, isLoading, count, refetch }` |
| `useRxQueryPaginated(collection, options)` | Paginated query | `{ data, page, setPage, hasNextPage, ... }` |
| `useRxDocument(collection, id)` | Single document subscription | `{ data, update, softDelete, remove }` |
| `useRxMutation(collection)` | CRUD operations | `{ insert, update, remove, upsert }` |
| `useRxState(key, defaultValue)` | Local document state | `{ state, setState, clear }` |

### Entity-Specific Hooks

| Hook | Purpose | Replaces |
|------|---------|----------|
| `useEntityList(entityCode, params)` | Entity list with formatting | `useFormattedEntityList` |
| `useEntityInstance(entityCode, id)` | Single entity with mutations | `useEntityInstance` |
| `useGlobalSettings()` | Currency/date/boolean formats | `useGlobalSettingsMetadataStore` |
| `useDatalabel(key)` | Dropdown options for one key | `useDatalabelMetadataStore.getDatalabel()` |
| `useAllDatalabels()` | All dropdown options | `useDatalabelMetadataStore` |
| `useEntityTypes()` | Entity type definitions | `useEntityCodeMetadataStore` |
| `useEntityType(code)` | Single entity type | `useEntityCodeMetadataStore.getEntityByCode()` |
| `useComponentMetadata(entity, component)` | viewType/editType | `useEntityComponentMetadataStore` |
| `useEntityEditState(type, id)` | Edit state with undo/redo | `useEntityEditStore` |

### Database Access Hooks

| Hook | Purpose |
|------|---------|
| `useDatabase()` | Get database instance (throws if not ready) |
| `useDatabaseSafe()` | Get database or null |
| `useDatabaseState()` | Loading/error/online status |
| `useOnlineStatus()` | Browser online state |
| `useSyncStatus()` | Replication active state |

---

## Usage Examples

### Query Entity List

```typescript
import { useEntityList } from '@/db/hooks';

function ProjectList() {
  const {
    data,                    // Raw ProjectDoc[]
    formattedData,           // FormattedRow[] with display/styles
    isLoading,
    total,
    page,
    setPage,
    hasNextPage
  } = useEntityList('project', {
    page: 1,
    pageSize: 20,
    search: 'kitchen',
    filters: { dl__project_stage: 'planning' },
    sort: { field: 'updated_ts', order: 'desc' }
  });

  if (isLoading) return <Spinner />;

  return (
    <DataTable
      data={formattedData}
      onPageChange={setPage}
    />
  );
}
```

### Single Entity with Mutations

```typescript
import { useEntityInstance } from '@/db/hooks';

function ProjectDetail({ projectId }: { projectId: string }) {
  const {
    data,
    formattedData,
    isLoading,
    update,
    softDelete
  } = useEntityInstance('project', projectId);

  const handleNameChange = async (newName: string) => {
    await update({ name: newName });
    // RxDB auto-updates, no manual refetch needed!
  };

  const handleDelete = async () => {
    await softDelete();
    // Sets active_flag: false, syncs to backend
  };

  return <ProjectView data={formattedData} onUpdate={handleNameChange} />;
}
```

### Global Settings (Replaces globalSettingsMetadataStore)

```typescript
import { useGlobalSettings } from '@/db/hooks';

function CurrencySettings() {
  const {
    globalSettings,
    setCurrency,
    isLoading
  } = useGlobalSettings();

  const handleSymbolChange = async (symbol: string) => {
    await setCurrency({
      ...globalSettings.currency,
      symbol
    });
    // Persists in IndexedDB, survives browser restart!
  };

  return (
    <Select
      value={globalSettings.currency.symbol}
      onChange={handleSymbolChange}
      options={['$', '€', '£', '¥']}
    />
  );
}
```

### Datalabels (Replaces datalabelMetadataStore)

```typescript
import { useDatalabel, useAllDatalabels } from '@/db/hooks';

// Single datalabel key
function ProjectStageSelect({ value, onChange }) {
  const { options, isLoading } = useDatalabel('project_stage');

  return (
    <Select
      value={value}
      onChange={onChange}
      options={options.map(opt => ({
        value: opt.name,
        label: opt.name,
        color: opt.color_code
      }))}
    />
  );
}

// All datalabels
function SettingsPage() {
  const { datalabels, keys, getDatalabel } = useAllDatalabels();

  return keys.map(key => (
    <DatalabelEditor key={key} options={getDatalabel(key)} />
  ));
}
```

### Edit State with Undo/Redo (Replaces useEntityEditStore)

```typescript
import { useEntityEditState } from '@/db/hooks';

function ProjectEditForm({ projectId }: { projectId: string }) {
  const {
    isEditing,
    currentData,
    dirtyFields,
    hasChanges,
    canUndo,
    canRedo,
    startEdit,
    updateField,
    saveChanges,
    cancelEdit,
    undo,
    redo
  } = useEntityEditState('project', projectId);

  // Start editing with original data
  const handleEdit = async (data: Record<string, unknown>) => {
    await startEdit(data);
  };

  // Update a field (auto-tracks dirty state)
  const handleFieldChange = async (field: string, value: unknown) => {
    await updateField(field, value);
    // undo/redo stack automatically updated
    // Draft persists even if browser refreshes!
  };

  // Save changes to RxDB (syncs to backend)
  const handleSave = async () => {
    const success = await saveChanges();
    if (success) {
      // Edit state cleared, synced to backend
    }
  };

  return (
    <Form>
      <input
        value={currentData.name}
        onChange={(e) => handleFieldChange('name', e.target.value)}
      />
      <button onClick={undo} disabled={!canUndo}>Undo</button>
      <button onClick={redo} disabled={!canRedo}>Redo</button>
      <button onClick={handleSave} disabled={!hasChanges}>Save</button>
      <button onClick={cancelEdit}>Cancel</button>
    </Form>
  );
}
```

---

## DatabaseProvider Setup

```typescript
// App.tsx
import { DatabaseProvider } from '@/db/DatabaseProvider';

function App() {
  const { token, isAuthenticated } = useAuth();

  return (
    <DatabaseProvider
      authToken={token}
      skip={!isAuthenticated}
    >
      <AppRoutes />
    </DatabaseProvider>
  );
}
```

---

## Replication Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REPLICATION FLOW                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ENTITY COLLECTIONS (Bidirectional)                                          │
│  ──────────────────────────────────                                          │
│                                                                              │
│  PULL:                                                                       │
│  GET /api/v1/{entity}/sync?since={timestamp}&limit=100                       │
│  → Returns documents modified since timestamp                                │
│  → Includes soft-deleted (active_flag: false)                                │
│  → RBAC filtering still applies                                              │
│                                                                              │
│  PUSH:                                                                       │
│  POST /api/v1/{entity}          (new document)                               │
│  PATCH /api/v1/{entity}/{id}    (update)                                     │
│  DELETE /api/v1/{entity}/{id}   (soft delete)                                │
│                                                                              │
│  CONFLICT RESOLUTION:                                                        │
│  Server wins (RBAC is authoritative)                                         │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  METADATA COLLECTIONS (Pull-Only)                                            │
│  ─────────────────────────────────                                           │
│                                                                              │
│  datalabel:                                                                  │
│  GET /api/v1/datalabel/all                                                   │
│  → Full refresh every 15 minutes                                             │
│  → Transforms to DatalabelDoc format                                         │
│                                                                              │
│  entity_type:                                                                │
│  GET /api/v1/entity/types                                                    │
│  → Full refresh every 1 hour                                                 │
│  → Transforms to EntityTypeDoc format                                        │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  LOCAL DOCUMENTS (No Sync)                                                   │
│  ──────────────────────────                                                  │
│                                                                              │
│  • global-settings       → Device-specific formatting preferences            │
│  • component-metadata:*  → Cached field metadata with TTL                    │
│  • edit-state:*          → Draft edits (key: {entityType}:{entityId})        │
│  • ui-preferences        → Theme, sidebar state, default views               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Migration from v8.x (Zustand + React Query)

### Hook Migration Map

| v8.x (Old) | v9.x (New) | Notes |
|------------|------------|-------|
| `useQuery(['entity-list', entityCode, params])` | `useEntityList(entityCode, params)` | Reactive, persistent |
| `useQuery(['entity', entityCode, id])` | `useEntityInstance(entityCode, id)` | Includes mutations |
| `useMutation()` | `useRxMutation(collection)` | No manual invalidation |
| `useGlobalSettingsMetadataStore()` | `useGlobalSettings()` | Persists across sessions |
| `useDatalabelMetadataStore()` | `useDatalabel(key)` | Auto-synced |
| `useEntityCodeMetadataStore()` | `useEntityTypes()` | Auto-synced |
| `useEntityComponentMetadataStore()` | `useComponentMetadata(entity, component)` | With TTL |
| `useEntityEditStore()` | `useEntityEditState(type, id)` | **Persists across refresh!** |

### Component Migration Example

```typescript
// BEFORE (v8.x - Zustand + React Query)
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useGlobalSettingsMetadataStore } from '@/stores';

function ProjectList() {
  const queryClient = useQueryClient();
  const { getCurrency } = useGlobalSettingsMetadataStore();

  const { data, isLoading } = useQuery({
    queryKey: ['entity-list', 'project', params],
    queryFn: () => api.get('/api/v1/project', { params })
  });

  const mutation = useMutation({
    mutationFn: (data) => api.patch(`/api/v1/project/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['entity-list', 'project']);
    }
  });

  // ...
}

// AFTER (v9.x - RxDB + RxState)
import { useEntityList, useGlobalSettings, useRxMutation } from '@/db/hooks';

function ProjectList() {
  const { globalSettings } = useGlobalSettings();

  const { data, formattedData, isLoading } = useEntityList('project', params);

  const { update } = useRxMutation('project');

  const handleUpdate = async (id, data) => {
    await update(id, data);
    // No manual invalidation needed - RxDB is reactive!
  };

  // ...
}
```

---

## Backend Sync Endpoint Requirements

For replication to work, the backend needs a `/sync` endpoint:

```typescript
// Required: GET /api/v1/{entity}/sync
fastify.get('/api/v1/project/sync', async (request, reply) => {
  const { since, limit = 100 } = request.query;

  const projects = await db.execute(sql`
    SELECT * FROM app.project
    WHERE updated_ts > ${since}
    ORDER BY updated_ts ASC
    LIMIT ${limit}
  `);

  return {
    data: projects,
    lastUpdatedAt: projects[projects.length - 1]?.updated_ts || since,
    hasMore: projects.length === limit
  };
});

// 3. Render based on vizContainer (set from viewType metadata)
if (vizContainer?.view === 'DAGVisualizer' && dagNodes.has(field.key)) {
  return <DAGVisualizer nodes={dagNodes.get(field.key)} />;
}
```

### Anti-Patterns (REMOVED in v8.3.2)

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| `loadDataLabels` property | Use `editType.lookupSource === 'datalabel'` |
| Pattern detection (`dl__*`) | Use backend metadata |
| `isStageField()` function | Use `viewType.component === 'DAGVisualizer'` |
| Per-field API calls | Login-time cache via `datalabelMetadataStore` |

---

## Cache Invalidation

### On Mutation (Local User)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  MUTATION → CACHE INVALIDATION (Local User)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  useEntityMutation('project').updateEntity(id, data)                         │
│                       │                                                      │
│                       ▼                                                      │
│  1. Optimistic Update                                                        │
│     React Query: setQueryData (immediate UI feedback)                        │
│                       │                                                      │
│                       ▼                                                      │
│  2. API Call                                                                 │
│     PATCH /api/v1/project/{id}                                               │
│                       │                                                      │
│       ┌───────────────┴───────────────┐                                      │
│       ▼                               ▼                                      │
│  3a. Success                     3b. Error                                   │
│     invalidateQueries(['entity-list'])    rollback to previous data          │
│     invalidateQueries(['entity', id])                                        │
│     entityComponentMetadataStore.invalidate('project')                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### On Remote Change (WebSocket - v8.4.0)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  WEBSOCKET INVALIDATE → CACHE INVALIDATION (Remote User)                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PubSub Service pushes INVALIDATE message                                    │
│                       │                                                      │
│                       ▼                                                      │
│  1. SyncProvider receives WebSocket message                                  │
│     { type: 'INVALIDATE', payload: { entityCode, changes } }                │
│                       │                                                      │
│                       ▼                                                      │
│  2. Version Check (out-of-order protection)                                  │
│     Skip if change.version <= lastProcessedVersion                          │
│                       │                                                      │
│                       ▼                                                      │
│  3. Invalidate React Query Cache                                             │
│     queryClient.invalidateQueries(['entity-instance', entityCode, entityId])│
│     queryClient.invalidateQueries(['entity-instance-list', entityCode])     │
│                       │                                                      │
│                       ▼                                                      │
│  4. React Query Auto-Refetch (if component mounted)                          │
│     GET /api/v1/{entityCode}/{entityId} → Fresh data                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### On Logout

```typescript
// Auth context clears all caches
const logout = () => {
  queryClient.clear();  // React Query
  useGlobalSettingsMetadataStore.getState().clear();
  useDatalabelMetadataStore.getState().clear();
  useEntityComponentMetadataStore.getState().clear();
  useEntityCodeMetadataStore.getState().clear();
};
```

---

## Comparison: v8.x vs v9.x

| Feature | v8.x (Zustand + React Query) | v9.x (RxDB + RxState) |
|---------|------------------------------|------------------------|
| **Cache Persistence** | Memory only | IndexedDB (survives restart) |
| **Offline Support** | ❌ None | ✅ Full offline-first |
| **Draft Persistence** | ❌ Lost on refresh | ✅ Survives refresh |
| **Multi-Tab Sync** | ❌ None | ✅ Automatic |
| **State Libraries** | 2 (Zustand + React Query) | 1 (RxDB) |
| **Cache Invalidation** | Manual (`invalidateQueries`) | Automatic (reactive) |
| **Sync Strategy** | Fetch on demand | Background replication |
| **Conflict Resolution** | N/A | Server wins |
| **Dependencies** | `zustand`, `@tanstack/react-query` | `rxdb`, `rxjs`, `dexie` |

---

## File Reference

| File | Purpose |
|------|---------|
| `stores/entityComponentMetadataStore.ts` | Component metadata cache |
| `stores/datalabelMetadataStore.ts` | Dropdown options cache |
| `stores/globalSettingsMetadataStore.ts` | Currency/date formats |
| `stores/entityCodeMetadataStore.ts` | Entity type registry |
| `stores/useEntityEditStore.ts` | Edit state management |
| `lib/hooks/useEntityQuery.ts` | React Query hooks + RefData type + auto-subscribe |
| `lib/hooks/useRefData.ts` | Reference resolution hook (v8.3.0) |
| `lib/refDataResolver.ts` | Metadata-based resolution utilities (v8.3.1) |
| `lib/formatters/types.ts` | ComponentMetadata types |
| `lib/formatters/datasetFormatter.ts` | formatDataset function |
| `db/sync/SyncProvider.tsx` | WebSocket connection + cache invalidation (v8.4.0) |
| `db/sync/useAutoSubscribe.ts` | Auto-subscription to entity IDs (v8.4.0) |
| `db/sync/types.ts` | Sync message type definitions (v8.4.0) |

---

**Version:** 8.4.0 | **Updated:** 2025-11-27

**Recent Updates:**
- v8.4.0 (2025-11-27): **Real-Time WebSocket Sync**
  - Added `SyncProvider` for WebSocket connection to PubSub service (port 4001)
  - Added `useAutoSubscribe` hook for automatic entity subscription
  - Entity hooks (`useEntityInstanceList`, `useEntityInstance`) now auto-subscribe
  - INVALIDATE messages trigger `queryClient.invalidateQueries()`
  - Version tracking prevents stale update processing
  - Exponential backoff reconnection (1s → 30s max)
  - See `docs/caching/RXDB_SYNC_ARCHITECTURE.md` for full architecture
- v8.3.2 (2025-11-27): **Datalabel Rendering Architecture**
  - viewType controls WHICH component renders (`renderType: 'component'` + `component: 'DAGVisualizer'`)
  - editType controls WHERE data comes from (`lookupSource: 'datalabel'` + `datalabelKey`)
  - Removed legacy `loadDataLabels` pattern from entityConfig
  - `EntityFormContainer_viz_container: { view: string, edit: string }` object structure
- v8.3.1 (2025-11-26): **Metadata-Based Reference Resolution**
  - Removed pattern matching from `refDataResolver.ts`
  - Added `isEntityReferenceField(fieldMeta)`, `getEntityCodeFromMetadata(fieldMeta)`
  - Frontend uses `metadata.viewType`/`metadata.lookupEntity` (no `_id` suffix detection)
  - Backend metadata is single source of truth for field type detection
- v8.3.0 (2025-11-26): **ref_data_entityInstance Pattern**
  - Added `ref_data_entityInstance` to API responses for O(1) entity reference resolution
  - Added `useRefData` hook for reference resolution utilities
  - Added `REF_DATA_STALE`/`REF_DATA_CACHE` TTL constants
  - Deprecated per-row `_ID/_IDS` embedded object pattern
