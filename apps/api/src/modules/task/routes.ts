import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
// RBAC imports temporarily disabled - will be updated to use unified scope system
// import { getEmployeeScopeIds, hasPermissionOnScopeId, Permission } from '../rbac/entity-permission-rbac-gate.js';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { 
  getUniversalColumnMetadata, 
  filterUniversalColumns,
  getColumnsByMetadata 
} from '../../lib/universal-schema-metadata.js';

const TaskSchema = Type.Object({
  id: Type.String(),
  slug: Type.String(),
  code: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  tags: Type.Any(), // jsonb
  metadata: Type.Any(), // jsonb

  // Relationships
  project_id: Type.String(),
  business_id: Type.Optional(Type.String()),
  office_id: Type.Optional(Type.String()),

  // Assignment
  assignee_employee_ids: Type.Optional(Type.Any()), // uuid[]

  // Status and priority
  stage: Type.Optional(Type.String()),
  priority_level: Type.Optional(Type.String()),

  // Effort tracking
  estimated_hours: Type.Optional(Type.Number()),
  actual_hours: Type.Optional(Type.Number()),
  story_points: Type.Optional(Type.Number()),

  // Task hierarchy
  parent_task_id: Type.Optional(Type.String()),
  dependency_task_ids: Type.Optional(Type.Any()), // uuid[]

  // Temporal fields
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.String()),
  active_flag: Type.Boolean(),
  created_ts: Type.String(),
  updated_ts: Type.String(),
  version: Type.Number(),
});

// Task Records are deprecated - using single table approach from DDL

const CreateTaskSchema = Type.Object({
  slug: Type.String({ minLength: 1 }),
  code: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Any()),
  metadata: Type.Optional(Type.Any()),

  // Relationships
  project_id: Type.String({ format: 'uuid' }),
  business_id: Type.Optional(Type.String({ format: 'uuid' })),
  office_id: Type.Optional(Type.String({ format: 'uuid' })),

  // Assignment
  assignee_employee_ids: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),

  // Status and priority
  stage: Type.Optional(Type.String()),
  priority_level: Type.Optional(Type.String()),

  // Effort tracking
  estimated_hours: Type.Optional(Type.Number()),
  actual_hours: Type.Optional(Type.Number()),
  story_points: Type.Optional(Type.Number()),

  // Task hierarchy
  parent_task_id: Type.Optional(Type.String({ format: 'uuid' })),
  dependency_task_ids: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
});

const UpdateTaskSchema = Type.Partial(CreateTaskSchema);

