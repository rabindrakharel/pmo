# Backend Formatter Service - Component-Aware Metadata Generation

**Status**: Production
**Version**: Final (v5 consolidated, renamed from backend-formatter-v5.service.ts)
**Location**: `apps/api/src/services/backend-formatter.service.ts`

---

## 1. Semantics & Business Context

Enables zero-configuration entity management by auto-generating **component-specific** field metadata from SQL column naming conventions. Backend becomes single source of truth for all UI rendering decisions across 8 different component contexts, eliminating frontend pattern detection and reducing entity onboarding time from hours to minutes.

---

## 2. Tooling & Framework Architecture

- **Pattern Engine**: 40+ regex-based column name rules
- **Component System**: 8 UI component metadata targets (entityDataTable, entityFormContainer, dagView, etc.)
- **Stateless**: No caching (per-request generation)
- **Type Safety**: Full TypeScript with exported interfaces
- **Integration**: Route handlers call `generateEntityResponse()` with view parameter

---

## 3. Architecture & System Design

### 3.1 Component-Aware Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│               CLIENT REQUEST WITH VIEW PARAMETER                  │
│   GET /api/v1/office?view=entityDataTable,kanbanView            │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│                    ROUTE HANDLER                                  │
│  - Parse view → ['entityDataTable', 'kanbanView']               │
│  - Execute SQL → offices[]                                        │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│          generateEntityResponse(entityCode, data, options)        │
│                                                                   │
│  For EACH requested component:                                    │
│    For EACH SQL column:                                           │
│      → Match 40+ pattern rules                                    │
│      → Generate component-specific metadata                       │
│      → Set viewType (badge vs dag vs text)                        │
│      → Set editType (select vs readonly)                          │
│      → Set visibility (true/false for this component)             │
│      → Set label via generateLabel()                              │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│                COMPONENT-SEGMENTED METADATA                       │
│  {                                                                │
│    entityDataTable: {                                             │
│      dl__office_type: {                                           │
│        format: 'datalabel_lookup',                                │
│        viewType: 'badge',                                         │
│        editType: 'select',                                        │
│        datalabelKey: 'dl__office_type'                            │
│      },                                                           │
│      budget_allocated_amt: {                                      │
│        format: 'currency',                                        │
│        viewType: 'currency',                                      │
│        editType: 'currency'                                       │
│      }                                                             │
│    },                                                             │
│    kanbanView: {                                                  │
│      dl__office_type: {                                           │
│        format: 'datalabel_lookup',                                │
│        viewType: 'badge',                                         │
│        editType: 'select'                                         │
│      }                                                             │
│    }                                                              │
│  }                                                                │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│         extractDatalabelKeys(metadata)                            │
│  - Scan all components for format === 'datalabel_lookup'         │
│  - Return unique datalabelKey values                              │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│         fetchDatalabels(db, keys) [from datalabel.service]        │
│  - Query setting_datalabel table in batch                         │
│  - Return: [{ name, options: [{id, name, color_code, ...}] }]    │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│                    ENTITY RESPONSE                                │
│  {                                                                │
│    data: [...],                                                   │
│    fields: ['id', 'code', 'name', ...],                           │
│    metadata: { entityDataTable: {...}, kanbanView: {...} },       │
│    datalabels: [{ name: 'dl__office_type', options: [...] }],     │
│    globalSettings: {...},                                         │
│    total, limit, offset                                           │
│  }                                                                │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Segmentation Table

| Component | Primary Use | viewType Preference | editType | Visibility Strategy |
|-----------|-------------|---------------------|----------|---------------------|
| **entityDataTable** | List view table | `badge`, `currency`, `date` | `select`, `currency` | High (show most fields) |
| **entityFormContainer** | Create/edit forms | `dag`, `badge` | `select`, `currency` | Medium (editable only) |
| **entityDetailView** | Single entity details | `badge`, `progress-bar` | `readonly` | High (read-only display) |
| **kanbanView** | Kanban board cards | `badge` | N/A | Low (summary fields) |
| **calendarView** | Calendar events | `badge` | N/A | Low (date + summary) |
| **gridView** | Grid/card layout | `badge`, `currency` | N/A | Medium |
| **dagView** | Workflow visualizer | `dag` | N/A | Low (stage fields only) |
| **hierarchyGraphView** | Org chart/hierarchy | `badge` | N/A | Low (name + role) |

