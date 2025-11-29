# 4-Layer Normalized Cache - Implementation Guide

> **Implementation Status:** Complete
> **Version:** 1.0.0
> **Date:** 2025-11-29

## Overview

This document describes the implementation of the 4-layer normalized cache architecture for the PMO Enterprise Platform. The architecture mirrors the database infrastructure tables directly in the frontend cache.

## Files Changed/Created

### Backend (API)

| File | Changes |
|------|---------|
| `apps/api/src/modules/entity/routes.ts` | Added 3 new endpoints for cache layers |

**New Endpoints:**
- `GET /api/v1/entity/types` - Layer 1: All entity type metadata
- `GET /api/v1/entity-instance/all` - Layer 2: All entity instances with delta sync
- `GET /api/v1/entity-instance-link/all` - Layer 3: All links with delta sync

### Frontend (Web)

| File | Changes |
|------|---------|
| `apps/web/src/db/dexie/database.ts` | Complete rewrite to v3 schema with 4 layers |
| `apps/web/src/db/tanstack-hooks/useNormalizedCache.ts` | **NEW** - All 4 layer hooks and utilities |
| `apps/web/src/db/tanstack-hooks/index.ts` | Added exports for new hooks |
| `apps/web/src/db/TanstackCacheProvider.tsx` | Integrated normalized cache hydration/prefetch |
| `apps/web/src/db/tanstack-sync/WebSocketManager.ts` | Added handlers for new invalidation types |

## API Endpoints

### GET /api/v1/entity/types

**Purpose:** Layer 1 - Entity type metadata

**Response:**
```json
{
  "data": [
    {
      "code": "project",
      "name": "Project",
      "ui_label": "Projects",
      "ui_icon": "FolderOpen",
      "db_table": "project",
      "db_model_type": "d",
      "child_entity_codes": ["task", "wiki", "artifact"],
      "display_order": 1,
      "domain_code": "operations",
      "active_flag": true
    }
  ],
  "syncedAt": 1732900000000
}
```

### GET /api/v1/entity-instance/all

**Purpose:** Layer 2 - Entity instance registry

**Query Parameters:**
- `since` (optional): Unix timestamp for delta sync
- `limit` (optional): Max records (default 5000)

**Response:**
```json
{
  "data": [
    {
      "entity_code": "project",
      "entity_instance_id": "uuid-here",
      "entity_instance_name": "Kitchen Renovation",
      "code": "PROJ-001",
      "order_id": 1,
      "updated_ts": "2025-11-29T00:00:00Z"
    }
  ],
  "syncedAt": 1732900000000,
  "hasMore": false
}
```

### GET /api/v1/entity-instance-link/all

**Purpose:** Layer 3 - Relationship graph

**Query Parameters:**
- `since` (optional): Unix timestamp for delta sync
- `limit` (optional): Max records (default 10000)

**Response:**
```json
{
  "data": [
    {
      "id": "link-uuid",
      "entity_code": "project",
      "entity_instance_id": "project-uuid",
      "child_entity_code": "task",
      "child_entity_instance_id": "task-uuid",
      "relationship_type": "contains",
      "updated_ts": "2025-11-29T00:00:00Z"
    }
  ],
  "syncedAt": 1732900000000,
  "hasMore": false
}
```

## Dexie Schema (v3)

```typescript
// Database name: pmo-cache-v3
{
  // Layer 1: Entity Types
  entityTypes: '_id, code, display_order, domain_code',

  // Layer 2: Entity Instances
  entityInstances: '_id, entity_code, entity_instance_id, [entity_code+entity_instance_id], isDeleted, syncedAt',

  // Layer 3: Entity Links
  entityLinksForward: '_id, parentCode, parentId, childCode, [parentCode+parentId+childCode]',
  entityLinksReverse: '_id, childCode, childId, [childCode+childId]',
  entityLinksRaw: '_id, entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, syncedAt',

  // Layer 4: Entity Instance Names
  entityInstanceNames: '_id, entityCode, entityInstanceId, [entityCode+entityInstanceId]',

  // Legacy Tables
  entities: '_id, entityCode, entityId, syncedAt, isDeleted',
  entityLists: '_id, entityCode, queryHash, syncedAt',
  metadata: '_id, type, key',
  drafts: '_id, entityCode, entityId, updatedAt',
}
```

## TanStack Query Keys

