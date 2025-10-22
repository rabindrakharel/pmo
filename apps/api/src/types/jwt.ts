/**
 * JWT Payload Types
 * Defines the structure of JWT tokens used throughout the application
 */

export interface JwtPayload {
  sub: string;  // User ID (employee or customer)
  email: string;  // User email
  type?: 'employee' | 'customer';  // User type (optional for backward compatibility)
  name?: string;  // User name (optional)
  [key: string]: any;  // Allow additional properties for flexibility
}

/**
 * Fastify Type Augmentation
 * This tells TypeScript that request.user is a JwtPayload, not just string | object | Buffer
 */
declare module 'fastify' {
  interface FastifyRequest {
    user: JwtPayload;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}
