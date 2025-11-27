# RefData Architecture (v8.3.2)

> Unified cache architecture for entity reference resolution: single cache serves both view mode display and edit mode dropdowns.

## Overview

The RefData pattern solves entity reference resolution with a **unified cache**:

1. **Backend** includes `ref_data_entityInstance` lookup table in API responses
2. **Frontend** upserts this data to a shared React Query cache
3. **Both view mode** (displaying names) **and edit mode** (dropdown options) use the same cache

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    RefData Unified Cache Architecture (v8.3.2)              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────────────────────────────────────────┐   │
│  │  API Response │    │           React Query Unified Cache              │   │
│  │              │    │                                                    │   │
│  │  ref_data_   │───▶│  ['ref-data-entity-instance', 'employee']         │   │
│  │  entityInst. │    │  { "uuid-james": "James Miller", ... }            │   │
│  │              │    │                                                    │   │
│  └──────────────┘    └───────────────────┬──────────────────────────────┘   │
│                                          │                                   │
│                      ┌───────────────────┴───────────────────┐              │
│                      │                                       │              │
│                      ▼                                       ▼              │
│           ┌──────────────────┐                   ┌──────────────────┐       │
│           │    VIEW MODE     │                   │    EDIT MODE     │       │
│           │                  │                   │                  │       │
│           │  resolveField()  │                   │  EntitySelect    │       │
│           │  → "James Miller"│                   │  dropdown opts   │       │
│           └──────────────────┘                   └──────────────────┘       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Improvement in v8.3.2

| Aspect | v8.3.1 (Before) | v8.3.2 (After) |
|--------|-----------------|----------------|
| **View mode** | Uses per-response `ref_data_entityInstance` | Uses unified cache |
| **Edit mode** | Separate `useEntityLookup` fetch | Uses unified cache |
| **Cache entries** | 2 separate caches | 1 unified cache |
| **Data freshness** | Could diverge | Always in sync |
| **Network requests** | Dropdown fetches independently | Dropdown shares API response data |

---

## 1. Sequence Diagram: View Mode Resolution

```
┌─────────┐     ┌──────────┐     ┌────────────┐     ┌──────────────┐     ┌─────────────┐
│  User   │     │Component │     │useEntityList│     │ Unified Cache │     │  Backend   │
└────┬────┘     └────┬─────┘     └──────┬─────┘     └──────┬───────┘     └──────┬──────┘
     │               │                  │                  │                    │
     │ Navigate to   │                  │                  │                    │
     │ Project List  │                  │                  │                    │
     │──────────────▶│                  │                  │                    │
     │               │                  │                  │                    │
     │               │ useEntityList()  │                  │                    │
     │               │─────────────────▶│                  │                    │
     │               │                  │                  │                    │
     │               │                  │ Check cache      │                    │
     │               │                  │─────────────────▶│                    │
     │               │                  │                  │                    │
     │               │                  │ Cache MISS       │                    │
     │               │                  │◀─────────────────│                    │
     │               │                  │                  │                    │
     │               │                  │ GET /api/v1/project                   │
     │               │                  │─────────────────────────────────────▶│
     │               │                  │                  │                    │
     │               │                  │                  │    { data: [...],  │
     │               │                  │                  │      ref_data_     │
     │               │                  │                  │      entityInst,   │
     │               │                  │                  │      metadata }    │
     │               │                  │◀─────────────────────────────────────│
     │               │                  │                  │                    │
     │               │                  │ UPSERT ref_data  │                    │
     │               │                  │ to unified cache │                    │
     │               │                  │─────────────────▶│                    │
     │               │                  │                  │                    │
     │               │                  │   ['ref-data-entity-instance', 'employee']
     │               │                  │   = { "uuid-james": "James Miller" }
     │               │                  │                  │                    │
     │               │ { data, refData }│                  │                    │
     │               │◀─────────────────│                  │                    │
     │               │                  │                  │                    │
     │               │ resolveField()   │                  │                    │
     │               │ "uuid-james" ──▶ "James Miller"     │                    │
     │               │                  │                  │                    │
     │◀──────────────│                  │                  │                    │
     │ Display table │                  │                  │                    │
     │ with names    │                  │                  │                    │
```

