# Entity Endpoint Design

> **Unified API patterns for 45+ entity routes with RBAC, parent filtering, and real-time cache sync**

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

---

## 1. Standard Endpoints

| Endpoint | Method | RBAC | Key Features |
|----------|--------|------|--------------|
| `/api/v1/{entity}` | GET | VIEW (WHERE) | Pagination, parent filter, auto-filters |
| `/api/v1/{entity}/:id` | GET | VIEW | Single instance with JOINs |
| `/api/v1/{entity}` | POST | CREATE + EDIT parent | 6-step transactional pattern |
| `/api/v1/{entity}/:id` | PATCH/PUT | EDIT | Update with registry sync |
| `/api/v1/{entity}/:id` | DELETE | DELETE | Soft delete with cascade |
| `/api/v1/{parent}/:id/{child}` | GET | VIEW parent | Factory-generated child endpoints |

---

## 2. Module Structure

### Required Imports

```typescript
import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql, SQL } from 'drizzle-orm';
import { createPaginatedResponse } from '@/lib/universal-schema-metadata.js';

// Core services
import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID } from '@/services/entity-infrastructure.service.js';
import { buildAutoFilters } from '@/lib/universal-filter-builder.js';
import { createEntityDeleteEndpoint } from '@/lib/entity-delete-route-factory.js';
import { createChildEntityEndpointsFromMetadata } from '@/lib/child-entity-route-factory.js';
```

### Module Constants (DRY)

```typescript
const ENTITY_CODE = 'project';  // Entity type code
const TABLE_ALIAS = 'e';        // SQL alias for primary table
```

### Service Initialization

```typescript
export async function projectRoutes(fastify: FastifyInstance) {
  const entityInfra = getEntityInfrastructure(db);
  // ... endpoints
}
```

---

## 3. LIST Pattern (with Parent Filtering)

### Query Parameters

```typescript
querystring: Type.Object({
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
  offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
  page: Type.Optional(Type.Number({ minimum: 1 })),
  search: Type.Optional(Type.String()),
  // Parent filtering
  parent_entity_code: Type.Optional(Type.String()),
  parent_entity_instance_id: Type.Optional(Type.String({ format: 'uuid' })),
  // Entity-specific filters auto-detected
})
```

### Implementation Flow

