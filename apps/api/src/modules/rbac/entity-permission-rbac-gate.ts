/**
 * New Entity-Based RBAC System using entity_id_rbac_map
 *
 * Uses simplified permission arrays instead of complex multi-table relationships
 * Permission Levels: 0=View, 1=Edit, 2=Share, 3=Delete, 4=Create
 */

import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

/**
 * Permission levels as integers in the permission array
 */
export enum PermissionLevel {
  VIEW = 0,
  EDIT = 1,
  SHARE = 2,
  DELETE = 3,
  CREATE = 4,
}

/**
 * Standard entity action mappings for consistent permission checking
 */
export type EntityAction = 'create' | 'view' | 'edit' | 'share' | 'modify' | 'delete';

/**
 * Map legacy actions to new permission levels
 */
const mapActionToPermissionLevel = (action: EntityAction): PermissionLevel => {
  switch (action) {
    case 'view':
      return PermissionLevel.VIEW;
    case 'modify':
    case 'edit':
      return PermissionLevel.EDIT;
    case 'share':
      return PermissionLevel.SHARE;
    case 'delete':
      return PermissionLevel.DELETE;
    case 'create':
      return PermissionLevel.CREATE;
    default:
      return PermissionLevel.VIEW;
  }
};

/**
 * Check if an employee has a specific permission on an entity instance
 *
 * @param employeeId - UUID of the employee
 * @param entityType - Type of entity (project, task, etc.)
 * @param entityId - Specific entity UUID or 'all' for type-level permissions
 * @param action - Permission action to check
 * @returns Promise<boolean> - Whether permission is granted
 */
export async function hasPermissionOnEntityId(
  employeeId: string,
  entityType: string,
  entityId: string,
  action: EntityAction
): Promise<boolean> {
  try {
    const requiredPermission = mapActionToPermissionLevel(action);

    // Check both specific entity permission and 'all' type permission
    // Note: entity_id is varchar, so we ensure string comparison
    const result = await db.execute(sql`
      SELECT permission
      FROM app.entity_id_rbac_map
      WHERE empid = ${employeeId}::uuid
        AND entity = ${entityType}
        AND (entity_id = ${entityId} OR entity_id = 'all')
        AND active_flag = true
      ORDER BY
        CASE WHEN entity_id = ${entityId} THEN 1 ELSE 2 END,
        created_ts DESC
      LIMIT 1
    `);

    if (result.length === 0) {
      return false;
    }

    const permissions = result[0].permission as number[];
    return permissions.includes(requiredPermission);
  } catch (error) {
    console.error('Error checking entity permission:', error);
    return false;
  }
}

/**
 * Get all entity IDs of a specific type that an employee has access to
 *
 * @param employeeId - UUID of the employee
 * @param entityType - Type of entity (project, task, etc.)
 * @param action - Permission action to filter by (default: view)
 * @returns Promise<string[]> - Array of entity UUIDs the employee can access
 */
export async function getEmployeeEntityIds(
  employeeId: string,
  entityType: string,
  action: EntityAction = 'view'
): Promise<string[]> {
  try {
    const requiredPermission = mapActionToPermissionLevel(action);

    const result = await db.execute(sql`
      SELECT DISTINCT entity_id
      FROM app.entity_id_rbac_map
      WHERE empid = ${employeeId}::uuid
        AND entity = ${entityType}
        AND entity_id != 'all'
        AND active_flag = true
        AND ${requiredPermission} = ANY(permission)
    `);

    // Also check if user has 'all' permission for this entity type
    const allPermissionResult = await db.execute(sql`
      SELECT permission
      FROM app.entity_id_rbac_map
      WHERE empid = ${employeeId}::uuid
        AND entity = ${entityType}
        AND entity_id = 'all'
        AND active_flag = true
      ORDER BY created_ts DESC
      LIMIT 1
    `);

    if (allPermissionResult.length > 0) {
      const permissions = allPermissionResult[0].permission as number[];
      if (permissions.includes(requiredPermission)) {
        // If user has 'all' permission, get all entity IDs of this type
        // This would require additional logic to fetch all entities from the appropriate table
        // For now, we'll return the specific entity IDs they have explicit access to
      }
    }

    return result.map(row => row.entity_id as string);
  } catch (error) {
    console.error('Error getting employee entity IDs:', error);
    return [];
  }
}

