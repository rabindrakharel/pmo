# RefData Architecture (v8.3.1)

> End-to-end architecture for resolving entity reference UUIDs to human-readable names using the ref_data_entityInstance lookup pattern with React Query caching.

## Overview

The RefData pattern solves the N+1 problem for entity references by:
1. Backend includes a `ref_data_entityInstance` lookup table in API responses
2. Frontend uses O(1) hash lookups instead of additional API calls
3. React Query caches everything, enabling instant rendering

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RefData Architecture                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌────────────┐ │
│  │  YAML    │ ──▶ │   Backend    │ ──▶ │  React Query │ ──▶ │  Component │ │
│  │  Config  │     │  Formatter   │     │    Cache     │     │   Render   │ │
│  └──────────┘     └──────────────┘     └──────────────┘     └────────────┘ │
│                                                                              │
│  renderType:      metadata +           RAW data +          resolveField()   │
│  entityInstanceId ref_data_entityInstance             ref_data_entityInstance            → "James Miller" │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Design Pattern

### Single Source of Truth

| Layer | Source of Truth | Responsibility |
|-------|-----------------|----------------|
| **YAML Config** | Field type detection | `renderType`, `inputType`, `lookupSource` |
| **Backend** | Entity extraction | `lookupEntity` from field name |
| **Backend** | Name resolution | `ref_data_entityInstance` lookup table |
| **Frontend** | Display only | Consume metadata, render UI |

### Key Principle

**Frontend does NOT detect patterns** - it uses backend metadata to determine:
- Whether a field is an entity reference (`renderType === 'entityInstanceId'`)
- Which entity to look up (`lookupEntity`)

---

## 1. YAML Configuration Layer

### view-type-mapping.yaml

```yaml
# Entity reference fields - single UUID reference
entityInstance_Id:
  dtype: uuid
  entityDataTable:
    renderType: entityInstanceId
    behavior: { visible: true, sortable: false, filterable: false }
    style: { displayField: name, linkToEntity: true }
  entityFormContainer:
    renderType: entityInstanceId
    behavior: { visible: true }
    style: { displayField: name }

# Entity reference fields - array of UUIDs
entityInstance_Ids:
  dtype: array[uuid]
  entityDataTable:
    renderType: entityInstanceIds
    behavior: { visible: true }
    style: { maxDisplay: 3 }
```

### edit-type-mapping.yaml

```yaml
# Entity reference fields - single UUID
entityInstance_Id:
  dtype: uuid
  lookupSource: entityInstance          # YAML provides this
  entityDataTable:
    inputType: entityInstanceId
    behavior: { editable: true, filterable: true, visible: true }
  entityFormContainer:
    inputType: entityInstanceId
    behavior: { editable: true }

# Entity reference fields - array of UUIDs
entityInstance_Ids:
  dtype: array[uuid]
  lookupSource: entityInstance
  entityDataTable:
    inputType: entityInstanceIds
    behavior: { editable: true }
```

### pattern-mapping.yaml

```yaml
# Pattern detection for field names
entityInstance_Id:
  pattern: '.*__[a-z]+_id$'           # e.g., manager__employee_id
  priority: 50

entityInstance_Ids:
  pattern: '.*__[a-z]+_ids$'          # e.g., team__employee_ids
  priority: 50
```

---

## 2. Backend Formatter Service

**File:** `apps/api/src/services/backend-formatter.service.ts`

### Field Name → Entity Extraction

```typescript
// YAML provides: lookupSource: entityInstance
// Backend extracts: lookupEntity from field name

function detectEntityFromFieldName(fieldName: string): string | null {
  // manager__employee_id → "employee"
  // business_id → "business"
  const match = fieldName.match(/(?:__)?([a-z]+)_ids?$/);
  return match ? match[1] : null;
}

// Only extract lookupEntity when YAML provides lookupSource
if (edit.lookupSource === 'entityInstance') {
  const entity = detectEntityFromFieldName(fieldName);
  if (entity) {
    edit.lookupEntity = entity;
  }
}
```

### build_ref_data_entityInstance() Method

