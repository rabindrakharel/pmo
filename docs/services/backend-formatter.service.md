# Backend Formatter Service (BFF)

**Version:** 8.2.0 | **Location:** `apps/api/src/services/backend-formatter.service.ts` | **Updated:** 2025-11-26

---

## Overview

The Backend Formatter Service generates **component-aware field metadata** from database column names. It is the **single source of truth** for all field rendering and editing behavior.

**Core Principle:** Backend decides HOW every field is displayed and edited. Frontend executes without pattern detection.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  BFF METADATA GENERATION                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Column Name: "budget_allocated_amt"                                         │
│                       │                                                      │
│                       ▼                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │  STEP 1: pattern-mapping.yaml                                       │     │
│  │  Match: "*_amt" → fieldBusinessType: "currency"                     │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                       │                                                      │
│           ┌───────────┴───────────┐                                          │
│           ▼                       ▼                                          │
│  ┌─────────────────┐   ┌─────────────────┐                                   │
│  │ view-type.yaml  │   │ edit-type.yaml  │                                   │
│  │ renderType:     │   │ inputType:      │                                   │
│  │  'currency'     │   │  'number'       │                                   │
│  └─────────────────┘   └─────────────────┘                                   │
│                       │                                                      │
│                       ▼                                                      │
│  API Response: metadata.entityDataTable.viewType.budget_allocated_amt        │
│                metadata.entityDataTable.editType.budget_allocated_amt        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## YAML Configuration Files

| File | Purpose |
|------|---------|
| `pattern-mapping.yaml` | Column name → fieldBusinessType |
| `view-type-mapping.yaml` | fieldBusinessType → renderType per component |
| `edit-type-mapping.yaml` | fieldBusinessType → inputType per component |
| `entity-field-config.ts` | Explicit field overrides (highest priority) |

---

## API Response Structure (v8.2.0)

```json
{
  "data": [
    { "id": "uuid-123", "name": "Kitchen Renovation", "budget_allocated_amt": 50000 }
  ],
  "fields": ["id", "name", "budget_allocated_amt", "dl__project_stage"],
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
        "dl__project_stage": {
          "dtype": "str",
          "label": "Project Stage",
          "inputType": "select",
          "lookupSource": "datalabel",
          "datalabelKey": "project_stage",
          "behavior": { "editable": true }
        }
      }
    },
    "entityFormContainer": {
      "viewType": { ... },
      "editType": { ... }
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

## Pattern Matching

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

  # Entity reference fields
  - pattern: "*__employee_id"
    fieldBusinessType: "entity_reference"
  - pattern: "*_id"
    fieldBusinessType: "uuid_reference"

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

## Component-Specific Metadata

Different components receive different metadata for the same field:

### Example: dl__project_stage

| Component | viewType.renderType | editType.inputType |
|-----------|--------------------|--------------------|
| entityDataTable | `badge` | `select` |
| entityFormContainer | `dag` | `interactive_dag` |
| kanbanView | `badge` | `select` |

### view-type-mapping.yaml Structure

```yaml
currency:
  entityDataTable:
    renderType: "currency"
    behavior:
      visible: true
      sortable: true
    style:
      align: "right"
      symbol: "$"
      decimals: 2

  entityFormContainer:
    renderType: "currency"
    behavior:
      visible: true
    style:
      symbol: "$"
      decimals: 2

datalabel:
  entityDataTable:
    renderType: "badge"
    behavior:
      visible: true
      filterable: true

  entityFormContainer:
    renderType: "dag"  # Different for form!
    behavior:
      visible: true
```

---

## Usage in Routes

```typescript
import { generateEntityResponse } from '@/services/backend-formatter.service.js';

fastify.get('/api/v1/project', async (request, reply) => {
  const projects = await db.execute(sql`SELECT * FROM app.project...`);

  // Generate complete response with metadata
  const response = generateEntityResponse('project', projects, {
    components: ['entityDataTable', 'entityFormContainer'],
    total: count,
    limit: 20,
    offset: 0
  });

  return reply.send(response);
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
        viewTypeMetadata[fieldName] = { dtype, label, ...fieldMeta.view };
        editTypeMetadata[fieldName] = { dtype, label, ...fieldMeta.edit };
      }
    }

    metadata[component] = { viewType: viewTypeMetadata, editType: editTypeMetadata };
  }

  return metadata;
}
```

---

## Metadata Structure Types

### ViewFieldMetadata

```typescript
interface ViewFieldMetadata {
  dtype: 'str' | 'float' | 'int' | 'bool' | 'uuid' | 'date' | 'timestamp' | 'jsonb';
  label: string;
  renderType: string;     // 'text', 'currency', 'date', 'badge', 'boolean', etc.
  component?: string;     // Custom component name
  behavior: {
    visible?: boolean;
    sortable?: boolean;
    filterable?: boolean;
    searchable?: boolean;
  };
  style: Record<string, any>;  // width, align, symbol, decimals, etc.
  datalabelKey?: string;       // For badge fields
}
```

### EditFieldMetadata

```typescript
interface EditFieldMetadata {
  dtype: string;
  label: string;
  inputType: string;      // 'text', 'number', 'select', 'date', 'checkbox', etc.
  component?: string;     // Custom input component
  behavior: {
    editable?: boolean;
  };
  style: Record<string, any>;
  validation: Record<string, any>;  // required, min, max, pattern
  lookupSource?: 'datalabel' | 'entityInstance';
  lookupEntity?: string;            // Entity code for reference fields
  datalabelKey?: string;            // Datalabel key for select fields
}
```

---

## Explicit Field Configuration

For non-standard fields, use explicit configuration:

```typescript
// apps/api/src/config/entity-field-config.ts

export const FIELD_CONFIG: Record<string, Record<string, FieldConfig>> = {
  project: {
    custom_status: {
      fieldBusinessType: 'datalabel',
      viewType: { renderType: 'badge' },
      editType: { inputType: 'select', datalabelKey: 'project_status' }
    }
  }
};
```

---

## Supported Components

| Component | Purpose |
|-----------|---------|
| `entityDataTable` | Table/list view |
| `entityFormContainer` | Create/edit forms |
| `kanbanView` | Kanban board |
| `calendarView` | Calendar events |
| `gridView` | Card grid |
| `dagView` | Workflow visualization |
| `hierarchyGraphView` | Parent-child hierarchy |

---

## Anti-Patterns

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| Frontend pattern detection | Duplicates logic | Backend sends complete metadata |
| Hardcoded field configs | Maintenance burden | Use YAML mappings |
| Same metadata for all components | Limited flexibility | Component-specific viewType/editType |
| Flat metadata structure | Hard to extend | Use nested { viewType, editType } |

---

**Version:** 8.2.0 | **Updated:** 2025-11-26
