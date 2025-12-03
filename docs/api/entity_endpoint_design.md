# Entity Endpoint Design

> **Complete reference for building entity API routes with factory patterns, RBAC, caching, and real-time sync**

**Version:** 5.0.0 | **Last Updated:** 2025-12-03 | **Status:** Production Ready

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Factory Pattern System](#factory-pattern-system)
3. [Database Schema Configuration](#database-schema-configuration)
4. [Request Flow & Execution](#request-flow--execution)
5. [Caching Architecture](#caching-architecture)
6. [CRUD Endpoint Patterns](#crud-endpoint-patterns)
7. [RBAC Permission Model](#rbac-permission-model)
8. [Auto-Filter System](#auto-filter-system)
9. [Frontend Integration](#frontend-integration)
10. [Complete Module Template](#complete-module-template)

---

## Architecture Overview

### System Layers

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              ENTITY API ARCHITECTURE                                 │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐│
│  │  LAYER 1: HTTP ROUTES                                                           ││
│  │  apps/api/src/modules/{entity}/routes.ts                                        ││
│  │  ─────────────────────────────────────────                                      ││
│  │  • Fastify route handlers (GET, POST, PATCH, PUT, DELETE)                       ││
│  │  • Schema validation (TypeBox)                                                  ││
│  │  • Authentication middleware (JWT)                                              ││
│  │  • Factory-generated or custom routes                                           ││
│  └─────────────────────────────────────────────────────────────────────────────────┘│
│                              ↓                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐│
│  │  LAYER 2: FACTORIES & UTILITIES                                                 ││
│  │  apps/api/src/lib/                                                              ││
│  │  ─────────────────────                                                          ││
│  │  • universal-entity-crud-factory.ts  → Creates all CRUD endpoints               ││
│  │  • universal-filter-builder.ts       → Auto-detects filters from query params   ││
│  │  • pagination.ts                     → Entity-specific limits                   ││
│  └─────────────────────────────────────────────────────────────────────────────────┘│
│                              ↓                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐│
│  │  LAYER 3: SERVICES                                                              ││
│  │  apps/api/src/services/                                                         ││
│  │  ─────────────────────────                                                      ││
│  │  • entity-infrastructure.service.ts  → RBAC, Registry, Links (Redis cached)    ││
│  │  • entity-component-metadata.service.ts      → Metadata generation (Redis cached)      ││
│  └─────────────────────────────────────────────────────────────────────────────────┘│
│                              ↓                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐│
│  │  LAYER 4: DATABASE                                                              ││
│  │  apps/api/src/db/index.ts                                                       ││
│  │  ─────────────────────────                                                      ││
│  │  • Drizzle ORM + postgres.js                                                    ││
│  │  • DB_SCHEMA config ('app')                                                     ││
│  │  • qualifyTable(), entityTable() utilities                                      ││
│  └─────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Request Lifecycle

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         API REQUEST LIFECYCLE                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  HTTP Request → Auth Middleware → Route Handler → RBAC Check                 │
│       ↓                                                                       │
│  Build JOINs (parent filter) → Build WHERE (RBAC + auto-filters) → Execute   │
│       ↓                                                                       │
│  Response → NOTIFY cache invalidation → WebSocket broadcast → Clients        │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Factory Pattern System

### Overview

The factory system eliminates boilerplate by generating standardized CRUD endpoints from configuration.

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         FACTORY PATTERN HIERARCHY                                    │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  createUniversalEntityRoutes()                                                       │
│  ════════════════════════════                                                        │
│  Generates ALL endpoints in one call:                                                │
│  ├── createEntityListEndpoint()    → GET  /api/v1/{entity}                          │
│  ├── createEntityGetEndpoint()     → GET  /api/v1/{entity}/:id                      │
│  ├── createEntityPatchEndpoint()   → PATCH /api/v1/{entity}/:id                     │
│  ├── createEntityPutEndpoint()     → PUT  /api/v1/{entity}/:id                      │
│  └── createEntityDeleteEndpoint()  → DELETE /api/v1/{entity}/:id                    │
│                                                                                      │
│  Skip options: { skip: { delete: true, patch: true } }                              │
│  Delete mode:  { deleteOptions: { hardDelete: true } }                              │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Factory Imports

```typescript
// apps/api/src/lib/universal-entity-crud-factory.ts
import {
  // Combined factory (recommended)
  createUniversalEntityRoutes,

  // Individual factories (for customization)
  createEntityListEndpoint,
  createEntityGetEndpoint,
  createEntityPatchEndpoint,
  createEntityPutEndpoint,
  createEntityDeleteEndpoint,

  // Entity-to-table mapping
  ENTITY_TABLE_MAP,
  getTableName,
  getEntityTableName
} from '@/lib/universal-entity-crud-factory.js';
```

### Usage Patterns

#### Pattern 1: Minimal (All Endpoints)

```typescript
export default async function roleRoutes(fastify: FastifyInstance) {
  // Generates LIST, GET, PATCH, PUT, DELETE for 'role' entity
  createUniversalEntityRoutes(fastify, { entityCode: 'role' });
}
```

#### Pattern 2: With Hard Delete (Transactional Entities)

```typescript
createUniversalEntityRoutes(fastify, {
  entityCode: 'entity_instance_link',
  deleteOptions: { hardDelete: true }  // No soft delete for link tables
});
```

#### Pattern 3: Skip and Customize

```typescript
// Use factory for standard endpoints
createUniversalEntityRoutes(fastify, {
  entityCode: 'project',
  skip: { delete: true }  // Skip DELETE - custom implementation below
});

// Custom DELETE with special logic
fastify.delete('/api/v1/project/:id', async (request, reply) => {
  // Custom cascade deletion logic
});
```

#### Pattern 4: Individual Factories

```typescript
// Only LIST and GET
createEntityListEndpoint(fastify, { entityCode: 'audit_log' });
createEntityGetEndpoint(fastify, { entityCode: 'audit_log' });
// No PATCH/PUT/DELETE - audit logs are immutable
```

### Entity-to-Table Mapping

```typescript
// ENTITY_TABLE_MAP in universal-entity-crud-factory.ts
export const ENTITY_TABLE_MAP: Record<string, string> = {
  // Core entities (entity_code = table_name)
  task: 'task',
  project: 'project',
  employee: 'employee',
  role: 'role',
  office: 'office',
  customer: 'customer',      // Canonical name (not 'cust')
  business: 'business',      // Canonical name (not 'biz')

  // Entities with different table names
  expense: 'f_expense',
  revenue: 'f_revenue',
  quote: 'fact_quote',
  message: 'message_data',

  // Hierarchy entities
  office_hierarchy: 'office_hierarchy',
  business_hierarchy: 'business_hierarchy',
  product_hierarchy: 'product_hierarchy',
};

// Convention: If not in map, use entity_code as table name
function getTableName(entityCode: string): string {
  return ENTITY_TABLE_MAP[entityCode] || entityCode;
}
```

---

## Database Schema Configuration

### Centralized Schema Config

```typescript
// apps/api/src/lib/config.ts
const configSchema = z.object({
  // ...
  DATABASE_URL: z.string().url(),
  DB_SCHEMA: z.string().default('app'),  // Schema name
  // ...
});
```

### Schema Utilities

```typescript
// apps/api/src/db/index.ts
import { config } from '@/lib/config.js';

/**
 * Database schema name (from config, defaults to 'app')
 */
export const DB_SCHEMA = config.DB_SCHEMA;

/**
 * Get fully qualified table name: {schema}.{table}
 * @example qualifyTable('project') → 'app.project'
 */
export function qualifyTable(tableName: string): string {
  return `${DB_SCHEMA}.${tableName}`;
}

/**
 * Get table name from entity code
 * @example entityTable('task') → 'app.task'
 */
export function entityTable(entityCode: string): string {
  return qualifyTable(entityCode);
}
```

### Usage in Routes

```typescript
import { db, qualifyTable, entityTable } from '@/db/index.js';

// Instead of hardcoded 'app.project':
const result = await db.execute(sql`
  SELECT * FROM ${sql.raw(qualifyTable('project'))} WHERE id = ${id}
`);

// Or using entity code directly:
const result = await db.execute(sql`
  SELECT * FROM ${sql.raw(entityTable(ENTITY_CODE))} WHERE id = ${id}
`);
```

---

## Request Flow & Execution

### Sequence Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         REQUEST EXECUTION SEQUENCE                                   │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  Client                Route Handler           Services              Database       │
│    │                        │                      │                     │          │
│    │─── GET /api/v1/task ───→                      │                     │          │
│    │                        │                      │                     │          │
│    │                   [1] Extract JWT user        │                     │          │
│    │                        │                      │                     │          │
│    │                   [2] Check metadata mode ────────────────────────────────────→│
│    │                        │    (content=metadata)│                     │          │
│    │                        │                      │                     │          │
│    │                   [3] Get RBAC condition ────→│                     │          │
│    │                        │    entityInfra.get_entity_rbac_where_condition()      │
│    │                        │                      │                     │          │
│    │                        │                      │──── Redis cache ───→│          │
│    │                        │                      │←─── entity metadata ─│          │
│    │                        │                      │                     │          │
│    │                   [4] Build auto-filters      │                     │          │
│    │                        │    buildAutoFilters()│                     │          │
│    │                        │                      │                     │          │
│    │                   [5] Execute query ─────────────────────────────────→│        │
│    │                        │                      │                     │          │
│    │                   [6] Build ref_data ────────→│                     │          │
│    │                        │    entityInfra.build_ref_data_entityInstance()        │
│    │                        │                      │                     │          │
│    │                   [7] Generate response ─────→│                     │          │
│    │                        │    generateEntityResponse()                │          │
│    │                        │                      │                     │          │
│    │←─────── JSON response ─│                      │                     │          │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Execution Steps (LIST Endpoint)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                      BACKEND REQUEST EXECUTION FLOW                                  │
│                      (Order of operations in route handler)                          │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  1. AUTHENTICATION (preHandler middleware)                                          │
│  ════════════════════════════════════════                                           │
│  fastify.authenticate extracts user from JWT                                        │
│  └── request.user.sub = userId (UUID)                                               │
│                                                                                      │
│  2. QUERY PARAMETER EXTRACTION                                                      │
│  ══════════════════════════════                                                     │
│  const {                                                                            │
│    limit = 20,                              // Pagination                           │
│    offset,                                  // Pagination                           │
│    page,                                    // Alternative pagination               │
│    content,                                 // 'metadata' for metadata-only         │
│    parent_entity_code,                      // Parent filtering                     │
│    parent_entity_instance_id,               // Parent filtering                     │
│    search,                                  // Full-text search                     │
│    ...filters                               // Auto-detected filters                │
│  } = request.query;                                                                 │
│                                                                                      │
│  3. METADATA-ONLY BRANCH (if content === 'metadata')                               │
│  ═══════════════════════════════════════════════════                               │
│  // Skip data query - return cached or generated metadata                          │
│  const cachedMetadata = await getCachedMetadataResponse(ENTITY_CODE, components);  │
│  if (cachedMetadata) return reply.send(cachedMetadata);                            │
│  // Generate and cache metadata...                                                 │
│                                                                                      │
│  4. BUILD JOINs ARRAY (parent filtering)                                            │
│  ═══════════════════════════════════════                                            │
│  const joins: SQL[] = [];                                                           │
│  if (parent_entity_code && parent_entity_instance_id) {                            │
│    joins.push(sql`                                                                 │
│      INNER JOIN ${sql.raw(qualifyTable('entity_instance_link'))} eil               │
│        ON eil.child_entity_code = ${ENTITY_CODE}                                   │
│        AND eil.child_entity_instance_id = ${sql.raw(TABLE_ALIAS)}.id               │
│        AND eil.entity_code = ${parent_entity_code}                                 │
│        AND eil.entity_instance_id = ${parent_entity_instance_id}::uuid             │
│    `);                                                                              │
│  }                                                                                  │
│                                                                                      │
│  5. BUILD CONDITIONS ARRAY (RBAC + filters)                                         │
│  ══════════════════════════════════════════                                         │
│  const conditions: SQL[] = [];                                                      │
│                                                                                      │
│  // GATE 1: RBAC filtering (MANDATORY)                                              │
│  const rbacWhereClause = await entityInfra.get_entity_rbac_where_condition(        │
│    userId, ENTITY_CODE, Permission.VIEW, TABLE_ALIAS                               │
│  );                                                                                 │
│  conditions.push(rbacWhereClause);                                                  │
│                                                                                      │
│  // GATE 2: Active flag (MANDATORY for soft-delete tables)                         │
│  conditions.push(sql`${sql.raw(TABLE_ALIAS)}.active_flag = true`);                 │
│                                                                                      │
│  // GATE 3: Auto-filters from query params                                          │
│  const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query, {                │
│    searchFields: ['name', 'code', 'descr']                                         │
│  });                                                                                │
│  conditions.push(...autoFilters);                                                   │
│                                                                                      │
│  6. EXECUTE QUERIES                                                                 │
│  ═════════════════                                                                  │
│  // COUNT (DISTINCT when JOINing)                                                  │
│  const countResult = await db.execute(sql`                                         │
│    SELECT COUNT(DISTINCT ${sql.raw(TABLE_ALIAS)}.id) as total ...                  │
│  `);                                                                                │
│                                                                                      │
│  // DATA (DISTINCT when JOINing)                                                   │
│  const rows = await db.execute(sql`                                                │
│    SELECT DISTINCT ${sql.raw(TABLE_ALIAS)}.* ...                                   │
│  `);                                                                                │
│                                                                                      │
│  7. BUILD RESPONSE                                                                  │
│  ═════════════════                                                                  │
│  const ref_data_entityInstance = await entityInfra.build_ref_data_entityInstance(  │
│    Array.from(rows)                                                                 │
│  );                                                                                 │
│  const response = await generateEntityResponse(ENTITY_CODE, Array.from(rows), {    │
│    total, limit, offset, ref_data_entityInstance                                   │
│  });                                                                                │
│  return reply.send(response);                                                       │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Caching Architecture

### Multi-Layer Cache System

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         CACHING ARCHITECTURE                                         │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐│
│  │  BACKEND CACHES (Redis)                                                         ││
│  ├─────────────────────────────────────────────────────────────────────────────────┤│
│  │                                                                                  ││
│  │  1. Entity Type Metadata Cache                                                  ││
│  │     Key: entity:metadata:{entity_code}                                          ││
│  │     TTL: 5 minutes                                                              ││
│  │     Data: { code, name, child_entity_codes, db_table, ... }                     ││
│  │     Used by: entityInfra.get_entity_metadata()                                  ││
│  │                                                                                  ││
│  │  2. Field Names Cache                                                           ││
│  │     Key: entity:fields:{entity_code}                                            ││
│  │     TTL: 24 hours                                                               ││
│  │     Data: ["id", "name", "code", "dl__status", ...]                             ││
│  │     Used by: generateEntityResponse() for empty data                            ││
│  │                                                                                  ││
│  │  3. Metadata Response Cache                                                     ││
│  │     Key: entity:metadata:response:{entity_code}:{components}                    ││
│  │     TTL: 30 minutes                                                             ││
│  │     Data: Full metadata response (viewType, editType)                           ││
│  │     Used by: content=metadata requests                                          ││
│  │                                                                                  ││
│  └─────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐│
│  │  FRONTEND CACHES (TanStack Query + Dexie)                                       ││
│  ├─────────────────────────────────────────────────────────────────────────────────┤│
│  │                                                                                  ││
│  │  1. TanStack Query (In-Memory)                                                  ││
│  │     • Server state management                                                   ││
│  │     • Auto background refetch                                                   ││
│  │     • Stale-while-revalidate                                                    ││
│  │                                                                                  ││
│  │  2. Dexie (IndexedDB)                                                           ││
│  │     • Offline-first persistence                                                 ││
│  │     • Survives browser restart                                                  ││
│  │     • Multi-tab sync                                                            ││
│  │                                                                                  ││
│  │  Cache Keys:                                                                    ││
│  │     ['entityInstanceData', entityCode, params]  → 5 min stale                  ││
│  │     ['entityInstanceMetadata', entityCode]      → 30 min stale                 ││
│  │     ['datalabel', fieldName]                    → 10 min stale                 ││
│  │                                                                                  ││
│  └─────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Real-Time Cache Invalidation

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    REAL-TIME CACHE INVALIDATION FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  1. API writes to database                                                           │
│     └── INSERT/UPDATE/DELETE on app.project                                         │
│                                                                                      │
│  2. PostgreSQL trigger fires                                                         │
│     └── Writes to app.system_logging (entity_code, entity_id, operation)            │
│                                                                                      │
│  3. LogWatcher polls app.system_logging                                              │
│     └── Every 60s, reads pending changes                                            │
│                                                                                      │
│  4. PubSub broadcasts via WebSocket (:4001)                                          │
│     └── NOTIFY { entity_code: 'project', entity_id: 'uuid', op: 'UPDATE' }          │
│                                                                                      │
│  5. Frontend WebSocketManager receives                                               │
│     └── queryClient.invalidateQueries(['entityInstanceData', 'project'])            │
│                                                                                      │
│  6. TanStack Query auto-refetches                                                    │
│     └── Fresh data rendered to user                                                  │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## CRUD Endpoint Patterns

### Standard Endpoints

| Endpoint | Method | RBAC | Description |
|----------|--------|------|-------------|
| `/api/v1/{entity}` | GET | VIEW (WHERE) | Paginated list with filters |
| `/api/v1/{entity}?content=metadata` | GET | VIEW | Metadata-only (no data query) |
| `/api/v1/{entity}/:id` | GET | VIEW | Single instance |
| `/api/v1/{entity}` | POST | CREATE + EDIT parent | Create with linkage |
| `/api/v1/{entity}/:id` | PATCH/PUT | EDIT | Update with registry sync |
| `/api/v1/{entity}/:id` | DELETE | DELETE | Soft/hard delete with cleanup |

### CREATE Flow (6 Steps)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         CREATE OPERATION FLOW (6 Steps)                              │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  STEP 1: RBAC - Can user CREATE this entity type?                                   │
│  ════════════════════════════════════════════════                                   │
│  check_entity_rbac(userId, ENTITY_CODE, ALL_ENTITIES_ID, Permission.CREATE)         │
│  └── ALL_ENTITIES_ID = '11111111-1111-1111-1111-111111111111' (type-level check)    │
│                                                                                      │
│  STEP 2: RBAC - If linking to parent, can user EDIT parent?                         │
│  ══════════════════════════════════════════════════════════                         │
│  if (parent_entity_code && parent_entity_instance_id) {                             │
│    check_entity_rbac(userId, parent_entity_code, parent_entity_instance_id, EDIT)   │
│  }                                                                                  │
│                                                                                      │
│  STEP 3: INSERT into primary table                                                  │
│  ═════════════════════════════════                                                  │
│  INSERT INTO app.project (...) VALUES (...) RETURNING *                             │
│                                                                                      │
│  STEP 4: Register in entity_instance                                                │
│  ═══════════════════════════════════                                                │
│  set_entity_instance_registry({                                                     │
│    entity_code: ENTITY_CODE,      // Entity TYPE code (e.g., 'project')             │
│    entity_id: entity.id,          // Entity instance UUID                           │
│    entity_name: entity.name,      // Display name                                   │
│    instance_code: entity.code     // Business code (e.g., 'PROJ-001')               │
│  })                                                                                 │
│                                                                                      │
│  STEP 5: Grant OWNER permission to creator                                          │
│  ═════════════════════════════════════════                                          │
│  set_entity_rbac_owner(userId, ENTITY_CODE, entity.id)                              │
│                                                                                      │
│  STEP 6: Link to parent (if provided)                                               │
│  ═════════════════════════════════════                                              │
│  if (parent_entity_code && parent_entity_instance_id) {                             │
│    set_entity_instance_link({                                                       │
│      entity_code: parent_entity_code,                                               │
│      entity_instance_id: parent_entity_instance_id,                                 │
│      child_entity_code: ENTITY_CODE,                                                │
│      child_entity_instance_id: entity.id,                                           │
│      relationship_type: 'contains'                                                  │
│    })                                                                               │
│  }                                                                                  │
│                                                                                      │
│  RETURN: 201 Created + entity data                                                  │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### DELETE Semantics

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         DELETE SEMANTICS BY TABLE TYPE                               │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  PRIMARY TABLES (configurable)         INFRASTRUCTURE TABLES (always hard delete)  │
│  ═════════════════════════════         ════════════════════════════════════════   │
│                                                                                      │
│  app.project:  soft delete             app.entity_instance:       HARD DELETE       │
│  app.task:     soft delete             app.entity_instance_link:  HARD DELETE       │
│  app.employee: soft delete             app.entity_rbac:           HARD DELETE       │
│                                                                                      │
│  Soft delete: active_flag=false        Hard delete: DELETE FROM table WHERE...      │
│                                                                                      │
│  Factory usage:                                                                      │
│  ──────────────                                                                      │
│  // Default: soft delete for primary table                                          │
│  createEntityDeleteEndpoint(fastify, 'project');                                    │
│                                                                                      │
│  // Hard delete (for transactional tables like linkage)                             │
│  createEntityDeleteEndpoint(fastify, 'entity_instance_link', { hardDelete: true }); │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## RBAC Permission Model

> **For comprehensive RBAC documentation, see [`docs/rbac/RBAC_INFRASTRUCTURE.md`](../rbac/RBAC_INFRASTRUCTURE.md)**

### Permission Levels

```typescript
enum Permission {
  VIEW       = 0,  // Read access
  COMMENT    = 1,  // Add comments
  CONTRIBUTE = 2,  // Insert form data
  EDIT       = 3,  // Modify (implies VIEW, COMMENT, CONTRIBUTE)
  SHARE      = 4,  // Share (implies EDIT)
  DELETE     = 5,  // Delete (implies SHARE)
  CREATE     = 6,  // Create new (type-level only)
  OWNER      = 7   // Full control (implies ALL)
}

// Type-level permission check constant
const ALL_ENTITIES_ID = '11111111-1111-1111-1111-111111111111';
```

### Permission Resolution

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         PERMISSION RESOLUTION (4 Sources)                            │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  check_entity_rbac(userId, 'project', projectId, Permission.EDIT)                   │
│                                                                                      │
│  Queries 4 sources and returns MAX permission level:                                │
│                                                                                      │
│  1. Direct Employee    → entity_rbac WHERE person_code='employee' AND person_id=user│
│  2. Role-Based         → entity_rbac WHERE person_code='role' AND person_id IN roles│
│  3. Parent-VIEW        → If parent has VIEW, child inherits VIEW                    │
│  4. Parent-CREATE      → If parent has CREATE, child inherits CREATE               │
│                                                                                      │
│  Result: MAX(all sources) >= required level?                                        │
│                                                                                      │
│  → See docs/rbac/RBAC_INFRASTRUCTURE.md for detailed algorithm and SQL queries      │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### RBAC Methods

| Method | Returns | Use Case |
|--------|---------|----------|
| `check_entity_rbac(userId, entity, id, perm)` | boolean | Single permission check |
| `get_entity_rbac_where_condition(userId, entity, perm, alias)` | SQL | List filtering |
| `set_entity_rbac_owner(userId, entity, id)` | void | Grant OWNER on create |

> **Detailed documentation:** Request flows, logical flows, design patterns → [`RBAC_INFRASTRUCTURE.md`](../rbac/RBAC_INFRASTRUCTURE.md)

---

## Auto-Filter System

The `buildAutoFilters()` function auto-detects filter types from column naming conventions:

| Query Param | Pattern | Generated SQL |
|-------------|---------|---------------|
| `?dl__project_stage=planning` | `dl__*` | `e.dl__project_stage = 'planning'` |
| `?manager__employee_id=uuid` | `*__*_id` | `e.manager__employee_id = 'uuid'::uuid` |
| `?business_id=uuid` | `*_id` | `e.business_id = 'uuid'::uuid` |
| `?budget_amt=50000` | `*_amt` | `e.budget_amt = 50000` |
| `?active_flag=true` | `*_flag` | `e.active_flag = true` |
| `?search=kitchen` | search | `(name ILIKE '%kitchen%' OR ...)` |

### Usage

```typescript
const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query as any, {
  searchFields: ['name', 'code', 'descr'],  // Full-text search fields
  excludeFields: ['limit', 'offset', 'page', 'content', 'view']  // Auto-excluded
});
conditions.push(...autoFilters);
```

---

## Frontend Integration

### Two-Query Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    FRONTEND TWO-QUERY PATTERN                                        │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  DATA QUERY                                METADATA QUERY                           │
│  ══════════                                ══════════════                           │
│                                                                                      │
│  GET /api/v1/task?limit=100                GET /api/v1/task?content=metadata        │
│                                                                                      │
│  Response:                                 Response:                                 │
│  {                                         {                                        │
│    data: [...],                              data: [],                              │
│    ref_data_entityInstance: {...},           fields: ["id", "name", ...],           │
│    metadata: {},  ← EMPTY by design          metadata: {                            │
│    total: 100                                  viewType: {...},                     │
│  }                                             editType: {...}                      │
│                                              }                                       │
│                                            }                                         │
│                                                                                      │
│  WHY SEPARATE?                                                                       │
│  ─────────────                                                                       │
│  1. Metadata is entity-TYPE level (same for all projects)                           │
│  2. Data varies by filters                                                          │
│  3. Different cache lifetimes: metadata 30-min, data 5-min                         │
│  4. Smaller data responses (no 2-5KB metadata payload)                             │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Frontend Hooks

```typescript
import {
  useEntityInstanceData,       // Data with parent filtering
  useEntityInstanceMetadata,   // Metadata (30-min cache)
  useEntity,                   // Single entity
  useEntityMutation,           // Create/Update/Delete
} from '@/db/tanstack-index';

// Child entity tab
const { data, refData, isLoading } = useEntityInstanceData('task', {
  parent_entity_code: 'project',
  parent_entity_instance_id: projectId,
  limit: 100
});

const { viewType, editType } = useEntityInstanceMetadata('task', 'entityListOfInstancesTable');
```

---

## Complete Module Template

```typescript
// apps/api/src/modules/{entity}/routes.ts

import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db, client, qualifyTable } from '@/db/index.js';
import { sql, SQL } from 'drizzle-orm';

import {
  getEntityInfrastructure,
  Permission,
  ALL_ENTITIES_ID
} from '@/services/entity-infrastructure.service.js';
import { generateEntityResponse } from '@/services/entity-component-metadata.service.js';
import { buildAutoFilters } from '@/lib/universal-filter-builder.js';
import { createEntityDeleteEndpoint } from '@/lib/universal-entity-crud-factory.js';

// ═══════════════════════════════════════════════════════════════════════════
// MODULE CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
const ENTITY_CODE = 'project';
const TABLE_ALIAS = 'e';

export default async function projectRoutes(fastify: FastifyInstance) {
  const entityInfra = getEntityInfrastructure(db);

  // ═══════════════════════════════════════════════════════════════════════════
  // LIST - GET /api/v1/project
  // ═══════════════════════════════════════════════════════════════════════════
  fastify.get('/api/v1/project', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
        offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
        content: Type.Optional(Type.String()),
        parent_entity_code: Type.Optional(Type.String()),
        parent_entity_instance_id: Type.Optional(Type.String({ format: 'uuid' })),
        search: Type.Optional(Type.String()),
      })
    }
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) return reply.status(401).send({ error: 'User not authenticated' });

    const {
      limit = 20,
      offset = 0,
      content,
      parent_entity_code,
      parent_entity_instance_id,
    } = request.query as any;

    // METADATA-ONLY MODE
    if (content === 'metadata') {
      const columnsResult = await client.unsafe(
        `SELECT * FROM ${qualifyTable(ENTITY_CODE)} WHERE 1=0`
      );
      const resultFields = columnsResult.columns?.map((c: any) => ({ name: c.name })) || [];

      const response = await generateEntityResponse(ENTITY_CODE, [], {
        metadataOnly: true,
        resultFields
      });
      return reply.send(response);
    }

    // BUILD JOINs (parent filtering)
    const joins: SQL[] = [];
    if (parent_entity_code && parent_entity_instance_id) {
      joins.push(sql`
        INNER JOIN ${sql.raw(qualifyTable('entity_instance_link'))} eil
          ON eil.child_entity_code = ${ENTITY_CODE}
          AND eil.child_entity_instance_id = ${sql.raw(TABLE_ALIAS)}.id
          AND eil.entity_code = ${parent_entity_code}
          AND eil.entity_instance_id = ${parent_entity_instance_id}::uuid
      `);
    }

    // BUILD CONDITIONS (RBAC + filters)
    const conditions: SQL[] = [];

    const rbacWhereClause = await entityInfra.get_entity_rbac_where_condition(
      userId, ENTITY_CODE, Permission.VIEW, TABLE_ALIAS
    );
    conditions.push(rbacWhereClause);
    conditions.push(sql`${sql.raw(TABLE_ALIAS)}.active_flag = true`);

    const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query as any, {
      searchFields: ['name', 'code', 'descr']
    });
    conditions.push(...autoFilters);

    // SQL CLAUSES
    const joinClause = joins.length > 0 ? sql.join(joins, sql` `) : sql``;
    const whereClause = conditions.length > 0
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;

    // COUNT + DATA
    const countResult = await db.execute(sql`
      SELECT COUNT(DISTINCT ${sql.raw(TABLE_ALIAS)}.id) as total
      FROM ${sql.raw(qualifyTable(ENTITY_CODE))} ${sql.raw(TABLE_ALIAS)}
      ${joinClause}
      ${whereClause}
    `);
    const total = Number(countResult[0]?.total || 0);

    const rows = await db.execute(sql`
      SELECT DISTINCT ${sql.raw(TABLE_ALIAS)}.*
      FROM ${sql.raw(qualifyTable(ENTITY_CODE))} ${sql.raw(TABLE_ALIAS)}
      ${joinClause}
      ${whereClause}
      ORDER BY ${sql.raw(TABLE_ALIAS)}.created_ts DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    // RESPONSE
    const ref_data_entityInstance = await entityInfra.build_ref_data_entityInstance(
      Array.from(rows)
    );
    const response = await generateEntityResponse(ENTITY_CODE, Array.from(rows), {
      total, limit, offset, ref_data_entityInstance
    });
    return reply.send(response);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DELETE - Factory generated
  // ═══════════════════════════════════════════════════════════════════════════
  createEntityDeleteEndpoint(fastify, ENTITY_CODE);
}
```

---

## Related Documentation

| Document | Path | Description |
|----------|------|-------------|
| Entity Infrastructure Service | `docs/services/entity-infrastructure.service.md` | RBAC + Registry + Links |
| Entity Component Metadata Service | `docs/services/entity-component-metadata.service.md` | Metadata generation |
| State Management | `docs/state_management/STATE_MANAGEMENT.md` | TanStack Query + Dexie |
| RBAC Infrastructure | `docs/rbac/RBAC_INFRASTRUCTURE.md` | Full RBAC details |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 5.0.0 | 2025-12-03 | **Factory refactoring**: Added factory pattern system, DB_SCHEMA config, qualifyTable() utility, updated caching architecture diagram, entity naming standardization (customer, business, office) |
| 4.0.0 | 2025-12-01 | Added detailed backend execution flow, v9.7.0 two-query architecture |
| 3.0.0 | 2025-11-29 | Added parent filtering, real-time cache invalidation |
| 2.0.0 | 2025-01-17 | Route-owned queries + infrastructure service |
| 1.0.0 | 2025-01-10 | Initial documentation |
