# Dexie Schema Refactoring

> Unified cache naming for TanStack Query + Dexie

**Version**: 4.0.0
**Status**: Implemented (Schema) + Pending (API content=metadata)
**Created**: 2025-11-30
**Updated**: 2025-11-30

---

## API Design: Unified Entity Endpoint

The same entity endpoint serves both data and metadata requests via the `content` query parameter:

### Endpoint Pattern
```
GET /api/v1/{entityCode}                    # Normal: returns data + metadata
GET /api/v1/{entityCode}?content=metadata   # Metadata-only: data=[], fields populated
```

### Unified Response Structure (Always Same)
```typescript
interface EntityResponse {
  // Always present, same structure
  data: Record<string, unknown>[];           // [] for metadata-only
  fields: string[];                          // Always populated
  ref_data_entityInstance: Record<string, Record<string, string>>;  // {} for metadata-only
  metadata: {
    entityListOfInstancesTable: {
      viewType: Record<string, ViewFieldMetadata>;
      editType: Record<string, EditFieldMetadata>;
    };
  };

  // Pagination (for data requests)
  total?: number;
  limit?: number;
  offset?: number;
}
```

### Request Examples

**Normal Data Request:**
```bash
GET /api/v1/project?limit=20&offset=0

Response:
{
  "data": [{ "id": "uuid-1", "name": "Project A", ... }, ...],
  "fields": ["id", "name", "code", "dl__project_stage", ...],
  "ref_data_entityInstance": {
    "employee": { "uuid-james": "James Miller" }
  },
  "metadata": {
    "entityListOfInstancesTable": {
      "viewType": { "name": { "dtype": "str", "label": "Name", ... } },
      "editType": { "name": { "dtype": "str", "inputType": "text", ... } }
    }
  },
  "total": 150,
  "limit": 20,
  "offset": 0
}
```

**Metadata-Only Request:**
```bash
GET /api/v1/project?content=metadata

Response:
{
  "data": [],
  "fields": ["id", "name", "code", "dl__project_stage", ...],
  "ref_data_entityInstance": {},
  "metadata": {
    "entityListOfInstancesTable": {
      "viewType": { "name": { "dtype": "str", "label": "Name", ... } },
      "editType": { "name": { "dtype": "str", "inputType": "text", ... } }
    }
  }
}
```

### Frontend Hook Updates

```typescript
// useEntityMetadata.ts - Uses content=metadata parameter
export function useEntityMetadata(entityCode: string) {
  return useQuery({
    queryKey: ['entityInstanceMetadata', entityCode],
    queryFn: async () => {
      // Try Dexie cache first
      const cached = await db.entityInstanceMetadata.get(entityCode);
      if (cached && Date.now() - cached.syncedAt < 30 * 60 * 1000) {
        return cached;
      }

      // Fetch metadata-only from API (no data transferred)
      const response = await apiClient.get(`/api/v1/${entityCode}`, {
        params: { content: 'metadata' }
      });

      const record = {
        _id: entityCode,
        entityCode,
        fields: response.data.fields,
        viewType: response.data.metadata?.entityListOfInstancesTable?.viewType ?? {},
        editType: response.data.metadata?.entityListOfInstancesTable?.editType ?? {},
        syncedAt: Date.now(),
      };

      await db.entityInstanceMetadata.put(record);
      return record;
    },
    staleTime: 30 * 60 * 1000,
  });
}
```

### Backend Implementation (Done)

```typescript
// apps/api/src/modules/{entity}/routes.ts

fastify.get('/api/v1/project', async (request, reply) => {
  const { content, limit = 20, offset = 0, view, ...filters } = request.query;

  // Metadata-only mode - returns fields + metadata without data query
  if (content === 'metadata') {
    const requestedComponents = view
      ? view.split(',').map((v: string) => v.trim())
      : ['entityListOfInstancesTable', 'entityInstanceFormContainer', 'kanbanView'];

    const response = await generateEntityResponse('project', [], {
      components: requestedComponents,
      metadataOnly: true  // Uses Redis field cache, returns data=[], ref_data_entityInstance={}
    });
    return reply.send(response);
  }

  // Normal data mode
  const data = await db.execute(sql`SELECT * FROM app.project ...`);
  const ref_data_entityInstance = await entityInfra.build_ref_data_entityInstance(data);

  const response = await generateEntityResponse('project', Array.from(data), {
    components: requestedComponents,
    total: count,
    limit,
    offset,
    ref_data_entityInstance
  });
  return reply.send(response);
});
```

---

## Unified Cache Naming

