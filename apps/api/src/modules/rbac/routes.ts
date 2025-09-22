import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { hasPermissionOnEntityId, getEmployeeEntityIds, getEmployeeEntityPermissions } from './ui-api-permission-rbac-gate.js';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

export async function rbacRoutes(fastify: FastifyInstance) {
  // Test endpoint without authentication - for development only
  fastify.post('/api/v1/rbac/test-permissions', {
    schema: {
      body: Type.Object({
        entityType: Type.String(),
        userId: Type.Optional(Type.String()),
      }),
      response: {
        200: Type.Object({
          entityType: Type.String(),
          permissions: Type.Array(Type.Object({
            actionEntityId: Type.String(),
            actions: Type.Array(Type.String()),
          })),
        }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { entityType, userId } = request.body as any;

    // Use James Miller's ID for testing
    const testUserId = userId || '353a8477-0002-4a4e-9e7a-88f83dfd6724';

    try {
      const permissions = await getEmployeeEntityPermissions(testUserId, entityType);

      return {
        entityType,
        permissions: permissions.map(p => ({
          actionEntityId: p.actionEntityId,
          actions: p.permissions,
        })),
      };
    } catch (error) {
      fastify.log.error('Error checking permissions:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ===============================
  // 3-TIERED RBAC API SOLUTION
  // ===============================

  // TIER 1: Get comprehensive permissions by entity type (for main page data tables)
  // Case I: Main page data table rbac buttons: project list (/project) and project detail overview (/project/{id})
  fastify.post('/api/v1/rbac/get-permissions-by-entityType', {
    preHandler: [fastify.authenticate],
    schema: {
      body: Type.Object({
        entityType: Type.String(),
      }),
      response: {
        200: Type.Object({
          entityType: Type.String(),
          permissions: Type.Array(Type.Object({
            actionEntityId: Type.String({ minLength: 0, description: "Entity ID - empty string for global permissions" }),
            actions: Type.Array(Type.String()),
          })),
        }),
        401: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { entityType } = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      const permissions = await getEmployeeEntityPermissions(userId, entityType);

      return {
        entityType,
        permissions: permissions.map(p => ({
          actionEntityId: p.actionEntityId,
          actions: p.permissions,
        })),
      };
    } catch (error) {
      fastify.log.error('Error getting permissions by entity type:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // TIER 2: Get permissions for specific entity (for detail page inline edit and share)
  // Case II: Detail page inline edit and share permissions - returns permissions JSON for specific entity
  fastify.post('/api/v1/rbac/check-permission-of-entity', {
    preHandler: [fastify.authenticate],
    schema: {
      body: Type.Object({
        entityType: Type.String(),
        entityId: Type.String(),
      }),
      response: {
        200: Type.Object({
          entityType: Type.String(),
          entityId: Type.String(),
          permissions: Type.Array(Type.Object({
            actionEntityId: Type.String({ minLength: 0, description: "Entity ID - empty string for global permissions" }),
            actions: Type.Array(Type.String()),
          })),
        }),
        401: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { entityType, entityId } = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Get comprehensive permissions for the entity type
      const allPermissions = await getEmployeeEntityPermissions(userId, entityType);

      // Find permissions for the specific entity only
      const entityPermissions = allPermissions.filter(p => p.actionEntityId === entityId);

      return {
        entityType,
        entityId,
        permissions: entityPermissions.map(p => ({
          actionEntityId: p.actionEntityId,
          actions: p.permissions,
        })),
      };
    } catch (error) {
      fastify.log.error('Error getting permissions for specific entity:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // TIER 3: Get permissions for action entities within parent context (for action entity tabs)
  // Case III: Header navigation tab clicked - action entity data tables (/project/{id}/task, /project/{id}/wiki, etc.)
  fastify.post('/api/v1/rbac/get-permissions-by-parentEntity-actionEntity', {
    preHandler: [fastify.authenticate],
    schema: {
      body: Type.Object({
        parentEntity: Type.String(),
        parentEntityId: Type.String(),
        actionEntity: Type.String(),
      }),
      response: {
        200: Type.Object({
          parentEntity: Type.String(),
          parentEntityId: Type.String(),
          actionEntity: Type.String(),
          permissions: Type.Array(Type.Object({
            actionEntityId: Type.String({ minLength: 0, description: "Entity ID - empty string for global permissions" }),
            actions: Type.Array(Type.String()),
          })),
        }),
        401: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { parentEntity, parentEntityId, actionEntity } = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Check if user has access to the parent entity first
      const hasParentAccess = await hasPermissionOnEntityId(userId, parentEntity, parentEntityId, 'view');

      if (!hasParentAccess) {
        // If no access to parent, return empty permissions
        return {
          parentEntity,
          parentEntityId,
          actionEntity,
          permissions: [],
        };
      }

      // Get all action entities of the specified type that are children of this parent
      let childEntityIds: string[] = [];

      // First, try to find relationships via hierarchy mapping table
      const hierarchyResult = await db.execute(sql`
        SELECT DISTINCT action_entity_id
        FROM app.entity_id_hierarchy_mapping
        WHERE parent_entity = ${parentEntity}
          AND parent_entity_id = ${parentEntityId}
          AND action_entity = ${actionEntity}
          AND active = true
          AND (to_ts IS NULL OR to_ts > NOW())
      `);

      if (hierarchyResult.length > 0) {
        childEntityIds = hierarchyResult.map(row => row.action_entity_id as string);
      } else {
        // If no results from hierarchy mapping, try direct foreign key relationships
        if (parentEntity === 'project' && actionEntity === 'task') {
          const directResult = await db.execute(sql`
            SELECT DISTINCT id
            FROM app.ops_task_head
            WHERE project_id = ${parentEntityId}
          `);
          childEntityIds = directResult.map(row => row.id as string);
        } else if (parentEntity === 'project' && actionEntity === 'wiki') {
          const directResult = await db.execute(sql`
            SELECT DISTINCT id
            FROM app.d_wiki
            WHERE project_id = ${parentEntityId}
          `);
          childEntityIds = directResult.map(row => row.id as string);
        } else if (parentEntity === 'project' && actionEntity === 'artifact') {
          const directResult = await db.execute(sql`
            SELECT DISTINCT id
            FROM app.d_artifact
            WHERE project_id = ${parentEntityId}
          `);
          childEntityIds = directResult.map(row => row.id as string);
        }
        // Add more parent-action entity relationships as needed
      }

      // Get comprehensive permissions for the action entity type
      const allPermissions = await getEmployeeEntityPermissions(userId, actionEntity);

      // Filter permissions to only include entities that are children of the parent
      const filteredPermissions = allPermissions.filter(p =>
        childEntityIds.includes(p.actionEntityId) || p.actionEntityId === '' // Include global permissions
      );

      return {
        parentEntity,
        parentEntityId,
        actionEntity,
        permissions: filteredPermissions.map(p => ({
          actionEntityId: p.actionEntityId,
          actions: p.permissions,
        })),
      };
    } catch (error) {
      fastify.log.error('Error getting permissions by parent-action entity:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}