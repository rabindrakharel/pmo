# Backend Formatter Service

**Version:** 9.0.0 | **Location:** `apps/api/src/services/backend-formatter.service.ts`

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
Database Column              Pattern Detection              Generated Metadata (v9.0)
─────────────────            ─────────────────              ─────────────────────────

total_amt          ───>      *_amt pattern       ───>       viewType: { component: 'CurrencyCell', format: {...} }
                                                            editType: { component: 'CurrencyInput', inputType: 'component' }

dl__project_stage  ───>      dl__* pattern       ───>       viewType: { component: 'BadgeCell', format: {...} }
                                                            editType: { lookupSource: 'datalabel', datalabelKey: '...' }

start_date         ───>      *_date pattern      ───>       viewType: { component: 'DateCell' }
                                                            editType: { inputType: 'date' }

is_active          ───>      is_* pattern        ───>       viewType: { component: 'StatusCell' }
                                                            editType: { inputType: 'component', component: 'Toggle' }

manager__employee_id ───>    *__*_id pattern     ───>       viewType: { component: 'EntityLookupCell' }
                                                            editType: { lookupSource: 'entityInstance', lookupEntity: 'employee' }
```

---

## Architecture Overview

### Core Functions

| Function | Purpose |
|----------|---------|
| `generateEntityResponse()` | Creates complete API response with metadata for requested components |
| `generateMetadataForComponents()` | Generates viewType/editType metadata for all requested components |
| `generateFieldMetadataForComponent()` | Generates field metadata using YAML mappings or pattern rules |
| `getFieldBusinessType()` | Determines field business type from pattern-mapping.yaml |
| `extractDatalabelKeys()` | Extracts datalabel field keys from editType metadata |

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
import { generateEntityResponse } from '@/services/backend-formatter.service.js';

const response = generateEntityResponse(ENTITY_CODE, entities, {
  components: ['entityDataTable', 'entityFormContainer'],
  total, limit, offset
});

return response;
// Response includes metadata.entityDataTable.viewType and metadata.entityDataTable.editType
```

### Component-Aware Metadata

The `view` query parameter controls which components receive metadata:

| Parameter Value | Components Included |
|-----------------|---------------------|
| `entityDataTable` | Table columns, sorting, filtering |
| `entityFormContainer` | Form fields, validation (also used for detail view) |
| `kanbanView` | Card fields, grouping |
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

### API Response Structure (v9.0 - viewType/editType Separation)

The API returns a comprehensive response with component-aware metadata. Each component contains separate `viewType` and `editType` objects:

```json
{
  "data": [
    {
      "id": "50192aab-000a-17c5-6904-1065b04a0a0b",
      "code": "CSE-2024-001",
      "name": "Customer Service Excellence Initiative",
      "dl__project_stage": "Execution",
      "budget_allocated_amt": 200000,
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
      "viewType": {
        "budget_allocated_amt": {
          "dtype": "float",
          "label": "Budget Allocated",
          "behavior": { "visible": true, "sortable": true, "filterable": true },
          "style": { "width": "140px", "align": "right" },
          "format": { "symbol": "$", "decimals": 2, "locale": "en-CA" },
          "component": "CurrencyCell"
        },
        "dl__project_stage": {
          "dtype": "str",
          "label": "Project Stage",
          "behavior": { "visible": true, "sortable": true, "filterable": true },
          "format": { "colorFromData": true },
          "component": "BadgeCell"
        },
        "manager__employee_id": {
          "dtype": "uuid",
          "label": "Manager Employee Name",
          "behavior": { "visible": true, "sortable": true, "filterable": true },
          "format": { "displayField": "name", "linkToEntity": true },
          "component": "EntityLookupCell"
        }
      },
      "editType": {
        "budget_allocated_amt": {
          "dtype": "float",
          "label": "Budget Allocated",
          "inputType": "component",
          "behavior": { "editable": true },
          "validation": { "min": 0 },
          "component": "CurrencyInput"
        },
        "dl__project_stage": {
          "dtype": "str",
          "label": "Project Stage",
          "inputType": "select",
          "behavior": { "editable": true },
          "lookupSource": "datalabel",
          "datalabelKey": "dl__project_stage",
          "component": "DatalabelSelect"
        },
        "manager__employee_id": {
          "dtype": "uuid",
          "label": "Manager Employee Name",
          "inputType": "select",
          "behavior": { "editable": true },
          "lookupSource": "entityInstance",
          "lookupEntity": "employee",
          "component": "EntitySelect"
        }
      }
    },
    "entityFormContainer": {
      "viewType": { /* ... view metadata for forms ... */ },
      "editType": { /* ... edit metadata for forms ... */ }
    }
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
| `total` | `number` | Total record count (for pagination) |
| `limit` | `number` | Page size |
| `offset` | `number` | Page offset |

### Datalabels and Global Settings (Dedicated Endpoints)

**Note:** Datalabels and global settings are NOT included in entity responses. They are fetched from dedicated endpoints for better caching and separation of concerns:

| Data | Endpoint | Frontend Hook | Cache TTL |
|------|----------|---------------|-----------|
| **Global Settings** | `GET /api/v1/settings/global` | `useGlobalSettings()` | 30 min (session) |
| **Single Datalabel** | `GET /api/v1/datalabel?name=<name>` | `useDatalabels(fieldKey)` | 30 min (session) |
| **All Datalabels** | `GET /api/v1/settings/datalabels/all` | `useAllDatalabels()` | 30 min (session) |

**Architecture Benefits:**
- Reduced payload size for entity responses
- Single source of truth (dedicated endpoints)
- Session-level caching via Zustand stores (`globalSettingsMetadataStore`, `datalabelMetadataStore`)
- Avoids redundant data in every entity request

### Metadata Structure (v9.0)

Metadata is **component-keyed** with **type-first** organization. Each component contains `viewType` and `editType` at the top level:

```typescript
metadata: {
  entityDataTable: {
    viewType: { [fieldKey]: ViewFieldMetadata },   // Display/rendering config
    editType: { [fieldKey]: EditFieldMetadata }    // Input/editing config
  },
  entityFormContainer: {
    viewType: { [fieldKey]: ViewFieldMetadata },
    editType: { [fieldKey]: EditFieldMetadata }
  },
  kanbanView: {
    viewType: { [fieldKey]: ViewFieldMetadata },
    editType: { [fieldKey]: EditFieldMetadata }
  }
}
```

### ViewFieldMetadata Properties

| Property | Type | Description |
|----------|------|-------------|
| `dtype` | `string` | Data type: `str`, `float`, `int`, `bool`, `uuid`, `date`, `timestamp`, `jsonb`, `array[uuid]` |
| `label` | `string` | Human-readable label |
| `behavior.visible` | `boolean` | Show in this component |
| `behavior.sortable` | `boolean` | Allow column sorting |
| `behavior.filterable` | `boolean` | Show in filter UI |
| `behavior.searchable` | `boolean` | Include in search |
| `style.width` | `string` | Column width (e.g., `140px`, `auto`) |
| `style.align` | `string` | Text alignment: `left`, `center`, `right` |
| `style.monospace` | `boolean` | Use monospace font |
| `format` | `object` | Type-specific formatting (symbol, decimals, colorFromData, etc.) |
| `component` | `string` | Cell component: `CurrencyCell`, `BadgeCell`, `DateCell`, `EntityLookupCell`, etc. |

### EditFieldMetadata Properties

| Property | Type | Description |
|----------|------|-------------|
| `dtype` | `string` | Data type (same as view) |
| `label` | `string` | Human-readable label |
| `inputType` | `string` | Input type: `text`, `textarea`, `select`, `date`, `readonly`, `component` |
| `behavior.editable` | `boolean` | Allow editing |
| `behavior.required` | `boolean` | Field is required |
| `validation` | `object` | Validation rules: `min`, `max`, `pattern`, `maxLength` |
| `lookupSource` | `string` | Lookup type: `datalabel` or `entityInstance` |
| `lookupEntity` | `string` | Entity code for entity lookups |
| `datalabelKey` | `string` | Field key for datalabel lookups (e.g., `dl__project_stage`) |
| `component` | `string` | Input component: `CurrencyInput`, `DatalabelSelect`, `EntitySelect`, etc. |

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
   └── Returns metadata with viewType/editType per component
   │
4. Backend returns { data, fields, metadata: { entityDataTable: { viewType, editType }, ... } }
   │
5. Frontend receives response
   ├── EntityDataTable reads metadata.entityDataTable.viewType for columns
   ├── Edit forms read metadata.entityDataTable.editType for inputs
   └── frontEndFormatterService renders based on component names
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

## Frontend Store Integration

The API response properties map directly to frontend Zustand stores:

### API Response → Zustand Store Mapping

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         API RESPONSE (v9.0)                              │
│  {                                                                       │
│    data: [...],           ─────────────►  EntitySpecificInstanceDataStore│
│                                           EntityListOfInstancesDataStore │
│                                           (URL-bound, 5 min TTL)         │
│                                                                          │
│    fields: [...],         ─────────────►  (used by stores internally)    │
│                                                                          │
│    metadata: {            ─────────────►  entityComponentMetadataStore   │
│      entityDataTable: {                   (URL-bound, 5 min TTL)         │
│        viewType: {...},                   • viewType for rendering       │
│        editType: {...}                    • editType for forms           │
│      },                                                                  │
│      entityFormContainer: {...}                                          │
│    }                                                                     │
│  }                                                                       │
│                                                                          │
│  Datalabels and globalSettings fetched from dedicated endpoints:         │
│  • GET /api/v1/settings/datalabels/all → datalabelMetadataStore          │
│  • GET /api/v1/settings/global → globalSettingsMetadataStore             │
└─────────────────────────────────────────────────────────────────────────┘
```

