# Entity Reference Resolution Pattern

**Version:** 13.0.0 | **Pattern Type:** Centralized Sync Store + TanStack Query + Dexie | **Updated:** 2025-12-02

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

### v10.0.0 Key Change: Centralized Cache

Both VIEW and EDIT modes now use the same centralized `entityInstanceNamesStore` sync store. This solves the problem where entity reference fields showed UUIDs after optimistic updates.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│           ENTITY REFERENCE RESOLUTION PATTERN (v13.0.0)                      │
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
│  │  LAYER 6: FRONTEND CACHE POPULATION (v10.0.0)                        │   │
│  │                                                                       │   │
│  │  useEntityInstanceData() receives API response:                      │   │
│  │  ├── entityInstanceNamesStore.merge(entityCode, names) [SYNC STORE]  │   │
│  │  ├── persistToEntityInstanceNames(entityCode, names)  [DEXIE]        │   │
│  │  └── upsertRefDataEntityInstance(queryClient, ...)    [TANSTACK]     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                              │                                               │
│                              ▼                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 7: FRONTEND RENDERING (Unified Cache Access)                  │   │
│  │                                                                       │   │
│  │  VIEW: formatReference() → getEntityInstanceNameSync(entityCode,uuid)│   │
│  │  EDIT: useRefDataEntityInstanceOptions() → same centralized cache    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Flow Architecture

### 2.1 API Response → Cache Population

When `useEntityInstanceData` fetches data, it receives `ref_data_entityInstance` and populates **three cache tiers**:

**File:** `apps/web/src/db/cache/hooks/useEntityInstanceData.ts:506-513`

```typescript
if (apiData.ref_data_entityInstance) {
  for (const [refEntityCode, names] of Object.entries(apiData.ref_data_entityInstance)) {
    await persistToEntityInstanceNames(refEntityCode, names);  // Dexie (IndexedDB)
    entityInstanceNamesStore.merge(refEntityCode, names);       // Sync store (in-memory)
  }
  // Also upsert to TanStack Query cache for edit mode hooks
  upsertRefDataEntityInstance(queryClient, apiData.ref_data_entityInstance);
}
```

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    API RESPONSE → CACHE POPULATION                           │
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
│  ┌────────────────────────────┐  ┌────────────────────────────────────┐│    │
│  │ entityInstanceNamesStore   │  │ persistToEntityInstanceNames()     ││    │
│  │ .merge('employee', names)  │  │ → Dexie IndexedDB                  ││    │
│  │                            │  │                                    ││    │
│  │ IN-MEMORY SYNC STORE       │  │ PERSISTENT STORAGE                 ││    │
│  │ • Instant access           │  │ • Survives browser restart         ││    │
│  │ • Used by formatReference()│  │ • Hydrated on app start            ││    │
│  └────────────────────────────┘  └────────────────────────────────────┘│    │
│      │                                                                  │    │
│      └──────────────────────────────────────────────────────────────────┘    │
│      │                                                                       │
│      ▼                                                                       │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ upsertRefDataEntityInstance(queryClient, ref_data)                 │     │
│  │ → TanStack Query Cache                                              │     │
│  │ • Cache key: ['ref_data_entityInstance', entityCode]                │     │
│  │ • Used by useRefDataEntityInstanceOptions() for edit dropdowns      │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Format-on-Read Uses Centralized Cache

When `formatDataset()` is called, `formatReference()` reads from the centralized sync store:

**File:** `apps/web/src/lib/formatters/valueFormatters.ts:265-268`

```typescript
// v10.0.0: Try to resolve from centralized sync store
if (entityCode) {
  const name = getEntityInstanceNameSync(entityCode, uuid);
  if (name) return { display: name };
}
```

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FORMAT-ON-READ FLOW (v10.0.0)                             │
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
│              │ entityInstanceNamesStore.getName()          │                 │
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

