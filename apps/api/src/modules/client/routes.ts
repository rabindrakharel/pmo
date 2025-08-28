import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { checkScopeAccess, Permission, applyScopeFiltering } from '../rbac/scope-auth.js';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

const ClientSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  contact: Type.Optional(Type.Object({
    email: Type.Optional(Type.String()),
    phone: Type.Optional(Type.String()),
    website: Type.Optional(Type.String()),
  })),
  tags: Type.Optional(Type.Array(Type.String())),
  created: Type.String(),
  updated: Type.String(),
});

const CreateClientSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  contact: Type.Optional(Type.Object({
    email: Type.Optional(Type.String()),
    phone: Type.Optional(Type.String()),
    website: Type.Optional(Type.String()),
  })),
  tags: Type.Optional(Type.Array(Type.String())),
});

const UpdateClientSchema = Type.Partial(CreateClientSchema);

export async function clientRoutes(fastify: FastifyInstance) {
  // List clients with filtering
  fastify.get('/api/v1/client', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        search: Type.Optional(Type.String()),
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
    const { search, limit = 50, offset = 0 } = request.query as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    };

    // Check if user has access to view clients - use business scope for client access
    const scopeAccess = await checkScopeAccess(userId, 'business', 'view', undefined);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      // Build query conditions
      const conditions = [];
      
      if (search) {
        conditions.push(sql`(
          COALESCE(name, '') ILIKE ${`%${search}%`} OR 
          COALESCE(contact::text, '') ILIKE ${`%${search}%`}
        )`);
      }

      // Get total count
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total 
        FROM app.d_client 
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      // Get paginated results
      const clients = await db.execute(sql`
        SELECT 
          id,
          name,
          contact,
          tags,
          created,
          updated
        FROM app.d_client 
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY name ASC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return {
        data: clients,
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
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    };

    const scopeAccess = await checkScopeAccess(userId, 'business', 'view', undefined);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const client = await db.execute(sql`
        SELECT 
          id,
          name,
          contact,
          tags,
          created,
          updated
        FROM app.d_client 
        WHERE id = ${id}
      `);

      if (client.length === 0) {
        return reply.status(404).send({ error: 'Client not found' });
      }

      return client[0];
    } catch (error) {
      fastify.log.error('Error fetching client:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create client
  fastify.post('/api/v1/client', {
    preHandler: [fastify.authenticate],
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
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    };

    const scopeAccess = await checkScopeAccess(userId, 'business', 'create', undefined);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      // Check for unique client name
      const existingClient = await db.execute(sql`
        SELECT id FROM app.d_client WHERE name = ${data.name}
      `);
      if (existingClient.length > 0) {
        return reply.status(400).send({ error: 'Client with this name already exists' });
      }

      const result = await db.execute(sql`
        INSERT INTO app.d_client (name, contact, tags)
        VALUES (${data.name}, ${data.contact ? JSON.stringify(data.contact) : '{}'}::jsonb, ${data.tags ? JSON.stringify(data.tags) : '[]'}::jsonb)
        RETURNING 
          id,
          name,
          contact,
          tags,
          created,
          updated
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to create client' });
      }

      return reply.status(201).send(result[0]);
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
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    };

    const scopeAccess = await checkScopeAccess(userId, 'business', 'modify', undefined);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      // Check if client exists
      const existing = await db.execute(sql`
        SELECT id FROM app.d_client WHERE id = ${id}
      `);
      
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Client not found' });
      }

      // Check for unique name on update
      if (data.name) {
        const existingName = await db.execute(sql`
          SELECT id FROM app.d_client WHERE name = ${data.name} AND id != ${id}
        `);
        if (existingName.length > 0) {
          return reply.status(400).send({ error: 'Client with this name already exists' });
        }
      }

      // Build update fields
      const updateFields = [];
      
      if (data.name !== undefined) {
        updateFields.push(sql`name = ${data.name}`);
      }
      
      if (data.contact !== undefined) {
        updateFields.push(sql`contact = ${data.contact ? JSON.stringify(data.contact) : '{}'}::jsonb`);
      }
      
      if (data.tags !== undefined) {
        updateFields.push(sql`tags = ${data.tags ? JSON.stringify(data.tags) : '[]'}::jsonb`);
      }

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.d_client 
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING 
          id,
          name,
          contact,
          tags,
          created,
          updated
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to update client' });
      }

      return result[0];
    } catch (error) {
      fastify.log.error('Error updating client:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete client
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
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    };

    const scopeAccess = await checkScopeAccess(userId, 'business', 'delete', undefined);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      // Check if client exists
      const existing = await db.execute(sql`
        SELECT id FROM app.d_client WHERE id = ${id}
      `);
      
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Client not found' });
      }

      // Hard delete for clients (they don't have soft delete in schema)
      await db.execute(sql`
        DELETE FROM app.d_client WHERE id = ${id}
      `);

      return reply.status(204).send();
    } catch (error) {
      fastify.log.error('Error deleting client:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}