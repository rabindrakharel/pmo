/**
 * Authentication Routes
 * Provides login endpoint for JWT token generation
 */

import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '@/lib/config.js';
import {
  getEmployeeEntityIds,
  hasPermissionOnEntityId,
  type EntityAction
} from '../rbac/entity-permission-rbac-gate.js';

// Login request schema
const LoginRequestSchema = Type.Object({
  email: Type.String({ format: 'email' }),
  password: Type.String({ minLength: 1 }),
});

// Login response schema
const LoginResponseSchema = Type.Object({
  token: Type.String(),
  employee: Type.Object({
    id: Type.String(),
    name: Type.String(),
    email: Type.String(),
  }),
});

// User profile schema  
const UserProfileSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  email: Type.String(),
});

// Permissions summary schema
const PermissionsSummarySchema = Type.Object({
  employeeId: Type.String(),
  isAdmin: Type.Boolean(),
  totalScopes: Type.Number(),
  scopesByType: Type.Record(Type.String(), Type.Number()),
  permissions: Type.Record(Type.String(), Type.Array(Type.String())),
});

// Scope access schema
const ScopeAccessSchema = Type.Object({
  scopeType: Type.String(),
  accessibleIds: Type.Array(Type.String()),
  total: Type.Number(),
});

// Error response schema
const ErrorResponseSchema = Type.Object({
  error: Type.String(),
});

