/**
 * Universal Parent-Action Entity API Routes
 * Standardized API for all parent-action entity relationships supporting both:
 * 1. Direct foreign key relationships (tasks, forms)
 * 2. Hierarchy mapping relationships (wiki, artifacts)
 */

import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

// Universal schemas
const UniversalEntitySchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  attr: Type.Object({}),
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.String()),
  active: Type.Boolean(),
  created: Type.String(),
  updated: Type.String()}, { additionalProperties: true });

const CreateEntitySchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  attr: Type.Optional(Type.Object({})),
  active: Type.Optional(Type.Boolean())}, { additionalProperties: true });

const UpdateEntitySchema = Type.Partial(CreateEntitySchema);

// Entity table mapping
const ENTITY_TABLE_MAP: Record<string, string> = {
  'biz': 'app.business',
  'project': 'app.project',
  'hr': 'app.office',
  'org': 'app.office',
  'client': 'app.cust',
  'worksite': 'app.worksite',
  'employee': 'app.employee',
  'role': 'app.role',
  'wiki': 'app.wiki',
  'form': 'app.form',
  'task': 'app.task',
  'artifact': 'app.artifact'};

// Relationship type configuration
interface RelationshipConfig {
  type: 'foreign_key' | 'hierarchy_mapping';
  foreignKeyColumn?: string;
}

// Relationship mapping with patterns
const RELATIONSHIP_MAP: Record<string, Record<string, RelationshipConfig>> = {
  'project': {
    'task': { type: 'foreign_key', foreignKeyColumn: 'project_id' },
    'form': { type: 'foreign_key', foreignKeyColumn: 'project_id' },
    'wiki': { type: 'hierarchy_mapping' },
    'artifact': { type: 'hierarchy_mapping' }},
  'biz': {
    'project': { type: 'foreign_key', foreignKeyColumn: 'biz_id' },
    'task': { type: 'foreign_key', foreignKeyColumn: 'biz_id' },
    'form': { type: 'foreign_key', foreignKeyColumn: 'biz_id' },
    'client': { type: 'foreign_key', foreignKeyColumn: 'biz_id' },
    'employee': { type: 'foreign_key', foreignKeyColumn: 'biz_id' },
    'wiki': { type: 'hierarchy_mapping' },
    'artifact': { type: 'hierarchy_mapping' }},
  'worksite': {
    'task': { type: 'foreign_key', foreignKeyColumn: 'worksite_id' },
    'form': { type: 'foreign_key', foreignKeyColumn: 'worksite_id' },
    'employee': { type: 'foreign_key', foreignKeyColumn: 'worksite_id' }},
  'org': {
    'worksite': { type: 'foreign_key', foreignKeyColumn: 'org_id' },
    'employee': { type: 'foreign_key', foreignKeyColumn: 'primary_org_id' }},
  'hr': {
    'employee': { type: 'foreign_key', foreignKeyColumn: 'hr_position_id' },
    'role': { type: 'hierarchy_mapping' }},
  'client': {
    'project': { type: 'hierarchy_mapping' }, // projects have clients jsonb array
    'task': { type: 'foreign_key', foreignKeyColumn: 'client_id' }},
  'task': {
    'form': { type: 'foreign_key', foreignKeyColumn: 'task_id' },
    'artifact': { type: 'hierarchy_mapping' }},
  'role': {
    'employee': { type: 'hierarchy_mapping' }, // Many-to-many relationship
  }};

// Helper functions
function validateEntityType(entityCode: string): boolean {
  return Object.keys(ENTITY_TABLE_MAP).includes(entityCode);
}

function getTableName(entityCode: string): string {
  return ENTITY_TABLE_MAP[entityCode];
}

function getRelationshipConfig(parentEntity: string, actionEntity: string): RelationshipConfig | null {
  return RELATIONSHIP_MAP[parentEntity]?.[actionEntity] || null;
}

