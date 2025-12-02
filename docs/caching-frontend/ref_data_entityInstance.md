# Entity Reference Resolution Pattern

**Version:** 14.0.0 | **Pattern Type:** TanStack Query Cache + Dexie | **Updated:** 2025-12-02

---

## 1. Overview

This document describes the complete end-to-end flow for entity reference resolution, from YAML configuration to UI rendering for both **VIEW** and **EDIT** modes.

### Core Problem

Database stores foreign key references as UUIDs, but users need human-readable names:

| Column Name | Stored Value | User Sees |
|-------------|--------------|-----------|
| `manager__employee_id` | `8260b1b0-5efc-...` | "James Miller" |
| `business_id` | `f0e9d8c7-b6a5-...` | "Huron Home Services" |
| `stakeholder__employee_ids` | `["uuid-1", "uuid-2"]` | "James, Sarah" |

### v11.0.0 Key Change: Single In-Memory Cache

**Removed sync stores.** Both VIEW and EDIT modes now read directly from the TanStack Query cache using `queryClient.getQueryData()`. This eliminates duplicate in-memory caches while maintaining synchronous access for formatters.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│           ENTITY REFERENCE RESOLUTION PATTERN (v11.0.0)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 1-5: BACKEND (YAML → Metadata → ref_data_entityInstance)      │   │
│  │                                                                       │   │
│  │  pattern-mapping.yaml → fieldBusinessType                            │   │
│  │  view-type-mapping.yaml → renderType, component, lookupEntity        │   │
│  │  edit-type-mapping.yaml → inputType, component, lookupEntity         │   │
│  │  build_ref_data_entityInstance() → { employee: { uuid: name } }      │   │
│  │  generateEntityResponse() → bundles data + metadata + ref_data       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                              │                                               │
│                              ▼                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 6: FRONTEND CACHE POPULATION (v11.0.0)                        │   │
│  │                                                                       │   │
│  │  useEntityInstanceData() receives API response:                      │   │
│  │  ├── queryClient.setQueryData(entityCode, names)  [TANSTACK QUERY]   │   │
│  │  └── persistToEntityInstanceNames(entityCode, names)  [DEXIE]        │   │
│  │                                                                       │   │
│  │  (v11.0.0: Removed separate sync stores - TanStack Query is cache)   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                              │                                               │
│                              ▼                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 7: FRONTEND RENDERING (Unified Cache Access)                  │   │
│  │                                                                       │   │
│  │  VIEW: formatReference() → getEntityInstanceNameSync(entityCode,uuid)│   │
│  │  EDIT: useRefDataEntityInstanceOptions() → same TanStack Query cache │   │
│  │                                                                       │   │
│  │  getEntityInstanceNameSync() reads from queryClient.getQueryData()   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Flow Architecture

### 2.1 API Response → Cache Population (v11.0.0)

When `useEntityInstanceData` fetches data, it receives `ref_data_entityInstance` and populates **two cache tiers**:

**File:** `apps/web/src/db/cache/hooks/useEntityInstanceData.ts`

