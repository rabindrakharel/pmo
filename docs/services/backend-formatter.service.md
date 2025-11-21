# Backend Formatter Service

**Version:** 5.0.0 | **Location:** `apps/api/src/services/backend-formatter.service.ts`

---

## Semantics

The Backend Formatter Service generates field metadata from database column names using 35+ pattern detection rules. It is the **single source of truth** for all rendering decisions in the PMO platform.

**Core Principle:** Backend controls ALL field rendering logic. Frontend executes backend instructions exactly.

---

## System Design Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     BACKEND FORMATTER SERVICE                            │
│                   (Single Source of Truth)                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐      │
│  │   Database   │───>│ Pattern Detection │───>│ Field Metadata   │      │
│  │   Columns    │    │   (35+ Rules)     │    │   Generation     │      │
│  └──────────────┘    └──────────────────┘    └──────────────────┘      │
│         │                     │                        │                 │
│         │                     │                        v                 │
│         │            ┌────────────────────────────────────────┐         │
│         │            │        Component Visibility             │         │
│         │            │  ┌─────────────┬─────────────────────┐ │         │
│         │            │  │EntityDataTable│EntityFormContainer│ │         │
│         │            │  │  KanbanView  │ EntityDetailView   │ │         │
│         │            │  │ CalendarView │                    │ │         │
│         │            │  └─────────────┴─────────────────────┘ │         │
│         │            └────────────────────────────────────────┘         │
│         │                              │                                 │
│         v                              v                                 │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │                    API RESPONSE                              │       │
│  │  { data: [...], metadata: { fields: [...] }, datalabels }   │       │
│  └─────────────────────────────────────────────────────────────┘       │
│                              │                                          │
└──────────────────────────────│──────────────────────────────────────────┘
                               v
                    ┌──────────────────┐
                    │   Frontend       │
                    │ (Pure Renderer)  │
                    └──────────────────┘
```

---

## Data Flow Diagram

```
Database Column              Pattern Detection              Generated Metadata
─────────────────            ─────────────────              ─────────────────────

total_amt          ───>      *_amt pattern       ───>       renderType: 'currency'
                                                            inputType: 'currency'
                                                            format: { symbol: '$' }

dl__project_stage  ───>      dl__* pattern       ───>       renderType: 'badge'
                                                            inputType: 'select'
                                                            loadFromDataLabels: true

start_date         ───>      *_date pattern      ───>       renderType: 'date'
                                                            inputType: 'date'

is_active          ───>      is_* pattern        ───>       renderType: 'boolean'
                                                            inputType: 'checkbox'

manager__employee_id ───>    *__*_id pattern     ───>       renderType: 'reference'
                                                            loadFromEntity: 'employee'
```

---

## Architecture Overview

### Core Functions

| Function | Purpose |
|----------|---------|
| `generateEntityResponse()` | Creates complete API response with metadata for requested components |
| `getEntityMetadata()` | Generates field metadata from entity data |
| `detectFieldType()` | Applies 35+ pattern rules to column names |
| `extractDatalabelKeys()` | Extracts datalabel field keys from metadata |
| `fetchDatalabels()` | Fetches datalabel options from database |

### Pattern Detection Rules (35+)

| Pattern | renderType | inputType | Additional Config |
|---------|------------|-----------|-------------------|
| `*_amt`, `*_price`, `*_cost` | currency | currency | format.symbol, format.decimals |
| `dl__*` | badge | select | loadFromDataLabels: true |
| `*_date` | date | date | - |
| `*_ts`, `*_at` | timestamp | datetime | - |
| `is_*`, `*_flag` | boolean | checkbox | - |
| `*__employee_id` | reference | select | loadFromEntity extracted |
| `*__project_id` | reference | select | loadFromEntity extracted |
| `*_pct` | percentage | number | format.suffix: '%' |
| `*_qty` | number | number | - |
| `metadata` | json | json | component: 'MetadataTable' |
| `*_url`, `*_link` | link | text | - |
| `color_code` | color | color | - |
| `s3_key`, `file_path` | file | file | - |

---

## Tooling Overview

### Usage in Route Handlers

```typescript
// Standard LIST endpoint pattern
import { generateEntityResponse, extractDatalabelKeys, fetchDatalabels } from '@/services/backend-formatter.service.js';

const response = generateEntityResponse(ENTITY_CODE, entities, {
  components: requestedComponents,
  total, limit, offset
});

const datalabelKeys = extractDatalabelKeys(response.metadata);
if (datalabelKeys.length > 0) {
  response.datalabels = await fetchDatalabels(db, datalabelKeys);
}

