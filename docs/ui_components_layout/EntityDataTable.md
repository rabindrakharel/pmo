# EntityDataTable Component

**Version:** 8.2.0 | **Location:** `apps/web/src/components/shared/ui/EntityDataTable.tsx`

---

## Semantics

EntityDataTable is a universal data table component with **virtualized rendering**, inline editing, sorting, filtering, and pagination. It uses the v8.2.0 `{ viewType, editType }` metadata structure to determine column configuration and rendering.

**Core Principle:** Backend metadata with `{ viewType, editType }` structure controls all columns, rendering, and edit behavior. Frontend is a pure renderer using `extractViewType()` and `extractEditType()` helpers.

---

## System Design Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     ENTITY DATA TABLE ARCHITECTURE (v8.2.0)              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    API Response Structure                        │    │
│  │  {                                                               │    │
│  │    data: [...],                                                  │    │
│  │    metadata: {                                                   │    │
│  │      entityDataTable: {                                          │    │
│  │        viewType: { field: { renderType, behavior, style } },     │    │
│  │        editType: { field: { inputType, validation } }            │    │
│  │      }                                                           │    │
│  │    },                                                            │    │
│  │    datalabels: { ... }                                           │    │
│  │  }                                                               │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                          │
│                              v                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    EntityDataTable                               │    │
│  │                                                                  │    │
│  │  const viewType = extractViewType(metadata.entityDataTable);     │    │
│  │  const editType = extractEditType(metadata.entityDataTable);     │    │
│  │                                                                  │    │
│  │  ┌─────────────────────────────────────────────────────────┐    │    │
│  │  │  Header Row (Sticky)                                     │    │    │
│  │  │  [Column titles from viewType[key].label]               │    │    │
│  │  │  [Sort indicators, filter icons]                         │    │    │
│  │  └─────────────────────────────────────────────────────────┘    │    │
│  │                                                                  │    │
│  │  ┌─────────────────────────────────────────────────────────┐    │    │
│  │  │  Virtualized Rows (@tanstack/react-virtual)              │    │    │
│  │  │  ─────────────────────────────────────────────────────   │    │    │
│  │  │  Only visible rows rendered in DOM (3 row overscan)      │    │    │
│  │  │                                                           │    │    │
│  │  │  ┌─────────────────────────────────────────────────┐    │    │    │
│  │  │  │ VIEW MODE: row.display[key] (pre-formatted)     │    │    │    │
│  │  │  │            row.styles[key] (CSS classes)        │    │    │    │
│  │  │  └─────────────────────────────────────────────────┘    │    │    │
│  │  │  ┌─────────────────────────────────────────────────┐    │    │    │
│  │  │  │ EDIT MODE: renderEditModeFromMetadata(          │    │    │    │
│  │  │  │              row.raw[key], editType[key])       │    │    │    │
│  │  │  └─────────────────────────────────────────────────┘    │    │    │
│  │  │                                                           │    │    │
│  │  │  Threshold: >50 rows → virtualized                       │    │    │
│  │  │             ≤50 rows → regular rendering                 │    │    │
│  │  └─────────────────────────────────────────────────────────┘    │    │
│  │                                                                  │    │
│  │  ┌─────────────────────────────────────────────────────────┐    │    │
│  │  │  Pagination (Client-side slicing)                        │    │    │
│  │  │  [Page numbers, page size selector: 100/500/1000/2000]   │    │    │
│  │  └─────────────────────────────────────────────────────────┘    │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Props Interface (v8.2.0)

```typescript
import type { FormattedRow } from '@/lib/formatters';

export interface EntityDataTableProps<T = any> {
  /** Entity records (FormattedRow[] from useFormattedEntityList) */
  data: T[];

  /** Backend metadata with { viewType, editType } structure (REQUIRED) */
  metadata?: EntityMetadata | null;

  /** Datalabel options from API (for dropdowns and DAG viz) */
  datalabels?: any[];

  /** Legacy explicit columns (fallback only - avoid in new code) */
  columns?: Column<T>[];

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

  /** Inline edit handler */
  onInlineEdit?: (recordId: string, fieldKey: string, value: any) => void;

  /** Enable inline editing mode */
  inlineEditable?: boolean;

  /** Row selection */
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
}

// EntityMetadata from API response (v8.2.0)
interface EntityMetadata {
  entityDataTable: ComponentMetadata;
  entityFormContainer?: ComponentMetadata;
}

// ComponentMetadata structure (v8.2.0 - REQUIRED)
interface ComponentMetadata {
  viewType: Record<string, ViewFieldMetadata>;
  editType: Record<string, EditFieldMetadata>;
}
```

