import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db, client } from '@/db/index.js';
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
  child_entities: Type.Array(Type.String()), // Simple array of entity codes
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

      // Filter out inactive child entities
      if (entity.child_entities.length > 0) {
        const childEntityCodes = entity.child_entities; // Already a string array

        // Build IN clause with raw SQL
        const placeholders = childEntityCodes.map((_: any, i: number) => `$${i + 1}`).join(', ');
        const query = `
          SELECT code
          FROM app.d_entity
          WHERE code IN (${placeholders})
            AND active_flag = true
        `;
        const activeChildEntities = await client.unsafe(query, childEntityCodes);

        const activeChildCodes = new Set(activeChildEntities.map((row: any) => row.code));

        // Filter to only include active child entities (strings)
        entity.child_entities = entity.child_entities.filter((c: string) =>
          activeChildCodes.has(c)
        );
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
   * Query params:
   *   - include_inactive: boolean (default: false) - include inactive entities
   */
  fastify.get('/api/v1/entity/types', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        include_inactive: Type.Optional(Type.Boolean())
      }),
      response: {
        200: Type.Array(Type.Object({
          code: Type.String(),
          name: Type.String(),
          ui_label: Type.String(),
          ui_icon: Type.Optional(Type.String()),
          display_order: Type.Number(),
          active_flag: Type.Boolean(),
          child_entities: Type.Optional(Type.Array(Type.String())) // Simple string array
        })),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    const { include_inactive } = request.query as { include_inactive?: boolean };

    try {
      // Build query conditionally based on include_inactive parameter
      const result = include_inactive
        ? await db.execute(sql`
            SELECT
              code,
              name,
              ui_label,
              ui_icon,
              display_order,
              active_flag,
              child_entities
            FROM app.d_entity
            ORDER BY display_order ASC
          `)
        : await db.execute(sql`
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

      // Filter out inactive child entities for all entity types
      // Get all active entity codes once for efficiency
      const allActiveEntities = await db.execute(sql`
        SELECT code
        FROM app.d_entity
        WHERE active_flag = true
      `);
      const activeEntityCodes = new Set(allActiveEntities.map((row: any) => row.code));

      // Filter child_entities for each entity to only include active ones
      mappedResult.forEach((entity: any) => {
        if (entity.child_entities && entity.child_entities.length > 0) {
          entity.child_entities = entity.child_entities.filter((c: string) =>
            activeEntityCodes.has(c)
          );
        }
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
   * Combines child_entities metadata from d_entity with actual counts from d_entity_instance_link
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

      // Parse child_entities - now a simple array of entity codes
      let childEntityCodes = entityType.child_entities || [];
      if (typeof childEntityCodes === 'string') {
        childEntityCodes = JSON.parse(childEntityCodes);
      }
      if (!Array.isArray(childEntityCodes)) {
        childEntityCodes = [];
      }

      // Step 1.5: Enrich child entities with metadata from d_entity and filter inactive
      // Query d_entity to get ui_icon, ui_label for each child entity
      let childEntitiesEnriched: any[] = [];

      if (childEntityCodes.length > 0) {
        // Build IN clause with raw SQL
        const placeholders = childEntityCodes.map((_: any, i: number) => `$${i + 1}`).join(', ');
        const query = `
          SELECT code, ui_icon, ui_label
          FROM app.d_entity
          WHERE code IN (${placeholders})
            AND active_flag = true
          ORDER BY display_order ASC
        `;
        const childMetadata = await client.unsafe(query, childEntityCodes);

        // Build enriched array maintaining order from parent's child_entities
        childEntitiesEnriched = childEntityCodes
          .map((code: string, index: number) => {
            const metadata = childMetadata.find((m: any) => m.code === code);
            if (!metadata) return null; // Skip inactive or non-existent entities
            return {
              entity: code,
              ui_icon: metadata.ui_icon,
              ui_label: metadata.ui_label,
              order: index
            };
          })
          .filter((item: any) => item !== null);
      }

      // Step 2: No RBAC check - allow access for all authenticated users

      // Step 2.5: Get entity name from the actual entity table
      // Different entities use different fields for display names
      const nameFieldMap: Record<string, string> = {
        'expense': 'expense_number',
        'invoice': 'invoice_number',
        'quote': 'quote_number',
        'work_order': 'work_order_number',
        // Default: most entities use 'name'
      };

      const tablePrefix = normalizedEntityType === 'expense' ? 'f_' : 'd_';
      const tableName = `${tablePrefix}${normalizedEntityType}`;
      const nameField = nameFieldMap[normalizedEntityType] || 'name';
      let entityName = entity_id; // Fallback to ID if name not found

      try {
        const nameResult = await client.unsafe(`
          SELECT ${nameField} as display_name FROM app.${tableName}
          WHERE id = $1
        `, [entity_id]);

        if (nameResult.length > 0 && nameResult[0].display_name) {
          entityName = nameResult[0].display_name;
        }
      } catch (err) {
        // If table doesn't exist or query fails, use ID as name
        fastify.log.warn(`Could not fetch ${nameField} from ${tableName} for ${entity_id}:`, err);
      }

      // If no child entities defined in type metadata, return empty tabs
      if (childEntitiesEnriched.length === 0) {
        return {
          parent_entity_type: entity_type,
          parent_entity_id: entity_id,
          parent_name: entityName,
          parent_ui_label: entityType.ui_label,
          parent_ui_icon: entityType.ui_icon,
          tabs: []
        };
      }

      // Step 3: Get actual counts for each child entity type
      // For most entities, count from d_entity_instance_link (parent-child relationships)
      // For special entities like 'rbac', count from their own table
      const countMap: Record<string, number> = {};

      for (const childMeta of childEntitiesEnriched) {
        const childEntityType = childMeta.entity;

        if (childEntityType === 'rbac') {
          // Count RBAC permissions for this role/employee
          const rbacCount = await db.execute(sql`
            SELECT COUNT(*) as count
            FROM app.d_entity_rbac
            WHERE person_entity_name = ${normalizedEntityType}
              AND person_entity_id = ${entity_id}
              AND active_flag = true
          `);
          countMap[childEntityType] = Number(rbacCount[0]?.count || 0);
        } else {
          // Count from d_entity_instance_link for regular parent-child relationships
          const childCount = await db.execute(sql`
            SELECT COUNT(DISTINCT eim.child_entity_id) as count
            FROM app.d_entity_instance_link eim
            WHERE eim.parent_entity_type = ${normalizedEntityType}
              AND eim.parent_entity_id = ${entity_id}
              AND eim.child_entity_type = ${childEntityType}
              AND eim.active_flag = true
          `);
          countMap[childEntityType] = Number(childCount[0]?.count || 0);
        }
      }

      // Combine enriched metadata with counts
      const tabs = childEntitiesEnriched.map((childMeta: any) => ({
        entity: childMeta.entity,
        ui_icon: childMeta.ui_icon,
        ui_label: childMeta.ui_label,
        count: countMap[childMeta.entity] || 0,
        order: childMeta.order
      }));

      return {
        parent_entity_type: entity_type,
        parent_entity_id: entity_id,
        parent_name: entityName,
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
   * Expects simple string array: ["task", "artifact", "wiki"]
   */
  fastify.put('/api/v1/entity/:code/children', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        code: Type.String()
      }),
      body: Type.Object({
        child_entities: Type.Array(Type.String())
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

      // Build SQL query with proper parameter binding using postgres client
      values.push(code);

      const updateQuery = `
        UPDATE app.d_entity
        SET ${setClauses.join(', ')}
        WHERE code = $${values.length}
        RETURNING code, name, ui_label, ui_icon, child_entities, display_order, active_flag
      `;

      const result = await client.unsafe(updateQuery, values);

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
   * PUT /api/v1/entity/type/:entity_code/configure
   * Update entity configuration including custom columns
   * Stores columns configuration in metadata JSONB field
   */
  fastify.put('/api/v1/entity/type/:entity_code/configure', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        entity_code: Type.String()
      }),
      body: Type.Object({
        code: Type.String(),
        name: Type.Optional(Type.String()),
        ui_label: Type.Optional(Type.String()),
        ui_icon: Type.Optional(Type.String()),
        display_order: Type.Optional(Type.Number()),
        columns: Type.Array(Type.Object({
          id: Type.String(),
          column_name: Type.String(),
          data_type: Type.Union([
            Type.Literal('text'),
            Type.Literal('number'),
            Type.Literal('date'),
            Type.Literal('boolean'),
            Type.Literal('json')
          ]),
          description: Type.String(),
          required: Type.Boolean(),
          order: Type.Number()
        }))
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          message: Type.String(),
          data: Type.Object({
            code: Type.String(),
            name: Type.String(),
            ui_label: Type.String(),
            ui_icon: Type.Optional(Type.String()),
            display_order: Type.Number(),
            columns: Type.Array(Type.Any())
          })
        }),
        400: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    const { entity_code } = request.params as { entity_code: string };
    const { code, name, ui_label, ui_icon, display_order, columns } = request.body as any;
    const normalizedCode = normalizeEntityType(entity_code);

    try {
      // Validate that the entity exists
      const existingEntity = await db.execute(sql`
        SELECT code, name, ui_label, ui_icon, display_order, metadata
        FROM app.d_entity
        WHERE code = ${normalizedCode}
        LIMIT 1
      `);

      if (existingEntity.length === 0) {
        return reply.status(404).send({
          error: `Entity type not found: ${entity_code}`
        });
      }

      // Parse existing metadata
      let metadata = existingEntity[0].metadata || {};
      if (typeof metadata === 'string') {
        metadata = JSON.parse(metadata);
      }

      // Store columns in metadata
      metadata.columns = columns;

      // Build update query
      const setClauses: string[] = ['updated_ts = NOW()'];
      const values: any[] = [];

      // Add metadata with columns
      setClauses.push(`metadata = $${values.length + 1}`);
      values.push(JSON.stringify(metadata));

      // Add other optional updates
      if (name !== undefined && name !== existingEntity[0].name) {
        setClauses.push(`name = $${values.length + 1}`);
        values.push(name);
      }
      if (ui_label !== undefined && ui_label !== existingEntity[0].ui_label) {
        setClauses.push(`ui_label = $${values.length + 1}`);
        values.push(ui_label);
      }
      if (ui_icon !== undefined && ui_icon !== existingEntity[0].ui_icon) {
        setClauses.push(`ui_icon = $${values.length + 1}`);
        values.push(ui_icon);
      }
      if (display_order !== undefined && display_order !== existingEntity[0].display_order) {
        setClauses.push(`display_order = $${values.length + 1}`);
        values.push(display_order);
      }

      // Execute update
      values.push(normalizedCode);
      const updateQuery = `
        UPDATE app.d_entity
        SET ${setClauses.join(', ')}
        WHERE code = $${values.length}
        RETURNING code, name, ui_label, ui_icon, display_order, metadata
      `;

      const result = await client.unsafe(updateQuery, values);

      if (result.length === 0) {
        return reply.status(500).send({
          error: 'Failed to update entity configuration'
        });
      }

      const updatedEntity = result[0];

      // Parse metadata to extract columns
      let parsedMetadata = updatedEntity.metadata || {};
      if (typeof parsedMetadata === 'string') {
        parsedMetadata = JSON.parse(parsedMetadata);
      }

      return {
        success: true,
        message: `Entity "${updatedEntity.name}" configuration updated successfully`,
        data: {
          code: updatedEntity.code,
          name: updatedEntity.name,
          ui_label: updatedEntity.ui_label,
          ui_icon: updatedEntity.ui_icon,
          display_order: updatedEntity.display_order,
          columns: parsedMetadata.columns || []
        }
      };
    } catch (error) {
      fastify.log.error('Error updating entity configuration:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/v1/entity/domains
   * Get all entities grouped by domain
   * Returns: { domains: [{ domain: string, entities: [...] }] }
   */
  fastify.get('/api/v1/entity/domains', {
    preHandler: [fastify.authenticate],
    schema: {
      response: {
        200: Type.Object({
          domains: Type.Array(Type.Object({
            domain: Type.String(),
            entities: Type.Array(Type.Object({
              code: Type.String(),
              name: Type.String(),
              ui_label: Type.String(),
              ui_icon: Type.Optional(Type.String()),
              domain: Type.String(),
              column_metadata: Type.Array(Type.Any()),
              data_labels: Type.Array(Type.String()),
              display_order: Type.Number()
            }))
          }))
        }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    try {
      // Get all entities with their domains
      const result = await db.execute(sql`
        SELECT
          code,
          name,
          ui_label,
          ui_icon,
          dl_entity_domain,
          column_metadata,
          data_labels,
          display_order
        FROM app.d_entity
        WHERE active_flag = true
          AND dl_entity_domain IS NOT NULL
        ORDER BY dl_entity_domain, display_order ASC
      `);

      // Group entities by domain
      const domainMap = new Map<string, any[]>();

      result.forEach((row: any) => {
        const domain = row.dl_entity_domain;

        // Parse column_metadata
        let columnMetadata = row.column_metadata || [];
        if (typeof columnMetadata === 'string') {
          columnMetadata = JSON.parse(columnMetadata);
        }
        if (!Array.isArray(columnMetadata)) {
          columnMetadata = [];
        }

        // Parse data_labels
        let dataLabels = row.data_labels || [];
        if (typeof dataLabels === 'string') {
          dataLabels = JSON.parse(dataLabels);
        }
        if (!Array.isArray(dataLabels)) {
          dataLabels = [];
        }

        const entity = {
          code: row.code,
          name: row.name,
          ui_label: row.ui_label,
          ui_icon: row.ui_icon,
          domain: domain,
          column_metadata: columnMetadata,
          data_labels: dataLabels,
          display_order: row.display_order
        };

        if (!domainMap.has(domain)) {
          domainMap.set(domain, []);
        }
        domainMap.get(domain)!.push(entity);
      });

      // Convert map to array
      const domains = Array.from(domainMap.entries()).map(([domain, entities]) => ({
        domain,
        entities
      }));

      // Sort domains alphabetically
      domains.sort((a, b) => a.domain.localeCompare(b.domain));

      return { domains };
    } catch (error) {
      fastify.log.error('Error fetching entity domains:', error);
      fastify.log.error('Error stack:', (error as Error).stack);
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
        SELECT 1 FROM app.d_entity_rbac rbac
        WHERE rbac.person_entity_name = 'employee' AND rbac.person_entity_id = ${userId}
          AND rbac.entity_name = ${normalizedEntityType}
          AND (rbac.entity_id = ${entity_id}::text OR rbac.entity_id = '11111111-1111-1111-1111-111111111111'::uuid)
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND rbac.permission >= 0
      `);

      if (parentAccess.length === 0) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      // Get child entity counts using d_entity_instance_link
      const childCounts = await db.execute(sql`
        SELECT
          eim.child_entity_type as entity_type,
          COUNT(DISTINCT eim.child_entity_id) as count
        FROM app.d_entity_instance_link eim
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

  /**
   * GET /api/v1/entity/:entityType/schema
   * Get database-driven schema for an entity type
   *
   * Returns column metadata by introspecting the database table structure.
   * Schemas are independent of data existence, solving the empty-table rendering issue.
   *
   * Used by FilteredDataTable to render columns even when no data exists.
   */
  fastify.get('/api/v1/entity/:entityType/schema', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        entityType: Type.String()
      }),
      response: {
        200: Type.Object({
          entityType: Type.String(),
          tableName: Type.String(),
          columns: Type.Array(Type.Object({
            key: Type.String(),
            title: Type.String(),
            dataType: Type.String(),
            visible: Type.Boolean(),
            width: Type.Optional(Type.String()),
            align: Type.Optional(Type.Union([
              Type.Literal('left'),
              Type.Literal('center'),
              Type.Literal('right')
            ])),
            format: Type.Object({
              type: Type.String(),
              settingsDatalabel: Type.Optional(Type.String()),
              entityType: Type.Optional(Type.String()),
              dateFormat: Type.Optional(Type.String())
            }),
            editable: Type.Boolean(),
            editType: Type.String(),
            sortable: Type.Boolean(),
            filterable: Type.Boolean(),
            dataSource: Type.Optional(Type.Object({
              type: Type.Literal('settings'),
              datalabel: Type.String()
            }))
          }))
        }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    const { entityType } = request.params as { entityType: string };
    const normalizedEntityType = normalizeEntityType(entityType);

    try {
      // Import schema builder service
      const { buildEntitySchema } = await import('../../lib/schema-builder.service.js');

      // ✨ FULLY DYNAMIC: Table name auto-fetched from d_entity.db_table!
      // No more hardcoded table mappings!
      const schema = await buildEntitySchema(db, normalizedEntityType);

      return schema;
    } catch (error) {
      fastify.log.error(`Error building schema for ${entityType}:`, error as any);

      // Check if error is due to table not existing
      if (error instanceof Error && error.message.includes('relation') && error.message.includes('does not exist')) {
        return reply.status(404).send({
          error: `Entity type "${entityType}" not found or table does not exist`
        });
      }

      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * PUT /api/v1/entity/:code/configure
   * Update entity configuration (column_metadata, display settings)
   * Allows users to configure entity schema and metadata
   */
  fastify.put('/api/v1/entity/:code/configure', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        code: Type.String()
      }),
      body: Type.Object({
        code: Type.String(),
        name: Type.String(),
        ui_label: Type.String(),
        ui_icon: Type.String(),
        display_order: Type.Number(),
        dl_entity_domain: Type.Union([Type.String(), Type.Null()]),
        column_metadata: Type.Array(Type.Object({
          orderid: Type.Number(),
          name: Type.String(),
          descr: Type.Union([Type.String(), Type.Null()]),
          datatype: Type.String(),
          is_nullable: Type.Boolean(),
          default_value: Type.Union([Type.String(), Type.Null()])
        })),
        data_labels: Type.Optional(Type.Array(Type.String()))
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          message: Type.String(),
          entity: Type.Object({
            code: Type.String(),
            name: Type.String(),
            ui_label: Type.String(),
            ui_icon: Type.String(),
            display_order: Type.Number(),
            dl_entity_domain: Type.Union([Type.String(), Type.Null()]),
            column_count: Type.Number()
          })
        }),
        400: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    const { code } = request.params as { code: string };
    const { name, ui_label, ui_icon, display_order, dl_entity_domain, column_metadata, data_labels } = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Validate column_metadata
      if (!column_metadata || !Array.isArray(column_metadata) || column_metadata.length === 0) {
        return reply.status(400).send({ error: 'column_metadata is required and must be a non-empty array' });
      }

      // Check for duplicate column names
      const columnNames = column_metadata.map(c => c.name.toLowerCase());
      const duplicates = columnNames.filter((name, index) => columnNames.indexOf(name) !== index);
      if (duplicates.length > 0) {
        return reply.status(400).send({ error: `Duplicate column names: ${duplicates.join(', ')}` });
      }

      // Verify entity exists
      const entityCheck = await db.execute(sql`
        SELECT code FROM app.d_entity
        WHERE code = ${code}
        LIMIT 1
      `);

      if (entityCheck.length === 0) {
        return reply.status(404).send({ error: `Entity "${code}" not found` });
      }

      // Update entity configuration
      await db.execute(sql`
        UPDATE app.d_entity
        SET
          name = ${name},
          ui_label = ${ui_label},
          ui_icon = ${ui_icon},
          display_order = ${display_order},
          dl_entity_domain = ${dl_entity_domain},
          column_metadata = ${JSON.stringify(column_metadata)}::jsonb,
          data_labels = ${JSON.stringify(data_labels || [])}::jsonb,
          updated_ts = NOW()
        WHERE code = ${code}
      `);

      fastify.log.info(`Entity configuration updated: ${code} by user ${userId}`);

      return {
        success: true,
        message: `Entity "${name}" configuration updated successfully`,
        entity: {
          code,
          name,
          ui_label,
          ui_icon,
          display_order,
          dl_entity_domain,
          column_count: column_metadata.length
        }
      };
    } catch (error) {
      fastify.log.error('Error updating entity configuration:', error as any);
      return reply.status(500).send({ error: 'Failed to update entity configuration' });
    }
  });
}
