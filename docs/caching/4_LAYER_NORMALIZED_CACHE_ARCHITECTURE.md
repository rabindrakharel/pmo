# 4-Layer Normalized Cache Architecture

> **Design Document v1.0** | PMO Enterprise Platform
> **Status:** Design Phase
> **Author:** Claude Code
> **Date:** 2025-11-29

## Executive Summary

This document describes a **4-layer normalized caching architecture** that mirrors the database infrastructure tables directly in the frontend cache. By caching the exact structure of `entity`, `entity_instance`, `entity_instance_link`, and `entity_instance_name`, we achieve:

- **Zero redundant API calls** - Filtered queries derive from cached graph
- **Instant parent-child navigation** - Link graph enables O(1) lookups
- **Single source of truth** - Each entity stored once, referenced everywhere
- **Offline-first** - Full entity graph persisted in IndexedDB

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    4-LAYER NORMALIZED CACHE ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  LAYER 1: entity (Entity Type Metadata)                                     │
│  ══════════════════════════════════════════════════════════════════════════ │
│  • Fetched at login, persisted for session                                  │
│  • Source: GET /api/v1/entity/types                                         │
│  • Cache Key: ['entity', code]                                              │
│  • Contains: code, name, ui_label, ui_icon, child_entity_codes, db_table    │
│  • Lifecycle: Fetch at login → Persist → Rarely invalidated                 │
│  • Use: Navigation menus, tab generation, entity pickers, icon resolution   │
│                                                                              │
│  LAYER 2: entity_instance (Entity Instance Registry)                        │
│  ══════════════════════════════════════════════════════════════════════════ │
│  • Fetched at login, upserted throughout session                            │
│  • Source: GET /api/v1/entity-instance/all (or per-type endpoints)          │
│  • Cache Key: ['entity_instance', entity_code, entity_instance_id]          │
│  • Contains: entity_code, entity_instance_id, entity_instance_name, code    │
│  • Lifecycle: Fetch at login → Persist → Upsert → Validate → Invalidate     │
│  • Use: Global search, entity existence validation, dropdown options        │
│                                                                              │
│  LAYER 3: entity_instance_link (Relationship Graph)                         │
│  ══════════════════════════════════════════════════════════════════════════ │
│  • Fetched at login, upserted throughout session                            │
│  • Source: GET /api/v1/entity-instance-link/all (or per-parent endpoints)   │
│  • Cache Key: ['entity_instance_link', parent_code, parent_id, child_code]  │
│  • Reverse Key: ['entity_instance_link_reverse', child_code, child_id]      │
│  • Contains: entity_code, entity_instance_id, child_entity_code,            │
│              child_entity_instance_id, relationship_type                    │
│  • Lifecycle: Fetch at login → Persist → Upsert → Validate → Invalidate     │
│  • Use: Parent-child filtering, tab counts, navigation, orphan detection    │
│                                                                              │
│  LAYER 4: entity_instance_name (Entity Name Lookup / ref_data_entityInstance)│
│  ══════════════════════════════════════════════════════════════════════════ │
│  • Derived from entity_instance, accumulated from API responses             │
│  • Source: Extracted from API response.ref_data_entityInstance              │
│  • Cache Key: ['entity_instance_name', entity_code]                         │
│  • Contains: { [entity_instance_id]: entity_instance_name }                 │
│  • Lifecycle: Upsert → Validate → Invalidate (accumulated throughout)       │
│  • Use: Display names for UUID references, O(1) name resolution             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Naming Conventions

| Layer | Cache Key Prefix | Database Table | API Response Key |
|-------|------------------|----------------|------------------|
| 1 | `entity` | `app.entity` | N/A (standalone) |
| 2 | `entity_instance` | `app.entity_instance` | N/A (standalone) |
| 3 | `entity_instance_link` | `app.entity_instance_link` | N/A (standalone) |
| 4 | `entity_instance_name` | Derived from `entity_instance` | `entity_instance_name_lookup` |

> **MIGRATION NOTE:** The API response key `ref_data_entityInstance` will be renamed to `entity_instance_name` for consistency, change this in api response and the name of cache collection must match too! This change should be applied across:
> - All API route responses
> - Frontend API response types
> - Documentation references
>
> Until migration is complete, the frontend should handle both key names for backward compatibility.

---

## Layer 1: `entity` (Entity Type Metadata)

### Database Table
```sql
CREATE TABLE app.entity (
    code varchar(50),                    -- 'project', 'task', 'employee'
    name varchar(100),                   -- 'Project', 'Task', 'Employee'
    ui_label varchar(100),               -- 'Projects', 'Tasks', 'Employees'
    ui_icon varchar(50),                 -- 'FolderOpen', 'CheckSquare', 'Users'
    db_table varchar(100),               -- 'project', 'task', 'employee'
    db_model_type varchar(2),            -- 'd', 'f', 'fh', 'fd'
    child_entity_codes jsonb,            -- '["task", "wiki", "artifact"]'
    display_order int4,
    domain_id int4,
    domain_code varchar(50),
    column_metadata jsonb,
    active_flag boolean,
    created_ts timestamptz,
    updated_ts timestamptz
);
```

