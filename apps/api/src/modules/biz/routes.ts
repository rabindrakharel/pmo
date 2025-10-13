import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import {
  getUniversalColumnMetadata,
  filterUniversalColumns,
  getColumnsByMetadata
} from '../../lib/universal-schema-metadata.js';
import {
  hasPermissionOnEntityId,
  hasCreatePermissionForEntityType
} from '../rbac/entity-permission-rbac-gate.js';

// Schema based on actual d_business table structure
const BizSchema = Type.Object({
  id: Type.String(),
  slug: Type.String(),
  code: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Array(Type.String())),
  parent_id: Type.Optional(Type.String()),
  level_id: Type.Number(),
  level_name: Type.String(),
  office_id: Type.Optional(Type.String()),
  budget_allocated: Type.Optional(Type.Number()),
  manager_employee_id: Type.Optional(Type.String()),
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.String()),
  active_flag: Type.Boolean(),
  created_ts: Type.String(),
  updated_ts: Type.String(),
  version: Type.Number(),
});

const CreateBizSchema = Type.Object({
  slug: Type.String({ minLength: 1 }),
  code: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Array(Type.String())),
  parent_id: Type.Optional(Type.String({ format: 'uuid' })),
  level_id: Type.Number({ minimum: 0 }),
  level_name: Type.String({ minLength: 1 }),
  office_id: Type.Optional(Type.String({ format: 'uuid' })),
  budget_allocated: Type.Optional(Type.Number()),
  manager_employee_id: Type.Optional(Type.String({ format: 'uuid' })),
  active_flag: Type.Optional(Type.Boolean()),
});

const UpdateBizSchema = Type.Partial(CreateBizSchema);

