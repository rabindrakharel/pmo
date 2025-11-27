# State Management Architecture

**Version:** 9.0.0 | **Location:** `apps/web/src/db/` | **Updated:** 2025-11-27

---

## Overview (v9.0.0 - RxDB + RxState)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STATE MANAGEMENT (v9.0.0 RxDB + RxState)                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐   │
│  │  RxDB DATABASE (IndexedDB via Dexie)                                  │   │
│  │  ─────────────────────────────────────────────────────────────────    │   │
│  │                                                                       │   │
│  │  ENTITY COLLECTIONS (Synced bidirectionally)                          │   │
│  │  ├── project        → ProjectDoc schema                               │   │
│  │  ├── task           → TaskDoc schema                                  │   │
│  │  ├── employee       → EmployeeDoc schema                              │   │
│  │  └── ... 27+ entity types                                             │   │
│  │                                                                       │   │
│  │  METADATA COLLECTIONS (Pull-only sync)                                │   │
│  │  ├── datalabel      → DatalabelDoc (dropdown options)                 │   │
│  │  └── entity_type    → EntityTypeDoc (entity definitions)              │   │
│  │                                                                       │   │
│  │  LOCAL DOCUMENTS (RxState - No sync)                                  │   │
│  │  ├── global-settings       → Currency, date, boolean formats          │   │
│  │  ├── component-metadata:*  → viewType/editType per component          │   │
│  │  ├── edit-state:*          → Draft edits (survives refresh!)          │   │
│  │  └── ui-preferences        → Theme, sidebar, default views            │   │
│  │                                                                       │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                              │                                               │
│                              ▼ Background Replication                        │
│  ┌───────────────────────────────────────────────────────────────────────┐   │
│  │  REST REPLICATION LAYER                                               │   │
│  │  ─────────────────────────────────────────────────────────────────    │   │
│  │  • Entity sync: Pull + Push (bidirectional)                           │   │
│  │  • Metadata sync: Pull only (reference data)                          │   │
│  │  • Conflict: Server wins (RBAC is authoritative)                      │   │
│  │  • Retry: Exponential backoff on failure                              │   │
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
| **Local-First** | RxDB stores data in IndexedDB; works offline |
| **Single Source of Truth** | All state in RxDB (collections + local documents) |
| **Reactive Queries** | Subscriptions auto-update when documents change |
| **Background Sync** | REST replication runs in background |
| **Conflict Resolution** | Server wins (RBAC is authoritative) |
| **Draft Persistence** | Edit state persists in local documents |

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

## Hook Catalog (v9.0.0)

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
| `db/index.ts` | Database creation, getDatabase() |
| `db/DatabaseProvider.tsx` | React context, loading states |
| `db/schemas/*.ts` | RxDB collection schemas |
| `db/hooks/*.ts` | All React hooks |
| `db/replication/*.ts` | REST sync handlers |

---

## Legacy Documentation (v8.x)

For reference, the previous Zustand + React Query architecture is documented in:
- `docs/migration/RXDB_MIGRATION_ANALYSIS.md` - Full migration analysis
- Git history - Previous STATE_MANAGEMENT.md versions

---

**Version:** 9.0.0 | **Updated:** 2025-11-27

**Recent Updates:**
- v9.0.0 (2025-11-27): **RxDB + RxState Local-First Architecture**
  - Complete infrastructure for local-first state management
  - Replaces Zustand stores with RxDB local documents
  - Replaces React Query with RxDB reactive queries
  - Added replication layer for REST sync
  - Benefits: offline-first, persistent, multi-tab sync, draft persistence
- v8.3.2 (2025-11-27): Component-driven rendering + BadgeDropdownSelect
- v8.3.1 (2025-11-26): Metadata-based reference resolution
- v8.3.0 (2025-11-26): ref_data_entityInstance pattern
- v8.0.0 (2025-11-23): Format-at-read pattern with React Query
