# Metadata Coupling Implementation Plan

**Version:** 3.2.0 | **Date:** 2025-11-25 | **Status:** 🔄 IN PROGRESS

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Current State: Frontend Architecture](#2-current-state-frontend-architecture)
3. [Current State: Backend Format](#3-current-state-backend-format)
4. [The Gap: What's Missing](#4-the-gap-whats-missing)
5. [Industry Best Practices](#5-industry-best-practices)
6. [Solution Design](#6-solution-design)
7. [Implementation Plan](#7-implementation-plan)
8. [Testing & Verification](#8-testing--verification)
9. [Changelog](#9-changelog)

---

## 1. Problem Statement

### 1.1 The Core Problem

**The frontend cannot read field metadata because it looks in the wrong place.**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          THE COUPLING FAILURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  FRONTEND CODE:                                                             │
│  ──────────────                                                             │
│  const meta = metadata.entityDataTable["budget_allocated_amt"];             │
│  // Returns: undefined ❌                                                   │
│                                                                             │
│  BACKEND SENDS:                                                             │
│  ──────────────                                                             │
│  metadata.entityDataTable.viewType["budget_allocated_amt"]  // ✅ Here!    │
│  metadata.entityDataTable.editType["budget_allocated_amt"]  // ✅ And here!│
│                                                                             │
│  RESULT:                                                                    │
│  ───────                                                                    │
│  • Columns render without proper formatting                                 │
│  • Edit mode doesn't know input types                                       │
│  • Validation rules are ignored                                             │
│  • Dropdowns don't populate correctly                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Three Distinct Mismatches

| # | Issue | Frontend Expects | Backend Sends |
|---|-------|------------------|---------------|
| 1 | **Path mismatch** | `metadata.entityDataTable[field]` | `metadata.entityDataTable.viewType[field]` |
| 2 | **Property nesting** | `fieldMeta.visible` (flat) | `fieldMeta.behavior.visible` (nested) |
| 3 | **Property naming** | `fieldMeta.editType` | `fieldMeta.inputType` |

### 1.3 Impact Assessment

| Component | Symptom | Root Cause |
|-----------|---------|------------|
| **EntityDataTable** | Columns show raw data without formatting | Can't find `renderType` |
| **EntityFormContainer** | Forms don't validate | Can't find `validation` |
| **KanbanView** | Cards show wrong fields | Can't find `behavior.visible` |
| **Inline Edit** | Wrong input controls | Can't find `inputType` |
| **Dropdowns** | Don't populate options | Can't find `lookupSource` |

---

## 2. Current State: Frontend Architecture

### 2.1 Architecture Overview

The frontend follows a strict architecture pattern that **MUST be preserved**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FRONTEND ARCHITECTURE (v8.0.0)                           │
│                    ══════════════════════════════                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         API LAYER                                    │   │
│  │  GET /api/v1/{entity}?limit=20 → { data, metadata, total, ... }     │   │
│  └───────────────────────────────────┬─────────────────────────────────┘   │
│                                      │                                      │
│                                      ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    REACT QUERY (Data Cache)                          │   │
│  │  ────────────────────────────────────────                           │   │
│  │  • SOLE source of truth for entity data                             │   │
│  │  • Caches RAW data only (no formatting in cache)                    │   │
│  │  • Stale time: 30s for lists, 10s for details                       │   │
│  │  • Format-at-Read via `select` option (memoized)                    │   │
│  │                                                                      │   │
│  │  useQuery({                                                          │   │
│  │    queryKey: ['entity-list', entityCode, params],                   │   │
│  │    queryFn: () => api.get(`/api/v1/${entityCode}`),                 │   │
│  │    select: (data) => formatDataset(data, metadata) // ← Format here │   │
│  │  })                                                                  │   │
│  └───────────────────────────────────┬─────────────────────────────────┘   │
│                                      │                                      │
│         ┌────────────────────────────┴────────────────────────────┐        │
│         │                                                          │        │
│         ▼                                                          ▼        │
│  ┌─────────────────────────────┐    ┌─────────────────────────────────┐   │
│  │  ZUSTAND: Metadata Stores   │    │  COMPONENTS                      │   │
│  │  ──────────────────────────│    │  ────────────                    │   │
│  │                             │    │                                  │   │
│  │  entityComponentMetadataStore    │  EntityDataTable                 │   │
│  │  ├─ entityDataTable metadata     │  ├─ Reads viewType for columns  │   │
│  │  ├─ entityFormContainer metadata │  └─ Reads editType for inline   │   │
│  │  └─ kanbanView metadata          │                                  │   │
│  │  TTL: 15 minutes                 │  EntityFormContainer             │   │
│  │                             │    │  └─ Reads editType for fields   │   │
│  │  datalabelMetadataStore     │    │                                  │   │
│  │  └─ Dropdown options (1h TTL)    │  KanbanView                      │   │
│  │                             │    │  └─ Reads viewType for cards    │   │
│  └─────────────────────────────┘    └─────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Design Pattern Constraints (MUST Preserve)

| Constraint | Description | Why |
|------------|-------------|-----|
| **React Query = SOLE data cache** | All entity data flows through React Query | Prevents cache duplication, ensures consistency |
| **Format-at-Read pattern** | Raw data cached, formatting via `select` | Smaller cache, instant datalabel color updates |
| **Zustand for metadata** | Component metadata cached separately with TTL | Metadata rarely changes, reduces API calls |
| **No data transformation in components** | Components receive pre-formatted data | Keeps components pure, testable |
| **15-minute metadata TTL** | Metadata refreshes every 15 minutes | Balance between freshness and performance |

### 2.3 State Management Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       STATE MANAGEMENT FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. API CALL                                                                │
│     useEntityQuery('project', { limit: 20 })                               │
│           │                                                                 │
│           ▼                                                                 │
│  2. REACT QUERY CACHES RAW RESPONSE                                        │
│     {                                                                       │
│       data: [{ id, name, budget_allocated_amt: 200000, ... }],             │
│       metadata: { entityDataTable: { viewType: {...}, editType: {...} } }, │
│       total: 100                                                            │
│     }                                                                       │
│           │                                                                 │
│           ├──────────────────────────────────────┐                         │
│           │                                      │                          │
│           ▼                                      ▼                          │
│  3. ZUSTAND STORES METADATA              4. SELECT FORMATS DATA             │
│     entityComponentMetadataStore            formatDataset(raw, viewType)    │
│       .setComponentMetadata(                      │                         │
│         'project',                               ▼                          │
│         'entityDataTable',               FormattedRow[] {                   │
│         { viewType, editType }             raw: { budget: 200000 },         │
│       )                                    display: { budget: "$200,000" }, │
│           │                                styles: { ... }                  │
│           │                              }                                  │
│           ▼                                      │                          │
│  5. COMPONENT READS BOTH                        │                          │
│     const { viewType, editType } = metadata;    │                          │
│     const formattedData = useFormattedList();←──┘                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Current Frontend Types (BROKEN)

```typescript
// apps/web/src/stores/entityComponentMetadataStore.ts

// CURRENT TYPE - WRONG (assumes flat structure)
export type ComponentMetadata = Record<string, FieldMetadata>;

// Frontend code tries to read:
const componentMetadata = metadata?.entityDataTable;
const fieldMeta = componentMetadata['budget_allocated_amt'];  // ❌ undefined!

// Because componentMetadata is actually:
// { viewType: {...}, editType: {...} }
// NOT: { budget_allocated_amt: {...}, name: {...} }
```

---

## 3. Current State: Backend Format

### 3.1 Backend Architecture

The backend generates metadata via a **3-stage YAML pipeline**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BACKEND METADATA PIPELINE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Database Column: "budget_allocated_amt"                                    │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STAGE 1: pattern-mapping.yaml                                       │   │
│  │  ───────────────────────────                                         │   │
│  │  Pattern: *_amt  →  fieldBusinessType: "currency"                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌────────────────────────────┐    ┌────────────────────────────┐          │
│  │  STAGE 2a: view-type-      │    │  STAGE 2b: edit-type-      │          │
│  │  mapping.yaml              │    │  mapping.yaml              │          │
│  │  ────────────────────      │    │  ────────────────────      │          │
│  │  currency:                 │    │  currency:                 │          │
│  │    renderType: currency    │    │    inputType: number       │          │
│  │    behavior:               │    │    behavior:               │          │
│  │      visible: true         │    │      editable: true        │          │
│  │      sortable: true        │    │    style:                  │          │
│  │    style:                  │    │      step: 0.01            │          │
│  │      symbol: "$"           │    │    validation:             │          │
│  │      decimals: 2           │    │      min: 0                │          │
│  └────────────────────────────┘    └────────────────────────────┘          │
│         │                                   │                               │
│         └─────────────┬─────────────────────┘                               │
│                       ▼                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STAGE 3: API Response                                               │   │
│  │  ─────────────────────                                               │   │
│  │  {                                                                   │   │
│  │    "metadata": {                                                     │   │
│  │      "entityDataTable": {                                            │   │
│  │        "viewType": { "budget_allocated_amt": {...} },                │   │
│  │        "editType": { "budget_allocated_amt": {...} }                 │   │
│  │      }                                                               │   │
│  │    }                                                                 │   │
│  │  }                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Actual API Response Example:**

```json
{
  "data": [{ "id": "uuid", "name": "Kitchen Reno", "budget_allocated_amt": 200000 }],
  "metadata": {
    "entityDataTable": {
      "viewType": {
        "budget_allocated_amt": {
          "dtype": "float",
          "label": "Budget Allocated",
          "renderType": "currency",
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
            "locale": "en-CA",
            "emptyValue": "$0.00",
            "helpText": "Amount in Canadian dollars"
          }
        }
      },
      "editType": {
        "budget_allocated_amt": {
          "dtype": "float",
          "label": "Budget Allocated",
          "inputType": "number",
          "behavior": { "editable": true },
          "style": {
            "step": 0.01,
            "placeholder": "0.00",
            "helpText": "Amount in Canadian dollars"
          },
          "validation": { "min": 0 }
        }
      }
    }
  }
}
```

### 3.2 Why viewType and editType are Separate

The backend separates view and edit because they serve **fundamentally different purposes**:

| Field | viewType (Display) | editType (Input) |
|-------|-------------------|------------------|
| `budget_allocated_amt` | `renderType: currency`, `decimals: 2`, `symbol: "$"` | `inputType: number`, `step: 0.01`, `min: 0` |
| `dl__project_stage` | `renderType: badge`, `colorFromData: true` | `inputType: select`, `component: DAGVisualizer` |
| `created_ts` | `renderType: timestamp`, `format: relative` | `inputType: readonly` |
| `manager__employee_id` | `renderType: entityLink`, `displayField: name` | `inputType: select`, `lookupEntity: employee` |

**If merged, conflicts arise:**
- `decimals: 2` for display vs `step: 0.01` for input
- `truncate: 100` for tables vs `rows: 4` for forms
- `colorFromData: true` for badges vs `searchable: true` for selects

### 3.3 Complete API Response Example

```json
{
  "data": [
    {
      "id": "a1234567-1234-1234-1234-123456789abc",
      "name": "Kitchen Renovation",
      "code": "PROJ-001",
      "budget_allocated_amt": 200000,
      "dl__project_stage": "in_progress",
      "manager__employee_id": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13",
      "created_ts": "2025-01-15T10:30:00Z"
    }
  ],
  "fields": ["id", "name", "code", "budget_allocated_amt", "dl__project_stage", "manager__employee_id", "created_ts"],
  "metadata": {
    "entityDataTable": {
      "viewType": {
        "id": {
          "dtype": "uuid",
          "label": "Id",
          "renderType": "text",
          "behavior": { "visible": false, "sortable": false, "filterable": false, "searchable": false },
          "style": {}
        },
        "name": {
          "dtype": "str",
          "label": "Name",
          "renderType": "text",
          "behavior": { "visible": true, "sortable": true, "filterable": true, "searchable": true, "required": true },
          "style": { "width": "250px", "bold": true, "linkToDetail": true, "emptyValue": "(untitled)", "helpText": "The display name for this record" }
        },
        "budget_allocated_amt": {
          "dtype": "float",
          "label": "Budget Allocated",
          "renderType": "currency",
          "behavior": { "visible": true, "sortable": true, "filterable": true, "searchable": false },
          "style": { "width": "140px", "align": "right", "symbol": "$", "decimals": 2, "locale": "en-CA", "emptyValue": "$0.00" }
        },
        "dl__project_stage": {
          "dtype": "str",
          "label": "Stage",
          "renderType": "badge",
          "behavior": { "visible": true, "sortable": true, "filterable": true, "searchable": false },
          "style": { "width": "120px", "colorFromData": true }
        },
        "manager__employee_id": {
          "dtype": "uuid",
          "label": "Manager",
          "renderType": "entityLink",
          "behavior": { "visible": true, "sortable": true, "filterable": true, "searchable": false },
          "style": { "width": "150px", "displayField": "name", "linkToEntity": true }
        },
        "created_ts": {
          "dtype": "timestamp",
          "label": "Created",
          "renderType": "timestamp",
          "behavior": { "visible": true, "sortable": true, "filterable": false, "searchable": false },
          "style": { "width": "140px", "format": "relative" }
        }
      },
      "editType": {
        "id": {
          "dtype": "uuid",
          "label": "Id",
          "inputType": "readonly",
          "behavior": { "editable": false },
          "style": {},
          "validation": {}
        },
        "name": {
          "dtype": "str",
          "label": "Name",
          "inputType": "text",
          "behavior": { "editable": true },
          "style": { "size": "lg", "placeholder": "Enter name...", "helpText": "The display name for this record" },
          "validation": { "required": true, "minLength": 1, "maxLength": 255 }
        },
        "budget_allocated_amt": {
          "dtype": "float",
          "label": "Budget Allocated",
          "inputType": "number",
          "behavior": { "editable": true },
          "style": { "symbol": "$", "decimals": 2, "locale": "en-CA", "placeholder": "0.00", "helpText": "Amount in Canadian dollars" },
          "validation": { "min": 0 }
        },
        "dl__project_stage": {
          "dtype": "str",
          "label": "Stage",
          "inputType": "select",
          "behavior": { "editable": true },
          "style": {},
          "validation": {},
          "component": "DataLabelSelect",
          "lookupSource": "datalabel",
          "datalabelKey": "dl__project_stage"
        },
        "manager__employee_id": {
          "dtype": "uuid",
          "label": "Manager",
          "inputType": "select",
          "behavior": { "editable": true },
          "style": { "searchable": true, "clearable": true, "displayField": "name" },
          "validation": {},
          "component": "EntitySelect",
          "lookupSource": "entityInstance",
          "lookupEntity": "employee"
        },
        "created_ts": {
          "dtype": "timestamp",
          "label": "Created",
          "inputType": "readonly",
          "behavior": { "editable": false },
          "style": {},
          "validation": {}
        }
      }
    },
    "entityFormContainer": { "viewType": {...}, "editType": {...} },
    "kanbanView": { "viewType": {...}, "editType": {...} }
  },
  "total": 100,
  "limit": 20,
  "offset": 0
}
```

### 3.4 Why Frontend Needs This Structure

The frontend needs `viewType` and `editType` to:

| Use Case | Reads From | Properties Used |
|----------|-----------|-----------------|
| **Render table columns** | `viewType` | `renderType`, `style.width`, `style.symbol`, `behavior.visible` |
| **Format display values** | `viewType` | `renderType`, `style.decimals`, `style.format`, `style.emptyValue` |
| **Render inline edit inputs** | `editType` | `inputType`, `validation`, `lookupSource`, `lookupEntity` |
| **Populate dropdowns** | `editType` | `lookupSource`, `datalabelKey`, `lookupEntity` |
| **Validate form inputs** | `editType` | `validation.required`, `validation.min`, `validation.pattern` |
| **Show help text** | `editType` | `style.helpText`, `style.placeholder` |

---

## 4. The Gap: What's Missing

### 4.1 Frontend Reading Logic is Broken

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      THE THREE MISMATCHES                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  MISMATCH 1: PATH EXTRACTION                                                │
│  ───────────────────────────                                                │
│                                                                             │
│  Frontend does:    metadata.entityDataTable['budget_allocated_amt']         │
│  Should do:        metadata.entityDataTable.viewType['budget_allocated_amt']│
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  MISMATCH 2: PROPERTY NESTING                                               │
│  ────────────────────────────                                               │
│                                                                             │
│  Frontend reads:   fieldMeta.visible                                        │
│  Backend sends:    fieldMeta.behavior.visible                               │
│                                                                             │
│  Frontend reads:   fieldMeta.width                                          │
│  Backend sends:    fieldMeta.style.width                                    │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  MISMATCH 3: PROPERTY NAMING                                                │
│  ───────────────────────────                                                │
│                                                                             │
│  Frontend reads:   fieldMeta.editType                                       │
│  Backend sends:    fieldMeta.inputType                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 TypeScript Types Don't Match API

```typescript
// CURRENT TYPE (WRONG)
export type ComponentMetadata = Record<string, FieldMetadata>;

// NEEDED TYPE (CORRECT)
export interface ComponentMetadata {
  viewType: Record<string, ViewFieldMetadata>;
  editType: Record<string, EditFieldMetadata>;
}
```

### 4.3 Files That Need Updating

| File | Current Problem | Fix Required |
|------|-----------------|--------------|
| `entityComponentMetadataStore.ts` | Types assume flat structure | Update interfaces to match API |
| `formatters/types.ts` | `ComponentMetadata` is flat | Update to `{ viewType, editType }` |
| `formatters/datasetFormatter.ts` | Reads `metadata[field]` directly | Extract `viewType` first |
| `EntityDataTable.tsx` | Reads `componentMetadata[field]` | Read `viewType[field]` + `editType[field]` |
| `EntityFormContainer.tsx` | Reads `componentMetadata[field]` | Read `editType[field]` for forms |
| `useEntityQuery.ts` | Passes wrong structure to formatter | Extract `viewType` for `formatDataset()` |

---

## 4.4 Zustand Store Deep Dive: The Hidden Bug

### 4.4.1 Current Store Type Definition (WRONG)

**File:** `apps/web/src/stores/entityComponentMetadataStore.ts` (lines 27-70)

```typescript
// CURRENT TYPES - WRONG
export interface FieldMetadata {
  dtype: string;
  format: string;
  internal: boolean;
  visible: boolean;        // ← FLAT (expects behavior.visible to be here)
  filterable: boolean;     // ← FLAT
  sortable: boolean;       // ← FLAT
  editable: boolean;       // ← FLAT
  viewType: string;        // ← WRONG! viewType is a CONTAINER, not a string
  editType: string;        // ← WRONG! editType is a CONTAINER, not a string
  label: string;
  width?: string;          // ← FLAT (expects style.width to be here)
  // ...
}

export type ComponentMetadata = Record<string, FieldMetadata>;
// ↑ WRONG! This says metadata['name'] returns FieldMetadata
//   But actually metadata.viewType['name'] returns the field metadata
```

### 4.4.2 Current Formatter Types (ALSO WRONG)

**File:** `apps/web/src/lib/formatters/types.ts` (lines 13-40)

```typescript
// ALSO WRONG - expects flat metadata
export interface FieldMetadata {
  renderType?: string;
  inputType?: string;
  visible?: boolean;       // ← FLAT
  // ...
}

export interface ComponentMetadata {
  [fieldName: string]: FieldMetadata;  // ← WRONG! Expects flat structure
}
```

### 4.4.3 How Store is Populated (CORRECT)

**File:** `apps/web/src/lib/hooks/useEntityQuery.ts` (lines 256-266)

```typescript
// This code is CORRECT - it stores the right data
if (result.metadata) {
  const componentName = normalizedParams.view || 'entityDataTable';
  const componentMetadata = (result.metadata as any)[componentName];
  // componentMetadata = { viewType: {...}, editType: {...} }

  if (componentMetadata && typeof componentMetadata === 'object') {
    useEntityComponentMetadataStore.getState().setComponentMetadata(
      entityCode, componentName, componentMetadata
      // ↑ Stores { viewType: {...}, editType: {...} } - CORRECT!
    );
  }
}
```

### 4.4.4 THE BUG: Formatter Receives Wrong Structure

**File:** `apps/web/src/lib/hooks/useEntityQuery.ts` (lines 493-501)

```typescript
const selectFormatted = useCallback(
  (raw: EntityInstanceListResult<T>): FormattedEntityInstanceListResult<T> => {
    // Gets { viewType: {...}, editType: {...} }
    const componentMetadata = (raw.metadata as any)?.[mappedView] as ComponentMetadata | null;

    // BUG: Passes { viewType, editType } but formatDataset expects Record<string, FieldMetadata>
    const formattedData = formatDataset(raw.data, componentMetadata);
    // ↑ formatDataset internally does: metadata['name'] → undefined!
```

**File:** `apps/web/src/lib/formatters/datasetFormatter.ts` (line 94)

```typescript
export function formatRow<T>(row: T, metadata: ComponentMetadata | null): FormattedRow<T> {
  for (const [key, value] of Object.entries(row)) {
    const fieldMeta = metadata?.[key];  // ← BUG! metadata is { viewType, editType }
    // For key='name', this returns undefined, NOT the field metadata!
    const formatted = formatValue(value, key, fieldMeta);  // fieldMeta = undefined
  }
}
```

### 4.4.5 Visual Diagram of the Bug

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        THE ZUSTAND/FORMATTER BUG                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  BACKEND RESPONSE:                                                          │
│  ─────────────────                                                          │
│  metadata.entityDataTable = {                                               │
│    viewType: {                                                              │
│      "name": { renderType: "text", behavior: {...}, style: {...} },        │
│      "budget": { renderType: "currency", ... }                              │
│    },                                                                       │
│    editType: {                                                              │
│      "name": { inputType: "text", validation: {...} },                     │
│      "budget": { inputType: "number", ... }                                 │
│    }                                                                        │
│  }                                                                          │
│         │                                                                   │
│         ▼                                                                   │
│  ZUSTAND STORE:                                                             │
│  ──────────────                                                             │
│  setComponentMetadata('project', 'entityDataTable', {                       │
│    viewType: { name: {...}, budget: {...} },   ← Stored correctly          │
│    editType: { name: {...}, budget: {...} }                                 │
│  })                                                                         │
│         │                                                                   │
│         ▼                                                                   │
│  FORMAT AT READ (select callback):                                          │
│  ─────────────────────────────────                                          │
│  componentMetadata = { viewType: {...}, editType: {...} }                   │
│  formatDataset(data, componentMetadata)  // ← Passes whole object          │
│         │                                                                   │
│         ▼                                                                   │
│  DATASET FORMATTER:                                                         │
│  ──────────────────                                                         │
│  for (const [key, value] of Object.entries(row)) {                          │
│    const fieldMeta = metadata?.[key];  // key = 'name'                     │
│    // metadata['name'] → undefined!  ❌                                     │
│    // metadata.viewType['name'] → { renderType: "text", ... } ✅            │
│  }                                                                          │
│                                                                             │
│  RESULT: All fields formatted as plain text because fieldMeta is undefined  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.4.6 Impact of the Bug

| Symptom | Cause |
|---------|-------|
| Currency shows `200000` not `$200,000.00` | `fieldMeta.renderType` is undefined |
| Dates show raw ISO string | `fieldMeta.renderType` is undefined |
| Badges show plain text, no colors | `fieldMeta.renderType` is undefined |
| All columns same width | `fieldMeta.width` is undefined |
| Dropdowns don't populate | `fieldMeta.lookupSource` is undefined |

### 4.4.7 Why It Appears to Work Sometimes

The code has fallbacks that mask the bug:

```typescript
// In formatValue:
const renderType = metadata?.renderType || 'text';  // Falls back to 'text'

// In formatText:
return { display: String(value ?? '') };  // Shows raw value as string
```

So instead of crashing, fields just render as plain text - which looks "okay" but loses all formatting.

---

## 5. Industry Best Practices

### 5.1 Separation of Concerns is Standard

| Platform | View Config | Edit Config | Approach |
|----------|-------------|-------------|----------|
| **Salesforce** | `displayType` | `inputType` | Separate field descriptors |
| **SAP Fiori** | `@UI.lineItem` | `@UI.fieldGroup` | Different OData annotations |
| **Microsoft Dynamics** | `DisplayMode` | `EditMode` | Separate attribute sections |
| **Retool** | `displayType` | `inputType` | Explicit separation |
| **Airtable** | `cellStyle` | `editorConfig` | Per-component configs |

### 5.2 JSON:API / OpenAPI Patterns

Modern API design recommends separating concerns:

```yaml
# OpenAPI best practice pattern
components:
  schemas:
    FieldDescriptor:
      properties:
        display:
          type: object
          description: "Read-only rendering configuration"
        input:
          type: object
          description: "Edit mode configuration"
```

### 5.3 React Best Practices

```typescript
// GOOD: Component props mirror API structure
interface TableColumnProps {
  viewConfig: ViewFieldMetadata;   // Display settings
  editConfig: EditFieldMetadata;   // Edit settings (optional)
}

// BAD: Merged/transformed props
interface TableColumnProps {
  config: MergedFieldMetadata;     // Where does this come from? Who transforms it?
}
```

---

## 6. Solution Design

### 6.1 Decision: Fix Frontend, Not Backend

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| **A: Flatten backend** | Frontend code unchanged | Violates SRP, loses semantics, creates conflicts | ❌ Rejected |
| **B: Fix frontend** | Preserves correct structure, industry-standard | Requires frontend changes | ✅ Chosen |

**Why Option B:**
1. Backend structure is semantically correct
2. Follows industry best practices
3. Changing backend would break API contract
4. Frontend fix is localized (5 files)

### 6.2 The Fix

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// BEFORE (BROKEN)
// ═══════════════════════════════════════════════════════════════════════════
const componentMetadata = metadata?.entityDataTable;
const fieldMeta = componentMetadata[fieldKey];  // ❌ undefined

return {
  visible: fieldMeta.visible,       // ❌ undefined
  width: fieldMeta.width,           // ❌ undefined
  editType: fieldMeta.editType,     // ❌ undefined (wrong name)
};

// ═══════════════════════════════════════════════════════════════════════════
// AFTER (FIXED)
// ═══════════════════════════════════════════════════════════════════════════
const componentMetadata = metadata?.entityDataTable;
const viewType = componentMetadata?.viewType || {};
const editType = componentMetadata?.editType || {};

const viewMeta = viewType[fieldKey] || {};
const editMeta = editType[fieldKey] || {};

return {
  // From viewType.behavior (nested)
  visible: viewMeta.behavior?.visible ?? true,
  sortable: viewMeta.behavior?.sortable ?? false,
  filterable: viewMeta.behavior?.filterable ?? false,

  // From viewType.style (nested)
  width: viewMeta.style?.width,
  align: viewMeta.style?.align,
  emptyValue: viewMeta.style?.emptyValue,

  // From viewType (flat)
  renderType: viewMeta.renderType,
  label: viewMeta.label,

  // From editType.behavior (nested)
  editable: editMeta.behavior?.editable ?? false,

  // From editType (flat) - note: inputType NOT editType
  inputType: editMeta.inputType,
  component: editMeta.component,
  lookupSource: editMeta.lookupSource,
  lookupEntity: editMeta.lookupEntity,
  datalabelKey: editMeta.datalabelKey,
  validation: editMeta.validation,
  placeholder: editMeta.style?.placeholder,
  helpText: editMeta.style?.helpText,
};
```

### 6.3 Data Flow After Fix

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CORRECTED DATA FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  API Response                                                               │
│       │                                                                     │
│       ├─→ React Query Cache (RAW entity data)                              │
│       │        │                                                            │
│       │        └─→ select: formatDataset(data, metadata)                   │
│       │                       │                                             │
│       │                       └─→ Extract viewType for formatting          │
│       │                                │                                    │
│       │                                └─→ Use renderType, style.*         │
│       │                                         │                           │
│       │                                         └─→ FormattedRow[]         │
│       │                                                                     │
│       └─→ Zustand Store (metadata with 15m TTL)                            │
│                │                                                            │
│                └─→ Components read viewType/editType separately            │
│                         │                                                   │
│                         ├─→ View Mode: renderType, style, behavior         │
│                         └─→ Edit Mode: inputType, validation, lookup*      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Implementation Plan

### 7.1 Files to Change (Updated Priority Order)

| Priority | File | Change | Status |
|----------|------|--------|--------|
| **P0** | `formatters/types.ts` | Add `ViewFieldMetadata`, `EditFieldMetadata`, update `ComponentMetadata` | ⬜ Pending |
| **P0** | `formatters/datasetFormatter.ts` | Extract `viewType` from nested structure | ⬜ Pending |
| **P0** | `entityComponentMetadataStore.ts` | Update TypeScript interfaces | ⬜ Pending |
| **P0** | `useEntityQuery.ts` | Fix `select` callback to extract `viewType` | ⬜ Pending |
| **P1** | `EntityDataTable.tsx` | Read `viewType`/`editType` separately | ⬜ Pending |
| **P1** | `EntityFormContainer.tsx` | Read `editType` for forms | ⬜ Pending |
| **P2** | Backend: `_ID`/`_IDS` metadata | Fix or remove | ⬜ Pending |

### 7.2 Step 0: Fix Formatter Types (CRITICAL - Fix the Bug First)

**File:** `apps/web/src/lib/formatters/types.ts`

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// UPDATED TYPES - Match Real Backend Response
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ViewFieldMetadata - For display/rendering (from viewType)
 */
export interface ViewFieldMetadata {
  dtype: string;
  label: string;
  renderType: string;
  behavior: {
    visible: boolean;
    sortable: boolean;
    filterable: boolean;
    searchable: boolean;
    required?: boolean;
  };
  style: {
    width?: string;
    align?: 'left' | 'right' | 'center';
    bold?: boolean;
    monospace?: boolean;
    symbol?: string;
    decimals?: number;
    locale?: string;
    format?: string;
    emptyValue?: string;
    helpText?: string;
    truncate?: number;
    colorFromData?: boolean;
    linkToDetail?: boolean;
    linkToEntity?: boolean;
    displayField?: string;
    [key: string]: any;
  };
  component?: string;
}

/**
 * EditFieldMetadata - For input controls (from editType)
 */
export interface EditFieldMetadata {
  dtype: string;
  label: string;
  inputType: string;
  behavior: {
    editable: boolean;
  };
  style: {
    step?: number;
    rows?: number;
    placeholder?: string;
    helpText?: string;
    searchable?: boolean;
    clearable?: boolean;
    displayField?: string;
    [key: string]: any;
  };
  validation: {
    required?: boolean;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
  component?: string;
  lookupSource?: 'datalabel' | 'entityInstance';
  lookupEntity?: string;
  datalabelKey?: string;
}

/**
 * ComponentMetadata - Container for viewType and editType
 * This is what the backend sends for each component (entityDataTable, etc.)
 */
export interface ComponentMetadata {
  viewType: Record<string, ViewFieldMetadata>;
  editType: Record<string, EditFieldMetadata>;
}

/**
 * Legacy FieldMetadata - For backwards compatibility during migration
 * @deprecated Use ViewFieldMetadata or EditFieldMetadata instead
 */
export interface FieldMetadata {
  renderType?: string;
  inputType?: string;
  datalabelKey?: string;
  lookupSource?: 'datalabel' | 'entityInstance';
  lookupEntity?: string;
  symbol?: string;
  decimals?: number;
  label?: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  visible?: boolean;
  editable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
}

/**
 * Flat field metadata for formatters (extracted from viewType)
 * Used internally by formatDataset/formatRow
 */
export type FlatViewMetadata = Record<string, ViewFieldMetadata>;
```

### 7.3 Step 1: Fix datasetFormatter (CRITICAL)

**File:** `apps/web/src/lib/formatters/datasetFormatter.ts`

```typescript
import type { ViewFieldMetadata, ComponentMetadata, FormattedRow, FormattedValue } from './types';

// ═══════════════════════════════════════════════════════════════════════════
// FIXED: Extract viewType from component metadata
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract viewType from component metadata
 * Handles both nested { viewType, editType } and legacy flat structures
 */
function extractViewType(
  metadata: ComponentMetadata | Record<string, any> | null
): Record<string, ViewFieldMetadata> | null {
  if (!metadata) return null;

  // New structure: { viewType: {...}, editType: {...} }
  if ('viewType' in metadata && typeof metadata.viewType === 'object') {
    return metadata.viewType as Record<string, ViewFieldMetadata>;
  }

  // Legacy flat structure: { fieldName: {...} } - for backwards compatibility
  // Check if first key looks like a field name (not 'viewType' or 'editType')
  const keys = Object.keys(metadata);
  if (keys.length > 0 && !['viewType', 'editType'].includes(keys[0])) {
    console.warn('[formatters] Using legacy flat metadata structure');
    return metadata as Record<string, ViewFieldMetadata>;
  }

  return null;
}

/**
 * Format a single row using viewType metadata
 */
export function formatRow<T extends Record<string, any>>(
  row: T,
  metadata: ComponentMetadata | Record<string, any> | null
): FormattedRow<T> {
  const display: Record<string, string> = {};
  const styles: Record<string, string> = {};

  // FIXED: Extract viewType from nested structure
  const viewType = extractViewType(metadata);

  for (const [key, value] of Object.entries(row)) {
    const fieldMeta = viewType?.[key];

    // FIXED: Read renderType from viewType field metadata
    const renderType = fieldMeta?.renderType || 'text';
    const formatter = FORMATTERS[renderType] || formatText;

    // FIXED: Pass the full viewType field metadata for style access
    const formatted = formatter(value, fieldMeta);

    display[key] = formatted.display;
    if (formatted.style) {
      styles[key] = formatted.style;
    }
  }

  return { raw: row, display, styles };
}

/**
 * Format entire dataset using viewType metadata
 */
export function formatDataset<T extends Record<string, any>>(
  data: T[],
  metadata: ComponentMetadata | Record<string, any> | null
): FormattedRow<T>[] {
  if (!data || data.length === 0) {
    return [];
  }

  // FIXED: Extract viewType once for the entire dataset
  const viewType = extractViewType(metadata);

  console.log(`%c[FORMAT] Formatting ${data.length} rows`, 'color: #be4bdb; font-weight: bold', {
    hasViewType: !!viewType,
    fieldCount: viewType ? Object.keys(viewType).length : 0,
  });

  const startTime = performance.now();
  const result = data.map(row => formatRow(row, metadata));
  const duration = performance.now() - startTime;

  console.log(`%c[FORMAT] Formatted in ${duration.toFixed(2)}ms`, 'color: #be4bdb');

  return result;
}
```

### 7.4 Step 2: Update Zustand Store Types

**File:** `apps/web/src/stores/entityComponentMetadataStore.ts`

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// UPDATED TYPES (Match Real API Response)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ComponentMetadata - Contains viewType and editType containers
 */
export interface ComponentMetadata {
  viewType: Record<string, ViewFieldMetadata>;
  editType: Record<string, EditFieldMetadata>;
}

/**
 * ViewFieldMetadata - Display configuration (read-only rendering)
 */
export interface ViewFieldMetadata {
  dtype: string;
  label: string;
  renderType: string;
  behavior: {
    visible: boolean;
    sortable: boolean;
    filterable: boolean;
    searchable: boolean;
    required?: boolean;  // Display indicator (*)
  };
  style: {
    width?: string;
    align?: 'left' | 'right' | 'center';
    bold?: boolean;
    monospace?: boolean;
    symbol?: string;
    decimals?: number;
    locale?: string;
    format?: string;
    emptyValue?: string;    // What to show when null
    helpText?: string;      // Tooltip on hover
    [key: string]: any;
  };
  component?: string;
}

/**
 * EditFieldMetadata - Input configuration (edit mode)
 */
export interface EditFieldMetadata {
  dtype: string;
  label: string;
  inputType: string;
  behavior: {
    editable: boolean;
  };
  style: {
    step?: number;
    rows?: number;
    placeholder?: string;   // Input hint
    helpText?: string;      // Tooltip/help
    [key: string]: any;
  };
  validation: {
    required?: boolean;     // Form validation
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
  component?: string;
  lookupSource?: 'datalabel' | 'entityInstance';
  lookupEntity?: string;
  datalabelKey?: string;
}

/**
 * Full API metadata response
 */
export interface EntityApiMetadata {
  entityDataTable: ComponentMetadata;
  entityFormContainer: ComponentMetadata;
  kanbanView: ComponentMetadata;
}
```

### 7.3 Step 2: Update EntityDataTable

**File:** `apps/web/src/components/shared/ui/EntityDataTable.tsx`

```typescript
// Extract viewType and editType from component metadata
const componentMetadata = metadata?.entityDataTable as ComponentMetadata | undefined;
const viewType = componentMetadata?.viewType || {};
const editType = componentMetadata?.editType || {};

// Generate column config
const columns = fieldOrder
  .filter((fieldKey) => viewType[fieldKey]?.behavior?.visible !== false)
  .map((fieldKey) => {
    const viewMeta = viewType[fieldKey] || {};
    const editMeta = editType[fieldKey] || {};

    return {
      key: fieldKey,
      // From viewType
      title: viewMeta.label || humanize(fieldKey),
      renderType: viewMeta.renderType,
      sortable: viewMeta.behavior?.sortable ?? false,
      filterable: viewMeta.behavior?.filterable ?? false,
      width: viewMeta.style?.width,
      align: viewMeta.style?.align,
      symbol: viewMeta.style?.symbol,
      decimals: viewMeta.style?.decimals,
      emptyValue: viewMeta.style?.emptyValue,
      // From editType
      editable: editMeta.behavior?.editable ?? false,
      inputType: editMeta.inputType,
      lookupSource: editMeta.lookupSource,
      lookupEntity: editMeta.lookupEntity,
      datalabelKey: editMeta.datalabelKey,
      validation: editMeta.validation,
      placeholder: editMeta.style?.placeholder,
    };
  });
```

### 7.4 Step 3: Update EntityFormContainer

**File:** `apps/web/src/components/shared/entity/EntityFormContainer.tsx`

```typescript
// Extract viewType and editType for form
const componentMetadata = metadata?.entityFormContainer as ComponentMetadata | undefined;
const viewType = componentMetadata?.viewType || {};
const editType = componentMetadata?.editType || {};

// Generate form fields from editType (edit config drives forms)
const fields = Object.keys(editType)
  .filter(key => editType[key]?.behavior?.editable !== false)
  .map(fieldKey => {
    const editMeta = editType[fieldKey] || {};
    const viewMeta = viewType[fieldKey] || {};

    return {
      key: fieldKey,
      label: editMeta.label || viewMeta.label || humanize(fieldKey),
      inputType: editMeta.inputType,
      component: editMeta.component,
      lookupSource: editMeta.lookupSource,
      lookupEntity: editMeta.lookupEntity,
      datalabelKey: editMeta.datalabelKey,
      validation: editMeta.validation,
      placeholder: editMeta.style?.placeholder,
      helpText: editMeta.style?.helpText,
      required: editMeta.validation?.required,
    };
  });
```

### 7.5 Step 4: Update datasetFormatter

**File:** `apps/web/src/lib/formatters/datasetFormatter.ts`

```typescript
/**
 * Format dataset using viewType metadata only
 * (Edit metadata not needed for display formatting)
 */
export function formatDataset<T>(
  data: T[],
  componentMetadata: ComponentMetadata | null
): FormattedRow<T>[] {
  // Extract viewType - formatting only needs display config
  const viewType = componentMetadata?.viewType || {};
  return data.map(row => formatRow(row, viewType));
}

function formatRow<T>(
  row: T,
  viewType: Record<string, ViewFieldMetadata>
): FormattedRow<T> {
  const display: Record<string, string> = {};
  const styles: Record<string, string> = {};

  for (const [key, value] of Object.entries(row as Record<string, any>)) {
    const meta = viewType[key];

    if (!meta) {
      display[key] = value != null ? String(value) : '';
      continue;
    }

    // Handle null/empty values
    if (value == null || value === '') {
      display[key] = meta.style?.emptyValue || '';
      continue;
    }

    // Format based on renderType from viewType
    switch (meta.renderType) {
      case 'currency':
        display[key] = formatCurrency(value, meta.style);
        break;
      case 'date':
        display[key] = formatDate(value, meta.style);
        break;
      case 'timestamp':
        display[key] = formatTimestamp(value, meta.style);
        break;
      case 'boolean':
        display[key] = value ? (meta.style?.trueLabel || 'Yes')
                             : (meta.style?.falseLabel || 'No');
        break;
      case 'badge':
        // Badge styling applied via styles map
        display[key] = String(value);
        styles[key] = getBadgeStyles(value, meta.style);
        break;
      default:
        display[key] = String(value);
    }
  }

  return { raw: row, display, styles };
}
```

### 7.6 Step 5: Update useEntityQuery

**File:** `apps/web/src/lib/hooks/useEntityQuery.ts`

```typescript
// Store the FULL component metadata structure (viewType + editType)
if (result.metadata) {
  const componentName = normalizedParams.view || 'entityDataTable';
  const componentMetadata = (result.metadata as any)[componentName];

  // Verify structure before storing
  if (componentMetadata?.viewType || componentMetadata?.editType) {
    useEntityComponentMetadataStore.getState().setComponentMetadata(
      entityCode,
      componentName,
      componentMetadata  // Preserves { viewType, editType }
    );
  }
}
```

---

## 8. Testing & Verification

### 8.1 API Verification Commands

```bash
# Verify API structure has viewType/editType
./tools/test-api.sh GET "/api/v1/project?limit=1" | jq '.metadata.entityDataTable | keys'
# Expected: ["editType", "viewType"]

# Verify viewType field structure
./tools/test-api.sh GET "/api/v1/project?limit=1" | \
  jq '.metadata.entityDataTable.viewType.budget_allocated_amt'
# Expected: { "dtype": "float", "renderType": "currency", "behavior": {...}, "style": {...} }

# Verify editType field with lookup
./tools/test-api.sh GET "/api/v1/project?limit=1" | \
  jq '.metadata.entityDataTable.editType.dl__project_stage'
# Expected: { "inputType": "select", "lookupSource": "datalabel", ... }
```

### 8.2 Manual Testing Checklist

**EntityDataTable:**
- [ ] Columns render with correct labels from `viewType[field].label`
- [ ] Currency fields show `$200,000.00` format (2 decimals)
- [ ] Badge fields show colored pills with `colorFromData`
- [ ] Empty values show `emptyValue` from style
- [ ] Column widths match `style.width`

**Inline Edit:**
- [ ] Edit uses correct input types from `editType[field].inputType`
- [ ] Dropdown fields populate from `lookupSource`
- [ ] Validation applies from `editType[field].validation`
- [ ] Placeholder text shows from `style.placeholder`

**EntityFormContainer:**
- [ ] Form renders all editable fields
- [ ] DAGVisualizer renders for stage fields (`component: DAGVisualizer`)
- [ ] EntitySelect renders for entity references (`lookupEntity: employee`)
- [ ] Required indicator (*) shows for `validation.required: true`
- [ ] Help text shows on hover from `style.helpText`

**KanbanView:**
- [ ] Cards display only `behavior.visible: true` fields
- [ ] Drag-drop works correctly
- [ ] Status badges colored correctly

---

## 9. Changelog

### v3.2.0 (2025-11-25) - Zustand Store Bug Discovery

**CRITICAL BUG FOUND:** The formatter receives `{ viewType, editType }` but reads `metadata[field]` directly, resulting in `undefined` for all field metadata.

- Added Section 4.4: Zustand Store Deep Dive - The Hidden Bug
  - Documented current wrong type definitions in `entityComponentMetadataStore.ts`
  - Documented current wrong type definitions in `formatters/types.ts`
  - Showed how store is populated correctly but consumed incorrectly
  - Visual diagram of the data flow and where it breaks
  - Impact analysis (currency, dates, badges all broken)
  - Explained why it "appears to work" (fallback to 'text')
- Updated Section 7.1: Reordered files by priority
  - P0: `formatters/types.ts` - Fix types first
  - P0: `formatters/datasetFormatter.ts` - Extract viewType
  - P0: `entityComponentMetadataStore.ts` - Update store types
  - P0: `useEntityQuery.ts` - Fix select callback
- Added Section 7.2: Step 0 - Fix Formatter Types
  - Added `ViewFieldMetadata` interface
  - Added `EditFieldMetadata` interface
  - Updated `ComponentMetadata` to `{ viewType, editType }`
- Added Section 7.3: Step 1 - Fix datasetFormatter
  - Added `extractViewType()` helper function
  - Updated `formatRow()` and `formatDataset()` to extract viewType

### v3.1.0 (2025-11-25) - Frontend Architecture Context

- Added Section 2: Current State - Frontend Architecture
  - Documented React Query / Zustand architecture constraints
  - Explained format-at-read pattern and why it must be preserved
  - Showed state management flow diagram
- Added Section 3: Current State - Backend Format
  - Complete API response example with all field types
  - Explained why viewType/editType separation is needed
- Added Section 4: The Gap - What's Missing
  - Documented the three mismatches (path, nesting, naming)
  - Listed all files that need updating
- Reorganized document structure for clarity

### v3.0.0 (2025-11-25) - Comprehensive Rewrite

- Rewrote entire document with clearer problem statement
- Added detailed format comparison (backend vs frontend)
- Explained why mismatch exists (historical, mental model)
- Added industry best practices section
- Consolidated implementation plan with code examples
- Added testing verification section

### v2.1.0 (2025-11-25) - YAML Schema Updates

**Completed:** Backend YAML schema updates for `helpText`, `emptyValue`, and `required`.

| File | Changes |
|------|---------|
| `view-type-mapping.yaml` | Added `helpText`, `emptyValue`, `required` (display indicator) |
| `edit-type-mapping.yaml` | Added `helpText`, `placeholder` |

**Field definitions updated:**
- `name`: `emptyValue: "(untitled)"`, `helpText`, `required: true`
- `code`: `emptyValue: "—"`, `placeholder: "PROJ-001"`, `helpText`
- `email`: `placeholder: "user@example.com"`, `helpText`
- `currency`: `emptyValue: "$0.00"`, `placeholder: "0.00"`, `helpText`

### v2.0.0 (2025-11-25) - Initial Problem Analysis

- Documented the three mismatches (path, nesting, naming)
- Added backend metadata audit
- Identified `_ID`/`_IDS` metadata issues

---

## Quick Reference

### Property Location Summary

| Property | Location | Path |
|----------|----------|------|
| `visible` | viewType | `behavior.visible` |
| `sortable` | viewType | `behavior.sortable` |
| `width` | viewType | `style.width` |
| `renderType` | viewType | `renderType` (flat) |
| `emptyValue` | viewType | `style.emptyValue` |
| `editable` | editType | `behavior.editable` |
| `inputType` | editType | `inputType` (flat) |
| `validation` | editType | `validation.*` |
| `placeholder` | editType | `style.placeholder` |
| `helpText` | both | `style.helpText` |
| `lookupSource` | editType | `lookupSource` (flat) |
| `lookupEntity` | editType | `lookupEntity` (flat) |
| `datalabelKey` | editType | `datalabelKey` (flat) |

### Decision Tree for Dropdown Fields

```
if (editMeta.lookupSource === 'datalabel') {
  // Render DataLabelSelect
  // Load options from datalabelMetadataStore[editMeta.datalabelKey]
}
else if (editMeta.lookupSource === 'entityInstance') {
  // Render EntitySelect or EntityMultiSelect
  // Load options from /api/v1/${editMeta.lookupEntity}
}
else {
  // Render native input based on editMeta.inputType
}
```

---

**Status:** Ready for frontend implementation (Steps 1-5 in Section 6)
