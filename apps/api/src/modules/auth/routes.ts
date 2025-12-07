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
import {
  generateTOTPSecret,
  generateTOTP,
  verifyTOTP,
  generateTOTPUri,
  generateBackupCodes,
  hashBackupCodes,
  verifyBackupCode,
  hashSecurityAnswer,
  verifySecurityAnswer,
  validatePasswordPolicy,
  generateVerificationToken,
  generatePasswordResetToken,
  generateEmailVerificationCode,
  isPasswordPreviouslyUsed,
  SECURITY_QUESTIONS,
  createLoginHistoryEntry,
} from '@/services/auth.service.js';

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

// ===================================================================
// MFA SCHEMAS
// ===================================================================

const MFASetupResponseSchema = Type.Object({
  secret: Type.String(),
  qrCodeUri: Type.String(),
  backupCodes: Type.Array(Type.String())
});

const MFAVerifyRequestSchema = Type.Object({
  code: Type.String({ minLength: 6, maxLength: 6 })
});

const MFALoginRequestSchema = Type.Object({
  email: Type.String({ format: 'email' }),
  password: Type.String({ minLength: 1 }),
  mfaCode: Type.Optional(Type.String({ minLength: 6, maxLength: 8 }))
});

const MFALoginResponseSchema = Type.Object({
  requiresMFA: Type.Boolean(),
  mfaToken: Type.Optional(Type.String()),
  token: Type.Optional(Type.String()),
  user: Type.Optional(Type.Object({
    id: Type.String(),
    personId: Type.String(),
    name: Type.String(),
    email: Type.String(),
    entityCode: Type.String()
  }))
});

const BackupCodeVerifyRequestSchema = Type.Object({
  code: Type.String({ minLength: 9, maxLength: 9 })
});

// ===================================================================
// EMAIL VERIFICATION SCHEMAS
// ===================================================================

const EmailVerificationRequestSchema = Type.Object({
  email: Type.String({ format: 'email' })
});

const EmailVerificationCodeSchema = Type.Object({
  code: Type.String({ minLength: 6, maxLength: 6 })
});

// ===================================================================
// PASSWORD RESET SCHEMAS
// ===================================================================

const PasswordResetRequestSchema = Type.Object({
  email: Type.String({ format: 'email' })
});

const PasswordResetConfirmSchema = Type.Object({
  token: Type.String(),
  newPassword: Type.String({ minLength: 8 })
});

const PasswordChangeSchema = Type.Object({
  currentPassword: Type.String({ minLength: 1 }),
  newPassword: Type.String({ minLength: 8 })
});

const PasswordPolicyResponseSchema = Type.Object({
  valid: Type.Boolean(),
  errors: Type.Array(Type.String()),
  strength: Type.Union([
    Type.Literal('weak'),
    Type.Literal('fair'),
    Type.Literal('good'),
    Type.Literal('strong')
  ])
});

// ===================================================================
// SECURITY QUESTIONS SCHEMAS
// ===================================================================

const SecurityQuestionSchema = Type.Object({
  questionId: Type.Number({ minimum: 0, maximum: 9 }),
  answer: Type.String({ minLength: 1 })
});

const SecurityQuestionsSetupSchema = Type.Object({
  questions: Type.Array(SecurityQuestionSchema, { minItems: 3, maxItems: 3 })
});

const SecurityQuestionsVerifySchema = Type.Object({
  answers: Type.Array(Type.Object({
    questionId: Type.Number(),
    answer: Type.String()
  }))
});

const SecurityQuestionsListSchema = Type.Object({
  questions: Type.Array(Type.Object({
    id: Type.Number(),
    question: Type.String()
  }))
});

// ===================================================================
// ACCOUNT RECOVERY SCHEMAS
// ===================================================================

const AccountRecoveryRequestSchema = Type.Object({
  email: Type.String({ format: 'email' }),
  method: Type.Union([
    Type.Literal('email'),
    Type.Literal('security_questions'),
    Type.Literal('backup_code')
  ])
});

// ===================================================================
// SSO SCHEMAS
// ===================================================================

const SSOInitRequestSchema = Type.Object({
  provider: Type.Union([
    Type.Literal('google'),
    Type.Literal('microsoft')
  ]),
  redirectUri: Type.String()
});

