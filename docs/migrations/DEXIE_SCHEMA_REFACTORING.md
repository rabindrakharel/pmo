# Dexie Schema Refactoring

> Direct refactor to separated cache stores

**Version**: 2.0.0
**Status**: Implementation Ready
**Created**: 2025-11-30

---

## Target Schema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        NEW DEXIE SCHEMA (v4)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SEPARATED METADATA STORES                                                   │
│  ─────────────────────────                                                   │
│                                                                              │
│  datalabels                                                                  │
│  ├── _id: string              // 'project_stage'                            │
│  ├── key: string                                                            │
│  ├── options: DatalabelOption[]                                             │
│  └── syncedAt: number                                                        │
│                                                                              │
│  entityCodes                                                                 │
│  ├── _id: string              // 'all'                                      │
│  ├── codes: EntityCodeDefinition[]                                          │
│  └── syncedAt: number                                                        │
│                                                                              │
│  globalSettings                                                              │
│  ├── _id: string              // 'settings'                                 │
│  ├── settings: Record<string, unknown>                                      │
│  └── syncedAt: number                                                        │
│                                                                              │
│  SEPARATED DATA + METADATA                                                   │
│  ─────────────────────────                                                   │
│                                                                              │
│  entityInstanceData            // Replaces: entities + entityLists          │
│  ├── _id: string              // 'project:{queryHash}'                      │
│  ├── entityCode: string                                                     │
│  ├── queryHash: string                                                      │
│  ├── params: Record<string, unknown>                                        │
│  ├── data: Record<string, unknown>[]  // Actual entity records             │
│  ├── total: number                                                          │
│  └── syncedAt: number                                                        │
│  // NO metadata - stored separately                                         │
│                                                                              │
│  entityInstanceMetadata        // NEW: Field metadata per entity type       │
│  ├── _id: string              // 'project'                                  │
│  ├── entityCode: string                                                     │
│  ├── fields: string[]                                                       │
│  ├── viewType: Record<string, ViewFieldMetadata>                           │
│  ├── editType: Record<string, EditFieldMetadata>                           │
│  └── syncedAt: number                                                        │
│                                                                              │
│  entityInstance                // Renamed from: entityInstanceNames         │
│  ├── _id: string              // 'project:uuid-123'                         │
│  ├── entityCode: string                                                     │
│  ├── entityInstanceId: string                                               │
│  ├── entityInstanceName: string                                             │
│  └── syncedAt: number                                                        │
│                                                                              │
│  UNCHANGED TABLES                                                            │
│  ────────────────                                                            │
│  entityTypes                   // Keep as-is                                │
│  entityInstances               // Keep as-is                                │
│  entityLinksForward            // Keep as-is                                │
│  entityLinksReverse            // Keep as-is                                │
│  entityLinksRaw                // Keep as-is                                │
│  drafts                        // Keep as-is                                │
│                                                                              │
│  REMOVED TABLES                                                              │
│  ──────────────                                                              │
│  metadata                      // Replaced by: datalabels, entityCodes,     │
│  entities                      //              globalSettings               │
│  entityLists                   // Replaced by: entityInstanceData           │
│  entityInstanceNames           // Renamed to: entityInstance                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Files to Modify

### 1. database.ts - Schema Definition

