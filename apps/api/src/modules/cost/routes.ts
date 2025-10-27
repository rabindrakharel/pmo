import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import {
  getUniversalColumnMetadata,
  filterUniversalColumns,
  getColumnsByMetadata
} from '../../lib/universal-schema-metadata.js';
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';
import { createChildEntityEndpoint } from '../../lib/child-entity-route-factory.js';

// Schema based on d_cost table structure from db/36_d_cost.ddl
const CostSchema = Type.Object({
  id: Type.String(),
  slug: Type.String(),
  code: Type.String(),
  cost_code: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Any()),
  metadata: Type.Optional(Type.Any()),
  // Financial fields
  cost_amt_lcl: Type.Number(),
  cost_amt_invoice: Type.Optional(Type.Number()),
  invoice_currency: Type.Optional(Type.String()),
  exch_rate: Type.Optional(Type.Number()),
  cust_budgeted_amt_lcl: Type.Optional(Type.Number()),
  // Attachment fields
  invoice_attachment: Type.Optional(Type.String()),
  // Temporal fields
  from_ts: Type.Optional(Type.String()),
  to_ts: Type.Optional(Type.String()),
  active_flag: Type.Optional(Type.Boolean()),
  created_ts: Type.Optional(Type.String()),
  updated_ts: Type.Optional(Type.String()),
  version: Type.Optional(Type.Number()),
});

const CreateCostSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1 })),
  slug: Type.Optional(Type.String({ minLength: 1 })),
  code: Type.Optional(Type.String({ minLength: 1 })),
  cost_code: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Union([Type.Array(Type.String()), Type.String()])),
  metadata: Type.Optional(Type.Union([Type.Object({}), Type.String()])),
  cost_amt_lcl: Type.Number(),
  cost_amt_invoice: Type.Optional(Type.Number()),
  invoice_currency: Type.Optional(Type.String()),
  exch_rate: Type.Optional(Type.Number()),
  cust_budgeted_amt_lcl: Type.Optional(Type.Number()),
  invoice_attachment: Type.Optional(Type.String()),
  active_flag: Type.Optional(Type.Boolean()),
});

const UpdateCostSchema = Type.Partial(CreateCostSchema);

