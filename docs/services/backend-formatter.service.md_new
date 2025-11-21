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

```json
{
  "data": [...],
  "metadata": {
    "entity": "project",
    "fields": [
      {
        "key": "budget_allocated_amt",
        "label": "Budget Allocated",
        "renderType": "currency",
        "inputType": "currency",
        "visible": { "entityDataTable": true, "entityFormContainer": true },
        "editable": true,
        "align": "right"
      }
    ]
  },
  "datalabels": [...],
  "total": 100,
  "limit": 20,
  "offset": 0
}
```

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
