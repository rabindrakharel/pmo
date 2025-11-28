# Component Architecture

**Version:** 8.5.0 | **Updated:** 2025-11-28

---

## Overview

The PMO frontend uses a **three-layer component hierarchy** with universal pages that render any entity type using backend-driven metadata.

**Core Principle:** Backend sends `{ viewType, editType }` metadata. Frontend is a pure renderer with zero pattern detection.

---

## Component Hierarchy

```
+-------------------------------------------------------------------------+
|                    THREE-LAYER COMPONENT HIERARCHY                       |
+-------------------------------------------------------------------------+
|                                                                          |
|  APPLICATION LAYER (Business Logic)                                     |
|  ----------------------------------------------------------------       |
|  EntityListOfInstancesTable, EntityInstanceFormContainer, KanbanView, CalendarView,        |
|  GridView, DAGVisualizer, DynamicChildEntityTabs, HierarchyGraphView    |
|                                                                          |
|  Props: data (FormattedRow[]), metadata ({ viewType, editType })        |
|  Uses: extractViewType(), extractEditType()                              |
|                                                                          |
|  DOMAIN LAYER (Data-Aware)                                              |
|  ----------------------------------------------------------------       |
|  EntitySelect, EntityMultiSelect, DataLabelSelect,                      |
|  BadgeDropdownSelect, EntitySelectDropdown                               |
|                                                                          |
|  Props: Uses editType.lookupSource, editType.datalabelKey               |
|  Data: RxDB (getDatalabelSync()), entity-instance API                    |
|                                                                          |
|  BASE LAYER (No Data Dependencies)                                      |
|  ----------------------------------------------------------------       |
|  Select, MultiSelect, DebouncedInput, DebouncedTextarea,                |
|  SearchableMultiSelect, Button, Modal, Badge                            |
|                                                                          |
|  Props: Generic value/onChange, no business logic                        |
|                                                                          |
+-------------------------------------------------------------------------+
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
  lookupEntity?: string;  // For entity reference fields
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
  raw: T;                           // Original values (for mutations)
  display: Record<string, string>;  // Pre-formatted display strings
  styles: Record<string, string>;   // CSS classes (for badges)
}
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
| `EntitySelect` | `ui/EntitySelect.tsx` | `entityCode` (from `editType.lookupEntity`) |
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

  // Render
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

// Regular field
<span>{formattedRecord.display[column.key]}</span>

// Badge field (has style)
if (formattedRecord.styles[column.key]) {
  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${formattedRecord.styles[column.key]}`}>
    {formattedRecord.display[column.key]}
  </span>
}
```

---

## Edit Mode Rendering

```typescript
import { renderEditModeFromMetadata } from '@/lib/frontEndFormatterService';

// Uses backend metadata for input type
const editType = extractEditType(metadata.entityListOfInstancesTable);
const editMeta = editType[column.key];

renderEditModeFromMetadata(
  formattedRecord.raw[column.key],  // Raw value for editing
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
      return <EntitySelect entityCode={metadata.lookupEntity} />;
    }
    break;
  case 'textarea':
    return <textarea />;
}
```

---

## File Structure

```
apps/web/src/components/
+-- shared/
|   +-- ui/
|   |   +-- EntityListOfInstancesTable.tsx       # Universal data table
|   |   +-- KanbanView.tsx            # Kanban board
|   |   +-- GridView.tsx              # Card grid
|   |   +-- CalendarView.tsx          # Event calendar
|   |   +-- Select.tsx                # Base select
|   |   +-- DataLabelSelect.tsx       # Datalabel dropdown
|   |   +-- EntitySelect.tsx          # Entity instance dropdown
|   |   +-- BadgeDropdownSelect.tsx   # Colored badge dropdown
|   |   +-- DebouncedInput.tsx        # Debounced text input
|   |   +-- Modal.tsx                 # Base modal
|   |   +-- Button.tsx                # Base button
|   +-- entity/
|   |   +-- EntityInstanceFormContainer.tsx   # Universal form renderer
|   |   +-- DynamicChildEntityTabs.tsx # Child entity tabs
|   +-- workflow/
|       +-- DAGVisualizer.tsx         # DAG status visualizer
+-- lib/
    +-- formatters/
    |   +-- index.ts                  # extractViewType, extractEditType
    |   +-- datasetFormatter.ts       # formatDataset, formatRow
    |   +-- types.ts                  # ComponentMetadata types
    +-- frontEndFormatterService.tsx  # renderViewModeFromMetadata, renderEditModeFromMetadata
```

---

## Anti-Patterns

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Direct `metadata.viewType` access | Use `extractViewType(metadata)` |
| Frontend pattern detection | Backend sends complete metadata |
| Custom render per field | Use `row.display[key]` from FormattedRow |
| Hardcoded columns | Use `viewType` from backend |
| Fallback metadata generation | Backend MUST send metadata |

---

## Component Checklist (v8.5.0)

When implementing a new component that consumes metadata:

- [ ] Import `extractViewType`, `extractEditType` from `@/lib/formatters`
- [ ] Extract metadata: `const viewType = extractViewType(metadata.entityListOfInstancesTable)`
- [ ] Handle null case: `if (!viewType) return null` with error log
- [ ] Use `row.display[key]` for view mode rendering
- [ ] Use `row.styles[key]` for badge CSS classes
- [ ] Use `row.raw[key]` for edit mode values
- [ ] Use `editType[key].inputType` for input component selection
- [ ] Use `editType[key].lookupSource` for data-aware inputs

---

## Related Documents

| Document | Purpose |
|----------|---------|
| `docs/ui_page/PAGE_ARCHITECTURE.md` | Page components and routing |
| `docs/ui_components/EntityListOfInstancesTable.md` | EntityListOfInstancesTable details |
| `docs/state_management/STATE_MANAGEMENT.md` | State management architecture |

---

**Version:** 8.5.0 | **Updated:** 2025-11-28 | **Status:** Production
