import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
// RBAC implemented directly via database joins - no separate permission gates
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { 
  getUniversalColumnMetadata, 
  filterUniversalColumns,
  getColumnsByMetadata 
} from '../../lib/universal-schema-metadata.js';

// Schema based on actual d_project table structure from db/XV_d_project.ddl
const ProjectSchema = Type.Object({
  id: Type.String(),
  slug: Type.String(),
  code: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Any()),
  metadata: Type.Optional(Type.Any()),
  // Project relationships
  business_id: Type.Optional(Type.String()),
  office_id: Type.Optional(Type.String()),
  // Project fields
  project_stage: Type.Optional(Type.String()),
  budget_allocated: Type.Optional(Type.Number()),
  budget_spent: Type.Optional(Type.Number()),
  planned_start_date: Type.Optional(Type.String()),
  planned_end_date: Type.Optional(Type.String()),
  actual_start_date: Type.Optional(Type.String()),
  actual_end_date: Type.Optional(Type.String()),
  // Project team
  manager_employee_id: Type.Optional(Type.String()),
  sponsor_employee_id: Type.Optional(Type.String()),
  stakeholder_employee_ids: Type.Optional(Type.Array(Type.String())),
  // Temporal fields
  from_ts: Type.Optional(Type.String()),
  to_ts: Type.Optional(Type.String()),
  active_flag: Type.Optional(Type.Boolean()),
  created_ts: Type.Optional(Type.String()),
  updated_ts: Type.Optional(Type.String()),
  version: Type.Optional(Type.Number()),
});

const CreateProjectSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  slug: Type.String({ minLength: 1 }),
  code: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Any()),
  metadata: Type.Optional(Type.Any()),
  business_id: Type.Optional(Type.String({ format: 'uuid' })),
  office_id: Type.Optional(Type.String({ format: 'uuid' })),
  project_stage: Type.Optional(Type.String()),
  budget_allocated: Type.Optional(Type.Number()),
  budget_spent: Type.Optional(Type.Number()),
  planned_start_date: Type.Optional(Type.String({ format: 'date' })),
  planned_end_date: Type.Optional(Type.String({ format: 'date' })),
  actual_start_date: Type.Optional(Type.String({ format: 'date' })),
  actual_end_date: Type.Optional(Type.String({ format: 'date' })),
  manager_employee_id: Type.Optional(Type.String({ format: 'uuid' })),
  sponsor_employee_id: Type.Optional(Type.String({ format: 'uuid' })),
  stakeholder_employee_ids: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
  active_flag: Type.Optional(Type.Boolean()),
});

const UpdateProjectSchema = Type.Partial(CreateProjectSchema);

