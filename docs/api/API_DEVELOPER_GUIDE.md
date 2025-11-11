# PMO Platform API Developer Guide

> **Complete guide for developing APIs following strict PMO Platform standards**
> Version: 3.1.0 | Last Updated: 2025-11-11

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

The PMO Platform API follows a **DRY-first, factory-driven architecture** that serves 30+ entity types through universal patterns. This guide enforces **strict standards** to ensure consistency, maintainability, and security.

### Core Principles

1. **Never duplicate route logic** - Use factory functions
2. **Always enforce RBAC** - Every endpoint requires authentication + permission checks
3. **Type-safe ORM** - Use Drizzle with proper TypeScript types
4. **Soft deletes only** - Never hard-delete records
5. **Audit trail** - Track created_ts, updated_ts, created_by, updated_by
6. **Pagination by default** - List endpoints must paginate
7. **Universal error handling** - Use standardized error responses

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
   resolveUnifiedAbilities(userId)
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
      const abilities = await resolveUnifiedAbilities(userId);
      if (!abilities.canReadEntity('project')) {
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

**Standard:** Use unified scope-based permissions from `app.rel_employee_scope_unified`

```typescript
// apps/api/src/lib/authz.ts

export enum Permission {
  read = 0,     // READ access
  create = 1,   // CREATE access
  update = 2,   // UPDATE access
  delete = 3,   // DELETE access
  execute = 4,  // EXECUTE access
  owner = 5     // OWNER access
}

export interface UnifiedAbilities {
  canReadEntity(entityType: string): boolean;
  canCreateEntity(entityType: string): boolean;
  canUpdateEntity(entityType: string, entityId: string): boolean;
  canDeleteEntity(entityType: string, entityId: string): boolean;
  isAdmin(): boolean;
}

// Usage in routes
const abilities = await resolveUnifiedAbilities(userId);

if (!abilities.canReadEntity('project')) {
  return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
}
```

### Standard RBAC Checks

| Operation | Permission Required | Check Method |
|-----------|-------------------|--------------|
| GET /api/v1/{entity} | Read | `abilities.canReadEntity(entityType)` |
| GET /api/v1/{entity}/:id | Read | `abilities.canReadEntity(entityType)` |
| POST /api/v1/{entity} | Create | `abilities.canCreateEntity(entityType)` |
| PUT /api/v1/{entity}/:id | Update | `abilities.canUpdateEntity(entityType, id)` |
| DELETE /api/v1/{entity}/:id | Delete | `abilities.canDeleteEntity(entityType, id)` |

---

## Factory Patterns (DRY API Development)

**Standard:** Use factory functions to generate repetitive routes. Never duplicate code across entity modules.

### 1. Child Entity Route Factory

**Pattern:** Automatically creates `GET /api/v1/{parent}/:id/{child}` endpoints

```typescript
// apps/api/src/lib/child-entity-route-factory.ts

import { createChildEntityEndpoint } from '@/lib/child-entity-route-factory.js';

// ✅ CORRECT: Use factory
createChildEntityEndpoint(fastify, 'project', 'task', 'd_task');
createChildEntityEndpoint(fastify, 'project', 'artifact', 'd_artifact');
createChildEntityEndpoint(fastify, 'project', 'form', 'd_form_head');

// Factory handles:
// - Authentication
// - RBAC checks
// - Pagination
// - Parent-child relationship query via d_entity_id_map
// - Error handling
```

**What the factory generates:**

```typescript
// GET /api/v1/project/:id/task
fastify.get(`/api/v1/${parentEntity}/:id/${childEntity}`, {
  preHandler: [fastify.authenticate],
  handler: async (request, reply) => {
    const userId = request.user.sub;
    const parentId = request.params.id;

    // RBAC check
    const abilities = await resolveUnifiedAbilities(userId);
    if (!abilities.canReadEntity(childEntity)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    // Query child entities via d_entity_id_map
    const children = await db.execute(sql`
      SELECT c.*
      FROM ${sql.raw(`app.${childTable}`)} c
      JOIN app.d_entity_id_map eim ON c.id = eim.child_entity_id
      WHERE eim.parent_entity_type = ${parentEntity.toUpperCase()}
        AND eim.parent_entity_id = ${parentId}
        AND eim.child_entity_type = ${childEntity.toUpperCase()}
        AND c.active_flag = true
      ORDER BY c.created_ts DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    return reply.send({ data: children.rows, total, page, limit });
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

**Pattern:** Universal soft-delete with cascading cleanup

```typescript
// apps/api/src/lib/entity-delete-route-factory.ts

import { createEntityDeleteEndpoint } from '@/lib/entity-delete-route-factory.js';

// ✅ CORRECT: Use factory for delete endpoints
createEntityDeleteEndpoint(fastify, 'task');
createEntityDeleteEndpoint(fastify, 'project');
createEntityDeleteEndpoint(fastify, 'employee');

// Factory automatically handles:
// 1. Soft-delete from main entity table (active_flag = false)
// 2. Soft-delete from entity instance registry (d_entity_instance_id)
// 3. Soft-delete parent linkages (d_entity_id_map where child)
// 4. Soft-delete child linkages (d_entity_id_map where parent)
```

**Cascading Delete Logic:**

```typescript
export async function universalEntityDelete(
  entityType: string,
  entityId: string,
  options?: { skipRegistry?: boolean; skipLinkages?: boolean }
): Promise<void> {
  // STEP 1: Soft-delete from main entity table
  await db.execute(sql`
    UPDATE ${sql.raw(`app.d_${entityType}`)}
    SET active_flag = false, updated_ts = NOW()
    WHERE id = ${entityId}
  `);

  // STEP 2: Soft-delete from entity instance registry
  if (!options?.skipRegistry) {
    await db.execute(sql`
      UPDATE app.d_entity_instance_id
      SET active_flag = false
      WHERE entity_type = ${entityType.toUpperCase()}
        AND entity_id = ${entityId}
    `);
  }

  // STEP 3: Soft-delete as child (parent → this entity)
  if (!options?.skipLinkages) {
    await db.execute(sql`
      UPDATE app.d_entity_id_map
      SET active_flag = false
      WHERE child_entity_type = ${entityType.toUpperCase()}
        AND child_entity_id = ${entityId}
    `);
  }

  // STEP 4: Soft-delete as parent (this entity → children)
  if (!options?.skipLinkages) {
    await db.execute(sql`
      UPDATE app.d_entity_id_map
      SET active_flag = false
      WHERE parent_entity_type = ${entityType.toUpperCase()}
        AND parent_entity_id = ${entityId}
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
    description TEXT,
    status VARCHAR(50),
    priority VARCHAR(50),

    -- Standard audit fields (REQUIRED)
    active_flag BOOLEAN DEFAULT TRUE,
    created_ts TIMESTAMPTZ DEFAULT NOW(),
    updated_ts TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,

    -- Version control
    version INTEGER DEFAULT 1,

    -- Indexes
    CONSTRAINT uk_project_code UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_project_active ON app.d_project(active_flag);
CREATE INDEX IF NOT EXISTS idx_project_created_ts ON app.d_project(created_ts);
```

**Standards:**
- ✅ Table name: `app.d_{entity}` (singular)
- ✅ Primary key: `id UUID`
- ✅ Unique code field: `code VARCHAR(50)`
- ✅ Audit fields: `active_flag`, `created_ts`, `updated_ts`, `created_by`, `updated_by`
- ✅ Indexes on: `active_flag`, `created_ts`

### Step 2: Drizzle Schema Definition

**File:** `apps/api/src/db/schema/{entity}.ts`

```typescript
// apps/api/src/db/schema/project.ts
import { pgTable, uuid, varchar, text, boolean, timestamp, integer } from 'drizzle-orm/pg-core';

export const projectTable = pgTable('d_project', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 50 }),
  priority: varchar('priority', { length: 50 }),

  // Audit fields
  activeFlag: boolean('active_flag').default(true),
  createdTs: timestamp('created_ts', { withTimezone: true }).defaultNow(),
  updatedTs: timestamp('updated_ts', { withTimezone: true }).defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  version: integer('version').default(1)
}, (table) => ({
  // Indexes
  activeIdx: index('idx_project_active').on(table.activeFlag),
  createdIdx: index('idx_project_created_ts').on(table.createdTs)
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
   * List projects with pagination
   * Standard: All list methods must paginate
   */
  async list(params: {
    page?: number;
    limit?: number;
    status?: string;
    userId: string;
  }): Promise<{ data: Project[]; total: number }> {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 100); // Max 100
    const offset = (page - 1) * limit;

    // Build query with filters
    let whereClause = sql`active_flag = true`;
    if (params.status) {
      whereClause = sql`${whereClause} AND status = ${params.status}`;
    }

    // Get total count
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as total
      FROM app.d_project
      WHERE ${whereClause}
    `);
    const total = parseInt(countResult.rows[0]?.total || '0');

    // Get paginated data
    const result = await db.execute(sql`
      SELECT *
      FROM app.d_project
      WHERE ${whereClause}
      ORDER BY created_ts DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    return { data: result.rows as Project[], total };
  }

  /**
   * Get single project by ID
   * Standard: Return null if not found (not 404 error)
   */
  async getById(id: string): Promise<Project | null> {
    const result = await db.execute(sql`
      SELECT *
      FROM app.d_project
      WHERE id = ${id} AND active_flag = true
    `);

    return result.rows[0] as Project || null;
  }

  /**
   * Create project
   * Standard: Return created entity with ID
   */
  async create(data: NewProject, userId: string): Promise<Project> {
    const result = await db.execute(sql`
      INSERT INTO app.d_project (
        code, name, description, status, priority,
        created_by, updated_by
      ) VALUES (
        ${data.code}, ${data.name}, ${data.description},
        ${data.status}, ${data.priority},
        ${userId}, ${userId}
      )
      RETURNING *
    `);

    return result.rows[0] as Project;
  }

  /**
   * Update project
   * Standard: Increment version, update updated_ts
   */
  async update(id: string, data: Partial<Project>, userId: string): Promise<Project> {
    const result = await db.execute(sql`
      UPDATE app.d_project
      SET
        name = COALESCE(${data.name}, name),
        description = COALESCE(${data.description}, description),
        status = COALESCE(${data.status}, status),
        priority = COALESCE(${data.priority}, priority),
        updated_by = ${userId},
        updated_ts = NOW(),
        version = version + 1
      WHERE id = ${id} AND active_flag = true
      RETURNING *
    `);

    if (result.rows.length === 0) {
      throw new Error('Project not found');
    }

    return result.rows[0] as Project;
  }

  /**
   * Soft-delete project
   * Standard: Use factory function for consistency
   */
  async delete(id: string): Promise<void> {
    await universalEntityDelete('project', id);
  }
}

