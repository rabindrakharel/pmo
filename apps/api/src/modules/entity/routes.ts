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
  'client': 'cust',  // Map 'client' to 'cust' (customer)
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
    ui_label: Type.String(),
    order: Type.Optional(Type.Number())
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

      const entity = result[0];

      // Parse child_entities if it's a string (JSONB returned as string)
      if (typeof entity.child_entities === 'string') {
        entity.child_entities = JSON.parse(entity.child_entities);
      }

      // Ensure child_entities is always an array
      if (!Array.isArray(entity.child_entities)) {
        entity.child_entities = [];
      }

      return entity;
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
        200: Type.Array(Type.Object({
          code: Type.String(),
          name: Type.String(),
          ui_label: Type.String(),
          ui_icon: Type.Optional(Type.String()),
          display_order: Type.Number(),
          active_flag: Type.Boolean(),
          child_entities: Type.Optional(Type.Array(Type.Object({
            entity: Type.String(),
            ui_icon: Type.String(),
            ui_label: Type.String(),
            order: Type.Number()
          })))
        })),
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
          display_order,
          active_flag,
          child_entities
        FROM app.d_entity
        WHERE active_flag = true
        ORDER BY display_order ASC
      `);

      // Parse child_entities JSONB and map results
      const mappedResult = result.map((row: any) => {
        let childEntities = row.child_entities || [];
        if (typeof childEntities === 'string') {
          childEntities = JSON.parse(childEntities);
        }
        if (!Array.isArray(childEntities)) {
          childEntities = [];
        }

        return {
          code: row.code,
          name: row.name,
          ui_label: row.ui_label,
          ui_icon: row.ui_icon,
          display_order: row.display_order,
          active_flag: row.active_flag,
          child_entities: childEntities
        };
      });

      return mappedResult;
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
            count: Type.Number(),
            order: Type.Number()
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

      // Parse child_entities if it's a string (JSONB returned as string)
      let childEntitiesMetadata = entityType.child_entities || [];
      if (typeof childEntitiesMetadata === 'string') {
        childEntitiesMetadata = JSON.parse(childEntitiesMetadata);
      }
      if (!Array.isArray(childEntitiesMetadata)) {
        childEntitiesMetadata = [];
      }

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
        .sort((a: any, b: any) => a.order - b.order); // Keep order field for frontend

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
   * PUT /api/v1/entity/:code/children
   * Update child entities for an entity type
   * Modifies the child_entities JSONB array in d_entity table
   */
  fastify.put('/api/v1/entity/:code/children', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        code: Type.String()
      }),
      body: Type.Object({
        child_entities: Type.Array(Type.Object({
          entity: Type.String(),
          ui_icon: Type.String(),
          ui_label: Type.String(),
          order: Type.Number()
        }))
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          message: Type.String(),
          data: EntityTypeMetadataSchema
        }),
        400: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    const { code } = request.params as { code: string };
    const { child_entities } = request.body as { child_entities: any[] };
    const normalizedCode = normalizeEntityType(code);

    try {
      // Validate that the entity exists
      const existingEntity = await db.execute(sql`
        SELECT code FROM app.d_entity
        WHERE code = ${normalizedCode}
        LIMIT 1
      `);

      if (existingEntity.length === 0) {
        return reply.status(404).send({
          error: `Entity type not found: ${code}`
        });
      }

      // Update the child_entities JSONB field
      const result = await db.execute(sql`
        UPDATE app.d_entity
        SET
          child_entities = ${JSON.stringify(child_entities)}::jsonb,
          updated_ts = NOW()
        WHERE code = ${normalizedCode}
        RETURNING
          code,
          name,
          ui_label,
          ui_icon,
          child_entities,
          display_order,
          active_flag
      `);

      if (result.length === 0) {
        return reply.status(500).send({
          error: 'Failed to update entity children'
        });
      }

      const updatedEntity = result[0];

      // Parse child_entities if it's a string (JSONB returned as string)
      if (typeof updatedEntity.child_entities === 'string') {
        updatedEntity.child_entities = JSON.parse(updatedEntity.child_entities);
      }

      // Ensure child_entities is always an array
      if (!Array.isArray(updatedEntity.child_entities)) {
        updatedEntity.child_entities = [];
      }

      return {
        success: true,
        message: `Updated child entities for ${code}`,
        data: updatedEntity
      };
    } catch (error) {
      fastify.log.error('Error updating entity children:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * POST /api/v1/entity
   * Create a new entity type
   */
  fastify.post('/api/v1/entity', {
    preHandler: [fastify.authenticate],
    schema: {
      body: Type.Object({
        code: Type.String(),
        name: Type.String(),
        ui_label: Type.String(),
        ui_icon: Type.Optional(Type.String()),
        display_order: Type.Optional(Type.Number()),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: EntityTypeMetadataSchema
        }),
        400: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    const { code, name, ui_label, ui_icon, display_order } = request.body as any;

    try {
      // Check if entity already exists
      const existing = await db.execute(sql`
        SELECT code FROM app.d_entity
        WHERE code = ${code}
      `);

      if (existing.length > 0) {
        return reply.status(400).send({ error: `Entity type '${code}' already exists` });
      }

      // Get max display_order if not provided
      let finalDisplayOrder = display_order;
      if (!finalDisplayOrder) {
        const maxOrder = await db.execute(sql`
          SELECT COALESCE(MAX(display_order), 0) + 10 as next_order
          FROM app.d_entity
        `);
        finalDisplayOrder = maxOrder[0].next_order;
      }

      // Create new entity
      const result = await db.execute(sql`
        INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order, active_flag)
        VALUES (${code}, ${name}, ${ui_label}, ${ui_icon || null}, '[]'::jsonb, ${finalDisplayOrder}, true)
        RETURNING code, name, ui_label, ui_icon, child_entities, display_order, active_flag
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to create entity' });
      }

      const newEntity = result[0];

      // Parse child_entities
      if (typeof newEntity.child_entities === 'string') {
        newEntity.child_entities = JSON.parse(newEntity.child_entities);
      }
      if (!Array.isArray(newEntity.child_entities)) {
        newEntity.child_entities = [];
      }

      return {
        success: true,
        data: newEntity
      };
    } catch (error) {
      fastify.log.error('Error creating entity:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * PUT /api/v1/entity/:code
   * Update an entity type
   */
  fastify.put('/api/v1/entity/:code', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        code: Type.String()
      }),
      body: Type.Object({
        name: Type.Optional(Type.String()),
        ui_label: Type.Optional(Type.String()),
        ui_icon: Type.Optional(Type.String()),
        display_order: Type.Optional(Type.Number()),
        active_flag: Type.Optional(Type.Boolean())
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: EntityTypeMetadataSchema
        }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    const { code } = request.params as { code: string };
    const updates = request.body as any;

    try {
      // Check if entity exists
      const existing = await db.execute(sql`
        SELECT code FROM app.d_entity WHERE code = ${code}
      `);

      if (existing.length === 0) {
        return reply.status(404).send({ error: `Entity type '${code}' not found` });
      }

      // Build update query
      const setClauses: string[] = ['updated_ts = NOW()'];
      const values: any[] = [];

      if (updates.name !== undefined) {
        setClauses.push(`name = $${values.length + 1}`);
        values.push(updates.name);
      }
      if (updates.ui_label !== undefined) {
        setClauses.push(`ui_label = $${values.length + 1}`);
        values.push(updates.ui_label);
      }
      if (updates.ui_icon !== undefined) {
        setClauses.push(`ui_icon = $${values.length + 1}`);
        values.push(updates.ui_icon);
      }
      if (updates.display_order !== undefined) {
        setClauses.push(`display_order = $${values.length + 1}`);
        values.push(updates.display_order);
      }
      if (updates.active_flag !== undefined) {
        setClauses.push(`active_flag = $${values.length + 1}`);
        values.push(updates.active_flag);
      }

      if (values.length === 0) {
        // No updates provided
        const result = await db.execute(sql`
          SELECT code, name, ui_label, ui_icon, child_entities, display_order, active_flag
          FROM app.d_entity WHERE code = ${code}
        `);
        return { success: true, data: result[0] };
      }

      // Update using dynamic SQL
      const updateQuery = `
        UPDATE app.d_entity
        SET ${setClauses.join(', ')}
        WHERE code = $${values.length + 1}
        RETURNING code, name, ui_label, ui_icon, child_entities, display_order, active_flag
      `;
      values.push(code);

      const result = await db.execute(sql.raw(updateQuery, values));

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to update entity' });
      }

      const updatedEntity = result[0];

      // Parse child_entities
      if (typeof updatedEntity.child_entities === 'string') {
        updatedEntity.child_entities = JSON.parse(updatedEntity.child_entities);
      }
      if (!Array.isArray(updatedEntity.child_entities)) {
        updatedEntity.child_entities = [];
      }

      return {
        success: true,
        data: updatedEntity
      };
    } catch (error) {
      fastify.log.error('Error updating entity:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * DELETE /api/v1/entity/:code
   * Delete (soft delete) an entity type by setting active_flag to false
   */
  fastify.delete('/api/v1/entity/:code', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        code: Type.String()
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          message: Type.String()
        }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    const { code } = request.params as { code: string };

    try {
      // Check if entity exists
      const existing = await db.execute(sql`
        SELECT code FROM app.d_entity WHERE code = ${code} AND active_flag = true
      `);

      if (existing.length === 0) {
        return reply.status(404).send({ error: `Entity type '${code}' not found` });
      }

      // Soft delete by setting active_flag to false
      await db.execute(sql`
        UPDATE app.d_entity
        SET active_flag = false, updated_ts = NOW()
        WHERE code = ${code}
      `);

      return {
        success: true,
        message: `Entity type '${code}' deactivated successfully`
      };
    } catch (error) {
      fastify.log.error('Error deleting entity:', error as any);
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
