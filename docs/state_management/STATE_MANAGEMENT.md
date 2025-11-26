# State Management Architecture

**Version:** 8.2.0 | **Location:** `apps/web/src/stores/` | **Updated:** 2025-11-26

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STATE MANAGEMENT (v8.2.0)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐   │
│  │  REACT QUERY - Sole Data Cache                                        │   │
│  │  ─────────────────────────────────────────────────────────────────    │   │
│  │  • Stores RAW entity data only (no formatted strings)                 │   │
│  │  • Format-at-read via `select` option (memoized)                      │   │
│  │  • Stale-while-revalidate pattern                                     │   │
│  │  • Optimistic updates with automatic rollback                         │   │
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
| **Separation of Concerns** | Data (React Query) vs Metadata (Zustand) |
| **Stale-While-Revalidate** | Show cached, refetch in background |
| **Tiered TTL** | Reference (1h) > Metadata (15m) > Lists (30s) > Details (10s) |

---

## Store Catalog

### React Query Hooks

| Hook | Purpose | TTL | Returns |
|------|---------|-----|---------|
| `useEntityInstanceList` | RAW entity lists | 30s stale, 5m cache | `{ data: T[], metadata }` |
| `useFormattedEntityList` | Formatted lists | Same cache + select | `{ formattedData: FormattedRow[] }` |
| `useEntityInstance` | RAW single entity | 10s stale, 2m cache | `{ data: T, metadata }` |
| `useFormattedEntityInstance` | Formatted entity | Same cache + select | `{ formattedData: FormattedRow }` |
| `useEntityMutation` | CRUD operations | N/A | `{ updateEntity, deleteEntity }` |

### Zustand Stores

| Store | Purpose | TTL | Key |
|-------|---------|-----|-----|
| `entityComponentMetadataStore` | Component metadata | 15 min | `entityCode:componentName` |
| `datalabelMetadataStore` | Dropdown options | 1 hour | `datalabelKey` |
| `globalSettingsMetadataStore` | Currency/date formats | 1 hour | `settings` |
| `entityCodeMetadataStore` | Entity type registry | 1 hour | `entityCode` |
| `entityEditStore` | Edit state | None | `entityCode:entityId` |

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
│       data: [{ budget_allocated_amt: 50000 }],                               │
│       metadata: {                                                            │
│         entityDataTable: {                                                   │
│           viewType: { budget_allocated_amt: { renderType: 'currency' } },    │
│           editType: { budget_allocated_amt: { inputType: 'number' } }        │
│         }                                                                    │
│       }                                                                      │
│     }                                                                        │
│                       │                                                      │
│                       ▼                                                      │
│  2. React Query Cache (RAW data only)                                        │
│     queryKey: ['entity-list', 'project', params]                             │
│     data: { data: [...], metadata: {...} }  // Stored as-is                  │
│                       │                                                      │
│                       ▼                                                      │
│  3. select Transform (ON READ - memoized)                                    │
│     select: (raw) => {                                                       │
│       const { viewType } = raw.metadata.entityDataTable;                     │
│       return formatDataset(raw.data, { viewType });                          │
│     }                                                                        │
│                       │                                                      │
│                       ▼                                                      │
│  4. Component receives FormattedRow[]                                        │
│     {                                                                        │
│       raw: { budget_allocated_amt: 50000 },                                  │
│       display: { budget_allocated_amt: '$50,000.00' },                       │
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

---

## Metadata Store Structure (v8.2.0)

### ComponentMetadata Type

```typescript
// Required structure from backend (v8.2.0)
interface ComponentMetadata {
  viewType: Record<string, ViewFieldMetadata>;
  editType: Record<string, EditFieldMetadata>;
}

interface ViewFieldMetadata {
  dtype: string;
  label: string;
  renderType: string;
  behavior: { visible?: boolean; sortable?: boolean };
  style: Record<string, any>;
}

interface EditFieldMetadata {
  dtype: string;
  label: string;
  inputType: string;
  behavior: { editable?: boolean };
  validation: Record<string, any>;
  lookupSource?: 'datalabel' | 'entityInstance';
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
│  COMPONENT → STORE INTERACTIONS                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  EntityListOfInstancesPage                                                   │
│  └── useFormattedEntityList('project', { view: 'entityDataTable' })          │
│       ├── React Query: fetch + cache RAW                                     │
│       ├── Zustand: store metadata in entityComponentMetadataStore            │
│       ├── Zustand: store datalabels in datalabelMetadataStore                │
│       └── select: formatDataset() → FormattedRow[]                           │
│                                                                              │
│  EntityDataTable                                                             │
│  └── Receives: { data: FormattedRow[], metadata }                            │
│       ├── VIEW: row.display[key], row.styles[key]                            │
│       ├── EDIT: renderEditModeFromMetadata(row.raw[key], editType[key])      │
│       └── Columns built from metadata.viewType                               │
│                                                                              │
│  EntityFormContainer                                                         │
│  └── useEntityInstance('project', id)                                        │
│       ├── Receives: { data, metadata: { entityFormContainer: {...} } }       │
│       ├── Fields built from metadata.entityFormContainer.viewType            │
│       └── Inputs rendered via metadata.entityFormContainer.editType          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Cache Invalidation

### On Mutation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  MUTATION → CACHE INVALIDATION                                               │
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
  // Reference Data (1 hour)
  ENTITY_TYPES: 60 * 60 * 1000,
  DATALABELS: 60 * 60 * 1000,
  GLOBAL_SETTINGS: 60 * 60 * 1000,

  // Metadata (15 minutes)
  ENTITY_METADATA: 15 * 60 * 1000,

  // Entity Lists (stale-while-revalidate)
  ENTITY_LIST_STALE: 30 * 1000,   // Mark stale after 30s
  ENTITY_LIST_CACHE: 5 * 60 * 1000, // Keep for 5 min

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
| Pattern detection in frontend | Backend should decide | Backend sends { viewType, editType } |

---

## File Reference

| File | Purpose |
|------|---------|
| `stores/entityComponentMetadataStore.ts` | Component metadata cache |
| `stores/datalabelMetadataStore.ts` | Dropdown options cache |
| `stores/globalSettingsMetadataStore.ts` | Currency/date formats |
| `stores/entityCodeMetadataStore.ts` | Entity type registry |
| `stores/useEntityEditStore.ts` | Edit state management |
| `lib/hooks/useEntityQuery.ts` | React Query hooks |
| `lib/formatters/types.ts` | ComponentMetadata types |
| `lib/formatters/datasetFormatter.ts` | formatDataset function |

---

**Version:** 8.2.0 | **Updated:** 2025-11-26