### 3.1 Three-Tier Cache System

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CACHE HIERARCHY (v10.0.0)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  TIER 1: entityInstanceNamesStore (In-Memory Sync Store)               │ │
│  │  ─────────────────────────────────────────────────────────            │ │
│  │  • Fastest access - synchronous                                        │ │
│  │  • Used by: formatReference() via getEntityInstanceNameSync()          │ │
│  │  • Structure: Map<entityCode, Record<uuid, name>>                      │ │
│  │  • Populated: entityInstanceNamesStore.merge(entityCode, names)        │ │
│  │  • Access: getEntityInstanceNameSync('employee', 'uuid') → 'James'     │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                              │                                               │
│                              ▼                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  TIER 2: TanStack Query Cache (In-Memory Reactive)                     │ │
│  │  ─────────────────────────────────────────────────────                │ │
│  │  • Cache key: ['ref_data_entityInstance', entityCode]                  │ │
│  │  • Used by: useRefDataEntityInstanceOptions() for edit dropdowns       │ │
│  │  • Populated: upsertRefDataEntityInstance(queryClient, ref_data)       │ │
│  │  • gcTime: 30 minutes, staleTime: 5 minutes                            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                              │                                               │
│                              ▼                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  TIER 3: Dexie (IndexedDB Persistent)                                  │ │
│  │  ─────────────────────────────────────────                            │ │
│  │  • Persists across browser restart                                     │ │
│  │  • Table: entityInstanceName                                           │ │
│  │  • Hydrated to sync store on app start                                 │ │
│  │  • Populated: persistToEntityInstanceNames(entityCode, names)          │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Sync Store Implementation

**File:** `apps/web/src/db/cache/stores.ts`

```typescript
class EntityInstanceNamesStore {
  private byType = new Map<string, Record<string, string>>();

  // Set single name
  set(entityCode: string, entityInstanceId: string, name: string): void;
  // Set multiple names
  set(entityCode: string, names: Record<string, string>): void;

  // Merge new names with existing (preserves existing entries)
  merge(entityCode: string, names: Record<string, string>): void {
    const existing = this.byType.get(entityCode) || {};
    this.byType.set(entityCode, { ...existing, ...names });
  }

  // Get single name - used by formatReference()
  getName(entityCode: string, entityInstanceId: string): string | null {
    return this.byType.get(entityCode)?.[entityInstanceId] ?? null;
  }

  // Get all names for entity type - used by edit dropdowns
  getNames(entityCode: string): Record<string, string> {
    return this.byType.get(entityCode) || {};
  }
}

export const entityInstanceNamesStore = new EntityInstanceNamesStore();

// Convenience function for formatReference()
export function getEntityInstanceNameSync(
  entityCode: string,
  entityInstanceId: string
): string | null {
  return entityInstanceNamesStore.getName(entityCode, entityInstanceId);
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
│                         VIEW MODE FLOW (v10.0.0)                             │
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
│  │ entityInstanceNamesStore.getName('employee', 'uuid-james')       │        │
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
import { getEntityInstanceNameSync } from '../../db/tanstack-index';

export function formatReference(
  value: any,
  metadata?: FieldMetadata,
  _refData?: Record<string, Record<string, string>>  // DEPRECATED v10.0.0
): FormattedValue {
  if (value === null || value === undefined || value === '') {
    return { display: '—' };
  }

  const entityCode = metadata?.lookupEntity;

  // Handle array of UUIDs
  if (Array.isArray(value)) {
    if (value.length === 0) return { display: '—' };

    const names = value.map(uuid => {
      // v10.0.0: Use centralized sync store
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

  // v10.0.0: Try to resolve from centralized sync store
  if (entityCode) {
    const name = getEntityInstanceNameSync(entityCode, uuid);
    if (name) return { display: name };
  }

  // Fallback: truncated UUID
  return { display: uuid.length > 8 ? `${uuid.substring(0, 8)}...` : uuid };
}
```

**File:** `apps/web/src/pages/shared/EntityListOfInstancesPage.tsx`

```typescript
// v10.0.0: refData removed from destructuring - using centralized entityInstanceNames sync store
const {
  data: rawData,
  total: totalRecords,
  isLoading: dataLoading,
  // ref_data_entityInstance no longer needed - cache populated automatically
} = useEntityInstanceData(entityCode, queryParams, { enabled: !!config });

// v10.0.0: refData no longer passed - formatDataset uses centralized sync store
const formattedData = useMemo(() => {
  if (!rawData || rawData.length === 0) return [];
  return formatDataset(rawData, metadata as ComponentMetadata | undefined);
}, [rawData, metadata]);
```

---

## 6. Edit Mode Rendering