### Cache Structure
```typescript
// TanStack Query Key
['entity', entityCode]  // e.g., ['entity', 'project']

// Full list key
['entity', 'all']

// Cache Entry Shape
interface EntityCache {
  code: string;
  name: string;
  ui_label: string;
  ui_icon: string;
  db_table: string;
  db_model_type: 'd' | 'f' | 'fh' | 'fd' | 'dh';
  child_entity_codes: string[];
  display_order: number;
  domain_code?: string;
  column_metadata?: ColumnMetadata[];
}
```

### Fetch Strategy
```typescript
// At login - fetch all entity types
const prefetchEntityTypes = async () => {
  const response = await api.get('/api/v1/entity/types');

  // Store as single list
  queryClient.setQueryData(['entity', 'all'], response.data);

  // Also index by code for O(1) lookup
  for (const entity of response.data) {
    queryClient.setQueryData(['entity', entity.code], entity);
    await dexie.entity.put({ _id: entity.code, ...entity });
  }
};
```

### Use Cases
| Use Case | Access Pattern |
|----------|----------------|
| Sidebar navigation | `['entity', 'all']` sorted by `display_order` |
| Entity picker dropdown | `['entity', 'all']` filtered by `db_model_type` |
| Get child types for tabs | `['entity', parentCode].child_entity_codes` |
| Resolve entity icon | `['entity', code].ui_icon` |
| Get plural label | `['entity', code].ui_label` |

### Invalidation
- **Trigger:** Admin updates entity configuration
- **WebSocket Event:** `{ type: 'INVALIDATE', payload: { table: 'entity' } }`
- **Action:** `queryClient.invalidateQueries(['entity'])`

---

## Layer 2: `entity_instance` (Entity Instance Registry)

### Database Table
```sql
CREATE TABLE app.entity_instance (
    order_id int4 GENERATED ALWAYS AS IDENTITY,
    entity_code varchar(50),             -- 'project', 'task'
    entity_instance_id uuid,             -- UUID of the instance
    entity_instance_name varchar(255),   -- 'Corporate Office Expansion'
    code varchar(100),                   -- 'COE-2024-001'
    created_ts timestamptz,
    updated_ts timestamptz
);
```

### Cache Structure
```typescript
// Individual entity instance
['entity_instance', entityCode, entityInstanceId]
// e.g., ['entity_instance', 'project', '61203bac-101b-28d6-7a15-2176c15a0b1c']

// All instances of a type
['entity_instance', entityCode, 'all']
// e.g., ['entity_instance', 'project', 'all']

// Cache Entry Shape
interface EntityInstanceCache {
  entity_code: string;
  entity_instance_id: string;
  entity_instance_name: string;
  code: string;
  order_id?: number;
  created_ts?: string;
  updated_ts?: string;
}
```

### Fetch Strategy
```typescript
// Option A: Fetch all at login (for small-medium datasets)
const prefetchEntityInstances = async () => {
  const response = await api.get('/api/v1/entity-instance/all');

  // Group by entity_code
  const grouped = groupBy(response.data, 'entity_code');

  for (const [entityCode, instances] of Object.entries(grouped)) {
    // Store list
    queryClient.setQueryData(['entity_instance', entityCode, 'all'], instances);

    // Index each instance
    for (const instance of instances) {
      const key = ['entity_instance', entityCode, instance.entity_instance_id];
      queryClient.setQueryData(key, instance);
      await dexie.entityInstance.put({
        _id: `${entityCode}:${instance.entity_instance_id}`,
        ...instance
      });
    }
  }
};

// Option B: Fetch per-type on demand (for large datasets)
const fetchEntityInstancesByType = async (entityCode: string) => {
  const cached = queryClient.getQueryData(['entity_instance', entityCode, 'all']);
  if (cached) return cached;

  const response = await api.get(`/api/v1/entity-instance?entity_code=${entityCode}`);
  // ... cache as above
};
```

### Use Cases
| Use Case | Access Pattern |
|----------|----------------|
| Global search | Scan all `['entity_instance', *, 'all']` with text match |
| Entity picker dropdown | `['entity_instance', entityCode, 'all']` |
| Validate entity exists | Check `['entity_instance', code, id]` exists |
| Get instance name by ID | `['entity_instance', code, id].entity_instance_name` |
| Get instance code by ID | `['entity_instance', code, id].code` |

### CRUD Operations

#### On Entity Create
```typescript
// When POST /api/v1/project returns new project
const onEntityCreated = (entityCode: string, entity: any) => {
  const instance: EntityInstanceCache = {
    entity_code: entityCode,
    entity_instance_id: entity.id,
    entity_instance_name: entity.name,
    code: entity.code,
  };

  // Upsert to cache
  queryClient.setQueryData(
    ['entity_instance', entityCode, entity.id],
    instance
  );

  // Add to list
  queryClient.setQueryData(
    ['entity_instance', entityCode, 'all'],
    (old: EntityInstanceCache[] = []) => [...old, instance]
  );

  // Persist to Dexie
  await dexie.entityInstance.put({
    _id: `${entityCode}:${entity.id}`,
    ...instance
  });
};
```

