# Entity Endpoint Design

> **Unified API patterns for all 45+ entity routes based on actual implementation**

## Overview

All entity routes (business, project, task, employee, etc.) follow **identical patterns** powered by the Entity Infrastructure Service. This document describes the actual implementation architecture, flow, and design patterns used across the platform.

**Key Principle**: Routes OWN their SQL queries. Services provide infrastructure add-ons.

## Architecture Stack

```
┌──────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
│  EntityListOfInstancesPage → API Call → /api/v1/project                │
└────────────────────────┬─────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────┐
│                   Fastify Route Handler                       │
│  apps/api/src/modules/project/routes.ts                      │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Module Constants (DRY)                             │    │
│  │  - ENTITY_CODE = 'project'                          │    │
│  │  - TABLE_ALIAS = 'e'                                │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Service Initialization                             │    │
│  │  - entityInfra = getEntityInfrastructure(db)        │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Request Validation (Typebox Schemas)               │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  RBAC Permission Check                              │    │
│  │  entityInfra.check_entity_rbac()                    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  ✅ ROUTE BUILDS SQL QUERY (Full Control)          │    │
│  │  - Custom SELECT/INSERT/UPDATE/DELETE               │    │
│  │  - JOINs, aggregations, business logic              │    │
│  │  - RBAC WHERE from service (helper)                 │    │
│  │  - Auto-filters from service (helper)               │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Infrastructure Operations (CREATE/UPDATE only)     │    │
│  │  - set_entity_instance_registry()                   │    │
│  │  - set_entity_rbac_owner()                          │    │
│  │  - set_entity_instance_link()                       │    │
│  │  - update_entity_instance_registry()                │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Response Formatting                                │    │
│  └─────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────┐
│         Entity Infrastructure Service (Add-On Helpers)        │
│  apps/api/src/services/entity-infrastructure.service.ts      │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  RBAC Methods (4 sources)                           │    │
│  │  - check_entity_rbac() → boolean                    │    │
│  │  - set_entity_rbac() → grant permission             │    │
│  │  - set_entity_rbac_owner() → grant OWNER            │    │
│  │  - get_entity_rbac_where_condition() → SQL WHERE    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Registry Methods                                   │    │
│  │  - set_entity_instance_registry() → upsert          │    │
│  │  - update_entity_instance_registry() → sync         │    │
│  │  - delete_entity_instance_registry() → hard delete  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Linkage Methods                                    │    │
│  │  - set_entity_instance_link() → create (idempotent) │    │
│  │  - get_entity_instance_link_children() → get IDs    │    │
│  │  - delete_entity_instance_link() → hard delete      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Metadata Methods                                   │    │
│  │  - get_entity() → entity type metadata              │    │
│  │  - get_all_entity() → all types                     │    │
│  │  - get_dynamic_child_entity_tabs() → child tabs     │    │
│  └─────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────┐
│            Supporting Libraries (Universal Helpers)           │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  buildAutoFilters()                                 │    │
│  │  Zero-config query filtering from column names      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  createEntityDeleteEndpoint()                       │    │
│  │  Factory-generated DELETE with cascading cleanup    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  createChildEntityEndpointsFromMetadata()           │    │
│  │  Auto-generate child endpoints from d_entity        │    │
│  └─────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────┐
│                    Database Layer                             │
│  PostgreSQL 14+ with 4 infrastructure + 46+ entity tables    │
│                                                               │
│  - entity (entity type metadata)                             │
│  - entity_instance (instance registry)                       │
│  - entity_instance_link (parent-child relationships)         │
│  - entity_rbac (permissions)                                 │
│  - d_project, d_task, d_business, ... (46+ entity tables)   │
└───────────────────────────────────────────────────────────────┘
```

## Standard Endpoint Catalog

Every entity route implements these endpoints:

