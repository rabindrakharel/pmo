# State Management Architecture

**Version:** 14.2.0 | **Updated:** 2025-12-11 | **Status:** Production

---

## Overview

The PMO frontend uses **TanStack Query + Dexie + Hydration Gate** for state management. TanStack Query manages server state, Dexie provides offline-first persistent storage, and the **Hydration Gate Pattern (v13.0.0)** guarantees all session metadata is loaded before rendering.

### v13.0.0: Hydration Gate Pattern

**CRITICAL CHANGE**: All protected routes are now wrapped in `<MetadataGate>` which blocks rendering until `isMetadataLoaded === true`. This **GUARANTEES** that sync accessors (`getDatalabelSync`, `getEntityInstanceNameSync`, etc.) will always return data (never null) for session-level stores.

```
+-------------------------------------------------------------------------+
|               STATE MANAGEMENT (v13.0.0 - Hydration Gate)                |
+-------------------------------------------------------------------------+
|                                                                          |
|   HYDRATION GATE (v13.0.0 - NEW)                                        |
|   ------------------------------                                        |
|   - Blocks rendering until ALL session metadata loaded                  |
|   - getDatalabelSync() GUARANTEED to return data (not null)            |
|   - getEntityInstanceNameSync() GUARANTEED for prefetched entities     |
|   - Eliminates race conditions with unformatted data                   |
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
|   |  useInlineAddRow()   |         |                        |          |
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

## Hydration Gate Integration

### What is the Hydration Gate?

The Hydration Gate is a pattern that **blocks rendering of protected routes** until all session-level metadata is loaded. This eliminates the race condition where components render before cache is populated.

```
+-----------------------------------------------------------------------------+
|                    BEFORE v13.0.0 (RACE CONDITION)                           |
+-----------------------------------------------------------------------------+
|                                                                              |
|  1. User logs in -> AuthContext starts prefetch                             |
|  2. App renders routes IMMEDIATELY                                          |
|  3. formatBadge() -> getDatalabelSync() -> NULL (cache empty!)              |
|  4. Badge renders gray (BROKEN UI)                                          |
|  5. Prefetch completes (TOO LATE)                                           |
|                                                                              |
+-----------------------------------------------------------------------------+

