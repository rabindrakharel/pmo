# Metadata Coupling Implementation Plan

**Version:** 1.0.0 | **Date:** 2025-11-25 | **Status:** 📋 PLANNING

---

## Table of Contents

1. [Current State: Frontend Architecture](#1-current-state-frontend-architecture)
2. [Current State: Backend Response Format](#2-current-state-backend-response-format)
3. [The Coupling Requirement](#3-the-coupling-requirement)
4. [The Gap Analysis](#4-the-gap-analysis)
5. [Implementation Plan](#5-implementation-plan)
6. [Testing Strategy](#6-testing-strategy)

---

## 1. Current State: Frontend Architecture

### 1.1 State Management (MUST PRESERVE)

The frontend uses a **hybrid architecture** that MUST be respected:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    STATE MANAGEMENT (v8.0.0)                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  REACT QUERY (SOLE Data Cache)                                          │
│  ├── Caches RAW entity data only                                        │
│  ├── Format-at-Read via `select` option (memoized)                      │
│  ├── Stale-While-Revalidate pattern                                     │
│  └── TTL: Lists (30s stale), Details (10s stale)                        │
│                                                                          │
│  ZUSTAND STORES (Metadata Only)                                          │
│  ├── datalabelMetadataStore (1h TTL) - Dropdown options                 │
│  ├── entityComponentMetadataStore (15m TTL) - Field metadata            │
│  ├── globalSettingsMetadataStore (1h TTL) - Formatting settings         │
│  └── entityCodeMetadataStore (1h TTL) - Entity type registry            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow (MUST PRESERVE)

```
API Response → React Query Cache (RAW) → select transform → FormattedRow[]
                     │
                     └→ Zustand stores metadata separately (15m TTL)
```

### 1.3 Format-at-Read Pattern (MUST PRESERVE)

```typescript
// useEntityQuery.ts - The pattern we MUST maintain
export function useFormattedEntityList(entityCode, params) {
  return useQuery({
    queryKey: ['entity-list', entityCode, params],
    queryFn: async () => {
      const response = await api.list(params);
      // Store metadata in Zustand (separate from data)
      if (response.metadata) {
        entityComponentMetadataStore.setComponentMetadata(entityCode, 'entityDataTable', componentMetadata);
      }
      return response;  // RAW data cached
    },
    // Format-at-read via select (memoized by React Query)
    select: (response) => ({
      ...response,
      formattedData: formatDataset(response.data, response.metadata?.entityDataTable)
    })
  });
}
```

### 1.4 Component Architecture (MUST PRESERVE)

| Component | Data Source | Metadata Source |
|-----------|-------------|-----------------|
| `EntityDataTable` | `formattedData` (from select) | `metadata` prop |
| `EntityFormContainer` | `data` (raw for editing) | `metadata` prop |
| `KanbanView` | `formattedData` | `metadata` prop |

---

## 2. Current State: Backend Response Format

### 2.1 Response Structure

The backend returns this structure for ALL entity endpoints:

```json
{
  "data": [
    {
      "id": "uuid-here",
      "name": "Customer Service Excellence Initiative",
      "budget_allocated_amt": 200000,
      "dl__project_stage": "Execution"
    }
  ],
  "fields": ["id", "code", "name", "budget_allocated_amt", "dl__project_stage", ...],
  "metadata": {
    "entityDataTable": {
      "viewType": { ... },    // Display configuration
      "editType": { ... }     // Edit configuration
    },
    "entityFormContainer": {
      "viewType": { ... },
      "editType": { ... }
    },
    "kanbanView": {
      "viewType": { ... },
      "editType": { ... }
    }
  },
  "total": 100,
  "limit": 20,
  "offset": 0
}
```

### 2.2 viewType Structure (How to DISPLAY)

Each field in `viewType` contains:

```json
{
  "budget_allocated_amt": {
    "dtype": "float",
    "label": "Budget Allocated",
    "renderType": "currency",           // ← Key property for display
    "behavior": {
      "visible": true,
      "sortable": true,
      "filterable": true,
      "searchable": false
    },
    "style": {
      "width": "140px",
      "align": "right",
      "symbol": "$",
      "decimals": 2,
      "locale": "en-CA"
    }
  }
}
```

### 2.3 editType Structure (How to EDIT)

Each field in `editType` contains:

```json
{
  "budget_allocated_amt": {
    "dtype": "float",
    "label": "Budget Allocated",
    "inputType": "number",              // ← Key property for editing
    "behavior": {
      "editable": true
    },
    "style": {
      "step": 0.01                      // ← Different from viewType.style!
    },
    "validation": {
      "min": 0
    }
  }
}
```

### 2.4 Why Separate viewType and editType?

| Aspect | viewType | editType |
|--------|----------|----------|
| **Purpose** | Display formatting | Input control |
| **Key Property** | `renderType` | `inputType` |
| **style.decimals** | `2` (display precision) | - |
| **style.step** | - | `0.01` (input increment) |
| **style.width** | `"140px"` (column width) | - |
| **validation** | - | `{ "min": 0 }` |
| **behavior** | visible, sortable, filterable | editable |

**They serve different purposes and MUST remain separate.**

---

## 3. The Coupling Requirement

### 3.1 Why Coupling is Needed

The frontend components need backend metadata to:

1. **Know which fields to show** → `viewType.behavior.visible`
2. **Know how to format values** → `viewType.renderType` + `style`
3. **Know which fields are editable** → `editType.behavior.editable`
4. **Know what input to render** → `editType.inputType`
5. **Know validation rules** → `editType.validation`
6. **Load dropdown options** → `editType.lookupSource`, `lookupEntity`, `datalabelKey`

### 3.2 Data Flow for View Mode

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│ Backend API     │ ──→ │ React Query      │ ──→ │ formatDataset()     │
│                 │     │ Cache (RAW)      │     │ via select          │
│ data: [...]     │     │                  │     │                     │
│ metadata:       │     │ Stores:          │     │ Uses:               │
│  viewType: {    │     │  • data (raw)    │     │  • renderType       │
│   renderType    │     │  • metadata      │     │  • style.symbol     │
│   style         │     │                  │     │  • style.decimals   │
│  }              │     │                  │     │                     │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
                                                           │
                                                           ▼
                                               ┌─────────────────────┐
                                               │ FormattedRow[]      │
                                               │  raw: { budget: 50k }│
                                               │  display: { budget: │
                                               │    "$50,000.00" }   │
                                               └─────────────────────┘
```

### 3.3 Data Flow for Edit Mode

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│ Backend API     │ ──→ │ Zustand Store    │ ──→ │ renderEditMode()    │
│                 │     │ (15m TTL)        │     │                     │
│ metadata:       │     │                  │     │ Uses:               │
│  editType: {    │     │ entityComponent  │     │  • inputType        │
│   inputType     │     │ MetadataStore    │     │  • style.step       │
│   validation    │     │                  │     │  • validation       │
│   lookupSource  │     │                  │     │  • lookupSource     │
│  }              │     │                  │     │  • lookupEntity     │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
                                                           │
                                                           ▼
                                               ┌─────────────────────┐
                                               │ <input type="number"│
                                               │  step={0.01}        │
                                               │  min={0} />         │
                                               └─────────────────────┘
```

---

## 4. The Gap Analysis

### 4.1 Current Frontend Code (BROKEN)

**EntityDataTable.tsx:410-417:**
```typescript
// CURRENT CODE (WRONG)
const componentMetadata = (metadata as any)?.entityDataTable;

// Tries to access fields directly on componentMetadata
const fieldMeta = componentMetadata[fieldKey];
// ❌ Returns undefined because componentMetadata = { viewType, editType }
// ❌ Not { budget_allocated_amt: {...}, name: {...} }
```

### 4.2 What Frontend EXPECTS

```typescript
// Frontend expects this structure:
metadata.entityDataTable = {
  "budget_allocated_amt": { visible: true, renderType: "currency", ... },
  "name": { visible: true, renderType: "text", ... }
}
```

### 4.3 What Backend SENDS

```typescript
// Backend actually sends this structure:
metadata.entityDataTable = {
  "viewType": {
    "budget_allocated_amt": { renderType: "currency", ... },
    "name": { renderType: "text", ... }
  },
  "editType": {
    "budget_allocated_amt": { inputType: "number", ... },
    "name": { inputType: "text", ... }
  }
}
```

### 4.4 The Gap

| What | Expected | Actual | Issue |
|------|----------|--------|-------|
| `metadata.entityDataTable[fieldKey]` | Field metadata object | `undefined` | Structure mismatch |
| `metadata.entityDataTable.keys()` | Field names | `['viewType', 'editType']` | Wrong keys |

---

## 5. Implementation Plan

### 5.1 Solution: Fix Frontend Reading Logic

**Why frontend fix (not backend)?**
- Backend structure is semantically correct (viewType ≠ editType)
- Changing backend would break API contract
- Frontend just needs to read the correct path

### 5.2 Files to Modify

| File | Change | Priority |
|------|--------|----------|
| `EntityDataTable.tsx` | Read from `viewType`/`editType` correctly | P0 |
| `EntityFormContainer.tsx` | Read from `viewType`/`editType` correctly | P0 |
| `useEntityQuery.ts` | Store metadata correctly in Zustand | P0 |
| `entityComponentMetadataStore.ts` | Update types to match actual structure | P1 |
| `datasetFormatter.ts` | Ensure reads `viewType` for formatting | P1 |

### 5.3 Implementation Steps

#### Step 1: Update entityComponentMetadataStore Types

**File:** `apps/web/src/stores/entityComponentMetadataStore.ts`

Based on **REAL API RESPONSE** from `/api/v1/project?limit=1`:

```typescript
// BEFORE (wrong)
export type ComponentMetadata = Record<string, FieldMetadata>;

// AFTER (correct - matches REAL API response exactly)
export interface ComponentMetadata {
  viewType: Record<string, ViewFieldMetadata>;
  editType: Record<string, EditFieldMetadata>;
}

/**
 * ViewFieldMetadata - matches REAL viewType structure
 *
 * Example from API (dl__project_stage in entityDataTable.viewType):
 * {
 *   "dtype": "str",
 *   "label": "Project Stage",
 *   "renderType": "badge",
 *   "behavior": { "visible": true, "sortable": true, "filterable": true, "searchable": false },
 *   "style": { "width": "140px", "align": "left", "colorFromData": true }
 * }
 */
export interface ViewFieldMetadata {
  dtype: string;                    // "str" | "float" | "uuid" | "date" | "timestamp" | "bool" | "int" | "jsonb" | "array[uuid]"
  label: string;                    // Human-readable label
  renderType: string;               // "text" | "badge" | "currency" | "date" | "timestamp" | "boolean" | "entityLink" | "entityLinks" | "json" | "version" | "number" | "component"
  behavior: {
    visible: boolean;               // Show in view
    sortable: boolean;              // Can sort column
    filterable: boolean;            // Can filter
    searchable: boolean;            // Include in search
  };
  style: {                          // Component-specific styling (varies by renderType)
    width?: string;                 // "140px", "250px", etc.
    align?: 'left' | 'right' | 'center';
    bold?: boolean;
    monospace?: boolean;
    linkToDetail?: boolean;
    truncate?: number;              // Character limit
    symbol?: string;                // "$" for currency
    decimals?: number;              // 2 for currency
    locale?: string;                // "en-CA"
    format?: string;                // "short" | "medium" | "datetime" | "relative"
    colorFromData?: boolean;        // For badges
    trueLabel?: string;             // For boolean
    falseLabel?: string;
    trueColor?: string;
    falseColor?: string;
    displayField?: string;          // "name" for entityLink
    linkToEntity?: boolean;
    maxDisplay?: number;            // For entityLinks array
    collapsed?: boolean;            // For json
    prefix?: string;                // "v" for version
    [key: string]: any;             // Additional properties
  };
  component?: string;               // For renderType="component": "DAGVisualizer"
}

/**
 * EditFieldMetadata - matches REAL editType structure
 *
 * Example from API (dl__project_stage in entityDataTable.editType):
 * {
 *   "dtype": "str",
 *   "label": "Project Stage",
 *   "inputType": "select",
 *   "behavior": { "editable": true },
 *   "style": {},
 *   "validation": {},
 *   "component": "DataLabelSelect",
 *   "lookupSource": "datalabel",
 *   "datalabelKey": "dl__project_stage"
 * }
 *
 * Example (manager__employee_id - entity reference):
 * {
 *   "dtype": "uuid",
 *   "label": "Manager Employee Name",
 *   "inputType": "select",
 *   "behavior": { "editable": true },
 *   "style": {},
 *   "validation": {},
 *   "component": "EntitySelect",
 *   "lookupSource": "entityInstance",
 *   "lookupEntity": "employee"
 * }
 */
export interface EditFieldMetadata {
  dtype: string;                    // Same types as viewType
  label: string;                    // Human-readable label
  inputType: string;                // "text" | "textarea" | "number" | "date" | "datetime-local" | "checkbox" | "select" | "readonly" | "component" | "currency" | "json" | "uuid"
  behavior: {
    editable: boolean;              // Can edit this field
  };
  style: {                          // Input-specific styling
    step?: number;                  // For number inputs
    rows?: number;                  // For textarea
    resizable?: boolean;
    mode?: string;                  // "tree" for json editor
    validateSchema?: boolean;
    symbol?: string;                // For currency display in edit
    decimals?: number;
    locale?: string;
    clearable?: boolean;            // For date/select
    searchable?: boolean;           // For select
    displayField?: string;          // "name" for entity select
    maxSelections?: number | null;  // For multi-select
    trueLabel?: string;             // For checkbox
    falseLabel?: string;
    showTimezone?: boolean;
    showHierarchy?: boolean;        // For DAGVisualizer
    interactive?: boolean;          // For DAGVisualizer
    monospace?: boolean;
    size?: string;                  // "lg" for large inputs
    [key: string]: any;
  };
  validation: {                     // Validation rules
    required?: boolean;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;               // Regex pattern
    [key: string]: any;
  };
  // Lookup properties (present when lookupSource exists)
  component?: string;               // "DataLabelSelect" | "EntitySelect" | "EntityMultiSelect" | "DAGVisualizer"
  lookupSource?: 'datalabel' | 'entityInstance';
  datalabelKey?: string;            // When lookupSource='datalabel': "dl__project_stage"
  lookupEntity?: string;            // When lookupSource='entityInstance': "employee"
}

/**
 * Full API metadata response structure
 */
export interface EntityApiMetadata {
  entityDataTable: ComponentMetadata;
  entityFormContainer: ComponentMetadata;
  kanbanView: ComponentMetadata;
}
```

#### Step 2: Update EntityDataTable Column Generation

**File:** `apps/web/src/components/shared/ui/EntityDataTable.tsx`

Based on **REAL API** structure - `metadata.entityDataTable` contains `{ viewType, editType }`:

```typescript
// BEFORE (wrong - tries to access fieldKey directly on componentMetadata)
const componentMetadata = (metadata as any)?.entityDataTable;
const fieldMeta = componentMetadata[fieldKey];  // ❌ Returns undefined!
// Why? Because componentMetadata = { viewType: {...}, editType: {...} }
// NOT componentMetadata = { name: {...}, budget_allocated_amt: {...} }

// AFTER (correct - access viewType and editType containers)
const componentMetadata = (metadata as any)?.entityDataTable as ComponentMetadata | undefined;
const viewType = componentMetadata?.viewType || {};
const editType = componentMetadata?.editType || {};

/**
 * Generate columns from real API metadata
 *
 * Real API viewType example for 'name' field:
 * {
 *   "dtype": "str",
 *   "label": "Name",
 *   "renderType": "text",
 *   "behavior": { "visible": true, "sortable": true, "filterable": true, "searchable": true },
 *   "style": { "width": "250px", "align": "left", "bold": true, "linkToDetail": true }
 * }
 */
return fieldOrder
  .filter((fieldKey: string) => {
    const viewMeta = viewType[fieldKey];
    // Use behavior.visible from viewType to determine column visibility
    return viewMeta?.behavior?.visible === true;
  })
  .map((fieldKey: string) => {
    const viewMeta = viewType[fieldKey] || {};
    const editMeta = editType[fieldKey] || {};

    return {
      key: fieldKey,
      // Display properties from viewType
      title: viewMeta.label || fieldKey,
      visible: true,
      renderType: viewMeta.renderType,           // "text", "badge", "currency", etc.
      sortable: viewMeta.behavior?.sortable,
      filterable: viewMeta.behavior?.filterable,
      searchable: viewMeta.behavior?.searchable,
      // Style from viewType (display styling)
      width: viewMeta.style?.width,              // "250px"
      align: viewMeta.style?.align,              // "left", "right", "center"
      bold: viewMeta.style?.bold,
      monospace: viewMeta.style?.monospace,
      linkToDetail: viewMeta.style?.linkToDetail,
      // Format options from viewType.style
      symbol: viewMeta.style?.symbol,            // "$" for currency
      decimals: viewMeta.style?.decimals,        // 2 for currency
      locale: viewMeta.style?.locale,            // "en-CA"
      format: viewMeta.style?.format,            // "short", "relative", etc.
      colorFromData: viewMeta.style?.colorFromData, // For badges

      // Edit properties from editType
      editable: editMeta.behavior?.editable,
      inputType: editMeta.inputType,             // "text", "select", "number", etc.
      component: editMeta.component,             // "DataLabelSelect", "EntitySelect", etc.

      // Lookup properties from editType (for dropdown population)
      lookupSource: editMeta.lookupSource,       // "datalabel" | "entityInstance"
      lookupEntity: editMeta.lookupEntity,       // "employee" (when lookupSource='entityInstance')
      datalabelKey: editMeta.datalabelKey,       // "dl__project_stage" (when lookupSource='datalabel')

      // Validation from editType
      validation: editMeta.validation,           // { min: 0, maxLength: 255, pattern: "..." }

      // Store full metadata for downstream renderers
      viewMetadata: viewMeta,
      editMetadata: editMeta,
    } as Column<T>;
  });
```

#### Step 3: Update EntityFormContainer Field Generation

**File:** `apps/web/src/components/shared/entity/EntityFormContainer.tsx`

Based on **REAL API** `metadata.entityFormContainer` structure:

```typescript
// BEFORE (wrong - accesses fieldKey directly on componentMetadata)
const componentMetadata = metadata?.entityFormContainer;
const fieldMeta = componentMetadata[fieldKey];  // ❌ Returns undefined!

// AFTER (correct - uses viewType and editType containers)
const componentMetadata = metadata?.entityFormContainer as ComponentMetadata | undefined;
const viewType = componentMetadata?.viewType || {};
const editType = componentMetadata?.editType || {};

/**
 * Real API entityFormContainer.editType example for 'dl__project_stage':
 * {
 *   "dtype": "str",
 *   "label": "Project Stage",
 *   "inputType": "component",         // Note: different from entityDataTable ("select")
 *   "behavior": { "editable": true },
 *   "style": { "showHierarchy": true, "interactive": true },
 *   "validation": {},
 *   "component": "DAGVisualizer",
 *   "lookupSource": "datalabel",
 *   "datalabelKey": "dl__project_stage"
 * }
 *
 * Real API entityFormContainer.editType example for 'manager__employee_id':
 * {
 *   "dtype": "uuid",
 *   "label": "Manager Employee Name",
 *   "inputType": "select",
 *   "behavior": { "editable": true },
 *   "style": { "searchable": true, "clearable": true, "displayField": "name" },
 *   "validation": {},
 *   "component": "EntitySelect",
 *   "lookupSource": "entityInstance",
 *   "lookupEntity": "employee"
 * }
 */
const fields = Object.keys(editType)
  .filter(fieldKey => {
    const editMeta = editType[fieldKey];
    // Filter out readonly and non-editable fields
    return editMeta?.behavior?.editable !== false &&
           editMeta?.inputType !== 'readonly';
  })
  .map(fieldKey => {
    const viewMeta = viewType[fieldKey] || {};
    const editMeta = editType[fieldKey] || {};

    return {
      key: fieldKey,
      dtype: editMeta.dtype,                    // "str", "uuid", "float", etc.
      label: editMeta.label || viewMeta.label || fieldKey,

      // Input type from editType (forms use edit metadata)
      inputType: editMeta.inputType || 'text',  // "text", "textarea", "select", "component", etc.
      editable: editMeta.behavior?.editable !== false,
      visible: viewMeta.behavior?.visible !== false,

      // Style from editType (form-specific styling)
      style: editMeta.style,                    // { rows: 4, resizable: true, size: "lg", ... }

      // Validation from editType
      validation: editMeta.validation,          // { required: true, min: 0, maxLength: 255, pattern: "..." }

      // Component to render (from editType)
      component: editMeta.component,            // "DAGVisualizer", "DataLabelSelect", "EntitySelect", "EntityMultiSelect"

      // Lookup properties from editType
      lookupSource: editMeta.lookupSource,      // "datalabel" | "entityInstance"
      lookupEntity: editMeta.lookupEntity,      // "employee" (when lookupSource='entityInstance')
      datalabelKey: editMeta.datalabelKey,      // "dl__project_stage" (when lookupSource='datalabel')

      // Store full metadata for custom rendering
      viewMetadata: viewMeta,
      editMetadata: editMeta,
    };
  });
```

#### Step 4: Update datasetFormatter to Use viewType

**File:** `apps/web/src/lib/formatters/datasetFormatter.ts`

The formatter must extract `viewType` from the component metadata for display formatting:

```typescript
import type { ComponentMetadata, ViewFieldMetadata } from '@/stores/entityComponentMetadataStore';

/**
 * Format dataset using viewType metadata for display
 *
 * @param data Raw data rows from API
 * @param componentMetadata Full component metadata { viewType, editType }
 * @returns FormattedRow[] with display strings and styles
 *
 * Real API viewType example for 'budget_allocated_amt':
 * {
 *   "dtype": "float",
 *   "label": "Budget Allocated",
 *   "renderType": "currency",
 *   "behavior": { "visible": true, "sortable": true, ... },
 *   "style": { "width": "140px", "align": "right", "symbol": "$", "decimals": 2, "locale": "en-CA" }
 * }
 */
export function formatDataset<T extends Record<string, unknown>>(
  data: T[],
  componentMetadata: ComponentMetadata | null  // { viewType, editType }
): FormattedRow<T>[] {
  // Extract viewType container - formatting only needs VIEW metadata
  const viewType = componentMetadata?.viewType || {};

  return data.map(row => formatRow(row, viewType));
}

/**
 * Format a single row using viewType metadata
 */
export function formatRow<T extends Record<string, unknown>>(
  row: T,
  viewType: Record<string, ViewFieldMetadata>
): FormattedRow<T> {
  const display: Record<string, string> = {};
  const styles: Record<string, string> = {};

  for (const [fieldKey, value] of Object.entries(row)) {
    const fieldMeta = viewType[fieldKey];

    if (!fieldMeta) {
      // No metadata - render as string
      display[fieldKey] = String(value ?? '');
      continue;
    }

    // Use renderType from viewType for formatting decision
    switch (fieldMeta.renderType) {
      case 'currency':
        display[fieldKey] = formatCurrency(value, fieldMeta.style);
        // style.align from viewType determines text alignment
        if (fieldMeta.style?.align) {
          styles[fieldKey] = `text-${fieldMeta.style.align}`;
        }
        break;

      case 'date':
        display[fieldKey] = formatDate(value, fieldMeta.style);
        break;

      case 'timestamp':
        display[fieldKey] = formatTimestamp(value, fieldMeta.style);
        break;

      case 'boolean':
        // Use trueLabel/falseLabel from viewType.style
        display[fieldKey] = value
          ? (fieldMeta.style?.trueLabel || 'Yes')
          : (fieldMeta.style?.falseLabel || 'No');
        // Use trueColor/falseColor for styling
        styles[fieldKey] = value
          ? `text-${fieldMeta.style?.trueColor || 'green'}-600`
          : `text-${fieldMeta.style?.falseColor || 'red'}-600`;
        break;

      case 'badge':
        display[fieldKey] = String(value ?? '');
        // colorFromData in viewType.style indicates badge color from data
        if (fieldMeta.style?.colorFromData) {
          styles[fieldKey] = 'badge-dynamic';  // CSS class to look up color
        }
        break;

      default:
        display[fieldKey] = String(value ?? '');
    }
  }

  return {
    raw: row,      // Original values (for editing)
    display,       // Pre-formatted display strings
    styles,        // CSS classes/inline styles
  };
}

function formatCurrency(value: unknown, style?: ViewFieldMetadata['style']): string {
  if (value == null) return '';
  const num = Number(value);
  if (isNaN(num)) return String(value);

  return new Intl.NumberFormat(style?.locale || 'en-CA', {
    style: 'currency',
    currency: 'CAD',  // Could be derived from style.symbol
    minimumFractionDigits: style?.decimals ?? 2,
    maximumFractionDigits: style?.decimals ?? 2,
  }).format(num);
}

function formatDate(value: unknown, style?: ViewFieldMetadata['style']): string {
  if (!value) return '';
  const date = new Date(String(value));
  if (isNaN(date.getTime())) return String(value);

  // Use style.format: "short", "medium", "long"
  const options: Intl.DateTimeFormatOptions =
    style?.format === 'short' ? { month: 'short', day: 'numeric', year: 'numeric' } :
    style?.format === 'medium' ? { month: 'long', day: 'numeric', year: 'numeric' } :
    { dateStyle: 'medium' };

  return new Intl.DateTimeFormat(style?.locale || 'en-CA', options).format(date);
}

function formatTimestamp(value: unknown, style?: ViewFieldMetadata['style']): string {
  if (!value) return '';
  const date = new Date(String(value));
  if (isNaN(date.getTime())) return String(value);

  // Use style.format: "relative", "datetime", etc.
  if (style?.format === 'relative') {
    return formatRelativeTime(date);
  }

  return new Intl.DateTimeFormat(style?.locale || 'en-CA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
```

#### Step 5: Update useEntityQuery Metadata Caching

**File:** `apps/web/src/lib/hooks/useEntityQuery.ts`

```typescript
// Line 261-264 - Store the FULL component metadata (viewType + editType)
if (result.metadata) {
  const componentName = normalizedParams.view || 'entityDataTable';
  const componentMetadata = (result.metadata as any)[componentName];

  // Store the full { viewType, editType } structure
  if (componentMetadata && typeof componentMetadata === 'object') {
    useEntityComponentMetadataStore.getState().setComponentMetadata(
      entityCode,
      componentName,
      componentMetadata  // Full structure preserved
    );
  }
}
```

### 5.4 Caching Considerations

The implementation MUST preserve these caching behaviors:

| Cache | What's Stored | TTL | No Change Needed |
|-------|---------------|-----|------------------|
| React Query | RAW data + full metadata | 30s stale | ✅ |
| entityComponentMetadataStore | `{ viewType, editType }` | 15m | ✅ (type fix only) |
| datalabelMetadataStore | Dropdown options | 1h | ✅ |

### 5.5 Format-at-Read Integration

The `select` transform must use `viewType` for formatting:

```typescript
// In useFormattedEntityList
select: (response) => ({
  ...response,
  formattedData: formatDataset(
    response.data,
    response.metadata?.entityDataTable  // Pass full { viewType, editType }
  )
})

// In formatDataset - extract viewType internally
export function formatDataset(data, componentMetadata) {
  const viewType = componentMetadata?.viewType || {};
  return data.map(row => formatRow(row, viewType));
}
```

---

## 6. Testing Strategy

### 6.1 Unit Tests

```typescript
import { ComponentMetadata, ViewFieldMetadata, EditFieldMetadata } from '@/stores/entityComponentMetadataStore';

describe('EntityDataTable column generation', () => {
  // Use REAL API structure from /api/v1/project?limit=1
  const mockMetadata: { entityDataTable: ComponentMetadata } = {
    entityDataTable: {
      viewType: {
        name: {
          dtype: 'str',
          label: 'Name',
          renderType: 'text',
          behavior: { visible: true, sortable: true, filterable: true, searchable: true },
          style: { width: '250px', align: 'left', bold: true, linkToDetail: true }
        },
        budget_allocated_amt: {
          dtype: 'float',
          label: 'Budget Allocated',
          renderType: 'currency',
          behavior: { visible: true, sortable: true, filterable: true, searchable: false },
          style: { width: '140px', align: 'right', symbol: '$', decimals: 2, locale: 'en-CA' }
        },
        dl__project_stage: {
          dtype: 'str',
          label: 'Project Stage',
          renderType: 'badge',
          behavior: { visible: true, sortable: true, filterable: true, searchable: false },
          style: { width: '140px', align: 'left', colorFromData: true }
        }
      },
      editType: {
        name: {
          dtype: 'str',
          label: 'Name',
          inputType: 'text',
          behavior: { editable: true },
          style: {},
          validation: { maxLength: 255 }
        },
        budget_allocated_amt: {
          dtype: 'float',
          label: 'Budget Allocated',
          inputType: 'number',
          behavior: { editable: true },
          style: {},
          validation: { min: 0 }
        },
        dl__project_stage: {
          dtype: 'str',
          label: 'Project Stage',
          inputType: 'select',
          behavior: { editable: true },
          style: {},
          validation: {},
          component: 'DataLabelSelect',
          lookupSource: 'datalabel',
          datalabelKey: 'dl__project_stage'
        }
      }
    }
  };

  it('should extract viewType and editType containers', () => {
    const componentMetadata = mockMetadata.entityDataTable;
    expect(componentMetadata.viewType).toBeDefined();
    expect(componentMetadata.editType).toBeDefined();
    expect(Object.keys(componentMetadata)).toEqual(['viewType', 'editType']);
  });

  it('should extract columns from viewType', () => {
    const { viewType, editType } = mockMetadata.entityDataTable;
    const columns = Object.keys(viewType)
      .filter(key => viewType[key].behavior.visible)
      .map(key => ({
        key,
        title: viewType[key].label,
        renderType: viewType[key].renderType,
        editable: editType[key]?.behavior?.editable ?? false,
      }));

    expect(columns.length).toBe(3);
    expect(columns[0].key).toBe('name');
    expect(columns[0].title).toBe('Name');
    expect(columns[0].renderType).toBe('text');
    expect(columns[0].editable).toBe(true);
  });

  it('should correctly map lookup properties from editType', () => {
    const { editType } = mockMetadata.entityDataTable;
    const stageField = editType['dl__project_stage'];

    expect(stageField.lookupSource).toBe('datalabel');
    expect(stageField.datalabelKey).toBe('dl__project_stage');
    expect(stageField.component).toBe('DataLabelSelect');
  });

  it('should use style properties from viewType for formatting', () => {
    const { viewType } = mockMetadata.entityDataTable;
    const budgetField = viewType['budget_allocated_amt'];

    expect(budgetField.style.symbol).toBe('$');
    expect(budgetField.style.decimals).toBe(2);
    expect(budgetField.style.locale).toBe('en-CA');
    expect(budgetField.style.align).toBe('right');
  });
});
```

### 6.2 Integration Tests

```bash
# 1. Verify API returns viewType and editType containers
./tools/test-api.sh GET "/api/v1/project?limit=1" | jq '.metadata.entityDataTable | keys'
# Expected: ["editType", "viewType"]

# 2. Verify viewType field structure
./tools/test-api.sh GET "/api/v1/project?limit=1" | jq '.metadata.entityDataTable.viewType.name'
# Expected:
# {
#   "dtype": "str",
#   "label": "Name",
#   "renderType": "text",
#   "behavior": { "visible": true, "sortable": true, "filterable": true, "searchable": true },
#   "style": { "width": "250px", "align": "left", "bold": true, "linkToDetail": true }
# }

# 3. Verify editType field structure with lookup properties
./tools/test-api.sh GET "/api/v1/project?limit=1" | jq '.metadata.entityDataTable.editType.dl__project_stage'
# Expected:
# {
#   "dtype": "str",
#   "label": "Project Stage",
#   "inputType": "select",
#   "behavior": { "editable": true },
#   "style": {},
#   "validation": {},
#   "component": "DataLabelSelect",
#   "lookupSource": "datalabel",
#   "datalabelKey": "dl__project_stage"
# }

# 4. Verify entity reference lookup
./tools/test-api.sh GET "/api/v1/project?limit=1" | jq '.metadata.entityDataTable.editType.manager__employee_id'
# Expected:
# {
#   "dtype": "uuid",
#   "label": "Manager Employee Name",
#   "inputType": "select",
#   "behavior": { "editable": true },
#   "style": {},
#   "validation": {},
#   "component": "EntitySelect",
#   "lookupSource": "entityInstance",
#   "lookupEntity": "employee"
# }

# 5. Verify all component types have same structure
./tools/test-api.sh GET "/api/v1/project?limit=1" | jq '.metadata | keys'
# Expected: ["entityDataTable", "entityFormContainer", "kanbanView"]

# 6. Verify entityFormContainer uses different style for DAGVisualizer
./tools/test-api.sh GET "/api/v1/project?limit=1" | jq '.metadata.entityFormContainer.editType.dl__project_stage'
# Expected:
# {
#   "dtype": "str",
#   "label": "Project Stage",
#   "inputType": "component",   // Different from entityDataTable
#   "behavior": { "editable": true },
#   "style": { "showHierarchy": true, "interactive": true },
#   "validation": {},
#   "component": "DAGVisualizer",
#   "lookupSource": "datalabel",
#   "datalabelKey": "dl__project_stage"
# }
```

### 6.3 Manual Testing Checklist

**EntityDataTable (List View):**
- [ ] `/project` page loads with correct columns
- [ ] Column headers match `viewType[field].label`
- [ ] Currency fields (`budget_allocated_amt`) show `$200,000.00` format (viewType.style)
- [ ] Badge fields (`dl__project_stage`) show colored badge (viewType.style.colorFromData)
- [ ] Date fields use correct locale format (viewType.style.locale: "en-CA")
- [ ] Timestamps with `format: "relative"` show "2d ago" style

**Inline Editing (EntityDataTable):**
- [ ] Inline edit triggers `editType.inputType` based input
- [ ] Datalabel dropdown shows options from `editType.datalabelKey`
- [ ] Entity select shows options from `editType.lookupEntity`
- [ ] Validation rules apply from `editType.validation`

**EntityFormContainer (Detail/Edit View):**
- [ ] Form renders all editable fields (`editType.behavior.editable: true`)
- [ ] DAGVisualizer renders for `dl__*` fields with `component: "DAGVisualizer"`
- [ ] EntitySelect renders for entity references with `lookupSource: "entityInstance"`
- [ ] DataLabelSelect renders for datalabel fields with `lookupSource: "datalabel"`
- [ ] Textarea renders for `descr` field with rows from `editType.style.rows`
- [ ] Validation patterns apply (`editType.validation.pattern`)

**KanbanView:**
- [ ] Cards display fields with `viewType.behavior.visible: true`
- [ ] Drag-drop updates stage correctly
- [ ] Compact currency format used (`viewType.style.compact: true`)

---

## 7. Appendix: Real API Response Structure

### 7.1 Complete Response Schema

```json
{
  "data": [...],          // Array of entity instances
  "fields": [...],        // Field order array
  "metadata": {
    "entityDataTable": {
      "viewType": {
        "<fieldKey>": {
          "dtype": "str | float | uuid | date | timestamp | bool | int | jsonb | array[uuid]",
          "label": "Human Label",
          "renderType": "text | badge | currency | date | timestamp | boolean | entityLink | entityLinks | json | version | number | component",
          "behavior": {
            "visible": true,
            "sortable": true,
            "filterable": true,
            "searchable": false
          },
          "style": { /* varies by renderType */ },
          "component": "DAGVisualizer"  // Only when renderType="component"
        }
      },
      "editType": {
        "<fieldKey>": {
          "dtype": "...",
          "label": "...",
          "inputType": "text | textarea | number | date | datetime-local | checkbox | select | readonly | component | currency | json",
          "behavior": { "editable": true },
          "style": { /* input-specific */ },
          "validation": { /* validation rules */ },
          "component": "DataLabelSelect | EntitySelect | EntityMultiSelect | DAGVisualizer",
          "lookupSource": "datalabel | entityInstance",
          "datalabelKey": "dl__*",        // When lookupSource="datalabel"
          "lookupEntity": "employee"      // When lookupSource="entityInstance"
        }
      }
    },
    "entityFormContainer": { /* Same structure, different style values */ },
    "kanbanView": { /* Same structure, different style values */ }
  },
  "total": 100,
  "limit": 20,
  "offset": 0
}
```

### 7.2 Lookup Property Decision Tree

```
if (editType[field].lookupSource === 'datalabel') {
  // Use DataLabelSelect component
  // Load options from datalabelMetadataStore using editType[field].datalabelKey
  // Example: dl__project_stage → datalabel_project_stage table
}
else if (editType[field].lookupSource === 'entityInstance') {
  // Use EntitySelect or EntityMultiSelect component
  // Load options from /api/v1/${editType[field].lookupEntity}
  // Example: lookupEntity='employee' → /api/v1/employee
}
else {
  // Regular input based on editType[field].inputType
}
```

---

## Summary

### What Changes

| Component | Change |
|-----------|--------|
| **Types** | Update `ComponentMetadata` to include `viewType`/`editType` |
| **EntityDataTable** | Read `viewType[field]` for display, `editType[field]` for edit |
| **EntityFormContainer** | Read `editType[field]` for form fields |
| **datasetFormatter** | Extract `viewType` internally for formatting |

### What Stays the Same

| Component | No Change |
|-----------|-----------|
| **Backend API** | Response structure preserved |
| **React Query** | Still caches RAW data |
| **Format-at-Read** | Still uses `select` transform |
| **Zustand TTL** | 15m for component metadata |
| **Datalabel caching** | Still at login, 1h TTL |

---

**Next Steps:** Approve this plan, then implement Step 1-5 in order.
