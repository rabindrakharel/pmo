/**
 * RBAC Service - Person-Based Permission Control (Integer Model 0-5)
 *
 * Provides API-level RBAC functions for permission gating and scope filtering.
 * Implements person-based permissions (role + employee) with hierarchical inheritance.
 *
 * Permission Levels (Integer 0-5):
 *   0 = View   - Read access
 *   1 = Edit   - Modify existing entity (inherits View)
 *   2 = Share  - Share with others (inherits Edit + View)
 *   3 = Delete - Soft delete (inherits Share + Edit + View)
 *   4 = Create - Create new entities (inherits all lower)
 *   5 = Owner  - Full control (inherits all permissions)
 *
 * Permission checks use >= comparison for hierarchical inheritance.
 */

import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import type { FastifyRequest, FastifyReply } from 'fastify';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type PermissionType = 'view' | 'edit' | 'share' | 'delete' | 'create' | 'owner';

export enum PermissionLevel {
  VIEW = 0,
  EDIT = 1,
  SHARE = 2,
  DELETE = 3,
  CREATE = 4,
  OWNER = 5,
}

export const PermissionTypeToLevel: Record<PermissionType, PermissionLevel> = {
  view: PermissionLevel.VIEW,
  edit: PermissionLevel.EDIT,
  share: PermissionLevel.SHARE,
  delete: PermissionLevel.DELETE,
  create: PermissionLevel.CREATE,
  owner: PermissionLevel.OWNER,
};

export interface PermissionCheckResult {
  hasPermission: boolean;
  maxPermissionLevel: number;
  source: 'role' | 'employee' | 'both' | 'none';
}

export interface ScopeResult {
  scope: string[];  // Array of entity_id UUIDs
  hasAllAccess: boolean;  // True if 'all' access
}

// ============================================================================
// CORE RBAC FUNCTIONS
// ============================================================================

/**
 * Check if employee has specific permission on entity instance.
 * Resolves via UNION of role-based and direct employee permissions, takes MAX level.
 *
 * @param employeeId - Employee UUID (from JWT token)
 * @param entityName - Entity type (project, task, employee, office, etc.)
 * @param entityId - Specific entity UUID or 'all' for type-level check
 * @param permissionType - Permission to check (view, edit, share, delete, create, owner)
 * @returns PermissionCheckResult with hasPermission, maxPermissionLevel, and source
 */
export async function hasPermissionOnEntityId(
  employeeId: string,
  entityName: string,
  entityId: string,
  permissionType: PermissionType
): Promise<PermissionCheckResult> {
  const requiredLevel = PermissionTypeToLevel[permissionType];

  try {
    // Query to get MAX permission from role-based and direct employee permissions
    const result = await db.execute(sql`
      SELECT
        COALESCE(MAX(permission), -1) as max_permission,
        ARRAY_AGG(DISTINCT person_entity_name) FILTER (WHERE permission >= ${requiredLevel}) as sources
      FROM (
        -- Source 1: Direct employee permissions
        SELECT permission, person_entity_name
        FROM app.entity_id_rbac_map
        WHERE person_entity_name = 'employee'
          AND person_entity_id = ${employeeId}::uuid
          AND entity_name = ${entityName}
          AND (entity_id = 'all' OR entity_id = ${entityId})
          AND active_flag = true
          AND (expires_ts IS NULL OR expires_ts > now())

        UNION ALL

        -- Source 2: Role-based permissions (employee → roles → permissions)
        SELECT rbac.permission, rbac.person_entity_name
        FROM app.entity_id_rbac_map rbac
        INNER JOIN app.d_entity_id_map eim
          ON eim.parent_entity_type = 'role'
          AND eim.parent_entity_id::text = rbac.person_entity_id::text
          AND eim.child_entity_type = 'employee'
          AND eim.child_entity_id = ${employeeId}::uuid
          AND eim.active_flag = true
        WHERE rbac.person_entity_name = 'role'
          AND rbac.entity_name = ${entityName}
          AND (rbac.entity_id = 'all' OR rbac.entity_id = ${entityId})
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > now())
      ) AS combined
    `);

    const row = result.rows[0] as any;
    const maxPermission = parseInt(row.max_permission);
    const sources = row.sources as string[] | null;

    // Check if max permission level meets requirement (hierarchical inheritance via >=)
    const hasPermission = maxPermission >= requiredLevel;

    // Determine source
    let source: 'role' | 'employee' | 'both' | 'none' = 'none';
    if (sources && sources.length > 0) {
      if (sources.includes('role') && sources.includes('employee')) {
        source = 'both';
      } else if (sources.includes('role')) {
        source = 'role';
      } else if (sources.includes('employee')) {
        source = 'employee';
      }
    }

    return {
      hasPermission,
      maxPermissionLevel: maxPermission,
      source,
    };
  } catch (error) {
    console.error('Error checking permission:', error);
    return {
      hasPermission: false,
      maxPermissionLevel: -1,
      source: 'none',
    };
  }
}