export async function bizRoutes(fastify: FastifyInstance) {
  // List business units with filtering and hierarchy support
  fastify.get('/api/v1/biz', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        active_flag: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        level_id: Type.Optional(Type.Number()),
        parent_id: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(BizSchema),
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
      active_flag, search, level_id, parent_id,
      limit = 50, offset = 0
    } = request.query as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Direct RBAC filtering - only show biz units user has access to
      const baseConditions = [
        sql`(
          EXISTS (
            SELECT 1 FROM app.entity_id_rbac_map rbac
            WHERE rbac.empid = ${userId}::uuid
              AND rbac.entity = 'biz'
              AND (rbac.entity_id = b.id::text OR rbac.entity_id = 'all')
              AND rbac.active_flag = true
              AND 0 = ANY(rbac.permission)
          )
        )`
      ];

      if (active_flag !== undefined) {
        baseConditions.push(sql`b.active_flag = ${active_flag}`);
      }

      if (level_id !== undefined) {
        baseConditions.push(sql`b.level_id = ${level_id}`);
      }

      if (parent_id) {
        baseConditions.push(sql`b.parent_id = ${parent_id}::uuid`);
      }

      if (search) {
        const searchTerms = [
          sql`b.name ILIKE ${`%${search}%`}`,
          sql`COALESCE(b."descr", '') ILIKE ${`%${search}%`}`,
          sql`b.code ILIKE ${`%${search}%`}`,
          sql`b.slug ILIKE ${`%${search}%`}`
        ];
        baseConditions.push(sql`(${sql.join(searchTerms, sql` OR `)})`);
      }

      const countResult = await db.execute(sql`
        SELECT COUNT(DISTINCT b.id) as total
        FROM app.d_business b
        WHERE ${sql.join(baseConditions, sql` AND `)}
      `);
      const total = Number(countResult[0]?.total || 0);

      const bizUnits = await db.execute(sql`
        SELECT
          b.id, b.slug, b.code, b.name, b.descr, b.tags, b.parent_id,
          b.level_id, b.level_name, b.office_id, b.budget_allocated, b.manager_employee_id,
          b.from_ts, b.to_ts, b.active_flag, b.created_ts, b.updated_ts, b.version
        FROM app.d_business b
        WHERE ${sql.join(baseConditions, sql` AND `)}
        ORDER BY b.level_id ASC, b.name ASC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
        canSeeSafetyInfo: true,
      };
      
      const filteredData = bizUnits.map(biz => 
        filterUniversalColumns(biz, userPermissions)
      );

      return {
        data: filteredData,
        total,
        limit,
        offset,
      };
    } catch (error) {
      fastify.log.error('Error fetching business units:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get business unit hierarchy children
  fastify.get('/api/v1/biz/:id/children', {
    
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
      querystring: Type.Object({
        active: Type.Optional(Type.Boolean()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
      }),
    },
  }, async function (request, reply) {
    try {
      const { id: parentId } = request.params as { id: string };
      const { active_flag = true, limit = 50, offset = 0 } = request.query as any;
      const userId = request.user?.sub;

      if (!userId) {
        return reply.status(401).send({ error: 'User not authenticated' });
      }

      // Check if user has access to parent business unit
      const hasAccess = await hasPermissionOnEntityId(userId, 'biz', parentId, 'view');
      if (!hasAccess) {
        return reply.status(403).send({ error: 'Access denied for this business unit' });
      }

      const conditions = [sql`parent_id = ${parentId}`];
      if (active !== undefined) {
        conditions.push(sql`active_flag = ${active}`);
      }

      const children = await db.execute(sql`
        SELECT 
          id, name, "descr", level_id, level_name, is_leaf_level, is_root_level,
          biz_unit_type, profit_center, cost_center_code, created, updated
        FROM app.d_business
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY level_id ASC, name ASC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total 
        FROM app.d_business
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);

      return {
        data: children,
        total: Number(countResult[0]?.total || 0),
        limit,
        offset,
        parent_id: parentId,
      };
    } catch (error) {
      fastify.log.error('Error fetching business unit children:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get projects within a business unit
  fastify.get('/api/v1/biz/:id/project', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
      querystring: Type.Object({
        active: Type.Optional(Type.Boolean()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
      }),
    },
  }, async function (request, reply) {
    try {
      const { id: bizId } = request.params as { id: string };
      const { active_flag = true, limit = 50, offset = 0 } = request.query as any;
      const userId = request.user?.sub;

      if (!userId) {
        return reply.status(401).send({ error: 'User not authenticated' });
      }

      // Check if user has access to this business unit
      const hasAccess = await hasPermissionOnEntityId(userId, 'biz', bizId, 'view');
      if (!hasAccess) {
        return reply.status(403).send({ error: 'Access denied for this business unit' });
      }

      const conditions = [sql`business_id = ${bizId}`];
      if (active !== undefined) {
        conditions.push(sql`active_flag = ${active}`);
      }

      const projects = await db.execute(sql`
        SELECT
          id, name, "descr", project_type, priority_level, project_status, project_stage,
          planned_start_date, planned_end_date, budget_allocated, budget_currency,
          created, updated
        FROM app.d_project
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY created DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.d_project
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);

      return {
        data: projects,
        total: Number(countResult[0]?.total || 0),
        limit,
        offset,
        business_id: bizId,
      };
    } catch (error) {
      fastify.log.error('Error fetching business unit projects:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get tasks within a business unit
  fastify.get('/api/v1/biz/:id/task', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
      querystring: Type.Object({
        active: Type.Optional(Type.Boolean()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
      }),
    },
  }, async function (request, reply) {
    try {
      const { id: bizId } = request.params as { id: string };
      const { active_flag = true, limit = 50, offset = 0 } = request.query as any;
      const userId = request.user?.sub;

      if (!userId) {
        return reply.status(401).send({ error: 'User not authenticated' });
      }

      // Check if user has access to this business unit
      const hasAccess = await hasPermissionOnEntityId(userId, 'biz', bizId, 'view');
      if (!hasAccess) {
        return reply.status(403).send({ error: 'Access denied for this business unit' });
      }

      // Get tasks associated with business unit (via projects)
      const conditions = [];
      if (active !== undefined) {
        conditions.push(sql`t.active_flag = ${active}`);
      }

      const tasks = await db.execute(sql`
        SELECT DISTINCT
          t.id, t.name, t."descr", t.task_type, t.priority_level, t.task_status, t.task_stage,
          t.planned_start_date, t.planned_end_date, t.estimated_hours, t.actual_hours,
          t.created, t.updated, t.project_id,
          p.name as project_name
        FROM app.d_task t
        INNER JOIN app.d_project p ON t.project_id = p.id
        WHERE p.business_id = ${bizId}
        ${conditions.length > 0 ? sql`AND ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY t.created DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const countResult = await db.execute(sql`
        SELECT COUNT(DISTINCT t.id) as total
        FROM app.d_task t
        INNER JOIN app.d_project p ON t.project_id = p.id
        WHERE p.business_id = ${bizId}
        ${conditions.length > 0 ? sql`AND ${sql.join(conditions, sql` AND `)}` : sql``}
      `);

      return {
        data: tasks,
        total: Number(countResult[0]?.total || 0),
        limit,
        offset,
        business_id: bizId,
      };
    } catch (error) {
      fastify.log.error('Error fetching business unit tasks:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get forms within a business unit
  fastify.get('/api/v1/biz/:id/form', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
      querystring: Type.Object({
        active: Type.Optional(Type.Boolean()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
      }),
    },
  }, async function (request, reply) {
    try {
      const { id: bizId } = request.params as { id: string };
      const { active_flag = true, limit = 50, offset = 0 } = request.query as any;
      const userId = request.user?.sub;

      if (!userId) {
        return reply.status(401).send({ error: 'User not authenticated' });
      }

      // Check if user has access to this business unit
      const hasAccess = await hasPermissionOnEntityId(userId, 'biz', bizId, 'view');
      if (!hasAccess) {
        return reply.status(403).send({ error: 'Access denied for this business unit' });
      }

      const conditions = [];
      if (active !== undefined) {
        conditions.push(sql`f.active_flag = ${active}`);
      }

      const forms = await db.execute(sql`
        SELECT DISTINCT
          f.id, f.name, f."descr", f.form_type, f.form_status, f.form_category,
          f.created, f.updated, f.form_schema, f.form_ui_schema
        FROM app.ops_formlog_head f
        INNER JOIN app.d_project p ON f.project_id = p.id
        WHERE p.business_id = ${bizId}
        ${conditions.length > 0 ? sql`AND ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY f.created DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const countResult = await db.execute(sql`
        SELECT COUNT(DISTINCT f.id) as total
        FROM app.ops_formlog_head f
        INNER JOIN app.d_project p ON f.project_id = p.id
        WHERE p.business_id = ${bizId}
        ${conditions.length > 0 ? sql`AND ${sql.join(conditions, sql` AND `)}` : sql``}
      `);

      return {
        data: forms,
        total: Number(countResult[0]?.total || 0),
        limit,
        offset,
        business_id: bizId,
      };
    } catch (error) {
      fastify.log.error('Error fetching business unit forms:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get artifacts within a business unit
  fastify.get('/api/v1/biz/:id/artifact', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
      querystring: Type.Object({
        active: Type.Optional(Type.Boolean()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
      }),
    },
  }, async function (request, reply) {
    try {
      const { id: bizId } = request.params as { id: string };
      const { active_flag = true, limit = 50, offset = 0 } = request.query as any;
      const userId = request.user?.sub;

      if (!userId) {
        return reply.status(401).send({ error: 'User not authenticated' });
      }

      // Check if user has access to this business unit
      const hasAccess = await hasPermissionOnEntityId(userId, 'biz', bizId, 'view');
      if (!hasAccess) {
        return reply.status(403).send({ error: 'Access denied for this business unit' });
      }

      const conditions = [sql`business_id = ${bizId}`];
      if (active !== undefined) {
        conditions.push(sql`active_flag = ${active}`);
      }

      const artifacts = await db.execute(sql`
        SELECT
          id, name, "descr", artifact_type, file_name, file_size, mime_type,
          storage_url, version_number, is_current_version,
          created, updated
        FROM app.d_artifact
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY created DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.d_artifact
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);

      return {
        data: artifacts,
        total: Number(countResult[0]?.total || 0),
        limit,
        offset,
        business_id: bizId,
      };
    } catch (error) {
      fastify.log.error('Error fetching business unit artifacts:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get wiki pages within a business unit
  fastify.get('/api/v1/biz/:id/wiki', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
      querystring: Type.Object({
        active: Type.Optional(Type.Boolean()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
      }),
    },
  }, async function (request, reply) {
    try {
      const { id: bizId } = request.params as { id: string };
      const { active_flag = true, limit = 50, offset = 0 } = request.query as any;
      const userId = request.user?.sub;

      if (!userId) {
        return reply.status(401).send({ error: 'User not authenticated' });
      }

      // Check if user has access to this business unit
      const hasAccess = await hasPermissionOnEntityId(userId, 'biz', bizId, 'view');
      if (!hasAccess) {
        return reply.status(403).send({ error: 'Access denied for this business unit' });
      }

      const conditions = [sql`business_id = ${bizId}`];
      if (active !== undefined) {
        conditions.push(sql`active_flag = ${active}`);
      }

      const wikis = await db.execute(sql`
        SELECT
          id, title, slug, content_preview, wiki_category, wiki_status,
          tags, is_published, view_count,
          created, updated, author_id
        FROM app.d_wiki
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY created DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.d_wiki
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);

      return {
        data: wikis,
        total: Number(countResult[0]?.total || 0),
        limit,
        offset,
        business_id: bizId,
      };
    } catch (error) {
      fastify.log.error('Error fetching business unit wiki pages:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get business dynamic child entity tabs - for tab navigation
  fastify.get('/api/v1/biz/:id/dynamic-child-entity-tabs', {
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
          business_id: Type.String()
        }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async function (request, reply) {
    try {
      const { id: bizId } = request.params as { id: string };
      const userId = request.user?.sub;

      if (!userId) {
        return reply.status(401).send({ error: 'User not authenticated' });
      }

      // Check if user has access to this business unit
      const hasAccess = await hasPermissionOnEntityId(userId, 'biz', bizId, 'view');
      if (!hasAccess) {
        return reply.status(403).send({ error: 'Access denied for this business unit' });
      }

      // Check if business unit exists
      const biz = await db.execute(sql`
        SELECT id FROM app.d_business WHERE id = ${bizId} AND active_flag = true
      `);

      if (biz.length === 0) {
        return reply.status(404).send({ error: 'Business unit not found' });
      }

      // Get action summaries for this business unit
      const actionSummaries = [];

      // Count projects
      const projectCount = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM app.d_project p
        WHERE p.business_id = ${bizId} AND p.active_flag = true
      `);
      actionSummaries.push({
        actionEntity: 'project',
        count: Number(projectCount[0]?.count || 0),
        label: 'Projects',
        icon: 'FolderOpen'
      });

      // Count tasks (via projects)
      const taskCount = await db.execute(sql`
        SELECT COUNT(DISTINCT t.id) as count
        FROM app.d_task t
        INNER JOIN app.d_project p ON t.project_id = p.id
        WHERE p.business_id = ${bizId} AND t.active_flag = true
      `);
      actionSummaries.push({
        actionEntity: 'task',
        count: Number(taskCount[0]?.count || 0),
        label: 'Tasks',
        icon: 'CheckSquare'
      });

      // Count artifacts (via projects)
      const artifactCount = await db.execute(sql`
        SELECT COUNT(DISTINCT a.id) as count
        FROM app.d_artifact a
        INNER JOIN app.d_project p ON a.project_id = p.id
        WHERE p.business_id = ${bizId} AND a.active_flag = true
      `);
      actionSummaries.push({
        actionEntity: 'artifact',
        count: Number(artifactCount[0]?.count || 0),
        label: 'Artifacts',
        icon: 'FileText'
      });

      // Count wiki entries (via projects)
      const wikiCount = await db.execute(sql`
        SELECT COUNT(DISTINCT w.id) as count
        FROM app.d_wiki w
        INNER JOIN app.d_project p ON w.project_id = p.id
        WHERE p.business_id = ${bizId} AND w.active_flag = true
      `);
      actionSummaries.push({
        actionEntity: 'wiki',
        count: Number(wikiCount[0]?.count || 0),
        label: 'Wiki',
        icon: 'BookOpen'
      });

      // Count forms (via projects)
      const formCount = await db.execute(sql`
        SELECT COUNT(DISTINCT f.id) as count
        FROM app.ops_formlog_head f
        INNER JOIN app.d_project p ON f.project_id = p.id
        WHERE p.business_id = ${bizId} AND f.active_flag = true
      `);
      actionSummaries.push({
        actionEntity: 'form',
        count: Number(formCount[0]?.count || 0),
        label: 'Forms',
        icon: 'FileText'
      });

      return {
        action_entities: actionSummaries,
        business_id: bizId
      };
    } catch (error) {
      fastify.log.error('Error fetching business action summaries:', error);
      console.error('Full error details:', error);
      return reply.status(500).send({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Get creatable entity types within a business unit
  fastify.get('/api/v1/biz/:id/creatable', {

    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
    },
  }, async function (request, reply) {
    try {
      const { id: bizId } = request.params as { id: string };
      const userId = request.user?.sub;

      if (!userId) {
        return reply.status(401).send({ error: 'User not authenticated' });
      }

      // Check if user has access to this business unit
      const hasAccess = await hasPermissionOnEntityId(userId, 'biz', bizId, 'view');
      if (!hasAccess) {
        return reply.status(403).send({ error: 'Access denied for this business unit' });
      }

      // Get entity types that can be created under a business unit
      const creatableTypes = [];

      // Check permissions for each entity type
      const entityTypes = ['project', 'task', 'artifact', 'wiki', 'form'];
      for (const entityType of entityTypes) {
        const canCreate = await hasCreatePermissionForEntityType(userId, entityType);
        if (canCreate) {
          creatableTypes.push({
            entity_type: entityType,
            label: entityType.charAt(0).toUpperCase() + entityType.slice(1),
            icon: entityType === 'project' ? 'FolderOpen' :
                  entityType === 'task' ? 'CheckSquare' :
                  entityType === 'artifact' ? 'FileText' :
                  entityType === 'wiki' ? 'BookOpen' : 'FileText'
          });
        }
      }

      return {
        business_id: bizId,
        creatable_entity_types: creatableTypes,
      };
    } catch (error) {
      fastify.log.error('Error fetching creatable entity types:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single business unit
  fastify.get('/api/v1/biz/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: BizSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    // Check if employee has permission to view this specific business unit
    const hasViewAccess = await hasPermissionOnEntityId(userId, 'biz', id, 'view');
    if (!hasViewAccess) {
      return reply.status(403).send({ error: 'Insufficient permissions to view this business unit' });
    }

    try {
      const bizUnit = await db.execute(sql`
        SELECT
          id, name, descr, tags, parent_id, level_id, level_name,
          slug, code, from_ts, to_ts, active_flag, created_ts, updated_ts, version,
          office_id, budget_allocated, manager_employee_id
        FROM app.d_business
        WHERE id = ${id}
      `);

      if (bizUnit.length === 0) {
        return reply.status(404).send({ error: 'Business unit not found' });
      }

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
        canSeeSafetyInfo: true,
      };
      
      return filterUniversalColumns(bizUnit[0], userPermissions);
    } catch (error) {
      fastify.log.error('Error fetching business unit:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create business unit
  fastify.post('/api/v1/biz', {
    
    schema: {
      body: CreateBizSchema,
      response: {
        201: BizSchema,
        403: Type.Object({ error: Type.String() }),
        400: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const data = request.body as any;
    const userId = request.user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // If creating under a parent, check create permissions
      if (data.parent_id) {
        const hasCreateAccess = await hasCreatePermissionForEntityType(userId, 'biz');
        if (!hasCreateAccess) {
          return reply.status(403).send({ error: 'Insufficient permissions to create business unit under this parent' });
        }
      }

      // Check for unique code if provided
      if (data.code) {
        const existingCode = await db.execute(sql`
          SELECT id FROM app.d_business WHERE code = ${data.code} AND active_flag = true
        `);
        if (existingCode.length > 0) {
          return reply.status(400).send({ error: 'Business unit with this code already exists' });
        }
      }

      // Check for unique slug if provided
      if (data.slug) {
        const existingSlug = await db.execute(sql`
          SELECT id FROM app.d_business WHERE slug = ${data.slug} AND active_flag = true
        `);
        if (existingSlug.length > 0) {
          return reply.status(400).send({ error: 'Business unit with this slug already exists' });
        }
      }

      // Validate parent exists if parent_id is provided
      if (data.parent_id) {
        const parentExists = await db.execute(sql`
          SELECT id FROM app.d_business WHERE id = ${data.parent_id} AND active_flag = true
        `);
        if (parentExists.length === 0) {
          return reply.status(400).send({ error: 'Parent business unit not found' });
        }
      }

      // Determine hierarchy flags
      const is_root_level = !data.parent_id;
      const is_leaf_level = false; // Will be updated based on actual hierarchy rules

      const result = await db.execute(sql`
        INSERT INTO app.d_business (
          name, "descr", slug, code, level_id, level_name, is_leaf_level, is_root_level, parent_id,
          cost_center_code, biz_unit_type, profit_center, tags, attr, active
        )
        VALUES (
          ${data.name}, 
          ${data.descr || null},
          ${data.slug || null}, 
          ${data.code || null}, 
          ${data.level_id}, 
          ${data.level_name},
          ${is_leaf_level},
          ${is_root_level},
          ${data.parent_id || null},
          ${data.cost_center_code || null}, 
          ${data.biz_unit_type || 'operational'}, 
          ${data.profit_center !== false},
          ${data.tags ? JSON.stringify(data.tags) : '[]'}::jsonb,
          ${data.attr ? JSON.stringify(data.attr) : '{}'}::jsonb,
          ${data.active !== false}
        )
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to create business unit' });
      }

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
        canSeeSafetyInfo: true,
      };
      
      return reply.status(201).send(filterUniversalColumns(result[0], userPermissions));
    } catch (error) {
      fastify.log.error('Error creating business unit:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update business unit
  fastify.put('/api/v1/biz/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      body: UpdateBizSchema,
      response: {
        200: BizSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const userId = request.user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    // Check if employee has permission to modify this specific business unit
    const hasModifyAccess = await hasPermissionOnEntityId(userId, 'biz', id, 'edit');
    if (!hasModifyAccess) {
      return reply.status(403).send({ error: 'Insufficient permissions to modify this business unit' });
    }

    try {
      const existing = await db.execute(sql`
        SELECT id FROM app.d_business WHERE id = ${id}
      `);
      
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Business unit not found' });
      }

      const updateFields = [];
      
      if (data.name !== undefined) updateFields.push(sql`name = ${data.name}`);
      if (data.descr !== undefined) updateFields.push(sql`"descr" = ${data.descr}`);
      if (data.slug !== undefined) updateFields.push(sql`slug = ${data.slug}`);
      if (data.code !== undefined) updateFields.push(sql`code = ${data.code}`);
      if (data.level_id !== undefined) updateFields.push(sql`level_id = ${data.level_id}`);
      if (data.level_name !== undefined) updateFields.push(sql`level_name = ${data.level_name}`);
      if (data.parent_id !== undefined) updateFields.push(sql`parent_id = ${data.parent_id}`);
      if (data.cost_center_code !== undefined) updateFields.push(sql`cost_center_code = ${data.cost_center_code}`);
      if (data.biz_unit_type !== undefined) updateFields.push(sql`biz_unit_type = ${data.biz_unit_type}`);
      if (data.profit_center !== undefined) updateFields.push(sql`profit_center = ${data.profit_center}`);
      if (data.tags !== undefined) updateFields.push(sql`tags = ${JSON.stringify(data.tags)}::jsonb`);
      if (data.attr !== undefined) updateFields.push(sql`attr = ${JSON.stringify(data.attr)}::jsonb`);
      if (data.active !== undefined) updateFields.push(sql`active_flag = ${data.active}`);

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated_ts = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.d_business
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to update business unit' });
      }

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
        canSeeSafetyInfo: true,
      };
      
      return filterUniversalColumns(result[0], userPermissions);
    } catch (error) {
      fastify.log.error('Error updating business unit:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete business unit (soft delete)
  fastify.delete('/api/v1/biz/:id', {
    
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
    const userId = request.user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    // Check if employee has permission to delete this specific business unit
    const hasDeleteAccess = await hasPermissionOnEntityId(userId, 'biz', id, 'delete');
    if (!hasDeleteAccess) {
      return reply.status(403).send({ error: 'Insufficient permissions to delete this business unit' });
    }

    try {
      const existing = await db.execute(sql`
        SELECT id FROM app.d_business WHERE id = ${id}
      `);
      
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Business unit not found' });
      }

      // Soft delete (using SCD Type 2 pattern)
      await db.execute(sql`
        UPDATE app.d_business
        SET active_flag = false, to_ts = NOW(), updated_ts = NOW()
        WHERE id = ${id}
      `);

      return reply.status(204).send();
    } catch (error) {
      fastify.log.error('Error deleting business unit:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}