#### On Entity Update
```typescript
// When PATCH /api/v1/project/:id returns updated project
const onEntityUpdated = (entityCode: string, entity: any) => {
  // Update instance cache if name/code changed
  queryClient.setQueryData(
    ['entity_instance', entityCode, entity.id],
    (old: EntityInstanceCache) => ({
      ...old,
      entity_instance_name: entity.name,
      code: entity.code,
      updated_ts: entity.updated_ts,
    })
  );

  // Update in list
  queryClient.setQueryData(
    ['entity_instance', entityCode, 'all'],
    (old: EntityInstanceCache[] = []) =>
      old.map(i => i.entity_instance_id === entity.id
        ? { ...i, entity_instance_name: entity.name, code: entity.code }
        : i
      )
  );
};
```

#### On Entity Delete (Soft)
```typescript
// When DELETE /api/v1/project/:id
const onEntityDeleted = (entityCode: string, entityId: string) => {
  // Remove from cache
  queryClient.removeQueries(['entity_instance', entityCode, entityId]);

  // Remove from list
  queryClient.setQueryData(
    ['entity_instance', entityCode, 'all'],
    (old: EntityInstanceCache[] = []) =>
      old.filter(i => i.entity_instance_id !== entityId)
  );

  // Mark deleted in Dexie
  await dexie.entityInstance.update(
    `${entityCode}:${entityId}`,
    { isDeleted: true }
  );
};
```

### Invalidation
- **Trigger:** Entity created/updated/deleted
- **WebSocket Event:**
  ```json
  {
    "type": "INVALIDATE",
    "payload": {
      "table": "entity_instance",
      "entity_code": "project",
      "entity_instance_id": "uuid",
      "action": "UPDATE"
    }
  }
  ```
- **Action:** Upsert specific instance, or refetch if stale

---

## Layer 3: `entity_instance_link` (Relationship Graph)

### Database Table
```sql
CREATE TABLE app.entity_instance_link (
    id uuid DEFAULT gen_random_uuid(),
    entity_code varchar(50),             -- Parent: 'project'
    entity_instance_id uuid,             -- Parent ID
    child_entity_code varchar(50),       -- Child: 'task'
    child_entity_instance_id uuid,       -- Child ID
    relationship_type varchar(50),       -- 'contains', 'assigned_to', 'owns'
    created_ts timestamptz,
    updated_ts timestamptz
);
```

### Cache Structure
```typescript
// Forward index: Parent → Children
['entity_instance_link', parentCode, parentId, childCode]
// e.g., ['entity_instance_link', 'project', '123', 'task'] → ['task-a', 'task-b']

// Reverse index: Child → Parents
['entity_instance_link_reverse', childCode, childId]
// e.g., ['entity_instance_link_reverse', 'task', 'task-a'] → [{code: 'project', id: '123'}]

// All links (for bulk operations)
['entity_instance_link', 'all']

// Forward Index Entry Shape
interface EntityLinkForward {
  parent_code: string;
  parent_id: string;
  child_code: string;
  child_ids: string[];  // Array of child entity_instance_ids
  relationships: Record<string, string>;  // { childId: relationship_type }
}

// Reverse Index Entry Shape
interface EntityLinkReverse {
  child_code: string;
  child_id: string;
  parents: Array<{
    entity_code: string;
    entity_instance_id: string;
    relationship_type: string;
  }>;
}
```

### Fetch Strategy
```typescript
// At login - fetch all links and build indexes
const prefetchEntityLinks = async () => {
  const response = await api.get('/api/v1/entity-instance-link/all');

  // Build forward index (parent → children)
  const forwardIndex = new Map<string, Set<string>>();
  const relationships = new Map<string, Map<string, string>>();

  // Build reverse index (child → parents)
  const reverseIndex = new Map<string, Array<{
    entity_code: string;
    entity_instance_id: string;
    relationship_type: string;
  }>>();

  for (const link of response.data) {
    // Forward index key
    const forwardKey = `${link.entity_code}:${link.entity_instance_id}:${link.child_entity_code}`;

    if (!forwardIndex.has(forwardKey)) {
      forwardIndex.set(forwardKey, new Set());
      relationships.set(forwardKey, new Map());
    }
    forwardIndex.get(forwardKey)!.add(link.child_entity_instance_id);
    relationships.get(forwardKey)!.set(
      link.child_entity_instance_id,
      link.relationship_type
    );

    // Reverse index key
    const reverseKey = `${link.child_entity_code}:${link.child_entity_instance_id}`;

    if (!reverseIndex.has(reverseKey)) {
      reverseIndex.set(reverseKey, []);
    }
    reverseIndex.get(reverseKey)!.push({
      entity_code: link.entity_code,
      entity_instance_id: link.entity_instance_id,
      relationship_type: link.relationship_type,
    });
  }

  // Store forward indexes
  for (const [key, childIds] of forwardIndex.entries()) {
    const [parentCode, parentId, childCode] = key.split(':');
    const cacheKey = ['entity_instance_link', parentCode, parentId, childCode];

    queryClient.setQueryData(cacheKey, {
      parent_code: parentCode,
      parent_id: parentId,
      child_code: childCode,
      child_ids: Array.from(childIds),
      relationships: Object.fromEntries(relationships.get(key)!),
    });

    await dexie.entityLinks.put({
      _id: key,
      parentCode,
      parentId,
      childCode,
      childIds: Array.from(childIds),
      relationships: Object.fromEntries(relationships.get(key)!),
    });
  }

  // Store reverse indexes
  for (const [key, parents] of reverseIndex.entries()) {
    const [childCode, childId] = key.split(':');
    const cacheKey = ['entity_instance_link_reverse', childCode, childId];

    queryClient.setQueryData(cacheKey, {
      child_code: childCode,
      child_id: childId,
      parents,
    });

    await dexie.entityLinksReverse.put({
      _id: key,
      childCode,
      childId,
      parents,
    });
  }
};
```