---

## 2. Sequence Diagram: Edit Mode Dropdown

```
┌─────────┐     ┌────────────┐     ┌─────────────────────┐     ┌──────────────┐
│  User   │     │EntitySelect│     │useRefDataEntityInst.│     │ Unified Cache│
└────┬────┘     └──────┬─────┘     │     Options()       │     └──────┬───────┘
     │                 │           └──────────┬──────────┘            │
     │                 │                      │                       │
     │ Click dropdown  │                      │                       │
     │────────────────▶│                      │                       │
     │                 │                      │                       │
     │                 │ useRefDataEntity     │                       │
     │                 │ InstanceOptions()    │                       │
     │                 │─────────────────────▶│                       │
     │                 │                      │                       │
     │                 │                      │ Check unified cache   │
     │                 │                      │──────────────────────▶│
     │                 │                      │                       │
     │                 │                      │                       │
     │                 │         ┌────────────┴────────────────────┐  │
     │                 │         │  CACHE HIT (from earlier view   │  │
     │                 │         │  mode API response upsert)?     │  │
     │                 │         └────────────┬────────────────────┘  │
     │                 │                      │                       │
     │                 │                      │   YES: Return cached  │
     │                 │                      │◀──────────────────────│
     │                 │                      │                       │
     │                 │   options = [        │                       │
     │                 │     { value: "uuid-james", label: "James" }, │
     │                 │     { value: "uuid-sarah", label: "Sarah" }  │
     │                 │   ]                  │                       │
     │                 │◀─────────────────────│                       │
     │                 │                      │                       │
     │◀────────────────│                      │                       │
     │ Show populated  │                      │                       │
     │ dropdown        │                      │                       │
```

### Cache Miss Flow (Dropdown before View)

```
┌─────────┐     ┌────────────┐     ┌─────────────────────┐     ┌──────────────┐     ┌────────┐
│  User   │     │EntitySelect│     │useRefDataEntityInst.│     │ Unified Cache│     │Backend │
└────┬────┘     └──────┬─────┘     │     Options()       │     └──────┬───────┘     └───┬────┘
     │                 │           └──────────┬──────────┘            │                 │
     │                 │                      │                       │                 │
     │ Click dropdown  │                      │                       │                 │
     │ (first time)    │                      │                       │                 │
     │────────────────▶│                      │                       │                 │
     │                 │                      │                       │                 │
     │                 │ useRefDataEntity     │                       │                 │
     │                 │ InstanceOptions()    │                       │                 │
     │                 │─────────────────────▶│                       │                 │
     │                 │                      │                       │                 │
     │                 │                      │ Check unified cache   │                 │
     │                 │                      │──────────────────────▶│                 │
     │                 │                      │                       │                 │
     │                 │                      │ CACHE MISS            │                 │
     │                 │                      │◀──────────────────────│                 │
     │                 │                      │                       │                 │
     │                 │                      │ GET /api/v1/entity/   │                 │
     │                 │                      │ employee/entity-instance               │
     │                 │                      │──────────────────────────────────────▶│
     │                 │                      │                       │                 │
     │                 │                      │                       │  [{ id, name }] │
     │                 │                      │◀──────────────────────────────────────│
     │                 │                      │                       │                 │
     │                 │                      │ Store in unified cache│                 │
     │                 │                      │──────────────────────▶│                 │
     │                 │                      │                       │                 │
     │                 │   options = [...]    │                       │                 │
     │                 │◀─────────────────────│                       │                 │
     │                 │                      │                       │                 │
     │◀────────────────│                      │                       │                 │
     │ Show dropdown   │                      │                       │                 │
```

---