+-----------------------------------------------------------------------------+
|                    AFTER v13.0.0 (HYDRATION GATE)                            |
+-----------------------------------------------------------------------------+
|                                                                              |
|  1. User logs in                                                            |
|  2. AuthContext: setMetadataLoaded(false) <- GATE CLOSED                   |
|  3. AuthContext: prefetch ALL metadata                                      |
|  4. AuthContext: setMetadataLoaded(true) <- GATE OPENS                     |
|  5. MetadataGate: NOW render children                                       |
|  6. formatBadge() -> getDatalabelSync() -> DATA (guaranteed!)              |
|                                                                              |
+-----------------------------------------------------------------------------+
```

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `MetadataGate` | `components/shared/gates/MetadataGate.tsx` | Blocks rendering until `isMetadataLoaded` |
| `CacheProvider` | `db/Provider.tsx` | Manages `isMetadataLoaded` state |
| `AuthContext` | `contexts/AuthContext.tsx` | Calls `setMetadataLoaded(true)` after prefetch |
| `ProtectedRoute` | `App.tsx` | Wraps children in `<MetadataGate>` |

### Guarantees After Gate Opens

| Accessor | Returns | Guarantee |
|----------|---------|-----------|
| `getDatalabelSync(key)` | `DatalabelOption[]` | **ALWAYS returns data** (not null) |
| `getEntityCodesSync()` | `EntityCode[]` | **ALWAYS returns data** (not null) |
| `getEntityInstanceNameSync(code, uuid)` | `string` | Returns name for prefetched entities |
| `getGlobalSettingsSync()` | `GlobalSettings` | **ALWAYS returns data** (not null) |

---

## Data Storage Summary

| Data Type | Storage | staleTime | gcTime | Dexie TTL | v14.0.0 Guarantee |
|-----------|---------|-----------|--------|-----------|-------------------|
| **Datalabels** | TanStack + Dexie | 10 min | **Infinity** | 24 hours | **Guaranteed non-null** |
| **Entity codes** | TanStack + Dexie | 30 min | **Infinity** | 24 hours | **Guaranteed non-null** |
| **Entity instance names** | TanStack + Dexie | 10 min | 1 hour | 24 hours | For prefetched entities |
| **Global settings** | TanStack + Dexie | 10 min | 1 hour | 24 hours | **Guaranteed non-null** |
| **Entity instances** | TanStack + Dexie | 1 min | 30 min | 30 min | On-demand |
| **Entity lists** | TanStack + Dexie | 1 min | 30 min | 30 min | On-demand |
| **Drafts** | Dexie only | N/A | N/A | Until saved | N/A |

**v14.0.0 Key Change:** Datalabels and entity codes now have `gcTime: Infinity` to prevent mid-session garbage collection. See [Cache Disappearance RCA](../caching-frontend/frontend_cache_design_pattern.md#13-cache-disappearance-rca--industry-best-practices-v1400).

---

## Hooks

### Session-Level Hooks (Prefetched at Login)

```typescript
import {
  useDatalabel,        // Dropdown options
  useEntityCodes,      // Entity type definitions
  useGlobalSettings,   // App settings
  useEntityInstanceNames, // Name resolution
} from '@/db/tanstack-index';
```

### On-Demand Hooks

```typescript
import {
  useEntity,           // Single entity with auto-refetch
  useEntityList,       // Paginated list
  useEntityMutation,   // Create/Update/Delete
  useOfflineEntity,    // Dexie-only (no network)
} from '@/db/tanstack-index';
```

### Sync Accessors (v13.0.0 - Guaranteed Non-Null)

```typescript
import {
  getDatalabelSync,           // GUARANTEED after MetadataGate
  getEntityCodesSync,         // GUARANTEED after MetadataGate
  getEntityInstanceNameSync,  // For prefetched entities
  getGlobalSettingsSync,      // GUARANTEED after MetadataGate
} from '@/db/tanstack-index';

// v13.0.0: These are SAFE to call without null checks
// (only after MetadataGate has passed)
const options = getDatalabelSync('project_stage');  // Never null
const codes = getEntityCodesSync();                 // Never null
```

### Draft Persistence Hook

```typescript
import { useDraft } from '@/db/tanstack-index';

const {
  currentData,   // Current edited values
  originalData,  // Original values
  hasChanges,    // currentData !== originalData
  updateField,   // (field, value) => void
  undo,          // Revert last change
  redo,          // Restore undone change
  save,          // Persist to server
  discard,       // Reset to original
} = useDraft('project', projectId);
```

### Inline Add Row Hook (v11.3.1)

```typescript
import {
  useInlineAddRow,
  createTempRow,
  shouldBlockNavigation,
} from '@/db/cache/hooks';

const {
  editingRow,
  editedData,
  isAddingRow,
  handleAddRow,
  handleSave,
  handleCancel,
} = useInlineAddRow({
  entityCode: 'project',
  createEntity,
  updateEntity,
});
```

---

## Data Flow Patterns

### Pattern 1: Login with Hydration Gate (v13.0.0)

```
User logs in
    |
    v
AuthContext.login()
    |
    +-- setMetadataLoaded(false)     <- GATE CLOSED
    +-- API: POST /api/v1/auth/login
    +-- setState({ isAuthenticated: true })
    |
    v
loadAllMetadata()
    |
    +-- prefetchAllDatalabels()       <- 58 datalabel sets
    +-- prefetchEntityCodes()         <- 23 entity types
    +-- prefetchGlobalSettings()      <- App config
    +-- prefetchRefDataEntityInstances() <- 300+ entity names
    |
    v
setMetadataLoaded(true)              <- GATE OPENS
    |
    v
ProtectedRoute renders children
    |
    +-- MetadataGate: isMetadataLoaded = true
    +-- Render page components
    |
    v
