# EntityListOfInstancesTable Component

**Version:** 16.0.0 | **Location:** `apps/web/src/components/shared/ui/EntityListOfInstancesTable.tsx` | **Updated:** 2025-12-06

---

## Overview

EntityListOfInstancesTable is a universal data table component with **virtualized rendering**, inline editing, sorting, filtering, and pagination. It uses the `{ viewType, editType }` metadata structure from the backend to determine column configuration and rendering.

**Core Principle:** Backend metadata with `{ viewType, editType }` structure controls all columns, rendering, and edit behavior. Frontend is a pure renderer.

**v16.0.0 Key Change:** Table view availability is now **database-driven** via `entity.component_views` JSONB column. The `EntityListOfInstancesTable` view is enabled/disabled per entity through the `/api/v1/entity/codes` endpoint. If `component_views.EntityListOfInstancesTable.enabled = true` (default), the table view is available.

**v12.3.0 Key Change:** All three components (`EntityListOfInstancesTable`, `EntityInstanceFormContainer`, `EntityMetadataField`) now use the same **slow click-and-hold (500ms) inline editing pattern** for consistent UX. Flat metadata format `{ viewType, editType }` used across all components. Entity reference fields resolved via `getEntityInstanceNameSync()` which reads directly from TanStack Query cache.

---

## System Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     ENTITY DATA TABLE ARCHITECTURE (v11.1.0)                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    Data Source (TanStack Query + Dexie)              │    │
│  │                                                                      │    │
│  │  Two-Query Architecture:                                             │    │
│  │  ├── QUERY 1: useEntityInstanceData('project') - data (5-min cache) │    │
│  │  └── QUERY 2: useEntityInstanceMetadata('project') - (30-min cache) │    │
│  │                                                                      │    │
│  │  Returns: { data, refData } + { viewType, editType }                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              │                                              │
│                              v                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    EntityListOfInstancesTable                        │    │
│  │                                                                      │    │
│  │  // v11.1.0: Flat metadata format                                   │    │
│  │  const viewType = metadata?.viewType ?? {};                         │    │
│  │  const editType = metadata?.editType ?? {};                         │    │
│  │                                                                      │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │  Header Row (Sticky)                                         │    │    │
│  │  │  [Column titles from viewType[key].label]                    │    │    │
│  │  │  [Sort indicators, filter icons]                             │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  │                                                                      │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │  Virtualized Rows (@tanstack/react-virtual)                  │    │    │
│  │  │  ─────────────────────────────────────────────────────────   │    │    │
│  │  │  Only visible rows rendered in DOM (3 row overscan)          │    │    │
│  │  │                                                               │    │    │
│  │  │  ┌─────────────────────────────────────────────────────┐    │    │    │
│  │  │  │ VIEW MODE: row.display[key] (pre-formatted)         │    │    │    │
│  │  │  │            row.styles[key] (CSS classes)            │    │    │    │
│  │  │  └─────────────────────────────────────────────────────┘    │    │    │
│  │  │  ┌─────────────────────────────────────────────────────┐    │    │    │
│  │  │  │ EDIT MODE: renderEditModeFromMetadata(              │    │    │    │
│  │  │  │              row.raw[key], editType[key])           │    │    │    │
│  │  │  └─────────────────────────────────────────────────────┘    │    │    │
│  │  │                                                               │    │    │
│  │  │  Threshold: >50 rows → virtualized                           │    │    │
│  │  │             ≤50 rows → regular rendering                     │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  │                                                                      │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │  Pagination (Client-side slicing)                            │    │    │
│  │  │  [Page numbers, page size selector: 100/500/1000/2000]       │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Props Interface (v11.1.0)

```typescript
import type { FormattedRow } from '@/lib/formatters';

export interface EntityListOfInstancesTableProps<T = any> {
  /** Entity records (FormattedRow[] or raw T[]) */
  data: T[];

  /** Backend metadata - FLAT format { viewType, editType } (v11.1.0) */
  metadata?: EntityMetadata | null;

  /** Reference data for entity lookups (from API response) */
  refData?: Record<string, Record<string, string>>;

  /** Loading state */
  loading?: boolean;

  /** Client-side pagination config */
  pagination?: {
    current: number;
    pageSize: number;
    total: number;
    showSizeChanger?: boolean;
    pageSizeOptions?: number[];
    onChange?: (page: number, pageSize: number) => void;
  };

  /** Row key accessor */
  rowKey?: string | ((record: T) => string);

  /** Row click handler */
  onRowClick?: (record: T) => void;

  /** Inline edit handler (cell-level) */
  onInlineEdit?: (recordId: string, fieldKey: string, value: any) => void;

  /** Enable inline editing mode */
  inlineEditable?: boolean;

  /** Allow adding rows via inline form */
  allowAddRow?: boolean;

  /** Row selection */
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
}

// v11.1.0: FLAT Metadata format (same as EntityInstanceFormContainer)
interface EntityMetadata {
  viewType: Record<string, ViewFieldMetadata>;
  editType: Record<string, EditFieldMetadata>;
  fields?: string[];  // Field ordering
}

// Note: Component also supports nested format for backward compatibility:
// { entityListOfInstancesTable: { viewType, editType } }
// But FLAT format is preferred
```

