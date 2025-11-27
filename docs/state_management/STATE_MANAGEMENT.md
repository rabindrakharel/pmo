# State Management Architecture

**Version:** 8.4.0 | **Location:** `apps/web/src/stores/` | **Updated:** 2025-11-27

---

## Overview

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
│  ┌───────────────────────────────────────────────────────────────────────┐   │
│  │  ZUSTAND STORES - Metadata + UI State Only                            │   │
│  │  ─────────────────────────────────────────────────────────────────    │   │
│  │  • entityComponentMetadataStore (15m TTL) - { viewType, editType }    │   │
│  │  • datalabelMetadataStore (1h TTL) - Dropdown options                 │   │
│  │  • globalSettingsMetadataStore (1h TTL) - Currency/date formats       │   │
│  │  • entityCodeMetadataStore (1h TTL) - Entity type registry            │   │
│  │  • entityEditStore (no TTL) - UI state (dirty fields, undo/redo)      │   │
│  │                                                                       │   │
│  │  ✗ NO entity data stored here (React Query only)                      │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
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

## Store Catalog

### React Query Hooks

| Hook | Purpose | TTL | Returns |
|------|---------|-----|---------|
| `useEntityInstanceList` | RAW entity lists | 30s stale, 5m cache | `{ data: T[], metadata, ref_data_entityInstance }` |
| `useFormattedEntityList` | Formatted lists | Same cache + select | `{ formattedData: FormattedRow[] }` |
| `useEntityInstance` | RAW single entity | 10s stale, 2m cache | `{ data: T, metadata, ref_data_entityInstance }` |
| `useFormattedEntityInstance` | Formatted entity | Same cache + select | `{ formattedData: FormattedRow }` |
| `useEntityMutation` | CRUD operations | N/A | `{ updateEntity, deleteEntity }` |
| `useRefData` | Reference resolution | Bound to query | `{ resolveName, resolveFieldDisplay }` |

### Zustand Stores

| Store | Purpose | TTL | Key |
|-------|---------|-----|-----|
| `entityComponentMetadataStore` | Component metadata | 15 min | `entityCode:componentName` |
| `datalabelMetadataStore` | Dropdown options | 1 hour | `datalabelKey` |
| `globalSettingsMetadataStore` | Currency/date formats | 1 hour | `settings` |
| `entityCodeMetadataStore` | Entity type registry | 1 hour | `entityCode` |
| `entityEditStore` | Edit state | None | `entityCode:entityId` |

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

### ref_data_entityInstance Pattern

API responses include `ref_data_entityInstance` - a lookup table for resolving entity reference UUIDs to display names:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ref_data_entityInstance PATTERN (v8.3.0)                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  API Response:                                                               │
│  {                                                                           │
│    data: [{                                                                  │
│      id: "proj-1",                                                           │
│      name: "Kitchen Renovation",                                             │
│      manager__employee_id: "uuid-james",    // Raw UUID                      │
│      business_id: "uuid-huron"              // Raw UUID                      │
│    }],                                                                       │
│    ref_data_entityInstance: {                                                               │
│      employee: { "uuid-james": "James Miller" },   // Lookup table           │
│      business: { "uuid-huron": "Huron Home Services" }                       │
│    },                                                                        │
│    metadata: {                                                               │
│      entityDataTable: {                                                      │
│        viewType: {                                                           │
│          manager__employee_id: {                                             │
│            renderType: "entityInstanceId",                                   │
│            lookupEntity: "employee"          // ← Backend tells frontend     │
│          }                                                                   │
│        }                                                                     │
│      }                                                                       │
│    }                                                                         │
│  }                                                                           │
│                                                                              │
│  Frontend Resolution (using metadata):                                       │
│  const { resolveFieldDisplay } = useRefData(data.ref_data_entityInstance);                  │
│  const fieldMeta = metadata.entityDataTable.viewType.manager__employee_id;   │
│  resolveFieldDisplay(fieldMeta, "uuid-james")  // → "James Miller"           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Resolution Flow (v8.3.1 - Metadata-Based)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ENTITY REFERENCE RESOLUTION (v8.3.1)                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Backend Metadata provides:                                                  │
│  ─────────────────────────                                                   │
│  {                                                                           │
│    manager__employee_id: {                                                   │
│      renderType: "entityInstanceId",   // ← Tells frontend: it's a reference│
│      lookupEntity: "employee",         // ← Tells frontend: use "employee"  │
│      lookupSource: "entityInstance"    // ← Tells frontend: look in ref_data_entityInstance│
│    }                                                                         │
│  }                                                                           │
│                                                                              │
│  Frontend uses metadata (NO pattern matching):                               │
│  ───────────────────────────────────────────                                 │
│  import { useRefData, isEntityReferenceField, getEntityCodeFromMetadata }    │
│                                                                              │
│  // Check if field is a reference using metadata                             │
│  if (isEntityReferenceField(fieldMeta)) {                                    │
│    const entityCode = getEntityCodeFromMetadata(fieldMeta);  // "employee"   │
│    const name = refData[entityCode][uuid];                   // "James"      │
│  }                                                                           │
│                                                                              │
│  ✗ REMOVED: Frontend pattern matching (_id suffix detection)                 │
│  ✓ NOW: Backend metadata is single source of truth                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### useRefData Hook (v8.3.1)

