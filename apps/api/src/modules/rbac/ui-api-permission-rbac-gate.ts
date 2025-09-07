
/**
 * Entity-Based RBAC System
 * 
 * This module provides a comprehensive, employee-focused RBAC system based on the new
 * entity-action permission model. Uses rel_employee_entity_action_rbac table for
 * fine-grained permissions on specific entity instances.
 * 
 * Architecture Overview:
 * 1. Entity-specific Permission Functions (Biz, HR, Org, Client, Project, Task, etc.)
 * 2. Action-based Permission Checking (create, view, edit, share)
 * 3. Bulk Permission Retrieval Functions (All entities of a type accessible to employee)
 * 
 * Entity Types:
 * - Organizational: biz, hr, org, client
 * - Operational: project, task, worksite
 * - Personnel: employee, role  
 * - Content: wiki, form, artifact
 */

import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

/**
 * Permission actions as defined in rel_employee_entity_action_rbac.permission_action
 */
export enum PermissionAction {
  CREATE = 'create',
  VIEW = 'view', 
  EDIT = 'edit',
  SHARE = 'share',
}

/**
 * Standard entity action mappings for consistent permission checking
 */
export type EntityAction = 'create' | 'view' | 'edit' | 'share' | 'modify' | 'delete';

/**
 * Map legacy actions to new permission system
 */
const mapActionToPermission = (action: EntityAction): PermissionAction => {
  switch (action) {
    case 'modify':
    case 'edit':
      return PermissionAction.EDIT;
    case 'delete':
      return PermissionAction.EDIT; // Delete requires edit permission
    case 'create':
      return PermissionAction.CREATE;
    case 'share':
      return PermissionAction.SHARE;
    case 'view':
    default:
      return PermissionAction.VIEW;
  }
};

/**
 * 🔐 ENTITY-BASED PERMISSION FUNCTIONS
 * Core functions for checking permissions on specific entity instances
 */

/**
 * Check if employee has permission on a specific entity instance
 * 
 * @param employeeId - The employee's unique identifier
 * @param entityType - The entity type (biz, project, task, etc.)
 * @param entityId - The specific entity instance UUID
 * @param action - The action being attempted
 * @returns Promise<boolean> - True if employee has the required permission
 */
export async function hasPermissionOnEntityId(
  employeeId: string,
  entityType: string,
  entityId: string,
  action: EntityAction
): Promise<boolean> {
  if (!employeeId || !entityId) {
    return false;
  }

  const permissionAction = mapActionToPermission(action);
  
  try {
    const result = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM app.rel_employee_entity_action_rbac 
      WHERE employee_id = ${employeeId} 
        AND action_entity = ${entityType} 
        AND action_entity_id = ${entityId}
        AND permission_action = ${permissionAction}
        AND active = true
        AND emergency_revoked = false
        AND (expiry_date IS NULL OR expiry_date > NOW())
        AND (to_ts IS NULL OR to_ts > NOW())
    `);
    
    return Number(result[0]?.count || 0) > 0;
    
  } catch (error) {
    console.error('Error checking permission on entity:', error);
    return false;
  }
}

/**
 * Get all entity IDs of a specific type that the employee has permission to access
 * 
 * @param employeeId - The employee's unique identifier
 * @param entityType - The entity type (biz, project, task, etc.)
 * @param action - The minimum action required (defaults to 'view')
 * @returns Promise<string[]> - Array of entity IDs the employee can access
 */
export async function getEmployeeEntityIds(
  employeeId: string,
  entityType: string,
  action: EntityAction = 'view'
): Promise<string[]> {
  if (!employeeId) {
    return [];
  }

  const permissionAction = mapActionToPermission(action);
  
  try {
    const result = await db.execute(sql`
      SELECT DISTINCT action_entity_id
      FROM app.rel_employee_entity_action_rbac 
      WHERE employee_id = ${employeeId} 
        AND action_entity = ${entityType}
        AND permission_action = ${permissionAction}
        AND active = true
        AND emergency_revoked = false
        AND (expiry_date IS NULL OR expiry_date > NOW())
        AND (to_ts IS NULL OR to_ts > NOW())
      ORDER BY action_entity_id
    `);
    
    return result.map(row => row.action_entity_id as string).filter(Boolean);
    
  } catch (error) {
    console.error('Error getting employee entity access:', error);
    return [];
  }
}

/**
 * Check if employee can create entities within a parent entity
 * 
 * @param employeeId - The employee's unique identifier
 * @param parentEntityType - The parent entity type (biz, project, etc.)
 * @param parentEntityId - The parent entity instance UUID
 * @param targetEntityType - The type of entity to create (task, wiki, etc.)
 * @returns Promise<boolean> - True if employee can create the target entity type within the parent
 */
export async function hasCreatePermissionInEntity(
  employeeId: string,
  parentEntityType: string,
  parentEntityId: string,
  targetEntityType: string
): Promise<boolean> {
  if (!employeeId || !parentEntityId) {
    return false;
  }
  
  try {
    // Check if employee has create permission in the parent scope for the target entity type
    const result = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM app.rel_employee_entity_action_rbac 
      WHERE employee_id = ${employeeId} 
        AND parent_entity = ${parentEntityType}
        AND parent_entity_id = ${parentEntityId}
        AND action_entity = ${targetEntityType}
        AND permission_action = ${PermissionAction.CREATE}
        AND active = true
        AND emergency_revoked = false
        AND (expiry_date IS NULL OR expiry_date > NOW())
        AND (to_ts IS NULL OR to_ts > NOW())
    `);
    
    return Number(result[0]?.count || 0) > 0;
    
  } catch (error) {
    console.error('Error checking create permission in scope:', error);
    return false;
  }
}

