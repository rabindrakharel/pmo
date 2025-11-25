# Format-on-Read Metadata Coupling Plan

**Version:** 3.0.0 | **Date:** 2025-11-25 | **Status:** ✅ IMPLEMENTED

---

## Executive Summary

This plan couples the **backend API metadata response** to the **frontend UI** at both page and field levels. The frontend is "dumb" - it ONLY follows backend instructions from `viewType` and `editType` metadata.

**Key Principle:** Backend is single source of truth. Frontend has ZERO pattern detection.

---

## Naming Convention (v3.0.0)

| Layer | Container Name | Property Inside |
|-------|----------------|-----------------|
| View/Display | `viewType` | `renderType` |
| Edit/Input | `editType` | `inputType` |

**Example:**
```json
{
  "viewType": {
    "budget": { "renderType": "currency", ... }
  },
  "editType": {
    "budget": { "inputType": "number", ... }
  }
}
```

---

## Current State Analysis

### What Already Exists

| Component | Status | Location |
|-----------|--------|----------|
| pattern-mapping.yaml | ✅ Complete | `apps/api/src/services/` |
| view-type-mapping.yaml | ✅ Complete (70+ types) | `apps/api/src/services/` |
| edit-type-mapping.yaml | ✅ Complete (70+ types) | `apps/api/src/services/` |
| backend-formatter.service.ts | ✅ Complete | `apps/api/src/services/` |
| React Query (data cache) | ✅ Complete | `apps/web/src/lib/hooks/useEntityQuery.ts` |
| Zustand stores (metadata cache) | ✅ Complete (5 stores) | `apps/web/src/stores/` |
| formatDataset() | ✅ Complete | `apps/web/src/lib/formatters/datasetFormatter.ts` |
| renderEditModeFromMetadata() | ✅ Complete | `apps/web/src/lib/frontEndFormatterService.tsx` |

### Live API Response Samples

Full response samples are available in [samples/](./samples/):

| Entity | Sample File | Key Field Types |
|--------|-------------|-----------------|
| **Project** | [project-api-response.json](./samples/project-api-response.json) | currency, date, employee refs, datalabel stage |
| **Task** | [task-api-response.json](./samples/task-api-response.json) | hours, story points, priority, stage |
| **Office** | [office-api-response.json](./samples/office-api-response.json) | hierarchy level, parent ref, address |
| **Business** | [business-api-response.json](./samples/business-api-response.json) | industry sector, hierarchy level |

See [samples/README.md](./samples/README.md) for detailed field-type examples.

### API Response Structure (v3.0.0)

