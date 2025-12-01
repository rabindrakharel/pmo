# Component Architecture

**Version:** 9.3.0 | **Updated:** 2025-12-01

---

## Overview

The PMO frontend uses a **three-layer component hierarchy** with universal pages that render any entity type using backend-driven metadata.

**Core Principles:**
- **Backend sends metadata** - `{ viewType, editType }` defines all field rendering
- **Frontend is a pure renderer** - Zero pattern detection in components
- **Format-at-read** - Raw data cached in hooks, formatted in pages via `useMemo`
- **Separation of concerns** - Cache = data, Page = transform, Component = render

---

## Format-at-Read Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FORMAT-AT-READ PATTERN                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  LAYER 1: CACHE HOOK (Raw Data Storage)                                     │
│  ───────────────────────────────────────                                    │
│  useEntityInstanceData(entityCode, params)                                  │
│  └── Returns: { data: T[], metadata, refData, isLoading, ... }             │
│  └── Stores RAW data in TanStack Query + Dexie                             │
│  └── NO formatting happens here                                             │
│                              │                                              │
│                              v                                              │
│  LAYER 2: PAGE (Transform via useMemo)                                      │
│  ─────────────────────────────────────                                      │
│  const formattedData = useMemo(() => {                                      │
│    return formatDataset(rawData, componentMetadata, refData);               │
│  }, [rawData, metadata, refData]);                                          │
│  └── Memoized transformation                                                │
│  └── Only recalculates when dependencies change                             │
│                              │                                              │
│                              v                                              │
│  LAYER 3: COMPONENT (Pure Renderer)                                         │
│  ──────────────────────────────────                                         │
│  <EntityListOfInstancesTable data={formattedData} metadata={metadata} />    │
│  └── Receives FormattedRow[] for viewing                                    │
│  └── Uses row.display[key] for pre-formatted strings                        │
│  └── Uses row.styles[key] for CSS classes (badges)                          │
│  └── Uses row.raw[key] for edit mode values                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Three-Layer Component Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    THREE-LAYER COMPONENT HIERARCHY                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  APPLICATION LAYER (Business Logic)                                         │
│  ──────────────────────────────────                                         │
│  EntityListOfInstancesTable, EntityInstanceFormContainer, KanbanView,       │
│  CalendarView, GridView, DAGVisualizer, DynamicChildEntityTabs,             │
│  HierarchyGraphView                                                         │
│                                                                              │
│  Props: data (FormattedRow[]), metadata ({ viewType, editType })            │
│  Uses: extractViewType(), extractEditType()                                 │
│                                                                              │
│  DOMAIN LAYER (Data-Aware)                                                  │
│  ─────────────────────────                                                  │
│  EntityInstanceNameLookup, EntityMultiSelect, DataLabelSelect,              │
│  BadgeDropdownSelect                                                        │
│                                                                              │
│  Props: Uses editType.lookupSource, editType.datalabelKey                   │
│  Data: Sync stores (getDatalabelSync()), entity-instance API                │
│                                                                              │
│  BASE LAYER (No Data Dependencies)                                          │
│  ─────────────────────────────────                                          │
│  Select, MultiSelect, DebouncedInput, DebouncedTextarea,                    │
│  SearchableMultiSelect, Button, Modal, Badge                                │
│                                                                              │
│  Props: Generic value/onChange, no business logic                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Types

### ComponentMetadata (from Backend)

```typescript
interface ComponentMetadata {
  viewType: Record<string, ViewFieldMetadata>;
  editType: Record<string, EditFieldMetadata>;
}

interface ViewFieldMetadata {
  dtype: 'str' | 'float' | 'int' | 'bool' | 'uuid' | 'date' | 'timestamp' | 'jsonb';
  label: string;
  renderType: string;     // 'text', 'currency', 'date', 'badge', 'boolean', etc.
  component?: string;     // Component name when renderType='component'
  behavior: {
    visible?: boolean;
    sortable?: boolean;
    filterable?: boolean;
    searchable?: boolean;
  };
  style: {
    width?: string;
    align?: 'left' | 'center' | 'right';
    symbol?: string;
    decimals?: number;
  };
  lookupEntity?: string;  // For entity reference fields (with ref_data_entityInstance)
  datalabelKey?: string;  // For badge/select fields
}

interface EditFieldMetadata {
  dtype: string;
  label: string;
  inputType: string;      // 'text', 'number', 'select', 'date', 'checkbox', etc.
  behavior: { editable?: boolean };
  validation: { required?: boolean; min?: number; max?: number };
  lookupSource?: 'datalabel' | 'entityInstance';
  datalabelKey?: string;
  lookupEntity?: string;
}
```

