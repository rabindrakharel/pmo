/**
 * ============================================================================
 * TASK-DATA ROUTES MODULE - Next-Gen Activity Feed (v2.0)
 * ============================================================================
 *
 * FEATURES:
 * - Threading: Reply to comments with task_data_id parent reference
 * - Reactions: Emoji reactions with toggle support
 * - Mentions: @mention tracking with employee UUID arrays
 * - Pinning: Pin important updates to top of feed
 * - Resolution: Mark threads/questions as resolved
 * - S3 Attachments: Normalized S3 storage (s3_bucket + s3_key)
 * - Smart Composer: Auto-detected intents from content
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

// S3 Attachment Schema (permissive - additionalProperties allowed)
const S3AttachmentSchema = Type.Any();

// Task Data Schema (response) - v2.0 with all new fields
// NOTE: Using Type.Any() for numeric/jsonb fields to handle PostgreSQL type variations
const TaskDataSchema = Type.Object({
  id: Type.String(),
  task_id: Type.String(),
  task_data_id: Type.Optional(Type.Union([Type.String(), Type.Null()])), // Parent for threading
  stage: Type.String(),
  updated_by__employee_id: Type.String(),
  data_richtext: Type.Any(),
  update_type: Type.String(),
  hours_logged: Type.Optional(Type.Any()), // numeric returns as string from postgres
  status_change_from: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  status_change_to: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  metadata: Type.Optional(Type.Any()),
  // v2.0 fields
  mentioned__employee_ids: Type.Optional(Type.Any()), // UUID array
  reactions_data: Type.Optional(Type.Any()),
  pinned_flag: Type.Optional(Type.Any()), // boolean
  pinned_by__employee_id: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  pinned_ts: Type.Optional(Type.Any()),
  resolved_flag: Type.Optional(Type.Any()), // boolean
  resolved_by__employee_id: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  resolved_ts: Type.Optional(Type.Any()),
  attachments: Type.Optional(Type.Any()), // JSONB array of S3 attachment objects
  detected_intents_data: Type.Optional(Type.Any()),
  // Temporal
  created_ts: Type.Any(),
  updated_ts: Type.Any(),
  // Joined fields
  updated_by_name: Type.Optional(Type.Any()),
  reply_count: Type.Optional(Type.Any()),
});

// Create schema - v2.0 with all new fields
// NOTE: task_id comes from URL params, not body
const CreateTaskDataSchema = Type.Object({
  task_data_id: Type.Optional(Type.Union([Type.String(), Type.Null()])), // Parent for reply
  data_richtext: Type.Any(),
  update_type: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  hours_logged: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  status_change_from: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  status_change_to: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  metadata: Type.Optional(Type.Any()),
  stage: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  // v2.0 fields
  mentioned__employee_ids: Type.Optional(Type.Any()), // UUID array
  attachments: Type.Optional(Type.Any()), // JSONB array of S3 attachment objects
  detected_intents_data: Type.Optional(Type.Any()),
});

// Reaction toggle schema
const ReactionToggleSchema = Type.Object({
  emoji: Type.String(), // e.g., "thumbs_up", "heart", "rocket"
});

export async function taskDataRoutes(fastify: FastifyInstance) {
  const entityInfra = getEntityInfrastructure(db);

  // ============================================================================
  // GET /api/v1/task/:taskId/data - List all updates with threading support
  // ============================================================================
  fastify.get('/api/v1/task/:taskId/data', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        taskId: Type.String(),
      }),
      querystring: Type.Object({
        include_replies: Type.Optional(Type.Boolean()), // Include nested replies
        pinned_only: Type.Optional(Type.Boolean()),     // Only pinned items
        unresolved_only: Type.Optional(Type.Boolean()), // Only unresolved threads
      }),
      response: {
        200: Type.Object({
          data: Type.Array(TaskDataSchema),
          total: Type.Number(),
          pinned_count: Type.Optional(Type.Number()),
          unresolved_count: Type.Optional(Type.Number()),
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
      const { include_replies, pinned_only, unresolved_only } = request.query as {
        include_replies?: boolean;
        pinned_only?: boolean;
        unresolved_only?: boolean;
      };

      // Check if user has view permission on the task
      const canView = await entityInfra.check_entity_rbac(userId, 'task', taskId, Permission.VIEW);
      if (!canView) {
        return reply.status(403).send({ error: 'No permission to view task updates' });
      }

      // Build WHERE conditions
      let whereConditions = sql`td.task_id = ${taskId}::uuid AND td.stage = 'saved'`;

      if (pinned_only) {
        whereConditions = sql`${whereConditions} AND td.pinned_flag = true`;
      }

      if (unresolved_only) {
        whereConditions = sql`${whereConditions} AND td.resolved_flag = false AND td.task_data_id IS NULL`;
      }

      // By default, get top-level comments only (replies fetched separately or nested)
      if (!include_replies) {
        whereConditions = sql`${whereConditions} AND td.task_data_id IS NULL`;
      }

      // Get task data entries with employee names and reply counts
      const updates = await db.execute(sql`
        SELECT
          td.id,
          td.task_id,
          td.task_data_id,
          td.stage,
          td.updated_by__employee_id,
          td.data_richtext,
          td.update_type,
          td.hours_logged,
          td.status_change_from,
          td.status_change_to,
          COALESCE(td.metadata, '{}'::jsonb) as metadata,
          td.mentioned__employee_ids,
          COALESCE(td.reactions_data, '{}'::jsonb) as reactions_data,
          td.pinned_flag,
          td.pinned_by__employee_id,
          td.pinned_ts,
          td.resolved_flag,
          td.resolved_by__employee_id,
          td.resolved_ts,
          COALESCE(td.attachments, '[]'::jsonb) as attachments,
          COALESCE(td.detected_intents_data, '{}'::jsonb) as detected_intents_data,
          td.created_ts,
          td.updated_ts,
          e.name as updated_by_name,
          (SELECT COUNT(*) FROM app.d_task_data r WHERE r.task_data_id = td.id) as reply_count
        FROM app.d_task_data td
        LEFT JOIN app.employee e ON td.updated_by__employee_id = e.id
        WHERE ${whereConditions}
        ORDER BY td.pinned_flag DESC, td.created_ts DESC
      `);

      // Get counts for UI indicators
      const counts = await db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE pinned_flag = true) as pinned_count,
          COUNT(*) FILTER (WHERE resolved_flag = false AND task_data_id IS NULL) as unresolved_count
        FROM app.d_task_data
        WHERE task_id = ${taskId}::uuid AND stage = 'saved'
      `);

      return {
        data: updates,
        total: updates.length,
        pinned_count: Number(counts[0]?.pinned_count || 0),
        unresolved_count: Number(counts[0]?.unresolved_count || 0),
      };
    } catch (error) {
      fastify.log.error('Error fetching task data: ' + String(error));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // GET /api/v1/task/:taskId/data/:dataId/replies - Get replies for a comment
  // ============================================================================
  fastify.get('/api/v1/task/:taskId/data/:dataId/replies', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        taskId: Type.String(),
        dataId: Type.String(),
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

      const { taskId, dataId } = request.params as { taskId: string; dataId: string };

      // Check permission
      const canView = await entityInfra.check_entity_rbac(userId, 'task', taskId, Permission.VIEW);
      if (!canView) {
        return reply.status(403).send({ error: 'No permission to view task updates' });
      }

      // Get all replies to this comment
      const replies = await db.execute(sql`
        SELECT
          td.id,
          td.task_id,
          td.task_data_id,
          td.stage,
          td.updated_by__employee_id,
          td.data_richtext,
          td.update_type,
          td.hours_logged,
          td.status_change_from,
          td.status_change_to,
          COALESCE(td.metadata, '{}'::jsonb) as metadata,
          td.mentioned__employee_ids,
          COALESCE(td.reactions_data, '{}'::jsonb) as reactions_data,
          td.pinned_flag,
          td.resolved_flag,
          COALESCE(td.attachments, '[]'::jsonb) as attachments,
          td.created_ts,
          td.updated_ts,
          e.name as updated_by_name
        FROM app.d_task_data td
        LEFT JOIN app.employee e ON td.updated_by__employee_id = e.id
        WHERE td.task_data_id = ${dataId}::uuid
          AND td.task_id = ${taskId}::uuid
          AND td.stage = 'saved'
        ORDER BY td.created_ts ASC
      `);

      return {
        data: replies,
        total: replies.length,
      };
    } catch (error) {
      fastify.log.error('Error fetching replies: ' + String(error));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // POST /api/v1/task/:taskId/data - Create new task update (with v2.0 fields)
  // ============================================================================
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

      // Check if user has edit permission on the task
      const canEdit = await entityInfra.check_entity_rbac(userId, 'task', taskId, Permission.EDIT);
      if (!canEdit) {
        return reply.status(403).send({ error: 'No permission to update this task' });
      }

      // Determine update_type (if replying, set to 'reply')
      let updateType = data.update_type || 'comment';
      if (data.task_data_id) {
        updateType = 'reply';
      }

      // Insert task data with v2.0 fields
      const result = await db.execute(sql`
        INSERT INTO app.d_task_data (
          task_id,
          task_data_id,
          stage,
          updated_by__employee_id,
          data_richtext,
          update_type,
          hours_logged,
          status_change_from,
          status_change_to,
          metadata,
          mentioned__employee_ids,
          attachments,
          detected_intents_data
        )
        VALUES (
          ${taskId}::uuid,
          ${data.task_data_id || null}::uuid,
          ${data.stage || 'saved'},
          ${userId}::uuid,
          ${JSON.stringify(data.data_richtext)}::jsonb,
          ${updateType},
          ${data.hours_logged || null},
          ${data.status_change_from || null},
          ${data.status_change_to || null},
          ${data.metadata ? JSON.stringify(data.metadata) : '{}'}::jsonb,
          ${data.mentioned__employee_ids ? `{${data.mentioned__employee_ids.join(',')}}` : '{}'}::uuid[],
          ${data.attachments ? JSON.stringify(data.attachments) : '[]'}::jsonb,
          ${data.detected_intents_data ? JSON.stringify(data.detected_intents_data) : '{}'}::jsonb
        )
        RETURNING *
      `);

      const created = result[0];

      // Get employee name
      const employee = await db.execute(sql`
        SELECT name FROM app.employee WHERE id = ${userId}::uuid
      `);

      return reply.status(201).send({
        ...created,
        updated_by_name: employee[0]?.name || null,
        reply_count: 0,
      });
    } catch (error) {
      fastify.log.error('Error creating task data: ' + String(error));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // POST /api/v1/task/:taskId/data/:dataId/react - Toggle emoji reaction
  // ============================================================================
  fastify.post('/api/v1/task/:taskId/data/:dataId/react', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        taskId: Type.String(),
        dataId: Type.String(),
      }),
      body: ReactionToggleSchema,
      response: {
        200: Type.Object({
          reactions_data: Type.Any(),
          action: Type.String(), // 'added' or 'removed'
        }),
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
      const { emoji } = request.body as { emoji: string };

      // Check permission
      const canView = await entityInfra.check_entity_rbac(userId, 'task', taskId, Permission.VIEW);
      if (!canView) {
        return reply.status(403).send({ error: 'No permission to react' });
      }

      // Get current reactions
      const current = await db.execute(sql`
        SELECT reactions_data FROM app.d_task_data
        WHERE id = ${dataId}::uuid AND task_id = ${taskId}::uuid
      `);

      if (current.length === 0) {
        return reply.status(404).send({ error: 'Task update not found' });
      }

      const reactions = current[0].reactions_data || {};
      const emojiReactions = reactions[emoji] || [];
      let action: string;

      // Toggle: add if not present, remove if present
      if (emojiReactions.includes(userId)) {
        // Remove user from reaction
        reactions[emoji] = emojiReactions.filter((id: string) => id !== userId);
        if (reactions[emoji].length === 0) {
          delete reactions[emoji];
        }
        action = 'removed';
      } else {
        // Add user to reaction
        reactions[emoji] = [...emojiReactions, userId];
        action = 'added';
      }

      // Update reactions
      await db.execute(sql`
        UPDATE app.d_task_data
        SET reactions_data = ${JSON.stringify(reactions)}::jsonb,
            updated_ts = now()
        WHERE id = ${dataId}::uuid
      `);

      return {
        reactions_data: reactions,
        action,
      };
    } catch (error) {
      fastify.log.error('Error toggling reaction: ' + String(error));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // PATCH /api/v1/task/:taskId/data/:dataId/pin - Toggle pin status
  // ============================================================================
  fastify.patch('/api/v1/task/:taskId/data/:dataId/pin', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        taskId: Type.String(),
        dataId: Type.String(),
      }),
      response: {
        200: Type.Object({
          pinned_flag: Type.Boolean(),
          pinned_by__employee_id: Type.Union([Type.String(), Type.Null()]),
          pinned_ts: Type.Union([Type.String(), Type.Null()]),
        }),
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

      // Check EDIT permission (pinning requires edit access)
      const canEdit = await entityInfra.check_entity_rbac(userId, 'task', taskId, Permission.EDIT);
      if (!canEdit) {
        return reply.status(403).send({ error: 'No permission to pin updates' });
      }

      // Get current pin status
      const current = await db.execute(sql`
        SELECT pinned_flag FROM app.d_task_data
        WHERE id = ${dataId}::uuid AND task_id = ${taskId}::uuid
      `);

      if (current.length === 0) {
        return reply.status(404).send({ error: 'Task update not found' });
      }

      const newPinnedFlag = !current[0].pinned_flag;

      // Toggle pin
      const result = await db.execute(sql`
        UPDATE app.d_task_data
        SET pinned_flag = ${newPinnedFlag},
            pinned_by__employee_id = ${newPinnedFlag ? userId : null}::uuid,
            pinned_ts = ${newPinnedFlag ? sql`now()` : sql`null`},
            updated_ts = now()
        WHERE id = ${dataId}::uuid
        RETURNING pinned_flag, pinned_by__employee_id, pinned_ts
      `);

      return result[0];
    } catch (error) {
      fastify.log.error('Error toggling pin: ' + String(error));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // PATCH /api/v1/task/:taskId/data/:dataId/resolve - Toggle resolved status
  // ============================================================================
  fastify.patch('/api/v1/task/:taskId/data/:dataId/resolve', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        taskId: Type.String(),
        dataId: Type.String(),
      }),
      response: {
        200: Type.Object({
          resolved_flag: Type.Boolean(),
          resolved_by__employee_id: Type.Union([Type.String(), Type.Null()]),
          resolved_ts: Type.Union([Type.String(), Type.Null()]),
        }),
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

      // Check EDIT permission
      const canEdit = await entityInfra.check_entity_rbac(userId, 'task', taskId, Permission.EDIT);
      if (!canEdit) {
        return reply.status(403).send({ error: 'No permission to resolve updates' });
      }

      // Get current resolved status
      const current = await db.execute(sql`
        SELECT resolved_flag FROM app.d_task_data
        WHERE id = ${dataId}::uuid AND task_id = ${taskId}::uuid
      `);

      if (current.length === 0) {
        return reply.status(404).send({ error: 'Task update not found' });
      }

      const newResolvedFlag = !current[0].resolved_flag;

      // Toggle resolved
      const result = await db.execute(sql`
        UPDATE app.d_task_data
        SET resolved_flag = ${newResolvedFlag},
            resolved_by__employee_id = ${newResolvedFlag ? userId : null}::uuid,
            resolved_ts = ${newResolvedFlag ? sql`now()` : sql`null`},
            updated_ts = now()
        WHERE id = ${dataId}::uuid
        RETURNING resolved_flag, resolved_by__employee_id, resolved_ts
      `);

      return result[0];
    } catch (error) {
      fastify.log.error('Error toggling resolved: ' + String(error));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // GET /api/v1/task/:taskId/data/:dataId - Get single task data entry
  // ============================================================================
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

      // Check permission
      const canView = await entityInfra.check_entity_rbac(userId, 'task', taskId, Permission.VIEW);
      if (!canView) {
        return reply.status(403).send({ error: 'No permission to view task updates' });
      }

      const result = await db.execute(sql`
        SELECT
          td.id,
          td.task_id,
          td.task_data_id,
          td.stage,
          td.updated_by__employee_id,
          td.data_richtext,
          td.update_type,
          td.hours_logged,
          td.status_change_from,
          td.status_change_to,
          COALESCE(td.metadata, '{}'::jsonb) as metadata,
          td.mentioned__employee_ids,
          COALESCE(td.reactions_data, '{}'::jsonb) as reactions_data,
          td.pinned_flag,
          td.pinned_by__employee_id,
          td.pinned_ts,
          td.resolved_flag,
          td.resolved_by__employee_id,
          td.resolved_ts,
          COALESCE(td.attachments, '[]'::jsonb) as attachments,
          COALESCE(td.detected_intents_data, '{}'::jsonb) as detected_intents_data,
          td.created_ts,
          td.updated_ts,
          e.name as updated_by_name,
          (SELECT COUNT(*) FROM app.d_task_data r WHERE r.task_data_id = td.id) as reply_count
        FROM app.d_task_data td
        LEFT JOIN app.employee e ON td.updated_by__employee_id = e.id
        WHERE td.id = ${dataId}::uuid AND td.task_id = ${taskId}::uuid
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
