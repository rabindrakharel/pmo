import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
// RBAC imports temporarily disabled - will be updated to use unified scope system
// import { getEmployeeScopeIds, hasPermissionOnScopeId, Permission } from '../rbac/ui-api-permission-rbac-gate.js';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { 
  getUniversalColumnMetadata, 
  filterUniversalColumns,
  getColumnsByMetadata 
} from '../../lib/universal-schema-metadata.js';

const TaskSchema = Type.Object({
  id: Type.String(),
  
  // Standard fields
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  tags: Type.Array(Type.String()),
  attr: Type.Object({}),
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.String()),
  active: Type.Boolean(),
  created: Type.String(),
  updated: Type.String(),
  
  // Task identification
  task_number: Type.String(),
  task_type: Type.String(),
  task_category: Type.String(),
  
  // Project relationship
  project_id: Type.String(),
  project_name: Type.Optional(Type.String()),
  project_code: Type.Optional(Type.String()),
  
  // Task status and priority
  task_status: Type.String(),
  priority_level: Type.Optional(Type.String()),
  urgency_level: Type.Optional(Type.String()),
  
  // Assignment and responsibility
  assigned_to_employee_id: Type.Optional(Type.String()),
  assigned_to_employee_name: Type.Optional(Type.String()),
  assigned_crew_id: Type.Optional(Type.String()),
  task_owner_id: Type.Optional(Type.String()),
  
  // Scheduling and timeline
  planned_start_date: Type.Optional(Type.String()),
  planned_end_date: Type.Optional(Type.String()),
  actual_start_date: Type.Optional(Type.String()),
  actual_end_date: Type.Optional(Type.String()),
  estimated_hours: Type.Optional(Type.Number()),
  actual_hours: Type.Optional(Type.Number()),
  
  // Location and site information
  worksite_id: Type.Optional(Type.String()),
  client_id: Type.Optional(Type.String()),
  service_address: Type.Optional(Type.String()),
  location_notes: Type.Optional(Type.String()),
  
  // Task specifications
  work_scope: Type.Optional(Type.String()),
  materials_required: Type.Array(Type.Any()),
  equipment_required: Type.Array(Type.Any()),
  safety_requirements: Type.Array(Type.Any()),
  
  // Quality and completion
  completion_percentage: Type.Optional(Type.Number()),
  quality_score: Type.Optional(Type.Number()),
  client_satisfaction_score: Type.Optional(Type.Number()),
  rework_required: Type.Optional(Type.Boolean()),
  
  // Financial tracking
  estimated_cost: Type.Optional(Type.Number()),
  actual_cost: Type.Optional(Type.Number()),
  billable_hours: Type.Optional(Type.Number()),
  billing_rate: Type.Optional(Type.Number()),
  
  // Dependencies and relationships
  predecessor_tasks: Type.Array(Type.Any()),
  successor_tasks: Type.Array(Type.Any()),
  blocking_issues: Type.Array(Type.Any()),
  
  // Communication and documentation
  client_communication_required: Type.Optional(Type.Boolean()),
  permit_required: Type.Optional(Type.Boolean()),
  inspection_required: Type.Optional(Type.Boolean()),
  documentation_complete: Type.Optional(Type.Boolean()),
});

// Task Records are deprecated - using single table approach from DDL

const CreateTaskSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  
  // Task identification
  task_number: Type.String({ minLength: 1 }),
  task_type: Type.Optional(Type.String()),
  task_category: Type.Optional(Type.String()),
  
  // Project relationship
  project_id: Type.String({ format: 'uuid' }),
  project_name: Type.Optional(Type.String()),
  project_code: Type.Optional(Type.String()),
  
  // Task status and priority
  task_status: Type.Optional(Type.String()),
  priority_level: Type.Optional(Type.String()),
  urgency_level: Type.Optional(Type.String()),
  
  // Assignment and responsibility
  assigned_to_employee_id: Type.Optional(Type.String({ format: 'uuid' })),
  assigned_to_employee_name: Type.Optional(Type.String()),
  assigned_crew_id: Type.Optional(Type.String({ format: 'uuid' })),
  task_owner_id: Type.Optional(Type.String({ format: 'uuid' })),
  
  // Scheduling and timeline
  planned_start_date: Type.Optional(Type.String({ format: 'date' })),
  planned_end_date: Type.Optional(Type.String({ format: 'date' })),
  actual_start_date: Type.Optional(Type.String({ format: 'date' })),
  actual_end_date: Type.Optional(Type.String({ format: 'date' })),
  estimated_hours: Type.Optional(Type.Number()),
  actual_hours: Type.Optional(Type.Number()),
  
  // Location and site information
  worksite_id: Type.Optional(Type.String({ format: 'uuid' })),
  client_id: Type.Optional(Type.String({ format: 'uuid' })),
  service_address: Type.Optional(Type.String()),
  location_notes: Type.Optional(Type.String()),
  
  // Task specifications
  work_scope: Type.Optional(Type.String()),
  materials_required: Type.Optional(Type.Array(Type.Any())),
  equipment_required: Type.Optional(Type.Array(Type.Any())),
  safety_requirements: Type.Optional(Type.Array(Type.Any())),
  
  // Quality and completion
  completion_percentage: Type.Optional(Type.Number()),
  quality_score: Type.Optional(Type.Number()),
  client_satisfaction_score: Type.Optional(Type.Number()),
  rework_required: Type.Optional(Type.Boolean()),
  
  // Financial tracking
  estimated_cost: Type.Optional(Type.Number()),
  actual_cost: Type.Optional(Type.Number()),
  billable_hours: Type.Optional(Type.Number()),
  billing_rate: Type.Optional(Type.Number()),
  
  // Dependencies and relationships
  predecessor_tasks: Type.Optional(Type.Array(Type.Any())),
  successor_tasks: Type.Optional(Type.Array(Type.Any())),
  blocking_issues: Type.Optional(Type.Array(Type.Any())),
  
  // Communication and documentation
  client_communication_required: Type.Optional(Type.Boolean()),
  permit_required: Type.Optional(Type.Boolean()),
  inspection_required: Type.Optional(Type.Boolean()),
  documentation_complete: Type.Optional(Type.Boolean()),
  
  // Standard fields
  tags: Type.Optional(Type.Array(Type.String())),
  attr: Type.Optional(Type.Object({})),
  active: Type.Optional(Type.Boolean()),
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


    try {
      // Build query conditions
      const conditions = [];
      
      if (active !== undefined) {
        conditions.push(sql`active = ${active}`);
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
        FROM app.ops_task_head
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      // Get paginated tasks
      const tasks = await db.execute(sql`
        SELECT 
          id, name, "descr",
          COALESCE(tags, '[]'::jsonb) as tags,
          attr, from_ts, to_ts, active, created, updated,
          task_number, task_type, task_category,
          project_id, project_name, project_code,
          task_status, priority_level, urgency_level,
          assigned_to_employee_id, assigned_to_employee_name, assigned_crew_id, task_owner_id,
          planned_start_date, planned_end_date, actual_start_date, actual_end_date,
          estimated_hours, actual_hours,
          worksite_id, client_id, service_address, location_notes,
          work_scope,
          COALESCE(materials_required, '[]'::jsonb) as materials_required,
          COALESCE(equipment_required, '[]'::jsonb) as equipment_required,
          COALESCE(safety_requirements, '[]'::jsonb) as safety_requirements,
          completion_percentage, quality_score, client_satisfaction_score, rework_required,
          estimated_cost, actual_cost, billable_hours, billing_rate,
          COALESCE(predecessor_tasks, '[]'::jsonb) as predecessor_tasks,
          COALESCE(successor_tasks, '[]'::jsonb) as successor_tasks,
          COALESCE(blocking_issues, '[]'::jsonb) as blocking_issues,
          client_communication_required, permit_required, inspection_required, documentation_complete
        FROM app.ops_task_head
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY created DESC
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
        200: TaskSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      // Get single task
      const task = await db.execute(sql`
        SELECT 
          id, name, "descr",
          COALESCE(tags, '[]'::jsonb) as tags,
          attr, from_ts, to_ts, active, created, updated,
          task_number, task_type, task_category,
          project_id, project_name, project_code,
          task_status, priority_level, urgency_level,
          assigned_to_employee_id, assigned_to_employee_name, assigned_crew_id, task_owner_id,
          planned_start_date, planned_end_date, actual_start_date, actual_end_date,
          estimated_hours, actual_hours,
          worksite_id, client_id, service_address, location_notes,
          work_scope,
          COALESCE(materials_required, '[]'::jsonb) as materials_required,
          COALESCE(equipment_required, '[]'::jsonb) as equipment_required,
          COALESCE(safety_requirements, '[]'::jsonb) as safety_requirements,
          completion_percentage, quality_score, client_satisfaction_score, rework_required,
          estimated_cost, actual_cost, billable_hours, billing_rate,
          COALESCE(predecessor_tasks, '[]'::jsonb) as predecessor_tasks,
          COALESCE(successor_tasks, '[]'::jsonb) as successor_tasks,
          COALESCE(blocking_issues, '[]'::jsonb) as blocking_issues,
          client_communication_required, permit_required, inspection_required, documentation_complete
        FROM app.ops_task_head
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
        materials_required: Array.isArray(taskData.materials_required) ? taskData.materials_required : (taskData.materials_required ? JSON.parse(taskData.materials_required) : []),
        equipment_required: Array.isArray(taskData.equipment_required) ? taskData.equipment_required : (taskData.equipment_required ? JSON.parse(taskData.equipment_required) : []),
        safety_requirements: Array.isArray(taskData.safety_requirements) ? taskData.safety_requirements : (taskData.safety_requirements ? JSON.parse(taskData.safety_requirements) : []),
        predecessor_tasks: Array.isArray(taskData.predecessor_tasks) ? taskData.predecessor_tasks : (taskData.predecessor_tasks ? JSON.parse(taskData.predecessor_tasks) : []),
        successor_tasks: Array.isArray(taskData.successor_tasks) ? taskData.successor_tasks : (taskData.successor_tasks ? JSON.parse(taskData.successor_tasks) : []),
        blocking_issues: Array.isArray(taskData.blocking_issues) ? taskData.blocking_issues : (taskData.blocking_issues ? JSON.parse(taskData.blocking_issues) : []),
        attr: taskData.attr || {},
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

    // Basic validation - detailed RBAC to be implemented with unified scope system

    try {
      // Create task using new normalized structure
      const result = await db.execute(sql`
        INSERT INTO app.ops_task_head (
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

    try {
      // Check if task exists
      const existing = await db.execute(sql`
        SELECT id FROM app.ops_task_head WHERE id = ${id}
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
      if (data.active !== undefined) updateFields.push(sql`active = ${data.active}`);

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.ops_task_head 
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

    try {
      // Check if task exists
      const existing = await db.execute(sql`
        SELECT id FROM app.ops_task_head WHERE id = ${id}
      `);
      
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      // Soft delete task
      await db.execute(sql`
        UPDATE app.ops_task_head 
        SET active = false, to_ts = NOW(), updated = NOW()
        WHERE id = ${id}
      `);

      return reply.status(204).send();
    } catch (error) {
      fastify.log.error('Error deleting task:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}