```typescript
import { useRefData } from '@/lib/hooks';

// Get ref_data_entityInstance from entity query
const { data } = useEntityInstance('project', projectId);
const { resolveFieldDisplay, isRefField } = useRefData(data?.ref_data_entityInstance);

// Resolve using field metadata (NOT field name pattern)
const fieldMeta = metadata.entityDataTable.viewType.manager__employee_id;
const displayValue = resolveFieldDisplay(fieldMeta, project.manager__employee_id);
// → "James Miller"

// Hook methods:
interface UseRefDataResult {
  refData: RefData | undefined;
  hasRefData: boolean;

  // Direct resolution (when you know the entity code)
  resolveName(uuid, entityCode): string | undefined;
  resolveNames(uuids, entityCode): string[];

  // Metadata-based resolution (v8.3.1 - recommended)
  resolveField(fieldMeta, value): string | string[] | undefined;
  resolveFieldDisplay(fieldMeta, value, fallback?): string;
  resolveRow(row, fieldMetadataMap): Record<string, string>;

  // Metadata utilities
  isRefField(fieldMeta): boolean;
  getEntityCode(fieldMeta): string | null;
  isArrayRef(fieldMeta): boolean;
}
```

---

## Data Flow

### Format-at-Read Pattern

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FORMAT-AT-READ FLOW                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. API Response                                                             │
│     {                                                                        │
│       data: [{ budget_allocated_amt: 50000, manager__employee_id: "uuid" }], │
│       ref_data_entityInstance: { employee: { "uuid": "James Miller" } },                    │
│       metadata: {                                                            │
│         entityDataTable: {                                                   │
│           viewType: {                                                        │
│             budget_allocated_amt: { renderType: 'currency' },                │
│             manager__employee_id: {                                          │
│               renderType: 'entityInstanceId',                                │
│               lookupEntity: 'employee'                                       │
│             }                                                                │
│           },                                                                 │
│           editType: { budget_allocated_amt: { inputType: 'number' } }        │
│         }                                                                    │
│       }                                                                      │
│     }                                                                        │
│                       │                                                      │
│                       ▼                                                      │
│  2. React Query Cache (RAW data + ref_data_entityInstance)                                  │
│     queryKey: ['entity-list', 'project', params]                             │
│     data: { data: [...], ref_data_entityInstance: {...}, metadata: {...} }                  │
│                       │                                                      │
│                       ▼                                                      │
│  3. select Transform (ON READ - memoized)                                    │
│     select: (raw) => {                                                       │
│       const { viewType } = raw.metadata.entityDataTable;                     │
│       return formatDataset(raw.data, { viewType, refData: raw.ref_data_entityInstance });   │
│     }                                                                        │
│                       │                                                      │
│                       ▼                                                      │
│  4. Component receives FormattedRow[]                                        │
│     {                                                                        │
│       raw: { budget_allocated_amt: 50000, manager__employee_id: "uuid" },    │
│       display: { budget_allocated_amt: '$50,000.00',                         │
│                  manager__employee_id: 'James Miller' },                     │
│       styles: {}                                                             │
│     }                                                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Benefits of Format-at-Read

