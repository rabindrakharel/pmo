import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { checkScopeAccess, Permission, applyScopeFiltering } from '../rbac/scope-auth.js';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { 
  getUniversalColumnMetadata, 
  filterUniversalColumns,
  getColumnsByMetadata 
} from '../../lib/universal-schema-metadata.js';

const TaskSchema = Type.Object({
  id: Type.String(),
  title: Type.String(),
  projHeadId: Type.String(),
  assigneeId: Type.Optional(Type.String()),
  reviewers: Type.Optional(Type.Array(Type.String())),
  approvers: Type.Optional(Type.Array(Type.String())),
  collaborators: Type.Optional(Type.Array(Type.String())),
  parentHeadId: Type.Optional(Type.String()),
  clientGroupId: Type.Optional(Type.String()),
  clients: Type.Optional(Type.Array(Type.String())),
  worksiteId: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Array(Type.String())),
  created: Type.String(),
  updated: Type.String(),
});

const TaskRecordSchema = Type.Object({
  id: Type.String(),
  headId: Type.String(),
  title: Type.String(),
  statusId: Type.String(),
  stageId: Type.String(),
  dueDate: Type.Optional(Type.String()),
  active: Type.Boolean(),
  fromTs: Type.String(),
  toTs: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Array(Type.String())),
  created: Type.String(),
  updated: Type.String(),
});

const CreateTaskSchema = Type.Object({
  title: Type.String({ minLength: 1 }),
  projHeadId: Type.String({ format: 'uuid' }),
  assigneeId: Type.Optional(Type.String({ format: 'uuid' })),
  parentHeadId: Type.Optional(Type.String({ format: 'uuid' })),
  reviewers: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
  approvers: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
  collaborators: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
  clientGroupId: Type.Optional(Type.String({ format: 'uuid' })),
  worksiteId: Type.Optional(Type.String({ format: 'uuid' })),
  statusId: Type.Optional(Type.String({ format: 'uuid' })),
  stageId: Type.Optional(Type.String({ format: 'uuid' })),
  dueDate: Type.Optional(Type.String({ format: 'date' })),
  tags: Type.Optional(Type.Array(Type.String())),
});

const UpdateTaskSchema = Type.Partial(CreateTaskSchema);