---

## Metadata Types

### ViewFieldMetadata

```typescript
interface ViewFieldMetadata {
  dtype: 'str' | 'float' | 'int' | 'bool' | 'uuid' | 'date' | 'timestamp' | 'jsonb';
  label: string;
  renderType: string;     // 'text', 'currency', 'date', 'badge', 'boolean', 'component', etc.
  component?: string;     // Component name when renderType='component' (e.g., 'DAGVisualizer')
  behavior: {
    visible?: boolean;    // Show in table
    sortable?: boolean;   // Allow sorting
    filterable?: boolean; // Show filter
    searchable?: boolean; // Include in search
  };
  style: {
    width?: string;
    align?: 'left' | 'center' | 'right';
    symbol?: string;      // Currency symbol
    decimals?: number;    // Decimal places
  };
  lookupEntity?: string;  // For entity reference fields
  lookupField?: string;   // v12.0.0: For badge/datalabel fields (renamed from datalabelKey)
}
```

### EditFieldMetadata

```typescript
interface EditFieldMetadata {
  dtype: string;
  label: string;
  inputType: string;      // 'text', 'number', 'date', 'checkbox', 'component', etc.
  component?: string;     // Component name when inputType='component' (e.g., 'DataLabelSelect', 'BadgeDropdownSelect')
  behavior: {
    editable?: boolean;   // Allow editing
  };
  validation: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
  };
  lookupSourceTable?: 'datalabel' | 'entityInstance';  // v12.0.0: renamed from lookupSource
  lookupField?: string;   // v12.0.0: For component fields (renamed from datalabelKey)
  lookupEntity?: string;  // For entity reference fields
}
```

**Rule:** If `component` has a value, `inputType` MUST be `'component'`.

---

## Data Flow (v11.1.0)

### Column Generation

```
Backend Metadata                     v11.1.0 Flat Format         Processed Columns
────────────────                     ───────────────────         ─────────────────

metadata: {                     →    const viewType =       →   columns: [
  viewType: {                        metadata?.viewType ?? {};     {
    budget_amt: {                                                   key: 'budget_amt',
      dtype: 'float',                // FLAT format                 title: 'Budget',
      label: 'Budget',               // Direct access               render: () =>
      renderType: 'currency',                                         row.display[key]
      behavior: { visible: true },                                 }
      style: { align: 'right' }                                   ]
    }
  },
  editType: { ... }
}
```

### Two-Query Architecture (v11.0.0)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  EntityListOfInstancesPage                                                      │
│                                                                                 │
│  QUERY 1: DATA (5-min cache)            QUERY 2: METADATA (30-min cache)       │
│  ──────────────────────────              ───────────────────────────────        │
│  useEntityInstanceData('project')        useEntityInstanceMetadata('project',  │
│  └── Returns: { data, refData }            'entityListOfInstancesTable')       │
│                                          └── Returns: { viewType, editType }   │
│                                                                                 │
│  Page constructs flat metadata:                                                 │
│  ─────────────────────────────                                                  │
│  const metadata = useMemo(() => ({                                              │
│    viewType: metadataResult.viewType,                                           │
│    editType: metadataResult.editType                                            │
│  }), [metadataResult]);                                                         │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Format-at-Read Pattern

```
TanStack Query Cache     formatDataset()              Component Receives
────────────────────     ───────────────              ──────────────────

{ data: [          →     Uses viewType to format  →   FormattedRow[] = [
  { budget_amt:          each field                     {
    50000 }                                              raw: { budget_amt: 50000 },
] }                                                      display: { budget_amt: '$50,000.00' },
                                                         styles: {}
                                                        }
                                                       ]
```

### Entity Reference Resolution (v11.0.0)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  formatDataset() calls formatValue() for each field                            │
│                                                                                 │
│  if (renderType === 'entityInstanceId' || component === 'EntityInstanceName') │
│    └── formatReference(uuid, metadata)                                         │
│          └── entityCode = metadata.lookupEntity                                │
│          └── getEntityInstanceNameSync(entityCode, uuid)                       │
│                └── queryClient.getQueryData(['entityInstanceNames', entityCode])│
│                      └── returns: "James Miller"                               │
│                                                                                 │
│  v11.0.0: No separate sync stores - reads directly from TanStack Query cache   │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Cell Rendering

