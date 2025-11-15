/**
 * RBAC Service - Minimal 2-Gate Pattern
 *
 * Provides only 2 essential gates for complete RBAC coverage:
 * 1. data_gate_* - Get accessible entity IDs (for listing/filtering)
 * 2. api_gate_*  - Gate API operations (throws 403 if denied)
 *
 * Permission Levels (Integer 0-5):
 *   0 = View   - Read access
 *   1 = Edit   - Modify existing (inherits View)
 *   2 = Share  - Share with others (inherits Edit + View)
 *   3 = Delete - Soft delete (inherits Share + Edit + View)
 *   4 = Create - Create new (inherits all lower)
 *   5 = Owner  - Full control (inherits all)
 */

import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

// ============================================================================
// TYPES
// ============================================================================

export enum PermissionLevel {
  VIEW = 0,
  EDIT = 1,
  SHARE = 2,
  DELETE = 3,
  CREATE = 4,
  OWNER = 5,
}

// ============================================================================
// INTERNAL HELPER (not exported)
// ============================================================================

/**
 * Internal: Get max permission level for user on entity
 *
 * Includes parent entity inheritance:
 * - If parent has VIEW (0+) → child gains VIEW
 * - If parent has CREATE (4+) → child gains CREATE
 */
async function getMaxPermissionLevelOfEntityID(
  userId: string,
  entityName: string,
  entityId: string
): Promise<number> {
  const result = await db.execute(sql`
    WITH

    -- ---------------------------------------------------------------------------
    -- 1. DIRECT EMPLOYEE PERMISSIONS
    -- ---------------------------------------------------------------------------
    direct_emp AS (
      SELECT permission
      FROM app.entity_id_rbac_map
      WHERE person_entity_name = 'employee'
        AND person_entity_id = ${userId}::uuid
        AND entity_name = ${entityName}
        AND (entity_id = '11111111-1111-1111-1111-111111111111'::uuid OR entity_id = ${entityId}::uuid)
        AND active_flag = true
        AND (expires_ts IS NULL OR expires_ts > NOW())
    ),

    -- ---------------------------------------------------------------------------
    -- 2. ROLE-BASED PERMISSIONS
    --    employee -> role (via d_entity_id_map) -> permissions
    -- ---------------------------------------------------------------------------
    role_based AS (
      SELECT rbac.permission
      FROM app.entity_id_rbac_map rbac
      INNER JOIN app.d_entity_id_map eim
        ON eim.parent_entity_type = 'role'
        AND eim.parent_entity_id = rbac.person_entity_id
        AND eim.child_entity_type = 'employee'
        AND eim.child_entity_id = ${userId}::uuid
        AND eim.active_flag = true
      WHERE rbac.person_entity_name = 'role'
        AND rbac.entity_name = ${entityName}
        AND (rbac.entity_id = '11111111-1111-1111-1111-111111111111'::uuid OR rbac.entity_id = ${entityId}::uuid)
        AND rbac.active_flag = true
        AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
    ),

    -- ---------------------------------------------------------------------------
    -- 3. FIND PARENT ENTITY TYPES OF CURRENT ENTITY
    --    (using d_entity.child_entities)
    -- ---------------------------------------------------------------------------
    parent_entities AS (
      SELECT
        d.code AS parent_entity_name
      FROM app.d_entity d
      WHERE ${entityName} = ANY(SELECT jsonb_array_elements_text(d.child_entities))
    ),

    -- ---------------------------------------------------------------------------
    -- 4. PARENT-VIEW INHERITANCE (permission >= 0)
    --    If parent has VIEW → child gains VIEW
    -- ---------------------------------------------------------------------------
    parent_view AS (
      SELECT 0 AS permission
      FROM parent_entities pe

      -- direct employee permissions on parent
      LEFT JOIN app.entity_id_rbac_map emp
        ON emp.person_entity_name = 'employee'
        AND emp.person_entity_id = ${userId}
        AND emp.entity_name = pe.parent_entity_name
        AND emp.active_flag = true
        AND (emp.expires_ts IS NULL OR emp.expires_ts > NOW())

      -- role permissions on parent
      LEFT JOIN app.entity_id_rbac_map rbac
        ON rbac.person_entity_name = 'role'
        AND rbac.entity_name = pe.parent_entity_name
        AND rbac.active_flag = true
        AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())

      LEFT JOIN app.d_entity_id_map eim
        ON eim.parent_entity_type = 'role'
        AND eim.parent_entity_id = rbac.person_entity_id
        AND eim.child_entity_type = 'employee'
        AND eim.child_entity_id = ${userId}::uuid
        AND eim.active_flag = true

      WHERE
          COALESCE(emp.permission, -1) >= 0
       OR COALESCE(rbac.permission, -1) >= 0
    ),

    -- ---------------------------------------------------------------------------
    -- 5. PARENT-CREATE INHERITANCE (permission >= 4)
    --    If parent has CREATE → child gains CREATE (4)
    -- ---------------------------------------------------------------------------
    parent_create AS (
      SELECT 4 AS permission
      FROM parent_entities pe

      LEFT JOIN app.entity_id_rbac_map emp
        ON emp.person_entity_name = 'employee'
        AND emp.person_entity_id = ${userId}
        AND emp.entity_name = pe.parent_entity_name
        AND emp.active_flag = true
        AND (emp.expires_ts IS NULL OR emp.expires_ts > NOW())

      LEFT JOIN app.entity_id_rbac_map rbac
        ON rbac.person_entity_name = 'role'
        AND rbac.entity_name = pe.parent_entity_name
        AND rbac.active_flag = true
        AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())

      LEFT JOIN app.d_entity_id_map eim
        ON eim.parent_entity_type = 'role'
        AND eim.parent_entity_id = rbac.person_entity_id
        AND eim.child_entity_type = 'employee'
        AND eim.child_entity_id = ${userId}::uuid
        AND eim.active_flag = true

      WHERE
          COALESCE(emp.permission, -1) >= 4
       OR COALESCE(rbac.permission, -1) >= 4
    )

    -- ---------------------------------------------------------------------------
    -- FINAL PERMISSION UNION + MAX()
    -- ---------------------------------------------------------------------------
    SELECT COALESCE(MAX(permission), -1) AS max_permission
    FROM (
      SELECT * FROM direct_emp
      UNION ALL
      SELECT * FROM role_based
      UNION ALL
      SELECT * FROM parent_view
      UNION ALL
      SELECT * FROM parent_create
    ) AS all_perms
  `);

  return parseInt(String(result[0]?.max_permission || -1));
}