export async function authRoutes(fastify: FastifyInstance) {
  // Login endpoint
  fastify.post('/login', {
    schema: {
      tags: ['auth'],
      summary: 'User login',
      description: 'Authenticate employee and return JWT token',
      body: LoginRequestSchema,
      response: {
        200: LoginResponseSchema,
        401: ErrorResponseSchema,
        400: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { email, password } = request.body as {
      email: string;
      password: string;
    };

    try {
      // Find employee by email
      const employeeResult = await db.execute(sql`
        SELECT id, name, email, password_hash
        FROM app.d_employee
        WHERE email = ${email}
          AND active_flag = true
          AND (to_ts IS NULL OR to_ts > NOW())
      `);

      if (employeeResult.length === 0) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const employee = employeeResult[0];
      if (!employee) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const passwordHash = employee.password_hash as string | null;

      if (!passwordHash) {
        return reply.status(401).send({ error: 'Account not properly configured' });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, passwordHash);
      if (!isValidPassword) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      // Generate JWT token using fastify-jwt
      const token = fastify.jwt.sign(
        {
          sub: employee.id as string,
          email: employee.email as string,
          name: employee.name as string,
        },
        { expiresIn: config.JWT_EXPIRES_IN }
      );

      return {
        token,
        employee: {
          id: employee.id as string,
          name: employee.name as string,
          email: employee.email as string,
        },
      };
    } catch (error) {
      fastify.log.error('Login error:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get current user profile endpoint
  fastify.get('/me', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth'],
      summary: 'Get current user profile',
      description: 'Get the profile of the currently authenticated user',
      response: {
        200: UserProfileSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    try {
      // Get authenticated user ID from JWT token
      const userId = (request.user as any)?.sub;
      if (!userId) {
        return reply.status(401).send({ error: 'User not authenticated' });
      }

      // Get employee profile
      const employeeResult = await db.execute(sql`
        SELECT id, name, email
        FROM app.d_employee
        WHERE id = ${userId}
          AND active_flag = true
          AND (to_ts IS NULL OR to_ts > NOW())
      `);

      if (employeeResult.length === 0) {
        return reply.status(401).send({ error: 'User not found' });
      }

      const employee = employeeResult[0];
      return {
        id: employee.id as string,
        name: employee.name as string,
        email: employee.email as string,
      };
    } catch (error) {
      fastify.log.error('Get profile error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get current user permissions summary
  fastify.get('/permissions', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth', 'permissions'],
      summary: 'Get current user permissions summary',
      description: 'Get complete permissions summary for the currently authenticated user',
      response: {
        200: PermissionsSummarySchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    try {
      const employeeId = (request as any).user?.sub;
      
      if (!employeeId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Get entity-based permissions summary
      const entityTypes = ['biz', 'hr', 'org', 'client', 'project', 'task', 'worksite', 'employee', 'role', 'wiki', 'form', 'artifact'];
      const actions = ['view', 'create', 'edit', 'share'];
      
      const permissions: any = {};
      let totalEntities = 0;
      let entityCounts: any = {};
      
      for (const entityType of entityTypes) {
        const entityIds = await getEmployeeEntityIds(employeeId, entityType, 'view');
        entityCounts[entityType] = entityIds.length;
        totalEntities += entityIds.length;
        
        if (entityIds.length > 0) {
          permissions[entityType] = actions;
        }
      }
      
      return {
        employeeId,
        isAdmin: totalEntities > 20, // Simple admin check based on permission count
        totalScopes: totalEntities,
        scopesByType: entityCounts,
        permissions
      };
    } catch (error) {
      fastify.log.error('Get permissions error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get accessible entities by type
  fastify.get('/scopes/:entityType', {
    
    schema: {
      tags: ['auth', 'permissions'],
      summary: 'Get accessible entities by type',
      description: 'Get all entities of a specific type that the user has access to',
      params: Type.Object({
        entityType: Type.String(),
      }),
      querystring: Type.Object({
        action: Type.Optional(Type.String()),
      }),
      response: {
        200: ScopeAccessSchema,
        401: ErrorResponseSchema,
        400: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    try {
      const employeeId = (request as any).user?.sub;
      const { entityType } = request.params as { entityType: string };
      const { action = 'view' } = request.query as { action?: string };
      
      if (!employeeId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Validate entity type
      const validEntityTypes = [
        'biz', 'hr', 'org', 'client', 'project', 'task', 
        'worksite', 'employee', 'role', 'wiki', 'form', 'artifact'
      ];
      
      if (!validEntityTypes.includes(entityType)) {
        return reply.status(400).send({ error: `Invalid entity type: ${entityType}` });
      }

      // Validate action
      const validActions = ['view', 'create', 'edit', 'share'];
      if (!validActions.includes(action)) {
        return reply.status(400).send({ error: `Invalid action: ${action}` });
      }

      const accessibleIds = await getEmployeeEntityIds(
        employeeId,
        entityType,
        action as EntityAction
      );

      return {
        scopeType: entityType,
        accessibleIds,
        total: accessibleIds.length,
      };
    } catch (error) {
      fastify.log.error('Get entities error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Debug permissions endpoint (admin only) - TEMPORARILY DISABLED
  /*
  fastify.get('/permissions/debug', {
    
    schema: {
      tags: ['auth', 'debug'],
      summary: 'Debug user permissions (Admin only)',
      description: 'Get detailed permission debugging information for the current user',
      response: {
        200: Type.Object({
          employeeId: Type.String(),
          isAdmin: Type.Boolean(),
          rawPermissions: Type.Array(Type.Object({
            scopeId: Type.String(),
            scopeName: Type.String(),
            scopeType: Type.String(),
            permissions: Type.Array(Type.String()),
            referenceTable: Type.String(),
            referenceId: Type.String(),
          })),
          summary: PermissionsSummarySchema,
        }),
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    try {
      const employeeId = (request as any).user?.sub;
      
      if (!employeeId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Get abilities to check if user is admin
      const abilities = await resolveUnifiedAbilities(employeeId);
      if (!abilities.isAdmin) {
        return reply.status(403).send({ error: 'Admin access required' });
      }

      // Get detailed permissions info
      const rawPermissions = Array.from(abilities.scopes.values()).map(scope => ({
        scopeId: scope.scopeId,
        scopeName: scope.scopeName,
        scopeType: scope.scopeType,
        permissions: Array.from(scope.permissions),
        referenceTable: scope.referenceTable,
        referenceId: scope.referenceId,
      }));

      const summary = await getEmployeePermissionsSummary(employeeId);

      return {
        employeeId,
        isAdmin: abilities.isAdmin,
        rawPermissions,
        summary,
      };
    } catch (error) {
      fastify.log.error('Debug permissions error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
  */

  // Logout endpoint (for cleanup purposes)
  fastify.post('/logout', {
    
    schema: {
      tags: ['auth'],
      summary: 'User logout',
      description: 'Logout current user (token cleanup)',
      response: {
        200: Type.Object({
          message: Type.String(),
        }),
        401: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    // Since we're using stateless JWT tokens, logout is mainly for client-side cleanup
    // In a more sophisticated setup, we could maintain a blacklist of tokens
    return { message: 'Logged out successfully' };
  });

}