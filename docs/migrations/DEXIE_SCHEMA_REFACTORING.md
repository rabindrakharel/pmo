# Dexie Schema Refactoring Plan

> Separating metadata stores for cleaner architecture and better cache management

**Version**: 1.0.0
**Status**: Planning
**Created**: 2025-11-30

---

## Table of Contents

1. [Current State](#current-state)
2. [Target State](#target-state)
3. [Migration Phases](#migration-phases)
4. [Affected Files](#affected-files)
5. [Implementation Details](#implementation-details)
6. [Rollback Strategy](#rollback-strategy)

---

## Current State

### Current Dexie Tables

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CURRENT DEXIE SCHEMA                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  COMBINED TABLES (Anti-Pattern)                                              │
│  ──────────────────────────────                                              │
│                                                                              │
│  metadata                          ← Combined: datalabels + entityCodes +    │
│  ├── _id: 'datalabel:project_stage'         globalSettings                   │
│  ├── type: 'datalabel' | 'entityCodes' | 'globalSettings'                   │
│  ├── key?: string                                                            │
│  ├── data: unknown                                                           │
│  └── syncedAt: number                                                        │
│                                                                              │
│  entities                          ← Combined: data + metadata + refData     │
│  ├── _id: 'project:uuid-123'                                                │
│  ├── data: Record<string, unknown>                                          │
│  ├── metadata?: Record<string, unknown>  ← Field metadata mixed in          │
│  ├── refData?: Record<...>                                                  │
│  └── syncedAt: number                                                        │
│                                                                              │
│  entityLists                       ← Combined: list results + metadata       │
│  ├── _id: 'project:{queryHash}'                                             │
│  ├── entityIds: string[]                                                    │
│  ├── metadata?: Record<string, unknown>  ← Field metadata mixed in          │
│  └── syncedAt: number                                                        │
│                                                                              │
│  entityInstanceNames               ← Misleading name (should be entityInstance)│
│  ├── _id: 'project:uuid-123'                                                │
│  ├── entityCode: string                                                     │
│  ├── entityInstanceId: string                                               │
│  └── entityInstanceName: string                                             │
│                                                                              │
│  NORMALIZED TABLES (Keep As-Is)                                              │
│  ──────────────────────────────                                              │
│  entityTypes          → Layer 1: Entity type definitions                    │
│  entityInstances      → Layer 2: Instance registry                          │
│  entityLinksForward   → Layer 3: Parent→children index                      │
│  entityLinksReverse   → Layer 3: Child→parents index                        │
│  entityLinksRaw       → Layer 3: Raw link records                           │
│  drafts               → Unsaved form edits                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Problems with Current Design

| Issue | Impact |
|-------|--------|
| `metadata` table combines 3 different types | Cannot query efficiently by type |
| `entities` stores field metadata with data | Metadata duplicated per record |
| `entityLists` stores metadata with results | Same metadata cached multiple times |
| `entityInstanceNames` misleading name | Confusion with `entityInstances` |
| Field metadata not shared | Each query caches same metadata |

---

## Target State

### New Dexie Tables

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        TARGET DEXIE SCHEMA                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SEPARATED METADATA TABLES                                                   │
│  ─────────────────────────                                                   │
│                                                                              │
│  datalabels                        ← NEW: Dedicated datalabel store          │
│  ├── _id: string                   // 'project_stage'                        │
│  ├── key: string                   // 'project_stage'                        │
│  ├── options: DatalabelOption[]    // [{name, label, color_code, ...}]       │
│  └── syncedAt: number                                                        │
│                                                                              │
│  entityCodes                       ← NEW: Dedicated entity codes store       │
│  ├── _id: string                   // 'all' (single record)                  │
│  ├── codes: EntityCodeRecord[]     // [{code, name, ui_label, ...}]          │
│  └── syncedAt: number                                                        │
│                                                                              │
│  globalSettings                    ← NEW: Dedicated global settings store    │
│  ├── _id: string                   // 'settings'                             │
│  ├── settings: Record<string, any> // All settings                           │
│  └── syncedAt: number                                                        │
│                                                                              │
│  SEPARATED DATA + METADATA                                                   │
│  ─────────────────────────                                                   │
│                                                                              │
│  entityInstanceData                ← RENAMED from entityLists (data only)    │
│  ├── _id: string                   // 'project:{queryHash}'                  │
│  ├── entityCode: string                                                      │
│  ├── queryHash: string                                                       │
│  ├── params: Record<string, unknown>                                         │
│  ├── entityIds: string[]           // References to entity records           │
│  ├── total: number                                                           │
│  └── syncedAt: number                                                        │
│  // NO metadata field - stored separately                                    │
│                                                                              │
│  entityInstanceMetadata            ← NEW: Dedicated field metadata store     │
│  ├── _id: string                   // 'project' (one per entity type)        │
│  ├── entityCode: string                                                      │
│  ├── fields: string[]              // ['id', 'name', 'budget_allocated_amt'] │
│  ├── viewType: Record<string, ViewFieldMetadata>                            │
│  ├── editType: Record<string, EditFieldMetadata>                            │
│  └── syncedAt: number                                                        │
│                                                                              │
│  entityInstance                    ← RENAMED from entityInstanceNames        │
│  ├── _id: string                   // 'project:uuid-123'                     │
│  ├── entityCode: string                                                      │
│  ├── entityInstanceId: string                                                │
│  ├── entityInstanceName: string                                              │
│  └── syncedAt: number                                                        │
│                                                                              │
│  UNCHANGED TABLES                                                            │
│  ────────────────                                                            │
│  entityTypes          → Layer 1: Keep as-is                                 │
│  entityInstances      → Layer 2: Keep as-is                                 │
│  entityLinksForward   → Layer 3: Keep as-is                                 │
│  entityLinksReverse   → Layer 3: Keep as-is                                 │
│  entityLinksRaw       → Layer 3: Keep as-is                                 │
│  drafts               → Keep as-is                                          │
│                                                                              │
│  DEPRECATED (Remove in Phase 3)                                              │
│  ──────────────────────────────                                              │
│  metadata             → Replaced by datalabels, entityCodes, globalSettings │
│  entities             → Merged into entityInstanceData                      │
│  entityLists          → Renamed to entityInstanceData                       │
│  entityInstanceNames  → Renamed to entityInstance                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Benefits of New Design

| Benefit | Description |
|---------|-------------|
| Separate metadata caching | Field metadata cached once per entity type, not per query |
| Cleaner type safety | Each table has specific interface, no union types |
| Better query performance | Direct table access instead of filtering by `type` |
| Reduced storage | Metadata not duplicated across records |
| Clearer naming | `entityInstance` instead of `entityInstanceNames` |

---

## Migration Phases

### Phase 1: Add New Tables (Non-Breaking)

**Goal**: Add new tables alongside existing ones. No breaking changes.

```typescript
// database.ts - Add new table definitions

// NEW: Separated metadata tables
export interface DatalabelRecord {
  _id: string;           // 'project_stage'
  key: string;
  options: DatalabelOption[];
  syncedAt: number;
}

export interface EntityCodesRecord {
  _id: string;           // 'all'
  codes: EntityCodeDefinition[];
  syncedAt: number;
}

export interface GlobalSettingsRecord {
  _id: string;           // 'settings'
  settings: Record<string, unknown>;
  syncedAt: number;
}

export interface EntityInstanceMetadataRecord {
  _id: string;           // 'project'
  entityCode: string;
  fields: string[];
  viewType: Record<string, ViewFieldMetadata>;
  editType: Record<string, EditFieldMetadata>;
  syncedAt: number;
}

// RENAMED: entityInstanceNames → entityInstance
export interface EntityInstanceRecord {
  _id: string;           // 'project:uuid-123'
  entityCode: string;
  entityInstanceId: string;
  entityInstanceName: string;
  syncedAt: number;
}

// RENAMED: entityLists → entityInstanceData (no metadata field)
export interface EntityInstanceDataRecord {
  _id: string;           // 'project:{queryHash}'
  entityCode: string;
  queryHash: string;
  params: Record<string, unknown>;
  entityIds: string[];
  total: number;
  syncedAt: number;
  // NO metadata - stored in entityInstanceMetadata
}
```

**Schema version bump**:
```typescript
this.version(2).stores({
  // NEW tables
  datalabels: '_id, key',
  entityCodes: '_id',
  globalSettings: '_id',
  entityInstanceData: '_id, entityCode, queryHash, syncedAt',
  entityInstanceMetadata: '_id, entityCode',
  entityInstance: '_id, entityCode, entityInstanceId, [entityCode+entityInstanceId]',

  // Keep existing for backward compatibility
  metadata: '_id, type, key',
  entities: '_id, entityCode, entityId, syncedAt, isDeleted',
  entityLists: '_id, entityCode, queryHash, syncedAt',
  entityInstanceNames: '_id, entityCode, entityInstanceId, [entityCode+entityInstanceId]',

  // Unchanged
  entityTypes: '_id, code, display_order, domain_code',
  entityInstances: '_id, entity_code, entity_instance_id, [entity_code+entity_instance_id], isDeleted, syncedAt',
  entityLinksForward: '_id, parentCode, parentId, childCode, [parentCode+parentId+childCode]',
  entityLinksReverse: '_id, childCode, childId, [childCode+childId]',
  entityLinksRaw: '_id, entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, syncedAt',
  drafts: '_id, entityCode, entityId, updatedAt',
});
```

**Files to modify**:
- `apps/web/src/db/dexie/database.ts` - Add new interfaces and tables

---

### Phase 2: Dual-Write Migration

**Goal**: Write to both old and new tables. Read from new tables with fallback.

**Step 2.1: Update hooks to dual-write**

```typescript
// useDatalabel.ts - Write to both tables
async function cacheDatalabel(key: string, options: DatalabelOption[]) {
  const now = Date.now();

  // NEW: Write to datalabels table
  await db.datalabels.put({
    _id: key,
    key,
    options,
    syncedAt: now,
  });

  // LEGACY: Also write to metadata table (for backward compatibility)
  await db.metadata.put({
    _id: `datalabel:${key}`,
    type: 'datalabel',
    key,
    data: options,
    syncedAt: now,
  });
}
```

```typescript
// useEntityList.ts - Write data and metadata separately
async function cacheEntityList(entityCode: string, response: ApiResponse) {
  const now = Date.now();
  const queryHash = createQueryHash(params);

  // NEW: Write metadata once per entity type
  if (response.metadata) {
    await db.entityInstanceMetadata.put({
      _id: entityCode,
      entityCode,
      fields: response.fields,
      viewType: response.metadata.entityListOfInstancesTable?.viewType,
      editType: response.metadata.entityListOfInstancesTable?.editType,
      syncedAt: now,
    });
  }

  // NEW: Write data without metadata
  await db.entityInstanceData.put({
    _id: `${entityCode}:${queryHash}`,
    entityCode,
    queryHash,
    params,
    entityIds: response.data.map(d => d.id),
    total: response.total,
    syncedAt: now,
  });

  // LEGACY: Also write to old tables (for backward compatibility)
  await db.entityLists.put({...});
}
```

**Step 2.2: Update reads to prefer new tables**

```typescript
// useDatalabel.ts - Read from new table with fallback
async function getDatalabelFromCache(key: string): Promise<DatalabelOption[] | null> {
  // Try new table first
  const newRecord = await db.datalabels.get(key);
  if (newRecord) {
    return newRecord.options;
  }

  // Fallback to legacy table
  const legacyRecord = await db.metadata.get(`datalabel:${key}`);
  if (legacyRecord) {
    // Migrate on read
    await db.datalabels.put({
      _id: key,
      key,
      options: legacyRecord.data as DatalabelOption[],
      syncedAt: legacyRecord.syncedAt,
    });
    return legacyRecord.data as DatalabelOption[];
  }

  return null;
}
```

**Files to modify**:
- `apps/web/src/db/tanstack-hooks/useDatalabel.ts`
- `apps/web/src/db/tanstack-hooks/useEntityList.ts`
- `apps/web/src/db/tanstack-hooks/useEntity.ts`
- `apps/web/src/db/tanstack-hooks/useGlobalSettings.ts`
- `apps/web/src/db/tanstack-hooks/useOfflineEntity.ts`
- `apps/web/src/db/query/queryClient.ts`

---

### Phase 3: Remove Legacy Tables

**Goal**: Remove old tables after migration is verified.

**Step 3.1: Remove dual-write code**

Remove all writes to legacy tables:
- `db.metadata.put(...)`
- `db.entities.put(...)`
- `db.entityLists.put(...)`
- `db.entityInstanceNames.put(...)`

**Step 3.2: Remove fallback reads**

Remove fallback reads from legacy tables.

**Step 3.3: Update schema to remove tables**

```typescript
this.version(3).stores({
  // Remove legacy tables by setting to null
  metadata: null,
  entities: null,
  entityLists: null,
  entityInstanceNames: null,

  // Keep new tables
  datalabels: '_id, key',
  entityCodes: '_id',
  globalSettings: '_id',
  entityInstanceData: '_id, entityCode, queryHash, syncedAt',
  entityInstanceMetadata: '_id, entityCode',
  entityInstance: '_id, entityCode, entityInstanceId, [entityCode+entityInstanceId]',

  // Unchanged
  entityTypes: '_id, code, display_order, domain_code',
  entityInstances: '_id, entity_code, entity_instance_id, [entity_code+entity_instance_id], isDeleted, syncedAt',
  entityLinksForward: '_id, parentCode, parentId, childCode, [parentCode+parentId+childCode]',
  entityLinksReverse: '_id, childCode, childId, [childCode+childId]',
  entityLinksRaw: '_id, entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, syncedAt',
  drafts: '_id, entityCode, entityId, updatedAt',
});
```

**Step 3.4: Update exports and types**

Remove deprecated type exports:
- `CachedMetadata`
- `CachedEntity`
- `CachedEntityList`
- `EntityInstanceNameRecord`

---

## Affected Files

### Primary Files (Must Modify)

| File | Changes |
|------|---------|
| `apps/web/src/db/dexie/database.ts` | Add new interfaces, tables, schema version |
| `apps/web/src/db/tanstack-hooks/useDatalabel.ts` | Use `datalabels` table |
| `apps/web/src/db/tanstack-hooks/useEntityList.ts` | Use `entityInstanceData` + `entityInstanceMetadata` |
| `apps/web/src/db/tanstack-hooks/useEntity.ts` | Use `entityInstanceMetadata` for metadata |
| `apps/web/src/db/tanstack-hooks/useGlobalSettings.ts` | Use `globalSettings` table |
| `apps/web/src/db/tanstack-hooks/useOfflineEntity.ts` | Update to new table structure |
| `apps/web/src/db/query/queryClient.ts` | Update hydration logic |

### Secondary Files (May Need Updates)

| File | Changes |
|------|---------|
| `apps/web/src/db/tanstack-hooks/index.ts` | Update exports |
| `apps/web/src/db/tanstack-index.ts` | Update type exports |
| `apps/web/src/db/normalized-cache/adapters/cache-adapter.ts` | Update if using legacy tables |
| `apps/web/src/db/tanstack-sync/WebSocketManager.ts` | Update invalidation logic |
| `apps/web/src/lib/hooks/index.ts` | Update re-exports |

### Documentation Files

| File | Changes |
|------|---------|
| `CLAUDE.md` | Update schema documentation |
| `docs/state_management/STATE_MANAGEMENT.md` | Update Dexie table descriptions |
| `docs/caching/TANSTACK_DEXIE_SYNC_ARCHITECTURE.md` | Update architecture diagrams |

---

## Implementation Details

### New Table Interfaces

```typescript
// ============================================================================
// SEPARATED METADATA TABLES
// ============================================================================

export interface DatalabelOption {
  name: string;
  label: string;
  color_code?: string;
  sort_order?: number;
  active_flag?: boolean;
}

export interface DatalabelRecord {
  _id: string;           // Primary key: datalabel key (e.g., 'project_stage')
  key: string;           // Datalabel key
  options: DatalabelOption[];
  syncedAt: number;
}

export interface EntityCodeDefinition {
  code: string;
  name: string;
  ui_label: string;
  ui_icon?: string;
  child_entity_codes?: string[];
  active_flag: boolean;
}

export interface EntityCodesRecord {
  _id: string;           // 'all' (single record with all codes)
  codes: EntityCodeDefinition[];
  syncedAt: number;
}

export interface GlobalSettingsRecord {
  _id: string;           // 'settings'
  settings: Record<string, unknown>;
  syncedAt: number;
}

// ============================================================================
// SEPARATED ENTITY DATA + METADATA
// ============================================================================

export interface ViewFieldMetadata {
  dtype: string;
  label: string;
  renderType?: string;
  lookupEntity?: string;
  lookupSource?: string;
  datalabelKey?: string;
  behavior?: Record<string, boolean>;
  style?: Record<string, unknown>;
}

export interface EditFieldMetadata {
  dtype: string;
  label: string;
  inputType?: string;
  lookupEntity?: string;
  lookupSource?: string;
  datalabelKey?: string;
  behavior?: Record<string, boolean>;
  validation?: Record<string, unknown>;
}

export interface EntityInstanceMetadataRecord {
  _id: string;           // Primary key: entity code (e.g., 'project')
  entityCode: string;
  fields: string[];      // Field names in order
  viewType: Record<string, ViewFieldMetadata>;
  editType: Record<string, EditFieldMetadata>;
  syncedAt: number;
}

export interface EntityInstanceDataRecord {
  _id: string;           // Composite: `${entityCode}:${queryHash}`
  entityCode: string;
  queryHash: string;
  params: Record<string, unknown>;
  entityIds: string[];   // References to entity instance IDs
  data: Record<string, unknown>[]; // Actual entity data
  total: number;
  syncedAt: number;
  // NO metadata field - use entityInstanceMetadata table
}

// ============================================================================
// RENAMED: entityInstanceNames → entityInstance
// ============================================================================

export interface EntityInstanceRecord {
  _id: string;           // Composite: `${entityCode}:${entityInstanceId}`
  entityCode: string;
  entityInstanceId: string;
  entityInstanceName: string;
  syncedAt: number;
}
```

### Key Helper Functions

```typescript
// ============================================================================
// Helper Functions for New Tables
// ============================================================================

export function createDatalabelKey(key: string): string {
  return key.startsWith('dl__') ? key.slice(4) : key;
}

export function createEntityInstanceMetadataKey(entityCode: string): string {
  return entityCode;
}

export function createEntityInstanceDataKey(entityCode: string, params: Record<string, unknown>): string {
  return `${entityCode}:${createQueryHash(params)}`;
}

export function createEntityInstanceKey(entityCode: string, entityInstanceId: string): string {
  return `${entityCode}:${entityInstanceId}`;
}
```

---

## Rollback Strategy

### Phase 1 Rollback
- Simply revert the schema version bump
- New tables will be ignored

### Phase 2 Rollback
- Continue reading from legacy tables (they're still being written)
- Remove dual-write code
- Revert to reading from legacy tables only

### Phase 3 Rollback
- NOT POSSIBLE after tables are deleted
- Must restore from backup or re-fetch all data

### Data Backup Before Phase 3

```typescript
// Export all data before removing legacy tables
async function backupLegacyData(): Promise<{
  metadata: CachedMetadata[];
  entities: CachedEntity[];
  entityLists: CachedEntityList[];
  entityInstanceNames: EntityInstanceNameRecord[];
}> {
  return {
    metadata: await db.metadata.toArray(),
    entities: await db.entities.toArray(),
    entityLists: await db.entityLists.toArray(),
    entityInstanceNames: await db.entityInstanceNames.toArray(),
  };
}
```

---

## Timeline

| Phase | Duration | Description |
|-------|----------|-------------|
| Phase 1 | 1 session | Add new tables, no breaking changes |
| Phase 2 | 1-2 sessions | Dual-write, migrate reads |
| Verification | 1 session | Test all flows, verify data integrity |
| Phase 3 | 1 session | Remove legacy tables |

---

**Document Version**: 1.0.0
**Author**: Claude (AI Assistant)
**Status**: Ready for Review
