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
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';
import { createChildEntityEndpoint } from '../../lib/child-entity-route-factory.js';

// Schema based on actual d_project table structure from db/XV_d_project.ddl
const ProjectSchema = Type.Object({
  id: Type.String(),
  code: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
  // Project fields
  project_stage: Type.Optional(Type.String()),
  budget_allocated_amt: Type.Optional(Type.Number()),
  budget_spent_amt: Type.Optional(Type.Number()),
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
  name: Type.Optional(Type.String({ minLength: 1 })),
  slug: Type.Optional(Type.String({ minLength: 1 })),
  code: Type.Optional(Type.String({ minLength: 1 })),
  descr: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Union([Type.Array(Type.String()), Type.String()])),
  metadata: Type.Optional(Type.Union([Type.Object({}), Type.String()])),
  business_id: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
  office_id: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
  project_stage: Type.Optional(Type.String()),
  budget_allocated: Type.Optional(Type.Number()),
  budget_spent: Type.Optional(Type.Number()),
  planned_start_date: Type.Optional(Type.Union([Type.String({ format: 'date' }), Type.Null()])),
  planned_end_date: Type.Optional(Type.Union([Type.String({ format: 'date' }), Type.Null()])),
  actual_start_date: Type.Optional(Type.Union([Type.String({ format: 'date' }), Type.Null()])),
  actual_end_date: Type.Optional(Type.Union([Type.String({ format: 'date' }), Type.Null()])),
  manager_employee_id: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
  sponsor_employee_id: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
  stakeholder_employee_ids: Type.Optional(Type.Union([Type.Array(Type.String({ format: 'uuid' })), Type.Null()])),
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
          p.code ILIKE ${`%${search}%`}
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
          p.id, p.code, p.name, p.descr, p.metadata,
          p.project_stage,
          p.budget_allocated_amt, p.budget_spent_amt,
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
      console.error('Full error details:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // DEPRECATED: Old manual endpoints (replaced by factory pattern below)
  // These plural endpoints (/tasks, /forms, /artifacts) can be removed
  // Frontend now uses singular endpoints (/task, /form, /artifact)

  /* COMMENTED OUT - Using factory pattern instead
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
  }); */

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

  /* COMMENTED OUT - Using factory pattern instead
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
  }); */

  /* COMMENTED OUT - Using factory pattern instead
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
  }); */

  /* COMMENTED OUT - Using factory pattern instead
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
  }); */

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
          id, code, name, descr, metadata,
          project_stage,
          budget_allocated_amt, budget_spent_amt,
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
        // Removed schema validation - let Fastify serialize naturally
        403: Type.Object({ error: Type.String() }),
        400: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const data = request.body as any;

    // Auto-generate required fields if missing
    if (!data.name) data.name = 'Untitled';
    if (!data.slug) data.slug = `project-${Date.now()}`;
    if (!data.code) data.code = `PROJECT-${Date.now()}`;

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
          code, name, descr, metadata,
          project_stage,
          budget_allocated_amt, budget_spent_amt,
          planned_start_date, planned_end_date, actual_start_date, actual_end_date,
          manager_employee_id, sponsor_employee_id, stakeholder_employee_ids,
          active_flag
        )
        VALUES (
          ${data.code || data.project_code || `PROJ-${Date.now()}`},
          ${data.name || 'Untitled Project'},
          ${data.descr || null},
          ${data.metadata || data.attr ? JSON.stringify(data.metadata || data.attr || {}) : '{}'}::jsonb,
          ${data.project_stage || null},
          ${data.budget_allocated || data.budget_allocated_amt || null},
          ${data.budget_spent || data.budget_spent_amt || 0},
          ${data.planned_start_date || null},
          ${data.planned_end_date || null},
          ${data.actual_start_date || null},
          ${data.actual_end_date || null},
          ${data.manager_employee_id || null},
          ${data.sponsor_employee_id || null},
          ${data.stakeholder_employee_ids && data.stakeholder_employee_ids.length > 0 ? `{${data.stakeholder_employee_ids.join(',')}}` : '{}'}::uuid[],
          ${data.active_flag !== false && data.active !== false}
        )
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to create project' });
      }

      const newProject = result[0] as any;

      // Register the project in d_entity_instance_id for global entity operations
      await db.execute(sql`
        INSERT INTO app.d_entity_instance_id (entity_type, entity_id, entity_name, entity_slug, entity_code)
        VALUES ('project', ${newProject.id}::uuid, ${newProject.name}, ${newProject.slug}, ${newProject.code})
        ON CONFLICT (entity_type, entity_id) DO UPDATE
        SET entity_name = EXCLUDED.entity_name,
            entity_slug = EXCLUDED.entity_slug,
            entity_code = EXCLUDED.entity_code,
            updated_ts = NOW()
      `);

      const userPermissions = {
        canSeePII: true, // Creator can see their data
        canSeeFinancial: true,
        canSeeSystemFields: true,
        canSeeSafetyInfo: true,
      };

      return reply.status(201).send(filterUniversalColumns(newProject, userPermissions));
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

      // Core fields matching d_project schema
      if (data.name !== undefined) updateFields.push(sql`name = ${data.name}`);
      if (data.descr !== undefined) updateFields.push(sql`descr = ${data.descr}`);
      if (data.code !== undefined) updateFields.push(sql`code = ${data.code}`);
      if (data.metadata !== undefined) updateFields.push(sql`metadata = ${JSON.stringify(data.metadata)}::jsonb`);

      // Project fields
      if (data.project_stage !== undefined) updateFields.push(sql`project_stage = ${data.project_stage}`);
      if (data.budget_allocated !== undefined || data.budget_allocated_amt !== undefined) {
        updateFields.push(sql`budget_allocated_amt = ${data.budget_allocated_amt || data.budget_allocated}`);
      }
      if (data.budget_spent !== undefined || data.budget_spent_amt !== undefined) {
        updateFields.push(sql`budget_spent_amt = ${data.budget_spent_amt || data.budget_spent}`);
      }
      if (data.planned_start_date !== undefined) updateFields.push(sql`planned_start_date = ${data.planned_start_date}`);
      if (data.planned_end_date !== undefined) updateFields.push(sql`planned_end_date = ${data.planned_end_date}`);
      if (data.actual_start_date !== undefined) updateFields.push(sql`actual_start_date = ${data.actual_start_date}`);
      if (data.actual_end_date !== undefined) updateFields.push(sql`actual_end_date = ${data.actual_end_date}`);

      // Team fields
      if (data.manager_employee_id !== undefined) updateFields.push(sql`manager_employee_id = ${data.manager_employee_id}`);
      if (data.sponsor_employee_id !== undefined) updateFields.push(sql`sponsor_employee_id = ${data.sponsor_employee_id}`);
      if (data.stakeholder_employee_ids !== undefined) {
        const stakeholderArray = data.stakeholder_employee_ids && data.stakeholder_employee_ids.length > 0
          ? `{${data.stakeholder_employee_ids.join(',')}}`
          : '{}';
        updateFields.push(sql`stakeholder_employee_ids = ${stakeholderArray}::uuid[]`);
      }

      // Temporal fields
      if (data.active_flag !== undefined) updateFields.push(sql`active_flag = ${data.active_flag}`);

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated_ts = NOW()`);

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

  // Delete project with cascading cleanup (soft delete)
  // Uses universal delete factory pattern - deletes from:
  // 1. app.d_project (base entity table)
  // 2. app.d_entity_instance_id (entity registry)
  // 3. app.d_entity_id_map (linkages in both directions)
  createEntityDeleteEndpoint(fastify, 'project');

  // ========================================
  // CHILD ENTITY ENDPOINTS (DRY Factory Pattern)
  // ========================================
  // Use factory pattern to create standardized child entity endpoints
  // Replaces manual endpoints above (which are now deprecated)
  // These create singular endpoints: /api/v1/project/:id/task (not /tasks)
  createChildEntityEndpoint(fastify, 'project', 'task', 'd_task');
  createChildEntityEndpoint(fastify, 'project', 'wiki', 'd_wiki');
  createChildEntityEndpoint(fastify, 'project', 'form', 'd_form_head');
  createChildEntityEndpoint(fastify, 'project', 'artifact', 'd_artifact');

  // Note: The manual endpoints above (lines 173-625, 944-1032) can be removed
  // after confirming frontend uses singular endpoints (/task not /tasks)

  // DEPRECATED: Old manual singular endpoint (replaced by factory above)
  /* fastify.get('/api/v1/project/:id/task', {
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
  }); */

  // ========================================
  // CHILD ENTITY CREATION
  // ========================================
  // Child entities (task, wiki, form, artifact) are created using:
  // 1. Universal entity create endpoint: POST /api/v1/:childType
  // 2. Linkage API: POST /api/v1/linkage to link child to parent
  // 3. Navigate to child detail page for editing
  // No special endpoints needed - reuses existing universal APIs
}