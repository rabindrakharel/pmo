# PMO Platform API Developer Guide

> **Complete guide for developing APIs following strict PMO Platform standards**
> Version: 4.0.0 | Last Updated: 2025-11-12

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Authentication & Authorization](#authentication--authorization)
3. [Factory Patterns (DRY API Development)](#factory-patterns-dry-api-development)
4. [Entity API Development Workflow](#entity-api-development-workflow)
5. [ORM Usage (Drizzle)](#orm-usage-drizzle)
6. [Data Flow Architecture](#data-flow-architecture)
7. [Standards & Enforcement](#standards--enforcement)
8. [Decision Trees (What Pattern When)](#decision-trees-what-pattern-when)
9. [Testing & Debugging](#testing--debugging)
10. [Common Patterns & Examples](#common-patterns--examples)

---

## Overview

The PMO Platform API follows a **DRY-first, factory-driven architecture** that serves **48 API modules** covering **27+ entity types** through universal patterns. This guide enforces **strict standards** to ensure consistency, maintainability, and security.

### Core Principles

1. **Never duplicate route logic** - Use factory functions
2. **Always enforce RBAC** - Every endpoint requires authentication + permission checks
3. **Type-safe ORM** - Use Drizzle with proper TypeScript types
4. **Soft deletes only** - Never hard-delete records
5. **Audit trail** - Track created_ts, updated_ts, created_by, updated_by
6. **Pagination by default** - List endpoints must paginate
7. **Universal error handling** - Use standardized error responses

### Platform Statistics

| Metric | Count |
|--------|-------|
| **API Modules** | 48 |
| **Entity Types** | 27+ |
| **Database Tables** | 50 |
| **Endpoints** | 200+ |
| **Factory Patterns** | 2 (Child Entity, Delete) |

---

## Authentication & Authorization

### JWT Authentication Flow

```
1. User Login
   POST /api/v1/auth/login
   Body: { email, password }
   Response: { token, user }

2. Request with Token
   GET /api/v1/project
   Header: Authorization: Bearer <token>

3. Token Verification
   fastify.authenticate hook decodes JWT
   Extracts user ID from token.sub

4. RBAC Check
   Query app.entity_rbac
   Check permissions for resource

5. Execute Request
   If authorized, proceed with business logic
```

### Implementation Standards

#### ✅ CORRECT: Every Route Must Authenticate

```typescript
// apps/api/src/modules/project/routes.ts
import type { FastifyInstance } from 'fastify';

export async function projectRoutes(fastify: FastifyInstance) {
  // LIST endpoint with authentication
  fastify.get('/api/v1/project', {
    preHandler: [fastify.authenticate],  // ⭐ REQUIRED
    handler: async (request, reply) => {
      // Extract user from JWT
      const userId = request.user.sub;

      // Check RBAC permissions
      const access = await db.execute(sql`
        SELECT 1 FROM app.entity_rbac rbac
        WHERE rbac.empid = ${userId}
          AND rbac.entity = 'project'
          AND (rbac.entity_id = 'all' OR rbac.entity_id = ${id}::text)
          AND rbac.active_flag = true
          AND 0 = ANY(rbac.permission)
      `);

      if (access.length === 0) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      // Business logic...
    }
  });
}
```

#### ❌ WRONG: No Authentication

```typescript
// NEVER do this - security vulnerability!
fastify.get('/api/v1/project', async (request, reply) => {
  // ❌ Missing preHandler: [fastify.authenticate]
  // ❌ No RBAC check
  // Anyone can access this endpoint!
});
```

### RBAC Permission System

**Standard:** Use unified scope-based permissions from `app.entity_rbac`

```typescript
// Permission levels (array indices in rbac.permission)
export enum Permission {
  read = 0,     // READ access
  create = 1,   // CREATE access
  update = 2,   // UPDATE access
  delete = 3,   // DELETE access
  execute = 4,  // EXECUTE access
  owner = 5     // OWNER access
}

// Universal RBAC check pattern
const access = await db.execute(sql`
  SELECT 1 FROM app.entity_rbac rbac
  WHERE rbac.empid = ${userId}
    AND rbac.entity = ${entityType}
    AND (rbac.entity_id = 'all' OR rbac.entity_id = ${entityId}::text)
    AND rbac.active_flag = true
    AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
    AND ${permissionLevel} = ANY(rbac.permission)
`);
```

### Standard RBAC Checks

| Operation | Permission Required | Check Pattern |
|-----------|-------------------|--------------|
| GET /api/v1/{entity} | Read (0) | `0 = ANY(rbac.permission)` |
| GET /api/v1/{entity}/:id | Read (0) | `0 = ANY(rbac.permission)` |
| POST /api/v1/{entity} | Create (1) | `1 = ANY(rbac.permission)` |
| PUT /api/v1/{entity}/:id | Update (2) | `2 = ANY(rbac.permission)` |
| DELETE /api/v1/{entity}/:id | Delete (3) | `3 = ANY(rbac.permission)` |

---

## Factory Patterns (DRY API Development)

**Standard:** Use factory functions to generate repetitive routes. Never duplicate code across entity modules.

### 1. Child Entity Route Factory

**File:** `apps/api/src/lib/child-entity-route-factory.ts`

**Pattern:** Automatically creates `GET /api/v1/{parent}/:id/{child}` endpoints

```typescript
import { createChildEntityEndpoint } from '@/lib/child-entity-route-factory.js';

// ✅ CORRECT: Use factory
createChildEntityEndpoint(fastify, 'project', 'task', 'd_task');
createChildEntityEndpoint(fastify, 'project', 'artifact', 'd_artifact');
createChildEntityEndpoint(fastify, 'project', 'form', 'd_form_head');
createChildEntityEndpoint(fastify, 'project', 'wiki', 'd_wiki');

// Factory handles:
// - Authentication (JWT validation)
// - RBAC checks (permission array check)
// - Pagination (page/limit query params)
// - Parent-child relationship query via entity_instance_link
// - Error handling (401, 403, 500)
// - Type validation (TypeBox schemas)
```

**What the factory generates:**

```typescript
// GET /api/v1/project/:id/task
fastify.get(`/api/v1/${parentEntity}/:id/${childEntity}`, {
  preHandler: [fastify.authenticate],
  schema: {
    params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
    querystring: Type.Object({
      page: Type.Optional(Type.Integer({ minimum: 1 })),
      limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 }))
    })
  },
  handler: async (request, reply) => {
    const { id: parentId } = request.params;
    const { page = 1, limit = 20 } = request.query;
    const userId = request.user?.sub;

    // RBAC check
    const access = await db.execute(sql`
      SELECT 1 FROM app.entity_rbac rbac
      WHERE rbac.empid = ${userId}
        AND rbac.entity = ${parentEntity}
        AND (rbac.entity_id = ${parentId}::text OR rbac.entity_id = 'all')
        AND rbac.active_flag = true
        AND 0 = ANY(rbac.permission)
    `);

    if (access.length === 0) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    // Query child entities via entity_instance_link
    const offset = (page - 1) * limit;
    const data = await db.execute(sql`
      SELECT c.*
      FROM app.${sql.identifier(childTable)} c
      INNER JOIN app.entity_instance_link eim ON eim.child_entity_id = c.id::text
      WHERE eim.parent_entity_id = ${parentId}
        AND eim.parent_entity_type = ${parentEntity}
        AND eim.child_entity_type = ${childEntity}
        AND eim.active_flag = true
        AND c.active_flag = true
      ORDER BY c.created_ts DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const countResult = await db.execute(sql`
      SELECT COUNT(*) as total
      FROM app.${sql.identifier(childTable)} c
      INNER JOIN app.entity_instance_link eim ON eim.child_entity_id = c.id::text
      WHERE eim.parent_entity_id = ${parentId}
        AND eim.parent_entity_type = ${parentEntity}
        AND eim.child_entity_type = ${childEntity}
        AND eim.active_flag = true
        AND c.active_flag = true
    `);

    return {
      data,
      total: Number(countResult[0]?.total || 0),
      page,
      limit
    };
  }
});
```

#### ❌ WRONG: Duplicating Route Logic

```typescript
// NEVER do this - violates DRY principle
fastify.get('/api/v1/project/:id/task', async (request, reply) => {
  // 50+ lines of duplicate code...
});

fastify.get('/api/v1/project/:id/artifact', async (request, reply) => {
  // Same 50+ lines of duplicate code...
});

fastify.get('/api/v1/project/:id/form', async (request, reply) => {
  // Same 50+ lines of duplicate code AGAIN...
});

// ⚠️ Result: 300+ lines of duplicate code across 6 child entities
// ⚠️ Bug fix requires updating 6+ places
// ⚠️ Maintenance nightmare
```

### 2. Entity Delete Route Factory

**File:** `apps/api/src/lib/entity-delete-route-factory.ts`

**Pattern:** Universal soft-delete with cascading cleanup

```typescript
import { createEntityDeleteEndpoint, universalEntityDelete } from '@/lib/entity-delete-route-factory.js';

// ✅ CORRECT: Use factory for delete endpoints
createEntityDeleteEndpoint(fastify, 'task');
createEntityDeleteEndpoint(fastify, 'project');
createEntityDeleteEndpoint(fastify, 'employee');

// With custom cleanup (e.g., delete S3 files before DB delete)
createEntityDeleteEndpoint(fastify, 'artifact', {
  customCleanup: async (artifactId) => {
    await deleteS3Files(artifactId);
  }
});

// Factory automatically handles:
// 1. Soft-delete from main entity table (active_flag = false)
// 2. Soft-delete from entity instance registry (d_entity_instance_registry)
// 3. Soft-delete parent linkages (entity_instance_link where child)
// 4. Soft-delete child linkages (entity_instance_link where parent)
```

**Cascading Delete Logic:**

```typescript
export async function universalEntityDelete(
  entityType: string,
  entityId: string,
  options?: {
    skipRegistry?: boolean;
    skipLinkages?: boolean;
    customCleanup?: () => Promise<void>;
  }
): Promise<void> {
  // Optional: Run custom cleanup first
  if (options?.customCleanup) {
    await options.customCleanup();
  }

  // STEP 1: Soft-delete from main entity table
  await db.execute(sql`
    UPDATE app.${sql.identifier(getEntityTable(entityType))}
    SET active_flag = false, to_ts = NOW(), updated_ts = NOW()
    WHERE id::text = ${entityId}
  `);

  // STEP 2: Soft-delete from entity instance registry
  if (!options?.skipRegistry) {
    await db.execute(sql`
      UPDATE app.d_entity_instance_registry
      SET active_flag = false, updated_ts = NOW()
      WHERE entity_type = ${entityType}
        AND entity_id::text = ${entityId}
    `);
  }

  // STEP 3 & 4: Soft-delete linkages (both as parent and child)
  if (!options?.skipLinkages) {
    await db.execute(sql`
      UPDATE app.entity_instance_link
      SET active_flag = false, updated_ts = NOW()
      WHERE (child_entity_type = ${entityType} AND child_entity_id::text = ${entityId})
         OR (parent_entity_type = ${entityType} AND parent_entity_id::text = ${entityId})
    `);
  }
}
```

### When to Use Factory Patterns

| Scenario | Factory Function | Purpose |
|----------|-----------------|---------|
| Parent-child relationships | `createChildEntityEndpoint()` | GET /parent/:id/child |
| Delete operations | `createEntityDeleteEndpoint()` | DELETE /entity/:id with cascading |
| Standard CRUD | Manual (see Entity API Workflow) | Custom business logic |

---

## Entity API Development Workflow

**Standard:** Follow this exact workflow when adding a new entity type.

### Step 1: Database Schema (DDL)

**File:** `db/d_{entity}.ddl`

```sql
-- Example: db/d_project.ddl
CREATE TABLE IF NOT EXISTS app.d_project (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    descr TEXT,

    -- Entity-specific fields
    project_status VARCHAR(50),
    project_stage VARCHAR(50),
    manager_employee_id UUID,
    budget_allocated_amt DECIMAL(15,2),
    start_date DATE,
    end_date DATE,

    -- Standard audit fields (REQUIRED)
    active_flag BOOLEAN DEFAULT TRUE,
    from_ts TIMESTAMPTZ DEFAULT NOW(),
    to_ts TIMESTAMPTZ,
    created_ts TIMESTAMPTZ DEFAULT NOW(),
    updated_ts TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    version INTEGER DEFAULT 1,

    -- Metadata
    metadata JSONB,

    -- Indexes
    CONSTRAINT uk_project_code UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_project_active ON app.d_project(active_flag);
CREATE INDEX IF NOT EXISTS idx_project_created_ts ON app.d_project(created_ts);
CREATE INDEX IF NOT EXISTS idx_project_status ON app.d_project(project_status);
```

**Standards:**
- ✅ Table name: `app.d_{entity}` (singular)
- ✅ Primary key: `id UUID`
- ✅ Unique code field: `code VARCHAR(50)`
- ✅ Audit fields: `active_flag`, `from_ts`, `to_ts`, `created_ts`, `updated_ts`, `created_by`, `updated_by`, `version`
- ✅ Indexes on: `active_flag`, `created_ts`, status/stage fields
- ✅ JSONB metadata field for flexibility

### Step 2: Drizzle Schema Definition

**File:** `apps/api/src/db/schema/{entity}.ts`

```typescript
// apps/api/src/db/schema/project.ts
import { pgTable, uuid, varchar, text, boolean, timestamp, integer, decimal, date, jsonb } from 'drizzle-orm/pg-core';

export const projectTable = pgTable('d_project', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  descr: text('descr'),

  // Entity-specific fields
  projectStatus: varchar('project_status', { length: 50 }),
  projectStage: varchar('project_stage', { length: 50 }),
  managerEmployeeId: uuid('manager_employee_id'),
  budgetAllocatedAmt: decimal('budget_allocated_amt', { precision: 15, scale: 2 }),
  startDate: date('start_date'),
  endDate: date('end_date'),

  // Audit fields
  activeFlag: boolean('active_flag').default(true),
  fromTs: timestamp('from_ts', { withTimezone: true }).defaultNow(),
  toTs: timestamp('to_ts', { withTimezone: true }),
  createdTs: timestamp('created_ts', { withTimezone: true }).defaultNow(),
  updatedTs: timestamp('updated_ts', { withTimezone: true }).defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  version: integer('version').default(1),

  // Metadata
  metadata: jsonb('metadata')
}, (table) => ({
  // Indexes
  activeIdx: index('idx_project_active').on(table.activeFlag),
  createdIdx: index('idx_project_created_ts').on(table.createdTs),
  statusIdx: index('idx_project_status').on(table.projectStatus)
}));

export type Project = typeof projectTable.$inferSelect;
export type NewProject = typeof projectTable.$inferInsert;
```

**Standards:**
- ✅ Use Drizzle schema builder
- ✅ Export inferred types: `Project`, `NewProject`
- ✅ camelCase for TypeScript fields, snake_case for DB columns
- ✅ Define indexes matching DDL

### Step 3: Service Layer

**File:** `apps/api/src/modules/{entity}/service.ts`

```typescript
// apps/api/src/modules/project/service.ts
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import type { Project, NewProject } from '@/db/schema/project.js';

export class ProjectService {
  /**
   * List projects with pagination and RBAC filtering
   */
  async list(params: {
    page?: number;
    limit?: number;
    status?: string;
    userId: string;
  }): Promise<{ data: Project[]; total: number; page: number; limit: number }> {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 100); // Max 100
    const offset = (page - 1) * limit;

    // Build WHERE clause
    let conditions = [
      sql`p.active_flag = true`,
      sql`EXISTS (
        SELECT 1 FROM app.entity_rbac rbac
        WHERE rbac.empid = ${params.userId}
          AND rbac.entity = 'project'
          AND (rbac.entity_id = 'all' OR rbac.entity_id = p.id::text)
          AND rbac.active_flag = true
          AND 0 = ANY(rbac.permission)
      )`
    ];

    if (params.status) {
      conditions.push(sql`p.project_status = ${params.status}`);
    }

    const whereClause = sql.join(conditions, sql` AND `);

    // Get total count
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as total
      FROM app.d_project p
      WHERE ${whereClause}
    `);
    const total = parseInt(countResult.rows[0]?.total || '0');

    // Get paginated data
    const result = await db.execute(sql`
      SELECT
        p.*,
        e.name as manager_name
      FROM app.d_project p
      LEFT JOIN app.d_employee e ON p.manager_employee_id = e.id
      WHERE ${whereClause}
      ORDER BY p.created_ts DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    return {
      data: result.rows as Project[],
      total,
      page,
      limit
    };
  }

  /**
   * Get single project by ID with RBAC check
   */
  async getById(id: string, userId: string): Promise<Project | null> {
    const result = await db.execute(sql`
      SELECT
        p.*,
        e.name as manager_name
      FROM app.d_project p
      LEFT JOIN app.d_employee e ON p.manager_employee_id = e.id
      WHERE p.id::text = ${id}
        AND p.active_flag = true
        AND EXISTS (
          SELECT 1 FROM app.entity_rbac rbac
          WHERE rbac.empid = ${userId}
            AND rbac.entity = 'project'
            AND (rbac.entity_id = 'all' OR rbac.entity_id = ${id})
            AND rbac.active_flag = true
            AND 0 = ANY(rbac.permission)
        )
    `);

    return result.rows[0] as Project || null;
  }

  /**
   * Create project
   */
  async create(data: NewProject, userId: string): Promise<Project> {
    const result = await db.execute(sql`
      INSERT INTO app.d_project (
        code, name, descr, project_status, project_stage,
        manager_employee_id, budget_allocated_amt, start_date,
        created_by, updated_by
      ) VALUES (
        ${data.code}, ${data.name}, ${data.descr},
        ${data.projectStatus}, ${data.projectStage},
        ${data.managerEmployeeId}, ${data.budgetAllocatedAmt}, ${data.startDate},
        ${userId}, ${userId}
      )
      RETURNING *
    `);

    return result.rows[0] as Project;
  }

  /**
   * Update project
   */
  async update(id: string, data: Partial<Project>, userId: string): Promise<Project> {
    const result = await db.execute(sql`
      UPDATE app.d_project
      SET
        name = COALESCE(${data.name}, name),
        descr = COALESCE(${data.descr}, descr),
        project_status = COALESCE(${data.projectStatus}, project_status),
        project_stage = COALESCE(${data.projectStage}, project_stage),
        manager_employee_id = COALESCE(${data.managerEmployeeId}, manager_employee_id),
        budget_allocated_amt = COALESCE(${data.budgetAllocatedAmt}, budget_allocated_amt),
        updated_by = ${userId},
        updated_ts = NOW(),
        version = version + 1
      WHERE id::text = ${id} AND active_flag = true
      RETURNING *
    `);

    if (result.rows.length === 0) {
      throw new Error('Project not found or access denied');
    }

    return result.rows[0] as Project;
  }

  /**
   * Soft-delete project (use factory function)
   */
  async delete(id: string): Promise<void> {
    const { universalEntityDelete } = await import('@/lib/entity-delete-route-factory.js');
    await universalEntityDelete('project', id);
  }
}

export const projectService = new ProjectService();
```

**Service Layer Standards:**
- ✅ Use class-based services
- ✅ All list methods paginate (default 20, max 100)
- ✅ RBAC checks in SQL queries
- ✅ Return null for not found (not errors)
- ✅ Update `updated_ts`, `updated_by`, `version` on every update
- ✅ Use soft-deletes via `universalEntityDelete()`
- ✅ Include userId in all CUD operations

### Step 4: Route Layer

**File:** `apps/api/src/modules/{entity}/routes.ts`

```typescript
// apps/api/src/modules/project/routes.ts
import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { projectService } from './service.js';
import { createChildEntityEndpoint } from '@/lib/child-entity-route-factory.js';
import { createEntityDeleteEndpoint } from '@/lib/entity-delete-route-factory.js';

export async function projectRoutes(fastify: FastifyInstance) {
  // LIST: GET /api/v1/project
  fastify.get('/api/v1/project', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Project'],
      summary: 'List projects',
      querystring: Type.Object({
        page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
        status: Type.Optional(Type.String())
      }),
      response: {
        200: Type.Object({
          data: Type.Array(Type.Any()),
          total: Type.Integer(),
          page: Type.Integer(),
          limit: Type.Integer()
        })
      }
    },
    handler: async (request, reply) => {
      const userId = request.user.sub;
      const { page, limit, status } = request.query as any;

      const result = await projectService.list({ page, limit, status, userId });
      return reply.send(result);
    }
  });

  // GET: GET /api/v1/project/:id
  fastify.get('/api/v1/project/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Project'],
      summary: 'Get project by ID',
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      })
    },
    handler: async (request, reply) => {
      const userId = request.user.sub;
      const { id } = request.params as { id: string };

      const project = await projectService.getById(id, userId);

      if (!project) {
        return reply.code(404).send({ error: 'Project not found or access denied' });
      }

      return reply.send(project);
    }
  });

  // CREATE: POST /api/v1/project
  fastify.post('/api/v1/project', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Project'],
      summary: 'Create project',
      body: Type.Object({
        code: Type.String({ maxLength: 50 }),
        name: Type.String({ maxLength: 255 }),
        descr: Type.Optional(Type.String()),
        project_status: Type.Optional(Type.String()),
        project_stage: Type.Optional(Type.String()),
        manager_employee_id: Type.Optional(Type.String({ format: 'uuid' })),
        budget_allocated_amt: Type.Optional(Type.Number()),
        start_date: Type.Optional(Type.String({ format: 'date' }))
      })
    },
    handler: async (request, reply) => {
      const userId = request.user.sub;
      const data = request.body as any;

      const project = await projectService.create(data, userId);
      return reply.code(201).send(project);
    }
  });

  // UPDATE: PUT /api/v1/project/:id
  fastify.put('/api/v1/project/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Project'],
      summary: 'Update project'
    },
    handler: async (request, reply) => {
      const userId = request.user.sub;
      const { id } = request.params as { id: string };
      const data = request.body as any;

      const project = await projectService.update(id, data, userId);
      return reply.send(project);
    }
  });

  // DELETE: DELETE /api/v1/project/:id (using factory)
  createEntityDeleteEndpoint(fastify, 'project');

  // CHILD ENTITY ENDPOINTS (using factory)
  createChildEntityEndpoint(fastify, 'project', 'task', 'd_task');
  createChildEntityEndpoint(fastify, 'project', 'wiki', 'd_wiki');
  createChildEntityEndpoint(fastify, 'project', 'artifact', 'd_artifact');
  createChildEntityEndpoint(fastify, 'project', 'form', 'd_form_head');
}
```

**Route Layer Standards:**
- ✅ Every route has `preHandler: [fastify.authenticate]`
- ✅ Extract userId from `request.user.sub`
- ✅ Use Fastify schema validation (TypeBox)
- ✅ Return 403 for forbidden, 404 for not found, 201 for created
- ✅ Tag routes for OpenAPI grouping
- ✅ Use factory patterns for delete and child entity routes

### Step 5: Register Routes

**File:** `apps/api/src/modules/index.ts`

```typescript
// Add to route registration
import { projectRoutes } from './project/routes.js';

