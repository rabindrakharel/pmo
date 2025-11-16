import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { unified_data_gate, Permission } from './unified-data-gate.js';

/**
 * Entity-to-Table Mapping
 *
 * Maps entity type names to their corresponding database table names.
 * Used by child entity route factories to automatically resolve table names.
 *
 * Convention: Most entities use 'd_{entity}' pattern, with these exceptions:
 * - 'cust' → 'd_client'
 * - 'form' → 'd_form_head'
 * - 'biz' (legacy) → 'd_business'
 * - Fact tables: 'order', 'invoice', 'shipment', etc. → 'f_{entity}'
 */
export const ENTITY_TABLE_MAP: Record<string, string> = {
  // Core entities (d_ prefix)
  task: 'd_task',
  project: 'd_project',
  employee: 'd_employee',
  role: 'd_role',
  position: 'd_position',
  office: 'd_office',
  worksite: 'd_worksite',
  wiki: 'd_wiki',
  artifact: 'd_artifact',
  reports: 'd_reports',
  calendar: 'd_entity_person_calendar',
  service: 'd_service',
  product: 'd_product',
  workflow: 'd_workflow',
  workflow_automation: 'd_workflow_automation',
  event: 'd_event',

  // Entities with different naming
  cust: 'd_client',
  business: 'd_business',
  biz: 'd_business', // Legacy alias
  form: 'd_form_head',
  message_schema: 'd_message_schema',

  // Hierarchy entities
  office_hierarchy: 'd_office_hierarchy',
  business_hierarchy: 'd_business_hierarchy',
  product_hierarchy: 'd_product_hierarchy',

  // Fact tables (f_ prefix)
  order: 'f_order',
  invoice: 'f_invoice',
  shipment: 'f_shipment',
  expense: 'f_expense',
  revenue: 'f_revenue',
  interaction: 'f_interaction',
  message: 'f_message',
  quote: 'fact_quote',
  work_order: 'fact_work_order',

  // Special entities
  rbac: 'd_entity_rbac'
};

/**
 * Resolve Database Table Name for Entity Type
 *
 * @param entityType - Entity type code (e.g., 'task', 'form', 'cust')
 * @returns Database table name (e.g., 'd_task', 'd_form_head', 'd_client')
 */
export function getEntityTableName(entityType: string): string {
  // Check map first
  if (ENTITY_TABLE_MAP[entityType]) {
    return ENTITY_TABLE_MAP[entityType];
  }

  // Default convention: d_{entity}
  return `d_${entityType}`;
}

/**
 * Auto-Create Child Entity Endpoints from d_entity Metadata
 *
 * Reads child entity relationships from d_entity table and automatically creates
 * all child entity endpoints for a given parent. This eliminates the need to
 * manually specify each child relationship in route files.
 *
 * Benefits:
 * - Single source of truth: Child relationships defined only in d_entity DDL
 * - Zero repetition: No need to manually list children in every route file
 * - Self-documenting: Entity structure is database-driven
 * - Maintainable: Add new child entity → update d_entity → endpoints auto-created
 *
 * @example
 * // Before (manual repetition):
 * createChildEntityEndpoint(fastify, 'project', 'task', 'd_task');
 * createChildEntityEndpoint(fastify, 'project', 'wiki', 'd_wiki');
 * createChildEntityEndpoint(fastify, 'project', 'form', 'd_form_head');
 * createChildEntityEndpoint(fastify, 'project', 'artifact', 'd_artifact');
 *
 * // After (database-driven):
 * await createChildEntityEndpointsFromMetadata(fastify, 'project');
 *
 * @param fastify - Fastify instance
 * @param parentEntity - Parent entity type (e.g., 'project', 'task', 'office')
 */