---

## Metadata Types (v8.2.0)

### ViewFieldMetadata

```typescript
interface ViewFieldMetadata {
  dtype: 'str' | 'float' | 'int' | 'bool' | 'uuid' | 'date' | 'timestamp' | 'jsonb';
  label: string;
  renderType: string;     // 'text', 'currency', 'date', 'badge', 'boolean', 'dag', etc.
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
  datalabelKey?: string;  // For badge/select fields
}
```

### EditFieldMetadata

```typescript
interface EditFieldMetadata {
  dtype: string;
  label: string;
  inputType: string;      // 'text', 'number', 'select', 'date', 'checkbox', etc.
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

## Data Flow Diagram (v8.2.0)

```
Column Generation Flow
──────────────────────

Backend Metadata                     extractViewType()           Processed Columns
────────────────                     ─────────────────           ─────────────────

metadata.entityDataTable: {    →    viewType = extractViewType   →   columns: [
  viewType: {                         (metadata.entityDataTable)       {
    budget_amt: {                                                        key: 'budget_amt',
      dtype: 'float',                 // v8.2.0: REQUIRED               title: 'Budget',
      label: 'Budget',                // Returns viewType or null        render: () =>
      renderType: 'currency',         // Logs error if invalid             row.display[key]
      behavior: { visible: true },                                      }
      style: { align: 'right' }                                        ]
    }
  },
  editType: { ... }
}


Format-at-Read Flow
───────────────────

API Response            React Query select           Component Receives
────────────            ──────────────────           ──────────────────

{ data: [         →     formatDataset(data,    →     FormattedRow[] = [
  { budget_amt:           metadata.entityDataTable)    {
    50000 }              ↓                              raw: { budget_amt: 50000 },
] }                     Uses viewType to format        display: { budget_amt: '$50,000.00' },
                        each field                      styles: {}
                                                       }
                                                      ]


Cell Rendering Flow (v8.2.0)
────────────────────────────

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

## Component Implementation (v8.2.0)

### Column Generation with Extractors

```typescript
import { extractViewType, extractEditType, isValidComponentMetadata } from '@/lib/formatters';

// Inside EntityDataTable
const processedColumns = useMemo(() => {
  // Get component-specific metadata
  const componentMetadata = metadata?.entityDataTable;

  if (!componentMetadata || !isValidComponentMetadata(componentMetadata)) {
    console.error('[EntityDataTable] Invalid metadata - backend must send { viewType, editType }');
    return [];
  }

  // v8.2.0: Use extractors to get viewType and editType
  const viewType = extractViewType(componentMetadata);
  const editType = extractEditType(componentMetadata);

  if (!viewType) {
    console.error('[EntityDataTable] No viewType in metadata');
    return [];
  }

  // Get field order from fields array if available
  const fieldOrder = (metadata as any)?.fields || Object.keys(viewType);

  return fieldOrder
    .filter((fieldKey: string) => {
      const fieldMeta = viewType[fieldKey];
      return fieldMeta?.behavior?.visible === true;
    })
    .map((fieldKey: string) => {
      const viewMeta = viewType[fieldKey];
      const editMeta = editType?.[fieldKey];

      return {
        key: fieldKey,
        title: viewMeta.label,
        width: viewMeta.style?.width,
        align: viewMeta.style?.align,
        sortable: viewMeta.behavior?.sortable,
        filterable: viewMeta.behavior?.filterable,
        editable: editMeta?.behavior?.editable ?? false,
        renderType: viewMeta.renderType,
        inputType: editMeta?.inputType ?? 'text',
        datalabelKey: viewMeta.datalabelKey,
      };
    });
}, [metadata]);
```

### Cell Rendering

```typescript
// VIEW MODE - uses pre-formatted FormattedRow
const formattedRecord = record as FormattedRow<any>;

if (formattedRecord.display && formattedRecord.styles !== undefined) {
  const displayValue = formattedRecord.display[column.key];
  const styleClass = formattedRecord.styles[column.key];

  // Badge field (has style class)
  if (styleClass) {
    return (
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styleClass}`}>
        {displayValue}
      </span>
    );
  }

  // Regular field
  return <span>{displayValue}</span>;
}


