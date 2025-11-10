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

// Schema based on actual d_office table structure (physical locations only)
// NOTE: Hierarchy fields (parent_id, dl__office_hierarchy_level) are in d_office_hierarchy
// Use /api/v1/office-hierarchy for organizational hierarchy management
const OfficeSchema = Type.Object({
  id: Type.String(),
  code: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
  // Physical location fields
  address_line1: Type.Optional(Type.String()),
  address_line2: Type.Optional(Type.String()),
  city: Type.Optional(Type.String()),
  province: Type.Optional(Type.String()),
  postal_code: Type.Optional(Type.String()),
  country: Type.Optional(Type.String()),
  // Contact and operational fields
  phone: Type.Optional(Type.String()),
  email: Type.Optional(Type.String()),
  office_type: Type.Optional(Type.String()),
  capacity_employees: Type.Optional(Type.Number()),
  square_footage: Type.Optional(Type.Number()),
  // Temporal audit fields
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
  // Physical location fields
  address_line1: Type.Optional(Type.String()),
  address_line2: Type.Optional(Type.String()),
  city: Type.Optional(Type.String()),
  province: Type.Optional(Type.String()),
  postal_code: Type.Optional(Type.String()),
  country: Type.Optional(Type.String()),
  // Contact and operational fields
  phone: Type.Optional(Type.String()),
  email: Type.Optional(Type.String()),
  office_type: Type.Optional(Type.String()),
  capacity_employees: Type.Optional(Type.Number()),
  square_footage: Type.Optional(Type.Number()),
  active_flag: Type.Optional(Type.Boolean()),
});

const UpdateOfficeSchema = Type.Partial(CreateOfficeSchema);

export async function officeRoutes(fastify: FastifyInstance) {
  // List physical office locations with filtering
  fastify.get('/api/v1/office', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        active_flag: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        office_type: Type.Optional(Type.String()),
        city: Type.Optional(Type.String()),
        province: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
        page: Type.Optional(Type.Number({ minimum: 1 })),
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
      active_flag, search, office_type, city, province,
      limit = 20, offset: queryOffset, page
    } = request.query as any;
    const offset = page ? (page - 1) * limit : (queryOffset !== undefined ? queryOffset : 0);

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Direct RBAC filtering - only show offices user has access to
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
        conditions.push(sql`o.active_flag = ${active_flag}`);
      }

      if (office_type) {
        conditions.push(sql`o.office_type = ${office_type}`);
      }

      if (city) {
        conditions.push(sql`o.city ILIKE ${`%${city}%`}`);
      }

      if (province) {
        conditions.push(sql`o.province ILIKE ${`%${province}%`}`);
      }

      if (search) {
        const searchConditions = [
          sql`COALESCE(o.name, '') ILIKE ${`%${search}%`}`,
          sql`COALESCE(o."descr", '') ILIKE ${`%${search}%`}`,
          sql`COALESCE(o.code, '') ILIKE ${`%${search}%`}`,
          sql`COALESCE(o.city, '') ILIKE ${`%${search}%`}`,
          sql`COALESCE(o.province, '') ILIKE ${`%${search}%`}`,
          sql`COALESCE(o.address_line1, '') ILIKE ${`%${search}%`}`
        ];

        conditions.push(sql`(${sql.join(searchConditions, sql` OR `)})`);
      }

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.d_office o
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      const offices = await db.execute(sql`
        SELECT
          o.id, o.code, o.name, o."descr", o.metadata,
          o.address_line1, o.address_line2, o.city, o.province, o.postal_code, o.country,
          o.phone, o.email, o.office_type, o.capacity_employees, o.square_footage,
          o.from_ts, o.to_ts, o.active_flag, o.created_ts, o.updated_ts, o.version
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

      const filteredData = offices.map(office =>
        filterUniversalColumns(office, userPermissions)
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

  // Get single office location
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
      const office = await db.execute(sql`
        SELECT
          id, code, name, "descr", metadata,
          address_line1, address_line2, city, province, postal_code, country,
          phone, email, office_type, capacity_employees, square_footage,
          from_ts, to_ts, active_flag, created_ts, updated_ts, version
        FROM app.d_office
        WHERE id = ${id}
      `);

      if (office.length === 0) {
        return reply.status(404).send({ error: 'Office not found' });
      }

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
        canSeeSafetyInfo: true,
      };

      return filterUniversalColumns(office[0], userPermissions);
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

  // Create office location
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
      // Check for unique office code if provided
      if (data.code) {
        const existingOffice = await db.execute(sql`
          SELECT id FROM app.d_office WHERE code = ${data.code} AND active_flag = true
        `);
        if (existingOffice.length > 0) {
          return reply.status(400).send({ error: 'Office with this code already exists' });
        }
      }

      const result = await db.execute(sql`
        INSERT INTO app.d_office (
          code, name, "descr", metadata,
          address_line1, address_line2, city, province, postal_code, country,
          phone, email, office_type, capacity_employees, square_footage,
          active_flag
        )
        VALUES (
          ${data.code},
          ${data.name},
          ${data.descr || null},
          ${data.metadata ? JSON.stringify(data.metadata) : '{}'}::jsonb,
          ${data.address_line1 || null},
          ${data.address_line2 || null},
          ${data.city || null},
          ${data.province || null},
          ${data.postal_code || null},
          ${data.country || 'Canada'},
          ${data.phone || null},
          ${data.email || null},
          ${data.office_type || null},
          ${data.capacity_employees || null},
          ${data.square_footage || null},
          ${data.active_flag !== false}
        )
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to create office' });
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

  // Update office location
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
      if (data.address_line1 !== undefined) updateFields.push(sql`address_line1 = ${data.address_line1}`);
      if (data.address_line2 !== undefined) updateFields.push(sql`address_line2 = ${data.address_line2}`);
      if (data.city !== undefined) updateFields.push(sql`city = ${data.city}`);
      if (data.province !== undefined) updateFields.push(sql`province = ${data.province}`);
      if (data.postal_code !== undefined) updateFields.push(sql`postal_code = ${data.postal_code}`);
      if (data.country !== undefined) updateFields.push(sql`country = ${data.country}`);
      if (data.phone !== undefined) updateFields.push(sql`phone = ${data.phone}`);
      if (data.email !== undefined) updateFields.push(sql`email = ${data.email}`);
      if (data.office_type !== undefined) updateFields.push(sql`office_type = ${data.office_type}`);
      if (data.capacity_employees !== undefined) updateFields.push(sql`capacity_employees = ${data.capacity_employees}`);
      if (data.square_footage !== undefined) updateFields.push(sql`square_footage = ${data.square_footage}`);
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
        return reply.status(500).send({ error: 'Failed to update office' });
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