// ============================================================================
// 1. DATA GATE - Get Accessible Entity IDs (for listing/filtering)
// ============================================================================

/**
 * DATA GATE: Get all entity IDs user can access
 *
 * Returns array of entity IDs for filtering list queries.
 * Checks view permission (0) by default.
 *
 * @param userId - Employee UUID
 * @param entityName - Entity type (project, task, etc.)
 * @param permission - Required permission level (default: 0 = view)
 * @returns string[] - Array of entity IDs (empty if none)
 *
 * @example
 * // Get all tasks user can view
 * const taskIds = await data_gate_EntityIdsByEntityType(userId, 'task', 0);
 * // Use in WHERE clause: WHERE task.id = ANY(${taskIds})
 */
export async function data_gate_EntityIdsByEntityType(
  userId: string,
  entityName: string,
  permission: number = 0
): Promise<string[]> {
  try {
    // Check if user has type-level permission (11111111-1111-1111-1111-111111111111)
    const typeLevel = await getMaxPermissionLevelOfEntityID(userId, entityName, '11111111-1111-1111-1111-111111111111');

    if (typeLevel >= permission) {
      // User has type-level access - return special marker
      return ['11111111-1111-1111-1111-111111111111'];
    }

    // Get specific entity IDs (with parent inheritance)
    // Logic: Direct permissions + Role permissions + Parent-VIEW inheritance + Parent-CREATE inheritance
    // Mirrors getMaxPermissionLevelOfEntityID but returns ALL accessible IDs instead of checking one
    const result = await db.execute(sql`
      WITH

      -- ---------------------------------------------------------------------------
      -- 1. PARENT ENTITY TYPES
      -- ---------------------------------------------------------------------------
      parent_entities AS (
        SELECT d.code AS parent_entity_name
        FROM app.d_entity d
        WHERE ${entityName} = ANY(SELECT jsonb_array_elements_text(d.child_entities))
      ),

      -- ---------------------------------------------------------------------------
      -- 2. DIRECT EMPLOYEE PERMISSIONS
      -- ---------------------------------------------------------------------------
      direct_emp AS (
        SELECT entity_id, permission
        FROM app.entity_id_rbac_map
        WHERE person_entity_name = 'employee'
          AND person_entity_id = ${userId}::uuid
          AND entity_name = ${entityName}
          AND entity_id != '11111111-1111-1111-1111-111111111111'::uuid
          AND active_flag = true
          AND (expires_ts IS NULL OR expires_ts > NOW())
      ),

      -- ---------------------------------------------------------------------------
      -- 3. ROLE-BASED PERMISSIONS
      -- ---------------------------------------------------------------------------
      role_based AS (
        SELECT rbac.entity_id, rbac.permission
        FROM app.entity_id_rbac_map rbac
        INNER JOIN app.d_entity_id_map eim
          ON eim.parent_entity_type = 'role'
          AND eim.parent_entity_id = rbac.person_entity_id
          AND eim.child_entity_type = 'employee'
          AND eim.child_entity_id = ${userId}::uuid
          AND eim.active_flag = true
        WHERE rbac.person_entity_name = 'role'
          AND rbac.entity_name = ${entityName}
          AND rbac.entity_id != '11111111-1111-1111-1111-111111111111'::uuid
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
      ),

      -- ---------------------------------------------------------------------------
      -- 4. PARENT ENTITIES WITH VIEW PERMISSION (permission >= 0)
      -- ---------------------------------------------------------------------------
      parents_with_view AS (
        SELECT DISTINCT emp.entity_id AS parent_id, pe.parent_entity_name
        FROM parent_entities pe
        INNER JOIN app.entity_id_rbac_map emp
          ON emp.person_entity_name = 'employee'
          AND emp.person_entity_id = ${userId}::uuid
          AND emp.entity_name = pe.parent_entity_name
          AND emp.permission >= 0
          AND emp.active_flag = true
          AND (emp.expires_ts IS NULL OR emp.expires_ts > NOW())

        UNION

        SELECT DISTINCT rbac.entity_id AS parent_id, pe.parent_entity_name
        FROM parent_entities pe
        INNER JOIN app.entity_id_rbac_map rbac
          ON rbac.person_entity_name = 'role'
          AND rbac.entity_name = pe.parent_entity_name
          AND rbac.permission >= 0
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
        INNER JOIN app.d_entity_id_map eim
          ON eim.parent_entity_type = 'role'
          AND eim.parent_entity_id = rbac.person_entity_id
          AND eim.child_entity_type = 'employee'
          AND eim.child_entity_id = ${userId}::uuid
          AND eim.active_flag = true
      ),

      -- ---------------------------------------------------------------------------
      -- 5. CHILDREN FROM PARENT-VIEW INHERITANCE
      --    If parent has VIEW → all children of that parent gain VIEW
      -- ---------------------------------------------------------------------------
      parent_view_children AS (
        SELECT DISTINCT eim.child_entity_id AS entity_id, 0 AS permission
        FROM parents_with_view pwv
        INNER JOIN app.d_entity_id_map eim
          ON eim.parent_entity_type = pwv.parent_entity_name
          AND eim.parent_entity_id = pwv.parent_id
          AND eim.child_entity_type = ${entityName}
          AND eim.active_flag = true
      ),

      -- ---------------------------------------------------------------------------
      -- 6. PARENT ENTITIES WITH CREATE PERMISSION (permission >= 4)
      -- ---------------------------------------------------------------------------
      parents_with_create AS (
        SELECT DISTINCT emp.entity_id AS parent_id, pe.parent_entity_name
        FROM parent_entities pe
        INNER JOIN app.entity_id_rbac_map emp
          ON emp.person_entity_name = 'employee'
          AND emp.person_entity_id = ${userId}::uuid
          AND emp.entity_name = pe.parent_entity_name
          AND emp.permission >= 4
          AND emp.active_flag = true
          AND (emp.expires_ts IS NULL OR emp.expires_ts > NOW())

        UNION

        SELECT DISTINCT rbac.entity_id AS parent_id, pe.parent_entity_name
        FROM parent_entities pe
        INNER JOIN app.entity_id_rbac_map rbac
          ON rbac.person_entity_name = 'role'
          AND rbac.entity_name = pe.parent_entity_name
          AND rbac.permission >= 4
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
        INNER JOIN app.d_entity_id_map eim
          ON eim.parent_entity_type = 'role'
          AND eim.parent_entity_id = rbac.person_entity_id
          AND eim.child_entity_type = 'employee'
          AND eim.child_entity_id = ${userId}::uuid
          AND eim.active_flag = true
      ),

      -- ---------------------------------------------------------------------------
      -- 7. CHILDREN FROM PARENT-CREATE INHERITANCE
      --    If parent has CREATE → all children of that parent gain CREATE
      -- ---------------------------------------------------------------------------
      parent_create_children AS (
        SELECT DISTINCT eim.child_entity_id AS entity_id, 4 AS permission
        FROM parents_with_create pwc
        INNER JOIN app.d_entity_id_map eim
          ON eim.parent_entity_type = pwc.parent_entity_name
          AND eim.parent_entity_id = pwc.parent_id
          AND eim.child_entity_type = ${entityName}
          AND eim.active_flag = true
      )

      -- ---------------------------------------------------------------------------
      -- FINAL UNION - Combine all permission sources
      -- ---------------------------------------------------------------------------
      SELECT DISTINCT entity_id
      FROM (
        SELECT entity_id, permission FROM direct_emp
        UNION ALL
        SELECT entity_id, permission FROM role_based
        UNION ALL
        SELECT entity_id, permission FROM parent_view_children
        UNION ALL
        SELECT entity_id, permission FROM parent_create_children
      ) AS all_permissions
      WHERE permission >= ${permission}
    `);

    return result.map((row: any) => row.entity_id as string);
  } catch (error) {
    console.error('data_gate_EntityIdsByEntityType error:', error);
    return [];
  }
}

