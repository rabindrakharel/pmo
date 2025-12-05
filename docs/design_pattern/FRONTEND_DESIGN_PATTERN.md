# PMO Frontend Design Pattern - Comprehensive Architecture Guide

> **Version**: 12.0.0 | **Updated**: 2025-12-05
> **Pattern**: TanStack Query + Dexie + Metadata-Driven Rendering + Optimistic Updates

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Navigation & Routing](#2-navigation--routing)
3. [Page Component Architecture](#3-page-component-architecture)
4. [Cache Architecture (TanStack Query + Dexie)](#4-cache-architecture-tanstack-query--dexie)
5. [Two-Query Pattern: Metadata + Data](#5-two-query-pattern-metadata--data)
6. [Format-at-Read Pattern](#6-format-at-read-pattern)
7. [Metadata-Driven Rendering](#7-metadata-driven-rendering)
8. [DataTable Component Architecture](#8-datatable-component-architecture)
9. [Inline Editing Pattern](#9-inline-editing-pattern)
10. [Optimistic Updates Pattern](#10-optimistic-updates-pattern)
11. [Inline Add Row Pattern](#11-inline-add-row-pattern)
12. [Draft Persistence Pattern](#12-draft-persistence-pattern)
13. [Reactive Re-rendering & Cache Subscriptions](#13-reactive-re-rendering--cache-subscriptions)
14. [Sync vs Async Cache Access](#14-sync-vs-async-cache-access)
15. [WebSocket Real-Time Invalidation](#15-websocket-real-time-invalidation)
16. [Component Re-render Lifecycle](#16-component-re-render-lifecycle)
17. [Error Handling & Rollback](#17-error-handling--rollback)
18. [Performance Optimizations](#18-performance-optimizations)

---

## 1. Architecture Overview

### 1.1 Core Principles

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PMO FRONTEND ARCHITECTURE PRINCIPLES                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. BACKEND IS SINGLE SOURCE OF TRUTH FOR FIELD METADATA                    │
│     • Backend sends viewType/editType → Frontend renders exactly as told    │
│     • Zero frontend pattern detection or field type inference               │
│                                                                              │
│  2. CACHE IS SINGLE SOURCE OF TRUTH FOR DATA                                │
│     • TanStack Query (in-memory) + Dexie (IndexedDB persistence)            │
│     • Components read from cache, never from local state copies             │
│                                                                              │
│  3. FORMAT-AT-READ, NOT FORMAT-AT-FETCH                                     │
│     • Cache stores RAW data only (smaller, canonical)                       │
│     • Formatting happens via useMemo on every read                          │
│     • Reactive to datalabel cache changes (badge colors)                    │
│                                                                              │
│  4. OPTIMISTIC UPDATES WITH OFFLINE-SAFE ROLLBACK                           │
│     • UI updates instantly → API call in background                         │
│     • On error: direct rollback using captured previous state               │
│     • No network required for rollback (works offline)                      │
│                                                                              │
│  5. TWO-QUERY PATTERN FOR PERCEIVED PERFORMANCE                             │
│     • Query 1: Metadata (30-min cache) → Show table structure instantly     │
│     • Query 2: Data (5-min cache) → Fill rows when ready                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Server State** | TanStack Query v5 | In-memory cache, auto-refetch, stale-while-revalidate |
| **Persistence** | Dexie v4 | IndexedDB wrapper, offline-first, survives browser restart |
| **Real-time** | WebSocket (port 4001) | Cache invalidation, multi-tab sync |
| **UI Framework** | React 19 | Component rendering |
| **Styling** | Tailwind CSS v4 | Utility-first CSS |
| **Build** | Vite | Fast HMR, ESM bundling |

### 1.3 Data Flow Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         COMPLETE DATA FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  USER ACTION (Navigate to /project)                                          │
│         │                                                                    │
│         ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ EntityListOfInstancesPage                                            │    │
│  │ ├── useEntityInstanceMetadata('project', 'entityListOfInstancesTable')│   │
│  │ │   └── Returns: { viewType, editType, fields }                      │    │
│  │ │                                                                     │    │
│  │ ├── useEntityInstanceData('project', { limit: 20000 })               │    │
│  │ │   └── Returns: { data: T[], metadata, refData, isLoading }         │    │
│  │ │                                                                     │    │
│  │ └── useFormattedEntityData(rawData, componentMetadata)               │    │
│  │     └── Returns: FormattedRow[] with { raw, display, styles }        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│         │                                                                    │
│         ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ EntityListOfInstancesTable                                           │    │
│  │ ├── Receives: data (FormattedRow[]), metadata (ComponentMetadata)    │    │
│  │ ├── Generates columns from metadata.viewType                         │    │
│  │ ├── Renders: row.display[key] for view mode                          │    │
│  │ ├── Renders: row.styles[key] for badge CSS classes                   │    │
│  │ └── Uses: row.raw[key] for edit mode values                          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Navigation & Routing

### 2.1 Route Structure

```typescript
// App.tsx - Route definitions
<Routes>
  {/* Entity List Pages */}
  <Route path="/:entityCode" element={<EntityListOfInstancesPage />} />

  {/* Entity Detail Pages */}
  <Route path="/:entityCode/:id" element={<EntitySpecificInstancePage />} />

  {/* Entity Create Pages */}
  <Route path="/:entityCode/new" element={<EntityCreatePage />} />

  {/* Settings Pages */}
  <Route path="/settings" element={<SettingsOverviewPage />} />
  <Route path="/settings/:settingType" element={<SettingDetailPage />} />
</Routes>
```

### 2.2 Navigation Patterns

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NAVIGATION PATTERNS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  LIST → DETAIL (Row Click)                                                   │
│  ─────────────────────────                                                   │
│  /project → /project/uuid-123                                                │
│  • Row click navigates to EntitySpecificInstancePage                         │
│  • BLOCKED for temp rows (id starts with 'temp_')                           │
│                                                                              │
│  DETAIL → CHILD TAB (DynamicChildEntityTabs)                                │
│  ───────────────────────────────────────────                                │
│  /project/uuid-123 → Shows child tabs (task, wiki, artifact)                │
│  • Tab click loads child data with parent context                           │
│  • Parent ID passed as parent_entity_instance_id query param                │
│                                                                              │
│  DETAIL → EDIT (Inline or Form)                                             │
│  ─────────────────────────────                                               │
│  • Inline: Single-click cell → edit that cell only                          │
│  • Form: Edit button → EntityFormPage with full form                        │
│                                                                              │
│  LIST → CREATE (Add Button)                                                  │
│  ─────────────────────────                                                   │
│  /project → /project/new                                                     │
│  • OR inline add row (stays on list page)                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Navigation Guard for Temp Rows

```typescript
// Temp rows cannot be navigated to (they don't exist on server)
const handleRowClick = (row: FormattedRow) => {
  const rowId = row.raw?.id || (row as any).id;

  // GUARD: Block navigation for temp rows
  if (rowId?.toString().startsWith('temp_')) {
    return; // Do nothing - row is being created
  }

  navigate(`/${entityCode}/${rowId}`);
};
```

---

## 3. Page Component Architecture

### 3.1 Universal Page Pattern

The application uses 3 universal pages that handle all 27+ entity types dynamically:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         3 UNIVERSAL PAGES                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  EntityListOfInstancesPage.tsx                                               │
│  ──────────────────────────────                                              │
│  Route: /:entityCode (e.g., /project, /task)                                │
│  Purpose: Display entity list with multiple view modes                       │
│  Components:                                                                 │
│  ├── ViewSwitcher (table/kanban/grid/calendar)                              │
│  ├── EntityListOfInstancesTable (main data table)                           │
│  ├── KanbanBoard (kanban view)                                              │
│  ├── GridView (card grid)                                                   │
│  └── CalendarView (event calendar)                                          │
│                                                                              │
│  EntitySpecificInstancePage.tsx                                              │
│  ───────────────────────────────                                             │
│  Route: /:entityCode/:id (e.g., /project/uuid-123)                          │
│  Purpose: Display single entity with detail view + child tabs               │
│  Components:                                                                 │
│  ├── EntityDetailView (header + fields)                                     │
│  └── DynamicChildEntityTabs (child entity tables)                           │
│                                                                              │
│  EntityCreatePage.tsx / EntityFormPage.tsx                                  │
│  ─────────────────────────────────────────                                   │
│  Route: /:entityCode/new                                                     │
│  Purpose: Create new entity with auto-generated form                        │
│  Components:                                                                 │
│  └── EntityInstanceFormContainer (metadata-driven form)                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 EntityListOfInstancesPage Component Structure

```typescript
// apps/web/src/pages/shared/EntityListOfInstancesPage.tsx

export function EntityListOfInstancesPage() {
  const { entityCode } = useParams();

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 1: METADATA FETCHING (Two-Query Pattern - Query 1)
  // ═══════════════════════════════════════════════════════════════════════════
  // Fetches field metadata SEPARATELY from data (30-min cache)
  // Returns undefined during load → component shows skeleton

  const {
    viewType,
    editType,
    fields,
    isLoading: metadataLoading
  } = useEntityInstanceMetadata(entityCode, 'entityListOfInstancesTable');

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 2: DATA FETCHING (Two-Query Pattern - Query 2)
  // ═══════════════════════════════════════════════════════════════════════════
  // Fetches entity data (5-min cache)
  // Runs in PARALLEL with metadata query

  const {
    data: rawData,
    total,
    refData,
    isLoading: dataLoading,
    isFetching,
    refetch
  } = useEntityInstanceData(entityCode, { limit: 20000 });

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 3: METADATA ASSEMBLY (Combine viewType + editType)
  // ═══════════════════════════════════════════════════════════════════════════

  const componentMetadata = useMemo(() => {
    if (!viewType) return null;  // CRITICAL: Return null during load
    return { viewType, editType };
  }, [viewType, editType]);

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 4: FORMAT-AT-READ (Reactive Formatting)
  // ═══════════════════════════════════════════════════════════════════════════
  // Formats data on every read, reactive to datalabel cache changes

  const { data: formattedData } = useFormattedEntityData(
    rawData,
    componentMetadata,
    entityCode
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 5: OPTIMISTIC MUTATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  const { updateEntity, createEntity, deleteEntity, isPending } =
    useOptimisticMutation(entityCode, {
      onError: (err) => toast.error(err.message),
      refetchOnSuccess: false,  // Optimistic update is sufficient
    });

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 6: INLINE ADD ROW
  // ═══════════════════════════════════════════════════════════════════════════

  const {
    editingRow,
    editedData,
    isAddingRow,
    handleAddRow,
    handleEditRow,
    handleFieldChange,
    handleSave,
    handleCancel,
  } = useInlineAddRow({
    entityCode,
    createEntity,
    updateEntity,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: Loading States
  // ═══════════════════════════════════════════════════════════════════════════

  // Priority 1: Metadata loading blocks entire render
  if (metadataLoading || !componentMetadata) {
    return <LoadingSpinner />;
  }

  // Priority 2: Data loading shows skeleton rows
  if (dataLoading) {
    return <SkeletonTable columns={columns} />;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: Main Table
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <EntityListOfInstancesTable
      data={formattedData}
      metadata={componentMetadata}
      loading={isFetching}
      editingRow={editingRow}
      editedData={editedData}
      onInlineEdit={handleFieldChange}
      onSaveInlineEdit={handleSave}
      onCancelInlineEdit={handleCancel}
      allowAddRow={true}
      onAddRow={handleAddRowClick}
    />
  );
}
```

---

## 4. Cache Architecture (TanStack Query + Dexie)

### 4.1 Dual-Layer Cache System

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DUAL-LAYER CACHE ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────┐    ┌─────────────────────────────┐         │
│  │    TanStack Query           │    │         Dexie               │         │
│  │    (In-Memory)              │    │      (IndexedDB)            │         │
│  ├─────────────────────────────┤    ├─────────────────────────────┤         │
│  │ • Server state management   │    │ • Persistent storage        │         │
│  │ • Automatic background      │    │ • Survives browser restart  │         │
│  │   refetch                   │    │ • Offline-first access      │         │
│  │ • Stale-while-revalidate    │    │ • Multi-tab sync            │         │
│  │ • Cache invalidation        │    │ • Draft persistence         │         │
│  │ • Query deduplication       │    │ • 24-hour TTL               │         │
│  └─────────────────────────────┘    └─────────────────────────────┘         │
│              │                                   │                           │
│              └───────────────┬───────────────────┘                           │
│                              │                                               │
│                              ▼                                               │
│              ┌───────────────────────────────────┐                           │
│              │     Hydration Flow (App Start)    │                           │
│              ├───────────────────────────────────┤                           │
│              │ 1. App mounts                     │                           │
│              │ 2. hydrateFromDexie() called      │                           │
│              │ 3. Dexie data → TanStack Query    │                           │
│              │ 4. Components render instantly    │                           │
│              │ 5. Background refetch if stale    │                           │
│              └───────────────────────────────────┘                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Cache Store Configuration

| Store | Hook | Sync Function | Stale Time | GC Time | Persistence |
|-------|------|---------------|------------|---------|-------------|
| **globalSettings** | `useGlobalSettings()` | `getSettingSync()` | 30 min | 24 hours | Dexie |
| **datalabel** | `useDatalabel(key)` | `getDatalabelSync(key)` | 30 min | **Infinity** | Dexie |
| **entityCodes** | `useEntityCodes()` | `getEntityCodesSync()` | 30 min | 24 hours | Dexie |
| **entityInstMetadata** | `useEntityInstanceMetadata()` | `getEntityInstanceMetadataSync()` | 30 min | 24 hours | Dexie |
| **entityInstNames** | `useEntityInstanceNames()` | `getEntityInstanceNameSync()` | 10 min | 24 hours | Dexie |
| **entityInstData** | `useEntityInstanceData()` | - | 5 min | 30 min | Dexie |
| **draft** | `useDraft()` | - | Never | Forever | Dexie |

### 4.3 Query Key Structure

```typescript
// apps/web/src/db/cache/keys.ts

export const QUERY_KEYS = {
  // Session-level stores (hydrated at login)
  globalSettings: () => ['globalSettings'] as const,
  datalabelAll: () => ['datalabel'] as const,
  datalabel: (key: string) => ['datalabel', key] as const,
  entityCodes: () => ['entityCodes'] as const,
  entityInstanceNames: (entityCode: string) => ['entityInstanceNames', entityCode] as const,

  // On-demand stores (fetched when needed)
  entityInstanceData: (entityCode: string, params: object) =>
    ['entityInstanceData', entityCode, params] as const,
  entityInstanceDataByCode: (entityCode: string) =>
    ['entityInstanceData', entityCode] as const,  // For cache updates
  entityInstanceMetadata: (entityCode: string, component: string) =>
    ['entityInstanceMetadata', entityCode, component] as const,
  entityInstance: (entityCode: string, entityId: string) =>
    ['entityInstance', entityCode, entityId] as const,
};
```

---

## 5. Two-Query Pattern: Metadata + Data

### 5.1 Why Two Queries?

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TWO-QUERY PATTERN RATIONALE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PROBLEM: Single query bundles metadata + data                              │
│  ─────────────────────────────────────────────                              │
│  • Metadata re-fetched with every data request (wasteful)                   │
│  • User waits for BOTH before seeing anything                               │
│  • Schema rarely changes, data changes frequently                           │
│                                                                              │
│  SOLUTION: Separate queries with different cache times                      │
│  ──────────────────────────────────────────────────                         │
│                                                                              │
│  Query 1: Metadata (useEntityInstanceMetadata)                              │
│  ├── API: GET /api/v1/project?content=metadata                              │
│  ├── Returns: { fields, viewType, editType } (no data array)                │
│  ├── Cache: 30 minutes (schema rarely changes)                              │
│  └── Benefit: Show table columns INSTANTLY from cache                       │
│                                                                              │
│  Query 2: Data (useEntityInstanceData)                                      │
│  ├── API: GET /api/v1/project?limit=20000                                   │
│  ├── Returns: { data[], total, ref_data_entityInstance }                    │
│  ├── Cache: 5 minutes (data changes frequently)                             │
│  └── Benefit: Fill rows when ready                                          │
│                                                                              │
│  RESULT:                                                                     │
│  ────────                                                                    │
│  Time 0ms:   Page mounts                                                     │
│  Time 10ms:  Metadata from cache → table columns visible                    │
│  Time 200ms: Data arrives → rows render                                      │
│                                                                              │
│  vs Single Query:                                                            │
│  Time 0ms:   Page mounts, spinner shown                                      │
│  Time 200ms: Data + metadata arrives → everything renders at once           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Implementation

```typescript
// Query 1: Metadata (30-min cache)
export function useEntityInstanceMetadata(
  entityCode: string,
  component: string = 'entityListOfInstancesTable'
): UseEntityInstanceMetadataResult {
  const query = useQuery({
    queryKey: QUERY_KEYS.entityInstanceMetadata(entityCode, component),
    queryFn: async () => {
      // Check Dexie first
      const cached = await getEntityInstanceMetadata(entityCode, component);
      if (cached && Date.now() - cached.syncedAt < SESSION_STORE_CONFIG.staleTime) {
        return cached;
      }

      // Fetch metadata-only from API (no data transferred)
      const response = await apiClient.get(`/api/v1/${entityCode}`, {
        params: { content: 'metadata' },  // ← Key: Skip data query on backend
      });

      // Persist to Dexie
      await setEntityInstanceMetadata(entityCode, component, ...);
      return result;
    },
    staleTime: SESSION_STORE_CONFIG.staleTime,  // 30 minutes
  });

  return {
    fields: query.data?.fields ?? [],
    viewType: query.data?.viewType,   // undefined during load
    editType: query.data?.editType,   // undefined during load
    isLoading: query.isLoading,
  };
}

// Query 2: Data (5-min cache)
export function useEntityInstanceData<T>(
  entityCode: string,
  params: EntityInstanceDataParams = {}
): UseEntityInstanceDataResult<T> {
  const query = useQuery({
    queryKey: QUERY_KEYS.entityInstanceData(entityCode, params),
    queryFn: async () => {
      // Check Dexie first (with TTL validation)
      const cached = await getEntityInstanceData(entityCode, params);
      if (cached && !isStale(cached)) {
        return cached;
      }

      // Fetch from API
      const response = await apiClient.get(`/api/v1/${entityCode}?${searchParams}`);

      // Persist to Dexie
      await persistToEntityInstanceData(...);
      return result;
    },
    staleTime: ONDEMAND_STORE_CONFIG.staleTime,  // 5 minutes
  });

  return {
    data: query.data?.data ?? [],
    total: query.data?.total ?? 0,
    metadata: query.data?.metadata,
    refData: query.data?.refData,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
  };
}
```

---

## 6. Format-at-Read Pattern

### 6.1 Concept

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FORMAT-AT-READ PATTERN                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ANTI-PATTERN: Format-at-Fetch                                              │
│  ─────────────────────────────                                               │
│  API → format → store formatted in cache → read from cache                  │
│  PROBLEM: Badge colors disappear when datalabel cache updates               │
│           (formatted data doesn't re-format automatically)                  │
│                                                                              │
│  PATTERN: Format-at-Read                                                    │
│  ───────────────────────                                                     │
│  API → store RAW in cache → read from cache → format via useMemo            │
│  BENEFIT: Formatting is REACTIVE to datalabel cache changes                 │
│                                                                              │
│  DATA FLOW:                                                                  │
│  ──────────                                                                  │
│  ┌─────────────────────┐                                                     │
│  │ TanStack Query      │  Stores: { data: T[], refData, total }             │
│  │ (RAW data only)     │  Format: None - raw API response                   │
│  └─────────────────────┘                                                     │
│            │                                                                 │
│            ▼                                                                 │
│  ┌─────────────────────┐                                                     │
│  │ useFormattedEntity  │  Subscribes to: datalabel cache                    │
│  │ Data (useMemo)      │  Dependencies: [rawData, metadata, cacheTimestamp] │
│  └─────────────────────┘                                                     │
│            │                                                                 │
│            ▼                                                                 │
│  ┌─────────────────────┐                                                     │
│  │ FormattedRow[]      │  Structure: { raw: T, display: {}, styles: {} }    │
│  │ (Render-ready)      │  display: Pre-computed strings                     │
│  └─────────────────────┘  styles: CSS classes for badges                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 FormattedRow Structure

```typescript
// apps/web/src/lib/formatters/types.ts

export interface FormattedRow<T> {
  /** Original raw data (for editing, filtering, sorting) */
  raw: T;

  /** Pre-formatted display strings (for view mode) */
  display: Record<string, string>;
  // Example: { budget_allocated_amt: "$50,000.00", dl__project_stage: "Planning" }

  /** CSS class strings (for badges, status indicators) */
  styles: Record<string, string>;
  // Example: { dl__project_stage: "bg-blue-100 text-blue-800" }
}
```

### 6.3 Reactive Formatting with Cache Subscription

```typescript
// apps/web/src/lib/hooks/useFormattedEntityData.ts

export function useFormattedEntityData<T>(
  rawData: T[] | undefined,
  metadata: ComponentMetadata | null,
  entityCode?: string
): UseFormattedEntityDataResult<T> {
  const queryClient = useQueryClient();

  // ═══════════════════════════════════════════════════════════════════════════
  // CACHE SUBSCRIPTION: React 18 useSyncExternalStore pattern
  // ═══════════════════════════════════════════════════════════════════════════
  // Subscribe to datalabel cache updates (for badge color reactivity)
  // When datalabel cache updates → timestamp changes → useMemo re-runs

  const datalabelCacheTimestamp = useSyncExternalStore(
    // subscribe - Register callback for QueryCache changes
    (callback) => {
      return queryClient.getQueryCache().subscribe((event) => {
        // Only trigger re-render if datalabel queries were updated
        if (event?.query?.queryKey?.[0] === 'datalabel') {
          callback();
        }
      });
    },
    // getSnapshot - Return current timestamp from cache
    () => {
      const state = queryClient.getQueryState(QUERY_KEYS.datalabelAll());
      return state?.dataUpdatedAt ?? 0;
    },
    // getServerSnapshot - Return initial value for SSR
    () => 0
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // REACTIVE FORMATTING: useMemo with cache dependency
  // ═══════════════════════════════════════════════════════════════════════════

  const formattedData = useMemo(() => {
    if (!rawData || rawData.length === 0) return [];
    return formatDataset(rawData, metadata);
  }, [rawData, metadata, datalabelCacheTimestamp]);  // ← Key: cache dependency

  return { data: formattedData, isLoading: !rawData };
}
```

---

## 7. Metadata-Driven Rendering

### 7.1 Backend Metadata Structure

```typescript
// API Response: GET /api/v1/project?content=metadata
{
  "data": [],  // Empty when content=metadata
  "fields": ["id", "name", "code", "budget_allocated_amt", "dl__project_stage"],
  "metadata": {
    "entityListOfInstancesTable": {
      "viewType": {
        "budget_allocated_amt": {
          "dtype": "float",
          "label": "Budget Allocated",
          "renderType": "currency",
          "style": { "symbol": "$", "decimals": 2 },
          "behavior": { "visible": true, "sortable": true }
        },
        "dl__project_stage": {
          "dtype": "str",
          "label": "Project Stage",
          "renderType": "badge",
          "lookupField": "dl__project_stage",
          "lookupSourceTable": "datalabel",
          "behavior": { "visible": true, "filterable": true }
        },
        "manager__employee_id": {
          "dtype": "uuid",
          "label": "Manager",
          "renderType": "component",
          "component": "EntityInstanceName",
          "lookupEntity": "employee",
          "lookupSourceTable": "entityInstance"
        }
      },
      "editType": {
        "budget_allocated_amt": {
          "inputType": "number",
          "behavior": { "editable": true }
        },
        "dl__project_stage": {
          "inputType": "component",
          "component": "BadgeDropdownSelect",
          "lookupField": "dl__project_stage",
          "lookupSourceTable": "datalabel",
          "behavior": { "editable": true }
        },
        "manager__employee_id": {
          "inputType": "component",
          "component": "EntityInstanceNameSelect",
          "lookupEntity": "employee",
          "lookupSourceTable": "entityInstance",
          "behavior": { "editable": true }
        }
      }
    }
  }
}
```

### 7.2 Column Generation from Metadata

```typescript
// EntityListOfInstancesTable.tsx - Column generation

const columns = useMemo(() => {
  const viewType = extractViewType(metadata);
  const editType = extractEditType(metadata);

  if (!viewType) return [];  // CRITICAL: Return empty during metadata load

  // Get field order from fields array
  const fieldOrder = metadata?.fields || Object.keys(viewType);

  return fieldOrder
    .filter((fieldKey) => {
      const fieldMeta = viewType[fieldKey];
      return fieldMeta?.behavior?.visible === true;  // Only visible fields
    })
    .map((fieldKey) => {
      const viewMeta = viewType[fieldKey];
      const editMeta = editType?.[fieldKey];

      return {
        key: fieldKey,
        title: viewMeta.label || humanizeKey(fieldKey),
        visible: true,
        sortable: viewMeta.behavior?.sortable,
        filterable: viewMeta.behavior?.filterable,
        editable: editMeta?.behavior?.editable ?? false,
        editType: editMeta?.inputType ?? 'text',
        lookupSourceTable: editMeta?.lookupSourceTable,
        lookupEntity: editMeta?.lookupEntity,
        lookupField: editMeta?.lookupField || viewMeta?.lookupField,
        backendMetadata: { key: fieldKey, ...viewMeta },
      };
    });
}, [metadata]);
```

### 7.3 View Mode Rendering (Frontend is "Dumb")

```typescript
// apps/web/src/lib/formatters/datasetFormatter.ts

// Formatter registry - maps renderType to formatter function
const FORMATTERS = {
  'currency': formatCurrency,      // "$50,000.00"
  'badge': formatBadge,            // { display: "Planning", style: "bg-blue-100" }
  'date': formatDate,              // "Dec 5, 2025"
  'timestamp': formatRelativeTime, // "2 hours ago"
  'boolean': formatBoolean,        // "Yes" / "No"
  'reference': formatReference,    // Looks up entity name from cache
  'text': formatText,              // Default passthrough
};

export function formatValue(value: any, key: string, metadata: ViewFieldMetadata) {
  const renderType = metadata?.renderType || 'text';

  // Component-based rendering
  if (renderType === 'component' && metadata?.component) {
    if (metadata.component === 'EntityInstanceName') {
      return formatReference(value, metadata);  // UUID → "James Miller"
    }
  }

  const formatter = FORMATTERS[renderType] || formatText;
  return formatter(value, metadata);
}
```

---

## 8. DataTable Component Architecture

### 8.1 Component Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DATATABLE COMPONENT HIERARCHY                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  EntityListOfInstancesTable (Main Component)                                 │
│  ├── Props: data, metadata, loading, editingRow, editedData, ...            │
│  │                                                                           │
│  ├── Header Row                                                              │
│  │   ├── Column headers with sort indicators                                │
│  │   ├── Filter dropdowns (per-column)                                      │
│  │   └── Column visibility toggle                                           │
│  │                                                                           │
│  ├── Body Rows (Virtualized with @tanstack/react-virtual)                   │
│  │   ├── Regular Row                                                         │
│  │   │   ├── Cell (View Mode): row.display[key]                             │
│  │   │   ├── Cell (Edit Mode): renderEditModeFromMetadata()                 │
│  │   │   └── Cell (Styles): row.styles[key] for badges                      │
│  │   │                                                                       │
│  │   └── Editing Row (when editingRow === row.id)                           │
│  │       ├── Inline inputs for each editable column                         │
│  │       ├── Save button (checkmark)                                        │
│  │       └── Cancel button (X)                                               │
│  │                                                                           │
│  ├── Add Row Button (when allowAddRow=true)                                 │
│  │   └── Clicking adds temp row to cache and enters edit mode               │
│  │                                                                           │
│  └── Pagination Controls                                                     │
│      ├── Page numbers                                                        │
│      ├── Page size selector                                                  │
│      └── Total count display                                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Row Rendering Logic

```typescript
// EntityListOfInstancesTable.tsx - Row rendering

{sortedData.map((row, index) => {
  const rowId = getRowKey(row);
  const isEditing = editingRow === rowId;
  const rawRecord = (row as FormattedRow<any>).raw || row;

  return (
    <tr
      key={rowId}
      onClick={() => !isEditing && onRowClick?.(row)}
      className={cn(
        isEditing && 'bg-blue-50',
        focusedRowId === rowId && 'ring-2 ring-blue-500'
      )}
    >
      {visibleColumnsList.map((column) => (
        <td key={column.key}>
          {isEditing && column.editable ? (
            // ═══════════════════════════════════════════════════════════════
            // EDIT MODE: Render input based on editType from metadata
            // ═══════════════════════════════════════════════════════════════
            renderEditCell(column, rawRecord, editedData)
          ) : (
            // ═══════════════════════════════════════════════════════════════
            // VIEW MODE: Use pre-formatted display value
            // ═══════════════════════════════════════════════════════════════
            renderViewCell(column, row)
          )}
        </td>
      ))}

      {/* Row Actions: Edit, Delete, Share */}
      <td>
        {isEditing ? (
          <>
            <button onClick={() => onSaveInlineEdit?.(row)}>✓</button>
            <button onClick={onCancelInlineEdit}>✕</button>
          </>
        ) : (
          <>
            <button onClick={() => handleEditRow(row)}>✏️</button>
            <button onClick={() => onDelete?.(rawRecord)}>🗑️</button>
          </>
        )}
      </td>
    </tr>
  );
})}
```

### 8.3 View Cell Rendering

```typescript
// View mode: Use FormattedRow structure
function renderViewCell(column: Column, row: FormattedRow | any) {
  const formattedRow = row as FormattedRow<any>;
  const displayValue = formattedRow.display?.[column.key];
  const styleClass = formattedRow.styles?.[column.key];

  // Badge with color
  if (styleClass) {
    return (
      <span className={cn('px-2 py-1 rounded-full text-sm', styleClass)}>
        {displayValue}
      </span>
    );
  }

  // Regular text
  return <span>{displayValue ?? '-'}</span>;
}
```

---

## 9. Inline Editing Pattern

### 9.1 Airtable-Style Cell Editing

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AIRTABLE-STYLE INLINE EDITING                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  INTERACTION PATTERN:                                                        │
│  ────────────────────                                                        │
│  • Single-click on editable cell → Instant inline edit of THAT cell only    │
│  • Click outside / Tab / Enter → Auto-save and exit edit mode               │
│  • Escape → Cancel without saving                                            │
│  • Edit icon (✏️) → Edit entire row (fallback for discoverability)          │
│  • Keyboard 'E' when row focused → Enter row edit mode                      │
│  • Tab → Navigate to next editable cell (spreadsheet convention)            │
│  • Cmd+Z / Ctrl+Z → Undo last change with toast notification                │
│                                                                              │
│  STATE MANAGEMENT:                                                           │
│  ─────────────────                                                           │
│  editingCell: { rowId: string, columnKey: string } | null                   │
│  localCellValue: any (current value being edited)                           │
│  undoStack: Array<{ rowId, columnKey, oldValue, newValue }>                 │
│                                                                              │
│  CELL EDITING FLOW:                                                          │
│  ──────────────────                                                          │
│  1. User clicks cell → enterEditMode(rowId, columnKey, record)              │
│  2. localCellValue = row.raw[columnKey]                                     │
│  3. Cell renders input component based on editType                          │
│  4. User changes value → localCellValue updated                             │
│  5. User clicks outside → handleCellBlur()                                  │
│  6. If value changed:                                                        │
│     a. Push to undoStack                                                     │
│     b. Call onCellSave(rowId, columnKey, newValue, record)                  │
│     c. Optimistic update: TanStack cache + Dexie updated                    │
│     d. API PATCH in background                                               │
│  7. Exit edit mode → editingCell = null                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Edit Cell Rendering

```typescript
// renderEditModeFromMetadata - Renders input based on backend editType
function renderEditCell(column: Column, rawRecord: any, editedData: any) {
  const currentValue = editedData[column.key] ?? rawRecord[column.key];
  const metadata = column.backendMetadata;

  // Route based on inputType from backend
  switch (column.editType) {
    case 'text':
      return (
        <input
          type="text"
          value={currentValue ?? ''}
          onChange={(e) => onInlineEdit?.(column.key, e.target.value)}
          className="w-full border rounded px-2 py-1"
          autoFocus
        />
      );

    case 'number':
    case 'currency':
      return (
        <input
          type="number"
          step={column.editType === 'currency' ? '0.01' : '1'}
          value={currentValue ?? ''}
          onChange={(e) => onInlineEdit?.(column.key, parseFloat(e.target.value))}
          className="w-full border rounded px-2 py-1"
        />
      );

    case 'component':
      // Component-based editing (BadgeDropdownSelect, EntityInstanceNameSelect)
      if (metadata?.component === 'BadgeDropdownSelect') {
        return (
          <BadgeDropdownSelect
            value={currentValue}
            datalabelKey={column.lookupField}
            onChange={(value) => onInlineEdit?.(column.key, value)}
          />
        );
      }
      if (metadata?.component === 'EntityInstanceNameSelect') {
        return (
          <EntityInstanceNameSelect
            value={currentValue}
            entityCode={column.lookupEntity}
            onChange={(value) => onInlineEdit?.(column.key, value)}
          />
        );
      }
      break;

    case 'date':
      return (
        <input
          type="date"
          value={currentValue ?? ''}
          onChange={(e) => onInlineEdit?.(column.key, e.target.value)}
        />
      );
  }

  // Default: text input
  return <input type="text" value={currentValue ?? ''} />;
}
```

---

## 10. Optimistic Updates Pattern

### 10.1 Industry-Standard Pattern

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    OPTIMISTIC UPDATE PATTERN                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  TIMELINE:                                                                   │
│  ─────────                                                                   │
│  T+0ms:   User clicks save                                                   │
│  T+1ms:   onMutate() fires:                                                  │
│           ├── Cancel outgoing queries (prevent race)                        │
│           ├── Capture previous state (for rollback)                         │
│           ├── Update TanStack Query cache (UI updates)                      │
│           └── Update Dexie cache (parallel, for persistence)                │
│  T+2ms:   UI shows new value (INSTANT feedback)                             │
│  T+200ms: API response arrives:                                              │
│           ├── Success → Optional refetch, update entity names               │
│           └── Error → Direct rollback using captured previous state         │
│                                                                              │
│  KEY INSIGHT: Rollback works OFFLINE                                        │
│  ───────────────────────────────────                                         │
│  Previous state is captured in onMutate context.                            │
│  On error, we restore from context - no network call needed.                │
│  This is the TanStack Query official pattern.                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10.2 useOptimisticMutation Implementation

```typescript
// apps/web/src/db/cache/hooks/useOptimisticMutation.ts

export function useOptimisticMutation<T extends { id: string }>(
  entityCode: string,
  options: UseOptimisticMutationOptions = {}
): UseOptimisticMutationResult<T> {
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async ({ entityId, changes }) => {
      const response = await apiClient.patch(`/api/v1/${entityCode}/${entityId}`, changes);
      return response.data?.data || response.data;
    },

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 1: OPTIMISTIC UPDATE (Before API call)
    // ═══════════════════════════════════════════════════════════════════════
    onMutate: async ({ entityId, changes }) => {
      // Cancel outgoing queries to prevent race conditions
      await queryClient.cancelQueries({
        queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode),
      });

      // Capture ALL previous list data for rollback
      const allPreviousListData = updateAllListCaches(
        queryClient,
        entityCode,
        (data) => data.map((item) => (item.id === entityId ? { ...item, ...changes } : item))
      );

      // Update Dexie in parallel
      updateEntityInstanceDataItem(entityCode, entityId, (item) => ({ ...item, ...changes }));

      // Return context for rollback
      return { allPreviousListData, entityId, mutationType: 'update' };
    },

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 2: ROLLBACK ON ERROR (Direct restore, no network)
    // ═══════════════════════════════════════════════════════════════════════
    onError: (error, { entityId }, context) => {
      // Direct rollback using captured previous states
      if (context?.allPreviousListData) {
        rollbackAllListCaches(queryClient, context.allPreviousListData);
      }

      // Clear Dexie for consistency
      clearEntityInstanceData(entityCode);

      options.onError?.(error, { entityId });
    },

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 3: ON SUCCESS (Optional refetch)
    // ═══════════════════════════════════════════════════════════════════════
    onSettled: async (data, error, variables) => {
      if (!error && data) {
        // Update entity instance name if changed
        if (data.name) {
          await setEntityInstance(entityCode, variables.entityId, data.name);
        }

        if (options.refetchOnSuccess) {
          queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode),
          });
        }

        options.onSuccess?.(data, variables);
      }
    },
  });

  return {
    updateEntity: (entityId, changes) => updateMutation.mutateAsync({ entityId, changes }),
    createEntity: (data, options) => createMutation.mutateAsync({ data, ...options }),
    deleteEntity: (entityId) => deleteMutation.mutateAsync(entityId),
    isPending: updateMutation.isPending || createMutation.isPending || deleteMutation.isPending,
    error: updateMutation.error || createMutation.error || deleteMutation.error,
  };
}
```

---

## 11. Inline Add Row Pattern

### 11.1 Single Source of Truth

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    INLINE ADD ROW PATTERN                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PRINCIPLE: Cache is the ONLY data store                                    │
│  ───────────────────────────────────────                                     │
│  • NO local state copying of rows                                           │
│  • Temp row added directly to TanStack Query cache                          │
│  • Components read from cache → see new row immediately                     │
│                                                                              │
│  FLOW:                                                                       │
│  ─────                                                                       │
│  1. User clicks "Add new row"                                                │
│  2. handleAddRow():                                                          │
│     ├── Create temp row: { id: 'temp_1733400000', name: 'Untitled', ... }   │
│     ├── Add to TanStack Query cache (ALL matching queries)                  │
│     ├── setEditingRow(tempId)                                               │
│     └── setIsAddingRow(true)                                                │
│  3. UI renders new row at bottom (from cache)                               │
│  4. User fills in fields → editedData accumulates changes                   │
│  5. User clicks Save:                                                        │
│     ├── Pass existingTempId to createEntity() → skip duplicate temp row     │
│     ├── API POST creates real entity                                        │
│     ├── On success: replace temp row with real data in cache                │
│     └── Clear edit state                                                     │
│  6. User clicks Cancel:                                                      │
│     ├── Remove temp row from cache                                          │
│     └── Clear edit state                                                     │
│                                                                              │
│  KEY: existingTempId                                                         │
│  ──────────────────                                                          │
│  When handleAddRow() adds temp row to cache, it passes the tempId to        │
│  createEntity(data, { existingTempId }). This tells useOptimisticMutation   │
│  to SKIP creating another temp row in onMutate (it already exists).         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 11.2 useInlineAddRow Hook

```typescript
// apps/web/src/db/cache/hooks/useInlineAddRow.ts

export function useInlineAddRow<T extends { id: string }>(
  options: UseInlineAddRowOptions<T>
): UseInlineAddRowResult<T> {
  const queryClient = useQueryClient();
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editedData, setEditedData] = useState<Partial<T>>({});
  const [isAddingRow, setIsAddingRow] = useState(false);

  // Add row directly to TanStack Query cache
  const addRowToCache = useCallback((newRow: T) => {
    const matchingQueries = queryClient.getQueryCache().findAll({
      queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode),
    });

    for (const query of matchingQueries) {
      queryClient.setQueryData(query.queryKey, (oldData: any) => ({
        ...oldData,
        data: [...oldData.data, newRow],
        total: (oldData.total || 0) + 1,
      }));
    }
  }, [queryClient, entityCode]);

  // Remove row from cache (for cancel)
  const removeRowFromCache = useCallback((rowId: string) => {
    const matchingQueries = queryClient.getQueryCache().findAll({
      queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode),
    });

    for (const query of matchingQueries) {
      queryClient.setQueryData(query.queryKey, (oldData: any) => ({
        ...oldData,
        data: oldData.data.filter((item: any) => item.id !== rowId),
        total: Math.max(0, (oldData.total || 1) - 1),
      }));
    }
  }, [queryClient, entityCode]);

  const handleAddRow = useCallback((newRow: T) => {
    addRowToCache(newRow);
    setEditingRow(newRow.id);
    setEditedData(newRow as Partial<T>);
    setIsAddingRow(true);
  }, [addRowToCache]);

  const handleSave = useCallback(async (record: T) => {
    const isNewRow = isAddingRow || isTempRow(record.id);

    if (isNewRow) {
      // Pass existingTempId to skip duplicate temp row in onMutate
      await createEntity(editedData, { existingTempId: record.id });
    } else {
      await updateEntity(record.id, editedData);
    }

    setEditingRow(null);
    setEditedData({});
    setIsAddingRow(false);
  }, [isAddingRow, editedData, createEntity, updateEntity]);

  const handleCancel = useCallback(() => {
    if (isAddingRow && editingRow) {
      removeRowFromCache(editingRow);
    }
    setEditingRow(null);
    setEditedData({});
    setIsAddingRow(false);
  }, [isAddingRow, editingRow, removeRowFromCache]);

  return {
    editingRow,
    editedData,
    isAddingRow,
    handleAddRow,
    handleFieldChange: (field, value) => setEditedData(prev => ({ ...prev, [field]: value })),
    handleSave,
    handleCancel,
    isRowEditing: (rowId) => editingRow === rowId,
    isTempRow: (rowId) => rowId?.startsWith('temp_'),
  };
}
```

---

## 12. Draft Persistence Pattern

### 12.1 Dexie-Based Draft Storage

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DRAFT PERSISTENCE PATTERN                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PURPOSE: Persist form edits across page refresh and browser restart        │
│  ────────                                                                    │
│                                                                              │
│  STORAGE: Dexie IndexedDB (survives everything except clear browsing data)  │
│  ────────                                                                    │
│                                                                              │
│  FEATURES:                                                                   │
│  ─────────                                                                   │
│  • Undo/redo with configurable stack size (default: 50)                     │
│  • Dirty field tracking (knows which fields changed)                        │
│  • Reactive updates via useLiveQuery                                        │
│  • Draft recovery on app restart                                            │
│                                                                              │
│  DEXIE SCHEMA:                                                               │
│  ──────────────                                                              │
│  draft: {                                                                    │
│    _id: 'project:uuid-123',  // entityCode:entityId                         │
│    entityCode: 'project',                                                    │
│    entityId: 'uuid-123',                                                     │
│    originalData: { ... },     // Snapshot at edit start                     │
│    currentData: { ... },      // Current edited state                       │
│    undoStack: [ { ... }, ... ],                                             │
│    redoStack: [ { ... }, ... ],                                             │
│    updatedAt: 1733400000000,                                                 │
│  }                                                                           │
│                                                                              │
│  LIFECYCLE:                                                                  │
│  ──────────                                                                  │
│  1. User clicks Edit → startEdit(originalData) → Creates draft in Dexie    │
│  2. User changes field → updateField(field, value) → Updates draft          │
│  3. User clicks Undo → undo() → Restores from undoStack                     │
│  4. User refreshes page → Draft survives → Can resume editing               │
│  5. User clicks Save → API call → discardDraft() → Removes from Dexie       │
│  6. User clicks Cancel → discardDraft() → Removes from Dexie                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 12.2 useDraft Hook Usage

```typescript
// Usage in EntitySpecificInstancePage
const {
  hasDraft,
  currentData,
  dirtyFields,
  hasChanges,
  canUndo,
  canRedo,
  startEdit,
  updateField,
  undo,
  redo,
  reset,
  discardDraft,
} = useDraft<Project>('project', projectId, originalProjectData);

// Start editing
const handleEditClick = () => {
  startEdit(originalProjectData);
};

// Update a field
const handleFieldChange = (field: string, value: any) => {
  updateField(field, value);
};

// Save changes
const handleSave = async () => {
  const changes = getChanges();  // Only changed fields
  await updateEntity(projectId, changes);
  await discardDraft();
};

// Undo last change
const handleUndo = () => {
  undo();  // Restores previous state from undoStack
};
```

---

## 13. Reactive Re-rendering & Cache Subscriptions

### 13.1 When Components Re-render

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    COMPONENT RE-RENDER TRIGGERS                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  TRIGGER 1: TanStack Query Cache Update                                     │
│  ─────────────────────────────────────                                       │
│  • useQuery returns { data, isLoading, isFetching }                         │
│  • When cache updates → query.data changes → component re-renders           │
│  • Optimistic updates work this way                                         │
│                                                                              │
│  TRIGGER 2: Datalabel Cache Subscription (useSyncExternalStore)             │
│  ─────────────────────────────────────────────────────────────              │
│  • useFormattedEntityData subscribes to QueryCache                          │
│  • When datalabel cache updates → timestamp changes → useMemo re-runs       │
│  • formatDataset() reads fresh datalabel options                            │
│  • Badge colors update reactively                                            │
│                                                                              │
│  TRIGGER 3: Local State Changes                                              │
│  ─────────────────────────────                                               │
│  • editingRow, editedData, visibleColumns, sortField, etc.                  │
│  • Standard React useState → component re-renders                           │
│                                                                              │
│  TRIGGER 4: WebSocket Invalidation                                          │
│  ─────────────────────────────────                                           │
│  • wsManager receives INVALIDATE message                                    │
│  • Calls queryClient.invalidateQueries()                                    │
│  • TanStack Query marks query as stale                                      │
│  • Auto-refetch (if query is active) → cache updates → re-render            │
│                                                                              │
│  TRIGGER 5: Dexie useLiveQuery                                              │
│  ─────────────────────────────                                               │
│  • useDraft uses useLiveQuery for reactive draft updates                    │
│  • When Dexie IndexedDB changes → component re-renders                      │
│  • Used for draft persistence across tabs                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 13.2 QueryCache Subscription Pattern

```typescript
// React 18 useSyncExternalStore pattern for cache subscription

const datalabelCacheTimestamp = useSyncExternalStore(
  // subscribe - Called once to register callback
  (callback) => {
    return queryClient.getQueryCache().subscribe((event) => {
      // Filter: Only react to datalabel updates
      if (event?.query?.queryKey?.[0] === 'datalabel') {
        callback();  // Triggers getSnapshot re-evaluation
      }
    });
  },

  // getSnapshot - Called on every render + after callback
  () => {
    const state = queryClient.getQueryState(QUERY_KEYS.datalabelAll());
    return state?.dataUpdatedAt ?? 0;  // Returns timestamp
  },

  // getServerSnapshot - For SSR (always 0)
  () => 0
);

// Use timestamp as useMemo dependency
const formattedData = useMemo(() => {
  return formatDataset(rawData, metadata);
}, [rawData, metadata, datalabelCacheTimestamp]);  // ← Re-formats when cache updates
```

---

## 14. Sync vs Async Cache Access

### 14.1 When to Use Each

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SYNC vs ASYNC CACHE ACCESS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ASYNC ACCESS (Hooks)                                                        │
│  ─────────────────────                                                       │
│  Use: In React components that can handle loading states                    │
│  Returns: { data, isLoading, isError, refetch }                             │
│  Pattern: Triggers Suspense-compatible loading                              │
│                                                                              │
│  const { data, isLoading } = useDatalabel('project_stage');                 │
│  const { data, isLoading } = useEntityInstanceData('project', params);      │
│  const { viewType, isLoading } = useEntityInstanceMetadata('project');      │
│                                                                              │
│  SYNC ACCESS (Non-Hook Functions)                                           │
│  ────────────────────────────────                                            │
│  Use: In formatters, utilities, non-component code                          │
│  Returns: Cached value OR null (never fetches)                              │
│  Pattern: Assumes data was pre-fetched                                      │
│                                                                              │
│  const options = getDatalabelSync('project_stage');     // → options | null │
│  const name = getEntityInstanceNameSync('employee', uuid); // → name | null │
│  const codes = getEntityCodesSync();                    // → codes | null   │
│  const setting = getSettingSync('date_format');         // → value | null   │
│                                                                              │
│  IMPLEMENTATION:                                                             │
│  ───────────────                                                             │
│  // Sync functions read directly from queryClient.getQueryData()            │
│  export function getDatalabelSync(key: string): DatalabelOption[] | null {  │
│    return queryClient.getQueryData(QUERY_KEYS.datalabel(key)) ?? null;      │
│  }                                                                           │
│                                                                              │
│  // Used in formatters (non-component context)                              │
│  export function formatBadge(value: string, meta: ViewFieldMetadata) {      │
│    const options = getDatalabelSync(meta.lookupField);                      │
│    const option = options?.find(o => o.value === value);                    │
│    return {                                                                  │
│      display: option?.label ?? value,                                        │
│      style: option?.color_code ? colorToClass(option.color_code) : '',      │
│    };                                                                        │
│  }                                                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 14.2 Sync Accessor Implementation

```typescript
// apps/web/src/db/cache/stores.ts

import { queryClient } from './client';
import { QUERY_KEYS } from './keys';

// ═══════════════════════════════════════════════════════════════════════════
// SYNC ACCESSORS: Read from TanStack Query cache (no fetch)
// ═══════════════════════════════════════════════════════════════════════════

export function getDatalabelSync(key: string): DatalabelOption[] | null {
  return queryClient.getQueryData(QUERY_KEYS.datalabel(key)) ?? null;
}

export function getEntityCodesSync(): EntityCode[] | null {
  return queryClient.getQueryData(QUERY_KEYS.entityCodes()) ?? null;
}

export function getEntityCodeSync(code: string): EntityCode | null {
  const codes = getEntityCodesSync();
  return codes?.find(c => c.code === code) ?? null;
}

export function getChildEntityCodesSync(parentCode: string): string[] | null {
  const entity = getEntityCodeSync(parentCode);
  return entity?.child_entity_codes ?? null;
}

export function getEntityInstanceNameSync(entityCode: string, entityId: string): string | null {
  const names = queryClient.getQueryData<Record<string, string>>(
    QUERY_KEYS.entityInstanceNames(entityCode)
  );
  return names?.[entityId] ?? null;
}

export function getSettingSync(key: string): any {
  const settings = queryClient.getQueryData<GlobalSettings>(QUERY_KEYS.globalSettings());
  return settings?.[key] ?? null;
}
```

---

## 15. WebSocket Real-Time Invalidation

### 15.1 Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WEBSOCKET INVALIDATION FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SERVER SIDE (API + PubSub):                                                │
│  ──────────────────────────                                                  │
│  1. User A updates project via API                                          │
│  2. Database trigger writes to app.system_logging                           │
│  3. LogWatcher polls system_logging every 60s                               │
│  4. PubSub service broadcasts INVALIDATE to all connected clients           │
│                                                                              │
│  CLIENT SIDE (WebSocketManager):                                            │
│  ─────────────────────────────                                               │
│  1. wsManager receives: { type: 'INVALIDATE', entityCode: 'project' }       │
│  2. wsManager calls: queryClient.invalidateQueries(...)                     │
│  3. TanStack Query marks queries as stale                                   │
│  4. Active queries auto-refetch → cache updates → UI re-renders             │
│                                                                              │
│  MESSAGE TYPES:                                                              │
│  ──────────────                                                              │
│  INVALIDATE:  { type: 'INVALIDATE', entityCode, entityId? }                 │
│  SUBSCRIBE:   { type: 'SUBSCRIBE', entityCode, entityIds: [] }              │
│  UNSUBSCRIBE: { type: 'UNSUBSCRIBE', entityCode }                           │
│                                                                              │
│  SUBSCRIPTION PATTERN:                                                       │
│  ────────────────────                                                        │
│  useEntityInstanceData subscribes on mount:                                 │
│  useEffect(() => {                                                           │
│    wsManager.subscribe(entityCode, []);  // Subscribe to entity type        │
│  }, [entityCode]);                                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 15.2 WebSocketManager Implementation

```typescript
// apps/web/src/db/realtime/manager.ts

class WebSocketManager {
  private ws: WebSocket | null = null;
  private subscriptions = new Map<string, Set<string>>();

  connect() {
    this.ws = new WebSocket(WS_URL);

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === 'INVALIDATE') {
        this.handleInvalidate(message);
      }
    };
  }

  handleInvalidate(payload: InvalidatePayload) {
    const { entityCode, entityId } = payload;

    if (entityId) {
      // Invalidate specific entity
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.entityInstance(entityCode, entityId),
      });
    }

    // Invalidate all list queries for this entity type
    queryClient.invalidateQueries({
      queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode),
    });

    // Clear Dexie cache for fresh data
    clearEntityInstanceData(entityCode);
  }

  subscribe(entityCode: string, entityIds: string[]) {
    this.ws?.send(JSON.stringify({
      type: 'SUBSCRIBE',
      entityCode,
      entityIds,
    }));
  }
}

export const wsManager = new WebSocketManager();
```

---

## 16. Component Re-render Lifecycle

### 16.1 Complete Render Sequence

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    COMPONENT RENDER LIFECYCLE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PHASE 1: MOUNT (First Render)                                              │
│  ─────────────────────────────                                               │
│  Time 0ms:   Component mounts                                                │
│  Time 1ms:   useEntityInstanceMetadata() returns { viewType: undefined }    │
│  Time 2ms:   useEntityInstanceData() returns { data: [], isLoading: true }  │
│  Time 3ms:   if (!viewType) return <LoadingSpinner />  ← BLOCKS RENDER      │
│                                                                              │
│  PHASE 2: METADATA ARRIVES                                                   │
│  ─────────────────────────                                                   │
│  Time 50ms:  TanStack Query cache hit (or API response)                     │
│  Time 51ms:  viewType = { ... } (no longer undefined)                       │
│  Time 52ms:  Component re-renders                                            │
│  Time 53ms:  columns = generateColumnsFromMetadata(viewType)                │
│  Time 54ms:  if (dataLoading) return <SkeletonTable columns={columns} />    │
│                                                                              │
│  PHASE 3: DATA ARRIVES                                                       │
│  ─────────────────────                                                       │
│  Time 200ms: API response with data array                                   │
│  Time 201ms: useEntityInstanceData() returns { data: [...], isLoading: false }
│  Time 202ms: Component re-renders                                            │
│  Time 203ms: useFormattedEntityData() → formatDataset() runs                │
│  Time 204ms: formattedData = [{ raw, display, styles }, ...]                │
│  Time 205ms: <EntityListOfInstancesTable data={formattedData} /> renders    │
│                                                                              │
│  PHASE 4: USER INTERACTION (Edit)                                           │
│  ─────────────────────────────────                                           │
│  Time N:     User clicks cell → enterEditMode()                             │
│  Time N+1:   setEditingCell({ rowId, columnKey }) → state change            │
│  Time N+2:   Component re-renders → cell shows input                        │
│  Time N+3:   User changes value → setLocalCellValue(newValue)               │
│  Time N+4:   Component re-renders → input shows new value                   │
│                                                                              │
│  PHASE 5: OPTIMISTIC UPDATE (Save)                                          │
│  ──────────────────────────────                                              │
│  Time N+5:   User clicks save → handleCellSave()                            │
│  Time N+6:   onMutate(): Update TanStack cache + Dexie                      │
│  Time N+7:   Component re-renders → shows new value (INSTANT)               │
│  Time N+8:   API PATCH in background                                        │
│  Time N+200: API responds → onSettled()                                     │
│  Time N+201: (Optional) invalidateQueries → background refetch              │
│                                                                              │
│  PHASE 6: WEBSOCKET INVALIDATION (External Change)                          │
│  ──────────────────────────────────────────────                              │
│  Time M:     User B updates same project on different browser               │
│  Time M+60s: LogWatcher detects change                                       │
│  Time M+61s: PubSub broadcasts INVALIDATE                                   │
│  Time M+62s: wsManager.handleInvalidate() → invalidateQueries()             │
│  Time M+63s: TanStack Query marks query stale                               │
│  Time M+64s: Auto-refetch → API call                                        │
│  Time M+200: Fresh data arrives → cache updates → re-render                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 17. Error Handling & Rollback

### 17.1 Error Boundaries

```typescript
// Three levels of error handling:

// 1. Query-level errors (handled by TanStack Query)
const { isError, error } = useEntityInstanceData('project', params);
if (isError) {
  return <ErrorMessage error={error} />;
}

// 2. Mutation-level errors (handled by useOptimisticMutation)
const { updateEntity, error: mutationError } = useOptimisticMutation('project', {
  onError: (error) => {
    toast.error(`Failed to save: ${error.message}`);
    // Rollback already happened in onError callback
  },
});

// 3. Component-level errors (React Error Boundary)
<ErrorBoundary fallback={<ErrorFallback />}>
  <EntityListOfInstancesPage />
</ErrorBoundary>
```

### 17.2 Offline-Safe Rollback

```typescript
// Rollback works WITHOUT network (uses captured previous state)

onError: (error, { entityId }, context) => {
  // context.allPreviousListData was captured in onMutate
  // We can restore it directly without any API call

  if (context?.allPreviousListData) {
    // Direct restore to TanStack Query cache
    for (const [queryKeyString, previousData] of context.allPreviousListData) {
      const queryKey = JSON.parse(queryKeyString);
      queryClient.setQueryData(queryKey, previousData);
    }
  }

  // Clear Dexie to ensure consistency
  // (Will repopulate from TanStack Query or next API call)
  clearEntityInstanceData(entityCode);
}
```

---

## 18. Performance Optimizations

### 18.1 Virtualization

```typescript
// EntityListOfInstancesTable uses @tanstack/react-virtual
import { useVirtualizer } from '@tanstack/react-virtual';

const rowVirtualizer = useVirtualizer({
  count: sortedData.length,
  getScrollElement: () => tableContainerRef.current,
  estimateSize: () => 48,  // Estimated row height
  overscan: 5,  // Render 5 extra rows above/below viewport
});

// Only render visible rows
{rowVirtualizer.getVirtualItems().map((virtualRow) => {
  const row = sortedData[virtualRow.index];
  return <tr key={virtualRow.key} style={{ height: virtualRow.size }} />;
})}
```

### 18.2 Memoization Strategy

```typescript
// 1. Column generation (expensive, based on metadata)
const columns = useMemo(() => {
  return generateColumnsFromMetadata(viewType, editType);
}, [viewType, editType]);  // Only re-compute when metadata changes

// 2. Data formatting (expensive, based on data + cache)
const formattedData = useMemo(() => {
  return formatDataset(rawData, metadata);
}, [rawData, metadata, datalabelCacheTimestamp]);  // Re-compute when any changes

// 3. Sorted/filtered data (expensive, based on formatted data)
const sortedData = useMemo(() => {
  let result = [...formattedData];
  if (sortField) {
    result.sort((a, b) => compare(a.raw[sortField], b.raw[sortField], sortDirection));
  }
  return result;
}, [formattedData, sortField, sortDirection]);

// 4. Stable empty arrays (prevents reference changes)
const EMPTY_ARRAY = Object.freeze([]);
return { data: result?.data ?? EMPTY_ARRAY };  // Same reference every time
```

### 18.3 Query Deduplication

```typescript
// TanStack Query automatically deduplicates concurrent requests

// Component A and B both call:
useEntityInstanceData('project', { limit: 20000 });

// Result: Only ONE API call is made (same query key)
// Both components receive the same cached result

// Query key structure enables this:
queryKey: ['entityInstanceData', 'project', { limit: 20000 }]
```

### 18.4 Stale-While-Revalidate

```typescript
// TanStack Query's default behavior

// Time 0: User navigates to /project
// Time 1: Cache hit → Show cached data IMMEDIATELY (stale but usable)
// Time 2: Background refetch starts
// Time 200: Fresh data arrives → Update UI (if different)

// User sees data instantly, gets fresh data automatically
// No loading spinner for subsequent visits
```

---

## Summary

This design pattern document captures the complete frontend architecture of the PMO platform:

1. **Two-Query Pattern**: Metadata and data fetched separately for perceived performance
2. **Format-at-Read**: Cache stores raw data; formatting happens reactively via useMemo
3. **Metadata-Driven Rendering**: Backend is single source of truth for field types
4. **Optimistic Updates**: Instant UI feedback with offline-safe rollback
5. **Inline Add Row**: Cache is single source of truth; temp rows added directly to cache
6. **Draft Persistence**: Dexie IndexedDB survives browser restart
7. **Reactive Re-rendering**: useSyncExternalStore for cache subscriptions
8. **Sync/Async Cache Access**: Hooks for components, sync functions for formatters
9. **WebSocket Invalidation**: Real-time cache updates across tabs/users
10. **Performance**: Virtualization, memoization, query deduplication

This architecture enables a highly responsive, offline-capable, real-time collaborative entity management system.
