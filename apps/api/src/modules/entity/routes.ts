import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

/**
 * Entity Metadata Routes
 *
 * Provides centralized entity TYPE metadata from d_entity table including:
 * - Parent-child relationships (child_entities JSONB)
 * - Entity icons
 * - Entity display names
 *
 * Used by:
 * - DynamicChildEntityTabs component for tab generation
 * - Entity navigation and routing
 * - Entity configuration management
 */

/**
 * Entity type alias mapping
 * Maps frontend/URL entity names to database entity_type values
 * Example: 'biz' (frontend) → 'business' (database)
 */
const ENTITY_ALIAS_MAP: Record<string, string> = {
  'biz': 'business',
  // Add more aliases as needed
};

/**
 * Normalize entity type - convert frontend alias to database entity_type
 */
function normalizeEntityType(entityType: string): string {
  return ENTITY_ALIAS_MAP[entityType] || entityType;
}

const EntityTypeMetadataSchema = Type.Object({
  code: Type.String(),
  name: Type.String(),
  ui_label: Type.String(),
  ui_icon: Type.Optional(Type.String()),
  child_entities: Type.Array(Type.Object({
    entity: Type.String(),
    ui_icon: Type.String(),
    ui_label: Type.String()
  })),
  display_order: Type.Number(),
  active_flag: Type.Boolean()
});

const ChildEntityCountSchema = Type.Object({
  entity_type: Type.String(),
  count: Type.Number()
});