```typescript
if (apiData.ref_data_entityInstance) {
  for (const [refEntityCode, names] of Object.entries(apiData.ref_data_entityInstance)) {
    // v11.0.0: Set directly in TanStack Query cache (sync store removed)
    queryClient.setQueryData(
      QUERY_KEYS.entityInstanceNames(refEntityCode),
      (existing: Record<string, string> | undefined) => ({ ...existing, ...names })
    );
    // Persist to Dexie for offline access
    await persistToEntityInstanceNames(refEntityCode, names);
  }
}
```

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    API RESPONSE → CACHE POPULATION (v11.0.0)                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  API Response                                                                │
│      │                                                                       │
│      ▼                                                                       │
│  ref_data_entityInstance: { employee: { "uuid-1": "James Miller" } }         │
│      │                                                                       │
│      ├──────────────────────────────────────────────────────────────────┐    │
│      │                                                                  │    │
│      ▼                                                                  ▼    │
│  ┌────────────────────────────────┐  ┌────────────────────────────────┐│    │
│  │ TanStack Query Cache           │  │ persistToEntityInstanceNames() ││    │
│  │ queryClient.setQueryData(...)  │  │ → Dexie IndexedDB              ││    │
│  │                                │  │                                ││    │
│  │ SINGLE IN-MEMORY CACHE         │  │ PERSISTENT STORAGE             ││    │
│  │ • Used by hooks (useQuery)     │  │ • Survives browser restart     ││    │
│  │ • Used by sync accessors       │  │ • Hydrated on app start        ││    │
│  │   (getEntityInstanceNameSync)  │  │                                ││    │
│  └────────────────────────────────┘  └────────────────────────────────┘│    │
│                                                                        │    │
│  v11.0.0: Removed separate sync stores                                 │    │
│  • getEntityInstanceNameSync() reads from queryClient.getQueryData()   │    │
│  • Single source of truth for all in-memory cache access               │    │
│                                                                        │    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Format-on-Read Uses TanStack Query Cache

When `formatDataset()` is called, `formatReference()` reads from the TanStack Query cache via sync accessor:

**File:** `apps/web/src/lib/formatters/valueFormatters.ts`

```typescript
// v11.0.0: Read from TanStack Query cache via sync accessor
if (entityCode) {
  const name = getEntityInstanceNameSync(entityCode, uuid);
  if (name) return { display: name };
}
```

**File:** `apps/web/src/db/cache/stores.ts`

```typescript
// v11.0.0: Sync accessor reads directly from queryClient.getQueryData()
export function getEntityInstanceNameSync(
  entityCode: string,
  entityInstanceId: string
): string | null {
  const names = queryClient.getQueryData<Record<string, string>>(
    QUERY_KEYS.entityInstanceNames(entityCode)
  );
  return names?.[entityInstanceId] ?? null;
}
```

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FORMAT-ON-READ FLOW (v11.0.0)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Component calls formatDataset(rawData, metadata)                            │
│      │                                                                       │
│      ▼                                                                       │
│  formatDataset() [datasetFormatter.ts]                                       │
│      │                                                                       │
│      ▼                                                                       │
│  for each row: formatRow(row, metadata)                                      │
│      │                                                                       │
│      ▼                                                                       │
│  for each field: formatValue(value, key, fieldMeta)                          │
│      │                                                                       │
│      ├── renderType === 'component'?                                         │
│      │       └── component === 'EntityInstanceName'?                         │
│      │               └── formatReference(value, metadata)                    │
│      │                                                                       │
│      └── renderType === 'entityInstanceId'?                                  │
│              └── formatReference(value, metadata)                            │
│                      │                                                       │
│                      ▼                                                       │
│              ┌─────────────────────────────────────────────┐                 │
│              │ formatReference(uuid, metadata)             │                 │
│              │                                             │                 │
│              │ entityCode = metadata.lookupEntity          │                 │
│              │           ↓                                 │                 │
│              │ getEntityInstanceNameSync(entityCode, uuid) │                 │
│              │           ↓                                 │                 │
│              │ queryClient.getQueryData(                   │                 │
│              │   QUERY_KEYS.entityInstanceNames(entityCode)│                 │
│              │ )?.[uuid]                                   │                 │
│              │           ↓                                 │                 │
│              │ return { display: "James Miller" }          │                 │
│              └─────────────────────────────────────────────┘                 │
│                      │                                                       │
│                      ▼                                                       │
│  FormattedRow                                                                │
│  └── raw: { manager__employee_id: "uuid-james" }                             │
│  └── display: { manager__employee_id: "James Miller" }                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Cache Architecture

