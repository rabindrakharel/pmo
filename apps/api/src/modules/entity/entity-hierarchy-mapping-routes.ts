/**
 * Entity Hierarchy Mapping API Routes
 * Manages parent-child relationships between entity instances
 */

import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

// Schema for hierarchy mapping
const HierarchyMappingSchema = Type.Object({
  id: Type.String(),
  action_entity_id: Type.String(),
  action_entity: Type.String(),
  parent_entity_id: Type.String(),
  parent_entity: Type.String(),
  created_at: Type.String(),
  active: Type.Boolean(),
});

// Schema for assignment request
const AssignmentRequestSchema = Type.Object({
  action_entity_id: Type.String(),
  action_entity: Type.String(),
  assignments: Type.Array(Type.Object({
    action_entity_id: Type.String(),
    action_entity: Type.String(),
    parent_entity_id: Type.String(),
    parent_entity: Type.String(),
  }))
});

/**
 * Validates if a parent entity can be assigned to an action entity
 * Checks the entity_id_hierarchy_mapping table for business rules and constraints
 */
async function canAssignParentEntity(
  actionEntityType: string,
  actionEntityId: string,
  parentEntityType: string,
  parentEntityId: string
): Promise<{ canAssign: boolean; reason?: string }> {
  try {
    // 1. Check if both entities exist and are active
    const entityTableMap: Record<string, string> = {
      'biz': 'app.d_biz',
      'org': 'app.d_org',
      'client': 'app.d_client',
      'project': 'app.d_project',
      'task': 'app.ops_task_head',
      'worksite': 'app.d_worksite',
      'employee': 'app.d_employee',
      'wiki': 'app.d_wiki',
      'artifact': 'app.d_artifact',
      'form': 'app.ops_formlog_head',
      'hr': 'app.d_hr',
      'role': 'app.d_role'
    };

    const actionTable = entityTableMap[actionEntityType];
    const parentTable = entityTableMap[parentEntityType];

    if (!actionTable || !parentTable) {
      return { canAssign: false, reason: 'Invalid entity types' };
    }

    // Check if action entity exists and is active
    const actionEntityExists = await db.execute(sql`
      SELECT id FROM ${sql.raw(actionTable)}
      WHERE id = ${actionEntityId} AND active = true
    `);

    if (!actionEntityExists.length) {
      return { canAssign: false, reason: 'Action entity does not exist or is inactive' };
    }

    // Check if parent entity exists and is active
    const parentEntityExists = await db.execute(sql`
      SELECT id FROM ${sql.raw(parentTable)}
      WHERE id = ${parentEntityId} AND active = true
    `);

    if (!parentEntityExists.length) {
      return { canAssign: false, reason: 'Parent entity does not exist or is inactive' };
    }

    // 2. Check if this relationship is allowed by meta_entity_hierarchy
    const hierarchyRule = await db.execute(sql`
      SELECT id FROM app.meta_entity_hierarchy
      WHERE parent_entity = ${parentEntityType}
        AND action_entity = ${actionEntityType}
        AND active = true
    `);

    if (!hierarchyRule.length) {
      return { canAssign: false, reason: `${parentEntityType} cannot be parent of ${actionEntityType} according to hierarchy rules` };
    }

    // 3. Check if this specific assignment already exists and is active
    const existingAssignment = await db.execute(sql`
      SELECT id FROM app.entity_id_hierarchy_mapping
      WHERE action_entity_id = ${actionEntityId}
        AND action_entity = ${actionEntityType}
        AND parent_entity_id = ${parentEntityId}
        AND parent_entity = ${parentEntityType}
        AND active = true
    `);

    if (existingAssignment.length) {
      return { canAssign: false, reason: 'Assignment already exists' };
    }

    // 4. Prevent circular relationships
    const circularCheck = await db.execute(sql`
      WITH RECURSIVE hierarchy_check AS (
        -- Base case: start with the proposed parent
        SELECT parent_entity_id as entity_id, parent_entity as entity_type, 1 as depth
        FROM app.entity_id_hierarchy_mapping
        WHERE action_entity_id = ${parentEntityId}
          AND action_entity = ${parentEntityType}
          AND active = true

        UNION ALL

        -- Recursive case: follow the chain up
        SELECT m.parent_entity_id, m.parent_entity, h.depth + 1
        FROM app.entity_id_hierarchy_mapping m
        INNER JOIN hierarchy_check h ON m.action_entity_id = h.entity_id
          AND m.action_entity = h.entity_type
        WHERE m.active = true
          AND h.depth < 10  -- Prevent infinite recursion
      )
      SELECT entity_id FROM hierarchy_check
      WHERE entity_id = ${actionEntityId}
    `);

    if (circularCheck.length) {
      return { canAssign: false, reason: 'Assignment would create circular dependency' };
    }

    // All checks passed
    return { canAssign: true };

  } catch (error) {
    console.error('Error in canAssignParentEntity:', error);
    return { canAssign: false, reason: 'Internal validation error' };
  }
}