**Component Inheritance**: If component lacks specific rule in PATTERN_RULES, it inherits from `entityDataTable`.

### 3.3 Critical Pattern Rules

#### Datalabel Lookup (Settings Dropdowns & DAG Workflows)

```typescript
'dl__*': {
  entityDataTable: {
    format: 'datalabel_lookup',   // Identifies field type
    viewType: 'badge',             // Colored badge in table
    editType: 'select',            // Dropdown in edit mode
    datalabelKey: 'dl__project_stage'  // Auto-set from field name
  },
  entityFormContainer: {
    format: 'datalabel_lookup',
    viewType: 'dag',               // DAG workflow visualizer
    editType: 'select'
  },
  dagView: {
    format: 'datalabel_lookup',
    viewType: 'dag',               // Full DAG diagram
    editType: 'select'
  },
  // Other components: viewType 'badge'
}
```

**Auto-Detection Logic:**
1. Service detects `dl__*` prefix
2. Sets `datalabelKey` = field name (e.g., `'dl__project_stage'`)
3. `extractDatalabelKeys()` scans for `format === 'datalabel_lookup'`
4. `fetchDatalabels()` queries `setting_datalabel` WHERE datalabel = ANY([...keys])
5. Returns options with `parent_id` hierarchy for DAG rendering

#### Entity Lookup (Foreign Key References)

```typescript
'*_id': {  // Matches: office_id, project_id, manager__employee_id
  entityDataTable: {
    format: 'entity_lookup',
    viewType: 'text',              // Show entity name (not UUID)
    editType: 'select',            // Dropdown with entity names
    displayField: 'name',          // Display field from entity
    valueField: 'id'               // Store UUID
  }
}

// Prefix extraction for labeled references:
// manager__employee_id → entity: 'employee', label: 'Manager Employee'
// office_id → entity: 'office', label: 'Office'
```

**Entity Detection:**
```
Field: manager__employee_id
  ↓
Split by '__' → ['manager', 'employee_id']
  ↓
Extract entity from second part → 'employee'
  ↓
Auto-set:
  - loadFromEntity: 'employee'
  - endpoint: '/api/v1/entity/employee/entity-instance-lookup'
  - label: 'Manager Employee'
```

#### Financial Patterns

```typescript
'*_amt', '*_price', '*_cost' → {
  format: 'currency',
  viewType: 'currency',
  editType: 'currency',
  align: 'right',
  width: '140px'
}
```

#### Temporal Patterns

```typescript
'*_date' → { format: 'date', viewType: 'date', editType: 'date' }
'*_ts', '*_at' → { format: 'timestamp', viewType: 'timestamp', editType: 'datetime' }
```

#### Boolean Patterns

```typescript
'is_*', '*_flag' → {
  format: 'boolean',
  viewType: 'boolean',
  editType: 'checkbox'
}
```

### 3.4 Data Flow Diagram

```
REQUEST
   │
   ├─ view=entityDataTable,entityFormContainer
   │
   ▼
ROUTE HANDLER
   │
   ├─ SQL Query → offices[]
   │
   ▼
generateEntityResponse()
   │
   ├─ For entityDataTable:
   │    ├─ budget_allocated_amt → {format:'currency', viewType:'currency'}
   │    ├─ dl__office_type → {format:'datalabel_lookup', viewType:'badge', datalabelKey}
   │    └─ office_id → {format:'entity_lookup', viewType:'text', loadFromEntity:'office'}
   │
   ├─ For entityFormContainer:
   │    ├─ budget_allocated_amt → {format:'currency', viewType:'currency'}
   │    ├─ dl__office_type → {format:'datalabel_lookup', viewType:'dag', datalabelKey}
   │    └─ office_id → {format:'entity_lookup', viewType:'text', editType:'select'}
   │
   ▼
extractDatalabelKeys()
   │
   ├─ Find format === 'datalabel_lookup' → ['dl__office_type']
   │
   ▼
fetchDatalabels()
   │
   ├─ Query setting_datalabel WHERE datalabel = 'dl__office_type'
   ├─ Return options: [{id:1, name:'HQ', color_code:'blue', parent_id:null}, ...]
   │
   ▼
RESPONSE
   │
   └─ { data, metadata: {entityDataTable:{...}, entityFormContainer:{...}}, datalabels }
```