export async function registerAllRoutes(fastify: FastifyInstance) {
  // ... existing routes
  await projectRoutes(fastify);
}
```

### Step 6: Run Database Import

```bash
# Import new DDL file
./tools/db-import.sh

# Verify table created
PGPASSWORD='app' psql -h localhost -p 5434 -U app -d app -c "\dt app.d_project"
```

### Step 7: Test API

```bash
# Test LIST endpoint
./tools/test-api.sh GET /api/v1/project

# Test CREATE endpoint
./tools/test-api.sh POST /api/v1/project '{"code":"PROJ001","name":"Test Project","project_status":"active"}'

# Test GET endpoint
./tools/test-api.sh GET /api/v1/project/{id}

# Test UPDATE endpoint
./tools/test-api.sh PUT /api/v1/project/{id} '{"project_status":"completed"}'

# Test DELETE endpoint
./tools/test-api.sh DELETE /api/v1/project/{id}

# Test child entity endpoints
./tools/test-api.sh GET /api/v1/project/{id}/task
./tools/test-api.sh GET /api/v1/project/{id}/wiki
```

---

## ORM Usage (Drizzle)

**Standard:** Use Drizzle ORM for type-safe database operations.

### Database Connection

```typescript
// apps/api/src/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL ||
  'postgresql://app:app@localhost:5434/app';