export async function taskRoutes(fastify: FastifyInstance) {
  // List tasks with filtering
  fastify.get('/api/v1/task', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        projHeadId: Type.Optional(Type.String()),
        assigneeId: Type.Optional(Type.String()),
        statusId: Type.Optional(Type.String()),
        stageId: Type.Optional(Type.String()),
        parentHeadId: Type.Optional(Type.String()),
        active: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(Type.Object({
            taskHead: TaskSchema,
            currentRecord: Type.Optional(TaskRecordSchema),
          })),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number(),
        }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { 
      projHeadId, assigneeId, statusId, stageId, parentHeadId, 
      active, search, limit = 50, offset = 0 
    } = request.query as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    };

    // Check if user has access to view tasks - filter by projects they can access
    const projectScopeAccess = await checkScopeAccess(userId, 'project', 'view', undefined);
    if (!projectScopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      // Get user's allowed project IDs for filtering
      const allowedProjectIds = await applyScopeFiltering(userId, 'project', 0); // 0 = VIEW permission

      // Build query conditions
      const conditions = [];
      
      if (allowedProjectIds.length > 0) {
        // Use IN clause instead of ANY for better compatibility with Drizzle
        conditions.push(sql.raw(`th.proj_head_id IN (${allowedProjectIds.map(id => `'${id}'`).join(',')})`));
      } else {
        // If no project access, return empty result
        return {
          data: [],
          total: 0,
          limit,
          offset,
        };
      }
      
      if (projHeadId !== undefined) {
        conditions.push(sql`th.proj_head_id = ${projHeadId}`);
      }
      
      if (assigneeId !== undefined) {
        conditions.push(sql`th.assignee = ${assigneeId}`);
      }
      
      if (parentHeadId !== undefined) {
        conditions.push(sql`th.parent_head_id = ${parentHeadId}`);
      }

      // Get total count
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total 
        FROM app.ops_task_head th
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      // Get paginated task heads with current records
      const tasks = await db.execute(sql`
        SELECT 
          th.id as "headId",
          th.proj_head_id as "projHeadId",
          th.parent_head_id as "parentHeadId",
          th.assignee as "assigneeId",
          th.client_group_id as "clientGroupId",
          th.clients,
          th.reviewers,
          th.approvers,
          th.collaborators,
          th.worksite_id as "worksiteId",
          th.tags as "headTags",
          th.created as "headCreated",
          th.updated as "headUpdated",
          tr.id as "recordId",
          tr.title,
          tr.status_id as "statusId",
          tr.stage_id as "stageId",
          tr.due_date as "dueDate",
          tr.active,
          tr.from_ts as "fromTs",
          tr.to_ts as "toTs",
          tr.tags as "recordTags",
          tr.created as "recordCreated",
          tr.updated as "recordUpdated"
        FROM app.ops_task_head th
        LEFT JOIN app.ops_task_records tr ON th.id = tr.head_id AND tr.active = true
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY th.created DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      // Apply universal column filtering and transform data
      const userPermissions = {
        canSeePII: projectScopeAccess.permissions?.includes(4) || false,
        canSeeFinancial: projectScopeAccess.permissions?.includes(4) || false,
        canSeeSystemFields: projectScopeAccess.permissions?.includes(4) || false,
        canSeeSafetyInfo: projectScopeAccess.permissions?.includes(4) || false,
      };
      
      const data = tasks.map(task => {
        const taskHeadData = {
          id: task.headId,
          projHeadId: task.projHeadId,
          parentHeadId: task.parentHeadId,
          assigneeId: task.assigneeId,
          clientGroupId: task.clientGroupId,
          clients: task.clients,
          reviewers: task.reviewers,
          approvers: task.approvers,
          collaborators: task.collaborators,
          worksiteId: task.worksiteId,
          tags: task.headTags,
          created: task.headCreated,
          updated: task.headUpdated,
        };
        
        const recordData = task.recordId ? {
          id: task.recordId,
          headId: task.headId,
          title: task.title,
          statusId: task.statusId,
          stageId: task.stageId,
          dueDate: task.dueDate,
          active: task.active,
          fromTs: task.fromTs,
          toTs: task.toTs,
          tags: task.recordTags,
          created: task.recordCreated,
          updated: task.recordUpdated,
        } : undefined;
        
        return {
          taskHead: filterUniversalColumns(taskHeadData, userPermissions),
          currentRecord: recordData ? filterUniversalColumns(recordData, userPermissions) : undefined,
        };
      });

      return {
        data,
        total,
        limit,
        offset,
      };
    } catch (error) {
      fastify.log.error('Error fetching tasks:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single task
  fastify.get('/api/v1/task/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          taskHead: TaskSchema,
          currentRecord: Type.Optional(TaskRecordSchema),
        }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    };

    try {
      // Get task head with current record
      const task = await db.execute(sql`
        SELECT 
          th.id as "headId",
          th.proj_head_id as "projHeadId",
          th.parent_head_id as "parentHeadId",
          th.assignee as "assigneeId",
          th.client_group_id as "clientGroupId",
          th.clients,
          th.reviewers,
          th.approvers,
          th.collaborators,
          th.worksite_id as "worksiteId",
          th.tags as "headTags",
          th.created as "headCreated",
          th.updated as "headUpdated",
          tr.id as "recordId",
          tr.title,
          tr.status_id as "statusId",
          tr.stage_id as "stageId",
          tr.due_date as "dueDate",
          tr.active,
          tr.from_ts as "fromTs",
          tr.to_ts as "toTs",
          tr.tags as "recordTags",
          tr.created as "recordCreated",
          tr.updated as "recordUpdated"
        FROM app.ops_task_head th
        LEFT JOIN app.ops_task_records tr ON th.id = tr.head_id AND tr.active = true
        WHERE th.id = ${id}
      `);

      if (task.length === 0) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      const taskData = task[0] as any;

      // Check if user has access to the project this task belongs to
      const scopeAccess = await checkScopeAccess(userId, 'project', 'view', taskData.projHeadId);
      if (!scopeAccess.allowed) {
        return reply.status(403).send({ error: 'Insufficient permissions' });
      }

      return {
        taskHead: {
          id: taskData.headId,
          projHeadId: taskData.projHeadId,
          parentHeadId: taskData.parentHeadId,
          assigneeId: taskData.assigneeId,
          clientGroupId: taskData.clientGroupId,
          clients: taskData.clients,
          reviewers: taskData.reviewers,
          approvers: taskData.approvers,
          collaborators: taskData.collaborators,
          worksiteId: taskData.worksiteId,
          tags: taskData.headTags,
          created: taskData.headCreated,
          updated: taskData.headUpdated,
        },
        currentRecord: taskData.recordId ? {
          id: taskData.recordId,
          headId: taskData.headId,
          title: taskData.title,
          statusId: taskData.statusId,
          stageId: taskData.stageId,
          dueDate: taskData.dueDate,
          active: taskData.active,
          fromTs: taskData.fromTs,
          toTs: taskData.toTs,
          tags: taskData.recordTags,
          created: taskData.recordCreated,
          updated: taskData.recordUpdated,
        } : undefined,
      };
    } catch (error) {
      fastify.log.error('Error fetching task:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create task
  fastify.post('/api/v1/task', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateTaskSchema,
      response: {
        201: Type.Object({
          taskHead: TaskSchema,
          currentRecord: TaskRecordSchema,
        }),
        403: Type.Object({ error: Type.String() }),
        400: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const data = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    };

    // Check if user has access to create tasks in the specified project
    const scopeAccess = await checkScopeAccess(userId, 'project', 'modify', data.projHeadId);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions to create task in this project' });
    }

    try {
      // Validate project exists
      const project = await db.execute(sql`
        SELECT id FROM app.ops_project_head WHERE id = ${data.projHeadId} AND active = true
      `);
      if (project.length === 0) {
        return reply.status(400).send({ error: 'Project not found' });
      }

      // Create task head
      const taskHeadResult = await db.execute(sql`
        INSERT INTO app.ops_task_head (
          proj_head_id, parent_head_id, assignee, client_group_id, 
          reviewers, approvers, collaborators, worksite_id, tags
        )
        VALUES (
          ${data.projHeadId}, ${data.parentHeadId || null}, ${data.assigneeId || null}, 
          ${data.clientGroupId || null}, 
          ${data.reviewers ? JSON.stringify(data.reviewers) : '[]'}::jsonb,
          ${data.approvers ? JSON.stringify(data.approvers) : '[]'}::jsonb,
          ${data.collaborators ? JSON.stringify(data.collaborators) : '[]'}::jsonb,
          ${data.worksiteId || null}, 
          ${data.tags ? JSON.stringify(data.tags) : '[]'}::jsonb
        )
        RETURNING id, proj_head_id as "projHeadId", parent_head_id as "parentHeadId", 
                  assignee as "assigneeId", client_group_id as "clientGroupId", clients, 
                  reviewers, approvers, collaborators, worksite_id as "worksiteId", 
                  tags, created, updated
      `);

      if (taskHeadResult.length === 0) {
        return reply.status(500).send({ error: 'Failed to create task head' });
      }

      const taskHead = taskHeadResult[0] as any;

      // Create initial task record
      const defaultStatusId = data.statusId || 
        (await db.execute(sql`SELECT id FROM app.meta_task_status WHERE code = 'OPEN' LIMIT 1`))[0]?.id;
      const defaultStageId = data.stageId || 
        (await db.execute(sql`SELECT id FROM app.meta_task_stage WHERE is_default = true LIMIT 1`))[0]?.id;

      const taskRecordResult = await db.execute(sql`
        INSERT INTO app.ops_task_records (
          head_id, title, status_id, stage_id, due_date, from_ts, active, tags
        )
        VALUES (
          ${taskHead.id}, ${data.title}, ${defaultStatusId}, ${defaultStageId}, 
          ${data.dueDate || null}, NOW(), true, 
          ${data.tags ? JSON.stringify(data.tags) : '[]'}::jsonb
        )
        RETURNING id, head_id as "headId", title, status_id as "statusId", 
                  stage_id as "stageId", due_date as "dueDate", active, 
                  from_ts as "fromTs", to_ts as "toTs", tags, created, updated
      `);

      if (taskRecordResult.length === 0) {
        return reply.status(500).send({ error: 'Failed to create task record' });
      }

      return reply.status(201).send({
        taskHead,
        currentRecord: taskRecordResult[0],
      });
    } catch (error) {
      fastify.log.error('Error creating task:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update task record (create new record with updated info)
  fastify.put('/api/v1/task/:id/record', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      body: Type.Object({
        title: Type.Optional(Type.String()),
        statusId: Type.Optional(Type.String({ format: 'uuid' })),
        stageId: Type.Optional(Type.String({ format: 'uuid' })),
        dueDate: Type.Optional(Type.String({ format: 'date' })),
        tags: Type.Optional(Type.Array(Type.String())),
      }),
      response: {
        200: TaskRecordSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    };

    try {
      // Get task head to check permissions
      const taskHead = await db.execute(sql`
        SELECT proj_head_id FROM app.ops_task_head WHERE id = ${id}
      `);

      if (taskHead.length === 0) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      // Check if user has access to modify the project this task belongs to
      const scopeAccess = await checkScopeAccess(userId, 'project', 'modify', (taskHead[0] as any).proj_head_id);
      if (!scopeAccess.allowed) {
        return reply.status(403).send({ error: 'Insufficient permissions' });
      }

      // Deactivate current record
      await db.execute(sql`
        UPDATE app.ops_task_records 
        SET active = false, to_ts = NOW(), updated = NOW()
        WHERE head_id = ${id} AND active = true
      `);

      // Get current record for defaults
      const currentRecord = await db.execute(sql`
        SELECT * FROM app.ops_task_records 
        WHERE head_id = ${id} AND active = false
        ORDER BY created DESC LIMIT 1
      `);

      const current = currentRecord[0];
      
      // Create new record with updates
      const newRecord = await db.execute(sql`
        INSERT INTO app.ops_task_records (
          head_id, title, status_id, stage_id, due_date, from_ts, active, tags
        )
        VALUES (
          ${id}, 
          ${data.title || current?.title}, 
          ${data.statusId || current?.status_id}, 
          ${data.stageId || current?.stage_id}, 
          ${data.dueDate || current?.due_date || null}, 
          NOW(), true, 
          ${data.tags ? JSON.stringify(data.tags) : current?.tags || '[]'}::jsonb
        )
        RETURNING id, head_id as "headId", title, status_id as "statusId", 
                  stage_id as "stageId", due_date as "dueDate", active, 
                  from_ts as "fromTs", to_ts as "toTs", tags, created, updated
      `);

      if (newRecord.length === 0) {
        return reply.status(500).send({ error: 'Failed to update task record' });
      }

      return newRecord[0];
    } catch (error) {
      fastify.log.error('Error updating task:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete task (soft delete)
  fastify.delete('/api/v1/task/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        204: Type.Null(),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    };

    try {
      // Get task head to check permissions
      const taskHead = await db.execute(sql`
        SELECT proj_head_id FROM app.ops_task_head WHERE id = ${id}
      `);

      if (taskHead.length === 0) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      // Check if user has access to delete from the project this task belongs to
      const scopeAccess = await checkScopeAccess(userId, 'project', 'delete', (taskHead[0] as any).proj_head_id);
      if (!scopeAccess.allowed) {
        return reply.status(403).send({ error: 'Insufficient permissions' });
      }

      // Soft delete all task records
      await db.execute(sql`
        UPDATE app.ops_task_records 
        SET active = false, to_ts = NOW(), updated = NOW()
        WHERE head_id = ${id} AND active = true
      `);

      return reply.status(204).send();
    } catch (error) {
      fastify.log.error('Error deleting task:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}