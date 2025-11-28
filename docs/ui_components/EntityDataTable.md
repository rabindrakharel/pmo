# EntityDataTable Component

**Version:** 8.6.0 | **Location:** `apps/web/src/components/shared/ui/EntityDataTable.tsx` | **Updated:** 2025-11-28

---

## Overview

EntityDataTable is a universal data table component with **virtualized rendering**, inline editing, sorting, filtering, and pagination. It uses the `{ viewType, editType }` metadata structure from the backend to determine column configuration and rendering.

**Core Principle:** Backend metadata with `{ viewType, editType }` structure controls all columns, rendering, and edit behavior. Frontend is a pure renderer using `extractViewType()` and `extractEditType()` helpers.

**v8.6.0 Key Change:** All metadata (datalabels, entity codes) is now cached in RxDB alongside entity data. Access via `getDatalabelSync()` for badge colors. Draft state managed via `useRxDraft`.

---

## System Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     ENTITY DATA TABLE ARCHITECTURE (v8.6.0)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    Data Source (RxDB → IndexedDB)                    │    │
│  │                                                                      │    │
│  │  useRxEntityList('project') or useEntityInstanceList('project')     │    │
│  │    ├── Instant from IndexedDB (if cached)                           │    │
│  │    └── Background fetch if stale (>30s)                             │    │
│  │                                                                      │    │
│  │  Returns: { data, refData, metadata, isLoading, isStale }           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              │                                              │
│                              v                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    EntityDataTable                                   │    │
│  │                                                                      │    │
│  │  const viewType = extractViewType(metadata.entityDataTable);        │    │
│  │  const editType = extractEditType(metadata.entityDataTable);        │    │
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

## Props Interface

```typescript
import type { FormattedRow } from '@/lib/formatters';

export interface EntityDataTableProps<T = any> {
  /** Entity records (FormattedRow[] or raw T[]) */
  data: T[];

  /** Backend metadata with { entityDataTable: { viewType, editType } } (REQUIRED) */
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

// Metadata structure from API (v8.5.0)
interface EntityMetadata {
  entityDataTable: ComponentMetadata;
  entityFormContainer?: ComponentMetadata;
  fields?: string[];  // Field ordering
}

interface ComponentMetadata {
  viewType: Record<string, ViewFieldMetadata>;
  editType: Record<string, EditFieldMetadata>;
}
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
  datalabelKey?: string;  // For badge/select fields
}
```

### EditFieldMetadata

```typescript
interface EditFieldMetadata {
  dtype: string;
  label: string;
  inputType: string;      // 'text', 'number', 'select', 'date', 'checkbox', 'BadgeDropdownSelect', etc.
  behavior: {
    editable?: boolean;   // Allow editing
  };
  validation: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
  };
  lookupSource?: 'datalabel' | 'entityInstance';
  datalabelKey?: string;  // For select fields
  lookupEntity?: string;  // For entity reference fields
}
```

---

## Data Flow

### Column Generation

```
Backend Metadata                     extractViewType()           Processed Columns
────────────────                     ─────────────────           ─────────────────

metadata.entityDataTable: {    →    viewType = extractViewType   →   columns: [
  viewType: {                         (metadata.entityDataTable)       {
    budget_amt: {                                                        key: 'budget_amt',
      dtype: 'float',                 // REQUIRED                        title: 'Budget',
      label: 'Budget',                // Returns viewType or null        render: () =>
      renderType: 'currency',         // Logs error if invalid             row.display[key]
      behavior: { visible: true },                                      }
      style: { align: 'right' }                                        ]
    }
  },
  editType: { ... }
}
```

### Format-at-Read Pattern

```
RxDB (IndexedDB)         formatDataset()              Component Receives
────────────────         ───────────────              ──────────────────

{ data: [          →     Uses viewType to format  →   FormattedRow[] = [
  { budget_amt:          each field                     {
    50000 }                                              raw: { budget_amt: 50000 },
] }                                                      display: { budget_amt: '$50,000.00' },
                                                         styles: {}
                                                        }
                                                       ]
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

## Inline Editing (Airtable-style v8.4.0)

### Behavior

| Interaction | Action |
|-------------|--------|
| Single-click on editable cell | Instant inline edit of THAT cell only |
| Click outside / Tab / Enter | Auto-save and exit edit mode |
| Escape | Cancel without saving |
| Edit icon (✏️) | Fallback - edits entire row |
| 'E' key when row focused | Enter row edit mode |
| Tab | Navigate to next editable cell |
| Cmd+Z / Ctrl+Z | Undo last change with toast |

### Implementation

```typescript
// Cell-level editing
const handleCellClick = (record, columnKey) => {
  if (isEditable(columnKey)) {
    setEditingCell({ rowId: record.id, columnKey });
  }
};

// Auto-save on blur
const handleCellBlur = async () => {
  if (editingCell && hasChanged) {
    await onInlineEdit(editingCell.rowId, editingCell.columnKey, newValue);
  }
  setEditingCell(null);
};
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

