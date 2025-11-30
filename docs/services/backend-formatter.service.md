# Backend Formatter Service (BFF)

**Version:** 9.3.0 | **Location:** `apps/api/src/services/backend-formatter.service.ts` | **Updated:** 2025-11-30

> **Note:** The backend formatter generates metadata consumed by the TanStack Query + Dexie frontend (v9.3.0). Field names are cached in Redis (24-hour TTL) to ensure metadata generation works even for empty result sets. Supports `content=metadata` API parameter for metadata-only requests.

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
│  │ renderType:     │   │ inputType:      │                                   │
│  │  'entityInstance│   │  'entityInstance│                                   │
│  │      Id'        │   │      Id'        │                                   │
│  │ lookupEntity:   │   │ lookupEntity:   │                                   │
│  │  'employee'     │   │  'employee'     │                                   │
│  └─────────────────┘   └─────────────────┘                                   │
│                       │                                                      │
│                       ▼                                                      │
│  API Response includes:                                                      │
│  • metadata.entityListOfInstancesTable.viewType.manager__employee_id                    │
│  • ref_data_entityInstance.employee = { "uuid-1": "James Miller", ... }                     │
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
  "ref_data_entityInstance": {
    "employee": {
      "uuid-james": "James Miller"
    }
  },
  "metadata": {
    "entityListOfInstancesTable": {
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
          "renderType": "entityInstanceId",
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
          "inputType": "entityInstanceId",
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

### ref_data_entityInstance Pattern

Entity reference fields (`*_id`, `*__entity_id`) are resolved via `ref_data_entityInstance` lookup table instead of per-row embedded objects:

```typescript
// Backend generates ref_data_entityInstance for all entity reference fields
const ref_data_entityInstance = await entityInfra.build_ref_data_entityInstance(data);

// Response includes ref_data_entityInstance
return {
  data: projects,
  ref_data_entityInstance,  // { employee: { "uuid-1": "James Miller" }, business: {...} }
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
  const displayName = ref_data_entityInstance[entityCode][uuid];  // "James Miller"
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
2. YAML Mappings (pattern → view/edit YAML)  → Standard method
3. Default (plain text)                       → Lowest priority
```

> **Note:** Legacy PATTERN_RULES was removed in v11.0.0. YAML mappings are now the sole source of truth.

---

## Redis Field Name Caching (v9.2.0)

The service caches entity field names in Redis to solve the "empty data" problem where child entity tabs show no columns when there's no existing data.

### Cache Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FIELD NAME CACHING FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Request → generateEntityResponse()                                          │
│                     │                                                        │
│                     ▼                                                        │
│           ┌─────────────────────┐                                            │
│           │  Check Redis Cache  │                                            │
│           │  entity:fields:{code}│                                           │
│           └─────────┬───────────┘                                            │
│                     │                                                        │
│           ┌─────────┴─────────┐                                              │
│           │                   │                                              │
│      CACHE HIT           CACHE MISS                                          │
│           │                   │                                              │
│           ▼                   ▼                                              │
│    Use cached fields    Extract from:                                        │
│                         1. data[0] (if data exists)                          │
│                         2. resultFields (PostgreSQL columns)                 │
│                                   │                                          │
│                                   ▼                                          │
│                         Hydrate Redis Cache (TTL: 24h)                       │
│                                   │                                          │
│           └───────────────────────┘                                          │
│                     │                                                        │
│                     ▼                                                        │
│           generateMetadataForComponents(fieldNames)                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Cache Configuration

| Setting | Value | Description |
|---------|-------|-------------|
| Key Pattern | `entity:fields:{entityCode}` | e.g., `entity:fields:task` |
| TTL | 86400 seconds (24 hours) | Schema changes are rare |
| Storage | JSON array of field names | `["id","name","code","..."]` |

### Graceful Degradation

If Redis is unavailable, the service continues without caching:

```typescript
async function getCachedFieldNames(entityCode: string): Promise<string[] | null> {
  try {
    const redis = getRedisClient();
    const cached = await redis.get(`entity:fields:${entityCode}`);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    // Redis unavailable - continue without cache
    console.warn(`[FieldCache] Redis error, falling back:`, error);
    return null;
  }
}
```

### Cache Invalidation

```typescript
import { invalidateFieldCache, clearAllFieldCache } from '@/services/backend-formatter.service.js';

// Invalidate single entity (e.g., after schema change)
await invalidateFieldCache('task');

// Clear all field caches (e.g., after DDL migration)
await clearAllFieldCache();
```

---

## Content Parameter API (v9.3.0)

The `content=metadata` query parameter allows frontend to request metadata-only responses without triggering data queries. This is used by `useEntityMetadata` hook for prefetching field metadata.

### Request

```
GET /api/v1/project?content=metadata
GET /api/v1/project?content=metadata&view=entityListOfInstancesTable,entityInstanceFormContainer
```

### Response Structure

When `content=metadata` is specified, the response contains full metadata but empty data:

```json
{
  "data": [],
  "fields": ["id", "name", "code", "budget_allocated_amt", "dl__project_stage", "manager__employee_id"],
  "ref_data_entityInstance": {},
  "metadata": {
    "entityListOfInstancesTable": {
      "viewType": { ... },
      "editType": { ... }
    }
  },
  "total": 0,
  "limit": 0,
  "offset": 0
}
```

### Route Implementation

```typescript
fastify.get('/api/v1/project', async (request, reply) => {
  const { content, view } = request.query;

  // Metadata-only mode - skip data query
  if (content === 'metadata') {
    const requestedComponents = view
      ? view.split(',').map((v: string) => v.trim())
      : ['entityListOfInstancesTable', 'entityInstanceFormContainer', 'kanbanView'];

    const response = await generateEntityResponse(ENTITY_CODE, [], {
      components: requestedComponents,
      metadataOnly: true
    });
    return reply.send(response);
  }

  // Normal data fetch continues...
});
```

### Frontend Hook Usage

```typescript
// apps/web/src/db/tanstack-hooks/useEntityList.ts
export function useEntityMetadata(entityCode: string) {
  return useQuery({
    queryKey: ['entityInstanceMetadata', entityCode],
    queryFn: async () => {
      // Uses content=metadata - no data query on backend
      const response = await apiClient.get(`/api/v1/${entityCode}`, {
        params: { content: 'metadata' }
      });
      return response.data.metadata?.entityListOfInstancesTable;
    },
    staleTime: 30 * 60 * 1000,  // 30-minute TTL
  });
}
```

---

## Usage in Routes

### Standard Pattern with ref_data_entityInstance

```typescript
import { generateEntityResponse } from '@/services/backend-formatter.service.js';
import { getEntityInfrastructure } from '@/services/entity-infrastructure.service.js';

const entityInfra = getEntityInfrastructure(db);

fastify.get('/api/v1/project', async (request, reply) => {
  const projects = await db.execute(sql`SELECT * FROM app.project...`);

  // Build ref_data_entityInstance lookup table for entity references
  const ref_data_entityInstance = await entityInfra.build_ref_data_entityInstance(projects);

  // Generate complete response with metadata (async - uses Redis cache)
  const response = await generateEntityResponse('project', Array.from(projects), {
    components: ['entityListOfInstancesTable', 'entityInstanceFormContainer'],
    total: count,
    limit: 20,
    offset: 0
  });

  return reply.send({
    ...response,
    ref_data_entityInstance  // Include ref_data_entityInstance in response
  });
});
```

### Child Entity Pattern with resultFields Fallback

For child entity tabs that may return empty data, pass `resultFields` from PostgreSQL:

```typescript
import { db, client } from '@/db/index.js';
import { generateEntityResponse } from '@/services/backend-formatter.service.js';

// Query with drizzle-orm
const data = await db.execute(sql`SELECT * FROM app.task...`);

// Get column metadata for empty data fallback
let resultFields: Array<{ name: string }> = [];
if (data.length === 0) {
  const columnsResult = await client.unsafe(
    `SELECT * FROM app.${tableName} WHERE 1=0`
  );
  resultFields = columnsResult.columns?.map((col: any) => ({ name: col.name })) || [];
}

// Generate response with resultFields fallback
const response = await generateEntityResponse(entityCode, Array.from(data), {
  total: count,
  limit,
  offset,
  resultFields  // PostgreSQL columns for empty data
});
```

---

## Key Functions

### generateEntityResponse (async - v9.3.0)

```typescript
async function generateEntityResponse(
  entityCode: string,
  data: any[],
  options: {
    components?: ComponentName[];
    total?: number;
    limit?: number;
    offset?: number;
    resultFields?: Array<{ name: string }>;  // PostgreSQL columns fallback
    metadataOnly?: boolean;                   // Return metadata only (v9.3.0)
    ref_data_entityInstance?: Record<string, Record<string, string>>;  // Entity references
  }
): Promise<EntityResponse & { ref_data_entityInstance: Record<string, Record<string, string>> }> {
  // Step 1: Check Redis cache
  const cachedFields = await getCachedFieldNames(entityCode);

  let fieldNames: string[];
  if (cachedFields) {
    fieldNames = cachedFields;  // Cache hit
  } else {
    // Cache miss - extract from data or resultFields
    if (data.length > 0) {
      fieldNames = Object.keys(data[0]);
    } else if (resultFields.length > 0) {
      fieldNames = resultFields.map(f => f.name);
    } else {
      fieldNames = [];
    }
    // Hydrate cache
    if (fieldNames.length > 0) {
      await cacheFieldNames(entityCode, fieldNames);
    }
  }

  // Metadata-only mode (v9.3.0)
  if (metadataOnly) {
    return {
      data: [],
      fields: fieldNames,
      metadata,
      ref_data_entityInstance: {},
      total: 0,
      limit: 0,
      offset: 0
    };
  }

  const metadata = generateMetadataForComponents(fieldNames, components, entityCode);
  return { data, fields: fieldNames, metadata, ref_data_entityInstance, total, limit, offset };
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
  renderType?: string;           // 'text', 'currency', 'date', 'badge', 'boolean', 'entityInstanceId'
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
  inputType?: string;            // 'text', 'number', 'select', 'date', 'checkbox', 'entityInstanceId'
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
| entityListOfInstancesTable | `badge` | - | `select` |
| entityInstanceFormContainer | `component` | `DAGVisualizer` | `BadgeDropdownSelect` |
| kanbanView | `badge` | - | `select` |

### BadgeDropdownSelect inputType (v8.3.2)

For datalabel fields that need colored badge rendering in edit mode, use `inputType: BadgeDropdownSelect`:

```yaml
# edit-type-mapping.yaml
datalabel_dag:
  entityInstanceFormContainer:
    inputType: BadgeDropdownSelect
    lookupSource: datalabel
    behavior: { editable: true }
```

This renders a dropdown with colored badges matching the datalabel options, using portal rendering to avoid overflow clipping.

### Example: manager__employee_id (v8.3.0)

| Component | renderType | inputType | lookupEntity |
|-----------|------------|-----------|--------------|
| entityListOfInstancesTable | `entityInstanceId` | `entityInstanceId` | `employee` |
| entityInstanceFormContainer | `entityInstanceId` | `entityInstanceId` | `employee` |
| kanbanView | `entityInstanceId` | `entityInstanceId` | `employee` |

---

## Anti-Patterns

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| Frontend pattern detection | Duplicates logic | Backend sends `lookupEntity` |
| Field name `_id` checking | Maintenance burden | Use `renderType === 'entityInstanceId'` |
| Hardcoded field configs | Maintenance burden | Use YAML mappings |
| Same metadata for all components | Limited flexibility | Component-specific viewType/editType |
| Per-row `_ID` embedded objects | N+1 performance | Use `ref_data_entityInstance` lookup table |

---

**Version:** 9.3.0 | **Updated:** 2025-11-30

**Recent Updates:**
- v9.3.0 (2025-11-30):
  - **`content=metadata` API parameter** - Metadata-only responses without data query
  - **`metadataOnly` option** - Skip data in `generateEntityResponse()`
  - **`useEntityMetadata` hook support** - Frontend uses 30-min TTL for metadata
  - `ref_data_entityInstance` now included in return type signature
- v9.2.0 (2025-11-30):
  - **Redis field name caching** - 24-hour TTL cache for entity field names
  - **`generateEntityResponse()` is now async** - all callers must use `await`
  - **`resultFields` parameter** - PostgreSQL column metadata fallback for empty data
  - Solves "empty child entity tabs show no columns" problem
  - Graceful degradation when Redis unavailable
  - Exported `invalidateFieldCache()` and `clearAllFieldCache()` for cache management
- v11.0.0 (2025-11-27):
  - **Removed legacy PATTERN_RULES** (~900 lines) - YAML is now sole source of truth
  - Standardized naming: `entityInstanceId` (camelCase) for both `renderType` and `inputType`
  - Removed `viewType`/`editType` field properties - use `renderType`/`inputType` instead
- v8.3.2 (2025-11-27):
  - Added `BadgeDropdownSelect` as valid inputType for datalabel fields
  - DAG fields use `renderType: 'component'` + `component: 'DAGVisualizer'` (not `renderType: 'dag'`)
  - EntityInstanceFormContainer uses separate view/edit component metadata
- v8.3.1 (2025-11-26): Enforced backend metadata as single source of truth
- v8.3.0 (2025-11-26): Added `lookupEntity`, `lookupSource` for reference fields