export async function createChildEntityEndpointsFromMetadata(
  fastify: FastifyInstance,
  parentEntity: string
) {
  try {
    // Query d_entity for child_entities metadata
    const result = await db.execute(sql`
      SELECT child_entities
      FROM app.d_entity
      WHERE code = ${parentEntity}
        AND active_flag = true
    `);

    if (result.length === 0) {
      fastify.log.warn(`No entity metadata found for '${parentEntity}' in d_entity`);
      return;
    }

    const metadata = result[0];
    let childEntities = metadata.child_entities || [];

    // Handle both string and array formats
    if (typeof childEntities === 'string') {
      childEntities = JSON.parse(childEntities);
    }

    if (!Array.isArray(childEntities)) {
      fastify.log.warn(`Invalid child_entities format for '${parentEntity}': expected array`);
      return;
    }

    // Handle both simple arrays ['task', 'wiki'] and complex objects [{ entity: 'task' }]
    const childCodes = childEntities.map((child: any) =>
      typeof child === 'string' ? child : child.entity
    );

    if (childCodes.length === 0) {
      fastify.log.info(`No child entities defined for '${parentEntity}'`);
      return;
    }

    // Create endpoints for each child entity
    for (const childEntity of childCodes) {
      const childTable = getEntityTableName(childEntity);

      fastify.log.info(
        `Creating child entity endpoint: /api/v1/${parentEntity}/:id/${childEntity} (table: ${childTable})`
      );

      // ═══════════════════════════════════════════════════════════════
      // Inline endpoint creation - Single source of truth pattern
      // ═══════════════════════════════════════════════════════════════
      fastify.get(`/api/v1/${parentEntity}/:id/${childEntity}`, {
        preHandler: [fastify.authenticate],
        schema: {
          params: Type.Object({
            id: Type.String({ format: 'uuid' })
          }),
          querystring: Type.Object({
            page: Type.Optional(Type.Integer({ minimum: 1 })),
            limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 }))
          })
        }
      }, async (request, reply) => {
        try {
          const { id: parentId } = request.params as { id: string };
          const { page = 1, limit = 20 } = request.query as any;
          const userId = request.user?.sub;

          if (!userId) {
            return reply.status(401).send({ error: 'User not authenticated' });
          }

          // ✅ UNIFIED DATA GATE: RBAC check for child entity access
          // Note: We check child entity permission, NOT parent (child can be visible without parent access)
          const rbacCondition = await unified_data_gate.rbac_gate.getWhereCondition(
            userId,
            childEntity,
            Permission.VIEW,
            'c'
          );

          // ✅ UNIFIED DATA GATE: Parent-child filtering (mandatory for child entity listing)
          const parentJoin = unified_data_gate.parent_child_filtering_gate.getJoinClause(
            childEntity,
            parentEntity,
            parentId,
            'c'
          );

          // Universal child entity query pattern
          const offset = (page - 1) * limit;

          const data = await db.execute(sql`
            SELECT c.*, COALESCE(c.name, 'Untitled') as name, c.descr
            FROM app.${sql.raw(childTable)} c
            ${parentJoin}
            WHERE ${rbacCondition}
              AND c.active_flag = true
            ORDER BY c.created_ts DESC
            LIMIT ${limit} OFFSET ${offset}
          `);

          // Universal count query pattern with unified data gate
          const countResult = await db.execute(sql`
            SELECT COUNT(*) as total
            FROM app.${sql.raw(childTable)} c
            ${parentJoin}
            WHERE ${rbacCondition}
              AND c.active_flag = true
          `);

          return {
            data,
            total: Number(countResult[0]?.total || 0),
            page,
            limit
          };
        } catch (error: any) {
          fastify.log.error({
            msg: `Error fetching ${parentEntity} ${childEntity}`,
            error: error.message,
            stack: error.stack,
            parentEntity,
            childEntity,
            childTable
          });
          return reply.status(500).send({ error: 'Internal server error' });
        }
      });
    }

    fastify.log.info(
      `✓ Auto-created ${childCodes.length} child entity endpoints for '${parentEntity}' from d_entity metadata`
    );
  } catch (error) {
    fastify.log.error(
      `Failed to create child entity endpoints for '${parentEntity}':`,
      error
    );
    throw error;
  }
}

