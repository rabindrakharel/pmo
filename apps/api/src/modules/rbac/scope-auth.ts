/**
 * RBAC Scope-based Authentication Utilities
 * Provides functions to check user permissions against rel_employee_scope_unified table
 */

import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

/**
 * Permission levels as defined in rel_employee_scope_unified.resource_permission
 * 0: view, 1: modify, 2: share, 3: delete, 4: create
 */
export enum Permission {
  VIEW = 0,
  MODIFY = 1, 
  SHARE = 2,
  DELETE = 3,
  CREATE = 4,
}

export interface ScopeAccess {
  allowed: boolean;
  scopeIds: string[];
  permissions: Permission[];
}

/**
 * Check if user has access to specific scope type and action
 */
export async function checkScopeAccess(
  userId: string,
  scopeType: string,
  action: 'view' | 'modify' | 'share' | 'delete' | 'create',
  specificScopeTableReferenceId?: string
): Promise<ScopeAccess> {
  
  if (!userId) {
    return { allowed: false, scopeIds: [], permissions: [] };
  }

  // Map action to permission level
  const actionToPermission: Record<string, Permission> = {
    view: Permission.VIEW,
    modify: Permission.MODIFY,
    share: Permission.SHARE,
    delete: Permission.DELETE,
    create: Permission.CREATE,
  };

  const requiredPermission = actionToPermission[action];
  
  if (requiredPermission === undefined) {
    return { allowed: false, scopeIds: [], permissions: [] };
  }
  
  // For development mode with OIDC bypass, allow all access
  if (process.env.DEV_BYPASS_OIDC === 'true') {
    return { 
      allowed: true, 
      scopeIds: specificScopeTableReferenceId ? [specificScopeTableReferenceId] : [], 
      permissions: [0, 1, 2, 3, 4] 
    };
  }
  
  try {
    // Query the database for user permissions using new structure
    let query = sql`
      SELECT scope_table_reference_id, resource_permission
      FROM app.rel_employee_scope_unified 
      WHERE emp_id = ${userId} 
        AND scope_type = ${scopeType} 
        AND active = true
    `;

    if (specificScopeTableReferenceId) {
      query = sql`
        SELECT scope_table_reference_id, resource_permission
        FROM app.rel_employee_scope_unified 
        WHERE emp_id = ${userId} 
          AND scope_type = ${scopeType} 
          AND scope_table_reference_id = ${specificScopeTableReferenceId}
          AND active = true
      `;
    }

    const permissions = await db.execute(query);
    
    if (permissions.length === 0) {
      return { allowed: false, scopeIds: [], permissions: [] };
    }

    // Check if user has the required permission
    const hasPermission = permissions.some(perm => {
      const resourcePermission = perm.resource_permission as number[] | null;
      return resourcePermission && Array.isArray(resourcePermission) && resourcePermission.includes(requiredPermission);
    });

    if (!hasPermission) {
      return { allowed: false, scopeIds: [], permissions: [] };
    }

    const scopeIds = permissions.map(p => p.scope_table_reference_id as string | null).filter((id): id is string => id !== null);
    const allPermissions = permissions.flatMap(p => {
      const resourcePermission = p.resource_permission as number[] | null;
      return Array.isArray(resourcePermission) ? resourcePermission : [];
    });

    return {
      allowed: true,
      scopeIds,
      permissions: [...new Set(allPermissions)].sort() as Permission[],
    };
  } catch (error) {
    console.error('Error checking scope access:', error);
    return { allowed: false, scopeIds: [], permissions: [] };
  }
}

/**
 * Get all scopes user has access to for a given scope type
 */