export async function costRoutes(fastify: FastifyInstance) {
  // List costs with filtering
  fastify.get('/api/v1/cost', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        active: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        cost_code: Type.Optional(Type.String()),
        invoice_currency: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(CostSchema),
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
      active, search, cost_code, invoice_currency, limit = 50, offset = 0
    } = request.query as any;

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.code(403).send({ error: 'User not authenticated' });
    }

    try {
      let conditions: string[] = ['c.active_flag = true'];

      if (active !== undefined) {
        conditions.push(`c.active_flag = ${active}`);
      }

      if (search) {
        conditions.push(`(c.name ILIKE $search OR c.cost_code ILIKE $search OR c.descr ILIKE $search)`);
      }

      if (cost_code) {
        conditions.push(`c.cost_code = $cost_code`);
      }

      if (invoice_currency) {
        conditions.push(`c.invoice_currency = $invoice_currency`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Query with RBAC enforcement
      const query = sql.raw(`
        SELECT c.*
        FROM app.d_cost c
        ${whereClause}
        AND EXISTS (
          SELECT 1 FROM app.entity_id_rbac_map rbac
          WHERE rbac.empid = ${sql.placeholder('userId')}
            AND rbac.entity = 'cost'
            AND (rbac.entity_id = c.id::text OR rbac.entity_id = 'all')
            AND 0 = ANY(rbac.permission)
        )
        ORDER BY c.created_ts DESC
        LIMIT ${sql.placeholder('limit')} OFFSET ${sql.placeholder('offset')}
      `);

      const countQuery = sql.raw(`
        SELECT COUNT(*) as count
        FROM app.d_cost c
        ${whereClause}
        AND EXISTS (
          SELECT 1 FROM app.entity_id_rbac_map rbac
          WHERE rbac.empid = ${sql.placeholder('userId')}
            AND rbac.entity = 'cost'
            AND (rbac.entity_id = c.id::text OR rbac.entity_id = 'all')
            AND 0 = ANY(rbac.permission)
        )
      `);

      const results = await db.execute(query.mapWith({
        userId, search: search ? `%${search}%` : undefined, cost_code, invoice_currency, limit, offset
      }));

      const countResult = await db.execute(countQuery.mapWith({ userId, search: search ? `%${search}%` : undefined, cost_code, invoice_currency }));
      const total = parseInt(countResult.rows[0]?.count || '0', 10);

      return reply.send({ data: results.rows, total, limit, offset });
    } catch (error: any) {
      fastify.log.error(`Cost list error: ${error.message}`);
      return reply.code(500).send({ error: 'Failed to fetch costs' });
    }
  });

  // Get single cost by ID
  fastify.get('/api/v1/cost/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: CostSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.code(403).send({ error: 'User not authenticated' });
    }

    try {
      const query = sql.raw(`
        SELECT c.*
        FROM app.d_cost c
        WHERE c.id = ${sql.placeholder('id')}
          AND c.active_flag = true
          AND EXISTS (
            SELECT 1 FROM app.entity_id_rbac_map rbac
            WHERE rbac.empid = ${sql.placeholder('userId')}
              AND rbac.entity = 'cost'
              AND (rbac.entity_id = c.id::text OR rbac.entity_id = 'all')
              AND 0 = ANY(rbac.permission)
          )
      `);

      const result = await db.execute(query.mapWith({ id, userId }));

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Cost not found or access denied' });
      }

      return reply.send(result.rows[0]);
    } catch (error: any) {
      fastify.log.error(`Cost get error: ${error.message}`);
      return reply.code(500).send({ error: 'Failed to fetch cost' });
    }
  });

  // Create new cost
  fastify.post('/api/v1/cost', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateCostSchema,
      response: {
        201: CostSchema,
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const body = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.code(403).send({ error: 'User not authenticated' });
    }

    try {
      // Check RBAC permission for creating cost
      const rbacCheck = await db.execute(
        sql.raw(`
          SELECT 1 FROM app.entity_id_rbac_map
          WHERE empid = ${sql.placeholder('userId')}
            AND entity = 'cost'
            AND entity_id = 'all'
            AND 4 = ANY(permission)
        `).mapWith({ userId })
      );

      if (rbacCheck.rows.length === 0) {
        return reply.code(403).send({ error: 'Permission denied to create cost' });
      }

      // Generate slug and code if not provided
      const slug = body.slug || body.name.toLowerCase().replace(/\s+/g, '-');
      const code = body.code || `COST-${Date.now()}`;

      const query = sql.raw(`
        INSERT INTO app.d_cost (
          slug, code, cost_code, name, descr, tags, metadata,
          cost_amt_lcl, cost_amt_invoice, invoice_currency, exch_rate,
          cust_budgeted_amt_lcl, invoice_attachment, active_flag
        ) VALUES (
          ${sql.placeholder('slug')}, ${sql.placeholder('code')}, ${sql.placeholder('cost_code')},
          ${sql.placeholder('name')}, ${sql.placeholder('descr')},
          ${sql.placeholder('tags')}, ${sql.placeholder('metadata')},
          ${sql.placeholder('cost_amt_lcl')}, ${sql.placeholder('cost_amt_invoice')},
          ${sql.placeholder('invoice_currency')}, ${sql.placeholder('exch_rate')},
          ${sql.placeholder('cust_budgeted_amt_lcl')}, ${sql.placeholder('invoice_attachment')},
          ${sql.placeholder('active_flag')}
        )
        RETURNING *
      `);

      const result = await db.execute(query.mapWith({
        slug,
        code,
        cost_code: body.cost_code,
        name: body.name || `Cost ${code}`,
        descr: body.descr || null,
        tags: JSON.stringify(body.tags || []),
        metadata: JSON.stringify(body.metadata || {}),
        cost_amt_lcl: body.cost_amt_lcl,
        cost_amt_invoice: body.cost_amt_invoice || null,
        invoice_currency: body.invoice_currency || 'CAD',
        exch_rate: body.exch_rate || 1.0,
        cust_budgeted_amt_lcl: body.cust_budgeted_amt_lcl || null,
        invoice_attachment: body.invoice_attachment || null,
        active_flag: body.active_flag !== undefined ? body.active_flag : true,
      }));

      return reply.code(201).send(result.rows[0]);
    } catch (error: any) {
      fastify.log.error(`Cost create error: ${error.message}`);
      return reply.code(500).send({ error: 'Failed to create cost' });
    }
  });

  // Update cost
  fastify.put('/api/v1/cost/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      body: UpdateCostSchema,
      response: {
        200: CostSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as any;
    const body = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.code(403).send({ error: 'User not authenticated' });
    }

    try {
      // Check RBAC permission for editing cost
      const rbacCheck = await db.execute(
        sql.raw(`
          SELECT 1 FROM app.entity_id_rbac_map
          WHERE empid = ${sql.placeholder('userId')}
            AND entity = 'cost'
            AND (entity_id = ${sql.placeholder('id')} OR entity_id = 'all')
            AND 1 = ANY(permission)
        `).mapWith({ userId, id })
      );

      if (rbacCheck.rows.length === 0) {
        return reply.code(403).send({ error: 'Permission denied to update cost' });
      }

      const updateFields: string[] = [];
      const params: any = { id };

      if (body.name !== undefined) {
        updateFields.push(`name = ${sql.placeholder('name')}`);
        params.name = body.name;
      }
      if (body.descr !== undefined) {
        updateFields.push(`descr = ${sql.placeholder('descr')}`);
        params.descr = body.descr;
      }
      if (body.cost_code !== undefined) {
        updateFields.push(`cost_code = ${sql.placeholder('cost_code')}`);
        params.cost_code = body.cost_code;
      }
      if (body.cost_amt_lcl !== undefined) {
        updateFields.push(`cost_amt_lcl = ${sql.placeholder('cost_amt_lcl')}`);
        params.cost_amt_lcl = body.cost_amt_lcl;
      }
      if (body.cost_amt_invoice !== undefined) {
        updateFields.push(`cost_amt_invoice = ${sql.placeholder('cost_amt_invoice')}`);
        params.cost_amt_invoice = body.cost_amt_invoice;
      }
      if (body.invoice_currency !== undefined) {
        updateFields.push(`invoice_currency = ${sql.placeholder('invoice_currency')}`);
        params.invoice_currency = body.invoice_currency;
      }
      if (body.exch_rate !== undefined) {
        updateFields.push(`exch_rate = ${sql.placeholder('exch_rate')}`);
        params.exch_rate = body.exch_rate;
      }
      if (body.cust_budgeted_amt_lcl !== undefined) {
        updateFields.push(`cust_budgeted_amt_lcl = ${sql.placeholder('cust_budgeted_amt_lcl')}`);
        params.cust_budgeted_amt_lcl = body.cust_budgeted_amt_lcl;
      }
      if (body.invoice_attachment !== undefined) {
        updateFields.push(`invoice_attachment = ${sql.placeholder('invoice_attachment')}`);
        params.invoice_attachment = body.invoice_attachment;
      }

      if (updateFields.length === 0) {
        return reply.code(400).send({ error: 'No fields to update' });
      }

      updateFields.push('version = version + 1');
      updateFields.push('updated_ts = now()');

      const query = sql.raw(`
        UPDATE app.d_cost
        SET ${updateFields.join(', ')}
        WHERE id = ${sql.placeholder('id')} AND active_flag = true
        RETURNING *
      `);

      const result = await db.execute(query.mapWith(params));

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Cost not found' });
      }

      return reply.send(result.rows[0]);
    } catch (error: any) {
      fastify.log.error(`Cost update error: ${error.message}`);
      return reply.code(500).send({ error: 'Failed to update cost' });
    }
  });

  // Delete cost (soft delete)
  await createEntityDeleteEndpoint(fastify, 'cost');
}
