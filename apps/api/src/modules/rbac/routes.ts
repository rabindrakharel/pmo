import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import {
  hasPermissionOnEntityId,
  getEmployeeEntityIds,
  getEmployeeEntityPermissions,
  PermissionLevel,
  getMainPageActionPermissions,
  canAssignProjectToBusiness,
  canNavigateToChildEntity
} from './entity-permission-rbac-gate.js';
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
      // Get permission levels for the specific entity using new system
      const permissionLevels = await getEmployeeEntityPermissions(userId, entityType, entityId);

      // Convert permission levels to action strings
      const actions: string[] = [];
      if (permissionLevels.includes(PermissionLevel.VIEW)) actions.push('view');
      if (permissionLevels.includes(PermissionLevel.EDIT)) actions.push('edit');
      if (permissionLevels.includes(PermissionLevel.SHARE)) actions.push('share');
      if (permissionLevels.includes(PermissionLevel.DELETE)) actions.push('delete');
      if (permissionLevels.includes(PermissionLevel.CREATE)) actions.push('create');

      return {
        entityType,
        entityId,
        permissions: [{
          actionEntityId: entityId,
          actions: actions,
        }],
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
        SELECT DISTINCT child_entity_id
        FROM app.entity_id_map
        WHERE parent_entity_type = ${parentEntity}
          AND parent_entity_id = ${parentEntityId}
          AND child_entity_type = ${actionEntity}
          AND active_flag = true
      `);

      if (hierarchyResult.length > 0) {
        childEntityIds = hierarchyResult.map(row => row.child_entity_id as string);
      } else {
        // If no results from hierarchy mapping, try direct foreign key relationships
        if (parentEntity === 'project' && actionEntity === 'task') {
          const directResult = await db.execute(sql`
            SELECT DISTINCT id
            FROM app.d_task
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

      // Get permissions for each child entity
      const permissions = [];

      // Check 'all' permission for this action entity type
      const allPermissionLevels = await getEmployeeEntityPermissions(userId, actionEntity, 'all');
      if (allPermissionLevels.length > 0) {
        const actions: string[] = [];
        if (allPermissionLevels.includes(PermissionLevel.VIEW)) actions.push('view');
        if (allPermissionLevels.includes(PermissionLevel.EDIT)) actions.push('edit');
        if (allPermissionLevels.includes(PermissionLevel.SHARE)) actions.push('share');
        if (allPermissionLevels.includes(PermissionLevel.DELETE)) actions.push('delete');
        if (allPermissionLevels.includes(PermissionLevel.CREATE)) actions.push('create');

        permissions.push({
          actionEntityId: '', // Empty string represents global permissions
          actions: actions,
        });
      }

      // Check permissions for each specific child entity
      for (const childEntityId of childEntityIds) {
        const permissionLevels = await getEmployeeEntityPermissions(userId, actionEntity, childEntityId);
        if (permissionLevels.length > 0) {
          const actions: string[] = [];
          if (permissionLevels.includes(PermissionLevel.VIEW)) actions.push('view');
          if (permissionLevels.includes(PermissionLevel.EDIT)) actions.push('edit');
          if (permissionLevels.includes(PermissionLevel.SHARE)) actions.push('share');
          if (permissionLevels.includes(PermissionLevel.DELETE)) actions.push('delete');
          if (permissionLevels.includes(PermissionLevel.CREATE)) actions.push('create');

          permissions.push({
            actionEntityId: childEntityId,
            actions: actions,
          });
        }
      }

      return {
        parentEntity,
        parentEntityId,
        actionEntity,
        permissions: permissions,
      };
    } catch (error) {
      fastify.log.error('Error getting permissions by parent-action entity:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Main page action permissions endpoint
  fastify.post('/api/v1/rbac/main-page-actions', {
    preHandler: [fastify.authenticate],
    schema: {
      body: Type.Object({
        entityType: Type.String(),
      }),
      response: {
        200: Type.Object({
          entityType: Type.String(),
          canCreate: Type.Boolean(),
          canShare: Type.Boolean(),
          canDelete: Type.Boolean(),
          canBulkShare: Type.Boolean(),
          canBulkDelete: Type.Boolean(),
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
      const permissions = await getMainPageActionPermissions(userId, entityType);

      return {
        entityType,
        ...permissions,
      };
    } catch (error) {
      fastify.log.error('Error getting main page action permissions:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Check project-business assignment permission
  fastify.post('/api/v1/rbac/can-assign-project-to-business', {
    preHandler: [fastify.authenticate],
    schema: {
      body: Type.Object({
        businessId: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          canAssign: Type.Boolean(),
          businessId: Type.String(),
        }),
        401: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { businessId } = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      const canAssign = await canAssignProjectToBusiness(userId, businessId);

      return {
        canAssign,
        businessId,
      };
    } catch (error) {
      fastify.log.error('Error checking project-business assignment permission:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Check child entity navigation permission
  fastify.post('/api/v1/rbac/can-navigate-to-child', {
    preHandler: [fastify.authenticate],
    schema: {
      body: Type.Object({
        childEntityType: Type.String(),
        childEntityId: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          canNavigate: Type.Boolean(),
          childEntityType: Type.String(),
          childEntityId: Type.String(),
        }),
        401: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { childEntityType, childEntityId } = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      const canNavigate = await canNavigateToChildEntity(userId, childEntityType, childEntityId);

      return {
        canNavigate,
        childEntityType,
        childEntityId,
      };
    } catch (error) {
      fastify.log.error('Error checking child entity navigation permission:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}