export async function universalParentActionRoutes(fastify: FastifyInstance) {

  // List action entities within a parent entity (Universal Pattern)
  fastify.get('/api/v1/:parentEntity/:parentId/:actionEntity', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['universal-parent-action'],
      summary: 'List action entities within parent entity',
      description: 'Universal API for listing action entities using either FK or hierarchy mapping',
      params: Type.Object({
        parentEntity: Type.String(),
        parentId: Type.String({ format: 'uuid' }),
        actionEntity: Type.String()}),
      querystring: Type.Object({
        page: Type.Optional(Type.Number({ minimum: 1 })),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        active: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        sortBy: Type.Optional(Type.String()),
        sortOrder: Type.Optional(Type.String({ enum: ['asc', 'desc'] }))}),
      response: {
        200: Type.Object({
          data: Type.Array(UniversalEntitySchema),
          total: Type.Number(),
          page: Type.Number(),
          limit: Type.Number(),
          parent_info: Type.Object({
            entity_type: Type.String(),
            entity_id: Type.String(),
            entity_name: Type.String()})}),
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    try {
      const employeeId = (request as any).user?.sub;
      const { parentEntity, parentId, actionEntity } = request.params as {
        parentEntity: string;
        parentId: string;
        actionEntity: string;
      };
      const {
        page = 1,
        limit = 20,
        active,
        search,
        sortBy = 'created',
        sortOrder = 'desc'
      } = request.query as any;

      if (!employeeId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      if (!validateEntityType(parentEntity) || !validateEntityType(actionEntity)) {
        return reply.status(400).send({ error: 'Invalid entity types' });
      }

      // Get relationship configuration
      const relationshipConfig = getRelationshipConfig(parentEntity, actionEntity);
      if (!relationshipConfig) {
        return reply.status(400).send({
          error: `Unsupported parent-action relationship: ${parentEntity} → ${actionEntity}`
        });
      }

      // Get parent entity info
      const parentTable = getTableName(parentEntity);
      const parentInfo = await db.execute(sql.raw(
        `SELECT id, name FROM ${parentTable} WHERE id = $1 AND active_flag = true`,
        [parentId]
      ));

      if (parentInfo.length === 0) {
        return reply.status(404).send({ error: 'Parent entity not found' });
      }

      const actionTable = getTableName(actionEntity);
      const offset = (page - 1) * limit;

      let query = '';
      let countQuery = '';

      if (relationshipConfig.type === 'foreign_key') {
        // Direct foreign key relationship
        const foreignKeyColumn = relationshipConfig.foreignKeyColumn!;

        const conditions = [
          `e.${foreignKeyColumn} = '${parentId}'`
        ];

        if (active !== undefined) {
          conditions.push(`e.active_flag = ${active}`);
        }

        if (search) {
          conditions.push(`(e.name ILIKE '%${search}%' OR e."descr" ILIKE '%${search}%')`);
        }

        const whereClause = `WHERE ${conditions.join(' AND ')}`;
        const orderClause = `ORDER BY e.${sortBy} ${sortOrder.toUpperCase()}`;

        query = `
          SELECT e.*
          FROM ${actionTable} e
          ${whereClause}
          ${orderClause}
          LIMIT ${limit} OFFSET ${offset}
        `;

        countQuery = `
          SELECT COUNT(*) as total
          FROM ${actionTable} e
          ${whereClause}
        `;

      } else {
        // Hierarchy mapping relationship
        const conditions = [
          `eh.parent_entity_type_id = '${parentId}'`,
          `eh.parent_entity_type = '${parentEntity}'`,
          `eh.child_entity_type = '${actionEntity}'`,
          `eh.active_flag = true`
        ];

        if (active !== undefined) {
          conditions.push(`e.active_flag = ${active}`);
        }

        if (search) {
          conditions.push(`(e.name ILIKE '%${search}%' OR e."descr" ILIKE '%${search}%')`);
        }

        const whereClause = `WHERE ${conditions.join(' AND ')}`;
        const orderClause = `ORDER BY e.${sortBy} ${sortOrder.toUpperCase()}`;

        query = `
          SELECT e.*
          FROM ${actionTable} e
          INNER JOIN app.entity_id_map eh ON eh.child_entity_id = e.id
          ${whereClause}
          ${orderClause}
          LIMIT ${limit} OFFSET ${offset}
        `;

        countQuery = `
          SELECT COUNT(*) as total
          FROM ${actionTable} e
          INNER JOIN app.entity_id_map eh ON eh.child_entity_id = e.id
          ${whereClause}
        `;
      }

      // Execute queries
      const [entities, countResult] = await Promise.all([
        db.execute(sql.raw(query)),
        db.execute(sql.raw(countQuery))
      ]);

      const total = Number(countResult[0]?.total || 0);

      return {
        data: entities,
        total,
        page,
        limit,
        parent_info: {
          entity_type: parentEntity,
          entity_id: parentId,
          entity_name: parentInfo[0].name}
      };
    } catch (error) {
      fastify.log.error(`Error fetching ${request.params.actionEntity} entities in ${request.params.parentEntity}:`, error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single action entity within parent context
  fastify.get('/api/v1/:parentEntity/:parentId/:actionEntity/:actionId', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['universal-parent-action'],
      summary: 'Get action entity within parent context',
      description: 'Universal API for getting single action entity with parent validation',
      params: Type.Object({
        parentEntity: Type.String(),
        parentId: Type.String({ format: 'uuid' }),
        actionEntity: Type.String(),
        actionId: Type.String({ format: 'uuid' })}),
      response: {
        200: Type.Object({
          entity: UniversalEntitySchema,
          parent_info: Type.Object({
            entity_type: Type.String(),
            entity_id: Type.String(),
            entity_name: Type.String()})}),
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    try {
      const employeeId = (request as any).user?.sub;
      const { parentEntity, parentId, actionEntity, actionId } = request.params as {
        parentEntity: string;
        parentId: string;
        actionEntity: string;
        actionId: string;
      };

      if (!employeeId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      if (!validateEntityType(parentEntity) || !validateEntityType(actionEntity)) {
        return reply.status(400).send({ error: 'Invalid entity types' });
      }

      // Get relationship configuration
      const relationshipConfig = getRelationshipConfig(parentEntity, actionEntity);
      if (!relationshipConfig) {
        return reply.status(400).send({
          error: `Unsupported parent-action relationship: ${parentEntity} → ${actionEntity}`
        });
      }

      // Get parent entity info
      const parentTable = getTableName(parentEntity);
      const parentInfo = await db.execute(sql.raw(
        `SELECT id, name FROM ${parentTable} WHERE id = $1 AND active_flag = true`,
        [parentId]
      ));

      if (parentInfo.length === 0) {
        return reply.status(404).send({ error: 'Parent entity not found' });
      }

      const actionTable = getTableName(actionEntity);
      let query = '';

      if (relationshipConfig.type === 'foreign_key') {
        const foreignKeyColumn = relationshipConfig.foreignKeyColumn!;
        query = `
          SELECT * FROM ${actionTable}
          WHERE id = $1 AND ${foreignKeyColumn} = $2 AND active_flag = true
        `;
      } else {
        query = `
          SELECT e.*
          FROM ${actionTable} e
          INNER JOIN app.entity_id_map eh ON eh.child_entity_id = e.id
          WHERE e.id = $1
            AND eh.parent_entity_type_id = $2
            AND eh.parent_entity_type = '${parentEntity}'
            AND eh.child_entity_type = '${actionEntity}'
            AND eh.active_flag = true
            AND e.active_flag = true
        `;
      }

      const entities = await db.execute(sql.raw(query, [actionId, parentId]));

      if (entities.length === 0) {
        return reply.status(404).send({ error: 'Action entity not found in parent context' });
      }

      return {
        entity: entities[0],
        parent_info: {
          entity_type: parentEntity,
          entity_id: parentId,
          entity_name: parentInfo[0].name}
      };
    } catch (error) {
      fastify.log.error(`Error fetching ${request.params.actionEntity} entity in ${request.params.parentEntity}:`, error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create action entity within parent context
  fastify.post('/api/v1/:parentEntity/:parentId/:actionEntity', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['universal-parent-action'],
      summary: 'Create action entity within parent context',
      description: 'Universal API for creating action entities with automatic relationship handling',
      params: Type.Object({
        parentEntity: Type.String(),
        parentId: Type.String({ format: 'uuid' }),
        actionEntity: Type.String()}),
      body: CreateEntitySchema,
      response: {
        201: UniversalEntitySchema,
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    try {
      const employeeId = (request as any).user?.sub;
      const { parentEntity, parentId, actionEntity } = request.params as {
        parentEntity: string;
        parentId: string;
        actionEntity: string;
      };
      const data = request.body as any;

      if (!employeeId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      if (!validateEntityType(parentEntity) || !validateEntityType(actionEntity)) {
        return reply.status(400).send({ error: 'Invalid entity types' });
      }

      // Get relationship configuration
      const relationshipConfig = getRelationshipConfig(parentEntity, actionEntity);
      if (!relationshipConfig) {
        return reply.status(400).send({
          error: `Unsupported parent-action creation: ${parentEntity} → ${actionEntity}`
        });
      }

      // Verify parent exists
      const parentTable = getTableName(parentEntity);
      const parentCheck = await db.execute(sql.raw(
        `SELECT id FROM ${parentTable} WHERE id = $1 AND active_flag = true`,
        [parentId]
      ));

      if (parentCheck.length === 0) {
        return reply.status(404).send({ error: 'Parent entity not found' });
      }

      const actionTable = getTableName(actionEntity);

      // Build insert query based on relationship type
      const fields = ['name', 'active'];
      const values = [data.name, data.active !== false];
      const placeholders = ['$1', '$2'];
      let paramIndex = 3;

      // Add foreign key if direct relationship
      if (relationshipConfig.type === 'foreign_key') {
        fields.push(relationshipConfig.foreignKeyColumn!);
        values.push(parentId);
        placeholders.push(`$${paramIndex++}`);
      }

      // Add optional fields
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
        INSERT INTO ${actionTable} (${fields.join(', ')})
        VALUES (${placeholders.join(', ')})
        RETURNING *
      `;

      const result = await db.execute(sql.raw(insertQuery, values));

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to create entity' });
      }

      // Create hierarchy mapping if needed
      if (relationshipConfig.type === 'hierarchy_mapping') {
        await db.execute(sql`
          INSERT INTO app.entity_id_map
          (action_entity_id, action_entity, parent_entity_id, parent_entity)
          VALUES (${result[0].id}, ${actionEntity}, ${parentId}, ${parentEntity})
        `);
      }

      return reply.status(201).send(result[0]);
    } catch (error) {
      fastify.log.error(`Error creating ${request.params.actionEntity} in ${request.params.parentEntity}:`, error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update action entity within parent context
  fastify.put('/api/v1/:parentEntity/:parentId/:actionEntity/:actionId', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['universal-parent-action'],
      summary: 'Update action entity within parent context',
      description: 'Universal API for updating action entities with parent validation',
      params: Type.Object({
        parentEntity: Type.String(),
        parentId: Type.String({ format: 'uuid' }),
        actionEntity: Type.String(),
        actionId: Type.String({ format: 'uuid' })}),
      body: UpdateEntitySchema,
      response: {
        200: UniversalEntitySchema,
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    try {
      const employeeId = (request as any).user?.sub;
      const { parentEntity, parentId, actionEntity, actionId } = request.params as {
        parentEntity: string;
        parentId: string;
        actionEntity: string;
        actionId: string;
      };
      const data = request.body as any;

      if (!employeeId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      if (!validateEntityType(parentEntity) || !validateEntityType(actionEntity)) {
        return reply.status(400).send({ error: 'Invalid entity types' });
      }

      // Get relationship configuration
      const relationshipConfig = getRelationshipConfig(parentEntity, actionEntity);
      if (!relationshipConfig) {
        return reply.status(400).send({
          error: `Unsupported parent-action relationship: ${parentEntity} → ${actionEntity}`
        });
      }

      const actionTable = getTableName(actionEntity);

      // Verify entity exists in parent context
      let existingCheck;
      if (relationshipConfig.type === 'foreign_key') {
        const foreignKeyColumn = relationshipConfig.foreignKeyColumn!;
        existingCheck = await db.execute(sql.raw(
          `SELECT id FROM ${actionTable} WHERE id = $1 AND ${foreignKeyColumn} = $2 AND active_flag = true`,
          [actionId, parentId]
        ));
      } else {
        existingCheck = await db.execute(sql.raw(`
          SELECT e.id
          FROM ${actionTable} e
          INNER JOIN app.entity_id_map eh ON eh.child_entity_id = e.id
          WHERE e.id = $1
            AND eh.parent_entity_type_id = $2
            AND eh.parent_entity_type = '${parentEntity}'
            AND eh.child_entity_type = '${actionEntity}'
            AND eh.active_flag = true
            AND e.active_flag = true
        `, [actionId, parentId]));
      }

      if (existingCheck.length === 0) {
        return reply.status(404).send({ error: 'Action entity not found in parent context' });
      }

      // Build update query
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
        updateFields.push(`active_flag = $${paramIndex++}`);
        values.push(data.active);
      }

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(`updated = NOW()`);
      values.push(actionId);

      const updateQuery = `
        UPDATE ${actionTable}
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await db.execute(sql.raw(updateQuery, values));

      if (result.length === 0) {
        return reply.status(404).send({ error: 'Action entity not found' });
      }

      return result[0];
    } catch (error) {
      fastify.log.error(`Error updating ${request.params.actionEntity} in ${request.params.parentEntity}:`, error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete action entity within parent context
  fastify.delete('/api/v1/:parentEntity/:parentId/:actionEntity/:actionId', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['universal-parent-action'],
      summary: 'Delete action entity within parent context',
      description: 'Universal API for soft deleting action entities with relationship cleanup',
      params: Type.Object({
        parentEntity: Type.String(),
        parentId: Type.String({ format: 'uuid' }),
        actionEntity: Type.String(),
        actionId: Type.String({ format: 'uuid' })}),
      response: {
        204: Type.Null(),
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    try {
      const employeeId = (request as any).user?.sub;
      const { parentEntity, parentId, actionEntity, actionId } = request.params as {
        parentEntity: string;
        parentId: string;
        actionEntity: string;
        actionId: string;
      };

      if (!employeeId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      if (!validateEntityType(parentEntity) || !validateEntityType(actionEntity)) {
        return reply.status(400).send({ error: 'Invalid entity types' });
      }

      // Get relationship configuration
      const relationshipConfig = getRelationshipConfig(parentEntity, actionEntity);
      if (!relationshipConfig) {
        return reply.status(400).send({
          error: `Unsupported parent-action relationship: ${parentEntity} → ${actionEntity}`
        });
      }

      const actionTable = getTableName(actionEntity);

      // Verify entity exists in parent context
      let existingCheck;
      if (relationshipConfig.type === 'foreign_key') {
        const foreignKeyColumn = relationshipConfig.foreignKeyColumn!;
        existingCheck = await db.execute(sql.raw(
          `SELECT id FROM ${actionTable} WHERE id = $1 AND ${foreignKeyColumn} = $2 AND active_flag = true`,
          [actionId, parentId]
        ));
      } else {
        existingCheck = await db.execute(sql.raw(`
          SELECT e.id
          FROM ${actionTable} e
          INNER JOIN app.entity_id_map eh ON eh.child_entity_id = e.id
          WHERE e.id = $1
            AND eh.parent_entity_type_id = $2
            AND eh.parent_entity_type = '${parentEntity}'
            AND eh.child_entity_type = '${actionEntity}'
            AND eh.active_flag = true
            AND e.active_flag = true
        `, [actionId, parentId]));
      }

      if (existingCheck.length === 0) {
        return reply.status(404).send({ error: 'Action entity not found in parent context' });
      }

      // Soft delete entity
      await db.execute(sql.raw(
        `UPDATE ${actionTable} SET active_flag = false, to_ts = NOW(), updated = NOW() WHERE id = $1`,
        [actionId]
      ));

      // Update hierarchy mapping if applicable
      if (relationshipConfig.type === 'hierarchy_mapping') {
        await db.execute(sql`
          UPDATE app.entity_id_map
          SET active_flag = false, to_ts = NOW(), updated = NOW()
          WHERE action_entity_id = ${actionId} AND action_entity = ${actionEntity}
            AND parent_entity_id = ${parentId} AND parent_entity = ${parentEntity}
        `);
      }

      return reply.status(204).send();
    } catch (error) {
      fastify.log.error(`Error deleting ${request.params.actionEntity} in ${request.params.parentEntity}:`, error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}