formatBadge() -> getDatalabelSync() -> DATA (guaranteed!)
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
1. UPDATE app.project SET ...
2. DB trigger -> INSERT app.system_logging
3. pg_notify('entity_changes', payload)
    |
    v
PubSub LogWatcher polls app.system_logging
    |
    +-- Push INVALIDATE via WebSocket to User A
    |
    v
User A's WebSocketManager receives INVALIDATE
    |
    +-- queryClient.invalidateQueries(['entityInstanceData', 'project'])
    +-- TanStack Query auto-refetches
    +-- Update Dexie with fresh data
    |
    v
Component auto-updates (TanStack Query reactivity)
```

---

## Unified Cache Architecture (v13.0.0)

```
+-----------------------------------------------------------------------------+
|                        v13.0.0 UNIFIED CACHE ARCHITECTURE                    |
+-----------------------------------------------------------------------------+
|                                                                              |
|  +------------------------------------------------------------------------+ |
|  |                         CacheProvider                                   | |
|  |  - Wraps QueryClientProvider (single source of truth)                  | |
|  |  - Hydrates from IndexedDB on mount                                    | |
|  |  - Manages WebSocket connection                                        | |
|  |  - Exposes setMetadataLoaded() for AuthContext                        | |
|  |  - Context: { isMetadataLoaded, syncStatus, connect, disconnect, ... } | |
|  +------------------------------------------------------------------------+ |
|                                    |                                        |
|           +------------------------+------------------------+               |
|           v                        v                        v               |
|  +-----------------+     +-----------------+     +-----------------+        |
|  |  TanStack Query |     |   Dexie v5      |     |   WebSocket     |        |
|  |  (In-Memory)    |<--->|  (IndexedDB)    |     |  (Real-time)    |        |
|  +-----------------+     +-----------------+     +-----------------+        |
|         |                        |                        |                 |
|         | queryClient            | Persistence            | Invalidation    |
|         | .getQueryData()        | Tables                 | wsManager       |
|         v                        v                        v                 |
|  +-------------------------------------------------------------------+     |
|  |                     UNIFIED QUERY KEYS                             |     |
|  +-------------------------------------------------------------------+     |
|  |  ['globalSettings']                    -> GlobalSettings            |     |
|  |  ['datalabel', key]                    -> DatalabelOption[]         |     |
|  |  ['entityCodes']                       -> EntityCode[]              |     |
|  |  ['entityInstanceNames', entityCode]   -> { uuid: name }            |     |
|  |  ['entityInstanceData', code, params]  -> EntityList                |     |
|  |  ['entityInstance', code, id]          -> EntityInstance            |     |
|  |  ['draft', entityCode, entityId]       -> Draft                     |     |
|  +-------------------------------------------------------------------+     |
|                                                                              |
+-----------------------------------------------------------------------------+
```

---

## Sync Accessors (v13.0.0)

### How They Work

```typescript
// db/cache/stores.ts
export function getDatalabelSync(key: string): DatalabelOption[] | null {
  const normalizedKey = key.startsWith('dl__') ? key.slice(4) : key;
  return queryClient.getQueryData<DatalabelOption[]>(
    QUERY_KEYS.datalabel(normalizedKey)
  ) ?? null;
}
```

**Key insight:** `queryClient.getQueryData()` is **synchronous** - it reads directly from TanStack Query's in-memory cache.

### v13.0.0 Guarantee

After `MetadataGate` passes, sync accessors for session-level data are **guaranteed to return data**:

```
+------------------------------------------------------------+
|           TanStack Query Cache                              |
|  queryClient.getQueryData(['datalabel', 'project_stage'])   |
|                      |                                      |
|         +------------+------------+                         |
|         v                         v                         |
|  useDatalabel()        getDatalabelSync()                   |
|  (React hook)          (sync accessor)                      |
|                                                             |
|  v13.0.0: Both GUARANTEED to return data after gate opens  |
+------------------------------------------------------------+
```

---

## File Structure

```
apps/web/src/db/
+-- Provider.tsx              # CacheProvider with setMetadataLoaded
+-- index.ts                  # Public API exports
+-- tanstack-index.ts         # Additional exports
+-- cache/
|   +-- client.ts             # TanStack Query config
|   +-- stores.ts             # Sync accessors
|   +-- keys.ts               # Query key factories
|   +-- hooks/                # All data hooks
+-- persistence/
|   +-- schema.ts             # Dexie schema
|   +-- hydrate.ts            # IndexedDB hydration
+-- realtime/
    +-- manager.ts            # WebSocket + cache invalidation

