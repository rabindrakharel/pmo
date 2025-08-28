import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { checkScopeAccess } from '../rbac/scope-auth.js';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

// Activity log types
const ActivityLogSchema = Type.Object({
  id: Type.String(),
  taskId: Type.String(),
  type: Type.Union([
    Type.Literal('comment'),
    Type.Literal('status_change'),
    Type.Literal('field_change'),
    Type.Literal('worklog'),
    Type.Literal('attachment')
  ]),
  authorId: Type.String(),
  authorName: Type.String(),
  content: Type.String(),
  metadata: Type.Optional(Type.Object({
    fieldName: Type.Optional(Type.String()),
    oldValue: Type.Optional(Type.Any()),
    newValue: Type.Optional(Type.Any()),
    timeSpent: Type.Optional(Type.Number()),
    timeRemaining: Type.Optional(Type.Number()),
    fileName: Type.Optional(Type.String()),
    fileSize: Type.Optional(Type.Number()),
  })),
  timestamp: Type.String(),
  created: Type.String(),
  updated: Type.String(),
});

const CreateCommentSchema = Type.Object({
  content: Type.String({ minLength: 1 }),
});

const CreateWorklogSchema = Type.Object({
  timeSpent: Type.Number({ minimum: 1 }), // minutes
  timeRemaining: Type.Optional(Type.Number({ minimum: 0 })),
  description: Type.Optional(Type.String()),
  startedAt: Type.Optional(Type.String({ format: 'date-time' })),
});

