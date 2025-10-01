import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { 
  getUniversalColumnMetadata, 
  filterUniversalColumns,
  getColumnsByMetadata 
} from '../../lib/universal-schema-metadata.js';

// Schema based on actual d_client table structure from db/07_client.ddl
const ClientSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  tags: Type.Array(Type.String()),
  attr: Type.Object({}),
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.String()),
  active: Type.Boolean(),
  created: Type.String(),
  updated: Type.String(),
  // Client-specific fields - match actual d_client table
  client_number: Type.String(),
  client_type: Type.String(),
  client_status: Type.String(),
  primary_contact_name: Type.Optional(Type.String()),
  primary_email: Type.Optional(Type.String()),
  primary_phone: Type.Optional(Type.String()),
  biz_id: Type.Optional(Type.String()),
  org_id: Type.Optional(Type.String()),
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
  biz_id: Type.Optional(Type.String({ format: 'uuid' })),
  org_id: Type.Optional(Type.String({ format: 'uuid' })),
  tags: Type.Optional(Type.Array(Type.String())),
  attr: Type.Optional(Type.Object({})),
  active: Type.Optional(Type.Boolean()),
});

const UpdateClientSchema = Type.Partial(CreateClientSchema);

export async function clientRoutes(fastify: FastifyInstance) {
  // List clients with filtering
  fastify.get('/api/v1/client', {
    schema: {
      querystring: Type.Object({
        active: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        client_type: Type.Optional(Type.String()),
        biz_id: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(ClientSchema),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number(),
        }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { active, search, client_type, biz_id, limit = 50, offset = 0 } = request.query as any;


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
          id, name, "descr", tags, attr, from_ts, to_ts, active, created, updated,
          client_number, client_type, client_status, primary_contact_name, 
          primary_email, primary_phone, biz_id, org_id
        FROM app.d_client 
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY name ASC NULLS LAST, created DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
      };
      
      const filteredData = clients.map(client => 
        filterUniversalColumns(client, userPermissions)
      );

      return {
        data: filteredData,
        total,
        limit,
        offset,
      };
    } catch (error) {
      fastify.log.error('Error fetching clients:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
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
          id, name, "descr", tags, attr, from_ts, to_ts, active, created, updated,
          client_number, client_type, client_status, primary_contact_name, 
          primary_email, primary_phone, biz_id, org_id
        FROM app.d_client 
        WHERE id = ${id}
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
          id, name, "descr", tags, attr, from_ts, to_ts, active, created, updated,
          client_number, client_type, client_status, primary_contact_name, 
          primary_email, primary_phone, biz_id, org_id
        FROM app.d_client 
        WHERE id = ${id}
      `);

      if (clientResult.length === 0) {
        return reply.status(404).send({ error: 'Client not found' });
      }

      const client = clientResult[0];

      if (!client) {
        return reply.status(404).send({ error: 'Client not found' });
      }

      // Get parent if exists
      let parent = null;
      if (client.client_parent_id) {
        const parentResult = await db.execute(sql`
          SELECT 
            id, name, "descr", tags, attr, from_ts, to_ts, active, created, updated,
            client_number, client_type, client_status, primary_contact_name, 
          primary_email, primary_phone, biz_id, org_id
          FROM app.d_client 
          WHERE id = ${client.client_parent_id}
        `);
        parent = parentResult[0] || null;
      }

      // Get children
      const children = await db.execute(sql`
        SELECT 
          id, name, "descr", tags, attr, from_ts, to_ts, active, created, updated,
          client_number, client_type, client_status, primary_contact_name, 
          primary_email, primary_phone, biz_id, org_id
        FROM app.d_client 
        WHERE client_parent_id = ${id}
        ORDER BY name ASC
      `);

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
      // Check for unique client name at the same level
      const existingClient = await db.execute(sql`
        SELECT id FROM app.d_client 
        WHERE name = ${data.name} 
        AND client_parent_id IS NOT DISTINCT FROM ${data.client_parent_id || null}
        AND active_flag = true
      `);
      if (existingClient.length > 0) {
        return reply.status(400).send({ error: 'Client with this name already exists at this level' });
      }

      // Validate parent exists if specified
      if (data.client_parent_id) {
        const parent = await db.execute(sql`
          SELECT id FROM app.d_client WHERE id = ${data.client_parent_id} AND active_flag = true
        `);
        if (parent.length === 0) {
          return reply.status(400).send({ error: 'Parent client not found' });
        }
      }

      const result = await db.execute(sql`
        INSERT INTO app.d_client (
          name, "descr", client_parent_id, contact, level_id, level_name,
          tags, attr, active
        )
        VALUES (
          ${data.name}, 
          ${data.descr || null}, 
          ${data.client_parent_id || null}, 
          ${data.contact ? JSON.stringify(data.contact) : '{}'}::jsonb,
          ${data.level_id || null},
          ${data.level_name || null},
          ${data.tags ? JSON.stringify(data.tags) : '[]'}::jsonb,
          ${data.attr ? JSON.stringify(data.attr) : '{}'}::jsonb,
          ${data.active !== false}
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
        SELECT id, client_parent_id FROM app.d_client WHERE id = ${id}
      `);
      
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Client not found' });
      }

      // Check for unique name on update
      if (data.name !== undefined) {
        const parentId = data.client_parent_id !== undefined ? data.client_parent_id : existing[0].client_parent_id;
        const existingName = await db.execute(sql`
          SELECT id FROM app.d_client 
          WHERE name = ${data.name} 
          AND client_parent_id IS NOT DISTINCT FROM ${parentId || null}
          AND id != ${id} 
          AND active_flag = true
        `);
        if (existingName.length > 0) {
          return reply.status(400).send({ error: 'Client with this name already exists at this level' });
        }
      }

      // Validate parent exists if specified
      if (data.client_parent_id) {
        const parent = await db.execute(sql`
          SELECT id FROM app.d_client WHERE id = ${data.client_parent_id} AND active_flag = true
        `);
        if (parent.length === 0) {
          return reply.status(400).send({ error: 'Parent client not found' });
        }
      }

      const updateFields = [];
      
      if (data.name !== undefined) updateFields.push(sql`name = ${data.name}`);
      if (data.descr !== undefined) updateFields.push(sql`"descr" = ${data.descr}`);
      if (data.client_parent_id !== undefined) updateFields.push(sql`client_parent_id = ${data.client_parent_id}`);
      if (data.contact !== undefined) updateFields.push(sql`contact = ${JSON.stringify(data.contact)}::jsonb`);
      if (data.level_id !== undefined) updateFields.push(sql`level_id = ${data.level_id}`);
      if (data.level_name !== undefined) updateFields.push(sql`level_name = ${data.level_name}`);
      if (data.tags !== undefined) updateFields.push(sql`tags = ${JSON.stringify(data.tags)}::jsonb`);
      if (data.attr !== undefined) updateFields.push(sql`attr = ${JSON.stringify(data.attr)}::jsonb`);
      if (data.active !== undefined) updateFields.push(sql`active_flag = ${data.active}`);

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated = NOW()`);

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

      // Check if client has children
      const children = await db.execute(sql`
        SELECT id FROM app.d_client WHERE client_parent_id = ${id} AND active_flag = true
      `);

      if (children.length > 0) {
        return reply.status(400).send({ 
          error: 'Cannot delete client with active sub-clients. Delete or reassign sub-clients first.' 
        });
      }

      // Soft delete (using SCD Type 2 pattern)
      await db.execute(sql`
        UPDATE app.d_client 
        SET active_flag = false, to_ts = NOW(), updated = NOW()
        WHERE id = ${id}
      `);

      return reply.status(204).send();
    } catch (error) {
      fastify.log.error('Error deleting client:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}