| Layer | Query Key | Purpose |
|-------|-----------|---------|
| 1 | `['entity', 'types']` | All entity types |
| 2 | `['entity_instance', 'all']` | All entity instances |
| 3 | `['entity_instance_link', 'all']` | Link graph loaded marker |
| 4 | `['entity_instance_name', entityCode]` | Names per entity type |

## Hooks

### Layer 1: Entity Types

```typescript
// Hook
const { data, isLoading, getByCode, getChildCodes } = useEntityTypes();

// Sync access
const entityType = getEntityTypeSync('project');
const allTypes = getAllEntityTypesSync();
const childCodes = getChildEntityCodesSync('project');

// Prefetch
await prefetchEntityTypes();
```

### Layer 2: Entity Instances

```typescript
// Hook
const { data, isLoading, getByCode, getInstance } = useEntityInstances();

// Sync access
const instances = getEntityInstancesSync('project');
const instance = getEntityInstanceSync('project', 'uuid');

// Prefetch
await prefetchEntityInstances();
```

### Layer 3: Entity Links

```typescript
// Hook
const { isLoading, getChildIds, getParents, getTabCounts } = useEntityLinks();

// Sync access (O(1) - no API call!)
const taskIds = getChildIdsSync('project', 'project-uuid', 'task');
const parents = getParentsSync('task', 'task-uuid');

// Prefetch
await prefetchEntityLinks();
```

### Layer 4: Entity Instance Names

```typescript
// Hook
const { data, isLoading, getName } = useEntityInstanceNames('employee');

// Sync access
const name = getEntityInstanceNameSync('employee', 'uuid');
const allNames = getEntityInstanceNamesForTypeSync('employee');

// Merge from API response
mergeEntityInstanceNames(response.entity_instance_name);
```

### Derived Queries

```typescript
// Get filtered list from cache (no API call!)
const { data, total, isLoading, isFromCache } = useNormalizedEntityList<Task>('task', {
  parentEntityCode: 'project',
  parentEntityInstanceId: 'project-uuid',
  limit: 50,
  offset: 0,
});
```

## WebSocket Message Types

### NORMALIZED_INVALIDATE

For table-level invalidations:

```json
{
  "type": "NORMALIZED_INVALIDATE",
  "payload": {
    "table": "entity" | "entity_instance" | "entity_instance_link",
    "action": "INSERT" | "UPDATE" | "DELETE",
    "entity_code": "project",
    "entity_instance_id": "uuid"
  }
}
```

### LINK_CHANGE

For optimistic link updates:

```json
{
  "type": "LINK_CHANGE",
  "payload": {
    "action": "INSERT" | "DELETE",
    "entity_code": "project",
    "entity_instance_id": "project-uuid",
    "child_entity_code": "task",
    "child_entity_instance_id": "task-uuid",
    "relationship_type": "contains"
  }
}
```

## Lifecycle

### App Startup

1. `TanstackCacheProvider` mounts
2. `hydrateQueryCache()` loads legacy entities from Dexie
3. `hydrateNormalizedCache()` loads all 4 layers from Dexie
4. App renders (isReady = true)

### Login

1. User authenticates
2. `connectWebSocket(token)` connects to PubSub (port 4001)
3. `prefetchAllMetadata()` runs:
   - `prefetchNormalizedCache()` - fetches all 4 layers
   - `prefetchAllDatalabels()` - dropdowns
   - `prefetchEntityCodes()` - legacy
   - `prefetchGlobalSettings()` - settings

### Runtime

1. Components use hooks (`useEntityTypes`, `useEntityInstances`, etc.)
2. Derived queries use `useNormalizedEntityList` - O(1) from cache
3. Mutations trigger WebSocket invalidation
4. WebSocket handlers update caches

### Logout

1. `clearCache()` called
2. WebSocket disconnects
3. All sync caches cleared
4. TanStack Query cache cleared
5. Dexie normalized tables cleared

## Benefits

| Metric | Before | After |
|--------|--------|-------|
| API calls for parent-child query | 1 per navigation | 0 (cache hit) |
| Memory for 100 tasks across 10 projects | 1000 entries | 100 + 10 indexes |
| Tab count calculation | API call | `getTabCounts()` |
| Name resolution | Per-row lookup | O(1) from cache |
| Offline support | Per-query | Full entity graph |

## Migration Notes

- Legacy tables (`entities`, `entityLists`) are preserved for backward compatibility
- Old hooks (`useEntity`, `useEntityList`) continue to work
- New components should prefer `useNormalizedEntityList` for filtered queries
- API responses can use either `entity_instance_name` or `ref_data_entityInstance`
