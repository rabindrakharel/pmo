# Entity Reference Resolution Pattern

**Version:** 11.2.0 | **Pattern Type:** Backend-for-Frontend (BFF) + Unified Cache | **Updated:** 2025-11-28

---

## 1. Problem Statement

### The UUID Display Problem

In enterprise applications with relational data models, database tables store **foreign key references as UUIDs**. However, users don't understand UUIDs—they need to see human-readable names.

**Example Database Columns:**

| Column Name | Stored Value | User Expectation |
|-------------|--------------|------------------|
| `manager__employee_id` | `8260b1b0-5efc-4611-ad33-ee76c0cf7f13` | "James Miller" |
| `sponsor__employee_id` | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` | "Sarah Johnson" |
| `stakeholder__employee_ids` | `["uuid-1", "uuid-2", "uuid-3"]` | "James, Sarah, Michael" |
| `business_id` | `f0e9d8c7-b6a5-4321-fedc-ba0987654321` | "Huron Home Services" |

### The Challenge

How do we translate these UUIDs into meaningful entity names across:

1. **View Mode** - Displaying data in tables, detail views, cards
2. **Edit Mode** - Populating dropdown/select options for users to choose from

**Constraints:**
- Backend owns the database schema and knows field semantics
- Frontend should NOT parse field names to guess their meaning
- Resolution must work for both single references (`_id`) and array references (`_ids`)
- Performance must scale (N+1 query problem, cache efficiency)
- View mode and edit mode must show consistent data

---

## 2. Design Pattern Overview

### Pattern: Backend-Driven Reference Resolution with Unified Cache

This pattern combines three architectural concepts:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│           ENTITY REFERENCE RESOLUTION PATTERN (v11.0.0)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  LAYER 1: PATTERN MATCHING (Backend Only)                           │    │
│  │                                                                      │    │
│  │  YAML Configuration detects field types from column names:          │    │
│  │  • "*__*_id"  → entityInstanceId (single reference)                 │    │
│  │  • "*__*_ids" → entityInstanceIds (array reference)                 │    │
│  │  • "*_id"     → entityInstanceId (simple reference)                 │    │
│  │                                                                      │    │
│  │  Extracts entity code: "manager__employee_id" → "employee"          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              │                                               │
│                              ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  LAYER 2: METADATA GENERATION (Backend Formatter Service)           │    │
│  │                                                                      │    │
│  │  Generates field metadata with lookup instructions:                 │    │
│  │  {                                                                   │    │
│  │    renderType: "entityInstanceId",                                  │    │
│  │    inputType: "entityInstanceId",                                   │    │
│  │    lookupEntity: "employee",                                        │    │
│  │    lookupSource: "entityInstance"                                   │    │
│  │  }                                                                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              │                                               │
│                              ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  LAYER 3: REFERENCE DATA BUNDLING (ref_data_entityInstance)         │    │
│  │                                                                      │    │
│  │  Backend scans response data, extracts UUIDs, batch resolves names: │    │
│  │  {                                                                   │    │
│  │    "employee": { "uuid-james": "James Miller", ... },               │    │
│  │    "business": { "uuid-huron": "Huron Home Services", ... }         │    │
│  │  }                                                                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              │                                               │
│                              ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  LAYER 4: UNIFIED CACHE (Frontend React Query)                      │    │
│  │                                                                      │    │
│  │  Single cache serves both view mode and edit mode:                  │    │
│  │  ['ref_data_entityInstance', 'employee'] = { uuid: name }          │    │
│  │                                                                      │    │
│  │  Cache population sources:                                          │    │
│  │  • Login prefetch (common entities)                                 │    │
│  │  • API response upsert (incremental)                                │    │
│  │  • On-demand fetch (cache miss)                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              │                                               │
│                              ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  LAYER 5: FORMAT-AT-READ (Frontend Rendering)                       │    │
│  │                                                                      │    │
│  │  React Query's `select` option transforms raw → formatted on read:  │    │
│  │  • Cache stores RAW data (small, canonical)                         │    │
│  │  • Formatting happens on component render (memoized)                │    │
│  │  • UUID → Name resolution via unified cache lookup                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Key Design Principles

### 3.1 Backend is Single Source of Truth

The backend owns field semantics. Frontend does NOT:
- Parse field names to detect types
- Guess which entity a `_id` field references
- Hardcode field-to-entity mappings

**Frontend uses metadata:**

```
✗ WRONG (Frontend pattern detection):
  if (fieldName.endsWith('_id')) → assume entity reference

✓ CORRECT (Metadata-driven):
  if (metadata.renderType === 'entityInstanceId') → use metadata.lookupEntity
```

### 3.2 Unified Cache for View and Edit

One cache serves both display and dropdown population:

```
┌───────────────────────────────────────────────────────────────────────────┐
│                         UNIFIED CACHE BENEFIT                              │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  BEFORE (v8.3.1):                        AFTER (v8.3.2+):                  │
│  ─────────────────                        ─────────────────                │
│                                                                            │
│  ┌─────────────┐  ┌─────────────┐        ┌─────────────────────────────┐  │
│  │ View Cache  │  │ Edit Cache  │        │      Unified Cache          │  │
│  │             │  │             │        │                             │  │
│  │ per-response│  │ useEntity   │   ──▶  │ ['ref_data_entityInstance']│  │
│  │ ref_data    │  │ Lookup()    │        │                             │  │
│  └─────────────┘  └─────────────┘        └─────────────────────────────┘  │
│                                                                            │
│  Problems:                                Benefits:                        │
│  • 2x memory                              • 1x memory                      │
│  • Data can diverge                       • Always consistent              │
│  • Separate fetch patterns                • Shared fetch patterns          │
│                                                                            │
└───────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Format-at-Read, Not Format-at-Fetch

Data is stored raw in cache, formatted when read:

```
┌───────────────────────────────────────────────────────────────────────────┐
│                       FORMAT-AT-READ PATTERN                               │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  API Response                                                              │
│       │                                                                    │
│       ▼                                                                    │
│  React Query Cache (RAW DATA)                                              │
│  • data: [{ manager__employee_id: "uuid-james", ... }]                     │
│  • ref_data_entityInstance: { employee: { "uuid-james": "James" } }        │
│       │                                                                    │
│       │ `select` option (ON READ)                                          │
│       ▼                                                                    │
│  formatDataset(data, metadata, refData)                                    │
│       │                                                                    │
│       ▼                                                                    │
│  FormattedRow[] (MEMOIZED)                                                 │
│  {                                                                         │
│    raw: { manager__employee_id: "uuid-james" },                            │
│    display: { manager__employee_id: "James Miller" },                      │
│    styles: {}                                                              │
│  }                                                                         │
│                                                                            │
│  BENEFITS:                                                                 │
│  • Cache stores small raw data                                             │
│  • Re-formatting is instant (memoized by React Query)                      │
│  • Datalabel/setting changes reflect immediately                           │
│                                                                            │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 4. End-to-End Data Flow

### Phase 1: Backend Pattern Matching (YAML Configuration)

Database column names follow conventions that encode their semantics:

**pattern-mapping.yaml:**

```yaml
patterns:
  # Entity reference (single)
  - pattern: "*__*_id"
    exact: false
    fieldBusinessType: entityInstance_Id    # Internal identifier

  # Entity reference (array)
  - pattern: "*__*_ids"
    exact: false
    fieldBusinessType: entityInstance_Ids   # Internal identifier

  # Simple reference
  - pattern: "*_id"
    exact: false
    fieldBusinessType: entityInstance_Id
```

**view-type-mapping.yaml:**

```yaml
entityInstance_Id:                          # Maps internal → output
  entityListOfInstancesTable:
    renderType: entityInstanceId            # Output format (camelCase)
    lookupSource: entityInstance
  entityInstanceFormContainer:
    renderType: entityInstanceId
    lookupSource: entityInstance
```

**edit-type-mapping.yaml:**

```yaml
entityInstance_Id:
  lookupSource: entityInstance
  entityListOfInstancesTable:
    inputType: entityInstanceId             # Output format (camelCase)
  entityInstanceFormContainer:
    inputType: entityInstanceId
```

### Phase 2: Backend Formatter Service (Metadata Generation)

The Backend Formatter Service reads YAML configs and generates field metadata:

**Input:** Column name `manager__employee_id`

**Processing:**
1. Match pattern `*__*_id` → fieldBusinessType: `entityInstance_Id`
2. Extract entity code: `manager__employee_id` → `employee`
3. Apply view-type-mapping → `renderType: entityInstanceId`
4. Apply edit-type-mapping → `inputType: entityInstanceId`
5. Set `lookupEntity: employee`

**Output (in API response):**

```
metadata.entityListOfInstancesTable.viewType.manager__employee_id = {
  dtype: "uuid",
  label: "Manager",
  renderType: "entityInstanceId",
  lookupSource: "entityInstance",
  lookupEntity: "employee"
}

