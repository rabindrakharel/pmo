import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { getEmployeeEntityIds, hasPermissionOnEntityId } from '../rbac/ui-api-permission-rbac-gate.js';
import { db } from '../../db/index.js';
import { sql } from 'drizzle-orm';
import {
  getUniversalColumnMetadata,
  filterUniversalColumns,
  getColumnsByMetadata
} from '../../lib/universal-schema-metadata.js';

// Schema based on actual d_org table structure
const OrgSchema = Type.Object({
  id: Type.String(),
  // Organization identification and metadata
  org_code: Type.Optional(Type.String()),
  org_type: Type.String(),
  location: Type.Optional(Type.String()),
  contact_info: Type.Optional(Type.String()),
  // Organizational structure
  parent_org_id: Type.Optional(Type.String()),
  parent_org_name: Type.Optional(Type.String()),
  territory_size: Type.Optional(Type.Number()),
  established_date: Type.Optional(Type.String()),
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

const CreateOrgSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  org_code: Type.Optional(Type.String()),
  org_type: Type.Optional(Type.String()),
  location: Type.Optional(Type.String()),
  contact_info: Type.Optional(Type.String()),
  parent_org_id: Type.Optional(Type.String({ format: 'uuid' })),
  territory_size: Type.Optional(Type.Number()),
  established_date: Type.Optional(Type.String({ format: 'date' })),
  tags: Type.Optional(Type.Array(Type.String())),
  attr: Type.Optional(Type.Object({})),
  active: Type.Optional(Type.Boolean()),
});

const UpdateOrgSchema = Type.Partial(CreateOrgSchema);