export async function getUserScopes(
  userId: string,
  scopeType: string,
  minPermission: Permission = Permission.VIEW
): Promise<{ scopeId: string; scopeName: string; permissions: Permission[] }[]> {
  
  if (!userId) {
    return [];
  }

  // For development mode with OIDC bypass, return mock data
  if (process.env.DEV_BYPASS_OIDC === 'true') {
    return [
      {
        scopeId: 'mock-scope-id',
        scopeName: `Mock ${scopeType} Scope`,
        permissions: [0, 1, 2, 3, 4]
      }
    ];
  }
  
  try {
    // Query using new permission structure
    const scopes = await db.execute(sql`
      SELECT 
        rus.scope_table_reference_id, 
        rus.scope_reference_table,
        rus.resource_permission,
        CASE 
          WHEN rus.scope_reference_table = 'd_scope_business' THEN sb.name
          WHEN rus.scope_reference_table = 'd_scope_location' THEN sl.name  
          WHEN rus.scope_reference_table = 'd_scope_hr' THEN sh.name
          WHEN rus.scope_reference_table = 'd_scope_worksite' THEN sw.name
          WHEN rus.scope_reference_table = 'd_scope_app' THEN sa.scope_name
          WHEN rus.scope_reference_table = 'ops_project_head' THEN ph.name
          ELSE 'Unknown'
        END as scope_name
      FROM app.rel_employee_scope_unified rus
      LEFT JOIN app.d_scope_business sb ON rus.scope_reference_table = 'd_scope_business' AND rus.scope_table_reference_id = sb.id
      LEFT JOIN app.d_scope_location sl ON rus.scope_reference_table = 'd_scope_location' AND rus.scope_table_reference_id = sl.id
      LEFT JOIN app.d_scope_hr sh ON rus.scope_reference_table = 'd_scope_hr' AND rus.scope_table_reference_id = sh.id
      LEFT JOIN app.d_scope_worksite sw ON rus.scope_reference_table = 'd_scope_worksite' AND rus.scope_table_reference_id = sw.id
      LEFT JOIN app.d_scope_app sa ON rus.scope_reference_table = 'd_scope_app' AND rus.scope_table_reference_id = sa.id
      LEFT JOIN app.ops_project_head ph ON rus.scope_reference_table = 'ops_project_head' AND rus.scope_table_reference_id = ph.id
      WHERE rus.emp_id = ${userId} 
        AND rus.scope_type = ${scopeType} 
        AND rus.active = true
        AND ${minPermission} = ANY(rus.resource_permission)
      ORDER BY scope_name
    `);

    return scopes.map(scope => ({
      scopeId: (scope.scope_table_reference_id as string | null) || '',
      scopeName: (scope.scope_name as string) || 'Unknown',
      permissions: (Array.isArray(scope.resource_permission) ? scope.resource_permission : []) as Permission[],
    }));
  } catch (error) {
    console.error('Error getting user scopes:', error);
    return [];
  }
}

/**
 * Check if user has admin permissions (full access)
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  if (!userId) {
    return false;
  }

  // For development mode with OIDC bypass, treat all users as admin
  if (process.env.DEV_BYPASS_OIDC === 'true') {
    return true;
  }

  try {
    // Check if user has app-level permissions (any app scope type)
    const adminPermissions = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM app.rel_employee_scope_unified 
      WHERE emp_id = ${userId} 
        AND scope_type IN ('app:page', 'app:api', 'app:component')
        AND active = true
        AND 4 = ANY(resource_permission) -- CREATE permission on app scope
    `);

    return Number(adminPermissions[0]?.count || 0) > 0;
  } catch (error) {
    console.error('Error checking admin permissions:', error);
    return false;
  }
}

/**
 * Apply scope filtering to database queries based on user permissions
 */
export async function applyScopeFiltering(
  userId: string,
  scopeType: string,
  minPermission: Permission = Permission.VIEW
): Promise<string[]> {
  
  const userScopes = await getUserScopes(userId, scopeType, minPermission);
  return userScopes.map(scope => scope.scopeId).filter(Boolean);
}

/**
 * Get user's effective permissions across all scope types
 */
export async function getUserEffectivePermissions(userId: string): Promise<{
  app: Permission[];
  scopes: Record<string, { scopeIds: string[]; permissions: Permission[] }>;
  isAdmin: boolean;
}> {
  if (!userId) {
    return { app: [], scopes: {}, isAdmin: false };
  }

  try {
    const allPermissions = await db.execute(sql`
      SELECT 
        rus.scope_type,
        rus.scope_table_reference_id, 
        rus.resource_permission as scope_permission
      FROM app.rel_employee_scope_unified rus
      WHERE rus.emp_id = ${userId} AND rus.active = true
      ORDER BY rus.scope_type
    `);

    const result = {
      app: [] as Permission[],
      scopes: {} as Record<string, { scopeIds: string[]; permissions: Permission[] }>,
      isAdmin: false,
    };

    for (const perm of allPermissions) {
      const scopeType = perm.scope_type as string;
      const scopeId = perm.scope_table_reference_id as string | null;
      const permissions = (Array.isArray(perm.scope_permission) ? perm.scope_permission : []) as Permission[];

      if (scopeType?.startsWith('app:')) {
        result.app = [...new Set([...result.app, ...permissions])];
      } else {
        if (!result.scopes[scopeType]) {
          result.scopes[scopeType] = { scopeIds: [], permissions: [] };
        }
        if (scopeId) {
          result.scopes[scopeType].scopeIds.push(scopeId);
        }
        result.scopes[scopeType].permissions = [
          ...new Set([...result.scopes[scopeType].permissions, ...permissions])
        ];
      }
    }

    result.isAdmin = result.app.includes(Permission.CREATE);
    return result;
  } catch (error) {
    console.error('Error getting user effective permissions:', error);
    return { app: [], scopes: {}, isAdmin: false };
  }
}