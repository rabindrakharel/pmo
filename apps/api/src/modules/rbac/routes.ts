/**
 * ============================================================================
 * RBAC API ROUTES - v2.0.0 Role-Only Model
 * ============================================================================
 *
 * All routes use /api/v1/entity_rbac/ prefix to match table name.
 *
 * RBAC Model (v2.0.0):
 * - Permissions are granted to ROLES only (no direct employee/person permissions)
 * - Persons get permissions through role membership via entity_instance_link
 * - Inheritance modes: none (explicit only), cascade (same to children), mapped (per-child-type)
 * - Explicit deny (is_deny=true) blocks permission even if granted elsewhere
 *
 * ============================================================================
 */

import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import {
  getEntityInfrastructure,
  Permission,
  ALL_ENTITIES_ID,
  type InheritanceMode
} from '../../services/entity-infrastructure.service.js';

// Helper type for permission results
interface PermissionResult {
  actionEntityId: string;
  permissions: string[];
}

// Module-level variable for entityInfra (initialized in rbacRoutes)
let entityInfra: ReturnType<typeof getEntityInfrastructure>;

// Permission level labels
const PERMISSION_LABELS: Record<number, string> = {
  0: 'View',
  1: 'Comment',
  2: 'Contribute',
  3: 'Edit',
  4: 'Share',
  5: 'Delete',
  6: 'Create',
  7: 'Owner'
};

/**
 * Get permission strings for a person on an entity
 * Uses the new role-only RBAC model
 */
async function getPersonEntityPermissions(
  personId: string,
  entityCode: string,
  entityId?: string
): Promise<PermissionResult[]> {
  const targetEntityId = entityId || ALL_ENTITIES_ID;
  const permissions: string[] = [];

  // Test each permission level
  const canView = await entityInfra.check_entity_rbac(personId, entityCode, targetEntityId, Permission.VIEW);
  if (canView) permissions.push('view');

  const canComment = await entityInfra.check_entity_rbac(personId, entityCode, targetEntityId, Permission.COMMENT);
  if (canComment) permissions.push('comment');

  const canContribute = await entityInfra.check_entity_rbac(personId, entityCode, targetEntityId, Permission.CONTRIBUTE);
  if (canContribute) permissions.push('contribute');

  const canEdit = await entityInfra.check_entity_rbac(personId, entityCode, targetEntityId, Permission.EDIT);
  if (canEdit) permissions.push('edit');

  const canShare = await entityInfra.check_entity_rbac(personId, entityCode, targetEntityId, Permission.SHARE);
  if (canShare) permissions.push('share');

  const canDelete = await entityInfra.check_entity_rbac(personId, entityCode, targetEntityId, Permission.DELETE);
  if (canDelete) permissions.push('delete');

  // CREATE is type-level only
  if (targetEntityId === ALL_ENTITIES_ID) {
    const canCreate = await entityInfra.check_entity_rbac(personId, entityCode, ALL_ENTITIES_ID, Permission.CREATE);
    if (canCreate) permissions.push('create');
  }

  const canOwn = await entityInfra.check_entity_rbac(personId, entityCode, targetEntityId, Permission.OWNER);
  if (canOwn) permissions.push('owner');

  return [{
    actionEntityId: targetEntityId,
    permissions
  }];
}

/**
 * Get main page action permissions for a person
 */
async function getMainPageActionPermissions(personId: string, entityCode: string) {
  const canCreate = await entityInfra.check_entity_rbac(personId, entityCode, ALL_ENTITIES_ID, Permission.CREATE);
  const canDelete = await entityInfra.check_entity_rbac(personId, entityCode, ALL_ENTITIES_ID, Permission.DELETE);
  const canShare = await entityInfra.check_entity_rbac(personId, entityCode, ALL_ENTITIES_ID, Permission.SHARE);

  return {
    canCreate,
    canShare,
    canDelete,
    canBulkShare: canShare,
    canBulkDelete: canDelete
  };
}

