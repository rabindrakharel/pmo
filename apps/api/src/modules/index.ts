import type { FastifyInstance } from 'fastify';
// Core authentication and metadata modules
import { authRoutes } from './auth/routes.js';
import { schemaRoutes } from './schema/routes.js';
import { metaRoutes } from './meta/routes.js';
import { settingRoutes } from './setting/routes.js';
import { datalabelRoutes } from './datalabel/routes.js';

// Entity-based API modules
import { empRoutes } from './employee/routes.js';
import { taskRoutes } from './task/routes.js';
import { projectRoutes } from './project/routes.js';
import { roleRoutes } from './role/routes.js';
import { custRoutes } from './cust/routes.js';
import { formRoutes } from './form/routes.js';
import { wikiRoutes } from './wiki/routes.js';
import { artifactRoutes } from './artifact/routes.js';
import { businessRoutes } from './business/routes.js';
import { officeRoutes } from './office/routes.js';
import { worksiteRoutes } from './worksite/routes.js';
import { taskDataRoutes } from './task-data/routes.js';
// import { messageSchemaRoutes } from './message-schema/routes.js'; // REMOVED: message_schema is template storage, not user-facing entity
import { messageDataRoutes } from './message-data/routes.js';
import { uploadRoutes } from './upload/routes.js';
import s3BackendRoutes from './s3-backend/routes.js';
import { workflowRoutes } from './workflow/routes.js';

// Product & Operations API modules
import { serviceRoutes } from './service/routes.js';
import { productRoutes } from './product/routes.js';
import { quoteRoutes } from './quote/routes.js';
import { workOrderRoutes } from './work_order/routes.js';
import { inventoryRoutes } from './inventory/routes.js';
import { orderRoutes } from './order/routes.js';
import { shipmentRoutes } from './shipment/routes.js';
import { invoiceRoutes } from './invoice/routes.js';

// Financial API modules (CRA T2125 compliant)
import { revenueRoutes } from './revenue/routes.js';
import { expenseRoutes } from './expense/routes.js';

// AI Chat Widget API module
import { chatRoutes } from './chat/routes.js';
import { personCalendarRoutes } from './person-calendar/routes.js';
import { personCalendarServiceRoutes } from './person-calendar/person-calendar-service.routes.js';
import { enrichedCalendarRoutes } from './person-calendar/calendar-enriched.routes.js';
import { interactionRoutes } from './interaction/routes.js';
import { eventRoutes } from './event/routes.js';
import { eventPersonCalendarRoutes } from './event-person-calendar/routes.js';

// Pure Agent Orchestrator API module (No LangGraph)
import { registerAgentOrchestratorRoutes } from './chat/orchestrator/agents/agent-orchestrator.routes.js';

// Collaborative Editing API module
import { collabRoutes } from './collab/routes.js';

// New hierarchical API modules
import { hierarchyRoutes } from './meta/hierarchy-routes.js';
import { singleEntityRoutes } from './entity/single-entity-routes.js';
import { entityRoutes } from './entity/routes.js';
import { rbacRoutes } from './rbac/routes.js';
import { linkageModule } from './linkage/index.js';
import { sharedRoutes } from './shared/routes.js';
import { entityInstanceLookupRoutes } from './entity-instance-lookup/routes.js';

// Hierarchy entity API modules
import { officeHierarchyRoutes } from './office-hierarchy/routes.js';
import { businessHierarchyRoutes } from './business-hierarchy/routes.js';
import { productHierarchyRoutes } from './product-hierarchy/routes.js';

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

  // Metadata routes (legacy - deprecated)
  await metaRoutes(fastify);

  // Setting routes (global settings only)
  await settingRoutes(fastify);

  // Datalabel routes (unified data labels for dropdowns)
  await datalabelRoutes(fastify);

  // Hierarchical metadata routes
  await hierarchyRoutes(fastify);
  
  // Single entity routes
  await singleEntityRoutes(fastify);

  // Entity type metadata routes (d_entity - parent-child relationships, icons)
  await entityRoutes(fastify);

  // Entity instance lookup routes (universal dropdown/selection options)
  await entityInstanceLookupRoutes(fastify);

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
  await businessRoutes(fastify);
  await officeRoutes(fastify);
  await worksiteRoutes(fastify);
  await taskDataRoutes(fastify);
  // await messageSchemaRoutes(fastify); // REMOVED: message_schema is template storage, not user-facing entity
  await messageDataRoutes(fastify);
  await workflowRoutes(fastify);

  // Hierarchy entity API routes
  await officeHierarchyRoutes(fastify);
  await businessHierarchyRoutes(fastify);
  await productHierarchyRoutes(fastify);

  // Product & Operations API routes
  await serviceRoutes(fastify);
  await productRoutes(fastify);
  await quoteRoutes(fastify);
  await workOrderRoutes(fastify);
  await inventoryRoutes(fastify);
  await orderRoutes(fastify);
  await shipmentRoutes(fastify);
  await invoiceRoutes(fastify);

  // Financial API routes (CRA T2125 compliant - revenue & expenses)
  await revenueRoutes(fastify);
  await expenseRoutes(fastify);

  // AI Chat Widget routes
  await fastify.register(chatRoutes, { prefix: '/api/v1/chat' });

  // Pure Agent Orchestrator routes (No LangGraph - pure agent-based system)
  await registerAgentOrchestratorRoutes(fastify);

  // Person-calendar service routes (unified event/calendar/notification orchestration)
  await personCalendarServiceRoutes(fastify);

  // Person Calendar routes (universal availability/booking calendar)
  await personCalendarRoutes(fastify);

  // Enriched Calendar routes (calendar with full event details)
  await enrichedCalendarRoutes(fastify);

  // Event routes (meetings/appointments as universal parent entities)
  await eventRoutes(fastify);

  // Event-Person-Calendar routes (event RSVP management)
  await eventPersonCalendarRoutes(fastify);

  // Interaction routes (customer interactions across channels)
  await interactionRoutes(fastify);

  // Collaborative editing routes (WebSocket + presence)
  await collabRoutes(fastify);

  // Upload routes (file upload to MinIO/S3)
  await uploadRoutes(fastify);

  // S3 Backend routes (presigned URLs and attachment management)
  await fastify.register(s3BackendRoutes, { prefix: '/api/v1/s3-backend' });
}
