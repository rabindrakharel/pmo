# Frontend Architecture - Component, Page & State Design

> **React 19, TypeScript, Backend-Driven Metadata, Zero Pattern Detection**
> Universal page system with 3 pages handling 27+ entity types dynamically

**Version:** 8.3.3 | **Last Updated:** 2025-11-27

---

## Semantics

The PMO frontend uses a **three-layer component architecture** (Base → Domain → Application) with universal pages that render any entity type using backend-driven metadata. All components use the v8.2.0 `{ viewType, editType }` structure via `extractViewType()` and `extractEditType()` helpers.

**Core Principle:** Backend sends complete `{ viewType, editType }` per component. Frontend is a pure renderer. No pattern detection.

---

## End-to-End Data Flow (v8.2.0)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      END-TO-END DATA FLOW (v8.2.0)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. BACKEND BFF (generateEntityResponse)                                     │
│     ─────────────────────────────────────────────────────────────────────    │
│     API: GET /api/v1/project?limit=1000                                      │
│                       │                                                      │
│                       ▼                                                      │
│     Response: {                                                              │
│       data: [{ id, name, budget_allocated_amt, dl__project_stage }],        │
│       fields: ['id', 'name', 'budget_allocated_amt', 'dl__project_stage'],  │
│       metadata: {                                                            │
│         entityDataTable: {                                                   │
│           viewType: {                                                        │
│             budget_allocated_amt: { renderType: 'currency', ... },          │
│             dl__project_stage: { renderType: 'badge', datalabelKey: '...' } │
│           },                                                                 │
│           editType: {                                                        │
│             budget_allocated_amt: { inputType: 'number', ... },             │
│             dl__project_stage: { inputType: 'select', ... }                 │
│           }                                                                  │
│         }                                                                    │
│       },                                                                     │
│       datalabels: { project_stage: [...] }                                  │
│     }                                                                        │
│                       │                                                      │
│                       ▼ HTTP Response                                        │
│                                                                              │
│  2. REACT QUERY CACHE (RAW data only)                                        │
│     ─────────────────────────────────────────────────────────────────────    │
│     queryKey: ['entity-list', 'project', { limit: 1000 }]                   │
│     data: { data: [...], metadata: {...} }  // Stored as-is                  │
│                       │                                                      │
│                       ▼ select transform (ON READ - memoized)                │
│                                                                              │
│  3. FORMAT-AT-READ (formatDataset)                                           │
│     ─────────────────────────────────────────────────────────────────────    │
│     select: (response) => {                                                  │
│       const viewType = extractViewType(response.metadata.entityDataTable);  │
│       return formatDataset(response.data, { viewType });                    │
│     }                                                                        │
│                       │                                                      │
│                       ▼                                                      │
│     FormattedRow[] = [                                                       │
│       {                                                                      │
│         raw: { budget_allocated_amt: 50000, dl__project_stage: 'planning' },│
│         display: { budget_allocated_amt: '$50,000.00', dl__project_stage: 'Planning' },
│         styles: { dl__project_stage: 'bg-blue-100 text-blue-700' }          │
│       }                                                                      │
│     ]                                                                        │
│                       │                                                      │
│                       ▼                                                      │
│                                                                              │
│  4. COMPONENT RENDERING                                                      │
│     ─────────────────────────────────────────────────────────────────────    │
│     const viewType = extractViewType(metadata.entityDataTable);             │
│     const editType = extractEditType(metadata.entityDataTable);             │
│                                                                              │
│     VIEW MODE:                                                               │
│       <span>{row.display[key]}</span>                                        │
│       if (row.styles[key]) <Badge className={row.styles[key]}>{...}</Badge> │
│                                                                              │
│     EDIT MODE:                                                               │
│       renderEditModeFromMetadata(row.raw[key], editType[key], onChange)     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## System Design Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      THREE-LAYER COMPONENT HIERARCHY                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    APPLICATION LAYER                             │    │
│  │  EntityDataTable, EntityFormContainer, LabelsDataTable          │    │
│  │  KanbanView, CalendarView, GridView, DAGVisualizer              │    │
│  │  HierarchyGraphView, DynamicChildEntityTabs                     │    │
│  │                                                                  │    │
│  │  Props: data (FormattedRow[]), metadata ({ viewType, editType })│    │
│  │  Uses: extractViewType(), extractEditType()                     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │ composes                                 │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      DOMAIN LAYER                                │    │
│  │  EntitySelect, EntityMultiSelect, DataLabelSelect               │    │
│  │  EntitySelectDropdown, EntityMultiSelectTags                    │    │
│  │                                                                  │    │
│  │  Props: Uses editType.lookupSource, editType.datalabelKey       │    │
│  │  Data: datalabelMetadataStore, entity-instance API              │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │ wraps                                    │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                       BASE LAYER                                 │    │
│  │  Select, MultiSelect, SearchableMultiSelect, BadgeDropdownSelect│    │
│  │  DebouncedInput, DebouncedTextarea                              │    │
│  │                                                                  │    │
│  │  Props: Generic value/onChange, no business logic               │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Core Types (v8.2.0)