export async function entityRoutes(fastify: FastifyInstance) {

  /**
   * GET /api/v1/entity/type/:entity_type
   * Get metadata for a specific entity TYPE
   */
  fastify.get('/api/v1/entity/type/:entity_type', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        entity_type: Type.String()
      }),
      response: {
        200: EntityTypeMetadataSchema,
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    const { entity_type } = request.params as { entity_type: string };
    const normalizedEntityType = normalizeEntityType(entity_type);

    try {
      const result = await db.execute(sql`
        SELECT
          code,
          name,
          ui_label,
          ui_icon,
          child_entities,
          display_order,
          active_flag
        FROM app.d_entity
        WHERE code = ${normalizedEntityType}
          AND active_flag = true
        LIMIT 1
      `);

      if (result.length === 0) {
        return reply.status(404).send({
          error: `Entity type not found: ${entity_type}`
        });
      }

      return result[0];
    } catch (error) {
      fastify.log.error('Error fetching entity type metadata:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/v1/entity/types
   * Get all entity TYPES with their metadata
   */
  fastify.get('/api/v1/entity/types', {
    preHandler: [fastify.authenticate],
    schema: {
      response: {
        200: Type.Array(EntityTypeMetadataSchema),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    try {
      const result = await db.execute(sql`
        SELECT
          code,
          name,
          ui_label,
          ui_icon,
          child_entities,
          display_order,
          active_flag
        FROM app.d_entity
        WHERE active_flag = true
        ORDER BY display_order ASC
      `);

      return result;
    } catch (error) {
      fastify.log.error('Error fetching all entity types:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/v1/entity/child-tabs/:entity_type/:entity_id
   * Get complete tab configuration for an entity including metadata + counts
   * Combines child_entities metadata from d_entity with actual counts from d_entity_id_map
   * This is the PRIMARY endpoint for DynamicChildEntityTabs
   */
  fastify.get('/api/v1/entity/child-tabs/:entity_type/:entity_id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        entity_type: Type.String(),
        entity_id: Type.String({ format: 'uuid' })
      }),
      response: {
        200: Type.Object({
          parent_entity_type: Type.String(),
          parent_entity_id: Type.String(),
          parent_name: Type.Optional(Type.String()),
          parent_ui_label: Type.Optional(Type.String()),
          parent_ui_icon: Type.Optional(Type.String()),
          tabs: Type.Array(Type.Object({
            entity: Type.String(),
            ui_icon: Type.String(),
            ui_label: Type.String(),
            count: Type.Number()
          }))
        }),
        404: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    const { entity_type, entity_id } = request.params as { entity_type: string; entity_id: string };
    const normalizedEntityType = normalizeEntityType(entity_type);
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Step 1: Get entity TYPE metadata from d_entity
      const entityTypeResult = await db.execute(sql`
        SELECT
          code,
          name,
          ui_label,
          ui_icon,
          child_entities
        FROM app.d_entity
        WHERE code = ${normalizedEntityType}
          AND active_flag = true
        LIMIT 1
      `);

      if (entityTypeResult.length === 0) {
        return reply.status(404).send({
          error: `Entity type not found: ${entity_type}`
        });
      }

      const entityType = entityTypeResult[0];
      const childEntitiesMetadata = entityType.child_entities || [];

      // Step 2: Get entity INSTANCE data from d_entity_instance_id and verify RBAC access
      const parentInstance = await db.execute(sql`
        SELECT
          e.entity_type,
          e.entity_id::text,
          e.entity_name
        FROM app.d_entity_instance_id e
        WHERE e.entity_type = ${normalizedEntityType}
          AND e.entity_id = ${entity_id}::uuid
          AND e.active_flag = true
          AND EXISTS (
            SELECT 1 FROM app.entity_id_rbac_map rbac
            WHERE rbac.empid = ${userId}
              AND rbac.entity = ${normalizedEntityType}
              AND (rbac.entity_id = ${entity_id}::text OR rbac.entity_id = 'all')
              AND rbac.active_flag = true
              AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
              AND 0 = ANY(rbac.permission)
          )
        LIMIT 1
      `);

      if (parentInstance.length === 0) {
        return reply.status(404).send({
          error: `Entity instance not found or access denied: ${entity_type}/${entity_id}`
        });
      }

      const parent = parentInstance[0];

      // If no child entities defined in type metadata, return empty tabs
      if (childEntitiesMetadata.length === 0) {
        return {
          parent_entity_type: entity_type,
          parent_entity_id: entity_id,
          parent_name: parent.entity_name,
          parent_ui_label: entityType.ui_label,
          parent_ui_icon: entityType.ui_icon,
          tabs: []
        };
      }

      // Step 3: Get actual counts for each child entity type from d_entity_id_map
      const childCounts = await db.execute(sql`
        SELECT
          eim.child_entity_type as entity_type,
          COUNT(DISTINCT eim.child_entity_id) as count
        FROM app.d_entity_id_map eim
        WHERE eim.parent_entity_type = ${normalizedEntityType}
          AND eim.parent_entity_id = ${entity_id}
          AND eim.active_flag = true
        GROUP BY eim.child_entity_type
      `);

      // Create count map for quick lookup
      const countMap = childCounts.reduce((acc: any, row: any) => {
        acc[row.entity_type] = Number(row.count);
        return acc;
      }, {});

      // Combine metadata with counts and sort by order field
      const tabs = childEntitiesMetadata
        .map((childMeta: any) => ({
          entity: childMeta.entity,
          ui_icon: childMeta.ui_icon,
          ui_label: childMeta.ui_label,
          count: countMap[childMeta.entity] || 0,
          order: childMeta.order || 999
        }))
        .sort((a: any, b: any) => a.order - b.order)
        .map(({ order, ...rest }: any) => rest); // Remove order field from response

      return {
        parent_entity_type: entity_type,
        parent_entity_id: entity_id,
        parent_name: parent.entity_name,
        parent_ui_label: entityType.ui_label,
        parent_ui_icon: entityType.ui_icon,
        tabs
      };
    } catch (error) {
      fastify.log.error('Error fetching child tabs:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/v1/entity/child-counts/:entity_type/:entity_id
   * Get counts of all child entities for a parent entity instance
   * Used for tab badges (e.g., "Tasks (12)")
   */
  fastify.get('/api/v1/entity/child-counts/:entity_type/:entity_id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        entity_type: Type.String(),
        entity_id: Type.String({ format: 'uuid' })
      }),
      response: {
        200: Type.Object({
          parent_entity_type: Type.String(),
          parent_entity_id: Type.String(),
          child_counts: Type.Array(ChildEntityCountSchema)
        }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    const { entity_type, entity_id } = request.params as { entity_type: string; entity_id: string };
    const normalizedEntityType = normalizeEntityType(entity_type);
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // First, verify user has access to the parent entity
      const parentAccess = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map rbac
        WHERE rbac.empid = ${userId}
          AND rbac.entity = ${normalizedEntityType}
          AND (rbac.entity_id = ${entity_id}::text OR rbac.entity_id = 'all')
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND 0 = ANY(rbac.permission)
      `);

      if (parentAccess.length === 0) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      // Get child entity counts using d_entity_id_map
      const childCounts = await db.execute(sql`
        SELECT
          eim.child_entity_type as entity_type,
          COUNT(DISTINCT eim.child_entity_id) as count
        FROM app.d_entity_id_map eim
        WHERE eim.parent_entity_type = ${normalizedEntityType}
          AND eim.parent_entity_id = ${entity_id}
          AND eim.active_flag = true
        GROUP BY eim.child_entity_type
        ORDER BY eim.child_entity_type
      `);

      return {
        parent_entity_type: entity_type,
        parent_entity_id: entity_id,
        child_counts: childCounts.map((row: any) => ({
          entity_type: row.entity_type,
          count: Number(row.count)
        }))
      };
    } catch (error) {
      fastify.log.error('Error fetching child entity counts:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