### 3.1 Two-Tier Cache System (v11.0.0)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CACHE HIERARCHY (v11.0.0)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  TIER 1: TanStack Query Cache (In-Memory - Single Source of Truth)    │ │
│  │  ────────────────────────────────────────────────────────────────────│ │
│  │  • Cache key: ['entityInstanceNames', entityCode]                     │ │
│  │  • Used by: React hooks (useEntityInstanceNames)                      │ │
│  │  • Used by: Sync accessors (getEntityInstanceNameSync)                │ │
│  │  • Populated: queryClient.setQueryData() after API fetch              │ │
│  │  • Access: queryClient.getQueryData(QUERY_KEYS.entityInstanceNames()) │ │
│  │  • gcTime: 30 minutes, staleTime: 10 minutes                          │ │
│  │                                                                        │ │
│  │  v11.0.0: Sync accessors now read from this cache directly            │ │
│  │  (no separate Map-based sync stores)                                  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                              │                                               │
│                              ▼                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  TIER 2: Dexie (IndexedDB Persistent)                                  │ │
│  │  ─────────────────────────────────────                                │ │
│  │  • Persists across browser restart                                     │ │
│  │  • Table: entityInstanceNames                                          │ │
│  │  • Hydrated to TanStack Query cache on app start                       │ │
│  │  • Populated: persistToEntityInstanceNames(entityCode, names)          │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Sync Accessor Implementation (v11.0.0)

**File:** `apps/web/src/db/cache/stores.ts`

```typescript
import { queryClient } from './client';
import { QUERY_KEYS } from './keys';

/**
 * Get entity instance name synchronously from TanStack Query cache
 *
 * v11.0.0: Reads directly from queryClient.getQueryData() - no separate sync stores
 *
 * Used by:
 * - formatReference() for VIEW mode display
 * - EntityInstanceNameSelect for immediate label resolution
 * - EntityInstanceNameMultiSelect for chip labels
 */
export function getEntityInstanceNameSync(
  entityCode: string,
  entityInstanceId: string
): string | null {
  const names = queryClient.getQueryData<Record<string, string>>(
    QUERY_KEYS.entityInstanceNames(entityCode)
  );
  return names?.[entityInstanceId] ?? null;
}

/**
 * Get all entity instance names for a type synchronously
 */
export function getEntityInstanceNamesForTypeSync(
  entityCode: string
): Record<string, string> {
  return queryClient.getQueryData<Record<string, string>>(
    QUERY_KEYS.entityInstanceNames(entityCode)
  ) ?? {};
}
```

---

## 4. Backend Layers (1-5)

### 4.1 Layer 1: YAML Pattern Matching

**File:** `apps/api/src/services/pattern-mapping.yaml`

```yaml
patterns:
  # Prefixed references: manager__employee_id, sponsor__client_id
  - { pattern: "*__*_id", exact: false, fieldBusinessType: entityInstance_Id }
  - { pattern: "*__*_ids", exact: false, fieldBusinessType: entityInstance_Ids }

  # Simple references: office_id, business_id
  - { pattern: "*_id", exact: false, fieldBusinessType: entityInstance_Id }
  - { pattern: "*_ids", exact: false, fieldBusinessType: entityInstance_Ids }
```

### 4.2 Layer 2: View Type Mapping

**File:** `apps/api/src/services/view-type-mapping.yaml`

```yaml
fieldBusinessTypes:
  entityInstance_Id:
    dtype: uuid
    entityListOfInstancesTable:
      renderType: component
      component: EntityInstanceName
      behavior: { visible: true, sortable: false, filterable: false }
      style: { displayField: name, linkToEntity: true }
```

### 4.3 Layer 3: Edit Type Mapping

**File:** `apps/api/src/services/edit-type-mapping.yaml`

```yaml
fieldBusinessTypes:
  entityInstance_Id:
    dtype: uuid
    lookupSource: entityInstance
    entityListOfInstancesTable:
      inputType: EntityInstanceNameSelect
      behavior: { editable: true, filterable: true, sortable: false }
```

### 4.4 Layer 4: Reference Data Building

**File:** `apps/api/src/services/entity-infrastructure.service.ts`

```typescript
async build_ref_data_entityInstance(
  rows: Record<string, any>[]
): Promise<Record<string, Record<string, string>>> {
  // Scans all _id/_ids fields, batch queries entity_instance table
  // Returns: { employee: { "uuid": "James Miller" }, ... }
}
```