## 3. Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Component Architecture (v8.3.2)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        REACT QUERY LAYER                            │    │
│  │                                                                     │    │
│  │  ┌───────────────────────────────────────────────────────────────┐  │    │
│  │  │  Unified Cache: ['ref-data-entity-instance', entityCode]      │  │    │
│  │  │                                                               │  │    │
│  │  │  employee: { "uuid-1": "James", "uuid-2": "Sarah" }          │  │    │
│  │  │  project:  { "uuid-p1": "Kitchen Reno" }                     │  │    │
│  │  │  business: { "uuid-b1": "Huron Home" }                       │  │    │
│  │  │                                                               │  │    │
│  │  │  TTL: staleTime=15min, gcTime=30min                          │  │    │
│  │  └───────────────────────────────────────────────────────────────┘  │    │
│  │                                                                     │    │
│  │  ┌───────────────────────────────────────────────────────────────┐  │    │
│  │  │  Entity Queries: ['entity-list', code, params]               │  │    │
│  │  │                                                               │  │    │
│  │  │  Contains: { data, ref_data_entityInstance, metadata }       │  │    │
│  │  │  UPSERTS ref_data to unified cache on fetch                  │  │    │
│  │  └───────────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                           HOOKS LAYER                               │    │
│  │                                                                     │    │
│  │  ┌─────────────────────────┐    ┌────────────────────────────────┐ │    │
│  │  │ useEntityInstanceList() │    │ useRefDataEntityInstanceCache  │ │    │
│  │  │ useEntityInstance()     │    │                                │ │    │
│  │  │                         │    │ ├─ useRefDataEntityInstance    │ │    │
│  │  │ On fetch:               │    │ │  Options()                   │ │    │
│  │  │ upsertRefDataEntity     │───▶│ │  → dropdown options         │ │    │
│  │  │ InstanceCache()         │    │ │                              │ │    │
│  │  │                         │    │ ├─ useRefDataEntityInstance    │ │    │
│  │  └─────────────────────────┘    │ │  Resolver()                  │ │    │
│  │                                 │ │  → view mode resolution      │ │    │
│  │  ┌─────────────────────────┐    │ │                              │ │    │
│  │  │ useRefData()            │    │ └─ prefetchEntityInstances()   │ │    │
│  │  │                         │    │    → optional login prefetch   │ │    │
│  │  │ Uses per-response       │    └────────────────────────────────┘ │    │
│  │  │ ref_data (legacy)       │                                       │    │
│  │  └─────────────────────────┘                                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         COMPONENT LAYER                             │    │
│  │                                                                     │    │
│  │  VIEW MODE                           EDIT MODE                      │    │
│  │  ─────────                           ─────────                      │    │
│  │  ┌─────────────────────┐             ┌────────────────────┐        │    │
│  │  │ EntityDataTable     │             │ EntitySelect       │        │    │
│  │  │                     │             │                    │        │    │
│  │  │ useRefData() or     │             │ useRefDataEntity   │        │    │
│  │  │ useRefDataEntity    │             │ InstanceOptions()  │        │    │
│  │  │ InstanceResolver()  │             │                    │        │    │
│  │  │                     │             │ Returns: options[] │        │    │
│  │  │ resolveField() →    │             │ [{ value, label }] │        │    │
│  │  │ "James Miller"      │             │                    │        │    │
│  │  └─────────────────────┘             └────────────────────┘        │    │
│  │                                                                     │    │
│  │  ┌─────────────────────┐             ┌────────────────────┐        │    │
│  │  │ EntityDetailView    │             │ EntityMultiSelect  │        │    │
│  │  └─────────────────────┘             └────────────────────┘        │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA FLOW (v8.3.2)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ╔═══════════════════════════════════════════════════════════════════════╗  │
│  ║  FETCH PHASE (Entity List/Detail)                                     ║  │
│  ╚═══════════════════════════════════════════════════════════════════════╝  │
│                                                                              │
│  Browser                    API Server                    Database          │
│  ───────                    ──────────                    ────────          │
│     │                           │                            │              │
│     │  GET /api/v1/project      │                            │              │
│     │──────────────────────────▶│                            │              │
│     │                           │                            │              │
│     │                           │  SELECT * FROM project     │              │
│     │                           │───────────────────────────▶│              │
│     │                           │◀───────────────────────────│              │
│     │                           │                            │              │
│     │                           │  build_ref_data_entityInstance()          │
│     │                           │  ┌────────────────────────────────────┐   │
│     │                           │  │ 1. Extract UUIDs from data rows   │   │
│     │                           │  │ 2. Query entity_instance table    │   │
│     │                           │  │ 3. Build { entityCode: { uuid: name }}│
│     │                           │  └────────────────────────────────────┘   │
│     │                           │                            │              │
│     │  {                        │                            │              │
│     │    data: [...],           │                            │              │
│     │    ref_data_entityInstance: {                          │              │
│     │      employee: { uuid: name }                          │              │
│     │    },                     │                            │              │
│     │    metadata: {...}        │                            │              │
│     │  }                        │                            │              │
│     │◀──────────────────────────│                            │              │
│     │                           │                            │              │
│                                                                              │
│  ╔═══════════════════════════════════════════════════════════════════════╗  │
│  ║  CACHE UPSERT PHASE                                                   ║  │
│  ╚═══════════════════════════════════════════════════════════════════════╝  │
│                                                                              │
│  React Query                                                                 │
│  ───────────                                                                 │
│     │                                                                        │
│     │  queryFn receives response                                             │
│     │     │                                                                  │
│     │     ▼                                                                  │
│     │  upsertRefDataEntityInstanceCache(queryClient, ref_data)               │
│     │     │                                                                  │
│     │     ▼                                                                  │
│     │  ┌──────────────────────────────────────────────────────────────────┐ │
│     │  │  FOR EACH entityCode IN ref_data:                                │ │
│     │  │    queryClient.setQueryData(                                     │ │
│     │  │      ['ref-data-entity-instance', entityCode],                   │ │
│     │  │      (old) => ({ ...old, ...newLookups })  // MERGE              │ │
│     │  │    )                                                             │ │
│     │  └──────────────────────────────────────────────────────────────────┘ │
│     │                                                                        │
│     │  RESULT: Unified cache now has employee names                          │
│     │                                                                        │
│                                                                              │
│  ╔═══════════════════════════════════════════════════════════════════════╗  │
│  ║  VIEW MODE RESOLUTION                                                 ║  │
│  ╚═══════════════════════════════════════════════════════════════════════╝  │
│                                                                              │
│  Component: EntityDataTable                                                  │
│  ─────────────────────────────                                               │
│     │                                                                        │
│     │  const { resolveFieldDisplay } = useRefData(data?.ref_data_entityInstance)
│     │     │                                                                  │
│     │     │  OR (using unified cache):                                       │
│     │     │                                                                  │
│     │  const { resolveName } = useRefDataEntityInstanceResolver()            │
│     │     │                                                                  │
│     │     ▼                                                                  │
│     │  resolveFieldDisplay(fieldMeta, "uuid-james")                          │
│     │     │                                                                  │
│     │     ▼                                                                  │
│     │  ┌──────────────────────────────────────────────────────────────────┐ │
│     │  │  1. getEntityCodeFromMetadata(fieldMeta) → "employee"            │ │
│     │  │  2. ref_data["employee"]["uuid-james"] → "James Miller"          │ │
│     │  │  3. Return "James Miller"                                         │ │
│     │  └──────────────────────────────────────────────────────────────────┘ │
│     │                                                                        │
│     │  RENDER: <td>James Miller</td>                                         │
│     │                                                                        │
│                                                                              │
│  ╔═══════════════════════════════════════════════════════════════════════╗  │
│  ║  EDIT MODE DROPDOWN                                                   ║  │
│  ╚═══════════════════════════════════════════════════════════════════════╝  │
│                                                                              │
│  Component: EntitySelect                                                     │
│  ───────────────────────                                                     │
│     │                                                                        │
│     │  const { options, isLoading } = useRefDataEntityInstanceOptions('employee')
│     │     │                                                                  │
│     │     ▼                                                                  │
│     │  ┌──────────────────────────────────────────────────────────────────┐ │
│     │  │  React Query checks cache:                                       │ │
│     │  │  ['ref-data-entity-instance', 'employee']                        │ │
│     │  │                                                                  │ │
│     │  │  CACHE HIT? (from earlier API response upsert)                   │ │
│     │  │    YES → Return cached { uuid: name } as options                 │ │
│     │  │    NO  → Fetch /api/v1/entity/employee/entity-instance          │ │
│     │  │          Store result in cache                                   │ │
│     │  │          Return as options                                       │ │
│     │  └──────────────────────────────────────────────────────────────────┘ │
│     │                                                                        │
│     │  options = [                                                           │
│     │    { value: "uuid-james", label: "James Miller" },                     │
│     │    { value: "uuid-sarah", label: "Sarah Johnson" }                     │
│     │  ]                                                                     │
│     │                                                                        │
│     │  RENDER: <Select options={options} />                                  │
│     │                                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Cache Structure