/**
 * Create Minimal Child Entity Instance with Automatic Linkage
 *
 * Creates a POST endpoint that:
 * 1. Creates a new child entity instance with minimal data (ID + name + defaults)
 * 2. Automatically creates the parent-child linkage in d_entity_instance_link
 * 3. Returns the new entity ID for immediate navigation to detail page
 *
 * This implements the create-then-link-then-edit workflow:
 * - Frontend calls: POST /api/v1/:parentType/:parentId/:childType/create-minimal
 * - Backend creates child record + linkage
 * - Frontend navigates to: /:childType/:newId for editing
 *
 * @param fastify - Fastify instance
 * @param parentEntity - Parent entity type (e.g., 'project')
 * @param childEntity - Child entity type (e.g., 'task')
 * @param childTable - Database table name (e.g., 'd_task')
 */
export function createMinimalChildEntityEndpoint(
  fastify: FastifyInstance,
  parentEntity: string,
  childEntity: string,
  childTable: string
) {
  fastify.post(`/api/v1/${parentEntity}/:id/${childEntity}/create-minimal`, {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
      body: Type.Object({
        name: Type.Optional(Type.String())
      }),
      response: {
        201: Type.Object({
          id: Type.String(),
          name: Type.String(),
          message: Type.String()
        }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    try {
      const { id: parentId } = request.params as { id: string };
      const { name } = request.body as { name?: string };
      const userId = (request as any).user?.sub;

      if (!userId) {
        return reply.status(401).send({ error: 'User not authenticated' });
      }

      // Check parent access permission
      const parentAccess = await db.execute(sql`
        SELECT 1 FROM app.d_entity_rbac rbac
        WHERE rbac.person_entity_name = 'employee' AND rbac.person_entity_id = ${userId}
          AND rbac.entity_name = ${parentEntity}
          AND (rbac.entity_id = ${parentId}::uuid OR rbac.entity_id = '11111111-1111-1111-1111-111111111111'::uuid)
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND rbac.permission >= 0
      `);

      if (parentAccess.length === 0) {
        return reply.status(403).send({ error: `Access denied for this ${parentEntity}` });
      }

      // Check child entity create permission
      const createAccess = await db.execute(sql`
        SELECT 1 FROM app.d_entity_rbac rbac
        WHERE rbac.person_entity_name = 'employee' AND rbac.person_entity_id = ${userId}
          AND rbac.entity_name = ${childEntity}
          AND rbac.entity_id = '11111111-1111-1111-1111-111111111111'::uuid
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND rbac.permission >= 4
      `);

      if (createAccess.length === 0) {
        return reply.status(403).send({ error: `Insufficient permissions to create ${childEntity}` });
      }

      // Generate default values
      const defaultName = name || `New ${childEntity.charAt(0).toUpperCase() + childEntity.slice(1)}`;
      const timestamp = new Date().toISOString();
      const autoCode = `${childEntity.toUpperCase()}-${Date.now()}`;
      const autoSlug = `${childEntity}-${Date.now()}`;

      // STEP 1: Create minimal child entity record
      const createResult = await db.execute(sql`
        INSERT INTO app.${sql.raw(childTable)} (
          name,
          code,
          descr,
          metadata,
          active_flag,
          created_ts,
          updated_ts,
          version
        ) VALUES (
          ${defaultName},
          ${autoCode},
          ${autoSlug},
          'Draft - please complete the details',
          '[]'::jsonb,
          '{}'::jsonb,
          true,
          ${timestamp},
          ${timestamp},
          1
        )
        RETURNING id, name
      `);

      const newEntity = createResult[0];
      const newEntityId = newEntity.id;

      // STEP 2: Create parent-child linkage in d_entity_instance_link
      await db.execute(sql`
        INSERT INTO app.d_entity_instance_link (
          parent_entity_type,
          parent_entity_id,
          child_entity_type,
          child_entity_id,
          relationship_type,
          active_flag,
          created_ts,
          updated_ts
        ) VALUES (
          ${parentEntity},
          ${parentId},
          ${childEntity},
          ${newEntityId},
          'contains',
          true,
          ${timestamp},
          ${timestamp}
        )
      `);

      fastify.log.info(`Created ${childEntity} ${newEntityId} and linked to ${parentEntity} ${parentId}`);

      // STEP 3: Return entity ID for frontend navigation
      return reply.status(201).send({
        id: newEntityId,
        name: defaultName,
        message: `${childEntity} created successfully. Please complete the details.`
      });

    } catch (error: any) {
      fastify.log.error(`Error creating minimal ${childEntity}:`, error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
