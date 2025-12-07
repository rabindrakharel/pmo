/**
 * Authentication Routes
 * Centralized authentication using app.person table
 *
 * Architecture:
 * - All auth (passwords, MFA, security) stored in app.person
 * - Personal details (name, address) stored in entity tables (employee, customer)
 * - JWT token subject is person.id
 * - Entity-specific profile fetched via JOIN
 */

import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { config } from '@/lib/config.js';
import { getEntityInfrastructure } from '@/services/entity-infrastructure.service.js';

// Login request schema
const LoginRequestSchema = Type.Object({
  email: Type.String({ format: 'email' }),
  password: Type.String({ minLength: 1 })
});

// Login response schema
const LoginResponseSchema = Type.Object({
  token: Type.String(),
  user: Type.Object({
    id: Type.String(),
    personId: Type.String(),
    name: Type.String(),
    email: Type.String(),
    entityCode: Type.String()
  })
});

// User profile schema
const UserProfileSchema = Type.Object({
  id: Type.String(),
  personId: Type.String(),
  name: Type.String(),
  email: Type.String(),
  entityCode: Type.String()
});

// Customer signup request schema
const CustomerSignupRequestSchema = Type.Object({
  first_name: Type.String({ minLength: 1 }),
  last_name: Type.String({ minLength: 1 }),
  email: Type.String({ format: 'email' }),
  password: Type.String({ minLength: 8 }),
  cust_type: Type.Optional(Type.String())
});

// Customer signup response schema
const CustomerSignupResponseSchema = Type.Object({
  token: Type.String(),
  user: Type.Object({
    id: Type.String(),
    personId: Type.String(),
    name: Type.String(),
    email: Type.String(),
    entityCode: Type.String(),
    entities: Type.Array(Type.String())
  })
});

// Customer profile schema
const CustomerProfileSchema = Type.Object({
  id: Type.String(),
  personId: Type.String(),
  name: Type.String(),
  email: Type.String(),
  entityCode: Type.String(),
  entities: Type.Array(Type.String()),
  cust_type: Type.String()
});

// Entity configuration request schema
const EntityConfigRequestSchema = Type.Object({
  entities: Type.Array(Type.String())
});

// Permissions summary schema
const PermissionsSummarySchema = Type.Object({
  personId: Type.String(),
  isAdmin: Type.Boolean(),
  totalScopes: Type.Number(),
  scopesByType: Type.Record(Type.String(), Type.Number()),
  permissions: Type.Record(Type.String(), Type.Array(Type.String()))
});

// Scope access schema
const ScopeAccessSchema = Type.Object({
  scopeType: Type.String(),
  accessibleIds: Type.Array(Type.String()),
  total: Type.Number()
});

// Error response schema
const ErrorResponseSchema = Type.Object({
  error: Type.String()
});