---

## 4. API Integration Pattern

### Route Implementation

```typescript
import { generateEntityResponse, extractDatalabelKeys } from '@/services/backend-formatter.service.js';
import { fetchDatalabels } from '@/services/datalabel.service.js';

const ENTITY_CODE = 'office';

// LIST Endpoint
fastify.get('/api/v1/office', async (request, reply) => {
  const { view } = request.query;

  // 1. SQL Query
  const offices = await db.execute(sql`SELECT * FROM app.office...`);

  // 2. Generate Component-Specific Metadata
  const requestedComponents = view?.split(',') || ['entityDataTable', 'entityFormContainer', 'kanbanView'];
  const response = generateEntityResponse(ENTITY_CODE, offices, {
    components: requestedComponents,
    total, limit, offset
  });

  // 3. Fetch Datalabels
  const datalabelKeys = extractDatalabelKeys(response.metadata);
  if (datalabelKeys.length > 0) {
    response.datalabels = await fetchDatalabels(db, datalabelKeys);
  }

  return response;
});

// GET Endpoint
fastify.get('/api/v1/office/:id', async (request, reply) => {
  const { view } = request.query;

  const office = await db.execute(sql`SELECT * FROM app.office WHERE id = ${id}`);

  const requestedComponents = view?.split(',') || ['entityDetailView', 'entityFormContainer'];
  const response = generateEntityResponse(ENTITY_CODE, [office[0]], {
    components: requestedComponents,
    total: 1, limit: 1, offset: 0
  });

  const datalabelKeys = extractDatalabelKeys(response.metadata);
  if (datalabelKeys.length > 0) {
    response.datalabels = await fetchDatalabels(db, datalabelKeys);
  }

  return {
    data: office[0],
    metadata: response.metadata,
    datalabels: response.datalabels
  };
});
```

### Response Structure

```json
{
  "data": [...],
  "fields": ["id", "code", "name", "budget_allocated_amt", "dl__office_type"],
  "metadata": {
    "entityDataTable": {
      "budget_allocated_amt": {
        "dtype": "numeric",
        "format": "currency",
        "viewType": "currency",
        "editType": "currency",
        "label": "Budget Allocated",
        "visible": true,
        "editable": true,
        "align": "right",
        "width": "140px"
      },
      "dl__office_type": {
        "dtype": "str",
        "format": "datalabel_lookup",
        "viewType": "badge",
        "editType": "select",
        "label": "Office Type",
        "datalabelKey": "dl__office_type",
        "visible": true,
        "editable": true
      }
    },
    "entityFormContainer": {
      "dl__office_type": {
        "dtype": "str",
        "format": "datalabel_lookup",
        "viewType": "dag",
        "editType": "select",
        "label": "Office Type",
        "datalabelKey": "dl__office_type",
        "visible": true,
        "editable": true
      }
    }
  },
  "datalabels": [
    {
      "name": "dl__office_type",
      "options": [
        {"id": 1, "name": "Headquarters", "color_code": "blue", "parent_id": null, "sort_order": 1, "active_flag": true},
        {"id": 2, "name": "Branch", "color_code": "green", "parent_id": 1, "sort_order": 2, "active_flag": true}
      ]
    }
  ],
  "globalSettings": {...},
  "total": 150,
  "limit": 20,
  "offset": 0
}
```

