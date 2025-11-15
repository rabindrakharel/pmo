import type { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

export type Action = 'view' | 'create' | 'modify' | 'delete' | 'execute';
export type ScopeType = 
  | 'business' 
  | 'location' 
  | 'hr' 
  | 'worksite' 
  | 'project' 
  | 'task' 
  | 'app:page' 
  | 'app:api' 
  | 'app:component';

export interface ScopePermission {
  scopeId: string;
  scopeName: string;
  scopeType: ScopeType;
  permissions: Set<Action>;
  referenceTable: string;
  referenceId: string;
}

export interface UnifiedAbilities {
  scopes: Map<string, ScopePermission>; // key: scopeId
  isAdmin: boolean;
  employeeId: string;
}

// Legacy interface for backward compatibility
export interface Abilities {
  app: Set<Action>;
  scopes: {
    project?: { ids: string[]; actions: Set<Action> };
    task?: { ids: string[]; actions: Set<Action> };
    location?: { ids: string[]; actions: Set<Action> };
    business?: { ids: string[]; actions: Set<Action> };
    hr?: { ids: string[]; actions: Set<Action> };
    worksite?: { ids: string[]; actions: Set<Action> };
  };
  isAdmin: boolean;
}

/**
 * Permission levels as defined in rel_employee_scope_unified.resource_permission
 * [0=Read, 1=Create, 2=Update, 3=Delete, 4=Execute]
 */
export enum Permission {
  read = 0,     // READ access - view data, reports, dashboards
  create = 1,   // CREATE access - add new resources, initiate workflows  
  update = 2,   // UPDATE access - edit existing records, change status
  delete = 3,   // DELETE access - remove/archive records with audit trail
  execute = 4,  // EXECUTE access - run operations, share resources, assign
}

// Action mapping for backward compatibility and convenience
export const ActionToPermission: Record<Action, Permission> = {
  view: Permission.read,
  create: Permission.create,
  modify: Permission.update,
  delete: Permission.delete,
  execute: Permission.execute,
};

// Authorization middleware using unified scope system
export function authorizeUnified(scopeType: ScopeType, action: Action, scopeId?: string) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const abilities = (req as any).unifiedAbilities as UnifiedAbilities;
    
    if (!abilities) {
      return reply.status(401).send({ error: 'Unified abilities not resolved' });
    }

    // Admin override - admins can do everything
    if (abilities.isAdmin) {
      return; // Continue to handler
    }

    // Check if user has any scopes of the required type
    const hasPermission = checkUnifiedPermission(abilities, scopeType, action, scopeId);
    if (hasPermission) {
      return; // Continue to handler
    }

    // Access denied
    return reply.status(403).send({ 
      error: 'Access denied', 
      details: `Cannot ${action} on ${scopeType}${scopeId ? ` (${scopeId})` : ''}` 
    });
  };
}

// Legacy authorization middleware (for backward compatibility during transition)
export function authorize(resource: string, action: Action) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const abilities = (req as any).unifiedAbilities as UnifiedAbilities;
    
    if (!abilities) {
      return reply.status(401).send({ error: 'Abilities not resolved' });
    }

    // Admin override - admins can do everything
    if (abilities.isAdmin) {
      return; // Continue to handler
    }

    // Map legacy resource types to scope types
    const scopeTypeMapping: Record<string, ScopeType> = {
      project: 'project',
      task: 'task',
      location: 'location', 
      business: 'business',
      hr: 'hr',
      worksite: 'worksite',
    };

    const scopeType = scopeTypeMapping[resource];
    if (!scopeType) {
      return reply.status(403).send({ 
        error: 'Unknown resource type', 
        details: `Resource ${resource} not supported` 
      });
    }

    const hasPermission = checkUnifiedPermission(abilities, scopeType, action);
    if (hasPermission) {
      return; // Continue to handler
    }

    // Access denied
    return reply.status(403).send({ 
      error: 'Access denied', 
      details: `Cannot ${action} ${resource}` 
    });
  };
}

