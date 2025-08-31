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
          AND active = true
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

      // Generate JWT token
      const token = jwt.sign(
        {
          sub: employee.id as string,
          email: employee.email as string,
          name: employee.name as string,
        },
        config.JWT_SECRET,
        { expiresIn: config.JWT_EXPIRES_IN } as jwt.SignOptions
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




}