### Query Derivation (The Magic!)

```typescript
/**
 * Derive filtered entity list from cache WITHOUT API call
 *
 * Before: GET /api/v1/task?parent_entity_code=project&parent_entity_instance_id=123
 * After:  Read from cache in O(1)
 */
const getChildEntitiesFromCache = (
  parentCode: string,
  parentId: string,
  childCode: string
): EntityInstanceCache[] | null => {
  // Step 1: Get child IDs from link graph
  const linkData = queryClient.getQueryData<EntityLinkForward>(
    ['entity_instance_link', parentCode, parentId, childCode]
  );

  if (!linkData) {
    return null; // Cache miss - need to fetch from API
  }

  // Step 2: Resolve each child ID to full entity instance
  const children: EntityInstanceCache[] = [];

  for (const childId of linkData.child_ids) {
    const instance = queryClient.getQueryData<EntityInstanceCache>(
      ['entity_instance', childCode, childId]
    );

    if (instance) {
      children.push(instance);
    }
  }

  return children;
};

/**
 * Get all parents of a child entity
 * Use case: "Which projects is this task linked to?"
 */
const getParentEntitiesFromCache = (
  childCode: string,
  childId: string
): Array<{ code: string; id: string; name: string; relationship: string }> | null => {
  const reverseData = queryClient.getQueryData<EntityLinkReverse>(
    ['entity_instance_link_reverse', childCode, childId]
  );

  if (!reverseData) {
    return null;
  }

  return reverseData.parents.map(parent => {
    const instance = queryClient.getQueryData<EntityInstanceCache>(
      ['entity_instance', parent.entity_code, parent.entity_instance_id]
    );

    return {
      code: parent.entity_code,
      id: parent.entity_instance_id,
      name: instance?.entity_instance_name || 'Unknown',
      relationship: parent.relationship_type,
    };
  });
};
```

### Use Cases
| Use Case | Access Pattern |
|----------|----------------|
| Get tasks for project | `['entity_instance_link', 'project', projectId, 'task']` → child_ids |
| Get tab counts | `['entity_instance_link', parentCode, parentId, childCode].child_ids.length` |
| Check if task has parent | `['entity_instance_link_reverse', 'task', taskId].parents.length > 0` |
| Get all parents of entity | `['entity_instance_link_reverse', childCode, childId].parents` |
| Move task to new project | Update both forward and reverse indexes |

### CRUD Operations

#### On Link Created
```typescript
const onLinkCreated = (link: EntityInstanceLink) => {
  const { entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, relationship_type } = link;

  // Update forward index
  const forwardKey = ['entity_instance_link', entity_code, entity_instance_id, child_entity_code];
  queryClient.setQueryData<EntityLinkForward>(forwardKey, (old) => {
    if (!old) {
      return {
        parent_code: entity_code,
        parent_id: entity_instance_id,
        child_code: child_entity_code,
        child_ids: [child_entity_instance_id],
        relationships: { [child_entity_instance_id]: relationship_type },
      };
    }
    return {
      ...old,
      child_ids: [...new Set([...old.child_ids, child_entity_instance_id])],
      relationships: {
        ...old.relationships,
        [child_entity_instance_id]: relationship_type,
      },
    };
  });

  // Update reverse index
  const reverseKey = ['entity_instance_link_reverse', child_entity_code, child_entity_instance_id];
  queryClient.setQueryData<EntityLinkReverse>(reverseKey, (old) => {
    const newParent = {
      entity_code,
      entity_instance_id,
      relationship_type,
    };

    if (!old) {
      return {
        child_code: child_entity_code,
        child_id: child_entity_instance_id,
        parents: [newParent],
      };
    }
    return {
      ...old,
      parents: [...old.parents, newParent],
    };
  });
};
```

