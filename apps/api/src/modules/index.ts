import type { FastifyInstance } from 'fastify';
// Core authentication and metadata modules
import { authRoutes } from './auth/routes.js';
import { schemaRoutes } from './schema/routes.js';
import { metaRoutes } from './meta/routes.js';
import { settingRoutes } from './setting/routes.js';
import { configRoutes } from '../routes/config.js';

// Entity-based API modules
import { empRoutes } from './employee/routes.js';
import { taskRoutes } from './task/routes.js';
import { projectRoutes } from './project/routes.js';
import { roleRoutes } from './role/routes.js';
import { clientRoutes } from './client/routes.js';
import { formRoutes } from './form/routes.js';
import { wikiRoutes } from './wiki/routes.js';
import { artifactRoutes } from './artifact/routes.js';
import { bizRoutes } from './biz/routes.js';
import { officeRoutes } from './office/routes.js';
import { positionRoutes } from './position/routes.js';
import { worksiteRoutes } from './worksite/routes.js';
import { reportsRoutes } from './reports/routes.js';
import { taskDataRoutes } from './task-data/routes.js';

// New hierarchical API modules
import { hierarchyRoutes } from './meta/hierarchy-routes.js';
import { singleEntityRoutes } from './entity/single-entity-routes.js';
import { parentActionEntityRoutes } from './entity/parent-action-entity-routes.js';
import { rbacRoutes } from './rbac/routes.js';

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

  // Metadata routes (legacy - deprecated)
  await metaRoutes(fastify);

  // Setting routes (new)
  await settingRoutes(fastify);

  // Hierarchical metadata routes
  await hierarchyRoutes(fastify);
  
  // Single entity routes
  await singleEntityRoutes(fastify);

  // Parent/action entity routes
  await parentActionEntityRoutes(fastify);


  // RBAC permission checking routes
  await rbacRoutes(fastify);

  // Entity-based API routes (all require entity-based RBAC)
  await empRoutes(fastify);
  await taskRoutes(fastify);
  await projectRoutes(fastify);
  await roleRoutes(fastify);
  await clientRoutes(fastify);
  await formRoutes(fastify);
  await wikiRoutes(fastify);
  await artifactRoutes(fastify);
  await bizRoutes(fastify);
  await officeRoutes(fastify);
  await positionRoutes(fastify);
  await worksiteRoutes(fastify);
  await reportsRoutes(fastify);
  await taskDataRoutes(fastify);
}
