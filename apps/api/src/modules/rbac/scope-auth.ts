/**
 * RBAC Scope-based Authentication Utilities
 * Provides functions to check user permissions against rel_user_scope table
 */

import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

/**
 * Permission levels as defined in rel_user_scope.scope_permission
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
  specificScopeId?: string
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
      scopeIds: specificScopeId ? [specificScopeId] : [], 
      permissions: [0, 1, 2, 3, 4] 
    };
  }
  
  try {
    // Query the database for user permissions
    let query = sql`
      SELECT scope_id, scope_permission
      FROM app.rel_user_scope 
      WHERE emp_id = ${userId} 
        AND scope_type = ${scopeType} 
        AND active = true
    `;

    if (specificScopeId) {
      query = sql`
        SELECT scope_id, scope_permission
        FROM app.rel_user_scope 
        WHERE emp_id = ${userId} 
          AND scope_type = ${scopeType} 
          AND scope_id = ${specificScopeId}
          AND active = true
      `;
    }

    const permissions = await db.execute(query);
    
    if (permissions.length === 0) {
      return { allowed: false, scopeIds: [], permissions: [] };
    }

    // Check if user has the required permission
    const hasPermission = permissions.some(perm => {
      const scopePermission = perm.scope_permission as number[] | null;
      return scopePermission && Array.isArray(scopePermission) && scopePermission.includes(requiredPermission);
    });

    if (!hasPermission) {
      return { allowed: false, scopeIds: [], permissions: [] };
    }

    const scopeIds = permissions.map(p => p.scope_id as string | null).filter((id): id is string => id !== null);
    const allPermissions = permissions.flatMap(p => {
      const scopePermission = p.scope_permission as number[] | null;
      return Array.isArray(scopePermission) ? scopePermission : [];
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
    const scopes = await db.execute(sql`
      SELECT scope_id, scope_name, scope_permission
      FROM app.rel_user_scope 
      WHERE emp_id = ${userId} 
        AND scope_type = ${scopeType} 
        AND active = true
        AND ${minPermission} = ANY(scope_permission)
      ORDER BY scope_name
    `);

    return scopes.map(scope => ({
      scopeId: (scope.scope_id as string | null) || '',
      scopeName: scope.scope_name as string,
      permissions: (Array.isArray(scope.scope_permission) ? scope.scope_permission : []) as Permission[],
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
    // Check if user has app-level permissions
    const adminPermissions = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM app.rel_user_scope 
      WHERE emp_id = ${userId} 
        AND scope_type = 'app' 
        AND active = true
        AND 4 = ANY(scope_permission) -- CREATE permission on app scope
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
      SELECT scope_type, scope_id, scope_name, scope_permission
      FROM app.rel_user_scope 
      WHERE emp_id = ${userId} AND active = true
      ORDER BY scope_type, scope_name
    `);

    const result = {
      app: [] as Permission[],
      scopes: {} as Record<string, { scopeIds: string[]; permissions: Permission[] }>,
      isAdmin: false,
    };

    for (const perm of allPermissions) {
      const scopeType = perm.scope_type as string;
      const scopeId = perm.scope_id as string | null;
      const permissions = (Array.isArray(perm.scope_permission) ? perm.scope_permission : []) as Permission[];

      if (scopeType === 'app') {
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