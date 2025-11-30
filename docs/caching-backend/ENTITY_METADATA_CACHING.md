# Entity Endpoint Metadata Caching

> Backend caching strategy for entity field metadata using Redis + PostgreSQL result descriptors

**Version**: 1.0.0
**Last Updated**: 2025-01-29
**Status**: Design Document

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Solution Overview](#solution-overview)
3. [Architecture](#architecture)
4. [Flow Diagrams](#flow-diagrams)
5. [Implementation Details](#implementation-details)
6. [Cache Configuration](#cache-configuration)
7. [API Response Structure](#api-response-structure)
8. [Error Handling](#error-handling)
9. [Cache Invalidation](#cache-invalidation)
10. [Related Documentation](#related-documentation)

---

## Problem Statement

### Issue

When navigating to a child entity tab (e.g., `/project/{id}/task`) that has **no existing data**, the "Add new row" functionality shows only the actions column. Users cannot fill in any data fields because the table has no column definitions.

### Root Cause

**Location**: `apps/api/src/services/backend-formatter.service.ts:981`

```typescript
// Current implementation - PROBLEMATIC
const fieldNames = data.length > 0 ? Object.keys(data[0]) : [];
```

**The Problem Flow:**

```
1. User navigates to /project/{id}/task (child entity tab)
2. child-entity-route-factory.ts queries database
3. Query returns data: [] (empty array)
4. generateEntityResponse() tries to extract field names from data[0]
5. data[0] is undefined → fieldNames = []
6. Empty fieldNames → empty metadata → no columns rendered
7. User clicks "Add new row" → table has no column definitions
8. User cannot fill in any data!
```

### Why Existing Rows Work

When data exists:
- `Object.keys(data[0])` extracts all field names from the first row
- Metadata is generated correctly with all field definitions
- All columns render with proper view/edit inputs

### Impact

- **User Experience**: Users cannot create new records in empty child entity tables
- **Workflow Blocking**: First record creation is impossible without workarounds
- **Affected Components**:
  - `EntityListOfInstancesTable` (child tabs)
  - `child-entity-route-factory.ts` (auto-generated endpoints)
  - Any LIST endpoint returning empty data

---

## Solution Overview

### Strategy: Redis Cache + PostgreSQL Result Field Descriptor Fallback

We implement a three-tier approach:

| Tier | Source | When Used |
|------|--------|-----------|
| 1 | Redis Cache | Cache hit - fastest path |
| 2 | Data Row | Cache miss + data exists |
| 3 | PGresult Fields | Cache miss + data empty |

### Key Insight: PostgreSQL Always Returns Field Metadata

Even when a query returns zero rows, PostgreSQL's result object contains complete column metadata:

```typescript
const result = await client.query('SELECT id, name, code FROM app.task WHERE 1=0');

// result.rows = []  (empty - no data)
// result.fields = [
//   { name: 'id', dataTypeID: 2950, tableID: 16385, ... },
//   { name: 'name', dataTypeID: 1043, tableID: 16385, ... },
//   { name: 'code', dataTypeID: 1043, tableID: 16385, ... }
// ]

// Field names are ALWAYS available!
const fieldNames = result.fields.map(f => f.name);
// → ['id', 'name', 'code']
```

This is the `PGresult` structure from libpq - the field descriptor is populated during query preparation, not result fetching.

---

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API Layer                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                     Entity Route Handlers                                ││
│  │  ┌─────────────┐  ┌─────────────────────┐  ┌──────────────────────────┐ ││
│  │  │ project/    │  │ task/               │  │ child-entity-route-      │ ││
│  │  │ routes.ts   │  │ routes.ts           │  │ factory.ts               │ ││
│  │  └──────┬──────┘  └──────────┬──────────┘  └────────────┬─────────────┘ ││
│  └─────────┼────────────────────┼──────────────────────────┼───────────────┘│
│            │                    │                          │                 │
│            └────────────────────┼──────────────────────────┘                 │
│                                 │                                            │
│                                 ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                  Backend Formatter Service                               ││
│  │                  (backend-formatter.service.ts)                          ││
│  │  ┌───────────────────────────────────────────────────────────────────┐  ││
│  │  │  generateEntityResponse()                                          │  ││
│  │  │  ├── checkFieldCache() ────────────────────┐                       │  ││
│  │  │  ├── extractFieldNames()                   │                       │  ││
│  │  │  ├── hydrateFieldCache() ◄─────────────────┤                       │  ││
│  │  │  └── generateMetadataForComponents()       │                       │  ││
│  │  └────────────────────────────────────────────┼───────────────────────┘  ││
│  └───────────────────────────────────────────────┼──────────────────────────┘│
└──────────────────────────────────────────────────┼──────────────────────────┘
                                                   │
                         ┌─────────────────────────┴─────────────────────────┐
                         │                                                   │
                         ▼                                                   ▼
              ┌─────────────────────┐                          ┌─────────────────────┐
              │      Redis          │                          │    PostgreSQL       │
              │  (ioredis/Valkey)   │                          │                     │
              │                     │                          │  ┌───────────────┐  │
              │  entity:fields:*    │                          │  │ Query Result  │  │
              │  ┌───────────────┐  │                          │  │ ┌───────────┐ │  │
              │  │ task: [...]   │  │                          │  │ │ rows: []  │ │  │
              │  │ project: [...] │  │                          │  │ │ fields:   │ │  │
              │  │ employee: [...] │  │                          │  │ │  [{name}] │ │  │
              │  └───────────────┘  │                          │  │ └───────────┘ │  │
              │                     │                          │  └───────────────┘  │
              │  TTL: 24 hours      │                          │                     │
              └─────────────────────┘                          └─────────────────────┘
```

### Existing Infrastructure Reuse

| Component | Location | Purpose |
|-----------|----------|---------|
| Redis Client | `apps/api/src/lib/redis.ts` | Singleton `ioredis` client |
| Entity Cache Pattern | `apps/api/src/services/entity-infrastructure.service.ts` | Existing `entity:metadata:*` caching |
| Formatter Service | `apps/api/src/services/backend-formatter.service.ts` | Metadata generation |

---

## Flow Diagrams

### Main Flow: Entity Endpoint Request

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Entity Endpoint Request                              │
│                    GET /api/v1/{entity} or GET /api/v1/{parent}/{id}/{child} │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
                       ┌───────────────────────────────┐
                       │     Check Redis Cache         │
                       │  Key: entity:fields:{entity}  │
                       └───────────────────────────────┘
                                       │
                       ┌───────────────┴───────────────┐
                       │                               │
                  CACHE HIT                       CACHE MISS
                       │                               │
                       ▼                               ▼
           ┌───────────────────┐           ┌───────────────────────┐
           │ Use cached        │           │ Execute SQL Query     │
           │ fieldNames        │           │                       │
           │                   │           │ Returns:              │
           │ Skip DB query     │           │ - rows: data[]        │
           │ for metadata      │           │ - fields: FieldInfo[] │
           └─────────┬─────────┘           └───────────┬───────────┘
                     │                                 │
                     │                     ┌───────────┴───────────┐
                     │                     │                       │
                     │                rows.length > 0        rows.length === 0
                     │                     │                       │
                     │                     ▼                       ▼
                     │         ┌─────────────────────┐  ┌─────────────────────┐
                     │         │ Extract fieldNames  │  │ Extract fieldNames  │
                     │         │ from rows[0]        │  │ from result.fields  │
                     │         │                     │  │                     │
                     │         │ Object.keys(data[0])│  │ fields.map(f=>f.name)│
                     │         └─────────┬───────────┘  └─────────┬───────────┘
                     │                   │                        │
                     │                   └───────────┬────────────┘
                     │                               │
                     │                               ▼
                     │                   ┌─────────────────────────┐
                     │                   │   Hydrate Redis Cache   │
                     │                   │                         │
                     │                   │   SETEX entity:fields:  │
                     │                   │   {entity} 86400 [...]  │
                     │                   └─────────────┬───────────┘
                     │                                 │
                     └─────────────────┬───────────────┘
                                       │
                                       ▼
                       ┌───────────────────────────────┐
                       │  generateMetadataForComponents │
                       │                               │
                       │  Input: fieldNames[]          │
                       │  Output: EntityMetadata       │
                       └───────────────────────────────┘
                                       │
                                       ▼
                       ┌───────────────────────────────┐
                       │     Build API Response        │
                       │                               │
                       │  {                            │
                       │    data: rows,                │
                       │    fields: fieldNames,        │
                       │    metadata: EntityMetadata,  │
                       │    total, limit, offset       │
                       │  }                            │
                       └───────────────────────────────┘
                                       │
                                       ▼
                       ┌───────────────────────────────┐
                       │     Return Response           │
                       │  (Always includes metadata!)  │
                       └───────────────────────────────┘
```

### Sequence Diagram: Cache Miss with Empty Data

```
┌──────────┐     ┌─────────────────┐     ┌───────┐     ┌────────────┐
│  Client  │     │ Backend Service │     │ Redis │     │ PostgreSQL │
└────┬─────┘     └────────┬────────┘     └───┬───┘     └─────┬──────┘
     │                    │                  │               │
     │ GET /project/123/task                 │               │
     │───────────────────>│                  │               │
     │                    │                  │               │
     │                    │ GET entity:fields:task           │
     │                    │─────────────────>│               │
     │                    │                  │               │
     │                    │ null (CACHE MISS)│               │
     │                    │<─────────────────│               │
     │                    │                  │               │
     │                    │ SELECT * FROM task WHERE ...     │
     │                    │─────────────────────────────────>│
     │                    │                  │               │
     │                    │ { rows: [], fields: [{name:'id'},│
     │                    │   {name:'name'}, {name:'code'}]} │
     │                    │<─────────────────────────────────│
     │                    │                  │               │
     │                    │ Extract: fields.map(f => f.name) │
     │                    │──────┐           │               │
     │                    │      │           │               │
     │                    │<─────┘           │               │
     │                    │ ['id','name','code']             │
     │                    │                  │               │
     │                    │ SETEX entity:fields:task 86400   │
     │                    │   ['id','name','code']           │
     │                    │─────────────────>│               │
     │                    │                  │               │
     │                    │ OK               │               │
     │                    │<─────────────────│               │
     │                    │                  │               │
     │                    │ generateMetadataForComponents()  │
     │                    │──────┐           │               │
     │                    │      │           │               │
     │                    │<─────┘           │               │
     │                    │                  │               │
     │ { data: [], metadata: {...}, fields: [...] }         │
     │<───────────────────│                  │               │
     │                    │                  │               │
```

### Sequence Diagram: Cache Hit

```
┌──────────┐     ┌─────────────────┐     ┌───────┐     ┌────────────┐
│  Client  │     │ Backend Service │     │ Redis │     │ PostgreSQL │
└────┬─────┘     └────────┬────────┘     └───┬───┘     └─────┬──────┘
     │                    │                  │               │
     │ GET /project/456/task                 │               │
     │───────────────────>│                  │               │
     │                    │                  │               │
     │                    │ GET entity:fields:task           │
     │                    │─────────────────>│               │
     │                    │                  │               │
     │                    │ ['id','name','code','status'...] │
     │                    │<─────────────────│ (CACHE HIT)   │
     │                    │                  │               │
     │                    │ SELECT * FROM task WHERE ...     │
     │                    │─────────────────────────────────>│
     │                    │                  │               │
     │                    │ { rows: [...], fields: [...] }   │
     │                    │<─────────────────────────────────│
     │                    │                  │               │
     │                    │ Use cached fieldNames for        │
     │                    │ metadata (skip extraction)       │
     │                    │──────┐           │               │
     │                    │      │           │               │
     │                    │<─────┘           │               │
     │                    │                  │               │
     │ { data: [...], metadata: {...}, fields: [...] }      │
     │<───────────────────│                  │               │
     │                    │                  │               │
```

---

## Implementation Details

### 1. Redis Cache Functions

**Location**: `apps/api/src/services/backend-formatter.service.ts`

```typescript
import { getRedisClient } from '../lib/redis.js';

// Cache configuration
const FIELD_CACHE_PREFIX = 'entity:fields:';
const FIELD_CACHE_TTL = 86400; // 24 hours in seconds

/**
 * Get cached field names for an entity
 * @param entityCode - Entity type code (e.g., 'task', 'project')
 * @returns Cached field names or null if not cached
 */
async function getCachedFieldNames(entityCode: string): Promise<string[] | null> {
  try {
    const redis = getRedisClient();
    const cacheKey = `${FIELD_CACHE_PREFIX}${entityCode}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      console.log(`[FieldCache] HIT for ${entityCode}`);
      return JSON.parse(cached);
    }

    console.log(`[FieldCache] MISS for ${entityCode}`);
    return null;
  } catch (error) {
    console.warn(`[FieldCache] Redis read error for ${entityCode}:`, error);
    return null; // Graceful degradation
  }
}

/**
 * Cache field names for an entity
 * @param entityCode - Entity type code
 * @param fieldNames - Array of field names to cache
 */
async function cacheFieldNames(entityCode: string, fieldNames: string[]): Promise<void> {
  try {
    const redis = getRedisClient();
    const cacheKey = `${FIELD_CACHE_PREFIX}${entityCode}`;
    await redis.setex(cacheKey, FIELD_CACHE_TTL, JSON.stringify(fieldNames));
    console.log(`[FieldCache] Cached ${fieldNames.length} fields for ${entityCode}`);
  } catch (error) {
    console.warn(`[FieldCache] Redis write error for ${entityCode}:`, error);
    // Non-critical - continue without caching
  }
}

/**
 * Invalidate field cache for an entity
 * Call this when entity schema changes (DDL updates, migrations)
 */
export async function invalidateFieldCache(entityCode: string): Promise<void> {
  try {
    const redis = getRedisClient();
    const cacheKey = `${FIELD_CACHE_PREFIX}${entityCode}`;
    await redis.del(cacheKey);
    console.log(`[FieldCache] Invalidated cache for ${entityCode}`);
  } catch (error) {
    console.warn(`[FieldCache] Invalidation error for ${entityCode}:`, error);
  }
}

/**
 * Clear all entity field caches
 * Useful for bulk schema updates or maintenance
 */
export async function clearAllFieldCache(): Promise<void> {
  try {
    const redis = getRedisClient();
    const pattern = `${FIELD_CACHE_PREFIX}*`;
    const keys = await redis.keys(pattern);

    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`[FieldCache] Cleared ${keys.length} cache entries`);
    }
  } catch (error) {
    console.warn('[FieldCache] Clear all error:', error);
  }
}
```

### 2. Updated generateEntityResponse Function

```typescript
/**
 * Generate complete entity response with cached metadata support
 *
 * Flow:
 * 1. Check Redis cache for field names
 * 2. If cache hit: use cached field names
 * 3. If cache miss: extract from data or result.fields
 * 4. Hydrate cache with field names
 * 5. Generate metadata
 */
export async function generateEntityResponse(
  entityCode: string,
  data: any[],
  options: {
    components?: ComponentName[];
    total?: number;
    limit?: number;
    offset?: number;
    resultFields?: Array<{ name: string }>; // PGresult fields for empty data
  } = {}
): Promise<EntityResponse> {
  const {
    components = ['entityListOfInstancesTable', 'entityInstanceFormContainer', 'kanbanView'],
    total = data.length,
    limit = 20,
    offset = 0,
    resultFields = []
  } = options;

  let fieldNames: string[];

  // Step 1: Check Redis cache
  const cachedFields = await getCachedFieldNames(entityCode);

  if (cachedFields) {
    // Cache hit - use cached field names
    fieldNames = cachedFields;
  } else {
    // Cache miss - extract field names
    if (data.length > 0) {
      // Extract from first data row
      fieldNames = Object.keys(data[0]);
    } else if (resultFields.length > 0) {
      // Extract from PGresult fields (empty data case)
      fieldNames = resultFields.map(f => f.name);
    } else {
      // Fallback - no fields available
      fieldNames = [];
    }

    // Hydrate cache (only if we have field names)
    if (fieldNames.length > 0) {
      await cacheFieldNames(entityCode, fieldNames);
    }
  }

  // Step 2: Generate metadata
  const metadata = generateMetadataForComponents(fieldNames, components, entityCode);

  return {
    data,
    fields: fieldNames,
    metadata,
    total,
    limit,
    offset
  };
}
```

### 3. Route Handler Updates

**Example: child-entity-route-factory.ts**

```typescript
// Before (problematic)
const data = await db.execute(sql`SELECT * FROM app.${sql.raw(childTable)} ...`);
return {
  data,
  total: Number(countResult[0]?.total || 0),
  page,
  limit
};

// After (with metadata caching)
import { client } from '@/db/index.js'; // Use raw pg client for field access
import { generateEntityResponse } from '../services/backend-formatter.service.js';

// Execute query with raw client to access result.fields
const result = await client.query({
  text: `SELECT c.* FROM app.${childTable} c ... LIMIT $1 OFFSET $2`,
  values: [limit, offset]
});

// Generate response with result.fields for empty data fallback
const response = await generateEntityResponse(childEntity, result.rows, {
  total: Number(countResult[0]?.total || 0),
  limit,
  offset,
  resultFields: result.fields // PGresult field descriptors
});

return response;
```

### 4. Accessing PGresult Fields with Different Clients

**Using `postgres` (postgres.js) - Current PMO Setup**

```typescript
import { client } from '@/db/index.js';

// postgres.js returns result with columns property
const result = await client.unsafe(
  `SELECT * FROM app.task WHERE active_flag = true LIMIT 10`
);

// Access column metadata
// Note: postgres.js uses 'columns' not 'fields'
const fieldNames = result.columns?.map(col => col.name) || [];
```

**Using `pg` (node-postgres)**

```typescript
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const result = await pool.query('SELECT * FROM app.task WHERE active_flag = true');

// result.fields contains column metadata
const fieldNames = result.fields.map(f => f.name);

// Additional metadata available:
result.fields.forEach(field => {
  console.log({
    name: field.name,           // Column name
    dataTypeID: field.dataTypeID, // PostgreSQL OID
    tableID: field.tableID,     // Table OID
    columnID: field.columnID,   // Column position
  });
});
```

---

## Cache Configuration

### Redis Key Structure

| Key Pattern | Value | TTL | Purpose |
|-------------|-------|-----|---------|
| `entity:fields:{entityCode}` | `["id","name","code",...]` | 24h | Field names for metadata generation |
| `entity:metadata:{entityCode}` | `{code,name,ui_label,...}` | 5m | Entity type metadata (existing) |

### TTL Rationale

| Cache | TTL | Reasoning |
|-------|-----|-----------|
| Field Names | 24 hours | Schema changes are rare, deployed via DDL migrations |
| Entity Metadata | 5 minutes | UI labels, icons may change more frequently |

### Environment Variables

```bash
# Redis connection (used by existing redis.ts)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=           # Optional
REDIS_DB=0
```

---

## API Response Structure

### With Data (Cache Population)

```json
{
  "data": [
    {
      "id": "uuid-1",
      "name": "Task 1",
      "code": "TASK-001",
      "dl__task_status": "in_progress"
    }
  ],
  "fields": ["id", "name", "code", "dl__task_status", "..."],
  "metadata": {
    "entityListOfInstancesTable": {
      "viewType": {
        "name": { "dtype": "str", "label": "Name", "renderType": "text" },
        "dl__task_status": { "dtype": "str", "label": "Status", "renderType": "badge" }
      },
      "editType": {
        "name": { "dtype": "str", "label": "Name", "inputType": "text" },
        "dl__task_status": { "inputType": "BadgeDropdownSelect", "datalabelKey": "task_status" }
      }
    }
  },
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

### Empty Data (Cache Hit or PGresult Fallback)

```json
{
  "data": [],
  "fields": ["id", "name", "code", "dl__task_status", "..."],
  "metadata": {
    "entityListOfInstancesTable": {
      "viewType": {
        "name": { "dtype": "str", "label": "Name", "renderType": "text" },
        "dl__task_status": { "dtype": "str", "label": "Status", "renderType": "badge" }
      },
      "editType": {
        "name": { "dtype": "str", "label": "Name", "inputType": "text" },
        "dl__task_status": { "inputType": "BadgeDropdownSelect", "datalabelKey": "task_status" }
      }
    }
  },
  "total": 0,
  "limit": 20,
  "offset": 0
}
```

**Key Point**: Both responses have identical `fields` and `metadata` structure. The frontend can always render columns regardless of data presence.

---

## Error Handling

### Graceful Degradation

```typescript
async function getCachedFieldNames(entityCode: string): Promise<string[] | null> {
  try {
    const redis = getRedisClient();
    const cached = await redis.get(`entity:fields:${entityCode}`);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    // Redis unavailable - continue without cache
    console.warn(`[FieldCache] Redis error, falling back to direct extraction:`, error);
    return null;
  }
}
```

### Fallback Chain

```
1. Redis Cache       → Success: Use cached fields
       ↓ (fail/miss)
2. Data Row [0]      → Success: Extract + cache
       ↓ (empty)
3. PGresult Fields   → Success: Extract + cache
       ↓ (unavailable)
4. Empty Array       → Last resort: No columns (current behavior)
```

### Redis Connection Failures

| Scenario | Behavior |
|----------|----------|
| Redis unavailable | Log warning, proceed without cache |
| Cache read error | Return null, fall through to extraction |
| Cache write error | Log warning, response still works |
| Invalid cached data | Return null, re-extract and re-cache |

---

## Cache Invalidation

### When to Invalidate

| Event | Action |
|-------|--------|
| DDL migration | `clearAllFieldCache()` |
| Schema change via API | `invalidateFieldCache(entityCode)` |
| Entity table update | `invalidateFieldCache(entityCode)` |
| Manual maintenance | `clearAllFieldCache()` |

### Invalidation Triggers

```typescript
// In entity configuration endpoints
fastify.put('/api/v1/entity/:code/configure', async (request, reply) => {
  // ... update entity schema ...

  // Invalidate field cache for this entity
  await invalidateFieldCache(code);

  // Also invalidate entity metadata cache
  await entityInfra.invalidate_entity_cache(code);

  return { success: true };
});
```

### CLI/Maintenance Commands

```typescript
// Clear all caches (for deployment/maintenance)
import { clearAllFieldCache } from './services/backend-formatter.service.js';
import { getEntityInfrastructure } from './services/entity-infrastructure.service.js';

async function clearAllCaches() {
  await clearAllFieldCache();
  await getEntityInfrastructure(db).clear_all_entity_cache();
  console.log('All entity caches cleared');
}
```

---

## Related Documentation

| Document | Path | Description |
|----------|------|-------------|
| Backend Formatter Service | `docs/services/backend-formatter.service.md` | Metadata generation patterns |
| Entity Infrastructure Service | `docs/services/entity-infrastructure.service.md` | Entity CRUD + existing cache |
| State Management | `docs/state_management/STATE_MANAGEMENT.md` | Frontend TanStack Query + Dexie |
| Redis Setup | `apps/api/src/lib/redis.ts` | ioredis client configuration |
| RBAC Infrastructure | `docs/rbac/RBAC_INFRASTRUCTURE.md` | Permission system |

---

## Appendix: PostgreSQL Field Descriptor Reference

### PGresult Field Properties

```typescript
interface FieldInfo {
  name: string;           // Column name
  tableID: number;        // OID of source table (0 if computed)
  columnID: number;       // Attribute number in table
  dataTypeID: number;     // PostgreSQL type OID
  dataTypeSize: number;   // Size of type (-1 for variable)
  dataTypeModifier: number; // Type modifier (e.g., varchar length)
  format: string;         // 'text' or 'binary'
}
```

### Common PostgreSQL Type OIDs

| OID | Type | Example Field Pattern |
|-----|------|----------------------|
| 2950 | uuid | `id`, `*_id` |
| 1043 | varchar | `name`, `code`, `descr` |
| 25 | text | `descr`, `content` |
| 16 | boolean | `is_*`, `*_flag` |
| 1184 | timestamptz | `*_ts`, `created_ts` |
| 1082 | date | `*_date` |
| 23 | int4 | `*_count`, `version` |
| 701 | float8 | `*_amt`, `*_pct` |
| 3802 | jsonb | `metadata`, `tags` |

---

**Document Version**: 1.0.0
**Author**: Claude (AI Assistant)
**Review Status**: Pending Implementation