### 4.5 Layer 5: API Response Assembly

**File:** `apps/api/src/services/backend-formatter.service.ts`

```json
{
  "data": [{ "manager__employee_id": "uuid-james", ... }],
  "ref_data_entityInstance": {
    "employee": { "uuid-james": "James Miller" }
  },
  "metadata": {
    "entityListOfInstancesTable": {
      "viewType": {
        "manager__employee_id": {
          "renderType": "component",
          "component": "EntityInstanceName",
          "lookupEntity": "employee"
        }
      },
      "editType": {
        "manager__employee_id": {
          "inputType": "EntityInstanceNameSelect",
          "lookupSource": "entityInstance",
          "lookupEntity": "employee"
        }
      }
    }
  }
}
```

---

## 5. View Mode Rendering

### 5.1 Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         VIEW MODE FLOW (v11.0.0)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  useEntityInstanceData() returns:                                            │
│  └── data: [{ manager__employee_id: "uuid-james" }]                          │
│  └── metadata.entityListOfInstancesTable.viewType.manager__employee_id:      │
│        └── renderType: "component"                                           │
│        └── component: "EntityInstanceName"                                   │
│        └── lookupEntity: "employee"                                          │
│                              │                                               │
│  (Cache already populated by useEntityInstanceData)                          │
│                              │                                               │
│                              ▼                                               │
│  EntityListOfInstancesPage calls:                                            │
│  formatDataset(rawData, metadata)   ← NO refData param needed                │
│                              │                                               │
│                              ▼                                               │
│  formatValue() → formatReference(value, metadata)                            │
│                              │                                               │
│                              ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │ formatReference('uuid-james', { lookupEntity: 'employee' })     │        │
│  │                                                                  │        │
│  │ const name = getEntityInstanceNameSync('employee', 'uuid-james')│        │
│  │                         ↓                                        │        │
│  │ queryClient.getQueryData(['entityInstanceNames', 'employee'])    │        │
│  │ ?.[uuid-james]                                                   │        │
│  │                         ↓                                        │        │
│  │ return { display: "James Miller" }                               │        │
│  └─────────────────────────────────────────────────────────────────┘        │
│                              │                                               │
│                              ▼                                               │
│  EntityListOfInstancesTable renders:                                         │
│  └── <td>{row.display['manager__employee_id']}</td>                          │
│  └── Shows: "James Miller"                                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Code Implementation

**File:** `apps/web/src/lib/formatters/valueFormatters.ts`

```typescript
import { getEntityInstanceNameSync } from '@/db/cache/stores';

export function formatReference(
  value: any,
  metadata?: FieldMetadata
): FormattedValue {
  if (value === null || value === undefined || value === '') {
    return { display: '—' };
  }

  const entityCode = metadata?.lookupEntity;

  // Handle array of UUIDs
  if (Array.isArray(value)) {
    if (value.length === 0) return { display: '—' };

    const names = value.map(uuid => {
      // v11.0.0: Use TanStack Query cache via sync accessor
      if (entityCode) {
        const name = getEntityInstanceNameSync(entityCode, uuid);
        if (name) return name;
      }
      return String(uuid).substring(0, 8) + '...';
    });

    return { display: names.join(', ') };
  }

  // Single UUID
  const uuid = String(value);

  // v11.0.0: Read from TanStack Query cache via sync accessor
  if (entityCode) {
    const name = getEntityInstanceNameSync(entityCode, uuid);
    if (name) return { display: name };
  }

  // Fallback: truncated UUID
  return { display: uuid.length > 8 ? `${uuid.substring(0, 8)}...` : uuid };
}
```

---

## 6. Edit Mode Rendering