### React Query Cache Keys

```typescript
// Unified entity instance cache (NEW in v8.3.2)
['ref-data-entity-instance', 'employee']  // { uuid: name }
['ref-data-entity-instance', 'project']   // { uuid: name }
['ref-data-entity-instance', 'business']  // { uuid: name }

// Entity data queries (existing)
['entity-list', 'project', { limit: 20 }] // Full response with ref_data
['entity-instance', 'project', 'uuid-1']  // Single entity with ref_data
```

### Cache Population Sources

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CACHE POPULATION SOURCES                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Source 1: API Response Upsert (Primary)                                     │
│  ───────────────────────────────────────                                     │
│                                                                              │
│  useEntityInstanceList()  ─┐                                                 │
│  useEntityInstance()       ├──▶ upsertRefDataEntityInstanceCache()           │
│  useFormattedEntityList() ─┘         │                                       │
│                                      ▼                                       │
│                           ['ref-data-entity-instance', entityCode]           │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════════ │
│                                                                              │
│  Source 2: On-Demand Fetch (Dropdown)                                        │
│  ────────────────────────────────────                                        │
│                                                                              │
│  useRefDataEntityInstanceOptions('employee')                                 │
│         │                                                                    │
│         ▼                                                                    │
│  Cache MISS? ──▶ GET /api/v1/entity/employee/entity-instance                │
│         │                                                                    │
│         ▼                                                                    │
│  Store in ['ref-data-entity-instance', 'employee']                          │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════════ │
│                                                                              │
│  Source 3: Optional Prefetch (Login)                                         │
│  ────────────────────────────────────                                        │
│                                                                              │
│  prefetchEntityInstances(queryClient, ['employee', 'project', 'business'])  │
│         │                                                                    │
│         ▼                                                                    │
│  Parallel fetch and cache commonly used entities                            │
│                                                                              │
│  NOTE: Use sparingly - lazy loading is preferred                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Hook API Reference