#### On Link Deleted
```typescript
const onLinkDeleted = (link: EntityInstanceLink) => {
  const { entity_code, entity_instance_id, child_entity_code, child_entity_instance_id } = link;

  // Update forward index
  const forwardKey = ['entity_instance_link', entity_code, entity_instance_id, child_entity_code];
  queryClient.setQueryData<EntityLinkForward>(forwardKey, (old) => {
    if (!old) return old;
    const newChildIds = old.child_ids.filter(id => id !== child_entity_instance_id);
    const { [child_entity_instance_id]: _, ...newRelationships } = old.relationships;
    return {
      ...old,
      child_ids: newChildIds,
      relationships: newRelationships,
    };
  });

  // Update reverse index
  const reverseKey = ['entity_instance_link_reverse', child_entity_code, child_entity_instance_id];
  queryClient.setQueryData<EntityLinkReverse>(reverseKey, (old) => {
    if (!old) return old;
    return {
      ...old,
      parents: old.parents.filter(
        p => !(p.entity_code === entity_code && p.entity_instance_id === entity_instance_id)
      ),
    };
  });
};
```

### Invalidation
- **Trigger:** Link created/deleted, entity deleted (cascades to links)
- **WebSocket Event:**
  ```json
  {
    "type": "LINK_CHANGE",
    "payload": {
      "action": "CREATE" | "DELETE",
      "entity_code": "project",
      "entity_instance_id": "uuid",
      "child_entity_code": "task",
      "child_entity_instance_id": "uuid"
    }
  }
  ```
- **Action:** Update both forward and reverse indexes

---

## Layer 4: `entity_instance_name` (Entity Name Lookup)

### Source
Derived from `entity_instance` table but structured for O(1) lookups.

**API Response** (uses `ref_data_entityInstance` for backward compatibility):
```typescript
// API Response includes this:
{
  "data": [...],
  "ref_data_entityInstance": {
    "employee": {
      "8260b1b0-5efc-4611-ad33-ee76c0cf7f13": "James Miller",
      "50d6b2f8-b4e8-4c2b-8259-d1e6ef8d36c4": "Sarah Johnson"
    },
    "project": {
      "61203bac-101b-28d6-7a15-2176c15a0b1c": "Corporate Office Expansion"
    }
  }
}
```

### Cache Structure
```typescript
// Per entity type
['entity_instance_name', entityCode]
// e.g., ['entity_instance_name', 'employee']

// Cache Entry Shape
type EntityInstanceNameMap = Record<string, string>;
// { [entity_instance_id]: entity_instance_name }
```

### Accumulation Strategy
```typescript
/**
 * Merge ref_data_entityInstance from API response into entity_instance_name cache
 * Called after EVERY API response that contains ref_data_entityInstance
 */
const mergeEntityInstanceNames = (
  refDataFromApi: Record<string, Record<string, string>>  // ref_data_entityInstance from API
) => {
  for (const [entityCode, nameMap] of Object.entries(refDataFromApi)) {
    // Cache key uses entity_instance_name
    const cacheKey = ['entity_instance_name', entityCode];

    queryClient.setQueryData<EntityInstanceNameMap>(cacheKey, (old = {}) => ({
      ...old,
      ...nameMap,
    }));

    // Also persist to Dexie
    await dexie.entityInstanceName.bulkPut(
      Object.entries(nameMap).map(([id, name]) => ({
        _id: `${entityCode}:${id}`,
        entityCode,
        entityInstanceId: id,
        entityInstanceName: name,
      }))
    );
  }
};
```

### Use Cases
| Use Case | Access Pattern |
|----------|----------------|
| Display manager name | `['entity_instance_name', 'employee'][manager__employee_id]` |
| Display project name in task | `['entity_instance_name', 'project'][project_id]` |
| Resolve any UUID to name | `['entity_instance_name', entityCode][uuid]` |

### Sync Cache for Non-Hook Access
```typescript
// In-memory Map for synchronous access (formatters, utilities)
const entityInstanceNameSyncCache = new Map<string, Record<string, string>>();

// Getter
export const getEntityInstanceNameSync = (
  entityCode: string,
  entityInstanceId: string
): string | null => {
  const entityMap = entityInstanceNameSyncCache.get(entityCode);
  return entityMap?.[entityInstanceId] ?? null;
};

// Update sync cache when TanStack Query cache changes
queryClient.getQueryCache().subscribe((event) => {
  if (event.query.queryKey[0] === 'entity_instance_name') {
    const entityCode = event.query.queryKey[1] as string;
    const data = event.query.state.data as EntityInstanceNameMap;
    if (data) {
      entityInstanceNameSyncCache.set(entityCode, data);
    }
  }
});
```

### Invalidation
- **Trigger:** Entity name updated, entity deleted
- **Action:** Remove specific entry or update name
- **Note:** This layer is append-only during normal operation; only removes on delete

---

## Dexie Schema (IndexedDB Persistence)

