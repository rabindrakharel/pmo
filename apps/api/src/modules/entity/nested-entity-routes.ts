/**
 * Nested Parent/Action Entity API Routes
 * Handles hierarchical CRUD operations for parent-action entity relationships
 */

import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { 
  getEmployeeEntityIds,
  hasPermissionOnEntityId,
  hasCreatePermissionInEntity,
  type EntityAction
} from '../rbac/ui-api-permission-rbac-gate.js';

// Reuse schemas from universal entity routes
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
}, { additionalProperties: true });

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

// Helper functions
function validateEntityType(entityType: string): boolean {
  return VALID_ENTITY_TYPES.includes(entityType);
}

function getTableName(entityType: string): string {
  return ENTITY_TABLE_MAP[entityType];
}

// Get parent entity foreign key column name for action entity
function getParentIdColumn(actionEntity: string, parentEntity: string): string | null {
  const parentIdMap: Record<string, Record<string, string>> = {
    'project': {
      'biz': 'biz_id',
      'client': 'client_id', // Note: project uses clients jsonb array, may need special handling
    },
    'task': {
      'project': 'project_id',
      'biz': 'biz_id',
      'worksite': 'worksite_id',
      'client': 'client_id',
    },
    'wiki': {
      'biz': 'biz_id',
      'project': 'project_id',
    },
    'form': {
      'biz': 'biz_id',
      'project': 'project_id',
      'worksite': 'worksite_id',
    },
    'artifact': {
      'biz': 'biz_id',
      'project': 'project_id',
    },
    'employee': {
      'hr': 'hr_position_id',
      'biz': 'biz_id',
      'org': 'primary_org_id',
      'role': null, // Many-to-many relationship
    },
    'worksite': {
      'org': 'org_id',
    },
    'client': {
      'biz': 'biz_id',
    },
    // Self-referential hierarchies
    'biz': {
      'biz': 'parent_id',
    },
    'project': {
      'project': 'parent_id',
    },
    'org': {
      'org': 'parent_id',
    },
  };

  return parentIdMap[actionEntity]?.[parentEntity] || null;
}