### useRefDataEntityInstanceOptions

Dropdown population hook - primary way to get options for EntitySelect.

```typescript
import { useRefDataEntityInstanceOptions } from '@/lib/hooks';

function MyForm() {
  const { options, lookup, isLoading, error } = useRefDataEntityInstanceOptions('employee');

  // options: [{ value: "uuid-1", label: "James Miller" }, ...]
  // lookup: { "uuid-1": "James Miller", ... }
  // isLoading: boolean
  // error: Error | null

  return (
    <Select options={options} />
  );
}
```

### useRefDataEntityInstanceResolver

View mode resolution hook - resolve UUIDs to names from unified cache.

```typescript
import { useRefDataEntityInstanceResolver } from '@/lib/hooks';

function MyTable() {
  const { resolveName, resolveNames, hasCachedData } = useRefDataEntityInstanceResolver();

  // Single UUID
  const managerName = resolveName('employee', 'uuid-james'); // "James Miller"

  // Array of UUIDs
  const teamNames = resolveNames('employee', ['uuid-1', 'uuid-2']); // ["James", "Sarah"]

  // Check if data is cached
  if (!hasCachedData('employee')) {
    // Data not yet cached for this entity type
  }
}
```

### upsertRefDataEntityInstanceCache

Utility function to merge ref_data into cache (called automatically by query hooks).

