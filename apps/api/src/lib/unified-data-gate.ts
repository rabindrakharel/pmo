/**
 * ============================================================================
 * UNIFIED DATA GATE - RBAC Gate + Parent-Child Entity Filtering Gate
 * ============================================================================
 *
 * This module combines:
 * 1. RBAC_GATE - Permission checking with role inheritance and parent permissions
 * 2. PARENT_CHILD_ENTITY_FILTERING_GATE - Query building with parent→child filtering (create-link-edit pattern)
 *
 * Architecture:
 * - RBAC_GATE determines WHICH entities a person (employee/role) can access (security layer)
 * - PARENT_CHILD_ENTITY_FILTERING_GATE determines HOW to filter those entities (parent context, search, etc.)
 * - Both gates work together for secure, filtered data access
 *
 * Permission Levels (Integer 0-5):
 *   0 = View   - Read access
 *   1 = Edit   - Modify existing (inherits View)
 *   2 = Share  - Share with others (inherits Edit + View)
 *   3 = Delete - Soft delete (inherits Share + Edit + View)
 *   4 = Create - Create new (inherits all lower)
 *   5 = Owner  - Full control (inherits all)
 */

import { sql, SQL } from 'drizzle-orm';
import { db } from '@/db/index.js';

// ============================================================================
// PERMISSION LEVELS
// ============================================================================

export enum Permission {
  VIEW = 0,
  EDIT = 1,
  SHARE = 2,
  DELETE = 3,
  CREATE = 4,
  OWNER = 5
}

export enum PermissionLevel {
  VIEW = 0,
  EDIT = 1,
  SHARE = 2,
  DELETE = 3,
  CREATE = 4,
  OWNER = 5,
}

/**
 * Special UUID marker for TYPE-LEVEL permissions (all entities)
 * When this UUID is used as entity_id in entity_id_rbac_map, it means the permission
 * applies to ALL instances of that entity type, not just one specific instance.
 *
 * Example: permission on (entity_name='project', entity_id=ALL_ENTITIES_ID)
 *          → User can perform action on ANY/ALL projects
 */
export const ALL_ENTITIES_ID = '11111111-1111-1111-1111-111111111111';

// ============================================================================
// ============================================================================
// RBAC_GATE - Permission Checking with Role Inheritance
// ============================================================================
// ============================================================================

/**
 * Internal: Get max permission level for user on entity
 *
 * Includes parent entity inheritance:
 * - If employee or role has  VIEW (0+) permission  on the child entity's any of the parent then → child gains VIEW
 * - If employee or role has  CREATE (4+) permission  on the child entity's any of the parent then  → child gains CREATE
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

// ============================================================================
// ============================================================================
// PARENT_CHILD_ENTITY_FILTERING_GATE - Query Augmentation (not building)
// ============================================================================
// ============================================================================

/**
 * ============================================================================
 * UNIFIED DATA GATE - Query Augmentation Architecture
 * ============================================================================
 *
 * Philosophy: Entity routes OWN their SQL queries. Gates AUGMENT them.
 *
 * Each entity endpoint builds its own SQL (SELECT, FROM, JOINs, columns, etc.).
 * The gates add security/filtering layers:
 *
 * 1. RBAC_GATE - Adds WHERE condition for accessible entity IDs
 * 2. PARENT_CHILD_FILTERING_GATE - Adds INNER JOIN on d_entity_id_map
 *
 * Example Usage:
 *
 * // Step 1: Entity route builds base query
 * let baseQuery = sql`
 *   SELECT e.*, b.name as business_name
 *   FROM app.d_project e
 *   LEFT JOIN app.d_business b ON e.business_id = b.id
 * `;
 *
 * // Step 2: Apply RBAC gate (security - REQUIRED)
 * const rbacFilter = await unified_data_gate.rbac_gate.getWhereCondition(
 *   userId, 'project', Permission.VIEW
 * );
 *
 * // Step 3: Apply parent-child filtering gate (optional)
 * const parentJoin = parent_type && parent_id
 *   ? unified_data_gate.parent_child_filtering_gate.getJoinClause(
 *       'project', parent_type, parent_id
 *     )
 *   : null;
 *
 * // Step 4: Compose final query
 * const query = sql`
 *   SELECT e.*, b.name as business_name
 *   FROM app.d_project e
 *   LEFT JOIN app.d_business b ON e.business_id = b.id
 *   ${parentJoin || sql``}
 *   WHERE ${rbacFilter}
 *   ORDER BY e.created_ts DESC
 * `;
 */