```
VIEW MODE:                              EDIT MODE:
──────────                              ─────────

const formatted = record as FormattedRow;    const editType = extractEditType(metadata);

// Zero function calls - direct access       // Uses editType for input rendering
<span>{formatted.display[key]}</span>        renderEditModeFromMetadata(
                                               formatted.raw[key],
// For badges, use pre-computed style          editType[key],
if (formatted.styles[key]) {                   onChange
  <span className={formatted.styles[key]}>   )
    {formatted.display[key]}
  </span>
}
```

---

## Inline Editing (Airtable-style v12.3.0)

### Unified Inline Editing Pattern

As of v12.3.0, all three components share the **same slow click-and-hold inline editing pattern**:

| Component | Location | Pattern |
|-----------|----------|---------|
| `EntityListOfInstancesTable` | List/grid views | 500ms long-press on cell |
| `EntityInstanceFormContainer` | Entity detail form | 500ms long-press on field |
| `EntityMetadataField` | Sticky header fields | 500ms long-press on name/code |

### Behavior

| Interaction | Action |
|-------------|--------|
| **Hold mouse 500ms** on editable cell | Enter inline edit mode for THAT cell only |
| Click outside | Auto-save via optimistic update and exit edit mode |
| Enter key | Auto-save via optimistic update and exit edit mode |
| Escape | Cancel without saving |
| Edit icon (✏️) | Fallback - edits entire row (full edit mode) |
| 'E' key when row focused | Enter row edit mode |
| Tab | Navigate to next editable cell |
| Cmd+Z / Ctrl+Z | Undo last change with toast |

### Implementation

```typescript
const LONG_PRESS_DELAY = 500; // Same across all components
const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// Start long-press timer on mouse down
const handleCellMouseDown = useCallback((record, columnKey) => {
  if (!isEditable(columnKey)) return;

  longPressTimerRef.current = setTimeout(() => {
    setEditingCell({ rowId: record.id, columnKey });
    longPressTimerRef.current = null;
  }, LONG_PRESS_DELAY);
}, []);

// Cancel timer on mouse up/leave
const handleCellMouseUp = useCallback(() => {
  if (longPressTimerRef.current) {
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  }
}, []);

// Click outside detection - triggers optimistic save
useEffect(() => {
  if (!editingCell) return;

  const handleClickOutside = (event: MouseEvent) => {
    if (cellRef.current && !cellRef.current.contains(event.target as Node)) {
      handleInlineSave(); // Optimistic update
    }
  };

  // Delay listener attachment to avoid immediate trigger
  const timeoutId = setTimeout(() => {
    document.addEventListener('mousedown', handleClickOutside);
  }, 0);

  return () => {
    clearTimeout(timeoutId);
    document.removeEventListener('mousedown', handleClickOutside);
  };
}, [editingCell, handleInlineSave]);

// Key handling - Enter saves, Escape cancels
const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleInlineSave(); // Optimistic update
  } else if (e.key === 'Escape') {
    e.preventDefault();
    handleInlineCancel();
  }
}, [handleInlineSave, handleInlineCancel]);

// Optimistic update via useOptimisticMutation
const handleInlineSave = useCallback(async () => {
  if (newValue !== originalValue) {
    await optimisticUpdateEntity(recordId, { [columnKey]: newValue });
  }
  setEditingCell(null);
}, [newValue, originalValue, optimisticUpdateEntity, recordId, columnKey]);
```

### Optimistic Update Flow

```
User holds 500ms → Edit mode activated → User modifies value
                                          │
                                          v
                        ┌─────────────────────────────────────┐
                        │ Click outside OR Enter key pressed  │
                        └─────────────────────────────────────┘
                                          │
                                          v
                        ┌─────────────────────────────────────┐
                        │ optimisticUpdateEntity(id, updates) │
                        │ └── Updates TanStack Query cache    │
                        │ └── Updates Dexie (IndexedDB)       │
                        │ └── PATCH /api/v1/{entity}/:id     │
                        └─────────────────────────────────────┘
                                          │
                                          v
                        ┌─────────────────────────────────────┐
                        │ UI updates instantly (optimistic)   │
                        │ Server confirms in background       │
                        └─────────────────────────────────────┘
```

---

## Inline Add Row Pattern (v11.3.1)

### Overview

The inline add row pattern allows users to add new rows directly in the table without navigating to a separate form page. This uses TanStack Query cache as the **single source of truth** - no local state copying.

