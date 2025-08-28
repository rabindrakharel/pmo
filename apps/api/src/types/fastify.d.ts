import { FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  
  interface FastifyRequest {
    user?: {
      sub: string;
      email: string;
      name: string;
      tenant_id: string;
      roles: string[];
    };
  }
}