const client = postgres(connectionString);
export const db = drizzle(client);
```

### Query Patterns

#### ✅ CORRECT: Type-Safe Queries

```typescript
import { db } from '@/db/index.js';
import { sql, eq, and, desc } from 'drizzle-orm';
import { projectTable } from '@/db/schema/project.js';

// SELECT with type safety
const projects = await db
  .select()
  .from(projectTable)
  .where(
    and(
      eq(projectTable.activeFlag, true),
      eq(projectTable.projectStatus, 'active')
    )
  )
  .orderBy(desc(projectTable.createdTs))
  .limit(20);

// Type: Project[]
projects.forEach(p => {
  console.log(p.name); // TypeScript knows 'name' exists
});
```

#### ✅ CORRECT: Raw SQL with sql`` Template

```typescript
// For complex queries, use sql`` template
const result = await db.execute(sql`
  SELECT
    p.*,
    e.name as manager_name,
    COUNT(t.id) as task_count
  FROM app.d_project p
  LEFT JOIN app.d_employee e ON p.manager_employee_id = e.id
  LEFT JOIN app.entity_instance_link eim ON eim.parent_entity_id = p.id::text
    AND eim.parent_entity_type = 'project'
    AND eim.child_entity_type = 'task'
    AND eim.active_flag = true
  LEFT JOIN app.d_task t ON t.id::text = eim.child_entity_id
    AND t.active_flag = true
  WHERE p.active_flag = true
    AND p.project_status = ${status}
  GROUP BY p.id, e.name
  ORDER BY p.created_ts DESC
  LIMIT ${limit} OFFSET ${offset}
`);