// ============================================================================
// 2. API GATES - Gate API Operations (throws 403 if denied)
// ============================================================================

/**
 * API GATE: Check CREATE permission (throws 403 if denied)
 *
 * Use as middleware for POST endpoints.
 * Checks permission level 4 (create) on type-level.
 *
 * @param userId - Employee UUID
 * @param entityName - Entity type
 * @throws 403 Forbidden if user lacks create permission
 *
 * @example
 * // In route handler:
 * await api_gate_Create(userId, 'project');
 * // If reaches here, user can create projects
 */
export async function api_gate_Create(
  userId: string,
  entityName: string
): Promise<void> {
  const maxLevel = await getMaxPermissionLevelOfEntityID(userId, entityName, '11111111-1111-1111-1111-111111111111');

  if (maxLevel < PermissionLevel.CREATE) {
    throw {
      statusCode: 403,
      error: 'Forbidden',
      message: `Insufficient permissions to create ${entityName}`
    };
  }
}

/**
 * API GATE: Check UPDATE permission (throws 403 if denied)
 *
 * Use as guard for PATCH/PUT endpoints.
 * Checks permission level 1 (edit) on specific entity.
 *
 * @param userId - Employee UUID
 * @param entityName - Entity type
 * @param entityId - Specific entity UUID
 * @throws 403 Forbidden if user lacks edit permission
 *
 * @example
 * // In PATCH /api/v1/project/:id handler:
 * await api_gate_Update(userId, 'project', projectId);
 * // If reaches here, user can update this project
 */