/**
 * Get all entities that can be created within a parent entity
 * 
 * @param employeeId - The employee's unique identifier
 * @param parentEntityType - The parent entity type
 * @param parentEntityId - The parent entity instance UUID
 * @returns Promise<string[]> - Array of entity types that can be created
 */
export async function getCreatableEntityTypes(
  employeeId: string,
  parentEntityType: string,
  parentEntityId: string
): Promise<string[]> {
  if (!employeeId || !parentEntityId) {
    return [];
  }
  
  try {
    const result = await db.execute(sql`
      SELECT DISTINCT action_entity
      FROM app.rel_employee_entity_action_rbac 
      WHERE employee_id = ${employeeId} 
        AND parent_entity = ${parentEntityType}
        AND parent_entity_id = ${parentEntityId}
        AND permission_action = ${PermissionAction.CREATE}
        AND active = true
        AND emergency_revoked = false
        AND (expiry_date IS NULL OR expiry_date > NOW())
        AND (to_ts IS NULL OR to_ts > NOW())
      ORDER BY action_entity
    `);
    
    return result.map(row => row.action_entity as string).filter(Boolean);
    
  } catch (error) {
    console.error('Error getting creatable entity types:', error);
    return [];
  }
}

/**
 * Get comprehensive permissions summary for an employee on a specific entity type
 * 
 * @param employeeId - The employee's unique identifier
 * @param entityType - The entity type to check
 * @returns Promise<{ entityId: string, permissions: string[] }[]> - Array of entities with their permissions
 */
export async function getEmployeeEntityPermissions(
  employeeId: string,
  entityType: string
): Promise<{ entityId: string, permissions: string[] }[]> {
  if (!employeeId) {
    return [];
  }
  
  try {
    const result = await db.execute(sql`
      SELECT 
        action_entity_id,
        array_agg(DISTINCT permission_action) as permissions
      FROM app.rel_employee_entity_action_rbac 
      WHERE employee_id = ${employeeId} 
        AND action_entity = ${entityType}
        AND active = true
        AND emergency_revoked = false
        AND (expiry_date IS NULL OR expiry_date > NOW())
        AND (to_ts IS NULL OR to_ts > NOW())
      GROUP BY action_entity_id
      ORDER BY action_entity_id
    `);
    
    return result.map(row => ({
      entityId: row.action_entity_id as string,
      permissions: (Array.isArray(row.permissions) ? row.permissions : []) as string[],
    }));
    
  } catch (error) {
    console.error('Error getting employee entity permissions:', error);
    return [];
  }
}

/**
 * Legacy compatibility functions - maintaining same interface for existing code
 */

// Maintain backward compatibility for existing API calls
export type ScopeAction = EntityAction;

// For backward compatibility with existing project routes
export const hasPermissionOnScopeId = hasPermissionOnEntityId;
export const getEmployeeScopeIds = getEmployeeEntityIds;
export const hasCreatePermissionInScope = hasCreatePermissionInEntity;