| Data Type | TanStack Query Key | Dexie Table | Dexie _id |
|-----------|-------------------|-------------|-----------|
| Datalabels | `['datalabel', key]` | `datalabel` | `key` |
| Entity Codes | `['entityCode']` | `entityCode` | `'all'` |
| Global Settings | `['globalSetting']` | `globalSetting` | `'settings'` |
| Entity Data | `['entityInstanceData', code, params]` | `entityInstanceData` | `code:hash` |
| Entity Metadata | `['entityInstanceMetadata', code]` | `entityInstanceMetadata` | `code` |
| Entity Instance | `['entityInstance', code, id]` | `entityInstance` | `code:id` |
| Entity Links | `['entityLink', parent, id, child]` | `entityLink` | `parent:id:child` |
| Drafts | `['draft', code, id]` | `draft` | `code:id` |

---

## Schema Definition

```typescript
// apps/web/src/db/dexie/database.ts

import Dexie, { type Table } from 'dexie';

// ============================================================================
// INTERFACES
// ============================================================================

// Datalabel
export interface DatalabelOption {
  name: string;
  label: string;
  color_code?: string;
  sort_order?: number;
  active_flag?: boolean;
}

export interface DatalabelRecord {
  _id: string;                    // 'project_stage'
  key: string;
  options: DatalabelOption[];
  syncedAt: number;
}

// Entity Code
export interface EntityCodeDefinition {
  code: string;
  name: string;
  ui_label: string;
  ui_icon?: string;
  child_entity_codes?: string[];
  active_flag: boolean;
}

export interface EntityCodeRecord {
  _id: string;                    // 'all'
  codes: EntityCodeDefinition[];
  syncedAt: number;
}

// Global Setting
export interface GlobalSettingRecord {
  _id: string;                    // 'settings'
  settings: Record<string, unknown>;
  syncedAt: number;
}

// Entity Instance Data (query results)
export interface EntityInstanceDataRecord {
  _id: string;                    // 'project:{queryHash}'
  entityCode: string;
  queryHash: string;
  params: Record<string, unknown>;
  data: Record<string, unknown>[];
  total: number;
  syncedAt: number;
}

// Entity Instance Metadata (field definitions per entity type)
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
  _id: string;                    // 'project'
  entityCode: string;
  fields: string[];
  viewType: Record<string, ViewFieldMetadata>;
  editType: Record<string, EditFieldMetadata>;
  syncedAt: number;
}

// Entity Instance (UUID → name lookup)
export interface EntityInstanceRecord {
  _id: string;                    // 'project:uuid-123'
  entityCode: string;
  entityInstanceId: string;
  entityInstanceName: string;
  syncedAt: number;
}

// Entity Link (forward index: parent → children)
export interface EntityLinkRecord {
  _id: string;                    // 'project:uuid-1:task'
  parentCode: string;
  parentId: string;
  childCode: string;
  childIds: string[];
  relationships: Record<string, string>;
  syncedAt: number;
}

// Draft (unsaved form edits)
export interface DraftRecord {
  _id: string;                    // 'project:uuid-123'
  entityCode: string;
  entityId: string;
  originalData: Record<string, unknown>;
  currentData: Record<string, unknown>;
  undoStack: Record<string, unknown>[];
  redoStack: Record<string, unknown>[];
  updatedAt: number;
}

// ============================================================================
// DATABASE CLASS
// ============================================================================

export class PMODatabase extends Dexie {
  // Separated metadata stores
  datalabel!: Table<DatalabelRecord, string>;
  entityCode!: Table<EntityCodeRecord, string>;
  globalSetting!: Table<GlobalSettingRecord, string>;

  // Entity data + metadata (separated)
  entityInstanceData!: Table<EntityInstanceDataRecord, string>;
  entityInstanceMetadata!: Table<EntityInstanceMetadataRecord, string>;
  entityInstance!: Table<EntityInstanceRecord, string>;

  // Entity links
  entityLink!: Table<EntityLinkRecord, string>;

  // Drafts
  draft!: Table<DraftRecord, string>;

  constructor() {
    super('pmo-cache-v4');

    this.version(1).stores({
      // Separated metadata stores
      datalabel: '_id, key',
      entityCode: '_id',
      globalSetting: '_id',

      // Entity data + metadata
      entityInstanceData: '_id, entityCode, queryHash, syncedAt',
      entityInstanceMetadata: '_id, entityCode',
      entityInstance: '_id, entityCode, entityInstanceId, [entityCode+entityInstanceId]',

      // Entity links
      entityLink: '_id, parentCode, parentId, childCode, [parentCode+parentId+childCode]',

      // Drafts
      draft: '_id, entityCode, entityId, updatedAt',
    });
  }
}

export const db = new PMODatabase();

// ============================================================================
// KEY GENERATORS
// ============================================================================

export function createDatalabelKey(key: string): string {
  return key.startsWith('dl__') ? key.slice(4) : key;
}

export function createEntityInstanceDataKey(entityCode: string, params: Record<string, unknown>): string {
  return `${entityCode}:${createQueryHash(params)}`;
}

export function createEntityInstanceKey(entityCode: string, entityInstanceId: string): string {
  return `${entityCode}:${entityInstanceId}`;
}

export function createEntityLinkKey(parentCode: string, parentId: string, childCode: string): string {
  return `${parentCode}:${parentId}:${childCode}`;
}

export function createDraftKey(entityCode: string, entityId: string): string {
  return `${entityCode}:${entityId}`;
}

export function createQueryHash(params: Record<string, unknown>): string {
  const sorted = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {} as Record<string, unknown>);
  return JSON.stringify(sorted);
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

export async function clearAllData(): Promise<void> {
  await Promise.all([
    db.datalabel.clear(),
    db.entityCode.clear(),
    db.globalSetting.clear(),
    db.entityInstanceData.clear(),
    db.entityInstanceMetadata.clear(),
    db.entityInstance.clear(),
    db.entityLink.clear(),
    db.draft.clear(),
  ]);
}

export async function getDatabaseStats(): Promise<Record<string, number>> {
  const [
    datalabel, entityCode, globalSetting,
    entityInstanceData, entityInstanceMetadata, entityInstance,
    entityLink, draft
  ] = await Promise.all([
    db.datalabel.count(),
    db.entityCode.count(),
    db.globalSetting.count(),
    db.entityInstanceData.count(),
    db.entityInstanceMetadata.count(),
    db.entityInstance.count(),
    db.entityLink.count(),
    db.draft.count(),
  ]);

  return {
    datalabel, entityCode, globalSetting,
    entityInstanceData, entityInstanceMetadata, entityInstance,
    entityLink, draft
  };
}
```