export async function rbacRoutes(fastify: FastifyInstance) {
  // Initialize Entity Infrastructure Service
  entityInfra = getEntityInfrastructure(db);

  // ===============================
  // PERMISSION CHECK ENDPOINTS
  // ===============================

  // TIER 1: Get comprehensive permissions by entity type (for main page data tables)
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
            actionEntityId: Type.String(),
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
      const permissions = await getPersonEntityPermissions(userId, entityCode);

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
            actionEntityId: Type.String(),
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
      const permissionResults = await getPersonEntityPermissions(userId, entityCode, entityId);

      return {
        entityCode,
        entityId,
        permissions: permissionResults.map(p => ({
          actionEntityId: p.actionEntityId,
          actions: p.permissions,
        })),
      };
    } catch (error) {
      fastify.log.error('Error getting permissions for specific entity:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // TIER 3: Get permissions for action entities within parent context
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
            actionEntityId: Type.String(),
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
        return {
          parentEntity,
          parentEntityId,
          actionEntity,
          permissions: [],
        };
      }

      // Get child entities via entity_instance_link
      const hierarchyResult = await db.execute(sql`
        SELECT DISTINCT child_entity_instance_id
        FROM app.entity_instance_link
        WHERE entity_code = ${parentEntity}
          AND entity_instance_id = ${parentEntityId}
          AND child_entity_code = ${actionEntity}
      `);

      const childEntityIds = hierarchyResult.map(row => row.child_entity_instance_id as string);

      // Get permissions for each child entity
      const permissions = [];

      // Check type-level permission for this action entity type
      const typePermissionResults = await getPersonEntityPermissions(userId, actionEntity, ALL_ENTITIES_ID);
      if (typePermissionResults.length > 0 && typePermissionResults[0].permissions.length > 0) {
        permissions.push({
          actionEntityId: '',
          actions: typePermissionResults[0].permissions,
        });
      }

      // Check permissions for each specific child entity
      for (const childEntityId of childEntityIds) {
        const permissionResults = await getPersonEntityPermissions(userId, actionEntity, childEntityId);
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
        permissions,
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

  // ===============================
  // ROLE PERMISSION MANAGEMENT
  // ===============================

  // Grant permission to a role (upsert - creates or updates)
  fastify.post('/api/v1/entity_rbac/grant-permission', {
    preHandler: [fastify.authenticate],
    schema: {
      body: Type.Object({
        role_id: Type.String({ format: 'uuid' }),
        entity_code: Type.String(),
        entity_instance_id: Type.String(), // ALL_ENTITIES_ID or specific UUID
        permission: Type.Number({ minimum: 0, maximum: 7 }),
        inheritance_mode: Type.Optional(Type.Union([
          Type.Literal('none'),
          Type.Literal('cascade'),
          Type.Literal('mapped')
        ])),
        child_permissions: Type.Optional(Type.Record(Type.String(), Type.Number())),
        is_deny: Type.Optional(Type.Boolean()),
        expires_ts: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
      }),
      response: {
        201: Type.Object({
          id: Type.String(),
          role_id: Type.String(),
          role_name: Type.Optional(Type.String()),
          entity_code: Type.String(),
          entity_instance_id: Type.String(),
          permission: Type.Number(),
          permission_label: Type.String(),
          inheritance_mode: Type.String(),
          child_permissions: Type.Any(),
          is_deny: Type.Boolean(),
          granted_by_person_id: Type.Optional(Type.Union([Type.String(), Type.Null()])),
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
    const {
      role_id,
      entity_code,
      entity_instance_id,
      permission,
      inheritance_mode = 'none',
      child_permissions = {},
      is_deny = false,
      expires_ts
    } = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Verify the role exists
      const roleResult = await db.execute(sql`
        SELECT id, name, code FROM app.role WHERE id = ${role_id}::uuid AND active_flag = true
      `);
      if (roleResult.length === 0) {
        return reply.status(400).send({ error: 'Role not found or inactive' });
      }
      const role = roleResult[0] as any;

      // Verify entity_instance_id if not ALL_ENTITIES_ID
      if (entity_instance_id !== ALL_ENTITIES_ID) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(entity_instance_id)) {
          return reply.status(400).send({ error: 'Invalid entity_instance_id format. Must be UUID or ALL_ENTITIES_ID' });
        }
      }

      // Use the entity infrastructure service to grant permission
      const result = await entityInfra.set_entity_rbac(
        role_id,
        entity_code,
        entity_instance_id,
        permission,
        {
          inheritance_mode: inheritance_mode as InheritanceMode,
          child_permissions,
          is_deny,
          granted_by_person_id: userId,
          expires_ts: expires_ts || null
        }
      );

      return reply.status(201).send({
        id: result.id,
        role_id: result.role_id,
        role_name: role.name,
        entity_code: result.entity_code,
        entity_instance_id: result.entity_instance_id,
        permission: result.permission,
        permission_label: PERMISSION_LABELS[result.permission] || 'Unknown',
        inheritance_mode: result.inheritance_mode,
        child_permissions: result.child_permissions,
        is_deny: result.is_deny,
        granted_by_person_id: result.granted_by_person_id,
        granted_ts: result.granted_ts || new Date().toISOString(),
        expires_ts: result.expires_ts,
        message: 'Permission granted successfully',
      });
    } catch (error) {
      fastify.log.error('Error granting permission:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get permissions for a specific role
  // NOTE: Response structure uses 'data' array to match frontend TanStack Query expectations
  fastify.get('/api/v1/entity_rbac/role/:roleId/permissions', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        roleId: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          role_id: Type.String(),
          role_name: Type.String(),
          role_code: Type.Optional(Type.String()),
          data: Type.Array(Type.Object({
            id: Type.String(),
            entity_code: Type.String(),
            entity_instance_id: Type.String(),
            entity_display: Type.String(),
            permission: Type.Number(),
            permission_label: Type.String(),
            inheritance_mode: Type.String(),
            child_permissions: Type.Any(),
            is_deny: Type.Boolean(),
            granted_by_name: Type.Optional(Type.Union([Type.String(), Type.Null()])),
            granted_ts: Type.Optional(Type.String()),
            expires_ts: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          })),
        }),
        401: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { roleId } = request.params as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Get role info
      const roleResult = await db.execute(sql`
        SELECT id, name, code FROM app.role WHERE id = ${roleId}::uuid
      `);
      if (roleResult.length === 0) {
        return reply.status(404).send({ error: 'Role not found' });
      }
      const role = roleResult[0] as any;

      // Get permissions using service method
      const permissions = await entityInfra.get_role_permissions(roleId);

      return {
        role_id: role.id,
        role_name: role.name,
        role_code: role.code,
        data: permissions.map(p => ({
          id: p.id,
          entity_code: p.entity_code,
          entity_instance_id: p.entity_instance_id,
          entity_display: p.entity_instance_id === ALL_ENTITIES_ID
            ? 'ALL (Type-level)'
            : p.entity_instance_id,
          permission: p.permission,
          permission_label: PERMISSION_LABELS[p.permission] || 'Unknown',
          inheritance_mode: p.inheritance_mode,
          child_permissions: p.child_permissions,
          is_deny: p.is_deny,
          granted_by_name: p.granted_by_name,
          granted_ts: p.granted_ts,
          expires_ts: p.expires_ts,
        })),
      };
    } catch (error) {
      const err = error as Error;
      fastify.log.error(`Error fetching role permissions: ${err.message}`);
      if (err.stack) fastify.log.error(err.stack);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update a permission
  fastify.put('/api/v1/entity_rbac/permission/:permissionId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        permissionId: Type.String({ format: 'uuid' }),
      }),
      body: Type.Object({
        permission: Type.Optional(Type.Number({ minimum: 0, maximum: 7 })),
        inheritance_mode: Type.Optional(Type.Union([
          Type.Literal('none'),
          Type.Literal('cascade'),
          Type.Literal('mapped')
        ])),
        child_permissions: Type.Optional(Type.Record(Type.String(), Type.Number())),
        is_deny: Type.Optional(Type.Boolean()),
        expires_ts: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
      }),
      response: {
        200: Type.Object({
          id: Type.String(),
          message: Type.String(),
        }),
        401: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { permissionId } = request.params as any;
    const updates = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Check if permission exists
      const existingResult = await db.execute(sql`
        SELECT id FROM app.entity_rbac WHERE id = ${permissionId}::uuid
      `);
      if (existingResult.length === 0) {
        return reply.status(404).send({ error: 'Permission not found' });
      }

      // Build dynamic update using SQL template literals
      const setClauses: ReturnType<typeof sql>[] = [];

      if (updates.permission !== undefined) {
        setClauses.push(sql`permission = ${updates.permission}`);
      }
      if (updates.inheritance_mode !== undefined) {
        setClauses.push(sql`inheritance_mode = ${updates.inheritance_mode}`);
      }
      if (updates.child_permissions !== undefined) {
        setClauses.push(sql`child_permissions = ${JSON.stringify(updates.child_permissions)}::jsonb`);
      }
      if (updates.is_deny !== undefined) {
        setClauses.push(sql`is_deny = ${updates.is_deny}`);
      }
      if (updates.expires_ts !== undefined) {
        setClauses.push(sql`expires_ts = ${updates.expires_ts}::timestamptz`);
      }

      if (setClauses.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      setClauses.push(sql`updated_ts = NOW()`);

      await db.execute(sql`
        UPDATE app.entity_rbac
        SET ${sql.join(setClauses, sql`, `)}
        WHERE id = ${permissionId}::uuid
      `);

      return { id: permissionId, message: 'Permission updated successfully' };
    } catch (error) {
      fastify.log.error('Error updating permission:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Revoke permission (hard delete)
  fastify.delete('/api/v1/entity_rbac/permission/:permissionId', {
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
        SELECT id FROM app.entity_rbac WHERE id = ${permissionId}::uuid
      `);

      if (permissionExists.length === 0) {
        return reply.status(404).send({ error: 'Permission not found' });
      }

      // Hard delete the permission
      await db.execute(sql`
        DELETE FROM app.entity_rbac WHERE id = ${permissionId}::uuid
      `);

      return { message: 'Permission revoked successfully' };
    } catch (error) {
      fastify.log.error('Error revoking permission:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ===============================
  // RBAC OVERVIEW & REPORTING
  // ===============================

  // Comprehensive RBAC overview with role names and entity permissions
  fastify.get('/api/v1/entity_rbac/overview', {
    preHandler: [fastify.authenticate],
    schema: {
      response: {
        200: Type.Object({
          summary: Type.Object({
            total_permissions: Type.Number(),
            unique_roles: Type.Number(),
            unique_entities: Type.Number(),
            deny_permissions: Type.Number(),
            cascading_permissions: Type.Number(),
            mapped_permissions: Type.Number(),
          }),
          permissions_by_role: Type.Array(Type.Object({
            role_id: Type.String(),
            role_name: Type.String(),
            role_code: Type.Optional(Type.String()),
            permissions: Type.Array(Type.Object({
              entity_code: Type.String(),
              entity_instance_id: Type.String(),
              entity_display: Type.String(),
              permission_level: Type.Number(),
              permission_label: Type.String(),
              inheritance_mode: Type.String(),
              child_permissions: Type.Any(),
              is_deny: Type.Boolean(),
              granted_ts: Type.Optional(Type.String()),
              expires_ts: Type.Optional(Type.Union([Type.String(), Type.Null()])),
            })),
          })),
          permissions_by_entity: Type.Array(Type.Object({
            entity_code: Type.String(),
            permissions: Type.Array(Type.Object({
              role_id: Type.String(),
              role_name: Type.String(),
              entity_instance_id: Type.String(),
              permission_level: Type.Number(),
              permission_label: Type.String(),
              inheritance_mode: Type.String(),
              is_deny: Type.Boolean(),
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
      // Get all RBAC records with role names
      const rbacRecords = await db.execute(sql`
        SELECT
          er.id,
          er.role_id,
          r.code AS role_code,
          r.name AS role_name,
          er.entity_code,
          er.entity_instance_id,
          er.permission,
          er.inheritance_mode,
          er.child_permissions,
          er.is_deny,
          er.granted_ts,
          er.expires_ts
        FROM app.entity_rbac er
        JOIN app.role r ON er.role_id = r.id
        ORDER BY r.name, er.entity_code, er.permission DESC
      `);

      // Group by role
      const roleMap = new Map<string, any>();
      const entityMap = new Map<string, any>();
      const uniqueRoles = new Set<string>();
      const uniqueEntities = new Set<string>();
      let denyCount = 0;
      let cascadeCount = 0;
      let mappedCount = 0;

      for (const record of rbacRecords) {
        const roleId = record.role_id as string;
        const roleName = record.role_name as string;
        const roleCode = record.role_code as string;
        const entityCode = record.entity_code as string;
        const entityInstanceId = record.entity_instance_id as string;
        const permission = record.permission as number;
        const inheritanceMode = record.inheritance_mode as string;
        const childPermissions = record.child_permissions;
        const isDeny = record.is_deny as boolean;
        const grantedTs = record.granted_ts as string;
        const expiresTs = record.expires_ts as string | null;

        uniqueRoles.add(roleId);
        uniqueEntities.add(entityCode);

        if (isDeny) denyCount++;
        if (inheritanceMode === 'cascade') cascadeCount++;
        if (inheritanceMode === 'mapped') mappedCount++;

        // Group by role
        if (!roleMap.has(roleId)) {
          roleMap.set(roleId, {
            role_id: roleId,
            role_name: roleName,
            role_code: roleCode,
            permissions: [],
          });
        }

        const entityDisplay = entityInstanceId === ALL_ENTITIES_ID
          ? 'ALL (Type-level)'
          : entityInstanceId;

        roleMap.get(roleId).permissions.push({
          entity_code: entityCode,
          entity_instance_id: entityInstanceId,
          entity_display: entityDisplay,
          permission_level: permission,
          permission_label: PERMISSION_LABELS[permission] || 'Unknown',
          inheritance_mode: inheritanceMode,
          child_permissions: childPermissions,
          is_deny: isDeny,
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
          role_id: roleId,
          role_name: roleName,
          entity_instance_id: entityInstanceId,
          permission_level: permission,
          permission_label: PERMISSION_LABELS[permission] || 'Unknown',
          inheritance_mode: inheritanceMode,
          is_deny: isDeny,
        });
      }

      return {
        summary: {
          total_permissions: rbacRecords.length,
          unique_roles: uniqueRoles.size,
          unique_entities: uniqueEntities.size,
          deny_permissions: denyCount,
          cascading_permissions: cascadeCount,
          mapped_permissions: mappedCount,
        },
        permissions_by_role: Array.from(roleMap.values()),
        permissions_by_entity: Array.from(entityMap.values()),
      };
    } catch (error: any) {
      fastify.log.error(`Error fetching RBAC overview: ${error.message}`, error);
      return reply.status(500).send({ error: `Internal server error: ${error.message}` });
    }
  });

  // Get effective access for a person (resolved permissions after inheritance)
  // NOTE: Response structure uses 'data' array to match frontend TanStack Query expectations
  fastify.get('/api/v1/entity_rbac/person/:personId/effective-access', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        personId: Type.String({ format: 'uuid' }),
      }),
      querystring: Type.Object({
        entity_code: Type.Optional(Type.String()),
      }),
      response: {
        200: Type.Object({
          person_id: Type.String(),
          person_name: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          roles: Type.Array(Type.Object({
            role_id: Type.String(),
            role_name: Type.String(),
          })),
          data: Type.Array(Type.Object({
            entity_code: Type.String(),
            entity_name: Type.Optional(Type.Union([Type.String(), Type.Null()])),
            entity_icon: Type.Optional(Type.Union([Type.String(), Type.Null()])),
            entity_instance_id: Type.String(),
            permission: Type.Number(),
            is_deny: Type.Boolean(),
            source: Type.String(), // 'direct' | 'inherited'
            inherited_from: Type.Optional(Type.Object({
              entity_code: Type.String(),
              entity_name: Type.Optional(Type.String()),
            })),
          })),
        }),
        401: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { personId } = request.params as any;
    const { entity_code } = request.query as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Get person info
      const personResult = await db.execute(sql`
        SELECT id, name FROM app.person WHERE id = ${personId}::uuid
      `);
      const personName = personResult.length > 0 ? (personResult[0] as any).name : null;

      // Get roles for this person
      const rolesResult = await db.execute(sql`
        SELECT r.id AS role_id, r.name AS role_name
        FROM app.entity_instance_link eil
        JOIN app.role r ON eil.entity_instance_id = r.id
        WHERE eil.entity_code = 'role'
          AND eil.child_entity_code = 'person'
          AND eil.child_entity_instance_id = ${personId}::uuid
      `);

      const roles = rolesResult.map(r => ({
        role_id: (r as any).role_id,
        role_name: (r as any).role_name,
      }));

      // Get effective permissions with entity metadata
      let entityFilter = sql`1=1`;
      if (entity_code) {
        entityFilter = sql`er.entity_code = ${entity_code}`;
      }

      const effectiveResult = await db.execute(sql`
        SELECT DISTINCT ON (er.entity_code, er.entity_instance_id)
          er.entity_code,
          er.entity_instance_id,
          er.permission,
          er.is_deny,
          er.inheritance_mode,
          e.name AS entity_name,
          e.ui_icon AS entity_icon,
          r.name AS role_name,
          CASE
            WHEN er.inheritance_mode = 'none' THEN 'direct'
            ELSE 'inherited'
          END AS source
        FROM app.entity_rbac er
        JOIN app.role r ON er.role_id = r.id
        JOIN app.entity_instance_link eil ON eil.entity_instance_id = r.id
        LEFT JOIN app.entity e ON e.code = er.entity_code
        WHERE eil.entity_code = 'role'
          AND eil.child_entity_code = 'person'
          AND eil.child_entity_instance_id = ${personId}::uuid
          AND (er.expires_ts IS NULL OR er.expires_ts > NOW())
          AND ${entityFilter}
        ORDER BY er.entity_code, er.entity_instance_id, er.permission DESC
      `);

      return {
        person_id: personId,
        person_name: personName,
        roles,
        data: effectiveResult.map(p => ({
          entity_code: (p as any).entity_code,
          entity_name: (p as any).entity_name,
          entity_icon: (p as any).entity_icon,
          entity_instance_id: (p as any).entity_instance_id,
          permission: (p as any).permission,
          is_deny: (p as any).is_deny,
          source: (p as any).source,
          inherited_from: (p as any).source === 'inherited' ? {
            entity_code: (p as any).entity_code,
            entity_name: (p as any).role_name,
          } : undefined,
        })),
      };
    } catch (error) {
      fastify.log.error('Error fetching effective access:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ===============================
  // HIERARCHICAL PERMISSIONS (v2.1.0)
  // ===============================

  // Get hierarchical permissions for a role with entity types, instances, and child entity support
  fastify.get('/api/v1/entity_rbac/role/:roleId/hierarchical-permissions', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        roleId: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          role_id: Type.String(),
          role_name: Type.String(),
          role_code: Type.Optional(Type.String()),
          entities: Type.Array(Type.Object({
            entity_code: Type.String(),
            entity_label: Type.String(),
            entity_icon: Type.Optional(Type.String()),
            child_entity_codes: Type.Array(Type.Object({
              entity: Type.String(),
              ui_label: Type.String(),
              ui_icon: Type.Optional(Type.String()),
              order: Type.Optional(Type.Number()),
            })),
            permissions: Type.Array(Type.Object({
              id: Type.String(),
              entity_instance_id: Type.String(),
              entity_instance_name: Type.Optional(Type.Union([Type.String(), Type.Null()])),
              permission: Type.Number(),
              permission_label: Type.String(),
              inheritance_mode: Type.String(),
              child_permissions: Type.Any(),
              is_deny: Type.Boolean(),
              granted_ts: Type.Optional(Type.String()),
              expires_ts: Type.Optional(Type.Union([Type.String(), Type.Null()])),
            })),
          })),
        }),
        401: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { roleId } = request.params as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Get role info
      const roleResult = await db.execute(sql`
        SELECT id, name, code FROM app.role WHERE id = ${roleId}::uuid
      `);
      if (roleResult.length === 0) {
        return reply.status(404).send({ error: 'Role not found' });
      }
      const role = roleResult[0] as any;

      // Get all entity types with their child_entity_codes
      const entityTypesResult = await db.execute(sql`
        SELECT
          code,
          name,
          ui_label,
          ui_icon,
          child_entity_codes
        FROM app.entity
        WHERE active_flag = true
        ORDER BY display_order, name
      `);

      // Get all permissions for this role with instance names
      const permissionsResult = await db.execute(sql`
        SELECT
          er.id,
          er.entity_code,
          er.entity_instance_id,
          er.permission,
          er.inheritance_mode,
          er.child_permissions,
          er.is_deny,
          er.granted_ts,
          er.expires_ts,
          ei.entity_instance_name
        FROM app.entity_rbac er
        LEFT JOIN app.entity_instance ei
          ON er.entity_code = ei.entity_code
          AND er.entity_instance_id = ei.entity_instance_id
        WHERE er.role_id = ${roleId}::uuid
          AND (er.expires_ts IS NULL OR er.expires_ts > NOW())
        ORDER BY er.entity_code, er.permission DESC
      `);

      // Build entity type map
      const entityTypeMap = new Map<string, any>();
      for (const et of entityTypesResult) {
        const entityType = et as any;
        entityTypeMap.set(entityType.code, {
          entity_code: entityType.code,
          entity_label: entityType.ui_label || entityType.name,
          entity_icon: entityType.ui_icon,
          child_entity_codes: entityType.child_entity_codes || [],
          permissions: [],
        });
      }

      // Group permissions by entity type
      for (const perm of permissionsResult) {
        const p = perm as any;
        const entityType = entityTypeMap.get(p.entity_code);

        if (entityType) {
          entityType.permissions.push({
            id: p.id,
            entity_instance_id: p.entity_instance_id,
            entity_instance_name: p.entity_instance_id === ALL_ENTITIES_ID
              ? null
              : p.entity_instance_name,
            permission: p.permission,
            permission_label: PERMISSION_LABELS[p.permission] || 'Unknown',
            inheritance_mode: p.inheritance_mode || 'none',
            child_permissions: p.child_permissions || {},
            is_deny: p.is_deny || false,
            granted_ts: p.granted_ts,
            expires_ts: p.expires_ts,
          });
        } else {
          // Entity type not in map (possibly inactive), still include it
          entityTypeMap.set(p.entity_code, {
            entity_code: p.entity_code,
            entity_label: p.entity_code,
            entity_icon: null,
            child_entity_codes: [],
            permissions: [{
              id: p.id,
              entity_instance_id: p.entity_instance_id,
              entity_instance_name: p.entity_instance_id === ALL_ENTITIES_ID
                ? null
                : p.entity_instance_name,
              permission: p.permission,
              permission_label: PERMISSION_LABELS[p.permission] || 'Unknown',
              inheritance_mode: p.inheritance_mode || 'none',
              child_permissions: p.child_permissions || {},
              is_deny: p.is_deny || false,
              granted_ts: p.granted_ts,
              expires_ts: p.expires_ts,
            }],
          });
        }
      }

      // Sort permissions within each entity: ALL first, then by name
      for (const entity of entityTypeMap.values()) {
        entity.permissions.sort((a: any, b: any) => {
          if (a.entity_instance_id === ALL_ENTITIES_ID) return -1;
          if (b.entity_instance_id === ALL_ENTITIES_ID) return 1;
          return (a.entity_instance_name || '').localeCompare(b.entity_instance_name || '');
        });
      }

      // Filter to only entities with permissions and convert to array
      const entitiesWithPermissions = Array.from(entityTypeMap.values())
        .filter(e => e.permissions.length > 0);

      return {
        role_id: role.id,
        role_name: role.name,
        role_code: role.code,
        entities: entitiesWithPermissions,
      };
    } catch (error: any) {
      fastify.log.error(`Error fetching hierarchical permissions: ${error.message}`, error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update child_permissions for a permission (used by hierarchical matrix)
  fastify.patch('/api/v1/entity_rbac/permission/:permissionId/child-permissions', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        permissionId: Type.String({ format: 'uuid' }),
      }),
      body: Type.Object({
        child_entity_code: Type.String(),
        permission: Type.Number({ minimum: -1, maximum: 7 }), // -1 to remove
      }),
      response: {
        200: Type.Object({
          id: Type.String(),
          child_permissions: Type.Any(),
          message: Type.String(),
        }),
        401: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { permissionId } = request.params as any;
    const { child_entity_code, permission } = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Get current permission
      const existingResult = await db.execute(sql`
        SELECT id, child_permissions, inheritance_mode
        FROM app.entity_rbac
        WHERE id = ${permissionId}::uuid
      `);

      if (existingResult.length === 0) {
        return reply.status(404).send({ error: 'Permission not found' });
      }

      const existing = existingResult[0] as any;
      const currentChildPerms = existing.child_permissions || {};

      // Update child_permissions
      let newChildPerms: Record<string, number>;
      if (permission === -1) {
        // Remove the child permission
        newChildPerms = { ...currentChildPerms };
        delete newChildPerms[child_entity_code];
      } else {
        // Set/update the child permission
        newChildPerms = { ...currentChildPerms, [child_entity_code]: permission };
      }

      // If we have child permissions, auto-set inheritance_mode to 'mapped'
      const hasChildPerms = Object.keys(newChildPerms).length > 0;
      const newInheritanceMode = hasChildPerms ? 'mapped' : existing.inheritance_mode;

      await db.execute(sql`
        UPDATE app.entity_rbac
        SET
          child_permissions = ${JSON.stringify(newChildPerms)}::jsonb,
          inheritance_mode = ${newInheritanceMode},
          updated_ts = NOW()
        WHERE id = ${permissionId}::uuid
      `);

      return {
        id: permissionId,
        child_permissions: newChildPerms,
        message: 'Child permission updated successfully',
      };
    } catch (error: any) {
      fastify.log.error(`Error updating child permissions: ${error.message}`, error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ===============================
  // ROLE-PERSON MEMBERSHIP (DEPRECATED)
  // ===============================
  // NOTE: Role-person membership is now managed via universal entity APIs:
  //   - GET members: GET /api/v1/person?parent_entity_code=role&parent_entity_instance_id={roleId}
  //   - Add member: POST /api/v1/entity_instance_link
  //   - Remove member: DELETE /api/v1/entity_instance_link/{linkId}
  // See: AccessControlPage.tsx for implementation details
}