### FormattedRow (from formatDataset)

```typescript
interface FormattedRow<T = Record<string, any>> {
  raw: T;                           // Original values (for mutations, sorting, editing)
  display: Record<string, string>;  // Pre-formatted display strings
  styles: Record<string, string>;   // CSS classes (for badges)
}
```

---

## Data Flow: Hook → Page → Component

### Step 1: Cache Hook Returns Raw Data

```typescript
// In page component
import { useEntityInstanceData } from '@/db/tanstack-index';
import { formatDataset } from '@/lib/formatters';

const {
  data: rawData,           // Raw T[] from API/cache
  metadata,                // { entityListOfInstancesTable: { viewType, editType } }
  refData,                 // { employee: { 'uuid': 'James Miller' }, ... }
  isLoading,
  refetch,
} = useEntityInstanceData(entityCode, { limit: 100 });
```

### Step 2: Page Transforms via useMemo

```typescript
// Format-at-read pattern - transformation in PAGE, not hook
const formattedData = useMemo(() => {
  if (!rawData || rawData.length === 0) return [];

  // Extract component-specific metadata
  const componentMetadata = metadata?.entityListOfInstancesTable as ComponentMetadata | null;

  // Transform raw → FormattedRow[] (memoized)
  return formatDataset(rawData, componentMetadata, refData);
}, [rawData, metadata, refData]);
```

### Step 3: Component Renders FormattedRow[]

```typescript
// Dual data path: formatted for viewing, raw for editing
const tableData = isEditing
  ? rawData          // Raw values for form inputs
  : formattedData;   // Formatted strings for display

<EntityListOfInstancesTable
  data={tableData}
  metadata={metadata}
  // ...
/>
```

---

## Application Layer Components

| Component | File | Props |
|-----------|------|-------|
| `EntityListOfInstancesTable` | `ui/EntityListOfInstancesTable.tsx` | `data: FormattedRow[]`, `metadata` |
| `EntityInstanceFormContainer` | `entity/EntityInstanceFormContainer.tsx` | `data`, `metadata`, `isEditing` |
| `KanbanView` | `ui/KanbanView.tsx` | `data: FormattedRow[]`, `metadata`, `config.kanban.datalabelKey` |
| `CalendarView` | `ui/CalendarView.tsx` | `data`, `dateField`, `titleField` |
| `GridView` | `ui/GridView.tsx` | `data: FormattedRow[]`, `metadata` |
| `DAGVisualizer` | `workflow/DAGVisualizer.tsx` | `nodes: DAGNode[]`, `currentNodeId?` |
| `DynamicChildEntityTabs` | `entity/DynamicChildEntityTabs.tsx` | `parentEntityType`, `parentEntityId` |

---

## Domain Layer Components

| Component | File | Props |
|-----------|------|-------|
| `EntityInstanceNameLookup` | `ui/EntityInstanceNameLookup.tsx` | `entityCode` (from `editType.lookupEntity`) |
| `DataLabelSelect` | `ui/DataLabelSelect.tsx` | `datalabelKey` (from `editType.datalabelKey`) |
| `EntityMultiSelect` | `ui/EntityMultiSelect.tsx` | `entityCode` |
| `BadgeDropdownSelect` | `ui/BadgeDropdownSelect.tsx` | `options`, `value`, `onChange` |

---

## Base Layer Components

| Component | File | Props |
|-----------|------|-------|
| `Select` | `ui/Select.tsx` | `options`, `value`, `onChange` |
| `DebouncedInput` | `ui/DebouncedInput.tsx` | `value`, `onChange`, `debounceMs` |
| `DebouncedTextarea` | `ui/DebouncedTextarea.tsx` | `value`, `onChange`, `debounceMs` |
| `Button` | `ui/Button.tsx` | `onClick`, `variant`, `children` |
| `Modal` | `ui/Modal.tsx` | `isOpen`, `onClose`, `children` |

---

## Metadata Extraction Pattern