/**
 * Get all entity IDs that employee can access with specified permission.
 * Returns array of entity_id UUIDs for filtering query results.
 *
 * @param employeeId - Employee UUID (from JWT token)
 * @param entityName - Entity type (project, task, employee, office, etc.)
 * @param permissionType - Permission to check (view, edit, share, delete, create, owner)
 * @returns ScopeResult with scope array and hasAllAccess flag
 */
export async function getAllScopeByEntityEmployee(
  employeeId: string,
  entityName: string,
  permissionType: PermissionType
): Promise<ScopeResult> {
  const requiredLevel = PermissionTypeToLevel[permissionType];

  try {
    // Check if employee has 'all' access (type-level permission with sufficient level)
    const allAccessResult = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM (
          -- Direct employee 'all' permission
          SELECT permission
          FROM app.entity_id_rbac_map
          WHERE person_entity_name = 'employee'
            AND person_entity_id = ${employeeId}::uuid
            AND entity_name = ${entityName}
            AND entity_id = 'all'
            AND permission >= ${requiredLevel}
            AND active_flag = true
            AND (expires_ts IS NULL OR expires_ts > now())

          UNION ALL

          -- Role-based 'all' permission
          SELECT rbac.permission
          FROM app.entity_id_rbac_map rbac
          INNER JOIN app.d_entity_id_map eim
            ON eim.parent_entity_type = 'role'
            AND eim.parent_entity_id::text = rbac.person_entity_id::text
            AND eim.child_entity_type = 'employee'
            AND eim.child_entity_id = ${employeeId}::uuid
            AND eim.active_flag = true
          WHERE rbac.person_entity_name = 'role'
            AND rbac.entity_name = ${entityName}
            AND rbac.entity_id = 'all'
            AND rbac.permission >= ${requiredLevel}
            AND rbac.active_flag = true
            AND (rbac.expires_ts IS NULL OR rbac.expires_ts > now())
        ) AS combined
      ) as has_all_access
    `);

    const hasAllAccess = (allAccessResult.rows[0] as any).has_all_access;

    if (hasAllAccess) {
      return {
        scope: ['all'],
        hasAllAccess: true,
      };
    }

    // Otherwise, collect specific entity IDs where permission level is sufficient
    const scopeResult = await db.execute(sql`
      SELECT array_agg(DISTINCT entity_id) as scope
      FROM (
        -- Direct employee permissions on specific entities
        SELECT entity_id
        FROM app.entity_id_rbac_map
        WHERE person_entity_name = 'employee'
          AND person_entity_id = ${employeeId}::uuid
          AND entity_name = ${entityName}
          AND entity_id != 'all'
          AND permission >= ${requiredLevel}
          AND active_flag = true
          AND (expires_ts IS NULL OR expires_ts > now())

        UNION

        -- Role-based permissions on specific entities
        SELECT rbac.entity_id
        FROM app.entity_id_rbac_map rbac
        INNER JOIN app.d_entity_id_map eim
          ON eim.parent_entity_type = 'role'
          AND eim.parent_entity_id::text = rbac.person_entity_id::text
          AND eim.child_entity_type = 'employee'
          AND eim.child_entity_id = ${employeeId}::uuid
          AND eim.active_flag = true
        WHERE rbac.person_entity_name = 'role'
          AND rbac.entity_name = ${entityName}
          AND rbac.entity_id != 'all'
          AND rbac.permission >= ${requiredLevel}
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > now())
      ) AS specific_permissions
    `);

    const scope = (scopeResult.rows[0] as any).scope || [];

    return {
      scope,
      hasAllAccess: false,
    };
  } catch (error) {
    console.error('Error getting scope:', error);
    return {
      scope: [],
      hasAllAccess: false,
    };
  }
}

// ============================================================================
// FASTIFY MIDDLEWARE
// ============================================================================

/**
 * Middleware to gate API operations based on permissions.
 * Use for UPDATE, DELETE operations to ensure user has required permission.
 *
 * @param entityName - Entity type (project, task, etc.)
 * @param permission - Required permission (edit, delete, share, etc.)
 * @param entityIdParam - Request param name containing entity ID (defaults to 'id')
 *
 * @example
 * app.put('/api/v1/project/:id', requirePermission('project', 'edit'), async (req, reply) => {
 *   // Handler executes only if user has edit permission
 * });
 */
export function requirePermission(
  entityName: string,
  permission: PermissionType,
  entityIdParam: string = 'id'
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Extract employee ID from JWT token
    const employeeId = (request as any).user?.sub;
    if (!employeeId) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Missing authentication token',
      });
    }

    // Get entity ID from request params
    const entityId = (request.params as any)[entityIdParam];
    if (!entityId) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: `Missing ${entityIdParam} parameter`,
      });
    }

    // Check permission
    const result = await hasPermissionOnEntityId(
      employeeId,
      entityName,
      entityId,
      permission
    );

    if (!result.hasPermission) {
      return reply.code(403).send({
        error: 'Permission denied',
        message: `You do not have ${permission} permission on ${entityName}`,
        entityId,
        requiredPermission: permission,
        yourMaxPermission: result.maxPermissionLevel,
      });
    }

    // Permission granted - continue to handler
  };
}

/**
 * Middleware to gate CREATE operations.
 * Checks for type-level create permission (entity_id='all', permission >= 4).
 *
 * @param entityName - Entity type (project, task, etc.)
 *
 * @example
 * app.post('/api/v1/project', requireCreatePermission('project'), async (req, reply) => {
 *   // Handler executes only if user can create projects
 * });
 */
export function requireCreatePermission(entityName: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const employeeId = (request as any).user?.sub;
    if (!employeeId) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Missing authentication token',
      });
    }

    // Check create permission on 'all' (type-level)
    const result = await hasPermissionOnEntityId(
      employeeId,
      entityName,
      'all',
      'create'
    );

    if (!result.hasPermission) {
      return reply.code(403).send({
        error: 'Permission denied',
        message: `You do not have create permission for ${entityName}`,
        requiredPermission: 'create',
        yourMaxPermission: result.maxPermissionLevel,
      });
    }

    // Permission granted - continue to handler
  };
}

/**
 * Helper function to filter query results by employee scope.
 * Returns SQL WHERE clause condition for filtering.
 *
 * @param employeeId - Employee UUID (from JWT token)
 * @param entityName - Entity type (project, task, etc.)
 * @param permission - Required permission (defaults to 'view')
 * @returns Object with scopeIds array and hasAllAccess flag
 *
 * @example
 * const filter = await getEntityScopeFilter(employeeId, 'project', 'view');
 * if (filter.hasAllAccess) {
 *   // No filtering needed - user can see all
 *   query = 'SELECT * FROM d_project WHERE active_flag = true';
 * } else if (filter.scopeIds.length === 0) {
 *   // No access - return empty result
 *   return [];
 * } else {
 *   // Filter by specific IDs
 *   query = 'SELECT * FROM d_project WHERE id = ANY($1) AND active_flag = true';
 *   params = [filter.scopeIds];
 * }
 */
export async function getEntityScopeFilter(
  employeeId: string,
  entityName: string,
  permission: PermissionType = 'view'
): Promise<{ scopeIds: string[]; hasAllAccess: boolean }> {
  const result = await getAllScopeByEntityEmployee(employeeId, entityName, permission);

  return {
    scopeIds: result.hasAllAccess ? [] : result.scope,
    hasAllAccess: result.hasAllAccess,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if employee can create child entity under parent.
 * Requires: parent edit permission (>=1) + child create permission (>=4 on 'all').
 *
 * @param employeeId - Employee UUID
 * @param parentEntityName - Parent entity type (project, etc.)
 * @param parentEntityId - Parent entity UUID
 * @param childEntityName - Child entity type (task, etc.)
 * @returns boolean
 */
export async function canCreateChildEntity(
  employeeId: string,
  parentEntityName: string,
  parentEntityId: string,
  childEntityName: string
): Promise<boolean> {
  // Check parent edit permission
  const parentResult = await hasPermissionOnEntityId(
    employeeId,
    parentEntityName,
    parentEntityId,
    'edit'
  );

  if (!parentResult.hasPermission) {
    return false;
  }

  // Check child create permission (type-level)
  const childResult = await hasPermissionOnEntityId(
    employeeId,
    childEntityName,
    'all',
    'create'
  );

  return childResult.hasPermission;
}

/**
 * Get permission level name from integer.
 *
 * @param level - Permission level (0-5)
 * @returns Permission name
 */
export function getPermissionName(level: number): string {
  const names: Record<number, string> = {
    0: 'View',
    1: 'Edit',
    2: 'Share',
    3: 'Delete',
    4: 'Create',
    5: 'Owner',
  };
  return names[level] || 'Unknown';
}

/**
 * Get all permissions implied by a permission level.
 *
 * @param level - Permission level (0-5)
 * @returns Array of implied permission names
 */
export function getImpliedPermissions(level: number): string[] {
  const all = ['View', 'Edit', 'Share', 'Delete', 'Create', 'Owner'];
  return all.slice(0, level + 1);
}