| Endpoint | Method | Purpose | RBAC Check | Pattern |
|----------|--------|---------|------------|---------|
| `/api/v1/{entity}` | GET | List with pagination + RBAC filtering | VIEW (WHERE condition) | LIST |
| `/api/v1/{entity}/:id` | GET | Get single instance | VIEW on instance | GET |
| `/api/v1/{entity}` | POST | Create new instance | CREATE on type | 6-STEP CREATE |
| `/api/v1/{entity}/:id` | PATCH | Update instance | EDIT on instance | 3-STEP UPDATE |
| `/api/v1/{entity}/:id` | DELETE | Soft delete instance | DELETE on instance | Factory |
| `/api/v1/{parent}/:id/{child}` | GET | Get filtered children | VIEW on parent | Factory |

## Module Structure

### Required Imports

```typescript
import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

// ✨ Entity Infrastructure Service (REQUIRED)
import {
  getEntityInfrastructure,
  Permission,
  ALL_ENTITIES_ID
} from '@/services/entity-infrastructure.service.js';

// ✨ Universal Auto-Filter Builder (REQUIRED for LIST endpoints)
import { buildAutoFilters } from '@/lib/universal-filter-builder.js';

// Factory Functions (OPTIONAL - for entities with children/delete)
import { createEntityDeleteEndpoint } from '@/lib/entity-delete-route-factory.js';
import { createChildEntityEndpointsFromMetadata } from '@/lib/child-entity-route-factory.js';
```

### Module Constants

```typescript
// ========================================
// MODULE CONSTANTS (DRY Principle)
// ========================================
const ENTITY_CODE = 'project';  // Used in all RBAC, queries, messages
const TABLE_ALIAS = 'e';        // Consistent SQL alias for primary table
```

### Service Initialization

```typescript
export async function projectRoutes(fastify: FastifyInstance) {
  // ✨ Initialize Entity Infrastructure Service
  const entityInfra = getEntityInfrastructure(db);

  // ... endpoint handlers
}
```

## 6-Step CREATE Pattern

**ALL entity CREATE endpoints follow this exact pattern**:

```typescript
fastify.post('/api/v1/project', {
  preHandler: [fastify.authenticate],
  schema: {
    querystring: Type.Object({
      parent_code: Type.Optional(Type.String()),
      parent_id: Type.Optional(Type.String({ format: 'uuid' }))
    }),
    body: CreateProjectSchema
  }
}, async (request, reply) => {
  const { parent_code, parent_id } = request.query;
  const userId = request.user.sub;
  const data = request.body;

  // ═══════════════════════════════════════════════════════════════
  // STEP 1: RBAC CHECK 1 - Can user CREATE this entity type?
  // ═══════════════════════════════════════════════════════════════
  const canCreate = await entityInfra.check_entity_rbac(
    userId,
    ENTITY_CODE,
    ALL_ENTITIES_ID,  // Type-level permission
    Permission.CREATE
  );

  if (!canCreate) {
    return reply.status(403).send({ error: 'Forbidden' });
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 2: RBAC CHECK 2 - If linking to parent, can user EDIT parent?
  // ═══════════════════════════════════════════════════════════════
  if (parent_code && parent_id) {
    const canEditParent = await entityInfra.check_entity_rbac(
      userId,
      parent_code,
      parent_id,
      Permission.EDIT
    );

    if (!canEditParent) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 3: ✅ ROUTE OWNS INSERT into primary table
  // ═══════════════════════════════════════════════════════════════
  const result = await db.execute(sql`
    INSERT INTO app.d_project (
      code, name, descr, dl__project_stage,
      budget_allocated_amt, manager_employee_id, metadata
    )
    VALUES (
      ${data.code || `PROJ-${Date.now()}`},
      ${data.name || 'Untitled Project'},
      ${data.descr},
      ${data.dl__project_stage || 'planning'},
      ${data.budget_allocated_amt},
      ${data.manager_employee_id},
      ${data.metadata || {}}
    )
    RETURNING *
  `);

  const project = result[0];

  // ═══════════════════════════════════════════════════════════════
  // STEP 4: Register in entity_instance
  // ═══════════════════════════════════════════════════════════════
  await entityInfra.set_entity_instance_registry({
    entity_type: ENTITY_CODE,
    entity_id: project.id,
    entity_name: project.name,
    entity_code: project.code
  });

  // ═══════════════════════════════════════════════════════════════
  // STEP 5: Grant OWNER permission to creator
  // ═══════════════════════════════════════════════════════════════
  await entityInfra.set_entity_rbac_owner(userId, ENTITY_CODE, project.id);

  // ═══════════════════════════════════════════════════════════════
  // STEP 6: Link to parent (if provided)
  // ═══════════════════════════════════════════════════════════════
  if (parent_code && parent_id) {
    await entityInfra.set_entity_instance_link({
      parent_entity_type: parent_code,
      parent_entity_id: parent_id,
      child_entity_type: ENTITY_CODE,
      child_entity_id: project.id,
      relationship_type: 'contains'
    });
  }

  return reply.status(201).send(project);
});
```

