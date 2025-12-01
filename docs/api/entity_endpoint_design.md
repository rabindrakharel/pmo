# Entity Endpoint Design

> **Complete reference for building entity API routes with RBAC, parent filtering, metadata generation, and real-time cache sync**

**Version:** 4.0.0 | **Last Updated:** 2025-12-01 | **Status:** Production Ready

---

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Route Code Structure](#route-code-structure)
3. [Backend Execution Flow](#backend-execution-flow)
4. [LIST Endpoint Pattern](#list-endpoint-pattern)
5. [GET Single Instance](#get-single-instance)
6. [CREATE Pattern (6-Step)](#create-pattern-6-step)
7. [UPDATE Pattern (3-Step)](#update-pattern-3-step)
8. [DELETE Pattern](#delete-pattern)
9. [Metadata-Only Mode](#metadata-only-mode)
10. [RBAC Permission Model](#rbac-permission-model)
11. [Auto-Filter System](#auto-filter-system)
12. [Backend Response Formatting](#backend-response-formatting)
13. [Frontend Integration (v9.7.0)](#frontend-integration-v970)
14. [Real-Time Cache Invalidation](#real-time-cache-invalidation)
15. [Complete Module Template](#complete-module-template)

---

## Quick Reference

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         API REQUEST LIFECYCLE                                  │
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

### Standard Endpoints

| Endpoint | Method | RBAC | Key Features |
|----------|--------|------|--------------|
| `/api/v1/{entity}` | GET | VIEW (WHERE) | Pagination, parent filter, auto-filters |
| `/api/v1/{entity}?content=metadata` | GET | VIEW | Metadata-only (no data query) |
| `/api/v1/{entity}/:id` | GET | VIEW | Single instance with JOINs |
| `/api/v1/{entity}` | POST | CREATE + EDIT parent | 6-step transactional pattern |
| `/api/v1/{entity}/:id` | PATCH/PUT | EDIT | Update with registry sync |
| `/api/v1/{entity}/:id` | DELETE | DELETE | Soft delete with cascade |
| `/api/v1/{parent}/:id/{child}` | GET | VIEW parent | Factory-generated child endpoints |

---

## Route Code Structure

### Required File Structure

Every entity module follows this structure:

```
apps/api/src/modules/{entity}/
├── routes.ts          # All route definitions
└── (no other files)   # Route owns queries, no service layer
```

### Required Imports Block

```typescript
import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db, client } from '@/db/index.js';
import { sql, SQL } from 'drizzle-orm';

// Core services
import {
  getEntityInfrastructure,
  Permission,
  ALL_ENTITIES_ID
} from '@/services/entity-infrastructure.service.js';

// Response formatting (async - v9.2.0+)
import { generateEntityResponse } from '@/services/backend-formatter.service.js';

// Auto-filter builder
import { buildAutoFilters } from '@/lib/universal-filter-builder.js';

// Factory functions
import { createEntityDeleteEndpoint } from '@/lib/entity-delete-route-factory.js';
import { createChildEntityEndpointsFromMetadata } from '@/lib/child-entity-route-factory.js';
```

### Module Constants (DRY Principle)

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// MODULE CONSTANTS - Use throughout route file for consistency
// ═══════════════════════════════════════════════════════════════════════════
const ENTITY_CODE = 'project';  // Entity type code - used in RBAC, registry, responses
const TABLE_ALIAS = 'e';        // SQL alias - use consistently in all queries
```

### Function Export Pattern

```typescript
export default async function projectRoutes(fastify: FastifyInstance) {
  const entityInfra = getEntityInfrastructure(db);

  // ═══════════════════════════════════════════════════════════════════════════
  // ENDPOINTS BELOW - Order: LIST, GET/:id, POST, PATCH/:id, DELETE/:id
  // ═══════════════════════════════════════════════════════════════════════════
}
```

---

## Backend Execution Flow

### Complete Request Processing Sequence

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
│  ┌────────────────────────────────────────────────────────────────────────────────┐│
│  │ // Skip data query entirely - return cached or generated metadata              ││
│  │ const columnsResult = await client.unsafe('SELECT * FROM table WHERE 1=0');    ││
│  │ const resultFields = columnsResult.columns.map(c => ({ name: c.name }));       ││
│  │ const response = await generateEntityResponse(ENTITY_CODE, [], {               ││
│  │   metadataOnly: true,                                                          ││
│  │   resultFields                                                                 ││
│  │ });                                                                            ││
│  │ return reply.send(response);                                                   ││
│  └────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                      │
│  4. BUILD JOINs ARRAY (parent filtering)                                            │
│  ═══════════════════════════════════════                                            │
│  const joins: SQL[] = [];                                                           │
│  if (parent_entity_code && parent_entity_instance_id) {                            │
│    joins.push(sql`                                                                 │
│      INNER JOIN app.entity_instance_link eil                                       │
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
│  6. CONSTRUCT SQL CLAUSES                                                           │
│  ═════════════════════════                                                          │
│  const joinClause = joins.length > 0 ? sql.join(joins, sql` `) : sql``;            │
│  const whereClause = conditions.length > 0                                          │
│    ? sql`WHERE ${sql.join(conditions, sql` AND `)}`                                │
│    : sql``;                                                                         │
│                                                                                      │
│  7. EXECUTE COUNT QUERY (with DISTINCT when JOINing)                               │
│  ═══════════════════════════════════════════════════                               │
│  const countResult = await db.execute(sql`                                         │
│    SELECT COUNT(DISTINCT ${sql.raw(TABLE_ALIAS)}.id) as total                      │
│    FROM app.${sql.raw(ENTITY_CODE)} ${sql.raw(TABLE_ALIAS)}                        │
│    ${joinClause}                                                                    │
│    ${whereClause}                                                                   │
│  `);                                                                                │
│  const total = Number(countResult[0]?.total || 0);                                 │
│                                                                                      │
│  8. EXECUTE DATA QUERY (with DISTINCT when JOINing)                                │
│  ══════════════════════════════════════════════════                                │
│  const rows = await db.execute(sql`                                                │
│    SELECT DISTINCT ${sql.raw(TABLE_ALIAS)}.*                                       │
│    FROM app.${sql.raw(ENTITY_CODE)} ${sql.raw(TABLE_ALIAS)}                        │
│    ${joinClause}                                                                    │
│    ${whereClause}                                                                   │
│    ORDER BY ${sql.raw(TABLE_ALIAS)}.created_ts DESC                                │
│    LIMIT ${limit} OFFSET ${offset}                                                 │
│  `);                                                                                │
│                                                                                      │
│  9. BUILD ref_data_entityInstance LOOKUP TABLE                                      │
│  ═════════════════════════════════════════════                                      │
│  const ref_data_entityInstance = await entityInfra.build_ref_data_entityInstance(  │
│    Array.from(rows)                                                                 │
│  );                                                                                 │
│                                                                                      │
│  10. GENERATE RESPONSE (with metadata: {} for data mode)                           │
│  ═══════════════════════════════════════════════════════                           │
│  const response = await generateEntityResponse(ENTITY_CODE, Array.from(rows), {    │
│    total,                                                                           │
│    limit,                                                                           │
│    offset,                                                                          │
│    ref_data_entityInstance                                                         │
│  });                                                                                │
│  return reply.send(response);                                                       │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Response Structures (Data vs Metadata Mode)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         RESPONSE STRUCTURES                                          │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  DATA MODE (default)                        METADATA MODE (content=metadata)        │
│  ═══════════════════                        ════════════════════════════════        │
│                                                                                      │
│  GET /api/v1/task                           GET /api/v1/task?content=metadata       │
│                                                                                      │
│  {                                          {                                       │
│    data: [                                    data: [],                             │
│      { id, name, code, ... },                                                       │
│      { id, name, code, ... }                  fields: [                             │
│    ],                                           "id", "name", "code",               │
│                                                 "dl__task_status",                  │
│    ref_data_entityInstance: {                   "assignee__employee_id"             │
│      employee: {                              ],                                    │
│        "uuid-james": "James Miller"                                                 │
│      }                                        metadata: {                           │
│    },                                           entityListOfInstancesTable: {       │
│                                                   viewType: {                       │
│    metadata: {},  ← EMPTY by design               name: { renderType: 'text' },    │
│                                                   dl__task_status: {               │
│    total: 100,                                      renderType: 'badge',           │
│    limit: 20,                                       datalabelKey: 'task_status'    │
│    offset: 0                                      },                               │
│  }                                                ...                              │
│                                                 },                                  │
│                                                 editType: { ... }                  │
│                                               }                                    │
│                                             },                                      │
│                                                                                      │
│                                             ref_data_entityInstance: {},            │
│                                             total: 0,                               │
│                                             limit: 0,                               │
│                                             offset: 0                               │
│                                           }                                         │
│                                                                                      │
│  WHY metadata: {} IN DATA MODE?                                                     │
│  ──────────────────────────────                                                     │
│  1. Keeps data responses smaller (metadata is ~2-5KB per entity type)              │
│  2. Metadata is entity-TYPE level (same for all projects) - cache separately       │
│  3. Different cache lifetimes: metadata 30-min, data 5-min                         │
│  4. Frontend fetches metadata via separate ?content=metadata call                  │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## LIST Endpoint Pattern

### Query Parameters Schema

```typescript
querystring: Type.Object({
  // Pagination
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
  offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
  page: Type.Optional(Type.Number({ minimum: 1 })),

  // Parent filtering (v9.7.0 - used by child entity tabs)
  parent_entity_code: Type.Optional(Type.String()),
  parent_entity_instance_id: Type.Optional(Type.String({ format: 'uuid' })),

  // Metadata-only mode (v9.3.0)
  content: Type.Optional(Type.String()),  // 'metadata' for metadata-only
  view: Type.Optional(Type.String()),     // Component names for metadata

  // Search
  search: Type.Optional(Type.String()),

  // Entity-specific filters auto-detected from column names
  // e.g., dl__project_stage, manager__employee_id, budget_amt
})
```

### Complete LIST Implementation

```typescript
fastify.get('/api/v1/project', {
  preHandler: [fastify.authenticate],
  schema: { querystring: /* above */ }
}, async (request, reply) => {
  const userId = (request as any).user?.sub;
  if (!userId) return reply.status(401).send({ error: 'User not authenticated' });

  const {
    limit = 20,
    offset: queryOffset,
    page,
    content,
    view,
    parent_entity_code,
    parent_entity_instance_id,
    ...filters
  } = request.query as any;

  const offset = page ? (page - 1) * limit : (queryOffset || 0);

  // ═══════════════════════════════════════════════════════════════════════════
  // METADATA-ONLY MODE (content=metadata)
  // Frontend calls this to get field metadata without executing data query
  // ═══════════════════════════════════════════════════════════════════════════
  if (content === 'metadata') {
    // Query for column names only (instant - no data)
    const columnsResult = await client.unsafe(
      `SELECT * FROM app.${ENTITY_CODE} WHERE 1=0`
    );
    const resultFields = columnsResult.columns?.map((c: any) => ({ name: c.name })) || [];

    // Parse requested components
    const requestedComponents = view
      ? view.split(',').map((v: string) => v.trim())
      : ['entityListOfInstancesTable', 'entityInstanceFormContainer'];

    // Generate metadata response (async - uses Redis cache)
    const response = await generateEntityResponse(ENTITY_CODE, [], {
      components: requestedComponents,
      metadataOnly: true,
      resultFields
    });

    return reply.send(response);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NORMAL DATA MODE
  // ═══════════════════════════════════════════════════════════════════════════

  // GATE 1: BUILD JOINs (parent filtering)
  const joins: SQL[] = [];

  if (parent_entity_code && parent_entity_instance_id) {
    joins.push(sql`
      INNER JOIN app.entity_instance_link eil
        ON eil.child_entity_code = ${ENTITY_CODE}
        AND eil.child_entity_instance_id = ${sql.raw(TABLE_ALIAS)}.id
        AND eil.entity_code = ${parent_entity_code}
        AND eil.entity_instance_id = ${parent_entity_instance_id}::uuid
    `);
  }

  // GATE 2: BUILD WHERE conditions
  const conditions: SQL[] = [];

  // RBAC filtering (MANDATORY)
  const rbacWhereClause = await entityInfra.get_entity_rbac_where_condition(
    userId, ENTITY_CODE, Permission.VIEW, TABLE_ALIAS
  );
  conditions.push(rbacWhereClause);

  // Active flag (MANDATORY)
  conditions.push(sql`${sql.raw(TABLE_ALIAS)}.active_flag = true`);

  // Auto-filters from query params
  const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query as any, {
    searchFields: ['name', 'code', 'descr']
  });
  conditions.push(...autoFilters);

  // CONSTRUCT SQL clauses
  const joinClause = joins.length > 0 ? sql.join(joins, sql` `) : sql``;
  const whereClause = conditions.length > 0
    ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
    : sql``;

  // COUNT query (DISTINCT required when JOINing)
  const countResult = await db.execute(sql`
    SELECT COUNT(DISTINCT ${sql.raw(TABLE_ALIAS)}.id) as total
    FROM app.project ${sql.raw(TABLE_ALIAS)}
    ${joinClause}
    ${whereClause}
  `);
  const total = Number(countResult[0]?.total || 0);

  // DATA query (DISTINCT required when JOINing)
  const rows = await db.execute(sql`
    SELECT DISTINCT ${sql.raw(TABLE_ALIAS)}.*
    FROM app.project ${sql.raw(TABLE_ALIAS)}
    ${joinClause}
    ${whereClause}
    ORDER BY ${sql.raw(TABLE_ALIAS)}.created_ts DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  // Build entity reference lookup table
  const ref_data_entityInstance = await entityInfra.build_ref_data_entityInstance(
    Array.from(rows)
  );

  // Generate response (metadata: {} for data mode)
  const response = await generateEntityResponse(ENTITY_CODE, Array.from(rows), {
    total,
    limit,
    offset,
    ref_data_entityInstance
  });

  return reply.send(response);
});
```

---

## GET Single Instance

```typescript
fastify.get('/api/v1/project/:id', {
  preHandler: [fastify.authenticate],
  schema: {
    params: Type.Object({ id: Type.String({ format: 'uuid' }) })
  }
}, async (request, reply) => {
  const userId = (request as any).user?.sub;
  const { id } = request.params as any;

  // RBAC check - Can user VIEW this instance?
  const canView = await entityInfra.check_entity_rbac(
    userId, ENTITY_CODE, id, Permission.VIEW
  );
  if (!canView) {
    return reply.status(403).send({ error: 'No permission to view' });
  }

  const result = await db.execute(sql`
    SELECT * FROM app.project WHERE id = ${id} AND active_flag = true
  `);

  if (!result.length) {
    return reply.status(404).send({ error: 'Not found' });
  }

  // Build ref_data for entity references in the single record
  const ref_data_entityInstance = await entityInfra.build_ref_data_entityInstance(
    Array.from(result)
  );

  return {
    ...result[0],
    ref_data_entityInstance
  };
});
```

---

## CREATE Pattern (6-Step)

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
│    entity_code: ENTITY_CODE,                                                        │
│    entity_id: entity.id,                                                            │
│    entity_name: entity.name,                                                        │
│    instance_code: entity.code                                                       │
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

### Implementation

```typescript
fastify.post('/api/v1/project', {
  preHandler: [fastify.authenticate],
  schema: { body: CreateSchema }
}, async (request, reply) => {
  const userId = (request as any).user?.sub;
  const data = request.body as any;
  const { parent_entity_code, parent_entity_instance_id } = request.query as any;

  // STEP 1: RBAC - Can user CREATE?
  const canCreate = await entityInfra.check_entity_rbac(
    userId, ENTITY_CODE, ALL_ENTITIES_ID, Permission.CREATE
  );
  if (!canCreate) {
    return reply.status(403).send({ error: 'No permission to create' });
  }

  // STEP 2: RBAC - Can user EDIT parent?
  if (parent_entity_code && parent_entity_instance_id) {
    const canEditParent = await entityInfra.check_entity_rbac(
      userId, parent_entity_code, parent_entity_instance_id, Permission.EDIT
    );
    if (!canEditParent) {
      return reply.status(403).send({ error: 'No permission to link to parent' });
    }
  }

  // STEP 3: INSERT
  const result = await db.execute(sql`
    INSERT INTO app.project (code, name, descr, budget_allocated_amt, active_flag, created_ts, updated_ts)
    VALUES (${data.code}, ${data.name}, ${data.descr}, ${data.budget_allocated_amt}, true, NOW(), NOW())
    RETURNING *
  `);
  const entity = result[0] as any;

  // STEP 4: Register in entity_instance
  await entityInfra.set_entity_instance_registry({
    entity_code: ENTITY_CODE,
    entity_id: entity.id,
    entity_name: entity.name,
    instance_code: entity.code
  });

  // STEP 5: Grant OWNER permission
  await entityInfra.set_entity_rbac_owner(userId, ENTITY_CODE, entity.id);

  // STEP 6: Link to parent
  if (parent_entity_code && parent_entity_instance_id) {
    await entityInfra.set_entity_instance_link({
      entity_code: parent_entity_code,
      entity_instance_id: parent_entity_instance_id,
      child_entity_code: ENTITY_CODE,
      child_entity_instance_id: entity.id,
      relationship_type: 'contains'
    });
  }

  return reply.status(201).send(entity);
});
```

---

## UPDATE Pattern (3-Step)

```typescript
fastify.put('/api/v1/project/:id', {
  preHandler: [fastify.authenticate],
  schema: {
    params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
    body: UpdateSchema
  }
}, async (request, reply) => {
  const userId = (request as any).user?.sub;
  const { id } = request.params as any;
  const data = request.body as any;

  // STEP 1: RBAC check - Can user EDIT?
  const canEdit = await entityInfra.check_entity_rbac(
    userId, ENTITY_CODE, id, Permission.EDIT
  );
  if (!canEdit) {
    return reply.status(403).send({ error: 'No permission to edit' });
  }

  // STEP 2: UPDATE (route owns query)
  const updateFields: SQL[] = [];
  if (data.name !== undefined) updateFields.push(sql`name = ${data.name}`);
  if (data.code !== undefined) updateFields.push(sql`code = ${data.code}`);
  if (data.descr !== undefined) updateFields.push(sql`descr = ${data.descr}`);
  // ... add all updateable fields
  updateFields.push(sql`updated_ts = NOW()`);

  const result = await db.execute(sql`
    UPDATE app.project
    SET ${sql.join(updateFields, sql`, `)}
    WHERE id = ${id} AND active_flag = true
    RETURNING *
  `);

  if (!result.length) {
    return reply.status(404).send({ error: 'Not found' });
  }

  // STEP 3: Sync registry if name/code changed
  if (data.name !== undefined || data.code !== undefined) {
    await entityInfra.update_entity_instance_registry(ENTITY_CODE, id, {
      entity_name: data.name,
      instance_code: data.code
    });
  }

  return result[0];
});
```

---

## DELETE Pattern

### Factory Approach (Recommended)

```typescript
// Factory-generated DELETE endpoint with RBAC + cascade
createEntityDeleteEndpoint(fastify, ENTITY_CODE);
```

The factory handles:
- RBAC check (DELETE permission)
- Soft delete (set `active_flag = false`)
- Registry cleanup (HARD DELETE from entity_instance)
- Link cleanup (HARD DELETE from entity_instance_link)
- RBAC cleanup (HARD DELETE from entity_rbac)

### Manual Implementation (if needed)

```typescript
fastify.delete('/api/v1/project/:id', {
  preHandler: [fastify.authenticate],
  schema: {
    params: Type.Object({ id: Type.String({ format: 'uuid' }) })
  }
}, async (request, reply) => {
  const userId = (request as any).user?.sub;
  const { id } = request.params as any;

  const result = await entityInfra.delete_entity({
    entity_code: ENTITY_CODE,
    entity_id: id,
    user_id: userId,
    primary_table: 'app.project',
    hard_delete: false  // Soft delete for primary table
    // NOTE: entity_instance, entity_instance_link, entity_rbac are ALWAYS hard deleted
  });

  return reply.send(result);
});
```

---

## Metadata-Only Mode

> **v9.7.0**: Critical for frontend two-query architecture. Child entity tabs fetch metadata separately from data.

### When to Use

| Use Case | Request | Response |
|----------|---------|----------|
| Main entity list | `GET /api/v1/task` | Data with `metadata: {}` |
| Child entity tab data | `GET /api/v1/task?parent_entity_code=project&...` | Data with `metadata: {}` |
| Metadata for rendering | `GET /api/v1/task?content=metadata` | Metadata with `data: []` |

### Implementation Pattern

```typescript
// Check for metadata-only mode FIRST in route handler
if (content === 'metadata') {
  // Query for column names only (instant - no data scan)
  const columnsResult = await client.unsafe(
    `SELECT * FROM app.${ENTITY_CODE} WHERE 1=0`
  );
  const resultFields = columnsResult.columns?.map((c: any) => ({ name: c.name })) || [];

  // Parse requested components (default: table + form)
  const requestedComponents = view
    ? view.split(',').map((v: string) => v.trim())
    : ['entityListOfInstancesTable', 'entityInstanceFormContainer'];

  // Generate metadata response
  const response = await generateEntityResponse(ENTITY_CODE, [], {
    components: requestedComponents,
    metadataOnly: true,
    resultFields
  });

  return reply.send(response);
}
// Continue with normal data query...
```

---

## RBAC Permission Model

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

### Permission Resolution (4 Sources)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         PERMISSION RESOLUTION                                        │
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
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### RBAC Methods Quick Reference

| Method | Returns | Use Case |
|--------|---------|----------|
| `check_entity_rbac(userId, entity, id, perm)` | boolean | Single permission check (GET/:id, PUT, DELETE) |
| `get_entity_rbac_where_condition(userId, entity, perm, alias)` | SQL | List filtering (GET) |
| `set_entity_rbac_owner(userId, entity, id)` | void | Grant OWNER on create |

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
| `?is_urgent=true` | `is_*` | `e.is_urgent = true` |
| `?search=kitchen` | search | `(name ILIKE '%kitchen%' OR code ILIKE '%kitchen%' OR descr ILIKE '%kitchen%')` |

### Usage

```typescript
const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query as any, {
  searchFields: ['name', 'code', 'descr'],  // Fields for full-text search
  excludeFields: ['limit', 'offset', 'page', 'content', 'view']  // Auto-excluded
});
conditions.push(...autoFilters);
```

---

## Backend Response Formatting

### generateEntityResponse() Function

```typescript
// Primary API for all entity responses (async - v9.2.0+)
const response = await generateEntityResponse(
  entityCode: string,     // e.g., 'project'
  data: any[],            // Query result rows
  options?: {
    components?: string[];         // Component names for metadata
    total?: number;                // Pagination total
    limit?: number;
    offset?: number;
    resultFields?: { name: string }[];  // PostgreSQL column descriptors
    metadataOnly?: boolean;        // Skip data, return metadata only
    ref_data_entityInstance?: Record<string, Record<string, string>>;
  }
): Promise<EntityResponse>
```

### Pattern Detection Rules

Backend detects field types from column names:

| Pattern | renderType | inputType | Example |
|---------|------------|-----------|---------|
| `*_amt`, `*_price`, `*_cost` | `currency` | `number` | `budget_allocated_amt` |
| `dl__*` | `badge` | `select` | `dl__project_stage` |
| `*_date` | `date` | `date` | `start_date` |
| `*_ts`, `*_at` | `timestamp` | `datetime` | `created_ts` |
| `is_*`, `*_flag` | `boolean` | `checkbox` | `is_active`, `active_flag` |
| `*__*_id` | `entityInstanceId` | `entityInstanceId` | `manager__employee_id` |
| `*_id` | `entityInstanceId` | `entityInstanceId` | `business_id` |
| `*_pct` | `percentage` | `number` | `completion_pct` |
| `tags` | `array` | `tags` | `tags` |
| `metadata` | `json` | `json` | `metadata` |

---

## Frontend Integration (v9.7.0)

### Two-Query Architecture

> **Critical**: Frontend fetches data and metadata separately. Data endpoints return `metadata: {}` by design.

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    FRONTEND TWO-QUERY PATTERN (v9.7.0)                               │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  CASE 1: MAIN ENTITY LIST (/task)                                                   │
│  ════════════════════════════════                                                   │
│                                                                                      │
│  useEntityInstanceData('task', { limit: 100 })                                      │
│  └── GET /api/v1/task?limit=100                                                     │
│  └── Returns: { data: [...], metadata: {} }                                         │
│                                                                                      │
│  useEntityInstanceMetadata('task', 'entityListOfInstancesTable')                    │
│  └── GET /api/v1/task?content=metadata                                              │
│  └── Returns: { fields: [...], metadata: { viewType, editType } }                   │
│                                                                                      │
│                                                                                      │
│  CASE 2: CHILD ENTITY TAB (/project/:id/task)                                       │
│  ════════════════════════════════════════════                                       │
│                                                                                      │
│  useEntityInstanceData('task', {                                                    │
│    parent_entity_code: 'project',                                                   │
│    parent_entity_instance_id: projectId,                                            │
│    limit: 100                                                                       │
│  })                                                                                 │
│  └── GET /api/v1/task?parent_entity_code=project&parent_entity_instance_id=...     │
│  └── Backend: INNER JOIN entity_instance_link to filter by parent                  │
│  └── Returns: { data: [filtered tasks], metadata: {} }                              │
│                                                                                      │
│  useEntityInstanceMetadata('task', 'entityListOfInstancesTable')                    │
│  └── GET /api/v1/task?content=metadata  (SAME as CASE 1 - shared cache!)           │
│  └── Returns: { fields: [...], metadata: { viewType, editType } }                   │
│                                                                                      │
│  KEY INSIGHT: Metadata is ENTITY-TYPE level, not parent-dependent                   │
│  ────────────────────────────────────────────────────────────────                   │
│  • Task columns are the same whether viewed at /task or /project/:id/task           │
│  • Metadata cached once per entity type (30-min TTL)                                │
│  • Data varies by filters (5-min TTL)                                               │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Frontend Hooks

```typescript
// All imports from unified entry point
import {
  useEntityInstanceData,       // Data with parent filtering support
  useEntityInstanceMetadata,   // Metadata (30-min cache)
  useEntity,                   // Single entity
  useEntityMutation,           // Create/Update/Delete
} from '@/db/tanstack-index';

// Child entity tab in EntitySpecificInstancePage.tsx
const { data: childData, refData: childRefData, isLoading: childLoading }
  = useEntityInstanceData('task', {
      parent_entity_code: 'project',
      parent_entity_instance_id: projectId,
      limit: 100
    }, { enabled: !!projectId });

const { viewType: childViewType, editType: childEditType, isLoading: childMetadataLoading }
  = useEntityInstanceMetadata('task', 'entityListOfInstancesTable');

// Combine for component
const childMetadata = useMemo(() =>
  ({ viewType: childViewType, editType: childEditType }),
  [childViewType, childEditType]
);

// Render
<EntityListOfInstancesTable
  data={childData}
  metadata={childMetadata}
  ref_data_entityInstance={childRefData}
  loading={childLoading || childMetadataLoading}
/>
```

---

## Real-Time Cache Invalidation

### Architecture

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

## Complete Module Template

```typescript
// apps/api/src/modules/{entity}/routes.ts

import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db, client } from '@/db/index.js';
import { sql, SQL } from 'drizzle-orm';

import {
  getEntityInfrastructure,
  Permission,
  ALL_ENTITIES_ID
} from '@/services/entity-infrastructure.service.js';
import { generateEntityResponse } from '@/services/backend-formatter.service.js';
import { buildAutoFilters } from '@/lib/universal-filter-builder.js';
import { createEntityDeleteEndpoint } from '@/lib/entity-delete-route-factory.js';

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
        page: Type.Optional(Type.Number({ minimum: 1 })),
        content: Type.Optional(Type.String()),
        view: Type.Optional(Type.String()),
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
      offset: queryOffset,
      page,
      content,
      view,
      parent_entity_code,
      parent_entity_instance_id,
    } = request.query as any;

    const offset = page ? (page - 1) * limit : (queryOffset || 0);

    // METADATA-ONLY MODE
    if (content === 'metadata') {
      const columnsResult = await client.unsafe(`SELECT * FROM app.${ENTITY_CODE} WHERE 1=0`);
      const resultFields = columnsResult.columns?.map((c: any) => ({ name: c.name })) || [];
      const requestedComponents = view?.split(',').map((v: string) => v.trim())
        || ['entityListOfInstancesTable', 'entityInstanceFormContainer'];

      const response = await generateEntityResponse(ENTITY_CODE, [], {
        components: requestedComponents,
        metadataOnly: true,
        resultFields
      });
      return reply.send(response);
    }

    // BUILD JOINs
    const joins: SQL[] = [];
    if (parent_entity_code && parent_entity_instance_id) {
      joins.push(sql`
        INNER JOIN app.entity_instance_link eil
          ON eil.child_entity_code = ${ENTITY_CODE}
          AND eil.child_entity_instance_id = ${sql.raw(TABLE_ALIAS)}.id
          AND eil.entity_code = ${parent_entity_code}
          AND eil.entity_instance_id = ${parent_entity_instance_id}::uuid
      `);
    }

    // BUILD CONDITIONS
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
      FROM app.project ${sql.raw(TABLE_ALIAS)}
      ${joinClause}
      ${whereClause}
    `);
    const total = Number(countResult[0]?.total || 0);

    const rows = await db.execute(sql`
      SELECT DISTINCT ${sql.raw(TABLE_ALIAS)}.*
      FROM app.project ${sql.raw(TABLE_ALIAS)}
      ${joinClause}
      ${whereClause}
      ORDER BY ${sql.raw(TABLE_ALIAS)}.created_ts DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    // RESPONSE
    const ref_data_entityInstance = await entityInfra.build_ref_data_entityInstance(Array.from(rows));
    const response = await generateEntityResponse(ENTITY_CODE, Array.from(rows), {
      total, limit, offset, ref_data_entityInstance
    });
    return reply.send(response);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GET SINGLE - GET /api/v1/project/:id
  // ═══════════════════════════════════════════════════════════════════════════
  fastify.get('/api/v1/project/:id', {
    preHandler: [fastify.authenticate],
    schema: { params: Type.Object({ id: Type.String({ format: 'uuid' }) }) }
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    const { id } = request.params as any;

    const canView = await entityInfra.check_entity_rbac(userId, ENTITY_CODE, id, Permission.VIEW);
    if (!canView) return reply.status(403).send({ error: 'No permission to view' });

    const result = await db.execute(sql`SELECT * FROM app.project WHERE id = ${id} AND active_flag = true`);
    if (!result.length) return reply.status(404).send({ error: 'Not found' });

    const ref_data_entityInstance = await entityInfra.build_ref_data_entityInstance(Array.from(result));
    return { ...result[0], ref_data_entityInstance };
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATE - POST /api/v1/project
  // ═══════════════════════════════════════════════════════════════════════════
  fastify.post('/api/v1/project', {
    preHandler: [fastify.authenticate],
    schema: { body: Type.Object({ name: Type.String(), code: Type.Optional(Type.String()) }) }
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    const data = request.body as any;
    const { parent_entity_code, parent_entity_instance_id } = request.query as any;

    // Step 1: Can CREATE?
    const canCreate = await entityInfra.check_entity_rbac(userId, ENTITY_CODE, ALL_ENTITIES_ID, Permission.CREATE);
    if (!canCreate) return reply.status(403).send({ error: 'No permission to create' });

    // Step 2: Can EDIT parent?
    if (parent_entity_code && parent_entity_instance_id) {
      const canEditParent = await entityInfra.check_entity_rbac(userId, parent_entity_code, parent_entity_instance_id, Permission.EDIT);
      if (!canEditParent) return reply.status(403).send({ error: 'No permission to link to parent' });
    }

    // Step 3: INSERT
    const result = await db.execute(sql`
      INSERT INTO app.project (name, code, active_flag, created_ts, updated_ts)
      VALUES (${data.name}, ${data.code || `PROJ-${Date.now()}`}, true, NOW(), NOW())
      RETURNING *
    `);
    const entity = result[0] as any;

    // Step 4: Register
    await entityInfra.set_entity_instance_registry({
      entity_code: ENTITY_CODE, entity_id: entity.id,
      entity_name: entity.name, instance_code: entity.code
    });

    // Step 5: Grant OWNER
    await entityInfra.set_entity_rbac_owner(userId, ENTITY_CODE, entity.id);

    // Step 6: Link to parent
    if (parent_entity_code && parent_entity_instance_id) {
      await entityInfra.set_entity_instance_link({
        entity_code: parent_entity_code, entity_instance_id: parent_entity_instance_id,
        child_entity_code: ENTITY_CODE, child_entity_instance_id: entity.id,
        relationship_type: 'contains'
      });
    }

    return reply.status(201).send(entity);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // UPDATE - PUT /api/v1/project/:id
  // ═══════════════════════════════════════════════════════════════════════════
  fastify.put('/api/v1/project/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      body: Type.Object({ name: Type.Optional(Type.String()), code: Type.Optional(Type.String()) })
    }
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    const { id } = request.params as any;
    const data = request.body as any;

    const canEdit = await entityInfra.check_entity_rbac(userId, ENTITY_CODE, id, Permission.EDIT);
    if (!canEdit) return reply.status(403).send({ error: 'No permission to edit' });

    const updateFields: SQL[] = [];
    if (data.name !== undefined) updateFields.push(sql`name = ${data.name}`);
    if (data.code !== undefined) updateFields.push(sql`code = ${data.code}`);
    updateFields.push(sql`updated_ts = NOW()`);

    const result = await db.execute(sql`
      UPDATE app.project SET ${sql.join(updateFields, sql`, `)}
      WHERE id = ${id} AND active_flag = true RETURNING *
    `);
    if (!result.length) return reply.status(404).send({ error: 'Not found' });

    if (data.name !== undefined || data.code !== undefined) {
      await entityInfra.update_entity_instance_registry(ENTITY_CODE, id, {
        entity_name: data.name, instance_code: data.code
      });
    }

    return result[0];
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DELETE - DELETE /api/v1/project/:id (Factory)
  // ═══════════════════════════════════════════════════════════════════════════
  createEntityDeleteEndpoint(fastify, ENTITY_CODE);
}
```

---

## Related Documentation

| Document | Path | Description |
|----------|------|-------------|
| Entity Infrastructure Service | `docs/services/entity-infrastructure.service.md` | CRUD + RBAC + ref_data |
| Backend Formatter Service | `docs/services/backend-formatter.service.md` | Metadata generation |
| RBAC Infrastructure | `docs/rbac/RBAC_INFRASTRUCTURE.md` | Full RBAC details |
| Unified Cache Architecture | `docs/caching-frontend/NORMALIZED_CACHE_ARCHITECTURE.md` | Frontend cache |
| Frontend Dataset Formatter | `docs/services/frontend_datasetFormatter.md` | Frontend rendering |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 4.0.0 | 2025-12-01 | **Complete rewrite**: Added detailed backend execution flow, route code structure requirements, v9.7.0 two-query architecture, metadata-only mode documentation, complete module template |
| 3.0.0 | 2025-11-29 | Added parent filtering, real-time cache invalidation, simplified structure |
| 2.0.0 | 2025-01-17 | Route-owned queries + infrastructure service |
| 1.0.0 | 2025-01-10 | Initial documentation |
