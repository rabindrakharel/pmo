import type { FastifyInstance } from 'fastify';
// Core working modules
import { empRoutes } from './employee/routes.js';
import { taskRoutes } from './task/routes.js';
import { metaRoutes } from './meta/routes.js';
import { authRoutes } from './auth/routes.js';
import { schemaRoutes } from './schema/routes.js';
import { configRoutes } from '../routes/config.js';

// Temporarily commented out to fix auth removal issues
// import { scopeLocationRoutes } from './scope-location/routes.js';
// import { scopeBusinessRoutes } from './scope-business/routes.js';
// import { scopeHRRoutes } from './scope-hr/routes.js';
// import { roleRoutes } from './role/routes.js';
// import { formRoutes } from './form/routes.js';
// import { projectRoutes } from './project/routes.js';
// import { wikiRoutes } from './wiki/routes.js';
// import { artifactRoutes } from './artifact/routes.js';
// import { worksiteRoutes } from './scope-worksite/routes.js';
// import { clientRoutes } from './client/routes.js';

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

  // Schema API routes (requires auth)
  await schemaRoutes(fastify);

  // Configuration API routes
  await configRoutes(fastify);

  // Register core route modules (temporarily disabled others due to authentication removal)
  await empRoutes(fastify);
  await taskRoutes(fastify);
  await metaRoutes(fastify);
  
  // Temporarily commented out to fix auth removal issues
  // await scopeLocationRoutes(fastify);
  // await scopeBusinessRoutes(fastify);
  // await scopeHRRoutes(fastify);
  // await roleRoutes(fastify);
  // await formRoutes(fastify);
  // await wikiRoutes(fastify);
  // await artifactRoutes(fastify);
  // await worksiteRoutes(fastify);
  // await clientRoutes(fastify);
  // await projectRoutes(fastify);
}
