import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { eq, and, isNull, desc, asc, sql } from 'drizzle-orm';

const ScopeBusinessSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  levelId: Type.Number(),
  parentId: Type.Optional(Type.String()),
  active: Type.Boolean(),
  fromTs: Type.String(),
  toTs: Type.Optional(Type.String()),
  created: Type.String(),
  updated: Type.String(),
});

const CreateScopeBusinessSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  levelId: Type.Number({ minimum: 1, maximum: 5 }),
  parentId: Type.Optional(Type.String({ format: 'uuid' })),
  active: Type.Optional(Type.Boolean()),
  fromTs: Type.Optional(Type.String({ format: 'date-time' })),
});

const UpdateScopeBusinessSchema = Type.Partial(CreateScopeBusinessSchema);

export async function scopeBusinessRoutes(fastify: FastifyInstance) {
  // List business units with filtering
  fastify.get('/api/v1/scope/business', {
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
          data: Type.Array(ScopeBusinessSchema),
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
        FROM app.d_scope_business 
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      // Get paginated results
      const businessUnits = await db.execute(sql`
        SELECT 
          id,
          name,
          "descr",
          level_id as "levelId",
          level_name as "levelName",
          parent_id as "parentId",
          active,
          from_ts as "fromTs",
          to_ts as "toTs",
          created,
          updated
        FROM app.d_scope_business 
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY level_id ASC, name ASC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return {
        data: businessUnits,
        total,
        limit,
        offset,
      };
    } catch (error) {
      fastify.log.error('Error fetching business units:');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single business unit
  fastify.get('/api/v1/scope/business/:id', {
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: ScopeBusinessSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    // Permission check removed - allow all authenticated users

    try {
      const businessUnit = await db.execute(sql`
        SELECT 
          id,
          name,
          "descr",
          level_id as "levelId",
          level_name as "levelName",
          parent_id as "parentId",
          active,
          from_ts as "fromTs",
          to_ts as "toTs",
          created,
          updated
        FROM app.d_scope_business 
        WHERE id = ${id} AND active = true
      `);

      if (businessUnit.length === 0) {
        return reply.status(404).send({ error: 'Business unit not found' });
      }

      return businessUnit[0];
    } catch (error) {
      fastify.log.error('Error fetching business unit:');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create business unit
  fastify.post('/api/v1/scope/business', {
    schema: {
      body: CreateScopeBusinessSchema,
      response: {
        201: ScopeBusinessSchema,
        403: Type.Object({ error: Type.String() }),
        400: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const data = request.body as any;


    // Permission check removed - allow all authenticated users

    try {
      const fromTs = data.fromTs || new Date().toISOString();
      
      const result = await db.execute(sql`
        INSERT INTO app.d_scope_business (name, "descr", level_id, parent_id, active, from_ts)
        VALUES (${data.name}, ${data.descr || null}, ${data.levelId}, ${data.parentId || null}, ${data.active !== false}, ${fromTs})
        RETURNING 
          id,
          name,
          "descr",
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
        return reply.status(500).send({ error: 'Failed to create business unit' });
      }

      return reply.status(201).send(result[0]);
    } catch (error) {
      fastify.log.error('Error creating business unit:');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update business unit
  fastify.put('/api/v1/scope/business/:id', {
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      body: UpdateScopeBusinessSchema,
      response: {
        200: ScopeBusinessSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;

    // Permission check removed - allow all authenticated users

    try {
      // Check if business unit exists
      const existing = await db.execute(sql`
        SELECT id FROM app.d_scope_business WHERE id = ${id} AND active = true
      `);
      
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Business unit not found' });
      }

      // Build update fields
      const updateFields = [];
      
      if (data.name !== undefined) {
        updateFields.push(sql`name = ${data.name}`);
      }
      
      if (data.descr !== undefined) {
        updateFields.push(sql`"descr" = ${data.descr}`);
      }
      
      if (data.levelId !== undefined) {
        updateFields.push(sql`level_id = ${data.levelId}`);
      }
      
      if (data.parentId !== undefined) {
        updateFields.push(sql`parent_id = ${data.parentId}`);
      }
      
      if (data.active !== undefined) {
        updateFields.push(sql`active = ${data.active}`);
      }

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.d_scope_business 
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING 
          id,
          name,
          "descr",
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
        return reply.status(500).send({ error: 'Failed to update business unit' });
      }

      return result[0];
    } catch (error) {
      fastify.log.error('Error updating business unit:');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete business unit (soft delete)
  fastify.delete('/api/v1/scope/business/:id', {
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

    // Permission check removed - allow all authenticated users

    try {
      // Check if business unit exists
      const existing = await db.execute(sql`
        SELECT id FROM app.d_scope_business WHERE id = ${id} AND active = true
      `);
      
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Business unit not found' });
      }

      // Check if business unit has children
      const children = await db.execute(sql`
        SELECT COUNT(*) as count FROM app.d_scope_business WHERE parent_id = ${id} AND active = true
      `);
      
      if (Number(children[0]?.count || 0) > 0) {
        return reply.status(400).send({ error: 'Cannot delete business unit with active children' });
      }

      // Soft delete
      await db.execute(sql`
        UPDATE app.d_scope_business 
        SET active = false, to_ts = NOW(), updated = NOW()
        WHERE id = ${id}
      `);

      return reply.status(204).send();
    } catch (error) {
      fastify.log.error('Error deleting business unit:');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get business hierarchy
  fastify.get('/api/v1/scope/business/:id/hierarchy', {
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          business: ScopeBusinessSchema,
          children: Type.Array(ScopeBusinessSchema),
          parent: Type.Optional(ScopeBusinessSchema),
        }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    // Permission check removed - allow all authenticated users

    try {
      // Get the business unit
      const businessUnit = await db.execute(sql`
        SELECT 
          id,
          name,
          "descr",
          level_id as "levelId",
          level_name as "levelName",
          parent_id as "parentId",
          active,
          from_ts as "fromTs",
          to_ts as "toTs",
          created,
          updated
        FROM app.d_scope_business 
        WHERE id = ${id} AND active = true
      `);

      if (businessUnit.length === 0) {
        return reply.status(404).send({ error: 'Business unit not found' });
      }

      // Get children
      const children = await db.execute(sql`
        SELECT 
          id,
          name,
          "descr",
          level_id as "levelId",
          level_name as "levelName",
          parent_id as "parentId",
          active,
          from_ts as "fromTs",
          to_ts as "toTs",
          created,
          updated
        FROM app.d_scope_business 
        WHERE parent_id = ${id} AND active = true
        ORDER BY level_id ASC, name ASC
      `);

      // Get parent if exists
      let parent = null;
      if (businessUnit[0] && businessUnit[0].parentId) {
        const parentResult = await db.execute(sql`
          SELECT 
            id,
            name,
            "descr",
            level_id as "levelId",
          level_name as "levelName",
            parent_id as "parentId",
            active,
            from_ts as "fromTs",
            to_ts as "toTs",
            created,
            updated
          FROM app.d_scope_business 
          WHERE id = ${businessUnit[0].parentId} AND active = true
        `);
        parent = parentResult[0] || null;
      }

      return {
        business: businessUnit[0],
        children,
        parent,
      };
    } catch (error) {
      fastify.log.error('Error fetching business hierarchy:');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}