export async function entityHierarchyMappingRoutes(fastify: FastifyInstance) {

  // Get parent assignments for a specific action entity (new route pattern for UI component)
  fastify.get('/api/v1/entity/:actionEntityType/:actionEntityId/parent-assignments', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['entity', 'hierarchy'],
      summary: 'Get parent entity assignments',
      description: 'Returns current parent entity assignments for the specified action entity',
      params: Type.Object({
        actionEntityType: Type.String(),
        actionEntityId: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(Type.Object({
            id: Type.String(),
            parent_entity_id: Type.String(),
            parent_entity: Type.String(),
            from_ts: Type.String(),
            active: Type.Boolean(),
          })),
        }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const employeeId = (request as any).user?.sub;
      const { actionEntityType, actionEntityId } = request.params as {
        actionEntityType: string;
        actionEntityId: string;
      };

      fastify.log.info(`Get parent assignments: employeeId=${employeeId}, actionEntity=${actionEntityType}, actionEntityId=${actionEntityId}`);

      if (!employeeId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Note: Removed UI RBAC check - validation now handled by data-based API gating

      // Get current assignments
      const mappings = await db.execute(sql`
        SELECT
          id,
          parent_entity_id,
          parent_entity,
          from_ts,
          active
        FROM app.entity_id_hierarchy_mapping
        WHERE action_entity_id = ${actionEntityId}
          AND action_entity = ${actionEntityType}
          AND active = true
        ORDER BY from_ts DESC
      `);

      return {
        data: mappings.map(mapping => ({
          id: String(mapping.id),
          parent_entity_id: String(mapping.parent_entity_id),
          parent_entity: String(mapping.parent_entity),
          from_ts: String(mapping.from_ts),
          active: Boolean(mapping.active),
        }))
      };
    } catch (error) {
      fastify.log.error('Error fetching parent assignments:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create a new parent assignment
  fastify.post('/api/v1/entity/:actionEntityType/:actionEntityId/parent-assignments', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['entity', 'hierarchy'],
      summary: 'Create parent entity assignment',
      description: 'Creates a new parent entity assignment for the specified action entity',
      params: Type.Object({
        actionEntityType: Type.String(),
        actionEntityId: Type.String({ format: 'uuid' }),
      }),
      body: Type.Object({
        action_entity_id: Type.String(),
        action_entity: Type.String(),
        parent_entity_id: Type.String(),
        parent_entity: Type.String(),
      }),
      response: {
        200: Type.Object({
          data: Type.Object({
            id: Type.String(),
            message: Type.String(),
          }),
        }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const employeeId = (request as any).user?.sub;
      const { actionEntityType, actionEntityId } = request.params as {
        actionEntityType: string;
        actionEntityId: string;
      };
      const { parent_entity_id, parent_entity } = request.body as {
        action_entity_id: string;
        action_entity: string;
        parent_entity_id: string;
        parent_entity: string;
      };

      if (!employeeId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Validate parent entity assignment using data-based API gating
      const validation = await canAssignParentEntity(
        actionEntityType,
        actionEntityId,
        parent_entity,
        parent_entity_id
      );
      if (!validation.canAssign) {
        return reply.status(403).send({
          error: `Cannot assign parent entity: ${validation.reason}`
        });
      }

      // Insert new assignment
      const result = await db.execute(sql`
        INSERT INTO app.entity_id_hierarchy_mapping (
          action_entity_id,
          action_entity,
          parent_entity_id,
          parent_entity,
          active,
          from_ts,
          created,
          updated
        ) VALUES (
          ${actionEntityId},
          ${actionEntityType},
          ${parent_entity_id},
          ${parent_entity},
          true,
          NOW(),
          NOW(),
          NOW()
        )
        RETURNING id
      `);

      const assignmentId = result[0]?.id;

      return {
        data: {
          id: String(assignmentId),
          message: 'Parent entity assignment created successfully',
        }
      };
    } catch (error) {
      fastify.log.error('Error creating parent assignment:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete a parent assignment
  fastify.delete('/api/v1/entity/:actionEntityType/:actionEntityId/parent-assignments/:assignmentId', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['entity', 'hierarchy'],
      summary: 'Delete parent entity assignment',
      description: 'Removes a parent entity assignment for the specified action entity',
      params: Type.Object({
        actionEntityType: Type.String(),
        actionEntityId: Type.String({ format: 'uuid' }),
        assignmentId: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          message: Type.String(),
        }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const employeeId = (request as any).user?.sub;
      const { actionEntityType, actionEntityId, assignmentId } = request.params as {
        actionEntityType: string;
        actionEntityId: string;
        assignmentId: string;
      };

      if (!employeeId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Note: Removed UI RBAC check - validation now handled by entity existence verification

      // Verify assignment exists and belongs to this action entity
      const existingAssignment = await db.execute(sql`
        SELECT id FROM app.entity_id_hierarchy_mapping
        WHERE id = ${assignmentId}
          AND action_entity_id = ${actionEntityId}
          AND action_entity = ${actionEntityType}
          AND active = true
      `);

      if (!existingAssignment.length) {
        return reply.status(404).send({ error: 'Assignment not found' });
      }

      // Mark assignment as inactive
      await db.execute(sql`
        UPDATE app.entity_id_hierarchy_mapping
        SET active = false, to_ts = NOW(), updated = NOW()
        WHERE id = ${assignmentId}
      `);

      return {
        message: 'Parent entity assignment removed successfully',
      };
    } catch (error) {
      fastify.log.error('Error deleting parent assignment:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get current assignments for an action entity
  fastify.get('/api/v1/entity-hierarchy-mapping', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['entity', 'hierarchy'],
      summary: 'Get entity hierarchy mappings',
      description: 'Returns current parent entity assignments for the specified action entity',
      querystring: Type.Object({
        action_entity: Type.String(),
        action_entity_id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(HierarchyMappingSchema),
        }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const employeeId = (request as any).user?.sub;
      const { action_entity, action_entity_id } = request.query as {
        action_entity: string;
        action_entity_id: string;
      };

      fastify.log.info(`Entity hierarchy mapping request: employeeId=${employeeId}, action_entity=${action_entity}, action_entity_id=${action_entity_id}`);

      if (!employeeId) {
        fastify.log.error('No employee ID in request');
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Note: Removed UI RBAC check - validation now handled by data-based API gating

      // Get current assignments
      fastify.log.info(`Fetching mappings for ${action_entity} ${action_entity_id}`);
      const mappings = await db.execute(sql`
        SELECT
          id,
          action_entity_id,
          action_entity,
          parent_entity_id,
          parent_entity,
          created_at,
          active
        FROM app.entity_id_hierarchy_mapping
        WHERE action_entity_id = ${action_entity_id}
          AND action_entity = ${action_entity}
          AND active = true
        ORDER BY created_at DESC
      `);
      fastify.log.info(`Found ${mappings.length} mappings`);

      return {
        data: mappings.map(mapping => ({
          id: String(mapping.id),
          action_entity_id: String(mapping.action_entity_id),
          action_entity: String(mapping.action_entity),
          parent_entity_id: String(mapping.parent_entity_id),
          parent_entity: String(mapping.parent_entity),
          created_at: String(mapping.created_at),
          active: Boolean(mapping.active),
        }))
      };
    } catch (error) {
      fastify.log.error('Error fetching entity hierarchy mappings:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update entity hierarchy assignments
  fastify.post('/api/v1/entity-hierarchy-mapping', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['entity', 'hierarchy'],
      summary: 'Update entity hierarchy assignments',
      description: 'Updates parent entity assignments for the specified action entity',
      body: AssignmentRequestSchema,
      response: {
        200: Type.Object({
          message: Type.String(),
          assignments_created: Type.Number(),
          assignments_removed: Type.Number(),
        }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const employeeId = (request as any).user?.sub;
      const { action_entity_id, action_entity, assignments } = request.body as {
        action_entity_id: string;
        action_entity: string;
        assignments: Array<{
          action_entity_id: string;
          action_entity: string;
          parent_entity_id: string;
          parent_entity: string;
        }>;
      };

      if (!employeeId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Note: Removed UI RBAC check - validation now handled by data-based API gating per assignment

      // Get current assignments
      const currentAssignments = await db.execute(sql`
        SELECT parent_entity_id, parent_entity
        FROM app.entity_id_hierarchy_mapping
        WHERE action_entity_id = ${action_entity_id}
          AND action_entity = ${action_entity}
          AND active = true
      `);

      const currentSet = new Set(
        currentAssignments.map(a => `${a.parent_entity}:${a.parent_entity_id}`)
      );

      const newSet = new Set(
        assignments.map(a => `${a.parent_entity}:${a.parent_entity_id}`)
      );

      // Calculate changes
      const toRemove = [...currentSet].filter(x => !newSet.has(x));
      const toAdd = assignments.filter(a => !currentSet.has(`${a.parent_entity}:${a.parent_entity_id}`));

      let assignmentsCreated = 0;
      let assignmentsRemoved = 0;

      // Start transaction
      await db.transaction(async (tx) => {
        // Remove old assignments
        for (const removal of toRemove) {
          const [parentEntity, parentEntityId] = removal.split(':');
          await tx.execute(sql`
            UPDATE app.entity_id_hierarchy_mapping
            SET active = false, updated_at = NOW()
            WHERE action_entity_id = ${action_entity_id}
              AND action_entity = ${action_entity}
              AND parent_entity_id = ${parentEntityId}
              AND parent_entity = ${parentEntity}
              AND active = true
          `);
          assignmentsRemoved++;
        }

        // Add new assignments
        for (const assignment of toAdd) {
          // Validate parent entity assignment using data-based API gating
          const validation = await canAssignParentEntity(
            assignment.action_entity,
            assignment.action_entity_id,
            assignment.parent_entity,
            assignment.parent_entity_id
          );

          if (!validation.canAssign) {
            throw new Error(`Cannot assign parent entity ${assignment.parent_entity}:${assignment.parent_entity_id}: ${validation.reason}`);
          }

          // Create new assignment
          await tx.execute(sql`
            INSERT INTO app.entity_id_hierarchy_mapping (
              action_entity_id,
              action_entity,
              parent_entity_id,
              parent_entity,
              active,
              created_at,
              updated_at
            ) VALUES (
              ${assignment.action_entity_id},
              ${assignment.action_entity},
              ${assignment.parent_entity_id},
              ${assignment.parent_entity},
              true,
              NOW(),
              NOW()
            )
            ON CONFLICT (action_entity_id, action_entity, parent_entity_id, parent_entity)
            DO UPDATE SET
              active = true,
              updated_at = NOW()
          `);
          assignmentsCreated++;
        }
      });

      return {
        message: 'Entity hierarchy assignments updated successfully',
        assignments_created: assignmentsCreated,
        assignments_removed: assignmentsRemoved,
      };
    } catch (error) {
      fastify.log.error('Error updating entity hierarchy mappings:', error);
      return reply.status(500).send({
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  });

  // Get all available parent entities for assignment
  fastify.get('/api/v1/entity-hierarchy-mapping/available-parents', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['entity', 'hierarchy'],
      summary: 'Get available parent entities',
      description: 'Returns all available parent entities that can be assigned to the specified action entity type',
      querystring: Type.Object({
        action_entity: Type.String(),
      }),
      response: {
        200: Type.Object({
          parent_entities: Type.Array(Type.Object({
            entity_type: Type.String(),
            entity_id: Type.String(),
            entity_name: Type.String(),
            can_assign: Type.Boolean(),
          })),
        }),
        401: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const employeeId = (request as any).user?.sub;
      const { action_entity } = request.query as { action_entity: string };

      if (!employeeId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Get valid parent entity types for this action entity from meta hierarchy
      const validParentTypes = await db.execute(sql`
        SELECT DISTINCT parent_entity
        FROM app.meta_entity_hierarchy_permission_mapping
        WHERE action_entity = ${action_entity}
          AND active = true
        ORDER BY parent_entity
      `);

      const parentEntities = [];

      // For each valid parent type, get all entities the user can access
      for (const parentType of validParentTypes) {
        const parentEntityType = String(parentType.parent_entity);

        const tableMap: Record<string, string> = {
          'biz': 'app.d_biz',
          'org': 'app.d_org',
          'client': 'app.d_client',
          'project': 'app.d_project',
          'worksite': 'app.d_worksite',
        };

        const table = tableMap[parentEntityType];
        if (!table) continue;

        // Get all entities of this type that exist
        const entities = await db.execute(sql`
          SELECT id, name FROM ${sql.raw(table)}
          WHERE active = true
          ORDER BY name
        `);

        // Add all entities (validation will be done at assignment time)
        for (const entity of entities) {
          parentEntities.push({
            entity_type: parentEntityType,
            entity_id: String(entity.id),
            entity_name: String(entity.name),
            can_assign: true, // Always true - validation handled by canAssignParentEntity at assignment time
          });
        }
      }

      return {
        parent_entities: parentEntities,
      };
    } catch (error) {
      fastify.log.error('Error fetching available parent entities:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}