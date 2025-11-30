import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db, client } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { getEntityInfrastructure, Permission } from '../services/entity-infrastructure.service.js';
import { PAGINATION_CONFIG } from './pagination.js';
import { generateEntityResponse } from '../services/backend-formatter.service.js';

/**
 * Entity-to-Table Mapping
 *
 * Maps entity type names to their corresponding database table names.
 * Used by child entity route factories to automatically resolve table names.
 *
 * Convention: Most entities use direct mapping (entity code = table name), with these exceptions:
 * - 'form' → 'form' (form has head/data split)
 * - 'wiki' → 'wiki' (wiki has head/data split, head table is just 'wiki')
 * - 'invoice' → 'invoice' (invoice table, invoice_data for line items)
 * - 'biz' (legacy) → 'business'
 */
export const ENTITY_TABLE_MAP: Record<string, string> = {
  // Core entities (direct mapping)
  task: 'task',
  project: 'project',
  employee: 'employee',
  role: 'role',
  office: 'office',
  worksite: 'worksite',
  wiki: 'wiki',
  artifact: 'artifact',
  service: 'service',
  product: 'product',
  event: 'event',
  cust: 'cust',
  business: 'business',
  order: 'order',
  shipment: 'shipment',
  expense: 'expense',
  revenue: 'revenue',
  quote: 'quote',
  work_order: 'work_order',

  // Entities with head/data split
  form: 'form',
  invoice: 'invoice',
  message: 'message_data',

  // Hierarchy entities
  office_hierarchy: 'office_hierarchy',
  business_hierarchy: 'business_hierarchy',
  product_hierarchy: 'product_hierarchy',

  // Calendar entities
  calendar: 'entity_person_calendar',
  event_person_calendar: 'entity_event_person_calendar',

  // Legacy aliases
  biz: 'business',

  // Special entities
  rbac: 'entity_rbac',
  message_schema: 'message_schema'
};

/**
 * Resolve Database Table Name for Entity Type
 *
 * @param entityCode - Entity type code (e.g., 'task', 'form', 'cust')
 * @returns Database table name (e.g., 'task', 'form', 'cust')
 */
export function getEntityTableName(entityCode: string): string {
  // Check map first
  if (ENTITY_TABLE_MAP[entityCode]) {
    return ENTITY_TABLE_MAP[entityCode];
  }

  // Default convention: direct mapping (entity code = table name)
  return entityCode;
}