/**
 * Check if an employee has CREATE permission for an entity type
 *
 * @param employeeId - UUID of the employee
 * @param entityType - Type of entity (project, task, etc.)
 * @returns Promise<boolean> - Whether create permission is granted
 */
export async function hasCreatePermissionForEntityType(
  employeeId: string,
  entityType: string
): Promise<boolean> {
  return hasPermissionOnEntityId(employeeId, entityType, 'all', 'create');
}

/**
 * Get all permissions an employee has for a specific entity
 *
 * @param employeeId - UUID of the employee
 * @param entityType - Type of entity
 * @param entityId - Specific entity UUID
 * @returns Promise<PermissionLevel[]> - Array of permission levels
 */
export async function getEmployeeEntityPermissions(
  employeeId: string,
  entityType: string,
  entityId: string
): Promise<PermissionLevel[]> {
  try {
    const result = await db.execute(sql`
      SELECT permission
      FROM app.entity_id_rbac_map
      WHERE empid = ${employeeId}::uuid
        AND entity = ${entityType}
        AND (entity_id = ${entityId} OR entity_id = 'all')
        AND active_flag = true
      ORDER BY
        CASE WHEN entity_id = ${entityId} THEN 1 ELSE 2 END,
        created_ts DESC
      LIMIT 1
    `);

    if (result.length === 0) {
      return [];
    }

    return result[0].permission as PermissionLevel[];
  } catch (error) {
    console.error('Error getting employee entity permissions:', error);
    return [];
  }
}

/**
 * Grant permission to an employee for an entity
 *
 * @param employeeId - UUID of the employee
 * @param entityType - Type of entity
 * @param entityId - Specific entity UUID or 'all'
 * @param permissions - Array of permission levels to grant
 * @returns Promise<boolean> - Whether the permission was granted successfully
 */
export async function grantPermission(
  employeeId: string,
  entityType: string,
  entityId: string,
  permissions: PermissionLevel[]
): Promise<boolean> {
  try {
    await db.execute(sql`
      INSERT INTO app.entity_id_rbac_map (
        empid, entity, entity_id, permission
      ) VALUES (
        ${employeeId}, ${entityType}, ${entityId}, ${JSON.stringify(permissions)}
      )
      ON CONFLICT (empid, entity, entity_id)
      DO UPDATE SET
        permission = ${JSON.stringify(permissions)},
        updated_ts = NOW()
    `);

    return true;
  } catch (error) {
    console.error('Error granting permission:', error);
    return false;
  }
}

/**
 * Revoke permission from an employee for an entity
 *
 * @param employeeId - UUID of the employee
 * @param entityType - Type of entity
 * @param entityId - Specific entity UUID
 * @returns Promise<boolean> - Whether the permission was revoked successfully
 */
export async function revokePermission(
  employeeId: string,
  entityType: string,
  entityId: string
): Promise<boolean> {
  try {
    await db.execute(sql`
      UPDATE app.entity_id_rbac_map
      SET active_flag = false, updated_ts = NOW()
      WHERE empid = ${employeeId}::uuid
        AND entity = ${entityType}
        AND entity_id = ${entityId}
        AND active_flag = true
    `);

    return true;
  } catch (error) {
    console.error('Error revoking permission:', error);
    return false;
  }
}

/**
 * Check if user can assign a project to a business
 * Requires: 1) CREATE permission on project 'all' AND 2) EDIT permission on specific business
 *
 * @param employeeId - UUID of the employee
 * @param businessId - UUID of the specific business
 * @returns Promise<boolean> - Whether assignment is allowed
 */
