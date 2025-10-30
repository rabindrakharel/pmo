import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import {
  getUniversalColumnMetadata,
  filterUniversalColumns,
  getColumnsByMetadata
} from '../../lib/universal-schema-metadata.js';

// Schema based on d_position table structure
const PositionSchema = Type.Object({
  id: Type.String(),
  // Standard fields
  code: Type.Optional(Type.String()),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.String()),
  active_flag: Type.Boolean(),
  created_ts: Type.String(),
  updated_ts: Type.String(),
  version: Type.Number(),

  // Entity metadata
  metadata: Type.Optional(Type.Object({})),

  // Hierarchical structure
  level_id: Type.Number(),
  dl__position_level: Type.String(),
  leaf_level_flag: Type.Boolean(),
  root_level_flag: Type.Boolean(),
  parent_id: Type.Optional(Type.String()),

  // Position attributes
  management_flag: Type.Boolean(),
  executive_flag: Type.Boolean(),

  // Compensation and authority
  salary_band_min: Type.Optional(Type.Number()),
  salary_band_max: Type.Optional(Type.Number()),
  bonus_target_pct: Type.Optional(Type.Number()),
  equity_eligible_flag: Type.Optional(Type.Boolean()),
  approval_limit: Type.Optional(Type.Number()),

  // Organizational capacity
  direct_reports_max: Type.Optional(Type.Number()),
  remote_eligible_flag: Type.Optional(Type.Boolean()),
});

const CreatePositionSchema = Type.Object({
  code: Type.Optional(Type.String()),
  name: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Object({})),
  level_id: Type.Number(),
  dl__position_level: Type.String(),
  leaf_level_flag: Type.Optional(Type.Boolean()),
  root_level_flag: Type.Optional(Type.Boolean()),
  parent_id: Type.Optional(Type.String()),
  management_flag: Type.Optional(Type.Boolean()),
  executive_flag: Type.Optional(Type.Boolean()),
  salary_band_min: Type.Optional(Type.Number()),
  salary_band_max: Type.Optional(Type.Number()),
  bonus_target_pct: Type.Optional(Type.Number()),
  equity_eligible_flag: Type.Optional(Type.Boolean()),
  approval_limit: Type.Optional(Type.Number()),
  direct_reports_max: Type.Optional(Type.Number()),
  remote_eligible_flag: Type.Optional(Type.Boolean()),
});

const UpdatePositionSchema = Type.Partial(CreatePositionSchema);

