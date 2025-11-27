# Backend Formatter Service (BFF)

**Version:** 8.3.2 | **Location:** `apps/api/src/services/backend-formatter.service.ts` | **Updated:** 2025-11-27

---

## Overview

The Backend Formatter Service generates **component-aware field metadata** from database column names. It is the **single source of truth** for all field rendering and editing behavior.

**Core Principle:** Backend decides HOW every field is displayed and edited. Frontend executes without pattern detection.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  BFF METADATA GENERATION                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Column Name: "manager__employee_id"                                         │
│                       │                                                      │
│                       ▼                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │  STEP 1: Pattern Detection (Backend Only)                           │     │
│  │  Match: "*__*_id" → fieldBusinessType: "entity_reference"           │     │
│  │  Extract entity: "employee"                                          │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                       │                                                      │
│           ┌───────────┴───────────┐                                          │
│           ▼                       ▼                                          │
│  ┌─────────────────┐   ┌─────────────────┐                                   │
│  │ viewType:       │   │ editType:       │                                   │
│  │  'entityInstance│   │  'entityInstance│                                   │
│  │      _Id'       │   │      _Id'       │                                   │
│  │ lookupEntity:   │   │ lookupEntity:   │                                   │
│  │  'employee'     │   │  'employee'     │                                   │
│  └─────────────────┘   └─────────────────┘                                   │
│                       │                                                      │
│                       ▼                                                      │
│  API Response includes:                                                      │
│  • metadata.entityDataTable.viewType.manager__employee_id                    │
│  • ref_data.employee = { "uuid-1": "James Miller", ... }                     │
│                                                                              │
│  Frontend uses metadata.lookupEntity (NO pattern matching)                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Response Structure (v8.3.1)

```json
{
  "data": [
    {
      "id": "uuid-123",
      "name": "Kitchen Renovation",
      "budget_allocated_amt": 50000,
      "manager__employee_id": "uuid-james",
      "dl__project_stage": "planning"
    }
  ],
  "fields": ["id", "name", "budget_allocated_amt", "manager__employee_id", "dl__project_stage"],
  "ref_data": {
    "employee": {
      "uuid-james": "James Miller"
    }
  },
  "metadata": {
    "entityDataTable": {
      "viewType": {
        "budget_allocated_amt": {
          "dtype": "float",
          "label": "Budget Allocated",
          "renderType": "currency",
          "behavior": { "visible": true, "sortable": true },
          "style": { "symbol": "$", "decimals": 2, "align": "right" }
        },
        "manager__employee_id": {
          "dtype": "uuid",
          "label": "Manager Employee Name",
          "viewType": "entityInstance_Id",
          "lookupSource": "entityInstance",
          "lookupEntity": "employee",
          "behavior": { "visible": true, "filterable": true }
        },
        "dl__project_stage": {
          "dtype": "str",
          "label": "Project Stage",
          "renderType": "badge",
          "datalabelKey": "project_stage",
          "behavior": { "visible": true, "filterable": true }
        }
      },
      "editType": {
        "budget_allocated_amt": {
          "dtype": "float",
          "label": "Budget Allocated",
          "inputType": "number",
          "behavior": { "editable": true },
          "validation": { "min": 0 }
        },
        "manager__employee_id": {
          "dtype": "uuid",
          "label": "Manager Employee Name",
          "editType": "entityInstance_Id",
          "lookupSource": "entityInstance",
          "lookupEntity": "employee",
          "behavior": { "editable": true }
        },
        "dl__project_stage": {
          "dtype": "str",
          "label": "Project Stage",
          "inputType": "select",
          "lookupSource": "datalabel",
          "datalabelKey": "project_stage",
          "behavior": { "editable": true }
        }
      }
    }
  },
  "datalabels": {
    "project_stage": [
      { "name": "planning", "label": "Planning", "color_code": "blue" },
      { "name": "in_progress", "label": "In Progress", "color_code": "yellow" }
    ]
  },
  "total": 100,
  "limit": 20,
  "offset": 0
}
```

---

## Entity Reference Fields (v8.3.0)

### ref_data Pattern

Entity reference fields (`*_id`, `*__entity_id`) are resolved via `ref_data` lookup table instead of per-row embedded objects:

```typescript
// Backend generates ref_data for all entity reference fields
const ref_data = await entityInfra.build_ref_data(data);

// Response includes ref_data
return {
  data: projects,
  ref_data,  // { employee: { "uuid-1": "James Miller" }, business: {...} }
  metadata: { ... }
};
```

### Field Metadata for References

Backend automatically sets `lookupEntity` for all reference fields:

| Field Pattern | lookupEntity | Example |
|---------------|--------------|---------|
| `*__employee_id` | `employee` | `manager__employee_id` |
| `*__project_id` | `project` | `parent__project_id` |
| `business_id` | `business` | Simple reference |
| `*__employee_ids` | `employee` | Array reference |