export const projectService = new ProjectService();
```

**Service Layer Standards:**
- ✅ Use class-based services
- ✅ All list methods paginate (default 20, max 100)
- ✅ Return null for not found (not errors)
- ✅ Update `updated_ts`, `updated_by`, `version` on every update
- ✅ Use soft-deletes via `universalEntityDelete()`
- ✅ Include userId in all CUD operations

### Step 4: Route Layer

**File:** `apps/api/src/modules/{entity}/routes.ts`

```typescript
// apps/api/src/modules/project/routes.ts
import type { FastifyInstance } from 'fastify';
import { projectService } from './service.js';
import { resolveUnifiedAbilities } from '@/lib/authz.js';

export async function projectRoutes(fastify: FastifyInstance) {
  // LIST: GET /api/v1/project
  fastify.get('/api/v1/project', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Project'],
      summary: 'List projects',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          status: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'array' },
            total: { type: 'integer' },
            page: { type: 'integer' },
            limit: { type: 'integer' }
          }
        }
      }
    },
    handler: async (request, reply) => {
      const userId = request.user.sub;

      // RBAC check
      const abilities = await resolveUnifiedAbilities(userId);
      if (!abilities.canReadEntity('project')) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const { page = 1, limit = 20, status } = request.query as any;
      const result = await projectService.list({ page, limit, status, userId });

      return reply.send({
        data: result.data,
        total: result.total,
        page,
        limit
      });
    }
  });

  // GET: GET /api/v1/project/:id
  fastify.get('/api/v1/project/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Project'],
      summary: 'Get project by ID',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      }
    },
    handler: async (request, reply) => {
      const userId = request.user.sub;
      const { id } = request.params as { id: string };

      // RBAC check
      const abilities = await resolveUnifiedAbilities(userId);
      if (!abilities.canReadEntity('project')) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const project = await projectService.getById(id);
      if (!project) {
        return reply.code(404).send({ error: 'Project not found' });
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
      body: {
        type: 'object',
        required: ['code', 'name'],
        properties: {
          code: { type: 'string', maxLength: 50 },
          name: { type: 'string', maxLength: 255 },
          description: { type: 'string' },
          status: { type: 'string' },
          priority: { type: 'string' }
        }
      }
    },
    handler: async (request, reply) => {
      const userId = request.user.sub;

      // RBAC check
      const abilities = await resolveUnifiedAbilities(userId);
      if (!abilities.canCreateEntity('project')) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

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

      // RBAC check
      const abilities = await resolveUnifiedAbilities(userId);
      if (!abilities.canUpdateEntity('project', id)) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const data = request.body as any;
      const project = await projectService.update(id, data, userId);

      return reply.send(project);
    }
  });

  // DELETE: DELETE /api/v1/project/:id
  fastify.delete('/api/v1/project/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Project'],
      summary: 'Delete project'
    },
    handler: async (request, reply) => {
      const userId = request.user.sub;
      const { id } = request.params as { id: string };

      // RBAC check
      const abilities = await resolveUnifiedAbilities(userId);
      if (!abilities.canDeleteEntity('project', id)) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      await projectService.delete(id);

      return reply.code(204).send();
    }
  });
}
```

**Route Layer Standards:**
- ✅ Every route has `preHandler: [fastify.authenticate]`
- ✅ Extract userId from `request.user.sub`
- ✅ Check RBAC before business logic
- ✅ Use Fastify schema validation
- ✅ Return 403 for forbidden, 404 for not found, 201 for created
- ✅ Tag routes for OpenAPI grouping

### Step 5: Register Routes

**File:** `apps/api/src/modules/index.ts`

```typescript
// Add to route registration
import { projectRoutes } from './project/routes.js';