return response;
```

### Component-Aware Metadata

The `view` query parameter controls which components receive metadata:

| Parameter Value | Components Included |
|-----------------|---------------------|
| `entityDataTable` | Table columns, sorting, filtering |
| `entityFormContainer` | Form fields, validation |
| `kanbanView` | Card fields, grouping |
| `entityDetailView` | Detail page fields |
| `calendarView` | Calendar event fields |

---

## Database/API/UI Mapping

### Field Visibility Matrix

| Field Pattern | EntityDataTable | EntityFormContainer | KanbanView | EntityDetailView |
|---------------|-----------------|---------------------|------------|------------------|
| `id` | hidden | hidden | hidden | hidden |
| `code` | visible | visible | visible | visible |
| `name` | visible | visible | visible (title) | visible |
| `*_amt` | visible (right-align) | visible | visible | visible |
| `dl__*_stage` | visible (badge) | visible (select) | groupBy field | visible (DAG) |
| `metadata` | hidden | visible | hidden | visible |
| `created_ts` | visible | readonly | hidden | visible |
| `active_flag` | hidden | visible | hidden | visible |

### API Response Structure

The API returns a comprehensive response with component-aware metadata:

```json
{
  "data": [
    {
      "id": "50192aab-000a-17c5-6904-1065b04a0a0b",
      "code": "CSE-2024-001",
      "name": "Customer Service Excellence Initiative",
      "dl__project_stage": "Execution",
      "budget_allocated_amt": 200000,
      "budget_spent_amt": 80000,
      "planned_start_date": "2024-08-01T00:00:00.000Z",
      "manager__employee_id": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13",
      "_ID": {
        "manager": {
          "entity_code": "employee",
          "manager__employee_id": "8260b1b0-...",
          "manager": "James Miller"
        }
      }
    }
  ],
  "fields": ["id", "code", "name", "dl__project_stage", "budget_allocated_amt", "..."],
  "metadata": {
    "entityDataTable": {
      "budget_allocated_amt": {
        "dtype": "float",
        "format": "currency",
        "viewType": "currency",
        "editType": "currency",
        "currencySymbol": "$",
        "decimals": 2,
        "locale": "en-CA",
        "visible": true,
        "editable": true,
        "filterable": true,
        "sortable": true,
        "align": "right",
        "width": "140px",
        "label": "Budget Allocated"
      },
      "dl__project_stage": {
        "dtype": "str",
        "format": "datalabel_lookup",
        "viewType": "badge",
        "editType": "select",
        "datalabelKey": "dl__project_stage",
        "visible": true,
        "editable": true,
        "label": "Project Stage"
      },
      "manager__employee_id": {
        "dtype": "uuid",
        "format": "reference",
        "viewType": "text",
        "editType": "select",
        "loadFromEntity": "employee",
        "endpoint": "/api/v1/entity/employee/entity-instance-lookup",
        "displayField": "name",
        "valueField": "id",
        "visible": true,
        "editable": true,
        "label": "Manager Employee Name"
      }
    },
    "entityFormContainer": {
      "budget_allocated_amt": {
        "dtype": "float",
        "format": "currency",
        "viewType": "currency",
        "editType": "currency",
        "currencySymbol": "$",
        "decimals": 2,
        "placeholder": "0.00",
        "visible": true,
        "editable": true,
        "label": "Budget Allocated"
      },
      "dl__project_stage": {
        "dtype": "str",
        "format": "datalabel_lookup",
        "viewType": "dag",
        "editType": "select",
        "datalabelKey": "dl__project_stage",
        "visible": true,
        "editable": true,
        "label": "Project Stage"
      }
    }
  },
  "datalabels": [
    {
      "name": "dl__project_stage",
      "options": [
        { "id": 0, "name": "Initiation", "parent_id": null, "color_code": "blue", "sort_order": 0 },
        { "id": 1, "name": "Planning", "parent_id": 0, "color_code": "purple", "sort_order": 1 },
        { "id": 2, "name": "Execution", "parent_id": 1, "color_code": "yellow", "sort_order": 2 },
        { "id": 3, "name": "Monitoring", "parent_id": 2, "color_code": "orange", "sort_order": 3 },
        { "id": 4, "name": "Closure", "parent_id": 3, "color_code": "green", "sort_order": 4 }
      ]
    }
  ],
  "globalSettings": {
    "currency": { "symbol": "$", "decimals": 2, "locale": "en-CA", "position": "prefix" },
    "date": { "format": "MM/DD/YYYY", "locale": "en-US", "style": "short" },
    "timestamp": { "style": "datetime", "locale": "en-US", "includeSeconds": false },
    "boolean": { "trueLabel": "Yes", "falseLabel": "No", "trueColor": "green", "falseColor": "gray" }
  },
  "total": 5,
  "limit": 20,
  "offset": 0
}
```

### Response Properties

| Property | Type | Description |
|----------|------|-------------|
| `data` | `Array` | Entity instances with resolved references (`_ID`, `_IDS`) |
| `fields` | `string[]` | Ordered list of field names from database |
| `metadata` | `Object` | Component-keyed field metadata (see below) |
| `datalabels` | `Array` | Dropdown options for `dl__*` fields with DAG structure |
| `globalSettings` | `Object` | Global formatting config (currency, date, timestamp, boolean) |
| `total` | `number` | Total record count (for pagination) |
| `limit` | `number` | Page size |
| `offset` | `number` | Page offset |

### Metadata Structure

Metadata is **component-keyed** - each component gets its own field configuration:

```typescript
metadata: {
  entityDataTable: { [fieldKey]: FieldMetadata },     // Table view
  entityFormContainer: { [fieldKey]: FieldMetadata }, // Form view
  entityDetailView: { [fieldKey]: FieldMetadata },    // Detail view
  kanbanView: { [fieldKey]: FieldMetadata }           // Kanban view
}
```

### Field Metadata Properties

| Property | Type | Description |
|----------|------|-------------|
| `dtype` | `string` | Data type: `str`, `float`, `int`, `bool`, `uuid`, `date`, `timestamp`, `jsonb`, `array[uuid]` |
| `format` | `string` | Format hint: `text`, `currency`, `date:YYYY-MM-DD`, `timestamp-relative`, `datalabel_lookup`, `reference`, `json` |
| `viewType` | `string` | View renderer: `text`, `currency`, `date`, `timestamp`, `badge`, `boolean`, `json`, `dag` |
| `editType` | `string` | Edit renderer: `text`, `textarea`, `currency`, `date`, `select`, `multiselect`, `checkbox`, `readonly` |
| `visible` | `boolean` | Show in this component |
| `editable` | `boolean` | Allow editing |
| `filterable` | `boolean` | Show in filter UI |
| `sortable` | `boolean` | Allow column sorting |
| `label` | `string` | Human-readable label |
| `width` | `string` | Column width (e.g., `140px`, `auto`) |
| `align` | `string` | Text alignment: `left`, `center`, `right` |
| `datalabelKey` | `string` | For `dl__*` fields - key to lookup in `datalabels` array |
| `loadFromEntity` | `string` | For reference fields - entity code for lookup |
| `endpoint` | `string` | API endpoint for dropdown options |
| `currencySymbol` | `string` | Currency symbol (e.g., `$`) |
| `decimals` | `number` | Decimal places for currency |
| `dateFormat` | `string` | Date format string |

---

## User Interaction Flow

```
1. User navigates to /project
   │