apps/web/src/components/shared/gates/
+-- MetadataGate.tsx          # v13.0.0 - Hydration gate component
+-- index.ts                  # Gate exports
```

---

## App Integration

```tsx
// App.tsx
import { CacheProvider } from '@/db';
import { MetadataGate } from '@/components/shared';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" />;

  // v13.0.0: MetadataGate ensures all session metadata is loaded
  return (
    <MetadataGate loadingMessage="Loading application data">
      {children}
    </MetadataGate>
  );
}

function App() {
  return (
    <CacheProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute><Outlet /></ProtectedRoute>}>
              <Route path="/project" element={<ProjectListPage />} />
              {/* ... */}
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </CacheProvider>
  );
}
```

---

## Cache Invalidation Strategies

| Trigger | Action | Result |
|---------|--------|--------|
| WebSocket INVALIDATE | `invalidateEntityQueries()` | Auto-refetch if observers mounted |
| Manual refetch | `refetch()` from hook | Immediate fetch + cache update |
| Mutation success | `invalidateQueries()` in onSuccess | Related queries refetched |
| Logout | `clearCache()` + `setMetadataLoaded(false)` | Gate closes, all caches cleared |
| Stale timeout | Automatic | Background refetch on next access |

---

## Key Design Principles

### 1. Hydration Gate First (v13.0.0)

```
- Block rendering until isMetadataLoaded = true
- Formatters NEVER see null from sync accessors
- No defensive fallbacks needed
- Clean, simple formatter code
```

### 2. Single QueryClient

```
- ONE QueryClient from db/cache/client.ts
- CacheProvider wraps with QueryClientProvider
- All hooks read/write to SAME cache
```

### 3. Prefetch is Awaited

```typescript
// AuthContext.tsx
await loadAllMetadata();  // Includes all prefetch operations
setMetadataLoaded(true);  // THEN open the gate
// Page renders AFTER cache is populated
```

### 4. Format-at-Read, Not Format-at-Fetch

```
- Cache stores RAW data (small, canonical)
- Formatting happens via TanStack Query's select option
- Memoized by React Query
```

### 5. Cache-First, Network-Second

```
1. Check TanStack Query memory cache
2. Check Dexie IndexedDB (if hydrated)
3. Fetch from API (last resort)
4. Store in both caches
```

### 6. TTL Alignment (v14.0.0)

```
CRITICAL: gcTime >= hydration maxAge (TanStack Query best practice)

For Session-Level Stores:
  HYDRATION_CONFIG.maxAge ≤ SESSION_STORE_CONFIG.persistMaxAge
  (24 hours)               (24 hours)

  STORE_GC_TIMES.datalabel = Infinity   (NEVER garbage collect)
  STORE_GC_TIMES.entityCodes = Infinity (NEVER garbage collect)

For On-Demand Stores:
  gcTime (30 min) ≥ persistMaxAge (30 min)  ✓