**Key Points**:
- ✅ Steps 1-2: RBAC checks via service
- ✅ Step 3: Route OWNS the INSERT query
- ✅ Steps 4-6: Infrastructure operations via service

## 3-Step UPDATE Pattern

**ALL entity UPDATE endpoints follow this exact pattern**:

```typescript
fastify.patch('/api/v1/project/:id', {
  preHandler: [fastify.authenticate],
  schema: {
    params: Type.Object({
      id: Type.String({ format: 'uuid' })
    }),
    body: UpdateProjectSchema
  }
}, async (request, reply) => {
  const { id } = request.params;
  const updates = request.body;
  const userId = request.user.sub;

  // ═══════════════════════════════════════════════════════════════
  // STEP 1: RBAC check - Can user EDIT this entity?
  // ═══════════════════════════════════════════════════════════════
  const canEdit = await entityInfra.check_entity_rbac(
    userId,
    ENTITY_CODE,
    id,
    Permission.EDIT
  );

  if (!canEdit) {
    return reply.status(403).send({ error: 'Forbidden' });
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 2: ✅ ROUTE OWNS UPDATE query
  // ═══════════════════════════════════════════════════════════════
  const updateFields: any[] = [];

  if (updates.name !== undefined) updateFields.push(sql`name = ${updates.name}`);
  if (updates.code !== undefined) updateFields.push(sql`code = ${updates.code}`);
  if (updates.descr !== undefined) updateFields.push(sql`descr = ${updates.descr}`);
  if (updates.dl__project_stage !== undefined) {
    updateFields.push(sql`dl__project_stage = ${updates.dl__project_stage}`);
  }
  // ... more fields

  // Always update these
  updateFields.push(sql`updated_ts = now()`);
  updateFields.push(sql`version = version + 1`);

  if (updateFields.length === 0) {
    return reply.status(400).send({ error: 'No fields to update' });
  }

  const result = await db.execute(sql`
    UPDATE app.d_project
    SET ${sql.join(updateFields, sql`, `)}
    WHERE id = ${id}
    RETURNING *
  `);

  if (result.length === 0) {
    return reply.status(404).send({ error: 'Project not found' });
  }

  const project = result[0];

  // ═══════════════════════════════════════════════════════════════
  // STEP 3: Sync registry if name/code changed
  // ═══════════════════════════════════════════════════════════════
  if (updates.name !== undefined || updates.code !== undefined) {
    await entityInfra.update_entity_instance_registry(ENTITY_CODE, id, {
      entity_name: updates.name,
      entity_code: updates.code
    });
  }

  return reply.send(project);
});
```

**Key Points**:
- ✅ Step 1: RBAC check via service
- ✅ Step 2: Route OWNS the UPDATE query
- ✅ Step 3: Registry sync via service (if needed)

## LIST Pattern (Route Builds Query)

**ALL entity LIST endpoints follow this pattern**:

```typescript
fastify.get('/api/v1/project', {
  preHandler: [fastify.authenticate],
  schema: {
    querystring: Type.Object({
      limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
      offset: Type.Optional(Type.Number({ minimum: 0 })),
      page: Type.Optional(Type.Number({ minimum: 1 })),
      search: Type.Optional(Type.String()),
      parent_code: Type.Optional(Type.String()),
      parent_id: Type.Optional(Type.String({ format: 'uuid' })),
      dl__project_stage: Type.Optional(Type.String())
      // ... entity-specific query params
    })
  }
}, async (request, reply) => {
  const { limit = 20, offset: queryOffset, page, search } = request.query;
  const offset = page ? (page - 1) * limit : (queryOffset || 0);
  const userId = request.user.sub;

  // ═══════════════════════════════════════════════════════════════
  // Build WHERE conditions array
  // ═══════════════════════════════════════════════════════════════
  const conditions: SQL[] = [];

  // REQUIRED: RBAC filtering
  const rbacCondition = await entityInfra.get_entity_rbac_where_condition(
    userId,
    ENTITY_CODE,
    Permission.VIEW,
    TABLE_ALIAS
  );
  conditions.push(rbacCondition);

  // DEFAULT: Only active records (soft delete filter)
  if (!('active' in (request.query as any))) {
    conditions.push(sql`${sql.raw(TABLE_ALIAS)}.active_flag = true`);
  }

  // UNIVERSAL AUTO-FILTER: Auto-detect filter types from query params
  const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query, {
    searchFields: ['name', 'descr', 'code']
  });
  conditions.push(...autoFilters);

  // ═══════════════════════════════════════════════════════════════
  // ✅ ROUTE BUILDS QUERY (full control over JOINs, columns, etc.)
  // ═══════════════════════════════════════════════════════════════
  const query = sql`
    SELECT
      e.*,
      b.name as business_name,
      m.name as manager_name,
      COUNT(t.id) as task_count
    FROM app.d_project e
    LEFT JOIN app.d_business b ON e.business_id = b.id
    LEFT JOIN app.d_employee m ON e.manager_employee_id = m.id
    LEFT JOIN app.d_task t ON t.project_id = e.id
    WHERE ${sql.join(conditions, sql` AND `)}
    GROUP BY e.id, b.name, m.name
    ORDER BY e.created_ts DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const projects = await db.execute(query);

  // Count total (for pagination)
  const countQuery = sql`
    SELECT COUNT(*) as total
    FROM app.d_project e
    WHERE ${sql.join(conditions, sql` AND `)}
  `;
  const countResult = await db.execute(countQuery);
  const total = Number(countResult[0]?.total || 0);

  return reply.send({
    data: projects,
    total,
    limit,
    offset
  });
});
```

**Key Points**:
- ✅ RBAC WHERE condition from service (helper)
- ✅ Auto-filters from service (helper)
- ✅ Route OWNS the query (SELECT, JOINs, GROUP BY)

## GET Single Instance Pattern

```typescript
fastify.get('/api/v1/project/:id', {
  preHandler: [fastify.authenticate],
  schema: {
    params: Type.Object({
      id: Type.String({ format: 'uuid' })
    })
  }
}, async (request, reply) => {
  const { id } = request.params;
  const userId = request.user.sub;

  // RBAC check
  const canView = await entityInfra.check_entity_rbac(
    userId,
    ENTITY_CODE,
    id,
    Permission.VIEW
  );

  if (!canView) {
    return reply.status(403).send({ error: 'Forbidden' });
  }

  // ✅ Route builds query with JOINs
  const result = await db.execute(sql`
    SELECT
      e.*,
      b.name as business_name,
      m.name as manager_name,
      s.name as sponsor_name
    FROM app.d_project e
    LEFT JOIN app.d_business b ON e.business_id = b.id
    LEFT JOIN app.d_employee m ON e.manager_employee_id = m.id
    LEFT JOIN app.d_employee s ON e.sponsor_employee_id = s.id
    WHERE e.id = ${id}
  `);

  if (result.length === 0) {
    return reply.status(404).send({ error: 'Project not found' });
  }

  return reply.send(result[0]);
});
```

## Factory-Generated Endpoints

### DELETE Endpoint (Factory)

```typescript
// Auto-generates: DELETE /api/v1/project/:id
// Includes RBAC check, soft delete, and optional cascading
createEntityDeleteEndpoint(fastify, {
  entityType: ENTITY_CODE,
  tableAlias: TABLE_ALIAS,
  primaryTableCallback: async (db, id) => {
    await db.execute(sql`
      UPDATE app.d_project
      SET active_flag = false, updated_ts = now()
      WHERE id = ${id}
    `);
  }
});
```

### Child Entity Endpoints (Factory)

```typescript
// Auto-generates ALL child endpoints from d_entity.child_entities:
// GET /api/v1/project/:id/task
// GET /api/v1/project/:id/wiki
// GET /api/v1/project/:id/artifact
// GET /api/v1/project/:id/form
// GET /api/v1/project/:id/expense
// GET /api/v1/project/:id/revenue
await createChildEntityEndpointsFromMetadata(fastify, ENTITY_CODE);
```

## RBAC Permission Model

### Permission Hierarchy (0-7)

```typescript
export enum Permission {
  VIEW = 0,       // Read-only access
  COMMENT = 1,    // Add comments (implies VIEW)
  EDIT = 3,       // Modify entity (implies COMMENT + VIEW)
  SHARE = 4,      // Share with others (implies EDIT + COMMENT + VIEW)
  DELETE = 5,     // Soft delete (implies SHARE + EDIT + COMMENT + VIEW)
  CREATE = 6,     // Create new entities (type-level only)
  OWNER = 7       // Full control (implies ALL permissions)
}
```

### Type-Level Permissions

```typescript
// Special ID for type-level permissions
export const ALL_ENTITIES_ID = '11111111-1111-1111-1111-111111111111';