---

## Hook Implementations

### useDatalabel.ts

```typescript
import { useQuery } from '@tanstack/react-query';
import { db, createDatalabelKey, type DatalabelOption } from '../dexie/database';
import { apiClient } from '../../lib/api';

const datalabelSyncCache = new Map<string, DatalabelOption[]>();

export function getDatalabelSync(key: string): DatalabelOption[] | null {
  return datalabelSyncCache.get(createDatalabelKey(key)) ?? null;
}

export function useDatalabel(key: string) {
  const normalizedKey = createDatalabelKey(key);

  return useQuery({
    queryKey: ['datalabel', normalizedKey],
    queryFn: async () => {
      const response = await apiClient.get(`/api/v1/datalabel/${normalizedKey}`);
      const options = response.data.options || response.data;

      // Write to Dexie
      await db.datalabel.put({
        _id: normalizedKey,
        key: normalizedKey,
        options,
        syncedAt: Date.now(),
      });

      // Update sync cache
      datalabelSyncCache.set(normalizedKey, options);

      return options;
    },
    staleTime: 10 * 60 * 1000,
  });
}
```

### useEntityList.ts

```typescript
import { useQuery } from '@tanstack/react-query';
import { db, createEntityInstanceDataKey, createQueryHash } from '../dexie/database';
import { apiClient } from '../../lib/api';

export function useEntityList<T>(entityCode: string, params: Record<string, unknown> = {}) {
  const queryHash = createQueryHash(params);

  return useQuery({
    queryKey: ['entityInstanceData', entityCode, params],
    queryFn: async () => {
      const response = await apiClient.get(`/api/v1/${entityCode}`, { params });
      const { data, metadata, total, limit, offset, ref_data_entityInstance } = response.data;

      // Write metadata ONCE per entity type
      if (metadata) {
        await db.entityInstanceMetadata.put({
          _id: entityCode,
          entityCode,
          fields: response.data.fields || [],
          viewType: metadata.entityListOfInstancesTable?.viewType ?? {},
          editType: metadata.entityListOfInstancesTable?.editType ?? {},
          syncedAt: Date.now(),
        });
      }

      // Write data WITHOUT metadata
      await db.entityInstanceData.put({
        _id: createEntityInstanceDataKey(entityCode, params),
        entityCode,
        queryHash,
        params,
        data,
        total: total || data.length,
        syncedAt: Date.now(),
      });

      // Write entity instance names
      if (ref_data_entityInstance) {
        for (const [refEntityCode, names] of Object.entries(ref_data_entityInstance)) {
          for (const [id, name] of Object.entries(names as Record<string, string>)) {
            await db.entityInstance.put({
              _id: `${refEntityCode}:${id}`,
              entityCode: refEntityCode,
              entityInstanceId: id,
              entityInstanceName: name,
              syncedAt: Date.now(),
            });
          }
        }
      }

      return { data, total, limit, offset, metadata, ref_data_entityInstance };
    },
    staleTime: 2 * 60 * 1000,
  });
}

// Separate hook for metadata only - uses content=metadata API param
export function useEntityMetadata(entityCode: string) {
  return useQuery({
    queryKey: ['entityInstanceMetadata', entityCode],
    queryFn: async () => {
      // Try Dexie cache first (30 min TTL)
      const cached = await db.entityInstanceMetadata.get(entityCode);
      if (cached && Date.now() - cached.syncedAt < 30 * 60 * 1000) {
        return cached;
      }

      // Fetch metadata-only from API (no data transferred)
      // Same endpoint, different content param
      const response = await apiClient.get(`/api/v1/${entityCode}`, {
        params: { content: 'metadata' }
      });

      // Response always has same structure: data=[], fields, metadata, ref_data_entityInstance={}
      const record = {
        _id: entityCode,
        entityCode,
        fields: response.data.fields || [],
        viewType: response.data.metadata?.entityListOfInstancesTable?.viewType ?? {},
        editType: response.data.metadata?.entityListOfInstancesTable?.editType ?? {},
        syncedAt: Date.now(),
      };

      await db.entityInstanceMetadata.put(record);
      return record;
    },
    staleTime: 30 * 60 * 1000,
  });
}
```