```

### 7. Stale-While-Revalidate from Dexie (v14.0.0)

```typescript
// useDatalabel queryFn pattern
queryFn: async () => {
  // 1. Check Dexie first
  const cached = await getDatalabel(key);

  // 2. If Dexie has data, return immediately + background refresh
  if (cached && cached.length > 0) {
    apiClient.get(...).then(...);  // Non-blocking
    return cached;  // Instant UI from IndexedDB
  }

  // 3. No cache - fetch from API
  return await apiClient.get(...);
}
```

---

## Related Documents

| Document | Purpose |
|----------|---------|
| `docs/caching-frontend/frontend_cache_design_pattern.md` | Comprehensive cache architecture (merged) |
| `docs/design_pattern/FRONTEND_DESIGN_PATTERN.md` | Frontend patterns including Hydration Gate |
| `docs/caching/TANSTACK_DEXIE_SYNC_ARCHITECTURE.md` | WebSocket sync |
| `docs/services/entity-infrastructure.service.md` | Entity CRUD patterns |
| `CLAUDE.md` | Main codebase reference |

---

## Component State Management Patterns (v14.1.0)

This section documents the **two types of state** in PMO components and when to use each.

### State Type Classification

```
+-----------------------------------------------------------------------------+
|                    STATE TYPE CLASSIFICATION                                  |
+-----------------------------------------------------------------------------+
|                                                                               |
|  CACHE STATE (Server Data)              LOCAL UI STATE (Component Data)       |
|  ─────────────────────────              ───────────────────────────────       |
|  Managed by: TanStack Query + Dexie     Managed by: useState / useReducer     |
|  Persisted: Yes (IndexedDB)             Persisted: No (in-memory only)        |
|  Shared: Yes (across components)        Shared: No (component-scoped)         |
|  Source: API / Backend                  Source: User interaction              |
|                                                                               |
|  Examples:                              Examples:                             |
|  • Entity data (projects, tasks)        • Sort field/direction                |
|  • Datalabel options                    • Visible columns                     |
|  • Entity codes                         • Dropdown open/closed                |
|  • Entity instance names                • Editing cell (rowId, columnKey)     |
|  • Drafts                               • Undo stack                          |
|                                         • Selection state (multi-select)      |
|                                         • Focused row index                   |
|                                         • Modal open/closed                   |
|                                         • Search/filter terms                 |
|                                                                               |
+-----------------------------------------------------------------------------+
```

### Decision Tree: Which State Type?

```
Is this data from the server (API)?
    │
    ├── YES → Use CACHE STATE (TanStack Query hooks)
    │         • useEntityInstanceData()
    │         • useDatalabel()
    │         • useEntityCodes()
    │         • getDatalabelSync() (after Hydration Gate)
    │
    └── NO → Is it user interaction state?
              │
              ├── YES → Use LOCAL UI STATE (useState/useReducer)
              │         • Sorting, filtering, pagination
              │         • Modal/dropdown visibility
              │         • Editing state (which cell, undo stack)
              │         • Selection state
              │
              └── NO → Is it derived from props/data?
                        │
                        └── YES → Use useMemo() (computed value)
```

---

### Component State Analysis

#### 1. EntityListOfInstancesTable (2,442 lines)

**Purpose:** Universal data table for all entity types with inline editing, filtering, sorting.

| State Category | Variables | Hook | Optimization Target |
|----------------|-----------|------|---------------------|
| **Cache State** | datalabel options | `getDatalabelSync()` | ✓ Correct |
| **Cache State** | entity codes | `useEntityCodes()` | ✓ Correct |
| **Local UI - Sorting** | `sortField`, `sortDirection` | `useState` | → `useReducer` |
| **Local UI - Filtering** | `dropdownFilters`, `filterSearchTerm`, `selectedFilterColumn` | `useState` | → `useReducer` |
| **Local UI - Columns** | `visibleColumns`, `showColumnSelector` | `useState` | → `useReducer` |
| **Local UI - Cell Editing** | `localEditingCell`, `undoStack` | `useState` | → `useCellEditing` hook (v13.0.0: `localCellValue` removed - DebouncedInput manages own state) |
| **Local UI - Selection** | `focusedRowIndex`, `selectionAnchorIndex`, `internalSelectedRows` | `useState` | → `useTableSelection` hook |
| **Local UI - Drag/Drop** | `draggedIndex`, `dragOverIndex` | `useState` | Keep as-is |
| **Local UI - Add Row** | (removed v13.0.0) | - | Parent manages add row state via `onAddRow` callback |
| **Rendering** | `labelsMetadata`, `badgeDropdownOptionsMap`, `columnStylesMap` | `useMemo` | ✓ Correct |
| **Rendering** | `filteredAndSortedData`, `paginatedData`, `processedColumns` | `useMemo` | ✓ Correct |

**State Flow:**
```
Props (data, metadata)
    │
    ├─→ useMemo: columns (from metadata)
    ├─→ useMemo: labelsMetadata (from getDatalabelSync)
    ├─→ useMemo: filteredAndSortedData (from data + filters + sort)
    ├─→ useMemo: paginatedData (from filteredAndSortedData + pagination)
    │
    └─→ useVirtualizer: rowVirtualizer (from paginatedData)
            │
            └─→ Render: VirtualizedRows