### Design Pattern: Single Source of Truth

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   INLINE ADD ROW PATTERN (v11.3.1)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  CORE PRINCIPLE: TanStack Query cache is the ONLY data store                │
│  ─────────────────────────────────────────────────────────────              │
│                                                                              │
│  ✅ CORRECT: Add temp row directly to cache → Edit in place → Save          │
│  ❌ WRONG: Copy all data to localData state → Add temp → Sync back          │
│                                                                              │
│  DATA FLOW:                                                                  │
│  ───────────                                                                 │
│  1. User clicks "Add Row" → createTempRow() → handleAddRow()                │
│  2. handleAddRow() → queryClient.setQueryData() → Temp row in cache         │
│  3. Component re-renders → Temp row visible at end of table                 │
│  4. User fills fields → handleFieldChange() → editedData updated            │
│  5. User clicks Save → createEntity(data, { existingTempId })               │
│  6. onMutate: SKIP temp row creation (already exists)                       │
│  7. API POST → Server returns real entity with UUID                         │
│  8. onSuccess: Replace temp row with real data in cache                     │
│                                                                              │
│  ANTI-PATTERN (causes duplicate rows):                                      │
│  ─────────────────────────────────────                                      │
│  handleAddRow → adds temp_123 to localData                                  │
│  handleSave → createEntity()                                                │
│  onMutate → adds ANOTHER temp_456 to cache  ← DUPLICATE!                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Using the useInlineAddRow Hook

The `useInlineAddRow` hook encapsulates the entire pattern for reuse across components.

```typescript
import {
  useInlineAddRow,
  createTempRow,
  shouldBlockNavigation,
} from '@/db/cache/hooks';
import { useOptimisticMutation } from '@/db/tanstack-index';

function ProjectListPage() {
  const { createEntity, updateEntity } = useOptimisticMutation('project');

  const {
    // State
    editingRow,
    editedData,
    isAddingRow,
    isSaving,

    // Actions
    handleAddRow,
    handleEditRow,
    handleFieldChange,
    handleSave,
    handleCancel,
    resetEditState,

    // Utilities
    isRowEditing,
    isTempRow,
    getFieldValue,
  } = useInlineAddRow({
    entityCode: 'project',
    createEntity,
    updateEntity,
    transformForApi: (editedData, originalRecord) => ({
      ...originalRecord,
      ...editedData,
      // Convert display values to API format
    }),
    transformFromApi: (record) => ({
      ...record,
      // Convert API values to display format
    }),
    onSaveSuccess: (data, isNewRow) => {
      toast.success(isNewRow ? 'Created successfully' : 'Updated successfully');
    },
    onSaveError: (error, isNewRow) => {
      toast.error(`Failed to ${isNewRow ? 'create' : 'update'}: ${error.message}`);
    },
    debug: false,
  });

  // Create a new temp row
  const handleStartAddRow = useCallback(() => {
    const newRow = createTempRow({
      defaults: {
        dl__project_stage: 'planning',
        active_flag: true,
      },
      generateName: () => 'New Project',
    });
    handleAddRow(newRow);
  }, [handleAddRow]);

  // Block navigation for temp rows
  const handleRowClick = useCallback((item) => {
    if (shouldBlockNavigation(item.id)) {
      return; // Temp row - don't navigate
    }
    navigate(`/project/${item.id}`);
  }, [navigate]);

  return (
    <EntityListOfInstancesTable
      data={formattedData}
      editingRow={editingRow}
      onAddRow={handleStartAddRow}
      onEditRow={handleEditRow}
      onFieldChange={handleFieldChange}
      onSave={handleSave}
      onCancel={handleCancel}
      onRowClick={handleRowClick}
      isRowEditing={isRowEditing}
    />
  );
}
```

### Hook API Reference

#### UseInlineAddRowOptions

```typescript
interface UseInlineAddRowOptions<T> {
  /** Entity code for cache key lookup */
  entityCode: string;

  /** Create entity function from useOptimisticMutation */
  createEntity: (data: Partial<T>, options?: { existingTempId?: string }) => Promise<T>;

  /** Update entity function from useOptimisticMutation */
  updateEntity: (entityId: string, changes: Partial<T>) => Promise<T>;

  /** Transform data for API (e.g., convert display values to API format) */
  transformForApi?: (editedData: Partial<T>, originalRecord: T) => Partial<T>;

  /** Transform data from API (e.g., convert API format to display values) */
  transformFromApi?: (record: T) => Partial<T>;

  /** Callback when save succeeds */
  onSaveSuccess?: (data: T, isNewRow: boolean) => void;

  /** Callback when save fails */
  onSaveError?: (error: Error, isNewRow: boolean) => void;

  /** Callback when cancel is triggered */
  onCancel?: () => void;

  /** Enable debug logging */
  debug?: boolean;
}
```

