import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import {
  api_gate_Update,
  api_gate_Delete,
  api_gate_Create,
  data_gate_EntityIdsByEntityType,
  PermissionLevel
} from '../../lib/rbac.service.js';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

// Helper type for permission results
interface PermissionResult {
  actionEntityId: string;
  permissions: string[];
}

// Helper functions for RBAC API endpoints (frontend UI needs)
// Uses API gates to determine permissions by trying each operation
async function getEmployeeEntityPermissions(employeeId: string, entityType: string, entityId?: string): Promise<PermissionResult[]> {
  const targetEntityId = entityId || '11111111-1111-1111-1111-111111111111';

  // Test each permission level using API gates
  const permissions: string[] = [];

  // Test view
  try {
    const accessibleEntityIds = await data_gate_EntityIdsByEntityType(employeeId, entityType, PermissionLevel.VIEW);
    const hasTypeAccess = accessibleEntityIds.includes('11111111-1111-1111-1111-111111111111');
    const hasSpecificAccess = accessibleEntityIds.includes(targetEntityId);
    if (hasTypeAccess || hasSpecificAccess) {
      permissions.push('view');
    }
  } catch {}

  // Test edit
  try {
    await api_gate_Update(employeeId, entityType, targetEntityId);
    permissions.push('edit');
  } catch {}

  // Test delete
  try {
    await api_gate_Delete(employeeId, entityType, targetEntityId);
    permissions.push('delete');
  } catch {}

  // Test create (only for type-level)
  if (targetEntityId === '11111111-1111-1111-1111-111111111111') {
    try {
      await api_gate_Create(employeeId, entityType);
      permissions.push('create');
    } catch {}
  }

  return [{
    actionEntityId: targetEntityId,
    permissions
  }];
}

async function getMainPageActionPermissions(employeeId: string, entityType: string) {
  // Test type-level permissions using API gates
  let canCreate = false;
  let canDelete = false;

  try {
    await api_gate_Create(employeeId, entityType);
    canCreate = true;
  } catch {}

  try {
    await api_gate_Delete(employeeId, entityType, '11111111-1111-1111-1111-111111111111');
    canDelete = true;
  } catch {}

  return {
    canCreate,
    canShare: canDelete, // Share requires same level as delete
    canDelete,
    canBulkShare: canDelete,
    canBulkDelete: canDelete
  };
}

// Backward-compatible wrappers using API gates
async function canAssignProjectToBusiness(userId: string, businessId: string): Promise<boolean> {
  try {
    await api_gate_Update(userId, 'business', businessId);
    return true;
  } catch {
    return false;
  }
}

async function canNavigateToChildEntity(userId: string, childType: string, childId: string): Promise<boolean> {
  try {
    const accessibleEntityIds = await data_gate_EntityIdsByEntityType(userId, childType, PermissionLevel.VIEW);
    const hasTypeAccess = accessibleEntityIds.includes('11111111-1111-1111-1111-111111111111');
    const hasSpecificAccess = accessibleEntityIds.includes(childId);
    return hasTypeAccess || hasSpecificAccess;
  } catch {
    return false;
  }
}