export async function projectRoutes(fastify: FastifyInstance) {
  // List projects with filtering
  fastify.get('/api/v1/project', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        active: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        project_stage: Type.Optional(Type.String()),
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
      active, search, project_stage, business_id, limit = 50, offset = 0
    } = request.query as any;

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Direct RBAC filtering - only show projects user has access to
      const baseConditions = [
        sql`(
          EXISTS (
            SELECT 1 FROM app.entity_id_rbac_map rbac
            WHERE rbac.empid = ${userId}
              AND rbac.entity = 'project'
              AND (rbac.entity_id = p.id::text OR rbac.entity_id = 'all')
              AND rbac.active_flag = true
              AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
              AND 0 = ANY(rbac.permission)
          )
        )`
      ];

      const conditions = [...baseConditions];

      if (active !== undefined) {
        conditions.push(sql`p.active_flag = ${active}`);
      }

      if (project_stage) {
        conditions.push(sql`p.project_stage = ${project_stage}`);
      }

      if (search) {
        conditions.push(sql`(
          p.name ILIKE ${`%${search}%`} OR
          p.descr ILIKE ${`%${search}%`} OR
          p.code ILIKE ${`%${search}%`} OR
          p.slug ILIKE ${`%${search}%`}
        )`);
      }

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.d_project p
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      const projects = await db.execute(sql`
        SELECT
          p.id, p.code, p.slug, p.name, p.descr, p.tags, p.metadata,
          p.project_stage,
          p.budget_allocated, p.budget_spent,
          p.planned_start_date, p.planned_end_date, p.actual_start_date, p.actual_end_date,
          p.manager_employee_id, p.sponsor_employee_id, p.stakeholder_employee_ids,
          p.from_ts, p.to_ts, p.active_flag, p.created_ts, p.updated_ts, p.version
        FROM app.d_project p
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY p.name ASC NULLS LAST, p.created_ts DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return {
        data: projects,
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
    preHandler: [fastify.authenticate],
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


      // Direct RBAC check for project access
      const projectAccess = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map rbac
        WHERE rbac.empid = ${userId}
          AND rbac.entity = 'project'
          AND (rbac.entity_id = ${projectId}::text OR rbac.entity_id = 'all')
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND 0 = ANY(rbac.permission)
      `);

      if (projectAccess.length === 0) {
        return reply.status(403).send({ error: 'Access denied for this project' });
      }

      // Build conditions for task filtering
      const conditions = [sql`th.project_id = ${projectId}`, sql`th.active_flag = true`];
      
      if (status) {
        conditions.push(sql`tr.status_name = ${status}`);
      }
      if (assignee) {
        conditions.push(sql`th.assignee_id = ${assignee}`);
      }

      const tasks = await db.execute(sql`
        SELECT 
          th.id, th.title, th.task_code, th.task_type, th.priority,
          th.assignee_id, th.reporter_id, th.project_id,
          th.estimated_hours, th.story_points,
          th.planned_start_date, th.planned_end_date,
          th.name, th.descr, th.tags, th.created, th.updated,
          -- Task records data
          tr.status_name, tr.stage_name, tr.completion_percentage,
          tr.actual_start_date, tr.actual_end_date, tr.actual_hours,
          -- Employee details
          assignee.name as assignee_name,
          reporter.name as reporter_name
        FROM app.d_task th
        LEFT JOIN app.d_task_data tr ON th.id = tr.head_id
        LEFT JOIN app.d_employee assignee ON th.assignee_id = assignee.id
        LEFT JOIN app.d_employee reporter ON th.reporter_id = reporter.id
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY th.created DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total 
        FROM app.d_task th
        LEFT JOIN app.d_task_data tr ON th.id = tr.head_id
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

  // Get project dynamic child entity tabs - for tab navigation
  fastify.get('/api/v1/project/:id/dynamic-child-entity-tabs', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
      response: {
        200: Type.Object({
          action_entities: Type.Array(Type.Object({
            actionEntity: Type.String(),
            count: Type.Number(),
            label: Type.String(),
            icon: Type.Optional(Type.String())
          })),
          project_id: Type.String()
        }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async function (request, reply) {
    try {
      const { id: projectId } = request.params as { id: string };
      const userId = request.user?.sub;

      if (!userId) {
        return reply.status(401).send({ error: 'User not authenticated' });
      }

      // Direct RBAC check for project access
      const projectAccess = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map rbac
        WHERE rbac.empid = ${userId}
          AND rbac.entity = 'project'
          AND (rbac.entity_id = ${projectId}::text OR rbac.entity_id = 'all')
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND 0 = ANY(rbac.permission)
      `);

      if (projectAccess.length === 0) {
        return reply.status(403).send({ error: 'Insufficient permissions to view this project' });
      }

      // Check if project exists
      const project = await db.execute(sql`
        SELECT id FROM app.d_project WHERE id = ${projectId} AND active_flag = true
      `);

      if (project.length === 0) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      // Get action summaries for this project
      const actionSummaries = [];

      // Count tasks using join table
      const taskCount = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM app.d_task t
        INNER JOIN app.entity_id_map eh ON eh.child_entity_id = t.id
        WHERE eh.parent_entity_id = ${projectId}
          AND eh.parent_entity_type = 'project'
          AND eh.child_entity_type = 'task'
          AND eh.active_flag = true
          AND t.active_flag = true
      `);
      actionSummaries.push({
        actionEntity: 'task',
        count: Number(taskCount[0]?.count || 0),
        label: 'Tasks',
        icon: 'CheckSquare'
      });

      // Count artifacts using join table
      const artifactCount = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM app.d_artifact a
        INNER JOIN app.entity_id_map eh ON eh.child_entity_id = a.id
        WHERE eh.parent_entity_id = ${projectId}
          AND eh.parent_entity_type = 'project'
          AND eh.child_entity_type = 'artifact'
          AND eh.active_flag = true
          AND a.active_flag = true
      `);
      actionSummaries.push({
        actionEntity: 'artifact',
        count: Number(artifactCount[0]?.count || 0),
        label: 'Artifacts',
        icon: 'FileText'
      });

      // Count wiki entries using join table
      const wikiCount = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM app.d_wiki w
        INNER JOIN app.entity_id_map eh ON eh.child_entity_id = w.id
        WHERE eh.parent_entity_id = ${projectId}
          AND eh.parent_entity_type = 'project'
          AND eh.child_entity_type = 'wiki'
          AND eh.active_flag = true
          AND w.active_flag = true
      `);
      actionSummaries.push({
        actionEntity: 'wiki',
        count: Number(wikiCount[0]?.count || 0),
        label: 'Wiki',
        icon: 'BookOpen'
      });

      // Count forms using join table
      const formCount = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM app.d_form_head f
        INNER JOIN app.entity_id_map eh ON eh.child_entity_id = f.id
        WHERE eh.parent_entity_id = ${projectId}
          AND eh.parent_entity_type = 'project'
          AND eh.child_entity_type = 'form'
          AND eh.active_flag = true
          AND f.active_flag = true
      `);
      actionSummaries.push({
        actionEntity: 'form',
        count: Number(formCount[0]?.count || 0),
        label: 'Forms',
        icon: 'FileText'
      });

      return {
        action_entities: actionSummaries,
        project_id: projectId
      };
    } catch (error) {
      fastify.log.error('Error fetching project action summaries:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get project wiki entries
  fastify.get('/api/v1/project/:id/wiki', {
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
      const { id: projectId } = request.params as { id: string };
      const { page = 1, limit = 20 } = request.query as any;
      const userId = request.user?.sub;

      if (!userId) {
        return reply.status(401).send({ error: 'User not authenticated' });
      }

      // Direct RBAC check for project access
      const projectAccess = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map rbac
        WHERE rbac.empid = ${userId}
          AND rbac.entity = 'project'
          AND (rbac.entity_id = ${projectId}::text OR rbac.entity_id = 'all')
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND 0 = ANY(rbac.permission)
      `);

      if (projectAccess.length === 0) {
        return reply.status(403).send({ error: 'Access denied for this project' });
      }

      const offset = (page - 1) * limit;
      const wiki = await db.execute(sql`
        SELECT w.id, w.name, w.summary as descr, w.tags, w.created_ts as created, w.updated_ts as updated
        FROM app.d_wiki w
        INNER JOIN app.d_entity_id_map eim ON eim.child_entity_id = w.id::text
        WHERE eim.parent_entity_id = ${projectId}
          AND eim.parent_entity_type = 'project'
          AND eim.child_entity_type = 'wiki'
          AND eim.active_flag = true
          AND w.active_flag = true
        ORDER BY w.created_ts DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.d_wiki w
        INNER JOIN app.d_entity_id_map eim ON eim.child_entity_id = w.id::text
        WHERE eim.parent_entity_id = ${projectId}
          AND eim.parent_entity_type = 'project'
          AND eim.child_entity_type = 'wiki'
          AND eim.active_flag = true
          AND w.active_flag = true
      `);

      return {
        data: wiki,
        total: Number(countResult[0]?.total || 0),
        page,
        limit
      };
    } catch (error) {
      fastify.log.error('Error fetching project wiki:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get project forms
  fastify.get('/api/v1/project/:id/forms', {
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
      const { id: projectId } = request.params as { id: string };
      const { page = 1, limit = 20 } = request.query as any;
      const userId = request.user?.sub;

      if (!userId) {
        return reply.status(401).send({ error: 'User not authenticated' });
      }

      // Direct RBAC check for project access
      const projectAccess = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map rbac
        WHERE rbac.empid = ${userId}
          AND rbac.entity = 'project'
          AND (rbac.entity_id = ${projectId}::text OR rbac.entity_id = 'all')
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND 0 = ANY(rbac.permission)
      `);

      if (projectAccess.length === 0) {
        return reply.status(403).send({ error: 'Access denied for this project' });
      }

      const offset = (page - 1) * limit;
      const forms = await db.execute(sql`
        SELECT f.id, f.name, f.descr, f.tags, f.created, f.updated, eim.relationship_type
        FROM app.d_entity_id_map eim
        INNER JOIN app.d_form_head f ON f.id::text = eim.child_entity_id
        WHERE eim.parent_entity_type = 'project'
          AND eim.parent_entity_id = ${projectId}
          AND eim.child_entity_type = 'form'
          AND eim.active_flag = true
          AND f.active_flag = true
        ORDER BY f.created DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.d_entity_id_map eim
        INNER JOIN app.d_form_head f ON f.id::text = eim.child_entity_id
        WHERE eim.parent_entity_type = 'project'
          AND eim.parent_entity_id = ${projectId}
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
      fastify.log.error('Error fetching project forms:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get project artifacts
  fastify.get('/api/v1/project/:id/artifacts', {
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
      const { id: projectId } = request.params as { id: string };
      const { page = 1, limit = 20 } = request.query as any;
      const userId = request.user?.sub;

      if (!userId) {
        return reply.status(401).send({ error: 'User not authenticated' });
      }

      // Direct RBAC check for project access
      const projectAccess = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map rbac
        WHERE rbac.empid = ${userId}
          AND rbac.entity = 'project'
          AND (rbac.entity_id = ${projectId}::text OR rbac.entity_id = 'all')
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND 0 = ANY(rbac.permission)
      `);

      if (projectAccess.length === 0) {
        return reply.status(403).send({ error: 'Access denied for this project' });
      }

      const offset = (page - 1) * limit;
      const artifacts = await db.execute(sql`
        SELECT a.id, a.name, a.descr, a.tags, a.created, a.updated
        FROM app.d_artifact a
        INNER JOIN app.entity_id_map eh ON eh.child_entity_id = a.id
        WHERE eh.parent_entity_id = ${projectId}
          AND eh.parent_entity_type = 'project'
          AND eh.child_entity_type = 'artifact'
          AND eh.active_flag = true
          AND a.active_flag = true
        ORDER BY a.created DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.d_artifact a
        INNER JOIN app.entity_id_map eh ON eh.child_entity_id = a.id
        WHERE eh.parent_entity_id = ${projectId}
          AND eh.parent_entity_type = 'project'
          AND eh.child_entity_type = 'artifact'
          AND eh.active_flag = true
          AND a.active_flag = true
      `);

      return {
        data: artifacts,
        total: Number(countResult[0]?.total || 0),
        page,
        limit
      };
    } catch (error) {
      fastify.log.error('Error fetching project artifacts:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single project
  fastify.get('/api/v1/project/:id', {
    preHandler: [fastify.authenticate],
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

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    // Direct RBAC check for project access
    const projectAccess = await db.execute(sql`
      SELECT 1 FROM app.entity_id_rbac_map rbac
      WHERE rbac.empid = ${userId}
        AND rbac.entity = 'project'
        AND (rbac.entity_id = ${id}::text OR rbac.entity_id = 'all')
        AND rbac.active_flag = true
        AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
        AND 0 = ANY(rbac.permission)
    `);

    if (projectAccess.length === 0) {
      return reply.status(403).send({ error: 'Insufficient permissions to view this project' });
    }

    try {
      const project = await db.execute(sql`
        SELECT
          id, code, slug, name, descr, tags, metadata,
          project_stage,
          budget_allocated, budget_spent,
          planned_start_date, planned_end_date, actual_start_date, actual_end_date,
          manager_employee_id, sponsor_employee_id, stakeholder_employee_ids,
          from_ts, to_ts, active_flag, created_ts, updated_ts, version
        FROM app.d_project
        WHERE id = ${id}
      `);

      if (project.length === 0) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      return project[0];
    } catch (error) {
      fastify.log.error('Error fetching project:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create project
  fastify.post('/api/v1/project', {
    preHandler: [fastify.authenticate],
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

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    // Direct RBAC check for project create permission
    const projectCreateAccess = await db.execute(sql`
      SELECT 1 FROM app.entity_id_rbac_map rbac
      WHERE rbac.empid = ${userId}
        AND rbac.entity = 'project'
        AND rbac.entity_id = 'all'
        AND rbac.active_flag = true
        AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
        AND 4 = ANY(rbac.permission)
    `);

    if (projectCreateAccess.length === 0) {
      return reply.status(403).send({ error: 'Insufficient permissions to create projects' });
    }

    try {
      // Check for unique project code if provided
      if (data.project_code) {
        const existingProject = await db.execute(sql`
          SELECT id FROM app.d_project WHERE project_code = ${data.project_code} AND active_flag = true
        `);
        if (existingProject.length > 0) {
          return reply.status(400).send({ error: 'Project with this code already exists' });
        }
      }

      // Check for unique slug if provided
      if (data.slug) {
        const existingSlug = await db.execute(sql`
          SELECT id FROM app.d_project WHERE slug = ${data.slug} AND active_flag = true
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
          project_code, project_type, priority_level, slug,
          budget_allocated, budget_currency, biz_id, locations, worksites,
          project_managers, project_sponsors, project_leads, clients, approvers,
          planned_start_date, planned_end_date, actual_start_date, actual_end_date,
          milestones, deliverables, estimated_hours, actual_hours, 
          project_stage, project_status, security_classification, 
          compliance_requirements, risk_assessment,
          name, "descr", tags, attr, active
        )
        VALUES (
          ${data.project_code || null}, 
          ${data.project_type || 'development'}, 
          ${data.priority_level || 'medium'}, 
          ${data.slug || null},
          ${data.budget_allocated || null}, 
          ${data.budget_currency || 'CAD'}, 
          ${data.biz_id || null}, 
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
    preHandler: [fastify.authenticate],
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

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    // Direct RBAC check for project edit access
    const projectEditAccess = await db.execute(sql`
      SELECT 1 FROM app.entity_id_rbac_map rbac
      WHERE rbac.empid = ${userId}
        AND rbac.entity = 'project'
        AND (rbac.entity_id = ${id}::text OR rbac.entity_id = 'all')
        AND rbac.active_flag = true
        AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
        AND 1 = ANY(rbac.permission)
    `);

    if (projectEditAccess.length === 0) {
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
      if (data.biz_id !== undefined) updateFields.push(sql`biz_id = ${data.biz_id}`);
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
      if (data.active !== undefined) updateFields.push(sql`active_flag = ${data.active}`);

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

    // Direct RBAC check for project delete access
    const projectDeleteAccess = await db.execute(sql`
      SELECT 1 FROM app.entity_id_rbac_map rbac
      WHERE rbac.empid = ${userId}
        AND rbac.entity = 'project'
        AND (rbac.entity_id = ${id}::text OR rbac.entity_id = 'all')
        AND rbac.active_flag = true
        AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
        AND 3 = ANY(rbac.permission)
    `);

    if (projectDeleteAccess.length === 0) {
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
        SET active_flag = false, to_ts = NOW(), updated = NOW()
        WHERE id = ${id}
      `);

      return reply.status(204).send();
    } catch (error) {
      fastify.log.error('Error deleting project:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Add singular endpoint aliases for frontend compatibility
  fastify.get('/api/v1/project/:id/task', {
    preHandler: [fastify.authenticate],
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

      // Direct RBAC check for project access
      const projectAccess = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map rbac
        WHERE rbac.empid = ${userId}
          AND rbac.entity = 'project'
          AND (rbac.entity_id = ${projectId}::text OR rbac.entity_id = 'all')
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND 0 = ANY(rbac.permission)
      `);

      if (projectAccess.length === 0) {
        return reply.status(403).send({ error: 'Access denied for this project' });
      }

      // Use d_entity_id_map to find tasks linked to this project
      const conditions = [
        sql`eim.parent_entity_type = 'project'`,
        sql`eim.parent_entity_id = ${projectId}`,
        sql`eim.child_entity_type = 'task'`,
        sql`eim.active_flag = true`,
        sql`t.active_flag = true`
      ];

      if (status) {
        conditions.push(sql`t.stage = ${status}`);
      }

      if (assignee) {
        conditions.push(sql`${assignee}::uuid = ANY(t.assignee_employee_ids)`);
      }

      const tasks = await db.execute(sql`
        SELECT
          t.id, t.slug, t.code, t.name, t.descr, t.tags, t.metadata,
          t.assignee_employee_ids, t.stage, t.priority_level,
          t.estimated_hours, t.actual_hours, t.story_points,
          t.parent_task_id, t.dependency_task_ids,
          t.from_ts, t.to_ts, t.active_flag, t.created_ts, t.updated_ts, t.version,
          eim.relationship_type
        FROM app.d_entity_id_map eim
        INNER JOIN app.d_task t ON t.id::text = eim.child_entity_id
        WHERE ${sql.join(conditions, sql` AND `)}
        ORDER BY t.created_ts DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      // Get total count
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.d_entity_id_map eim
        INNER JOIN app.d_task t ON t.id::text = eim.child_entity_id
        WHERE ${sql.join(conditions, sql` AND `)}
      `);

      return {
        data: tasks,
        total: Number(countResult[0]?.total || 0),
        limit,
        offset
      };
    } catch (error) {
      fastify.log.error('Error fetching project tasks:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.get('/api/v1/project/:id/form', {
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
      const { id: projectId } = request.params as { id: string };
      const { page = 1, limit = 20 } = request.query as any;
      const userId = request.user?.sub;

      if (!userId) {
        return reply.status(401).send({ error: 'User not authenticated' });
      }

      // Direct RBAC check for project access
      const projectAccess = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map rbac
        WHERE rbac.empid = ${userId}
          AND rbac.entity = 'project'
          AND (rbac.entity_id = ${projectId}::text OR rbac.entity_id = 'all')
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND 0 = ANY(rbac.permission)
      `);

      if (projectAccess.length === 0) {
        return reply.status(403).send({ error: 'Access denied for this project' });
      }

      const offset = (page - 1) * limit;
      const forms = await db.execute(sql`
        SELECT f.*, COALESCE(f.name, 'Untitled Form') as name, f.descr
        FROM app.d_form_head f
        INNER JOIN app.d_entity_id_map eim ON eim.child_entity_id = f.id::text
        WHERE eim.parent_entity_id = ${projectId}
          AND eim.parent_entity_type = 'project'
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
        WHERE eim.parent_entity_id = ${projectId}
          AND eim.parent_entity_type = 'project'
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
      fastify.log.error('Error fetching project forms:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.get('/api/v1/project/:id/artifact', {
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
      const { id: projectId } = request.params as { id: string };
      const { page = 1, limit = 20 } = request.query as any;
      const userId = request.user?.sub;

      if (!userId) {
        return reply.status(401).send({ error: 'User not authenticated' });
      }

      // Direct RBAC check for project access
      const projectAccess = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map rbac
        WHERE rbac.empid = ${userId}
          AND rbac.entity = 'project'
          AND (rbac.entity_id = ${projectId}::text OR rbac.entity_id = 'all')
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND 0 = ANY(rbac.permission)
      `);

      if (projectAccess.length === 0) {
        return reply.status(403).send({ error: 'Access denied for this project' });
      }

      const offset = (page - 1) * limit;
      const artifacts = await db.execute(sql`
        SELECT a.*, COALESCE(a.name, 'Untitled Artifact') as name, a.descr
        FROM app.d_artifact a
        INNER JOIN app.d_entity_id_map eim ON eim.child_entity_id = a.id::text
        WHERE eim.parent_entity_id = ${projectId}
          AND eim.parent_entity_type = 'project'
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
        WHERE eim.parent_entity_id = ${projectId}
          AND eim.parent_entity_type = 'project'
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
      fastify.log.error('Error fetching project artifacts:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}