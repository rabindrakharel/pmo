import type { FastifyInstance } from 'fastify';
// Core authentication and metadata modules
import { authRoutes } from './auth/routes.js';
import { schemaRoutes } from './schema/routes.js';
import { metaRoutes } from './meta/routes.js';
import { configRoutes } from '../routes/config.js';

// Entity-based API modules
import { empRoutes } from './employee/routes.js';
import { taskRoutes } from './task/routes.js';
import { projectRoutes } from './project/routes.js';
import { roleRoutes } from './role/routes.js';
import { clientRoutes } from './client/routes.js';
import { formRoutes } from './form/routes.js';
// import { wikiRoutes } from './wiki/routes.js';
import { artifactRoutes } from './artifact/routes.js';
import { bizRoutes } from './biz/routes.js';

// New hierarchical API modules
import { hierarchyRoutes } from './meta/hierarchy-routes.js';
import { universalEntityRoutes } from './entity/universal-entity-routes.js';
import { nestedEntityRoutes } from './entity/nested-entity-routes.js';

/**
 * Register all API route modules with entity-based RBAC functionality
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

  // Metadata routes
  await metaRoutes(fastify);
  
  // Hierarchical metadata routes
  await hierarchyRoutes(fastify);
  
  // Universal entity routes
  await universalEntityRoutes(fastify);
  
  // Nested parent/action entity routes
  await nestedEntityRoutes(fastify);

  // Entity-based API routes (all require entity-based RBAC)
  await empRoutes(fastify);
  await taskRoutes(fastify);
  await projectRoutes(fastify);
  await roleRoutes(fastify);
  await clientRoutes(fastify);
  await formRoutes(fastify);
  // await wikiRoutes(fastify); // Temporarily disabled due to syntax errors
  await artifactRoutes(fastify);
  await bizRoutes(fastify);

  // TODO: Add new entity routes as they are implemented
  // await hrRoutes(fastify);       // HR positions and hierarchy
  // await orgRoutes(fastify);      // Geographic organization
  // await worksiteRoutes(fastify); // Physical worksites
}
