# RBAC API Migration Guide

## Overview

This guide demonstrates how to migrate from SQL-based RBAC checks to the new API-based RBAC service for gating operations and filtering queries.

**Status**: ✅ RBAC Service Created
**Location**: `/apps/api/src/lib/rbac.service.ts`
**Next Step**: Apply to all API routes

---

## Migration Benefits

| Aspect | Old (SQL-based) | New (API-based) |
|--------|----------------|-----------------|
| **Code Reuse** | Duplicated in every route | Single service, imported once |
| **Maintainability** | Changes require updating 45+ files | Change once, applies everywhere |
| **Testability** | Hard to unit test | Easy to mock and test |
| **Consistency** | Prone to copy-paste errors | Guaranteed consistency |
| **Type Safety** | Raw SQL strings | TypeScript types |
| **Permission Model** | Array-based (legacy) | Integer-based (0-5) |
| **Role Resolution** | Manual UNION queries | Automatic MAX resolution |

---

## Core RBAC Functions

### 1. `hasPermissionOnEntityId()` - Permission Check
```typescript
import { hasPermissionOnEntityId } from '@/lib/rbac.service.js';

const result = await hasPermissionOnEntityId(
  employeeId,    // From JWT: request.user?.sub
  'project',     // Entity type
  projectId,     // Entity UUID or 'all'
  'edit'         // Permission: 'view' | 'edit' | 'share' | 'delete' | 'create' | 'owner'
);

// Returns: { hasPermission: boolean, maxPermissionLevel: number, source: 'role'|'employee'|'both'|'none' }
```

### 2. `getAllScopeByEntityEmployee()` - Get Accessible Entity IDs
```typescript
import { getAllScopeByEntityEmployee } from '@/lib/rbac.service.js';

const scope = await getAllScopeByEntityEmployee(
  employeeId,
  'project',
  'view'
);

// Returns: { scope: string[], hasAllAccess: boolean }
// scope = ['uuid1', 'uuid2', ...] or ['all']
```

### 3. `requirePermission()` - Middleware for UPDATE/DELETE
```typescript
import { requirePermission } from '@/lib/rbac.service.js';

// Apply as preHandler middleware
fastify.put('/api/v1/project/:id', {
  preHandler: [fastify.authenticate, requirePermission('project', 'edit')],
}, async (request, reply) => {
  // Handler only executes if user has edit permission
  // No manual RBAC check needed!
});

fastify.delete('/api/v1/project/:id', {
  preHandler: [fastify.authenticate, requirePermission('project', 'delete')],
}, async (request, reply) => {
  // Handler only executes if user has delete permission
});
```

### 4. `requireCreatePermission()` - Middleware for CREATE
```typescript
import { requireCreatePermission } from '@/lib/rbac.service.js';

fastify.post('/api/v1/project', {
  preHandler: [fastify.authenticate, requireCreatePermission('project')],
}, async (request, reply) => {
  // Handler only executes if user can create projects (permission >= 4 on 'all')
});
```

### 5. `getEntityScopeFilter()` - Helper for SELECT Queries
```typescript
import { getEntityScopeFilter } from '@/lib/rbac.service.js';

const filter = await getEntityScopeFilter(employeeId, 'project', 'view');

if (filter.hasAllAccess) {
  // User can see all projects - no filtering needed
  query = sql`SELECT * FROM app.d_project WHERE active_flag = true`;
} else if (filter.scopeIds.length === 0) {
  // User has no access - return empty result
  return { data: [], total: 0, limit, offset };
} else {
  // Filter by specific IDs
  query = sql`
    SELECT * FROM app.d_project
    WHERE id = ANY(${filter.scopeIds}::uuid[])
    AND active_flag = true
  `;
}
```

---

## Complete Migration Example: Project Routes

### OLD Implementation (Current)

