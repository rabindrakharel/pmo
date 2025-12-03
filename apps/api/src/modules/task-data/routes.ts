/**
 * ============================================================================
 * TASK-DATA ROUTES MODULE - Custom Routes for Task Updates/Comments
 * ============================================================================
 *
 * ⚠️ CUSTOM ROUTES DECISION (NOT USING FACTORY PATTERN)
 * ──────────────────────────────────────────────────────
 * This module intentionally uses custom routes instead of createUniversalEntityRoutes
 * factory for the following reasons:
 *
 * 1. NESTED URL PATTERN: Task data uses /api/v1/task/:taskId/data pattern where
 *    the parent task ID is part of the URL. This is fundamentally different from
 *    the standard /api/v1/{entity} pattern the factory generates.
 *
 * 2. PARENT ENTITY RBAC: Permission checks are done against the parent TASK entity,
 *    not the task_data entity itself. Users with VIEW on task can view task data;
 *    users with EDIT on task can create task data entries.
 *
 * 3. NOT A STANDALONE ENTITY: Task data (d_task_data) is a child/detail table of
 *    task, not a registered entity in the entity system. It doesn't have its own
 *    RBAC entries or entity_instance records.
 *
 * 4. ACTIVITY LOG PATTERN: Task data represents an append-only activity log with
 *    comments, status changes, and time entries - not a traditional CRUD entity.
 *
 * ============================================================================
 */

import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { getEntityInfrastructure, Permission } from '@/services/entity-infrastructure.service.js';

// Task Data Schema
const TaskDataSchema = Type.Object({
  id: Type.String(),
  task_id: Type.String(),
  project_id: Type.String(),
  stage: Type.String(),
  updated_by__employee_id: Type.String(),
  data_richtext: Type.Any(),
  update_type: Type.String(),
  hours_logged: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  status_change_from: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  status_change_to: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  metadata: Type.Optional(Type.Any()),
  created_ts: Type.String(),
  updated_ts: Type.String(),
  updated_by_name: Type.Optional(Type.String()),
});

const CreateTaskDataSchema = Type.Object({
  task_id: Type.String(),
  project_id: Type.String(),
  data_richtext: Type.Any(),
  update_type: Type.Optional(Type.String()),
  hours_logged: Type.Optional(Type.Number()),
  status_change_from: Type.Optional(Type.String()),
  status_change_to: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
  stage: Type.Optional(Type.String()),
});

export async function taskDataRoutes(fastify: FastifyInstance) {
  const entityInfra = getEntityInfrastructure(db);

  // Get all updates for a task
  fastify.get('/api/v1/task/:taskId/data', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        taskId: Type.String(),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(TaskDataSchema),
          total: Type.Number(),
        }),
        403: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const userId = request.user?.sub;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { taskId } = request.params as { taskId: string };

      // Check if user has view permission on the task (DRY pattern)
      const canView = await entityInfra.check_entity_rbac(userId, 'task', taskId, Permission.VIEW);
      if (!canView) {
        return reply.status(403).send({ error: 'No permission to view task updates' });
      }

      // Get all task data entries with employee names
      const updates = await db.execute(sql`
        SELECT
          td.id,
          td.task_id,
          td.project_id,
          td.stage,
          td.updated_by__employee_id,
          td.data_richtext,
          td.update_type,
          td.hours_logged,
          td.status_change_from,
          td.status_change_to,
          COALESCE(td.metadata, '{}'::jsonb) as metadata,
          td.created_ts,
          td.updated_ts,
          e.name as updated_by_name
        FROM app.d_task_data td
        LEFT JOIN app.employee e ON td.updated_by__employee_id = e.id
        WHERE td.task_id = ${taskId}
          AND td.stage = 'saved'
        ORDER BY td.created_ts DESC
      `);

      return {
        data: updates,
        total: updates.length,
      };
    } catch (error) {
      fastify.log.error('Error fetching task data: ' + String(error));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create a new task update
  fastify.post('/api/v1/task/:taskId/data', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        taskId: Type.String(),
      }),
      body: CreateTaskDataSchema,
      response: {
        201: TaskDataSchema,
        403: Type.Object({ error: Type.String() }),
        400: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const userId = request.user?.sub;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { taskId } = request.params as { taskId: string };
      const data = request.body as any;

      // Verify task_id matches
      if (data.task_id !== taskId) {
        return reply.status(400).send({ error: 'Task ID mismatch' });
      }

      // Check if user has edit permission on the task (DRY pattern)
      const canEdit = await entityInfra.check_entity_rbac(userId, 'task', taskId, Permission.EDIT);
      if (!canEdit) {
        return reply.status(403).send({ error: 'No permission to update this task' });
      }

      // Insert task data
      const result = await db.execute(sql`
        INSERT INTO app.d_task_data (
          task_id,
          project_id,
          stage,
          updated_by__employee_id,
          data_richtext,
          update_type,
          hours_logged,
          status_change_from,
          status_change_to,
          metadata
        )
        VALUES (
          ${data.task_id},
          ${data.project_id},
          ${data.stage || 'saved'},
          ${userId},
          ${JSON.stringify(data.data_richtext)},
          ${data.update_type || 'comment'},
          ${data.hours_logged || null},
          ${data.status_change_from || null},
          ${data.status_change_to || null},
          ${data.metadata ? JSON.stringify(data.metadata) : '{}'}::jsonb
        )
        RETURNING
          id,
          task_id,
          project_id,
          stage,
          updated_by__employee_id,
          data_richtext,
          update_type,
          hours_logged,
          status_change_from,
          status_change_to,
          metadata,
          created_ts,
          updated_ts
      `);

      const created = result[0];

      // Get employee name
      const employee = await db.execute(sql`
        SELECT name FROM app.employee WHERE id = ${userId}
      `);

      return reply.status(201).send({
        ...created,
        updated_by_name: employee[0]?.name || null,
      });
    } catch (error) {
      fastify.log.error('Error creating task data: ' + String(error));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single task data entry
  fastify.get('/api/v1/task/:taskId/data/:dataId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        taskId: Type.String(),
        dataId: Type.String(),
      }),
      response: {
        200: TaskDataSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const userId = request.user?.sub;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { taskId, dataId } = request.params as { taskId: string; dataId: string };

      // Check permission (DRY pattern)
      const canView = await entityInfra.check_entity_rbac(userId, 'task', taskId, Permission.VIEW);
      if (!canView) {
        return reply.status(403).send({ error: 'No permission to view task updates' });
      }

      const result = await db.execute(sql`
        SELECT
          td.id,
          td.task_id,
          td.project_id,
          td.stage,
          td.updated_by__employee_id,
          td.data_richtext,
          td.update_type,
          td.hours_logged,
          td.status_change_from,
          td.status_change_to,
          COALESCE(td.metadata, '{}'::jsonb) as metadata,
          td.created_ts,
          td.updated_ts,
          e.name as updated_by_name
        FROM app.d_task_data td
        LEFT JOIN app.employee e ON td.updated_by__employee_id = e.id
        WHERE td.id = ${dataId} AND td.task_id = ${taskId}
      `);

      if (result.length === 0) {
        return reply.status(404).send({ error: 'Task update not found' });
      }

      return result[0];
    } catch (error) {
      fastify.log.error('Error fetching task data: ' + String(error));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