```typescript
fastify.get('/api/v1/project', {
  preHandler: [fastify.authenticate],
  schema: { querystring: ... }
}, async (request, reply) => {
  const userId = (request as any).user?.sub;
  if (!userId) return reply.status(401).send({ error: 'User not authenticated' });

  const {
    limit = 20,
    offset: queryOffset,
    page,
    parent_entity_code,
    parent_entity_instance_id
  } = request.query as any;

  const offset = page ? (page - 1) * limit : (queryOffset || 0);

  // ═══════════════════════════════════════════════════════════════
  // BUILD JOINs - Parent filtering via entity_instance_link
  // ═══════════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════════
  // BUILD WHERE conditions
  // ═══════════════════════════════════════════════════════════════
  const conditions: SQL[] = [];

  // RBAC filtering (required)
  const rbacWhereClause = await entityInfra.get_entity_rbac_where_condition(
    userId, ENTITY_CODE, Permission.VIEW, TABLE_ALIAS
  );
  conditions.push(rbacWhereClause);

  // Auto-filters from query params
  const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query as any, {
    searchFields: ['name', 'code', 'descr']
  });
  conditions.push(...autoFilters);

  // ═══════════════════════════════════════════════════════════════
  // EXECUTE QUERIES
  // ═══════════════════════════════════════════════════════════════
  const joinClause = joins.length > 0 ? sql.join(joins, sql` `) : sql``;
  const whereClause = conditions.length > 0
    ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
    : sql``;

  // Count with DISTINCT (required when JOINing)
  const countResult = await db.execute(sql`
    SELECT COUNT(DISTINCT ${sql.raw(TABLE_ALIAS)}.id) as total
    FROM app.project ${sql.raw(TABLE_ALIAS)}
    ${joinClause}
    ${whereClause}
  `);
  const total = Number(countResult[0]?.total || 0);

  // Data query
  const rows = await db.execute(sql`
    SELECT DISTINCT ${sql.raw(TABLE_ALIAS)}.*
    FROM app.project ${sql.raw(TABLE_ALIAS)}
    ${joinClause}
    ${whereClause}
    ORDER BY ${sql.raw(TABLE_ALIAS)}.created_ts DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  return createPaginatedResponse(rows, total, limit, offset);
});
```

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LIST ENDPOINT DATA FLOW                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Request: GET /api/v1/task?parent_entity_code=project&parent_entity_instance_id=uuid
│                                                                              │
│  1. Extract params                                                           │
│     └── { parent_entity_code: 'project', parent_entity_instance_id: 'uuid' }│
│                                                                              │
│  2. Build JOINs (parent filtering)                                          │
│     └── INNER JOIN app.entity_instance_link eil                             │
│           ON eil.child_entity_code = 'task'                                 │
│           AND eil.child_entity_instance_id = t.id                           │
│           AND eil.entity_code = 'project'                                   │
│           AND eil.entity_instance_id = 'uuid'::uuid                         │
│                                                                              │
│  3. Build WHERE (RBAC + filters)                                            │
│     └── WHERE (RBAC condition) AND (auto-filters)                           │
│                                                                              │
│  4. Execute COUNT(DISTINCT) + SELECT DISTINCT                               │
│                                                                              │
│  5. Return: { data: [...], total: N, limit: 20, offset: 0 }                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. GET Single Instance Pattern

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
    SELECT * FROM app.project WHERE id = ${id}
  `);

  if (!result.length) return reply.status(404).send({ error: 'Not found' });
  return result[0];
});
```

---

## 5. CREATE Pattern (6-Step Transactional)

```typescript
fastify.post('/api/v1/project', {
  preHandler: [fastify.authenticate],
  schema: { body: CreateSchema }
}, async (request, reply) => {
  const userId = (request as any).user?.sub;
  const data = request.body as any;
  const { parent_entity_code, parent_entity_instance_id } = request.query as any;

  // ═══════════════════════════════════════════════════════════════
  // STEP 1: RBAC - Can user CREATE this entity type?
  // ═══════════════════════════════════════════════════════════════
  const canCreate = await entityInfra.check_entity_rbac(
    userId, ENTITY_CODE, ALL_ENTITIES_ID, Permission.CREATE
  );
  if (!canCreate) {
    return reply.status(403).send({ error: 'No permission to create' });
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 2: RBAC - If linking to parent, can user EDIT parent?
  // ═══════════════════════════════════════════════════════════════
  if (parent_entity_code && parent_entity_instance_id) {
    const canEditParent = await entityInfra.check_entity_rbac(
      userId, parent_entity_code, parent_entity_instance_id, Permission.EDIT
    );
    if (!canEditParent) {
      return reply.status(403).send({ error: 'No permission to link to parent' });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 3: INSERT into primary table (route owns query)
  // ═══════════════════════════════════════════════════════════════
  const result = await db.execute(sql`
    INSERT INTO app.project (code, name, descr, ...)
    VALUES (${data.code}, ${data.name}, ${data.descr}, ...)
    RETURNING *
  `);
  const entity = result[0] as any;

  // ═══════════════════════════════════════════════════════════════
  // STEP 4: Register in entity_instance
  // ═══════════════════════════════════════════════════════════════
  await entityInfra.set_entity_instance_registry({
    entity_code: ENTITY_CODE,
    entity_id: entity.id,
    entity_name: entity.name,
    instance_code: entity.code
  });

  // ═══════════════════════════════════════════════════════════════
  // STEP 5: Grant OWNER permission to creator
  // ═══════════════════════════════════════════════════════════════
  await entityInfra.set_entity_rbac_owner(userId, ENTITY_CODE, entity.id);

  // ═══════════════════════════════════════════════════════════════
  // STEP 6: Link to parent (if provided)
  // ═══════════════════════════════════════════════════════════════
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

## 6. UPDATE Pattern (3-Step)

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
  // ... more fields
  updateFields.push(sql`updated_ts = NOW()`);

  const result = await db.execute(sql`
    UPDATE app.project
    SET ${sql.join(updateFields, sql`, `)}
    WHERE id = ${id}
    RETURNING *
  `);

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

## 7. DELETE Pattern (Factory)

```typescript
// Factory-generated DELETE endpoint with RBAC + cascade
createEntityDeleteEndpoint(fastify, ENTITY_CODE);
```

The factory handles:
- RBAC check (DELETE permission)
- Soft delete (set `active_flag = false`)
- Registry cleanup
- Link cleanup
- Child cascade (optional)

---

## 8. RBAC Permission Model

### Permission Levels

```typescript
enum Permission {
  VIEW   = 0,  // Read access
  EDIT   = 1,  // Modify (implies VIEW)
  SHARE  = 2,  // Share (implies EDIT)
  DELETE = 3,  // Delete (implies SHARE)
  CREATE = 4,  // Create new (type-level only)
  OWNER  = 5   // Full control
}

// Type-level permission check constant
const ALL_ENTITIES_ID = '11111111-1111-1111-1111-111111111111';
```

### Permission Resolution (4 Sources)

```
1. Direct Employee    → entity_rbac WHERE person_code='employee'
2. Role-Based         → entity_rbac WHERE person_code='role'
3. Parent-VIEW        → Inherited from parent
4. Parent-CREATE      → Inherited from parent

Result: MAX(all sources)
```

### RBAC Methods

| Method | Returns | Use Case |
|--------|---------|----------|
| `check_entity_rbac(userId, entity, id, perm)` | boolean | Single permission check |
| `get_entity_rbac_where_condition(userId, entity, perm, alias)` | SQL | List filtering |
| `set_entity_rbac_owner(userId, entity, id)` | void | Grant OWNER on create |

---

## 9. Auto-Filter System

The `buildAutoFilters()` function auto-detects filter types from column naming:

| Query Param | Pattern | Generated SQL |
|-------------|---------|---------------|
| `?dl__project_stage=planning` | `dl__*` | `e.dl__project_stage = 'planning'` |
| `?manager__employee_id=uuid` | `*__*_id` | `e.manager__employee_id = 'uuid'::uuid` |
| `?budget_amt=50000` | `*_amt` | `e.budget_amt = 50000` |
| `?active_flag=true` | `*_flag` | `e.active_flag = true` |
| `?search=kitchen` | search | `(name ILIKE '%kitchen%' OR code ILIKE...)` |

---

## 10. Real-Time Cache Invalidation

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REAL-TIME CACHE INVALIDATION FLOW                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. API writes to database                                                   │
│     └── INSERT/UPDATE/DELETE on app.project                                 │
│                                                                              │
│  2. PostgreSQL trigger fires                                                 │
│     └── Writes to app.system_logging (entity_code, entity_id, operation)   │
│                                                                              │
│  3. LogWatcher polls app.system_logging                                     │
│     └── Every 60s, reads pending changes                                    │
│                                                                              │
│  4. PubSub broadcasts via WebSocket (:4001)                                 │
│     └── NOTIFY { entity_code: 'project', entity_id: 'uuid', op: 'UPDATE' } │
│                                                                              │
│  5. Frontend WebSocketManager receives                                       │
│     └── queryClient.invalidateQueries(['project', 'uuid'])                  │
│                                                                              │
│  6. TanStack Query auto-refetches                                           │
│     └── Fresh data rendered to user                                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Database Tables

```sql
-- Log table for pending changes
CREATE TABLE app.system_logging (
  id SERIAL PRIMARY KEY,
  entity_code VARCHAR(50),
  entity_id UUID,
  operation VARCHAR(10),  -- INSERT, UPDATE, DELETE
  created_ts TIMESTAMP DEFAULT NOW(),
  processed_flag BOOLEAN DEFAULT FALSE
);

-- Subscription registry
CREATE TABLE app.system_cache_subscription (
  id UUID PRIMARY KEY,
  client_id VARCHAR(100),
  entity_code VARCHAR(50),
  entity_id UUID,
  subscribed_ts TIMESTAMP DEFAULT NOW()
);
```

---

## 11. Frontend Integration

### 4-Layer Normalized Cache

```
Layer 1: Entity Codes     → Entity type metadata (icon, label, children)
Layer 2: Entity Instances → Instance registry (id → name lookup)
Layer 3: Entity Links     → Parent-child relationship graph
Layer 4: Entity Names     → ref_data_entityInstance for O(1) name resolution
```

### React Hooks

```typescript
// TanStack Query + Dexie (IndexedDB)
const { data, isLoading } = useEntity('project', projectId);
const { data: projects, total } = useEntityList('project', { limit: 50 });
const { updateEntity, deleteEntity } = useEntityMutation('project');

// Sync cache (non-hook access)
import { getDatalabelSync, getEntityCodesSync } from '@/db/tanstack-index';
```

---

## 12. Complete Module Example

```typescript
import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql, SQL } from 'drizzle-orm';
import { createPaginatedResponse } from '@/lib/universal-schema-metadata.js';
import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID } from '@/services/entity-infrastructure.service.js';
import { buildAutoFilters } from '@/lib/universal-filter-builder.js';
import { createEntityDeleteEndpoint } from '@/lib/entity-delete-route-factory.js';

const ENTITY_CODE = 'project';
const TABLE_ALIAS = 'e';

export async function projectRoutes(fastify: FastifyInstance) {
  const entityInfra = getEntityInfrastructure(db);

  // LIST with parent filtering
  fastify.get('/api/v1/project', { /* ... */ });

  // GET single
  fastify.get('/api/v1/project/:id', { /* ... */ });

  // CREATE (6-step)
  fastify.post('/api/v1/project', { /* ... */ });

  // UPDATE (3-step)
  fastify.put('/api/v1/project/:id', { /* ... */ });

  // DELETE (factory)
  createEntityDeleteEndpoint(fastify, ENTITY_CODE);

  // Child endpoints (factory)
  // await createChildEntityEndpointsFromMetadata(fastify, ENTITY_CODE);
}
```

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2025-11-29 | 3.0.0 | Added parent filtering, real-time cache invalidation, simplified structure |
| 2025-01-17 | 2.0.0 | Route-owned queries + infrastructure service |
| 2025-01-10 | 1.0.0 | Initial documentation |