```typescript
// ❌ OLD: GET /api/v1/project (List projects)
fastify.get('/api/v1/project', {
  preHandler: [fastify.authenticate],
}, async (request, reply) => {
  const userId = request.user?.sub;

  // PROBLEM 1: Manual RBAC check in every endpoint
  // PROBLEM 2: Uses legacy array-based permission model
  // PROBLEM 3: Incorrect field names (empid, entity instead of person_entity_id, entity_name)
  // PROBLEM 4: Missing role-based permission resolution
  const baseConditions = [
    sql`(
      EXISTS (
        SELECT 1 FROM app.d_entity_rbac rbac
        WHERE rbac.empid = ${userId}
          AND rbac.entity = 'project'
          AND (rbac.entity_id = p.id::text OR rbac.entity_id = 'all')
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND 0 = ANY(rbac.permission)  -- Legacy array-based check
      )
    )`
  ];

  const projects = await db.execute(sql`
    SELECT * FROM app.d_project p
    WHERE ${sql.join(baseConditions, sql` AND `)}
  `);

  return { data: projects };
});

// ❌ OLD: PUT /api/v1/project/:id (Update project)
fastify.put('/api/v1/project/:id', {
  preHandler: [fastify.authenticate],
}, async (request, reply) => {
  const { id } = request.params;
  const userId = request.user?.sub;

  // PROBLEM: Manual RBAC check duplicated in every endpoint
  const projectEditAccess = await db.execute(sql`
    SELECT 1 FROM app.d_entity_rbac rbac
    WHERE rbac.empid = ${userId}
      AND rbac.entity = 'project'
      AND (rbac.entity_id = ${id}::text OR rbac.entity_id = 'all')
      AND rbac.active_flag = true
      AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
      AND 1 = ANY(rbac.permission)  -- Legacy array-based check
  `);

  if (projectEditAccess.length === 0) {
    return reply.status(403).send({ error: 'Insufficient permissions' });
  }

  // ... update logic
});

// ❌ OLD: POST /api/v1/project (Create project)
fastify.post('/api/v1/project', {
  preHandler: [fastify.authenticate],
}, async (request, reply) => {
  const userId = request.user?.sub;

  // PROBLEM: Manual RBAC check for create permission
  const projectCreateAccess = await db.execute(sql`
    SELECT 1 FROM app.d_entity_rbac rbac
    WHERE rbac.empid = ${userId}
      AND rbac.entity = 'project'
      AND rbac.entity_id = 'all'
      AND rbac.active_flag = true
      AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
      AND 4 = ANY(rbac.permission)  -- Legacy array-based check
  `);

  if (projectCreateAccess.length === 0) {
    return reply.status(403).send({ error: 'Insufficient permissions' });
  }

  // ... create logic
});
```

### NEW Implementation (API-based)