### ComponentMetadata Structure

```typescript
// v8.2.0: REQUIRED structure from backend
interface ComponentMetadata {
  viewType: Record<string, ViewFieldMetadata>;
  editType: Record<string, EditFieldMetadata>;
}

// ViewFieldMetadata - rendering instructions
interface ViewFieldMetadata {
  dtype: 'str' | 'float' | 'int' | 'bool' | 'uuid' | 'date' | 'timestamp' | 'jsonb';
  label: string;
  renderType: string;     // 'text', 'currency', 'date', 'badge', 'boolean', 'component', etc.
  component?: string;     // Component name when renderType='component' (e.g., 'DAGVisualizer')
  behavior: {
    visible?: boolean;    // Show in component
    sortable?: boolean;   // Allow sorting (tables)
    filterable?: boolean; // Show filter (tables)
    searchable?: boolean; // Include in search
  };
  style: {
    width?: string;
    align?: 'left' | 'center' | 'right';
    symbol?: string;      // Currency symbol
    decimals?: number;    // Decimal places
  };
  datalabelKey?: string;  // For badge fields
}

// EditFieldMetadata - input instructions
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

### FormattedRow Structure

```typescript
// Output of formatDataset() via format-at-read
interface FormattedRow<T = Record<string, any>> {
  raw: T;                           // Original values (for mutations)
  display: Record<string, string>;  // Pre-formatted display strings
  styles: Record<string, string>;   // CSS classes (for badges)
}
```

### Helper Functions

```typescript
// lib/formatters/index.ts

// Extract viewType from ComponentMetadata (REQUIRED)
function extractViewType(metadata: ComponentMetadata | null): Record<string, ViewFieldMetadata> | null {
  if (!metadata || !isValidComponentMetadata(metadata)) {
    console.error('[formatters] Invalid metadata - backend must send { viewType, editType }');
    return null;
  }
  return metadata.viewType;
}

// Extract editType from ComponentMetadata (REQUIRED)
function extractEditType(metadata: ComponentMetadata | null): Record<string, EditFieldMetadata> | null {
  if (!metadata || !isValidComponentMetadata(metadata)) {
    console.error('[formatters] Invalid metadata structure');
    return null;
  }
  return metadata.editType;
}

// Validate ComponentMetadata has required structure
function isValidComponentMetadata(metadata: any): boolean {
  return metadata && 'viewType' in metadata && typeof metadata.viewType === 'object';
}

// Check if data is already formatted
function isFormattedData(data: any): data is FormattedRow<any> {
  return data && typeof data === 'object' && 'raw' in data && 'display' in data;
}
```

---

## Component Layer Summary

### Application Layer (Business Logic)

| Component | File | Props (v8.2.0) |
|-----------|------|----------------|
| EntityDataTable | `ui/EntityDataTable.tsx` | `data: FormattedRow[]`, `metadata: { entityDataTable: ComponentMetadata }` |
| EntityFormContainer | `entity/EntityFormContainer.tsx` | `data`, `metadata: { entityFormContainer: ComponentMetadata }`, `formattedData?: FormattedRow` |
| KanbanView | `ui/KanbanView.tsx` | `data: FormattedRow[]`, `metadata`, `config.kanban.datalabelKey` |
| DAGVisualizer | `workflow/DAGVisualizer.tsx` | `nodes: DAGNode[]`, `currentNodeId?: number`, `onNodeClick?: (nodeId) => void` |
| DynamicChildEntityTabs | `entity/DynamicChildEntityTabs.tsx` | `parentEntityType`, `parentEntityId` |

### Domain Layer (Data-Aware)

| Component | File | Props |
|-----------|------|-------|
| EntitySelect | `ui/EntitySelect.tsx` | `entityCode` (from `editType.lookupEntity`) |
| DataLabelSelect | `ui/DataLabelSelect.tsx` | `datalabelKey` (from `editType.datalabelKey`) |
| EntityMultiSelect | `ui/EntityMultiSelect.tsx` | `entityCode` |

### Base Layer (No Data Dependencies)

| Component | File | Props |
|-----------|------|-------|
| Select | `ui/Select.tsx` | `options`, `value`, `onChange` |
| DebouncedInput | `ui/DebouncedInput.tsx` | `value`, `onChange`, `debounceMs` |
| BadgeDropdownSelect | `ui/BadgeDropdownSelect.tsx` | `options`, `value`, `onChange`, `disabled` |

---

## Page Architecture

### Universal Page System

```
┌─────────────────────────────────────────────────────────────────┐
│                     UNIVERSAL PAGE SYSTEM                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  EntityListOfInstancesPage.tsx      → Handles ALL entity lists  │
│    ├── /project             (projects list)                    │
│    ├── /task                (tasks list)                       │
│    └── ... 27+ entities                                        │
│                                                                 │
│    Data: useFormattedEntityList(entityCode) → FormattedRow[]   │
│    Metadata: { entityDataTable: { viewType, editType } }        │
│                                                                 │
│  EntitySpecificInstancePage.tsx    → Handles ALL entity details │
│    ├── /project/:id         (project detail + child tabs)     │
│    ├── /task/:id            (task detail + child tabs)        │
│    └── ... 27+ entities                                        │
│                                                                 │
│    Data: useEntityInstance(entityCode, id)                      │
│    Metadata: { entityFormContainer: { viewType, editType } }    │
│                                                                 │
│  EntityFormPage.tsx                → Handles ALL entity forms   │
│    ├── /project/new         (create project)                  │
│    ├── /project/:id/edit    (edit project)                    │
│    └── ... 27+ entities                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Page to Component Data Flow

