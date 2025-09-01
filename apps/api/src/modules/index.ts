import type { FastifyInstance } from 'fastify';
import { scopeLocationRoutes } from './scope-location/routes.js';
import { scopeBusinessRoutes } from './scope-business/routes.js';
import { scopeHRRoutes } from './scope-hr/routes.js';
import { empRoutes } from './employee/routes.js';
import { roleRoutes } from './role/routes.js';
import { formRoutes } from './form/routes.js';
import { projectRoutes } from './project/routes.js';
import { taskRoutes } from './task/routes.js';
// import { taskActivityRoutes } from './task/activity-routes.js';
import { metaRoutes } from './meta/routes.js';
import { worksiteRoutes } from './scope-worksite/routes.js';
import { clientRoutes } from './client/routes.js';
import { authRoutes } from './auth/routes.js';

/**
 * Register all API route modules with full RBAC functionality
 */
export async function registerAllRoutes(fastify: FastifyInstance): Promise<void> {
  // Health check route
  fastify.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Authentication routes (no auth required)
  await fastify.register(authRoutes, { prefix: '/api/v1/auth' });

  // Register all RBAC route modules
  await scopeLocationRoutes(fastify);
  await scopeBusinessRoutes(fastify);
  await scopeHRRoutes(fastify);
  await empRoutes(fastify);
  await roleRoutes(fastify);
  await formRoutes(fastify);
  await worksiteRoutes(fastify);
  await clientRoutes(fastify);
  await projectRoutes(fastify);
  await taskRoutes(fastify);
  // await taskActivityRoutes(fastify);
  await metaRoutes(fastify);
}