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
import { custRoutes } from './cust/routes.js';
import { formRoutes } from './form/routes.js';
import { wikiRoutes } from './wiki/routes.js';
import { artifactRoutes } from './artifact/routes.js';
import { bizRoutes } from './biz/routes.js';
import { officeRoutes } from './office/routes.js';
import { positionRoutes } from './position/routes.js';
import { worksiteRoutes } from './worksite/routes.js';
import { reportsRoutes } from './reports/routes.js';
import { taskDataRoutes } from './task-data/routes.js';
import { emailTemplateRoutes } from './email-template/routes.js';
import { uploadRoutes } from './upload/routes.js';
import s3BackendRoutes from './s3-backend/routes.js';
import { workflowAutomationRoutes } from './workflow-automation/routes.js';

// Product & Operations API modules
import { productRoutes } from './product/routes.js';
import { inventoryRoutes } from './inventory/routes.js';
import { orderRoutes } from './order/routes.js';
import { shipmentRoutes } from './shipment/routes.js';
import { invoiceRoutes } from './invoice/routes.js';

// Financial API modules
import { costRoutes } from './cost/routes.js';
import { revenueRoutes } from './revenue/routes.js';

// New hierarchical API modules
import { hierarchyRoutes } from './meta/hierarchy-routes.js';
import { singleEntityRoutes } from './entity/single-entity-routes.js';
import { parentActionEntityRoutes } from './entity/parent-action-entity-routes.js';
import { entityRoutes } from './entity/routes.js';
import { rbacRoutes } from './rbac/routes.js';
import { linkageModule } from './linkage/index.js';
import { sharedRoutes } from './shared/routes.js';
import { entityOptionsRoutes } from './entity-options/routes.js';

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

  // Shared URL routes (public access for shared entity viewing)
  await sharedRoutes(fastify);

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

  // Entity type metadata routes (d_entity - parent-child relationships, icons)
  await entityRoutes(fastify);

  // Entity options routes (universal dropdown/selection options)
  await entityOptionsRoutes(fastify);

  // RBAC permission checking routes
  await rbacRoutes(fastify);

  // Linkage routes (entity relationship management - both type and instance)
  await linkageModule(fastify);

  // Entity-based API routes (all require entity-based RBAC)
  await empRoutes(fastify);
  await taskRoutes(fastify);
  await projectRoutes(fastify);
  await roleRoutes(fastify);
  await custRoutes(fastify);
  await formRoutes(fastify);
  await wikiRoutes(fastify);
  await artifactRoutes(fastify);
  await bizRoutes(fastify);
  await officeRoutes(fastify);
  await positionRoutes(fastify);
  await worksiteRoutes(fastify);
  await reportsRoutes(fastify);
  await taskDataRoutes(fastify);
  await emailTemplateRoutes(fastify);
  await workflowAutomationRoutes(fastify);

  // Product & Operations API routes
  await productRoutes(fastify);
  await inventoryRoutes(fastify);
  await orderRoutes(fastify);
  await shipmentRoutes(fastify);
  await invoiceRoutes(fastify);

  // Financial API routes
  await costRoutes(fastify);
  await revenueRoutes(fastify);

  // Upload routes (file upload to MinIO/S3)
  await uploadRoutes(fastify);

  // S3 Backend routes (presigned URLs and attachment management)
  await fastify.register(s3BackendRoutes, { prefix: '/api/v1/s3-backend' });
}
