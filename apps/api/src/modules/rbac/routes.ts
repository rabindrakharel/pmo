import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
// ✅ Entity Infrastructure Service - Centralized infrastructure management
import { getEntityInfrastructure } from '../../services/entity-infrastructure.service.js';

// Helper type for permission results
interface PermissionResult {
  actionEntityId: string;
  permissions: string[];
}

// Helper functions for RBAC API endpoints (frontend UI needs)
// Uses unified_data_gate to determine permissions
async function getEmployeeEntityPermissions(employeeId: string, entityType: string, entityId?: string): Promise<PermissionResult[]> {
  const targetEntityId = entityId || ALL_ENTITIES_ID;

  // Test each permission level using unified_data_gate
  const permissions: string[] = [];

  // Test view
  const canView = await entityInfra.check_entity_rbac(
    employeeId, entityType, targetEntityId, Permission.VIEW
  );
  if (canView) permissions.push('view');

  // Test edit
  const canEdit = await entityInfra.check_entity_rbac(
    employeeId, entityType, targetEntityId, Permission.EDIT
  );
  if (canEdit) permissions.push('edit');

  // Test delete
  const canDelete = await entityInfra.check_entity_rbac(
    employeeId, entityType, targetEntityId, Permission.DELETE
  );
  if (canDelete) permissions.push('delete');

  // Test create (only for type-level)
  if (targetEntityId === ALL_ENTITIES_ID) {
    const canCreate = await entityInfra.check_entity_rbac(
      employeeId, entityType, ALL_ENTITIES_ID, Permission.CREATE
    );
    if (canCreate) permissions.push('create');
  }

  return [{
    actionEntityId: targetEntityId,
    permissions
  }];
}

async function getMainPageActionPermissions(employeeId: string, entityType: string) {
  // Test type-level permissions using unified_data_gate
  const canCreate = await entityInfra.check_entity_rbac(
    employeeId, entityType, ALL_ENTITIES_ID, Permission.CREATE
  );

  const canDelete = await entityInfra.check_entity_rbac(
    employeeId, entityType, ALL_ENTITIES_ID, Permission.DELETE
  );

  return {
    canCreate,
    canShare: canDelete, // Share requires same level as delete
    canDelete,
    canBulkShare: canDelete,
    canBulkDelete: canDelete
  };
}

// Backward-compatible wrappers using unified_data_gate
async function canAssignProjectToBusiness(userId: string, businessId: string): Promise<boolean> {
  return await entityInfra.check_entity_rbac(
    userId, 'business', businessId, Permission.EDIT
  );
}

async function canNavigateToChildEntity(userId: string, childType: string, childId: string): Promise<boolean> {
  return await entityInfra.check_entity_rbac(
    userId, childType, childId, Permission.VIEW
  );
}