### 6.1 Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EDIT MODE FLOW (v11.0.0)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  metadata.editType.manager__employee_id:                                     │
│  └── inputType: "EntityInstanceNameSelect"                                   │
│  └── lookupSource: "entityInstance"                                          │
│  └── lookupEntity: "employee"                                                │
│                              │                                               │
│                              ▼                                               │
│  renderEditModeFromMetadata(value, metadata, onChange)                       │
│  └── case 'EntityInstanceNameSelect':                                        │
│        └── <EntityInstanceNameSelect entityCode="employee" />                │
│                              │                                               │
│                              ▼                                               │
│  EntityInstanceNameSelect component                                          │
│  └── useRefDataEntityInstanceOptions('employee')                             │
│        └── Reads from TanStack Query cache                                   │
│        └── Cache key: ['entityInstanceNames', 'employee']                    │
│        └── Returns: { options: [{ value: uuid, label: name }] }              │
│  └── For immediate label resolution:                                         │
│        └── getEntityInstanceNameSync(entityCode, value)                      │
│                              │                                               │
│                              ▼                                               │
│  Dropdown renders with employee names                                        │
│  └── User selects "James Miller"                                             │
│  └── onChange(uuid) called                                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Code Implementation

**File:** `apps/web/src/lib/hooks/useRefDataEntityInstance.ts`

```typescript
export function useRefDataEntityInstanceOptions(entityCode: string) {
  const queryClient = useQueryClient();

  // Read from TanStack Query cache
  const data = queryClient.getQueryData<Record<string, string>>(
    QUERY_KEYS.entityInstanceNames(entityCode)
  );

  const options = useMemo(() => {
    if (!data) return [];
    return Object.entries(data).map(([uuid, name]) => ({
      value: uuid,
      label: name,
    }));
  }, [data]);

  return { options, lookup: data || {}, isLoading: !data };
}
```

**File:** `apps/web/src/components/shared/ui/EntityInstanceNameSelect.tsx`

```typescript
import { getEntityInstanceNameSync } from '@/db/cache/stores';

// Get current selected option label
// v11.0.0: Use TanStack Query cache accessor for immediate resolution
const selectedOption = options.find(opt => opt.value === value);
const cachedName = value ? getEntityInstanceNameSync(entityCode, value) : null;
const displayLabel = selectedOption?.label || cachedName || currentLabel || '';
```

---

## 7. Optimistic Updates

### 7.1 Why Single Cache Solves the Problem

**Before v10.0.0:**
- `refData` was passed through component props
- After optimistic update, cache updated but `refData` not re-fetched
- UUIDs displayed instead of names

**v10.0.0 (Sync Stores):**
- `entityInstanceNamesStore` persisted across renders
- `formatReference()` read from store
- Names resolved correctly

**v11.0.0 (TanStack Query Only):**
- TanStack Query cache is single source of truth
- `getEntityInstanceNameSync()` reads from queryClient
- No duplicate sync stores - same cache as React hooks
- Names resolve correctly after optimistic updates

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    OPTIMISTIC UPDATE FLOW (v11.0.0)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. User edits a field                                                       │
│      │                                                                       │
│      ▼                                                                       │
│  2. useOptimisticMutation() updates TanStack Query cache                     │
│     └── updateAllListCaches() patches the row data                           │
│      │                                                                       │
│      ▼                                                                       │
│  3. Component re-renders with updated rawData                                │
│      │                                                                       │
│      ▼                                                                       │
│  4. formatDataset(rawData, metadata) called                                  │
│      │                                                                       │
│      ▼                                                                       │
│  5. formatReference() → getEntityInstanceNameSync()                          │
│      │                                                                       │
│      ▼                                                                       │
│  6. queryClient.getQueryData(['entityInstanceNames', entityCode])            │
│     └── Name still in TanStack Query cache! ✓                                │
│      │                                                                       │
│      ▼                                                                       │
│  7. "James Miller" displays correctly                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Key Design Principles

### 8.1 Backend is Single Source of Truth

The backend owns field semantics. Frontend does NOT:
- Parse field names to detect types
- Guess which entity a `_id` field references
- Hardcode field-to-entity mappings