2. Frontend requests GET /api/v1/project?view=entityDataTable,kanbanView
   │
3. Backend Route Handler
   ├── Executes database query
   ├── Calls generateEntityResponse() with component list
   ├── Extracts datalabel keys from metadata
   └── Fetches datalabel options from database
   │
4. Backend returns { data, metadata, datalabels }
   │
5. Frontend receives response
   ├── EntityDataTable reads metadata.fields for columns
   ├── KanbanView reads metadata for card rendering
   └── frontEndFormatterService renders based on renderType/inputType
   │
6. User sees data rendered exactly as backend specified
```

---

## Critical Considerations

### Design Principles

1. **Zero Frontend Configuration** - Add column to database, backend generates metadata automatically
2. **Single Source of Truth** - Backend controls ALL rendering logic
3. **Component-Aware** - Different components can show/hide fields independently
4. **Cached Metadata** - In-memory cache per entity for performance
5. **Datalabel Integration** - Automatic fetching of dropdown options

### Common Patterns

| Scenario | Backend Action | Frontend Result |
|----------|----------------|-----------------|
| New currency field | Detect `*_amt` pattern | Currency input with $ symbol |
| New stage field | Detect `dl__*` pattern | Badge view, select edit, DAG visualization |
| New reference field | Detect `*__entity_id` | Dropdown populated from entity lookup |
| New boolean field | Detect `is_*` pattern | Toggle switch in edit mode |

### Anti-Patterns

- Frontend pattern detection (use backend metadata)
- Hardcoded field configurations (use naming conventions)
- Manual dropdown options (use datalabels)
- Field visibility logic in frontend (use metadata.visible)

---

**Last Updated:** 2025-11-21 | **Status:** Production Ready
