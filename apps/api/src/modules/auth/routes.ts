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
import { getUserEffectivePermissions, Permission } from '../rbac/scope-auth.js';

// Login request schema
const LoginRequestSchema = Type.Object({
  email: Type.String({ format: 'email' }),
  password: Type.String({ minLength: 1 }),
});

// Login response schema
const LoginResponseSchema = Type.Object({
  token: Type.String(),
  user: Type.Object({
    id: Type.String(),
    name: Type.String(),
    email: Type.String(),
  }),
  permissions: Type.Object({
    app: Type.Array(Type.Number()),
    scopes: Type.Record(Type.String(), Type.Object({
      scopeIds: Type.Array(Type.String()),
      permissions: Type.Array(Type.Number()),
    })),
    isAdmin: Type.Boolean(),
  }),
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
      description: 'Authenticate user and return JWT token',
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
      // Find user by email
      const userResult = await db.execute(sql`
        SELECT id, name, email, password_hash
        FROM app.d_employee 
        WHERE email = ${email} 
          AND active = true
          AND (to_ts IS NULL OR to_ts > NOW())
      `);

      if (userResult.length === 0) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const user = userResult[0];
      if (!user) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const passwordHash = user.password_hash as string | null;

      if (!passwordHash) {
        return reply.status(401).send({ error: 'Account not properly configured' });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, passwordHash);
      if (!isValidPassword) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      // Get user permissions from rel_employee_scope_unified
      const userPermissions = await getUserEffectivePermissions(user.id as string);

      // Generate JWT token
      const token = jwt.sign(
        {
          sub: user.id as string,
          email: user.email as string,
          name: user.name as string,
        },
        config.JWT_SECRET,
        { expiresIn: config.JWT_EXPIRES_IN } as jwt.SignOptions
      );

      return {
        token,
        user: {
          id: user.id as string,
          name: user.name as string,
          email: user.email as string,
        },
        permissions: userPermissions,
      };
    } catch (error) {
      fastify.log.error('Login error:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get current user endpoint (for validating tokens)
  fastify.get('/me', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth'],
      summary: 'Get current user',
      description: 'Get current authenticated user information',
      response: {
        200: Type.Object({
          user: Type.Object({
            id: Type.String(),
            name: Type.String(),
            email: Type.String(),
          }),
        }),
        401: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    
    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    try {
      const userResult = await db.execute(sql`
        SELECT id, name, email
        FROM app.d_employee 
        WHERE id = ${userId}
          AND active = true
          AND (to_ts IS NULL OR to_ts > NOW())
      `);

      if (userResult.length === 0) {
        return reply.status(401).send({ error: 'User not found' });
      }

      const user = userResult[0];
      if (!user) {
        return reply.status(401).send({ error: 'User not found' });
      }

      return {
        user: {
          id: user.id as string,
          name: user.name as string,
          email: user.email as string,
        },
      };
    } catch (error) {
      fastify.log.error('Get user error:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get current user profile endpoint (alias for /me)
  fastify.get('/profile', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth'],
      summary: 'Get current user profile',
      description: 'Get current authenticated user profile information',
      response: {
        200: Type.Object({
          user: Type.Object({
            id: Type.String(),
            name: Type.String(),
            email: Type.String(),
          }),
        }),
        401: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    
    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    try {
      const userResult = await db.execute(sql`
        SELECT id, name, email
        FROM app.d_employee 
        WHERE id = ${userId}
          AND active = true
          AND (to_ts IS NULL OR to_ts > NOW())
      `);

      if (userResult.length === 0) {
        return reply.status(401).send({ error: 'User not found' });
      }

      const user = userResult[0];
      if (!user) {
        return reply.status(401).send({ error: 'User not found' });
      }

      return {
        user: {
          id: user.id as string,
          name: user.name as string,
          email: user.email as string,
        },
      };
    } catch (error) {
      fastify.log.error('Get user profile error:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get current user permissions from rel_employee_scope_unified
  fastify.get('/permissions', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth'],
      summary: 'Get current user permissions',
      description: 'Get current user permissions from rel_employee_scope_unified table',
      response: {
        200: Type.Object({
          permissions: Type.Object({
            app: Type.Array(Type.Number()),
            scopes: Type.Record(Type.String(), Type.Object({
              scopeIds: Type.Array(Type.String()),
              permissions: Type.Array(Type.Number()),
            })),
            isAdmin: Type.Boolean(),
          }),
        }),
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    
    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    try {
      const userPermissions = await getUserEffectivePermissions(userId);

      return {
        permissions: userPermissions,
      };
    } catch (error) {
      fastify.log.error('Get user permissions error:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get user scopes by scope type
  fastify.get('/scopes/:scopeType', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth'],
      summary: 'Get user scopes by type',
      description: 'Get user scopes for a specific scope type from rel_employee_scope_unified',
      params: Type.Object({
        scopeType: Type.String({ 
          description: 'Scope type: business, location, hr, worksite, project, app:page, app:api, app:component' 
        }),
      }),
      querystring: Type.Object({
        minPermission: Type.Optional(Type.Number({ 
          minimum: 0, 
          maximum: 4,
          description: 'Minimum permission level (0=view, 1=modify, 2=share, 3=delete, 4=create)' 
        })),
      }),
      response: {
        200: Type.Object({
          scopes: Type.Array(Type.Object({
            scopeId: Type.String(),
            scopeName: Type.String(),
            permissions: Type.Array(Type.Number()),
          })),
        }),
        401: ErrorResponseSchema,
        400: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    const { scopeType } = request.params as { scopeType: string };
    const { minPermission = 0 } = request.query as { minPermission?: number };
    
    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    // Validate scope type
    const validScopeTypes = [
      'business', 'location', 'hr', 'worksite', 'project', 
      'app:page', 'app:api', 'app:component'
    ];
    
    if (!validScopeTypes.includes(scopeType)) {
      return reply.status(400).send({ 
        error: `Invalid scope type. Must be one of: ${validScopeTypes.join(', ')}` 
      });
    }

    try {
      const { getUserScopes } = await import('../rbac/scope-auth.js');
      const userScopes = await getUserScopes(userId, scopeType, minPermission as Permission);

      return {
        scopes: userScopes,
      };
    } catch (error) {
      fastify.log.error('Get user scopes error:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get detailed permission info for debugging (admin only)
  fastify.get('/permissions/debug', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth'],
      summary: 'Debug user permissions (admin only)',
      description: 'Get detailed permission information from rel_employee_scope_unified for debugging',
      response: {
        200: Type.Object({
          userId: Type.String(),
          rawPermissions: Type.Array(Type.Object({
            scope_type: Type.String(),
            scope_reference_table: Type.String(),
            scope_table_reference_id: Type.String(),
            resource_permission: Type.Array(Type.Number()),
            name: Type.String(),
            descr: Type.Optional(Type.String()),
          })),
          summary: Type.Object({
            totalPermissions: Type.Number(),
            scopeTypes: Type.Array(Type.String()),
            isAdmin: Type.Boolean(),
          }),
        }),
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    
    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    try {
      // Check if user is admin
      const { isUserAdmin } = await import('../rbac/scope-auth.js');
      const userIsAdmin = await isUserAdmin(userId);
      
      if (!userIsAdmin && process.env.DEV_BYPASS_OIDC !== 'true') {
        return reply.status(403).send({ error: 'Admin access required' });
      }

      // Get raw permission data
      const rawPermissions = await db.execute(sql`
        SELECT 
          rus.scope_type,
          rus.scope_reference_table,
          rus.scope_table_reference_id,
          rus.resource_permission,
          rus.name,
          rus.descr
        FROM app.rel_employee_scope_unified rus
        WHERE rus.emp_id = ${userId} AND rus.active = true
        ORDER BY rus.scope_type, rus.name
      `);

      const scopeTypes = [...new Set(rawPermissions.map(p => p.scope_type as string))];

      return {
        userId,
        rawPermissions: rawPermissions.map(p => ({
          scope_type: p.scope_type as string,
          scope_reference_table: p.scope_reference_table as string,
          scope_table_reference_id: p.scope_table_reference_id as string,
          resource_permission: p.resource_permission as number[],
          name: p.name as string,
          descr: p.descr as string || undefined,
        })),
        summary: {
          totalPermissions: rawPermissions.length,
          scopeTypes,
          isAdmin: userIsAdmin,
        },
      };
    } catch (error) {
      fastify.log.error('Debug permissions error:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}