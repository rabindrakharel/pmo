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

// Login request schema
const LoginRequestSchema = Type.Object({
  email: Type.String({ format: 'email' }),
  password: Type.String({ minLength: 1 })});

// Login response schema
const LoginResponseSchema = Type.Object({
  token: Type.String(),
  employee: Type.Object({
    id: Type.String(),
    name: Type.String(),
    email: Type.String()})});

// User profile schema
const UserProfileSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  email: Type.String()});

// Customer signup request schema
const CustomerSignupRequestSchema = Type.Object({
  name: Type.String({ minLength: 2 }),
  primary_email: Type.String({ format: 'email' }),
  password: Type.String({ minLength: 8 }),
  cust_type: Type.Optional(Type.String())});

// Customer signup response schema
const CustomerSignupResponseSchema = Type.Object({
  token: Type.String(),
  customer: Type.Object({
    id: Type.String(),
    name: Type.String(),
    email: Type.String(),
    entities: Type.Array(Type.String())})});

// Customer profile schema
const CustomerProfileSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  email: Type.String(),
  entities: Type.Array(Type.String()),
  cust_type: Type.String()});

// Entity configuration request schema
const EntityConfigRequestSchema = Type.Object({
  entities: Type.Array(Type.String())});

// Permissions summary schema
const PermissionsSummarySchema = Type.Object({
  employeeId: Type.String(),
  isAdmin: Type.Boolean(),
  totalScopes: Type.Number(),
  scopesByType: Type.Record(Type.String(), Type.Number()),
  permissions: Type.Record(Type.String(), Type.Array(Type.String()))});

// Scope access schema
const ScopeAccessSchema = Type.Object({
  scopeType: Type.String(),
  accessibleIds: Type.Array(Type.String()),
  total: Type.Number()});

