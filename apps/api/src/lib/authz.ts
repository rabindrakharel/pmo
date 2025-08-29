import type { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '@/db/index.js';

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

// Simplified authorization middleware for development
export function authorize(resource: Resource, action: Action) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    // For development, allow all admin operations
    // In production, this would check actual user permissions
    const abilities = (req as any).abilities as Abilities;
    
    if (!abilities) {
      // Dev mode: create mock admin abilities
      if (process.env.DEV_BYPASS_OIDC === 'true') {
        return; // Allow access in development
      }
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
  // For development with OIDC bypass, allow all access
  if (process.env.DEV_BYPASS_OIDC === 'true') {
    return true;
  }
  
  // In production, this would check actual permissions
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

  // For development with OIDC bypass, return everything
  if (process.env.DEV_BYPASS_OIDC === 'true') {
    return queryBuilder;
  }

  // In production, this would apply scope filters
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

  // For development mode with OIDC bypass, return basic abilities
  if (process.env.DEV_BYPASS_OIDC === 'true') {
    return {
      app: new Set(['view', 'create', 'modify', 'delete', 'grant']),
      scopes: {},
      isAdmin: true,
    };
  }
  
  // In production, this would query the database
  return {
    app: new Set(),
    scopes: {},
    isAdmin: false,
  };
}
