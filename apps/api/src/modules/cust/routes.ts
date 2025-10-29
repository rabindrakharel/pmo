import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import {
  getUniversalColumnMetadata,
  filterUniversalColumns,
  getColumnsByMetadata
} from '../../lib/universal-schema-metadata.js';
import { transformRequestBody } from '../../lib/data-transformers.js';

// Schema based on actual d_cust table structure from db/14_d_cust.ddl
const CustSchema = Type.Object({
  id: Type.String(),
  code: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.String()),
  active_flag: Type.Boolean(),
  created_ts: Type.String(),
  updated_ts: Type.String(),
  version: Type.Number(),
  // Customer-specific fields - match actual d_cust table
  cust_number: Type.String(),
  cust_type: Type.String(),
  cust_status: Type.String(),
  primary_contact_name: Type.Optional(Type.String()),
  primary_email: Type.Optional(Type.String()),
  primary_phone: Type.Optional(Type.String()),
  city: Type.Optional(Type.String()),
  // Sales and marketing fields - _name columns only
  opportunity_funnel_stage_name: Type.Optional(Type.String()),
  industry_sector_name: Type.Optional(Type.String()),
  acquisition_channel_name: Type.Optional(Type.String()),
  customer_tier_name: Type.Optional(Type.String()),
});

const CreateCustSchema = Type.Object({
  code: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  cust_number: Type.String({ minLength: 1 }),
  cust_type: Type.Optional(Type.String()),
  cust_status: Type.Optional(Type.String()),
  primary_contact_name: Type.Optional(Type.String()),
  primary_email: Type.Optional(Type.String()),
  primary_phone: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
  active_flag: Type.Optional(Type.Boolean()),
});

const UpdateCustSchema = Type.Partial(CreateCustSchema);

