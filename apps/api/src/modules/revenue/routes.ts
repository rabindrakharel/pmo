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

// Schema based on d_revenue table structure from db/37_d_revenue.ddl
const RevenueSchema = Type.Object({
  id: Type.String(),
  slug: Type.String(),
  code: Type.String(),
  revenue_code: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Any()),
  metadata: Type.Optional(Type.Any()),
  // Financial fields
  revenue_amt_local: Type.Number(),
  revenue_amt_invoice: Type.Optional(Type.Number()),
  invoice_currency: Type.Optional(Type.String()),
  exch_rate: Type.Optional(Type.Number()),
  revenue_forecasted_amt_lcl: Type.Optional(Type.Number()),
  // Attachment fields
  sales_receipt_attachment: Type.Optional(Type.String()),
  // Temporal fields
  from_ts: Type.Optional(Type.String()),
  to_ts: Type.Optional(Type.String()),
  active_flag: Type.Optional(Type.Boolean()),
  created_ts: Type.Optional(Type.String()),
  updated_ts: Type.Optional(Type.String()),
  version: Type.Optional(Type.Number()),
});

const CreateRevenueSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1 })),
  slug: Type.Optional(Type.String({ minLength: 1 })),
  code: Type.Optional(Type.String({ minLength: 1 })),
  revenue_code: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Union([Type.Array(Type.String()), Type.String()])),
  metadata: Type.Optional(Type.Union([Type.Object({}), Type.String()])),
  revenue_amt_local: Type.Number(),
  revenue_amt_invoice: Type.Optional(Type.Number()),
  invoice_currency: Type.Optional(Type.String()),
  exch_rate: Type.Optional(Type.Number()),
  revenue_forecasted_amt_lcl: Type.Optional(Type.Number()),
  sales_receipt_attachment: Type.Optional(Type.String()),
  active_flag: Type.Optional(Type.Boolean()),
});

const UpdateRevenueSchema = Type.Partial(CreateRevenueSchema);