const projects = result.rows as (Project & { manager_name: string; task_count: number })[];
```

#### ❌ WRONG: Unsafe String Concatenation

```typescript
// NEVER do this - SQL injection vulnerability!
const query = `SELECT * FROM app.d_project WHERE project_status = '${status}'`;
const result = await db.execute(query); // ❌ UNSAFE
```

### Transaction Pattern

```typescript
// Use transactions for multi-step operations
await db.transaction(async (tx) => {
  // Step 1: Create project
  const project = await tx.execute(sql`
    INSERT INTO app.d_project (code, name, created_by)
    VALUES (${code}, ${name}, ${userId})
    RETURNING *
  `);

  const projectId = project.rows[0].id;

  // Step 2: Create linkage to business
  await tx.execute(sql`
    INSERT INTO app.entity_instance_link (
      parent_entity_type, parent_entity_id,
      child_entity_type, child_entity_id
    ) VALUES (
      'business', ${businessId},
      'project', ${projectId}::text
    )
  `);

  // Step 3: Create registry entry
  await tx.execute(sql`
    INSERT INTO app.d_entity_instance_registry (entity_type, entity_id)
    VALUES ('project', ${projectId}::text)
  `);

  // Step 4: Grant owner permission to creator
  await tx.execute(sql`
    INSERT INTO app.entity_rbac (
      empid, entity, entity_id, permission, active_flag
    ) VALUES (
      ${userId}, 'project', ${projectId}::text, ARRAY[0,1,2,3,4,5], true
    )
  `);
});
```

### ORM Standards

| Pattern | Standard | Example |
|---------|----------|---------|
| **Simple queries** | Use Drizzle query builder | `db.select().from(table).where(...)` |
| **Complex queries** | Use `sql`` template` | `db.execute(sql`SELECT ... JOIN ...`)` |
| **Parameters** | Always use parameterized queries | `sql`WHERE id = ${id}`` |
| **Transactions** | Use `db.transaction()` for multi-step | See example above |
| **Type safety** | Export and use inferred types | `Project`, `NewProject` |

---

## Data Flow Architecture

### Request → Response Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. CLIENT REQUEST                                           │
│    GET /api/v1/project?page=1&limit=20                     │
│    Header: Authorization: Bearer <jwt_token>               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. FASTIFY ROUTER                                           │
│    Route: /api/v1/project                                   │
│    Method: GET                                              │
│    preHandler: [fastify.authenticate]                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. JWT AUTHENTICATION                                       │
│    Decode token → Extract user.sub (user ID)               │
│    Attach to request.user                                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. RBAC AUTHORIZATION (SQL-embedded)                        │
│    EXISTS check in app.entity_rbac                   │
│    Check: 0 = ANY(rbac.permission)                          │
│    If false → 403 Forbidden                                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. SERVICE LAYER                                            │
│    projectService.list({ page, limit, userId })             │
│    Business logic + validation                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. ORM LAYER (Drizzle)                                      │
│    db.execute(sql`SELECT ... FROM app.d_project ...`)       │
│    Execute parameterized query with RBAC                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. DATABASE (PostgreSQL)                                    │
│    Query execution with JOINs                               │
│    Return rows                                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. DATA TRANSFORMATION                                      │
│    Convert DB rows to TypeScript objects                    │
│    Apply computed fields (JOINs)                            │
│    Calculate totals, pagination metadata                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 9. RESPONSE                                                 │
│    JSON: { data: [...], total: 42, page: 1, limit: 20 }   │
│    Status: 200 OK                                           │
└─────────────────────────────────────────────────────────────┘
```