// Grant user permission to CREATE all projects
await entityInfra.set_entity_rbac(
  userId,
  'project',
  ALL_ENTITIES_ID,
  Permission.CREATE
);
```

### Permission Resolution (4 Sources)

1. **Direct Employee Permissions** - `entity_rbac` where `person_code='employee'`
2. **Role-Based Permissions** - `entity_rbac` where `person_code='role'`
3. **Parent-VIEW Inheritance** - If parent has VIEW (≥0), child gains VIEW
4. **Parent-CREATE Inheritance** - If parent has CREATE (≥6), child gains CREATE

**Result**: MAX permission level from all 4 sources

## Universal Auto-Filter System

Auto-detects filter types from column naming conventions:

```typescript
// In LIST endpoint
const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query, {
  searchFields: ['name', 'descr', 'code']
});
```

**Auto-detected patterns**:

| Query Param | Detection | SQL Generated |
|-------------|-----------|---------------|
| `?dl__project_stage=planning` | Settings dropdown | `e.dl__project_stage = 'planning'` |
| `?manager_employee_id=uuid` | UUID reference | `e.manager_employee_id = 'uuid'::uuid` |
| `?budget_allocated_amt=50000` | Currency | `e.budget_allocated_amt = 50000` |
| `?active=true` | Boolean | `e.active_flag = true` |
| `?search=kitchen` | Multi-field | `(e.name ILIKE '%kitchen%' OR e.descr ILIKE '%kitchen%')` |

## Component Data Flow

### Request Flow Diagram

```
1. HTTP Request
   ↓
2. Fastify Authentication Middleware
   • Extract JWT token
   • Attach userId to request.user.sub
   ↓
3. Route Handler (project/routes.ts)
   • Initialize Entity Infrastructure Service
   • Extract query params, body, path params
   ↓
4. RBAC Check (Entity Infrastructure Service)
   • Query 4 permission sources
   • Resolve MAX permission
   • Return boolean or SQL WHERE fragment
   ↓
5. Query Building (ROUTE OWNS THIS)
   • Build custom SELECT/INSERT/UPDATE/DELETE
   • Add JOINs for related data
   • Add RBAC WHERE condition (from service)
   • Add auto-filters (from service)
   • Add custom business logic filters
   ↓
6. Database Execution
   • Execute composed SQL query
   • PostgreSQL handles all filtering server-side
   ↓