metadata.entityListOfInstancesTable.editType.manager__employee_id = {
  dtype: "uuid",
  label: "Manager",
  inputType: "entityInstanceId",
  lookupSource: "entityInstance",
  lookupEntity: "employee"
}
```

### Phase 3: Reference Data Building (ref_data_entityInstance)

The Entity Infrastructure Service scans response data and builds a lookup table:

**Input:** Data rows containing UUID references

```
data = [
  { id: "proj-1", manager__employee_id: "uuid-james", business_id: "uuid-huron" },
  { id: "proj-2", manager__employee_id: "uuid-sarah", business_id: "uuid-huron" }
]
```

**Processing:**
1. Scan all fields ending in `_id` or `_ids`
2. Collect unique UUIDs per entity type
3. Batch query `entity_instance` table
4. Build lookup dictionary

**Output:**

```
ref_data_entityInstance = {
  "employee": {
    "uuid-james": "James Miller",
    "uuid-sarah": "Sarah Johnson"
  },
  "business": {
    "uuid-huron": "Huron Home Services"
  }
}
```

### Phase 4: Complete API Response

```
{
  "data": [
    {
      "id": "uuid-project-1",
      "name": "Kitchen Renovation",
      "manager__employee_id": "uuid-james",
      "sponsor__employee_id": "uuid-sarah",
      "business_id": "uuid-huron",
      "dl__project_stage": "planning"
    }
  ],

  "ref_data_entityInstance": {
    "employee": {
      "uuid-james": "James Miller",
      "uuid-sarah": "Sarah Johnson"
    },
    "business": {
      "uuid-huron": "Huron Home Services"
    }
  },

  "metadata": {
    "entityListOfInstancesTable": {
      "viewType": {
        "manager__employee_id": {
          "dtype": "uuid",
          "label": "Manager",
          "renderType": "entityInstanceId",
          "lookupSource": "entityInstance",
          "lookupEntity": "employee"
        },
        "business_id": {
          "dtype": "uuid",
          "label": "Business",
          "renderType": "entityInstanceId",
          "lookupSource": "entityInstance",
          "lookupEntity": "business"
        }
      },
      "editType": {
        "manager__employee_id": {
          "dtype": "uuid",
          "label": "Manager",
          "inputType": "entityInstanceId",
          "lookupSource": "entityInstance",
          "lookupEntity": "employee"
        }
      }
    }
  },

  "total": 45,
  "limit": 20,
  "offset": 0
}
```

---

## 5. Frontend Cache Architecture

### Cache Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REACT QUERY CACHE STRUCTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  UNIFIED REFERENCE CACHE                                            │    │
│  │  Cache Key: ['ref_data_entityInstance', entityCode]                 │    │
│  │  TTL: gcTime=30min                                                  │    │
│  │                                                                      │    │
│  │  ['ref_data_entityInstance', 'employee']                            │    │
│  │    = { "uuid-james": "James Miller", "uuid-sarah": "Sarah" }        │    │
│  │                                                                      │    │
│  │  ['ref_data_entityInstance', 'business']                            │    │
│  │    = { "uuid-huron": "Huron Home Services" }                        │    │
│  │                                                                      │    │
│  │  ['ref_data_entityInstance', 'project']                             │    │
│  │    = { "uuid-proj1": "Kitchen Renovation" }                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  ENTITY DATA CACHE                                                  │    │
│  │  Cache Key: ['entity-list', entityCode, params]                     │    │
│  │  Contains: { data, ref_data_entityInstance, metadata }              │    │
│  │                                                                      │    │
│  │  ['entity-list', 'project', { limit: 20 }]                          │    │
│  │    = Full API response (raw data)                                   │    │
│  │                                                                      │    │
│  │  On fetch: UPSERTS ref_data to unified cache                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Cache Population Sources

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CACHE POPULATION SOURCES                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SOURCE 1: Login Prefetch (v9.1.1: Awaited)                                  │
│  ──────────────────────────────────────────                                  │
│                                                                              │
│  User logs in                                                                │
│       │                                                                      │
│       ▼                                                                      │
│  AuthContext.login()                                                         │
│       │                                                                      │
│       ▼                                                                      │
│  await prefetchRefDataEntityInstances(queryClient, [                         │
│    'employee', 'project', 'business', 'office', 'role', 'cust'             │
│  ])                                                                          │
│       │                                                                      │
│       ▼                                                                      │
│  Parallel API calls, results stored in unified cache via setQueryData        │
│  → Authoritative data replaces any partial upsert data                       │
│  → Dropdowns are instant when user opens forms                               │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════════ │
│                                                                              │
│  SOURCE 2: API Response Upsert (Incremental Merge)                           │
│  ─────────────────────────────────────────────────                           │
│                                                                              │
│  User views project list                                                     │
│       │                                                                      │
│       ▼                                                                      │
│  GET /api/v1/project                                                         │
│       │                                                                      │
│       ▼                                                                      │
│  Response includes ref_data_entityInstance                                   │
│       │                                                                      │
│       ▼                                                                      │
│  upsertRefDataEntityInstance(queryClient, ref_data)                          │
│       │                                                                      │
│       ▼                                                                      │
│  FOR EACH entityCode IN ref_data:                                            │
│    queryClient.setQueryData(                                                 │
│      ['ref_data_entityInstance', entityCode],                                │
│      (existing) => ({ ...existing, ...newLookups })  // MERGE                │
│    )                                                                         │
│                                                                              │
│  → Cache grows incrementally as user browses                                 │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════════ │
│                                                                              │
│  SOURCE 3: On-Demand Fetch (Cache Miss)                                      │
│  ──────────────────────────────────────                                      │
│                                                                              │
│  User opens dropdown for entity not yet cached                               │
│       │                                                                      │
│       ▼                                                                      │
│  useRefDataEntityInstanceOptions('worksite')                                 │
│       │                                                                      │
│       ▼                                                                      │
│  Check cache: ['ref_data_entityInstance', 'worksite']                       │
│       │                                                                      │
│       ▼                                                                      │
│  CACHE MISS                                                                  │
│       │                                                                      │
│       ▼                                                                      │
│  GET /api/v1/entity/worksite/entity-instance                                │
│       │                                                                      │
│       ▼                                                                      │
│  Store result in unified cache                                               │
│       │                                                                      │
│       ▼                                                                      │
│  Return as dropdown options                                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      COMPONENT ARCHITECTURE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        BACKEND LAYER                                │    │
│  │                                                                      │    │
│  │  ┌───────────────────┐   ┌────────────────────┐   ┌──────────────┐  │    │
│  │  │ YAML Configs      │   │ Backend Formatter  │   │ Entity Infra │  │    │
│  │  │                   │   │ Service            │   │ Service      │  │    │
│  │  │ pattern-mapping   │──▶│                    │   │              │  │    │
│  │  │ view-type-mapping │   │ Generates metadata │   │ Builds       │  │    │
│  │  │ edit-type-mapping │   │ per field          │   │ ref_data     │  │    │
│  │  └───────────────────┘   └────────────────────┘   └──────────────┘  │    │
│  │                                   │                       │          │    │
│  │                                   └───────────┬───────────┘          │    │
│  │                                               │                      │    │
│  │                                               ▼                      │    │
│  │                                    ┌──────────────────┐              │    │
│  │                                    │ API Response     │              │    │
│  │                                    │ { data,          │              │    │
│  │                                    │   ref_data,      │              │    │
│  │                                    │   metadata }     │              │    │
│  │                                    └──────────────────┘              │    │
│  └──────────────────────────────────────────────│───────────────────────┘    │
│                                                 │                            │
│                                                 ▼                            │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                       FRONTEND LAYER                                │    │
│  │                                                                      │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │  REACT QUERY CACHE LAYER                                    │    │    │
│  │  │                                                              │    │    │
│  │  │  Entity Query Cache          Unified Reference Cache         │    │    │
│  │  │  ['entity-list', ...]        ['ref_data_entityInstance', *] │    │    │
│  │  │          │                              ▲                    │    │    │
│  │  │          │    upsertRefDataCache()      │                    │    │    │
│  │  │          └──────────────────────────────┘                    │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  │                           │                │                         │    │
│  │              ┌────────────┘                └────────────┐            │    │
│  │              │                                          │            │    │
│  │              ▼                                          ▼            │    │
│  │  ┌─────────────────────────┐          ┌─────────────────────────┐   │    │
│  │  │  HOOKS LAYER            │          │  HOOKS LAYER            │   │    │
│  │  │                         │          │                         │   │    │
│  │  │  useFormattedEntityList │          │  useRefDataEntityInst.  │   │    │
│  │  │  ─────────────────────  │          │  Options()              │   │    │
│  │  │  • Fetches entity data  │          │  ─────────────────────  │   │    │
│  │  │  • Upserts ref_data     │          │  • Returns dropdown     │   │    │
│  │  │  • select: formatDataset│          │    options from cache   │   │    │
│  │  │                         │          │                         │   │    │
│  │  │  useRefData             │          │  useRefDataEntityInst.  │   │    │
│  │  │  ───────────            │          │  Resolver()             │   │    │
│  │  │  • Per-response ref_data│          │  ─────────────────────  │   │    │
│  │  │  • resolveFieldDisplay()│          │  • resolveName() from   │   │    │
│  │  │                         │          │    unified cache        │   │    │
│  │  └─────────────────────────┘          └─────────────────────────┘   │    │
│  │              │                                          │            │    │
│  │              ▼                                          ▼            │    │
│  │  ┌─────────────────────────┐          ┌─────────────────────────┐   │    │
│  │  │  COMPONENT LAYER        │          │  COMPONENT LAYER        │   │    │
│  │  │                         │          │                         │   │    │
│  │  │  VIEW MODE              │          │  EDIT MODE              │   │    │
│  │  │  ──────────             │          │  ─────────              │   │    │
│  │  │  EntityListOfInstancesTable        │          │  EntitySelect           │   │    │
│  │  │  EntityDetailView       │          │  EntityMultiSelect      │   │    │
│  │  │  EntityInstanceFormContainer    │          │  EntityInstanceFormContainer    │   │    │
│  │  │                         │          │                         │   │    │
│  │  │  Displays: "James"      │          │  Shows: [dropdown]      │   │    │
│  │  └─────────────────────────┘          └─────────────────────────┘   │    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Sequence Diagrams

### 7.1 View Mode: User Views Project List

```
┌─────────┐     ┌──────────────┐     ┌──────────────┐     ┌───────────────┐     ┌─────────┐
│  User   │     │EntityListOfInstancesTable│    │useFormatted  │     │ Unified Cache │     │ Backend │
│         │     │              │     │EntityList()  │     │               │     │         │
└────┬────┘     └──────┬───────┘     └──────┬───────┘     └───────┬───────┘     └────┬────┘
     │                 │                    │                     │                  │
     │ Navigate to     │                    │                     │                  │
     │ /projects       │                    │                     │                  │
     │────────────────▶│                    │                     │                  │
     │                 │                    │                     │                  │
     │                 │ Render component   │                     │                  │
     │                 │───────────────────▶│                     │                  │
     │                 │                    │                     │                  │
     │                 │                    │ Check cache         │                  │
     │                 │                    │ ['entity-list',     │                  │
     │                 │                    │  'project', params] │                  │
     │                 │                    │────────────────────▶│                  │
     │                 │                    │                     │                  │
     │                 │                    │ CACHE MISS          │                  │
     │                 │                    │◀────────────────────│                  │
     │                 │                    │                     │                  │
     │                 │                    │ GET /api/v1/project │                  │
     │                 │                    │────────────────────────────────────────▶
     │                 │                    │                     │                  │
     │                 │                    │                     │  { data: [...],  │
     │                 │                    │                     │    ref_data_     │
     │                 │                    │                     │    entityInst.,  │
     │                 │                    │                     │    metadata }    │
     │                 │                    │◀────────────────────────────────────────
     │                 │                    │                     │                  │
     │                 │                    │ Store in entity     │                  │
     │                 │                    │ cache               │                  │
     │                 │                    │────────────────────▶│                  │
     │                 │                    │                     │                  │
     │                 │                    │ UPSERT ref_data     │                  │
     │                 │                    │ to unified cache    │                  │
     │                 │                    │────────────────────▶│                  │
     │                 │                    │                     │                  │
     │                 │                    │ select: transform   │                  │
     │                 │                    │ formatDataset()     │                  │
     │                 │                    │                     │                  │
     │                 │ FormattedRow[]     │                     │                  │
     │                 │◀───────────────────│                     │                  │
     │                 │                    │                     │                  │
     │                 │ Render table with  │                     │                  │
     │                 │ display values     │                     │                  │
     │                 │ "James Miller"     │                     │                  │
     │◀────────────────│                    │                     │                  │
     │                 │                    │                     │                  │
     │ See table with  │                    │                     │                  │
     │ names, not UUIDs│                    │                     │                  │