### 6.1 Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EDIT MODE FLOW                                       │
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
│        └── Cache key: ['ref_data_entityInstance', 'employee']                │
│        └── Returns: { options: [{ value: uuid, label: name }] }              │
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

  // Read from TanStack Query cache (same data as sync store)
  const data = queryClient.getQueryData<Record<string, string>>(
    ['ref_data_entityInstance', entityCode]
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

---

## 7. Optimistic Updates

### 7.1 Why Centralized Cache Solves the Problem

**Before v10.0.0:**
- `refData` was passed through component props
- After optimistic update, cache updated but `refData` not re-fetched
- UUIDs displayed instead of names

**After v10.0.0:**
- `entityInstanceNamesStore` persists across renders
- `formatReference()` reads from store, not props
- Names resolve correctly after optimistic updates

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    OPTIMISTIC UPDATE FLOW (v10.0.0)                          │
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
│  6. entityInstanceNamesStore still has the name! ✓                           │
│     (Store persists across re-renders, populated on initial fetch)           │
│      │                                                                       │
│      ▼                                                                       │
│  7. "James Miller" displays correctly                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Conditional Branching Summary

### 8.1 View Mode Branching

```
formatValue(value, key, metadata)
  │
  ├─ renderType === 'component'?
  │   └─ component in ['EntityInstanceName', 'EntityInstanceNames']?
  │       └─ YES → formatReference(value, metadata)
  │                  └─ getEntityInstanceNameSync(entityCode, uuid)
  │       └─ NO → formatText(value)
  │
  ├─ renderType in ['entityInstanceId', 'entityInstanceIds', 'reference']?
  │   └─ YES → formatReference(value, metadata)
  │
  └─ default → FORMATTERS[renderType](value, metadata)
```

### 8.2 Edit Mode Branching

```
renderEditModeFromMetadata(value, metadata, onChange)
  │
  ├─ inputType === 'EntityInstanceNameSelect'?
  │   └─ YES → <EntityInstanceNameSelect entityCode={metadata.lookupEntity} />
  │              └─ useRefDataEntityInstanceOptions(entityCode)
  │
  ├─ inputType === 'EntityInstanceNameMultiSelect'?
  │   └─ YES → <EntityInstanceNameMultiSelect entityCode={metadata.lookupEntity} />
  │
  └─ default → other input types
```

---

## 9. Key Design Principles

### 9.1 Backend is Single Source of Truth

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

### 9.2 Unified Cache for View and Edit

One centralized store serves both display and dropdown population:

```
BEFORE v10.0.0:                      AFTER v10.0.0:
┌─────────────┐  ┌─────────────┐    ┌─────────────────────────────────┐
│ refData prop│  │ TanStack    │    │    entityInstanceNamesStore     │
│ passed down │  │ Query cache │ →  │    (centralized sync store)     │
└─────────────┘  └─────────────┘    └─────────────────────────────────┘
                                           ↑              ↑
                                    formatReference()  useRefDataEntityInstanceOptions()
                                    (VIEW mode)        (EDIT mode)
```

### 9.3 Format-at-Read Pattern

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

## 10. File Reference

| Component | File Path |
|-----------|-----------|
| Pattern Mapping | `apps/api/src/services/pattern-mapping.yaml` |
| View Type Mapping | `apps/api/src/services/view-type-mapping.yaml` |
| Edit Type Mapping | `apps/api/src/services/edit-type-mapping.yaml` |
| Backend Formatter | `apps/api/src/services/backend-formatter.service.ts` |
| Entity Infrastructure | `apps/api/src/services/entity-infrastructure.service.ts` |
| Dataset Formatter | `apps/web/src/lib/formatters/datasetFormatter.ts` |
| Value Formatters | `apps/web/src/lib/formatters/valueFormatters.ts` |
| Sync Store | `apps/web/src/db/cache/stores.ts` |
| useEntityInstanceData | `apps/web/src/db/cache/hooks/useEntityInstanceData.ts` |
| RefData Hooks | `apps/web/src/lib/hooks/useRefDataEntityInstance.ts` |

---

## 11. Migration Notes (v10.0.0)

### 11.1 Deprecated Parameters

The `refData` parameter is deprecated in these functions but kept for backward compatibility:

- `formatDataset(data, metadata, _refData?)`
- `formatRow(row, metadata, _refData?)`
- `formatValue(value, key, metadata, _refData?)`
- `formatReference(value, metadata, _refData?)`

### 11.2 Deprecated Props

The `ref_data_entityInstance` prop is deprecated in:

- `EntityListOfInstancesTable` component

### 11.3 What Changed

| Before v10.0.0 | After v10.0.0 |
|----------------|---------------|
| `refData` passed through component tree | Centralized `entityInstanceNamesStore` |
| `formatReference(value, meta, refData)` | `formatReference(value, meta)` + `getEntityInstanceNameSync()` |
| Names lost after optimistic updates | Names persist in sync store |

---

**Version:** 13.0.0 | **Updated:** 2025-12-02 | **Architecture:** Centralized Sync Store + TanStack Query + Dexie
