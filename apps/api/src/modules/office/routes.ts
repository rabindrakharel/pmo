import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
// RBAC implemented directly via database joins - no separate permission gates
import { db } from '../../db/index.js';
import { sql } from 'drizzle-orm';
import {
  getUniversalColumnMetadata,
  filterUniversalColumns,
  getColumnsByMetadata
} from '../../lib/universal-schema-metadata.js';
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';
import { createChildEntityEndpoint } from '../../lib/child-entity-route-factory.js';

// Schema based on actual d_office table structure
const OfficeSchema = Type.Object({
  id: Type.String(),
  code: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
  parent_id: Type.Optional(Type.String()),
  parent_name: Type.Optional(Type.String()),
  dl__office_level: Type.String(),
  address_line1: Type.Optional(Type.String()),
  address_line2: Type.Optional(Type.String()),
  city: Type.Optional(Type.String()),
  province: Type.Optional(Type.String()),
  postal_code: Type.Optional(Type.String()),
  country: Type.Optional(Type.String()),
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.String()),
  active_flag: Type.Boolean(),
  created_ts: Type.String(),
  updated_ts: Type.String(),
  version: Type.Number(),
});

const CreateOfficeSchema = Type.Object({
  code: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
  parent_id: Type.Optional(Type.String({ format: 'uuid' })),
  dl__office_level: Type.String(),
  address_line1: Type.Optional(Type.String()),
  address_line2: Type.Optional(Type.String()),
  city: Type.Optional(Type.String()),
  province: Type.Optional(Type.String()),
  postal_code: Type.Optional(Type.String()),
  country: Type.Optional(Type.String()),
  active_flag: Type.Optional(Type.Boolean()),
});

const UpdateOfficeSchema = Type.Partial(CreateOfficeSchema);