```typescript
// Entity Infrastructure Service
async build_ref_data_entityInstance(
  entityCodes: string[],
  entityIds: string[]
): Promise<RefData> {
  // Query entity_instance table for all referenced entities
  const instances = await db.execute(sql`
    SELECT entity_code, entity_id, entity_instance_name
    FROM app.entity_instance
    WHERE entity_code = ANY(${entityCodes})
      AND entity_id = ANY(${entityIds})
  `);

  // Build lookup table
  const refData: RefData = {};
  for (const inst of instances) {
    if (!refData[inst.entity_code]) {
      refData[inst.entity_code] = {};
    }
    refData[inst.entity_code][inst.entity_id] = inst.entity_instance_name;
  }
  return refData;
}
```

### API Response Structure

```json
{
  "data": [
    {
      "id": "uuid-project-1",
      "name": "Kitchen Renovation",
      "manager__employee_id": "uuid-james",
      "sponsor__employee_id": "uuid-sarah"
    }
  ],
  "ref_data_entityInstance": {
    "employee": {
      "uuid-james": "James Miller",
      "uuid-sarah": "Sarah Johnson"
    }
  },
  "metadata": {
    "viewType": {
      "manager__employee_id": {
        "dtype": "uuid",
        "label": "Manager Employee",
        "renderType": "entityInstanceId",
        "lookupSource": "entityInstance",
        "lookupEntity": "employee",
        "behavior": { "visible": true },
        "style": { "displayField": "name", "linkToEntity": true }
      }
    },
    "editType": {
      "manager__employee_id": {
        "dtype": "uuid",
        "label": "Manager Employee",
        "inputType": "entityInstanceId",
        "lookupSource": "entityInstance",
        "lookupEntity": "employee",
        "behavior": { "editable": true }
      }
    }
  }
}
```

---

## 3. Frontend RefData Resolver

**File:** `apps/web/src/lib/refDataResolver.ts`

### Type Definitions

```typescript
export interface FieldMetadata {
  key: string;
  renderType?: string;    // 'entityInstanceId', 'currency', 'badge', etc.
  inputType?: string;     // 'entityInstanceId', 'currency', 'select', etc.
  lookupSource?: 'entityInstance' | 'datalabel';
  lookupEntity?: string;  // 'employee', 'business', 'project', etc.
  dtype?: string;
}

export interface RefData {
  [entityCode: string]: {
    [uuid: string]: string;  // uuid → display name
  };
}
```

### Detection Functions

```typescript
// Check if field is an entity reference
export function isEntityReferenceField(fieldMeta: FieldMetadata | undefined): boolean {
  if (!fieldMeta) return false;
  return (
    fieldMeta.renderType === 'entityInstanceId' ||
    fieldMeta.renderType === 'entityInstanceIds' ||
    fieldMeta.inputType === 'entityInstanceId' ||
    fieldMeta.inputType === 'entityInstanceIds' ||
    fieldMeta.lookupSource === 'entityInstance'
  );
}

// Get entity code from metadata
export function getEntityCodeFromMetadata(fieldMeta: FieldMetadata | undefined): string | null {
  if (!fieldMeta) return null;
  return fieldMeta.lookupEntity ?? null;
}

// Check if array reference
export function isArrayReferenceField(fieldMeta: FieldMetadata | undefined): boolean {
  if (!fieldMeta) return false;
  return (
    fieldMeta.renderType === 'entityInstanceIds' ||
    fieldMeta.inputType === 'entityInstanceIds' ||
    fieldMeta.dtype === 'array[uuid]'
  );
}
```

### Resolution Functions

```typescript
// Single UUID → name
export function resolveEntityName(
  uuid: string | null | undefined,
  entityCode: string,
  refData: RefData | undefined
): string | undefined {
  if (!uuid || !refData) return undefined;
  return refData[entityCode]?.[uuid];
}

// Array of UUIDs → names
export function resolveEntityNames(
  uuids: string[] | null | undefined,
  entityCode: string,
  refData: RefData | undefined
): string[] {
  if (!uuids || !Array.isArray(uuids) || !refData) return [];
  const entityLookup = refData[entityCode];
  if (!entityLookup) return [];
  return uuids.map(uuid => entityLookup[uuid]).filter(Boolean);
}

// Using metadata (recommended)
export function resolveFieldWithMetadata(
  fieldMeta: FieldMetadata | undefined,
  value: string | string[] | null | undefined,
  refData: RefData | undefined
): string | string[] | undefined {
  if (!value || !refData || !fieldMeta) return undefined;

  const entityCode = getEntityCodeFromMetadata(fieldMeta);
  if (!entityCode) return undefined;

  if (isArrayReferenceField(fieldMeta) && Array.isArray(value)) {
    return resolveEntityNames(value, entityCode, refData);
  }

  if (typeof value === 'string') {
    return resolveEntityName(value, entityCode, refData);
  }

  return undefined;
}
```

