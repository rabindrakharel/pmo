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
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';

// Schema based on actual d_business table structure (operational teams only)
// NOTE: Hierarchy fields (parent_id, dl__business_hierarchy_level, budget, manager) are in d_business_hierarchy
// Use /api/v1/business-hierarchy for organizational hierarchy management
const BizSchema = Type.Object({
  id: Type.String(),
  code: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
  // Operational fields
  office_id: Type.Optional(Type.String()),
  current_headcount: Type.Optional(Type.Number()),
  operational_status: Type.Optional(Type.String()),
  // Temporal audit fields
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.String()),
  active_flag: Type.Boolean(),
  created_ts: Type.String(),
  updated_ts: Type.String(),
  version: Type.Number(),
});

const CreateBizSchema = Type.Object({
  code: Type.Optional(Type.String({ minLength: 1 })),
  name: Type.Optional(Type.String({ minLength: 1 })),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
  // Operational fields
  office_id: Type.Optional(Type.String({ format: 'uuid' })),
  current_headcount: Type.Optional(Type.Number()),
  operational_status: Type.Optional(Type.String()),
  active_flag: Type.Optional(Type.Boolean()),
});

const UpdateBizSchema = Type.Partial(CreateBizSchema);

export async function bizRoutes(fastify: FastifyInstance) {
  // List operational business units with filtering
  fastify.get('/api/v1/biz', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        active_flag: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        operational_status: Type.Optional(Type.String()),
        office_id: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
        page: Type.Optional(Type.Number({ minimum: 1 })),
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
      active_flag, search, operational_status, office_id,
      limit = 20, offset: queryOffset, page
    } = request.query as any;
    const offset = page ? (page - 1) * limit : (queryOffset !== undefined ? queryOffset : 0);
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

      if (operational_status) {
        baseConditions.push(sql`b.operational_status = ${operational_status}`);
      }

      if (office_id) {
        baseConditions.push(sql`b.office_id = ${office_id}::uuid`);
      }

      if (search) {
        const searchTerms = [
          sql`b.name ILIKE ${`%${search}%`}`,
          sql`COALESCE(b."descr", '') ILIKE ${`%${search}%`}`,
          sql`b.code ILIKE ${`%${search}%`}`
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
          b.id, b.code, b.name, b.descr, b.metadata,
          b.office_id, b.current_headcount, b.operational_status,
          b.from_ts, b.to_ts, b.active_flag, b.created_ts, b.updated_ts, b.version
        FROM app.d_business b
        WHERE ${sql.join(baseConditions, sql` AND `)}
        ORDER BY b.name ASC, b.created_ts DESC
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
      console.error('Full error details:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // NOTE: Business hierarchy children endpoint removed
  // Hierarchy relationships are managed through d_business_hierarchy table
  // Use /api/v1/business-hierarchy/:id/children for hierarchy navigation
  // d_business table only contains operational teams without parent-child relationships

  // Get projects within a business unit
  fastify.get('/api/v1/biz/:id/project', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
      querystring: Type.Object({
        active_flag: Type.Optional(Type.Boolean()),
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

      // Use d_entity_id_map to find projects linked to this business
      const conditions = [
        sql`eim.parent_entity_type = 'business'`,
        sql`eim.parent_entity_id = ${bizId}`,
        sql`eim.child_entity_type = 'project'`,
        sql`eim.active_flag = true`
      ];

      if (active_flag !== undefined) {
        conditions.push(sql`p.active_flag = ${active_flag}`);
      }

      const projects = await db.execute(sql`
        SELECT
          p.id, p.code, p.name, p.descr, p.metadata,
          p.dl__project_stage,
          p.budget_allocated_amt, p.budget_spent_amt,
          p.planned_start_date, p.planned_end_date,
          p.actual_start_date, p.actual_end_date,
          p.manager_employee_id, p.sponsor_employee_id, p.stakeholder_employee_ids,
          p.from_ts, p.to_ts, p.active_flag, p.created_ts, p.updated_ts, p.version,
          eim.relationship_type
        FROM app.d_entity_id_map eim
        INNER JOIN app.d_project p ON p.id::text = eim.child_entity_id
        WHERE ${sql.join(conditions, sql` AND `)}
        ORDER BY p.created_ts DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.d_entity_id_map eim
        INNER JOIN app.d_project p ON p.id::text = eim.child_entity_id
        WHERE ${sql.join(conditions, sql` AND `)}
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
      console.error('Full error details:', error);
      return reply.status(500).send({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) });
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

      // Count projects (via entity_id_map as projects don't have direct business_id FK)
      const projectCount = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM app.d_project p
        INNER JOIN app.entity_id_map eim ON eim.child_entity_id = p.id::text
        WHERE eim.parent_entity_id = ${bizId}
          AND eim.parent_entity_type = 'business'
          AND eim.child_entity_type = 'project'
          AND eim.active_flag = true
          AND p.active_flag = true
      `);
      actionSummaries.push({
        actionEntity: 'project',
        count: Number(projectCount[0]?.count || 0),
        label: 'Projects',
        icon: 'FolderOpen'
      });

      // Count tasks (via entity_id_map linkage to projects, then to business)
      const taskCount = await db.execute(sql`
        SELECT COUNT(DISTINCT t.id) as count
        FROM app.d_task t
        INNER JOIN app.entity_id_map eim_task ON eim_task.child_entity_id = t.id::text
        INNER JOIN app.d_project p ON p.id::text = eim_task.parent_entity_id
        INNER JOIN app.entity_id_map eim_proj ON eim_proj.child_entity_id = p.id::text
        WHERE eim_proj.parent_entity_id = ${bizId}
          AND eim_proj.parent_entity_type = 'business'
          AND eim_proj.child_entity_type = 'project'
          AND eim_task.parent_entity_type = 'project'
          AND eim_task.child_entity_type = 'task'
          AND eim_task.active_flag = true
          AND eim_proj.active_flag = true
          AND t.active_flag = true
      `);
      actionSummaries.push({
        actionEntity: 'task',
        count: Number(taskCount[0]?.count || 0),
        label: 'Tasks',
        icon: 'CheckSquare'
      });

      // Count artifacts (via entity_id_map linkage to business)
      const artifactCount = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM app.d_artifact a
        INNER JOIN app.entity_id_map eim ON eim.child_entity_id = a.id::text
        WHERE eim.parent_entity_id = ${bizId}
          AND eim.parent_entity_type = 'business'
          AND eim.child_entity_type = 'artifact'
          AND eim.active_flag = true
          AND a.active_flag = true
      `);
      actionSummaries.push({
        actionEntity: 'artifact',
        count: Number(artifactCount[0]?.count || 0),
        label: 'Artifacts',
        icon: 'FileText'
      });

      // Count wiki entries (via entity_id_map linkage to business)
      const wikiCount = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM app.d_wiki w
        INNER JOIN app.entity_id_map eim ON eim.child_entity_id = w.id::text
        WHERE eim.parent_entity_id = ${bizId}
          AND eim.parent_entity_type = 'business'
          AND eim.child_entity_type = 'wiki'
          AND eim.active_flag = true
          AND w.active_flag = true
      `);
      actionSummaries.push({
        actionEntity: 'wiki',
        count: Number(wikiCount[0]?.count || 0),
        label: 'Wiki',
        icon: 'BookOpen'
      });

      // Count forms (forms are standalone, use entity_id_map table to link)
      // For now, we'll count forms as 0 until proper entity mapping is added
      actionSummaries.push({
        actionEntity: 'form',
        count: 0,
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
          id, name, descr, metadata, parent_id, dl__business_level,
          code, from_ts, to_ts, active_flag, created_ts, updated_ts, version,
          office_id, budget_allocated_amt, manager_employee_id
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
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateBizSchema,
      response: {
        // Removed schema validation - let Fastify serialize naturally
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

    // Auto-generate required fields if missing
    if (!data.name) data.name = 'Untitled Business Unit';
    if (!data.code) data.code = `BIZ-${Date.now()}`;
    if (!data.operational_status) data.operational_status = 'Active'; // Default status

    try {
      // Check for unique code if provided
      if (data.code) {
        const existingCode = await db.execute(sql`
          SELECT id FROM app.d_business WHERE code = ${data.code} AND active_flag = true
        `);
        if (existingCode.length > 0) {
          return reply.status(400).send({ error: 'Business unit with this code already exists' });
        }
      }

      // Validate office exists if office_id is provided
      if (data.office_id) {
        const officeExists = await db.execute(sql`
          SELECT id FROM app.d_office WHERE id = ${data.office_id} AND active_flag = true
        `);
        if (officeExists.length === 0) {
          return reply.status(400).send({ error: 'Office not found' });
        }
      }

      const result = await db.execute(sql`
        INSERT INTO app.d_business (
          name, descr, code, office_id, current_headcount, operational_status,
          metadata, active_flag
        )
        VALUES (
          ${data.name},
          ${data.descr || null},
          ${data.code || null},
          ${data.office_id || null},
          ${data.current_headcount || 0},
          ${data.operational_status || 'Active'},
          ${data.metadata ? JSON.stringify(data.metadata) : '{}'}::jsonb,
          ${data.active_flag !== false}
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
      if (data.descr !== undefined) updateFields.push(sql`descr = ${data.descr}`);
      if (data.code !== undefined) updateFields.push(sql`code = ${data.code}`);
      if (data.office_id !== undefined) updateFields.push(sql`office_id = ${data.office_id}`);
      if (data.current_headcount !== undefined) updateFields.push(sql`current_headcount = ${data.current_headcount}`);
      if (data.operational_status !== undefined) updateFields.push(sql`operational_status = ${data.operational_status}`);
      if (data.metadata !== undefined) updateFields.push(sql`metadata = ${JSON.stringify(data.metadata)}::jsonb`);
      if (data.active_flag !== undefined) updateFields.push(sql`active_flag = ${data.active_flag}`);

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

  // Delete business unit with cascading cleanup (soft delete)
  // Uses universal delete factory pattern - deletes from:
  // 1. app.d_business (base entity table)
  // 2. app.d_entity_instance_id (entity registry)
  // 3. app.d_entity_id_map (linkages in both directions)
  createEntityDeleteEndpoint(fastify, 'biz');
}