### Parent-Child Linkage Flow

```
┌─────────────────────────────────────────────────────────────┐
│ USER ACTION: Create Task for Project                       │
│ POST /api/v1/task                                           │
│ Body: { name: "Task 1", project_id: "abc-123" }           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: Create Task Entity                                 │
│ INSERT INTO app.d_task (name, ...)                         │
│ RETURNING id → "def-456"                                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Create Parent-Child Linkage                        │
│ INSERT INTO app.entity_instance_link (                           │
│   parent_entity_type = 'project',                           │
│   parent_entity_id = 'abc-123',                             │
│   child_entity_type = 'task',                               │
│   child_entity_id = 'def-456'                               │
│ )                                                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: Create Entity Registry Entry                       │
│ INSERT INTO app.d_entity_instance_registry (                      │
│   entity_type = 'task',                                     │
│   entity_id = 'def-456'                                     │
│ )                                                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: Grant RBAC Permissions                             │
│ INSERT INTO app.entity_rbac (                        │
│   empid = userId,                                           │
│   entity = 'task',                                          │
│   entity_id = 'def-456',                                    │
│   permission = ARRAY[0,1,2,3,4,5]                           │
│ )                                                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ RESPONSE: Created Task                                      │
│ { id: "def-456", name: "Task 1", ... }                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Standards & Enforcement

### Mandatory Standards Checklist

Every API endpoint MUST follow these standards:

#### Authentication & Authorization
- [ ] Has `preHandler: [fastify.authenticate]`
- [ ] Extracts userId from `request.user.sub`
- [ ] RBAC check embedded in SQL query (for list endpoints)
- [ ] Explicit RBAC check for single entity operations
- [ ] Returns 403 Forbidden if unauthorized

#### Data Integrity
- [ ] Uses soft-deletes (`active_flag = false`, `to_ts = NOW()`)
- [ ] Never hard-deletes records
- [ ] Updates `updated_ts`, `updated_by`, `version` on every update
- [ ] Sets `created_by` on entity creation
- [ ] Uses transactions for multi-step operations

#### Query Standards
- [ ] List endpoints paginate (default 20, max 100)
- [ ] Uses parameterized queries (no string concatenation)
- [ ] Filters by `active_flag = true` by default
- [ ] Returns 404 for not found entities
- [ ] Returns null from service layer (not errors)

#### Schema Validation
- [ ] Defines Fastify schema for request validation
- [ ] Validates params, query, body using TypeBox
- [ ] Sets tags for OpenAPI grouping
- [ ] Includes summary/description

#### Error Handling
- [ ] Returns standard error format: `{ error: string }`
- [ ] Uses appropriate status codes (400, 403, 404, 500)
- [ ] Catches and logs database errors
- [ ] Never exposes internal error details to client

#### Factory Usage
- [ ] Uses `createChildEntityEndpoint()` for child entities
- [ ] Uses `createEntityDeleteEndpoint()` for delete operations
- [ ] Never duplicates route logic across entities

### Code Review Checklist

Before merging API code:

1. **Security:**
   - [ ] All routes have authentication
   - [ ] RBAC checks in SQL or explicit checks
   - [ ] No SQL injection vulnerabilities
   - [ ] No hardcoded credentials

2. **Standards:**
   - [ ] Follows entity API workflow
   - [ ] Uses factory patterns where applicable
   - [ ] Drizzle schema matches DDL
   - [ ] Service layer exists

3. **Testing:**
   - [ ] Tested with `./tools/test-api.sh`
   - [ ] All CRUD operations work
   - [ ] RBAC enforced correctly
   - [ ] Pagination works

4. **Documentation:**
   - [ ] OpenAPI schema defined
   - [ ] Route comments explain purpose
   - [ ] Complex logic has comments

---

## Decision Trees (What Pattern When)

### 1. When to Use Factory vs Manual Routes

```
Do you need child entity endpoints (e.g., /project/:id/task)?
│
├─ YES → Use createChildEntityEndpoint()
│         Example: createChildEntityEndpoint(fastify, 'project', 'task', 'd_task')
│
└─ NO → Does the entity need custom business logic?
          │
          ├─ YES → Write manual routes + service
          │         Example: Custom project approval workflow
          │
          └─ NO → Write standard CRUD routes
                    Example: Basic entity with list/get/create/update/delete