#### UseInlineAddRowResult

```typescript
interface UseInlineAddRowResult<T> {
  // State
  editingRow: string | null;     // Currently editing row ID
  editedData: Partial<T>;        // Accumulated field changes
  isAddingRow: boolean;          // Whether adding a new row
  isSaving: boolean;             // Whether save is in progress

  // Actions
  handleAddRow: (newRow: T) => void;                    // Add temp row to cache
  handleEditRow: (record: T | { raw: T }) => void;      // Enter edit mode
  handleFieldChange: (field: string, value: unknown) => void;  // Update field
  handleSave: (record: T | { raw: T }) => Promise<void>; // Save (create or update)
  handleCancel: () => void;                              // Cancel edit
  resetEditState: () => void;                            // Clear all edit state

  // Utilities
  isRowEditing: (rowId: string) => boolean;  // Check if row is being edited
  isTempRow: (rowId: string) => boolean;     // Check if row is temp
  getFieldValue: (field: string, originalValue: unknown) => unknown;
}
```

### Factory Function: createTempRow

```typescript
import { createTempRow } from '@/db/cache/hooks';

// Create a temp row with defaults
const newRow = createTempRow<Project>({
  defaults: {
    dl__project_stage: 'planning',
    active_flag: true,
    budget_allocated_amt: 0,
  },
  generateName: () => `Project ${Date.now()}`,
});

// Result:
// {
//   id: 'temp_1701609600000',
//   name: 'Project 1701609600000',
//   _isNew: true,
//   dl__project_stage: 'planning',
//   active_flag: true,
//   budget_allocated_amt: 0,
// }
```

### Navigation Blocking Utility

```typescript
import { shouldBlockNavigation } from '@/db/cache/hooks';

const handleRowClick = (item) => {
  // Prevent navigation for temp rows (they don't exist on server)
  if (shouldBlockNavigation(item.id)) {
    return;
  }
  navigate(`/project/${item.id}`);
};

// shouldBlockNavigation('temp_123') → true
// shouldBlockNavigation('uuid-here') → false
// shouldBlockNavigation(null) → false
```

### Cache Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    INLINE ADD ROW - CACHE LIFECYCLE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STEP 1: ADD TEMP ROW                                                        │
│  ─────────────────────                                                       │
│  handleAddRow(newRow) →                                                      │
│    queryClient.getQueryCache().findAll({ queryKey: ['entityInstanceData', 'project'] })│
│    for each matchingQuery:                                                   │
│      queryClient.setQueryData(query.queryKey, {                              │
│        ...oldData,                                                           │
│        data: [...oldData.data, { id: 'temp_123', _isNew: true, ... }],      │
│        total: oldData.total + 1                                              │
│      })                                                                      │
│                                                                              │
│  STEP 2: SAVE (CREATE)                                                       │
│  ─────────────────────                                                       │
│  handleSave() → createEntity(data, { existingTempId: 'temp_123' })          │
│    onMutate: SKIP temp row creation (existingTempId provided)               │
│              Capture previous state for rollback                             │
│    API POST: /api/v1/project { name: 'New Project', ... }                   │
│    Response: { id: 'real-uuid', name: 'New Project', ... }                  │
│    onSuccess: Replace temp_123 with real-uuid in cache                      │
│                                                                              │
│  STEP 3: CANCEL                                                              │
│  ─────────────────                                                           │
│  handleCancel() →                                                            │
│    for each matchingQuery:                                                   │
│      queryClient.setQueryData(query.queryKey, {                              │
│        ...oldData,                                                           │
│        data: oldData.data.filter(item => item.id !== 'temp_123'),           │
│        total: oldData.total - 1                                              │
│      })                                                                      │
│                                                                              │
│  STEP 4: ERROR ROLLBACK                                                      │
│  ─────────────────────                                                       │
│  API fails → onError:                                                        │
│    Remove temp row from cache (same as cancel)                              │
│    Restore previous state from context.allPreviousListData                  │
│    toast.error('Failed to create')                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### existingTempId Integration

The `existingTempId` option in `useOptimisticMutation.createEntity()` is critical:

```typescript
// In useOptimisticMutation.ts
const createMutation = useMutation({
  mutationFn: async ({ data, existingTempId }) => {
    return apiClient.post(`/api/v1/${entityCode}`, data);
  },

  onMutate: async ({ data, existingTempId }) => {
    await queryClient.cancelQueries({ queryKey: [...] });

    if (existingTempId) {
      // ROW ALREADY IN CACHE - just capture state for rollback
      // DO NOT create another temp row
      return { entityId: existingTempId, allPreviousListData: capturedState };
    }

    // Original flow: create temp row in cache
    const tempId = `temp_${Date.now()}`;
    addTempRowToCache({ id: tempId, ...data });
    return { entityId: tempId, allPreviousListData: capturedState };
  },

  onSuccess: async (serverData, variables, context) => {
    // Replace temp row (context.entityId) with real server data
    updateAllListCaches(queryClient, entityCode, (listData) =>
      listData.map((item) =>
        item.id === context.entityId ? serverData : item
      )
    );

    // v11.3.1: SKIP refetch for inline add row
    // Data is already correct in cache, no need to refetch
    if (context?.existingTempId) {
      // Skip invalidation - prevents race condition
    } else {
      queryClient.invalidateQueries({ queryKey: [...] });
    }
  },

  onError: (error, variables, context) => {
    if (context?.existingTempId) {
      // Remove temp row that was added by handleAddRow
      removeTempRowFromCache(context.existingTempId);
    } else {
      // Original rollback flow
      rollbackFromCapturedState(context.allPreviousListData);
    }
  },
});
```

### Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|--------------|---------|------------------|
| Copying all data to `localData` state | Dual source of truth, sync issues | Use cache directly |
| Creating temp row in both handleAddRow AND onMutate | Duplicate rows | Pass `existingTempId` to skip onMutate temp creation |
| Refetching immediately after save | Race condition, stale data | Skip refetch when `existingTempId` used |
| Navigating to temp row URL | 404 error, invalid page | Block navigation with `shouldBlockNavigation()` |
| Storing edit state in table component | Component coupling | Use `useInlineAddRow` hook |

---

## Virtualization

### Performance Optimizations

| Optimization | Before | After | Impact |
|--------------|--------|-------|--------|
| **Overscan** | 10 rows | 3 rows | 70% fewer off-screen nodes |
| **Scroll Listeners** | Blocking | Passive | 60fps consistent |
| **Column Styles** | Recreate per render | Pre-computed Map | Zero allocations |
| **Stable Keys** | Array index | getRowKey() | Better reconciliation |
| **DOM Nodes** | 1000×10 = 10,000 | ~20×10 = 200 | 98% reduction |

### Implementation

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

const VIRTUALIZATION_THRESHOLD = 50;
const ESTIMATED_ROW_HEIGHT = 44;
const OVERSCAN = 3;

const shouldVirtualize = paginatedData.length > VIRTUALIZATION_THRESHOLD;

const rowVirtualizer = useVirtualizer({
  count: paginatedData.length,
  getScrollElement: () => tableContainerRef.current,
  estimateSize: useCallback(() => ESTIMATED_ROW_HEIGHT, []),
  overscan: OVERSCAN,
  enabled: shouldVirtualize,
  getItemKey: useCallback((index: number) => {
    const record = paginatedData[index];
    return record ? getRowKey(record, index) : `row-${index}`;
  }, [paginatedData]),
});

// Pre-computed styles (zero allocations during scroll)
const columnStylesMap = useMemo(() => {
  const map = new Map<string, React.CSSProperties>();
  processedColumns.forEach((col) => {
    map.set(col.key, {
      textAlign: (col.align || 'left') as any,
      width: col.width || 'auto',
    });
  });
  return map;
}, [processedColumns]);
```

---

## Usage Example (v11.1.0)

### With Two-Query Architecture

```typescript
import { useEntityInstanceData, useEntityInstanceMetadata } from '@/db/tanstack-index';
import { EntityListOfInstancesTable } from '@/components/shared/ui/EntityListOfInstancesTable';
import { formatDataset } from '@/lib/formatters';

function ProjectListPage() {
  // QUERY 1: Data (5-min cache)
  const {
    data: rawData,
    refData,
    isLoading: dataLoading,
  } = useEntityInstanceData('project', { limit: 1000 });

  // QUERY 2: Metadata (30-min cache)
  const {
    viewType,
    editType,
    isLoading: metadataLoading,
  } = useEntityInstanceMetadata('project', 'entityListOfInstancesTable');

  // v11.1.0: Flat metadata format - same as EntityInstanceFormContainer
  const metadata = useMemo(() => {
    if (!viewType || Object.keys(viewType).length === 0) return null;
    return { viewType, editType };
  }, [viewType, editType]);

  // Format data for display (memoized)
  const formattedData = useMemo(() => {
    if (!rawData?.length || !metadata) return [];
    return formatDataset(rawData, metadata);
  }, [rawData, metadata]);

  return (
    <EntityListOfInstancesTable
      data={formattedData}
      metadata={metadata}  // v11.1.0: Flat format { viewType, editType }
      refData={refData}
      loading={dataLoading || metadataLoading}
      onRowClick={(record) => navigate(`/project/${record.raw.id}`)}
      onInlineEdit={async (id, key, value) => {
        await updateEntity(id, { [key]: value });
      }}
      pagination={{
        current: currentPage,
        pageSize: 1000,
        total: totalRecords,
        pageSizeOptions: [100, 500, 1000, 2000],
        onChange: setCurrentPage,
      }}
    />
  );
}
```

### With useFormattedEntityList Hook

```typescript
import { useFormattedEntityList } from '@/lib/hooks/useEntityFormatters';