export async function rbacRoutes(fastify: FastifyInstance) {
  // ═══════════════════════════════════════════════════════════════
  // ✅ ENTITY INFRASTRUCTURE SERVICE - Initialize service instance
  // ═══════════════════════════════════════════════════════════════
  const entityInfra = getEntityInfrastructure(db);

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
      const hasParentAccess = await entityInfra.check_entity_rbac(
        userId, parentEntity, parentEntityId, Permission.VIEW
      );

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
            FROM app.task
            WHERE project_id = ${parentEntityId}
          `);
          childEntityIds = directResult.map(row => row.id as string);
        } else if (parentEntity === 'project' && actionEntity === 'wiki') {
          const directResult = await db.execute(sql`
            SELECT DISTINCT id
            FROM app.wiki
            WHERE project_id = ${parentEntityId}
          `);
          childEntityIds = directResult.map(row => row.id as string);
        } else if (parentEntity === 'project' && actionEntity === 'artifact') {
          const directResult = await db.execute(sql`
            SELECT DISTINCT id
            FROM app.artifact
            WHERE project_id = ${parentEntityId}
          `);
          childEntityIds = directResult.map(row => row.id as string);
        }
        // Add more parent-action entity relationships as needed
      }

      // Get permissions for each child entity
      const permissions = [];

      // Check type-level permission for this action entity type
      const typePermissionResults = await getEmployeeEntityPermissions(userId, actionEntity, ALL_ENTITIES_ID);
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
        person_id: Type.String({ format: 'uuid' }),
        entity_name: Type.String(),
        entity_id: Type.String(), // 'all' or specific UUID
        permission: Type.Number({ minimum: 0, maximum: 5 }),
        expires_ts: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
      }),
      response: {
        201: Type.Object({
          id: Type.String(),
          person_entity_name: Type.String(),
          person_id: Type.String(),
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
    const { person_entity_name, person_id, entity_name, entity_id, permission, expires_ts } = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Verify the person exists
      if (person_entity_name === 'role') {
        const roleExists = await db.execute(sql`
          SELECT id FROM app.role WHERE id = ${person_id} AND active_flag = true
        `);
        if (roleExists.length === 0) {
          return reply.status(400).send({ error: 'Role not found or inactive' });
        }
      } else if (person_entity_name === 'employee') {
        const employeeExists = await db.execute(sql`
          SELECT id FROM app.employee WHERE id = ${person_id} AND active_flag = true
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
        FROM app.entity_rbac
        WHERE person_entity_name = ${person_entity_name}
          AND person_id = ${person_id}
          AND entity_name = ${entity_name}
          AND entity_id = ${entity_id}
          AND active_flag = true
      `);

      let result;
      if (existingPermission.length > 0) {
        // Update existing permission
        result = await db.execute(sql`
          UPDATE app.entity_rbac
          SET permission = ${permission},
              granted_by_employee_id = ${userId},
              granted_ts = NOW(),
              expires_ts = ${expires_ts || null},
              updated_ts = NOW()
          WHERE id = ${existingPermission[0].id}
          RETURNING id, person_entity_name, person_id, entity_name, entity_id, permission, granted_by_employee_id, granted_ts, expires_ts
        `);
      } else {
        // Insert new permission
        result = await db.execute(sql`
          INSERT INTO app.entity_rbac (
            person_entity_name,
            person_id,
            entity_name,
            entity_id,
            permission,
            granted_by_employee_id,
            granted_ts,
            expires_ts,
            active_flag
          ) VALUES (
            ${person_entity_name},
            ${person_id},
            ${entity_name},
            ${entity_id},
            ${permission},
            ${userId},
            NOW(),
            ${expires_ts || null},
            true
          )
          RETURNING id, person_entity_name, person_id, entity_name, entity_id, permission, granted_by_employee_id, granted_ts, expires_ts
        `);
      }

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to grant permission' });
      }

      const granted = result[0];
      return reply.status(201).send({
        id: granted.id,
        person_entity_name: granted.person_entity_name,
        person_id: granted.person_id,
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
        FROM app.entity_rbac
        WHERE person_entity_name = ${personType}
          AND person_id = ${personId}
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
        SELECT id FROM app.entity_rbac WHERE id = ${permissionId} AND active_flag = true
      `);

      if (permissionExists.length === 0) {
        return reply.status(404).send({ error: 'Permission not found or already revoked' });
      }

      // Soft delete the permission
      await db.execute(sql`
        UPDATE app.entity_rbac
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
            person_id: Type.String(),
            person_name: Type.String(),
            entity_type: Type.String(),
            entity_id: Type.String(),
            entity_name: Type.String(),
            permission: Type.Number(),
            permission_label: Type.String(),
            granted_by_employee_id: Type.Optional(Type.Union([Type.String(), Type.Null()])),
            granted_by_name: Type.String(),
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
      // Get all RBAC records with joined person names and entity names (using centralized entity_instance_id table)
      const records = await db.execute(sql`
        SELECT
          rbac.id,
          rbac.person_entity_name,
          rbac.person_id,
          CASE
            WHEN rbac.person_entity_name = 'employee' THEN COALESCE(emp.name, emp.email, 'Unknown Employee')
            WHEN rbac.person_entity_name = 'role' THEN COALESCE(role.name, 'Unknown Role')
            ELSE 'Unknown'
          END AS person_name,
          rbac.entity_name AS entity_type,
          rbac.entity_id,
          CASE
            WHEN rbac.entity_id = '11111111-1111-1111-1111-111111111111' THEN 'ALL (Type-level)'
            ELSE COALESCE(entity_inst.entity_name, entity_inst.entity_code, rbac.entity_id::text)
          END AS entity_name,
          rbac.permission,
          CASE rbac.permission
            WHEN 0 THEN 'View'
            WHEN 1 THEN 'Edit'
            WHEN 2 THEN 'Share'
            WHEN 3 THEN 'Delete'
            WHEN 4 THEN 'Create'
            WHEN 5 THEN 'Owner'
            ELSE 'Unknown'
          END AS permission_label,
          rbac.granted_by_employee_id,
          COALESCE(granter.name, granter.email, 'System') AS granted_by_name,
          rbac.granted_ts,
          rbac.expires_ts,
          rbac.active_flag,
          rbac.created_ts,
          rbac.updated_ts
        FROM app.entity_rbac rbac
        LEFT JOIN app.employee emp ON rbac.person_entity_name = 'employee' AND rbac.person_id = emp.id
        LEFT JOIN app.role role ON rbac.person_entity_name = 'role' AND rbac.person_id = role.id
        LEFT JOIN app.employee granter ON rbac.granted_by_employee_id = granter.id
        -- Centralized entity name resolution using entity_instance_id registry
        LEFT JOIN app.entity_instance entity_inst
          ON rbac.entity_name = entity_inst.entity_type
          AND rbac.entity_id = entity_inst.entity_id
        WHERE rbac.active_flag = true
        ORDER BY rbac.created_ts DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `);

      // Get total count
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM app.entity_rbac
        WHERE active_flag = true
      `);

      return {
        data: records,
        total: Number(countResult[0].count),
      };
    } catch (error: any) {
      fastify.log.error('Error fetching RBAC records:', error);
      console.error('[RBAC GET] Full error:', error);
      console.error('[RBAC GET] Error message:', error.message);
      console.error('[RBAC GET] Error stack:', error.stack);
      return reply.status(500).send({ error: `Internal server error: ${error.message}` });
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
          person_id: Type.String(),
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
          person_id,
          entity_name,
          entity_id,
          permission,
          granted_by_employee_id,
          granted_ts,
          expires_ts,
          active_flag,
          created_ts,
          updated_ts
        FROM app.entity_rbac
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
        person_id: Type.String({ format: 'uuid' }),
        entity_name: Type.String(),
        entity_id: Type.String(), // 'all' or specific UUID
        permission: Type.Number({ minimum: 0, maximum: 5 }),
        expires_ts: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
      }),
      response: {
        201: Type.Object({
          id: Type.String(),
          person_entity_name: Type.String(),
          person_id: Type.String(),
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
    const { person_entity_name, person_id, entity_name, entity_id, permission, expires_ts } = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Verify the person exists
      if (person_entity_name === 'role') {
        const roleExists = await db.execute(sql`
          SELECT id FROM app.role WHERE id = ${person_id} AND active_flag = true
        `);
        if (roleExists.length === 0) {
          return reply.status(400).send({ error: 'Role not found or inactive' });
        }
      } else if (person_entity_name === 'employee') {
        const employeeExists = await db.execute(sql`
          SELECT id FROM app.employee WHERE id = ${person_id} AND active_flag = true
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
        FROM app.entity_rbac
        WHERE person_entity_name = ${person_entity_name}
          AND person_id = ${person_id}
          AND entity_name = ${entity_name}
          AND entity_id = ${entity_id}
          AND active_flag = true
      `);

      let result;
      if (existingPermission.length > 0) {
        // Update existing permission
        result = await db.execute(sql`
          UPDATE app.entity_rbac
          SET permission = ${permission},
              granted_by_employee_id = ${userId},
              granted_ts = NOW(),
              expires_ts = ${expires_ts || null},
              updated_ts = NOW()
          WHERE id = ${existingPermission[0].id}
          RETURNING id, person_entity_name, person_id, entity_name, entity_id, permission, granted_by_employee_id, granted_ts, expires_ts
        `);
      } else {
        // Insert new permission
        result = await db.execute(sql`
          INSERT INTO app.entity_rbac (
            person_entity_name,
            person_id,
            entity_name,
            entity_id,
            permission,
            granted_by_employee_id,
            granted_ts,
            expires_ts,
            active_flag
          ) VALUES (
            ${person_entity_name},
            ${person_id},
            ${entity_name},
            ${entity_id},
            ${permission},
            ${userId},
            NOW(),
            ${expires_ts || null},
            true
          )
          RETURNING id, person_entity_name, person_id, entity_name, entity_id, permission, granted_by_employee_id, granted_ts, expires_ts
        `);
      }

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to create RBAC record' });
      }

      const created = result[0];
      return reply.status(201).send({
        id: created.id,
        person_entity_name: created.person_entity_name,
        person_id: created.person_id,
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
          person_id: Type.String(),
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
        SELECT id FROM app.entity_rbac WHERE id = ${id} AND active_flag = true
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
        UPDATE app.entity_rbac
        SET permission = ${permission !== undefined ? permission : sql`permission`},
            granted_by_employee_id = ${permission !== undefined ? userId : sql`granted_by_employee_id`},
            granted_ts = ${permission !== undefined ? sql`NOW()` : sql`granted_ts`},
            expires_ts = ${expires_ts !== undefined ? expires_ts : sql`expires_ts`},
            updated_ts = NOW()
        WHERE id = ${id}
        RETURNING id, person_entity_name, person_id, entity_name, entity_id, permission, granted_by_employee_id, granted_ts, expires_ts
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to update RBAC record' });
      }

      const updated = result[0];
      return {
        id: updated.id,
        person_entity_name: updated.person_entity_name,
        person_id: updated.person_id,
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
        SELECT id FROM app.entity_rbac WHERE id = ${id} AND active_flag = true
      `);

      if (permissionExists.length === 0) {
        return reply.status(404).send({ error: 'RBAC record not found or already deleted' });
      }

      // Soft delete the permission
      await db.execute(sql`
        UPDATE app.entity_rbac
        SET active_flag = false, updated_ts = NOW()
        WHERE id = ${id}
      `);

      return { message: 'RBAC record deleted successfully' };
    } catch (error) {
      fastify.log.error('Error deleting RBAC record:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/v1/rbac/overview - Comprehensive RBAC overview with person names and entity permissions
  fastify.get('/api/v1/rbac/overview', {
    preHandler: [fastify.authenticate],
    schema: {
      response: {
        200: Type.Object({
          summary: Type.Object({
            total_permissions: Type.Number(),
            role_based_permissions: Type.Number(),
            employee_permissions: Type.Number(),
            unique_persons: Type.Number(),
            unique_entities: Type.Number(),
          }),
          permissions_by_person: Type.Array(Type.Object({
            person_type: Type.String(),
            person_id: Type.String(),
            person_name: Type.String(),
            person_code: Type.Optional(Type.String()),
            permissions: Type.Array(Type.Object({
              entity_name: Type.String(),
              entity_id: Type.String(),
              entity_display: Type.String(),
              permission_level: Type.Number(),
              permission_label: Type.String(),
              granted_ts: Type.String(),
              expires_ts: Type.Optional(Type.Union([Type.String(), Type.Null()])),
            })),
          })),
          permissions_by_entity: Type.Array(Type.Object({
            entity_name: Type.String(),
            permissions: Type.Array(Type.Object({
              person_type: Type.String(),
              person_id: Type.String(),
              person_name: Type.String(),
              entity_id: Type.String(),
              permission_level: Type.Number(),
              permission_label: Type.String(),
            })),
          })),
        }),
        401: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Get all RBAC records with person and entity names
      const rbacRecords = await db.execute(sql`
        SELECT
          rbac.id,
          rbac.person_entity_name,
          rbac.person_id,
          rbac.entity_name,
          rbac.entity_id,
          rbac.permission,
          rbac.granted_ts,
          rbac.expires_ts,
          CASE
            WHEN rbac.person_entity_name = 'employee' THEN COALESCE(emp.name, emp.first_name || ' ' || emp.last_name, emp.email)
            WHEN rbac.person_entity_name = 'role' THEN role.name
            ELSE NULL
          END AS person_name,
          CASE
            WHEN rbac.person_entity_name = 'employee' THEN emp.code
            WHEN rbac.person_entity_name = 'role' THEN role.code
            ELSE NULL
          END AS person_code
        FROM app.entity_rbac rbac
        LEFT JOIN app.employee emp ON rbac.person_entity_name = 'employee' AND rbac.person_id = emp.id
        LEFT JOIN app.role role ON rbac.person_entity_name = 'role' AND rbac.person_id = role.id
        WHERE rbac.active_flag = true
        ORDER BY
          rbac.person_entity_name,
          CASE
            WHEN rbac.person_entity_name = 'employee' THEN COALESCE(emp.name, emp.first_name || ' ' || emp.last_name, emp.email)
            WHEN rbac.person_entity_name = 'role' THEN role.name
            ELSE NULL
          END,
          rbac.entity_name,
          rbac.permission DESC
      `);

      // Helper function to get permission label
      const getPermissionLabel = (level: number): string => {
        switch (level) {
          case 0: return 'View';
          case 1: return 'Edit';
          case 2: return 'Share';
          case 3: return 'Delete';
          case 4: return 'Create';
          case 5: return 'Owner';
          default: return 'Unknown';
        }
      };

      // Group by person
      const personMap = new Map<string, any>();
      const entityMap = new Map<string, any>();
      const uniquePersons = new Set<string>();
      const uniqueEntities = new Set<string>();
      let roleBasedCount = 0;
      let employeeCount = 0;

      for (const record of rbacRecords) {
        const personKey = `${record.person_entity_name}:${record.person_id}`;
        uniquePersons.add(personKey);
        uniqueEntities.add(record.entity_name);

        if (record.person_entity_name === 'role') {
          roleBasedCount++;
        } else {
          employeeCount++;
        }

        // Group by person
        if (!personMap.has(personKey)) {
          personMap.set(personKey, {
            person_type: record.person_entity_name,
            person_id: record.person_id,
            person_name: record.person_name || 'Unknown',
            person_code: record.person_code,
            permissions: [],
          });
        }

        const entity_display = record.entity_id === '11111111-1111-1111-1111-111111111111'
          ? 'ALL (Type-level)'
          : record.entity_id;

        personMap.get(personKey).permissions.push({
          entity_name: record.entity_name,
          entity_id: record.entity_id,
          entity_display: entity_display,
          permission_level: record.permission,
          permission_label: getPermissionLabel(record.permission),
          granted_ts: record.granted_ts,
          expires_ts: record.expires_ts,
        });

        // Group by entity
        if (!entityMap.has(record.entity_name)) {
          entityMap.set(record.entity_name, {
            entity_name: record.entity_name,
            permissions: [],
          });
        }

        entityMap.get(record.entity_name).permissions.push({
          person_type: record.person_entity_name,
          person_id: record.person_id,
          person_name: record.person_name || 'Unknown',
          entity_id: record.entity_id,
          permission_level: record.permission,
          permission_label: getPermissionLabel(record.permission),
        });
      }

      return {
        summary: {
          total_permissions: rbacRecords.length,
          role_based_permissions: roleBasedCount,
          employee_permissions: employeeCount,
          unique_persons: uniquePersons.size,
          unique_entities: uniqueEntities.size,
        },
        permissions_by_person: Array.from(personMap.values()),
        permissions_by_entity: Array.from(entityMap.values()),
      };
    } catch (error: any) {
      fastify.log.error(`Error fetching RBAC overview: ${error.message}`, error);
      console.error('[RBAC Overview] Full error:', error);
      return reply.status(500).send({ error: `Internal server error: ${error.message}` });
    }
  });

  // Custom schema endpoint for RBAC with computed columns
  fastify.get('/api/v1/entity/rbac/schema', {
    preHandler: [fastify.authenticate],
    schema: {
      response: {
        200: Type.Object({
          entityType: Type.String(),
          tableName: Type.String(),
          columns: Type.Array(Type.Object({
            key: Type.String(),
            title: Type.String(),
            dataType: Type.String(),
            visible: Type.Boolean(),
            width: Type.Optional(Type.String()),
            align: Type.Optional(Type.Union([
              Type.Literal('left'),
              Type.Literal('center'),
              Type.Literal('right')
            ])),
            format: Type.Object({
              type: Type.String(),
              settingsDatalabel: Type.Optional(Type.String()),
              entityType: Type.Optional(Type.String()),
              dateFormat: Type.Optional(Type.String())
            }),
            editable: Type.Boolean(),
            editType: Type.String(),
            sortable: Type.Boolean(),
            filterable: Type.Boolean(),
            dataSource: Type.Optional(Type.Object({
              type: Type.Literal('settings'),
              datalabel: Type.String()
            }))
          }))
        }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    try {
      // Import schema builder service
      const { buildEntitySchema } = await import('../../lib/schema-builder.service.js');

      // Get base schema from database introspection
      const baseSchema = await buildEntitySchema(db, 'rbac');

      // Rename entity_name column to entity_type and ensure all base columns are present
      const enhancedColumns = baseSchema.columns.map(col => {
        if (col.key === 'entity_name') {
          return {
            ...col,
            key: 'entity_type',
            title: 'Entity Type'
          };
        }
        // Ensure system columns are visible in schema but can be hidden via visible flag
        if (col.key === 'id') {
          return { ...col, visible: true, width: '100px', editable: false };
        }
        if (col.key === 'active_flag') {
          return { ...col, visible: true, width: '100px', align: 'center' as const };
        }
        if (col.key === 'created_ts' || col.key === 'updated_ts') {
          return { ...col, visible: true, format: { type: 'relative-time' as const } };
        }
        return col;
      });

      // Add computed columns that come from JOINs and ensure system columns exist
      const computedColumns = [
        {
          key: 'person_name',
          title: 'Person Name',
          dataType: 'character varying',
          visible: true,
          format: { type: 'text' },
          editable: false,
          editType: 'readonly' as const,
          sortable: true,
          filterable: true,
          width: '200px',
          align: 'left' as const
        },
        {
          key: 'entity_name',
          title: 'Entity Name',
          dataType: 'character varying',
          visible: true,
          format: { type: 'text' },
          editable: false,
          editType: 'readonly' as const,
          sortable: true,
          filterable: true,
          width: '200px',
          align: 'left' as const
        },
        {
          key: 'permission_label',
          title: 'Permission',
          dataType: 'character varying',
          visible: true,
          format: {
            type: 'badge',
            valueMap: {
              'View': { label: 'View', color: 'blue' },
              'Edit': { label: 'Edit', color: 'green' },
              'Share': { label: 'Share', color: 'yellow' },
              'Delete': { label: 'Delete', color: 'red' },
              'Create': { label: 'Create', color: 'purple' },
              'Owner': { label: 'Owner', color: 'pink' }
            }
          },
          editable: false,
          editType: 'readonly' as const,
          sortable: true,
          filterable: true,
          width: '120px',
          align: 'center' as const
        },
        {
          key: 'granted_by_name',
          title: 'Granted By',
          dataType: 'character varying',
          visible: true,
          format: { type: 'text' },
          editable: false,
          editType: 'readonly' as const,
          sortable: true,
          filterable: true,
          width: '150px',
          align: 'left' as const
        }
      ];

      // Create a map of existing columns FIRST
      const columnMap = new Map(enhancedColumns.map(col => [col.key, col]));

      // Ensure system columns exist (they may be filtered by schema builder)
      if (!columnMap.has('id')) {
        columnMap.set('id', {
          key: 'id',
          title: 'ID',
          dataType: 'uuid',
          visible: true,
          format: { type: 'text' },
          editable: false,
          editType: 'readonly' as const,
          sortable: true,
          filterable: true,
          width: '100px',
          align: 'left' as const
        });
      }
      if (!columnMap.has('active_flag')) {
        columnMap.set('active_flag', {
          key: 'active_flag',
          title: 'Active',
          dataType: 'boolean',
          visible: true,
          format: { type: 'boolean' },
          editable: true,
          editType: 'boolean' as const,
          sortable: true,
          filterable: true,
          width: '100px',
          align: 'center' as const
        });
      }
      if (!columnMap.has('created_ts')) {
        columnMap.set('created_ts', {
          key: 'created_ts',
          title: 'Created',
          dataType: 'timestamp with time zone',
          visible: true,
          format: { type: 'relative-time' },
          editable: false,
          editType: 'readonly' as const,
          sortable: true,
          filterable: true,
          width: '150px',
          align: 'left' as const
        });
      }
      if (!columnMap.has('updated_ts')) {
        columnMap.set('updated_ts', {
          key: 'updated_ts',
          title: 'Updated',
          dataType: 'timestamp with time zone',
          visible: true,
          format: { type: 'relative-time' },
          editable: false,
          editType: 'readonly' as const,
          sortable: true,
          filterable: true,
          width: '150px',
          align: 'left' as const
        });
      }

      // Reorder columns to match data endpoint order and insert computed columns
      const columnOrder = [
        'id',
        'person_entity_name',
        'person_name', // computed
        'person_id',
        'entity_type',
        'entity_name', // computed
        'entity_id',
        'permission',
        'permission_label', // computed
        'granted_by_employee_id',
        'granted_by_name', // computed
        'granted_ts',
        'expires_ts',
        'active_flag',
        'created_ts',
        'updated_ts'
      ];

      // Add computed columns to the map
      const computedColumnMap = new Map([
        ['person_name', computedColumns[0]],
        ['entity_name', computedColumns[1]],
        ['permission_label', computedColumns[2]],
        ['granted_by_name', computedColumns[3]]
      ]);

      // Build final column array in correct order
      const orderedColumns = columnOrder
        .map(key => {
          // Check if it's a computed column
          if (computedColumnMap.has(key)) {
            return computedColumnMap.get(key);
          }
          // Otherwise get from base columns
          return columnMap.get(key);
        })
        .filter(col => col !== undefined); // Remove any undefined columns

      // Hide numeric permission column
      const permissionCol = orderedColumns.find(col => col.key === 'permission');
      if (permissionCol) {
        permissionCol.visible = false;
      }

      return {
        entityType: 'rbac',
        tableName: baseSchema.tableName,
        columns: orderedColumns
      };
    } catch (error) {
      fastify.log.error('Error building RBAC schema:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

}