```json
{
  "data": [{ "budget_allocated_amt": 50000, "dl__project_stage": "Execution", ... }],
  "fields": ["id", "name", "budget_allocated_amt", "dl__project_stage", ...],
  "metadata": {
    "entityDataTable": {
      "viewType": {
        "budget_allocated_amt": {
          "dtype": "float",
          "label": "Budget Allocated",
          "renderType": "currency",
          "behavior": { "visible": true, "sortable": true, "filterable": true },
          "style": { "width": "140px", "align": "right", "symbol": "$", "decimals": 2 }
        },
        "dl__project_stage": {
          "dtype": "str",
          "label": "Project Stage",
          "renderType": "component",
          "component": "BadgeCell",
          "behavior": { "visible": true, "sortable": true, "filterable": true },
          "style": { "width": "140px", "colorFromData": true }
        }
      },
      "editType": {
        "budget_allocated_amt": {
          "dtype": "float",
          "label": "Budget Allocated",
          "inputType": "number",
          "behavior": { "editable": true },
          "style": { "symbol": "$", "step": 0.01 },
          "validation": { "min": 0 }
        },
        "dl__project_stage": {
          "dtype": "str",
          "label": "Project Stage",
          "inputType": "select",
          "component": "DataLabelSelect",
          "behavior": { "editable": true },
          "style": { "showColor": true, "searchable": true },
          "lookupSource": "datalabel",
          "datalabelKey": "dl__project_stage"
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

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                     FORMAT-ON-READ METADATA COUPLING ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌───────────────────────────────────────────────────────────────────────────────┐  │
│  │                              BACKEND (apps/api)                                │  │
│  ├───────────────────────────────────────────────────────────────────────────────┤  │
│  │                                                                                │  │
│  │  Column Name (e.g., "budget_allocated_amt")                                    │  │
│  │         │                                                                      │  │
│  │         ▼                                                                      │  │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐  │  │
│  │  │  STEP 1: pattern-mapping.yaml                                           │  │  │
│  │  │  ─────────────────────────────                                          │  │  │
│  │  │  Question: "What BUSINESS TYPE is this field?"                          │  │  │
│  │  │                                                                         │  │  │
│  │  │  Input:  "budget_allocated_amt"                                         │  │  │
│  │  │  Match:  "*_amt" pattern                                                │  │  │
│  │  │  Output: fieldBusinessType = "currency"                                 │  │  │
│  │  └─────────────────────────────────────────────────────────────────────────┘  │  │
│  │         │                                                                      │  │
│  │         ├──────────────────────────────────┬───────────────────────────────┐  │  │
│  │         ▼                                  ▼                               │  │  │
│  │  ┌─────────────────────────────┐   ┌─────────────────────────────┐        │  │  │
│  │  │  STEP 2a: view-type-        │   │  STEP 2b: edit-type-        │        │  │  │
│  │  │  mapping.yaml               │   │  mapping.yaml               │        │  │  │
│  │  │  ─────────────────────────  │   │  ─────────────────────────  │        │  │  │
│  │  │  Question: "How to DISPLAY  │   │  Question: "How to EDIT     │        │  │  │
│  │  │  this field?"               │   │  this field?"               │        │  │  │
│  │  │                             │   │                             │        │  │  │
│  │  │  Output per component:      │   │  Output per component:      │        │  │  │
│  │  │  • renderType               │   │  • inputType                │        │  │  │
│  │  │  • component (optional)     │   │  • component (optional)     │        │  │  │
│  │  │  • behavior                 │   │  • behavior                 │        │  │  │
│  │  │  • style                    │   │  • style                    │        │  │  │
│  │  │                             │   │  • validation               │        │  │  │
│  │  │                             │   │  • lookupSource             │        │  │  │
│  │  └─────────────────────────────┘   └─────────────────────────────┘        │  │  │
│  │                                                                            │  │  │
│  │  backend-formatter.service.ts → generateEntityResponse()                   │  │  │
│  │                                                                            │  │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │  │
│                                    │                                              │  │
│                                    ▼ HTTP Response                                │  │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │  │
│  │                            FRONTEND (apps/web)                              │  │  │
│  ├────────────────────────────────────────────────────────────────────────────┤  │  │
│  │                                                                             │  │  │
│  │  ┌─────────────────────────────────────────────────────────────────────┐   │  │  │
│  │  │  EXISTING: React Query Cache (RAW Data Only)                        │   │  │  │
│  │  │  ───────────────────────────────────────────                        │   │  │  │
│  │  │  useFormattedEntityList(entityCode, params)                         │   │  │  │
│  │  │  • queryFn: fetch API → cache RAW data + metadata                   │   │  │  │
│  │  │  • select: formatDataset(raw, metadata.viewType) → FormattedRow[]   │   │  │  │
│  │  │  • React Query memoizes select (zero re-formats on scroll)          │   │  │  │
│  │  └─────────────────────────────────────────────────────────────────────┘   │  │  │
│  │                                    │                                        │  │  │
│  │                                    ▼                                        │  │  │
│  │  ┌─────────────────────────────────────────────────────────────────────┐   │  │  │
│  │  │  FIELD-LEVEL COUPLING                                                │   │  │  │
│  │  │  ────────────────────────────────────────                            │   │  │  │
│  │  │                                                                      │   │  │  │
│  │  │  VIEW MODE: formatDataset() → FormattedRow[]                         │   │  │  │
│  │  │  ─────────────────────────────────────────                           │   │  │  │
│  │  │  • Reads metadata.viewType[field].renderType                         │   │  │  │
│  │  │  • Looks up formatter from registry: formatters[renderType]          │   │  │  │
│  │  │  • Applies style options: symbol, decimals, format, locale           │   │  │  │
│  │  │  • Returns: { display: string, styles: string }                      │   │  │  │
│  │  │                                                                      │   │  │  │
│  │  │  EDIT MODE: renderEditModeFromMetadata()                             │   │  │  │
│  │  │  ─────────────────────────────────────────                           │   │  │  │
│  │  │  • Reads metadata.editType[field].inputType                          │   │  │  │
│  │  │  • If inputType=select|component → uses editType.component           │   │  │  │
│  │  │  • If inputType=HTML5 (text,number,date) → native <input>            │   │  │  │
│  │  │  • Applies style options: symbol, step, mask                         │   │  │  │
│  │  │  • Applies validation: required, min, max, pattern                   │   │  │  │
│  │  │  • For lookups: uses lookupSource + datalabelKey/lookupEntity        │   │  │  │
│  │  │                                                                      │   │  │  │
│  │  └─────────────────────────────────────────────────────────────────────┘   │  │  │
│  │                                                                             │  │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │  │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Files Modified (v3.0.0)

### Backend

| File | Changes |
|------|---------|
| `apps/api/src/services/backend-formatter.service.ts` | Interface: `ViewMetadata.renderType`, `EditMetadata.inputType` |

### Frontend

| File | Changes |
|------|---------|
| `apps/web/src/lib/formatters/types.ts` | `renderType?: string`, `inputType?: string` |
| `apps/web/src/lib/formatters/datasetFormatter.ts` | Uses `metadata?.renderType` |
| `apps/web/src/lib/api-factory.ts` | `renderType: string`, `inputType: string` |
| `apps/web/src/lib/frontEndFormatterService.tsx` | Uses `metadata.inputType` |

---

## Part 1: Page-Level Metadata Coupling

### 1.1 Component → Metadata Key Mapping

Each page/view component uses a specific metadata key from the API response:

| Page/View | Component Key | viewType Usage | editType Usage |
|-----------|---------------|----------------|----------------|
| EntityListOfInstancesPage | `entityDataTable` | Column rendering | Inline edit |
| EntitySpecificInstancePage | `entityFormContainer` | Field display | Field editing |
| EntityFormPage | `entityFormContainer` | N/A (edit only) | Form inputs |
| KanbanView | `kanbanView` | Card field display | Card quick edit |
| GridView | `gridView` | Card field display | Card quick edit |
| CalendarView | `calendarView` | Event rendering | Event editing |
| DAGVisualizer | `dagView` | Node rendering | Node editing |

### 1.2 Metadata Resolution Flow

```typescript
// apps/web/src/lib/hooks/useEntityQuery.ts