export async function api_gate_Update(
  userId: string,
  entityName: string,
  entityId: string
): Promise<void> {
  const maxLevel = await getMaxPermissionLevelOfEntityID(userId, entityName, entityId);

  if (maxLevel < PermissionLevel.EDIT) {
    throw {
      statusCode: 403,
      error: 'Forbidden',
      message: `Insufficient permissions to update this ${entityName}`
    };
  }
}

/**
 * API GATE: Check DELETE permission (throws 403 if denied)
 *
 * Use as guard for DELETE endpoints.
 * Checks permission level 3 (delete) on specific entity.
 *
 * @param userId - Employee UUID
 * @param entityName - Entity type
 * @param entityId - Specific entity UUID
 * @throws 403 Forbidden if user lacks delete permission
 *
 * @example
 * // In DELETE /api/v1/project/:id handler:
 * await api_gate_Delete(userId, 'project', projectId);
 * // If reaches here, user can delete this project
 */
export async function api_gate_Delete(
  userId: string,
  entityName: string,
  entityId: string
): Promise<void> {
  const maxLevel = await getMaxPermissionLevelOfEntityID(userId, entityName, entityId);

  if (maxLevel < PermissionLevel.DELETE) {
    throw {
      statusCode: 403,
      error: 'Forbidden',
      message: `Insufficient permissions to delete this ${entityName}`
    };
  }
}