---

## 5. Type Definitions

```typescript
interface EntityResponse {
  data: any[];
  fields: string[];
  metadata: EntityMetadata;
  datalabels: DatalabelData[];
  globalSettings: GlobalSettings;
  total: number;
  limit: number;
  offset: number;
}

interface EntityMetadata {
  entityDataTable?: ComponentMetadata;
  entityFormContainer?: ComponentMetadata;
  entityDetailView?: ComponentMetadata;
  kanbanView?: ComponentMetadata;
  calendarView?: ComponentMetadata;
  gridView?: ComponentMetadata;
  dagView?: ComponentMetadata;
  hierarchyGraphView?: ComponentMetadata;
}

interface ComponentMetadata {
  [fieldName: string]: FieldMetadataBase;
}

interface FieldMetadataBase {
  dtype: string;
  format: string;                  // 'currency', 'datalabel_lookup', 'entity_lookup', etc.
  viewType: string;                // 'badge', 'dag', 'currency', 'text', etc.
  editType: string;                // 'select', 'currency', 'date', 'checkbox', etc.
  label: string;                   // Human-readable label
  visible: boolean;
  editable: boolean;
  datalabelKey?: string;           // For datalabel_lookup fields
  loadFromEntity?: string;         // For entity_lookup fields
  endpoint?: string;               // API endpoint for options
  displayField?: string;           // Display field for entity_lookup
  valueField?: string;             // Value field for entity_lookup
  align?: 'left' | 'right' | 'center';
  width?: string;
}

interface DatalabelData {
  name: string;                    // e.g., 'dl__project_stage'
  options: DatalabelOption[];
}

interface DatalabelOption {
  id: number;
  name: string;
  descr?: string | null;
  parent_id: number | null;        // For DAG hierarchy
  sort_order: number;
  color_code: string;              // For badge rendering
  active_flag: boolean;
}
```

---

## 6. Critical Considerations for Developers

### Adding New Field Pattern

1. Edit `PATTERN_RULES` in backend-formatter.service.ts
2. Define metadata for each component (or just entityDataTable for inheritance)
3. **NO frontend changes needed**

### Format vs ViewType vs EditType

- **format**: Identifies field type (`'datalabel_lookup'`, `'entity_lookup'`, `'currency'`)
- **viewType**: Controls rendering style (`'badge'`, `'dag'`, `'currency'`, `'text'`)
- **editType**: Controls input type (`'select'`, `'currency'`, `'date'`, `'checkbox'`)

### Datalabel Lookup vs Entity Lookup

**Datalabel Lookup:**
- Prefix: `dl__*`
- Format: `'datalabel_lookup'`
- Source: `setting_datalabel` table
- Options: Preloaded in `response.datalabels`
- Supports: DAG hierarchy (via `parent_id`)

**Entity Lookup:**
- Suffix: `*_id`
- Format: `'entity_lookup'`
- Source: `/api/v1/entity/{entity}/entity-instance-lookup` endpoint
- Options: Fetched on-demand (not preloaded)

### View Parameter Strategy

**List View**: `?view=entityDataTable` (single component for table rendering)
**Detail View**: `?view=entityDetailView,entityFormContainer` (multiple components for detail + editing)

### Performance

- **Stateless**: No caching (regenerates metadata per request)
- **Cost**: O(n × m) where n = fields, m = components
- **Typical**: 20 fields × 2 components = 40 iterations (~1ms)

### DO NOT

- ❌ Add pattern detection to frontend
- ❌ Query datalabels individually (batch only via `extractDatalabelKeys`)
- ❌ Mix `loadFromDataLabels` flag (removed, use `format === 'datalabel_lookup'`)
- ❌ Hardcode viewType in pattern rules (component-specific values only)

---

## 7. Related Services

- **frontEndFormatterService.tsx**: Pure metadata renderer (frontend)
- **entity-infrastructure.service.ts**: RBAC, entity registry, parent-child links
- **datalabel.service.ts**: Datalabel option fetcher (batch query)
