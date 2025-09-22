/**
 * Universal Entity API Routes
 * Handles CRUD operations for all 12 entity types with proper hierarchy and RBAC
 */

import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
// RBAC imports removed - no authentication required

// Universal entity schema (common fields)
const UniversalEntitySchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  tags: Type.Array(Type.String()),
  attr: Type.Object({}),
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.String()),
  active: Type.Boolean(),
  created: Type.String(),
  updated: Type.String(),
}, { additionalProperties: true }); // Allow additional entity-specific fields

const CreateEntitySchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Array(Type.String())),
  attr: Type.Optional(Type.Object({})),
  active: Type.Optional(Type.Boolean()),
}, { additionalProperties: true });

const UpdateEntitySchema = Type.Partial(CreateEntitySchema);

// Entity type mapping to table names
const ENTITY_TABLE_MAP: Record<string, string> = {
  'biz': 'app.d_biz',
  'project': 'app.d_project', 
  'hr': 'app.d_hr',
  'org': 'app.d_org',
  'client': 'app.d_client',
  'worksite': 'app.d_worksite',
  'employee': 'app.d_employee',
  'role': 'app.d_role',
  'wiki': 'app.d_wiki',
  'form': 'app.ops_formlog_head',
  'task': 'app.ops_task_head',
  'artifact': 'app.d_artifact',
};

// Valid entity types
const VALID_ENTITY_TYPES = Object.keys(ENTITY_TABLE_MAP);

// Helper function to validate entity type
function validateEntityType(entityType: string): boolean {
  return VALID_ENTITY_TYPES.includes(entityType);
}

// Helper function to get table name for entity type
function getTableName(entityType: string): string {
  return ENTITY_TABLE_MAP[entityType];
}