function ProjectListPage() {
  // Combines both queries + formatting in single hook
  const {
    data: formattedData,
    metadata,
    isLoading
  } = useFormattedEntityList('project', { limit: 1000 });

  return (
    <EntityListOfInstancesTable
      data={formattedData}
      metadata={metadata}  // Flat format { viewType, editType }
      loading={isLoading}
      // ... other props
    />
  );
}
```

---

## Field Type Mapping

| viewType.renderType | View Display | editType.inputType | Edit Component |
|---------------------|--------------|--------------------| ---------------|
| `currency` | `$50,000.00` (right-aligned) | `currency` | `<input type="number">` |
| `badge` | `<Badge>` with color | `BadgeDropdownSelect` | `<BadgeDropdownSelect>` |
| `date` | `Jan 15, 2025` | `date` | `<input type="date">` |
| `boolean` | Check/X icon | `checkbox` | `<input type="checkbox">` |
| `entityInstanceId` | Entity name (from refData) | `entityInstanceId` | `<EntitySelect>` |
| `text` | Plain text | `text` | `<input type="text">` |
| `component` | Custom component | Varies | `<DAGVisualizer>`, etc. |

---

## User Interaction Flow

```
Table Load Flow (v11.1.0 - Two-Query Architecture)
───────────────────────────────────────────────────

1. Page component mounts
   │
2. useEntityInstanceData('project') + useEntityInstanceMetadata('project')
   │
   ├── [TanStack Query Cache HIT] → Instant return
   │     ├── Data: 5-min staleTime
   │     └── Metadata: 30-min staleTime
   │
   └── [Cache MISS] → API fetches
                      │
                      v
3. DATA API returns { data, ref_data_entityInstance }
   METADATA API returns { viewType, editType }
   │
4. TanStack Query caches both (ref_data_entityInstance populates cache)
   │
5. Page constructs flat metadata: { viewType, editType }
   │
6. formatDataset() transforms to FormattedRow[]
   │     └── Entity references: getEntityInstanceNameSync() reads from TanStack Query
   │
7. EntityListOfInstancesTable receives FormattedRow[] + flat metadata
   │
8. const viewType = metadata?.viewType ?? {};
   const editType = metadata?.editType ?? {};
   │
9. Columns built from viewType (visible, sortable, label, etc.)
   │
10. View cells: row.display[key], row.styles[key]
    Edit cells: renderEditModeFromMetadata(row.raw[key], editType[key])


Inline Edit Flow (v12.3.0 - Slow Click-and-Hold)
─────────────────────────────────────────────────

1. User holds mouse down on editable cell (500ms)
   │
2. longPressTimerRef fires → setEditingCell({ rowId, columnKey })
   │
3. Cell re-renders in edit mode:
   renderEditModeFromMetadata(row.raw[key], editType[key], onChange)
   │
4. User modifies value
   │
5. User clicks outside OR presses Enter:
   │  └── handleInlineSave() called
   │
6. Optimistic update → TanStack Query + Dexie updated immediately
   │
7. PATCH /api/v1/project/:id → Server confirms in background
   │
8. UI already updated (instant feedback to user)

   Note: Escape key cancels without saving (handleInlineCancel)
```

---

## Critical Considerations

### Design Principles (v11.1.0)

1. **Flat Metadata Format** - Component receives `{ viewType, editType }` directly (v11.1.0)
2. **Two-Query Architecture** - Data (5-min cache) and metadata (30-min cache) fetched separately
3. **FormattedRow** - View mode uses pre-formatted `display` and `styles`
4. **Raw Values** - Edit mode uses `row.raw[key]` for original values
5. **Backend Required** - Metadata must contain `{ viewType, editType }`
6. **Virtualized** - Auto-activates for >50 rows
7. **TanStack Query + Dexie** - Data persists in IndexedDB, survives page refresh
8. **Single In-Memory Cache** - Entity names resolved via `getEntityInstanceNameSync()` from TanStack Query (v11.0.0)

### Anti-Patterns

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Using `extractViewType(metadata.entityListOfInstancesTable)` | v11.1.0: Use `metadata?.viewType` directly (flat format) |
| Using nested metadata format | v11.1.0: Use flat `{ viewType, editType }` format |
| Frontend pattern detection | Backend sends complete metadata |
| Custom render per field | Use `row.display[key]` from FormattedRow |
| Hardcoded columns | Use `viewType` from backend |
| Fallback metadata generation | Backend MUST send metadata |
| Creating separate sync stores | v11.0.0: TanStack Query cache is single source of truth |

---

## Dynamic Entity Integration (v16.0.0)

### Database-Driven View Availability

The table view is controlled by the `entity.component_views` JSONB column in the database:

```sql
-- Table view enabled (default)
UPDATE app.entity SET
    component_views = '{
      "EntityListOfInstancesTable": { "enabled": true, "default": true }
    }'::jsonb