```typescript
import { extractViewType, extractEditType, isValidComponentMetadata } from '@/lib/formatters';

function EntityListOfInstancesTable({ data, metadata }) {
  // Get component-specific metadata
  const componentMetadata = metadata?.entityListOfInstancesTable;

  // Validate structure
  if (!componentMetadata || !isValidComponentMetadata(componentMetadata)) {
    console.error('[EntityListOfInstancesTable] Invalid metadata');
    return null;
  }

  // Extract viewType and editType
  const viewType = extractViewType(componentMetadata);
  const editType = extractEditType(componentMetadata);

  // Build columns from viewType
  const columns = Object.entries(viewType)
    .filter(([_, meta]) => meta.behavior?.visible)
    .map(([key, meta]) => ({
      key,
      title: meta.label,
      width: meta.style?.width,
      align: meta.style?.align,
      sortable: meta.behavior?.sortable,
      renderType: meta.renderType,
    }));

  // Render using FormattedRow structure
  return (
    <table>
      {data.map(row => (
        <tr key={row.raw.id}>
          {columns.map(col => (
            <td key={col.key}>
              {/* VIEW MODE: Use pre-formatted display */}
              {row.styles[col.key] ? (
                <span className={row.styles[col.key]}>
                  {row.display[col.key]}
                </span>
              ) : (
                row.display[col.key]
              )}
            </td>
          ))}
        </tr>
      ))}
    </table>
  );
}
```

---

## View Mode Rendering

```typescript
// Zero function calls per cell - direct property access
const formattedRecord = record as FormattedRow<any>;

// Regular field - use pre-formatted display string
<span>{formattedRecord.display[column.key]}</span>

// Badge field - has style from formatDataset
if (formattedRecord.styles[column.key]) {
  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${formattedRecord.styles[column.key]}`}>
    {formattedRecord.display[column.key]}
  </span>
}

// Entity reference - display string resolved from ref_data_entityInstance
// formatDataset already resolved UUID → name via refData
<span>{formattedRecord.display['manager__employee_id']}</span>  // "James Miller"
```

---

## Edit Mode Rendering

```typescript
import { renderEditModeFromMetadata } from '@/lib/frontEndFormatterService';

// Uses backend metadata for input type
const editType = extractEditType(metadata.entityListOfInstancesTable);
const editMeta = editType[column.key];

renderEditModeFromMetadata(
  formattedRecord.raw[column.key],  // Raw value for editing (not display string!)
  editMeta,
  (val) => onChange(id, column.key, val)
);

// renderEditModeFromMetadata switches on inputType:
switch (metadata.inputType) {
  case 'currency':
  case 'number':
    return <input type="number" step="0.01" />;
  case 'text':
    return <input type="text" />;
  case 'date':
    return <input type="date" />;
  case 'checkbox':
    return <input type="checkbox" />;
  case 'select':
    if (metadata.lookupSource === 'datalabel') {
      return <DataLabelSelect datalabelKey={metadata.datalabelKey} />;
    }
    if (metadata.lookupSource === 'entityInstance') {
      return <EntityInstanceNameLookup entityCode={metadata.lookupEntity} />;
    }
    break;
  case 'textarea':
    return <textarea />;
}
```

---

## Dual Data Path Pattern

Components must handle both view and edit modes:

```typescript
// In EntityListOfInstancesTable

function renderCell(row: FormattedRow<T>, column: Column, isEditing: boolean) {
  if (isEditing) {
    // EDIT MODE: Use raw values for form inputs
    const rawValue = row.raw[column.key];
    return renderEditModeFromMetadata(rawValue, editType[column.key], onChange);
  } else {
    // VIEW MODE: Use pre-formatted display strings
    const displayValue = row.display[column.key];
    const styleClass = row.styles[column.key];

    if (styleClass) {
      return <Badge className={styleClass}>{displayValue}</Badge>;
    }
    return <span>{displayValue}</span>;
  }
}
```

---

## File Structure

```
apps/web/src/
├── pages/
│   └── shared/
│       ├── EntityListOfInstancesPage.tsx    # useMemo(formatDataset) here
│       ├── EntitySpecificInstancePage.tsx   # useMemo(formatDataset) here
│       └── EntityCreatePage.tsx
├── components/
│   └── shared/
│       ├── ui/
│       │   ├── EntityListOfInstancesTable.tsx  # Receives FormattedRow[]
│       │   ├── KanbanView.tsx
│       │   ├── GridView.tsx
│       │   ├── CalendarView.tsx
│       │   ├── Select.tsx
│       │   ├── DataLabelSelect.tsx
│       │   ├── EntityInstanceNameLookup.tsx
│       │   ├── BadgeDropdownSelect.tsx
│       │   ├── DebouncedInput.tsx
│       │   └── Modal.tsx
│       ├── entity/
│       │   ├── EntityInstanceFormContainer.tsx
│       │   └── DynamicChildEntityTabs.tsx
│       └── workflow/
│           └── DAGVisualizer.tsx
├── db/
│   ├── tanstack-index.ts                    # Main exports
│   └── cache/
│       └── hooks/
│           └── useEntityInstanceData.ts     # Returns raw data
└── lib/
    ├── formatters/
    │   ├── index.ts                         # extractViewType, extractEditType
    │   ├── datasetFormatter.ts              # formatDataset, formatRow
    │   └── types.ts                         # ComponentMetadata, FormattedRow
    └── frontEndFormatterService.tsx         # renderEditModeFromMetadata