// EDIT MODE - uses editType metadata
const editType = extractEditType(metadata.entityDataTable);
const editMeta = editType[column.key];

// v8.2.0: Backend metadata required - minimal fallback for text input
const metadata = editMeta || { inputType: 'text', label: column.key };

return renderEditModeFromMetadata(
  formattedRecord.raw[column.key],  // Raw value for editing
  metadata,
  (newValue) => handleFieldChange(column.key, newValue)
);
```

---

## Virtualization Architecture

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

## Usage Example (v8.2.0)

```typescript
import { useFormattedEntityList } from '@/lib/hooks/useEntityQuery';
import { EntityDataTable } from '@/components/shared/ui/EntityDataTable';

function ProjectListPage() {
  const { data: queryResult, isLoading } = useFormattedEntityList('project', {
    limit: 1000,
  });

  // queryResult contains:
  // - formattedData: FormattedRow[] (via select transform)
  // - metadata: { entityDataTable: { viewType, editType } }
  const formattedData = queryResult?.formattedData || [];
  const metadata = queryResult?.metadata;

  return (
    <EntityDataTable
      data={formattedData}
      metadata={metadata}
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

---

## Field Type Mapping

| viewType.renderType | View Display | editType.inputType | Edit Component |
|---------------------|--------------|--------------------| ---------------|
| `currency` | `$50,000.00` (right-aligned) | `number` | `<input type="number">` |
| `badge` | `<Badge>` with color | `select` | `<DataLabelSelect>` |
| `date` | `Jan 15, 2025` | `date` | `<input type="date">` |
| `boolean` | Check/X icon | `checkbox` | `<input type="checkbox">` |
| `reference` | Entity name | `select` | `<EntitySelect>` |
| `text` | Plain text | `text` | `<input type="text">` |
| `dag` | Visual progress path | `select` | `<DAGVisualizer>` |

---

## User Interaction Flow

```
Table Load Flow (v8.2.0)
────────────────────────

1. Page component mounts
   │
2. useFormattedEntityList fetches GET /api/v1/project?limit=1000
   │
3. API returns { data, metadata: { entityDataTable: { viewType, editType } } }
   │
4. React Query caches RAW data
   │
5. select: formatDataset() transforms to FormattedRow[]
   │   (Uses viewType for formatting)
   │
6. EntityDataTable receives FormattedRow[] + metadata
   │
7. const viewType = extractViewType(metadata.entityDataTable)
   const editType = extractEditType(metadata.entityDataTable)
   │
8. Columns built from viewType (visible, sortable, label, etc.)
   │
9. View cells: row.display[key], row.styles[key]
   Edit cells: renderEditModeFromMetadata(row.raw[key], editType[key])


Inline Edit Flow
────────────────

1. User clicks Edit icon on row
   │
2. setEditingRowId(row.id)
   │
3. editType = extractEditType(metadata.entityDataTable)
   │
4. Row re-renders in edit mode:
   renderEditModeFromMetadata(row.raw[key], editType[key], onChange)
   │
5. User modifies values
   │
6. User clicks Save → onInlineEdit(rowId, key, value)
   │
7. PATCH /api/v1/project/:id
   │
8. Query invalidation, table refetches
```

---

## Critical Considerations

### Design Principles (v8.2.0)

1. **extractViewType()** - Always use helper to access viewType
2. **extractEditType()** - Always use helper to access editType
3. **FormattedRow** - View mode uses pre-formatted `display` and `styles`
4. **Raw Values** - Edit mode uses `row.raw[key]` for original values
5. **Backend Required** - Metadata must contain `{ viewType, editType }`
6. **Virtualized** - Auto-activates for >50 rows

### Anti-Patterns

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Direct `metadata.viewType` access | Use `extractViewType(metadata)` |
| Frontend pattern detection | Backend sends complete metadata |
| Custom render per field | Use `row.display[key]` from FormattedRow |
| Hardcoded columns | Use `viewType` from backend |
| Fallback metadata generation | Backend MUST send metadata |

---

**Last Updated:** 2025-11-26 | **Version:** 8.2.0 | **Status:** Production Ready