```

**Recommended Extractions:**
```typescript
// Extract to: hooks/useCellEditing.ts
const cellEditing = useCellEditing({
  onCellSave,
  onInlineEdit,
  onCancelInlineEdit,
});
// Returns: { activeCell, enterEdit, saveCell, cancelEdit, undo, undoStack }

// Extract to: hooks/useTableSelection.ts
const selection = useTableSelection(paginatedData, getRowKey);
// Returns: { selectedRows, focusedIndex, toggleSelection, selectRange, isSelected }

// Consolidate with useReducer
const [tableState, dispatch] = useReducer(tableReducer, {
  sort: { field: '', direction: 'asc' },
  filters: { dropdown: {}, column: '', search: '' },
  ui: { showColumnSelector: false, showFilterDropdown: false },
  visibleColumns: new Set(initialVisibleColumns),
});
```

---

#### 2. CalendarView (1,058 lines)

**Purpose:** Weekly calendar with drag-drop scheduling, multi-person filtering.

| State Category | Variables | Hook | Notes |
|----------------|-----------|------|-------|
| **Cache State** | People data | `useEffect` + fetch | Could use `useEntityInstanceData` |
| **Local UI - Navigation** | `currentWeekStart` | `useState` | Keep as-is |
| **Local UI - Selection** | `selectedPersonIds` | `useState` | Keep as-is |
| **Local UI - Sidebar** | `sidebarCollapsed`, `expandedSections` | `useState` | → `useReducer` |
| **Local UI - Search** | `employeeSearchTerm`, `customerSearchTerm` | `useState` | → `useReducer` |
| **Local UI - Modal** | `modalOpen`, `modalMode`, `modalData` | `useState` | → `useCalendarModal` hook |
| **Local UI - Popover** | `popoverOpen`, `popoverEvent`, `popoverPosition` | `useState` | → `useCalendarPopover` hook |
| **Local UI - Drag** | `dragState`, `dragOverSlot` | `useState` | → `useCalendarDrag` hook |
| **Rendering** | `filteredData`, `peopleByType`, `weekDays`, `timeSlots`, `slotsByDateTime` | `useMemo` | ✓ Correct |

**State Flow:**
```
Props (data)
    │
    ├─→ useEffect: fetch people (API)
    ├─→ useMemo: filteredData (from data + selectedPersonIds)
    ├─→ useMemo: weekDays (from currentWeekStart)
    ├─→ useMemo: slotsByDateTime (from filteredData + weekDays)
    │
    └─→ Render: CalendarGrid + Sidebar
```

---

#### 3. EntityInstanceFormContainer (609 lines)

**Purpose:** Auto-generated form for entity create/edit with inline editing.

| State Category | Variables | Hook | Notes |
|----------------|-----------|------|-------|
| **Cache State** | Datalabel options | `getDatalabelSync()` | ✓ Correct |
| **Local UI - Data** | `localData` | `useState` | Mirrors props, syncs on change |
| **Local UI - Inline Edit** | `inlineEditingField`, `inlineEditValue` | `useState` | → `useInlineFieldEdit` hook |
| **Local UI - Long Press** | `longPressTimerRef`, `longPressTriggeredRef` | `useRef` | Part of inline edit |
| **Rendering** | `fields`, `labelsMetadata` | `useMemo` | ✓ Correct |

**State Flow:**
```
Props (data, metadata, onChange)
    │
    ├─→ useState: localData (copy of data)
    ├─→ useMemo: fields (from metadata.viewType)
    ├─→ useMemo: labelsMetadata (from getDatalabelSync)
    │
    └─→ Render: Form fields
            │
            └─→ onChange → handleFieldChange → onChange(localData)