```
EntityListOfInstancesPage
─────────────────────────

1. useFormattedEntityList(entityCode, { limit: 1000 })
   │
2. Returns: { formattedData: FormattedRow[], metadata }
   │
3. Pass to view component based on viewMode:
   ├── 'table'    → <EntityDataTable data={formattedData} metadata={metadata} />
   ├── 'kanban'   → <KanbanView data={formattedData} metadata={metadata} />
   ├── 'grid'     → <GridView data={formattedData} metadata={metadata} />
   └── 'calendar' → <CalendarView data={formattedData} metadata={metadata} />

4. Component extracts metadata:
   const viewType = extractViewType(metadata.entityDataTable);
   const editType = extractEditType(metadata.entityDataTable);


EntitySpecificInstancePage
──────────────────────────

1. useEntityInstance(entityCode, id)
   │
2. Returns: { data, metadata }
   │
3. Pass to form container:
   <EntityFormContainer
     data={data}
     metadata={metadata}
     isEditing={isEditing}
     onChange={handleChange}
   />

4. Component extracts metadata:
   const viewType = extractViewType(metadata.entityFormContainer);
   const editType = extractEditType(metadata.entityFormContainer);
```

---

## State Management

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    STATE MANAGEMENT (v8.2.0)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  REACT QUERY - Sole Data Cache                             │  │
│  │  ─────────────────────────────────────────────────────     │  │
│  │  • Stores RAW entity data only (no formatted strings)      │  │
│  │  • Format-at-read via `select` option (memoized)           │  │
│  │  • Stale-while-revalidate pattern                          │  │
│  │  • Automatic cache invalidation on mutations               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ZUSTAND STORES - Metadata + UI State Only                 │  │
│  │  ─────────────────────────────────────────────────────     │  │
│  │  • entityComponentMetadataStore (15m TTL)                  │  │
│  │  • datalabelMetadataStore (1h TTL)                         │  │
│  │  • globalSettingsMetadataStore (1h TTL)                    │  │
│  │  • entityEditStore (no TTL) - UI state                     │  │
│  │                                                            │  │
│  │  ✗ NO entity data stored here (React Query only)           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Hooks

| Hook | Purpose | Returns |
|------|---------|---------|
| `useFormattedEntityList(entityCode, params)` | List with format-at-read | `{ formattedData: FormattedRow[], metadata }` |
| `useEntityInstance(entityCode, id)` | Single entity | `{ data, metadata }` |
| `useEntityMutation(entityCode)` | CRUD operations | `{ updateEntity, deleteEntity }` |
| `extractViewType(metadata)` | Get viewType from ComponentMetadata | `Record<string, ViewFieldMetadata>` |
| `extractEditType(metadata)` | Get editType from ComponentMetadata | `Record<string, EditFieldMetadata>` |

---

## Rendering Patterns

### View Mode Rendering

```typescript
// EntityDataTable cell rendering (VIEW MODE)
// Zero function calls per cell - direct property access

const formattedRecord = record as FormattedRow<any>;

if (formattedRecord.display && formattedRecord.styles !== undefined) {
  const displayValue = formattedRecord.display[column.key];
  const styleClass = formattedRecord.styles[column.key];

  // Badge field (has style)
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
```

### Edit Mode Rendering

```typescript
// EntityDataTable cell rendering (EDIT MODE)
// Uses backend metadata for input type

const editType = extractEditType(metadata.entityDataTable);
const editMeta = editType[column.key];

// v8.2.0: Backend metadata required - minimal fallback for text input
const metadata = editMeta || { inputType: 'text', label: column.key };

// Backend decides input type
renderEditModeFromMetadata(
  formattedRecord.raw[column.key],  // Raw value for editing
  metadata,
  (val) => onChange(id, column.key, val)
);
```