---

## 4. React Query Caching Layer

**File:** `apps/web/src/lib/hooks/useRefData.ts`

### useRefData Hook

```typescript
export function useRefData(refData: RefData | undefined): UseRefDataResult {
  // Memoized resolution functions
  const resolveName = useCallback(
    (uuid: string, entityCode: string) =>
      resolveEntityName(uuid, entityCode, refData),
    [refData]
  );

  const resolveFieldDisplay = useCallback(
    (fieldMeta: FieldMetadata, value: string | string[], fallback = 'uuid') =>
      resolveFieldDisplayWithMetadata(fieldMeta, value, refData, fallback),
    [refData]
  );

  return {
    refData,
    hasRefData: !!refData && Object.keys(refData).length > 0,
    resolveName,
    resolveFieldDisplay,
    // ... other methods
  };
}
```

### Cache Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         React Query Cache                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  queryKey: ['entity-list', 'project', { limit: 20, offset: 0 }]             │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  {                                                                      │ │
│  │    data: [...],           // RAW entity data                           │ │
│  │    ref_data_entityInstance: {            // Pre-resolved names                        │ │
│  │      employee: { "uuid-1": "James", "uuid-2": "Sarah" },              │ │
│  │      business: { "uuid-b": "Huron Home" }                              │ │
│  │    },                                                                   │ │
│  │    metadata: { viewType: {...}, editType: {...} }                      │ │
│  │  }                                                                      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  TTL: staleTime: 5 min | gcTime: 30 min                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Format-at-Read Pattern

```typescript
// useFormattedEntityList - transforms on read (memoized)
export function useFormattedEntityList(entityCode: string, params: Params) {
  return useQuery({
    queryKey: ['entity-list', entityCode, params],
    queryFn: () => api.get(`/api/v1/${entityCode}`, { params }),
    select: (response) => ({
      ...response,
      // Transform happens on READ, not on fetch
      // React Query memoizes this transformation
      data: response.data.map(row => ({
        raw: row,
        display: resolveRowWithMetadata(row, fieldMetaMap, response.ref_data_entityInstance)
      }))
    })
  });
}
```

---

## 5. ref_data_entityInstance Source: entity_instance Table

The `ref_data_entityInstance` lookup table is built from the `entity_instance` table - **NOT** from individual entity tables.

### entity_instance Table Structure

```sql
CREATE TABLE app.entity_instance (
  id UUID PRIMARY KEY,
  entity_code VARCHAR(50),        -- 'employee', 'business', 'project'
  entity_id UUID,                 -- The actual entity's UUID
  entity_instance_name VARCHAR,   -- Display name: "James Miller"
  instance_code VARCHAR,          -- Business code: "EMP-001"
  ...
);
```

### ref_data_entityInstance Build Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ref_data_entityInstance Build Flow                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  GET /api/v1/project                                                         │
│       │                                                                      │
│       ▼                                                                      │
│  Step 1: Query primary table                                                 │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  SELECT * FROM app.project WHERE ...                                    │ │
│  │  → Returns: [{ manager__employee_id: "uuid-james", ... }]              │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│       │                                                                      │
│       ▼                                                                      │
│  Step 2: Extract referenced UUIDs from data                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Scan fields with lookupSource: entityInstance                          │ │
│  │  → { employee: ["uuid-james", "uuid-sarah"], business: ["uuid-b"] }    │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│       │                                                                      │
│       ▼                                                                      │
│  Step 3: Query entity_instance table (source of truth for names)             │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  SELECT entity_code, entity_id, entity_instance_name                   │ │
│  │  FROM app.entity_instance                                               │ │
│  │  WHERE (entity_code, entity_id) IN (                                    │ │
│  │    ('employee', 'uuid-james'),                                          │ │
│  │    ('employee', 'uuid-sarah'),                                          │ │
│  │    ('business', 'uuid-b')                                               │ │
│  │  )                                                                      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│       │                                                                      │
│       ▼                                                                      │
│  Step 4: Build ref_data_entityInstance lookup table                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  ref_data_entityInstance = {                                                           │ │
│  │    "employee": { "uuid-james": "James Miller", "uuid-sarah": "Sarah" },│ │
│  │    "business": { "uuid-b": "Huron Home Services" }                      │ │
│  │  }                                                                      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Component Usage