// Helper to check unified permission
export function checkUnifiedPermission(
  abilities: UnifiedAbilities,
  scopeType: ScopeType,
  action: Action,
  scopeId?: string
): boolean {
  // Admin override
  if (abilities.isAdmin) {
    return true;
  }

  // Find matching scopes
  const matchingScopes = Array.from(abilities.scopes.values())
    .filter(scope => scope.scopeType === scopeType);

  if (matchingScopes.length === 0) {
    return false;
  }

  // If specific scope ID is required
  if (scopeId) {
    const specificScope = abilities.scopes.get(scopeId);
    return specificScope ? specificScope.permissions.has(action) : false;
  }

  // Check if any matching scope has the required permission
  return matchingScopes.some(scope => scope.permissions.has(action));
}

// Helper to get accessible scope IDs for a user
export async function getAccessibleScopeIds(
  userId: string,
  scopeType: ScopeType,
  action: Action = 'view'
): Promise<string[]> {
  try {
    const result = await db.execute(sql`
      SELECT DISTINCT scope_table_reference_id
      FROM app.rel_employee_scope_unified resu
      JOIN app.d_scope_unified dsu ON resu.scope_unified_id = dsu.id
      WHERE resu.employee_id = ${userId}
        AND resu.active_flag = true
        AND dsu.scope_type = ${scopeType}
        AND ${ActionToPermission[action]} = ANY(resu.resource_permission)
    `);
    
    return result.map(row => row.scope_table_reference_id as string);
  } catch (error) {
    console.error('Error getting accessible scope IDs:', error);
    return [];
  }
}

