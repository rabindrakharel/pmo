import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
// ✅ Entity Infrastructure Service - Centralized infrastructure management
import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID } from '../../services/entity-infrastructure.service.js';

// Helper type for permission results
interface PermissionResult {
  actionEntityId: string;
  permissions: string[];
}

// Module-level variable for entityInfra (initialized in rbacRoutes)
let entityInfra: ReturnType<typeof getEntityInfrastructure>;

// Helper functions for RBAC API endpoints (frontend UI needs)
// Uses Entity Infrastructure Service to determine permissions
async function getEmployeeEntityPermissions(employeeId: string, entityCode: string, entityId?: string): Promise<PermissionResult[]> {
  const targetEntityId = entityId || ALL_ENTITIES_ID;

  // Test each permission level using Entity Infrastructure Service
  const permissions: string[] = [];

  // Test view
  const canView = await entityInfra.check_entity_rbac(
    employeeId, entityCode, targetEntityId, Permission.VIEW
  );
  if (canView) permissions.push('view');

  // Test edit
  const canEdit = await entityInfra.check_entity_rbac(
    employeeId, entityCode, targetEntityId, Permission.EDIT
  );
  if (canEdit) permissions.push('edit');

  // Test delete
  const canDelete = await entityInfra.check_entity_rbac(
    employeeId, entityCode, targetEntityId, Permission.DELETE
  );
  if (canDelete) permissions.push('delete');

  // Test create (only for type-level)
  if (targetEntityId === ALL_ENTITIES_ID) {
    const canCreate = await entityInfra.check_entity_rbac(
      employeeId, entityCode, ALL_ENTITIES_ID, Permission.CREATE
    );
    if (canCreate) permissions.push('create');
  }

  return [{
    actionEntityId: targetEntityId,
    permissions
  }];
}

async function getMainPageActionPermissions(employeeId: string, entityCode: string) {
  // Test type-level permissions using Entity Infrastructure Service
  const canCreate = await entityInfra.check_entity_rbac(
    employeeId, entityCode, ALL_ENTITIES_ID, Permission.CREATE
  );

  const canDelete = await entityInfra.check_entity_rbac(
    employeeId, entityCode, ALL_ENTITIES_ID, Permission.DELETE
  );

  return {
    canCreate,
    canShare: canDelete, // Share requires same level as delete
    canDelete,
    canBulkShare: canDelete,
    canBulkDelete: canDelete
  };
}