export const unified_data_gate = {
  // ============================================================================
  // RBAC_GATE - Returns WHERE condition for RBAC filtering
  // ============================================================================
  rbac_gate: {
    /**
     * Get entity IDs user can access (RBAC filtering only)
     * Use this for custom queries where you need just the ID list
     */
    getFilteredIds: data_gate_EntityIdsByEntityType,

    /**
     * Get WHERE condition for RBAC filtering
     * This is the PRIMARY method for applying RBAC to queries
     *
     * @returns SQL condition to add to WHERE clause (or null if full access)
     *
     * @example
     * const rbacCondition = await unified_data_gate.rbac_gate.getWhereCondition(
     *   userId, 'project', Permission.VIEW
     * );
     *
     * const query = sql`
     *   SELECT * FROM app.d_project e
     *   WHERE ${rbacCondition}
     * `;
     */
    getWhereCondition: async (
      userId: string,
      entityType: string,
      requiredPermission: number = Permission.VIEW,
      tableAlias: string = 'e'
    ): Promise<SQL> => {
      const accessibleIds = await data_gate_EntityIdsByEntityType(userId, entityType, requiredPermission);

      // No access at all - return FALSE condition
      if (accessibleIds.length === 0) {
        return sql`FALSE`;
      }

      // Type-level access - no filtering needed, return TRUE
      const hasTypeLevelAccess = accessibleIds.includes('11111111-1111-1111-1111-111111111111');
      if (hasTypeLevelAccess) {
        return sql`TRUE`;
      }

      // Filter by accessible IDs
      return sql`${sql.raw(tableAlias)}.id = ANY(${accessibleIds}::uuid[])`;
    },

    /**
     * Check if user has specific permission on entity (returns boolean)
     * Use this for conditional logic without throwing errors
     */
    checkPermission: async (
      db: any,
      userId: string,
      entityType: string,
      entityId: string | 'all',
      requiredPermission: number
    ): Promise<boolean> => {
      const checkId = entityId === 'all' ? '11111111-1111-1111-1111-111111111111' : entityId;
      const accessibleIds = await data_gate_EntityIdsByEntityType(userId, entityType, requiredPermission);
      if (accessibleIds.length === 0) return false;
      return accessibleIds.includes('11111111-1111-1111-1111-111111111111') || accessibleIds.includes(checkId);
    },

    /**
     * Gate API operations (throws 403 if denied)
     * Use these in route handlers for CREATE/UPDATE/DELETE operations
     */
    gate: {
      create: api_gate_Create,
      update: api_gate_Update,
      delete: api_gate_Delete,
    },

    /**
     * LEGACY: Build custom query with RBAC filtering applied
     * @deprecated Use getWhereCondition() instead for better composability
     */
    applyToQuery: async (
      userId: string,
      entityType: string,
      requiredPermission: number = Permission.VIEW
    ): Promise<{
      hasTypeLevelAccess: boolean;
      accessibleIds: string[];
      sqlCondition: SQL | null;
    }> => {
      const accessibleIds = await data_gate_EntityIdsByEntityType(userId, entityType, requiredPermission);

      if (accessibleIds.length === 0) {
        return {
          hasTypeLevelAccess: false,
          accessibleIds: [],
          sqlCondition: sql`FALSE`,
        };
      }

      const hasTypeLevelAccess = accessibleIds.includes('11111111-1111-1111-1111-111111111111');

      return {
        hasTypeLevelAccess,
        accessibleIds,
        sqlCondition: hasTypeLevelAccess
          ? null
          : sql`id = ANY(${accessibleIds}::uuid[])`,
      };
    },
  },

  // ============================================================================
  // PARENT_CHILD_FILTERING_GATE - Returns JOIN clause for parent filtering
  // ============================================================================
  parent_child_filtering_gate: {
    /**
     * Get JOIN clause for parent-child filtering
     * This is the PRIMARY method for applying parent context filtering
     *
     * @returns SQL JOIN clause to add to query
     *
     * @example
     * const parentJoin = unified_data_gate.parent_child_filtering_gate.getJoinClause(
     *   'project', 'business', businessId, 'e'
     * );
     *
     * const query = sql`
     *   SELECT * FROM app.d_project e
     *   ${parentJoin}
     *   WHERE ...
     * `;
     */
    getJoinClause: (
      childEntityType: string,
      parentEntityType: string,
      parentEntityId: string,
      tableAlias: string = 'e'
    ): SQL => {
      return sql`
        INNER JOIN app.d_entity_id_map eim ON (
          eim.child_entity_id = ${sql.raw(tableAlias)}.id
          AND eim.parent_entity_type = ${parentEntityType}
          AND eim.parent_entity_id = ${parentEntityId}::uuid
          AND eim.child_entity_type = ${childEntityType}
          AND eim.active_flag = true
        )
      `;
    },

    /**
     * LEGACY: Get filtered entities with RBAC_GATE + optional parent/search/pagination
     * @deprecated Use getJoinClause() + rbac_gate.getWhereCondition() for better composability
     */
    getFilteredEntities: async <T = any>(
      db: any,
      context: FilterContext
    ): Promise<QueryResult<T>> => {
      return buildEntityQuery(db, context);
    },
  },
};