export async function registerRoutes(fastify: FastifyInstance) {
  // ... existing routes
  await fastify.register(projectRoutes);
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
./tools/test-api.sh POST /api/v1/project '{"code":"PROJ001","name":"Test Project","status":"ACTIVE"}'

# Test GET endpoint
./tools/test-api.sh GET /api/v1/project/{id}

# Test UPDATE endpoint
./tools/test-api.sh PUT /api/v1/project/{id} '{"status":"COMPLETED"}'

# Test DELETE endpoint
./tools/test-api.sh DELETE /api/v1/project/{id}
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
      eq(projectTable.status, 'ACTIVE')
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
    e.name as manager_name
  FROM app.d_project p
  LEFT JOIN app.d_employee e ON p.created_by = e.id
  WHERE p.active_flag = true
    AND p.status = ${status}
  ORDER BY p.created_ts DESC
  LIMIT ${limit} OFFSET ${offset}
`);

const projects = result.rows as Project[];
```

#### ❌ WRONG: Unsafe String Concatenation

```typescript
// NEVER do this - SQL injection vulnerability!
const query = `SELECT * FROM app.d_project WHERE status = '${status}'`;
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

  // Step 2: Create linkage
  await tx.execute(sql`
    INSERT INTO app.d_entity_id_map (
      parent_entity_type, parent_entity_id,
      child_entity_type, child_entity_id
    ) VALUES (
      'CLIENT', ${clientId},
      'PROJECT', ${projectId}
    )
  `);

  // Step 3: Create registry entry
  await tx.execute(sql`
    INSERT INTO app.d_entity_instance_id (entity_type, entity_id)
    VALUES ('PROJECT', ${projectId})
  `);
});
```

### ORM Standards

| Pattern | Standard | Example |
|---------|----------|---------|
| **Simple queries** | Use Drizzle query builder | `db.select().from(table).where(...)` |
| **Complex queries** | Use `sql`` template | `db.execute(sql`SELECT ... JOIN ...`)` |
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
│ 4. RBAC AUTHORIZATION                                       │
│    resolveUnifiedAbilities(userId)                          │
│    Query: app.rel_employee_scope_unified                    │
│    Check: abilities.canReadEntity('project')                │
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
│    Execute parameterized query                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. DATABASE (PostgreSQL)                                    │
│    Query execution                                          │
│    Return rows                                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. DATA TRANSFORMATION                                      │
│    Convert DB rows to TypeScript objects                    │
│    Apply computed fields (JOINs)                            │
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
│ INSERT INTO app.d_entity_id_map (                           │
│   parent_entity_type = 'PROJECT',                           │
│   parent_entity_id = 'abc-123',                             │
│   child_entity_type = 'TASK',                               │
│   child_entity_id = 'def-456'                               │
│ )                                                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: Create Entity Registry Entry                       │
│ INSERT INTO app.d_entity_instance_id (                      │
│   entity_type = 'TASK',                                     │
│   entity_id = 'def-456'                                     │
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
- [ ] Calls `resolveUnifiedAbilities(userId)`
- [ ] Checks appropriate permission (read/create/update/delete)
- [ ] Returns 403 Forbidden if unauthorized

#### Data Integrity
- [ ] Uses soft-deletes (`active_flag = false`)
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
- [ ] Validates params, query, body
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
   - [ ] RBAC checks before business logic
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
│         Example: db.select().from(projectTable).where(eq(projectTable.status, 'ACTIVE'))
│
└─ NO → Does the query need JOINs or complex logic?
          │
          ├─ YES → Use sql`` template
          │         Example: Multi-table JOINs with computed fields
          │
          └─ NO → Still prefer query builder for type safety
```

### 3. When to Use Transactions

```
Does the operation modify multiple tables?
│
├─ YES → Use db.transaction()
│         Example: Create entity + linkage + registry entry
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
                    │         Example: datalabel_task_status
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
const abilities = await resolveUnifiedAbilities(userId);
console.log('User abilities:', abilities);
console.log('Can read project:', abilities.canReadEntity('project'));

// Verify user has permissions in database
PGPASSWORD='app' psql -h localhost -p 5434 -U app -d app -c "
  SELECT * FROM app.rel_employee_scope_unified
  WHERE emp_id = 'user-id-here'
"
```

#### 404 Not Found Error

```typescript
// Check entity exists and is active
const result = await db.execute(sql`
  SELECT * FROM app.d_project WHERE id = ${id}
`);
console.log('Entity found:', result.rows.length > 0);
console.log('Active flag:', result.rows[0]?.active_flag);
```

#### Empty Child Entity List

```typescript
// Check linkage exists in d_entity_id_map
const linkages = await db.execute(sql`
  SELECT * FROM app.d_entity_id_map
  WHERE parent_entity_id = ${parentId}
    AND parent_entity_type = 'PROJECT'
    AND child_entity_type = 'TASK'
    AND active_flag = true
`);
console.log('Linkages found:', linkages.rows.length);
```

---

## Common Patterns & Examples

### Pattern 1: Enriched List Response (JOINs)

```typescript
// Return entities with computed fields from JOINs
async list(params: { page: number; limit: number }): Promise<{ data: any[]; total: number }> {
  const result = await db.execute(sql`
    SELECT
      p.*,
      e.name as manager_name,
      c.name as client_name,
      (
        SELECT COUNT(*)
        FROM app.d_task t
        JOIN app.d_entity_id_map eim ON t.id = eim.child_entity_id
        WHERE eim.parent_entity_id = p.id
          AND eim.parent_entity_type = 'PROJECT'
          AND eim.child_entity_type = 'TASK'
          AND t.active_flag = true
      ) as task_count
    FROM app.d_project p
    LEFT JOIN app.d_employee e ON p.created_by = e.id
    LEFT JOIN app.d_client c ON p.client_id = c.id
    WHERE p.active_flag = true
    ORDER BY p.created_ts DESC
    LIMIT ${params.limit} OFFSET ${(params.page - 1) * params.limit}
  `);

  return { data: result.rows, total: 0 }; // Compute total separately
}
```

### Pattern 2: Create with Parent Linkage

```typescript
// Create task and link to project
async createTask(data: { name: string; project_id: string }, userId: string): Promise<Task> {
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
      INSERT INTO app.d_entity_id_map (
        parent_entity_type, parent_entity_id,
        child_entity_type, child_entity_id
      ) VALUES (
        'PROJECT', ${data.project_id},
        'TASK', ${task.id}
      )
    `);

    return task as Task;
  });
}
```

### Pattern 3: Soft Delete with Cascading

```typescript
// Delete entity and all linkages
async delete(id: string): Promise<void> {
  await universalEntityDelete('project', id);

  // universalEntityDelete() handles:
  // 1. Soft-delete project (active_flag = false)
  // 2. Soft-delete registry entry (d_entity_instance_id)
  // 3. Soft-delete as parent (project → tasks linkages)
  // 4. Soft-delete as child (client → project linkages)
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
}): Promise<{ data: Task[]; total: number }> {
  let whereClauses = [sql`active_flag = true`];

  if (filters.status) {
    whereClauses.push(sql`status = ${filters.status}`);
  }
  if (filters.priority) {
    whereClauses.push(sql`priority = ${filters.priority}`);
  }
  if (filters.assignee_id) {
    whereClauses.push(sql`assignee_id = ${filters.assignee_id}`);
  }

  const whereClause = whereClauses.reduce((acc, clause, idx) =>
    idx === 0 ? clause : sql`${acc} AND ${clause}`
  );

  const result = await db.execute(sql`
    SELECT * FROM app.d_task
    WHERE ${whereClause}
    ORDER BY created_ts DESC
    LIMIT ${filters.limit} OFFSET ${(filters.page - 1) * filters.limit}
  `);

  return { data: result.rows as Task[], total: 0 };
}
```

### Pattern 5: Options/Settings Endpoint

```typescript
// GET /api/v1/entity/task/options
// Returns dropdown options from settings tables
fastify.get('/api/v1/entity/task/options', {
  preHandler: [fastify.authenticate],
  handler: async (request, reply) => {
    const options = await db.execute(sql`
      SELECT
        (SELECT json_agg(json_build_object('value', code, 'label', name))
         FROM app.datalabel_task_status
         WHERE active_flag = true) as status,
        (SELECT json_agg(json_build_object('value', code, 'label', name))
         FROM app.datalabel_task_priority
         WHERE active_flag = true) as priority,
        (SELECT json_agg(json_build_object('value', id, 'label', name))
         FROM app.d_employee
         WHERE active_flag = true) as assignees
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

### Getting Help

**Documentation References:**
- Universal Entity System: `docs/entity_design_pattern/universal_entity_system.md`
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

**Last Updated:** 2025-11-11
**Version:** 3.1.0
**For Questions:** Refer to OpenAPI spec or existing entity modules as examples