### useGlobalSetting.ts

```typescript
import { useQuery } from '@tanstack/react-query';
import { db } from '../dexie/database';
import { apiClient } from '../../lib/api';

export function useGlobalSetting() {
  return useQuery({
    queryKey: ['globalSetting'],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/settings');
      const settings = response.data;

      await db.globalSetting.put({
        _id: 'settings',
        settings,
        syncedAt: Date.now(),
      });

      return settings;
    },
    staleTime: 30 * 60 * 1000,
  });
}
```

### queryClient.ts - Hydration

```typescript
import { QueryClient } from '@tanstack/react-query';
import { db } from '../dexie/database';
import { setDatalabelSync } from '../tanstack-hooks/useDatalabel';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 3,
    },
  },
});

export async function hydrateQueryCache(): Promise<number> {
  let count = 0;
  const maxAge = 30 * 60 * 1000;
  const now = Date.now();

  // Hydrate datalabels
  const datalabels = await db.datalabel.filter(d => now - d.syncedAt < maxAge).toArray();
  for (const record of datalabels) {
    queryClient.setQueryData(['datalabel', record.key], record.options);
    setDatalabelSync(record.key, record.options);
    count++;
  }

  // Hydrate entity codes
  const entityCodes = await db.entityCode.get('all');
  if (entityCodes && now - entityCodes.syncedAt < maxAge) {
    queryClient.setQueryData(['entityCode'], entityCodes.codes);
    count++;
  }

  // Hydrate global settings
  const globalSetting = await db.globalSetting.get('settings');
  if (globalSetting && now - globalSetting.syncedAt < maxAge) {
    queryClient.setQueryData(['globalSetting'], globalSetting.settings);
    count++;
  }

  // Hydrate entity metadata
  const entityMetadata = await db.entityInstanceMetadata.toArray();
  for (const record of entityMetadata) {
    queryClient.setQueryData(['entityInstanceMetadata', record.entityCode], record);
    count++;
  }

  // Hydrate entity data
  const entityData = await db.entityInstanceData.filter(d => now - d.syncedAt < maxAge).toArray();
  for (const record of entityData) {
    const metadata = await db.entityInstanceMetadata.get(record.entityCode);
    queryClient.setQueryData(
      ['entityInstanceData', record.entityCode, record.params],
      {
        data: record.data,
        total: record.total,
        metadata: metadata ? { viewType: metadata.viewType, editType: metadata.editType } : undefined,
      }
    );
    count++;
  }

  console.log(`[QueryClient] Hydrated ${count} cache entries from Dexie`);
  return count;
}

export async function clearAllCaches(): Promise<void> {
  queryClient.clear();
  await db.datalabel.clear();
  await db.entityCode.clear();
  await db.globalSetting.clear();
  await db.entityInstanceData.clear();
  await db.entityInstanceMetadata.clear();
  await db.entityInstance.clear();
}

export function invalidateEntityQueries(entityCode: string, entityId?: string): void {
  queryClient.invalidateQueries({ queryKey: ['entityInstanceData', entityCode] });
  if (entityId) {
    queryClient.invalidateQueries({ queryKey: ['entityInstance', entityCode, entityId] });
  }
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `apps/web/src/db/dexie/database.ts` | Complete rewrite with new schema |
| `apps/web/src/db/tanstack-hooks/useDatalabel.ts` | Use `datalabel` table, `['datalabel', key]` |
| `apps/web/src/db/tanstack-hooks/useEntityList.ts` | Use `entityInstanceData` + `entityInstanceMetadata` |
| `apps/web/src/db/tanstack-hooks/useEntity.ts` | Use `entityInstanceMetadata` for metadata |
| `apps/web/src/db/tanstack-hooks/useGlobalSettings.ts` | Use `globalSetting` table |
| `apps/web/src/db/tanstack-hooks/useOfflineEntity.ts` | Update to new structure |
| `apps/web/src/db/query/queryClient.ts` | Update hydration with new tables |
| `apps/web/src/db/tanstack-hooks/index.ts` | Update exports |
| `apps/web/src/db/tanstack-index.ts` | Update type exports |
| `apps/web/src/db/tanstack-sync/WebSocketManager.ts` | Update invalidation |

---

## Removed Items

| Removed | Replaced By |
|---------|-------------|
| `metadata` table | `datalabel`, `entityCode`, `globalSetting` |
| `entities` table | `entityInstanceData` |
| `entityLists` table | `entityInstanceData` |
| `entityInstanceNames` table | `entityInstance` |
| `entityTypes` table | `entityCode` (consolidated) |
| `entityType` table | (removed - consolidated into `entityCode`) |
| `entityLinksForward` table | `entityLink` |
| `entityLinksReverse` table | (removed - derive from entityLink) |
| `entityLinksRaw` table | (removed - not needed) |
| `entityInstances` table | (removed - use entityInstance) |
| `drafts` table | `draft` |
| `CachedMetadata` type | Individual record types |
| `CachedEntity` type | `EntityInstanceDataRecord` |
| `CachedEntityList` type | `EntityInstanceDataRecord` |

---

## Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FINAL SCHEMA (v4)                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  TanStack Query Key                    Dexie Table                          │
│  ─────────────────                     ───────────                          │
│  ['datalabel', key]              ←→    datalabel                            │
│  ['entityCode']                  ←→    entityCode                           │
│  ['globalSetting']               ←→    globalSetting                        │
│  ['entityInstanceData', ...]     ←→    entityInstanceData                   │
│  ['entityInstanceMetadata', ...]  ←→    entityInstanceMetadata              │
│  ['entityInstance', ...]         ←→    entityInstance                       │
│  ['entityLink', ...]             ←→    entityLink                           │
│  ['draft', ...]                  ←→    draft                                │
│                                                                              │
│  Total: 8 tables (down from 14)                                             │
│  Metadata stored ONCE per entity type (not per record)                      │
│  Unified naming between TanStack Query and Dexie                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                   UNIFIED ENTITY API (content parameter)                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  GET /api/v1/{entity}                  → Normal data + metadata response    │
│  GET /api/v1/{entity}?content=metadata → Metadata-only (data=[], fields=[]) │
│                                                                              │
│  Response Structure (ALWAYS SAME):                                          │
│  ─────────────────────────────────                                          │
│  {                                                                           │
│    data: [],                    // [] for metadata-only, [...] for normal   │
│    fields: [...],               // Always populated from Redis cache        │
│    ref_data_entityInstance: {}, // {} for metadata-only, {...} for normal   │
│    metadata: {                  // Always present                           │
│      entityListOfInstancesTable: { viewType, editType }                     │
│    },                                                                        │
│    total?, limit?, offset?      // Pagination (normal mode only)            │
│  }                                                                           │
│                                                                              │
│  Benefits:                                                                   │
│  • Single endpoint serves both data and metadata                            │
│  • Child tabs can fetch metadata without data transfer                      │
│  • Consistent response structure simplifies frontend parsing                │
│  • Redis field cache ensures metadata works for empty results               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Dexie Schema v4 | ✅ Done | 8 tables, unified naming |
| TanStack hooks | ✅ Done | useEntityList, useEntityMetadata, useDatalabel, etc. |
| queryClient hydration | ✅ Done | Hydrates from new tables |
| WebSocketManager | ✅ Done | Uses new table names, hard delete |
| Backend `content=metadata` | ✅ Done | project/routes.ts, child-entity-route-factory.ts |
| Backend formatter update | ✅ Done | metadataOnly option in generateEntityResponse() |

---

**Version**: 4.0.0 | **Status**: Fully Implemented