## Usage Example (v8.5.0)

### With RxDB Hooks

```typescript
import { useRxEntityList } from '@/db/rxdb/hooks/useRxEntity';
import { EntityDataTable } from '@/components/shared/ui/EntityDataTable';
import { formatDataset } from '@/lib/formatters';

function ProjectListPage() {
  const {
    data,           // Raw data from IndexedDB
    refData,        // Reference lookups
    metadata,       // Field metadata
    isLoading,
    isStale,        // True if data older than 30s
    refetch,
  } = useRxEntityList<Project>('project', { limit: 1000 });

  // Format data for display
  const formattedData = useMemo(() => {
    if (!data.length) return [];
    return formatDataset(data, metadata?.entityDataTable);
  }, [data, metadata]);

  return (
    <EntityDataTable
      data={formattedData}
      metadata={metadata}
      refData={refData}
      loading={isLoading}
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

### With Compatibility Hooks

```typescript
import { useFormattedEntityList } from '@/lib/hooks/useEntityQuery';

function ProjectListPage() {
  // Uses RxDB internally, maintains React Query API
  const { data: formattedData, metadata, isLoading } = useFormattedEntityList('project', {
    limit: 1000,
  });

  return (
    <EntityDataTable
      data={formattedData}
      metadata={metadata}
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
Table Load Flow (v8.5.0)
────────────────────────

1. Page component mounts
   │
2. useRxEntityList('project') queries IndexedDB
   │
   ├── [Cache HIT] → Instant data, isLoading=false
   │                  Check staleness, background refresh if >30s
   │
   └── [Cache MISS] → ReplicationManager.fetchEntityList()
                      │
                      v
3. API returns { data, ref_data_entityInstance, metadata }
   │
4. ReplicationManager stores in RxDB (IndexedDB)
   │
5. RxDB reactive query emits → component re-renders
   │
6. formatDataset() transforms to FormattedRow[]
   │
7. EntityDataTable receives FormattedRow[] + metadata
   │
8. const viewType = extractViewType(metadata.entityDataTable)
   const editType = extractEditType(metadata.entityDataTable)
   │
9. Columns built from viewType (visible, sortable, label, etc.)
   │
10. View cells: row.display[key], row.styles[key]
    Edit cells: renderEditModeFromMetadata(row.raw[key], editType[key])


Inline Edit Flow
────────────────

1. User clicks cell (or Edit icon)
   │
2. setEditingCell({ rowId, columnKey })
   │
3. Cell re-renders in edit mode:
   renderEditModeFromMetadata(row.raw[key], editType[key], onChange)
   │
4. User modifies value
   │
5. User clicks away / Tab / Enter → onInlineEdit(rowId, key, value)
   │
6. PATCH /api/v1/project/:id
   │
7. RxDB upsert → Reactive query emits → UI updates
```

---

## Critical Considerations

### Design Principles (v8.5.0)

1. **extractViewType()** - Always use helper to access viewType
2. **extractEditType()** - Always use helper to access editType
3. **FormattedRow** - View mode uses pre-formatted `display` and `styles`
4. **Raw Values** - Edit mode uses `row.raw[key]` for original values
5. **Backend Required** - Metadata must contain `{ viewType, editType }`
6. **Virtualized** - Auto-activates for >50 rows
7. **RxDB Cache** - Data persists in IndexedDB, survives page refresh

### Anti-Patterns

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Direct `metadata.viewType` access | Use `extractViewType(metadata.entityDataTable)` |
| Direct `metadata.editType` access | Use `extractEditType(metadata.entityDataTable)` |
| Frontend pattern detection | Backend sends complete metadata |
| Custom render per field | Use `row.display[key]` from FormattedRow |
| Hardcoded columns | Use `viewType` from backend |
| Fallback metadata generation | Backend MUST send metadata |

---

## Related Documents

| Document | Purpose |
|----------|---------|
| `docs/ui_page/PAGE_ARCHITECTURE.md` | Page components and routing |
| `docs/ui_page/Layout_Component_Architecture.md` | Component hierarchy |
| `docs/state_management/STATE_MANAGEMENT.md` | RxDB + React Query + Zustand |
| `docs/caching/RXDB_SYNC_ARCHITECTURE.md` | WebSocket sync + caching |

---

**Version:** 8.5.0 | **Last Updated:** 2025-11-28 | **Status:** Production

**Recent Updates:**
- v8.5.0 (2025-11-28): RxDB offline-first data source, IndexedDB persistent storage
- v8.4.0 (2025-11-27): WebSocket real-time updates via PubSub invalidation
- v8.3.2 (2025-11-27): BadgeDropdownSelect for datalabel fields
- v8.3.0 (2025-11-26): ref_data_entityInstance pattern for entity resolution
- v8.2.0 (2025-11-25): Format-at-read pattern with FormattedRow