// 1. Fetch API → Cache RAW data + metadata
const queryFn = async () => {
  const response = await api.get(`/api/v1/${entityCode}`, { params });
  return response; // { data, metadata, total, fields }
};

// 2. Format-at-read via select (memoized by React Query)
const selectFormatted = (raw: EntityInstanceListResult) => {
  // Get component-specific metadata
  const componentMeta = raw.metadata?.[mappedView]; // e.g., 'entityDataTable'

  // Format using viewType metadata (reads renderType property)
  const formattedData = formatDataset(raw.data, componentMeta?.viewType);

  return {
    ...raw,
    formattedData,
    viewMetadata: componentMeta?.viewType,
    editMetadata: componentMeta?.editType,
  };
};
```

---

## Part 2: Field-Level Metadata Coupling

### 2.1 View Mode: Formatter Registry

The formatter registry maps `renderType` to formatting functions:

```typescript
// apps/web/src/lib/formatters/datasetFormatter.ts

export function formatValue(
  value: any,
  key: string,
  metadata: FieldMetadata | undefined
): FormattedValue {
  const renderType = metadata?.renderType || 'text';
  const formatter = FORMATTERS[renderType] || formatText;
  return formatter(value, metadata);
}
```

### 2.2 Edit Mode: Input Renderer

```typescript
// apps/web/src/lib/frontEndFormatterService.tsx

