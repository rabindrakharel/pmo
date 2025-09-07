import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { getEmployeeEntityIds, hasPermissionOnEntityId } from '../rbac/ui-api-permission-rbac-gate.js';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { 
  getUniversalColumnMetadata, 
  filterUniversalColumns,
  getColumnsByMetadata 
} from '../../lib/universal-schema-metadata.js';

// Schema based on actual ops_project_head table structure from db/09_project_task.ddl
const ProjectSchema = Type.Object({
  id: Type.String(),
  tenant_id: Type.String(),
  // Project identification and metadata
  project_code: Type.Optional(Type.String()),
  project_type: Type.String(),
  priority_level: Type.String(),
  slug: Type.Optional(Type.String()),
  // Business and operational context
  budget_allocated: Type.Optional(Type.Number()),
  budget_currency: Type.String(),
  // Scope relationships
  business_id: Type.Optional(Type.String()),
  locations: Type.Array(Type.String()),
  worksites: Type.Array(Type.String()),
  // Project team and stakeholders
  project_managers: Type.Array(Type.String()),
  project_sponsors: Type.Array(Type.String()),
  project_leads: Type.Array(Type.String()),
  clients: Type.Array(Type.Any()),
  approvers: Type.Array(Type.String()),
  // Project timeline and planning
  planned_start_date: Type.Optional(Type.String()),
  planned_end_date: Type.Optional(Type.String()),
  actual_start_date: Type.Optional(Type.String()),
  actual_end_date: Type.Optional(Type.String()),
  milestones: Type.Array(Type.Any()),
  deliverables: Type.Array(Type.Any()),
  estimated_hours: Type.Optional(Type.Number()),
  actual_hours: Type.Optional(Type.Number()),
  project_stage: Type.Optional(Type.String()),
  project_status: Type.Optional(Type.String()),
  // Compliance and governance
  security_classification: Type.String(),
  compliance_requirements: Type.Array(Type.Any()),
  risk_assessment: Type.Object({}),
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
});

const CreateProjectSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  project_code: Type.Optional(Type.String()),
  project_type: Type.Optional(Type.String()),
  priority_level: Type.Optional(Type.String()),
  slug: Type.Optional(Type.String()),
  budget_allocated: Type.Optional(Type.Number()),
  budget_currency: Type.Optional(Type.String()),
  business_id: Type.Optional(Type.String({ format: 'uuid' })),
  locations: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
  worksites: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
  project_managers: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
  project_sponsors: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
  project_leads: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
  clients: Type.Optional(Type.Array(Type.Any())),
  approvers: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
  planned_start_date: Type.Optional(Type.String({ format: 'date' })),
  planned_end_date: Type.Optional(Type.String({ format: 'date' })),
  actual_start_date: Type.Optional(Type.String({ format: 'date' })),
  actual_end_date: Type.Optional(Type.String({ format: 'date' })),
  milestones: Type.Optional(Type.Array(Type.Any())),
  deliverables: Type.Optional(Type.Array(Type.Any())),
  estimated_hours: Type.Optional(Type.Number()),
  actual_hours: Type.Optional(Type.Number()),
  project_stage: Type.Optional(Type.String()),
  project_status: Type.Optional(Type.String()),
  security_classification: Type.Optional(Type.String()),
  compliance_requirements: Type.Optional(Type.Array(Type.Any())),
  risk_assessment: Type.Optional(Type.Object({})),
  tags: Type.Optional(Type.Array(Type.String())),
  attr: Type.Optional(Type.Object({})),
  active: Type.Optional(Type.Boolean()),
});

const UpdateProjectSchema = Type.Partial(CreateProjectSchema);