### Store Population Flow

| API Response Property | Frontend Store | Cache Type | Dedicated Endpoint? |
|-----------------------|----------------|------------|---------------------|
| `data` (list) | `EntityListOfInstancesDataStore` | URL-bound (5 min) | No - from entity endpoints |
| `data` (single) | `EntitySpecificInstanceDataStore` | URL-bound (5 min) | No - from entity endpoints |
| `metadata` | `entityComponentMetadataStore` | URL-bound (5 min) | **No** - piggybacks on entity response |
| `datalabels` | `datalabelMetadataStore` | Session (30 min, login) | Yes - `GET /api/v1/settings/datalabels/all` |
| `globalSettings` | `globalSettingsMetadataStore` | Session (30 min, login) | Yes - `GET /api/v1/settings/global` |
| (entity codes) | `entityCodeMetadataStore` | Session (30 min, login) | Yes - `GET /api/v1/entity/codes` |

### Key Point: Metadata Has No Dedicated Endpoint

`entityComponentMetadataStore` is populated as a **side-effect** of entity endpoint responses. The metadata is generated by the Backend Formatter Service based on SQL query columns and cannot be fetched independently:

```typescript
// Entity endpoint returns data + metadata together
const response = await fetch('/api/v1/project?view=entityDataTable');
// { data: [...], metadata: { entityDataTable: { viewType: {...}, editType: {...} } }, ... }

// Frontend caches both in their respective stores:
EntityListOfInstancesDataStore.setList('project', queryHash, response.data);
entityComponentMetadataStore.setMetadata('project', 'entityDataTable', response.metadata.entityDataTable);

// Access viewType for rendering, editType for forms:
const viewMeta = response.metadata.entityDataTable.viewType;
const editMeta = response.metadata.entityDataTable.editType;
```

> **See:** `docs/state_management/zustand-integration-guide.md` for complete store documentation

---

**Last Updated:** 2025-11-25 | **Status:** Production Ready | **Breaking Change:** v9.0 restructured metadata to viewType/editType