/**
 * Filter context for unified data gate
 */
export interface FilterContext {
  // Security (REQUIRED)
  userId: string;                    // Current user's employee ID
  entityType: string;                // e.g., 'business', 'project', 'task'
  requiredPermission?: number;       // 0=view, 1=edit, 2=share, 3=delete, 4=create

  // Parent filtering (OPTIONAL - create-link-edit pattern)
  parentType?: string;               // e.g., 'office', 'business', 'project'
  parentId?: string;                 // Parent entity UUID

  // Standard filters (OPTIONAL)
  activeOnly?: boolean;              // Filter to active_flag = true
  searchTerm?: string;               // Full-text search
  additionalConditions?: SQL[];      // Custom WHERE conditions

  // Pagination (OPTIONAL)
  limit?: number;
  offset?: number;
  page?: number;
}

/**
 * Query result with metadata
 */
export interface QueryResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  appliedFilters: {
    rbac: boolean;
    parent: boolean;
    search: boolean;
    active: boolean;
  };
}

/**
 * Unified Data Gate Builder
 *
 * Combines RBAC filtering + parent filtering + additional filters
 * into a single, reusable query builder.
 *
 * Uses rbac.service.ts for proper permission checking that includes:
 * - Direct employee permissions
 * - Role-based permissions
 * - Parent-VIEW inheritance (if parent has VIEW, children gain VIEW)
 * - Parent-CREATE inheritance (if parent has CREATE, children gain CREATE)
 *
 * @example
 * // Get all projects user can view
 * const result = await buildEntityQuery(db, {
 *   userId: 'user-123',
 *   entityType: 'project'
 * });
 *
 * @example
 * // Get projects in business (if user has permission)
 * const result = await buildEntityQuery(db, {
 *   userId: 'user-123',
 *   entityType: 'project',
 *   parentType: 'business',
 *   parentId: 'business-id'
 * });
 */
