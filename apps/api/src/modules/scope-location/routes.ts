import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { eq, and, isNull, desc, asc, sql } from 'drizzle-orm';

const ScopeLocationSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  addr: Type.Optional(Type.String()),
  levelId: Type.Number(),
  parentId: Type.Optional(Type.String()),
  active: Type.Boolean(),
  fromTs: Type.String(),
  toTs: Type.Optional(Type.String()),
  created: Type.String(),
  updated: Type.String(),
});

const CreateScopeLocationSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  addr: Type.Optional(Type.String()),
  levelId: Type.Number({ minimum: 1, maximum: 5 }),
  parentId: Type.Optional(Type.String({ format: 'uuid' })),
  active: Type.Optional(Type.Boolean()),
  fromTs: Type.Optional(Type.String({ format: 'date-time' })),
});

const UpdateScopeLocationSchema = Type.Partial(CreateScopeLocationSchema);

export async function scopeLocationRoutes(fastify: FastifyInstance) {
  // List locations with filtering
  fastify.get('/api/v1/scope/location', {
    schema: {
      querystring: Type.Object({
        levelId: Type.Optional(Type.Number()),
        parentId: Type.Optional(Type.String()),
        active: Type.Optional(Type.Boolean()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(ScopeLocationSchema),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number(),
        }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { levelId, parentId, active, limit = 50, offset = 0 } = request.query as any;


    try {
      // Build query conditions
      const conditions = [];
      
      if (levelId !== undefined) {
        conditions.push(sql`level_id = ${levelId}`);
      }
      
      if (parentId !== undefined) {
        if (parentId === 'null') {
          conditions.push(isNull(sql`parent_id`));
        } else {
          conditions.push(sql`parent_id = ${parentId}`);
        }
      }
      
      if (active !== undefined) {
        conditions.push(sql`active = ${active}`);
      }

      // Get total count
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total 
        FROM app.d_scope_location 
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      // Get paginated results
      const locations = await db.execute(sql`
        SELECT 
          id,
          name,
          "descr",
          addr,
          level_id as "levelId",
          level_name as "levelName",
          parent_id as "parentId",
          active,
          from_ts as "fromTs",
          to_ts as "toTs",
          created,
          updated
        FROM app.d_scope_location 
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY level_id ASC, name ASC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return {
        data: locations,
        total,
        limit,
        offset,
      };
    } catch (error) {
      fastify.log.error('Error fetching locations: ' + String(error));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single location
  fastify.get('/api/v1/scope/location/:id', {
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: ScopeLocationSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const location = await db.execute(sql`
        SELECT 
          id,
          name,
          "descr",
          addr,
          level_id as "levelId",
          level_name as "levelName",
          parent_id as "parentId",
          active,
          from_ts as "fromTs",
          to_ts as "toTs",
          created,
          updated
        FROM app.d_scope_location 
        WHERE id = ${id} AND active = true
      `);

      if (location.length === 0) {
        return reply.status(404).send({ error: 'Location not found' });
      }

      return location[0];
    } catch (error) {
      fastify.log.error('Error fetching location: ' + String(error));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create location
  fastify.post('/api/v1/scope/location', {
    schema: {
      body: CreateScopeLocationSchema,
      response: {
        201: ScopeLocationSchema,
        403: Type.Object({ error: Type.String() }),
        400: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const data = request.body as any;


    try {
      const fromTs = data.fromTs || new Date().toISOString();
      
      const result = await db.execute(sql`
        INSERT INTO app.d_scope_location (name, "descr", addr, level_id, parent_id, active, from_ts)
        VALUES (${data.name}, ${data.descr || null}, ${data.addr || null}, ${data.levelId}, ${data.parentId || null}, ${data.active !== false}, ${fromTs})
        RETURNING 
          id,
          name,
          "descr",
          addr,
          level_id as "levelId",
          level_name as "levelName",
          parent_id as "parentId",
          active,
          from_ts as "fromTs",
          to_ts as "toTs",
          created,
          updated
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to create location' });
      }

      return reply.status(201).send(result[0]);
    } catch (error) {
      fastify.log.error('Error creating location: ' + String(error));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update location
  fastify.put('/api/v1/scope/location/:id', {
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      body: UpdateScopeLocationSchema,
      response: {
        200: ScopeLocationSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;

    try {
      // Check if location exists
      const existing = await db.execute(sql`
        SELECT id FROM app.d_scope_location WHERE id = ${id} AND active = true
      `);
      
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Location not found' });
      }

      // Build update fields
      const updateFields = [];
      const values = [];
      
      if (data.name !== undefined) {
        updateFields.push(sql`name = $${values.length + 1}`);
        values.push(data.name);
      }
      
      if (data.descr !== undefined) {
        updateFields.push(sql`"descr" = $${values.length + 1}`);
        values.push(data.descr);
      }
      
      if (data.addr !== undefined) {
        updateFields.push(sql`addr = $${values.length + 1}`);
        values.push(data.addr);
      }
      
      if (data.levelId !== undefined) {
        updateFields.push(sql`level_id = $${values.length + 1}`);
        values.push(data.levelId);
      }
      
      if (data.parentId !== undefined) {
        updateFields.push(sql`parent_id = $${values.length + 1}`);
        values.push(data.parentId);
      }
      
      if (data.active !== undefined) {
        updateFields.push(sql`active = $${values.length + 1}`);
        values.push(data.active);
      }

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.d_scope_location 
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING 
          id,
          name,
          "descr",
          addr,
          level_id as "levelId",
          level_name as "levelName",
          parent_id as "parentId",
          active,
          from_ts as "fromTs",
          to_ts as "toTs",
          created,
          updated
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to update location' });
      }

      return result[0];
    } catch (error) {
      fastify.log.error('Error updating location: ' + String(error));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete location (soft delete)
  fastify.delete('/api/v1/scope/location/:id', {
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

    try {
      // Check if location exists
      const existing = await db.execute(sql`
        SELECT id FROM app.d_scope_location WHERE id = ${id} AND active = true
      `);
      
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Location not found' });
      }

      // Check if location has children
      const children = await db.execute(sql`
        SELECT COUNT(*) as count FROM app.d_scope_location WHERE parent_id = ${id} AND active = true
      `);
      
      if (Number(children[0]?.count || 0) > 0) {
        return reply.status(400).send({ error: 'Cannot delete location with active children' });
      }

      // Soft delete
      await db.execute(sql`
        UPDATE app.d_scope_location 
        SET active = false, to_ts = NOW(), updated = NOW()
        WHERE id = ${id}
      `);

      return reply.status(204).send();
    } catch (error) {
      fastify.log.error('Error deleting location: ' + String(error));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get location hierarchy
  fastify.get('/api/v1/scope/location/:id/hierarchy', {
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          location: ScopeLocationSchema,
          children: Type.Array(ScopeLocationSchema),
          parent: Type.Optional(ScopeLocationSchema),
        }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      // Get the location
      const location = await db.execute(sql`
        SELECT 
          id,
          name,
          "descr",
          addr,
          level_id as "levelId",
          level_name as "levelName",
          parent_id as "parentId",
          active,
          from_ts as "fromTs",
          to_ts as "toTs",
          created,
          updated
        FROM app.d_scope_location 
        WHERE id = ${id} AND active = true
      `);

      if (location.length === 0) {
        return reply.status(404).send({ error: 'Location not found' });
      }

      // Get children
      const children = await db.execute(sql`
        SELECT 
          id,
          name,
          "descr",
          addr,
          level_id as "levelId",
          level_name as "levelName",
          parent_id as "parentId",
          active,
          from_ts as "fromTs",
          to_ts as "toTs",
          created,
          updated
        FROM app.d_scope_location 
        WHERE parent_id = ${id} AND active = true
        ORDER BY level_id ASC, name ASC
      `);

      // Get parent if exists
      let parent = null;
      if (location[0] && location[0].parentId) {
        const parentResult = await db.execute(sql`
          SELECT 
            id,
            name,
            "descr",
            addr,
            level_id as "levelId",
          level_name as "levelName",
            parent_id as "parentId",
            active,
            from_ts as "fromTs",
            to_ts as "toTs",
            created,
            updated
          FROM app.d_scope_location 
          WHERE id = ${location[0].parentId} AND active = true
        `);
        parent = parentResult[0] || null;
      }

      return {
        location: location[0],
        children,
        parent,
      };
    } catch (error) {
      fastify.log.error('Error fetching location hierarchy: ' + String(error));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}