export async function positionRoutes(fastify: FastifyInstance) {
  // List positions
  fastify.get('/api/v1/position', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        active: Type.Optional(Type.Boolean()),
        level_id: Type.Optional(Type.Number()),
        management_flag: Type.Optional(Type.Boolean()),
        executive_flag: Type.Optional(Type.Boolean()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
        search: Type.Optional(Type.String()),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(PositionSchema),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number(),
        }),
        401: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const {
        active = true,
        level_id,
        management_flag,
        executive_flag,
        limit = 20,
        offset = 0,
        search
      } = request.query as any;

      // Build where conditions
      const conditions = [];
      if (active !== undefined) {
        conditions.push(sql`active_flag = ${active}`);
      }
      if (level_id !== undefined) {
        conditions.push(sql`level_id = ${level_id}`);
      }
      if (management_flag !== undefined) {
        conditions.push(sql`management_flag = ${management_flag}`);
      }
      if (executive_flag !== undefined) {
        conditions.push(sql`executive_flag = ${executive_flag}`);
      }
      if (search) {
        conditions.push(sql`(name ILIKE ${'%' + search + '%'} OR descr ILIKE ${'%' + search + '%'})`);
      }

      // Get total count
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.d_position
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      const positions = await db.execute(sql`
        SELECT
          id, code, name, "descr", from_ts, to_ts, active_flag,
          created_ts, updated_ts, version, metadata, level_id, dl__position_level,
          leaf_level_flag, root_level_flag, parent_id, management_flag, executive_flag,
          salary_band_min, salary_band_max, bonus_target_pct, equity_eligible_flag,
          approval_limit, direct_reports_max, remote_eligible_flag,
          -- Include parent position name for display
          (SELECT name FROM app.d_position parent WHERE parent.id = d_position.parent_id) as parent_position_name
        FROM app.d_position
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY level_id ASC, name ASC NULLS LAST
        LIMIT ${limit} OFFSET ${offset}
      `);

      return {
        data: positions,
        total,
        limit,
        offset,
      };
    } catch (error) {
      fastify.log.error('Error fetching positions:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single position
  fastify.get('/api/v1/position/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      response: {
        200: PositionSchema,
        404: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const position = await db.execute(sql`
        SELECT
          id, code, name, "descr", from_ts, to_ts, active_flag,
          created_ts, updated_ts, version, metadata, level_id, dl__position_level,
          leaf_level_flag, root_level_flag, parent_id, management_flag, executive_flag,
          salary_band_min, salary_band_max, bonus_target_pct, equity_eligible_flag,
          approval_limit, direct_reports_max, remote_eligible_flag,
          -- Include parent position name for display
          (SELECT name FROM app.d_position parent WHERE parent.id = d_position.parent_id) as parent_position_name
        FROM app.d_position
        WHERE id = ${id}
      `);

      if (position.length === 0) {
        return reply.status(404).send({ error: 'Position not found' });
      }

      return position[0];
    } catch (error) {
      fastify.log.error('Error fetching position:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create position
  fastify.post('/api/v1/position', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreatePositionSchema,
      response: {
        201: PositionSchema,
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const data = request.body as any;

    try {
      // Validate parent position exists if provided
      if (data.parent_id) {
        const parentPosition = await db.execute(sql`
          SELECT id FROM app.d_position WHERE id = ${data.parent_id} AND active_flag = true
        `);
        if (parentPosition.length === 0) {
          return reply.status(400).send({ error: 'Parent position not found' });
        }
      }

      // Determine hierarchy flags
      const root_level_flag = !data.parent_id;
      const leaf_level_flag = false; // Will be updated based on actual hierarchy rules

      const result = await db.execute(sql`
        INSERT INTO app.d_position (
          code, name, "descr", metadata, level_id, dl__position_level,
          leaf_level_flag, root_level_flag, parent_id, management_flag, executive_flag,
          salary_band_min, salary_band_max, bonus_target_pct, equity_eligible_flag,
          approval_limit, direct_reports_max, remote_eligible_flag
        )
        VALUES (
          ${data.slug || null},
          ${data.code || null},
          ${data.name},
          ${data.descr || null},
          ${JSON.stringify(data.tags || [])},
          ${JSON.stringify(data.metadata || {})},
          ${data.level_id},
          ${data.dl__position_level},
          ${data.leaf_level_flag || leaf_level_flag},
          ${data.root_level_flag || root_level_flag},
          ${data.parent_id || null},
          ${data.management_flag || false},
          ${data.executive_flag || false},
          ${data.salary_band_min || null},
          ${data.salary_band_max || null},
          ${data.bonus_target_pct || null},
          ${data.equity_eligible_flag || false},
          ${data.approval_limit || null},
          ${data.direct_reports_max || null},
          ${data.remote_eligible_flag || false}
        )
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to create position' });
      }

      reply.status(201);
      return result[0];
    } catch (error) {
      fastify.log.error('Error creating position:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update position
  fastify.put('/api/v1/position/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      body: UpdatePositionSchema,
      response: {
        200: PositionSchema,
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;

    try {
      // Check if position exists
      const existing = await db.execute(sql`
        SELECT id FROM app.d_position WHERE id = ${id}
      `);

      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Position not found' });
      }

      // Validate parent position exists if provided
      if (data.parent_id) {
        const parentPosition = await db.execute(sql`
          SELECT id FROM app.d_position WHERE id = ${data.parent_id} AND active_flag = true
        `);
        if (parentPosition.length === 0) {
          return reply.status(400).send({ error: 'Parent position not found' });
        }
      }

      // Build update fields
      const updateFields = [];
      if (data.slug !== undefined) updateFields.push(sql`slug = ${data.slug}`);
      if (data.code !== undefined) updateFields.push(sql`code = ${data.code}`);
      if (data.name !== undefined) updateFields.push(sql`name = ${data.name}`);
      if (data.descr !== undefined) updateFields.push(sql`"descr" = ${data.descr}`);
      if (data.tags !== undefined) updateFields.push(sql`tags = ${JSON.stringify(data.tags)}`);
      if (data.metadata !== undefined) updateFields.push(sql`metadata = ${JSON.stringify(data.metadata)}`);
      if (data.level_id !== undefined) updateFields.push(sql`level_id = ${data.level_id}`);
      if (data.dl__position_level !== undefined) updateFields.push(sql`dl__position_level = ${data.dl__position_level}`);
      if (data.leaf_level_flag !== undefined) updateFields.push(sql`leaf_level_flag = ${data.leaf_level_flag}`);
      if (data.root_level_flag !== undefined) updateFields.push(sql`root_level_flag = ${data.root_level_flag}`);
      if (data.parent_id !== undefined) updateFields.push(sql`parent_id = ${data.parent_id}`);
      if (data.management_flag !== undefined) updateFields.push(sql`management_flag = ${data.management_flag}`);
      if (data.executive_flag !== undefined) updateFields.push(sql`executive_flag = ${data.executive_flag}`);
      if (data.salary_band_min !== undefined) updateFields.push(sql`salary_band_min = ${data.salary_band_min}`);
      if (data.salary_band_max !== undefined) updateFields.push(sql`salary_band_max = ${data.salary_band_max}`);
      if (data.bonus_target_pct !== undefined) updateFields.push(sql`bonus_target_pct = ${data.bonus_target_pct}`);
      if (data.equity_eligible_flag !== undefined) updateFields.push(sql`equity_eligible_flag = ${data.equity_eligible_flag}`);
      if (data.approval_limit !== undefined) updateFields.push(sql`approval_limit = ${data.approval_limit}`);
      if (data.direct_reports_max !== undefined) updateFields.push(sql`direct_reports_max = ${data.direct_reports_max}`);
      if (data.remote_eligible_flag !== undefined) updateFields.push(sql`remote_eligible_flag = ${data.remote_eligible_flag}`);

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated_ts = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.d_position
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to update position' });
      }

      return result[0];
    } catch (error) {
      fastify.log.error('Error updating position:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete (soft delete) position
  fastify.delete('/api/v1/position/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      response: {
        204: Type.Object({}),
        401: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      // Check if position exists
      const existing = await db.execute(sql`
        SELECT id FROM app.d_position WHERE id = ${id}
      `);

      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Position not found' });
      }

      // Soft delete (using SCD Type 2 pattern)
      await db.execute(sql`
        UPDATE app.d_position
        SET active_flag = false, to_ts = NOW(), updated_ts = NOW()
        WHERE id = ${id}
      `);

      return reply.status(204).send();
    } catch (error) {
      fastify.log.error('Error deleting position:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}