export async function taskActivityRoutes(fastify: FastifyInstance) {
  // Get activity logs for a task
  fastify.get('/api/v1/task/:taskId/activity', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        taskId: Type.String({ format: 'uuid' }),
      }),
      querystring: Type.Object({
        type: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(ActivityLogSchema),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number(),
        }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const { type, limit = 50, offset = 0 } = request.query as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    try {
      // Get task to check permissions
      const task = await db.execute(sql`
        SELECT proj_head_id FROM app.ops_task_head WHERE id = ${taskId}
      `);

      if (task.length === 0) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      // Check if user has access to view tasks
      const scopeAccess = await checkScopeAccess(userId, 'task', 'view');
      if (!scopeAccess.allowed) {
        return reply.status(403).send({ error: 'Insufficient permissions' });
      }

      // Build conditions
      const conditions = [sql`task_id = ${taskId}`];
      if (type) {
        conditions.push(sql`type = ${type}`);
      }

      // Get total count
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total 
        FROM app.ops_task_activity 
        WHERE ${sql.join(conditions, sql` AND `)}
      `);
      const total = Number(countResult[0]?.total || 0);

      // Get activity logs
      const activities = await db.execute(sql`
        SELECT 
          ta.id,
          ta.task_id as "taskId",
          ta.type,
          ta.author_id as "authorId",
          COALESCE(e.name, ta.author_id) as "authorName",
          ta.content,
          ta.metadata,
          ta.timestamp,
          ta.created,
          ta.updated
        FROM app.ops_task_activity ta
        LEFT JOIN app.d_emp e ON ta.author_id = e.id
        WHERE ${sql.join(conditions, sql` AND `)}
        ORDER BY ta.timestamp DESC, ta.created DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return {
        data: activities,
        total,
        limit,
        offset,
      };
    } catch (error) {
      fastify.log.error('Error fetching task activity:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Add comment to task
  fastify.post('/api/v1/task/:taskId/comment', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        taskId: Type.String({ format: 'uuid' }),
      }),
      body: CreateCommentSchema,
      response: {
        201: ActivityLogSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const { content } = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    try {
      // Get task to check permissions
      const task = await db.execute(sql`
        SELECT proj_head_id FROM app.ops_task_head WHERE id = ${taskId}
      `);

      if (task.length === 0) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      // Check if user has access to modify tasks
      const scopeAccess = await checkScopeAccess(userId, 'task', 'modify');
      if (!scopeAccess.allowed) {
        return reply.status(403).send({ error: 'Insufficient permissions' });
      }

      // Create activity log entry
      const result = await db.execute(sql`
        INSERT INTO app.ops_task_activity (
          task_id, type, author_id, content, timestamp
        )
        VALUES (
          ${taskId}, 'comment', ${userId}, ${content}, NOW()
        )
        RETURNING 
          id,
          task_id as "taskId",
          type,
          author_id as "authorId",
          content,
          metadata,
          timestamp,
          created,
          updated
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to create comment' });
      }

      // Get author name
      const author = await db.execute(sql`
        SELECT name FROM app.d_emp WHERE id = ${userId}
      `);

      const activityLog = {
        ...result[0],
        authorName: author[0]?.name || userId,
      } as any;

      return reply.status(201).send(activityLog);
    } catch (error) {
      fastify.log.error('Error creating comment:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Log work on task
  fastify.post('/api/v1/task/:taskId/worklog', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        taskId: Type.String({ format: 'uuid' }),
      }),
      body: CreateWorklogSchema,
      response: {
        201: ActivityLogSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const { timeSpent, timeRemaining, description, startedAt } = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    try {
      // Get task to check permissions
      const task = await db.execute(sql`
        SELECT proj_head_id FROM app.ops_task_head WHERE id = ${taskId}
      `);

      if (task.length === 0) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      // Check if user has access to modify tasks
      const scopeAccess = await checkScopeAccess(userId, 'task', 'modify');
      if (!scopeAccess.allowed) {
        return reply.status(403).send({ error: 'Insufficient permissions' });
      }

      const hours = Math.floor(timeSpent / 60);
      const minutes = timeSpent % 60;
      const worklogContent = `Logged ${hours}h ${minutes}m${description ? `: ${description}` : ''}`;

      // Create activity log entry
      const result = await db.execute(sql`
        INSERT INTO app.ops_task_activity (
          task_id, type, author_id, content, metadata, timestamp
        )
        VALUES (
          ${taskId}, 'worklog', ${userId}, ${worklogContent}, 
          ${JSON.stringify({ timeSpent, timeRemaining, startedAt })}::jsonb,
          ${startedAt || 'NOW()'}
        )
        RETURNING 
          id,
          task_id as "taskId",
          type,
          author_id as "authorId",
          content,
          metadata,
          timestamp,
          created,
          updated
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to log work' });
      }

      // Get author name
      const author = await db.execute(sql`
        SELECT name FROM app.d_emp WHERE id = ${userId}
      `);

      const activityLog = {
        ...result[0],
        authorName: author[0]?.name || userId,
      } as any;

      return reply.status(201).send(activityLog);
    } catch (error) {
      fastify.log.error('Error logging work:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get task work summary
  fastify.get('/api/v1/task/:taskId/work-summary', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        taskId: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          totalSpent: Type.Number(), // minutes
          totalRemaining: Type.Optional(Type.Number()), // minutes
          originalEstimate: Type.Optional(Type.Number()), // minutes
          workLogs: Type.Array(Type.Object({
            id: Type.String(),
            authorName: Type.String(),
            timeSpent: Type.Number(),
            description: Type.Optional(Type.String()),
            timestamp: Type.String(),
          })),
        }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    try {
      // Get task to check permissions
      const task = await db.execute(sql`
        SELECT proj_head_id FROM app.ops_task_head WHERE id = ${taskId}
      `);

      if (task.length === 0) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      // Check if user has access to view tasks
      const scopeAccess = await checkScopeAccess(userId, 'task', 'view');
      if (!scopeAccess.allowed) {
        return reply.status(403).send({ error: 'Insufficient permissions' });
      }

      // Get work logs
      const workLogs = await db.execute(sql`
        SELECT 
          ta.id,
          COALESCE(e.name, ta.author_id) as "authorName",
          (ta.metadata->>'timeSpent')::int as "timeSpent",
          ta.metadata->>'description' as description,
          ta.timestamp
        FROM app.ops_task_activity ta
        LEFT JOIN app.d_emp e ON ta.author_id = e.id
        WHERE ta.task_id = ${taskId} AND ta.type = 'worklog'
        ORDER BY ta.timestamp DESC
      `);

      // Calculate totals
      const totalSpent = workLogs.reduce((sum: number, log: any) => sum + (log.timeSpent || 0), 0);
      
      // Get the most recent remaining estimate
      const latestRemaining = workLogs.find((log: any) => 
        log.metadata && JSON.parse(log.metadata as string || '{}').timeRemaining
      );

      return {
        totalSpent,
        totalRemaining: latestRemaining ? JSON.parse(String(latestRemaining.metadata || '{}')).timeRemaining : undefined,
        originalEstimate: undefined, // Could be stored in task record
        workLogs: workLogs.map((log: any) => ({
          id: log.id,
          authorName: log.authorName,
          timeSpent: log.timeSpent,
          description: log.description,
          timestamp: log.timestamp,
        })),
      };
    } catch (error) {
      fastify.log.error('Error fetching work summary:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}