export async function canAssignProjectToBusiness(
  employeeId: string,
  businessId: string
): Promise<boolean> {
  try {
    // Condition 1: Can create projects (entity='project', entity_id='all', permission contains 4)
    const canCreateProjects = await hasCreatePermissionForEntityType(employeeId, 'project');

    if (!canCreateProjects) {
      return false;
    }

    // Condition 2: Can edit the specific business (entity='biz', entity_id=businessId, permission contains 1)
    const canEditBusiness = await hasPermissionOnEntityId(employeeId, 'biz', businessId, 'edit');

    return canEditBusiness;
  } catch (error) {
    console.error('Error checking project-business assignment permission:', error);
    return false;
  }
}

/**
 * Get all entities of a specific type that user has specific permissions for
 * Used for main page action buttons (Share, Delete) and bulk operations
 *
 * @param employeeId - UUID of the employee
 * @param entityType - Type of entity
 * @param action - Permission action required
 * @returns Promise<string[]> - Array of entity IDs user can perform action on
 */
export async function getEntitiesUserCanActOn(
  employeeId: string,
  entityType: string,
  action: EntityAction
): Promise<string[]> {
  try {
    const requiredPermission = mapActionToPermissionLevel(action);

    // Get all specific entity permissions
    const result = await db.execute(sql`
      SELECT DISTINCT entity_id
      FROM app.entity_id_rbac_map
      WHERE empid = ${employeeId}::uuid
        AND entity = ${entityType}
        AND entity_id != 'all'
        AND active_flag = true
        AND ${requiredPermission} = ANY(permission)
    `);

    const specificEntityIds = result.map(row => row.entity_id as string);

    // Check if user has 'all' permission for this action
    const hasAllPermission = await hasPermissionOnEntityId(employeeId, entityType, 'all', action);

    if (hasAllPermission) {
      // User can act on all entities of this type
      // Return a special indicator or fetch all entity IDs from the respective table
      // For now, return the specific ones plus an 'all' indicator
      return ['all', ...specificEntityIds];
    }

    return specificEntityIds;
  } catch (error) {
    console.error('Error getting entities user can act on:', error);
    return [];
  }
}

/**
 * Check if user has permission to navigate to child entity
 * Used when clicking child entity rows to navigate to child detail pages
 *
 * @param employeeId - UUID of the employee
 * @param childEntityType - Type of child entity
 * @param childEntityId - UUID of child entity
 * @returns Promise<boolean> - Whether navigation is allowed
 */
export async function canNavigateToChildEntity(
  employeeId: string,
  childEntityType: string,
  childEntityId: string
): Promise<boolean> {
  // At minimum, user needs VIEW permission on the child entity
  return hasPermissionOnEntityId(employeeId, childEntityType, childEntityId, 'view');
}

/**
 * Get user's permissions summary for main page action buttons
 * Returns what actions user can perform on this entity type
 *
 * @param employeeId - UUID of the employee
 * @param entityType - Type of entity
 * @returns Promise<object> - Summary of available actions
 */
export async function getMainPageActionPermissions(
  employeeId: string,
  entityType: string
): Promise<{
  canCreate: boolean;
  canShare: boolean;
  canDelete: boolean;
  canBulkShare: boolean;
  canBulkDelete: boolean;
}> {
  try {
    const [canCreate, shareableEntities, deletableEntities] = await Promise.all([
      hasCreatePermissionForEntityType(employeeId, entityType),
      getEntitiesUserCanActOn(employeeId, entityType, 'share'),
      getEntitiesUserCanActOn(employeeId, entityType, 'delete')
    ]);

    return {
      canCreate,
      canShare: shareableEntities.length > 0,
      canDelete: deletableEntities.length > 0,
      canBulkShare: shareableEntities.includes('all'),
      canBulkDelete: deletableEntities.includes('all')
    };
  } catch (error) {
    console.error('Error getting main page action permissions:', error);
    return {
      canCreate: false,
      canShare: false,
      canDelete: false,
      canBulkShare: false,
      canBulkDelete: false
    };
  }
}