WHERE code = 'project';
```

### How Table View is Rendered

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  v16.0.0: DATABASE-DRIVEN TABLE VIEW                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. GET /api/v1/entity/codes                                                │
│     └── Returns: { component_views: { EntityListOfInstancesTable: {...} } } │
│                                                                              │
│  2. useEntityCodes() → useMergedEntityConfig()                              │
│     └── Extracts: viewConfig.supportedViews includes 'table' if enabled    │
│                                                                              │
│  3. EntityListOfInstancesPage                                               │
│     └── if (viewConfig.supportedViews.includes('table'))                    │
│     └── ViewSwitcher shows table option                                     │
│                                                                              │
│  4. When view === 'table':                                                  │
│     └── <EntityListOfInstancesTable                                         │
│           data={formattedData}                                              │
│           metadata={metadata}                                               │
│           hasNextPage={hasNextPage}          // Infinite scroll             │
│           isFetchingNextPage={isFetchingNextPage}                           │
│           fetchNextPage={fetchNextPage}                                     │
│         />                                                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Configuration Options

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | boolean | Whether table view is available |
| `default` | boolean | Whether table is the default view |

---

## Related Documents

| Document | Purpose |
|----------|---------|
| `docs/ui_components/EntityInstanceFormContainer.md` | Entity detail form with same inline editing pattern |
| `docs/ui_page/PAGE_LAYOUT_COMPONENT_ARCHITECTURE.md` | Page components and routing |
| `docs/caching-frontend/NORMALIZED_CACHE_ARCHITECTURE.md` | TanStack Query + Dexie cache architecture |
| `docs/caching-frontend/ref_data_entityInstance.md` | Entity reference resolution pattern |
| `docs/state_management/STATE_MANAGEMENT.md` | State architecture overview |
| `docs/design_pattern/INFINITE_SCROLL_VIRTUALIZATION.md` | Infinite scroll + dynamic entity config |

---

**Version:** 16.0.0 | **Last Updated:** 2025-12-06 | **Status:** Production

**Recent Updates:**
- v16.0.0 (2025-12-06): **Database-Driven View Configuration**
  - Table view availability controlled by `entity.component_views` JSONB column
  - View config fetched from `/api/v1/entity/codes` endpoint
  - `useMergedEntityConfig` hook extracts table config with static fallback
  - Infinite scroll props passed from page for seamless integration
- v12.3.0 (2025-12-03): **Unified Slow Click-and-Hold Inline Editing**
  - All three components (`EntityListOfInstancesTable`, `EntityInstanceFormContainer`, `EntityMetadataField`) now use consistent 500ms long-press pattern
  - Click outside OR Enter key triggers optimistic update (TanStack Query + Dexie)
  - Escape cancels without saving
  - Edit pencil icon still available for full row edit mode
  - Font size consistent between view and edit modes (`text-sm` class)
- v11.1.0 (2025-12-02): **Flat Metadata Format**
  - Both `EntityListOfInstancesTable` and `EntityInstanceFormContainer` now use flat `{ viewType, editType }` format
  - Component supports both flat and nested formats for backward compatibility
  - Entity reference fields resolved via `getEntityInstanceNameSync()` reading from TanStack Query cache
  - Updated data flow diagrams and code examples
- v11.0.0 (2025-12-02): **Single In-Memory Cache**
  - Removed RxDB references - now uses TanStack Query + Dexie
  - Sync accessors read from `queryClient.getQueryData()` - no separate Map-based stores
  - TanStack Query cache is single source of truth
  - Two-query architecture: data (5-min cache) + metadata (30-min cache)
- v8.5.0 (2025-11-28): RxDB offline-first data source, IndexedDB persistent storage
- v8.4.0 (2025-11-27): WebSocket real-time updates via PubSub invalidation
- v8.3.2 (2025-11-27): BadgeDropdownSelect for datalabel fields
- v8.3.0 (2025-11-26): ref_data_entityInstance pattern for entity resolution
- v8.2.0 (2025-11-25): Format-at-read pattern with FormattedRow