```
✗ WRONG (Frontend pattern detection):
  if (fieldName.endsWith('_id')) → assume entity reference

✓ CORRECT (Metadata-driven):
  if (metadata.lookupEntity) → use getEntityInstanceNameSync(metadata.lookupEntity, uuid)
```

### 8.2 Single In-Memory Cache (v11.0.0)

TanStack Query cache serves both React hooks and sync accessors:

```
v10.0.0:                              v11.0.0:
┌─────────────┐  ┌─────────────┐    ┌─────────────────────────────────┐
│ Sync Stores │  │ TanStack    │    │    TanStack Query Cache         │
│ (Map-based) │  │ Query cache │ →  │    (Single Source of Truth)     │
└─────────────┘  └─────────────┘    └─────────────────────────────────┘
      ↑                ↑                      ↑              ↑
formatReference()  useQuery()        getEntityInstanceNameSync()  useQuery()
(sync accessor)   (React hook)       (sync accessor - reads      (React hook)
                                      from queryClient)
```

### 8.3 Format-at-Read Pattern

Data is stored raw in cache, formatted when read:

```
API Response → TanStack Query Cache (RAW data)
                     │
                     │ formatDataset(data, metadata)
                     ▼
              FormattedRow[] (MEMOIZED)
              └── raw: { manager__employee_id: "uuid-james" }
              └── display: { manager__employee_id: "James Miller" }
```

---

## 9. File Reference

| Component | File Path |
|-----------|-----------|
| Pattern Mapping | `apps/api/src/services/pattern-mapping.yaml` |
| View Type Mapping | `apps/api/src/services/view-type-mapping.yaml` |
| Edit Type Mapping | `apps/api/src/services/edit-type-mapping.yaml` |
| Backend Formatter | `apps/api/src/services/backend-formatter.service.ts` |
| Entity Infrastructure | `apps/api/src/services/entity-infrastructure.service.ts` |
| Dataset Formatter | `apps/web/src/lib/formatters/datasetFormatter.ts` |
| Value Formatters | `apps/web/src/lib/formatters/valueFormatters.ts` |
| Sync Accessors | `apps/web/src/db/cache/stores.ts` |
| useEntityInstanceData | `apps/web/src/db/cache/hooks/useEntityInstanceData.ts` |
| RefData Hooks | `apps/web/src/lib/hooks/useRefDataEntityInstance.ts` |
| EntityInstanceNameSelect | `apps/web/src/components/shared/ui/EntityInstanceNameSelect.tsx` |
| EntityInstanceNameMultiSelect | `apps/web/src/components/shared/ui/EntityInstanceNameMultiSelect.tsx` |

---

## 10. Migration Notes (v11.0.0)

### 10.1 Removed

- `entityInstanceNamesStore` class
- `entityInstanceNamesStore.merge()` method
- `entityInstanceNamesStore.getName()` method
- `clearAllSyncStores()` function

### 10.2 Changed

| Before (v10.0.0) | After (v11.0.0) |
|------------------|-----------------|
| `entityInstanceNamesStore.getName(code, uuid)` | `getEntityInstanceNameSync(code, uuid)` |
| `entityInstanceNamesStore.merge(code, names)` | `queryClient.setQueryData(...)` |

### 10.3 Same API, Different Implementation

The sync accessor functions have the same API but now read from `queryClient.getQueryData()`:

```typescript
// Before v11.0.0 (stores.ts):
export function getEntityInstanceNameSync(entityCode: string, entityInstanceId: string): string | null {
  return entityInstanceNamesStore.getName(entityCode, entityInstanceId);
}

// After v11.0.0 (stores.ts):
export function getEntityInstanceNameSync(entityCode: string, entityInstanceId: string): string | null {
  const names = queryClient.getQueryData<Record<string, string>>(
    QUERY_KEYS.entityInstanceNames(entityCode)
  );
  return names?.[entityInstanceId] ?? null;
}
```

---

**Version:** 14.0.0 | **Updated:** 2025-12-02 | **Architecture:** TanStack Query Cache + Dexie (v11.0.0 - Sync Stores Removed)
