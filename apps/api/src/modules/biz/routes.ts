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

// Schema based on actual d_business table structure
const BizSchema = Type.Object({
  id: Type.String(),
  code: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
  parent_id: Type.Optional(Type.String()),
  dl__business_level: Type.String(),
  office_id: Type.Optional(Type.String()),
  budget_allocated_amt: Type.Optional(Type.Number()),
  manager_employee_id: Type.Optional(Type.String()),
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
  parent_id: Type.Optional(Type.String({ format: 'uuid' })),
  dl__business_level: Type.Optional(Type.String({ minLength: 1 })),
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
        dl__business_level: Type.Optional(Type.String()),
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
      active_flag, search, dl__business_level, parent_id,
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

      if (dl__business_level !== undefined) {
        baseConditions.push(sql`b.dl__business_level = ${dl__business_level}`);
      }

      if (parent_id) {
        baseConditions.push(sql`b.parent_id = ${parent_id}::uuid`);
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
          b.id, b.code, b.name, b.descr, b.metadata, b.parent_id,
          b.dl__business_level, b.office_id, b.budget_allocated_amt, b.manager_employee_id,
          b.from_ts, b.to_ts, b.active_flag, b.created_ts, b.updated_ts, b.version
        FROM app.d_business b
        WHERE ${sql.join(baseConditions, sql` AND `)}
        ORDER BY b.dl__business_level ASC, b.name ASC
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
      if (active_flag !== undefined) {
        conditions.push(sql`active_flag = ${active_flag}`);
      }

      const children = await db.execute(sql`
        SELECT
          id, name, descr, dl__business_level, parent_id, metadata,
          budget_allocated_amt, manager_employee_id, office_id,
          from_ts, to_ts, active_flag, created_ts, updated_ts, version
        FROM app.d_business
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY dl__business_level ASC, name ASC
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
          p.project_stage,
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

      // Count artifacts (via entity mapping with biz)
      const artifactCount = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM app.d_artifact a
        WHERE a.primary_entity_type = 'biz'
          AND a.primary_entity_id = ${bizId}
          AND a.active_flag = true
      `);
      actionSummaries.push({
        actionEntity: 'artifact',
        count: Number(artifactCount[0]?.count || 0),
        label: 'Artifacts',
        icon: 'FileText'
      });

      // Count wiki entries (via entity mapping with biz)
      const wikiCount = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM app.d_wiki w
        WHERE w.primary_entity_type = 'biz'
          AND w.primary_entity_id = ${bizId}
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
    if (!data.name) data.name = 'Untitled';
    if (!data.code) data.code = `BIZ-${Date.now()}`;
    if (!data.dl__business_level) data.dl__business_level = 'Department'; // Default to Department level

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
          name, descr, code, dl__business_level, parent_id,
          office_id, budget_allocated_amt, manager_employee_id, metadata, active_flag
        )
        VALUES (
          ${data.name},
          ${data.descr || null},
          ${data.code || null},
          ${data.dl__business_level},
          ${data.parent_id || null},
          ${data.office_id || null},
          ${data.budget_allocated || data.budget_allocated_amt || null},
          ${data.manager_employee_id || null},
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
      if (data.dl__business_level !== undefined) updateFields.push(sql`dl__business_level = ${data.dl__business_level}`);
      if (data.parent_id !== undefined) updateFields.push(sql`parent_id = ${data.parent_id}`);
      if (data.office_id !== undefined) updateFields.push(sql`office_id = ${data.office_id}`);
      if (data.budget_allocated !== undefined || data.budget_allocated_amt !== undefined) {
        updateFields.push(sql`budget_allocated_amt = ${data.budget_allocated_amt || data.budget_allocated}`);
      }
      if (data.manager_employee_id !== undefined) updateFields.push(sql`manager_employee_id = ${data.manager_employee_id}`);
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