### View Mode (Data Table)

```tsx
function EntityDataTable({ entityCode }: Props) {
  const { data, isLoading } = useEntityInstanceList(entityCode, params);
  const { resolveFieldDisplay, isRefField } = useRefData(data?.ref_data_entityInstance);

  // Get field metadata
  const fieldMeta = data?.metadata?.viewType?.manager__employee_id;

  return (
    <Table>
      {data?.data.map(row => (
        <TableRow key={row.id}>
          <TableCell>
            {isRefField(fieldMeta)
              ? resolveFieldDisplay(fieldMeta, row.manager__employee_id)
              : row.manager__employee_id}
          </TableCell>
        </TableRow>
      ))}
    </Table>
  );
}
```

### Edit Mode (Form)

```tsx
function EntityForm({ entityCode, entityId }: Props) {
  const { data } = useEntityInstance(entityCode, entityId);
  const { isRefField, getEntityCode } = useRefData(data?.ref_data_entityInstance);

  const fieldMeta = data?.metadata?.editType?.manager__employee_id;

  if (isRefField(fieldMeta)) {
    const lookupEntity = getEntityCode(fieldMeta); // "employee"
    return (
      <EntitySelect
        entityCode={lookupEntity}
        value={data?.manager__employee_id}
        onChange={handleChange}
      />
    );
  }

  return <TextInput value={data?.manager__employee_id} />;
}
```

---

## 7. Performance Benefits

### Without ref_data_entityInstance (N+1 Problem)

```
GET /api/v1/project          → 20 projects
GET /api/v1/employee/uuid-1  → resolve manager
GET /api/v1/employee/uuid-2  → resolve manager
GET /api/v1/employee/uuid-3  → resolve manager
...
Total: 21+ API calls, 500ms+ latency
```

### With ref_data_entityInstance (O(1) Lookup)

```
GET /api/v1/project          → 20 projects + ref_data_entityInstance + metadata
ref_data_entityInstance["employee"][uuid]   → instant hash lookup

Total: 1 API call, ~50ms latency
```

### Cache Sharing

```typescript
// Multiple components share same cached data
<ProjectList />      // fetches & caches
<ProjectKanban />    // reads from cache
<ProjectCalendar />  // reads from cache

// All use same:
// - Raw data
// - ref_data_entityInstance lookup table
// - Metadata
```

---

## 8. Cache Upsert Pattern (Not Invalidation)

When an entity is updated, we **upsert** the cache directly instead of invalidating and refetching. This provides instant updates without network requests.

### Cache Upsert Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Cache Upsert Flow                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PATCH /api/v1/employee/:id                                                  │
│  (Update employee name: "James Miller" → "James M. Miller")                  │
│       │                                                                      │
│       ▼                                                                      │
│  Backend: update_entity() transaction                                        │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  1. UPDATE app.employee SET name = 'James M. Miller' WHERE id = ...    │ │
│  │  2. UPDATE app.entity_instance                                         │ │
│  │     SET entity_instance_name = 'James M. Miller'                       │ │
│  │     WHERE entity_code = 'employee' AND entity_id = ...                 │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│       │                                                                      │
│       ▼                                                                      │
│  Backend Response: Returns updated entity + ref_data_entityInstance_update                  │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  {                                                                      │ │
│  │    data: { id: "uuid-james", name: "James M. Miller", ... },           │ │
│  │    ref_data_entityInstance_update: {                                                   │ │
│  │      employee: { "uuid-james": "James M. Miller" }                     │ │
│  │    }                                                                    │ │
│  │  }                                                                      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│       │                                                                      │
│       ▼                                                                      │
│  Frontend: onSuccess - UPSERT cache (no refetch)                             │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  queryClient.setQueriesData(                                            │ │
│  │    { queryKey: ['entity-list'] },  // All entity lists                 │ │
│  │    (oldData) => ({                                                      │ │
│  │      ...oldData,                                                        │ │
│  │      ref_data_entityInstance: mergeRefData(oldData.ref_data_entityInstance, response.ref_data_entityInstance_update)│ │
│  │    })                                                                   │ │
│  │  );                                                                     │ │
│  │                                                                         │ │
│  │  // Instant update - no network request                                │ │
│  │  // "James M. Miller" appears immediately in all cached queries        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Implementation

