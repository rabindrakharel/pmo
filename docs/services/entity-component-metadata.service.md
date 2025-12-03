# Entity Component Metadata Service

> Complete reference for field metadata generation, YAML pattern matching, and API response formatting. Backend is the single source of truth for all field rendering.

**Version**: 4.0.0
**Location**: `apps/api/src/services/entity-component-metadata.service.ts`
**Last Updated**: 2025-11-30
**Status**: Production Ready

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [End-to-End Data Flow](#end-to-end-data-flow)
3. [Pattern Detection System](#pattern-detection-system)
4. [Response Generation](#response-generation)
5. [Metadata Structure](#metadata-structure)
6. [Use Case Matrix](#use-case-matrix)
7. [API Reference](#api-reference)
8. [YAML Configuration](#yaml-configuration)
9. [Integration Patterns](#integration-patterns)
10. [Caching Layer](#caching-layer)

---

## Architecture Overview

### System Design Principle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BACKEND IS SINGLE SOURCE OF TRUTH                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────┐    ┌───────────────────┐    ┌───────────────────┐   │
│  │   DATABASE        │ →  │  BACKEND SERVICE  │ →  │   FRONTEND        │   │
│  │                   │    │                   │    │                   │   │
│  │  Column names     │    │  YAML patterns    │    │  Pure renderer    │   │
│  │  • budget_amt     │    │  • *_amt → $      │    │  • No detection   │   │
│  │  • dl__status     │    │  • dl__* → badge  │    │  • Consume only   │   │
│  │  • manager_id     │    │  • *_id → entity  │    │  • Render meta    │   │
│  └───────────────────┘    └───────────────────┘    └───────────────────┘   │
│                                                                              │
│  ANTI-PATTERN: Frontend pattern detection (parsing column names on client)  │
│  CORRECT: Frontend consumes metadata.viewType/editType from backend         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       BACKEND FORMATTER SERVICE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                         ENTRY POINTS                                     ││
│  ├─────────────────────────────────────────────────────────────────────────┤│
│  │                                                                          ││
│  │  generateEntityResponse()         Primary API for routes                 ││
│  │  ─────────────────────────        ────────────────────                   ││
│  │  • Accepts entity code + data     • Returns unified response             ││
│  │  • Handles metadata-only mode     • Builds ref_data from entity-infra    ││
│  │  • Caches metadata in Redis       • Supports all components              ││
│  │                                                                          ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                     │                                        │
│                                     ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                      METADATA GENERATION                                 ││
│  ├─────────────────────────────────────────────────────────────────────────┤│
│  │                                                                          ││
│  │  generateMetadataForComponents()   generateViewTypeMetadata()            ││
│  │  ───────────────────────────────   ──────────────────────────           ││
│  │  • For each component type         • YAML pattern matching               ││
│  │  • Generates viewType + editType   • Field-to-renderType mapping        ││
│  │  • entityListOfInstancesTable      • behavior + style generation        ││
│  │  • entityInstanceFormContainer                                           ││
│  │                                                                          ││
│  │  generateEditTypeMetadata()        detectFieldType()                     ││
│  │  ──────────────────────────        ─────────────────                    ││
│  │  • YAML pattern matching           • Column name → dtype                 ││
│  │  • Field-to-inputType mapping      • uuid, str, float, bool, etc.       ││
│  │  • lookupSourceTable detection     • Pattern-based detection             ││
│  │                                                                          ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                     │                                        │
│                                     ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                         YAML MAPPINGS                                    ││
│  ├─────────────────────────────────────────────────────────────────────────┤│
│  │                                                                          ││
│  │  pattern-mapping.yaml      view-type-mapping.yaml   edit-type-mapping.yaml
│  │  ────────────────────      ──────────────────────   ─────────────────────
│  │  • Column patterns         • renderType mappings    • inputType mappings ││
│  │  • dl__* → datalabel       • currency, badge, date  • text, select, date││
│  │  • *_amt → currency        • entityInstanceId       • entityInstanceId  ││
│  │  • *__*_id → entity ref    • behavior defaults      • validation rules  ││
│  │                                                                          ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## End-to-End Data Flow

### Normal Data Mode

```
┌──────────┐     ┌───────────────┐     ┌────────────────────┐     ┌──────────┐
│  Client  │     │ Route Handler │     │ Entity Component   │     │ Entity   │
│          │     │               │     │ Metadata Service   │     │ Infra    │
└────┬─────┘     └───────┬───────┘     └──────────┬─────────┘     └────┬─────┘
     │                   │                        │                    │
     │ GET /api/v1/project                        │                    │
     │──────────────────>│                        │                    │
     │                   │                        │                    │
     │                   │ Query PostgreSQL       │                    │
     │                   │ (full data query)      │                    │
     │                   │                        │                    │
     │                   │ build_ref_data_entityInstance(rows)         │
     │                   │─────────────────────────────────────────────>
     │                   │                        │                    │
     │                   │                        │     ref_data       │
     │                   │<─────────────────────────────────────────────
     │                   │                        │                    │
     │                   │ generateEntityResponse(entityCode, rows,    │
     │                   │   { ref_data_entityInstance })              │
     │                   │───────────────────────>│                    │
     │                   │                        │                    │
     │                   │     { data, ref_data_entityInstance,        │
     │                   │       fields: [], metadata: {} }            │
     │                   │<───────────────────────│                    │
     │                   │                        │                    │
     │ Response with data + ref_data              │                    │
     │<──────────────────│                        │                    │
```

### Metadata-Only Mode

> **v9.7.0 Note:** This mode is critical for the frontend's two-query architecture. For child entity tabs (e.g., `/project/:id/task`), the frontend fetches data and metadata separately:
> - **Data query**: `GET /api/v1/task?parent_entity_code=project&parent_entity_instance_id=:id` → returns `metadata: {}`
> - **Metadata query**: `GET /api/v1/task?content=metadata` → returns full metadata for rendering
>
> Data endpoints return `metadata: {}` by design to keep responses smaller. The frontend's `useEntityInstanceMetadata()` hook fetches metadata separately with 30-min caching.

```
┌──────────┐     ┌───────────────┐     ┌────────────────────┐     ┌──────────┐
│  Client  │     │ Route Handler │     │ Entity Component   │     │  Redis   │
│          │     │               │     │ Metadata Service   │     │          │
└────┬─────┘     └───────┬───────┘     └──────────┬─────────┘     └────┬─────┘
     │                   │                        │                    │
     │ GET /api/v1/project?content=metadata       │                    │
     │──────────────────>│                        │                    │
     │                   │                        │                    │
     │                   │ getCachedMetadataResponse()                 │
     │                   │─────────────────────────────────────────────>
     │                   │                        │                    │
     │                   │                        │     CACHE HIT      │
     │                   │<─────────────────────────────────────────────
     │                   │                        │                    │
     │ { data: [], fields: [...], metadata: {...} }                    │
     │<──────────────────│                        │                    │


                    CACHE MISS FLOW
                    ───────────────

     │ GET /api/v1/project?content=metadata       │                    │
     │──────────────────>│                        │                    │
     │                   │                        │                    │
     │                   │ getCachedMetadataResponse()                 │
     │                   │─────────────────────────────────────────────>
     │                   │                        │     null (MISS)    │
     │                   │<─────────────────────────────────────────────
     │                   │                        │                    │
     │                   │ Query: SELECT * FROM table WHERE 1=0       │
     │                   │ (instant - no data, just column metadata)   │
     │                   │                        │                    │
     │                   │ generateEntityResponse(entityCode, [],      │
     │                   │   { metadataOnly: true, resultFields })     │
     │                   │───────────────────────>│                    │
     │                   │                        │                    │
     │                   │   generateMetadataForComponents()           │
     │                   │   (YAML pattern matching)                   │
     │                   │                        │                    │
     │                   │     { data: [], fields, metadata }          │
     │                   │<───────────────────────│                    │
     │                   │                        │                    │
     │                   │ cacheMetadataResponse()                     │
     │                   │─────────────────────────────────────────────>
     │                   │                        │                    │
     │ { data: [], fields: [...], metadata: {...} }                    │
     │<──────────────────│                        │                    │
```

---

## Pattern Detection System

### Column Name → Field Type Mapping

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PATTERN DETECTION PIPELINE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Column Name                Pattern Match               Field Configuration │
│  ───────────                ─────────────               ─────────────────── │
│                                                                              │
│  budget_allocated_amt  ──>  *_amt                  ──>  dtype: float        │
│                                                         renderType: currency│
│                                                         inputType: number   │
│                                                         style: {symbol:'$'} │
│                                                                              │
│  dl__project_stage     ──>  dl__*                  ──>  dtype: str          │
│                                                         renderType: badge   │
│                                                         inputType: component│
│                                                         lookupSourceTable: datalabel
│                                                         lookupField: dl__project_stage
│                                                                              │
│  manager__employee_id  ──>  {label}__{entity}_id   ──>  dtype: uuid         │
│                                                         renderType: component
│                                                         component: EntityInstanceName
│                                                         inputType: EntityInstanceNameSelect
│                                                         lookupEntity: employee
│                                                         lookupSourceTable: entityInstance
│                                                                              │
│  business_id           ──>  {entity}_id            ──>  dtype: uuid         │
│                                                         renderType: component
│                                                         component: EntityInstanceName
│                                                         lookupEntity: business │
│                                                                              │
│  start_date            ──>  *_date                 ──>  dtype: date         │
│                                                         renderType: date    │
│                                                         inputType: date     │
│                                                                              │
│  created_ts            ──>  *_ts                   ──>  dtype: timestamp    │
│                                                         renderType: timestamp
│                                                         inputType: datetime │
│                                                                              │
│  is_active             ──>  is_*                   ──>  dtype: bool         │
│                                                         renderType: boolean │
│                                                         inputType: checkbox │
│                                                                              │
│  active_flag           ──>  *_flag                 ──>  dtype: bool         │
│                                                         renderType: boolean │
│                                                                              │
│  completion_pct        ──>  *_pct                  ──>  dtype: float        │
│                                                         renderType: percentage
│                                                                              │
│  tags                  ──>  tags                   ──>  dtype: array        │
│                                                         renderType: array   │
│                                                         inputType: tags     │
│                                                                              │
│  metadata              ──>  metadata               ──>  dtype: jsonb        │
│                                                         renderType: json    │
│                                                         inputType: json     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Pattern Detection Priority Order

| Priority | Pattern | Example | Detection Logic |
|----------|---------|---------|-----------------|
| 1 | `{label}__{entity}_ids` | `stakeholder__employee_ids` | Labeled multi-entity reference |
| 2 | `{label}__{entity}_id` | `manager__employee_id` | Labeled single entity reference |
| 3 | `{entity}_ids` | `tag_ids` | Simple multi-entity reference |
| 4 | `{entity}_id` | `business_id` | Simple single entity reference |
| 5 | `dl__*` | `dl__project_stage` | Datalabel dropdown |
| 6 | `*_amt`, `*_price`, `*_cost` | `budget_allocated_amt` | Currency field |
| 7 | `*_date` | `start_date` | Date field |
| 8 | `*_ts`, `*_at` | `created_ts`, `updated_at` | Timestamp field |
| 9 | `is_*`, `*_flag` | `is_active`, `active_flag` | Boolean field |
| 10 | `*_pct` | `completion_pct` | Percentage field |
| 11 | `tags` | `tags` | Tag array field |
| 12 | `metadata` | `metadata` | JSON field |
| 13 | `id`, `code`, `name`, `descr` | Standard fields | Text fields |
| 14 | Default | Any other | String text field |

### Entity Reference Pattern Details

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ENTITY REFERENCE PATTERNS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Pattern Type                Example                  Parsed Components      │
│  ────────────                ───────                  ─────────────────      │
│                                                                              │
│  LABELED SINGLE              manager__employee_id     label: "manager"       │
│  {label}__{entity}_id                                 entity: "employee"     │
│                                                       type: single           │
│                                                                              │
│  LABELED ARRAY               stakeholder__employee_ids label: "stakeholder" │
│  {label}__{entity}_ids                                entity: "employee"     │
│                                                       type: array            │
│                                                                              │
│  SIMPLE SINGLE               business_id              entity: "business"     │
│  {entity}_id                                          type: single           │
│                                                       label: (auto-gen)      │
│                                                                              │
│  SIMPLE ARRAY                tag_ids                  entity: "tag"          │
│  {entity}_ids                                         type: array            │
│                                                       label: (auto-gen)      │
│                                                                              │
│  ──────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  METADATA OUTPUT:                                                            │
│                                                                              │
│  manager__employee_id: {                                                     │
│    dtype: "uuid",                                                            │
│    label: "Manager Employee Name",  // label + entity + "Name"               │
│    renderType: "component",         // v9.8.0: component-based rendering     │
│    component: "EntityInstanceName", // v9.8.0: standardized component name   │
│    lookupEntity: "employee",                                                 │
│    lookupSourceTable: "entityInstance"  // v12.0.0: renamed from lookupSource│
│  }                                                                           │
│                                                                              │
│  stakeholder__employee_ids: {       // v9.8.0: Array reference               │
│    dtype: "array[uuid]",                                                     │
│    label: "Stakeholder Employees",                                           │
│    renderType: "component",                                                  │
│    component: "EntityInstanceNames", // Plural for arrays                    │
│    lookupEntity: "employee",                                                 │
│    lookupSourceTable: "entityInstance"  // v12.0.0: renamed from lookupSource│
│  }                                                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Response Generation

### generateEntityResponse() Flow

```typescript
// Primary entry point for all entity routes

export async function generateEntityResponse(
  entityCode: string,
  data: any[],
  options: {
    components?: ComponentName[];        // Default: ['entityListOfInstancesTable']
    total?: number;                       // For pagination
    limit?: number;
    offset?: number;
    resultFields?: Array<{ name: string }>;  // PostgreSQL column descriptors
    metadataOnly?: boolean;               // Skip data, return metadata only
    ref_data_entityInstance?: Record<string, Record<string, string>>;
  } = {}
): Promise<EntityResponse>
```

### Response Structure by Mode

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RESPONSE STRUCTURES                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  DATA MODE (content=undefined)           METADATA MODE (content=metadata)   │
│  ─────────────────────────────           ────────────────────────────────   │
│                                                                              │
│  {                                       {                                   │
│    data: [                                 data: [],                         │
│      { id, name, budget_amt, ... },                                         │
│      { id, name, budget_amt, ... }         fields: [                        │
│    ],                                        "id",                           │
│                                              "name",                         │
│    fields: [],                               "budget_allocated_amt",         │
│                                              "dl__project_stage",            │
│    metadata: {},                             "manager__employee_id"          │
│                                            ],                                │
│    ref_data_entityInstance: {                                               │
│      employee: {                           metadata: {                       │
│        "uuid-james": "James Miller"          entityListOfInstancesTable: {  │
│      },                                        viewType: { ... },           │
│      business: {                               editType: { ... }            │
│        "uuid-bus": "Huron Home"              }                               │
│      }                                       },                              │
│    },                                                                        │
│                                            ref_data_entityInstance: {},      │
│    total: 100,                                                               │
│    limit: 20,                              total: 0,                         │
│    offset: 0                               limit: 0,                         │
│  }                                         offset: 0                         │
│                                          }                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Metadata Structure

### viewType Schema

```typescript
interface ViewTypeMetadata {
  [fieldName: string]: {
    // Core type information
    dtype: 'uuid' | 'str' | 'int' | 'float' | 'bool' | 'date' | 'timestamp' | 'array' | 'jsonb';
    label: string;                    // Human-readable label
    renderType: RenderType;           // Component to use for rendering

    // Entity reference fields
    lookupEntity?: string;            // Entity code for lookups (e.g., 'employee')
    lookupSourceTable?: 'entityInstance' | 'datalabel';  // v12.0.0: renamed from lookupSource

    // Datalabel fields (v12.0.0: renamed from datalabelKey)
    lookupField?: string;             // Field name for datalabel lookup (e.g., 'dl__project_stage')

    // Behavior configuration
    behavior: {
      visible: boolean;               // Show in list/table view
      sortable: boolean;              // Allow column sorting
      filterable: boolean;            // Show in filter dropdown
      searchable: boolean;            // Include in search
    };

    // Style configuration (renderType-specific)
    style?: {
      symbol?: string;                // Currency symbol ('$')
      decimals?: number;              // Decimal places (2)
      align?: 'left' | 'center' | 'right';
      format?: string;                // Date/time format
    };
  };
}
```

### editType Schema

```typescript
interface EditTypeMetadata {
  [fieldName: string]: {
    // Core type information
    dtype: 'uuid' | 'str' | 'int' | 'float' | 'bool' | 'date' | 'timestamp' | 'array' | 'jsonb';
    label: string;
    inputType: InputType;             // Form input component to use

    // Entity reference fields
    lookupEntity?: string;
    lookupSourceTable?: 'entityInstance' | 'datalabel';  // v12.0.0: renamed from lookupSource

    // Datalabel fields (v12.0.0: renamed from datalabelKey)
    lookupField?: string;

    // Behavior configuration
    behavior: {
      editable: boolean;              // Can be edited
      required?: boolean;             // Validation required
      readonly?: boolean;             // Display-only in edit mode
    };

    // Validation rules
    validation?: {
      min?: number;                   // Minimum value
      max?: number;                   // Maximum value
      minLength?: number;             // String min length
      maxLength?: number;             // String max length
      pattern?: string;               // Regex pattern
    };
  };
}
```

### Full Metadata Response Example

```json
{
  "metadata": {
    "entityListOfInstancesTable": {
      "viewType": {
        "id": {
          "dtype": "uuid",
          "label": "Id",
          "renderType": "text",
          "behavior": { "visible": false, "sortable": false, "filterable": false, "searchable": false }
        },
        "name": {
          "dtype": "str",
          "label": "Name",
          "renderType": "text",
          "behavior": { "visible": true, "sortable": true, "filterable": true, "searchable": true }
        },
        "code": {
          "dtype": "str",
          "label": "Code",
          "renderType": "text",
          "behavior": { "visible": true, "sortable": true, "filterable": true, "searchable": true }
        },
        "budget_allocated_amt": {
          "dtype": "float",
          "label": "Budget Allocated",
          "renderType": "currency",
          "behavior": { "visible": true, "sortable": true, "filterable": false, "searchable": false },
          "style": { "symbol": "$", "decimals": 2, "align": "right" }
        },
        "dl__project_stage": {
          "dtype": "str",
          "label": "Project Stage",
          "renderType": "badge",
          "lookupField": "dl__project_stage",
          "behavior": { "visible": true, "sortable": false, "filterable": true, "searchable": false }
        },
        "manager__employee_id": {
          "dtype": "uuid",
          "label": "Manager Employee Name",
          "renderType": "component",
          "component": "EntityInstanceName",
          "lookupEntity": "employee",
          "lookupSourceTable": "entityInstance",
          "behavior": { "visible": true, "sortable": false, "filterable": true, "searchable": false }
        },
        "start_date": {
          "dtype": "date",
          "label": "Start Date",
          "renderType": "date",
          "behavior": { "visible": true, "sortable": true, "filterable": true, "searchable": false },
          "style": { "format": "MMM d, yyyy" }
        },
        "active_flag": {
          "dtype": "bool",
          "label": "Active",
          "renderType": "boolean",
          "behavior": { "visible": false, "sortable": false, "filterable": true, "searchable": false }
        },
        "created_ts": {
          "dtype": "timestamp",
          "label": "Created",
          "renderType": "timestamp",
          "behavior": { "visible": true, "sortable": true, "filterable": false, "searchable": false },
          "style": { "format": "MMM d, yyyy HH:mm" }
        }
      },
      "editType": {
        "name": {
          "dtype": "str",
          "label": "Name",
          "inputType": "text",
          "behavior": { "editable": true, "required": true },
          "validation": { "minLength": 1, "maxLength": 255 }
        },
        "code": {
          "dtype": "str",
          "label": "Code",
          "inputType": "text",
          "behavior": { "editable": true },
          "validation": { "maxLength": 50 }
        },
        "budget_allocated_amt": {
          "dtype": "float",
          "label": "Budget Allocated",
          "inputType": "number",
          "behavior": { "editable": true },
          "validation": { "min": 0 }
        },
        "dl__project_stage": {
          "dtype": "str",
          "label": "Project Stage",
          "inputType": "component",
          "component": "BadgeDropdownSelect",
          "lookupSourceTable": "datalabel",
          "lookupField": "dl__project_stage",
          "behavior": { "editable": true }
        },
        "manager__employee_id": {
          "dtype": "uuid",
          "label": "Manager Employee Name",
          "inputType": "EntityInstanceNameSelect",
          "lookupSourceTable": "entityInstance",
          "lookupEntity": "employee",
          "behavior": { "editable": true }
        },
        "start_date": {
          "dtype": "date",
          "label": "Start Date",
          "inputType": "date",
          "behavior": { "editable": true }
        }
      }
    }
  }
}
```

---

## Use Case Matrix

### Field Type Mapping Matrix

| Column Pattern | dtype | renderType | inputType | lookupSourceTable | Example |
|----------------|-------|------------|-----------|-------------------|---------|
| `id` | uuid | text | - | - | Primary key |
| `name` | str | text | text | - | Display name |
| `code` | str | text | text | - | Business code |
| `descr` | str | text | textarea | - | Description |
| `*_amt`, `*_price`, `*_cost` | float | currency | number | - | `budget_amt` |
| `*_date` | date | date | date | - | `start_date` |
| `*_ts`, `*_at` | timestamp | timestamp | datetime | - | `created_ts` |
| `is_*`, `*_flag` | bool | boolean | checkbox | - | `is_active` |
| `*_pct` | float | percentage | number | - | `completion_pct` |
| `dl__*` | str | badge | select | datalabel | `dl__status` |
| `{label}__{entity}_id` | uuid | component (EntityInstanceName) | EntityInstanceNameSelect | entityInstance | `manager__employee_id` |
| `{entity}_id` | uuid | component (EntityInstanceName) | EntityInstanceNameSelect | entityInstance | `business_id` |
| `{label}__{entity}_ids` | array | component (EntityInstanceNames) | EntityInstanceNameMultiSelect | entityInstance | `stakeholder__employee_ids` |
| `{entity}_ids` | array | component (EntityInstanceNames) | EntityInstanceNameMultiSelect | entityInstance | `tag_ids` |
| `tags` | array | array | tags | - | Tag array |
| `metadata` | jsonb | json | json | - | JSON object |

### Behavior Matrix by Field Type

| Field Type | visible | sortable | filterable | searchable | editable |
|------------|---------|----------|------------|------------|----------|
| `id` | false | false | false | false | false |
| `name` | true | true | true | true | true |
| `code` | true | true | true | true | true |
| `descr` | true | false | false | true | true |
| Currency (`*_amt`) | true | true | false | false | true |
| Date (`*_date`) | true | true | true | false | true |
| Timestamp (`*_ts`) | true | true | false | false | false |
| Boolean (`is_*`) | varies | false | true | false | true |
| `active_flag` | false | false | true | false | false |
| Datalabel (`dl__*`) | true | false | true | false | true |
| Entity ref (`*_id`) | true | false | true | false | true |
| Array (`*_ids`) | true | false | false | false | true |

---

## API Reference

### Core Functions

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// generateEntityResponse - Primary entry point for routes
// ═══════════════════════════════════════════════════════════════════════════

export async function generateEntityResponse(
  entityCode: string,
  data: any[],
  options?: {
    components?: ComponentName[];
    total?: number;
    limit?: number;
    offset?: number;
    resultFields?: Array<{ name: string }>;
    metadataOnly?: boolean;
    ref_data_entityInstance?: Record<string, Record<string, string>>;
  }
): Promise<EntityResponse>;

// Usage in routes:
const response = await generateEntityResponse('project', Array.from(projects), {
  total: count,
  limit,
  offset,
  ref_data_entityInstance
});

// ═══════════════════════════════════════════════════════════════════════════
// generateMetadataForComponents - Generate metadata for specific components
// ═══════════════════════════════════════════════════════════════════════════

export function generateMetadataForComponents(
  fieldNames: string[],
  components?: ComponentName[],
  entityCode?: string
): Record<ComponentName, ComponentMetadata>;

// Usage:
const metadata = generateMetadataForComponents(
  ['id', 'name', 'budget_amt', 'dl__status'],
  ['entityListOfInstancesTable', 'entityInstanceFormContainer'],
  'project'
);

// ═══════════════════════════════════════════════════════════════════════════
// detectFieldType - Determine dtype from column name
// ═══════════════════════════════════════════════════════════════════════════

export function detectFieldType(fieldName: string): FieldDType;

// Examples:
detectFieldType('id')                    // 'uuid'
detectFieldType('name')                  // 'str'
detectFieldType('budget_amt')            // 'float'
detectFieldType('start_date')            // 'date'
detectFieldType('created_ts')            // 'timestamp'
detectFieldType('is_active')             // 'bool'
detectFieldType('dl__status')            // 'str'
detectFieldType('manager__employee_id')  // 'uuid'
detectFieldType('metadata')              // 'jsonb'
```

### Cache Functions

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// Redis Metadata Response Cache
// ═══════════════════════════════════════════════════════════════════════════

export async function getCachedMetadataResponse(
  apiPath: string
): Promise<EntityResponse | null>;

export async function cacheMetadataResponse(
  apiPath: string,
  response: EntityResponse
): Promise<void>;

export async function invalidateMetadataCache(
  entityCode: string
): Promise<void>;

export async function clearAllMetadataCache(): Promise<void>;

// ═══════════════════════════════════════════════════════════════════════════
// Redis Field Name Cache
// ═══════════════════════════════════════════════════════════════════════════

export async function getCachedFieldNames(
  entityCode: string
): Promise<string[] | null>;

export async function cacheFieldNames(
  entityCode: string,
  fieldNames: string[]
): Promise<void>;

export async function invalidateFieldCache(
  entityCode: string
): Promise<void>;

export async function clearAllFieldCache(): Promise<void>;
```

---

## YAML Configuration

### pattern-mapping.yaml

```yaml
# Field pattern to type mapping
patterns:
  # Currency fields
  - pattern: "*_amt"
    dtype: float
    renderType: currency
    inputType: number
    style:
      symbol: "$"
      decimals: 2

  - pattern: "*_price"
    dtype: float
    renderType: currency
    inputType: number

  - pattern: "*_cost"
    dtype: float
    renderType: currency
    inputType: number

  # Date/Time fields
  - pattern: "*_date"
    dtype: date
    renderType: date
    inputType: date

  - pattern: "*_ts"
    dtype: timestamp
    renderType: timestamp
    inputType: datetime

  - pattern: "*_at"
    dtype: timestamp
    renderType: timestamp
    inputType: datetime

  # Boolean fields
  - pattern: "is_*"
    dtype: bool
    renderType: boolean
    inputType: checkbox

  - pattern: "*_flag"
    dtype: bool
    renderType: boolean
    inputType: checkbox

  # Datalabel dropdown
  - pattern: "dl__*"
    dtype: str
    renderType: badge
    inputType: component
    component: BadgeDropdownSelect
    lookupSourceTable: datalabel  # v12.0.0: renamed from lookupSource

  # Percentage
  - pattern: "*_pct"
    dtype: float
    renderType: percentage
    inputType: number

  # Special fields
  - pattern: "tags"
    dtype: array
    renderType: array
    inputType: tags

  - pattern: "metadata"
    dtype: jsonb
    renderType: json
    inputType: json
```

### view-type-mapping.yaml

```yaml
# RenderType to component mapping
renderTypes:
  text:
    component: TextRenderer
    defaultBehavior:
      visible: true
      sortable: true
      filterable: true
      searchable: true

  currency:
    component: CurrencyRenderer
    defaultBehavior:
      visible: true
      sortable: true
      filterable: false
      searchable: false
    defaultStyle:
      symbol: "$"
      decimals: 2
      align: right

  badge:
    component: BadgeRenderer
    defaultBehavior:
      visible: true
      sortable: false
      filterable: true
      searchable: false

  # v9.8.0: Entity references now use component-based rendering
  # For _ID fields: renderType: component, component: EntityInstanceName
  # For _IDS fields: renderType: component, component: EntityInstanceNames
  # Frontend components: EntityInstanceNameSelect, EntityInstanceNameMultiSelect

  date:
    component: DateRenderer
    defaultBehavior:
      visible: true
      sortable: true
      filterable: true
      searchable: false
    defaultStyle:
      format: "MMM d, yyyy"

  timestamp:
    component: TimestampRenderer
    defaultBehavior:
      visible: true
      sortable: true
      filterable: false
      searchable: false
    defaultStyle:
      format: "MMM d, yyyy HH:mm"

  boolean:
    component: BooleanRenderer
    defaultBehavior:
      visible: true
      sortable: false
      filterable: true
      searchable: false

  percentage:
    component: PercentageRenderer
    defaultBehavior:
      visible: true
      sortable: true
      filterable: false
      searchable: false
```

---

## Integration Patterns

### Route Handler Pattern

```typescript
// apps/api/src/modules/{entity}/routes.ts

import { generateEntityResponse, getCachedMetadataResponse, cacheMetadataResponse } from '@/services/entity-component-metadata.service.js';
import { getEntityInfrastructure, Permission } from '@/services/entity-infrastructure.service.js';
import { db, client } from '@/db/index.js';

const ENTITY_CODE = 'project';
const TABLE_ALIAS = 'e';
const entityInfra = getEntityInfrastructure(db);

export default async function projectRoutes(fastify: FastifyInstance) {
  fastify.get('/api/v1/project', async (request, reply) => {
    const { content, limit = 20, offset = 0, ...filters } = request.query;
    const userId = request.user.sub;

    // ═══════════════════════════════════════════════════════════════
    // METADATA-ONLY MODE
    // ═══════════════════════════════════════════════════════════════
    if (content === 'metadata') {
      const cacheKey = `/api/v1/${ENTITY_CODE}?content=metadata`;

      // Check Redis cache
      const cached = await getCachedMetadataResponse(cacheKey);
      if (cached) return reply.send(cached);

      // Query for column names only (instant - no data)
      const columnsResult = await client.unsafe(
        `SELECT * FROM app.${ENTITY_CODE} WHERE 1=0`
      );
      const resultFields = columnsResult.columns?.map((c: any) => ({ name: c.name })) || [];

      // Generate metadata
      const response = await generateEntityResponse(ENTITY_CODE, [], {
        metadataOnly: true,
        resultFields
      });

      // Cache for 24 hours
      await cacheMetadataResponse(cacheKey, response);

      return reply.send(response);
    }

    // ═══════════════════════════════════════════════════════════════
    // NORMAL DATA MODE
    // ═══════════════════════════════════════════════════════════════
    const rbacCondition = await entityInfra.get_entity_rbac_where_condition(
      userId, ENTITY_CODE, Permission.VIEW, TABLE_ALIAS
    );

    const projects = await db.execute(sql`
      SELECT ${TABLE_ALIAS}.* FROM app.${sql.raw(ENTITY_CODE)} ${sql.raw(TABLE_ALIAS)}
      WHERE ${rbacCondition} AND ${sql.raw(TABLE_ALIAS)}.active_flag = true
      ORDER BY ${sql.raw(TABLE_ALIAS)}.created_ts DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const ref_data_entityInstance = await entityInfra.build_ref_data_entityInstance(
      Array.from(projects)
    );

    const response = await generateEntityResponse(ENTITY_CODE, Array.from(projects), {
      total: count,
      limit,
      offset,
      ref_data_entityInstance
    });

    return reply.send(response);
  });
}
```

### Frontend Consumption Pattern

```typescript
// apps/web/src/lib/frontEndFormatterService.tsx

import { renderViewModeFromMetadata, renderEditModeFromMetadata } from '@/lib/frontEndFormatterService';

// The frontend is a PURE RENDERER - no pattern detection
function EntityCell({ value, fieldName, metadata, refData }) {
  const fieldMeta = metadata?.viewType?.[fieldName];

  if (!fieldMeta) {
    // Fallback to raw value if no metadata
    return <span>{String(value ?? '')}</span>;
  }

  // For entity references, resolve from ref_data_entityInstance
  // v9.8.0: Uses component-based rendering with EntityInstanceName/EntityInstanceNames
  if (fieldMeta.renderType === 'component' && fieldMeta.component === 'EntityInstanceName') {
    const displayName = refData?.[fieldMeta.lookupEntity]?.[value];
    return renderViewModeFromMetadata(displayName ?? value, fieldMeta);
  }

  // Use metadata to render - NO pattern detection on frontend
  return renderViewModeFromMetadata(value, fieldMeta);
}
```

---

## Caching Layer

### Cache Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CACHING LAYERS                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  LAYER 1: Redis Response Cache (Backend - 24h TTL)                          │
│  ─────────────────────────────────────────────────                          │
│  • Key: api:metadata:/api/v1/{entity}?content=metadata                      │
│  • Value: Complete EntityResponse JSON                                      │
│  • Purpose: Skip ALL backend processing on cache hit                        │
│                                                                              │
│  LAYER 2: Redis Field Name Cache (Backend - 24h TTL)                        │
│  ───────────────────────────────────────────────────                        │
│  • Key: entity:fields:{entityCode}                                          │
│  • Value: ["id", "name", "code", ...]                                       │
│  • Purpose: Fallback when data is empty                                     │
│                                                                              │
│  LAYER 3: TanStack Query Cache (Frontend - 30m staleTime)                   │
│  ─────────────────────────────────────────────────────                      │
│  • Key: [QUERY_KEYS.ENTITY_INSTANCE_METADATA, entityCode]                   │
│  • Value: { fields, viewType, editType }                                    │
│  • Access: import { useEntityMetadata } from '@/db/tanstack-index'          │
│  • Purpose: In-memory cache for current session                             │
│                                                                              │
│  LAYER 4: Dexie IndexedDB (Frontend - persistent)                           │
│  ─────────────────────────────────────────────────                          │
│  • Table: entityInstanceMetadata                                            │
│  • Key: entityCode                                                          │
│  • Access: import { db } from '@/db/tanstack-index'                         │
│  • Purpose: Offline-first, survives browser restart                         │
│                                                                              │
│  NOTE: All frontend cache imports from single entry point:                  │
│        import { ... } from '@/db/tanstack-index';                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Cache Flow Decision Tree

```
Metadata Request Arrives
│
├── Check Redis Response Cache
│   ├── HIT → Return cached response (0 DB queries, 0 processing)
│   │
│   └── MISS → Continue
│       │
│       ├── Query PostgreSQL with WHERE 1=0
│       │   └── Extract column names from postgres.js columns
│       │
│       ├── Generate metadata via YAML pattern matching
│       │
│       ├── Cache complete response in Redis (24h TTL)
│       │
│       └── Return response
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| Frontend pattern detection | Duplicates logic | Backend sends `lookupEntity` |
| Field name `_id` checking | Maintenance burden | Use `renderType === 'component'` + `component: 'EntityInstanceName'` |
| Hardcoded field configs | Maintenance burden | Use YAML mappings |
| Same metadata for all components | Limited flexibility | Component-specific viewType/editType |
| Per-row `_ID` embedded objects | N+1 performance | Use `ref_data_entityInstance` lookup table |

---

## Related Documentation

| Document | Path | Description |
|----------|------|-------------|
| Entity Metadata Caching | `docs/caching-backend/ENTITY_METADATA_CACHING.md` | Redis caching architecture |
| Entity Infrastructure Service | `docs/services/entity-infrastructure.service.md` | CRUD + ref_data_entityInstance |
| Frontend Formatter Service | `docs/services/frontend_datasetFormatter.md` | Frontend rendering (pure renderer) |
| Unified Cache Architecture | `docs/caching-frontend/NORMALIZED_CACHE_ARCHITECTURE.md` | TanStack Query + Dexie unified cache |
| State Management | `docs/state_management/STATE_MANAGEMENT.md` | Frontend state management overview |

---

**Document Version**: 4.2.0
**Last Updated**: 2025-12-01
**Status**: Production Ready

### Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-11-20 | Initial YAML pattern matching |
| 2.0.0 | 2025-11-25 | Added viewType/editType separation |
| 3.0.0 | 2025-11-28 | Added ref_data_entityInstance integration |
| 4.0.0 | 2025-11-30 | Complete rewrite with end-to-end architecture, cache integration |
| 4.1.0 | 2025-12-01 | Updated frontend cache references to unified tanstack-index.ts |
| 4.2.0 | 2025-12-01 | **v9.7.0 Note**: Added clarification that `content=metadata` mode is critical for frontend's two-query architecture. Child entity tabs fetch data + metadata separately (data endpoints return `metadata: {}` by design). |
| 4.3.0 | 2025-12-01 | **v9.8.0**: Standardized entity reference component naming - VIEW: `renderType: component` + `component: EntityInstanceName/EntityInstanceNames`, EDIT: `inputType: EntityInstanceNameSelect/EntityInstanceNameMultiSelect`. Removed legacy `entityInstanceId` renderType. |