```typescript
// ✅ NEW: Import RBAC service once at top
import {
  requirePermission,
  requireCreatePermission,
  getEntityScopeFilter,
} from '@/lib/rbac.service.js';

// ✅ NEW: GET /api/v1/project (List projects with scope filtering)
fastify.get('/api/v1/project', {
  preHandler: [fastify.authenticate],
  schema: {
    querystring: Type.Object({
      active: Type.Optional(Type.Boolean()),
      search: Type.Optional(Type.String()),
      limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
      offset: Type.Optional(Type.Number({ minimum: 0 })),
    }),
  },
}, async (request, reply) => {
  const { active, search, limit = 20, offset = 0 } = request.query as any;
  const userId = request.user?.sub;

  if (!userId) {
    return reply.status(401).send({ error: 'User not authenticated' });
  }

  try {
    // ✅ Get employee's project scope using API function
    const scopeFilter = await getEntityScopeFilter(userId, 'project', 'view');

    // ✅ Handle three cases: all access, specific IDs, or no access
    if (scopeFilter.scopeIds.length === 0 && !scopeFilter.hasAllAccess) {
      // No access - return empty result
      return { data: [], total: 0, limit, offset };
    }

    // Build query conditions
    const conditions = [];

    // ✅ Add scope filter (only if not "all access")
    if (!scopeFilter.hasAllAccess) {
      conditions.push(sql`p.id = ANY(${scopeFilter.scopeIds}::uuid[])`);
    }

    if (active !== undefined) {
      conditions.push(sql`p.active_flag = ${active}`);
    }

    if (search) {
      conditions.push(sql`(
        p.name ILIKE ${`%${search}%`} OR
        p.descr ILIKE ${`%${search}%`} OR
        p.code ILIKE ${`%${search}%`}
      )`);
    }

    // Execute queries
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as total
      FROM app.d_project p
      ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
    `);
    const total = Number(countResult[0]?.total || 0);

    const projects = await db.execute(sql`
      SELECT
        p.id, p.code, p.name, p.descr, p.metadata,
        p.dl__project_stage,
        p.budget_allocated_amt, p.budget_spent_amt,
        p.planned_start_date, p.planned_end_date,
        p.manager_employee_id, p.sponsor_employee_id,
        p.from_ts, p.to_ts, p.active_flag, p.created_ts, p.updated_ts, p.version
      FROM app.d_project p
      ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      ORDER BY p.name ASC NULLS LAST, p.created_ts DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    return { data: projects, total, limit, offset };
  } catch (error) {
    fastify.log.error('Error fetching projects:', error);
    return reply.status(500).send({ error: 'Internal server error' });
  }
});

// ✅ NEW: GET /api/v1/project/:id (Get single project)
fastify.get('/api/v1/project/:id', {
  preHandler: [
    fastify.authenticate,
    requirePermission('project', 'view')  // ✅ Middleware handles all RBAC logic
  ],
  schema: {
    params: Type.Object({
      id: Type.String({ format: 'uuid' }),
    }),
  },
}, async (request, reply) => {
  const { id } = request.params as { id: string };

  // ✅ No manual RBAC check needed - middleware already validated!

  try {
    const project = await db.execute(sql`
      SELECT
        id, code, name, descr, metadata,
        dl__project_stage,
        budget_allocated_amt, budget_spent_amt,
        planned_start_date, planned_end_date,
        manager_employee_id, sponsor_employee_id,
        from_ts, to_ts, active_flag, created_ts, updated_ts, version
      FROM app.d_project
      WHERE id = ${id}
    `);

    if (project.length === 0) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    return project[0];
  } catch (error) {
    fastify.log.error('Error fetching project:', error);
    return reply.status(500).send({ error: 'Internal server error' });
  }
});

// ✅ NEW: POST /api/v1/project (Create project)
fastify.post('/api/v1/project', {
  preHandler: [
    fastify.authenticate,
    requireCreatePermission('project')  // ✅ Single line replaces 15 lines of RBAC code
  ],
  schema: {
    body: CreateProjectSchema,
  },
}, async (request, reply) => {
  const data = request.body as any;

  // ✅ No manual RBAC check needed!

  // Auto-generate required fields
  if (!data.name) data.name = 'Untitled';
  if (!data.code) data.code = `PROJECT-${Date.now()}`;

  try {
    const result = await db.execute(sql`
      INSERT INTO app.d_project (
        code, name, descr, metadata,
        dl__project_stage,
        budget_allocated_amt, budget_spent_amt,
        active_flag
      )
      VALUES (
        ${data.code},
        ${data.name},
        ${data.descr || null},
        ${data.metadata ? JSON.stringify(data.metadata) : '{}'}::jsonb,
        ${data.dl__project_stage || null},
        ${data.budget_allocated || null},
        ${data.budget_spent || 0},
        ${data.active_flag !== false}
      )
      RETURNING *
    `);

    const newProject = result[0] as any;

    // Register in entity instance registry
    await db.execute(sql`
      INSERT INTO app.d_entity_instance_registry (entity_type, entity_id, entity_name, entity_code)
      VALUES ('project', ${newProject.id}::uuid, ${newProject.name}, ${newProject.code})
      ON CONFLICT (entity_type, entity_id) DO UPDATE
      SET entity_name = EXCLUDED.entity_name,
          entity_code = EXCLUDED.entity_code,
          updated_ts = NOW()
    `);

    return reply.status(201).send(newProject);
  } catch (error) {
    fastify.log.error('Error creating project:', error);
    return reply.status(500).send({ error: 'Internal server error' });
  }
});

// ✅ NEW: PUT /api/v1/project/:id (Update project)
fastify.put('/api/v1/project/:id', {
  preHandler: [
    fastify.authenticate,
    requirePermission('project', 'edit')  // ✅ Single line replaces 20 lines of RBAC code
  ],
  schema: {
    params: Type.Object({
      id: Type.String({ format: 'uuid' }),
    }),
    body: UpdateProjectSchema,
  },
}, async (request, reply) => {
  const { id } = request.params as { id: string };
  const data = request.body as any;

  // ✅ No manual RBAC check needed!

  try {
    const updateFields = [];

    if (data.name !== undefined) updateFields.push(sql`name = ${data.name}`);
    if (data.descr !== undefined) updateFields.push(sql`descr = ${data.descr}`);
    if (data.code !== undefined) updateFields.push(sql`code = ${data.code}`);
    if (data.dl__project_stage !== undefined) updateFields.push(sql`dl__project_stage = ${data.dl__project_stage}`);
    if (data.budget_allocated !== undefined) updateFields.push(sql`budget_allocated_amt = ${data.budget_allocated}`);
    if (data.active_flag !== undefined) updateFields.push(sql`active_flag = ${data.active_flag}`);

    if (updateFields.length === 0) {
      return reply.status(400).send({ error: 'No fields to update' });
    }

    updateFields.push(sql`updated_ts = NOW()`);

    const result = await db.execute(sql`
      UPDATE app.d_project
      SET ${sql.join(updateFields, sql`, `)}
      WHERE id = ${id}
      RETURNING *
    `);

    if (result.length === 0) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    return result[0];
  } catch (error) {
    fastify.log.error('Error updating project:', error);
    return reply.status(500).send({ error: 'Internal server error' });
  }
});

// ✅ NEW: DELETE /api/v1/project/:id (Delete project)
fastify.delete('/api/v1/project/:id', {
  preHandler: [
    fastify.authenticate,
    requirePermission('project', 'delete')  // ✅ Single line for delete permission
  ],
  schema: {
    params: Type.Object({
      id: Type.String({ format: 'uuid' }),
    }),
  },
}, async (request, reply) => {
  const { id } = request.params as { id: string };

  // ✅ No manual RBAC check needed!

  try {
    // Soft delete
    const result = await db.execute(sql`
      UPDATE app.d_project
      SET active_flag = false, updated_ts = NOW()
      WHERE id = ${id}
      RETURNING id
    `);

    if (result.length === 0) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    return { success: true, id };
  } catch (error) {
    fastify.log.error('Error deleting project:', error);
    return reply.status(500).send({ error: 'Internal server error' });
  }
});
```

---

## Migration Checklist

### For Each Entity Route File

- [ ] Import RBAC service at top of file
  ```typescript
  import {
    requirePermission,
    requireCreatePermission,
    getEntityScopeFilter,
  } from '@/lib/rbac.service.js';
  ```

- [ ] **GET /api/v1/:entity** (List)
  - [ ] Replace manual RBAC WHERE clause with `getEntityScopeFilter()`
  - [ ] Handle `hasAllAccess` case (no filtering)
  - [ ] Handle `scopeIds.length === 0` case (return empty)
  - [ ] Add `id = ANY(scopeIds)` filter for specific IDs

- [ ] **GET /api/v1/:entity/:id** (Get Single)
  - [ ] Add `requirePermission(entityName, 'view')` to preHandler
  - [ ] Remove manual RBAC check from handler body

- [ ] **POST /api/v1/:entity** (Create)
  - [ ] Add `requireCreatePermission(entityName)` to preHandler
  - [ ] Remove manual RBAC check from handler body

- [ ] **PUT /api/v1/:entity/:id** (Update)
  - [ ] Add `requirePermission(entityName, 'edit')` to preHandler
  - [ ] Remove manual RBAC check from handler body

- [ ] **DELETE /api/v1/:entity/:id** (Delete)
  - [ ] Add `requirePermission(entityName, 'delete')` to preHandler
  - [ ] Remove manual RBAC check from handler body

- [ ] **GET /api/v1/:parent/:id/:child** (Child Entity List)
  - [ ] Keep parent permission check: `requirePermission(parentEntity, 'view')`
  - [ ] Add child scope filtering: `getEntityScopeFilter(userId, childEntity, 'view')`
  - [ ] Combine parent access + child scope in WHERE clause

---

## Advanced Patterns

### Pattern 1: Custom Entity ID Parameter
```typescript
// If entity ID is not in :id parameter
fastify.put('/api/v1/custom/route/:projectId', {
  preHandler: [
    fastify.authenticate,
    requirePermission('project', 'edit', 'projectId')  // Specify parameter name
  ],
}, handler);
```

### Pattern 2: Multiple Permission Checks
```typescript
// Check both parent and child permissions
fastify.post('/api/v1/project/:projectId/task', {
  preHandler: [
    fastify.authenticate,
    requirePermission('project', 'edit', 'projectId'),  // Can edit parent
    requireCreatePermission('task')  // Can create child
  ],
}, handler);
```

### Pattern 3: Conditional Permission Logic
```typescript
// Use canCreateChildEntity() for complex parent-child relationships
import { canCreateChildEntity } from '@/lib/rbac.service.js';

const canCreate = await canCreateChildEntity(
  employeeId,
  'project',      // Parent entity
  projectId,      // Parent ID
  'task'          // Child entity
);

if (!canCreate) {
  return reply.status(403).send({
    error: 'You need edit permission on project AND create permission on tasks'
  });
}
```

### Pattern 4: Combining Scope Filters
```typescript
// Filter by both entity scope AND business rules
const scopeFilter = await getEntityScopeFilter(userId, 'project', 'view');

const conditions = [];

// Add RBAC scope
if (!scopeFilter.hasAllAccess) {
  if (scopeFilter.scopeIds.length === 0) {
    return { data: [], total: 0 };
  }
  conditions.push(sql`id = ANY(${scopeFilter.scopeIds}::uuid[])`);
}

// Add business filters
if (filters.status) {
  conditions.push(sql`dl__project_stage = ${filters.status}`);
}

if (filters.businessId) {
  conditions.push(sql`metadata->>'business_id' = ${filters.businessId}`);
}
```

---

## Testing the Migration

### 1. Test Permission Gating
```bash
# Test without permission (should return 403)
curl -X PUT http://localhost:4000/api/v1/project/uuid \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated"}'

# Expected: 403 Permission denied
```

### 2. Test Scope Filtering
```bash
# List projects (should only show accessible ones)
curl -X GET http://localhost:4000/api/v1/project \
  -H "Authorization: Bearer $TOKEN"

# Expected: Only projects where employee has view permission
```

### 3. Test Create Permission
```bash
# Create project (should check type-level create permission)
curl -X POST http://localhost:4000/api/v1/project \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "New Project", "code": "PROJ-001"}'

# Expected: 403 if no create permission, 201 if allowed
```

---

## Rollout Strategy

### Phase 1: Core Entities (Week 1)
- [ ] `/modules/project/routes.ts`
- [ ] `/modules/task/routes.ts`
- [ ] `/modules/employee/routes.ts`
- [ ] `/modules/office/routes.ts`
- [ ] `/modules/business/routes.ts`

### Phase 2: Customer 360 (Week 2)
- [ ] `/modules/cust/routes.ts` (customer)
- [ ] `/modules/role/routes.ts`
- [ ] `/modules/worksite/routes.ts`

### Phase 3: Operations (Week 3)
- [ ] `/modules/work_order/routes.ts`
- [ ] `/modules/service/routes.ts`
- [ ] `/modules/wiki/routes.ts`
- [ ] `/modules/artifact/routes.ts`
- [ ] `/modules/form/routes.ts`

### Phase 4: Remaining Domains (Week 4)
- [ ] `/modules/product/routes.ts`
- [ ] `/modules/inventory/routes.ts`
- [ ] `/modules/order/routes.ts`
- [ ] `/modules/quote/routes.ts`
- [ ] `/modules/invoice/routes.ts`
- [ ] `/modules/expense/routes.ts`
- [ ] `/modules/revenue/routes.ts`
- [ ] All other entity modules

---

## Common Pitfalls

### ❌ Pitfall 1: Forgetting to Remove Manual Checks
```typescript
// BAD: Middleware handles permission, but manual check is still there
fastify.put('/api/v1/project/:id', {
  preHandler: [fastify.authenticate, requirePermission('project', 'edit')],
}, async (request, reply) => {
  // ❌ Don't do this - middleware already checked!
  const projectEditAccess = await db.execute(sql`...RBAC check...`);
  if (projectEditAccess.length === 0) {
    return reply.status(403).send({ error: 'No permission' });
  }
  // ...
});
```

### ❌ Pitfall 2: Not Handling Empty Scope
```typescript
// BAD: Querying with empty scopeIds array
const filter = await getEntityScopeFilter(userId, 'project', 'view');
// ❌ Don't query if no access!
const projects = await db.execute(sql`
  SELECT * FROM app.d_project WHERE id = ANY(${filter.scopeIds}::uuid[])
`);
// This will fail if scopeIds is empty!

// GOOD: Check before querying
if (filter.scopeIds.length === 0 && !filter.hasAllAccess) {
  return { data: [], total: 0 };
}
```

### ❌ Pitfall 3: Wrong Permission Level
```typescript
// BAD: Using 'view' for update operation
fastify.put('/api/v1/project/:id', {
  preHandler: [fastify.authenticate, requirePermission('project', 'view')],  // ❌ Wrong!
}, handler);

// GOOD: Use 'edit' for updates
fastify.put('/api/v1/project/:id', {
  preHandler: [fastify.authenticate, requirePermission('project', 'edit')],  // ✅ Correct
}, handler);
```

---

## Performance Considerations

### Database Query Optimization
```typescript
// The RBAC service queries are optimized:
// 1. UNION ALL (not UNION) - no deduplication overhead
// 2. MAX() aggregation - single pass
// 3. Indexed columns: person_entity_id, entity_name, entity_id
// 4. Cached in application layer (future enhancement)

// Expected query time: < 10ms for permission check
// Expected query time: < 50ms for scope resolution
```

### Caching Strategy (Future)
```typescript
// TODO: Add Redis caching for permission results
// Cache key: `rbac:${employeeId}:${entityName}:${entityId}:${permission}`
// TTL: 5 minutes
// Invalidate on: RBAC table updates
```

---

## Summary

| Metric | Impact |
|--------|--------|
| **Code Reduction** | ~60 lines → ~3 lines per endpoint |
| **Files Changed** | 45+ route files |
| **Type Safety** | SQL strings → TypeScript types |
| **Permission Model** | Array-based → Integer (0-5) |
| **Maintainability** | ⭐⭐ → ⭐⭐⭐⭐⭐ |
| **Test Coverage** | Hard to test → Easy to mock |

**Next Steps**:
1. ✅ RBAC service created
2. ⏳ Migrate project routes (pilot)
3. ⏳ Migrate all entity routes
4. ⏳ Remove SQL functions from DDL
5. ⏳ Update documentation
6. ⏳ Add integration tests