### Frontend Resolution (v8.3.1)

Frontend uses `metadata.lookupEntity` - **NO pattern matching**:

```typescript
// Frontend code (v8.3.1)
import { isEntityReferenceField, getEntityCodeFromMetadata } from '@/lib/refDataResolver';

const fieldMeta = metadata.viewType.manager__employee_id;

// Check using metadata, NOT field name pattern
if (isEntityReferenceField(fieldMeta)) {
  const entityCode = getEntityCodeFromMetadata(fieldMeta);  // "employee"
  const displayName = ref_data[entityCode][uuid];           // "James Miller"
}

// ✗ WRONG: Pattern detection (removed in v8.3.1)
// if (fieldName.endsWith('_id')) { ... }
```

---

## Pattern Matching (Backend Only)

### pattern-mapping.yaml Examples

```yaml
patterns:
  # Currency fields
  - pattern: "*_amt"
    fieldBusinessType: "currency"
  - pattern: "*_price"
    fieldBusinessType: "currency"
  - pattern: "*_cost"
    fieldBusinessType: "currency"

  # Date/Time fields
  - pattern: "*_date"
    fieldBusinessType: "date"
  - pattern: "*_ts"
    fieldBusinessType: "timestamp"
  - pattern: "created_at"
    fieldBusinessType: "timestamp"

  # Boolean fields
  - pattern: "is_*"
    fieldBusinessType: "boolean"
  - pattern: "*_flag"
    fieldBusinessType: "boolean"

  # Datalabel/Settings fields
  - pattern: "dl__*"
    fieldBusinessType: "datalabel"

  # Entity reference fields (v8.3.0)
  - pattern: "*__*_id"
    fieldBusinessType: "entity_reference"
  - pattern: "*_id"
    fieldBusinessType: "entity_reference"
  - pattern: "*__*_ids"
    fieldBusinessType: "entity_reference_array"
  - pattern: "*_ids"
    fieldBusinessType: "entity_reference_array"

  # Special fields
  - pattern: "metadata"
    fieldBusinessType: "json"
  - pattern: "tags"
    fieldBusinessType: "array"
  - pattern: "*_pct"
    fieldBusinessType: "percentage"
```

### Priority Order

```
1. Explicit Config (entity-field-config.ts)  → Highest priority
2. YAML Mappings (pattern → view/edit YAML)  → Preferred method
3. Legacy Pattern (PATTERN_RULES object)     → Fallback
4. Default (plain text)                       → Lowest priority
```

---

## Usage in Routes

### Standard Pattern with ref_data

```typescript
import { generateEntityResponse } from '@/services/backend-formatter.service.js';
import { getEntityInfrastructure } from '@/services/entity-infrastructure.service.js';

const entityInfra = getEntityInfrastructure(db);

fastify.get('/api/v1/project', async (request, reply) => {
  const projects = await db.execute(sql`SELECT * FROM app.project...`);

  // Build ref_data lookup table for entity references
  const ref_data = await entityInfra.build_ref_data(projects);

  // Generate complete response with metadata
  const response = generateEntityResponse('project', projects, {
    components: ['entityDataTable', 'entityFormContainer'],
    total: count,
    limit: 20,
    offset: 0
  });

  return reply.send({
    ...response,
    ref_data  // Include ref_data in response
  });
});
```

---

## Key Functions

### generateEntityResponse

```typescript
function generateEntityResponse(
  entityCode: string,
  data: any[],
  options: {
    components?: ComponentName[];
    total?: number;
    limit?: number;
    offset?: number;
  }
): EntityResponse {
  const fieldNames = data.length > 0 ? Object.keys(data[0]) : [];
  const metadata = generateMetadataForComponents(fieldNames, components, entityCode);

  return { data, fields: fieldNames, metadata, total, limit, offset };
}
```

### generateMetadataForComponents

```typescript
function generateMetadataForComponents(
  fieldNames: string[],
  components: ComponentName[],
  entityCode: string
): EntityMetadata {
  const metadata: EntityMetadata = {};

  for (const component of components) {
    const viewTypeMetadata = {};
    const editTypeMetadata = {};

    for (const fieldName of fieldNames) {
      const fieldMeta = generateFieldMetadataForComponent(fieldName, component, entityCode);
      if (fieldMeta) {
        // Includes lookupEntity for reference fields
        viewTypeMetadata[fieldName] = { dtype, label, ...fieldMeta.view };
        editTypeMetadata[fieldName] = { dtype, label, ...fieldMeta.edit };
      }
    }

    metadata[component] = { viewType: viewTypeMetadata, editType: editTypeMetadata };
  }

  return metadata;
}
```