export function renderEditModeFromMetadata(
  value: any,
  metadata: FieldMetadata,
  onChange: (value: any) => void
): React.ReactElement {
  // Render based on backend-specified inputType
  switch (metadata.inputType) {
    case 'currency':
    case 'number':
      return (
        <DebouncedInput
          type="number"
          step={metadata.inputType === 'currency' ? '0.01' : '1'}
          value={value ?? ''}
          onChange={(val) => onChange(val ? parseFloat(val) : null)}
          // ...
        />
      );
    case 'select':
      // ... select component
    case 'date':
      // ... date input
    // ... other types
  }
}
```

---

## Appendix A: Actual Field Type Examples (from Live API)

### A.1 Currency Fields

**Source:** `project-api-response.json` - `budget_allocated_amt`

```json
// Data
"budget_allocated_amt": 200000

// viewType (how to DISPLAY)
{
  "dtype": "float",
  "label": "Budget Allocated",
  "renderType": "currency",
  "behavior": { "visible": true, "sortable": true, "filterable": true, "searchable": false },
  "style": { "width": "140px", "align": "right", "symbol": "$", "decimals": 2, "locale": "en-CA" }
}

// editType (how to EDIT)
{
  "dtype": "float",
  "label": "Budget Allocated",
  "inputType": "number",
  "behavior": { "editable": true },
  "style": { "symbol": "$", "step": 0.01 },
  "validation": { "min": 0 }
}

// Frontend renders:
// VIEW: "$200,000.00" (right-aligned, formatted)
// EDIT: <input type="number" step="0.01" min="0" /> with "$" prefix
```

### A.2 Datalabel/Badge Fields

**Source:** `project-api-response.json` - `dl__project_stage`

```json
// Data
"dl__project_stage": "Execution"

// viewType
{
  "dtype": "str",
  "label": "Project Stage",
  "renderType": "badge",
  "behavior": { "visible": true, "sortable": true, "filterable": true, "searchable": false },
  "style": { "width": "140px", "align": "left", "colorFromData": true }
}

// editType
{
  "dtype": "str",
  "label": "Project Stage",
  "inputType": "select",
  "component": "DataLabelSelect",
  "behavior": { "editable": true },
  "style": { "showColor": true, "searchable": true },
  "validation": {},
  "lookupSource": "datalabel",
  "datalabelKey": "dl__project_stage"
}

// Frontend renders:
// VIEW: Colored badge with color from datalabelMetadataStore
// EDIT: <DataLabelSelect> dropdown loading options from datalabelMetadataStore
```

### A.3 Entity Reference Fields

**Source:** `project-api-response.json` - `manager__employee_id`

```json
// Data
"manager__employee_id": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13"

// viewType
{
  "dtype": "uuid",
  "label": "Manager",
  "renderType": "entityLink",
  "behavior": { "visible": true, "sortable": true, "filterable": true },
  "style": { "width": "150px", "align": "left", "displayField": "name", "linkToEntity": true }
}

// editType
{
  "dtype": "uuid",
  "label": "Manager",
  "inputType": "select",
  "component": "EntitySelect",
  "behavior": { "editable": true },
  "style": { "searchable": true, "clearable": true },
  "lookupSource": "entityInstance",
  "lookupEntity": "employee"
}

// Frontend renders:
// VIEW: "James Miller" (linked to /employee/{id}) from _ID lookup
// EDIT: <EntitySelect> dropdown fetching from /api/v1/employee
```

---

## Summary

This plan establishes **strict metadata-driven UI** where:

1. **Backend generates complete metadata** using existing YAML mappings
2. **Frontend consumes metadata blindly** - ZERO pattern detection
3. **Naming Convention:**
   - Container names: `viewType`, `editType`
   - Property names: `renderType`, `inputType`
4. **Page-level coupling**: Each page maps to a specific metadata key
5. **Field-level coupling**:
   - View mode: `formatDataset(data, viewType)` reads `renderType`
   - Edit mode: `renderEditModeFromMetadata(value, editType)` reads `inputType`

The frontend is a pure renderer that:
- Reads `viewType[field].renderType` → calls formatter from registry
- Reads `editType[field].inputType` + `component` → renders input
- ZERO business logic about field types - all intelligence is in backend YAML

---

## Change Log

| Version | Date | Changes |
|---------|------|---------|
| 3.0.0 | 2025-11-25 | Fixed naming: `renderType`/`inputType` inside containers |
| 2.0.0 | 2025-11-25 | Added existing infrastructure, API samples |
| 1.0.0 | 2025-11-25 | Initial plan |
