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
  child_entity_type_id: Type.String(),
  child_entity_type: Type.String(),
  parent_entity_type_id: Type.String(),
  parent_entity_type: Type.String(),
  created_at: Type.String(),
  active: Type.Boolean(),
});

// Schema for assignment request
const AssignmentRequestSchema = Type.Object({
  child_entity_type_id: Type.String(),
  child_entity_type: Type.String(),
  assignments: Type.Array(Type.Object({
    child_entity_type_id: Type.String(),
    child_entity_type: Type.String(),
    parent_entity_type_id: Type.String(),
    parent_entity_type: Type.String(),
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
      'task': 'app.d_task',
      'worksite': 'app.d_worksite',
      'employee': 'app.d_employee',
      'wiki': 'app.d_wiki',
      'artifact': 'app.d_artifact',
      'form': 'app.d_form_head',
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
      WHERE id = ${actionEntityId} AND active_flag = true
    `);

    if (!actionEntityExists.length) {
      return { canAssign: false, reason: 'Action entity does not exist or is inactive' };
    }

    // Check if parent entity exists and is active
    const parentEntityExists = await db.execute(sql`
      SELECT id FROM ${sql.raw(parentTable)}
      WHERE id = ${parentEntityId} AND active_flag = true
    `);

    if (!parentEntityExists.length) {
      return { canAssign: false, reason: 'Parent entity does not exist or is inactive' };
    }

    // 2. Check if this relationship is allowed by meta_entity_hierarchy
    const hierarchyRule = await db.execute(sql`
      SELECT id FROM app.meta_entity_hierarchy
      WHERE parent_entity_type = ${parentEntityType}
        AND child_entity_type = ${actionEntityType}
        AND active_flag = true
    `);

    if (!hierarchyRule.length) {
      return { canAssign: false, reason: `${parentEntityType} cannot be parent of ${actionEntityType} according to hierarchy rules` };
    }

    // 3. Check if this specific assignment already exists and is active
    const existingAssignment = await db.execute(sql`
      SELECT id FROM app.entity_id_map
      WHERE child_entity_type_id = ${actionEntityId}
        AND child_entity_type = ${actionEntityType}
        AND parent_entity_type_id = ${parentEntityId}
        AND parent_entity_type = ${parentEntityType}
        AND active_flag = true
    `);

    if (existingAssignment.length) {
      return { canAssign: false, reason: 'Assignment already exists' };
    }

    // 4. Prevent circular relationships
    const circularCheck = await db.execute(sql`
      WITH RECURSIVE hierarchy_check AS (
        -- Base case: start with the proposed parent
        SELECT parent_entity_type_id as entity_id, parent_entity_type as entity_type, 1 as depth
        FROM app.entity_id_map
        WHERE child_entity_type_id = ${parentEntityId}
          AND child_entity_type = ${parentEntityType}
          AND active_flag = true

        UNION ALL

        -- Recursive case: follow the chain up
        SELECT m.parent_entity_type_id, m.parent_entity_type, h.depth + 1
        FROM app.entity_id_map m
        INNER JOIN hierarchy_check h ON m.child_entity_type_id = h.entity_id
          AND m.child_entity_type = h.entity_type
        WHERE m.active_flag = true
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
            parent_entity_type_id: Type.String(),
            parent_entity_type: Type.String(),
            created_ts: Type.String(),
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
          parent_entity_type_id,
          parent_entity_type,
          created_ts,
          active
        FROM app.entity_id_map
        WHERE child_entity_type_id = ${actionEntityId}
          AND child_entity_type = ${actionEntityType}
          AND active_flag = true
        ORDER BY created_ts DESC
      `);

      return {
        data: mappings.map(mapping => ({
          id: String(mapping.id),
          parent_entity_type_id: String(mapping.parent_entity_type_id),
          parent_entity_type: String(mapping.parent_entity_type),
          created_ts: String(mapping.created_ts),
          active: Boolean(mapping.active_flag_flag),
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
        child_entity_type_id: Type.String(),
        child_entity_type: Type.String(),
        parent_entity_type_id: Type.String(),
        parent_entity_type: Type.String(),
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
      const { parent_entity_type_id, parent_entity_type } = request.body as {
        child_entity_type_id: string;
        child_entity_type: string;
        parent_entity_type_id: string;
        parent_entity_type: string;
      };

      if (!employeeId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Validate parent entity assignment using data-based API gating
      const validation = await canAssignParentEntity(
        actionEntityType,
        actionEntityId,
        parent_entity_type,
        parent_entity_type_id
      );
      if (!validation.canAssign) {
        return reply.status(403).send({
          error: `Cannot assign parent entity: ${validation.reason}`
        });
      }

      // Insert new assignment
      const result = await db.execute(sql`
        INSERT INTO app.entity_id_map (
          child_entity_type_id,
          child_entity_type,
          parent_entity_type_id,
          parent_entity_type,
          active,
          created_ts,
          created,
          updated
        ) VALUES (
          ${actionEntityId},
          ${actionEntityType},
          ${parent_entity_type_id},
          ${parent_entity_type},
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
        SELECT id FROM app.entity_id_map
        WHERE id = ${assignmentId}
          AND child_entity_type_id = ${actionEntityId}
          AND child_entity_type = ${actionEntityType}
          AND active_flag = true
      `);

      if (!existingAssignment.length) {
        return reply.status(404).send({ error: 'Assignment not found' });
      }

      // Mark assignment as inactive
      await db.execute(sql`
        UPDATE app.entity_id_map
        SET active_flag = false, updated_ts = NOW()
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
        child_entity_type: Type.String(),
        child_entity_type_id: Type.String({ format: 'uuid' }),
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
      const { child_entity_type, child_entity_type_id } = request.query as {
        child_entity_type: string;
        child_entity_type_id: string;
      };

      fastify.log.info(`Entity hierarchy mapping request: employeeId=${employeeId}, child_entity_type=${child_entity_type}, child_entity_type_id=${child_entity_type_id}`);

      if (!employeeId) {
        fastify.log.error('No employee ID in request');
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Note: Removed UI RBAC check - validation now handled by data-based API gating

      // Get current assignments
      fastify.log.info(`Fetching mappings for ${child_entity_type} ${child_entity_type_id}`);
      const mappings = await db.execute(sql`
        SELECT
          id,
          child_entity_type_id,
          child_entity_type,
          parent_entity_type_id,
          parent_entity_type,
          created_at,
          active
        FROM app.entity_id_map
        WHERE child_entity_type_id = ${child_entity_type_id}
          AND child_entity_type = ${child_entity_type}
          AND active_flag = true
        ORDER BY created_at DESC
      `);
      fastify.log.info(`Found ${mappings.length} mappings`);

      return {
        data: mappings.map(mapping => ({
          id: String(mapping.id),
          child_entity_type_id: String(mapping.child_entity_type_id),
          child_entity_type: String(mapping.child_entity_type),
          parent_entity_type_id: String(mapping.parent_entity_type_id),
          parent_entity_type: String(mapping.parent_entity_type),
          created_at: String(mapping.created_at),
          active: Boolean(mapping.active_flag_flag),
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
      const { child_entity_type_id, child_entity_type, assignments } = request.body as {
        child_entity_type_id: string;
        child_entity_type: string;
        assignments: Array<{
          child_entity_type_id: string;
          child_entity_type: string;
          parent_entity_type_id: string;
          parent_entity_type: string;
        }>;
      };

      if (!employeeId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Note: Removed UI RBAC check - validation now handled by data-based API gating per assignment

      // Get current assignments
      const currentAssignments = await db.execute(sql`
        SELECT parent_entity_type_id, parent_entity_type
        FROM app.entity_id_map
        WHERE child_entity_type_id = ${child_entity_type_id}
          AND child_entity_type = ${child_entity_type}
          AND active_flag = true
      `);

      const currentSet = new Set(
        currentAssignments.map(a => `${a.parent_entity_type}:${a.parent_entity_type_id}`)
      );

      const newSet = new Set(
        assignments.map(a => `${a.parent_entity_type}:${a.parent_entity_type_id}`)
      );

      // Calculate changes
      const toRemove = [...currentSet].filter(x => !newSet.has(x));
      const toAdd = assignments.filter(a => !currentSet.has(`${a.parent_entity_type}:${a.parent_entity_type_id}`));

      let assignmentsCreated = 0;
      let assignmentsRemoved = 0;

      // Start transaction
      await db.transaction(async (tx) => {
        // Remove old assignments
        for (const removal of toRemove) {
          const [parentEntity, parentEntityId] = removal.split(':');
          await tx.execute(sql`
            UPDATE app.entity_id_map
            SET active_flag = false, updated_at = NOW()
            WHERE child_entity_type_id = ${child_entity_type_id}
              AND child_entity_type = ${child_entity_type}
              AND parent_entity_type_id = ${parentEntityId}
              AND parent_entity_type = ${parentEntity}
              AND active_flag = true
          `);
          assignmentsRemoved++;
        }

        // Add new assignments
        for (const assignment of toAdd) {
          // Validate parent entity assignment using data-based API gating
          const validation = await canAssignParentEntity(
            assignment.child_entity_type,
            assignment.child_entity_type_id,
            assignment.parent_entity_type,
            assignment.parent_entity_type_id
          );

          if (!validation.canAssign) {
            throw new Error(`Cannot assign parent entity ${assignment.parent_entity_type}:${assignment.parent_entity_type_id}: ${validation.reason}`);
          }

          // Create new assignment
          await tx.execute(sql`
            INSERT INTO app.entity_id_map (
              child_entity_type_id,
              child_entity_type,
              parent_entity_type_id,
              parent_entity_type,
              active,
              created_at,
              updated_at
            ) VALUES (
              ${assignment.child_entity_type_id},
              ${assignment.child_entity_type},
              ${assignment.parent_entity_type_id},
              ${assignment.parent_entity_type},
              true,
              NOW(),
              NOW()
            )
            ON CONFLICT (child_entity_type_id, child_entity_type, parent_entity_type_id, parent_entity_type)
            DO UPDATE SET
              active_flag = true,
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
        child_entity_type: Type.String(),
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
      const { child_entity_type } = request.query as { child_entity_type: string };

      if (!employeeId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Get valid parent entity types for this action entity from meta hierarchy
      const validParentTypes = await db.execute(sql`
        SELECT DISTINCT parent_entity_type
        FROM app.meta_entity_hierarchy_permission_mapping
        WHERE child_entity_type = ${child_entity_type}
          AND active_flag = true
        ORDER BY parent_entity_type
      `);

      const parentEntities = [];

      // For each valid parent type, get all entities the user can access
      for (const parentType of validParentTypes) {
        const parentEntityType = String(parentType.parent_entity_type);

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
          WHERE active_flag = true
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