| Benefit | Description |
|---------|-------------|
| **Smaller Cache** | RAW data only (not formatted strings) |
| **Fresh Formatting** | Datalabel colors always current |
| **Multiple Views** | Same cache serves table, kanban, grid |
| **Memoization** | React Query auto-memoizes select transform |
| **O(1) Reference Resolution** | ref_data_entityInstance lookup vs per-row API calls |

---

## Metadata Store Structure (v8.3.1)

### ComponentMetadata Type

```typescript
// Required structure from backend (v8.3.1)
interface ComponentMetadata {
  viewType: Record<string, ViewFieldMetadata>;
  editType: Record<string, EditFieldMetadata>;
}

interface ViewFieldMetadata {
  dtype: string;
  label: string;
  renderType: string;             // 'entityInstanceId' for references (v11.0.0)
  lookupEntity?: string;          // Entity code for reference fields (v8.3.0)
  lookupSource?: 'entityInstance' | 'datalabel';  // Where to lookup
  behavior: { visible?: boolean; sortable?: boolean };
  style: Record<string, any>;
}

interface EditFieldMetadata {
  dtype: string;
  label: string;
  inputType: string;              // 'entityInstanceId' for references (v11.0.0)
  lookupEntity?: string;          // Entity code for reference fields (v8.3.0)
  lookupSource?: 'entityInstance' | 'datalabel';
  behavior: { editable?: boolean };
  validation: Record<string, any>;
  datalabelKey?: string;
}
```

### Store Interface

```typescript
// entityComponentMetadataStore
interface EntityComponentMetadataStore {
  // Cache key format: "project:entityDataTable"
  setComponentMetadata(entityCode: string, componentName: string, metadata: ComponentMetadata): void;
  getComponentMetadata(entityCode: string, componentName: string): ComponentMetadata | null;
  invalidateEntity(entityCode: string): void;
}

// Stored structure (per entity:component)
{
  "project:entityDataTable": {
    data: { viewType: {...}, editType: {...} },
    timestamp: 1732631234567,
    ttl: 900000  // 15 min
  }
}
```

---

## Component Interaction

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  COMPONENT → STORE INTERACTIONS (v8.3.1)                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  EntityListOfInstancesPage                                                   │
│  └── useFormattedEntityList('project', { view: 'entityDataTable' })          │
│       ├── React Query: fetch + cache RAW + ref_data_entityInstance                          │
│       ├── Zustand: store metadata in entityComponentMetadataStore            │
│       ├── Zustand: store datalabels in datalabelMetadataStore                │
│       └── select: formatDataset() → FormattedRow[]                           │
│                                                                              │
│  EntityDataTable                                                             │
│  └── Receives: { data: FormattedRow[], metadata, ref_data_entityInstance }                  │
│       ├── VIEW: row.display[key], row.styles[key]                            │
│       ├── REFERENCE: Uses metadata.lookupEntity (no pattern matching)        │
│       ├── EDIT: renderEditModeFromMetadata(row.raw[key], editType[key])      │
│       └── Columns built from metadata.viewType                               │
│                                                                              │
│  EntityFormContainer                                                         │
│  └── useEntityInstance('project', id)                                        │
│       ├── Receives: { data, metadata, ref_data_entityInstance }                             │
│       ├── Fields built from metadata.entityFormContainer.viewType            │
│       ├── Reference dropdowns: metadata.lookupEntity → fetch options         │
│       └── Inputs rendered via metadata.entityFormContainer.editType          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Datalabel Caching & Rendering (v8.3.2)

### Architectural Truth

**Metadata properties control datalabel field rendering:**