export async function custRoutes(fastify: FastifyInstance) {
  // Test endpoint
  fastify.get('/api/v1/cust/test', async (request, reply) => {
    try {
      const result = await db.execute(sql`SELECT id, name FROM app.d_cust LIMIT 2`);
      return { success: true, count: result.length, data: result };
    } catch (error) {
      return { error: String(error) };
    }
  });

  // List customers with filtering
  fastify.get('/api/v1/cust', {
    schema: {
      querystring: Type.Object({
        active: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        cust_type: Type.Optional(Type.String()),
        biz_id: Type.Optional(Type.String()),
        page: Type.Optional(Type.Number({ minimum: 1 })),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
      }),
    },
  }, async (request, reply) => {
    const { active, search, cust_type, biz_id, page, limit = 20, offset } = request.query as any;

    // Calculate offset from page if page is provided
    const actualOffset = page !== undefined ? (page - 1) * limit : (offset || 0);


    try {
      const conditions = [];
      
      if (active !== undefined) {
        conditions.push(sql`active_flag = ${active}`);
      }
      
      if (search) {
        conditions.push(sql`(
          name ILIKE ${`%${search}%`} OR
          "descr" ILIKE ${`%${search}%`} OR
          cust_number ILIKE ${`%${search}%`} OR
          primary_contact_name ILIKE ${`%${search}%`} OR
          primary_email ILIKE ${`%${search}%`}
        )`);
      }

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.d_cust
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      const customers = await db.execute(sql`
        SELECT
          c.id, c.code, c.name, c."descr", c.metadata, c.from_ts, c.to_ts, c.active_flag, c.created_ts, c.updated_ts, c.version,
          c.cust_number, c.cust_type, c.cust_status, c.primary_contact_name,
          c.primary_email, c.primary_phone, c.city,
          c.opportunity_funnel_stage_name,
          c.industry_sector_name,
          c.acquisition_channel_name,
          c.customer_tier_name
        FROM app.d_cust c
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY c.name ASC NULLS LAST, c.created_ts DESC
        LIMIT ${limit} OFFSET ${actualOffset}
      `);

      return {
        data: customers,
        total,
        limit,
        offset: actualOffset,
        page: page || Math.floor(actualOffset / limit) + 1,
      };
    } catch (error) {
      fastify.log.error('Error fetching customers:', error);
      console.error('CUST API ERROR:', error);
      return reply.status(500).send({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Get single customer
  fastify.get('/api/v1/cust/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: CustSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };


    try {
      const customer = await db.execute(sql`
        SELECT
          c.id, c.code, c.name, c."descr", c.metadata, c.from_ts, c.to_ts, c.active_flag, c.created_ts, c.updated_ts, c.version,
          c.cust_number, c.cust_type, c.cust_status, c.primary_contact_name,
          c.primary_email, c.primary_phone, c.city,
          c.opportunity_funnel_stage_name,
          c.industry_sector_name,
          c.acquisition_channel_name,
          c.customer_tier_name
        FROM app.d_cust c
        WHERE c.id = ${id}
      `);

      if (customer.length === 0) {
        return reply.status(404).send({ error: 'Customer not found' });
      }

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
      };

      return filterUniversalColumns(customer[0], userPermissions);
    } catch (error) {
      fastify.log.error('Error fetching customer:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get customer hierarchy (parent and children)
  fastify.get('/api/v1/cust/:id/hierarchy', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          customer: CustSchema,
          parent: Type.Optional(CustSchema),
          children: Type.Array(CustSchema),
        }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };


    try {
      // Get the customer
      const customerResult = await db.execute(sql`
        SELECT
          c.id, c.code, c.name, c."descr", c.metadata, c.from_ts, c.to_ts, c.active_flag, c.created_ts, c.updated_ts, c.version,
          c.cust_number, c.cust_type, c.cust_status, c.primary_contact_name,
          c.primary_email, c.primary_phone, c.city,
          c.opportunity_funnel_stage_name,
          c.industry_sector_name,
          c.acquisition_channel_name,
          c.customer_tier_name
        FROM app.d_cust c
        WHERE c.id = ${id}
      `);

      if (customerResult.length === 0) {
        return reply.status(404).send({ error: 'Customer not found' });
      }

      const customer = customerResult[0];

      if (!customer) {
        return reply.status(404).send({ error: 'Customer not found' });
      }

      // Note: Customer table doesn't have hierarchy - parent/children not applicable
      const parent = null;
      const children = [];

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
      };

      return {
        customer: filterUniversalColumns(customer, userPermissions),
        parent: parent ? filterUniversalColumns(parent, userPermissions) : null,
        children: children.map(child => filterUniversalColumns(child, userPermissions)),
      };
    } catch (error) {
      fastify.log.error('Error fetching customer hierarchy:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create customer
  fastify.post('/api/v1/cust', {
    schema: {
      body: CreateCustSchema,
      response: {
        201: CustSchema,
        403: Type.Object({ error: Type.String() }),
        400: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    // Transform request data (tags string → array, etc.)
    const data = transformRequestBody(request.body as any);


    try {
      // Check for unique customer number
      const existingCust = await db.execute(sql`
        SELECT id FROM app.d_cust
        WHERE cust_number = ${data.cust_number}
        AND active_flag = true
      `);
      if (existingCust.length > 0) {
        return reply.status(400).send({ error: 'Customer with this customer number already exists' });
      }

      const result = await db.execute(sql`
        INSERT INTO app.d_cust (
          code, name, "descr", cust_number, cust_type, cust_status,
          primary_contact_name, primary_email, primary_phone,
          metadata, active_flag
        )
        VALUES (
          ${data.code},
          ${data.name},
          ${data.descr || null},
          ${data.cust_number},
          ${data.cust_type || 'residential'},
          ${data.cust_status || 'active'},
          ${data.primary_contact_name || null},
          ${data.primary_email || null},
          ${data.primary_phone || null},
          ${data.metadata ? JSON.stringify(data.metadata) : '{}'}::jsonb,
          ${data.active_flag !== false}
        )
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to create customer' });
      }

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
      };
      
      return reply.status(201).send(filterUniversalColumns(result[0], userPermissions));
    } catch (error) {
      fastify.log.error('Error creating customer:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update customer
  fastify.put('/api/v1/cust/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      body: UpdateCustSchema,
      response: {
        200: CustSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        400: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    // Transform request data (tags string → array, etc.)
    const data = transformRequestBody(request.body as any);

    try {
      const existing = await db.execute(sql`
        SELECT id FROM app.d_cust WHERE id = ${id}
      `);

      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Customer not found' });
      }

      // Check for unique customer number on update
      if (data.cust_number !== undefined) {
        const existingNumber = await db.execute(sql`
          SELECT id FROM app.d_cust
          WHERE cust_number = ${data.cust_number}
          AND id != ${id}
          AND active_flag = true
        `);
        if (existingNumber.length > 0) {
          return reply.status(400).send({ error: 'Customer with this customer number already exists' });
        }
      }

      const updateFields = [];

      if (data.code !== undefined) updateFields.push(sql`code = ${data.code}`);
      if (data.name !== undefined) updateFields.push(sql`name = ${data.name}`);
      if (data.descr !== undefined) updateFields.push(sql`"descr" = ${data.descr}`);
      if (data.cust_number !== undefined) updateFields.push(sql`cust_number = ${data.cust_number}`);
      if (data.cust_type !== undefined) updateFields.push(sql`cust_type = ${data.cust_type}`);
      if (data.cust_status !== undefined) updateFields.push(sql`cust_status = ${data.cust_status}`);
      if (data.primary_contact_name !== undefined) updateFields.push(sql`primary_contact_name = ${data.primary_contact_name}`);
      if (data.primary_email !== undefined) updateFields.push(sql`primary_email = ${data.primary_email}`);
      if (data.primary_phone !== undefined) updateFields.push(sql`primary_phone = ${data.primary_phone}`);
      if (data.metadata !== undefined) updateFields.push(sql`metadata = ${JSON.stringify(data.metadata)}::jsonb`);
      if (data.active_flag !== undefined) updateFields.push(sql`active_flag = ${data.active_flag}`);

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated_ts = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.d_cust
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to update customer' });
      }

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
      };

      return filterUniversalColumns(result[0], userPermissions);
    } catch (error) {
      fastify.log.error('Error updating customer:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete customer (soft delete)
  fastify.delete('/api/v1/cust/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        204: Type.Null(),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        400: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };


    try {
      const existing = await db.execute(sql`
        SELECT id FROM app.d_cust WHERE id = ${id}
      `);

      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Customer not found' });
      }

      // Soft delete (using SCD Type 2 pattern)
      await db.execute(sql`
        UPDATE app.d_cust
        SET active_flag = false, to_ts = NOW(), updated_ts = NOW()
        WHERE id = ${id}
      `);

      return reply.status(204).send();
    } catch (error) {
      fastify.log.error('Error deleting customer:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get customer projects (child entity route)
  fastify.get('/api/v1/cust/:id/project', {
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
  }, async (request, reply) => {
    try {
      const { id: custId } = request.params as { id: string };
      const { page = 1, limit = 20 } = request.query as any;
      const userId = (request as any).user?.sub;

      if (!userId) {
        return reply.status(401).send({ error: 'User not authenticated' });
      }

      // Check RBAC for customer access
      const custAccess = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map rbac
        WHERE rbac.empid = ${userId}
          AND rbac.entity = 'cust'
          AND (rbac.entity_id = ${custId}::text OR rbac.entity_id = 'all')
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND 0 = ANY(rbac.permission)
      `);

      if (custAccess.length === 0) {
        return reply.status(403).send({ error: 'Access denied for this customer' });
      }

      // Query child projects linked to this customer
      const offset = (page - 1) * limit;
      const projects = await db.execute(sql`
        SELECT p.*
        FROM app.d_project p
        INNER JOIN app.d_entity_id_map eim ON eim.child_entity_id = p.id::text
        WHERE eim.parent_entity_id = ${custId}
          AND eim.parent_entity_type = 'cust'
          AND eim.child_entity_type = 'project'
          AND eim.active_flag = true
          AND p.active_flag = true
        ORDER BY p.created_ts DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      // Count total projects for pagination
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.d_project p
        INNER JOIN app.d_entity_id_map eim ON eim.child_entity_id = p.id::text
        WHERE eim.parent_entity_id = ${custId}
          AND eim.parent_entity_type = 'cust'
          AND eim.child_entity_type = 'project'
          AND eim.active_flag = true
          AND p.active_flag = true
      `);

      return {
        data: projects,
        total: Number(countResult[0]?.total || 0),
        page,
        limit
      };
    } catch (error) {
      fastify.log.error('Error fetching customer projects:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}