```

---

#### 4. KanbanBoard (416 lines)

**Purpose:** Kanban view for entities with drag-drop between columns.

| State Category | Variables | Hook | Notes |
|----------------|-----------|------|-------|
| **Local UI - Columns** | `columns` | `useState` | Mirrors props or auto-generated |
| **Local UI - Generation** | `isGenerating` | `useState` | Loading state for auto-gen |
| **Local UI - Card Menu** | `showMenu` (in KanbanCard) | `useState` | Keep as-is |
| **Local UI - Drag Over** | `isDragOver` (in KanbanColumn) | `useState` | Keep as-is |

**State Flow:**
```
Props (data, columns, statusField)
    │
    ├─→ useState: columns (from props or auto-generated)
    │
    └─→ Render: KanbanColumn[] → KanbanCard[]
            │
            └─→ onDrop → onCardMove(cardId, newStatus)
```

---

#### 5. DeleteOrUnlinkModal (559 lines)

**Purpose:** Confirmation modal for delete vs unlink operations on child entities.

| State Category | Variables | Hook | Notes |
|----------------|-----------|------|-------|
| **Local UI - Selection** | `selectedAction` | `useState` | 'unlink' or 'delete' |
| **Local UI - Processing** | `isProcessing`, `steps`, `error` | `useState` | → `useProcessingSteps` hook |

**State Flow:**
```
Props (isOpen, parentEntity, childEntity, onConfirm)
    │
    ├─→ useState: selectedAction (default based on context)
    ├─→ useState: steps (progress stepper)
    │
    └─→ Render: Action selection → Stepper → Confirm
            │
            └─→ onConfirm → processWithSteps → onSuccess/onError
```

---

#### 6. BadgeDropdownSelect (267 lines)

**Purpose:** Colored badge dropdown for datalabel fields.

| State Category | Variables | Hook | Notes |
|----------------|-----------|------|-------|
| **Local UI - Dropdown** | `dropdownOpen`, `dropdownPosition` | `useState` | Keep as-is |

**State Flow:**
```
Props (value, options, onChange)
    │
    ├─→ useState: dropdownOpen
    ├─→ useEffect: calculate dropdownPosition
    │
    └─→ Render: Badge button → Portal dropdown
            │
            └─→ onClick → onChange(newValue) → dropdownOpen = false
```

---

#### 7. EntityInstanceNameSelect (381 lines)

**Purpose:** Searchable dropdown for selecting entity instances.

| State Category | Variables | Hook | Notes |
|----------------|-----------|------|-------|
| **Local UI - Dropdown** | `isOpen`, `searchTerm`, `highlightedIndex` | `useState` | Keep as-is |
| **Local UI - Position** | `dropdownPosition` | `useState` | Calculated on open |
| **Local UI - Value** | `localValue`, `localLabel` | `useState` | Controlled/uncontrolled hybrid |

**State Flow:**
```
Props (value, options, onChange)
    │
    ├─→ useState: localValue (mirrors value prop)
    ├─→ useState: searchTerm (filter options)
    ├─→ filtered options = options.filter(searchTerm)
    │
    └─→ Render: Input → Portal dropdown
            │
            └─→ selectOption → onChange(value) → isOpen = false
```

---

#### 8. DynamicChildEntityTabs (233 lines)

**Purpose:** Renders child entity tabs based on parent entity's `child_entity_codes`.

| State Category | Variables | Hook | Notes |
|----------------|-----------|------|-------|
| **Cache State** | Entity codes | `useEntityCodes()` | ✓ Correct |
| **Local UI - Tabs** | `tabs`, `loading` | `useState` | Derived from entity codes |

**State Flow:**
```
Props (entityCode, childEntityCodes)
    │
    ├─→ useEntityCodes: getEntityByCode
    ├─→ useEffect: build tabs from childEntityCodes + entity metadata
    │
    └─→ Render: Tab headers + Tab content (EntityListOfInstancesTable)