// Error response schema
const ErrorResponseSchema = Type.Object({
  error: Type.String()});

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
        500: ErrorResponseSchema}}}, async (request, reply) => {
    const { email, password } = request.body as {
      email: string;
      password: string;
    };

    try {
      // Find employee by email
      const employeeResult = await db.execute(sql`
        SELECT id, name, email, password_hash
        FROM app.employee
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
          name: employee.name as string},
        { expiresIn: config.JWT_EXPIRES_IN }
      );

      return {
        token,
        employee: {
          id: employee.id as string,
          name: employee.name as string,
          email: employee.email as string}};
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
        500: ErrorResponseSchema}}}, async (request, reply) => {
    try {
      // Get authenticated user ID from JWT token
      const userId = (request.user as any)?.sub;
      if (!userId) {
        return reply.status(401).send({ error: 'User not authenticated' });
      }

      // Get employee profile
      const employeeResult = await db.execute(sql`
        SELECT id, name, email
        FROM app.employee
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
        email: employee.email as string};
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
        500: ErrorResponseSchema}}}, async (request, reply) => {
    try {
      const employeeId = (request as any).user?.sub;
      
      if (!employeeId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Get entity-based permissions summary
      const entityTypes = ['biz', 'hr', 'org', 'client', 'project', 'task', 'worksite', 'employee', 'role', 'wiki', 'form', 'artifact'];
      const actions = ['view', 'create', 'edit', 'share'];
      
      const permissions: any = {};
      const entityCounts: any = {};

      for (const entityType of entityTypes) {
        entityCounts[entityType] = 0;
        permissions[entityType] = actions;
      }
      
      return {
        employeeId,
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

  // Get accessible entities by type
  fastify.get('/scopes/:entityType', {
    
    schema: {
      tags: ['auth', 'permissions'],
      summary: 'Get accessible entities by type',
      description: 'Get all entities of a specific type that the user has access to',
      params: Type.Object({
        entityType: Type.String()}),
      querystring: Type.Object({
        action: Type.Optional(Type.String())}),
      response: {
        200: ScopeAccessSchema,
        401: ErrorResponseSchema,
        400: ErrorResponseSchema,
        500: ErrorResponseSchema}}}, async (request, reply) => {
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

      // Convert action to permission level
      return {
        scopeType: entityType,
        accessibleIds: [],
        total: 0};
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
            referenceId: Type.String()})),
          summary: PermissionsSummarySchema}),
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        500: ErrorResponseSchema}}}, async (request, reply) => {
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
        referenceId: scope.referenceId}));

      const summary = await getEmployeePermissionsSummary(employeeId);

      return {
        employeeId,
        isAdmin: abilities.isAdmin,
        rawPermissions,
        summary};
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
          message: Type.String()}),
        401: ErrorResponseSchema}}}, async (request, reply) => {
    // Since we're using stateless JWT tokens, logout is mainly for client-side cleanup
    // In a more sophisticated setup, we could maintain a blacklist of tokens
    return { message: 'Logged out successfully' };
  });

  // ===================================================================
  // CUSTOMER AUTHENTICATION ENDPOINTS (App User Signup/Signin)
  // ===================================================================

  // Customer signup endpoint
  fastify.post('/customer/signup', {
    schema: {
      tags: ['auth', 'customer'],
      summary: 'Customer signup',
      description: 'Register a new customer user account',
      body: CustomerSignupRequestSchema,
      response: {
        201: CustomerSignupResponseSchema,
        400: ErrorResponseSchema,
        500: ErrorResponseSchema}}}, async (request, reply) => {
    const { name, primary_email, password, cust_type = 'residential' } = request.body as {
      name: string;
      primary_email: string;
      password: string;
      cust_type?: string;
    };

    try {
      // Check if email already exists
      const existingCustomer = await db.execute(sql`
        SELECT id FROM app.d_cust
        WHERE primary_email = ${primary_email}
          AND active_flag = true
      `);

      if (existingCustomer.length > 0) {
        return reply.status(400).send({ error: 'Email already registered' });
      }

      // Hash password
      const password_hash = await bcrypt.hash(password, 10);

      // Generate customer number (simple incrementing system)
      const lastCustNumber = await db.execute(sql`
        SELECT cust_number FROM app.d_cust
        WHERE cust_number LIKE 'APP-%'
        ORDER BY created_ts DESC
        LIMIT 1
      `);

      let custNumber = 'APP-0001';
      if (lastCustNumber.length > 0) {
        const lastNum = parseInt((lastCustNumber[0].cust_number as string).split('-')[1]) || 0;
        custNumber = `APP-${String(lastNum + 1).padStart(4, '0')}`;
      }

      // Create customer account
      const result = await db.execute(sql`
        INSERT INTO app.d_cust (
          name,
          cust_number,
          cust_type,
          cust_status,
          primary_email,
          password_hash,
          entities,
          code
        ) VALUES (
          ${name},
          ${custNumber},
          ${cust_type},
          'active',
          ${primary_email},
          ${password_hash},
          ARRAY[]::text[],
          ${name.toLowerCase().replace(/\s+/g, '-')},
          ${custNumber}
        )
        RETURNING id, name, primary_email, entities
      `);

      const customer = result[0];
      if (!customer) {
        return reply.status(500).send({ error: 'Failed to create account' });
      }

      // Generate JWT token
      const token = fastify.jwt.sign(
        {
          sub: customer.id as string,
          email: customer.primary_email as string,
          name: customer.name as string,
          userType: 'customer'},
        { expiresIn: config.JWT_EXPIRES_IN }
      );

      reply.status(201);
      return {
        token,
        customer: {
          id: customer.id as string,
          name: customer.name as string,
          email: customer.primary_email as string,
          entities: (customer.entities as string[]) || []}};
    } catch (error) {
      fastify.log.error('Customer signup error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Customer signin endpoint
  fastify.post('/customer/signin', {
    schema: {
      tags: ['auth', 'customer'],
      summary: 'Customer signin',
      description: 'Authenticate customer and return JWT token',
      body: LoginRequestSchema,
      response: {
        200: CustomerSignupResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema}}}, async (request, reply) => {
    const { email, password } = request.body as {
      email: string;
      password: string;
    };

    try {
      // Find customer by email
      const customerResult = await db.execute(sql`
        SELECT id, name, primary_email, password_hash, entities
        FROM app.d_cust
        WHERE primary_email = ${email}
          AND active_flag = true
          AND password_hash IS NOT NULL
      `);

      if (customerResult.length === 0) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const customer = customerResult[0];
      const passwordHash = customer.password_hash as string | null;

      if (!passwordHash) {
        return reply.status(401).send({ error: 'Account not properly configured' });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, passwordHash);
      if (!isValidPassword) {
        // Increment failed login attempts
        await db.execute(sql`
          UPDATE app.d_cust
          SET failed_login_attempts = failed_login_attempts + 1,
              account_locked_until = CASE
                WHEN failed_login_attempts >= 4
                THEN NOW() + INTERVAL '30 minutes'
                ELSE account_locked_until
              END
          WHERE id = ${customer.id as string}
        `);
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      // Update last login and reset failed attempts
      await db.execute(sql`
        UPDATE app.d_cust
        SET last_login_ts = NOW(),
            failed_login_attempts = 0,
            account_locked_until = NULL
        WHERE id = ${customer.id as string}
      `);

      // Generate JWT token
      const token = fastify.jwt.sign(
        {
          sub: customer.id as string,
          email: customer.primary_email as string,
          name: customer.name as string,
          userType: 'customer'},
        { expiresIn: config.JWT_EXPIRES_IN }
      );

      return {
        token,
        customer: {
          id: customer.id as string,
          name: customer.name as string,
          email: customer.primary_email as string,
          entities: (customer.entities as string[]) || []}};
    } catch (error) {
      fastify.log.error('Customer signin error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get customer profile
  fastify.get('/customer/me', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth', 'customer'],
      summary: 'Get customer profile',
      description: 'Get the profile of the currently authenticated customer',
      response: {
        200: CustomerProfileSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema}}}, async (request, reply) => {
    try {
      const userId = (request.user as any)?.sub;
      const userType = (request.user as any)?.userType;

      if (!userId || userType !== 'customer') {
        return reply.status(401).send({ error: 'Not authenticated as customer' });
      }

      const customerResult = await db.execute(sql`
        SELECT id, name, primary_email, entities, cust_type
        FROM app.d_cust
        WHERE id = ${userId}
          AND active_flag = true
      `);

      if (customerResult.length === 0) {
        return reply.status(401).send({ error: 'Customer not found' });
      }

      const customer = customerResult[0];
      return {
        id: customer.id as string,
        name: customer.name as string,
        email: customer.primary_email as string,
        entities: (customer.entities as string[]) || [],
        cust_type: customer.cust_type as string};
    } catch (error) {
      fastify.log.error('Get customer profile error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update customer entity configuration
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
        500: ErrorResponseSchema}}}, async (request, reply) => {
    const { entities } = request.body as { entities: string[] };

    try {
      const userId = (request.user as any)?.sub;
      const userType = (request.user as any)?.userType;

      if (!userId || userType !== 'customer') {
        return reply.status(401).send({ error: 'Not authenticated as customer' });
      }

      // Validate entities array
      const validEntities = [
        'biz', 'office', 'project', 'task', 'employee', 'role', 'worksite',
        'cust', 'position', 'artifact', 'wiki', 'form', 'marketing',
        'product', 'inventory', 'order', 'invoice', 'shipment'
      ];

      const invalidEntities = entities.filter(e => !validEntities.includes(e));
      if (invalidEntities.length > 0) {
        return reply.status(400).send({
          error: `Invalid entities: ${invalidEntities.join(', ')}`
        });
      }

      // Update customer entities
      const result = await db.execute(sql`
        UPDATE app.d_cust
        SET entities = ${sql`ARRAY[${sql.join(entities.map(e => sql`${e}`), sql`, `)}]::text[]`},
            updated_ts = NOW()
        WHERE id = ${userId}
        RETURNING id, name, primary_email, entities, cust_type
      `);

      if (result.length === 0) {
        return reply.status(401).send({ error: 'Customer not found' });
      }

      const customer = result[0];
      return {
        id: customer.id as string,
        name: customer.name as string,
        email: customer.primary_email as string,
        entities: (customer.entities as string[]) || [],
        cust_type: customer.cust_type as string};
    } catch (error) {
      fastify.log.error('Configure customer entities error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

}