// Helper to check if user can access a specific entity
export async function canAccessEntity(
  userId: string, 
  scopeType: ScopeType, 
  action: Action, 
  entityId: string
): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      SELECT 1
      FROM app.rel_employee_scope_unified resu
      JOIN app.d_scope_unified dsu ON resu.scope_unified_id = dsu.id
      WHERE resu.employee_id = ${userId}
        AND resu.active_flag = true
        AND dsu.scope_type = ${scopeType}
        AND dsu.scope_table_reference_id = ${entityId}
        AND ${ActionToPermission[action]} = ANY(resu.resource_permission)
      LIMIT 1
    `);
    
    return result.length > 0;
  } catch (error) {
    console.error('Error checking entity access:', error);
    return false;
  }
}

// Scope filter builder for queries using unified system
export function applyUnifiedScopeFilter(
  userId: string,
  scopeType: ScopeType,
  action: Action = 'view'
): string {
  // Returns SQL fragment for filtering based on unified scope permissions
  return `
    EXISTS (
      SELECT 1 
      FROM app.rel_employee_scope_unified resu
      JOIN app.d_scope_unified dsu ON resu.scope_unified_id = dsu.id
      WHERE resu.employee_id = '${userId}'
        AND resu.active_flag = true
        AND dsu.scope_type = '${scopeType}'
        AND dsu.scope_table_reference_id = id
        AND ${ActionToPermission[action]} = ANY(resu.resource_permission)
    )
  `;
}

// Legacy scope filter for backward compatibility
export function applyScopeFilter<T extends Record<string, any>>(
  queryBuilder: any, 
  abilities: UnifiedAbilities, 
  scopeType: ScopeType,
  entityTable: string
): any {
  // Admins see everything
  if (abilities.isAdmin) {
    return queryBuilder;
  }

  // Apply unified scope-based filtering for non-admin users
  const accessibleIds = Array.from(abilities.scopes.values())
    .filter(scope => scope.scopeType === scopeType)
    .map(scope => scope.referenceId);
  
  if (accessibleIds.length === 0) {
    // No access - return empty result
    return queryBuilder.where(sql`false`);
  }
  
  // Filter by accessible IDs
  return queryBuilder.where(sql`${sql.identifier(entityTable + '.id')} = ANY(${accessibleIds})`);
}

/**
 * Resolve user unified abilities from rel_employee_scope_unified table
 */
export async function resolveUnifiedAbilities(userId: string): Promise<UnifiedAbilities> {
  if (!userId) {
    return {
      scopes: new Map(),
      isAdmin: false,
      employeeId: userId,
    };
  }
  
  try {
    // Query the unified permission structure with scope details
    const permissions = await db.execute(sql`
      SELECT 
        resu.scope_unified_id,
        resu.scope_type,
        resu.scope_reference_table,
        resu.scope_table_reference_id,
        resu.resource_permission,
        dsu.scope_name,
        dsu.is_system_scope
      FROM app.rel_employee_scope_unified resu
      JOIN app.d_scope_unified dsu ON resu.scope_unified_id = dsu.id
      WHERE resu.employee_id = ${userId}
        AND resu.active_flag = true
        AND dsu.active_flag = true
    `);

    const abilities: UnifiedAbilities = {
      scopes: new Map(),
      isAdmin: false,
      employeeId: userId,
    };

    let hasAdminPrivileges = false;

    for (const perm of permissions) {
      const scopeId = perm.scope_unified_id as string;
      const scopeType = perm.scope_type as ScopeType;
      const scopeName = perm.scope_name as string;
      const referenceTable = perm.scope_reference_table as string;
      const referenceId = perm.scope_table_reference_id as string;
      const resourcePermissions = perm.resource_permission as number[];
      const isSystemScope = perm.is_system_scope as boolean;

      // Convert permission numbers to actions
      const permissions = new Set<Action>();
      if (resourcePermissions.includes(0)) permissions.add('view');
      if (resourcePermissions.includes(1)) permissions.add('create');
      if (resourcePermissions.includes(2)) permissions.add('modify');
      if (resourcePermissions.includes(3)) permissions.add('delete');
      if (resourcePermissions.includes(4)) permissions.add('execute');

      // Check for admin privileges (system scope with full permissions)
      if (isSystemScope && resourcePermissions.includes(4)) {
        hasAdminPrivileges = true;
      }

      // Store scope permission
      abilities.scopes.set(scopeId, {
        scopeId,
        scopeName,
        scopeType,
        permissions,
        referenceTable,
        referenceId,
      });
    }

    abilities.isAdmin = hasAdminPrivileges;

    return abilities;
  } catch (error) {
    console.error('Error resolving unified abilities:', error);
    return {
      scopes: new Map(),
      isAdmin: false,
      employeeId: userId,
    };
  }
}

// Legacy function for backward compatibility
export async function resolveAbilities(userId: string): Promise<UnifiedAbilities> {
  return resolveUnifiedAbilities(userId);
}

// Helper functions for common permission checks
export async function hasPermissionOnScope(
  userId: string,
  scopeType: ScopeType,
  action: Action,
  scopeId?: string
): Promise<boolean> {
  const abilities = await resolveUnifiedAbilities(userId);
  return checkUnifiedPermission(abilities, scopeType, action, scopeId);
}

// Get employee permissions summary for API responses
export async function getEmployeePermissionsSummary(userId: string) {
  const abilities = await resolveUnifiedAbilities(userId);
  
  const summary = {
    employeeId: userId,
    isAdmin: abilities.isAdmin,
    totalScopes: abilities.scopes.size,
    scopesByType: {} as Record<ScopeType, number>,
    permissions: {} as Record<ScopeType, string[]>,
  };
  
  // Count scopes by type and aggregate permissions
  for (const [, scope] of abilities.scopes) {
    summary.scopesByType[scope.scopeType] = (summary.scopesByType[scope.scopeType] || 0) + 1;
    
    if (!summary.permissions[scope.scopeType]) {
      summary.permissions[scope.scopeType] = [];
    }
    
    scope.permissions.forEach(permission => {
      if (!summary.permissions[scope.scopeType].includes(permission)) {
        summary.permissions[scope.scopeType].push(permission);
      }
    });
  }
  
  return summary;
}