export async function singleEntityRoutes(fastify: FastifyInstance) {

  // List entities of a specific type
  fastify.get('/api/v1/entity/:entityType', {
    
    schema: {
      tags: ['entity'],
      summary: 'List entities of specific type',
      description: 'Returns paginated list of entities with RBAC filtering',
      params: Type.Object({
        entityType: Type.String(),
      }),
      querystring: Type.Object({
        active: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
        sortBy: Type.Optional(Type.String()),
        sortOrder: Type.Optional(Type.String({ enum: ['asc', 'desc'] })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(UniversalEntitySchema),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number(),
        }),
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const { entityType } = request.params as { entityType: string };
      const { 
        active, 
        search, 
        limit = 50, 
        offset = 0,
        sortBy = 'name',
        sortOrder = 'asc'
      } = request.query as any;

      if (!validateEntityType(entityType)) {
        return reply.status(400).send({ error: `Invalid entity type: ${entityType}` });
      }

      const tableName = getTableName(entityType);
      const conditions = [];

      // Add filters
      if (active !== undefined) {
        conditions.push(`active = ${active}`);
      }

      if (search) {
        conditions.push(`(name ILIKE '%${search}%' OR "descr" ILIKE '%${search}%')`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const orderClause = `ORDER BY ${sortBy} ${sortOrder.toUpperCase()}, created DESC`;

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM ${tableName} ${whereClause}`;
      const countResult = await db.execute(sql.raw(countQuery));
      const total = Number(countResult[0]?.total || 0);

      // Get paginated results
      const dataQuery = `
        SELECT *
        FROM ${tableName}
        ${whereClause}
        ${orderClause}
        LIMIT ${limit} OFFSET ${offset}
      `;
      const entities = await db.execute(sql.raw(dataQuery));

      return {
        data: entities,
        total,
        limit,
        offset,
      };
    } catch (error) {
      fastify.log.error(`Error fetching ${request.params.entityType} entities:`, error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single entity by ID
  fastify.get('/api/v1/entity/:entityType/:id', {
    
    schema: {
      tags: ['entity'],
      summary: 'Get single entity by ID',
      description: 'Returns single entity with RBAC check',
      params: Type.Object({
        entityType: Type.String(),
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: UniversalEntitySchema,
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const { entityType, id } = request.params as { entityType: string; id: string };

      if (!validateEntityType(entityType)) {
        return reply.status(400).send({ error: `Invalid entity type: ${entityType}` });
      }

      const tableName = getTableName(entityType);
      const query = `SELECT * FROM ${tableName} WHERE id = $1 AND active = true`;
      const entities = await db.execute(sql.raw(query, [id]));

      if (entities.length === 0) {
        return reply.status(404).send({ error: 'Entity not found' });
      }

      return entities[0];
    } catch (error) {
      fastify.log.error(`Error fetching ${request.params.entityType} entity:`, error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create new entity (root level)
  fastify.post('/api/v1/entity/:entityType', {
    
    schema: {
      tags: ['entity'],
      summary: 'Create new root entity',
      description: 'Creates new root-level entity (for root-capable entities only)',
      params: Type.Object({
        entityType: Type.String(),
      }),
      body: CreateEntitySchema,
      response: {
        201: UniversalEntitySchema,
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const { entityType } = request.params as { entityType: string };
      const data = request.body as any;

      if (!validateEntityType(entityType)) {
        return reply.status(400).send({ error: `Invalid entity type: ${entityType}` });
      }

      // Check if entity type is root-capable
      const entityTypeInfo = await db.execute(sql`
        SELECT is_root_capable 
        FROM app.meta_entity_types 
        WHERE entity_type_code = ${entityType} AND active = true
      `);

      if (entityTypeInfo.length === 0) {
        return reply.status(400).send({ error: 'Invalid entity type' });
      }

      if (!entityTypeInfo[0].is_root_capable) {
        return reply.status(403).send({ 
          error: `Entity type '${entityType}' requires a parent entity. Use parent-scoped creation endpoint instead.` 
        });
      }

      const tableName = getTableName(entityType);

      // Build insert query dynamically based on provided fields
      const fields = ['name', 'active'];
      const values = [data.name, data.active !== false];
      const placeholders = ['$1', '$2'];
      let paramIndex = 3;

      if (data.descr) {
        fields.push('"descr"');
        values.push(data.descr);
        placeholders.push(`$${paramIndex++}`);
      }

      if (data.tags) {
        fields.push('tags');
        values.push(JSON.stringify(data.tags));
        placeholders.push(`$${paramIndex++}::jsonb`);
      }

      if (data.attr) {
        fields.push('attr');
        values.push(JSON.stringify(data.attr));
        placeholders.push(`$${paramIndex++}::jsonb`);
      }

      const insertQuery = `
        INSERT INTO ${tableName} (${fields.join(', ')})
        VALUES (${placeholders.join(', ')})
        RETURNING *
      `;

      const result = await db.execute(sql.raw(insertQuery, values));

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to create entity' });
      }

      // Create hierarchy mapping for root entity
      await db.execute(sql`
        INSERT INTO app.entity_id_hierarchy_mapping 
        (action_entity_id, action_entity, parent_entity_id, parent_entity)
        VALUES (${result[0].id}, ${entityType}, NULL, NULL)
      `);

      return reply.status(201).send(result[0]);
    } catch (error) {
      fastify.log.error(`Error creating ${request.params.entityType} entity:`, error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update entity
  fastify.put('/api/v1/entity/:entityType/:id', {
    
    schema: {
      tags: ['entity'],
      summary: 'Update entity',
      description: 'Updates entity with RBAC check',
      params: Type.Object({
        entityType: Type.String(),
        id: Type.String({ format: 'uuid' }),
      }),
      body: UpdateEntitySchema,
      response: {
        200: UniversalEntitySchema,
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const { entityType, id } = request.params as { entityType: string; id: string };
      const data = request.body as any;

      if (!validateEntityType(entityType)) {
        return reply.status(400).send({ error: `Invalid entity type: ${entityType}` });
      }

      const tableName = getTableName(entityType);

      // Build update query dynamically
      const updateFields = [];
      const values = [];
      let paramIndex = 1;

      if (data.name !== undefined) {
        updateFields.push(`name = $${paramIndex++}`);
        values.push(data.name);
      }

      if (data.descr !== undefined) {
        updateFields.push(`"descr" = $${paramIndex++}`);
        values.push(data.descr);
      }

      if (data.tags !== undefined) {
        updateFields.push(`tags = $${paramIndex++}::jsonb`);
        values.push(JSON.stringify(data.tags));
      }

      if (data.attr !== undefined) {
        updateFields.push(`attr = $${paramIndex++}::jsonb`);
        values.push(JSON.stringify(data.attr));
      }

      if (data.active !== undefined) {
        updateFields.push(`active = $${paramIndex++}`);
        values.push(data.active);
      }

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(`updated = NOW()`);
      values.push(id); // For WHERE clause

      const updateQuery = `
        UPDATE ${tableName}
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await db.execute(sql.raw(updateQuery, values));

      if (result.length === 0) {
        return reply.status(404).send({ error: 'Entity not found' });
      }

      return result[0];
    } catch (error) {
      fastify.log.error(`Error updating ${request.params.entityType} entity:`, error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete entity (soft delete)
  fastify.delete('/api/v1/entity/:entityType/:id', {
    
    schema: {
      tags: ['entity'],
      summary: 'Delete entity',
      description: 'Soft deletes entity with RBAC check',
      params: Type.Object({
        entityType: Type.String(),
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        204: Type.Null(),
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const { entityType, id } = request.params as { entityType: string; id: string };

      if (!validateEntityType(entityType)) {
        return reply.status(400).send({ error: `Invalid entity type: ${entityType}` });
      }

      const tableName = getTableName(entityType);

      // Check if entity exists
      const existingEntity = await db.execute(sql.raw(
        `SELECT id FROM ${tableName} WHERE id = $1 AND active = true`,
        [id]
      ));

      if (existingEntity.length === 0) {
        return reply.status(404).send({ error: 'Entity not found' });
      }

      // Soft delete
      await db.execute(sql.raw(
        `UPDATE ${tableName} SET active = false, to_ts = NOW(), updated = NOW() WHERE id = $1`,
        [id]
      ));

      // Update hierarchy mapping
      await db.execute(sql`
        UPDATE app.entity_id_hierarchy_mapping 
        SET active = false, to_ts = NOW(), updated = NOW()
        WHERE action_entity_id = ${id} AND action_entity = ${entityType}
      `);

      return reply.status(204).send();
    } catch (error) {
      fastify.log.error(`Error deleting ${request.params.entityType} entity:`, error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}