export async function nestedEntityRoutes(fastify: FastifyInstance) {

  // List action entities within a parent entity
  fastify.get('/api/v1/:parentEntity/:parentId/:actionEntity', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['nested-entity'],
      summary: 'List action entities within parent entity',
      description: 'Returns paginated list of action entities scoped to parent entity with RBAC filtering',
      params: Type.Object({
        parentEntity: Type.String(),
        parentId: Type.String({ format: 'uuid' }),
        actionEntity: Type.String(),
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
          parent_info: Type.Object({
            entity_type: Type.String(),
            entity_id: Type.String(),
            entity_name: Type.String(),
          }),
        }),
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const employeeId = (request as any).user?.sub;
      const { parentEntity, parentId, actionEntity } = request.params as { 
        parentEntity: string; 
        parentId: string; 
        actionEntity: string; 
      };
      const { 
        active, 
        search, 
        limit = 50, 
        offset = 0,
        sortBy = 'name',
        sortOrder = 'asc'
      } = request.query as any;

      if (!employeeId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      if (!validateEntityType(parentEntity) || !validateEntityType(actionEntity)) {
        return reply.status(400).send({ error: 'Invalid entity types' });
      }

      // Check user has access to parent entity
      const hasParentAccess = await hasPermissionOnEntityId(employeeId, parentEntity, parentId, 'view');
      if (!hasParentAccess) {
        return reply.status(404).send({ error: 'Parent entity not found or access denied' });
      }

      // Verify parent-action relationship is valid
      const hierarchyCheck = await db.execute(sql`
        SELECT 1 FROM app.meta_entity_hierarchy_permission_mapping 
        WHERE parent_entity = ${parentEntity} 
          AND action_entity = ${actionEntity} 
          AND active = true
        LIMIT 1
      `);

      if (hierarchyCheck.length === 0) {
        return reply.status(400).send({ 
          error: `Invalid parent-action relationship: ${parentEntity} cannot contain ${actionEntity}` 
        });
      }

      // Get parent entity info for context
      const parentTable = getTableName(parentEntity);
      const parentInfo = await db.execute(sql.raw(
        `SELECT id, name FROM ${parentTable} WHERE id = $1 AND active = true`,
        [parentId]
      ));

      if (parentInfo.length === 0) {
        return reply.status(404).send({ error: 'Parent entity not found' });
      }

      // Get accessible action entity IDs for this user
      const accessibleIds = await getEmployeeEntityIds(employeeId, actionEntity, 'view');
      if (accessibleIds.length === 0) {
        return { 
          data: [], 
          total: 0, 
          limit, 
          offset,
          parent_info: {
            entity_type: parentEntity,
            entity_id: parentId,
            entity_name: parentInfo[0].name,
          }
        };
      }

      const actionTable = getTableName(actionEntity);
      const parentIdColumn = getParentIdColumn(actionEntity, parentEntity);

      if (!parentIdColumn) {
        return reply.status(400).send({ 
          error: `Unsupported parent-action relationship: ${parentEntity} → ${actionEntity}` 
        });
      }

      // Build conditions
      const conditions = [
        `id = ANY(ARRAY[${accessibleIds.map(id => `'${id}'`).join(',')}]::uuid[])`,
        `${parentIdColumn} = '${parentId}'`
      ];

      // Add filters
      if (active !== undefined) {
        conditions.push(`active = ${active}`);
      }

      if (search) {
        conditions.push(`(name ILIKE '%${search}%' OR "descr" ILIKE '%${search}%')`);
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;
      const orderClause = `ORDER BY ${sortBy} ${sortOrder.toUpperCase()}, created DESC`;

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM ${actionTable} ${whereClause}`;
      const countResult = await db.execute(sql.raw(countQuery));
      const total = Number(countResult[0]?.total || 0);

      // Get paginated results
      const dataQuery = `
        SELECT *
        FROM ${actionTable}
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
        parent_info: {
          entity_type: parentEntity,
          entity_id: parentId,
          entity_name: parentInfo[0].name,
        }
      };
    } catch (error) {
      fastify.log.error(`Error fetching ${request.params.actionEntity} entities in ${request.params.parentEntity}:`, error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single action entity within parent entity context
  fastify.get('/api/v1/:parentEntity/:parentId/:actionEntity/:actionId', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['nested-entity'],
      summary: 'Get action entity within parent context',
      description: 'Returns single action entity with parent context validation',
      params: Type.Object({
        parentEntity: Type.String(),
        parentId: Type.String({ format: 'uuid' }),
        actionEntity: Type.String(),
        actionId: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          entity: UniversalEntitySchema,
          parent_info: Type.Object({
            entity_type: Type.String(),
            entity_id: Type.String(),
            entity_name: Type.String(),
          }),
        }),
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
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

      // Check user has access to parent entity
      const hasParentAccess = await hasPermissionOnEntityId(employeeId, parentEntity, parentId, 'view');
      if (!hasParentAccess) {
        return reply.status(404).send({ error: 'Parent entity not found or access denied' });
      }

      // Check user has access to action entity
      const hasActionAccess = await hasPermissionOnEntityId(employeeId, actionEntity, actionId, 'view');
      if (!hasActionAccess) {
        return reply.status(404).send({ error: 'Action entity not found or access denied' });
      }

      // Get parent entity info
      const parentTable = getTableName(parentEntity);
      const parentInfo = await db.execute(sql.raw(
        `SELECT id, name FROM ${parentTable} WHERE id = $1 AND active = true`,
        [parentId]
      ));

      if (parentInfo.length === 0) {
        return reply.status(404).send({ error: 'Parent entity not found' });
      }

      // Get action entity with parent relationship validation
      const actionTable = getTableName(actionEntity);
      const parentIdColumn = getParentIdColumn(actionEntity, parentEntity);

      if (!parentIdColumn) {
        return reply.status(400).send({ 
          error: `Unsupported parent-action relationship: ${parentEntity} → ${actionEntity}` 
        });
      }

      const query = `
        SELECT * FROM ${actionTable} 
        WHERE id = $1 AND ${parentIdColumn} = $2 AND active = true
      `;
      const entities = await db.execute(sql.raw(query, [actionId, parentId]));

      if (entities.length === 0) {
        return reply.status(404).send({ error: 'Action entity not found in parent context' });
      }

      return {
        entity: entities[0],
        parent_info: {
          entity_type: parentEntity,
          entity_id: parentId,
          entity_name: parentInfo[0].name,
        }
      };
    } catch (error) {
      fastify.log.error(`Error fetching ${request.params.actionEntity} entity in ${request.params.parentEntity}:`, error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create action entity within parent entity context
  fastify.post('/api/v1/:parentEntity/:parentId/:actionEntity', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['nested-entity'],
      summary: 'Create action entity within parent context',
      description: 'Creates new action entity scoped to parent entity with RBAC validation',
      params: Type.Object({
        parentEntity: Type.String(),
        parentId: Type.String({ format: 'uuid' }),
        actionEntity: Type.String(),
      }),
      body: CreateEntitySchema,
      response: {
        201: UniversalEntitySchema,
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
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

      // Check user has create permission within parent entity
      const hasCreatePermission = await hasCreatePermissionInEntity(employeeId, parentEntity, parentId, actionEntity);
      if (!hasCreatePermission) {
        return reply.status(403).send({ error: 'Insufficient permissions to create entity in this context' });
      }

      // Verify parent exists and user has access
      const parentTable = getTableName(parentEntity);
      const parentCheck = await db.execute(sql.raw(
        `SELECT id FROM ${parentTable} WHERE id = $1 AND active = true`,
        [parentId]
      ));

      if (parentCheck.length === 0) {
        return reply.status(404).send({ error: 'Parent entity not found' });
      }

      // Verify parent-action relationship is valid
      const hierarchyCheck = await db.execute(sql`
        SELECT permission_action FROM app.meta_entity_hierarchy_permission_mapping 
        WHERE parent_entity = ${parentEntity} 
          AND action_entity = ${actionEntity} 
          AND permission_action = 'create'
          AND active = true
        LIMIT 1
      `);

      if (hierarchyCheck.length === 0) {
        return reply.status(400).send({ 
          error: `Cannot create ${actionEntity} within ${parentEntity}` 
        });
      }

      const actionTable = getTableName(actionEntity);
      const parentIdColumn = getParentIdColumn(actionEntity, parentEntity);

      if (!parentIdColumn) {
        return reply.status(400).send({ 
          error: `Unsupported parent-action creation: ${parentEntity} → ${actionEntity}` 
        });
      }

      // Build insert query with parent relationship
      const fields = ['name', 'active', parentIdColumn];
      const values = [data.name, data.active !== false, parentId];
      const placeholders = ['$1', '$2', '$3'];
      let paramIndex = 4;

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

      // Create hierarchy mapping
      await db.execute(sql`
        INSERT INTO app.entity_id_hierarchy_mapping 
        (action_entity_id, action_entity, parent_entity_id, parent_entity)
        VALUES (${result[0].id}, ${actionEntity}, ${parentId}, ${parentEntity})
      `);

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
      tags: ['nested-entity'],
      summary: 'Update action entity within parent context',
      description: 'Updates action entity with parent context validation',
      params: Type.Object({
        parentEntity: Type.String(),
        parentId: Type.String({ format: 'uuid' }),
        actionEntity: Type.String(),
        actionId: Type.String({ format: 'uuid' }),
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

      // Check RBAC permission
      const hasAccess = await hasPermissionOnEntityId(employeeId, actionEntity, actionId, 'edit');
      if (!hasAccess) {
        return reply.status(404).send({ error: 'Action entity not found or access denied' });
      }

      const actionTable = getTableName(actionEntity);
      const parentIdColumn = getParentIdColumn(actionEntity, parentEntity);

      if (!parentIdColumn) {
        return reply.status(400).send({ 
          error: `Unsupported parent-action relationship: ${parentEntity} → ${actionEntity}` 
        });
      }

      // Verify entity exists in parent context
      const existingCheck = await db.execute(sql.raw(
        `SELECT id FROM ${actionTable} WHERE id = $1 AND ${parentIdColumn} = $2 AND active = true`,
        [actionId, parentId]
      ));

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
        updateFields.push(`active = $${paramIndex++}`);
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
      tags: ['nested-entity'],
      summary: 'Delete action entity within parent context',
      description: 'Soft deletes action entity with parent context validation',
      params: Type.Object({
        parentEntity: Type.String(),
        parentId: Type.String({ format: 'uuid' }),
        actionEntity: Type.String(),
        actionId: Type.String({ format: 'uuid' }),
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

      // Check RBAC permission (using edit permission for delete)
      const hasAccess = await hasPermissionOnEntityId(employeeId, actionEntity, actionId, 'edit');
      if (!hasAccess) {
        return reply.status(404).send({ error: 'Action entity not found or access denied' });
      }

      const actionTable = getTableName(actionEntity);
      const parentIdColumn = getParentIdColumn(actionEntity, parentEntity);

      if (!parentIdColumn) {
        return reply.status(400).send({ 
          error: `Unsupported parent-action relationship: ${parentEntity} → ${actionEntity}` 
        });
      }

      // Check if entity exists in parent context
      const existingEntity = await db.execute(sql.raw(
        `SELECT id FROM ${actionTable} WHERE id = $1 AND ${parentIdColumn} = $2 AND active = true`,
        [actionId, parentId]
      ));

      if (existingEntity.length === 0) {
        return reply.status(404).send({ error: 'Action entity not found in parent context' });
      }

      // Soft delete
      await db.execute(sql.raw(
        `UPDATE ${actionTable} SET active = false, to_ts = NOW(), updated = NOW() WHERE id = $1`,
        [actionId]
      ));

      // Update hierarchy mapping
      await db.execute(sql`
        UPDATE app.entity_id_hierarchy_mapping 
        SET active = false, to_ts = NOW(), updated = NOW()
        WHERE action_entity_id = ${actionId} AND action_entity = ${actionEntity}
          AND parent_entity_id = ${parentId} AND parent_entity = ${parentEntity}
      `);

      return reply.status(204).send();
    } catch (error) {
      fastify.log.error(`Error deleting ${request.params.actionEntity} in ${request.params.parentEntity}:`, error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}