/**
 * Auto-Create Child Entity Endpoints from entity Metadata
 *
 * Reads child entity relationships from entity table and automatically creates
 * all child entity endpoints for a given parent. This eliminates the need to
 * manually specify each child relationship in route files.
 *
 * Benefits:
 * - Single source of truth: Child relationships defined only in entity DDL
 * - Zero repetition: No need to manually list children in every route file
 * - Self-documenting: Entity structure is database-driven
 * - Maintainable: Add new child entity → update d_entity → endpoints auto-created
 *
 * @example
 * // Before (manual repetition):
 * createChildEntityEndpoint(fastify, 'project', 'task', 'task');
 * createChildEntityEndpoint(fastify, 'project', 'wiki', 'wiki');
 * createChildEntityEndpoint(fastify, 'project', 'form', 'form');
 * createChildEntityEndpoint(fastify, 'project', 'artifact', 'artifact');
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
    // Query d_entity for child_entity_codes metadata
    const result = await db.execute(sql`
      SELECT child_entity_codes
      FROM app.entity
      WHERE code = ${parentEntity}
        AND active_flag = true
    `);

    if (result.length === 0) {
      fastify.log.warn(`No entity metadata found for '${parentEntity}' in entity table`);
      return;
    }

    const metadata = result[0];
    let childEntities = metadata.child_entity_codes || [];

    // Handle both string and array formats
    if (typeof childEntities === 'string') {
      childEntities = JSON.parse(childEntities);
    }

    if (!Array.isArray(childEntities)) {
      fastify.log.warn(`Invalid child_entity_codes format for '${parentEntity}': expected array`);
      return;
    }

    // Handle both simple arrays ['task', 'wiki'] and complex objects [{ entity: 'task' }]
    const childCodes = childEntities.map((child: any) =>
      typeof child === 'string' ? child : child.entity
    );

    if (childCodes.length === 0) {
      // Leaf entity - empty child_entity_codes is intentional by design
      // No logging needed - this is normal for entities like work_order, artifact, etc.
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
          const { page = 1, limit = PAGINATION_CONFIG.CHILD_ENTITY_LIMIT } = request.query as any;
          const userId = request.user?.sub;

          if (!userId) {
            return reply.status(401).send({ error: 'User not authenticated' });
          }

          const entityInfra = getEntityInfrastructure(db);

          // ✅ ENTITY INFRASTRUCTURE SERVICE: RBAC check for child entity access
          // Note: We check child entity permission, NOT parent (child can be visible without parent access)
          const rbacWhereClause = await entityInfra.get_entity_rbac_where_condition(
            userId,
            childEntity,
            Permission.VIEW,
            'c'
          );

          // ✅ Parent-child filtering (mandatory for child entity listing)
          const parentJoin = sql`
            INNER JOIN app.entity_instance_link eil
              ON eil.child_entity_code = ${childEntity}
              AND eil.child_entity_instance_id = c.id
              AND eil.entity_code = ${parentEntity}
              AND eil.entity_instance_id = ${parentId}
          `;

          // Universal child entity query pattern
          const offsetVal = (page - 1) * limit;

          const data = await db.execute(sql`
            SELECT c.*, COALESCE(c.name, 'Untitled') as name, c.descr
            FROM app.${sql.raw(childTable)} c
            ${parentJoin}
            WHERE ${rbacWhereClause}
              AND c.active_flag = true
            ORDER BY c.created_ts DESC
            LIMIT ${limit} OFFSET ${offsetVal}
          `);

          // Count query
          const countResult = await db.execute(sql`
            SELECT COUNT(*) as total
            FROM app.${sql.raw(childTable)} c
            ${parentJoin}
            WHERE ${rbacWhereClause}
              AND c.active_flag = true
          `);

          // For empty data, fetch column metadata using LIMIT 0 query
          // This gets us the column names without returning any data
          let resultFields: Array<{ name: string }> = [];
          if (data.length === 0) {
            const columnsResult = await client.unsafe(
              `SELECT * FROM app.${childTable} WHERE 1=0`
            );
            resultFields = columnsResult.columns?.map((col: any) => ({ name: col.name })) || [];
          }

          // Generate response with metadata caching + column fallback
          const response = await generateEntityResponse(childEntity, Array.from(data), {
            total: Number(countResult[0]?.total || 0),
            limit,
            offset: offsetVal,
            resultFields
          });

          return {
            ...response,
            page
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
      `✓ Auto-created ${childCodes.length} child entity endpoints for '${parentEntity}' from entity metadata`
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
 * 2. Automatically creates the parent-child linkage in entity_instance_link
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
 * @param childTable - Database table name (e.g., 'task')
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

      // Check parent VIEW permission using DRY pattern
      const entityInfra = getEntityInfrastructure(db);
      const canViewParent = await entityInfra.check_entity_rbac(userId, parentEntity, parentId, Permission.VIEW);
      if (!canViewParent) {
        return reply.status(403).send({ error: `Access denied for this ${parentEntity}` });
      }

      // Check child entity CREATE permission using DRY pattern
      const canCreate = await entityInfra.check_entity_rbac(userId, childEntity, '11111111-1111-1111-1111-111111111111', Permission.CREATE);
      if (!canCreate) {
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

      // STEP 2: Create parent-child linkage in entity_instance_link
      await db.execute(sql`
        INSERT INTO app.entity_instance_link (
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