```typescript
import { upsertRefDataEntityInstanceCache } from '@/lib/hooks';

// Inside queryFn or onSuccess
upsertRefDataEntityInstanceCache(queryClient, {
  employee: { "uuid-1": "James Miller" },
  business: { "uuid-2": "Huron Home" }
});
```

### prefetchEntityInstances

Optional bulk prefetch for common entities.

```typescript
import { prefetchEntityInstances } from '@/lib/hooks';

// After login (optional)
async function onLoginSuccess() {
  await prefetchEntityInstances(
    queryClient,
    ['employee', 'project', 'business'],
    { limit: 500 }
  );
}
```

---

## 7. API Response Structure

### Entity List Response

```json
{
  "data": [
    {
      "id": "uuid-project-1",
      "name": "Kitchen Renovation",
      "manager__employee_id": "uuid-james",
      "sponsor__employee_id": "uuid-sarah",
      "business_id": "uuid-huron"
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
    "viewType": {
      "manager__employee_id": {
        "renderType": "entityInstanceId",
        "lookupSource": "entityInstance",
        "lookupEntity": "employee"
      }
    },
    "editType": {
      "manager__employee_id": {
        "inputType": "entityInstanceId",
        "lookupSource": "entityInstance",
        "lookupEntity": "employee"
      }
    }
  },
  "total": 45,
  "limit": 20,
  "offset": 0
}
```

### Entity Instance Lookup Response

```json
{
  "data": [
    { "id": "uuid-james", "name": "James Miller" },
    { "id": "uuid-sarah", "name": "Sarah Johnson" }
  ],
  "total": 25
}
```

---

## 8. Benefits of Unified Cache

### Performance

| Metric | Before (v8.3.1) | After (v8.3.2) |
|--------|-----------------|----------------|
| Dropdown fetch when view cached | Always fetches | Cache hit |
| View render when dropdown cached | Always fetches | Cache hit |
| Memory for employee names | 2x (two caches) | 1x (unified) |
| Network requests | Separate for view/edit | Shared |

### Consistency

```
Before v8.3.2:
- View shows "James Miller"
- Dropdown shows "James M. Miller" (different fetch, different data)

After v8.3.2:
- Both use same cache entry
- Always consistent
```

### Developer Experience

```typescript
// Before: Two different patterns
const { options } = useEntityLookup('employee');         // Dropdown
const { resolveFieldDisplay } = useRefData(ref_data);   // View mode

// After: Unified pattern
const { options } = useRefDataEntityInstanceOptions('employee');  // Dropdown
const { resolveName } = useRefDataEntityInstanceResolver();       // View mode
// Both use ['ref-data-entity-instance', 'employee'] cache
```

---

## 9. File Reference

| File | Purpose |
|------|---------|
| `apps/web/src/lib/hooks/useRefDataEntityInstanceCache.ts` | **Unified cache hook (v8.3.2)** |
| `apps/web/src/lib/hooks/useRefData.ts` | Per-response resolution (legacy) |
| `apps/web/src/lib/hooks/useEntityQuery.ts` | Entity queries + cache upsert |
| `apps/web/src/lib/refDataResolver.ts` | Resolution utility functions |
| `apps/web/src/components/shared/ui/EntitySelect.tsx` | Single entity dropdown |
| `apps/web/src/components/shared/ui/EntityMultiSelect.tsx` | Multi-select dropdown |
| `apps/api/src/services/entity-infrastructure.service.ts` | build_ref_data_entityInstance() |
| `apps/api/src/modules/entity-instance-lookup/routes.ts` | Entity instance API |

---

## 10. Migration Guide

### From useEntityLookup to useRefDataEntityInstanceOptions

```typescript
// Before
import { useEntityLookup } from '@/lib/hooks/useEntityQuery';
const { options, isLoading } = useEntityLookup('employee');

// After
import { useRefDataEntityInstanceOptions } from '@/lib/hooks';
const { options, isLoading } = useRefDataEntityInstanceOptions('employee');
```

### EntitySelect Already Updated

EntitySelect and EntityMultiSelect have been updated to use the unified cache internally. No changes needed in consuming code.

---

**Version:** 8.3.2 | **Updated:** 2025-11-27 | **Pattern:** Unified Cache