```typescript
// apps/web/src/db/dexie/database.ts

import Dexie, { Table } from 'dexie';

export interface EntityRecord {
  _id: string;  // entity.code
  code: string;
  name: string;
  ui_label: string;
  ui_icon: string;
  db_table: string;
  db_model_type: string;
  child_entity_codes: string[];
  display_order: number;
  domain_code?: string;
  column_metadata?: any[];
  syncedAt: number;
}

export interface EntityInstanceRecord {
  _id: string;  // `${entity_code}:${entity_instance_id}`
  entity_code: string;
  entity_instance_id: string;
  entity_instance_name: string;
  code: string;
  order_id?: number;
  isDeleted?: boolean;
  syncedAt: number;
}

export interface EntityLinkRecord {
  _id: string;  // `${parentCode}:${parentId}:${childCode}`
  parentCode: string;
  parentId: string;
  childCode: string;
  childIds: string[];
  relationships: Record<string, string>;
  syncedAt: number;
}

export interface EntityLinkReverseRecord {
  _id: string;  // `${childCode}:${childId}`
  childCode: string;
  childId: string;
  parents: Array<{
    entity_code: string;
    entity_instance_id: string;
    relationship_type: string;
  }>;
  syncedAt: number;
}

export interface EntityInstanceNameRecord {
  _id: string;  // `${entityCode}:${entityInstanceId}`
  entityCode: string;
  entityInstanceId: string;
  entityInstanceName: string;
  syncedAt: number;
}

class PMODatabase extends Dexie {
  entity!: Table<EntityRecord>;
  entityInstance!: Table<EntityInstanceRecord>;
  entityInstanceLink!: Table<EntityLinkRecord>;
  entityInstanceLinkReverse!: Table<EntityLinkReverseRecord>;
  entityInstanceName!: Table<EntityInstanceNameRecord>;

  // Existing tables
  entities!: Table<any>;  // Raw entity data (from API responses)
  metadata!: Table<any>;  // Field metadata, datalabels
  drafts!: Table<any>;    // Form drafts with undo/redo

  constructor() {
    super('pmo-cache-v3');

    this.version(1).stores({
      // Layer 1: Entity types (fetch at login, persist)
      entity: '_id, code, display_order',

      // Layer 2: Entity instances (fetch at login, persist, upsert, validate, invalidate)
      entityInstance: '_id, entity_code, entity_instance_id, [entity_code+entity_instance_id], isDeleted',

      // Layer 3: Link graph forward (fetch at login, persist, upsert, validate, invalidate)
      entityInstanceLink: '_id, parentCode, parentId, childCode, [parentCode+parentId+childCode]',

      // Layer 3: Link graph reverse (fetch at login, persist, upsert, validate, invalidate)
      entityInstanceLinkReverse: '_id, childCode, childId, [childCode+childId]',

      // Layer 4: Name lookups (upsert, validate, invalidate - accumulated from API responses)
      entityInstanceName: '_id, entityCode, entityInstanceId, [entityCode+entityInstanceId]',

      // Existing tables (for raw entity data from API responses)
      entities: '_id, entityCode, entityId, syncedAt, isDeleted',
      metadata: '_id, type, key',
      drafts: '_id, entityCode, entityId, updatedAt',
    });
  }
}

export const dexie = new PMODatabase();
```

---

## Hydration Flow (App Startup)

```typescript
// apps/web/src/db/TanstackCacheProvider.tsx

const hydrateFromDexie = async () => {
  const startTime = Date.now();

  // Layer 1: Entity types
  const entities = await dexie.entity.toArray();
  for (const entity of entities) {
    queryClient.setQueryData(['entity', entity.code], entity);
  }
  queryClient.setQueryData(['entity', 'all'], entities);

  // Layer 2: Entity instances
  const instances = await dexie.entityInstance
    .where('isDeleted')
    .notEqual(true)
    .toArray();

  const instancesByCode = groupBy(instances, 'entity_code');
  for (const [code, list] of Object.entries(instancesByCode)) {
    queryClient.setQueryData(['entity_instance', code, 'all'], list);
    for (const instance of list) {
      queryClient.setQueryData(
        ['entity_instance', code, instance.entity_instance_id],
        instance
      );
    }
  }

  // Layer 3: entity_instance_link (forward)
  const links = await dexie.entityInstanceLink.toArray();
  for (const link of links) {
    queryClient.setQueryData(
      ['entity_instance_link', link.parentCode, link.parentId, link.childCode],
      link
    );
  }

  // Layer 3: entity_instance_link (reverse)
  const reverseLinks = await dexie.entityInstanceLinkReverse.toArray();
  for (const link of reverseLinks) {
    queryClient.setQueryData(
      ['entity_instance_link_reverse', link.childCode, link.childId],
      link
    );
  }

  // Layer 4: entity_instance_name
  const nameRecords = await dexie.entityInstanceName.toArray();
  const namesByCode = groupBy(nameRecords, 'entityCode');
  for (const [code, records] of Object.entries(namesByCode)) {
    const nameMap: Record<string, string> = {};
    for (const record of records) {
      nameMap[record.entityInstanceId] = record.entityInstanceName;
    }
    queryClient.setQueryData(['entity_instance_name', code], nameMap);
    entityInstanceNameSyncCache.set(code, nameMap);
  }

  console.log(`Cache hydrated in ${Date.now() - startTime}ms`);
};
```