export async function buildEntityQuery<T = any>(
  db: any,
  context: FilterContext
): Promise<QueryResult<T>> {

  const {
    userId,
    entityType,
    requiredPermission = Permission.VIEW,
    parentType,
    parentId,
    activeOnly,
    searchTerm,
    additionalConditions = [],
    limit = 50,
    offset: providedOffset,
    page
  } = context;

  // Calculate offset from page or use provided
  const offset = page ? (page - 1) * limit : (providedOffset || 0);

  // Track which filters are applied (for debugging/logging)
  const appliedFilters = {
    rbac: true,        // Always applied
    parent: Boolean(parentType && parentId),
    search: Boolean(searchTerm),
    active: Boolean(activeOnly)
  };

  // ============================================================================
  // 1. RBAC GATE - Get accessible entity IDs (Security First)
  // ============================================================================
  // Uses rbac.service.ts which handles:
  // - Direct permissions (employee)
  // - Role-based permissions (employee -> role -> permissions)
  // - Parent inheritance (if parent has VIEW/CREATE, children gain access)

  const accessibleIds = await data_gate_EntityIdsByEntityType(userId, entityType, requiredPermission);

  // If user has no access at all, return empty result immediately
  if (accessibleIds.length === 0) {
    return {
      data: [] as T[],
      total: 0,
      limit,
      offset,
      appliedFilters
    };
  }

  // Check if user has type-level access (special marker UUID)
  const hasTypeLevelAccess = accessibleIds.includes('11111111-1111-1111-1111-111111111111');

  // ============================================================================
  // 2. BUILD JOINS
  // ============================================================================

  const joins: SQL[] = [];

  // Parent Filter JOIN (OPTIONAL - Create-Link-Edit Pattern)
  // Only applied when filtering by parent entity
  if (parentType && parentId) {
    joins.push(sql`
      INNER JOIN app.d_entity_id_map eim ON (
        eim.child_entity_id = e.id
        AND eim.parent_entity_type = ${parentType}
        AND eim.parent_entity_id = ${parentId}::uuid
        AND eim.child_entity_type = ${entityType}
        AND eim.active_flag = true
      )
    `);
  }

  // ============================================================================
  // 3. BUILD WHERE CONDITIONS
  // ============================================================================

  const conditions: SQL[] = [];

  // RBAC Condition (ALWAYS APPLIED)
  // If user doesn't have type-level access, filter by accessible IDs
  if (!hasTypeLevelAccess) {
    conditions.push(sql`e.id = ANY(${accessibleIds}::uuid[])`);
  }

  // Active flag filter (OPTIONAL)
  if (activeOnly) {
    conditions.push(sql`e.active_flag = true`);
  }

  // Search filter (OPTIONAL)
  // Searches across common fields: name, code, descr
  if (searchTerm) {
    const searchPattern = `%${searchTerm}%`;
    conditions.push(sql`(
      COALESCE(e.name, '') ILIKE ${searchPattern} OR
      COALESCE(e.code, '') ILIKE ${searchPattern} OR
      COALESCE(e."descr", '') ILIKE ${searchPattern}
    )`);
  }

  // Additional custom conditions (OPTIONAL)
  conditions.push(...additionalConditions);

  // ============================================================================
  // 4. EXECUTE QUERIES (Count + Data in parallel)
  // ============================================================================

  const joinClause = joins.length > 0 ? sql.join(joins, sql` `) : sql``;
  const whereClause = conditions.length > 0
    ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
    : sql``;

  // Count query
  const countQuery = sql`
    SELECT COUNT(DISTINCT e.id) as total
    FROM app.d_${sql.raw(entityType)} e
    ${joinClause}
    ${whereClause}
  `;

  // Data query
  const dataQuery = sql`
    SELECT DISTINCT e.*
    FROM app.d_${sql.raw(entityType)} e
    ${joinClause}
    ${whereClause}
    ORDER BY e.created_ts DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  // Execute in parallel
  const [countResult, dataResult] = await Promise.all([
    db.execute(countQuery),
    db.execute(dataQuery)
  ]);

  const total = Number(countResult[0]?.total || 0);

  return {
    data: dataResult as T[],
    total,
    limit,
    offset,
    appliedFilters
  };
}

/**
 * Helper: Check if user has specific permission on entity
 *
 * Uses rbac.service.ts for proper permission checking.
 *
 * @param db - Database instance (not used, kept for compatibility)
 * @param userId - Employee UUID
 * @param entityType - Entity type (project, task, etc.)
 * @param entityId - Specific entity UUID or 'all' for type-level check
 * @param requiredPermission - Required permission level (0-5)
 * @returns boolean - True if user has permission
 */
export async function checkEntityPermission(
  db: any,
  userId: string,
  entityType: string,
  entityId: string | 'all',
  requiredPermission: number
): Promise<boolean> {
  // For type-level check (create permission), use special UUID
  const checkId = entityId === 'all' ? '11111111-1111-1111-1111-111111111111' : entityId;

  // Get accessible entity IDs from RBAC service
  const accessibleIds = await data_gate_EntityIdsByEntityType(userId, entityType, requiredPermission);

  // If no access at all
  if (accessibleIds.length === 0) {
    return false;
  }

  // Check if user has type-level access or specific entity access
  return accessibleIds.includes('11111111-1111-1111-1111-111111111111') || accessibleIds.includes(checkId);
}