### detectEntityFromFieldName (Backend Internal)

```typescript
// Backend function - NOT used in frontend
function detectEntityFromFieldName(fieldName: string): string | null {
  // Pattern: *__entity_id → entity
  const match1 = fieldName.match(/^.*__(\w+)_id$/);
  if (match1) return match1[1];

  // Pattern: *__entity_ids → entity
  const match1b = fieldName.match(/^.*__(\w+)_ids$/);
  if (match1b) return match1b[1];

  // Pattern: entity_id → entity
  const match2 = fieldName.match(/^(\w+)_id$/);
  if (match2 && match2[1] !== 'id') return match2[1];

  // Pattern: entity_ids → entity
  const match2b = fieldName.match(/^(\w+)_ids$/);
  if (match2b) return match2b[1];

  return null;
}
```

---

## Metadata Structure Types

### ViewFieldMetadata

```typescript
interface ViewFieldMetadata {
  dtype: 'str' | 'float' | 'int' | 'bool' | 'uuid' | 'date' | 'timestamp' | 'jsonb';
  label: string;
  renderType?: string;           // 'text', 'currency', 'date', 'badge', 'boolean'
  viewType?: string;             // 'entityInstance_Id' for references (v8.3.0)
  component?: string;            // Custom component name
  behavior: {
    visible?: boolean;
    sortable?: boolean;
    filterable?: boolean;
    searchable?: boolean;
  };
  style: Record<string, any>;    // width, align, symbol, decimals
  datalabelKey?: string;         // For badge fields
  lookupSource?: 'entityInstance' | 'datalabel';  // (v8.3.0)
  lookupEntity?: string;         // Entity code for reference fields (v8.3.0)
}
```

### EditFieldMetadata

```typescript
interface EditFieldMetadata {
  dtype: string;
  label: string;
  inputType?: string;            // 'text', 'number', 'select', 'date', 'checkbox'
  editType?: string;             // 'entityInstance_Id' for references (v8.3.0)
  component?: string;            // Custom input component
  behavior: {
    editable?: boolean;
  };
  style: Record<string, any>;
  validation: Record<string, any>;  // required, min, max, pattern
  lookupSource?: 'entityInstance' | 'datalabel';  // (v8.3.0)
  lookupEntity?: string;         // Entity code for reference fields (v8.3.0)
  datalabelKey?: string;         // Datalabel key for select fields
}
```

---

## Component-Specific Metadata

Different components receive different metadata for the same field:

### Example: dl__project_stage

| Component | viewType.renderType | viewType.component | editType.inputType |
|-----------|--------------------|--------------------|---------------------|
| entityDataTable | `badge` | - | `select` |
| entityFormContainer | `component` | `DAGVisualizer` | `BadgeDropdownSelect` |
| kanbanView | `badge` | - | `select` |

### BadgeDropdownSelect inputType (v8.3.2)

For datalabel fields that need colored badge rendering in edit mode, use `inputType: BadgeDropdownSelect`:

```yaml
# edit-type-mapping.yaml
datalabel_dag:
  entityFormContainer:
    inputType: BadgeDropdownSelect
    lookupSource: datalabel
    behavior: { editable: true }
```

This renders a dropdown with colored badges matching the datalabel options, using portal rendering to avoid overflow clipping.

### Example: manager__employee_id (v8.3.0)

| Component | viewType | editType | lookupEntity |
|-----------|----------|----------|--------------|
| entityDataTable | `entityInstance_Id` | `entityInstance_Id` | `employee` |
| entityFormContainer | `entityInstance_Id` | `entityInstance_Id` | `employee` |
| kanbanView | `entityInstance_Id` | `entityInstance_Id` | `employee` |

---

## Anti-Patterns

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| Frontend pattern detection | Duplicates logic | Backend sends `lookupEntity` |
| Field name `_id` checking | Maintenance burden | Use `viewType === 'entityInstance_Id'` |
| Hardcoded field configs | Maintenance burden | Use YAML mappings |
| Same metadata for all components | Limited flexibility | Component-specific viewType/editType |
| Per-row `_ID` embedded objects | N+1 performance | Use `ref_data` lookup table |

---

**Version:** 8.3.2 | **Updated:** 2025-11-27

**Recent Updates:**
- v8.3.2 (2025-11-27):
  - Added `BadgeDropdownSelect` as valid inputType for datalabel fields
  - DAG fields use `renderType: 'component'` + `component: 'DAGVisualizer'` (not `renderType: 'dag'`)
  - EntityFormContainer uses separate view/edit component metadata
- v8.3.1 (2025-11-26): Enforced backend metadata as single source of truth
- v8.3.0 (2025-11-26): Added `lookupEntity`, `lookupSource` for reference fields