```typescript
// apps/web/src/db/dexie/database.ts

// ============================================================================
// SEPARATED METADATA STORES
// ============================================================================

export interface DatalabelOption {
  name: string;
  label: string;
  color_code?: string;
  sort_order?: number;
  active_flag?: boolean;
}

export interface DatalabelRecord {
  _id: string;
  key: string;
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
  _id: string;
  codes: EntityCodeDefinition[];
  syncedAt: number;
}

export interface GlobalSettingsRecord {
  _id: string;
  settings: Record<string, unknown>;
  syncedAt: number;
}

// ============================================================================
// SEPARATED DATA + METADATA
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
  _id: string;
  entityCode: string;
  fields: string[];
  viewType: Record<string, ViewFieldMetadata>;
  editType: Record<string, EditFieldMetadata>;
  syncedAt: number;
}

export interface EntityInstanceDataRecord {
  _id: string;
  entityCode: string;
  queryHash: string;
  params: Record<string, unknown>;
  data: Record<string, unknown>[];
  total: number;
  syncedAt: number;
}

export interface EntityInstanceRecord {
  _id: string;
  entityCode: string;
  entityInstanceId: string;
  entityInstanceName: string;
  syncedAt: number;
}

// ============================================================================
// Database Class
// ============================================================================

export class PMODatabase extends Dexie {
  // Separated metadata stores
  datalabels!: Table<DatalabelRecord, string>;
  entityCodes!: Table<EntityCodesRecord, string>;
  globalSettings!: Table<GlobalSettingsRecord, string>;

  // Separated data + metadata
  entityInstanceData!: Table<EntityInstanceDataRecord, string>;
  entityInstanceMetadata!: Table<EntityInstanceMetadataRecord, string>;
  entityInstance!: Table<EntityInstanceRecord, string>;

  // Unchanged tables
  entityTypes!: Table<EntityTypeRecord, string>;
  entityInstances!: Table<EntityInstanceRecord, string>;
  entityLinksForward!: Table<EntityLinkForwardRecord, string>;
  entityLinksReverse!: Table<EntityLinkReverseRecord, string>;
  entityLinksRaw!: Table<EntityLinkRawRecord, string>;
  drafts!: Table<CachedDraft, string>;

  constructor() {
    super('pmo-cache-v4');

    this.version(1).stores({
      // Separated metadata stores
      datalabels: '_id, key',
      entityCodes: '_id',
      globalSettings: '_id',

      // Separated data + metadata
      entityInstanceData: '_id, entityCode, queryHash, syncedAt',
      entityInstanceMetadata: '_id, entityCode',
      entityInstance: '_id, entityCode, entityInstanceId, [entityCode+entityInstanceId]',

      // Unchanged tables
      entityTypes: '_id, code, display_order, domain_code',
      entityInstances: '_id, entity_code, entity_instance_id, [entity_code+entity_instance_id], isDeleted, syncedAt',
      entityLinksForward: '_id, parentCode, parentId, childCode, [parentCode+parentId+childCode]',
      entityLinksReverse: '_id, childCode, childId, [childCode+childId]',
      entityLinksRaw: '_id, entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, syncedAt',
      drafts: '_id, entityCode, entityId, updatedAt',
    });
  }
}

export const db = new PMODatabase();
```

### 2. useDatalabel.ts

```typescript
// apps/web/src/db/tanstack-hooks/useDatalabel.ts

// Write to datalabels table
await db.datalabels.put({
  _id: key,
  key,
  options,
  syncedAt: Date.now(),
});

// Read from datalabels table
const record = await db.datalabels.get(key);
return record?.options ?? null;
```

### 3. useEntityList.ts

```typescript
// apps/web/src/db/tanstack-hooks/useEntityList.ts

// Write metadata ONCE per entity type
if (response.metadata) {
  await db.entityInstanceMetadata.put({
    _id: entityCode,
    entityCode,
    fields: response.fields,
    viewType: response.metadata.entityListOfInstancesTable?.viewType ?? {},
    editType: response.metadata.entityListOfInstancesTable?.editType ?? {},
    syncedAt: Date.now(),
  });
}

// Write data WITHOUT metadata
await db.entityInstanceData.put({
  _id: `${entityCode}:${queryHash}`,
  entityCode,
  queryHash,
  params,
  data: response.data,
  total: response.total,
  syncedAt: Date.now(),
});

// Read: get data + metadata separately, merge
const dataRecord = await db.entityInstanceData.get(`${entityCode}:${queryHash}`);
const metadataRecord = await db.entityInstanceMetadata.get(entityCode);
return {
  data: dataRecord?.data ?? [],
  metadata: metadataRecord ? { viewType: metadataRecord.viewType, editType: metadataRecord.editType } : null,
};
```

### 4. useGlobalSettings.ts

```typescript
// apps/web/src/db/tanstack-hooks/useGlobalSettings.ts

// Write to globalSettings table
await db.globalSettings.put({
  _id: 'settings',
  settings,
  syncedAt: Date.now(),
});

// Read from globalSettings table
const record = await db.globalSettings.get('settings');
return record?.settings ?? null;
```