---

## Login Prefetch Flow

```typescript
// apps/web/src/db/prefetch.ts

export const prefetchAllMetadata = async () => {
  await Promise.all([
    // Layer 1: Entity types (always fresh at login)
    prefetchEntityTypes(),

    // Layer 2: Entity instances (delta sync if large)
    prefetchEntityInstances(),

    // Layer 3: Link graph (delta sync if large)
    prefetchEntityLinks(),

    // Existing: Datalabels, global settings
    prefetchDatalabels(),
    prefetchGlobalSettings(),
  ]);
};

const prefetchEntityTypes = async () => {
  const response = await api.get('/api/v1/entity/types');

  for (const entity of response.data) {
    queryClient.setQueryData(['entity', entity.code], entity);
    await dexie.entity.put({
      _id: entity.code,
      ...entity,
      syncedAt: Date.now(),
    });
  }

  queryClient.setQueryData(['entity', 'all'], response.data);
};

const prefetchEntityInstances = async () => {
  // Get last sync timestamp from Dexie
  const lastSync = await dexie.metadata.get('entity_instance_last_sync');
  const since = lastSync?.value || 0;

  // Delta fetch: only get records updated since last sync
  const response = await api.get(`/api/v1/entity-instance/all?since=${since}`);

  // ... process and cache

  // Update sync timestamp
  await dexie.metadata.put({
    _id: 'entity_instance_last_sync',
    type: 'sync',
    key: 'entity_instance_last_sync',
    value: Date.now(),
  });
};

const prefetchEntityLinks = async () => {
  // Similar delta sync pattern
  const lastSync = await dexie.metadata.get('entity_links_last_sync');
  const since = lastSync?.value || 0;

  const response = await api.get(`/api/v1/entity-instance-link/all?since=${since}`);

  // ... process and cache
};
```

---

## WebSocket Invalidation Strategy

```typescript
// apps/web/src/db/tanstack-sync/WebSocketManager.ts

interface InvalidateMessage {
  type: 'INVALIDATE';
  payload: {
    table: 'entity' | 'entity_instance' | 'entity_instance_link';
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    entity_code?: string;
    entity_instance_id?: string;
    child_entity_code?: string;
    child_entity_instance_id?: string;
  };
}

const handleInvalidate = async (message: InvalidateMessage) => {
  const { table, action, entity_code, entity_instance_id, child_entity_code, child_entity_instance_id } = message.payload;

  switch (table) {
    case 'entity':
      // Rare: admin changed entity config
      queryClient.invalidateQueries(['entity']);
      break;

    case 'entity_instance':
      if (action === 'DELETE') {
        onEntityDeleted(entity_code!, entity_instance_id!);
      } else {
        // Refetch specific instance
        const response = await api.get(
          `/api/v1/entity-instance/${entity_code}/${entity_instance_id}`
        );
        onEntityUpdated(entity_code!, response.data);
      }
      break;

    case 'entity_instance_link':
      if (action === 'CREATE') {
        // Fetch the new link and add to cache
        const link = await api.get(
          `/api/v1/entity-instance-link?parent=${entity_code}:${entity_instance_id}&child=${child_entity_code}:${child_entity_instance_id}`
        );
        onLinkCreated(link.data);
      } else if (action === 'DELETE') {
        onLinkDeleted({
          entity_code: entity_code!,
          entity_instance_id: entity_instance_id!,
          child_entity_code: child_entity_code!,
          child_entity_instance_id: child_entity_instance_id!,
        });
      }
      break;
  }
};
```

---

## Hook Implementation: `useNormalizedEntityList`

