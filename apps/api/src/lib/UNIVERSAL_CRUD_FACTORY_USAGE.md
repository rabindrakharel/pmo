# Universal CRUD Factory - Usage Guide

## Overview

The Universal CRUD Factory provides a DRY pattern for creating entity CRUD routes with built-in RBAC gating. **No more repetitive permission checks!**

## Permission Model (Automatic)

All routes automatically enforce RBAC using `checkPermission(userId, entityType, entityId, action)`:

- **GET /api/v1/{entity}** → Requires `view` permission (0)
- **GET /api/v1/{entity}/:id** → Requires `view` permission (0) on specific entity
- **POST /api/v1/{entity}** → Requires `create` permission (4) on entity type
- **PATCH /api/v1/{entity}/:id** → Requires `edit` permission (1) on specific entity
- **DELETE /api/v1/{entity}/:id** → Requires `delete` permission (3) on specific entity

## Basic Usage

### Minimal Example (5 routes, RBAC included)

```typescript
// apps/api/src/modules/project/routes.ts
import type { FastifyInstance } from 'fastify';
import { createUniversalCRUDRoutes } from '@/lib/universal-crud-factory.js';

export async function projectRoutes(fastify: FastifyInstance) {
  // This ONE line creates all 5 CRUD routes with RBAC gating:
  createUniversalCRUDRoutes(fastify, {
    entityType: 'project',
    tableName: 'd_project'
  });
}
```

**That's it!** You now have:
- ✅ GET /api/v1/project (list with RBAC filtering)
- ✅ GET /api/v1/project/:id (view with RBAC check)
- ✅ POST /api/v1/project (create with RBAC check)
- ✅ PATCH /api/v1/project/:id (update with RBAC check)
- ✅ DELETE /api/v1/project/:id (delete with RBAC check + cascade)

## Advanced Usage

### With Validation Schemas

```typescript
import { Type } from '@sinclair/typebox';
import { createUniversalCRUDRoutes } from '@/lib/universal-crud-factory.js';

const ProjectCreateSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 200 }),
  code: Type.String({ minLength: 1, maxLength: 50 }),
  dl__project_stage: Type.String(),
  budget_amt: Type.Optional(Type.Number())
});

const ProjectUpdateSchema = Type.Object({
  name: Type.Optional(Type.String()),
  dl__project_stage: Type.Optional(Type.String()),
  budget_amt: Type.Optional(Type.Number())
});

export async function projectRoutes(fastify: FastifyInstance) {
  createUniversalCRUDRoutes(fastify, {
    entityType: 'project',
    tableName: 'd_project',
    createSchema: ProjectCreateSchema,
    updateSchema: ProjectUpdateSchema
  });
}
```

### With Lifecycle Hooks

```typescript
export async function projectRoutes(fastify: FastifyInstance) {
  createUniversalCRUDRoutes(fastify, {
    entityType: 'project',
    tableName: 'd_project',
    hooks: {
      // Run before creating entity
      beforeCreate: async (data, userId) => {
        // Add default values
        data.created_by = userId;
        data.status = data.status || 'draft';
        return data;
      },

      // Run after creating entity
      afterCreate: async (entity, userId) => {
        // Register in entity instance registry
        await db.execute(sql`
          INSERT INTO app.d_entity_instance_id (entity_type, entity_id)
          VALUES ('project', ${entity.id})
        `);
      },

      // Run before updating entity
      beforeUpdate: async (id, data, userId) => {
        // Audit log or validation
        console.log(`User ${userId} updating project ${id}`);
        return data;
      },

      // Run after updating entity
      afterUpdate: async (entity, userId) => {
        // Trigger notifications
        await notifyProjectUpdate(entity.id);
      },

      // Run before deleting entity
      beforeDelete: async (id, userId) => {
        // Archive important data
        await archiveProjectData(id);
      },

      // Run after deleting entity
      afterDelete: async (id, userId) => {
        // Cleanup external resources (S3, etc.)
        await cleanupProjectFiles(id);
      }
    }
  });
}
```