| Metadata | Property | Purpose |
|----------|----------|---------|
| **viewType** | `renderType` + `component` | Controls WHICH component renders (view mode) |
| **editType** | `inputType` + `component` | Controls WHICH component renders (edit mode) |
| **editType** | `lookupSource` + `datalabelKey` | Controls WHERE data comes from |

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  DATALABEL CACHING & RENDERING (v8.3.2)                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Login Time: Cache ALL datalabels                                         │
│     AuthContext → GET /api/v1/datalabels/all → datalabelMetadataStore        │
│                                                                              │
│  2. Component Load: Use metadata to detect datalabel fields                  │
│     editType.lookupSource === 'datalabel' → needs datalabel options          │
│     editType.datalabelKey → cache lookup key                                 │
│                                                                              │
│  3. View Mode: Render based on viewType metadata                             │
│     viewType.renderType === 'component' && viewType.component === 'DAGVisualizer'│
│     → <DAGVisualizer nodes={...} />                                          │
│     Otherwise: <Badge color={...}>{value}</Badge>                            │
│                                                                              │
│  4. Edit Mode: Load options from cache                                       │
│     const options = datalabelStore.getDatalabel(field.datalabelKey);         │
│     → <BadgeDropdownSelect options={options} />                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### datalabelMetadataStore

```typescript
interface DatalabelMetadataStore {
  // Cache structure
  datalabels: Record<string, DatalabelOption[]>;  // keyed by datalabelKey

  // Methods
  setAllDatalabels(data: Record<string, DatalabelOption[]>): void;
  getDatalabel(key: string): DatalabelOption[] | undefined;
  invalidateDatalabel(key: string): void;
  clear(): void;
}

interface DatalabelOption {
  id: number;
  name: string;
  color_code?: string;
  parent_ids?: number[];
  sort_order?: number;
  active_flag?: boolean;
}
```

### Usage in EntityFormContainer

```typescript
// 1. Filter fields needing datalabel options (using metadata, NOT field name)
const fieldsNeedingSettings = fields.filter(
  field => field.lookupSource === 'datalabel' || field.datalabelKey
);

// 2. Load from cache using datalabelKey
fieldsNeedingSettings.forEach((field) => {
  const lookupKey = field.datalabelKey || field.key;
  const cachedOptions = useDatalabelMetadataStore.getState().getDatalabel(lookupKey);

  // Build DAG nodes if viewType specifies DAGVisualizer
  if (vizContainer?.view === 'DAGVisualizer') {
    dagNodesMap.set(field.key, transformToDAGNodes(cachedOptions));
  }
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

## TTL Configuration

```typescript
// useEntityQuery.ts
export const CACHE_TTL = {
  // Reference Data (long-lived)
  ENTITY_TYPES: 60 * 60 * 1000,        // 1 hour
  DATALABELS: 60 * 60 * 1000,          // 1 hour
  GLOBAL_SETTINGS: 60 * 60 * 1000,     // 1 hour
  REF_DATA_STALE: 60 * 60 * 1000,      // 1 hour (v8.3.0)
  REF_DATA_CACHE: 2 * 60 * 60 * 1000,  // 2 hours (v8.3.0)

  // Metadata (15 minutes)
  ENTITY_METADATA: 15 * 60 * 1000,

  // Entity Lists (stale-while-revalidate)
  ENTITY_LIST_STALE: 30 * 1000,        // Mark stale after 30s
  ENTITY_LIST_CACHE: 5 * 60 * 1000,    // Keep for 5 min

  // Entity Details (near real-time)
  ENTITY_DETAIL_STALE: 10 * 1000,
  ENTITY_DETAIL_CACHE: 2 * 60 * 1000,
};
```

---

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| Storing entity data in Zustand | Dual cache, stale data | Use React Query only |
| Formatting in queryFn | Bloated cache | Use `select` option |
| Subscribing to full store | Unnecessary re-renders | Use `getState()` or `useShallow` |
| Hardcoded dropdown options | Maintenance burden | Use datalabelMetadataStore |
| Pattern detection in frontend | Backend should decide | Use `metadata.lookupEntity` (v8.3.1) |
| Field name `_id` suffix detection | Duplicates backend logic | Use `renderType === 'entityInstanceId'` |

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