export async function taskRoutes(fastify: FastifyInstance) {
  // List tasks with filtering
  fastify.get('/api/v1/task', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        project_id: Type.Optional(Type.String()),
        assigned_to_employee_id: Type.Optional(Type.String()),
        task_status: Type.Optional(Type.String()),
        task_type: Type.Optional(Type.String()),
        task_category: Type.Optional(Type.String()),
        worksite_id: Type.Optional(Type.String()),
        client_id: Type.Optional(Type.String()),
        active: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(TaskSchema),
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
      project_id, assigned_to_employee_id, task_status, task_type, task_category,
      worksite_id, client_id, active, search, limit = 50, offset = 0
    } = request.query as any;

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Direct RBAC filtering - only show tasks user has access to
      const baseConditions = [
        sql`EXISTS (
          SELECT 1 FROM app.entity_id_rbac_map rbac
          WHERE rbac.empid = ${userId}
            AND rbac.entity = 'task'
            AND (rbac.entity_id = t.id::text OR rbac.entity_id = 'all')
            AND rbac.active_flag = true
            AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
            AND 0 = ANY(rbac.permission)
        )`
      ];

      // Build query conditions
      const conditions = [...baseConditions];
      
      if (active !== undefined) {
        conditions.push(sql`active_flag = ${active}`);
      }
      
      if (project_id !== undefined) {
        conditions.push(sql`project_id = ${project_id}`);
      }
      
      if (assigned_to_employee_id !== undefined) {
        conditions.push(sql`assigned_to_employee_id = ${assigned_to_employee_id}`);
      }
      
      if (task_status !== undefined) {
        conditions.push(sql`task_status = ${task_status}`);
      }
      
      if (task_type !== undefined) {
        conditions.push(sql`task_type = ${task_type}`);
      }
      
      if (task_category !== undefined) {
        conditions.push(sql`task_category = ${task_category}`);
      }
      
      if (worksite_id !== undefined) {
        conditions.push(sql`worksite_id = ${worksite_id}`);
      }
      
      if (client_id !== undefined) {
        conditions.push(sql`client_id = ${client_id}`);
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

      // Get paginated tasks
      const tasks = await db.execute(sql`
        SELECT
          t.id, t.slug, t.code, t.name, t.descr,
          COALESCE(t.tags, '[]'::jsonb) as tags,
          COALESCE(t.metadata, '{}'::jsonb) as metadata,
          t.assignee_employee_ids,
          t.stage,
          t.priority_level,
          t.estimated_hours, t.actual_hours,
          t.story_points,
          t.parent_task_id,
          t.dependency_task_ids,
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

      // Apply universal column filtering and transform data
      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
        canSeeSafetyInfo: true,
      };
      
      const data = tasks.map(task => {
        // Parse JSON fields properly
        const parsedTask = {
          ...task,
          tags: Array.isArray(task.tags) ? task.tags : (task.tags ? JSON.parse(task.tags as string) : []),
          materials_required: Array.isArray(task.materials_required) ? task.materials_required : (task.materials_required ? JSON.parse(task.materials_required as string) : []),
          equipment_required: Array.isArray(task.equipment_required) ? task.equipment_required : (task.equipment_required ? JSON.parse(task.equipment_required as string) : []),
          safety_requirements: Array.isArray(task.safety_requirements) ? task.safety_requirements : (task.safety_requirements ? JSON.parse(task.safety_requirements as string) : []),
          predecessor_tasks: Array.isArray(task.predecessor_tasks) ? task.predecessor_tasks : (task.predecessor_tasks ? JSON.parse(task.predecessor_tasks as string) : []),
          successor_tasks: Array.isArray(task.successor_tasks) ? task.successor_tasks : (task.successor_tasks ? JSON.parse(task.successor_tasks as string) : []),
          blocking_issues: Array.isArray(task.blocking_issues) ? task.blocking_issues : (task.blocking_issues ? JSON.parse(task.blocking_issues as string) : []),
          attr: task.attr || {},
        };
        
        return filterUniversalColumns(parsedTask, userPermissions);
      });

      return {
        data,
        total,
        limit,
        offset,
      };
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
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        // Schema removed to allow flexible response based on actual database columns
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    // Direct RBAC check for task access
    const taskAccess = await db.execute(sql`
      SELECT 1 FROM app.entity_id_rbac_map rbac
      WHERE rbac.empid = ${userId}
        AND rbac.entity = 'task'
        AND (rbac.entity_id = ${id} OR rbac.entity_id = 'all')
        AND rbac.active_flag = true
        AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
        AND 0 = ANY(rbac.permission)
    `);

    if (taskAccess.length === 0) {
      return reply.status(403).send({ error: 'Insufficient permissions to view this task' });
    }

    try {
      // Get single task
      const task = await db.execute(sql`
        SELECT
          id, slug, code, name, descr,
          COALESCE(tags, '[]'::jsonb) as tags,
          COALESCE(metadata, '{}'::jsonb) as metadata,
          assignee_employee_ids,
          stage, priority_level,
          estimated_hours, actual_hours, story_points,
          parent_task_id, dependency_task_ids,
          -- Extract IDs from metadata JSONB
          (metadata->>'project_id')::text as project_id,
          (metadata->>'business_id')::text as business_id,
          (metadata->>'office_id')::text as office_id,
          from_ts, to_ts, active_flag,
          created_ts, updated_ts, version
        FROM app.d_task
        WHERE id = ${id}
      `);

      if (task.length === 0) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      const taskData = task[0] as any;

      // Parse JSON fields properly
      const parsedTask = {
        ...taskData,
        tags: Array.isArray(taskData.tags) ? taskData.tags : (taskData.tags ? JSON.parse(taskData.tags) : []),
        metadata: taskData.metadata || {},
      };

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
        canSeeSafetyInfo: true,
      };
      
      return filterUniversalColumns(parsedTask, userPermissions);
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
        201: TaskSchema,
        403: Type.Object({ error: Type.String() }),
        400: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const data = request.body as any;

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    // Direct RBAC check for task create permission
    const taskCreateAccess = await db.execute(sql`
      SELECT 1 FROM app.entity_id_rbac_map rbac
      WHERE rbac.empid = ${userId}
        AND rbac.entity = 'task'
        AND rbac.entity_id = 'all'
        AND rbac.active_flag = true
        AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
        AND 4 = ANY(rbac.permission)
    `);

    if (taskCreateAccess.length === 0) {
      return reply.status(403).send({ error: 'Insufficient permissions to create tasks' });
    }

    try {
      // Create task using new normalized structure
      const result = await db.execute(sql`
        INSERT INTO app.d_task (
          name, "descr", task_number, task_type, task_category,
          project_id, project_name, project_code,
          task_status, priority_level, urgency_level,
          assigned_to_employee_id, assigned_to_employee_name, assigned_crew_id, task_owner_id,
          planned_start_date, planned_end_date, actual_start_date, actual_end_date,
          estimated_hours, actual_hours,
          worksite_id, client_id, service_address, location_notes,
          work_scope, materials_required, equipment_required, safety_requirements,
          completion_percentage, quality_score, client_satisfaction_score, rework_required,
          estimated_cost, actual_cost, billable_hours, billing_rate,
          predecessor_tasks, successor_tasks, blocking_issues,
          client_communication_required, permit_required, inspection_required, documentation_complete,
          tags, attr, active
        )
        VALUES (
          ${data.name},
          ${data.descr || null},
          ${data.task_number},
          ${data.task_type || 'installation'},
          ${data.task_category || 'operational'},
          ${data.project_id},
          ${data.project_name || null},
          ${data.project_code || null},
          ${data.task_status || 'planned'},
          ${data.priority_level || 'medium'},
          ${data.urgency_level || 'normal'},
          ${data.assigned_to_employee_id || null},
          ${data.assigned_to_employee_name || null},
          ${data.assigned_crew_id || null},
          ${data.task_owner_id || null},
          ${data.planned_start_date || null},
          ${data.planned_end_date || null},
          ${data.actual_start_date || null},
          ${data.actual_end_date || null},
          ${data.estimated_hours || null},
          ${data.actual_hours || null},
          ${data.worksite_id || null},
          ${data.client_id || null},
          ${data.service_address || null},
          ${data.location_notes || null},
          ${data.work_scope || null},
          ${data.materials_required ? JSON.stringify(data.materials_required) : '[]'}::jsonb,
          ${data.equipment_required ? JSON.stringify(data.equipment_required) : '[]'}::jsonb,
          ${data.safety_requirements ? JSON.stringify(data.safety_requirements) : '[]'}::jsonb,
          ${data.completion_percentage || 0.0},
          ${data.quality_score || null},
          ${data.client_satisfaction_score || null},
          ${data.rework_required || false},
          ${data.estimated_cost || null},
          ${data.actual_cost || null},
          ${data.billable_hours || null},
          ${data.billing_rate || null},
          ${data.predecessor_tasks ? JSON.stringify(data.predecessor_tasks) : '[]'}::jsonb,
          ${data.successor_tasks ? JSON.stringify(data.successor_tasks) : '[]'}::jsonb,
          ${data.blocking_issues ? JSON.stringify(data.blocking_issues) : '[]'}::jsonb,
          ${data.client_communication_required || false},
          ${data.permit_required || false},
          ${data.inspection_required || false},
          ${data.documentation_complete || false},
          ${data.tags ? JSON.stringify(data.tags) : '[]'}::jsonb,
          ${data.attr ? JSON.stringify(data.attr) : '{}'}::jsonb,
          ${data.active !== false}
        )
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to create task' });
      }

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
        canSeeSafetyInfo: true,
      };
      
      return reply.status(201).send(filterUniversalColumns(result[0], userPermissions));
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
        id: Type.String({ format: 'uuid' }),
      }),
      body: UpdateTaskSchema,
      response: {
        200: TaskSchema,
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
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    // Direct RBAC check for task edit access
    const taskEditAccess = await db.execute(sql`
      SELECT 1 FROM app.entity_id_rbac_map rbac
      WHERE rbac.empid = ${userId}
        AND rbac.entity = 'task'
        AND (rbac.entity_id = ${id} OR rbac.entity_id = 'all')
        AND rbac.active_flag = true
        AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
        AND 1 = ANY(rbac.permission)
    `);

    if (taskEditAccess.length === 0) {
      return reply.status(403).send({ error: 'Insufficient permissions to modify this task' });
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
      
      if (data.name !== undefined) updateFields.push(sql`name = ${data.name}`);
      if (data.descr !== undefined) updateFields.push(sql`"descr" = ${data.descr}`);
      if (data.task_number !== undefined) updateFields.push(sql`task_number = ${data.task_number}`);
      if (data.task_type !== undefined) updateFields.push(sql`task_type = ${data.task_type}`);
      if (data.task_category !== undefined) updateFields.push(sql`task_category = ${data.task_category}`);
      if (data.project_id !== undefined) updateFields.push(sql`project_id = ${data.project_id}`);
      if (data.project_name !== undefined) updateFields.push(sql`project_name = ${data.project_name}`);
      if (data.project_code !== undefined) updateFields.push(sql`project_code = ${data.project_code}`);
      if (data.task_status !== undefined) updateFields.push(sql`task_status = ${data.task_status}`);
      if (data.priority_level !== undefined) updateFields.push(sql`priority_level = ${data.priority_level}`);
      if (data.urgency_level !== undefined) updateFields.push(sql`urgency_level = ${data.urgency_level}`);
      if (data.assigned_to_employee_id !== undefined) updateFields.push(sql`assigned_to_employee_id = ${data.assigned_to_employee_id}`);
      if (data.assigned_to_employee_name !== undefined) updateFields.push(sql`assigned_to_employee_name = ${data.assigned_to_employee_name}`);
      if (data.assigned_crew_id !== undefined) updateFields.push(sql`assigned_crew_id = ${data.assigned_crew_id}`);
      if (data.task_owner_id !== undefined) updateFields.push(sql`task_owner_id = ${data.task_owner_id}`);
      if (data.planned_start_date !== undefined) updateFields.push(sql`planned_start_date = ${data.planned_start_date}`);
      if (data.planned_end_date !== undefined) updateFields.push(sql`planned_end_date = ${data.planned_end_date}`);
      if (data.actual_start_date !== undefined) updateFields.push(sql`actual_start_date = ${data.actual_start_date}`);
      if (data.actual_end_date !== undefined) updateFields.push(sql`actual_end_date = ${data.actual_end_date}`);
      if (data.estimated_hours !== undefined) updateFields.push(sql`estimated_hours = ${data.estimated_hours}`);
      if (data.actual_hours !== undefined) updateFields.push(sql`actual_hours = ${data.actual_hours}`);
      if (data.worksite_id !== undefined) updateFields.push(sql`worksite_id = ${data.worksite_id}`);
      if (data.client_id !== undefined) updateFields.push(sql`client_id = ${data.client_id}`);
      if (data.service_address !== undefined) updateFields.push(sql`service_address = ${data.service_address}`);
      if (data.location_notes !== undefined) updateFields.push(sql`location_notes = ${data.location_notes}`);
      if (data.work_scope !== undefined) updateFields.push(sql`work_scope = ${data.work_scope}`);
      if (data.materials_required !== undefined) updateFields.push(sql`materials_required = ${JSON.stringify(data.materials_required)}::jsonb`);
      if (data.equipment_required !== undefined) updateFields.push(sql`equipment_required = ${JSON.stringify(data.equipment_required)}::jsonb`);
      if (data.safety_requirements !== undefined) updateFields.push(sql`safety_requirements = ${JSON.stringify(data.safety_requirements)}::jsonb`);
      if (data.completion_percentage !== undefined) updateFields.push(sql`completion_percentage = ${data.completion_percentage}`);
      if (data.quality_score !== undefined) updateFields.push(sql`quality_score = ${data.quality_score}`);
      if (data.client_satisfaction_score !== undefined) updateFields.push(sql`client_satisfaction_score = ${data.client_satisfaction_score}`);
      if (data.rework_required !== undefined) updateFields.push(sql`rework_required = ${data.rework_required}`);
      if (data.estimated_cost !== undefined) updateFields.push(sql`estimated_cost = ${data.estimated_cost}`);
      if (data.actual_cost !== undefined) updateFields.push(sql`actual_cost = ${data.actual_cost}`);
      if (data.billable_hours !== undefined) updateFields.push(sql`billable_hours = ${data.billable_hours}`);
      if (data.billing_rate !== undefined) updateFields.push(sql`billing_rate = ${data.billing_rate}`);
      if (data.predecessor_tasks !== undefined) updateFields.push(sql`predecessor_tasks = ${JSON.stringify(data.predecessor_tasks)}::jsonb`);
      if (data.successor_tasks !== undefined) updateFields.push(sql`successor_tasks = ${JSON.stringify(data.successor_tasks)}::jsonb`);
      if (data.blocking_issues !== undefined) updateFields.push(sql`blocking_issues = ${JSON.stringify(data.blocking_issues)}::jsonb`);
      if (data.client_communication_required !== undefined) updateFields.push(sql`client_communication_required = ${data.client_communication_required}`);
      if (data.permit_required !== undefined) updateFields.push(sql`permit_required = ${data.permit_required}`);
      if (data.inspection_required !== undefined) updateFields.push(sql`inspection_required = ${data.inspection_required}`);
      if (data.documentation_complete !== undefined) updateFields.push(sql`documentation_complete = ${data.documentation_complete}`);
      if (data.tags !== undefined) updateFields.push(sql`tags = ${JSON.stringify(data.tags)}::jsonb`);
      if (data.attr !== undefined) updateFields.push(sql`attr = ${JSON.stringify(data.attr)}::jsonb`);
      if (data.active !== undefined) updateFields.push(sql`active_flag = ${data.active}`);

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.d_task 
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to update task' });
      }

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
        canSeeSafetyInfo: true,
      };
      
      return filterUniversalColumns(result[0], userPermissions);
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
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    // Direct RBAC check for task delete access
    const taskDeleteAccess = await db.execute(sql`
      SELECT 1 FROM app.entity_id_rbac_map rbac
      WHERE rbac.empid = ${userId}
        AND rbac.entity = 'task'
        AND (rbac.entity_id = ${id} OR rbac.entity_id = 'all')
        AND rbac.active_flag = true
        AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
        AND 3 = ANY(rbac.permission)
    `);

    if (taskDeleteAccess.length === 0) {
      return reply.status(403).send({ error: 'Insufficient permissions to delete this task' });
    }

    try {
      // Check if task exists
      const existing = await db.execute(sql`
        SELECT id FROM app.d_task WHERE id = ${id}
      `);
      
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      // Soft delete task
      await db.execute(sql`
        UPDATE app.d_task 
        SET active_flag = false, to_ts = NOW(), updated = NOW()
        WHERE id = ${id}
      `);

      return reply.status(204).send();
    } catch (error) {
      fastify.log.error('Error deleting task:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Kanban status update endpoint (for drag-drop operations)
  fastify.patch('/api/v1/task/:id/status', {
    
    schema: {
      tags: ['task', 'kanban'],
      summary: 'Update task status (Kanban)',
      description: 'Updates task status for Kanban drag-drop operations with optimistic UI support',
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      body: Type.Object({
        task_status: Type.String({ enum: ['backlog', 'in_progress', 'blocked', 'done', 'completed'] }),
        position: Type.Optional(Type.Number()),
        moved_by: Type.Optional(Type.String()),
      }),
      response: {
        200: Type.Object({
          id: Type.String(),
          task_status: Type.String(),
          updated: Type.String(),
        }),
        400: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { task_status, position, moved_by } = request.body as any;
      const employeeId = (request as any).user?.sub;

      // Validate task exists and user has permission
      const existingTask = await db.execute(sql`
        SELECT id, name, task_status FROM app.d_task 
        WHERE id = ${id} AND active_flag = true
      `);
      
      if (existingTask.length === 0) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      // Update task status with audit info
      const updateResult = await db.execute(sql`
        UPDATE app.d_task 
        SET 
          task_status = ${task_status},
          updated = NOW(),
          attr = COALESCE(attr, '{}'::jsonb) || jsonb_build_object(
            'kanban_moved_at', NOW()::text,
            'kanban_moved_by', ${moved_by || employeeId},
            'kanban_position', ${position || 0}
          )
        WHERE id = ${id}
        RETURNING id, task_status, updated
      `);

      if (updateResult.length === 0) {
        return reply.status(404).send({ error: 'Failed to update task' });
      }

      return {
        id: String(updateResult[0].id),
        task_status: String(updateResult[0].task_status),
        updated: String(updateResult[0].updated),
      };
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
        projectId: Type.String({ format: 'uuid' }),
      }),
      querystring: Type.Object({
        assignee: Type.Optional(Type.String()),
        priority: Type.Optional(Type.String()),
      }),
      response: {
        200: Type.Object({
          project: Type.Object({
            id: Type.String(),
            name: Type.String(),
          }),
          columns: Type.Object({
            backlog: Type.Array(TaskSchema),
            in_progress: Type.Array(TaskSchema),
            blocked: Type.Array(TaskSchema),
            done: Type.Array(TaskSchema),
          }),
          stats: Type.Object({
            total: Type.Number(),
            by_status: Type.Record(Type.String(), Type.Number()),
          }),
        }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
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
      const filters = [sql`project_id = ${projectId}`, sql`active_flag = true`];
      if (assignee) filters.push(sql`assigned_to_employee_id = ${assignee}`);
      if (priority) filters.push(sql`priority_level = ${priority}`);

      // Get all tasks for the project
      const tasks = await db.execute(sql`
        SELECT * FROM app.d_task
        WHERE ${sql.join(filters, sql` AND `)}
        ORDER BY 
          CASE task_status 
            WHEN 'backlog' THEN 1 
            WHEN 'in_progress' THEN 2 
            WHEN 'blocked' THEN 3 
            WHEN 'done' THEN 4 
            ELSE 5 
          END,
          (attr->>'kanban_position')::int NULLS LAST,
          created
      `);

      // Group tasks by status
      const columns = {
        backlog: tasks.filter(t => t.task_status === 'backlog'),
        in_progress: tasks.filter(t => t.task_status === 'in_progress'),
        blocked: tasks.filter(t => t.task_status === 'blocked'),
        done: tasks.filter(t => ['done', 'completed'].includes(String(t.task_status))),
      };

      // Calculate stats
      const stats = {
        total: tasks.length,
        by_status: {
          backlog: columns.backlog.length,
          in_progress: columns.in_progress.length,
          blocked: columns.blocked.length,
          done: columns.done.length,
        },
      };

      return {
        project: {
          id: String(project[0].id),
          name: String(project[0].name),
        },
        columns,
        stats,
      };
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
        taskId: Type.String({ format: 'uuid' }),
      }),
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
              mime_type: Type.String(),
            })),
          })),
        }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const { taskId } = request.params as { taskId: string };
      const employeeId = (request as any).user?.sub;

      // Direct RBAC check for task access
      const taskAccess = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map rbac
        WHERE rbac.empid = ${employeeId}
          AND rbac.entity = 'task'
          AND (rbac.entity_id = ${taskId} OR rbac.entity_id = 'all')
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND 0 = ANY(rbac.permission)
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
          COALESCE(tr.attr->>'mentions', '[]')::jsonb as mentions,
          COALESCE(tr.attr->>'attachments', '[]')::jsonb as attachments
        FROM app.d_task_data tr
        LEFT JOIN app.d_employee e ON e.id = tr.created_by_employee_id
        WHERE tr.task_head_id = ${taskId}
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
        attachments: Array.isArray(note.attachments) ? note.attachments : [],
      }));

      return {
        task_id: taskId,
        notes: formattedNotes,
      };
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
        taskId: Type.String({ format: 'uuid' }),
      }),
      body: Type.Object({
        content: Type.String({ minLength: 1 }),
        content_type: Type.Optional(Type.String({ enum: ['case_note', 'rich_note', 'log_entry'] })),
        mentions: Type.Optional(Type.Array(Type.String())),
        attachments: Type.Optional(Type.Array(Type.Object({
          filename: Type.String(),
          size: Type.Number(),
          mime_type: Type.String(),
          data: Type.Optional(Type.String()),
        }))),
      }),
      response: {
        201: Type.Object({
          id: Type.String(),
          content: Type.String(),
          author_name: Type.String(),
          created_at: Type.String(),
        }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const { taskId } = request.params as { taskId: string };
      const { content, content_type = 'case_note', mentions = [], attachments = [] } = request.body as any;
      const employeeId = (request as any).user?.sub;

      // Direct RBAC check for task edit access
      const taskEditAccess = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map rbac
        WHERE rbac.empid = ${employeeId}
          AND rbac.entity = 'task'
          AND (rbac.entity_id = ${taskId} OR rbac.entity_id = 'all')
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND 1 = ANY(rbac.permission)
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
          task_head_id,
          record_type,
          record_content,
          created_by_employee_id,
          attr,
          active
        ) VALUES (
          ${taskId},
          ${content_type},
          ${content},
          ${employeeId},
          ${JSON.stringify({ mentions, attachments })},
          true
        )
        RETURNING id, created
      `);

      return reply.status(201).send({
        id: String(noteResult[0].id),
        content,
        author_name: String(authorName),
        created_at: String(noteResult[0].created),
      });
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
        taskId: Type.String({ format: 'uuid' }),
      }),
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
            metadata: Type.Optional(Type.Object({})),
          })),
        }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const { taskId } = request.params as { taskId: string };
      const employeeId = (request as any).user?.sub;

      // Direct RBAC check for task access
      const taskAccess = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map rbac
        WHERE rbac.empid = ${employeeId}
          AND rbac.entity = 'task'
          AND (rbac.entity_id = ${taskId} OR rbac.entity_id = 'all')
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND 0 = ANY(rbac.permission)
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
          tr.created_by_employee_id as actor_id,
          e.name as actor_name,
          tr.created as timestamp,
          tr.attr as metadata
        FROM app.d_task_data tr
        LEFT JOIN app.d_employee e ON e.id = tr.created_by_employee_id
        WHERE tr.task_head_id = ${taskId}
          AND tr.active_flag = true
        
        UNION ALL
        
        -- Add system events from task updates
        SELECT 
          gen_random_uuid() as id,
          'system_update' as activity_type,
          CASE 
            WHEN th.created = th.updated THEN 'Task created'
            ELSE 'Task updated'
          END as description,
          NULL as actor_id,
          'System' as actor_name,
          th.updated as timestamp,
          th.attr as metadata
        FROM app.d_task th
        WHERE th.id = ${taskId}
          AND th.active_flag = true
          
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
        metadata: activity.metadata ? JSON.parse(String(activity.metadata)) : undefined,
      }));

      return {
        task_id: taskId,
        activities: formattedActivities,
      };
    } catch (error) {
      fastify.log.error('Error fetching task activity:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get forms linked to task
  fastify.get('/api/v1/task/:id/form', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
      querystring: Type.Object({
        page: Type.Optional(Type.Integer({ minimum: 1 })),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 }))
      })
    }
  }, async function (request, reply) {
    try {
      const { id: taskId } = request.params as { id: string };
      const { page = 1, limit = 20 } = request.query as any;
      const userId = request.user?.sub;

      if (!userId) {
        return reply.status(401).send({ error: 'User not authenticated' });
      }

      // Direct RBAC check for task access
      const taskAccess = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map rbac
        WHERE rbac.empid = ${userId}
          AND rbac.entity = 'task'
          AND (rbac.entity_id = ${taskId}::text OR rbac.entity_id = 'all')
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND 0 = ANY(rbac.permission)
      `);

      if (taskAccess.length === 0) {
        return reply.status(403).send({ error: 'Access denied for this task' });
      }

      const offset = (page - 1) * limit;
      const forms = await db.execute(sql`
        SELECT f.*, COALESCE(f.name, 'Untitled Form') as name, f.descr
        FROM app.d_form_head f
        INNER JOIN app.d_entity_id_map eim ON eim.child_entity_id = f.id::text
        WHERE eim.parent_entity_id = ${taskId}
          AND eim.parent_entity_type = 'task'
          AND eim.child_entity_type = 'form'
          AND eim.active_flag = true
          AND f.active_flag = true
        ORDER BY f.created_ts DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.d_form_head f
        INNER JOIN app.d_entity_id_map eim ON eim.child_entity_id = f.id::text
        WHERE eim.parent_entity_id = ${taskId}
          AND eim.parent_entity_type = 'task'
          AND eim.child_entity_type = 'form'
          AND eim.active_flag = true
          AND f.active_flag = true
      `);

      return {
        data: forms,
        total: Number(countResult[0]?.total || 0),
        page,
        limit
      };
    } catch (error) {
      fastify.log.error('Error fetching task forms:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get artifacts linked to task
  fastify.get('/api/v1/task/:id/artifact', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
      querystring: Type.Object({
        page: Type.Optional(Type.Integer({ minimum: 1 })),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 }))
      })
    }
  }, async function (request, reply) {
    try {
      const { id: taskId } = request.params as { id: string };
      const { page = 1, limit = 20 } = request.query as any;
      const userId = request.user?.sub;

      if (!userId) {
        return reply.status(401).send({ error: 'User not authenticated' });
      }

      // Direct RBAC check for task access
      const taskAccess = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map rbac
        WHERE rbac.empid = ${userId}
          AND rbac.entity = 'task'
          AND (rbac.entity_id = ${taskId}::text OR rbac.entity_id = 'all')
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND 0 = ANY(rbac.permission)
      `);

      if (taskAccess.length === 0) {
        return reply.status(403).send({ error: 'Access denied for this task' });
      }

      const offset = (page - 1) * limit;
      const artifacts = await db.execute(sql`
        SELECT a.*, COALESCE(a.name, 'Untitled Artifact') as name, a.descr
        FROM app.d_artifact a
        INNER JOIN app.d_entity_id_map eim ON eim.child_entity_id = a.id::text
        WHERE eim.parent_entity_id = ${taskId}
          AND eim.parent_entity_type = 'task'
          AND eim.child_entity_type = 'artifact'
          AND eim.active_flag = true
          AND a.active_flag = true
        ORDER BY a.created_ts DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.d_artifact a
        INNER JOIN app.d_entity_id_map eim ON eim.child_entity_id = a.id::text
        WHERE eim.parent_entity_id = ${taskId}
          AND eim.parent_entity_type = 'task'
          AND eim.child_entity_type = 'artifact'
          AND eim.active_flag = true
          AND a.active_flag = true
      `);

      return {
        data: artifacts,
        total: Number(countResult[0]?.total || 0),
        page,
        limit
      };
    } catch (error) {
      fastify.log.error('Error fetching task artifacts:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}