export async function officeRoutes(fastify: FastifyInstance) {
  // List organizations with filtering
  fastify.get('/api/v1/office', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        active_flag: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        parent_id: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(OfficeSchema),
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
      active_flag, search, parent_id,
      limit = 50, offset = 0
    } = request.query as any;

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Direct RBAC filtering - only show orgs user has access to
      const baseConditions = [
        sql`(
          EXISTS (
            SELECT 1 FROM app.entity_id_rbac_map rbac
            WHERE rbac.empid = ${userId}::uuid
              AND rbac.entity = 'office'
              AND (rbac.entity_id = o.id::text OR rbac.entity_id = 'all')
              AND rbac.active_flag = true
              AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
              AND 0 = ANY(rbac.permission)
          )
        )`
      ];

      const conditions = [...baseConditions];

      if (active_flag !== undefined) {
        conditions.push(sql`active_flag = ${active_flag}`);
      }

      if (parent_id) {
        conditions.push(sql`parent_id = ${parent_id}`);
      }

      if (search) {
        const searchConditions = [
          sql`COALESCE(name, '') ILIKE ${`%${search}%`}`,
          sql`COALESCE("descr", '') ILIKE ${`%${search}%`}`,
          sql`COALESCE(code, '') ILIKE ${`%${search}%`}`,
          sql`COALESCE(city, '') ILIKE ${`%${search}%`}`,
          sql`COALESCE(province, '') ILIKE ${`%${search}%`}`
        ];

        conditions.push(sql`(${sql.join(searchConditions, sql` OR `)})`);
      }

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.d_office o
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      const orgs = await db.execute(sql`
        SELECT
          o.id, o.code, o.name, o."descr", o.metadata,
          o.parent_id, o.dl__office_level,
          o.address_line1, o.address_line2, o.city, o.province, o.postal_code, o.country,
          o.from_ts, o.to_ts, o.active_flag, o.created_ts, o.updated_ts, o.version,
          -- Include parent org name for display
          (SELECT name FROM app.d_office parent WHERE parent.id = o.parent_id) as parent_name
        FROM app.d_office o
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY o.name ASC NULLS LAST, o.created_ts DESC
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
      fastify.log.error({ error, stack: (error as Error).stack }, 'Error fetching organizations');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single organization
  fastify.get('/api/v1/office/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: OfficeSchema,
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

    // Direct RBAC check for org access
    const orgAccess = await db.execute(sql`
      SELECT 1 FROM app.entity_id_rbac_map rbac
      WHERE rbac.empid = ${userId}::uuid
        AND rbac.entity = 'office'
        AND (rbac.entity_id = ${id} OR rbac.entity_id = 'all')
        AND rbac.active_flag = true
        AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
        AND 0 = ANY(rbac.permission)
    `);

    if (orgAccess.length === 0) {
      return reply.status(403).send({ error: 'Insufficient permissions to view this organization' });
    }

    try {
      const org = await db.execute(sql`
        SELECT
          id, code, name, "descr", metadata,
          parent_id, dl__office_level,
          address_line1, address_line2, city, province, postal_code, country,
          from_ts, to_ts, active_flag, created_ts, updated_ts, version,
          -- Include parent org name for display
          (SELECT name FROM app.d_office parent WHERE parent.id = d_office.parent_id) as parent_name
        FROM app.d_office
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

  // Get organization dynamic child entity tabs - for tab navigation
  fastify.get('/api/v1/office/:id/dynamic-child-entity-tabs', {
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

      // Direct RBAC check for org access
      const orgAccess = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map rbac
        WHERE rbac.empid = ${userId}::uuid
          AND rbac.entity = 'office'
          AND (rbac.entity_id = ${orgId} OR rbac.entity_id = 'all')
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND 0 = ANY(rbac.permission)
      `);

      if (orgAccess.length === 0) {
        return reply.status(403).send({ error: 'Access denied for this organization' });
      }

      // Check if organization exists
      const org = await db.execute(sql`
        SELECT id FROM app.d_office WHERE id = ${orgId} AND active_flag = true
      `);

      if (org.length === 0) {
        return reply.status(404).send({ error: 'Organization not found' });
      }

      // Get action summaries for this organization
      const actionSummaries = [];

      // Count businesses in this office
      const businessCount = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM app.d_business b
        WHERE b.office_id = ${orgId} AND b.active_flag = true
      `);
      actionSummaries.push({
        actionEntity: 'biz',
        count: Number(businessCount[0]?.count || 0),
        label: 'Businesses',
        icon: 'Building'
      });

      // Count projects in this office
      const projectCount = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM app.d_project p
        WHERE p.office_id = ${orgId} AND p.active_flag = true
      `);
      actionSummaries.push({
        actionEntity: 'project',
        count: Number(projectCount[0]?.count || 0),
        label: 'Projects',
        icon: 'Briefcase'
      });

      // Count tasks assigned to this office
      const taskCount = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM app.d_task t
        WHERE t.office_id = ${orgId} AND t.active_flag = true
      `);
      actionSummaries.push({
        actionEntity: 'task',
        count: Number(taskCount[0]?.count || 0),
        label: 'Tasks',
        icon: 'CheckSquare'
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
  fastify.post('/api/v1/office', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateOfficeSchema,
      response: {
        201: OfficeSchema,
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
      if (data.code) {
        const existingOrg = await db.execute(sql`
          SELECT id FROM app.d_office WHERE code = ${data.code} AND active_flag = true
        `);
        if (existingOrg.length > 0) {
          return reply.status(400).send({ error: 'Organization with this code already exists' });
        }
      }

      // Validate parent organization if provided
      if (data.parent_id) {
        const parentOrg = await db.execute(sql`
          SELECT id FROM app.d_office WHERE id = ${data.parent_id} AND active_flag = true
        `);
        if (parentOrg.length === 0) {
          return reply.status(400).send({ error: 'Parent organization not found' });
        }
      }

      const result = await db.execute(sql`
        INSERT INTO app.d_office (
          code, name, "descr", metadata, parent_id, dl__office_level,
          address_line1, address_line2, city, province, postal_code, country, active_flag
        )
        VALUES (
          ${data.code},
          ${data.name},
          ${data.descr || null},
          ${data.metadata ? JSON.stringify(data.metadata) : '{}'}::jsonb,
          ${data.parent_id || null},
          ${data.dl__office_level},
          ${data.address_line1 || null},
          ${data.address_line2 || null},
          ${data.city || null},
          ${data.province || null},
          ${data.postal_code || null},
          ${data.country || 'Canada'},
          ${data.active_flag !== false}
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
  fastify.put('/api/v1/office/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      body: UpdateOfficeSchema,
      response: {
        200: OfficeSchema,
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

    // Direct RBAC check for org edit access
    const orgEditAccess = await db.execute(sql`
      SELECT 1 FROM app.entity_id_rbac_map rbac
      WHERE rbac.empid = ${userId}::uuid
        AND rbac.entity = 'office'
        AND (rbac.entity_id = ${id} OR rbac.entity_id = 'all')
        AND rbac.active_flag = true
        AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
        AND 1 = ANY(rbac.permission)
    `);

    if (orgEditAccess.length === 0) {
      return reply.status(403).send({ error: 'Insufficient permissions to modify this organization' });
    }

    try {
      const existing = await db.execute(sql`
        SELECT id FROM app.d_office WHERE id = ${id}
      `);

      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Organization not found' });
      }

      const updateFields = [];

      if (data.name !== undefined) updateFields.push(sql`name = ${data.name}`);
      if (data.descr !== undefined) updateFields.push(sql`"descr" = ${data.descr}`);
      if (data.code !== undefined) updateFields.push(sql`code = ${data.code}`);
      if (data.metadata !== undefined) updateFields.push(sql`metadata = ${JSON.stringify(data.metadata)}::jsonb`);
      if (data.parent_id !== undefined) updateFields.push(sql`parent_id = ${data.parent_id}`);
      if (data.dl__office_level !== undefined) updateFields.push(sql`dl__office_level = ${data.dl__office_level}`);
      if (data.address_line1 !== undefined) updateFields.push(sql`address_line1 = ${data.address_line1}`);
      if (data.address_line2 !== undefined) updateFields.push(sql`address_line2 = ${data.address_line2}`);
      if (data.city !== undefined) updateFields.push(sql`city = ${data.city}`);
      if (data.province !== undefined) updateFields.push(sql`province = ${data.province}`);
      if (data.postal_code !== undefined) updateFields.push(sql`postal_code = ${data.postal_code}`);
      if (data.country !== undefined) updateFields.push(sql`country = ${data.country}`);
      if (data.active_flag !== undefined) updateFields.push(sql`active_flag = ${data.active_flag}`);

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated_ts = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.d_office
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

  // Delete office with cascading cleanup (soft delete)
  // Uses universal delete factory pattern - deletes from:
  // 1. app.d_office (base entity table)
  // 2. app.d_entity_instance_id (entity registry)
  // 3. app.d_entity_id_map (linkages in both directions)
  createEntityDeleteEndpoint(fastify, 'office');

  // ========================================
  // CHILD ENTITY ENDPOINTS (DRY Factory Pattern)
  // ========================================
  // Use factory pattern to create standardized child entity endpoints
  // Replaces 100+ lines of duplicate code with single function calls
  createChildEntityEndpoint(fastify, 'office', 'task', 'd_task');
  createChildEntityEndpoint(fastify, 'office', 'project', 'd_project');
  createChildEntityEndpoint(fastify, 'office', 'employee', 'd_employee');

  // ========================================
  // CHILD ENTITY CREATION
  // ========================================
  // Child entities (task, artifact, wiki, form) are created using:
  // 1. Universal entity create endpoint: POST /api/v1/:childType
  // 2. Linkage API: POST /api/v1/linkage to link child to parent
  // 3. Navigate to child detail page for editing
  // No special endpoints needed - reuses existing universal APIs
}