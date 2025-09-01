import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { getEmployeeScopeIds, hasPermissionOnScopeId } from '../rbac/ui-api-permission-rbac-gate.js';
import { db } from '@/db/index.js';
import { eq, and, isNull, desc, asc, sql } from 'drizzle-orm';

const ScopeHRSchema = Type.Object({
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

const CreateScopeHRSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  levelId: Type.Number({ minimum: 1, maximum: 8 }),
  parentId: Type.Optional(Type.String({ format: 'uuid' })),
  active: Type.Optional(Type.Boolean()),
  fromTs: Type.Optional(Type.String({ format: 'date-time' })),
});

const UpdateScopeHRSchema = Type.Partial(CreateScopeHRSchema);

export async function scopeHRRoutes(fastify: FastifyInstance) {
  // List HR hierarchy with filtering
  fastify.get('/api/v1/scope/hr', {
    preHandler: [fastify.authenticate],
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
          data: Type.Array(ScopeHRSchema),
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
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    };


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
        FROM app.d_scope_hr 
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      // Get paginated results
      const hrUnits = await db.execute(sql`
        SELECT 
          id,
          name,
          "descr",
          level_id as "levelId",
          parent_id as "parentId",
          active,
          from_ts as "fromTs",
          to_ts as "toTs",
          created,
          updated
        FROM app.d_scope_hr 
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY level_id ASC, name ASC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return {
        data: hrUnits,
        total,
        limit,
        offset,
      };
    } catch (error) {
      fastify.log.error('Error fetching HR hierarchy:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single HR unit
  fastify.get('/api/v1/scope/hr/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: ScopeHRSchema,
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

    const scopeAccess = await hasPermissionOnScopeId(userId, 'hr', id, 'view');
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const hrUnit = await db.execute(sql`
        SELECT 
          id,
          name,
          "descr",
          level_id as "levelId",
          parent_id as "parentId",
          active,
          from_ts as "fromTs",
          to_ts as "toTs",
          created,
          updated
        FROM app.d_scope_hr 
        WHERE id = ${id} AND active = true
      `);

      if (hrUnit.length === 0) {
        return reply.status(404).send({ error: 'HR unit not found' });
      }

      return hrUnit[0];
    } catch (error) {
      fastify.log.error('Error fetching HR unit:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create HR unit
  fastify.post('/api/v1/scope/hr', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateScopeHRSchema,
      response: {
        201: ScopeHRSchema,
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

    // Check if user can create in this scope
    if (data.parentId) {
      const scopeAccess = await hasPermissionOnScopeId(userId, 'hr', data.parentId, 'view');
      if (!scopeAccess.allowed) {
        return reply.status(403).send({ error: 'Insufficient permissions to create in parent scope' });
      }
    }

    try {
      const fromTs = data.fromTs || new Date().toISOString();
      
      const result = await db.execute(sql`
        INSERT INTO app.d_scope_hr (name, "descr", level_id, parent_id, active, from_ts)
        VALUES (${data.name}, ${data.descr || null}, ${data.levelId}, ${data.parentId || null}, ${data.active !== false}, ${fromTs})
        RETURNING 
          id,
          name,
          "descr",
          level_id as "levelId",
          parent_id as "parentId",
          active,
          from_ts as "fromTs",
          to_ts as "toTs",
          created,
          updated
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to create HR unit' });
      }

      return reply.status(201).send(result[0]);
    } catch (error) {
      fastify.log.error('Error creating HR unit:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update HR unit
  fastify.put('/api/v1/scope/hr/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      body: UpdateScopeHRSchema,
      response: {
        200: ScopeHRSchema,
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
      return reply.status(401).send({ error: 'Invalid token' });
    };

    const scopeAccess = await hasPermissionOnScopeId(userId, 'hr', id, 'modify');
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      // Check if HR unit exists
      const existing = await db.execute(sql`
        SELECT id FROM app.d_scope_hr WHERE id = ${id} AND active = true
      `);
      
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'HR unit not found' });
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
        UPDATE app.d_scope_hr 
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING 
          id,
          name,
          "descr",
          level_id as "levelId",
          parent_id as "parentId",
          active,
          from_ts as "fromTs",
          to_ts as "toTs",
          created,
          updated
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to update HR unit' });
      }

      return result[0];
    } catch (error) {
      fastify.log.error('Error updating HR unit:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete HR unit (soft delete)
  fastify.delete('/api/v1/scope/hr/:id', {
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

    const scopeAccess = await hasPermissionOnScopeId(userId, 'hr', id, 'delete');
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      // Check if HR unit exists
      const existing = await db.execute(sql`
        SELECT id FROM app.d_scope_hr WHERE id = ${id} AND active = true
      `);
      
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'HR unit not found' });
      }

      // Check if HR unit has children
      const children = await db.execute(sql`
        SELECT COUNT(*) as count FROM app.d_scope_hr WHERE parent_id = ${id} AND active = true
      `);
      
      if (Number(children[0]?.count || 0) > 0) {
        return reply.status(400).send({ error: 'Cannot delete HR unit with active children' });
      }

      // Soft delete
      await db.execute(sql`
        UPDATE app.d_scope_hr 
        SET active = false, to_ts = NOW(), updated = NOW()
        WHERE id = ${id}
      `);

      return reply.status(204).send();
    } catch (error) {
      fastify.log.error('Error deleting HR unit:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get HR unit hierarchy
  fastify.get('/api/v1/scope/hr/:id/hierarchy', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          hrUnit: ScopeHRSchema,
          children: Type.Array(ScopeHRSchema),
          parent: Type.Optional(ScopeHRSchema),
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
    };

    const scopeAccess = await hasPermissionOnScopeId(userId, 'hr', id, 'view');
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      // Get the HR unit
      const hrUnit = await db.execute(sql`
        SELECT 
          id,
          name,
          "descr",
          level_id as "levelId",
          parent_id as "parentId",
          active,
          from_ts as "fromTs",
          to_ts as "toTs",
          created,
          updated
        FROM app.d_scope_hr 
        WHERE id = ${id} AND active = true
      `);

      if (hrUnit.length === 0) {
        return reply.status(404).send({ error: 'HR unit not found' });
      }

      // Get children
      const children = await db.execute(sql`
        SELECT 
          id,
          name,
          "descr",
          level_id as "levelId",
          parent_id as "parentId",
          active,
          from_ts as "fromTs",
          to_ts as "toTs",
          created,
          updated
        FROM app.d_scope_hr 
        WHERE parent_id = ${id} AND active = true
        ORDER BY level_id ASC, name ASC
      `);

      // Get parent if exists
      let parent = null;
      if (hrUnit[0] && hrUnit[0].parentId) {
        const parentResult = await db.execute(sql`
          SELECT 
            id,
            name,
            "descr",
            level_id as "levelId",
            parent_id as "parentId",
            active,
            from_ts as "fromTs",
            to_ts as "toTs",
            created,
            updated
          FROM app.d_scope_hr 
          WHERE id = ${hrUnit[0].parentId} AND active = true
        `);
        parent = parentResult[0] || null;
      }

      return {
        hrUnit: hrUnit[0],
        children,
        parent,
      };
    } catch (error) {
      fastify.log.error('Error fetching HR hierarchy:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}