export async function authRoutes(fastify: FastifyInstance) {
  // Entity infrastructure service for entity metadata (Redis cached)
  const entityInfra = getEntityInfrastructure(db);

  /**
   * Universal Login Endpoint
   * Authenticates against app.person table, returns entity-specific profile
   */
  fastify.post('/login', {
    schema: {
      tags: ['auth'],
      summary: 'User login',
      description: 'Authenticate user via person table and return JWT token with entity profile',
      body: LoginRequestSchema,
      response: {
        200: LoginResponseSchema,
        401: ErrorResponseSchema,
        423: ErrorResponseSchema,
        400: ErrorResponseSchema,
        500: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    const { email, password } = request.body as {
      email: string;
      password: string;
    };

    try {
      // Find person by email (auth hub)
      const personResult = await db.execute(sql`
        SELECT
          p.id,
          p.code,
          p.email,
          p.password_hash,
          p.entity_code,
          p.employee_id,
          p.customer_id,
          p.supplier_id,
          p.failed_login_attempts,
          p.account_locked_until_ts,
          p.permanent_lock_flag,
          p.mfa_enabled_flag,
          p.force_password_change_flag
        FROM app.person p
        WHERE p.email = ${email}
          AND p.active_flag = true
          AND (p.to_ts IS NULL OR p.to_ts > NOW())
      `);

      if (personResult.length === 0) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const person = personResult[0];

      // Check permanent lock
      if (person.permanent_lock_flag) {
        return reply.status(423).send({ error: 'Account permanently locked. Contact administrator.' });
      }

      // Check temporary lock
      if (person.account_locked_until_ts) {
        const lockUntil = new Date(person.account_locked_until_ts as string);
        if (lockUntil > new Date()) {
          const minutes = Math.ceil((lockUntil.getTime() - Date.now()) / 60000);
          return reply.status(423).send({
            error: `Account temporarily locked. Try again in ${minutes} minutes.`
          });
        }
      }

      const passwordHash = person.password_hash as string | null;
      if (!passwordHash) {
        return reply.status(401).send({ error: 'Account not properly configured' });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, passwordHash);
      if (!isValidPassword) {
        // Increment failed attempts
        const newAttempts = ((person.failed_login_attempts as number) || 0) + 1;
        const lockUntil = newAttempts >= 5
          ? sql`NOW() + INTERVAL '30 minutes'`
          : sql`NULL`;

        await db.execute(sql`
          UPDATE app.person
          SET
            failed_login_attempts = ${newAttempts},
            account_locked_until_ts = ${lockUntil},
            account_locked_reason = CASE WHEN ${newAttempts} >= 5 THEN 'failed_attempts' ELSE account_locked_reason END
          WHERE id = ${person.id as string}
        `);

        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      // Get entity-specific profile based on entity_code
      let entityProfile: any = null;
      const entityCode = person.entity_code as string;

      if (entityCode === 'employee' && person.employee_id) {
        const empResult = await db.execute(sql`
          SELECT id, code, name, first_name, last_name, email, department, title
          FROM app.employee
          WHERE id = ${person.employee_id as string}
            AND active_flag = true
        `);
        if (empResult.length > 0) {
          entityProfile = empResult[0];
        }
      } else if (entityCode === 'customer' && person.customer_id) {
        const custResult = await db.execute(sql`
          SELECT id, code, name, first_name, last_name, primary_email as email, cust_type, entities
          FROM app.customer
          WHERE id = ${person.customer_id as string}
            AND active_flag = true
        `);
        if (custResult.length > 0) {
          entityProfile = custResult[0];
        }
      }

      if (!entityProfile) {
        return reply.status(401).send({ error: 'Entity profile not found' });
      }

      // Update login tracking
      await db.execute(sql`
        UPDATE app.person
        SET
          failed_login_attempts = 0,
          account_locked_until_ts = NULL,
          account_locked_reason = NULL,
          last_login_ts = NOW(),
          login_count = COALESCE(login_count, 0) + 1
        WHERE id = ${person.id as string}
      `);

      // Generate JWT token (subject is person.id for RBAC)
      const token = fastify.jwt.sign(
        {
          sub: person.id as string,
          email: person.email as string,
          name: entityProfile.name as string,
          entityCode: entityCode,
          entityId: entityProfile.id as string
        },
        { expiresIn: config.JWT_EXPIRES_IN }
      );

      return {
        token,
        user: {
          id: entityProfile.id as string,
          personId: person.id as string,
          name: entityProfile.name as string,
          email: person.email as string,
          entityCode: entityCode
        }
      };
    } catch (error) {
      fastify.log.error('Login error:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * Get Current User Profile
   */
  fastify.get('/me', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth'],
      summary: 'Get current user profile',
      description: 'Get the profile of the currently authenticated user',
      response: {
        200: UserProfileSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    try {
      const personId = (request.user as any)?.sub;
      if (!personId) {
        return reply.status(401).send({ error: 'User not authenticated' });
      }

      // Get person with entity profile
      const personResult = await db.execute(sql`
        SELECT p.id, p.email, p.entity_code, p.employee_id, p.customer_id
        FROM app.person p
        WHERE p.id = ${personId}
          AND p.active_flag = true
      `);

      if (personResult.length === 0) {
        return reply.status(401).send({ error: 'User not found' });
      }

      const person = personResult[0];
      const entityCode = person.entity_code as string;

      // Get entity-specific profile
      let entityProfile: any = null;

      if (entityCode === 'employee' && person.employee_id) {
        const empResult = await db.execute(sql`
          SELECT id, name FROM app.employee WHERE id = ${person.employee_id as string}
        `);
        if (empResult.length > 0) entityProfile = empResult[0];
      } else if (entityCode === 'customer' && person.customer_id) {
        const custResult = await db.execute(sql`
          SELECT id, name FROM app.customer WHERE id = ${person.customer_id as string}
        `);
        if (custResult.length > 0) entityProfile = custResult[0];
      }

      if (!entityProfile) {
        return reply.status(401).send({ error: 'Entity profile not found' });
      }

      return {
        id: entityProfile.id as string,
        personId: person.id as string,
        name: entityProfile.name as string,
        email: person.email as string,
        entityCode: entityCode
      };
    } catch (error) {
      fastify.log.error('Get profile error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * Get Current User Permissions Summary
   */
  fastify.get('/permissions', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth', 'permissions'],
      summary: 'Get current user permissions summary',
      description: 'Get complete permissions summary for the currently authenticated user',
      response: {
        200: PermissionsSummarySchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    try {
      const personId = (request as any).user?.sub;

      if (!personId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Get entity-based permissions summary from entity table (Redis cached)
      const entities = await entityInfra.get_all_entity();
      const validEntityCodes = entities.map(e => e.code);
      const actions = ['view', 'create', 'edit', 'share'];

      const permissions: any = {};
      const entityCounts: any = {};

      for (const entityCode of validEntityCodes) {
        entityCounts[entityCode] = 0;
        permissions[entityCode] = actions;
      }

      return {
        personId,
        isAdmin: false,
        totalScopes: 0,
        scopesByType: entityCounts,
        permissions
      };
    } catch (error) {
      fastify.log.error('Get permissions error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * Get Accessible Entities by Type
   */
  fastify.get('/scopes/:entityCode', {
    schema: {
      tags: ['auth', 'permissions'],
      summary: 'Get accessible entities by type',
      description: 'Get all entities of a specific type that the user has access to',
      params: Type.Object({
        entityCode: Type.String()
      }),
      querystring: Type.Object({
        action: Type.Optional(Type.String())
      }),
      response: {
        200: ScopeAccessSchema,
        401: ErrorResponseSchema,
        400: ErrorResponseSchema,
        500: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    try {
      const personId = (request as any).user?.sub;
      const { entityCode } = request.params as { entityCode: string };
      const { action = 'view' } = request.query as { action?: string };

      if (!personId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Validate entity type from entity table (Redis cached)
      const entityMetadata = await entityInfra.get_entity_metadata(entityCode);
      if (!entityMetadata) {
        return reply.status(400).send({ error: `Invalid entity type: ${entityCode}` });
      }

      // Validate action
      const validActions = ['view', 'create', 'edit', 'share'];
      if (!validActions.includes(action)) {
        return reply.status(400).send({ error: `Invalid action: ${action}` });
      }

      return {
        scopeType: entityCode,
        accessibleIds: [],
        total: 0
      };
    } catch (error) {
      fastify.log.error('Get entities error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * Logout Endpoint
   */
  fastify.post('/logout', {
    schema: {
      tags: ['auth'],
      summary: 'User logout',
      description: 'Logout current user (token cleanup)',
      response: {
        200: Type.Object({
          message: Type.String()
        }),
        401: ErrorResponseSchema
      }
    }
  }, async (_request, _reply) => {
    // Stateless JWT - logout is client-side cleanup
    // Future: Add token to blacklist or invalidate active_sessions
    return { message: 'Logged out successfully' };
  });

  // ===================================================================
  // CUSTOMER AUTHENTICATION ENDPOINTS
  // ===================================================================

  /**
   * Customer Signup
   * Creates both person (auth) and customer (profile) records
   */
  fastify.post('/customer/signup', {
    schema: {
      tags: ['auth', 'customer'],
      summary: 'Customer signup',
      description: 'Register a new customer user account (creates person + customer)',
      body: CustomerSignupRequestSchema,
      response: {
        201: CustomerSignupResponseSchema,
        400: ErrorResponseSchema,
        500: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    const { first_name, last_name, email, password, cust_type = 'residential' } = request.body as {
      first_name: string;
      last_name: string;
      email: string;
      password: string;
      cust_type?: string;
    };

    try {
      // Check if email already exists in person table
      const existingPerson = await db.execute(sql`
        SELECT id FROM app.person
        WHERE email = ${email}
          AND active_flag = true
      `);

      if (existingPerson.length > 0) {
        return reply.status(400).send({ error: 'Email already registered' });
      }

      // Hash password
      const password_hash = await bcrypt.hash(password, 12);

      // Generate codes
      const lastCustNumber = await db.execute(sql`
        SELECT cust_number FROM app.customer
        WHERE cust_number LIKE 'APP-%'
        ORDER BY created_ts DESC
        LIMIT 1
      `);

      let custNumber = 'APP-0001';
      if (lastCustNumber.length > 0) {
        const lastNum = parseInt((lastCustNumber[0].cust_number as string).split('-')[1]) || 0;
        custNumber = `APP-${String(lastNum + 1).padStart(4, '0')}`;
      }

      const perCode = `PER-CU-${custNumber.split('-')[1]}`;
      const fullName = `${first_name} ${last_name}`;

      // Create person record (auth hub)
      const personResult = await db.execute(sql`
        INSERT INTO app.person (
          code,
          entity_code,
          email,
          password_hash,
          email_verified_flag,
          tos_accepted_flag,
          tos_accepted_ts
        ) VALUES (
          ${perCode},
          'customer',
          ${email},
          ${password_hash},
          false,
          true,
          NOW()
        )
        RETURNING id
      `);

      const personId = personResult[0].id as string;

      // Create customer record (profile)
      const customerResult = await db.execute(sql`
        INSERT INTO app.customer (
          code,
          name,
          cust_number,
          cust_type,
          cust_status,
          person_id,
          first_name,
          last_name,
          primary_email,
          primary_contact_name,
          entities
        ) VALUES (
          ${custNumber},
          ${fullName},
          ${custNumber},
          ${cust_type},
          'active',
          ${personId},
          ${first_name},
          ${last_name},
          ${email},
          ${fullName},
          ARRAY[]::text[]
        )
        RETURNING id, name, entities
      `);

      const customer = customerResult[0];
      const customerId = customer.id as string;

      // Update person with customer_id reference
      await db.execute(sql`
        UPDATE app.person SET customer_id = ${customerId} WHERE id = ${personId}
      `);

      // Generate JWT token
      const token = fastify.jwt.sign(
        {
          sub: personId,
          email: email,
          name: fullName,
          entityCode: 'customer',
          entityId: customerId
        },
        { expiresIn: config.JWT_EXPIRES_IN }
      );

      reply.status(201);
      return {
        token,
        user: {
          id: customerId,
          personId: personId,
          name: fullName,
          email: email,
          entityCode: 'customer',
          entities: (customer.entities as string[]) || []
        }
      };
    } catch (error) {
      fastify.log.error('Customer signup error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * Customer Signin
   * Authenticates via person table, returns customer profile
   */
  fastify.post('/customer/signin', {
    schema: {
      tags: ['auth', 'customer'],
      summary: 'Customer signin',
      description: 'Authenticate customer and return JWT token',
      body: LoginRequestSchema,
      response: {
        200: CustomerSignupResponseSchema,
        401: ErrorResponseSchema,
        423: ErrorResponseSchema,
        500: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    const { email, password } = request.body as {
      email: string;
      password: string;
    };

    try {
      // Find person by email (must be customer type)
      const personResult = await db.execute(sql`
        SELECT
          p.id,
          p.email,
          p.password_hash,
          p.entity_code,
          p.customer_id,
          p.failed_login_attempts,
          p.account_locked_until_ts,
          p.permanent_lock_flag
        FROM app.person p
        WHERE p.email = ${email}
          AND p.entity_code = 'customer'
          AND p.active_flag = true
          AND p.password_hash IS NOT NULL
      `);

      if (personResult.length === 0) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const person = personResult[0];

      // Check locks
      if (person.permanent_lock_flag) {
        return reply.status(423).send({ error: 'Account permanently locked' });
      }

      if (person.account_locked_until_ts) {
        const lockUntil = new Date(person.account_locked_until_ts as string);
        if (lockUntil > new Date()) {
          return reply.status(423).send({ error: 'Account temporarily locked' });
        }
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, person.password_hash as string);
      if (!isValidPassword) {
        const newAttempts = ((person.failed_login_attempts as number) || 0) + 1;
        await db.execute(sql`
          UPDATE app.person
          SET
            failed_login_attempts = ${newAttempts},
            account_locked_until_ts = CASE WHEN ${newAttempts} >= 5 THEN NOW() + INTERVAL '30 minutes' ELSE NULL END
          WHERE id = ${person.id as string}
        `);
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      // Get customer profile
      const customerResult = await db.execute(sql`
        SELECT id, name, entities, cust_type
        FROM app.customer
        WHERE id = ${person.customer_id as string}
          AND active_flag = true
      `);

      if (customerResult.length === 0) {
        return reply.status(401).send({ error: 'Customer profile not found' });
      }

      const customer = customerResult[0];

      // Update login tracking
      await db.execute(sql`
        UPDATE app.person
        SET
          failed_login_attempts = 0,
          account_locked_until_ts = NULL,
          last_login_ts = NOW(),
          login_count = COALESCE(login_count, 0) + 1
        WHERE id = ${person.id as string}
      `);

      // Generate JWT token
      const token = fastify.jwt.sign(
        {
          sub: person.id as string,
          email: person.email as string,
          name: customer.name as string,
          entityCode: 'customer',
          entityId: customer.id as string
        },
        { expiresIn: config.JWT_EXPIRES_IN }
      );

      return {
        token,
        user: {
          id: customer.id as string,
          personId: person.id as string,
          name: customer.name as string,
          email: person.email as string,
          entityCode: 'customer',
          entities: (customer.entities as string[]) || []
        }
      };
    } catch (error) {
      fastify.log.error('Customer signin error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * Get Customer Profile
   */
  fastify.get('/customer/me', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth', 'customer'],
      summary: 'Get customer profile',
      description: 'Get the profile of the currently authenticated customer',
      response: {
        200: CustomerProfileSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    try {
      const personId = (request.user as any)?.sub;
      const entityCode = (request.user as any)?.entityCode;

      if (!personId || entityCode !== 'customer') {
        return reply.status(401).send({ error: 'Not authenticated as customer' });
      }

      // Get person with customer profile
      const result = await db.execute(sql`
        SELECT
          p.id as person_id,
          p.email,
          c.id,
          c.name,
          c.entities,
          c.cust_type
        FROM app.person p
        INNER JOIN app.customer c ON c.person_id = p.id
        WHERE p.id = ${personId}
          AND p.active_flag = true
          AND c.active_flag = true
      `);

      if (result.length === 0) {
        return reply.status(401).send({ error: 'Customer not found' });
      }

      const row = result[0];
      return {
        id: row.id as string,
        personId: row.person_id as string,
        name: row.name as string,
        email: row.email as string,
        entityCode: 'customer',
        entities: (row.entities as string[]) || [],
        cust_type: row.cust_type as string
      };
    } catch (error) {
      fastify.log.error('Get customer profile error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * Update Customer Entity Configuration
   */
  fastify.put('/customer/configure', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth', 'customer'],
      summary: 'Configure customer entities',
      description: 'Update the list of activated entities for the customer',
      body: EntityConfigRequestSchema,
      response: {
        200: CustomerProfileSchema,
        401: ErrorResponseSchema,
        400: ErrorResponseSchema,
        500: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    const { entities } = request.body as { entities: string[] };

    try {
      const personId = (request.user as any)?.sub;
      const entityCode = (request.user as any)?.entityCode;

      if (!personId || entityCode !== 'customer') {
        return reply.status(401).send({ error: 'Not authenticated as customer' });
      }

      // Validate entities array from entity table (Redis cached)
      const allEntities = await entityInfra.get_all_entity();
      const validEntityCodes = allEntities.map(e => e.code);

      const invalidEntities = entities.filter(e => !validEntityCodes.includes(e));
      if (invalidEntities.length > 0) {
        return reply.status(400).send({
          error: `Invalid entities: ${invalidEntities.join(', ')}`
        });
      }

      // Update customer entities
      const result = await db.execute(sql`
        UPDATE app.customer c
        SET
          entities = ${sql`ARRAY[${sql.join(entities.map(e => sql`${e}`), sql`, `)}]::text[]`},
          updated_ts = NOW()
        FROM app.person p
        WHERE c.person_id = p.id
          AND p.id = ${personId}
        RETURNING c.id, c.name, c.entities, c.cust_type, p.email, p.id as person_id
      `);

      if (result.length === 0) {
        return reply.status(401).send({ error: 'Customer not found' });
      }

      const row = result[0];
      return {
        id: row.id as string,
        personId: row.person_id as string,
        name: row.name as string,
        email: row.email as string,
        entityCode: 'customer',
        entities: (row.entities as string[]) || [],
        cust_type: row.cust_type as string
      };
    } catch (error) {
      fastify.log.error('Configure customer entities error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
