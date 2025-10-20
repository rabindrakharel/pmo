import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { 
  getUniversalColumnMetadata, 
  filterUniversalColumns,
  getColumnsByMetadata 
} from '../../lib/universal-schema-metadata.js';

// Schema based on actual d_client table structure from db/XIV_d_client.ddl
const ClientSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  tags: Type.Array(Type.String()),
  attr: Type.Object({}),
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.String()),
  active_flag: Type.Boolean(),
  created_ts: Type.String(),
  updated_ts: Type.String(),
  // Client-specific fields - match actual d_client table
  client_number: Type.String(),
  client_type: Type.String(),
  client_status: Type.String(),
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

const CreateClientSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  client_number: Type.String({ minLength: 1 }),
  client_type: Type.Optional(Type.String()),
  client_status: Type.Optional(Type.String()),
  primary_contact_name: Type.Optional(Type.String()),
  primary_email: Type.Optional(Type.String()),
  primary_phone: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Array(Type.String())),
  metadata: Type.Optional(Type.Object({})),
  active_flag: Type.Optional(Type.Boolean()),
});

const UpdateClientSchema = Type.Partial(CreateClientSchema);

export async function clientRoutes(fastify: FastifyInstance) {
  // Test endpoint
  fastify.get('/api/v1/client/test', async (request, reply) => {
    try {
      const result = await db.execute(sql`SELECT id, name FROM app.d_client LIMIT 2`);
      return { success: true, count: result.length, data: result };
    } catch (error) {
      return { error: String(error) };
    }
  });

  // List clients with filtering
  fastify.get('/api/v1/client', {
    schema: {
      querystring: Type.Object({
        active: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        client_type: Type.Optional(Type.String()),
        biz_id: Type.Optional(Type.String()),
        page: Type.Optional(Type.Number({ minimum: 1 })),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
      }),
    },
  }, async (request, reply) => {
    const { active, search, client_type, biz_id, page, limit = 20, offset } = request.query as any;

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
          client_number ILIKE ${`%${search}%`} OR
          primary_contact_name ILIKE ${`%${search}%`} OR
          primary_email ILIKE ${`%${search}%`}
        )`);
      }

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total 
        FROM app.d_client 
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      const clients = await db.execute(sql`
        SELECT
          c.id, c.name, c."descr", c.tags, c.metadata as attr, c.from_ts, c.to_ts, c.active_flag, c.created_ts, c.updated_ts,
          c.client_number, c.client_type, c.client_status, c.primary_contact_name,
          c.primary_email, c.primary_phone, c.city,
          c.opportunity_funnel_stage_name,
          c.industry_sector_name,
          c.acquisition_channel_name,
          c.customer_tier_name
        FROM app.d_client c
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY c.name ASC NULLS LAST, c.created_ts DESC
        LIMIT ${limit} OFFSET ${actualOffset}
      `);

      return {
        data: clients,
        total,
        limit,
        offset: actualOffset,
        page: page || Math.floor(actualOffset / limit) + 1,
      };
    } catch (error) {
      fastify.log.error('Error fetching clients:', error);
      console.error('CLIENT API ERROR:', error);
      return reply.status(500).send({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Get single client
  fastify.get('/api/v1/client/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: ClientSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };


    try {
      const client = await db.execute(sql`
        SELECT
          c.id, c.name, c."descr", c.tags, c.metadata as attr, c.from_ts, c.to_ts, c.active_flag, c.created_ts, c.updated_ts,
          c.client_number, c.client_type, c.client_status, c.primary_contact_name,
          c.primary_email, c.primary_phone, c.city,
          c.opportunity_funnel_stage_name,
          c.industry_sector_name,
          c.acquisition_channel_name,
          c.customer_tier_name
        FROM app.d_client c
        WHERE c.id = ${id}
      `);

      if (client.length === 0) {
        return reply.status(404).send({ error: 'Client not found' });
      }

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
      };
      
      return filterUniversalColumns(client[0], userPermissions);
    } catch (error) {
      fastify.log.error('Error fetching client:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get client hierarchy (parent and children)
  fastify.get('/api/v1/client/:id/hierarchy', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          client: ClientSchema,
          parent: Type.Optional(ClientSchema),
          children: Type.Array(ClientSchema),
        }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };


    try {
      // Get the client
      const clientResult = await db.execute(sql`
        SELECT
          c.id, c.name, c."descr", c.tags, c.metadata as attr, c.from_ts, c.to_ts, c.active_flag, c.created_ts, c.updated_ts,
          c.client_number, c.client_type, c.client_status, c.primary_contact_name,
          c.primary_email, c.primary_phone, c.city,
          c.opportunity_funnel_stage_name,
          c.industry_sector_name,
          c.acquisition_channel_name,
          c.customer_tier_name
        FROM app.d_client c
        WHERE c.id = ${id}
      `);

      if (clientResult.length === 0) {
        return reply.status(404).send({ error: 'Client not found' });
      }

      const client = clientResult[0];

      if (!client) {
        return reply.status(404).send({ error: 'Client not found' });
      }

      // Note: Client table doesn't have hierarchy - parent/children not applicable
      const parent = null;
      const children = [];

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
      };

      return {
        client: filterUniversalColumns(client, userPermissions),
        parent: parent ? filterUniversalColumns(parent, userPermissions) : null,
        children: children.map(child => filterUniversalColumns(child, userPermissions)),
      };
    } catch (error) {
      fastify.log.error('Error fetching client hierarchy:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create client
  fastify.post('/api/v1/client', {
    schema: {
      body: CreateClientSchema,
      response: {
        201: ClientSchema,
        403: Type.Object({ error: Type.String() }),
        400: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const data = request.body as any;


    try {
      // Check for unique client number
      const existingClient = await db.execute(sql`
        SELECT id FROM app.d_client
        WHERE client_number = ${data.client_number}
        AND active_flag = true
      `);
      if (existingClient.length > 0) {
        return reply.status(400).send({ error: 'Client with this client number already exists' });
      }

      const result = await db.execute(sql`
        INSERT INTO app.d_client (
          name, "descr", client_number, client_type, client_status,
          primary_contact_name, primary_email, primary_phone,
          tags, metadata, active_flag
        )
        VALUES (
          ${data.name},
          ${data.descr || null},
          ${data.client_number},
          ${data.client_type || 'residential'},
          ${data.client_status || 'active'},
          ${data.primary_contact_name || null},
          ${data.primary_email || null},
          ${data.primary_phone || null},
          ${data.tags ? JSON.stringify(data.tags) : '[]'}::jsonb,
          ${data.metadata ? JSON.stringify(data.metadata) : '{}'}::jsonb,
          ${data.active_flag !== false}
        )
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to create client' });
      }

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
      };
      
      return reply.status(201).send(filterUniversalColumns(result[0], userPermissions));
    } catch (error) {
      fastify.log.error('Error creating client:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update client
  fastify.put('/api/v1/client/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      body: UpdateClientSchema,
      response: {
        200: ClientSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        400: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;


    try {
      const existing = await db.execute(sql`
        SELECT id FROM app.d_client WHERE id = ${id}
      `);

      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Client not found' });
      }

      // Check for unique client number on update
      if (data.client_number !== undefined) {
        const existingNumber = await db.execute(sql`
          SELECT id FROM app.d_client
          WHERE client_number = ${data.client_number}
          AND id != ${id}
          AND active_flag = true
        `);
        if (existingNumber.length > 0) {
          return reply.status(400).send({ error: 'Client with this client number already exists' });
        }
      }

      const updateFields = [];

      if (data.name !== undefined) updateFields.push(sql`name = ${data.name}`);
      if (data.descr !== undefined) updateFields.push(sql`"descr" = ${data.descr}`);
      if (data.client_number !== undefined) updateFields.push(sql`client_number = ${data.client_number}`);
      if (data.client_type !== undefined) updateFields.push(sql`client_type = ${data.client_type}`);
      if (data.client_status !== undefined) updateFields.push(sql`client_status = ${data.client_status}`);
      if (data.primary_contact_name !== undefined) updateFields.push(sql`primary_contact_name = ${data.primary_contact_name}`);
      if (data.primary_email !== undefined) updateFields.push(sql`primary_email = ${data.primary_email}`);
      if (data.primary_phone !== undefined) updateFields.push(sql`primary_phone = ${data.primary_phone}`);
      if (data.tags !== undefined) updateFields.push(sql`tags = ${JSON.stringify(data.tags)}::jsonb`);
      if (data.metadata !== undefined) updateFields.push(sql`metadata = ${JSON.stringify(data.metadata)}::jsonb`);
      if (data.active_flag !== undefined) updateFields.push(sql`active_flag = ${data.active_flag}`);

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated_ts = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.d_client 
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to update client' });
      }

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
      };
      
      return filterUniversalColumns(result[0], userPermissions);
    } catch (error) {
      fastify.log.error('Error updating client:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete client (soft delete)
  fastify.delete('/api/v1/client/:id', {
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
        SELECT id FROM app.d_client WHERE id = ${id}
      `);

      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Client not found' });
      }

      // Soft delete (using SCD Type 2 pattern)
      await db.execute(sql`
        UPDATE app.d_client
        SET active_flag = false, to_ts = NOW(), updated_ts = NOW()
        WHERE id = ${id}
      `);

      return reply.status(204).send();
    } catch (error) {
      fastify.log.error('Error deleting client:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get client projects (child entity route)
  fastify.get('/api/v1/client/:id/project', {
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
      const { id: clientId } = request.params as { id: string };
      const { page = 1, limit = 20 } = request.query as any;
      const userId = (request as any).user?.sub;

      if (!userId) {
        return reply.status(401).send({ error: 'User not authenticated' });
      }

      // Check RBAC for client access
      const clientAccess = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map rbac
        WHERE rbac.empid = ${userId}
          AND rbac.entity = 'client'
          AND (rbac.entity_id = ${clientId}::text OR rbac.entity_id = 'all')
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND 0 = ANY(rbac.permission)
      `);

      if (clientAccess.length === 0) {
        return reply.status(403).send({ error: 'Access denied for this client' });
      }

      // Query child projects linked to this client
      const offset = (page - 1) * limit;
      const projects = await db.execute(sql`
        SELECT p.*
        FROM app.d_project p
        INNER JOIN app.d_entity_id_map eim ON eim.child_entity_id = p.id::text
        WHERE eim.parent_entity_id = ${clientId}
          AND eim.parent_entity_type = 'client'
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
        WHERE eim.parent_entity_id = ${clientId}
          AND eim.parent_entity_type = 'client'
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
      fastify.log.error('Error fetching client projects:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}