### renderEditModeFromMetadata Switch

```typescript
switch (metadata.inputType) {
  case 'currency':
  case 'number':
    return <input type="number" step={metadata.inputType === 'currency' ? '0.01' : '1'} />;

  case 'text':
    return <input type="text" />;

  case 'date':
    return <input type="date" />;

  case 'datetime':
    return <input type="datetime-local" />;

  case 'checkbox':
    return <input type="checkbox" />;

  case 'select':
    // Lookup options from datalabelMetadataStore or entity-instance API
    if (metadata.lookupSource === 'datalabel') {
      return <DataLabelSelect datalabelKey={metadata.datalabelKey} />;
    }
    if (metadata.lookupSource === 'entityInstance') {
      return <EntitySelect entityCode={metadata.lookupEntity} />;
    }
    return <select>{options}</select>;

  case 'textarea':
    return <textarea />;

  default:
    return <input type="text" />;
}
```

---

## Performance Optimizations

### Virtualization (EntityDataTable)

| Metric | Without Virtualization | With Virtualization (v8.2.0) |
|--------|------------------------|-------------------------------|
| DOM Nodes (1000 rows) | 10,000-23,000 | ~200-300 |
| Scroll FPS | 30-45fps | 60fps |
| Memory Usage | Baseline | -90% |
| Threshold | N/A | >50 rows |

### Format-at-Read Benefits

| Benefit | Description |
|---------|-------------|
| **Smaller Cache** | RAW data only (not formatted strings) |
| **Fresh Formatting** | Datalabel colors always current |
| **Multiple Views** | Same cache serves table, kanban, grid |
| **Memoization** | React Query auto-memoizes select transform |

### Optimization Patterns

| Pattern | Purpose | Location |
|---------|---------|----------|
| **extractViewType()** | Safe metadata access | `lib/formatters` |
| **FormattedRow** | Pre-computed display values | `select` transform |
| **Pre-computed Styles** | Zero allocations during scroll | `columnStylesMap` |
| **Passive Listeners** | Non-blocking scroll | `{ passive: true }` |
| **Stable Keys** | Better React reconciliation | `getItemKey` |

---

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Correct Approach |
|--------------|---------|------------------|
| Direct `metadata.viewType` access | May fail on invalid structure | Use `extractViewType(metadata)` |
| Frontend pattern detection | Duplicates backend logic | Backend sends complete metadata |
| Storing entity data in Zustand | Dual cache, stale data | Use React Query only |
| Formatting in queryFn | Bloated cache | Use `select` option |
| Hardcoded field configs | Maintenance burden | Use backend metadata |
| Flat metadata structure | Removed in v8.2.0 | Use nested `{ viewType, editType }` |

---

## Component Checklist (v8.2.0)

When implementing a new component that consumes metadata:

- [ ] Import `extractViewType`, `extractEditType` from `@/lib/formatters`
- [ ] Extract metadata: `const viewType = extractViewType(metadata.entityDataTable)`
- [ ] Handle null case: `if (!viewType) return null` with error log
- [ ] Use `row.display[key]` for view mode rendering
- [ ] Use `row.styles[key]` for badge CSS classes
- [ ] Use `row.raw[key]` for edit mode values
- [ ] Use `editType[key].inputType` for input component selection
- [ ] Use `editType[key].lookupSource` for data-aware inputs

---

## File Reference

| File | Purpose |
|------|---------|
| `lib/formatters/types.ts` | ComponentMetadata, ViewFieldMetadata, EditFieldMetadata types |
| `lib/formatters/index.ts` | extractViewType, extractEditType, isValidComponentMetadata |
| `lib/formatters/datasetFormatter.ts` | formatDataset, formatRow, formatValue |
| `stores/entityComponentMetadataStore.ts` | Component metadata cache |
| `stores/datalabelMetadataStore.ts` | Dropdown options cache |
| `lib/hooks/useEntityQuery.ts` | React Query hooks |
| `lib/frontEndFormatterService.tsx` | renderViewModeFromMetadata, renderEditModeFromMetadata |

---

**Version:** 8.3.3 | **Last Updated:** 2025-11-27 | **Status:** Production Ready

**Recent Updates:**
- v8.3.3 (2025-11-27):
  - Updated DAGVisualizer props: `nodes: DAGNode[]`, `currentNodeId?: number`, `onNodeClick?`
  - Added `component` property to ViewFieldMetadata for `renderType: 'component'` pattern
  - DAGVisualizer now uses `renderType: 'component'` + `component: 'DAGVisualizer'` (not `renderType: 'dag'`)
- v8.3.2 (2025-11-27): Renamed ColoredDropdown → BadgeDropdownSelect