```

### 2. When to Use Drizzle Query Builder vs Raw SQL

```
Is the query simple (single table, basic filters)?
│
├─ YES → Use Drizzle query builder
│         Example: db.select().from(projectTable).where(eq(projectTable.projectStatus, 'active'))
│
└─ NO → Does the query need JOINs or complex logic?
          │
          ├─ YES → Use sql`` template
          │         Example: Multi-table JOINs with computed fields, RBAC checks
          │
          └─ NO → Still prefer query builder for type safety
```

### 3. When to Use Transactions

```
Does the operation modify multiple tables?
│
├─ YES → Use db.transaction()
│         Example: Create entity + linkage + registry + RBAC
│
└─ NO → Does failure require rollback?
          │
          ├─ YES → Use db.transaction()
          │         Example: Financial operations
          │
          └─ NO → Single query is fine
                    Example: Update single entity field
```

### 4. When to Create New Entity Type

```
Is this a new business concept?
│
├─ YES → Create new entity
│         Follow: Entity API Development Workflow
│
└─ NO → Can it be a field in existing entity?
          │
          ├─ YES → Add field to existing DDL
          │         Example: Add 'priority' field to task
          │
          └─ NO → Is it a settings/configuration?
                    │
                    ├─ YES → Add to settings table
                    │         Example: setting_datalabel_task_priority
                    │
                    └─ NO → Create new entity