```

---

### Optimization Opportunities Summary

| Component | Current State Count | After Optimization | Extraction Target |
|-----------|--------------------|--------------------|-------------------|
| **EntityListOfInstancesTable** | ~25 useState | ~10 useState + 2 hooks + 1 reducer | `useCellEditing`, `useTableSelection`, `useReducer` |
| **CalendarView** | ~15 useState | ~8 useState + 3 hooks | `useCalendarModal`, `useCalendarPopover`, `useCalendarDrag` |
| **EntityInstanceFormContainer** | ~4 useState | ~2 useState + 1 hook | `useInlineFieldEdit` |
| **KanbanBoard** | ~5 useState | Keep as-is | None needed |
| **DeleteOrUnlinkModal** | ~4 useState | ~2 useState + 1 hook | `useProcessingSteps` |
| **BadgeDropdownSelect** | ~2 useState | Keep as-is | None needed |
| **EntityInstanceNameSelect** | ~6 useState | Keep as-is | None needed |
| **DynamicChildEntityTabs** | ~2 useState | Keep as-is | None needed |

---

### Key Principles

#### 1. Cache State vs Local UI State

```
CACHE STATE: Use TanStack Query / Dexie
─────────────────────────────────────────
• Data from API (entities, datalabels, settings)
• Shared across components
• Persisted to IndexedDB
• Invalidated by WebSocket

LOCAL UI STATE: Use useState / useReducer
─────────────────────────────────────────
• User interaction state (open/closed, selected, editing)
• Component-scoped (not shared)
• Not persisted (resets on unmount)
• Changed by user actions only
```

#### 2. When to Extract to Custom Hook

Extract when:
- **3+ related state variables** that always change together
- **Complex handlers** that operate on the state
- **Reusable pattern** across multiple components
- **Testability** - logic can be unit tested in isolation

Don't extract when:
- Simple open/close toggle
- Single state variable
- Component-specific logic

#### 3. When to Use useReducer

Use `useReducer` when:
- **5+ related state variables** in same logical group
- **Complex state transitions** (e.g., sort + filter + pagination)
- **Actions have names** (e.g., 'SET_SORT', 'TOGGLE_COLUMN', 'CLEAR_FILTERS')

Example:
```typescript
type TableAction =
  | { type: 'SET_SORT'; field: string; direction: 'asc' | 'desc' }
  | { type: 'SET_FILTER'; column: string; values: string[] }
  | { type: 'TOGGLE_COLUMN'; column: string }
  | { type: 'CLEAR_FILTERS' };

function tableReducer(state: TableState, action: TableAction): TableState {
  switch (action.type) {
    case 'SET_SORT':
      return { ...state, sort: { field: action.field, direction: action.direction } };
    // ...
  }
}
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 14.2.0 | 2025-12-11 | **Component State Patterns**: Added comprehensive documentation for Cache State vs Local UI State classification. Documented state analysis for 8 major components (EntityListOfInstancesTable, CalendarView, EntityInstanceFormContainer, KanbanBoard, DeleteOrUnlinkModal, BadgeDropdownSelect, EntityInstanceNameSelect, DynamicChildEntityTabs). Added optimization opportunities and extraction targets. |
| 14.0.0 | 2025-12-09 | **Cache Disappearance Fix**: Aligned hydration maxAge with persistMaxAge (24h). Applied `gcTime: Infinity` to datalabel/entityCodes. Implemented stale-while-revalidate pattern (Dexie-first). |
| 13.0.0 | 2025-12-07 | **Hydration Gate Pattern**: MetadataGate blocks rendering until all session metadata loaded. Sync accessors guaranteed non-null. |
| 11.3.1 | 2025-12-03 | Inline add row pattern with `useInlineAddRow` hook |
| 11.1.0 | 2025-12-02 | Flat metadata format for table and form components |
| 11.0.0 | 2025-12-01 | Removed sync stores - TanStack Query single source of truth |
| 9.1.0 | 2025-11-28 | TanStack Query + Dexie migration (replaced RxDB) |

---

**Version:** 14.2.0 | **Updated:** 2025-12-11 | **Status:** Production