export async function revenueRoutes(fastify: FastifyInstance) {
  // List revenues with filtering
  fastify.get('/api/v1/revenue', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        active: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        revenue_code: Type.Optional(Type.String()),
        invoice_currency: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(RevenueSchema),
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
      active, search, revenue_code, invoice_currency, limit = 50, offset = 0
    } = request.query as any;

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.code(403).send({ error: 'User not authenticated' });
    }

    try {
      let conditions: string[] = ['r.active_flag = true'];

      if (active !== undefined) {
        conditions.push(`r.active_flag = ${active}`);
      }

      if (search) {
        conditions.push(`(r.name ILIKE $search OR r.revenue_code ILIKE $search OR r.descr ILIKE $search)`);
      }

      if (revenue_code) {
        conditions.push(`r.revenue_code = $revenue_code`);
      }

      if (invoice_currency) {
        conditions.push(`r.invoice_currency = $invoice_currency`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Query with RBAC enforcement
      const query = sql.raw(`
        SELECT r.*
        FROM app.d_revenue r
        ${whereClause}
        AND EXISTS (
          SELECT 1 FROM app.entity_id_rbac_map rbac
          WHERE rbac.empid = ${sql.placeholder('userId')}
            AND rbac.entity = 'revenue'
            AND (rbac.entity_id = r.id::text OR rbac.entity_id = 'all')
            AND 0 = ANY(rbac.permission)
        )
        ORDER BY r.created_ts DESC
        LIMIT ${sql.placeholder('limit')} OFFSET ${sql.placeholder('offset')}
      `);

      const countQuery = sql.raw(`
        SELECT COUNT(*) as count
        FROM app.d_revenue r
        ${whereClause}
        AND EXISTS (
          SELECT 1 FROM app.entity_id_rbac_map rbac
          WHERE rbac.empid = ${sql.placeholder('userId')}
            AND rbac.entity = 'revenue'
            AND (rbac.entity_id = r.id::text OR rbac.entity_id = 'all')
            AND 0 = ANY(rbac.permission)
        )
      `);

      const results = await db.execute(query.mapWith({
        userId, search: search ? `%${search}%` : undefined, revenue_code, invoice_currency, limit, offset
      }));

      const countResult = await db.execute(countQuery.mapWith({ userId, search: search ? `%${search}%` : undefined, revenue_code, invoice_currency }));
      const total = parseInt(countResult.rows[0]?.count || '0', 10);

      return reply.send({ data: results.rows, total, limit, offset });
    } catch (error: any) {
      fastify.log.error(`Revenue list error: ${error.message}`);
      return reply.code(500).send({ error: 'Failed to fetch revenues' });
    }
  });

  // Get single revenue by ID
  fastify.get('/api/v1/revenue/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: RevenueSchema,
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
        SELECT r.*
        FROM app.d_revenue r
        WHERE r.id = ${sql.placeholder('id')}
          AND r.active_flag = true
          AND EXISTS (
            SELECT 1 FROM app.entity_id_rbac_map rbac
            WHERE rbac.empid = ${sql.placeholder('userId')}
              AND rbac.entity = 'revenue'
              AND (rbac.entity_id = r.id::text OR rbac.entity_id = 'all')
              AND 0 = ANY(rbac.permission)
          )
      `);

      const result = await db.execute(query.mapWith({ id, userId }));

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Revenue not found or access denied' });
      }

      return reply.send(result.rows[0]);
    } catch (error: any) {
      fastify.log.error(`Revenue get error: ${error.message}`);
      return reply.code(500).send({ error: 'Failed to fetch revenue' });
    }
  });

  // Create new revenue
  fastify.post('/api/v1/revenue', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateRevenueSchema,
      response: {
        201: RevenueSchema,
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
      // Check RBAC permission for creating revenue
      const rbacCheck = await db.execute(
        sql.raw(`
          SELECT 1 FROM app.entity_id_rbac_map
          WHERE empid = ${sql.placeholder('userId')}
            AND entity = 'revenue'
            AND entity_id = 'all'
            AND 4 = ANY(permission)
        `).mapWith({ userId })
      );

      if (rbacCheck.rows.length === 0) {
        return reply.code(403).send({ error: 'Permission denied to create revenue' });
      }

      // Generate slug and code if not provided
      const slug = body.slug || body.name.toLowerCase().replace(/\s+/g, '-');
      const code = body.code || `REV-${Date.now()}`;

      const query = sql.raw(`
        INSERT INTO app.d_revenue (
          slug, code, revenue_code, name, descr, tags, metadata,
          revenue_amt_local, revenue_amt_invoice, invoice_currency, exch_rate,
          revenue_forecasted_amt_lcl, sales_receipt_attachment, active_flag
        ) VALUES (
          ${sql.placeholder('slug')}, ${sql.placeholder('code')}, ${sql.placeholder('revenue_code')},
          ${sql.placeholder('name')}, ${sql.placeholder('descr')},
          ${sql.placeholder('tags')}, ${sql.placeholder('metadata')},
          ${sql.placeholder('revenue_amt_local')}, ${sql.placeholder('revenue_amt_invoice')},
          ${sql.placeholder('invoice_currency')}, ${sql.placeholder('exch_rate')},
          ${sql.placeholder('revenue_forecasted_amt_lcl')}, ${sql.placeholder('sales_receipt_attachment')},
          ${sql.placeholder('active_flag')}
        )
        RETURNING *
      `);

      const result = await db.execute(query.mapWith({
        slug,
        code,
        revenue_code: body.revenue_code,
        name: body.name || `Revenue ${code}`,
        descr: body.descr || null,
        tags: JSON.stringify(body.tags || []),
        metadata: JSON.stringify(body.metadata || {}),
        revenue_amt_local: body.revenue_amt_local,
        revenue_amt_invoice: body.revenue_amt_invoice || null,
        invoice_currency: body.invoice_currency || 'CAD',
        exch_rate: body.exch_rate || 1.0,
        revenue_forecasted_amt_lcl: body.revenue_forecasted_amt_lcl || null,
        sales_receipt_attachment: body.sales_receipt_attachment || null,
        active_flag: body.active_flag !== undefined ? body.active_flag : true,
      }));

      return reply.code(201).send(result.rows[0]);
    } catch (error: any) {
      fastify.log.error(`Revenue create error: ${error.message}`);
      return reply.code(500).send({ error: 'Failed to create revenue' });
    }
  });

  // Update revenue
  fastify.put('/api/v1/revenue/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      body: UpdateRevenueSchema,
      response: {
        200: RevenueSchema,
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
      // Check RBAC permission for editing revenue
      const rbacCheck = await db.execute(
        sql.raw(`
          SELECT 1 FROM app.entity_id_rbac_map
          WHERE empid = ${sql.placeholder('userId')}
            AND entity = 'revenue'
            AND (entity_id = ${sql.placeholder('id')} OR entity_id = 'all')
            AND 1 = ANY(permission)
        `).mapWith({ userId, id })
      );

      if (rbacCheck.rows.length === 0) {
        return reply.code(403).send({ error: 'Permission denied to update revenue' });
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
      if (body.revenue_code !== undefined) {
        updateFields.push(`revenue_code = ${sql.placeholder('revenue_code')}`);
        params.revenue_code = body.revenue_code;
      }
      if (body.revenue_amt_local !== undefined) {
        updateFields.push(`revenue_amt_local = ${sql.placeholder('revenue_amt_local')}`);
        params.revenue_amt_local = body.revenue_amt_local;
      }
      if (body.revenue_amt_invoice !== undefined) {
        updateFields.push(`revenue_amt_invoice = ${sql.placeholder('revenue_amt_invoice')}`);
        params.revenue_amt_invoice = body.revenue_amt_invoice;
      }
      if (body.invoice_currency !== undefined) {
        updateFields.push(`invoice_currency = ${sql.placeholder('invoice_currency')}`);
        params.invoice_currency = body.invoice_currency;
      }
      if (body.exch_rate !== undefined) {
        updateFields.push(`exch_rate = ${sql.placeholder('exch_rate')}`);
        params.exch_rate = body.exch_rate;
      }
      if (body.revenue_forecasted_amt_lcl !== undefined) {
        updateFields.push(`revenue_forecasted_amt_lcl = ${sql.placeholder('revenue_forecasted_amt_lcl')}`);
        params.revenue_forecasted_amt_lcl = body.revenue_forecasted_amt_lcl;
      }
      if (body.sales_receipt_attachment !== undefined) {
        updateFields.push(`sales_receipt_attachment = ${sql.placeholder('sales_receipt_attachment')}`);
        params.sales_receipt_attachment = body.sales_receipt_attachment;
      }

      if (updateFields.length === 0) {
        return reply.code(400).send({ error: 'No fields to update' });
      }

      updateFields.push('version = version + 1');
      updateFields.push('updated_ts = now()');

      const query = sql.raw(`
        UPDATE app.d_revenue
        SET ${updateFields.join(', ')}
        WHERE id = ${sql.placeholder('id')} AND active_flag = true
        RETURNING *
      `);

      const result = await db.execute(query.mapWith(params));

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Revenue not found' });
      }

      return reply.send(result.rows[0]);
    } catch (error: any) {
      fastify.log.error(`Revenue update error: ${error.message}`);
      return reply.code(500).send({ error: 'Failed to update revenue' });
    }
  });

  // Delete revenue (soft delete)
  await createEntityDeleteEndpoint(fastify, 'revenue');
}