```

---

## formatDataset Function

Location: `apps/web/src/lib/formatters/datasetFormatter.ts`

```typescript
/**
 * Format entire dataset (call ONCE at fetch time via useMemo)
 *
 * @param data - Raw data array from API
 * @param metadata - Component metadata with viewType and editType
 * @param refData - ref_data_entityInstance for entity name resolution
 * @returns Array of formatted rows with raw, display, and styles
 */
export function formatDataset<T extends Record<string, any>>(
  data: T[],
  metadata: ComponentMetadata | null,
  refData?: RefData
): FormattedRow<T>[] {
  if (!data || data.length === 0) return [];

  const viewType = extractViewType(metadata);

  return data.map(row => {
    const display: Record<string, string> = {};
    const styles: Record<string, string> = {};

    for (const [key, value] of Object.entries(row)) {
      const fieldMeta = viewType?.[key];
      const formatted = formatValue(value, key, fieldMeta, refData);

      display[key] = formatted.display;
      if (formatted.style) {
        styles[key] = formatted.style;
      }
    }

    return { raw: row, display, styles };
  });
}
```

---

## Anti-Patterns

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Formatting in cache hook | Format in page via `useMemo(formatDataset)` |
| Direct `metadata.viewType` access | Use `extractViewType(metadata)` |
| Frontend pattern detection | Backend sends complete metadata |
| Custom render per field | Use `row.display[key]` from FormattedRow |
| Hardcoded columns | Use `viewType` from backend |
| Calling formatDataset on every render | Use `useMemo` with proper dependencies |

---

## Component Checklist (v9.3.0)

When implementing a component that consumes formatted data:

- [ ] Expect `FormattedRow[]` as data prop (not raw data)
- [ ] Import `extractViewType`, `extractEditType` from `@/lib/formatters`
- [ ] Extract metadata: `const viewType = extractViewType(metadata.entityListOfInstancesTable)`
- [ ] Handle null case: `if (!viewType) return null` with error log
- [ ] Use `row.display[key]` for view mode rendering
- [ ] Use `row.styles[key]` for badge CSS classes
- [ ] Use `row.raw[key]` for edit mode values
- [ ] Use `editType[key].inputType` for input component selection
- [ ] Use `editType[key].lookupSource` for data-aware inputs

When implementing a page that fetches data:

- [ ] Use `useEntityInstanceData()` hook for data fetching
- [ ] Transform via `useMemo(() => formatDataset(...), [deps])`
- [ ] Pass `formattedData` to components for view mode
- [ ] Pass `rawData` to components for edit mode

---

## Related Documents

| Document | Purpose |
|----------|---------|
| `docs/ui_page/PAGE_ARCHITECTURE.md` | Page components and routing |
| `docs/services/frontend_datasetFormatter.md` | formatDataset implementation details |
| `docs/state_management/STATE_MANAGEMENT.md` | TanStack Query + Dexie architecture |
| `docs/caching/TANSTACK_DEXIE_SYNC_ARCHITECTURE.md` | Cache sync and WebSocket |

---

**Version:** 9.3.0 | **Updated:** 2025-12-01 | **Status:** Production

**Recent Updates:**
- v9.3.0 (2025-12-01): Documented format-at-read pattern with cache hook integration
- v9.0.0 (2025-11-28): Migrated from RxDB to TanStack Query + Dexie
- v8.5.0 (2025-11-28): Added FormattedRow dual data path (view vs edit)
- v8.3.2 (2025-11-27): Added ref_data_entityInstance support