```

---

## Testing & Debugging

### Testing Tools

```bash
# 1. Test API endpoints
./tools/test-api.sh GET /api/v1/project
./tools/test-api.sh POST /api/v1/project '{"code":"P001","name":"Test"}'

# 2. View API logs
./tools/logs-api.sh 100        # Last 100 lines
./tools/logs-api.sh -f         # Follow in real-time

# 3. Database import (after DDL changes)
./tools/db-import.sh

# 4. Check database directly
PGPASSWORD='app' psql -h localhost -p 5434 -U app -d app
```

### Common Debugging Patterns

#### 403 Forbidden Error

```typescript
// Check RBAC permissions
const access = await db.execute(sql`
  SELECT * FROM app.entity_rbac
  WHERE empid = ${userId}
    AND entity = 'project'
    AND (entity_id = 'all' OR entity_id = ${projectId})
    AND active_flag = true
`);

console.log('Access records:', access);
console.log('Has permission 0 (read):', access.some(r => r.permission.includes(0)));
```

#### 404 Not Found Error

```typescript
// Check entity exists and is active
const result = await db.execute(sql`
  SELECT * FROM app.d_project
  WHERE id::text = ${id}
`);
console.log('Entity found:', result.rows.length > 0);
console.log('Active flag:', result.rows[0]?.active_flag);
console.log('To timestamp:', result.rows[0]?.to_ts);
```

#### Empty Child Entity List

```typescript
// Check linkage exists in entity_instance_link
const linkages = await db.execute(sql`
  SELECT * FROM app.entity_instance_link
  WHERE parent_entity_id = ${parentId}
    AND parent_entity_type = 'project'
    AND child_entity_type = 'task'
    AND active_flag = true
`);
console.log('Linkages found:', linkages.rows.length);
console.log('Linkages:', linkages.rows);
```

---

## Common Patterns & Examples

### Pattern 1: Enriched List Response (JOINs)

```typescript
// Return entities with computed fields from JOINs
async list(params: { page: number; limit: number; userId: string }) {
  const offset = (params.page - 1) * params.limit;

  const result = await db.execute(sql`
    SELECT
      p.*,
      e.name as manager_name,
      b.name as business_name,
      (
        SELECT COUNT(*)
        FROM app.d_task t
        INNER JOIN app.entity_instance_link eim ON t.id::text = eim.child_entity_id
        WHERE eim.parent_entity_id = p.id::text
          AND eim.parent_entity_type = 'project'
          AND eim.child_entity_type = 'task'
          AND eim.active_flag = true
          AND t.active_flag = true
      ) as task_count
    FROM app.d_project p
    LEFT JOIN app.d_employee e ON p.manager_employee_id = e.id
    LEFT JOIN app.d_business b ON p.business_id = b.id
    WHERE p.active_flag = true
      AND EXISTS (
        SELECT 1 FROM app.entity_rbac rbac
        WHERE rbac.empid = ${params.userId}
          AND rbac.entity = 'project'
          AND (rbac.entity_id = 'all' OR rbac.entity_id = p.id::text)
          AND rbac.active_flag = true
          AND 0 = ANY(rbac.permission)
      )
    ORDER BY p.created_ts DESC
    LIMIT ${params.limit} OFFSET ${offset}
  `);

  // Get total count
  const countResult = await db.execute(sql`
    SELECT COUNT(*) as total
    FROM app.d_project p
    WHERE p.active_flag = true
      AND EXISTS (
        SELECT 1 FROM app.entity_rbac rbac
        WHERE rbac.empid = ${params.userId}
          AND rbac.entity = 'project'
          AND (rbac.entity_id = 'all' OR rbac.entity_id = p.id::text)
          AND rbac.active_flag = true
          AND 0 = ANY(rbac.permission)
      )
  `);

  return {
    data: result.rows,
    total: Number(countResult.rows[0]?.total || 0),
    page: params.page,
    limit: params.limit
  };
}
```

### Pattern 2: Create with Parent Linkage

```typescript
// Create task and link to project
async createTask(data: { name: string; project_id: string }, userId: string) {
  return await db.transaction(async (tx) => {
    // Step 1: Create task
    const taskResult = await tx.execute(sql`
      INSERT INTO app.d_task (name, created_by, updated_by)
      VALUES (${data.name}, ${userId}, ${userId})
      RETURNING *
    `);
    const task = taskResult.rows[0];

    // Step 2: Create linkage
    await tx.execute(sql`
      INSERT INTO app.entity_instance_link (
        parent_entity_type, parent_entity_id,
        child_entity_type, child_entity_id
      ) VALUES (
        'project', ${data.project_id},
        'task', ${task.id}::text
      )
    `);

    // Step 3: Create registry entry
    await tx.execute(sql`
      INSERT INTO app.d_entity_instance_registry (entity_type, entity_id)
      VALUES ('task', ${task.id}::text)
    `);

    // Step 4: Grant creator full permissions
    await tx.execute(sql`
      INSERT INTO app.entity_rbac (
        empid, entity, entity_id, permission, active_flag
      ) VALUES (
        ${userId}, 'task', ${task.id}::text, ARRAY[0,1,2,3,4,5], true
      )
    `);

    return task;
  });
}
```

### Pattern 3: Soft Delete with Cascading

```typescript
// Delete entity and all linkages
async delete(id: string): Promise<void> {
  // Use universal delete factory
  await universalEntityDelete('project', id);

  // universalEntityDelete() automatically handles:
  // 1. Soft-delete project (active_flag=false, to_ts=NOW())
  // 2. Soft-delete registry entry (d_entity_instance_registry)
  // 3. Soft-delete as parent (project → tasks, wiki, etc. linkages)
  // 4. Soft-delete as child (business → project linkages)
}
```

### Pattern 4: Dynamic Filters

```typescript
// Build WHERE clause dynamically based on filters
async list(filters: {
  status?: string;
  priority?: string;
  assignee_id?: string;
  page: number;
  limit: number;
  userId: string;
}) {
  let conditions = [
    sql`t.active_flag = true`,
    sql`EXISTS (
      SELECT 1 FROM app.entity_rbac rbac
      WHERE rbac.empid = ${filters.userId}
        AND rbac.entity = 'task'
        AND (rbac.entity_id = 'all' OR rbac.entity_id = t.id::text)
        AND rbac.active_flag = true
        AND 0 = ANY(rbac.permission)
    )`
  ];

  if (filters.status) {
    conditions.push(sql`t.task_status = ${filters.status}`);
  }
  if (filters.priority) {
    conditions.push(sql`t.task_priority = ${filters.priority}`);
  }
  if (filters.assignee_id) {
    conditions.push(sql`t.assignee_employee_id = ${filters.assignee_id}`);
  }

  const whereClause = sql.join(conditions, sql` AND `);
  const offset = (filters.page - 1) * filters.limit;

  const result = await db.execute(sql`
    SELECT
      t.*,
      e.name as assignee_name,
      p.name as project_name
    FROM app.d_task t
    LEFT JOIN app.d_employee e ON t.assignee_employee_id = e.id
    LEFT JOIN app.d_project p ON t.project_id = p.id
    WHERE ${whereClause}
    ORDER BY t.created_ts DESC
    LIMIT ${filters.limit} OFFSET ${offset}
  `);

  const countResult = await db.execute(sql`
    SELECT COUNT(*) as total
    FROM app.d_task t
    WHERE ${whereClause}
  `);

  return {
    data: result.rows,
    total: Number(countResult.rows[0]?.total || 0),
    page: filters.page,
    limit: filters.limit
  };
}
```

### Pattern 5: Options/Settings Endpoint

```typescript
// GET /api/v1/entity/task/entity-instance-lookup
// Returns entity instance lookup options
fastify.get('/api/v1/entity/task/entity-instance-lookup', {
  preHandler: [fastify.authenticate],
  schema: {
    tags: ['Settings'],
    summary: 'Get task dropdown options'
  },
  handler: async (request, reply) => {
    const options = await db.execute(sql`
      SELECT
        (SELECT json_agg(json_build_object('value', code, 'label', name, 'display_order', display_order, 'color', color_code))
         FROM app.setting_datalabel
         WHERE datalabel = 'dl__task_status'
           AND active_flag = true
         ORDER BY display_order) as status,
        (SELECT json_agg(json_build_object('value', code, 'label', name, 'display_order', display_order, 'color', color_code))
         FROM app.setting_datalabel
         WHERE datalabel = 'dl__task_priority'
           AND active_flag = true
         ORDER BY display_order) as priority,
        (SELECT json_agg(json_build_object('value', id::text, 'label', name))
         FROM app.d_employee
         WHERE active_flag = true
         ORDER BY name) as assignees
    `);

    return reply.send(options.rows[0]);
  }
});
```

---

## Summary

### Golden Rules for API Development

1. **Never skip authentication/RBAC** - Every route requires both
2. **Use factory patterns** - Avoid duplicating route logic
3. **Soft-deletes only** - Never hard-delete records
4. **Paginate by default** - List endpoints must paginate
5. **Type-safe queries** - Use Drizzle with parameterized queries
6. **Transactions for multi-step** - Ensure data integrity
7. **Follow workflow exactly** - DDL → Schema → Service → Routes
8. **Test with tools** - Use `./tools/test-api.sh`
9. **Document in OpenAPI** - Keep spec updated
10. **Enforce standards strictly** - No exceptions

### Current Module Inventory

**48 API Modules:**
- **Core entities (13)**: auth, employee, task, project, role, cust, worksite, wiki, artifact, form, reports, interaction, collab
- **Hierarchies (3)**: office-hierarchy, business-hierarchy, product-hierarchy
- **Product & Operations (8)**: service, product, quote, work_order, inventory, order, shipment, invoice
- **Financial (1)**: cost
- **Calendar & Events (4)**: event, person-calendar, event-person-calendar, booking
- **Infrastructure (11)**: schema, meta, setting, entity, entity-options, rbac, linkage, shared, upload, s3-backend, email-template
- **Workflow (2)**: workflow, workflow-automation
- **AI & Messaging (3)**: chat, message-data, task-data
- **Flat entities (3)**: office, business, worksite (non-hierarchical versions)

### Getting Help

**Documentation References:**
- Entity System v4.0: `docs/entity_design_pattern/ENTITY_SYSTEM_V4.md`
- Data Model: `docs/datamodel/datamodel.md`
- OpenAPI Spec: `docs/api/openapi.yaml`
- Tools Guide: `docs/tools.md`

**Testing Commands:**
```bash
./tools/test-api.sh          # API testing
./tools/logs-api.sh          # View logs
./tools/db-import.sh         # Import DDL changes
```

---

**Last Updated:** 2025-11-12
**Version:** 4.0.0
**Modules:** 48
**For Questions:** Refer to OpenAPI spec or existing entity modules as examples