export async function rbacRoutes(fastify: FastifyInstance) {
  // ═══════════════════════════════════════════════════════════════
  // ✅ ENTITY INFRASTRUCTURE SERVICE - Initialize service instance
  // ═══════════════════════════════════════════════════════════════
  entityInfra = getEntityInfrastructure(db);

  // ===============================
  // ENTITY_RBAC API ROUTES
  // All routes use /api/v1/entity_rbac/ prefix to match table name
  // ===============================

  // TIER 1: Get comprehensive permissions by entity type (for main page data tables)
  // Case I: Main page data table rbac buttons: project list (/project) and project detail overview (/project/{id})
  fastify.post('/api/v1/entity_rbac/get-permissions-by-entityCode', {
    preHandler: [fastify.authenticate],
    schema: {
      body: Type.Object({
        entityCode: Type.String(),
      }),
      response: {
        200: Type.Object({
          entityCode: Type.String(),
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
    const { entityCode } = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      const permissions = await getEmployeeEntityPermissions(userId, entityCode);

      return {
        entityCode,
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
  fastify.post('/api/v1/entity_rbac/check-permission-of-entity', {
    preHandler: [fastify.authenticate],
    schema: {
      body: Type.Object({
        entityCode: Type.String(),
        entityId: Type.String(),
      }),
      response: {
        200: Type.Object({
          entityCode: Type.String(),
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
    const { entityCode, entityId } = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Get permission levels for the specific entity using new system
      const permissionResults = await getEmployeeEntityPermissions(userId, entityCode, entityId);

      return {
        entityCode,
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
  fastify.post('/api/v1/entity_rbac/get-permissions-by-parentEntity-actionEntity', {
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

      // First, try to find relationships via entity_instance_link table
      const hierarchyResult = await db.execute(sql`
        SELECT DISTINCT child_entity_instance_id
        FROM app.entity_instance_link
        WHERE entity_code = ${parentEntity}
          AND entity_instance_id = ${parentEntityId}
          AND child_entity_code = ${actionEntity}
      `);

      if (hierarchyResult.length > 0) {
        childEntityIds = hierarchyResult.map(row => row.child_entity_instance_id as string);
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
  fastify.post('/api/v1/entity_rbac/main-page-actions', {
    preHandler: [fastify.authenticate],
    schema: {
      body: Type.Object({
        entityCode: Type.String(),
      }),
      response: {
        200: Type.Object({
          entityCode: Type.String(),
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
    const { entityCode } = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      const permissions = await getMainPageActionPermissions(userId, entityCode);

      return {
        entityCode,
        ...permissions,
      };
    } catch (error) {
      fastify.log.error('Error getting main page action permissions:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Grant permission to role or employee (upsert - creates or updates)
  fastify.post('/api/v1/entity_rbac/grant-permission', {
    preHandler: [fastify.authenticate],
    schema: {
      body: Type.Object({
        person_code: Type.Union([Type.Literal('role'), Type.Literal('employee')]),
        person_id: Type.String({ format: 'uuid' }),
        entity_code: Type.String(),
        entity_instance_id: Type.String(), // ALL_ENTITIES_ID or specific UUID
        permission: Type.Number({ minimum: 0, maximum: 5 }),
        expires_ts: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
      }),
      response: {
        201: Type.Object({
          id: Type.String(),
          person_code: Type.String(),
          person_id: Type.String(),
          entity_code: Type.String(),
          entity_instance_id: Type.String(),
          permission: Type.Number(),
          granted_by__employee_id: Type.String(),
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
    const { person_code, person_id, entity_code, entity_instance_id, permission, expires_ts } = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Verify the person exists
      if (person_code === 'role') {
        const roleExists = await db.execute(sql`
          SELECT id FROM app.role WHERE id = ${person_id} AND active_flag = true
        `);
        if (roleExists.length === 0) {
          return reply.status(400).send({ error: 'Role not found or inactive' });
        }
      } else if (person_code === 'employee') {
        const employeeExists = await db.execute(sql`
          SELECT id FROM app.employee WHERE id = ${person_id} AND active_flag = true
        `);
        if (employeeExists.length === 0) {
          return reply.status(400).send({ error: 'Employee not found or inactive' });
        }
      }

      // Verify entity_instance_id if not ALL_ENTITIES_ID
      if (entity_instance_id !== ALL_ENTITIES_ID) {
        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(entity_instance_id)) {
          return reply.status(400).send({ error: 'Invalid entity_instance_id format. Must be UUID or ALL_ENTITIES_ID' });
        }
      }

      // Check if permission already exists
      const existingPermission = await db.execute(sql`
        SELECT id, permission
        FROM app.entity_rbac
        WHERE person_code = ${person_code}
          AND person_id = ${person_id}
          AND entity_code = ${entity_code}
          AND entity_instance_id = ${entity_instance_id}
      `);

      let result;
      if (existingPermission.length > 0) {
        // Update existing permission
        result = await db.execute(sql`
          UPDATE app.entity_rbac
          SET permission = ${permission},
              granted_by__employee_id = ${userId},
              granted_ts = NOW(),
              expires_ts = ${expires_ts || null},
              updated_ts = NOW()
          WHERE id = ${existingPermission[0].id}
          RETURNING id, person_code, person_id, entity_code, entity_instance_id, permission, granted_by__employee_id, granted_ts, expires_ts
        `);
      } else {
        // Insert new permission
        result = await db.execute(sql`
          INSERT INTO app.entity_rbac (
            person_code,
            person_id,
            entity_code,
            entity_instance_id,
            permission,
            granted_by__employee_id,
            granted_ts,
            expires_ts
          ) VALUES (
            ${person_code},
            ${person_id},
            ${entity_code},
            ${entity_instance_id},
            ${permission},
            ${userId},
            NOW(),
            ${expires_ts || null}
          )
          RETURNING id, person_code, person_id, entity_code, entity_instance_id, permission, granted_by__employee_id, granted_ts, expires_ts
        `);
      }

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to grant permission' });
      }

      const granted = result[0];
      return reply.status(201).send({
        id: granted.id,
        person_code: granted.person_code,
        person_id: granted.person_id,
        entity_code: granted.entity_code,
        entity_instance_id: granted.entity_instance_id,
        permission: granted.permission,
        granted_by__employee_id: granted.granted_by__employee_id,
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
  fastify.get('/api/v1/entity_rbac/permissions/:personType/:personId', {
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
            entity_code: Type.String(),
            entity_instance_id: Type.String(),
            permission: Type.Number(),
            granted_by__employee_id: Type.Optional(Type.String()),
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
          entity_code,
          entity_instance_id,
          permission,
          granted_by__employee_id,
          granted_ts,
          expires_ts
        FROM app.entity_rbac
        WHERE person_code = ${personType}
          AND person_id = ${personId}
        ORDER BY entity_code ASC, entity_instance_id ASC
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

  // Revoke permission (hard delete)
  fastify.delete('/api/v1/entity_rbac/revoke-permission/:permissionId', {
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
        SELECT id FROM app.entity_rbac WHERE id = ${permissionId}
      `);

      if (permissionExists.length === 0) {
        return reply.status(404).send({ error: 'Permission not found' });
      }

      // Hard delete the permission (entity_rbac uses hard delete)
      await db.execute(sql`
        DELETE FROM app.entity_rbac WHERE id = ${permissionId}
      `);

      return { message: 'Permission revoked successfully' };
    } catch (error) {
      fastify.log.error('Error revoking permission:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Comprehensive RBAC overview with person names and entity permissions
  fastify.get('/api/v1/entity_rbac/overview', {
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
              entity_code: Type.String(),
              entity_instance_id: Type.String(),
              entity_display: Type.String(),
              permission_level: Type.Number(),
              permission_label: Type.String(),
              granted_ts: Type.String(),
              expires_ts: Type.Optional(Type.Union([Type.String(), Type.Null()])),
            })),
          })),
          permissions_by_entity: Type.Array(Type.Object({
            entity_code: Type.String(),
            permissions: Type.Array(Type.Object({
              person_type: Type.String(),
              person_id: Type.String(),
              person_name: Type.String(),
              entity_instance_id: Type.String(),
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
          rbac.person_code,
          rbac.person_id,
          rbac.entity_code,
          rbac.entity_instance_id,
          rbac.permission,
          rbac.granted_ts,
          rbac.expires_ts,
          CASE
            WHEN rbac.person_code = 'employee' THEN COALESCE(emp.name, emp.email)
            WHEN rbac.person_code = 'role' THEN role.name
            ELSE NULL
          END AS person_name,
          CASE
            WHEN rbac.person_code = 'employee' THEN emp.code
            WHEN rbac.person_code = 'role' THEN role.code
            ELSE NULL
          END AS person_code_value
        FROM app.entity_rbac rbac
        LEFT JOIN app.employee emp ON rbac.person_code = 'employee' AND rbac.person_id = emp.id
        LEFT JOIN app.role role ON rbac.person_code = 'role' AND rbac.person_id = role.id
        ORDER BY
          rbac.person_code,
          CASE
            WHEN rbac.person_code = 'employee' THEN COALESCE(emp.name, emp.email)
            WHEN rbac.person_code = 'role' THEN role.name
            ELSE NULL
          END,
          rbac.entity_code,
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
        const personCode = record.person_code as string;
        const personId = record.person_id as string;
        const entityCode = record.entity_code as string;
        const entityInstanceId = record.entity_instance_id as string;
        const permission = record.permission as number;
        const personName = (record.person_name as string) || 'Unknown';
        const personCodeValue = record.person_code_value as string;
        const grantedTs = record.granted_ts as string;
        const expiresTs = record.expires_ts as string | null;

        const personKey = `${personCode}:${personId}`;
        uniquePersons.add(personKey);
        uniqueEntities.add(entityCode);

        if (personCode === 'role') {
          roleBasedCount++;
        } else {
          employeeCount++;
        }

        // Group by person
        if (!personMap.has(personKey)) {
          personMap.set(personKey, {
            person_type: personCode,
            person_id: personId,
            person_name: personName,
            person_code: personCodeValue,
            permissions: [],
          });
        }

        const entity_display = entityInstanceId === '11111111-1111-1111-1111-111111111111'
          ? 'ALL (Type-level)'
          : entityInstanceId;

        personMap.get(personKey).permissions.push({
          entity_code: entityCode,
          entity_instance_id: entityInstanceId,
          entity_display: entity_display,
          permission_level: permission,
          permission_label: getPermissionLabel(permission),
          granted_ts: grantedTs,
          expires_ts: expiresTs,
        });

        // Group by entity
        if (!entityMap.has(entityCode)) {
          entityMap.set(entityCode, {
            entity_code: entityCode,
            permissions: [],
          });
        }

        entityMap.get(entityCode).permissions.push({
          person_type: personCode,
          person_id: personId,
          person_name: personName,
          entity_instance_id: entityInstanceId,
          permission_level: permission,
          permission_label: getPermissionLabel(permission),
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

}