export async function orgRoutes(fastify: FastifyInstance) {
  // List organizations with filtering
  fastify.get('/api/v1/org', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        active: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        org_type: Type.Optional(Type.String()),
        parent_org_id: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(OrgSchema),
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
      active, search, org_type, parent_org_id,
      limit = 50, offset = 0
    } = request.query as any;

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Get employee's allowed organization IDs for filtering
      const allowedOrgIds = await getEmployeeEntityIds(userId, 'org');

      const conditions = [];

      if (allowedOrgIds.length > 0) {
        // Use IN clause for better compatibility with Drizzle
        conditions.push(sql.raw(`id IN (${allowedOrgIds.map(id => `'${id}'`).join(',')})`));
      } else {
        // If no org access, return empty result
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

      if (org_type) {
        conditions.push(sql`org_type = ${org_type}`);
      }

      if (parent_org_id) {
        conditions.push(sql`parent_org_id = ${parent_org_id}`);
      }

      if (search) {
        const searchableColumns = getColumnsByMetadata([
          'name', 'descr', 'org_code', 'location'
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
        FROM app.d_org
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      const orgs = await db.execute(sql`
        SELECT
          id, org_code, org_type, location, contact_info,
          parent_org_id, territory_size, established_date,
          name, "descr", tags, attr, from_ts, to_ts, active, created, updated,
          -- Include parent org name for display
          (SELECT name FROM app.d_org parent WHERE parent.id = d_org.parent_org_id) as parent_org_name
        FROM app.d_org
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY name ASC NULLS LAST, created DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
        canSeeSafetyInfo: true,
      };

      const filteredData = orgs.map(org =>
        filterUniversalColumns(org, userPermissions)
      );

      return {
        data: filteredData,
        total,
        limit,
        offset,
      };
    } catch (error) {
      (fastify.log as any).error('Error fetching organizations:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single organization
  fastify.get('/api/v1/org/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: OrgSchema,
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

    // Check if employee has permission to view this specific organization
    const hasViewAccess = await hasPermissionOnEntityId(userId, 'org', id, 'view');
    if (!hasViewAccess) {
      return reply.status(403).send({ error: 'Insufficient permissions to view this organization' });
    }

    try {
      const org = await db.execute(sql`
        SELECT
          id, org_code, org_type, location, contact_info,
          parent_org_id, territory_size, established_date,
          name, "descr", tags, attr, from_ts, to_ts, active, created, updated,
          -- Include parent org name for display
          (SELECT name FROM app.d_org parent WHERE parent.id = d_org.parent_org_id) as parent_org_name
        FROM app.d_org
        WHERE id = ${id}
      `);

      if (org.length === 0) {
        return reply.status(404).send({ error: 'Organization not found' });
      }

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
        canSeeSafetyInfo: true,
      };

      return filterUniversalColumns(org[0], userPermissions);
    } catch (error) {
      (fastify.log as any).error('Error fetching organization:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get organization action summaries - for tab navigation
  fastify.get('/api/v1/org/:id/action-summaries', {
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
          organization_id: Type.String()
        }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async function (request, reply) {
    try {
      const { id: orgId } = request.params as { id: string };
      const userId = request.user?.sub;

      if (!userId) {
        return reply.status(401).send({ error: 'User not authenticated' });
      }

      // Check if user has access to this organization
      const hasAccess = await hasPermissionOnEntityId(userId, 'org', orgId, 'view');
      if (!hasAccess) {
        return reply.status(403).send({ error: 'Access denied for this organization' });
      }

      // Check if organization exists
      const org = await db.execute(sql`
        SELECT id FROM app.d_org WHERE id = ${orgId} AND active = true
      `);

      if (org.length === 0) {
        return reply.status(404).send({ error: 'Organization not found' });
      }

      // Get action summaries for this organization
      const actionSummaries = [];

      // Count employees in this organization
      const employeeCount = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM app.d_employee e
        WHERE e.org_id = ${orgId} AND e.active = true
      `);
      actionSummaries.push({
        actionEntity: 'employee',
        count: Number(employeeCount[0]?.count || 0),
        label: 'Employees',
        icon: 'Users'
      });

      // Count worksites in this organization
      const worksiteCount = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM app.d_worksite w
        WHERE w.org_id = ${orgId} AND w.active = true
      `);
      actionSummaries.push({
        actionEntity: 'worksite',
        count: Number(worksiteCount[0]?.count || 0),
        label: 'Worksites',
        icon: 'MapPin'
      });

      // Count tasks assigned to this organization
      const taskCount = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM app.ops_task_head t
        WHERE t.org_id = ${orgId} AND t.active = true
      `);
      actionSummaries.push({
        actionEntity: 'task',
        count: Number(taskCount[0]?.count || 0),
        label: 'Tasks',
        icon: 'CheckSquare'
      });

      // Count artifacts
      const artifactCount = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM app.d_artifact a
        WHERE a.org_id = ${orgId} AND a.active = true
      `);
      actionSummaries.push({
        actionEntity: 'artifact',
        count: Number(artifactCount[0]?.count || 0),
        label: 'Artifacts',
        icon: 'FileText'
      });

      // Count wiki entries
      const wikiCount = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM app.d_wiki w
        WHERE w.org_id = ${orgId} AND w.active = true
      `);
      actionSummaries.push({
        actionEntity: 'wiki',
        count: Number(wikiCount[0]?.count || 0),
        label: 'Wiki',
        icon: 'BookOpen'
      });

      // Count forms
      const formCount = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM app.ops_formlog_head f
        WHERE f.org_id = ${orgId} AND f.active = true
      `);
      actionSummaries.push({
        actionEntity: 'form',
        count: Number(formCount[0]?.count || 0),
        label: 'Forms',
        icon: 'FileText'
      });

      return {
        action_entities: actionSummaries,
        organization_id: orgId
      };
    } catch (error) {
      fastify.log.error('Error fetching organization action summaries:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create organization
  fastify.post('/api/v1/org', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateOrgSchema,
      response: {
        201: OrgSchema,
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

    try {
      // Check for unique organization code if provided
      if (data.org_code) {
        const existingOrg = await db.execute(sql`
          SELECT id FROM app.d_org WHERE org_code = ${data.org_code} AND active = true
        `);
        if (existingOrg.length > 0) {
          return reply.status(400).send({ error: 'Organization with this code already exists' });
        }
      }

      // Validate parent organization if provided
      if (data.parent_org_id) {
        const parentOrg = await db.execute(sql`
          SELECT id FROM app.d_org WHERE id = ${data.parent_org_id} AND active = true
        `);
        if (parentOrg.length === 0) {
          return reply.status(400).send({ error: 'Parent organization not found' });
        }
      }

      const result = await db.execute(sql`
        INSERT INTO app.d_org (
          org_code, org_type, location, contact_info,
          parent_org_id, territory_size, established_date,
          name, "descr", tags, attr, active
        )
        VALUES (
          ${data.org_code || null},
          ${data.org_type || 'department'},
          ${data.location || null},
          ${data.contact_info || null},
          ${data.parent_org_id || null},
          ${data.territory_size || null},
          ${data.established_date || null},
          ${data.name},
          ${data.descr || null},
          ${data.tags ? JSON.stringify(data.tags) : '[]'}::jsonb,
          ${data.attr ? JSON.stringify(data.attr) : '{}'}::jsonb,
          ${data.active !== false}
        )
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to create organization' });
      }

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
        canSeeSafetyInfo: true,
      };

      return reply.status(201).send(filterUniversalColumns(result[0], userPermissions));
    } catch (error) {
      (fastify.log as any).error('Error creating organization:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update organization
  fastify.put('/api/v1/org/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      body: UpdateOrgSchema,
      response: {
        200: OrgSchema,
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

    // Check if employee has permission to modify this specific organization
    const hasModifyAccess = await hasPermissionOnEntityId(userId, 'org', id, 'modify');
    if (!hasModifyAccess) {
      return reply.status(403).send({ error: 'Insufficient permissions to modify this organization' });
    }

    try {
      const existing = await db.execute(sql`
        SELECT id FROM app.d_org WHERE id = ${id}
      `);

      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Organization not found' });
      }

      const updateFields = [];

      if (data.name !== undefined) updateFields.push(sql`name = ${data.name}`);
      if (data.descr !== undefined) updateFields.push(sql`"descr" = ${data.descr}`);
      if (data.org_code !== undefined) updateFields.push(sql`org_code = ${data.org_code}`);
      if (data.org_type !== undefined) updateFields.push(sql`org_type = ${data.org_type}`);
      if (data.location !== undefined) updateFields.push(sql`location = ${data.location}`);
      if (data.contact_info !== undefined) updateFields.push(sql`contact_info = ${data.contact_info}`);
      if (data.parent_org_id !== undefined) updateFields.push(sql`parent_org_id = ${data.parent_org_id}`);
      if (data.territory_size !== undefined) updateFields.push(sql`territory_size = ${data.territory_size}`);
      if (data.established_date !== undefined) updateFields.push(sql`established_date = ${data.established_date}`);
      if (data.tags !== undefined) updateFields.push(sql`tags = ${JSON.stringify(data.tags)}::jsonb`);
      if (data.attr !== undefined) updateFields.push(sql`attr = ${JSON.stringify(data.attr)}::jsonb`);
      if (data.active !== undefined) updateFields.push(sql`active = ${data.active}`);

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.d_org
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to update organization' });
      }

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
        canSeeSafetyInfo: true,
      };

      return filterUniversalColumns(result[0], userPermissions);
    } catch (error) {
      (fastify.log as any).error('Error updating organization:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete organization (soft delete)
  fastify.delete('/api/v1/org/:id', {
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

    // Check if employee has permission to delete this specific organization
    const hasDeleteAccess = await hasPermissionOnEntityId(userId, 'org', id, 'delete');
    if (!hasDeleteAccess) {
      return reply.status(403).send({ error: 'Insufficient permissions to delete this organization' });
    }

    try {
      const existing = await db.execute(sql`
        SELECT id FROM app.d_org WHERE id = ${id}
      `);

      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Organization not found' });
      }

      // Soft delete (using SCD Type 2 pattern)
      await db.execute(sql`
        UPDATE app.d_org
        SET active = false, to_ts = NOW(), updated = NOW()
        WHERE id = ${id}
      `);

      return reply.status(204).send();
    } catch (error) {
      (fastify.log as any).error('Error deleting organization:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}