7. Infrastructure Operations (CREATE/UPDATE only)
   • set_entity_instance_registry() - register instance
   • set_entity_rbac_owner() - grant permission
   • set_entity_instance_link() - create linkage
   • update_entity_instance_registry() - sync name/code
   ↓
8. Response Formatting
   • Format as JSON
   • Include pagination metadata (LIST)
   • Return with status code
```

### Data Flow Components

```
┌─────────────────────────────────────────────────────────┐
│  Entity Infrastructure Service                          │
│  (Manages 4 infrastructure tables)                      │
│                                                          │
│  ┌────────────────┐  ┌────────────────┐               │
│  │  entity        │  │  entity_       │               │
│  │  (metadata)    │  │  instance      │               │
│  │                │  │  (registry)    │               │
│  └────────────────┘  └────────────────┘               │
│                                                          │
│  ┌────────────────┐  ┌────────────────┐               │
│  │  entity_       │  │  entity_rbac   │               │
│  │  instance_link │  │  (permissions) │               │
│  └────────────────┘  └────────────────┘               │
│                                                          │
│  Service provides helper methods:                       │
│  • check_entity_rbac() → boolean                        │
│  • get_entity_rbac_where_condition() → SQL WHERE        │
│  • set_entity_instance_registry() → upsert              │
│  • set_entity_rbac_owner() → grant OWNER                │
│  • set_entity_instance_link() → create link             │
│  • update_entity_instance_registry() → sync             │
│  • get_dynamic_child_entity_tabs() → metadata           │
└─────────────────────────────────────────────────────────┘
```

## Implementation Examples

### business/routes.ts

**Source**: `apps/api/src/modules/business/routes.ts`

```typescript
const ENTITY_CODE = 'business';
const TABLE_ALIAS = 'e';
const entityInfra = getEntityInfrastructure(db);

// Follows exact same patterns:
// - 6-step CREATE
// - 3-step UPDATE
// - LIST with RBAC + auto-filters
// - GET with RBAC check
// - Factory DELETE
// - Factory child endpoints
```

### project/routes.ts

**Source**: `apps/api/src/modules/project/routes.ts`

```typescript
const ENTITY_CODE = 'project';
const TABLE_ALIAS = 'e';
const entityInfra = getEntityInfrastructure(db);

// Identical patterns - zero variation
```

### task/routes.ts

**Source**: `apps/api/src/modules/task/routes.ts`

```typescript
const ENTITY_CODE = 'task';
const TABLE_ALIAS = 't';
const entityInfra = getEntityInfrastructure(db);

// Identical patterns - 100% consistency
```

## Benefits

### 80% Code Reduction

**Before** (Manual):
- 200+ lines for RBAC
- 100+ lines for registry
- 50+ lines for linkage
- **Total**: 350+ lines per route

**After** (Service):
- 5 lines for RBAC
- 3 lines for registry
- 2 lines for linkage
- **Total**: 10 lines per route

### 100% Consistency

- ✅ Same RBAC logic across all 45+ routes
- ✅ Same CREATE pattern
- ✅ Same UPDATE pattern
- ✅ Same LIST pattern
- ✅ Zero drift

## Anti-Patterns (Avoid)

❌ **Service builds queries for routes**:
```typescript
// WRONG - Routes must own queries
const projects = await entityInfra.getAll('project');
```

❌ **Routes bypass service for RBAC**:
```typescript
// WRONG - Must use service
const result = await db.execute(sql`SELECT * FROM d_project WHERE id = ${id}`);
```

❌ **Inconsistent patterns**:
```typescript
// WRONG - All routes must follow same patterns
```

## Related Documentation

- **Entity Infrastructure Service**: `/docs/services/entity-infrastructure.service.md`
- **Universal Formatter Service**: `/docs/services/frontEndFormatterService.md`
- **Data Model**: `/docs/datamodel/README.md`

## Version History

- **2025-01-17** - Complete rewrite based on actual implementation
- **Pattern**: Route-Owned Queries + Infrastructure Service Add-Ons
- **Coverage**: All 45+ entity routes
