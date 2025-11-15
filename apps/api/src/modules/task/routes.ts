import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import {
  getUniversalColumnMetadata,
  filterUniversalColumns,
  getColumnsByMetadata
} from '../../lib/universal-schema-metadata.js';
import { universalEntityDelete, createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';
// ✅ API-based RBAC service
import {
  data_gate_EntityIdsByEntityType,
  api_gate_Create,
  api_gate_Update,
  PermissionLevel
} from '../../lib/rbac.service.js';

const TaskSchema = Type.Object({
  id: Type.String(),
  code: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  internal_url: Type.Optional(Type.String()),
  shared_url: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),

  // Status and priority
  dl__task_stage: Type.Optional(Type.String()),
  dl__task_priority: Type.Optional(Type.String()),

  // Effort tracking
  estimated_hours: Type.Optional(Type.Number()),
  actual_hours: Type.Optional(Type.Number()),
  story_points: Type.Optional(Type.Number()),

  // Temporal fields
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.String()),
  active_flag: Type.Boolean(),
  created_ts: Type.String(),
  updated_ts: Type.String(),
  version: Type.Number()});

// Task Records are deprecated - using single table approach from DDL

const CreateTaskSchema = Type.Object({
  code: Type.Optional(Type.String({ minLength: 1 })),
  name: Type.Optional(Type.String({ minLength: 1 })),
  descr: Type.Optional(Type.String()),
  internal_url: Type.Optional(Type.String()),
  shared_url: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),

  // Status and priority
  dl__task_stage: Type.Optional(Type.String()),
  dl__task_priority: Type.Optional(Type.String()),

  // Effort tracking
  estimated_hours: Type.Optional(Type.Number()),
  actual_hours: Type.Optional(Type.Number()),
  story_points: Type.Optional(Type.Number())});

const UpdateTaskSchema = Type.Partial(CreateTaskSchema);