const SSOCallbackSchema = Type.Object({
  provider: Type.String(),
  code: Type.String(),
  state: Type.Optional(Type.String())
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

  // ===================================================================
  // MFA (MULTI-FACTOR AUTHENTICATION) ENDPOINTS
  // ===================================================================

  /**
   * Initialize MFA Setup
   * Generates TOTP secret and backup codes
   */
  fastify.post('/mfa/setup', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth', 'mfa'],
      summary: 'Initialize MFA setup',
      description: 'Generate TOTP secret and backup codes for MFA setup',
      response: {
        200: MFASetupResponseSchema,
        401: ErrorResponseSchema,
        400: ErrorResponseSchema,
        500: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    try {
      const personId = (request.user as any)?.sub;
      if (!personId) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }

      // Get person email
      const personResult = await db.execute(sql`
        SELECT email, mfa_enabled_flag FROM app.person WHERE id = ${personId}
      `);

      if (personResult.length === 0) {
        return reply.status(401).send({ error: 'User not found' });
      }

      const person = personResult[0];

      if (person.mfa_enabled_flag) {
        return reply.status(400).send({ error: 'MFA is already enabled' });
      }

      // Generate TOTP secret
      const secret = generateTOTPSecret();
      const qrCodeUri = generateTOTPUri(secret, person.email as string);

      // Generate backup codes
      const backupCodes = generateBackupCodes(10);
      const hashedBackupCodes = await hashBackupCodes(backupCodes);

      // Store pending MFA setup (not enabled yet)
      await db.execute(sql`
        UPDATE app.person
        SET
          mfa_secret = ${secret},
          mfa_backup_codes = ${JSON.stringify(hashedBackupCodes)}::jsonb,
          updated_ts = NOW()
        WHERE id = ${personId}
      `);

      return {
        secret,
        qrCodeUri,
        backupCodes
      };
    } catch (error) {
      fastify.log.error('MFA setup error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * Verify and Enable MFA
   * Verifies TOTP code and enables MFA
   */
  fastify.post('/mfa/verify', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth', 'mfa'],
      summary: 'Verify and enable MFA',
      description: 'Verify TOTP code and enable MFA for the account',
      body: MFAVerifyRequestSchema,
      response: {
        200: Type.Object({ success: Type.Boolean(), message: Type.String() }),
        401: ErrorResponseSchema,
        400: ErrorResponseSchema,
        500: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    const { code } = request.body as { code: string };

    try {
      const personId = (request.user as any)?.sub;
      if (!personId) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }

      // Get person MFA secret
      const personResult = await db.execute(sql`
        SELECT mfa_secret, mfa_enabled_flag FROM app.person WHERE id = ${personId}
      `);

      if (personResult.length === 0) {
        return reply.status(401).send({ error: 'User not found' });
      }

      const person = personResult[0];

      if (person.mfa_enabled_flag) {
        return reply.status(400).send({ error: 'MFA is already enabled' });
      }

      if (!person.mfa_secret) {
        return reply.status(400).send({ error: 'MFA setup not initialized' });
      }

      // Verify TOTP code
      const isValid = verifyTOTP(person.mfa_secret as string, code);

      if (!isValid) {
        return reply.status(400).send({ error: 'Invalid verification code' });
      }

      // Enable MFA
      await db.execute(sql`
        UPDATE app.person
        SET
          mfa_enabled_flag = true,
          mfa_method = 'totp',
          mfa_enabled_ts = NOW(),
          updated_ts = NOW()
        WHERE id = ${personId}
      `);

      return {
        success: true,
        message: 'MFA has been enabled successfully'
      };
    } catch (error) {
      fastify.log.error('MFA verify error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * Disable MFA
   */
  fastify.post('/mfa/disable', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth', 'mfa'],
      summary: 'Disable MFA',
      description: 'Disable MFA for the account (requires current password)',
      body: Type.Object({
        password: Type.String({ minLength: 1 }),
        code: Type.String({ minLength: 6, maxLength: 6 })
      }),
      response: {
        200: Type.Object({ success: Type.Boolean(), message: Type.String() }),
        401: ErrorResponseSchema,
        400: ErrorResponseSchema,
        500: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    const { password, code } = request.body as { password: string; code: string };

    try {
      const personId = (request.user as any)?.sub;
      if (!personId) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }

      // Get person
      const personResult = await db.execute(sql`
        SELECT password_hash, mfa_secret, mfa_enabled_flag
        FROM app.person WHERE id = ${personId}
      `);

      if (personResult.length === 0) {
        return reply.status(401).send({ error: 'User not found' });
      }

      const person = personResult[0];

      // Verify password
      const isValidPassword = await bcrypt.compare(password, person.password_hash as string);
      if (!isValidPassword) {
        return reply.status(401).send({ error: 'Invalid password' });
      }

      if (!person.mfa_enabled_flag) {
        return reply.status(400).send({ error: 'MFA is not enabled' });
      }

      // Verify TOTP code
      const isValidCode = verifyTOTP(person.mfa_secret as string, code);
      if (!isValidCode) {
        return reply.status(400).send({ error: 'Invalid verification code' });
      }

      // Disable MFA
      await db.execute(sql`
        UPDATE app.person
        SET
          mfa_enabled_flag = false,
          mfa_secret = NULL,
          mfa_backup_codes = NULL,
          mfa_method = NULL,
          updated_ts = NOW()
        WHERE id = ${personId}
      `);

      return {
        success: true,
        message: 'MFA has been disabled'
      };
    } catch (error) {
      fastify.log.error('MFA disable error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * Regenerate Backup Codes
   */
  fastify.post('/mfa/backup-codes/regenerate', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth', 'mfa'],
      summary: 'Regenerate backup codes',
      description: 'Generate new backup codes (invalidates old ones)',
      body: Type.Object({
        code: Type.String({ minLength: 6, maxLength: 6 })
      }),
      response: {
        200: Type.Object({
          backupCodes: Type.Array(Type.String())
        }),
        401: ErrorResponseSchema,
        400: ErrorResponseSchema,
        500: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    const { code } = request.body as { code: string };

    try {
      const personId = (request.user as any)?.sub;
      if (!personId) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }

      // Get person
      const personResult = await db.execute(sql`
        SELECT mfa_secret, mfa_enabled_flag FROM app.person WHERE id = ${personId}
      `);

      if (personResult.length === 0) {
        return reply.status(401).send({ error: 'User not found' });
      }

      const person = personResult[0];

      if (!person.mfa_enabled_flag) {
        return reply.status(400).send({ error: 'MFA is not enabled' });
      }

      // Verify TOTP code
      const isValid = verifyTOTP(person.mfa_secret as string, code);
      if (!isValid) {
        return reply.status(400).send({ error: 'Invalid verification code' });
      }

      // Generate new backup codes
      const backupCodes = generateBackupCodes(10);
      const hashedBackupCodes = await hashBackupCodes(backupCodes);

      await db.execute(sql`
        UPDATE app.person
        SET
          mfa_backup_codes = ${JSON.stringify(hashedBackupCodes)}::jsonb,
          updated_ts = NOW()
        WHERE id = ${personId}
      `);

      return { backupCodes };
    } catch (error) {
      fastify.log.error('Regenerate backup codes error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * Get MFA Status
   */
  fastify.get('/mfa/status', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth', 'mfa'],
      summary: 'Get MFA status',
      description: 'Get current MFA status for the account',
      response: {
        200: Type.Object({
          enabled: Type.Boolean(),
          method: Type.Optional(Type.String()),
          backupCodesRemaining: Type.Optional(Type.Number())
        }),
        401: ErrorResponseSchema,
        500: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    try {
      const personId = (request.user as any)?.sub;
      if (!personId) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }

      const personResult = await db.execute(sql`
        SELECT mfa_enabled_flag, mfa_method, mfa_backup_codes
        FROM app.person WHERE id = ${personId}
      `);

      if (personResult.length === 0) {
        return reply.status(401).send({ error: 'User not found' });
      }

      const person = personResult[0];
      const backupCodes = person.mfa_backup_codes as string[] | null;

      return {
        enabled: person.mfa_enabled_flag as boolean || false,
        method: person.mfa_method as string | undefined,
        backupCodesRemaining: backupCodes ? backupCodes.length : undefined
      };
    } catch (error) {
      fastify.log.error('Get MFA status error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ===================================================================
  // EMAIL VERIFICATION ENDPOINTS
  // ===================================================================

  /**
   * Send Email Verification Code
   */
  fastify.post('/email/send-verification', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth', 'email'],
      summary: 'Send email verification code',
      description: 'Send a 6-digit verification code to the user email',
      response: {
        200: Type.Object({ success: Type.Boolean(), message: Type.String() }),
        401: ErrorResponseSchema,
        400: ErrorResponseSchema,
        500: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    try {
      const personId = (request.user as any)?.sub;
      if (!personId) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }

      const personResult = await db.execute(sql`
        SELECT email, email_verified_flag FROM app.person WHERE id = ${personId}
      `);

      if (personResult.length === 0) {
        return reply.status(401).send({ error: 'User not found' });
      }

      const person = personResult[0];

      if (person.email_verified_flag) {
        return reply.status(400).send({ error: 'Email is already verified' });
      }

      // Generate verification code
      const verificationCode = generateEmailVerificationCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      // Store verification code
      await db.execute(sql`
        UPDATE app.person
        SET
          email_verification_token = ${verificationCode},
          email_verification_expires_ts = ${expiresAt.toISOString()},
          updated_ts = NOW()
        WHERE id = ${personId}
      `);

      // TODO: Send email via email service
      // For now, log the code (in production, use proper email service)
      fastify.log.info(`Email verification code for ${person.email}: ${verificationCode}`);

      return {
        success: true,
        message: 'Verification code sent to your email'
      };
    } catch (error) {
      fastify.log.error('Send email verification error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * Verify Email Code
   */
  fastify.post('/email/verify', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth', 'email'],
      summary: 'Verify email code',
      description: 'Verify the 6-digit email verification code',
      body: EmailVerificationCodeSchema,
      response: {
        200: Type.Object({ success: Type.Boolean(), message: Type.String() }),
        401: ErrorResponseSchema,
        400: ErrorResponseSchema,
        500: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    const { code } = request.body as { code: string };

    try {
      const personId = (request.user as any)?.sub;
      if (!personId) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }

      const personResult = await db.execute(sql`
        SELECT email_verification_token, email_verification_expires_ts, email_verified_flag
        FROM app.person WHERE id = ${personId}
      `);

      if (personResult.length === 0) {
        return reply.status(401).send({ error: 'User not found' });
      }

      const person = personResult[0];

      if (person.email_verified_flag) {
        return reply.status(400).send({ error: 'Email is already verified' });
      }

      if (!person.email_verification_token) {
        return reply.status(400).send({ error: 'No verification code sent' });
      }

      // Check expiry
      const expiresAt = new Date(person.email_verification_expires_ts as string);
      if (expiresAt < new Date()) {
        return reply.status(400).send({ error: 'Verification code has expired' });
      }

      // Verify code
      if (person.email_verification_token !== code) {
        return reply.status(400).send({ error: 'Invalid verification code' });
      }

      // Mark email as verified
      await db.execute(sql`
        UPDATE app.person
        SET
          email_verified_flag = true,
          email_verified_ts = NOW(),
          email_verification_token = NULL,
          email_verification_expires_ts = NULL,
          updated_ts = NOW()
        WHERE id = ${personId}
      `);

      return {
        success: true,
        message: 'Email verified successfully'
      };
    } catch (error) {
      fastify.log.error('Verify email error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ===================================================================
  // PASSWORD MANAGEMENT ENDPOINTS
  // ===================================================================

  /**
   * Validate Password Policy
   */
  fastify.post('/password/validate', {
    schema: {
      tags: ['auth', 'password'],
      summary: 'Validate password policy',
      description: 'Check if a password meets the security requirements',
      body: Type.Object({ password: Type.String() }),
      response: {
        200: PasswordPolicyResponseSchema
      }
    }
  }, async (request, _reply) => {
    const { password } = request.body as { password: string };
    return validatePasswordPolicy(password);
  });

  /**
   * Request Password Reset
   */
  fastify.post('/password/reset-request', {
    schema: {
      tags: ['auth', 'password'],
      summary: 'Request password reset',
      description: 'Send a password reset link to the email',
      body: PasswordResetRequestSchema,
      response: {
        200: Type.Object({ success: Type.Boolean(), message: Type.String() }),
        400: ErrorResponseSchema,
        500: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    const { email } = request.body as { email: string };

    try {
      // Find person by email
      const personResult = await db.execute(sql`
        SELECT id, email FROM app.person
        WHERE email = ${email} AND active_flag = true
      `);

      // Always return success to prevent email enumeration
      if (personResult.length === 0) {
        return {
          success: true,
          message: 'If your email is registered, you will receive a password reset link'
        };
      }

      const person = personResult[0];

      // Generate reset token
      const { token, expiresAt } = generatePasswordResetToken();

      // Store reset token
      await db.execute(sql`
        UPDATE app.person
        SET
          password_reset_token = ${token},
          password_reset_expires_ts = ${expiresAt.toISOString()},
          updated_ts = NOW()
        WHERE id = ${person.id as string}
      `);

      // TODO: Send email via email service
      fastify.log.info(`Password reset token for ${email}: ${token}`);

      return {
        success: true,
        message: 'If your email is registered, you will receive a password reset link'
      };
    } catch (error) {
      fastify.log.error('Password reset request error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * Reset Password (with token)
   */
  fastify.post('/password/reset', {
    schema: {
      tags: ['auth', 'password'],
      summary: 'Reset password',
      description: 'Reset password using the token from email',
      body: PasswordResetConfirmSchema,
      response: {
        200: Type.Object({ success: Type.Boolean(), message: Type.String() }),
        400: ErrorResponseSchema,
        500: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    const { token, newPassword } = request.body as { token: string; newPassword: string };

    try {
      // Validate password policy
      const policyResult = validatePasswordPolicy(newPassword);
      if (!policyResult.valid) {
        return reply.status(400).send({ error: policyResult.errors.join(', ') });
      }

      // Find person by reset token
      const personResult = await db.execute(sql`
        SELECT id, password_reset_expires_ts, password_history
        FROM app.person
        WHERE password_reset_token = ${token} AND active_flag = true
      `);

      if (personResult.length === 0) {
        return reply.status(400).send({ error: 'Invalid or expired reset token' });
      }

      const person = personResult[0];

      // Check token expiry
      const expiresAt = new Date(person.password_reset_expires_ts as string);
      if (expiresAt < new Date()) {
        return reply.status(400).send({ error: 'Reset token has expired' });
      }

      // Check password history
      const passwordHistory = (person.password_history as string[]) || [];
      const isReused = await isPasswordPreviouslyUsed(newPassword, passwordHistory);
      if (isReused) {
        return reply.status(400).send({ error: 'Cannot reuse a previous password' });
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, 12);

      // Update password and add to history
      const newHistory = [passwordHash, ...passwordHistory.slice(0, 4)]; // Keep last 5

      await db.execute(sql`
        UPDATE app.person
        SET
          password_hash = ${passwordHash},
          password_changed_ts = NOW(),
          password_reset_token = NULL,
          password_reset_expires_ts = NULL,
          password_history = ${JSON.stringify(newHistory)}::jsonb,
          failed_login_attempts = 0,
          account_locked_until_ts = NULL,
          force_password_change_flag = false,
          updated_ts = NOW()
        WHERE id = ${person.id as string}
      `);

      return {
        success: true,
        message: 'Password has been reset successfully'
      };
    } catch (error) {
      fastify.log.error('Password reset error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * Change Password (authenticated)
   */
  fastify.post('/password/change', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth', 'password'],
      summary: 'Change password',
      description: 'Change password for authenticated user',
      body: PasswordChangeSchema,
      response: {
        200: Type.Object({ success: Type.Boolean(), message: Type.String() }),
        401: ErrorResponseSchema,
        400: ErrorResponseSchema,
        500: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    const { currentPassword, newPassword } = request.body as {
      currentPassword: string;
      newPassword: string;
    };

    try {
      const personId = (request.user as any)?.sub;
      if (!personId) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }

      // Validate password policy
      const policyResult = validatePasswordPolicy(newPassword);
      if (!policyResult.valid) {
        return reply.status(400).send({ error: policyResult.errors.join(', ') });
      }

      // Get person
      const personResult = await db.execute(sql`
        SELECT password_hash, password_history FROM app.person WHERE id = ${personId}
      `);

      if (personResult.length === 0) {
        return reply.status(401).send({ error: 'User not found' });
      }

      const person = personResult[0];

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, person.password_hash as string);
      if (!isValidPassword) {
        return reply.status(401).send({ error: 'Current password is incorrect' });
      }

      // Check password history
      const passwordHistory = (person.password_history as string[]) || [];
      const isReused = await isPasswordPreviouslyUsed(newPassword, passwordHistory);
      if (isReused) {
        return reply.status(400).send({ error: 'Cannot reuse a previous password' });
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, 12);
      const newHistory = [passwordHash, ...passwordHistory.slice(0, 4)];

      await db.execute(sql`
        UPDATE app.person
        SET
          password_hash = ${passwordHash},
          password_changed_ts = NOW(),
          password_history = ${JSON.stringify(newHistory)}::jsonb,
          force_password_change_flag = false,
          updated_ts = NOW()
        WHERE id = ${personId}
      `);

      return {
        success: true,
        message: 'Password changed successfully'
      };
    } catch (error) {
      fastify.log.error('Password change error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ===================================================================
  // SECURITY QUESTIONS ENDPOINTS
  // ===================================================================

  /**
   * Get Available Security Questions
   */
  fastify.get('/security-questions/list', {
    schema: {
      tags: ['auth', 'security'],
      summary: 'Get security questions list',
      description: 'Get the list of available security questions',
      response: {
        200: SecurityQuestionsListSchema
      }
    }
  }, async (_request, _reply) => {
    return {
      questions: SECURITY_QUESTIONS.map((q, i) => ({ id: i, question: q }))
    };
  });

  /**
   * Setup Security Questions
   */
  fastify.post('/security-questions/setup', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth', 'security'],
      summary: 'Setup security questions',
      description: 'Set up 3 security questions for account recovery',
      body: SecurityQuestionsSetupSchema,
      response: {
        200: Type.Object({ success: Type.Boolean(), message: Type.String() }),
        401: ErrorResponseSchema,
        400: ErrorResponseSchema,
        500: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    const { questions } = request.body as {
      questions: Array<{ questionId: number; answer: string }>
    };

    try {
      const personId = (request.user as any)?.sub;
      if (!personId) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }

      // Validate question IDs are unique
      const questionIds = questions.map(q => q.questionId);
      if (new Set(questionIds).size !== questionIds.length) {
        return reply.status(400).send({ error: 'Security questions must be unique' });
      }

      // Validate question IDs are valid
      const invalidIds = questionIds.filter(id => id < 0 || id >= SECURITY_QUESTIONS.length);
      if (invalidIds.length > 0) {
        return reply.status(400).send({ error: 'Invalid question IDs' });
      }

      // Hash answers
      const securityQuestionsData = await Promise.all(
        questions.map(async q => ({
          questionId: q.questionId,
          question: SECURITY_QUESTIONS[q.questionId],
          answerHash: await hashSecurityAnswer(q.answer)
        }))
      );

      // Store security questions
      await db.execute(sql`
        UPDATE app.person
        SET
          security_questions = ${JSON.stringify(securityQuestionsData)}::jsonb,
          security_questions_set_flag = true,
          updated_ts = NOW()
        WHERE id = ${personId}
      `);

      return {
        success: true,
        message: 'Security questions have been set up'
      };
    } catch (error) {
      fastify.log.error('Setup security questions error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * Get User's Security Questions (without answers)
   */
  fastify.get('/security-questions/user', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth', 'security'],
      summary: 'Get user security questions',
      description: 'Get the security questions configured for the user',
      response: {
        200: Type.Object({
          configured: Type.Boolean(),
          questions: Type.Optional(Type.Array(Type.Object({
            questionId: Type.Number(),
            question: Type.String()
          })))
        }),
        401: ErrorResponseSchema,
        500: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    try {
      const personId = (request.user as any)?.sub;
      if (!personId) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }

      const personResult = await db.execute(sql`
        SELECT security_questions, security_questions_set_flag
        FROM app.person WHERE id = ${personId}
      `);

      if (personResult.length === 0) {
        return reply.status(401).send({ error: 'User not found' });
      }

      const person = personResult[0];
      const configured = person.security_questions_set_flag as boolean || false;

      if (!configured) {
        return { configured: false };
      }

      const securityQuestions = person.security_questions as Array<{
        questionId: number;
        question: string;
      }>;

      return {
        configured: true,
        questions: securityQuestions.map(q => ({
          questionId: q.questionId,
          question: q.question
        }))
      };
    } catch (error) {
      fastify.log.error('Get user security questions error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * Verify Security Questions (for account recovery)
   */
  fastify.post('/security-questions/verify', {
    schema: {
      tags: ['auth', 'security'],
      summary: 'Verify security questions',
      description: 'Verify security question answers for account recovery',
      body: Type.Object({
        email: Type.String({ format: 'email' }),
        answers: Type.Array(Type.Object({
          questionId: Type.Number(),
          answer: Type.String()
        }))
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          recoveryToken: Type.Optional(Type.String())
        }),
        400: ErrorResponseSchema,
        500: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    const { email, answers } = request.body as {
      email: string;
      answers: Array<{ questionId: number; answer: string }>
    };

    try {
      // Find person by email
      const personResult = await db.execute(sql`
        SELECT id, security_questions, security_questions_set_flag
        FROM app.person
        WHERE email = ${email} AND active_flag = true
      `);

      if (personResult.length === 0) {
        return reply.status(400).send({ error: 'Invalid email or security questions' });
      }

      const person = personResult[0];

      if (!person.security_questions_set_flag) {
        return reply.status(400).send({ error: 'Security questions not configured' });
      }

      const securityQuestions = person.security_questions as Array<{
        questionId: number;
        answerHash: string;
      }>;

      // Verify all answers
      let correctCount = 0;
      for (const answer of answers) {
        const storedQuestion = securityQuestions.find(q => q.questionId === answer.questionId);
        if (storedQuestion) {
          const isCorrect = await verifySecurityAnswer(answer.answer, storedQuestion.answerHash);
          if (isCorrect) correctCount++;
        }
      }

      // Require all 3 correct answers
      if (correctCount < 3) {
        return reply.status(400).send({ error: 'Invalid security question answers' });
      }

      // Generate recovery token
      const { token, expiresAt } = generatePasswordResetToken();

      await db.execute(sql`
        UPDATE app.person
        SET
          password_reset_token = ${token},
          password_reset_expires_ts = ${expiresAt.toISOString()},
          updated_ts = NOW()
        WHERE id = ${person.id as string}
      `);

      return {
        success: true,
        recoveryToken: token
      };
    } catch (error) {
      fastify.log.error('Verify security questions error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ===================================================================
  // ACCOUNT RECOVERY ENDPOINTS
  // ===================================================================

  /**
   * Get Account Recovery Options
   */
  fastify.post('/recovery/options', {
    schema: {
      tags: ['auth', 'recovery'],
      summary: 'Get account recovery options',
      description: 'Get available recovery methods for an account',
      body: Type.Object({
        email: Type.String({ format: 'email' })
      }),
      response: {
        200: Type.Object({
          email: Type.Boolean(),
          securityQuestions: Type.Boolean(),
          backupCodes: Type.Boolean()
        }),
        500: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    const { email } = request.body as { email: string };

    try {
      const personResult = await db.execute(sql`
        SELECT
          email_verified_flag,
          security_questions_set_flag,
          mfa_enabled_flag,
          mfa_backup_codes
        FROM app.person
        WHERE email = ${email} AND active_flag = true
      `);

      // Always return something to prevent enumeration
      if (personResult.length === 0) {
        return {
          email: true,
          securityQuestions: false,
          backupCodes: false
        };
      }

      const person = personResult[0];
      const backupCodes = person.mfa_backup_codes as string[] | null;

      return {
        email: person.email_verified_flag as boolean || true, // Email recovery always available
        securityQuestions: person.security_questions_set_flag as boolean || false,
        backupCodes: person.mfa_enabled_flag as boolean && backupCodes !== null && backupCodes.length > 0
      };
    } catch (error) {
      fastify.log.error('Get recovery options error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * Recover Account with Backup Code
   */
  fastify.post('/recovery/backup-code', {
    schema: {
      tags: ['auth', 'recovery'],
      summary: 'Recover account with backup code',
      description: 'Use a backup code to recover account access',
      body: Type.Object({
        email: Type.String({ format: 'email' }),
        backupCode: Type.String()
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          recoveryToken: Type.String(),
          remainingCodes: Type.Number()
        }),
        400: ErrorResponseSchema,
        500: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    const { email, backupCode } = request.body as { email: string; backupCode: string };

    try {
      const personResult = await db.execute(sql`
        SELECT id, mfa_backup_codes
        FROM app.person
        WHERE email = ${email} AND active_flag = true AND mfa_enabled_flag = true
      `);

      if (personResult.length === 0) {
        return reply.status(400).send({ error: 'Invalid email or backup code' });
      }

      const person = personResult[0];
      const hashedCodes = (person.mfa_backup_codes as string[]) || [];

      // Verify backup code
      const { valid, index } = await verifyBackupCode(backupCode, hashedCodes);

      if (!valid) {
        return reply.status(400).send({ error: 'Invalid backup code' });
      }

      // Remove used code
      hashedCodes.splice(index, 1);

      // Generate recovery token
      const { token, expiresAt } = generatePasswordResetToken();

      await db.execute(sql`
        UPDATE app.person
        SET
          mfa_backup_codes = ${JSON.stringify(hashedCodes)}::jsonb,
          password_reset_token = ${token},
          password_reset_expires_ts = ${expiresAt.toISOString()},
          updated_ts = NOW()
        WHERE id = ${person.id as string}
      `);

      return {
        success: true,
        recoveryToken: token,
        remainingCodes: hashedCodes.length
      };
    } catch (error) {
      fastify.log.error('Backup code recovery error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ===================================================================
  // LOGIN WITH MFA SUPPORT
  // ===================================================================

  /**
   * Login with MFA Support
   * Two-step authentication: password first, then MFA if enabled
   */
  fastify.post('/login/mfa', {
    schema: {
      tags: ['auth'],
      summary: 'Login with MFA support',
      description: 'Authenticate with optional MFA verification',
      body: MFALoginRequestSchema,
      response: {
        200: MFALoginResponseSchema,
        401: ErrorResponseSchema,
        423: ErrorResponseSchema,
        500: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    const { email, password, mfaCode } = request.body as {
      email: string;
      password: string;
      mfaCode?: string;
    };

    try {
      // Find person by email
      const personResult = await db.execute(sql`
        SELECT
          p.id,
          p.email,
          p.password_hash,
          p.entity_code,
          p.employee_id,
          p.customer_id,
          p.failed_login_attempts,
          p.account_locked_until_ts,
          p.permanent_lock_flag,
          p.mfa_enabled_flag,
          p.mfa_secret,
          p.mfa_backup_codes
        FROM app.person p
        WHERE p.email = ${email}
          AND p.active_flag = true
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

      // Check if MFA is required
      if (person.mfa_enabled_flag && !mfaCode) {
        // Generate temporary MFA token for second step
        const mfaToken = fastify.jwt.sign(
          { sub: person.id as string, purpose: 'mfa_verification' },
          { expiresIn: '5m' }
        );

        return {
          requiresMFA: true,
          mfaToken
        };
      }

      // Verify MFA code if provided
      if (person.mfa_enabled_flag && mfaCode) {
        // Try TOTP first
        let isValidMFA = verifyTOTP(person.mfa_secret as string, mfaCode);

        // If TOTP fails, try backup code
        if (!isValidMFA && mfaCode.includes('-')) {
          const hashedCodes = (person.mfa_backup_codes as string[]) || [];
          const { valid, index } = await verifyBackupCode(mfaCode, hashedCodes);
          if (valid) {
            isValidMFA = true;
            // Remove used backup code
            hashedCodes.splice(index, 1);
            await db.execute(sql`
              UPDATE app.person
              SET mfa_backup_codes = ${JSON.stringify(hashedCodes)}::jsonb
              WHERE id = ${person.id as string}
            `);
          }
        }

        if (!isValidMFA) {
          return reply.status(401).send({ error: 'Invalid MFA code' });
        }
      }

      // Get entity profile
      let entityProfile: any = null;
      const entityCode = person.entity_code as string;

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

      // Update login tracking
      const loginEntry = createLoginHistoryEntry(
        request.ip || 'unknown',
        request.headers['user-agent'] || 'unknown',
        true,
        person.mfa_enabled_flag ? 'mfa' : 'password'
      );

      await db.execute(sql`
        UPDATE app.person
        SET
          failed_login_attempts = 0,
          account_locked_until_ts = NULL,
          last_login_ts = NOW(),
          login_count = COALESCE(login_count, 0) + 1,
          login_history = COALESCE(login_history, '[]'::jsonb) || ${JSON.stringify([loginEntry])}::jsonb
        WHERE id = ${person.id as string}
      `);

      // Generate JWT token
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
        requiresMFA: false,
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
      fastify.log.error('MFA login error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * Complete MFA Login (second step)
   */
  fastify.post('/login/mfa/verify', {
    schema: {
      tags: ['auth'],
      summary: 'Verify MFA code',
      description: 'Complete MFA login by verifying the TOTP code',
      body: Type.Object({
        mfaToken: Type.String(),
        code: Type.String({ minLength: 6 })
      }),
      response: {
        200: LoginResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    const { mfaToken, code } = request.body as { mfaToken: string; code: string };

    try {
      // Verify MFA token
      let decoded: any;
      try {
        decoded = fastify.jwt.verify(mfaToken);
      } catch {
        return reply.status(401).send({ error: 'Invalid or expired MFA token' });
      }

      if (decoded.purpose !== 'mfa_verification') {
        return reply.status(401).send({ error: 'Invalid token type' });
      }

      const personId = decoded.sub;

      // Get person
      const personResult = await db.execute(sql`
        SELECT id, email, entity_code, employee_id, customer_id, mfa_secret, mfa_backup_codes
        FROM app.person WHERE id = ${personId}
      `);

      if (personResult.length === 0) {
        return reply.status(401).send({ error: 'User not found' });
      }

      const person = personResult[0];

      // Verify MFA code
      let isValid = verifyTOTP(person.mfa_secret as string, code);

      // Try backup code if TOTP fails
      if (!isValid && code.includes('-')) {
        const hashedCodes = (person.mfa_backup_codes as string[]) || [];
        const { valid, index } = await verifyBackupCode(code, hashedCodes);
        if (valid) {
          isValid = true;
          hashedCodes.splice(index, 1);
          await db.execute(sql`
            UPDATE app.person SET mfa_backup_codes = ${JSON.stringify(hashedCodes)}::jsonb
            WHERE id = ${personId}
          `);
        }
      }

      if (!isValid) {
        return reply.status(401).send({ error: 'Invalid MFA code' });
      }

      // Get entity profile
      let entityProfile: any = null;
      const entityCode = person.entity_code as string;

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

      // Update login tracking
      const loginEntry = createLoginHistoryEntry(
        request.ip || 'unknown',
        request.headers['user-agent'] || 'unknown',
        true,
        'mfa'
      );

      await db.execute(sql`
        UPDATE app.person
        SET
          failed_login_attempts = 0,
          last_login_ts = NOW(),
          login_count = COALESCE(login_count, 0) + 1,
          login_history = COALESCE(login_history, '[]'::jsonb) || ${JSON.stringify([loginEntry])}::jsonb
        WHERE id = ${personId}
      `);

      // Generate JWT token
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
      fastify.log.error('MFA verify error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
