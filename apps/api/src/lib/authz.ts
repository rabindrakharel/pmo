import type { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

export type Action = 'view' | 'create' | 'modify' | 'delete' | 'grant';
export type Resource = 'project' | 'task' | 'tasklog' | 'form' | 'meta' | 'location' | 'business' | 'hr' | 'worksite' | 'employee' | 'client' | 'projects';

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
 * 0: view, 1: modify, 2: share, 3: delete, 4: create
 */
export enum Permission {
  VIEW = 0,
  MODIFY = 1, 
  SHARE = 2,
  DELETE = 3,
  CREATE = 4,
}

// Authorization middleware
export function authorize(resource: Resource, action: Action) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const abilities = (req as any).abilities as Abilities;
    
    if (!abilities) {
      return reply.status(401).send({ error: 'Abilities not resolved' });
    }

    // Admin override - admins can do everything
    if (abilities.isAdmin) {
      return; // Continue to handler
    }

    // App-level permissions
    if (abilities.app.has(action)) {
      return; // Continue to handler
    }

    // Check scoped permissions for this resource
    const resourceScope = abilities.scopes[resource as keyof typeof abilities.scopes];
    if (resourceScope?.actions.has(action)) {
      return; // Continue to handler
    }

    // Special case: project scope includes tasks
    if (resource === 'task' && abilities.scopes.project?.actions.has(action)) {
      return; // Continue to handler
    }

    // Special case: worksite scope for location-based resources
    if (resource === 'location' && abilities.scopes.worksite?.actions.has(action)) {
      return; // Continue to handler
    }

    // Access denied
    return reply.status(403).send({ 
      error: 'Access denied', 
      details: `Cannot ${action} ${resource}` 
    });
  };
}

// Helper to check if user can access a specific entity
export async function canAccessEntity(
  userId: string, 
  resource: Resource, 
  action: Action, 
  entityId: string
): Promise<boolean> {
  // This would check actual permissions against the database
  // For now, returning false as this needs proper implementation
  return false;
}

// Scope filter builder for queries
export function applyScopeFilter<T extends Record<string, any>>(
  queryBuilder: any, 
  abilities: Abilities, 
  resource: Resource,
  entityTable: string
): any {
  // Admins see everything
  if (abilities.isAdmin || abilities.app.size > 0) {
    return queryBuilder;
  }

  // Apply scope-based filtering for non-admin users
  // This would apply scope filters based on user permissions
  return queryBuilder;
}

/**
 * Resolve user abilities from rel_employee_scope_unified table
 */
export async function resolveAbilities(userId: string): Promise<Abilities> {
  if (!userId) {
    return {
      app: new Set(),
      scopes: {},
      isAdmin: false,
    };
  }
  
  try {
    // Query the new permission structure
    const permissions = await db.execute(sql`
      SELECT 
        scope_type,
        scope_table_reference_id,
        resource_permission
      FROM app.rel_employee_scope_unified 
      WHERE emp_id = ${userId} AND active = true
    `);

    const abilities: Abilities = {
      app: new Set(),
      scopes: {},
      isAdmin: false,
    };

    for (const perm of permissions) {
      const scopeType = perm.scope_type as string;
      const scopeId = perm.scope_table_reference_id as string;
      const resourcePermissions = perm.resource_permission as number[];

      // Convert permission numbers to actions
      const actions = new Set<Action>();
      if (resourcePermissions.includes(0)) actions.add('view');
      if (resourcePermissions.includes(1)) actions.add('modify');
      if (resourcePermissions.includes(3)) actions.add('delete');
      if (resourcePermissions.includes(4)) actions.add('create');
      if (resourcePermissions.includes(2)) actions.add('grant');

      if (scopeType?.startsWith('app:')) {
        // App-level permissions
        actions.forEach(action => abilities.app.add(action));
        abilities.isAdmin = actions.has('create');
      } else {
        // Scope-specific permissions
        const resourceType = scopeType as keyof typeof abilities.scopes;
        if (!abilities.scopes[resourceType]) {
          abilities.scopes[resourceType] = { ids: [], actions: new Set() };
        }
        abilities.scopes[resourceType]!.ids.push(scopeId);
        actions.forEach(action => abilities.scopes[resourceType]!.actions.add(action));
      }
    }

    return abilities;
  } catch (error) {
    console.error('Error resolving abilities:', error);
    return {
      app: new Set(),
      scopes: {},
      isAdmin: false,
    };
  }
}