### 5. queryClient.ts - Hydration

```typescript
// apps/web/src/db/query/queryClient.ts

export async function hydrateQueryCache(): Promise<number> {
  let count = 0;

  // Hydrate datalabels
  const datalabels = await db.datalabels.toArray();
  for (const record of datalabels) {
    queryClient.setQueryData(['datalabel', record.key], record.options);
    setDatalabelSync(record.key, record.options);
    count++;
  }

  // Hydrate entity codes
  const entityCodes = await db.entityCodes.get('all');
  if (entityCodes) {
    queryClient.setQueryData(['entityCodes'], entityCodes.codes);
    count++;
  }

  // Hydrate global settings
  const settings = await db.globalSettings.get('settings');
  if (settings) {
    queryClient.setQueryData(['globalSettings'], settings.settings);
    count++;
  }

  // Hydrate entity data with metadata
  const entityData = await db.entityInstanceData.toArray();
  for (const record of entityData) {
    const metadata = await db.entityInstanceMetadata.get(record.entityCode);
    queryClient.setQueryData(
      ['entity-list', record.entityCode, record.params],
      {
        data: record.data,
        total: record.total,
        metadata: metadata ? { viewType: metadata.viewType, editType: metadata.editType } : null,
      }
    );
    count++;
  }

  return count;
}
```

---

## Helper Functions

```typescript
// Key generators
export function createDatalabelKey(key: string): string {
  return key.startsWith('dl__') ? key.slice(4) : key;
}

export function createEntityInstanceDataKey(entityCode: string, params: Record<string, unknown>): string {
  return `${entityCode}:${createQueryHash(params)}`;
}

export function createEntityInstanceKey(entityCode: string, entityInstanceId: string): string {
  return `${entityCode}:${entityInstanceId}`;
}

// Clear functions
export async function clearAllData(): Promise<void> {
  await Promise.all([
    db.datalabels.clear(),
    db.entityCodes.clear(),
    db.globalSettings.clear(),
    db.entityInstanceData.clear(),
    db.entityInstanceMetadata.clear(),
    db.entityInstance.clear(),
    db.entityTypes.clear(),
    db.entityInstances.clear(),
    db.entityLinksForward.clear(),
    db.entityLinksReverse.clear(),
    db.entityLinksRaw.clear(),
    db.drafts.clear(),
  ]);
}
```

---

## Removed Items

### Removed Tables
- `metadata` - replaced by `datalabels`, `entityCodes`, `globalSettings`
- `entities` - merged into `entityInstanceData`
- `entityLists` - renamed to `entityInstanceData`
- `entityInstanceNames` - renamed to `entityInstance`

### Removed Types
- `CachedMetadata`
- `CachedEntity`
- `CachedEntityList`
- `EntityInstanceNameRecord` (replaced by `EntityInstanceRecord`)

### Removed Functions
- `createMetadataKey()` - no longer needed
- `createEntityKey()` - replaced by `createEntityInstanceKey()`

---

## Implementation Checklist

- [ ] `apps/web/src/db/dexie/database.ts` - New schema, interfaces, helpers
- [ ] `apps/web/src/db/tanstack-hooks/useDatalabel.ts` - Use `datalabels` table
- [ ] `apps/web/src/db/tanstack-hooks/useEntityList.ts` - Use `entityInstanceData` + `entityInstanceMetadata`
- [ ] `apps/web/src/db/tanstack-hooks/useEntity.ts` - Use `entityInstanceMetadata`
- [ ] `apps/web/src/db/tanstack-hooks/useGlobalSettings.ts` - Use `globalSettings` table
- [ ] `apps/web/src/db/tanstack-hooks/useOfflineEntity.ts` - Update to new structure
- [ ] `apps/web/src/db/query/queryClient.ts` - Update hydration
- [ ] `apps/web/src/db/tanstack-hooks/index.ts` - Update exports
- [ ] `apps/web/src/db/tanstack-index.ts` - Update type exports
- [ ] `apps/web/src/db/tanstack-sync/WebSocketManager.ts` - Update invalidation

---

**Version**: 2.0.0 | **Status**: Ready for Implementation