export async function projectRoutes(fastify: FastifyInstance) {
  // List projects with filtering
  fastify.get('/api/v1/project', {
    schema: {
      querystring: Type.Object({
        active: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        project_type: Type.Optional(Type.String()),
        priority_level: Type.Optional(Type.String()),
        project_stage: Type.Optional(Type.String()),
        project_status: Type.Optional(Type.String()),
        business_id: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(ProjectSchema),
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
      active, search, project_type, priority_level, project_stage, 
      project_status, business_id, limit = 50, offset = 0 
    } = request.query as any;


    try {
      // Get employee's allowed project IDs for filtering
      const allowedProjectIds = await getEmployeeEntityIds(userId, 'project');

      const conditions = [];
      
      if (allowedProjectIds.length > 0) {
        // Use IN clause instead of ANY for better compatibility with Drizzle
        const placeholders = allowedProjectIds.map(() => '?').join(',');
        conditions.push(sql.raw(`id IN (${allowedProjectIds.map(id => `'${id}'`).join(',')})`));
      } else {
        // If no project access, return empty result
        return {
          data: [],
          total: 0,
          limit,
          offset,
        };
      }
      
      if (active !== undefined) {
        conditions.push(sql`active = ${active}`);
      }
      
      if (project_type) {
        conditions.push(sql`project_type = ${project_type}`);
      }
      
      if (priority_level) {
        conditions.push(sql`priority_level = ${priority_level}`);
      }
      
      if (project_stage) {
        conditions.push(sql`project_stage = ${project_stage}`);
      }
      
      if (project_status) {
        conditions.push(sql`project_status = ${project_status}`);
      }
      
      if (business_id) {
        conditions.push(sql`business_id = ${business_id}`);
      }
      
      if (search) {
        const searchableColumns = getColumnsByMetadata([
          'name', 'descr', 'project_code', 'slug'
        ], 'ui:search');
        
        const searchConditions = searchableColumns.map(col => 
          sql`COALESCE(${sql.identifier(col)}, '') ILIKE ${`%${search}%`}`
        );
        
        if (searchConditions.length > 0) {
          conditions.push(sql`(${sql.join(searchConditions, sql` OR `)})`);
        }
      }

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total 
        FROM app.d_project 
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      const projects = await db.execute(sql`
        SELECT 
          id, tenant_id, project_code, project_type, priority_level, slug,
          budget_allocated, budget_currency, business_id, locations, worksites,
          project_managers, project_sponsors, project_leads, clients, approvers,
          planned_start_date, planned_end_date, actual_start_date, actual_end_date,
          milestones, deliverables, estimated_hours, actual_hours, 
          project_stage, project_status, security_classification, 
          compliance_requirements, risk_assessment,
          name, "descr", tags, attr, from_ts, to_ts, active, created, updated
        FROM app.d_project
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY name ASC NULLS LAST, created DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true, // Allow all system fields for projects since user has project access
        canSeeSafetyInfo: true,
      };
      
      const filteredData = projects.map(project => 
        filterUniversalColumns(project, userPermissions)
      );

      return {
        data: filteredData,
        total,
        limit,
        offset,
      };
    } catch (error) {
      fastify.log.error('Error fetching projects:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get project tasks - NEW ENDPOINT for navigation
  fastify.get('/api/v1/project/:id/tasks', {
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
      querystring: Type.Object({
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Integer({ minimum: 0 })),
        status: Type.Optional(Type.String()),
        assignee: Type.Optional(Type.String())
      }),
    },
  }, async function (request, reply) {
    try {
      const { id: projectId } = request.params as { id: string };
      const { limit = 50, offset = 0, status, assignee } = request.query as any;
      const userId = request.user?.sub;

      if (!userId) {
        return reply.status(401).send({ error: 'User not authenticated' });
      }


      // Get employee's allowed project IDs for filtering
      const allowedProjectIds = await getEmployeeEntityIds(userId, 'project');

      if (!allowedProjectIds.includes(projectId)) {
        return reply.status(403).send({ error: 'Access denied for this project' });
      }

      // Build conditions for task filtering
      const conditions = [sql`th.proj_head_id = ${projectId}`, sql`th.active = true`];
      
      if (status) {
        conditions.push(sql`tr.status_name = ${status}`);
      }
      if (assignee) {
        conditions.push(sql`th.assignee_id = ${assignee}`);
      }

      const tasks = await db.execute(sql`
        SELECT 
          th.id, th.title, th.task_code, th.task_type, th.priority,
          th.assignee_id, th.reporter_id, th.proj_head_id,
          th.estimated_hours, th.story_points,
          th.planned_start_date, th.planned_end_date,
          th.name, th.descr, th.tags, th.created, th.updated,
          -- Task records data
          tr.status_name, tr.stage_name, tr.completion_percentage,
          tr.actual_start_date, tr.actual_end_date, tr.actual_hours,
          -- Employee details
          assignee.name as assignee_name,
          reporter.name as reporter_name
        FROM app.ops_task_head th
        LEFT JOIN app.ops_task_records tr ON th.id = tr.head_id
        LEFT JOIN app.d_employee assignee ON th.assignee_id = assignee.id
        LEFT JOIN app.d_employee reporter ON th.reporter_id = reporter.id
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY th.created DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total 
        FROM app.ops_task_head th
        LEFT JOIN app.ops_task_records tr ON th.id = tr.head_id
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);

      return {
        data: tasks,
        total: Number(countResult[0]?.total || 0),
        limit,
        offset,
        project_id: projectId,
      };
    } catch (error) {
      fastify.log.error('Error fetching project tasks:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single project
  fastify.get('/api/v1/project/:id', {
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: ProjectSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    // Check if employee has permission to view this specific project
    const hasViewAccess = await hasPermissionOnEntityId(userId, 'project', id, 'view');
    if (!hasViewAccess) {
      return reply.status(403).send({ error: 'Insufficient permissions to view this project' });
    }

    try {
      const project = await db.execute(sql`
        SELECT 
          id, tenant_id, project_code, project_type, priority_level, slug,
          budget_allocated, budget_currency, business_id, locations, worksites,
          project_managers, project_sponsors, project_leads, clients, approvers,
          planned_start_date, planned_end_date, actual_start_date, actual_end_date,
          milestones, deliverables, estimated_hours, actual_hours, 
          project_stage, project_status, security_classification, 
          compliance_requirements, risk_assessment,
          name, "descr", tags, attr, from_ts, to_ts, active, created, updated
        FROM app.d_project 
        WHERE id = ${id}
      `);

      if (project.length === 0) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true, // Allow all system fields for projects since user has project access
        canSeeSafetyInfo: true,
      };
      
      return filterUniversalColumns(project[0], userPermissions);
    } catch (error) {
      fastify.log.error('Error fetching project:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create project
  fastify.post('/api/v1/project', {
    schema: {
      body: CreateProjectSchema,
      response: {
        201: ProjectSchema,
        403: Type.Object({ error: Type.String() }),
        400: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const data = request.body as any;


    try {
      // Check for unique project code if provided
      if (data.project_code) {
        const existingProject = await db.execute(sql`
          SELECT id FROM app.d_project WHERE project_code = ${data.project_code} AND active = true
        `);
        if (existingProject.length > 0) {
          return reply.status(400).send({ error: 'Project with this code already exists' });
        }
      }

      // Check for unique slug if provided
      if (data.slug) {
        const existingSlug = await db.execute(sql`
          SELECT id FROM app.d_project WHERE slug = ${data.slug} AND active = true
        `);
        if (existingSlug.length > 0) {
          return reply.status(400).send({ error: 'Project with this slug already exists' });
        }
      }

      // Get user's tenant_id (this should come from auth context in real implementation)
      const userInfo = await db.execute(sql`
        SELECT id FROM app.d_employee WHERE id = ${userId} LIMIT 1
      `);
      
      if (userInfo.length === 0) {
        return reply.status(400).send({ error: 'User not found' });
      }

      // For now, use a default tenant_id - in production this should come from user context
      const tenantId = '00000000-0000-0000-0000-000000000000';

      const result = await db.execute(sql`
        INSERT INTO app.d_project (
          tenant_id, project_code, project_type, priority_level, slug,
          budget_allocated, budget_currency, business_id, locations, worksites,
          project_managers, project_sponsors, project_leads, clients, approvers,
          planned_start_date, planned_end_date, actual_start_date, actual_end_date,
          milestones, deliverables, estimated_hours, actual_hours, 
          project_stage, project_status, security_classification, 
          compliance_requirements, risk_assessment,
          name, "descr", tags, attr, active
        )
        VALUES (
          ${tenantId},
          ${data.project_code || null}, 
          ${data.project_type || 'development'}, 
          ${data.priority_level || 'medium'}, 
          ${data.slug || null},
          ${data.budget_allocated || null}, 
          ${data.budget_currency || 'CAD'}, 
          ${data.business_id || null}, 
          ${data.locations ? JSON.stringify(data.locations) : '[]'}::uuid[],
          ${data.worksites ? JSON.stringify(data.worksites) : '[]'}::uuid[],
          ${data.project_managers ? JSON.stringify(data.project_managers) : '[]'}::uuid[],
          ${data.project_sponsors ? JSON.stringify(data.project_sponsors) : '[]'}::uuid[],
          ${data.project_leads ? JSON.stringify(data.project_leads) : '[]'}::uuid[],
          ${data.clients ? JSON.stringify(data.clients) : '[]'}::jsonb,
          ${data.approvers ? JSON.stringify(data.approvers) : '[]'}::uuid[],
          ${data.planned_start_date || null},
          ${data.planned_end_date || null},
          ${data.actual_start_date || null},
          ${data.actual_end_date || null},
          ${data.milestones ? JSON.stringify(data.milestones) : '[]'}::jsonb,
          ${data.deliverables ? JSON.stringify(data.deliverables) : '[]'}::jsonb,
          ${data.estimated_hours || null},
          ${data.actual_hours || null},
          ${data.project_stage || null},
          ${data.project_status || null},
          ${data.security_classification || 'internal'},
          ${data.compliance_requirements ? JSON.stringify(data.compliance_requirements) : '[]'}::jsonb,
          ${data.risk_assessment ? JSON.stringify(data.risk_assessment) : '{}'}::jsonb,
          ${data.name}, 
          ${data.descr || null},
          ${data.tags ? JSON.stringify(data.tags) : '[]'}::jsonb,
          ${data.attr ? JSON.stringify(data.attr) : '{}'}::jsonb,
          ${data.active !== false}
        )
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to create project' });
      }

      const userPermissions = {
        canSeePII: true, // Creator can see their data
        canSeeFinancial: true,
        canSeeSystemFields: true,
        canSeeSafetyInfo: true,
      };
      
      return reply.status(201).send(filterUniversalColumns(result[0], userPermissions));
    } catch (error) {
      fastify.log.error('Error creating project:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update project
  fastify.put('/api/v1/project/:id', {
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      body: UpdateProjectSchema,
      response: {
        200: ProjectSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;

    // Check if employee has permission to modify this specific project
    const hasModifyAccess = await hasPermissionOnEntityId(userId, 'project', id, 'modify');
    if (!hasModifyAccess) {
      return reply.status(403).send({ error: 'Insufficient permissions to modify this project' });
    }

    try {
      const existing = await db.execute(sql`
        SELECT id FROM app.d_project WHERE id = ${id}
      `);
      
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      const updateFields = [];
      
      if (data.name !== undefined) updateFields.push(sql`name = ${data.name}`);
      if (data.descr !== undefined) updateFields.push(sql`"descr" = ${data.descr}`);
      if (data.project_code !== undefined) updateFields.push(sql`project_code = ${data.project_code}`);
      if (data.project_type !== undefined) updateFields.push(sql`project_type = ${data.project_type}`);
      if (data.priority_level !== undefined) updateFields.push(sql`priority_level = ${data.priority_level}`);
      if (data.slug !== undefined) updateFields.push(sql`slug = ${data.slug}`);
      if (data.budget_allocated !== undefined) updateFields.push(sql`budget_allocated = ${data.budget_allocated}`);
      if (data.budget_currency !== undefined) updateFields.push(sql`budget_currency = ${data.budget_currency}`);
      if (data.business_id !== undefined) updateFields.push(sql`business_id = ${data.business_id}`);
      if (data.locations !== undefined) updateFields.push(sql`locations = ${JSON.stringify(data.locations)}::uuid[]`);
      if (data.worksites !== undefined) updateFields.push(sql`worksites = ${JSON.stringify(data.worksites)}::uuid[]`);
      if (data.project_managers !== undefined) updateFields.push(sql`project_managers = ${JSON.stringify(data.project_managers)}::uuid[]`);
      if (data.project_sponsors !== undefined) updateFields.push(sql`project_sponsors = ${JSON.stringify(data.project_sponsors)}::uuid[]`);
      if (data.project_leads !== undefined) updateFields.push(sql`project_leads = ${JSON.stringify(data.project_leads)}::uuid[]`);
      if (data.clients !== undefined) updateFields.push(sql`clients = ${JSON.stringify(data.clients)}::jsonb`);
      if (data.approvers !== undefined) updateFields.push(sql`approvers = ${JSON.stringify(data.approvers)}::uuid[]`);
      if (data.planned_start_date !== undefined) updateFields.push(sql`planned_start_date = ${data.planned_start_date}`);
      if (data.planned_end_date !== undefined) updateFields.push(sql`planned_end_date = ${data.planned_end_date}`);
      if (data.actual_start_date !== undefined) updateFields.push(sql`actual_start_date = ${data.actual_start_date}`);
      if (data.actual_end_date !== undefined) updateFields.push(sql`actual_end_date = ${data.actual_end_date}`);
      if (data.milestones !== undefined) updateFields.push(sql`milestones = ${JSON.stringify(data.milestones)}::jsonb`);
      if (data.deliverables !== undefined) updateFields.push(sql`deliverables = ${JSON.stringify(data.deliverables)}::jsonb`);
      if (data.estimated_hours !== undefined) updateFields.push(sql`estimated_hours = ${data.estimated_hours}`);
      if (data.actual_hours !== undefined) updateFields.push(sql`actual_hours = ${data.actual_hours}`);
      if (data.project_stage !== undefined) updateFields.push(sql`project_stage = ${data.project_stage}`);
      if (data.project_status !== undefined) updateFields.push(sql`project_status = ${data.project_status}`);
      if (data.security_classification !== undefined) updateFields.push(sql`security_classification = ${data.security_classification}`);
      if (data.compliance_requirements !== undefined) updateFields.push(sql`compliance_requirements = ${JSON.stringify(data.compliance_requirements)}::jsonb`);
      if (data.risk_assessment !== undefined) updateFields.push(sql`risk_assessment = ${JSON.stringify(data.risk_assessment)}::jsonb`);
      if (data.tags !== undefined) updateFields.push(sql`tags = ${JSON.stringify(data.tags)}::jsonb`);
      if (data.attr !== undefined) updateFields.push(sql`attr = ${JSON.stringify(data.attr)}::jsonb`);
      if (data.active !== undefined) updateFields.push(sql`active = ${data.active}`);

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.d_project 
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to update project' });
      }

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
        canSeeSafetyInfo: true,
      };
      
      return filterUniversalColumns(result[0], userPermissions);
    } catch (error) {
      fastify.log.error('Error updating project:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete project (soft delete)
  fastify.delete('/api/v1/project/:id', {
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

    // Check if employee has permission to delete this specific project
    const hasDeleteAccess = await hasPermissionOnEntityId(userId, 'project', id, 'delete');
    if (!hasDeleteAccess) {
      return reply.status(403).send({ error: 'Insufficient permissions to delete this project' });
    }

    try {
      const existing = await db.execute(sql`
        SELECT id FROM app.d_project WHERE id = ${id}
      `);
      
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      // Soft delete (using SCD Type 2 pattern)
      await db.execute(sql`
        UPDATE app.d_project 
        SET active = false, to_ts = NOW(), updated = NOW()
        WHERE id = ${id}
      `);

      return reply.status(204).send();
    } catch (error) {
      fastify.log.error('Error deleting project:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}