export async function taskRoutes(fastify: FastifyInstance) {
  // List tasks with filtering
  fastify.get('/api/v1/task', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        project_id: Type.Optional(Type.String()),
        assigned_to_employee_id: Type.Optional(Type.String()),
        dl__task_stage: Type.Optional(Type.String()),  // DDL column name (not task_status)
        task_type: Type.Optional(Type.String()),
        task_category: Type.Optional(Type.String()),
        worksite_id: Type.Optional(Type.String()),
        client_id: Type.Optional(Type.String()),
        active: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
        page: Type.Optional(Type.Number({ minimum: 1 }))}),
      response: {
        200: Type.Object({
          data: Type.Array(TaskSchema),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number()}),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    const {
      project_id, assigned_to_employee_id, dl__task_stage, task_type, task_category,
      worksite_id, client_id, active, search, limit = 20, offset: queryOffset, page
    } = request.query as any;

    // Support both page (new standard) and offset (legacy) - NO fallback to unlimited
    const offset = page ? (page - 1) * limit : (queryOffset !== undefined ? queryOffset : 0);

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // DATA GATE: Get accessible entity IDs for SELECT
      const accessibleEntityIds = await data_gate_EntityIdsByEntityType(userId, 'task', PermissionLevel.VIEW);

      if (accessibleEntityIds.length === 0) {
        return reply.send({
          data: [],
          total: 0,
          limit,
          offset
        });
      }

      // Build ID filter - gate at SQL level
      const hasTypeAccess = accessibleEntityIds.includes('11111111-1111-1111-1111-111111111111');
      const idFilter = hasTypeAccess
        ? sql`TRUE`  // Type-level access - no filtering
        : sql`t.id::text = ANY(${accessibleEntityIds})`;  // Filter by accessible IDs

      // Build query conditions
      const conditions = [idFilter];

      if (active !== undefined) {
        conditions.push(sql`t.active_flag = ${active}`);
      }

      // Project relationship stored in metadata JSONB
      if (project_id !== undefined) {
        conditions.push(sql`(t.metadata->>'project_id')::uuid = ${project_id}::uuid`);
      }

      // Assignee relationship managed via entity_id_map
      if (assigned_to_employee_id !== undefined) {
        conditions.push(sql`EXISTS (
          SELECT 1 FROM app.entity_id_map map
          WHERE map.parent_entity_type = 'task'
            AND map.parent_entity_id = t.id::text
            AND map.child_entity_type = 'employee'
            AND map.child_entity_id = ${assigned_to_employee_id}
            AND map.relationship_type = 'assigned_to'
            AND map.active_flag = true
        )`);
      }

      // Task status is stored as 'dl__task_stage' column (DDL name)
      if (dl__task_stage !== undefined) {
        conditions.push(sql`t.dl__task_stage = ${dl__task_stage}`);
      }

      // Task type stored in metadata JSONB
      if (task_type !== undefined) {
        conditions.push(sql`t.metadata->>'task_type' = ${task_type}`);
      }

      // Task category stored in metadata JSONB
      if (task_category !== undefined) {
        conditions.push(sql`t.metadata->>'task_category' = ${task_category}`);
      }

      // Worksite relationship stored in metadata JSONB
      if (worksite_id !== undefined) {
        conditions.push(sql`(t.metadata->>'worksite_id')::uuid = ${worksite_id}::uuid`);
      }

      // Client relationship stored in metadata JSONB
      if (client_id !== undefined) {
        conditions.push(sql`(t.metadata->>'client_id')::uuid = ${client_id}::uuid`);
      }
      
      if (search) {
        const searchableColumns = getColumnsByMetadata([
          'name', 'descr', 'task_number', 'work_scope', 'service_address'
        ], 'ui:search');
        
        const searchConditions = searchableColumns.map(col => 
          sql`COALESCE(${sql.identifier(col)}, '') ILIKE ${`%${search}%`}`
        );
        
        if (searchConditions.length > 0) {
          conditions.push(sql`(${sql.join(searchConditions, sql` OR `)})`);
        }
      }

      // Get total count
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.d_task t
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      // Get paginated tasks with assignee names from entity_id_map
      const tasks = await db.execute(sql`
        SELECT
          t.id, t.code, t.name, t.descr,
          t.internal_url, t.shared_url,
          COALESCE(t.metadata, '{}'::jsonb) as metadata,
          -- Get assignee IDs from entity_id_map
          COALESCE(
            (
              SELECT json_agg(map.child_entity_id::uuid ORDER BY e.name)
              FROM app.d_entity_id_map map
              JOIN app.d_employee e ON e.id::text = map.child_entity_id
              WHERE map.parent_entity_type = 'task'
                AND map.parent_entity_id = t.id::text
                AND map.child_entity_type = 'employee'
                AND map.relationship_type = 'assigned_to'
                AND map.active_flag = true
            ),
            '[]'::json
          ) as assignee_employee_ids,
          -- Get assignee names from entity_id_map
          COALESCE(
            (
              SELECT json_agg(e.name ORDER BY e.name)
              FROM app.d_entity_id_map map
              JOIN app.d_employee e ON e.id::text = map.child_entity_id
              WHERE map.parent_entity_type = 'task'
                AND map.parent_entity_id = t.id::text
                AND map.child_entity_type = 'employee'
                AND map.relationship_type = 'assigned_to'
                AND map.active_flag = true
            ),
            '[]'::json
          ) as assignee_employee_names,
          t.dl__task_stage,
          t.dl__task_priority,
          t.estimated_hours, t.actual_hours,
          t.story_points,
          -- Extract IDs from metadata JSONB
          (t.metadata->>'project_id')::text as project_id,
          (t.metadata->>'business_id')::text as business_id,
          (t.metadata->>'office_id')::text as office_id,
          t.from_ts, t.to_ts,
          t.active_flag,
          t.created_ts, t.updated_ts,
          t.version
        FROM app.d_task t
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY t.created_ts DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      // Return all columns without filtering
      return {
        data: tasks,
        total,
        limit,
        offset};
    } catch (error) {
      fastify.log.error('Error fetching tasks:', error);
      console.error('Detailed task error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single task
  fastify.get('/api/v1/task/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })}),
      response: {
        // Schema removed to allow flexible response based on actual database columns
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    const { id } = request.params as { id: string };

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // DATA GATE: Get accessible entity IDs for SELECT
      const accessibleEntityIds = await data_gate_EntityIdsByEntityType(userId, 'task', PermissionLevel.VIEW);

      if (accessibleEntityIds.length === 0) {
        return reply.status(403).send({ error: 'No access to task' });
      }

      // Build ID filter - gate at SQL level
      const hasTypeAccess = accessibleEntityIds.includes('11111111-1111-1111-1111-111111111111');
      const idFilter = hasTypeAccess
        ? sql`TRUE`
        : sql`t.id::text = ANY(${accessibleEntityIds})`;

      // Get single task with assignee names from entity_id_map
      const task = await db.execute(sql`
        SELECT
          t.id, t.code, t.name, t.descr,
          t.internal_url, t.shared_url,
          COALESCE(t.metadata, '{}'::jsonb) as metadata,
          -- Get assignee IDs from entity_id_map
          COALESCE(
            (
              SELECT json_agg(map.child_entity_id::uuid ORDER BY e.name)
              FROM app.d_entity_id_map map
              JOIN app.d_employee e ON e.id::text = map.child_entity_id
              WHERE map.parent_entity_type = 'task'
                AND map.parent_entity_id = t.id::text
                AND map.child_entity_type = 'employee'
                AND map.relationship_type = 'assigned_to'
                AND map.active_flag = true
            ),
            '[]'::json
          ) as assignee_employee_ids,
          -- Get assignee names from entity_id_map
          COALESCE(
            (
              SELECT json_agg(e.name ORDER BY e.name)
              FROM app.d_entity_id_map map
              JOIN app.d_employee e ON e.id::text = map.child_entity_id
              WHERE map.parent_entity_type = 'task'
                AND map.parent_entity_id = t.id::text
                AND map.child_entity_type = 'employee'
                AND map.relationship_type = 'assigned_to'
                AND map.active_flag = true
            ),
            '[]'::json
          ) as assignee_employee_names,
          t.dl__task_stage, t.dl__task_priority,
          t.estimated_hours, t.actual_hours, t.story_points,
          -- Extract IDs from metadata JSONB
          (t.metadata->>'project_id')::text as project_id,
          (t.metadata->>'business_id')::text as business_id,
          (t.metadata->>'office_id')::text as office_id,
          t.from_ts, t.to_ts, t.active_flag,
          t.created_ts, t.updated_ts, t.version
        FROM app.d_task t
        WHERE t.id = ${id}
          AND ${idFilter}
      `);

      if (task.length === 0) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
        canSeeSafetyInfo: true};

      return filterUniversalColumns(task[0], userPermissions);
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
        // Removed schema validation - let Fastify serialize naturally
        403: Type.Object({ error: Type.String() }),
        400: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    const data = request.body as any;

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    // API GATE: Check CREATE permission
    try {
      await api_gate_Create(userId, 'task');
    } catch (err: any) {
      return reply.status(err.statusCode || 403).send({
        error: err.error || 'Forbidden',
        message: err.message
      });
    }

    // Auto-generate required fields if missing
    if (!data.name) data.name = 'Untitled';
    if (!data.code) data.code = `TASK-${Date.now()}`;

    try {
      // Create task using actual DDL structure (matches 19_d_task.ddl)
      const result = await db.execute(sql`
        INSERT INTO app.d_task (
          code, name, descr, metadata,
          dl__task_stage, dl__task_priority,
          estimated_hours, actual_hours, story_points,
          active_flag
        )
        VALUES (
          ${data.code || `TASK-${Date.now()}`},
          ${data.name || 'Untitled Task'},
          ${data.descr || null},
          ${data.metadata ? JSON.stringify(data.metadata) : '{}'}::jsonb,
          ${data.dl__task_stage || null},
          ${data.dl__task_priority || 'medium'},
          ${data.estimated_hours || null},
          ${data.actual_hours || 0},
          ${data.story_points || null},
          true
        )
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to create task' });
      }

      const newTask = result[0] as any;

      // Register the task in d_entity_instance_id for global entity operations
      await db.execute(sql`
        INSERT INTO app.d_entity_instance_id (entity_type, entity_id, entity_name, entity_code)
        VALUES ('task', ${newTask.id}::uuid, ${newTask.name}, ${newTask.code})
        ON CONFLICT (entity_type, entity_id) DO UPDATE
        SET entity_name = EXCLUDED.entity_name,
            entity_code = EXCLUDED.entity_code,
            updated_ts = NOW()
      `);

      // NOTE: Assignees should be managed separately via the Linkage API
      // POST /api/v1/linkage with parent_entity_type='task', child_entity_type='employee'

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
        canSeeSafetyInfo: true};

      return reply.status(201).send(filterUniversalColumns(newTask, userPermissions));
    } catch (error) {
      fastify.log.error('Error creating task:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update task (direct update to task table)
  fastify.put('/api/v1/task/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })}),
      body: UpdateTaskSchema,
      response: {
        200: TaskSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    // API GATE: Check UPDATE permission
    try {
      await api_gate_Update(userId, 'task', id);
    } catch (err: any) {
      return reply.status(err.statusCode || 403).send({
        error: err.error || 'Forbidden',
        message: err.message
      });
    }

    try {
      // Check if task exists
      const existing = await db.execute(sql`
        SELECT id FROM app.d_task WHERE id = ${id}
      `);

      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      const updateFields = [];

      // Update only fields that exist in d_task DDL (19_d_task.ddl)
      if (data.name !== undefined) updateFields.push(sql`name = ${data.name}`);
      if (data.descr !== undefined) updateFields.push(sql`descr = ${data.descr}`);
      if (data.code !== undefined) updateFields.push(sql`code = ${data.code}`);
      if (data.internal_url !== undefined) updateFields.push(sql`internal_url = ${data.internal_url}`);
      if (data.shared_url !== undefined) updateFields.push(sql`shared_url = ${data.shared_url}`);
      if (data.metadata !== undefined) updateFields.push(sql`metadata = ${JSON.stringify(data.metadata)}::jsonb`);
      if (data.dl__task_stage !== undefined) updateFields.push(sql`dl__task_stage = ${data.dl__task_stage}`);
      if (data.dl__task_priority !== undefined) updateFields.push(sql`dl__task_priority = ${data.dl__task_priority}`);
      if (data.estimated_hours !== undefined) updateFields.push(sql`estimated_hours = ${data.estimated_hours}`);
      if (data.actual_hours !== undefined) updateFields.push(sql`actual_hours = ${data.actual_hours}`);
      if (data.story_points !== undefined) updateFields.push(sql`story_points = ${data.story_points}`);
      if (data.active_flag !== undefined) updateFields.push(sql`active_flag = ${data.active_flag}`);

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated_ts = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.d_task
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to update task' });
      }

      const updatedTask = result[0] as any;

      // Sync with d_entity_instance_id registry when name/code changes
      if (data.name !== undefined || data.code !== undefined) {
        await db.execute(sql`
          UPDATE app.d_entity_instance_id
          SET entity_name = ${updatedTask.name},
              entity_code = ${updatedTask.code},
              updated_ts = NOW()
          WHERE entity_type = 'task' AND entity_id = ${id}::uuid
        `);
      }

      // NOTE: Assignees should be managed separately via the Linkage API
      // POST /api/v1/linkage to add assignees
      // DELETE /api/v1/linkage/:id to remove assignees

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
        canSeeSafetyInfo: true};

      return filterUniversalColumns(updatedTask, userPermissions);
    } catch (error) {
      fastify.log.error('Error updating task:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete task with cascading cleanup (soft delete)
  // Uses universal delete factory pattern - deletes from:
  // 1. app.d_task (base entity table)
  // 2. app.d_entity_instance_id (entity registry)
  // 3. app.d_entity_id_map (linkages in both directions)
  createEntityDeleteEndpoint(fastify, 'task');

  // Kanban status update endpoint (for drag-drop operations)
  fastify.patch('/api/v1/task/:id/status', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['task', 'kanban'],
      summary: 'Update task status (Kanban)',
      description: 'Updates task status for Kanban drag-drop operations with optimistic UI support',
      params: Type.Object({
        id: Type.String({ format: 'uuid' })}),
      body: Type.Object({
        task_status: Type.String({ enum: ['backlog', 'in_progress', 'blocked', 'done', 'completed'] }),
        position: Type.Optional(Type.Number()),
        moved_by: Type.Optional(Type.String())}),
      response: {
        200: Type.Object({
          id: Type.String(),
          task_status: Type.String(),
          updated: Type.String()}),
        400: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { task_status, position, moved_by } = request.body as any;
      const userId = (request as any).user?.sub;

      if (!userId) {
        return reply.status(401).send({ error: 'User not authenticated' });
      }

      // API GATE: Check UPDATE permission
      try {
        await api_gate_Update(userId, 'task', id);
      } catch (err: any) {
        return reply.status(err.statusCode || 403).send({
          error: err.error || 'Forbidden',
          message: err.message
        });
      }

      // Validate task exists
      const existingTask = await db.execute(sql`
        SELECT id, name, dl__task_stage FROM app.d_task
        WHERE id = ${id} AND active_flag = true
      `);

      if (existingTask.length === 0) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      // Update task status with audit info
      const updateResult = await db.execute(sql`
        UPDATE app.d_task
        SET
          dl__task_stage = ${task_status},
          updated_ts = NOW(),
          metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
            'kanban_moved_at', NOW()::text,
            'kanban_moved_by', ${moved_by || userId},
            'kanban_position', ${position || 0}
          )
        WHERE id = ${id}
        RETURNING id, dl__task_stage as task_status, updated_ts as updated
      `);

      if (updateResult.length === 0) {
        return reply.status(404).send({ error: 'Failed to update task' });
      }

      return {
        id: String(updateResult[0].id),
        task_status: String(updateResult[0].task_status),
        updated: String(updateResult[0].updated)};
    } catch (error) {
      fastify.log.error('Error updating task status:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get Kanban view data for project
  fastify.get('/api/v1/project/:projectId/tasks/kanban', {
    
    schema: {
      tags: ['task', 'kanban', 'project'],
      summary: 'Get tasks for Kanban view',
      description: 'Returns tasks grouped by status for Kanban board display',
      params: Type.Object({
        projectId: Type.String({ format: 'uuid' })}),
      querystring: Type.Object({
        assignee: Type.Optional(Type.String()),
        priority: Type.Optional(Type.String())}),
      response: {
        200: Type.Object({
          project: Type.Object({
            id: Type.String(),
            name: Type.String()}),
          columns: Type.Object({
            backlog: Type.Array(TaskSchema),
            in_progress: Type.Array(TaskSchema),
            blocked: Type.Array(TaskSchema),
            done: Type.Array(TaskSchema)}),
          stats: Type.Object({
            total: Type.Number(),
            by_status: Type.Record(Type.String(), Type.Number())})}),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const { assignee, priority } = request.query as any;
      const employeeId = (request as any).user?.sub;

      // Get project info
      const project = await db.execute(sql`
        SELECT id, name FROM app.d_project 
        WHERE id = ${projectId} AND active_flag = true
      `);

      if (project.length === 0) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      // Build filter conditions
      // Project relationship stored in metadata JSONB
      const filters = [
        sql`(t.metadata->>'project_id')::uuid = ${projectId}::uuid`,
        sql`t.active_flag = true`
      ];

      // Assignee relationship managed via entity_id_map
      if (assignee) {
        filters.push(sql`EXISTS (
          SELECT 1 FROM app.entity_id_map map
          WHERE map.parent_entity_type = 'task'
            AND map.parent_entity_id = t.id::text
            AND map.child_entity_type = 'employee'
            AND map.child_entity_id = ${assignee}
            AND map.relationship_type = 'assigned_to'
            AND map.active_flag = true
        )`);
      }

      if (priority) filters.push(sql`t.dl__task_priority = ${priority}`);

      // Get all tasks for the project
      const tasks = await db.execute(sql`
        SELECT t.* FROM app.d_task t
        WHERE ${sql.join(filters, sql` AND `)}
        ORDER BY
          CASE t.dl__task_stage
            WHEN 'backlog' THEN 1
            WHEN 'in_progress' THEN 2
            WHEN 'blocked' THEN 3
            WHEN 'done' THEN 4
            ELSE 5
          END,
          (t.metadata->>'kanban_position')::int NULLS LAST,
          t.created_ts
      `);

      // Group tasks by status
      const columns = {
        backlog: tasks.filter(t => t.dl__task_stage === 'backlog'),
        in_progress: tasks.filter(t => t.dl__task_stage === 'in_progress'),
        blocked: tasks.filter(t => t.dl__task_stage === 'blocked'),
        done: tasks.filter(t => ['done', 'completed'].includes(String(t.dl__task_stage)))};

      // Calculate stats
      const stats = {
        total: tasks.length,
        by_status: {
          backlog: columns.backlog.length,
          in_progress: columns.in_progress.length,
          blocked: columns.blocked.length,
          done: columns.done.length}};

      return {
        project: {
          id: String(project[0].id),
          name: String(project[0].name)},
        columns,
        stats};
    } catch (error) {
      fastify.log.error('Error fetching Kanban data:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Case notes for tasks (rich editor support)
  fastify.get('/api/v1/task/:taskId/case-notes', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['task', 'case-notes'],
      summary: 'Get task case notes',
      description: 'Returns case notes timeline with rich content for task detail view',
      params: Type.Object({
        taskId: Type.String({ format: 'uuid' })}),
      response: {
        200: Type.Object({
          task_id: Type.String(),
          notes: Type.Array(Type.Object({
            id: Type.String(),
            content: Type.String(),
            content_type: Type.String(),
            author_id: Type.String(),
            author_name: Type.String(),
            created_at: Type.String(),
            updated_at: Type.String(),
            mentions: Type.Array(Type.String()),
            attachments: Type.Array(Type.Object({
              id: Type.String(),
              filename: Type.String(),
              size: Type.Number(),
              mime_type: Type.String()}))}))}),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    try {
      const { taskId } = request.params as { taskId: string };
      const employeeId = (request as any).user?.sub;

      // Direct RBAC check for task access
      const taskAccess = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map rbac
        WHERE rbac.person_entity_name = 'employee' AND rbac.person_entity_id = ${employeeId}
          AND rbac.entity_name = 'task'
          AND (rbac.entity_id = ${taskId} OR rbac.entity_id = '11111111-1111-1111-1111-111111111111'::uuid)
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND rbac.permission >= 0
      `);

      if (taskAccess.length === 0) {
        return reply.status(404).send({ error: 'Task not found or access denied' });
      }

      // Get case notes from task records table
      const notes = await db.execute(sql`
        SELECT
          tr.id,
          tr.record_content as content,
          tr.record_type as content_type,
          tr.created_by_employee_id as author_id,
          e.name as author_name,
          tr.created as created_at,
          tr.updated as updated_at,
          COALESCE(tr.metadata->>'mentions', '[]')::jsonb as mentions,
          COALESCE(tr.metadata->>'attachments', '[]')::jsonb as attachments
        FROM app.d_task_data tr
        LEFT JOIN app.d_employee e ON e.id = tr.created_by_employee_id
        WHERE tr.task_id = ${taskId}
          AND tr.record_type IN ('case_note', 'rich_note')
          AND tr.active_flag = true
        ORDER BY tr.created DESC
      `);

      const formattedNotes = notes.map(note => ({
        id: String(note.id),
        content: String(note.content),
        content_type: String(note.content_type),
        author_id: String(note.author_id),
        author_name: String(note.author_name || 'Unknown'),
        created_at: String(note.created_at),
        updated_at: String(note.updated_at),
        mentions: Array.isArray(note.mentions) ? note.mentions.map(String) : [],
        attachments: Array.isArray(note.attachments) ? note.attachments : []}));

      return {
        task_id: taskId,
        notes: formattedNotes};
    } catch (error) {
      fastify.log.error('Error fetching case notes:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Add case note to task
  fastify.post('/api/v1/task/:taskId/case-notes', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['task', 'case-notes'],
      summary: 'Add case note to task',
      description: 'Adds a new case note with rich content and mentions to task',
      params: Type.Object({
        taskId: Type.String({ format: 'uuid' })}),
      body: Type.Object({
        content: Type.String({ minLength: 1 }),
        content_type: Type.Optional(Type.String({ enum: ['case_note', 'rich_note', 'log_entry'] })),
        mentions: Type.Optional(Type.Array(Type.String())),
        attachments: Type.Optional(Type.Array(Type.Object({
          filename: Type.String(),
          size: Type.Number(),
          mime_type: Type.String(),
          data: Type.Optional(Type.String())})))}),
      response: {
        201: Type.Object({
          id: Type.String(),
          content: Type.String(),
          author_name: Type.String(),
          created_at: Type.String()}),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    try {
      const { taskId } = request.params as { taskId: string };
      const { content, content_type = 'case_note', mentions = [], attachments = [] } = request.body as any;
      const employeeId = (request as any).user?.sub;

      // Direct RBAC check for task edit access
      const taskEditAccess = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map rbac
        WHERE rbac.person_entity_name = 'employee' AND rbac.person_entity_id = ${employeeId}
          AND rbac.entity_name = 'task'
          AND (rbac.entity_id = ${taskId} OR rbac.entity_id = '11111111-1111-1111-1111-111111111111'::uuid)
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND rbac.permission >= 1
      `);

      if (taskEditAccess.length === 0) {
        return reply.status(404).send({ error: 'Task not found or access denied' });
      }

      // Get author name
      const authorResult = await db.execute(sql`
        SELECT name FROM app.d_employee WHERE id = ${employeeId}
      `);
      const authorName = authorResult[0]?.name || 'Unknown';

      // Insert case note
      const noteResult = await db.execute(sql`
        INSERT INTO app.d_task_data (
          task_id,
          project_id,
          record_type,
          record_content,
          updated_by_employee_id,
          metadata,
          active_flag
        ) VALUES (
          ${taskId}::uuid,
          (SELECT (metadata->>'project_id')::uuid FROM app.d_task WHERE id = ${taskId}::uuid),
          ${content_type},
          ${content},
          ${employeeId}::uuid,
          ${JSON.stringify({ mentions, attachments })}::jsonb,
          true
        )
        RETURNING id, created_ts as created
      `);

      return reply.status(201).send({
        id: String(noteResult[0].id),
        content,
        author_name: String(authorName),
        created_at: String(noteResult[0].created)});
    } catch (error) {
      fastify.log.error('Error adding case note:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Activity timeline for task
  fastify.get('/api/v1/task/:taskId/activity', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['task', 'activity'],
      summary: 'Get task activity timeline',
      description: 'Returns chronological activity feed for task with system and user events',
      params: Type.Object({
        taskId: Type.String({ format: 'uuid' })}),
      response: {
        200: Type.Object({
          task_id: Type.String(),
          activities: Type.Array(Type.Object({
            id: Type.String(),
            activity_type: Type.String(),
            description: Type.String(),
            actor_id: Type.Optional(Type.String()),
            actor_name: Type.Optional(Type.String()),
            timestamp: Type.String(),
            changes: Type.Optional(Type.Object({})),
            metadata: Type.Optional(Type.Object({}))}))}),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    try {
      const { taskId } = request.params as { taskId: string };
      const employeeId = (request as any).user?.sub;

      // Direct RBAC check for task access
      const taskAccess = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map rbac
        WHERE rbac.person_entity_name = 'employee' AND rbac.person_entity_id = ${employeeId}
          AND rbac.entity_name = 'task'
          AND (rbac.entity_id = ${taskId} OR rbac.entity_id = '11111111-1111-1111-1111-111111111111'::uuid)
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND rbac.permission >= 0
      `);

      if (taskAccess.length === 0) {
        return reply.status(404).send({ error: 'Task not found or access denied' });
      }

      // Get all task records for activity feed
      const activities = await db.execute(sql`
        SELECT
          tr.id,
          tr.record_type as activity_type,
          tr.record_content as description,
          tr.updated_by_employee_id as actor_id,
          e.name as actor_name,
          tr.created_ts as timestamp,
          tr.metadata
        FROM app.d_task_data tr
        LEFT JOIN app.d_employee e ON e.id = tr.updated_by_employee_id
        WHERE tr.task_id = ${taskId}
          AND tr.active_flag = true

        UNION ALL

        -- Add system events from task updates
        SELECT
          gen_random_uuid() as id,
          'system_update' as activity_type,
          CASE
            WHEN t.created_ts = t.updated_ts THEN 'Task created'
            ELSE 'Task updated'
          END as description,
          NULL as actor_id,
          'System' as actor_name,
          t.updated_ts as timestamp,
          t.metadata
        FROM app.d_task t
        WHERE t.id = ${taskId}
          AND t.active_flag = true

        ORDER BY timestamp DESC
        LIMIT 50
      `);

      const formattedActivities = activities.map(activity => ({
        id: String(activity.id),
        activity_type: String(activity.activity_type),
        description: String(activity.description),
        actor_id: activity.actor_id ? String(activity.actor_id) : undefined,
        actor_name: String(activity.actor_name || 'Unknown'),
        timestamp: String(activity.timestamp),
        changes: undefined, // TODO: Implement change tracking
        metadata: activity.metadata ? JSON.parse(String(activity.metadata)) : undefined}));

      return {
        task_id: taskId,
        activities: formattedActivities};
    } catch (error) {
      fastify.log.error('Error fetching task activity:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ========================================
  // TASK ASSIGNEES (via entity_id_map)
  // ========================================

  // Get task assignees
  fastify.get('/api/v1/task/:id/assignees', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })}),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Object({
            id: Type.String(),
            name: Type.String(),
            email: Type.Optional(Type.String()),
            linkage_id: Type.String()}))}),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    // Check RBAC permission to view task
    const taskAccess = await db.execute(sql`
      SELECT 1 FROM app.entity_id_rbac_map rbac
      WHERE rbac.person_entity_name = 'employee' AND rbac.person_entity_id = ${userId}
        AND rbac.entity_name = 'task'
        AND (rbac.entity_id = ${id} OR rbac.entity_id = '11111111-1111-1111-1111-111111111111'::uuid)
        AND rbac.active_flag = true
        AND rbac.permission >= 0
    `);

    if (taskAccess.length === 0) {
      return reply.status(403).send({ error: 'Insufficient permissions to view this task' });
    }

    try {
      // Get assignees from entity_id_map
      const assignees = await db.execute(sql`
        SELECT
          e.id,
          e.name,
          e.email,
          map.id as linkage_id
        FROM app.d_entity_id_map map
        INNER JOIN app.d_employee e ON e.id::text = map.child_entity_id
        WHERE map.parent_entity_type = 'task'
          AND map.parent_entity_id = ${id}
          AND map.child_entity_type = 'employee'
          AND map.relationship_type = 'assigned_to'
          AND map.active_flag = true
        ORDER BY e.name
      `);

      return reply.send({
        success: true,
        data: assignees.map(a => ({
          id: String(a.id),
          name: String(a.name),
          email: a.email ? String(a.email) : undefined,
          linkage_id: String(a.linkage_id)}))});
    } catch (error) {
      fastify.log.error('Error fetching task assignees:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ========================================
  // CHILD ENTITY CREATION
  // ========================================
  // Child entities (form, artifact) are created using:
  // 1. Universal entity create endpoint: POST /api/v1/:childType
  // 2. Linkage API: POST /api/v1/linkage to link child to parent
  // 3. Navigate to child detail page for editing
  // No special endpoints needed - reuses existing universal APIs
}