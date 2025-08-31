import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { hasPermissionOnAPI } from '../rbac/ui-api-permission-rbac-gate.js';
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
  // Client-specific fields
  client_parent_id: Type.Optional(Type.String()),
  contact: Type.Object({}),
  level_id: Type.Optional(Type.Number()),
  level_name: Type.Optional(Type.String()),
});

const CreateClientSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  client_parent_id: Type.Optional(Type.String({ format: 'uuid' })),
  contact: Type.Optional(Type.Object({})),
  level_id: Type.Optional(Type.Number()),
  level_name: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Array(Type.String())),
  attr: Type.Optional(Type.Object({})),
  active: Type.Optional(Type.Boolean()),
});

const UpdateClientSchema = Type.Partial(CreateClientSchema);

export async function clientRoutes(fastify: FastifyInstance) {
  // List clients with filtering
  fastify.get('/api/v1/client', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        active: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        client_parent_id: Type.Optional(Type.String()),
        level_id: Type.Optional(Type.Number()),
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
    const { active, search, client_parent_id, level_id, limit = 50, offset = 0 } = request.query as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    const hasAccess = await hasPermissionOnAPI(userId, 'app:api', '/api/v1/client', 'view');
    if (!hasAccess) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const conditions = [];
      
      if (active !== undefined) {
        conditions.push(sql`active = ${active}`);
      }
      
      if (client_parent_id) {
        conditions.push(sql`client_parent_id = ${client_parent_id}`);
      }
      
      if (level_id !== undefined) {
        conditions.push(sql`level_id = ${level_id}`);
      }
      
      if (search) {
        const searchableColumns = getColumnsByMetadata([
          'name', 'descr', 'level_name'
        ], 'ui:search');
        
        const searchConditions = searchableColumns.map(col => 
          sql`COALESCE(${sql.identifier(col)}, '') ILIKE ${`%${search}%`}`
        );
        
        // Also search in contact JSON
        searchConditions.push(sql`COALESCE(contact::text, '') ILIKE ${`%${search}%`}`);
        
        if (searchConditions.length > 0) {
          conditions.push(sql`(${sql.join(searchConditions, sql` OR `)})`);
        }
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
          client_parent_id, contact, level_id, level_name
        FROM app.d_client 
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY name ASC NULLS LAST, created DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const userPermissions = {
        canSeePII: scopeAccess.permissions?.includes(4) || false,
        canSeeFinancial: scopeAccess.permissions?.includes(4) || false,
        canSeeSystemFields: scopeAccess.permissions?.includes(4) || false,
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
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    const hasAccess = await hasPermissionOnAPI(userId, 'app:api', '/api/v1/client', 'view');
    if (!hasAccess) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const client = await db.execute(sql`
        SELECT 
          id, name, "descr", tags, attr, from_ts, to_ts, active, created, updated,
          client_parent_id, contact, level_id, level_name
        FROM app.d_client 
        WHERE id = ${id}
      `);

      if (client.length === 0) {
        return reply.status(404).send({ error: 'Client not found' });
      }

      const userPermissions = {
        canSeePII: scopeAccess.permissions?.includes(4) || false,
        canSeeFinancial: scopeAccess.permissions?.includes(4) || false,
        canSeeSystemFields: scopeAccess.permissions?.includes(4) || false,
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
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    const hasAccess = await hasPermissionOnAPI(userId, 'app:api', '/api/v1/client', 'view');
    if (!hasAccess) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      // Get the client
      const clientResult = await db.execute(sql`
        SELECT 
          id, name, "descr", tags, attr, from_ts, to_ts, active, created, updated,
          client_parent_id, contact, level_id, level_name
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
            client_parent_id, contact, level_id, level_name
          FROM app.d_client 
          WHERE id = ${client.client_parent_id}
        `);
        parent = parentResult[0] || null;
      }

      // Get children
      const children = await db.execute(sql`
        SELECT 
          id, name, "descr", tags, attr, from_ts, to_ts, active, created, updated,
          client_parent_id, contact, level_id, level_name
        FROM app.d_client 
        WHERE client_parent_id = ${id}
        ORDER BY name ASC
      `);

      const userPermissions = {
        canSeePII: scopeAccess.permissions?.includes(4) || false,
        canSeeFinancial: scopeAccess.permissions?.includes(4) || false,
        canSeeSystemFields: scopeAccess.permissions?.includes(4) || false,
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
    }

    const hasAccess = await hasPermissionOnAPI(userId, 'app:api', '/api/v1/client', 'create');
    if (!hasAccess) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      // Check for unique client name at the same level
      const existingClient = await db.execute(sql`
        SELECT id FROM app.d_client 
        WHERE name = ${data.name} 
        AND client_parent_id IS NOT DISTINCT FROM ${data.client_parent_id || null}
        AND active = true
      `);
      if (existingClient.length > 0) {
        return reply.status(400).send({ error: 'Client with this name already exists at this level' });
      }

      // Validate parent exists if specified
      if (data.client_parent_id) {
        const parent = await db.execute(sql`
          SELECT id FROM app.d_client WHERE id = ${data.client_parent_id} AND active = true
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
        canSeeFinancial: scopeAccess.permissions?.includes(4) || false,
        canSeeSystemFields: scopeAccess.permissions?.includes(4) || false,
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
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    const hasAccess = await hasPermissionOnAPI(userId, 'app:api', '/api/v1/client', 'modify');
    if (!hasAccess) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

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
          AND active = true
        `);
        if (existingName.length > 0) {
          return reply.status(400).send({ error: 'Client with this name already exists at this level' });
        }
      }

      // Validate parent exists if specified
      if (data.client_parent_id) {
        const parent = await db.execute(sql`
          SELECT id FROM app.d_client WHERE id = ${data.client_parent_id} AND active = true
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
      if (data.active !== undefined) updateFields.push(sql`active = ${data.active}`);

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
        canSeePII: scopeAccess.permissions?.includes(4) || false,
        canSeeFinancial: scopeAccess.permissions?.includes(4) || false,
        canSeeSystemFields: scopeAccess.permissions?.includes(4) || false,
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
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    const hasAccess = await hasPermissionOnAPI(userId, 'app:api', '/api/v1/client', 'delete');
    if (!hasAccess) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const existing = await db.execute(sql`
        SELECT id FROM app.d_client WHERE id = ${id}
      `);
      
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Client not found' });
      }

      // Check if client has children
      const children = await db.execute(sql`
        SELECT id FROM app.d_client WHERE client_parent_id = ${id} AND active = true
      `);

      if (children.length > 0) {
        return reply.status(400).send({ 
          error: 'Cannot delete client with active sub-clients. Delete or reassign sub-clients first.' 
        });
      }

      // Soft delete (using SCD Type 2 pattern)
      await db.execute(sql`
        UPDATE app.d_client 
        SET active = false, to_ts = NOW(), updated = NOW()
        WHERE id = ${id}
      `);

      return reply.status(204).send();
    } catch (error) {
      fastify.log.error('Error deleting client:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}