# Entity Endpoint Metadata Caching

> Complete end-to-end architecture for API metadata caching with Redis, `content=metadata` API parameter, and PostgreSQL column descriptor fallback

**Version**: 3.0.0
**Last Updated**: 2025-11-30
**Status**: Production Ready

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [End-to-End Data Flow](#end-to-end-data-flow)
3. [API Request Modes](#api-request-modes)
4. [Logic Flow](#logic-flow)
5. [Sequence Diagrams](#sequence-diagrams)
6. [Use Case Matrix](#use-case-matrix)
7. [Implementation Details](#implementation-details)
8. [Cache Configuration](#cache-configuration)
9. [Response Structure](#response-structure)
10. [Cache Invalidation](#cache-invalidation)
11. [Error Handling](#error-handling)

---

## Architecture Overview

### System Design Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         API Request Flow                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  GET /api/v1/project              GET /api/v1/project?content=metadata       │
│         │                                      │                             │
│         ▼                                      ▼                             │
│  ┌─────────────┐                      ┌─────────────────┐                   │
│  │ NORMAL MODE │                      │ METADATA MODE   │                   │
│  └──────┬──────┘                      └────────┬────────┘                   │
│         │                                      │                             │
│         ▼                                      ▼                             │
│  ┌─────────────────┐               ┌─────────────────────┐                  │
│  │ Query PostgreSQL│               │ Check Redis Cache   │                  │
│  │ (full data)     │               │ Key: api:metadata:  │                  │
│  └────────┬────────┘               │ /api/v1/project?    │                  │
│           │                        │ content=metadata    │                  │
│           ▼                        └─────────┬───────────┘                  │
│  ┌─────────────────┐                    ┌────┴────┐                         │
│  │ Build ref_data  │                    │         │                         │
│  │ entityInstance  │                  HIT       MISS                        │
│  └────────┬────────┘                    │         │                         │
│           │                             ▼         ▼                         │
│           ▼                      ┌──────────┐  ┌────────────────┐           │
│  ┌─────────────────┐             │ Return   │  │ Query Postgres │           │
│  │ Return:         │             │ cached   │  │ WHERE 1=0      │           │
│  │ • data: [rows]  │             │ response │  │ (get columns)  │           │
│  │ • fields: []    │             └──────────┘  └───────┬────────┘           │
│  │ • metadata: {}  │                                   │                    │
│  │ • ref_data: {}  │                                   ▼                    │
│  └─────────────────┘                          ┌────────────────┐            │
│                                               │ Generate       │            │
│                                               │ metadata from  │            │
│                                               │ YAML patterns  │            │
│                                               └───────┬────────┘            │
│                                                       │                     │
│                                                       ▼                     │
│                                               ┌────────────────┐            │
│                                               │ Cache in Redis │            │
│                                               │ TTL: 24 hours  │            │
│                                               └───────┬────────┘            │
│                                                       │                     │
│                                                       ▼                     │
│                                               ┌────────────────┐            │
│                                               │ Return:        │            │
│                                               │ • data: []     │            │
│                                               │ • fields: [21] │            │
│                                               │ • metadata: {} │            │
│                                               │ • ref_data: {} │            │
│                                               └────────────────┘            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Stack

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  TanStack Query                    Dexie (IndexedDB)                        │
│  ─────────────────                 ─────────────────                        │
│  • useEntityMetadata hook          • entityInstanceMetadata table           │
│  • 30-min staleTime               • Offline-first cache                     │
│  • queryKey: ['entityInstance     • Survives browser restart               │
│    Metadata', entityCode]                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND API                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Route Handler                     Backend Formatter Service                 │
│  ─────────────────                 ───────────────────────                  │
│  • Parse content=metadata          • generateEntityResponse()               │
│  • Route to correct mode           • generateMetadataForComponents()        │
│  • Execute data or metadata query  • YAML pattern matching                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                         ┌────────────┴────────────┐
                         ▼                         ▼
┌─────────────────────────────────┐  ┌─────────────────────────────────┐
│           REDIS                 │  │         POSTGRESQL               │
├─────────────────────────────────┤  ├─────────────────────────────────┤
│  Metadata Response Cache        │  │  Entity Tables                  │
│  ─────────────────────────      │  │  ─────────────                  │
│  • Key: api:metadata:/api/...   │  │  • Full entity data             │
│  • TTL: 86400s (24h)            │  │  • postgres.js columns property │
│  • JSON serialized response     │  │  • WHERE 1=0 for schema-only    │
│                                 │  │                                 │
│  Field Name Cache               │  │                                 │
│  ─────────────────              │  │                                 │
│  • Key: entity:fields:{code}    │  │                                 │
│  • TTL: 86400s (24h)            │  │                                 │
│  • JSON array of field names    │  │                                 │
└─────────────────────────────────┘  └─────────────────────────────────┘
```

---

## End-to-End Data Flow

### Normal Mode (Data Request)

```
┌──────────┐     ┌─────────────────┐     ┌───────────┐     ┌────────────┐
│  Client  │     │  Route Handler  │     │  Entity   │     │ PostgreSQL │
│          │     │                 │     │  Infra    │     │            │
└────┬─────┘     └────────┬────────┘     └─────┬─────┘     └─────┬──────┘
     │                    │                    │                  │
     │ GET /api/v1/project                     │                  │
     │───────────────────>│                    │                  │
     │                    │                    │                  │
     │                    │ Query data         │                  │
     │                    │────────────────────────────────────────>
     │                    │                    │                  │
     │                    │                    │     [rows]       │
     │                    │<────────────────────────────────────────
     │                    │                    │                  │
     │                    │ build_ref_data_entityInstance(rows)   │
     │                    │───────────────────>│                  │
     │                    │                    │                  │
     │                    │     ref_data_entityInstance           │
     │                    │<───────────────────│                  │
     │                    │                    │                  │
     │ { data, ref_data_entityInstance, fields: [], metadata: {} }│
     │<───────────────────│                    │                  │
```

### Metadata Mode (content=metadata)

```
┌──────────┐     ┌─────────────────┐     ┌───────────┐     ┌────────────┐
│  Client  │     │  Route Handler  │     │   Redis   │     │ PostgreSQL │
│          │     │                 │     │           │     │            │
└────┬─────┘     └────────┬────────┘     └─────┬─────┘     └─────┬──────┘
     │                    │                    │                  │
     │ GET /api/v1/project?content=metadata    │                  │
     │───────────────────>│                    │                  │
     │                    │                    │                  │
     │                    │ GET api:metadata:/api/v1/project...   │
     │                    │───────────────────>│                  │
     │                    │                    │                  │
     │                    │     CACHE HIT      │                  │
     │                    │<───────────────────│                  │
     │                    │                    │                  │
     │ { data: [], fields: [...], metadata: {...}, ref_data: {} } │
     │<───────────────────│                    │                  │
```

### Metadata Mode (Cache Miss)

```
┌──────────┐     ┌─────────────────┐     ┌───────────┐     ┌────────────┐
│  Client  │     │ Backend Format  │     │   Redis   │     │ PostgreSQL │
│          │     │    Service      │     │           │     │            │
└────┬─────┘     └────────┬────────┘     └─────┬─────┘     └─────┬──────┘
     │                    │                    │                  │
     │ GET /api/v1/project?content=metadata    │                  │
     │───────────────────>│                    │                  │
     │                    │                    │                  │
     │                    │ GET api:metadata:...                  │
     │                    │───────────────────>│                  │
     │                    │     CACHE MISS     │                  │
     │                    │<───────────────────│                  │
     │                    │                    │                  │
     │                    │ SELECT * FROM table WHERE 1=0        │
     │                    │─────────────────────────────────────>│
     │                    │                    │                  │
     │                    │     { rows: [], columns: [...] }     │
     │                    │<─────────────────────────────────────│
     │                    │                    │                  │
     │                    │ generateMetadataForComponents()      │
     │                    │──────┐             │                  │
     │                    │      │ YAML        │                  │
     │                    │<─────┘ patterns    │                  │
     │                    │                    │                  │
     │                    │ SETEX api:metadata:... 86400 {...}   │
     │                    │───────────────────>│                  │
     │                    │                    │                  │
     │ { data: [], fields: [...], metadata: {...}, ref_data: {} } │
     │<───────────────────│                    │                  │
```

---

## API Request Modes

### Request Routing Logic

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REQUEST ROUTING                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  GET /api/v1/{entity}?content=X&...                                         │
│                  │                                                           │
│                  ▼                                                           │
│         ┌───────────────────┐                                               │
│         │ Parse content     │                                               │
│         │ query parameter   │                                               │
│         └─────────┬─────────┘                                               │
│                   │                                                          │
│         ┌─────────┴─────────┐                                               │
│         │                   │                                               │
│   content=metadata    content=undefined (or 'data')                         │
│         │                   │                                               │
│         ▼                   ▼                                               │
│  ┌──────────────┐    ┌──────────────┐                                       │
│  │ METADATA     │    │ DATA MODE    │                                       │
│  │ MODE         │    │              │                                       │
│  └──────┬───────┘    └──────┬───────┘                                       │
│         │                   │                                               │
│         ▼                   ▼                                               │
│  • Check Redis cache  • Execute PostgreSQL query                            │
│  • Query WHERE 1=0    • Build ref_data_entityInstance                       │
│  • Generate metadata  • Return data + ref_data                              │
│  • Cache response     • NO metadata (use content=metadata)                  │
│  • Return metadata    • NO fields (use content=metadata)                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Logic Flow

### Step-by-Step Processing

| Step | Normal Mode | Metadata Mode |
|------|-------------|---------------|
| 1 | Parse query parameters | Parse query parameters |
| 2 | Check RBAC permissions | Check Redis cache: `api:metadata:/api/v1/{entity}?content=metadata` |
| 3 | Execute PostgreSQL data query | **Cache HIT**: Return cached JSON immediately |
| 4 | Build `ref_data_entityInstance` | **Cache MISS**: Query PostgreSQL with `WHERE 1=0` |
| 5 | Return `{ data, ref_data_entityInstance }` | Extract column names from postgres.js `columns` |
| 6 | - | Generate metadata via YAML pattern matching |
| 7 | - | Cache response with 24h TTL |
| 8 | - | Return `{ data: [], fields, metadata }` |

### Decision Tree

```
Request arrives at /api/v1/{entity}
│
├── Is content=metadata?
│   ├── YES → Metadata Mode
│   │   │
│   │   ├── Check Redis cache
│   │   │   ├── HIT → Return cached response (0 DB queries)
│   │   │   │
│   │   │   └── MISS → Query WHERE 1=0
│   │   │       ├── Extract columns from postgres.js result
│   │   │       ├── Generate metadata from YAML patterns
│   │   │       ├── Cache response (24h TTL)
│   │   │       └── Return { data: [], fields, metadata }
│   │   │
│   └── NO → Data Mode
│       │
│       ├── Execute full PostgreSQL query
│       ├── Build ref_data_entityInstance
│       └── Return { data, ref_data_entityInstance, fields: [], metadata: {} }
```

---

## Sequence Diagrams

### Frontend useEntityMetadata Hook

```
┌──────────────┐     ┌─────────────────┐     ┌───────────┐     ┌─────────────┐
│   Component  │     │ TanStack Query  │     │   Dexie   │     │   API       │
└──────┬───────┘     └────────┬────────┘     └─────┬─────┘     └──────┬──────┘
       │                      │                    │                  │
       │ useEntityMetadata('project')              │                  │
       │─────────────────────>│                    │                  │
       │                      │                    │                  │
       │                      │ Check Dexie cache  │                  │
       │                      │───────────────────>│                  │
       │                      │                    │                  │
       │                      │     entityInstanceMetadata['project'] │
       │                      │<───────────────────│                  │
       │                      │                    │                  │
       │                      │ Is stale? (>30 min)│                  │
       │                      │──────┐             │                  │
       │                      │      │ check       │                  │
       │                      │<─────┘ syncedAt    │                  │
       │                      │                    │                  │
       │                      │ GET /api/v1/project?content=metadata  │
       │                      │────────────────────────────────────────>
       │                      │                    │                  │
       │                      │     { fields, metadata, viewType, editType }
       │                      │<────────────────────────────────────────
       │                      │                    │                  │
       │                      │ Update Dexie cache │                  │
       │                      │───────────────────>│                  │
       │                      │                    │                  │
       │ { fields, viewType, editType }            │                  │
       │<─────────────────────│                    │                  │
```

### Cache Miss with Empty Child Entity Tab

```
┌──────────┐     ┌─────────────────┐     ┌───────────┐     ┌────────────┐
│  Client  │     │ Backend Service │     │   Redis   │     │ PostgreSQL │
└────┬─────┘     └────────┬────────┘     └─────┬─────┘     └─────┬──────┘
     │                    │                    │                  │
     │ GET /project/123/task?content=metadata  │                  │
     │───────────────────>│                    │                  │
     │                    │                    │                  │
     │                    │ GET api:metadata:/api/v1/project/123/task...
     │                    │───────────────────>│                  │
     │                    │                    │                  │
     │                    │ null (CACHE MISS)  │                  │
     │                    │<───────────────────│                  │
     │                    │                    │                  │
     │                    │ SELECT * FROM task WHERE 1=0          │
     │                    │─────────────────────────────────────>│
     │                    │                    │                  │
     │                    │     { rows: [], columns: [           │
     │                    │       {name:'id'}, {name:'name'},    │
     │                    │       {name:'dl__task_status'}...]}  │
     │                    │<─────────────────────────────────────│
     │                    │                    │                  │
     │                    │ generateMetadataForComponents(       │
     │                    │   ['id','name','dl__task_status'...],│
     │                    │   ['entityListOfInstancesTable',     │
     │                    │    'entityInstanceFormContainer'],   │
     │                    │   'task'                             │
     │                    │ )                  │                  │
     │                    │                    │                  │
     │                    │ SETEX api:metadata:... 86400 {...}   │
     │                    │───────────────────>│                  │
     │                    │                    │                  │
     │ { data: [], fields: ['id','name','dl__task_status',...],  │
     │   metadata: { entityListOfInstancesTable: {...} }, ... }  │
     │<───────────────────│                    │                  │
```

---

## Use Case Matrix

### Request Handling Matrix

| Use Case | URL | Mode | Redis Key | DB Query | Response |
|----------|-----|------|-----------|----------|----------|
| List data | `/api/v1/project` | DATA | - | Full query | `{data: [...], ref_data: {...}}` |
| Get metadata only | `/api/v1/project?content=metadata` | META | `api:metadata:/api/v1/project?content=metadata` | None or `WHERE 1=0` | `{data: [], fields: [...], metadata: {...}}` |
| Child entity list | `/api/v1/project/123/task` | DATA | - | Full query with parent filter | `{data: [...], ref_data: {...}}` |
| Empty child tab | `/api/v1/project/123/task?content=metadata` | META | `api:metadata:/api/v1/project/123/task?content=metadata` | None or `WHERE 1=0` | `{data: [], fields: [...], metadata: {...}}` |
| Paginated list | `/api/v1/project?limit=20&offset=40` | DATA | - | Full query with LIMIT/OFFSET | `{data: [...], ref_data: {...}, total, limit, offset}` |

### Response Field Matrix

| Field | Normal Mode | Metadata Mode |
|-------|-------------|---------------|
| `data` | `[{...}, {...}]` (entity rows) | `[]` (empty array) |
| `fields` | `[]` (empty) | `["id", "name", "code", ...]` |
| `metadata` | `{}` (empty) | `{entityListOfInstancesTable: {viewType, editType}}` |
| `ref_data_entityInstance` | `{employee: {...}, business: {...}}` | `{}` (empty) |
| `total` | `100` (actual count) | `0` |
| `limit` | `20` (page size) | `0` |
| `offset` | `0` (page offset) | `0` |

### Cache Behavior Matrix

| Scenario | Redis Action | DB Query | Response Time |
|----------|--------------|----------|---------------|
| Metadata: Cache HIT | Read & return | None | ~5-10ms |
| Metadata: Cache MISS | Read, generate, write | `WHERE 1=0` (~1ms) | ~50-100ms |
| Data: Always | No Redis | Full query | ~100-500ms |
| Redis unavailable | Skip cache | `WHERE 1=0` | ~50-100ms |

---

## Implementation Details

### Route Handler Pattern

```typescript
// apps/api/src/modules/{entity}/routes.ts

fastify.get('/api/v1/project', async (request, reply) => {
  const { content, view, limit = 20, offset = 0, ...filters } = request.query;
  const userId = request.user.sub;

  // ═══════════════════════════════════════════════════════════════
  // METADATA-ONLY MODE: Return fields + metadata, data = []
  // ═══════════════════════════════════════════════════════════════
  if (content === 'metadata') {
    const cacheKey = `/api/v1/project?content=metadata`;

    // Check Redis cache first
    const cached = await getCachedMetadataResponse(cacheKey);
    if (cached) {
      return reply.send(cached);
    }

    // Cache miss - query for column names only (instant)
    const columnsResult = await client.unsafe(
      `SELECT * FROM app.project WHERE 1=0`
    );
    const resultFields = columnsResult.columns?.map((c: any) => ({ name: c.name })) || [];

    // Generate metadata from YAML patterns
    const response = await generateEntityResponse(ENTITY_CODE, [], {
      metadataOnly: true,
      resultFields
    });

    // Cache for 24 hours
    await cacheMetadataResponse(cacheKey, response);

    return reply.send(response);
  }

  // ═══════════════════════════════════════════════════════════════
  // NORMAL DATA MODE: Return data + ref_data (no metadata overhead)
  // ═══════════════════════════════════════════════════════════════
  const rbacCondition = await entityInfra.get_entity_rbac_where_condition(
    userId, ENTITY_CODE, Permission.VIEW, TABLE_ALIAS
  );

  const projects = await db.execute(sql`
    SELECT e.* FROM app.project e
    WHERE ${rbacCondition} AND e.active_flag = true
    ORDER BY e.created_ts DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  // Build entity reference lookup table
  const ref_data_entityInstance = await entityInfra.build_ref_data_entityInstance(
    Array.from(projects)
  );

  // Generate response with data only (no metadata)
  const response = await generateEntityResponse(ENTITY_CODE, Array.from(projects), {
    total: count,
    limit,
    offset,
    ref_data_entityInstance
  });

  return reply.send(response);
});
```

### Backend Formatter Service Functions

```typescript
// apps/api/src/services/backend-formatter.service.ts

// ═══════════════════════════════════════════════════════════════
// REDIS METADATA RESPONSE CACHE
// ═══════════════════════════════════════════════════════════════

const METADATA_CACHE_PREFIX = 'api:metadata:';
const METADATA_CACHE_TTL = 86400; // 24 hours

export async function getCachedMetadataResponse(apiPath: string): Promise<EntityResponse | null> {
  try {
    const redis = getRedisClient();
    const cacheKey = `${METADATA_CACHE_PREFIX}${apiPath}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log(`[MetadataCache] HIT for ${apiPath}`);
      return JSON.parse(cached);
    }
    console.log(`[MetadataCache] MISS for ${apiPath}`);
    return null;
  } catch (error) {
    console.warn(`[MetadataCache] Redis read error:`, error);
    return null;
  }
}

export async function cacheMetadataResponse(apiPath: string, response: EntityResponse): Promise<void> {
  try {
    const redis = getRedisClient();
    const cacheKey = `${METADATA_CACHE_PREFIX}${apiPath}`;
    await redis.setex(cacheKey, METADATA_CACHE_TTL, JSON.stringify(response));
    console.log(`[MetadataCache] Cached response for ${apiPath}`);
  } catch (error) {
    console.warn(`[MetadataCache] Redis write error:`, error);
  }
}

// ═══════════════════════════════════════════════════════════════
// GENERATE ENTITY RESPONSE
// ═══════════════════════════════════════════════════════════════

export async function generateEntityResponse(
  entityCode: string,
  data: any[],
  options: {
    components?: ComponentName[];
    total?: number;
    limit?: number;
    offset?: number;
    resultFields?: Array<{ name: string }>;
    metadataOnly?: boolean;
    ref_data_entityInstance?: Record<string, Record<string, string>>;
  } = {}
): Promise<EntityResponse & { ref_data_entityInstance: Record<string, Record<string, string>> }> {

  // METADATA-ONLY MODE
  if (options.metadataOnly) {
    const fieldNames = options.resultFields?.map(f => f.name) || [];
    const metadata = generateMetadataForComponents(fieldNames, options.components, entityCode);

    return {
      data: [],
      fields: fieldNames,
      metadata,
      ref_data_entityInstance: {},
      total: 0,
      limit: 0,
      offset: 0
    };
  }

  // NORMAL DATA MODE - return data + ref_data only
  return {
    data,
    fields: [],
    metadata: {},
    ref_data_entityInstance: options.ref_data_entityInstance || {},
    total: options.total || data.length,
    limit: options.limit || 20,
    offset: options.offset || 0
  };
}
```

### Frontend Hook Pattern

```typescript
// apps/web/src/db/tanstack-hooks/useEntityList.ts

export function useEntityMetadata(entityCode: string) {
  return useQuery({
    queryKey: ['entityInstanceMetadata', entityCode],
    queryFn: async () => {
      // Check Dexie cache first (offline-first)
      const cached = await db.entityInstanceMetadata.get(entityCode);
      if (cached && Date.now() - cached.syncedAt < 30 * 60 * 1000) {
        return cached;
      }

      // Fetch metadata-only from API (no data transferred)
      const response = await apiClient.get(`/api/v1/${entityCode}`, {
        params: { content: 'metadata' }
      });

      // Store in Dexie cache
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
    staleTime: 30 * 60 * 1000,  // 30-minute TTL
  });
}
```

---

## Cache Configuration

### Redis Key Structure

| Key Pattern | Example | Value | TTL |
|-------------|---------|-------|-----|
| `api:metadata:{path}` | `api:metadata:/api/v1/project?content=metadata` | Full JSON response | 24h |
| `entity:fields:{code}` | `entity:fields:project` | `["id","name","code",...]` | 24h |
| `entity:metadata:{code}` | `entity:metadata:project` | Entity type metadata | 5m |

### Cache Key Generation

```typescript
// Metadata response cache key
const cacheKey = `api:metadata:${request.url}`;
// Example: api:metadata:/api/v1/project?content=metadata

// Field name cache key
const cacheKey = `entity:fields:${entityCode}`;
// Example: entity:fields:project
```

### TTL Rationale

| Cache | TTL | Reasoning |
|-------|-----|-----------|
| Metadata response | 24 hours | Schema changes are rare, deployed via DDL migrations |
| Field names | 24 hours | Column names don't change without DDL |
| Entity type metadata | 5 minutes | UI labels, icons may change more frequently |

---

## Response Structure

### Metadata Mode Response

```json
{
  "data": [],
  "fields": ["id", "name", "code", "budget_allocated_amt", "dl__project_stage", "manager__employee_id"],
  "ref_data_entityInstance": {},
  "metadata": {
    "entityListOfInstancesTable": {
      "viewType": {
        "id": {
          "dtype": "uuid",
          "label": "Id",
          "renderType": "text",
          "behavior": { "visible": false, "sortable": false, "filterable": false }
        },
        "name": {
          "dtype": "str",
          "label": "Name",
          "renderType": "text",
          "behavior": { "visible": true, "sortable": true, "filterable": true, "searchable": true }
        },
        "budget_allocated_amt": {
          "dtype": "float",
          "label": "Budget Allocated",
          "renderType": "currency",
          "behavior": { "visible": true, "sortable": true },
          "style": { "symbol": "$", "decimals": 2, "align": "right" }
        },
        "dl__project_stage": {
          "dtype": "str",
          "label": "Project Stage",
          "renderType": "badge",
          "behavior": { "visible": true, "filterable": true }
        },
        "manager__employee_id": {
          "dtype": "uuid",
          "label": "Manager Employee Name",
          "renderType": "entityInstanceId",
          "lookupEntity": "employee",
          "behavior": { "visible": true, "filterable": true }
        }
      },
      "editType": {
        "name": {
          "dtype": "str",
          "label": "Name",
          "inputType": "text",
          "behavior": { "editable": true }
        },
        "budget_allocated_amt": {
          "dtype": "float",
          "label": "Budget Allocated",
          "inputType": "number",
          "behavior": { "editable": true },
          "validation": { "min": 0 }
        },
        "dl__project_stage": {
          "dtype": "str",
          "label": "Project Stage",
          "inputType": "component",
          "component": "BadgeDropdownSelect",
          "lookupSourceTable": "datalabel",
          "lookupField": "dl__project_stage",
          "behavior": { "editable": true }
        },
        "manager__employee_id": {
          "dtype": "uuid",
          "label": "Manager Employee Name",
          "inputType": "entityInstanceId",
          "lookupSourceTable": "entityInstance",
          "lookupEntity": "employee",
          "behavior": { "editable": true }
        }
      }
    }
  },
  "total": 0,
  "limit": 0,
  "offset": 0
}
```

### Normal Mode Response

```json
{
  "data": [
    {
      "id": "uuid-123",
      "name": "Kitchen Renovation",
      "code": "PROJ-001",
      "budget_allocated_amt": 50000,
      "dl__project_stage": "planning",
      "manager__employee_id": "uuid-james"
    }
  ],
  "fields": [],
  "ref_data_entityInstance": {
    "employee": {
      "uuid-james": "James Miller"
    }
  },
  "metadata": {},
  "total": 100,
  "limit": 20,
  "offset": 0
}
```

---

## Cache Invalidation

### When to Invalidate

| Event | Action | Function |
|-------|--------|----------|
| DDL migration (schema change) | Clear all metadata cache | `clearAllMetadataCache()` |
| YAML mapping update | Clear all metadata cache | `clearAllMetadataCache()` |
| Entity configuration change | Invalidate specific entity | `invalidateMetadataCache(entityCode)` |
| Column added/removed | Invalidate specific entity | `invalidateMetadataCache(entityCode)` + `invalidateFieldCache(entityCode)` |

### Invalidation Functions

```typescript
// apps/api/src/services/backend-formatter.service.ts

// Invalidate metadata cache for specific entity
export async function invalidateMetadataCache(entityCode: string): Promise<void> {
  try {
    const redis = getRedisClient();
    const pattern = `${METADATA_CACHE_PREFIX}/api/v1/${entityCode}*`;
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`[MetadataCache] Invalidated ${keys.length} entries for ${entityCode}`);
    }
  } catch (error) {
    console.warn(`[MetadataCache] Invalidation error:`, error);
  }
}

// Clear all metadata caches
export async function clearAllMetadataCache(): Promise<void> {
  try {
    const redis = getRedisClient();
    const pattern = `${METADATA_CACHE_PREFIX}*`;
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`[MetadataCache] Cleared ${keys.length} entries`);
    }
  } catch (error) {
    console.warn('[MetadataCache] Clear all error:', error);
  }
}

// Invalidate field name cache
export async function invalidateFieldCache(entityCode: string): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.del(`entity:fields:${entityCode}`);
    console.log(`[FieldCache] Invalidated cache for ${entityCode}`);
  } catch (error) {
    console.warn(`[FieldCache] Invalidation error:`, error);
  }
}

// Clear all field caches
export async function clearAllFieldCache(): Promise<void> {
  try {
    const redis = getRedisClient();
    const keys = await redis.keys('entity:fields:*');
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`[FieldCache] Cleared ${keys.length} entries`);
    }
  } catch (error) {
    console.warn('[FieldCache] Clear all error:', error);
  }
}
```

### CLI/Maintenance Commands

```bash
# Clear all caches after DDL migration
./tools/db-import.sh  # Automatically clears caches

# Manual cache clear via Redis CLI
redis-cli KEYS "api:metadata:*" | xargs redis-cli DEL
redis-cli KEYS "entity:fields:*" | xargs redis-cli DEL
```

---

## Error Handling

### Graceful Degradation

```
Redis Error Flow
────────────────

1. Redis unavailable → Continue without cache
2. Cache read error → Fall through to PostgreSQL
3. Cache write error → Response still returns correctly
4. Invalid cached data → Re-generate metadata

PostgreSQL Error Flow
─────────────────────

1. Query error → Return 500 with error message
2. Empty columns → Return empty metadata
3. Connection timeout → Return 503 Service Unavailable
```

### Error Handling Matrix

| Scenario | Redis | PostgreSQL | Behavior |
|----------|-------|------------|----------|
| Normal operation | Available | Available | Cache + query |
| Redis down | Unavailable | Available | Query only, no cache |
| PostgreSQL down | Available | Unavailable | Return cached (if HIT) or 503 |
| Both down | Unavailable | Unavailable | Return 503 |
| Invalid cache | Available | Available | Regenerate metadata |

### Code Pattern

```typescript
async function getCachedMetadataResponse(apiPath: string): Promise<EntityResponse | null> {
  try {
    const redis = getRedisClient();
    const cached = await redis.get(`api:metadata:${apiPath}`);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    // Redis unavailable - continue without cache
    console.warn(`[MetadataCache] Redis error, falling back:`, error);
    return null;
  }
}
```

---

## Performance Benefits

| Metric | Without Cache | With Cache (HIT) | Improvement |
|--------|---------------|------------------|-------------|
| DB Queries | 1 (`WHERE 1=0`) | 0 | 100% reduction |
| YAML Parsing | Yes | No | Eliminated |
| Metadata Generation | Yes | No | Eliminated |
| Response Time | ~50-100ms | ~5-10ms | 5-10x faster |
| Network Payload | Same | Same | N/A |

---

## Related Documentation

| Document | Path | Description |
|----------|------|-------------|
| Backend Formatter Service | `docs/services/backend-formatter.service.md` | Metadata generation patterns |
| Entity Infrastructure Service | `docs/services/entity-infrastructure.service.md` | Entity CRUD + ref_data_entityInstance |
| State Management | `docs/state_management/STATE_MANAGEMENT.md` | Frontend TanStack Query + Dexie |
| Dexie Schema | `docs/migrations/DEXIE_SCHEMA_REFACTORING.md` | IndexedDB v4 schema |

---

**Document Version**: 3.0.0
**Last Updated**: 2025-11-30
**Status**: Production Ready

### Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-11-30 | Initial Redis field caching |
| 2.0.0 | 2025-11-30 | Added `content=metadata` API parameter |
| 3.0.0 | 2025-11-30 | Complete rewrite with end-to-end architecture, sequence diagrams, use case matrix |
