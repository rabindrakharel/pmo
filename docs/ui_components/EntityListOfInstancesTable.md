# EntityListOfInstancesTable Component

**Version:** 12.3.0 | **Location:** `apps/web/src/components/shared/ui/EntityListOfInstancesTable.tsx` | **Updated:** 2025-12-03

---

## Overview

EntityListOfInstancesTable is a universal data table component with **virtualized rendering**, inline editing, sorting, filtering, and pagination. It uses the `{ viewType, editType }` metadata structure from the backend to determine column configuration and rendering.

**Core Principle:** Backend metadata with `{ viewType, editType }` structure controls all columns, rendering, and edit behavior. Frontend is a pure renderer.

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

## Related Documents

| Document | Purpose |
|----------|---------|
| `docs/ui_components/EntityInstanceFormContainer.md` | Entity detail form with same inline editing pattern |
| `docs/ui_page/PAGE_LAYOUT_COMPONENT_ARCHITECTURE.md` | Page components and routing |
| `docs/caching-frontend/NORMALIZED_CACHE_ARCHITECTURE.md` | TanStack Query + Dexie cache architecture |
| `docs/caching-frontend/ref_data_entityInstance.md` | Entity reference resolution pattern |
| `docs/state_management/STATE_MANAGEMENT.md` | State architecture overview |

---

**Version:** 12.3.0 | **Last Updated:** 2025-12-03 | **Status:** Production

**Recent Updates:**
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