```typescript
// apps/web/src/db/tanstack-hooks/useNormalizedEntityList.ts

interface UseNormalizedEntityListParams {
  entityCode: string;
  parentEntityCode?: string;
  parentEntityInstanceId?: string;
  limit?: number;
  offset?: number;
}

export function useNormalizedEntityList<T>(params: UseNormalizedEntityListParams) {
  const {
    entityCode,
    parentEntityCode,
    parentEntityInstanceId,
    limit = 100,
    offset = 0,
  } = params;

  // Check if we can derive from cache (parent-child query)
  const canDeriveFromCache = parentEntityCode && parentEntityInstanceId;

  // Try to get from link graph first
  const linkData = useQuery({
    queryKey: ['entity_instance_link', parentEntityCode, parentEntityInstanceId, entityCode],
    enabled: !!canDeriveFromCache,
    staleTime: Infinity,  // Link graph is kept fresh via WebSocket
  });

  // Get entity instances
  const instancesQuery = useQuery({
    queryKey: ['entity_instance', entityCode, 'all'],
    staleTime: 5 * 60 * 1000,  // 5 minutes
  });

  // Derive filtered list from cache
  const derivedData = useMemo(() => {
    if (!canDeriveFromCache || !linkData.data || !instancesQuery.data) {
      return null;
    }

    const childIds = new Set(linkData.data.child_ids);
    const filtered = instancesQuery.data.filter(
      (instance: EntityInstanceCache) => childIds.has(instance.entity_instance_id)
    );

    // Apply pagination
    const paginated = filtered.slice(offset, offset + limit);

    return {
      data: paginated,
      total: filtered.length,
      limit,
      offset,
    };
  }, [linkData.data, instancesQuery.data, offset, limit, canDeriveFromCache]);

  // Fallback: Fetch from API if cache miss
  const apiQuery = useQuery({
    queryKey: ['entity-list', entityCode, params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      queryParams.set('limit', String(limit));
      queryParams.set('offset', String(offset));
      if (parentEntityCode) queryParams.set('parent_entity_code', parentEntityCode);
      if (parentEntityInstanceId) queryParams.set('parent_entity_instance_id', parentEntityInstanceId);

      const response = await api.get(`/api/v1/${entityCode}?${queryParams}`);

      // Merge ref_data_entityInstance into cache
      if (response.ref_data_entityInstance) {
        mergeRefDataEntityInstance(response.ref_data_entityInstance);
      }

      // Update entity_instance cache
      for (const entity of response.data) {
        onEntityUpdated(entityCode, entity);
      }

      // Update link graph if parent context
      if (parentEntityCode && parentEntityInstanceId) {
        const childIds = response.data.map((e: any) => e.id);
        queryClient.setQueryData(
          ['entity_instance_link', parentEntityCode, parentEntityInstanceId, entityCode],
          {
            parent_code: parentEntityCode,
            parent_id: parentEntityInstanceId,
            child_code: entityCode,
            child_ids: childIds,
            relationships: {},  // Will be populated by link API
          }
        );
      }

      return response;
    },
    enabled: !derivedData,  // Only fetch if can't derive
    staleTime: 2 * 60 * 1000,  // 2 minutes
  });

  // Return derived data or API data
  if (derivedData) {
    return {
      data: derivedData.data as T[],
      total: derivedData.total,
      limit: derivedData.limit,
      offset: derivedData.offset,
      isLoading: false,
      isFetching: false,
      isFromCache: true,
    };
  }

  return {
    data: (apiQuery.data?.data || []) as T[],
    total: apiQuery.data?.total || 0,
    limit: apiQuery.data?.limit || limit,
    offset: apiQuery.data?.offset || offset,
    metadata: apiQuery.data?.metadata,
    ref_data_entityInstance: apiQuery.data?.ref_data_entityInstance,
    isLoading: apiQuery.isLoading,
    isFetching: apiQuery.isFetching,
    isFromCache: false,
  };
}
```

---

## Benefits Summary

| Metric | Before | After |
|--------|--------|-------|
| API calls for parent-child query | 1 per navigation | 0 (cache hit) |
| Memory for 100 tasks across 10 projects | 100 × 10 = 1000 entries | 100 entries + 10 link indexes |
| Update propagation | Invalidate all list queries | Update 1 entity, derived lists auto-update |
| Offline support | Per-query cache | Full entity graph available |
| Name resolution | Per-row lookup or JOIN | O(1) from ref_data_entityInstance |
| Tab count calculation | API call | `linkData.child_ids.length` |

---

## Migration Path

1. **Phase 1:** Add new Dexie tables (non-breaking)
2. **Phase 2:** Add prefetch functions for new layers
3. **Phase 3:** Create `useNormalizedEntityList` hook
4. **Phase 4:** Gradually migrate components to new hook
5. **Phase 5:** Add WebSocket handlers for new invalidation events
6. **Phase 6:** Deprecate old hooks after validation

---

## API Endpoints Required

| Endpoint | Purpose | Response |
|----------|---------|----------|
| `GET /api/v1/entity/types` | All entity type metadata | `{ data: Entity[] }` |
| `GET /api/v1/entity-instance/all?since=timestamp` | Delta sync entity instances | `{ data: EntityInstance[] }` |
| `GET /api/v1/entity-instance-link/all?since=timestamp` | Delta sync links | `{ data: EntityInstanceLink[] }` |
| `GET /api/v1/entity-instance/:code/:id` | Single instance | `{ data: EntityInstance }` |

---

## Open Questions

1. **Delta Sync Threshold:** At what dataset size should we switch from full fetch to delta sync?
2. **Link Graph Size:** Should we limit link prefetch to "recent" or "active" entities?
3. **Ref Data Eviction:** Should we evict old ref_data entries to prevent unbounded growth?
4. **Offline Conflict Resolution:** How to handle conflicts when syncing after offline period?

---

**Version:** 1.0
**Last Updated:** 2025-11-29
**Status:** Design Phase - Ready for Review