```

### 7.2 Edit Mode: User Opens Manager Dropdown

```
┌─────────┐     ┌──────────────┐     ┌──────────────┐     ┌───────────────┐
│  User   │     │ EntitySelect │     │useRefDataEnt.│     │ Unified Cache │
│         │     │              │     │Inst.Options()│     │               │
└────┬────┘     └──────┬───────┘     └──────┬───────┘     └───────┬───────┘
     │                 │                    │                     │
     │ Click manager   │                    │                     │
     │ dropdown        │                    │                     │
     │────────────────▶│                    │                     │
     │                 │                    │                     │
     │                 │ Request options    │                     │
     │                 │ for 'employee'     │                     │
     │                 │───────────────────▶│                     │
     │                 │                    │                     │
     │                 │                    │ Check cache         │
     │                 │                    │ ['ref-data-entity-  │
     │                 │                    │  instance','employee│
     │                 │                    │────────────────────▶│
     │                 │                    │                     │
     │                 │                    │                     │
     │                 │    ┌───────────────┴──────────────────┐  │
     │                 │    │  CACHE HIT!                      │  │
     │                 │    │  (from earlier project list      │  │
     │                 │    │   API response upsert)           │  │
     │                 │    └───────────────┬──────────────────┘  │
     │                 │                    │                     │
     │                 │                    │ Return cached       │
     │                 │                    │ { uuid: name }      │
     │                 │                    │◀────────────────────│
     │                 │                    │                     │
     │                 │                    │ Transform to        │
     │                 │                    │ options format      │
     │                 │                    │                     │
     │                 │ options = [        │                     │
     │                 │  { value: uuid,    │                     │
     │                 │    label: "James" }│                     │
     │                 │ ]                  │                     │
     │                 │◀───────────────────│                     │
     │                 │                    │                     │
     │                 │ Render dropdown    │                     │
     │◀────────────────│                    │                     │
     │                 │                    │                     │
     │ See populated   │                    │                     │
     │ dropdown with   │                    │                     │
     │ employee names  │                    │                     │
```

### 7.3 Edit Mode: Cache Miss (First Access)

```
┌─────────┐     ┌──────────────┐     ┌──────────────┐     ┌───────────────┐     ┌─────────┐
│  User   │     │ EntitySelect │     │useRefDataEnt.│     │ Unified Cache │     │ Backend │
│         │     │              │     │Inst.Options()│     │               │     │         │
└────┬────┘     └──────┬───────┘     └──────┬───────┘     └───────┬───────┘     └────┬────┘
     │                 │                    │                     │                  │
     │ Click worksite  │                    │                     │                  │
     │ dropdown        │                    │                     │                  │
     │────────────────▶│                    │                     │                  │
     │                 │                    │                     │                  │
     │                 │ Request options    │                     │                  │
     │                 │ for 'worksite'     │                     │                  │
     │                 │───────────────────▶│                     │                  │
     │                 │                    │                     │                  │
     │                 │                    │ Check cache         │                  │
     │                 │                    │────────────────────▶│                  │
     │                 │                    │                     │                  │
     │                 │                    │ CACHE MISS          │                  │
     │                 │                    │ (worksite never     │                  │
     │                 │                    │  fetched before)    │                  │
     │                 │                    │◀────────────────────│                  │
     │                 │                    │                     │                  │
     │                 │ isLoading: true    │                     │                  │
     │◀────────────────│                    │                     │                  │
     │                 │                    │                     │                  │
     │ See loading     │                    │ GET /api/v1/entity/ │                  │
     │ spinner         │                    │ worksite/           │                  │
     │                 │                    │ entity-instance     │                  │
     │                 │                    │────────────────────────────────────────▶
     │                 │                    │                     │                  │
     │                 │                    │                     │ [{ id, name }]   │
     │                 │                    │◀────────────────────────────────────────
     │                 │                    │                     │                  │
     │                 │                    │ Store in cache      │                  │
     │                 │                    │────────────────────▶│                  │
     │                 │                    │                     │                  │
     │                 │ options = [...]    │                     │                  │
     │                 │◀───────────────────│                     │                  │
     │                 │                    │                     │                  │
     │◀────────────────│                    │                     │                  │
     │ See populated   │                    │                     │                  │
     │ dropdown        │                    │                     │                  │
```

---

## 8. User Interaction Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    USER INTERACTION FLOW                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. USER LOGS IN                                                             │
│     │                                                                        │
│     ▼                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ AuthContext prefetches common entities:                              │   │
│  │ employee, project, business, office, role, cust                     │   │
│  │                                                                       │   │
│  │ Cache: ['ref_data_entityInstance', 'employee'] = { populated }      │   │
│  │ Cache: ['ref_data_entityInstance', 'project'] = { populated }       │   │
│  │ Cache: ['ref_data_entityInstance', 'business'] = { populated }      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│     │                                                                        │
│     ▼                                                                        │
│  2. USER NAVIGATES TO PROJECT LIST                                           │
│     │                                                                        │
│     ▼                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ API Response includes:                                               │   │
│  │ • data: [{ manager__employee_id: "uuid-james", ... }]               │   │
│  │ • ref_data_entityInstance: { employee: { "uuid-james": "James" } }  │   │
│  │ • metadata: { viewType: { manager__employee_id: { ... } } }         │   │
│  │                                                                       │   │
│  │ Frontend:                                                             │   │
│  │ • Upserts ref_data into unified cache (MERGE with existing)          │   │
│  │ • Formats data using metadata: "uuid-james" → "James Miller"        │   │
│  │ • Renders table with human-readable names                            │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│     │                                                                        │
│     ▼                                                                        │
│  3. USER SEES TABLE WITH NAMES (NOT UUIDs)                                   │
│     │                                                                        │
│     │ ┌─────────────────────────────────────────────────────────────────┐   │
│     │ │  Project Name      │ Manager      │ Business             │ ... │   │
│     │ ├─────────────────────────────────────────────────────────────────┤   │
│     │ │  Kitchen Reno      │ James Miller │ Huron Home Services  │ ... │   │
│     │ │  Bathroom Update   │ Sarah Johnson│ Huron Home Services  │ ... │   │
│     │ └─────────────────────────────────────────────────────────────────┘   │
│     │                                                                        │
│     ▼                                                                        │
│  4. USER CLICKS EDIT ON A PROJECT                                            │
│     │                                                                        │
│     ▼                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ EntityInstanceFormContainer renders form with:                               │   │
│  │ • field.type === 'entityInstanceId' (from metadata)                 │   │
│  │ • field.lookupEntity === 'employee' (from metadata)                 │   │
│  │                                                                       │   │
│  │ Renders EntitySelect component for manager field                     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│     │                                                                        │
│     ▼                                                                        │
│  5. USER CLICKS MANAGER DROPDOWN                                             │
│     │                                                                        │
│     ▼                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ EntitySelect uses useRefDataEntityInstanceOptions('employee')        │   │
│  │                                                                       │   │
│  │ Check cache: ['ref_data_entityInstance', 'employee']               │   │
│  │ → CACHE HIT (from login prefetch + API response upsert)             │   │
│  │                                                                       │   │
│  │ Instant dropdown population with employee names                      │   │
│  │ NO additional network request!                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│     │                                                                        │
│     ▼                                                                        │
│  6. USER SELECTS A DIFFERENT MANAGER                                         │
│     │                                                                        │
│     ▼                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ EntitySelect fires onChange(uuid, label)                             │   │
│  │ Form state updated with new UUID                                     │   │
│  │ Display shows selected name from cache                               │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Interface Definitions

### Backend Response Structure

```
EntityListResponse {
  data: EntityRow[]                           // Raw entity data with UUID references
  ref_data_entityInstance: RefData            // Lookup table: { entityCode: { uuid: name } }
  metadata: EntityMetadata                    // Field rendering/editing instructions
  total: number
  limit: number
  offset: number
}

RefData {
  [entityCode: string]: {                     // e.g., "employee", "business"
    [uuid: string]: string                    // e.g., "uuid-james": "James Miller"
  }
}

EntityMetadata {
  entityListOfInstancesTable: ComponentMetadata          // Metadata per component
  entityInstanceFormContainer: ComponentMetadata
  // ... other components
}

ComponentMetadata {
  viewType: { [fieldKey: string]: ViewFieldMetadata }
  editType: { [fieldKey: string]: EditFieldMetadata }
}

ViewFieldMetadata {
  dtype: "str" | "float" | "int" | "bool" | "uuid" | "date" | "timestamp"
  label: string
  renderType: string                          // "entityInstanceId" for references
  lookupSource: "entityInstance" | "datalabel"
  lookupEntity: string                        // Entity code, e.g., "employee"
  behavior: { visible, sortable, filterable }
  style: { width, align, ... }
}

EditFieldMetadata {
  dtype: string
  label: string
  inputType: string                           // "entityInstanceId" for references
  lookupSource: "entityInstance" | "datalabel"
  lookupEntity: string                        // Entity code, e.g., "employee"
  behavior: { editable }
  validation: { required, min, max, pattern }
}
```

### Frontend Types

```
FormattedRow<T> {
  raw: T                                      // Original data (for mutations)
  display: { [key: string]: string }          // Pre-formatted display values
  styles: { [key: string]: string }           // CSS classes (for badges)
}

DropdownOption {
  value: string                               // UUID
  label: string                               // Display name
}

UseRefDataEntityInstanceOptionsResult {
  options: DropdownOption[]                   // Dropdown options
  lookup: { [uuid: string]: string }          // Quick lookup map
  isLoading: boolean
  error: Error | null
}

UseRefDataEntityInstanceResolverResult {
  resolveName: (entityCode: string, uuid: string) => string | undefined
  resolveNames: (entityCode: string, uuids: string[]) => string[]
  hasCachedData: (entityCode: string) => boolean
}
```

---

## 10. Benefits Summary

| Aspect | Benefit |
|--------|---------|
| **Separation of Concerns** | Backend owns field semantics, frontend is a pure renderer |
| **Performance** | O(1) name resolution via lookup table, no N+1 queries |
| **Consistency** | View mode and edit mode always show same data |
| **Cache Efficiency** | Single unified cache, incremental population, merge strategy |
| **Developer Experience** | No field name parsing, metadata-driven rendering |
| **Scalability** | Pattern works for any entity type, any reference field |
| **Maintainability** | YAML configs, no hardcoded mappings in frontend |

---

## 11. Race Condition Fix (v9.1.1)

### Problem: Prefetch + Upsert Race Condition

A race condition occurred where dropdowns showed only 1 employee instead of 250+:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    RACE CONDITION (BEFORE v9.1.1)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  TIMELINE:                                                                   │
│  ─────────                                                                   │
│                                                                              │
│  T1: Login completes                                                         │
│       │                                                                      │
│       ▼                                                                      │
│  T2: prefetchRefDataEntityInstances() starts (fire-and-forget, NOT awaited)  │
│       │                                                                      │
│       │  ← Page starts rendering before prefetch completes                   │
│       │                                                                      │
│  T3: Page renders, calls GET /api/v1/project                                │
│       │                                                                      │
│       ▼                                                                      │
│  T4: API response includes ref_data_entityInstance: { employee: { 1 uuid } } │
│       │                                                                      │
│       ▼                                                                      │
│  T5: upsertRefDataEntityInstance() sets cache to 1 employee                  │
│       │                                                                      │
│  T6: prefetchRefDataEntityInstances() completes with 250 employees           │
│       │                                                                      │
│       │  ← But fetchQuery sees existing data and returns cached 1 employee   │
│       │  ← The 250 employees are never stored in cache!                      │
│       │                                                                      │
│  T7: useQuery reads cache → Only 1 employee visible!                         │
│                                                                              │
│  RESULT: Dropdown shows 1 employee instead of 250                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Root Cause

Two issues combined:

1. **Fire-and-forget prefetch**: `prefetchRefDataEntityInstances()` was not awaited in AuthContext
2. **fetchQuery skips fetch**: When cache has data, `fetchQuery` may return cached data without fetching

### Solution (v9.1.2)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FIX (v9.1.2)                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  FIX 1: Await prefetch in AuthContext                                        │
│  ─────────────────────────────────────                                       │
│                                                                              │
│  // AuthContext.tsx                                                          │
│  const login = async () => {                                                 │
│    // ... login logic ...                                                    │
│                                                                              │
│    // v9.1.2: AWAIT prefetch to prevent race condition                       │
│    await prefetchRefDataEntityInstances(queryClient, [                       │
│      'employee', 'project', 'business', 'office', 'role', 'cust'           │
│    ]);                                                                       │
│  };                                                                          │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════════ │
│                                                                              │
│  FIX 2: Use setQueryData instead of fetchQuery (v9.1.2)                      │
│  ───────────────────────────────────────────────────────                     │
│                                                                              │
│  // useRefDataEntityInstance.ts - prefetchRefDataEntityInstances()           │
│  // Fetch directly and use setQueryData to ALWAYS set complete data          │
│  const response = await fetch(url, { headers: { Authorization: token } });   │
│  const lookup = transformToLookup(await response.json());                    │
│                                                                              │
│  // v9.1.2: setQueryData ALWAYS sets data, regardless of what's in cache     │
│  // This is the authoritative source - replaces any partial upsert data      │
│  queryClient.setQueryData(queryKey, lookup);                                                                         │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════════ │
│                                                                              │
│  RESULT: Prefetch completes BEFORE page renders                              │
│          setQueryData always sets complete authoritative data                │
│          Upserts MERGE properly (250 + 1 = 250)                              │
│          Dropdown shows all 250 employees                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Principles for Cache Consistency

| Principle | Implementation |
|-----------|----------------|
| **Await prefetch at auth boundaries** | `await prefetchRefDataEntityInstances()` in login/refresh |
| **Prefetch uses setQueryData** | Always sets complete authoritative data |
| **Upsert always merges** | `{ ...old, ...new }` never replaces |
| **Log before/after counts** | Debug cache mutations with `{ before, added, after }` |

### Console Output (After Fix)

```
[REF_DATA_CACHE] ✅ Prefetched 250 employee instances
[REF_DATA_CACHE] 🔍 Cache verification for employee: {cacheSize: 250}
[REF_DATA_CACHE] 📥 Upserted 1 entries for employee {before: 250, added: 1, after: 250}
[REF_DATA_OPTIONS] 🔍 Hook called for: employee {cacheSize: 250}  ✅
```

---

## 12. Standard Cache Patterns (v9.1.3)

This section documents the standard cache patterns for all ref_data types in the system.

### 12.1 Single QueryClient Architecture

**CRITICAL**: The application uses a **single QueryClient** instance from `db/query/queryClient.ts`. This ensures cache consistency across all components.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SINGLE QUERYCLIENT ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ✅ CORRECT: Single QueryClient                                              │
│  ────────────────────────────────                                            │
│                                                                              │
│  TanstackCacheProvider                                                       │
│    └── QueryClientProvider client={queryClient}  // from db/query/queryClient│
│          └── AuthProvider                                                    │
│                └── EntityMetadataProvider                                    │
│                      └── Router                                              │
│                            └── Components (all use same queryClient)         │
│                                                                              │
│  ❌ WRONG: Dual QueryClient (causes cache isolation)                         │
│  ────────────────────────────────────────────────────                        │
│                                                                              │
│  QueryClientProvider client={queryClient1}  // App.tsx local instance        │
│    └── TanstackCacheProvider                                                 │
│          └── QueryClientProvider client={queryClient2}  // Another instance! │
│                └── Components  // See queryClient2, NOT queryClient1         │
│                                                                              │
│  Impact: Prefetch writes to queryClient1, hooks read from queryClient2       │
│  Result: Cache appears empty despite successful prefetch                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 12.2 Entity Instance Cache Pattern

**File**: `apps/web/src/lib/hooks/useRefDataEntityInstance.ts`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│               ENTITY INSTANCE CACHE PATTERN                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PURPOSE: UUID → Name resolution for entity references                       │
│  QUERY KEY: ['ref_data_entityInstance', entityCode]                        │
│  DATA STRUCTURE: { [uuid: string]: string }                                  │
│  STALE TIME: 5 minutes                                                       │
│  GC TIME: 30 minutes                                                         │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════════ │
│                                                                              │
│  POPULATION SOURCES (3 sources, all MERGE):                                  │
│  ─────────────────────────────────────────                                   │
│                                                                              │
│  1. Login Prefetch (AWAITED - bulk population)                               │
│     ┌────────────────────────────────────────┐                               │
│     │ // AuthContext.tsx                     │                               │
│     │ await prefetchRefDataEntityInstances(  │                               │
│     │   queryClient,                         │                               │
│     │   ['employee', 'project', 'business',  │                               │
│     │    'office', 'role', 'cust']          │                               │
│     │ );                                     │                               │
│     │                                        │                               │
│     │ // Uses setQueryData with MERGE:       │                               │
│     │ queryClient.setQueryData(key, (old) =>│                               │
│     │   ({ ...(old || {}), ...lookup })     │                               │
│     │ );                                     │                               │
│     └────────────────────────────────────────┘                               │
│                                                                              │
│  2. API Response Upsert (incremental population)                             │
│     ┌────────────────────────────────────────┐                               │
│     │ // On every API response with ref_data │                               │
│     │ upsertRefDataEntityInstance(           │                               │
│     │   queryClient,                         │                               │
│     │   response.ref_data_entityInstance     │                               │
│     │ );                                     │                               │
│     │                                        │                               │
│     │ // ALWAYS merges (never replaces):     │                               │
│     │ setQueryData(key, (old) =>            │                               │
│     │   ({ ...(old || {}), ...newLookups }) │                               │
│     │ );                                     │                               │
│     └────────────────────────────────────────┘                               │
│                                                                              │
│  3. On-Demand Fetch (cache miss)                                             │
│     ┌────────────────────────────────────────┐                               │
│     │ // useRefDataEntityInstanceOptions()   │                               │
│     │ useQuery({                             │                               │
│     │   queryKey: ['ref-data-entity-        │                               │
│     │              instance', entityCode],  │                               │
│     │   queryFn: fetchEntityInstances,      │                               │
│     │   staleTime: 5 * 60 * 1000,           │                               │
│     │ });                                    │                               │
│     └────────────────────────────────────────┘                               │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════════ │
│                                                                              │
│  HOOKS:                                                                      │
│  ──────                                                                      │
│                                                                              │
│  useRefDataEntityInstanceOptions(entityCode)                                 │
│    Returns: { options: [{value, label}], isLoading, lookup }                 │
│    Usage: Dropdown population                                                │
│                                                                              │
│  useRefDataEntityInstanceResolver()                                          │
│    Returns: { resolveName, resolveNames, hasCachedData }                     │
│    Usage: View mode UUID → name resolution                                   │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════════ │
│                                                                              │
│  KEY RULES:                                                                  │
│  ──────────                                                                  │
│  1. Prefetch is AWAITED at login (prevents race condition)                   │
│  2. ALL writes use MERGE pattern: { ...old, ...new }                         │
│  3. setQueryData is used (not fetchQuery) for authoritative writes           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Upsert Function Implementation

The `upsertRefDataEntityInstance` function is the core of the Entity Instance cache pattern. It is called on **every API response** that includes `ref_data_entityInstance`:

```typescript
// File: apps/web/src/lib/hooks/useRefDataEntityInstance.ts

/**
 * Upsert ref_data_entityInstance from API response into cache
 *
 * CRITICAL: This function ALWAYS MERGES - it never replaces the cache.
 * This ensures that prefetched data (250 employees) is not overwritten
 * by API response data (1 employee from current page).
 */
export function upsertRefDataEntityInstance(
  queryClient: QueryClient,
  refData: RefData
): void {
  if (!refData || typeof refData !== 'object') return;

  for (const [entityCode, lookups] of Object.entries(refData)) {
    if (!lookups || typeof lookups !== 'object') continue;

    const queryKey = refDataEntityInstanceKeys.byEntity(entityCode);
    // queryKey = ['ref_data_entityInstance', 'employee']

    // Get current cache state for logging
    const before = queryClient.getQueryData<EntityInstanceLookup>(queryKey);
    const beforeCount = before ? Object.keys(before).length : 0;

    // CRITICAL: setQueryData with updater function for MERGE
    queryClient.setQueryData<EntityInstanceLookup>(queryKey, (old) => {
      // Always merge: existing + new (new overwrites duplicates)
      const merged = { ...(old || {}), ...lookups };
      return merged;
    });

    // Log for debugging
    const after = queryClient.getQueryData<EntityInstanceLookup>(queryKey);
    const afterCount = after ? Object.keys(after).length : 0;

    console.log(
      `[REF_DATA_CACHE] 📥 Upserted ${Object.keys(lookups).length} entries for ${entityCode}`,
      { before: beforeCount, added: Object.keys(lookups).length, after: afterCount }
    );
  }
}
```

#### Where Upsert is Called

The upsert is typically called in entity query hooks after receiving an API response:

```typescript
// File: apps/web/src/lib/hooks/useEntityQuery.ts (example usage)

const { data } = useQuery({
  queryKey: ['entity-list', entityCode, params],
  queryFn: async () => {
    const response = await api.get(`/api/v1/${entityCode}`, { params });

    // UPSERT: Merge ref_data into unified cache
    if (response.ref_data_entityInstance) {
      upsertRefDataEntityInstance(queryClient, response.ref_data_entityInstance);
    }

    return response;
  },
});
```

#### Console Output Example

```
// After login prefetch:
[REF_DATA_CACHE] ✅ Prefetched 250 employee instances

// User navigates to /project, API returns ref_data with 1 employee:
[REF_DATA_CACHE] 📥 Upserted 1 entries for employee {before: 250, added: 1, after: 250}
                                                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                                     Cache stays at 250 (merge, not replace)

// User opens EntitySelect dropdown:
[REF_DATA_OPTIONS] 🔍 Hook called for: employee {cacheSize: 250}  ✅
```

### 12.3 Datalabel Cache Pattern

**File**: `apps/web/src/db/tanstack-hooks/useDatalabel.ts`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   DATALABEL CACHE PATTERN                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PURPOSE: Settings dropdown options (status, stages, types)                  │
│  QUERY KEY: ['datalabel', key]                                              │
│  DATA STRUCTURE: DatalabelOption[] (id, name, color_code, etc.)             │
│  STALE TIME: 10 minutes                                                      │
│  GC TIME: 1 hour                                                             │
│  PERSISTENCE: Dexie IndexedDB + sync cache Map                               │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════════ │
│                                                                              │
│  POPULATION:                                                                 │
│  ───────────                                                                 │
│                                                                              │
│  1. Login Prefetch (bulk - all datalabels at once)                           │
│     ┌────────────────────────────────────────┐                               │
│     │ // AuthContext.tsx                     │                               │
│     │ await prefetchAllDatalabels();         │                               │
│     │                                        │                               │
│     │ // Fetches /api/v1/datalabel/all       │                               │
│     │ // Stores in Dexie + sync cache        │                               │
│     └────────────────────────────────────────┘                               │
│                                                                              │
│  2. On-Demand Fetch (per-key)                                                │
│     ┌────────────────────────────────────────┐                               │
│     │ // useDatalabel('project_stage')       │                               │
│     │ useQuery({                             │                               │
│     │   queryKey: ['datalabel', key],        │                               │
│     │   queryFn: fetchDatalabel,             │                               │
│     │ });                                    │                               │
│     └────────────────────────────────────────┘                               │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════════ │
│                                                                              │
│  HOOKS:                                                                      │
│  ──────                                                                      │
│                                                                              │
│  useDatalabel(key)                                                           │
│    Returns: { options, getLabel, getColor, isLoading }                       │
│    Usage: Badge dropdown, status select                                      │
│                                                                              │
│  useAllDatalabels()                                                          │
│    Returns: { datalabels, getDatalabel, isLoading }                          │
│    Usage: Bulk access to all datalabels                                      │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════════ │
│                                                                              │
│  SYNC CACHE (non-hook access):                                               │
│  ─────────────────────────────                                               │
│                                                                              │
│  getDatalabelSync(key)                                                       │
│    Returns: DatalabelOption[] | null                                         │
│    Usage: Formatters, utilities outside React                                │
│                                                                              │
│  setDatalabelSync(key, options)                                              │
│    Usage: Called internally when data is fetched                             │
│                                                                              │
│  clearDatalabelCache()                                                       │
│    Usage: Called on logout                                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 12.4 Entity Codes Cache Pattern

**File**: `apps/web/src/db/tanstack-hooks/useEntityCodes.ts`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   ENTITY CODES CACHE PATTERN                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PURPOSE: Entity type definitions (code, label, icon, child_entity_codes)   │
│  QUERY KEY: ['entityCodes']                                                 │
│  DATA STRUCTURE: EntityCodeData[]                                           │
│  STALE TIME: 30 minutes                                                      │
│  GC TIME: 1 hour                                                             │
│  PERSISTENCE: Dexie IndexedDB + module-level sync cache                      │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════════ │
│                                                                              │
│  POPULATION:                                                                 │
│  ───────────                                                                 │
│                                                                              │
│  1. Login Prefetch                                                           │
│     ┌────────────────────────────────────────┐                               │
│     │ // AuthContext.tsx                     │                               │
│     │ await prefetchEntityCodes();           │                               │
│     │                                        │                               │
│     │ // Fetches /api/v1/entity/codes        │                               │
│     │ // Stores in Dexie + sync cache        │                               │
│     └────────────────────────────────────────┘                               │
│                                                                              │
│  2. On-Demand Fetch                                                          │
│     ┌────────────────────────────────────────┐                               │
│     │ // useEntityCodes()                    │                               │
│     │ useQuery({                             │                               │
│     │   queryKey: ['entityCodes'],           │                               │
│     │   queryFn: fetchEntityCodes,           │                               │
│     │ });                                    │                               │
│     └────────────────────────────────────────┘                               │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════════ │
│                                                                              │
│  HOOKS:                                                                      │
│  ──────                                                                      │
│                                                                              │
│  useEntityCodes()                                                            │
│    Returns: { entityCodes, getEntityByCode, getLabel, getIcon, getChildCodes│
│    Usage: Entity type lookups, navigation, child tabs                        │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════════ │
│                                                                              │
│  SYNC CACHE (non-hook access):                                               │
│  ─────────────────────────────                                               │
│                                                                              │
│  getEntityCodesSync()                                                        │
│    Returns: EntityCodeData[] | null                                          │
│                                                                              │
│  getEntityByCodeSync(code)                                                   │
│    Returns: EntityCodeData | undefined                                       │
│                                                                              │
│  clearEntityCodesCache()                                                     │
│    Usage: Called on logout                                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 12.5 Global Settings Cache Pattern

**File**: `apps/web/src/db/tanstack-hooks/useGlobalSettings.ts`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   GLOBAL SETTINGS CACHE PATTERN                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PURPOSE: App-wide formatting settings (currency, date, boolean)            │
│  QUERY KEY: ['globalSettings']                                              │
│  DATA STRUCTURE: GlobalSettings object                                       │
│  STALE TIME: 30 minutes                                                      │
│  GC TIME: 1 hour                                                             │
│  PERSISTENCE: Dexie IndexedDB + module-level sync cache                      │
│  DEFAULT: DEFAULT_SETTINGS constant (fallback)                               │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════════ │
│                                                                              │
│  POPULATION:                                                                 │
│  ───────────                                                                 │
│                                                                              │
│  1. Login Prefetch                                                           │
│     ┌────────────────────────────────────────┐                               │
│     │ // AuthContext.tsx                     │                               │
│     │ await prefetchGlobalSettings();        │                               │
│     │                                        │                               │
│     │ // Fetches /api/v1/settings/global     │                               │
│     │ // Falls back to DEFAULT_SETTINGS      │                               │
│     └────────────────────────────────────────┘                               │
│                                                                              │
│  2. On-Demand Fetch                                                          │
│     ┌────────────────────────────────────────┐                               │
│     │ // useGlobalSettings()                 │                               │
│     │ useQuery({                             │                               │
│     │   queryKey: ['globalSettings'],        │                               │
│     │   queryFn: fetchSettings,              │                               │
│     │   placeholderData: DEFAULT_SETTINGS,   │                               │
│     │ });                                    │                               │
│     └────────────────────────────────────────┘                               │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════════ │
│                                                                              │
│  HOOKS:                                                                      │
│  ──────                                                                      │
│                                                                              │
│  useGlobalSettings()                                                         │
│    Returns: { settings, getSetting, isLoading }                              │
│    Usage: Currency formatting, date formatting                               │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════════ │
│                                                                              │
│  SYNC CACHE (non-hook access):                                               │
│  ─────────────────────────────                                               │
│                                                                              │
│  getGlobalSettingsSync()                                                     │
│    Returns: GlobalSettings | null                                            │
│                                                                              │
│  getSettingSync(key, defaultValue)                                           │
│    Returns: value at key or defaultValue                                     │
│    Supports nested keys: 'currency.symbol'                                   │
│                                                                              │
│  clearGlobalSettingsCache()                                                  │
│    Usage: Called on logout                                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 12.6 Cache Pattern Summary Table

| Cache Type | Query Key | Stale Time | GC Time | Persistence | Sync Access |
|------------|-----------|------------|---------|-------------|-------------|
| **Entity Instance** | `['ref_data_entityInstance', code]` | 5 min | 30 min | TanStack only | No |
| **Datalabel** | `['datalabel', key]` | 10 min | 1 hour | Dexie + Map | `getDatalabelSync()` |
| **Entity Codes** | `['entityCodes']` | 30 min | 1 hour | Dexie + var | `getEntityCodesSync()` |
| **Global Settings** | `['globalSettings']` | 30 min | 1 hour | Dexie + var | `getGlobalSettingsSync()` |

### 12.7 Login Prefetch Flow (AuthContext)

```typescript
// AuthContext.tsx - login() function
const login = async (email: string, password: string) => {
  // 1. Authenticate
  const { token, employee } = await authApi.login({ email, password });
  localStorage.setItem('auth_token', token);

  // 2. Prefetch metadata (Dexie + TanStack Query)
  await Promise.all([
    prefetchAllDatalabels(),     // /api/v1/datalabel/all
    prefetchEntityCodes(),       // /api/v1/entity/codes
    prefetchGlobalSettings(),    // /api/v1/settings/global
  ]);

  // 3. Prefetch entity instances (AWAITED - prevents race condition)
  await prefetchRefDataEntityInstances(queryClient, [
    'employee', 'project', 'business', 'office', 'role', 'cust',
  ]);

  // 4. Set auth state - page renders AFTER all prefetch complete
  setState({ user: employee, token, isAuthenticated: true, isLoading: false });
};
```

---

## 13. File Reference

| Layer | File | Purpose |
|-------|------|---------|
| **Backend Config** | `apps/api/src/services/pattern-mapping.yaml` | Field pattern → business type |
| **Backend Config** | `apps/api/src/services/view-type-mapping.yaml` | Business type → view metadata |
| **Backend Config** | `apps/api/src/services/edit-type-mapping.yaml` | Business type → edit metadata |
| **Backend Service** | `apps/api/src/services/backend-formatter.service.ts` | Metadata generation |
| **Backend Service** | `apps/api/src/services/entity-infrastructure.service.ts` | build_ref_data_entityInstance() |
| **Frontend Cache** | `apps/web/src/lib/hooks/useRefDataEntityInstance.ts` | Unified cache hooks |
| **Frontend Hook** | `apps/web/src/lib/hooks/useRefData.ts` | Per-response resolution |
| **Frontend Hook** | `apps/web/src/lib/hooks/useEntityQuery.ts` | Entity queries + cache upsert |
| **Frontend Util** | `apps/web/src/lib/refDataResolver.ts` | Resolution utilities |
| **Frontend Component** | `apps/web/src/components/shared/ui/EntitySelect.tsx` | Single entity dropdown |
| **Frontend Component** | `apps/web/src/components/shared/ui/EntityMultiSelect.tsx` | Multi-select dropdown |

---

**Version:** 11.3.0 | **Updated:** 2025-11-28 | **Pattern:** Backend-Driven Reference Resolution with Unified Cache

---

## 14. Architecture Diagrams

### 14.1 Overall Cache Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    OVERALL CACHE ARCHITECTURE (v9.1.3)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                            ┌──────────────────┐                              │
│                            │    BACKEND API   │                              │
│                            │   (Fastify v5)   │                              │
│                            └────────┬─────────┘                              │
│                                     │                                        │
│               ┌─────────────────────┼─────────────────────┐                  │
│               │                     │                     │                  │
│               ▼                     ▼                     ▼                  │
│   ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐         │
│   │  Entity Instance  │ │    Datalabel      │ │   Entity Codes    │         │
│   │     API          │ │      API          │ │      API          │         │
│   │/entity/:code/    │ │ /datalabel/all    │ │ /entity/codes     │         │
│   │entity-instance   │ │ /datalabel?name=  │ │                   │         │
│   └────────┬─────────┘ └────────┬──────────┘ └────────┬──────────┘         │
│            │                    │                     │                     │
│            │                    │                     │                     │
│            └──────────────┬─────┴─────────────────────┘                     │
│                           │                                                  │
│                           ▼                                                  │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                   TANSTACK QUERY CACHE                               │   │
│   │                   (Single QueryClient)                               │   │
│   │                                                                      │   │
│   │  ┌────────────────────────┐  ┌────────────────────────┐             │   │
│   │  │ ['ref-data-entity-     │  │ ['datalabel', key]     │             │   │
│   │  │  instance', entityCode]│  │                        │             │   │
│   │  │ ───────────────────────│  │ DatalabelOption[]      │             │   │
│   │  │ { uuid: name }         │  │                        │             │   │
│   │  └────────────────────────┘  └────────────────────────┘             │   │
│   │                                                                      │   │
│   │  ┌────────────────────────┐  ┌────────────────────────┐             │   │
│   │  │ ['entityCodes']        │  │ ['globalSettings']     │             │   │
│   │  │ ───────────────────────│  │ ───────────────────────│             │   │
│   │  │ EntityCodeData[]       │  │ GlobalSettings         │             │   │
│   │  └────────────────────────┘  └────────────────────────┘             │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                           │                                                  │
│                           │ Persist (datalabel, entityCodes, globalSettings) │
│                           ▼                                                  │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                      DEXIE (IndexedDB)                               │   │
│   │                                                                      │   │
│   │  metadata table:                                                     │   │
│   │  ┌──────────────────────────────────────────────────────────────┐   │   │
│   │  │ _id              │ type          │ data           │ syncedAt │   │   │
│   │  │─────────────────────────────────────────────────────────────│   │   │
│   │  │ datalabel:stage  │ datalabel     │ [{id,name}...] │ 123456   │   │   │
│   │  │ entityCodes      │ entityCodes   │ [{code,...}]   │ 123456   │   │   │
│   │  │ globalSettings   │ globalSettings│ {currency:...} │ 123456   │   │   │
│   │  └──────────────────────────────────────────────────────────────┘   │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                           │                                                  │
│                           │ Also maintained:                                 │
│                           ▼                                                  │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                      SYNC CACHES (In-Memory)                         │   │
│   │                      For non-hook access                             │   │
│   │                                                                      │   │
│   │  datalabelSyncCache: Map<string, DatalabelOption[]>                 │   │
│   │  entityCodesSyncCache: EntityCodeData[] | null                       │   │
│   │  globalSettingsSyncCache: GlobalSettings | null                      │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 14.2 Login Prefetch Sequence Diagram

```
┌─────────┐     ┌──────────────┐     ┌──────────────┐     ┌───────────────┐     ┌─────────┐
│  User   │     │ AuthContext  │     │ TanStack     │     │    Dexie      │     │ Backend │
│         │     │              │     │ QueryClient  │     │   (IndexedDB) │     │   API   │
└────┬────┘     └──────┬───────┘     └──────┬───────┘     └───────┬───────┘     └────┬────┘
     │                 │                    │                     │                  │
     │ Submit login    │                    │                     │                  │
     │ (email, pwd)    │                    │                     │                  │
     │────────────────▶│                    │                     │                  │
     │                 │                    │                     │                  │
     │                 │ POST /api/v1/auth/login                  │                  │
     │                 │────────────────────────────────────────────────────────────▶│
     │                 │                    │                     │                  │
     │                 │                    │                     │  { token, user } │
     │                 │◀────────────────────────────────────────────────────────────│
     │                 │                    │                     │                  │
     │                 │ Store token        │                     │                  │
     │                 │ localStorage       │                     │                  │
     │                 │                    │                     │                  │
     │                 │════════════════════════════════════════════════════════════ │
     │                 │ PHASE 1: Prefetch Metadata (parallel)                      │
     │                 │════════════════════════════════════════════════════════════ │
     │                 │                    │                     │                  │
     │                 │ await Promise.all([                      │                  │
     │                 │   prefetchAllDatalabels()                │                  │
     │                 │   prefetchEntityCodes()                  │                  │
     │                 │   prefetchGlobalSettings()               │                  │
     │                 │ ])                 │                     │                  │
     │                 │────────────────────────────────────────────────────────────▶│
     │                 │                    │                     │                  │
     │                 │                    │◀───────────────────────────────────────│
     │                 │                    │                     │                  │
     │                 │                    │ setQueryData()      │                  │
     │                 │                    │────────────────────▶│                  │
     │                 │                    │                     │                  │
     │                 │                    │    db.metadata.put()│                  │
     │                 │                    │────────────────────▶│                  │
     │                 │                    │                     │                  │
     │                 │════════════════════════════════════════════════════════════ │
     │                 │ PHASE 2: Prefetch Entity Instances (AWAITED)               │
     │                 │════════════════════════════════════════════════════════════ │
     │                 │                    │                     │                  │
     │                 │ await prefetchRefDataEntityInstances(    │                  │
     │                 │   queryClient,     │                     │                  │
     │                 │   ['employee', 'project', ...]           │                  │
     │                 │ )                  │                     │                  │
     │                 │                    │                     │                  │
     │                 │ For each entityCode (parallel):          │                  │
     │                 │────────────────────────────────────────────────────────────▶│
     │                 │                    │                     │                  │
     │                 │ GET /api/v1/entity/{code}/entity-instance                  │
     │                 │◀────────────────────────────────────────────────────────────│
     │                 │                    │                     │                  │
     │                 │                    │ setQueryData(key,   │                  │
     │                 │                    │   (old) => ({       │                  │
     │                 │                    │     ...old,         │                  │
     │                 │                    │     ...newLookup    │                  │
     │                 │                    │   })                │                  │
     │                 │                    │ )                   │                  │
     │                 │────────────────────▶│                    │                  │
     │                 │                    │                     │                  │
     │                 │════════════════════════════════════════════════════════════ │
     │                 │ PHASE 3: Complete Login                                    │
     │                 │════════════════════════════════════════════════════════════ │
     │                 │                    │                     │                  │
     │                 │ setState({         │                     │                  │
     │                 │   isAuthenticated: true,                 │                  │
     │                 │   isLoading: false │                     │                  │
     │                 │ })                 │                     │                  │
     │                 │                    │                     │                  │
     │ Redirect to     │                    │                     │                  │
     │ /welcome        │                    │                     │                  │
     │◀────────────────│                    │                     │                  │
     │                 │                    │                     │                  │
     │                 │                    │                     │                  │
     │ ════════════════════════════════════════════════════════════════════════════ │
     │ ALL CACHES POPULATED BEFORE PAGE RENDERS                                     │
     │ ════════════════════════════════════════════════════════════════════════════ │
```

### 14.3 Entity Instance Cache Dataflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              ENTITY INSTANCE CACHE DATAFLOW (v9.1.3)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════════ │
│  SOURCE 1: LOGIN PREFETCH (Authoritative Bulk Data)                          │
│  ═══════════════════════════════════════════════════════════════════════════ │
│                                                                              │
│  AuthContext.login()                                                         │
│       │                                                                      │
│       ▼                                                                      │
│  await prefetchRefDataEntityInstances(queryClient, ['employee', ...])               │
│       │                                                                      │
│       ├──────────────────────────────────────────────────────────────────┐   │
│       │                           Per Entity (parallel)                  │   │
│       ▼                                                                  │   │
│  ┌─────────────────────────────────────────────────────────────────────┐│   │
│  │ fetch(`/api/v1/entity/${entityCode}/entity-instance`)               ││   │
│  │      │                                                               ││   │
│  │      ▼                                                               ││   │
│  │ Transform: [{ id, name }] → { uuid: name }                          ││   │
│  │      │                                                               ││   │
│  │      ▼                                                               ││   │
│  │ queryClient.setQueryData(                                           ││   │
│  │   ['ref_data_entityInstance', entityCode],                         ││   │
│  │   (old) => ({ ...(old || {}), ...lookup })  // MERGE               ││   │
│  │ )                                                                    ││   │
│  └─────────────────────────────────────────────────────────────────────┘│   │
│       │                                                                  │   │
│       └──────────────────────────────────────────────────────────────────┘   │
│       │                                                                      │
│       ▼                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ CACHE STATE: employee → { uuid1: "James", uuid2: "Sarah", ... }    │    │
│  │              project  → { uuid3: "Kitchen Reno", ... }              │    │
│  │              250+ entries per entity type                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════════ │
│  SOURCE 2: API RESPONSE UPSERT (Incremental Merge)                           │
│  ═══════════════════════════════════════════════════════════════════════════ │
│                                                                              │
│  User navigates to /project                                                  │
│       │                                                                      │
│       ▼                                                                      │
│  useEntityList('project') → GET /api/v1/project                             │
│       │                                                                      │
│       ▼                                                                      │
│  Response: {                                                                 │
│    data: [...],                                                              │
│    ref_data_entityInstance: {                                                │
│      employee: { "uuid-james": "James Miller" },  // 1 entry                │
│      business: { "uuid-huron": "Huron Home" }                               │
│    }                                                                         │
│  }                                                                           │
│       │                                                                      │
│       ▼                                                                      │
│  upsertRefDataEntityInstance(queryClient, ref_data)                     │
│       │                                                                      │
│       ▼                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ For each entityCode in ref_data:                                    │    │
│  │   queryClient.setQueryData(                                         │    │
│  │     ['ref_data_entityInstance', entityCode],                        │    │
│  │     (old) => ({ ...(old || {}), ...lookups })  // ALWAYS MERGE     │    │
│  │   )                                                                 │    │
│  │                                                                     │    │
│  │ Log: { before: 250, added: 1, after: 250 }                         │    │
│  │      (no net change if entry exists)                                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════════ │
│  SOURCE 3: ON-DEMAND FETCH (Cache Miss)                                      │
│  ═══════════════════════════════════════════════════════════════════════════ │
│                                                                              │
│  User opens dropdown for unpopulated entity type                             │
│       │                                                                      │
│       ▼                                                                      │
│  useRefDataEntityInstanceOptions('supplier')                                 │
│       │                                                                      │
│       ▼                                                                      │
│  Check cache: ['ref_data_entityInstance', 'supplier']                       │
│       │                                                                      │
│       ▼                                                                      │
│  CACHE MISS (no data for 'supplier')                                         │
│       │                                                                      │
│       ▼                                                                      │
│  useQuery queryFn executes:                                                  │
│  fetch(`/api/v1/entity/supplier/entity-instance`)                           │
│       │                                                                      │
│       ▼                                                                      │
│  Store in cache, return as options                                           │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════════ │
│  CONSUMPTION: React Components                                               │
│  ═══════════════════════════════════════════════════════════════════════════ │
│                                                                              │
│  ┌────────────────────────────────────────┐                                 │
│  │ EntitySelect (edit mode - dropdown)    │                                 │
│  │                                        │                                 │
│  │ const { options } =                    │                                 │
│  │   useRefDataEntityInstanceOptions(     │                                 │
│  │     'employee'                         │                                 │
│  │   );                                   │                                 │
│  │                                        │                                 │
│  │ // Cache HIT → 250 options instantly   │                                 │
│  └────────────────────────────────────────┘                                 │
│                                                                              │
│  ┌────────────────────────────────────────┐                                 │
│  │ EntityDetailView (view mode - display) │                                 │
│  │                                        │                                 │
│  │ const { resolveName } =                │                                 │
│  │   useRefDataEntityInstanceResolver();  │                                 │
│  │                                        │                                 │
│  │ resolveName('employee', 'uuid-james')  │                                 │
│  │ // Returns: "James Miller"             │                                 │
│  └────────────────────────────────────────┘                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 14.4 QueryClient Provider Hierarchy (Correct vs Wrong)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│           QUERYCLIENT PROVIDER HIERARCHY                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ✅ CORRECT (v9.1.3 - Single QueryClient)                                    │
│  ════════════════════════════════════════                                    │
│                                                                              │
│  App.tsx:                                                                    │
│  ─────────                                                                   │
│  return (                                                                    │
│    <TanstackCacheProvider>     ◄─── SINGLE QueryClientProvider inside       │
│      <AuthProvider>                 Uses queryClient from db/query/         │
│        <EntityMetadataProvider>                                              │
│          <Router>                                                            │
│            ...                                                               │
│          </Router>                                                           │
│        </EntityMetadataProvider>                                             │
│      </AuthProvider>                                                         │
│    </TanstackCacheProvider>                                                  │
│  );                                                                          │
│                                                                              │
│  TanstackCacheProvider.tsx:                                                  │
│  ──────────────────────────                                                  │
│  import { queryClient } from './query/queryClient';  // Centralized          │
│                                                                              │
│  return (                                                                    │
│    <QueryClientProvider client={queryClient}>  ◄─── ONE provider             │
│      {children}                                                              │
│    </QueryClientProvider>                                                    │
│  );                                                                          │
│                                                                              │
│  AuthContext.tsx:                                                            │
│  ───────────────                                                             │
│  const queryClient = useQueryClient();  ◄─── Gets SAME queryClient           │
│  await prefetchRefDataEntityInstances(queryClient, [...]);  ◄─── Writes here        │
│                                                                              │
│  EntitySelect.tsx:                                                           │
│  ─────────────────                                                           │
│  useRefDataEntityInstanceOptions('employee');  ◄─── Reads SAME cache         │
│                                                                              │
│  ───────────────────────────────────────────────────────────────────────────│
│                                                                              │
│  ❌ WRONG (Pre-v9.1.3 - Dual QueryClient Bug)                                │
│  ═══════════════════════════════════════════                                 │
│                                                                              │
│  App.tsx (BROKEN):                                                           │
│  ──────────────────                                                          │
│  const queryClient = new QueryClient({...});  ◄─── CREATES queryClient #1    │
│                                                                              │
│  return (                                                                    │
│    <QueryClientProvider client={queryClient}>  ◄─── Provider #1 (outer)      │
│      <AuthProvider>                                                          │
│        <TanstackCacheProvider>                                               │
│          <QueryClientProvider client={...}>  ◄─── Provider #2 (inner)        │
│            <Router>                              Has DIFFERENT queryClient!  │
│              ...                                                             │
│            </Router>                                                         │
│          </QueryClientProvider>                                              │
│        </TanstackCacheProvider>                                              │
│      </AuthProvider>                                                         │
│    </QueryClientProvider>                                                    │
│  );                                                                          │
│                                                                              │
│  PROBLEM:                                                                    │
│  ─────────                                                                   │
│  AuthContext.tsx:                                                            │
│  const queryClient = useQueryClient();  ◄─── Gets queryClient #1 (outer)     │
│  prefetchRefDataEntityInstances(queryClient);  ◄─── Writes to #1                    │
│                                                                              │
│  EntitySelect.tsx:                                                           │
│  useQuery({...});  ◄─── Inside Provider #2, reads from queryClient #2        │
│                         DIFFERENT CACHE! Shows 0 entries                     │
│                                                                              │
│  RESULT: Prefetch writes to cache #1, hooks read from cache #2               │
│          250 employees in #1, 0 employees visible in dropdown                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 15. v9.4.0: Strict Format-at-Read Architecture

### 15.1 Problem Statement (Pre-v9.4.0)

Edit mode in EntityListOfInstancesTable showed **raw UUIDs instead of resolved names** because view mode and edit mode used **separate data resolution paths**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PRE-v9.4.0 ARCHITECTURE - CACHE MISMATCH                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  API Response                                                                │
│  { data: [...], ref_data_entityInstance: { employee: { uuid: name } } }     │
│       │                                                                      │
│       ├─────────────────────────────────────┐                               │
│       │                                     │                               │
│       ▼                                     ▼                               │
│  VIEW MODE PATH                        EDIT MODE PATH                       │
│  ─────────────────                     ──────────────────                   │
│                                                                              │
│  formatDataset(data, metadata, refData)  EntityInstanceNameSelect           │
│       │                                       │                             │
│       ▼                                       ▼                             │
│  formatReference() uses refData         useRefDataEntityInstanceOptions()   │
│       │                                       │                             │
│       ▼                                       ▼                             │
│  ✅ "James Miller"                      ❌ SEPARATE CACHE                   │
│     (from API response)                    ['ref_data_entityInstance',      │
│                                             entityCode]                      │
│                                                │                            │
│                                                ▼                            │
│                                           CACHE MISS!                       │
│                                           Shows UUID or empty               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Root Cause:** `useEntityInstanceData` persisted `ref_data_entityInstance` to:
1. ✅ Dexie IndexedDB (via `persistToEntityInstanceNames`)
2. ✅ Sync store (via `entityInstanceNamesStore.merge`)
3. ❌ **MISSING**: TanStack Query cache for edit components

### 15.2 Solution: Unified Cache Population

**File:** `apps/web/src/db/cache/hooks/useEntityInstanceData.ts`

```typescript
// v9.4.0: After API response, populate ALL cache layers
if (result.refData) {
  for (const [code, names] of Object.entries(result.refData)) {
    await persistToEntityInstanceNames(code, names);     // Layer 1: Dexie
    entityInstanceNamesStore.merge(code, names);          // Layer 2: Sync Store
  }
  // Layer 3: TanStack Query cache (NEW in v9.4.0)
  upsertRefDataEntityInstance(queryClient, result.refData);
}
```

### 15.3 Data Resolution Chain (v9.4.0)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    v9.4.0 UNIFIED DATA RESOLUTION CHAIN                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  API Response                                                                │
│  { data: [...], ref_data_entityInstance: { employee: { uuid: name } } }     │
│       │                                                                      │
│       ▼                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    UNIFIED CACHE LAYER (3 Destinations)              │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │                                                                      │    │
│  │  1. persistToEntityInstanceNames()    → Dexie (IndexedDB)           │    │
│  │     Purpose: Offline persistence, survives browser restart           │    │
│  │                                                                      │    │
│  │  2. entityInstanceNamesStore.merge()  → Sync Store (in-memory)      │    │
│  │     Purpose: Instant synchronous access for formatters               │    │
│  │                                                                      │    │
│  │  3. upsertRefDataEntityInstance()     → TanStack Query Cache (NEW)  │    │
│  │     Purpose: Edit mode dropdown population                           │    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│       │                                                                      │
│       ├─────────────────────────────────────┬───────────────────────────┐   │
│       │                                     │                           │   │
│       ▼                                     ▼                           ▼   │
│  VIEW MODE                             EDIT (Single)              EDIT (Multi)
│  ─────────────                         ─────────────              ────────────
│                                                                              │
│  formatDataset()                    EntityInstance-            EntityInstance-
│  → formatReference()                NameSelect                 NameMultiSelect
│  → refData[entity][uuid]                 │                           │      │
│       │                                  ▼                           ▼      │
│       ▼                         useRefDataEntity-          useRefDataEntity- │
│  ✅ "James Miller"              InstanceOptions()          InstanceOptions() │
│                                        +                          +         │
│                                 entityInstance-            entityInstance-  │
│                                 NamesStore.getName()       NamesStore.getName()
│                                 (sync fallback)            (sync fallback)  │
│                                        │                          │         │
│                                        ▼                          ▼         │
│                                 ✅ "James Miller"          ✅ ["James", ...] │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 15.4 Metadata-Driven Component Rendering

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    METADATA-DRIVEN ENTITY REFERENCE RENDERING                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SINGLE REFERENCE (_ID)                   MULTIPLE REFERENCES (_IDS)        │
│  ───────────────────────                  ─────────────────────────         │
│                                                                              │
│  Field: manager__employee_id              Field: stakeholder__employee_ids  │
│                                                                              │
│  BACKEND METADATA:                        BACKEND METADATA:                 │
│  ┌─────────────────────────────┐          ┌─────────────────────────────┐   │
│  │ viewType: {                 │          │ viewType: {                 │   │
│  │   renderType: "entityInst-  │          │   renderType: "entityInst-  │   │
│  │               anceId"       │          │               anceIds"      │   │
│  │ }                           │          │ }                           │   │
│  │ editType: {                 │          │ editType: {                 │   │
│  │   inputType: "EntityInst-   │          │   inputType: "EntityInst-   │   │
│  │              anceNameSelect"│          │           anceNameMultiSelect"│ │
│  │   lookupEntity: "employee"  │          │   lookupEntity: "employee"  │   │
│  │ }                           │          │ }                           │   │
│  └─────────────────────────────┘          └─────────────────────────────┘   │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  VIEW MODE                                VIEW MODE                         │
│  ─────────                                ─────────                         │
│  formatReference()                        formatReference()                 │
│  (valueFormatters.ts:232)                 (valueFormatters.ts:232)          │
│       │                                        │                            │
│       ▼                                        ▼                            │
│  → "James Miller"                         → "James Miller, Sarah Smith"     │
│                                                                              │
│  EDIT MODE                                EDIT MODE                         │
│  ─────────                                ─────────                         │
│  renderEditModeFromMetadata()             renderEditModeFromMetadata()      │
│  (frontEndFormatterService.tsx)           (frontEndFormatterService.tsx)    │
│       │                                        │                            │
│       ▼                                        ▼                            │
│  case 'EntityInstanceNameSelect':         case 'EntityInstanceNameMulti-    │
│       │                                        Select':                     │
│       ▼                                        │                            │
│  <EntityInstanceNameSelect                     ▼                            │
│    entityCode="employee"                  <EntityInstanceNameMultiSelect    │
│    value={uuid}                             entityCode="employee"           │
│    onChange={...}                           value={[uuid1, uuid2]}          │
│  />                                         onChange={...}                  │
│       │                                   />                                │
│       ▼                                        │                            │
│  → Searchable dropdown                         ▼                            │
│  → Single selection                       → Searchable checkbox dropdown    │
│                                           → Multi selection with chips      │
│                                           → Removable chips (X button)      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 15.5 Component File Reference

| Component | Purpose | File Path |
|-----------|---------|-----------|
| `formatReference()` | VIEW mode - UUID to name | `apps/web/src/lib/formatters/valueFormatters.ts:232` |
| `EntityInstanceNameSelect` | EDIT mode - single select | `apps/web/src/components/shared/ui/EntityInstanceNameSelect.tsx` |
| `EntityInstanceNameMultiSelect` | EDIT mode - multi select | `apps/web/src/components/shared/ui/EntityInstanceNameMultiSelect.tsx` |
| `renderEditModeFromMetadata()` | Routes inputType to component | `apps/web/src/lib/frontEndFormatterService.tsx` |
| `useRefDataEntityInstanceOptions()` | Dropdown options hook | `apps/web/src/lib/hooks/useRefDataEntityInstance.ts` |
| `entityInstanceNamesStore` | Sync store for instant access | `apps/web/src/db/cache/stores.ts` |
| `upsertRefDataEntityInstance()` | Cache upsert function | `apps/web/src/lib/hooks/useRefDataEntityInstance.ts` |

### 15.6 Sync Store Fallback Pattern

Both select components use the sync store as a fallback for immediate name resolution:

**EntityInstanceNameSelect.tsx:**
```typescript
// v9.4.0: Use sync store for immediate resolution when options not yet loaded
const selectedOption = options.find(opt => opt.value === value);
const syncStoreName = value ? entityInstanceNamesStore.getName(entityCode, value) : null;
const displayLabel = selectedOption?.label || syncStoreName || currentLabel || '';
```

**EntityInstanceNameMultiSelect.tsx:**
```typescript
// v9.4.0: Use sync store as fallback when options not yet loaded
const selectedOptions = value.map(uuid => {
  // First try TanStack Query options
  const fromOptions = options.find(opt => opt.value === uuid);
  if (fromOptions) return fromOptions;

  // Fallback to sync store for immediate resolution
  const syncName = entityInstanceNamesStore.getName(entityCode, uuid);
  if (syncName) return { value: uuid, label: syncName };

  // Last resort: show truncated UUID
  return { value: uuid, label: uuid.substring(0, 8) + '...' };
});
```

### 15.7 Resolution Priority Chain

```
┌───────────────────────────────────────────────────────────────────────────┐
│                    NAME RESOLUTION PRIORITY (v9.4.0)                       │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Priority 1: TanStack Query Options (from useRefDataEntityInstanceOptions) │
│  ─────────────────────────────────────────────────────────────────────────│
│  • Full dropdown loaded from cache or API                                  │
│  • Most complete - has all active entities                                 │
│  • May have loading delay on first access                                  │
│                                                                            │
│  Priority 2: Sync Store (entityInstanceNamesStore.getName)                 │
│  ─────────────────────────────────────────────────────────────────────────│
│  • Populated from API response ref_data_entityInstance                     │
│  • Instant synchronous access                                              │
│  • Only contains entities seen in recent API responses                     │
│                                                                            │
│  Priority 3: Truncated UUID Fallback                                       │
│  ─────────────────────────────────────────────────────────────────────────│
│  • Last resort when name cannot be resolved                                │
│  • Shows: "8260b1b0..."                                                    │
│  • Indicates a cache miss (should be rare)                                 │
│                                                                            │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 16. Architecture Coherence Critique

### 16.1 Strengths

| Aspect | Assessment |
|--------|------------|
| **Single Source of Truth** | ✅ Backend metadata drives all rendering decisions |
| **Cache Unification** | ✅ All 3 cache layers populated from same API response |
| **Fallback Chain** | ✅ Graceful degradation: Options → Sync Store → UUID |
| **Component Reuse** | ✅ Same select components for all entity types |
| **Metadata-Driven** | ✅ No frontend pattern detection |

### 16.2 Potential Issues

| Issue | Risk Level | Mitigation |
|-------|------------|------------|
| **Circular Import Risk** | Medium | `queryClient` imported directly in hook - could cause issues if import order changes |
| **Cache Staleness** | Low | 5-min staleTime may show outdated names if entity renamed |
| **Memory Usage** | Low | Sync store grows unbounded for long sessions |
| **Race Condition** | Low | Sync store populated before TanStack cache on API response |

### 16.3 Missing Pieces

| Gap | Impact | Recommendation |
|-----|--------|----------------|
| **View Mode Chips** | Cosmetic | Consider `ChipList` for array references in view mode |
| **Cache Invalidation** | Medium | WebSocket should invalidate entity instance name cache on entity update |
| **Prefetch Coverage** | Low | Verify all common entity types prefetched at login |

### 16.4 Recommended Future Improvements

1. **Cache Invalidation on Entity Update**
   ```typescript
   // When entity is renamed, invalidate name cache
   wsManager.onMessage('ENTITY_UPDATED', (entityCode, entityId) => {
     queryClient.invalidateQueries(['ref_data_entityInstance', entityCode]);
     entityInstanceNamesStore.clearByCode(entityCode);
   });
   ```

2. **Memory Cleanup for Long Sessions**
   ```typescript
   // Periodic cleanup of sync store
   const MAX_SYNC_STORE_AGE = 30 * 60 * 1000; // 30 minutes
   entityInstanceNamesStore.clearStaleEntries(MAX_SYNC_STORE_AGE);
   ```

3. **View Mode Chip Rendering**
   ```typescript
   // In valueFormatters.ts - return structured data for chip rendering
   if (Array.isArray(value)) {
     return {
       display: names.join(', '),
       chips: names.map((name, i) => ({ id: value[i], label: name }))
     };
   }
   ```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 12.1.0 | 2025-12-02 | **v9.4.1 YAML-Frontend Alignment**: Frontend now correctly handles `renderType: 'component'` with `component: 'EntityInstanceName'/'EntityInstanceNames'` pattern from YAML. Both VIEW mode (`datasetFormatter.ts`) and EDIT mode (`frontEndFormatterService.tsx`) now route component-based metadata to appropriate formatters/components. |
| 12.0.0 | 2025-12-01 | **v9.4.0 Strict Format-at-Read**: Unified cache population, EntityInstanceNameMultiSelect support, sync store fallback pattern, architecture critique |
| 11.3.0 | 2025-11-28 | Added comprehensive architecture diagrams, fixed dual QueryClient bug, removed unused imports from App.tsx |
| 11.2.0 | 2025-11-28 | Use `setQueryData` instead of `fetchQuery` - ensures prefetch always sets complete data |
| 11.1.0 | 2025-11-28 | Fixed race condition: await prefetch, staleTime=5min, improved upsert logging |
| 11.0.0 | 2025-11-27 | Initial unified cache documentation |