### Selectively Disable Routes

```typescript
export async function readOnlyEntityRoutes(fastify: FastifyInstance) {
  createUniversalCRUDRoutes(fastify, {
    entityType: 'reports',
    tableName: 'd_reports',
    disable: {
      create: true,  // No POST route
      update: true,  // No PATCH route
      delete: true   // No DELETE route
    }
  });
  // Only GET routes are created
}
```

### Custom List Filtering

```typescript
export async function taskRoutes(fastify: FastifyInstance) {
  createUniversalCRUDRoutes(fastify, {
    entityType: 'task',
    tableName: 'd_task',
    // Add custom WHERE clause to list endpoint
    listWhereClause: (userId) => sql`
      (assignee_id = ${userId} OR created_by = ${userId})
    `
  });
}
```

## Migration Guide

### Before (Old Pattern - Repetitive)

```typescript
// 100+ lines of repetitive RBAC code per entity...

fastify.get('/api/v1/project/:id', async (request, reply) => {
  const { id } = request.params;
  const userId = request.user?.sub;

  // Manual RBAC check
  const hasAccess = await checkPermission(userId, 'project', id, 'view');
  if (!hasAccess) {
    return reply.status(403).send({ error: 'No permission' });
  }

  // Fetch entity
  const result = await db.execute(sql`
    SELECT * FROM app.d_project WHERE id = ${id}
  `);
  return reply.send(result[0]);
});

// ... repeat for POST, PATCH, DELETE with different permissions
```

### After (New Pattern - DRY)

```typescript
// 5 lines creates all routes with RBAC:

export async function projectRoutes(fastify: FastifyInstance) {
  createUniversalCRUDRoutes(fastify, {
    entityType: 'project',
    tableName: 'd_project'
  });
}
```

## Fine-Grained Control

If you need custom logic for specific routes, use individual factories:

```typescript
import {
  createListRoute,
  createGetOneRoute,
  createUpdateRoute
} from '@/lib/universal-crud-factory.js';

export async function customRoutes(fastify: FastifyInstance) {
  // Use factory for standard routes
  createListRoute(fastify, { entityType: 'project', tableName: 'd_project' });
  createGetOneRoute(fastify, { entityType: 'project', tableName: 'd_project' });

  // Custom POST with special logic
  fastify.post('/api/v1/project', async (request, reply) => {
    // Your custom implementation
  });

  // Factory for update/delete
  createUpdateRoute(fastify, { entityType: 'project', tableName: 'd_project' });
}
```

## RBAC Details

The factory automatically:
- ✅ Checks `entity_id_rbac_map` table with role + employee UNION
- ✅ Supports hierarchical permissions (Owner [5] > Create [4] > Delete [3] > Share [2] > Edit [1] > View [0])
- ✅ Handles `'11111111-1111-1111-1111-111111111111'` for type-level permissions
- ✅ Filters list results based on user's accessible entities
- ✅ Returns 403 Forbidden for unauthorized access
- ✅ Returns 401 Unauthorized for missing authentication

## Performance

- Single RBAC query per request (no N+1 queries)
- Optimized with proper indexes on `entity_id_rbac_map`
- List endpoint uses EXISTS clause for efficient filtering

## Error Handling

All routes return standard HTTP status codes:
- `200 OK` - Success
- `201 Created` - Resource created
- `204 No Content` - Delete success
- `401 Unauthorized` - Missing authentication
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Entity doesn't exist
- `500 Internal Server Error` - Server error

## Best Practices

1. **Use the factory by default** - Only write custom routes when truly necessary
2. **Add validation schemas** - Protect your API with TypeBox schemas
3. **Use hooks for side effects** - Keep business logic in hooks, not routes
4. **Disable unused routes** - Security through minimal surface area
5. **Let RBAC do the work** - Trust the permission system, don't add extra checks