export async function rbacRoutes(fastify: FastifyInstance) {
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
      const permissionResults = await getEmployeeEntityPermissions(userId, entityType, entityId);

      return {
        entityType,
        entityId,
        permissions: permissionResults,
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
      const parentAccessibleIds = await data_gate_EntityIdsByEntityType(userId, parentEntity, PermissionLevel.VIEW);
      const hasParentTypeAccess = parentAccessibleIds.includes('11111111-1111-1111-1111-111111111111');
      const hasParentSpecificAccess = parentAccessibleIds.includes(parentEntityId);

      if (!hasParentTypeAccess && !hasParentSpecificAccess) {
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

      // Check type-level permission for this action entity type
      const typePermissionResults = await getEmployeeEntityPermissions(userId, actionEntity, '11111111-1111-1111-1111-111111111111');
      if (typePermissionResults.length > 0 && typePermissionResults[0].permissions.length > 0) {
        permissions.push({
          actionEntityId: '', // Empty string represents global permissions
          actions: typePermissionResults[0].permissions,
        });
      }

      // Check permissions for each specific child entity
      for (const childEntityId of childEntityIds) {
        const permissionResults = await getEmployeeEntityPermissions(userId, actionEntity, childEntityId);
        if (permissionResults.length > 0 && permissionResults[0].permissions.length > 0) {
          permissions.push({
            actionEntityId: childEntityId,
            actions: permissionResults[0].permissions,
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

  // Grant permission to role or employee
  fastify.post('/api/v1/rbac/grant-permission', {
    preHandler: [fastify.authenticate],
    schema: {
      body: Type.Object({
        person_entity_name: Type.Union([Type.Literal('role'), Type.Literal('employee')]),
        person_entity_id: Type.String({ format: 'uuid' }),
        entity_name: Type.String(),
        entity_id: Type.String(), // 'all' or specific UUID
        permission: Type.Number({ minimum: 0, maximum: 5 }),
        expires_ts: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
      }),
      response: {
        201: Type.Object({
          id: Type.String(),
          person_entity_name: Type.String(),
          person_entity_id: Type.String(),
          entity_name: Type.String(),
          entity_id: Type.String(),
          permission: Type.Number(),
          granted_by_employee_id: Type.String(),
          granted_ts: Type.String(),
          expires_ts: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          message: Type.String(),
        }),
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { person_entity_name, person_entity_id, entity_name, entity_id, permission, expires_ts } = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Verify the person exists
      if (person_entity_name === 'role') {
        const roleExists = await db.execute(sql`
          SELECT id FROM app.d_role WHERE id = ${person_entity_id} AND active_flag = true
        `);
        if (roleExists.length === 0) {
          return reply.status(400).send({ error: 'Role not found or inactive' });
        }
      } else if (person_entity_name === 'employee') {
        const employeeExists = await db.execute(sql`
          SELECT id FROM app.d_employee WHERE id = ${person_entity_id} AND active_flag = true
        `);
        if (employeeExists.length === 0) {
          return reply.status(400).send({ error: 'Employee not found or inactive' });
        }
      }

      // Verify entity_id if not 'all'
      if (entity_id !== 'all') {
        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(entity_id)) {
          return reply.status(400).send({ error: 'Invalid entity_id format. Must be UUID or "all"' });
        }
      }

      // Check if permission already exists
      const existingPermission = await db.execute(sql`
        SELECT id, permission
        FROM app.entity_id_rbac_map
        WHERE person_entity_name = ${person_entity_name}
          AND person_entity_id = ${person_entity_id}
          AND entity_name = ${entity_name}
          AND entity_id = ${entity_id}
          AND active_flag = true
      `);

      let result;
      if (existingPermission.length > 0) {
        // Update existing permission
        result = await db.execute(sql`
          UPDATE app.entity_id_rbac_map
          SET permission = ${permission},
              granted_by_employee_id = ${userId},
              granted_ts = NOW(),
              expires_ts = ${expires_ts || null},
              updated_ts = NOW()
          WHERE id = ${existingPermission[0].id}
          RETURNING id, person_entity_name, person_entity_id, entity_name, entity_id, permission, granted_by_employee_id, granted_ts, expires_ts
        `);
      } else {
        // Insert new permission
        result = await db.execute(sql`
          INSERT INTO app.entity_id_rbac_map (
            person_entity_name,
            person_entity_id,
            entity_name,
            entity_id,
            permission,
            granted_by_employee_id,
            granted_ts,
            expires_ts,
            active_flag
          ) VALUES (
            ${person_entity_name},
            ${person_entity_id},
            ${entity_name},
            ${entity_id},
            ${permission},
            ${userId},
            NOW(),
            ${expires_ts || null},
            true
          )
          RETURNING id, person_entity_name, person_entity_id, entity_name, entity_id, permission, granted_by_employee_id, granted_ts, expires_ts
        `);
      }

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to grant permission' });
      }

      const granted = result[0];
      return reply.status(201).send({
        id: granted.id,
        person_entity_name: granted.person_entity_name,
        person_entity_id: granted.person_entity_id,
        entity_name: granted.entity_name,
        entity_id: granted.entity_id,
        permission: granted.permission,
        granted_by_employee_id: granted.granted_by_employee_id,
        granted_ts: granted.granted_ts,
        expires_ts: granted.expires_ts,
        message: existingPermission.length > 0 ? 'Permission updated successfully' : 'Permission granted successfully',
      });
    } catch (error) {
      fastify.log.error('Error granting permission:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get permissions for a specific role or employee
  fastify.get('/api/v1/rbac/permissions/:personType/:personId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        personType: Type.Union([Type.Literal('role'), Type.Literal('employee')]),
        personId: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          person_type: Type.String(),
          person_id: Type.String(),
          permissions: Type.Array(Type.Object({
            id: Type.String(),
            entity_name: Type.String(),
            entity_id: Type.String(),
            permission: Type.Number(),
            granted_by_employee_id: Type.Optional(Type.String()),
            granted_ts: Type.String(),
            expires_ts: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          })),
        }),
        401: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { personType, personId } = request.params as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      const permissions = await db.execute(sql`
        SELECT
          id,
          entity_name,
          entity_id,
          permission,
          granted_by_employee_id,
          granted_ts,
          expires_ts
        FROM app.entity_id_rbac_map
        WHERE person_entity_name = ${personType}
          AND person_entity_id = ${personId}
          AND active_flag = true
        ORDER BY entity_name ASC, entity_id ASC
      `);

      return {
        person_type: personType,
        person_id: personId,
        permissions: permissions,
      };
    } catch (error) {
      fastify.log.error('Error fetching permissions:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Revoke permission
  fastify.delete('/api/v1/rbac/revoke-permission/:permissionId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        permissionId: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          message: Type.String(),
        }),
        401: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { permissionId } = request.params as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Check if permission exists
      const permissionExists = await db.execute(sql`
        SELECT id FROM app.entity_id_rbac_map WHERE id = ${permissionId} AND active_flag = true
      `);

      if (permissionExists.length === 0) {
        return reply.status(404).send({ error: 'Permission not found or already revoked' });
      }

      // Soft delete the permission
      await db.execute(sql`
        UPDATE app.entity_id_rbac_map
        SET active_flag = false, updated_ts = NOW()
        WHERE id = ${permissionId}
      `);

      return { message: 'Permission revoked successfully' };
    } catch (error) {
      fastify.log.error('Error revoking permission:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ===============================
  // UNIVERSAL ENTITY CRUD ENDPOINTS
  // ===============================

  // GET /api/v1/rbac - List all RBAC records (for main entity page)
  fastify.get('/api/v1/rbac', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        limit: Type.Optional(Type.Number({ default: 100 })),
        offset: Type.Optional(Type.Number({ default: 0 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(Type.Object({
            id: Type.String(),
            person_entity_name: Type.String(),
            person_entity_id: Type.String(),
            entity_name: Type.String(),
            entity_id: Type.String(),
            permission: Type.Number(),
            granted_by_employee_id: Type.Optional(Type.Union([Type.String(), Type.Null()])),
            granted_ts: Type.String(),
            expires_ts: Type.Optional(Type.Union([Type.String(), Type.Null()])),
            active_flag: Type.Boolean(),
            created_ts: Type.String(),
            updated_ts: Type.String(),
          })),
          total: Type.Number(),
        }),
        401: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    const { limit = 100, offset = 0 } = request.query as any;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Get all RBAC records
      const records = await db.execute(sql`
        SELECT
          id,
          person_entity_name,
          person_entity_id,
          entity_name,
          entity_id,
          permission,
          granted_by_employee_id,
          granted_ts,
          expires_ts,
          active_flag,
          created_ts,
          updated_ts
        FROM app.entity_id_rbac_map
        WHERE active_flag = true
        ORDER BY created_ts DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `);

      // Get total count
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM app.entity_id_rbac_map
        WHERE active_flag = true
      `);

      return {
        data: records,
        total: Number(countResult[0].count),
      };
    } catch (error) {
      fastify.log.error('Error fetching RBAC records:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/v1/rbac/:id - Get single RBAC record
  fastify.get('/api/v1/rbac/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          id: Type.String(),
          person_entity_name: Type.String(),
          person_entity_id: Type.String(),
          entity_name: Type.String(),
          entity_id: Type.String(),
          permission: Type.Number(),
          granted_by_employee_id: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          granted_ts: Type.String(),
          expires_ts: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          active_flag: Type.Boolean(),
          created_ts: Type.String(),
          updated_ts: Type.String(),
        }),
        401: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      const records = await db.execute(sql`
        SELECT
          id,
          person_entity_name,
          person_entity_id,
          entity_name,
          entity_id,
          permission,
          granted_by_employee_id,
          granted_ts,
          expires_ts,
          active_flag,
          created_ts,
          updated_ts
        FROM app.entity_id_rbac_map
        WHERE id = ${id} AND active_flag = true
      `);

      if (records.length === 0) {
        return reply.status(404).send({ error: 'RBAC record not found' });
      }

      return records[0];
    } catch (error) {
      fastify.log.error('Error fetching RBAC record:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/v1/rbac - Create RBAC record (reuses grant-permission logic)
  fastify.post('/api/v1/rbac', {
    preHandler: [fastify.authenticate],
    schema: {
      body: Type.Object({
        person_entity_name: Type.Union([Type.Literal('role'), Type.Literal('employee')]),
        person_entity_id: Type.String({ format: 'uuid' }),
        entity_name: Type.String(),
        entity_id: Type.String(), // 'all' or specific UUID
        permission: Type.Number({ minimum: 0, maximum: 5 }),
        expires_ts: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
      }),
      response: {
        201: Type.Object({
          id: Type.String(),
          person_entity_name: Type.String(),
          person_entity_id: Type.String(),
          entity_name: Type.String(),
          entity_id: Type.String(),
          permission: Type.Number(),
          granted_by_employee_id: Type.String(),
          granted_ts: Type.String(),
          expires_ts: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          message: Type.String(),
        }),
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { person_entity_name, person_entity_id, entity_name, entity_id, permission, expires_ts } = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Verify the person exists
      if (person_entity_name === 'role') {
        const roleExists = await db.execute(sql`
          SELECT id FROM app.d_role WHERE id = ${person_entity_id} AND active_flag = true
        `);
        if (roleExists.length === 0) {
          return reply.status(400).send({ error: 'Role not found or inactive' });
        }
      } else if (person_entity_name === 'employee') {
        const employeeExists = await db.execute(sql`
          SELECT id FROM app.d_employee WHERE id = ${person_entity_id} AND active_flag = true
        `);
        if (employeeExists.length === 0) {
          return reply.status(400).send({ error: 'Employee not found or inactive' });
        }
      }

      // Verify entity_id if not 'all'
      if (entity_id !== 'all') {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(entity_id)) {
          return reply.status(400).send({ error: 'Invalid entity_id format. Must be UUID or "all"' });
        }
      }

      // Check if permission already exists
      const existingPermission = await db.execute(sql`
        SELECT id, permission
        FROM app.entity_id_rbac_map
        WHERE person_entity_name = ${person_entity_name}
          AND person_entity_id = ${person_entity_id}
          AND entity_name = ${entity_name}
          AND entity_id = ${entity_id}
          AND active_flag = true
      `);

      let result;
      if (existingPermission.length > 0) {
        // Update existing permission
        result = await db.execute(sql`
          UPDATE app.entity_id_rbac_map
          SET permission = ${permission},
              granted_by_employee_id = ${userId},
              granted_ts = NOW(),
              expires_ts = ${expires_ts || null},
              updated_ts = NOW()
          WHERE id = ${existingPermission[0].id}
          RETURNING id, person_entity_name, person_entity_id, entity_name, entity_id, permission, granted_by_employee_id, granted_ts, expires_ts
        `);
      } else {
        // Insert new permission
        result = await db.execute(sql`
          INSERT INTO app.entity_id_rbac_map (
            person_entity_name,
            person_entity_id,
            entity_name,
            entity_id,
            permission,
            granted_by_employee_id,
            granted_ts,
            expires_ts,
            active_flag
          ) VALUES (
            ${person_entity_name},
            ${person_entity_id},
            ${entity_name},
            ${entity_id},
            ${permission},
            ${userId},
            NOW(),
            ${expires_ts || null},
            true
          )
          RETURNING id, person_entity_name, person_entity_id, entity_name, entity_id, permission, granted_by_employee_id, granted_ts, expires_ts
        `);
      }

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to create RBAC record' });
      }

      const created = result[0];
      return reply.status(201).send({
        id: created.id,
        person_entity_name: created.person_entity_name,
        person_entity_id: created.person_entity_id,
        entity_name: created.entity_name,
        entity_id: created.entity_id,
        permission: created.permission,
        granted_by_employee_id: created.granted_by_employee_id,
        granted_ts: created.granted_ts,
        expires_ts: created.expires_ts,
        message: existingPermission.length > 0 ? 'Permission updated successfully' : 'Permission created successfully',
      });
    } catch (error) {
      fastify.log.error('Error creating RBAC record:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // PATCH /api/v1/rbac/:id - Update RBAC record
  fastify.patch('/api/v1/rbac/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      body: Type.Object({
        permission: Type.Optional(Type.Number({ minimum: 0, maximum: 5 })),
        expires_ts: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
      }),
      response: {
        200: Type.Object({
          id: Type.String(),
          person_entity_name: Type.String(),
          person_entity_id: Type.String(),
          entity_name: Type.String(),
          entity_id: Type.String(),
          permission: Type.Number(),
          granted_by_employee_id: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          granted_ts: Type.String(),
          expires_ts: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          message: Type.String(),
        }),
        401: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as any;
    const { permission, expires_ts } = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Check if record exists
      const existing = await db.execute(sql`
        SELECT id FROM app.entity_id_rbac_map WHERE id = ${id} AND active_flag = true
      `);

      if (existing.length === 0) {
        return reply.status(404).send({ error: 'RBAC record not found' });
      }

      // Build update query dynamically
      const updates: string[] = [];
      const values: any[] = [];

      if (permission !== undefined) {
        updates.push(`permission = $${updates.length + 1}`);
        values.push(permission);
        updates.push(`granted_by_employee_id = $${updates.length + 1}`);
        values.push(userId);
        updates.push(`granted_ts = NOW()`);
      }

      if (expires_ts !== undefined) {
        updates.push(`expires_ts = $${updates.length + 1}`);
        values.push(expires_ts);
      }

      updates.push(`updated_ts = NOW()`);

      if (updates.length === 1) { // Only updated_ts
        return reply.status(400).send({ error: 'No fields to update' });
      }

      // Execute update
      const result = await db.execute(sql`
        UPDATE app.entity_id_rbac_map
        SET permission = ${permission !== undefined ? permission : sql`permission`},
            granted_by_employee_id = ${permission !== undefined ? userId : sql`granted_by_employee_id`},
            granted_ts = ${permission !== undefined ? sql`NOW()` : sql`granted_ts`},
            expires_ts = ${expires_ts !== undefined ? expires_ts : sql`expires_ts`},
            updated_ts = NOW()
        WHERE id = ${id}
        RETURNING id, person_entity_name, person_entity_id, entity_name, entity_id, permission, granted_by_employee_id, granted_ts, expires_ts
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to update RBAC record' });
      }

      const updated = result[0];
      return {
        id: updated.id,
        person_entity_name: updated.person_entity_name,
        person_entity_id: updated.person_entity_id,
        entity_name: updated.entity_name,
        entity_id: updated.entity_id,
        permission: updated.permission,
        granted_by_employee_id: updated.granted_by_employee_id,
        granted_ts: updated.granted_ts,
        expires_ts: updated.expires_ts,
        message: 'RBAC record updated successfully',
      };
    } catch (error) {
      fastify.log.error('Error updating RBAC record:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // DELETE /api/v1/rbac/:id - Delete RBAC record (reuses revoke-permission logic)
  fastify.delete('/api/v1/rbac/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          message: Type.String(),
        }),
        401: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Check if permission exists
      const permissionExists = await db.execute(sql`
        SELECT id FROM app.entity_id_rbac_map WHERE id = ${id} AND active_flag = true
      `);

      if (permissionExists.length === 0) {
        return reply.status(404).send({ error: 'RBAC record not found or already deleted' });
      }

      // Soft delete the permission
      await db.execute(sql`
        UPDATE app.entity_id_rbac_map
        SET active_flag = false, updated_ts = NOW()
        WHERE id = ${id}
      `);

      return { message: 'RBAC record deleted successfully' };
    } catch (error) {
      fastify.log.error('Error deleting RBAC record:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/v1/role/:id/rbac - Get RBAC records for a specific role (child entity endpoint)
  fastify.get('/api/v1/role/:id/rbac', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      querystring: Type.Object({
        limit: Type.Optional(Type.Number({ default: 100 })),
        offset: Type.Optional(Type.Number({ default: 0 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(Type.Object({
            id: Type.String(),
            person_entity_name: Type.String(),
            person_entity_id: Type.String(),
            entity_name: Type.String(),
            entity_id: Type.String(),
            permission: Type.Number(),
            granted_by_employee_id: Type.Optional(Type.Union([Type.String(), Type.Null()])),
            granted_ts: Type.String(),
            expires_ts: Type.Optional(Type.Union([Type.String(), Type.Null()])),
            active_flag: Type.Boolean(),
            created_ts: Type.String(),
            updated_ts: Type.String(),
          })),
          total: Type.Number(),
        }),
        401: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as any;
    const userId = (request as any).user?.sub;
    const { limit = 100, offset = 0 } = request.query as any;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Verify role exists
      const roleExists = await db.execute(sql`
        SELECT id FROM app.d_role WHERE id = ${id} AND active_flag = true
      `);

      if (roleExists.length === 0) {
        return reply.status(404).send({ error: 'Role not found' });
      }

      // Get RBAC records for this role
      const records = await db.execute(sql`
        SELECT
          id,
          person_entity_name,
          person_entity_id,
          entity_name,
          entity_id,
          permission,
          granted_by_employee_id,
          granted_ts,
          expires_ts,
          active_flag,
          created_ts,
          updated_ts
        FROM app.entity_id_rbac_map
        WHERE person_entity_name = 'role'
          AND person_entity_id = ${id}
          AND active_flag = true
        ORDER BY entity_name ASC, entity_id ASC
        LIMIT ${limit}
        OFFSET ${offset}
      `);

      // Get total count
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM app.entity_id_rbac_map
        WHERE person_entity_name = 'role'
          AND person_entity_id = ${id}
          AND active_flag = true
      `);

      return {
        data: records,
        total: Number(countResult[0].count),
      };
    } catch (error) {
      fastify.log.error('Error fetching RBAC records for role:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/v1/employee/:id/rbac - Get RBAC records for a specific employee (child entity endpoint)
  fastify.get('/api/v1/employee/:id/rbac', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      querystring: Type.Object({
        limit: Type.Optional(Type.Number({ default: 100 })),
        offset: Type.Optional(Type.Number({ default: 0 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(Type.Object({
            id: Type.String(),
            person_entity_name: Type.String(),
            person_entity_id: Type.String(),
            entity_name: Type.String(),
            entity_id: Type.String(),
            permission: Type.Number(),
            granted_by_employee_id: Type.Optional(Type.Union([Type.String(), Type.Null()])),
            granted_ts: Type.String(),
            expires_ts: Type.Optional(Type.Union([Type.String(), Type.Null()])),
            active_flag: Type.Boolean(),
            created_ts: Type.String(),
            updated_ts: Type.String(),
          })),
          total: Type.Number(),
        }),
        401: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as any;
    const userId = (request as any).user?.sub;
    const { limit = 100, offset = 0 } = request.query as any;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Verify employee exists
      const employeeExists = await db.execute(sql`
        SELECT id FROM app.d_employee WHERE id = ${id} AND active_flag = true
      `);

      if (employeeExists.length === 0) {
        return reply.status(404).send({ error: 'Employee not found' });
      }

      // Get RBAC records for this employee
      const records = await db.execute(sql`
        SELECT
          id,
          person_entity_name,
          person_entity_id,
          entity_name,
          entity_id,
          permission,
          granted_by_employee_id,
          granted_ts,
          expires_ts,
          active_flag,
          created_ts,
          updated_ts
        FROM app.entity_id_rbac_map
        WHERE person_entity_name = 'employee'
          AND person_entity_id = ${id}
          AND active_flag = true
        ORDER BY entity_name ASC, entity_id ASC
        LIMIT ${limit}
        OFFSET ${offset}
      `);

      // Get total count
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM app.entity_id_rbac_map
        WHERE person_entity_name = 'employee'
          AND person_entity_id = ${id}
          AND active_flag = true
      `);

      return {
        data: records,
        total: Number(countResult[0].count),
      };
    } catch (error) {
      fastify.log.error('Error fetching RBAC records for employee:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}