```typescript
// Frontend mutation hook with cache upsert
const updateEmployee = useMutation({
  mutationFn: (data) => api.patch(`/api/v1/employee/${id}`, data),
  onSuccess: (response) => {
    // Upsert ref_data_entityInstance in ALL cached queries - no refetch needed
    queryClient.setQueriesData(
      { queryKey: ['entity-list'] },
      (oldData: any) => {
        if (!oldData?.ref_data_entityInstance) return oldData;
        return {
          ...oldData,
          ref_data_entityInstance: mergeRefData(oldData.ref_data_entityInstance, response.ref_data_entityInstance_update)
        };
      }
    );

    // Also update the specific entity instance cache
    queryClient.setQueryData(
      ['entity-instance', 'employee', id],
      response.data
    );
  }
});
```

### Benefits of Upsert vs Invalidation

| Aspect | Invalidation | Upsert |
|--------|--------------|--------|
| Network requests | Refetch all affected queries | Zero |
| Latency | 100-500ms per query | Instant (~1ms) |
| User experience | Loading states flash | Seamless update |
| Bandwidth | Re-downloads all data | Only mutation response |
| Consistency | Eventually consistent | Immediately consistent |

---

## 10. Data Flow Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         End-to-End Data Flow                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. YAML CONFIG                                                              │
│     ────────────                                                             │
│     pattern-mapping.yaml    → manager__employee_id matches entityInstance_Id │
│     view-type-mapping.yaml  → renderType: entityInstanceId                   │
│     edit-type-mapping.yaml  → inputType: entityInstanceId, lookupSource      │
│                                                                              │
│  2. BACKEND FORMATTER                                                        │
│     ─────────────────                                                        │
│     Field: manager__employee_id                                              │
│     YAML provides: lookupSource: entityInstance                              │
│     Backend extracts: lookupEntity: "employee"                               │
│                                                                              │
│  3. API RESPONSE                                                             │
│     ────────────                                                             │
│     {                                                                        │
│       data: [{ manager__employee_id: "uuid-james" }],                       │
│       ref_data_entityInstance: { employee: { "uuid-james": "James Miller" } },             │
│       metadata: {                                                            │
│         viewType: { manager__employee_id: {                                 │
│           renderType: "entityInstanceId",                                    │
│           lookupEntity: "employee"                                           │
│         }}                                                                   │
│       }                                                                      │
│     }                                                                        │
│                                                                              │
│  4. REACT QUERY CACHE                                                        │
│     ─────────────────                                                        │
│     Stores RAW response (data + ref_data_entityInstance + metadata)                        │
│     TTL: 5 min stale, 30 min gc                                             │
│                                                                              │
│  5. FRONTEND RESOLVER                                                        │
│     ─────────────────                                                        │
│     isEntityReferenceField(fieldMeta) → true                                │
│     getEntityCodeFromMetadata(fieldMeta) → "employee"                       │
│     ref_data_entityInstance["employee"]["uuid-james"] → "James Miller"                     │
│                                                                              │
│  6. COMPONENT RENDER                                                         │
│     ────────────────                                                         │
│     View mode: Display "James Miller" as clickable link                     │
│     Edit mode: Render EntitySelect dropdown                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## File References

| File | Purpose |
|------|---------|
| `apps/api/src/services/pattern-mapping.yaml` | Field name pattern detection |
| `apps/api/src/services/view-type-mapping.yaml` | View mode metadata (renderType) |
| `apps/api/src/services/edit-type-mapping.yaml` | Edit mode metadata (inputType) |
| `apps/api/src/services/backend-formatter.service.ts` | Metadata generation |
| `apps/api/src/services/entity-infrastructure.service.ts` | build_ref_data_entityInstance() |
| `apps/web/src/lib/refDataResolver.ts` | Frontend resolution utilities |
| `apps/web/src/lib/hooks/useRefData.ts` | React hook for ref_data_entityInstance |
| `apps/web/src/lib/hooks/useEntityQuery.ts` | React Query hooks |

---

**Version:** 8.3.1 | **Updated:** 2025-11-27
