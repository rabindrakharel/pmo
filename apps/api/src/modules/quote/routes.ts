import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql, SQL } from 'drizzle-orm';
import { filterUniversalColumns, createPaginatedResponse } from '../../lib/universal-schema-metadata.js';
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';
import { createChildEntityEndpointsFromMetadata } from '../../lib/child-entity-route-factory.js';
// ✅ Centralized unified data gate - loosely coupled API
import { unified_data_gate, Permission, ALL_ENTITIES_ID } from '../../lib/unified-data-gate.js';
// ✨ Entity Infrastructure Service - centralized infrastructure operations
import { getEntityInfrastructure } from '../../services/entity-infrastructure.service.js';
// ✨ Universal auto-filter builder - zero-config query filtering
import { buildAutoFilters } from '../../lib/universal-filter-builder.js';

const QuoteSchema = Type.Object({
  id: Type.String(),
  code: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
  dl__quote_stage: Type.Optional(Type.String()),
  quote_items: Type.Optional(Type.Any()),
  subtotal_amt: Type.Optional(Type.Number()),
  discount_pct: Type.Optional(Type.Number()),
  discount_amt: Type.Optional(Type.Number()),
  tax_pct: Type.Optional(Type.Number()),
  quote_tax_amt: Type.Optional(Type.Number()),
  quote_total_amt: Type.Optional(Type.Number()),
  valid_until_date: Type.Optional(Type.String()),
  customer_name: Type.Optional(Type.String()),
  customer_email: Type.Optional(Type.String()),
  customer_phone: Type.Optional(Type.String()),
  active_flag: Type.Optional(Type.Boolean()),
  created_ts: Type.Optional(Type.String()),
  updated_ts: Type.Optional(Type.String()),
});

const CreateQuoteSchema = Type.Partial(Type.Object({
  code: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
  descr: Type.String(),
  metadata: Type.Any(),
  dl__quote_stage: Type.String(),
  quote_items: Type.Any(),
  subtotal_amt: Type.Number(),
  discount_pct: Type.Number(),
  discount_amt: Type.Number(),
  tax_pct: Type.Number(),
  quote_tax_amt: Type.Number(),
  quote_total_amt: Type.Number(),
  valid_until_date: Type.String({ format: 'date' }),
  customer_name: Type.String(),
  customer_email: Type.String(),
  customer_phone: Type.String(),
  internal_notes: Type.String(),
  customer_notes: Type.String(),
}));

const UpdateQuoteSchema = Type.Partial(CreateQuoteSchema);

// ============================================================================
// Module-level constants (DRY - used across all endpoints)
// ============================================================================
const ENTITY_TYPE = 'quote';
const TABLE_ALIAS = 'q';

export async function quoteRoutes(fastify: FastifyInstance) {
  // ✨ Initialize Entity Infrastructure Service
  const entityInfra = getEntityInfrastructure(db);

  // List quotes
  fastify.get('/api/v1/quote', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        active: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        dl__quote_stage: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
        page: Type.Optional(Type.Number({ minimum: 1 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(QuoteSchema),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number(),
        }),
      },
    },
  }, async (request, reply) => {
    const { active, search, dl__quote_stage, limit = 20, offset: queryOffset, page } = request.query as any;
    const offset = page ? (page - 1) * limit : (queryOffset !== undefined ? queryOffset : 0);
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Build WHERE conditions array
      const conditions: SQL[] = [];

      // ✨ UNIFIED RBAC - Replace ~9 lines of manual SQL with single service call
      const rbacCondition = await unified_data_gate.rbac_gate.getWhereCondition(
        userId, ENTITY_TYPE, Permission.VIEW, TABLE_ALIAS
      );
      conditions.push(rbacCondition);

      // ✨ UNIVERSAL AUTO-FILTER SYSTEM
      // Automatically builds filters from ANY query parameter based on field naming conventions
      // Supports: ?active=true, ?dl__quote_stage=X, ?search=keyword, etc.
      const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query as any, {
        searchFields: ['name', 'descr', 'code', 'customer_name']
      });
      conditions.push(...autoFilters);

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.fact_quote q
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      const quotes = await db.execute(sql`
        SELECT *
        FROM app.fact_quote q
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY q.created_ts DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return createPaginatedResponse(quotes, total, limit, offset);
    } catch (error) {
      fastify.log.error('Error fetching quotes:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single quote
  fastify.get('/api/v1/quote/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    // ✨ UNIFIED RBAC - Replace ~9 lines of manual SQL with single service call
    const canView = await entityInfra.check_entity_rbac(userId, ENTITY_TYPE, id, Permission.VIEW);
    if (!canView) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const quote = await db.execute(sql`
        SELECT * FROM app.fact_quote WHERE id = ${id}
      `);

      if (quote.length === 0) {
        return reply.status(404).send({ error: 'Quote not found' });
      }

      return quote[0];
    } catch (error) {
      fastify.log.error('Error fetching quote:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create quote
  fastify.post('/api/v1/quote', {
    preHandler: [fastify.authenticate],
    schema: { body: CreateQuoteSchema },
  }, async (request, reply) => {
    const data = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    if (!data.name) data.name = 'Untitled';
    if (!data.code) data.code = `QT-${Date.now()}`;

    // ✨ UNIFIED RBAC - Replace ~9 lines of manual SQL with single service call
    const canCreate = await entityInfra.check_entity_rbac(userId, ENTITY_TYPE, ALL_ENTITIES_ID, Permission.CREATE);
    if (!canCreate) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const result = await db.execute(sql`
        INSERT INTO app.fact_quote (
          code, name, descr, metadata,
          dl__quote_stage, quote_items,
          subtotal_amt, discount_pct, discount_amt, tax_pct, quote_tax_amt, quote_total_amt,
          valid_until_date, customer_name, customer_email, customer_phone,
          internal_notes, customer_notes, active_flag
        )
        VALUES (
          ${data.code}, ${data.name}, ${data.descr || null},
          ${data.metadata ? JSON.stringify(data.metadata) : '{}'}::jsonb,
          ${data.dl__quote_stage || 'Draft'},
          ${data.quote_items ? JSON.stringify(data.quote_items) : '[]'}::jsonb,
          ${data.subtotal_amt || 0}, ${data.discount_pct || 0}, ${data.discount_amt || 0},
          ${data.tax_pct || 13.00}, ${data.quote_tax_amt || 0}, ${data.quote_total_amt || 0},
          ${data.valid_until_date || null}, ${data.customer_name || null},
          ${data.customer_email || null}, ${data.customer_phone || null},
          ${data.internal_notes || null}, ${data.customer_notes || null},
          true
        )
        RETURNING *
      `);

      const newQuote = result[0] as any;

      await db.execute(sql`
        INSERT INTO app.entity_instance (entity_type, entity_id, entity_name, entity_code)
        VALUES ('quote', ${newQuote.id}::uuid, ${newQuote.name}, ${newQuote.code})
        ON CONFLICT (entity_type, entity_id) DO UPDATE
        SET entity_name = EXCLUDED.entity_name, entity_code = EXCLUDED.entity_code, updated_ts = NOW()
      `);

      return reply.status(201).send(filterUniversalColumns(newQuote, {
        canSeePII: true, canSeeFinancial: true, canSeeSystemFields: true, canSeeSafetyInfo: true
      }));
    } catch (error) {
      fastify.log.error('Error creating quote:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update quote
  fastify.put('/api/v1/quote/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      body: UpdateQuoteSchema,
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    // ✨ UNIFIED RBAC - Replace ~9 lines of manual SQL with single service call
    const canEdit = await entityInfra.check_entity_rbac(userId, ENTITY_TYPE, id, Permission.EDIT);
    if (!canEdit) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const existing = await db.execute(sql`SELECT id FROM app.fact_quote WHERE id = ${id}`);
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Quote not found' });
      }

      const updateFields = [];
      if (data.name !== undefined) updateFields.push(sql`name = ${data.name}`);
      if (data.descr !== undefined) updateFields.push(sql`descr = ${data.descr}`);
      if (data.code !== undefined) updateFields.push(sql`code = ${data.code}`);
      if (data.metadata !== undefined) updateFields.push(sql`metadata = ${JSON.stringify(data.metadata)}::jsonb`);
      if (data.dl__quote_stage !== undefined) updateFields.push(sql`dl__quote_stage = ${data.dl__quote_stage}`);
      if (data.quote_items !== undefined) updateFields.push(sql`quote_items = ${JSON.stringify(data.quote_items)}::jsonb`);
      if (data.subtotal_amt !== undefined) updateFields.push(sql`subtotal_amt = ${data.subtotal_amt}`);
      if (data.discount_pct !== undefined) updateFields.push(sql`discount_pct = ${data.discount_pct}`);
      if (data.discount_amt !== undefined) updateFields.push(sql`discount_amt = ${data.discount_amt}`);
      if (data.tax_pct !== undefined) updateFields.push(sql`tax_pct = ${data.tax_pct}`);
      if (data.quote_tax_amt !== undefined) updateFields.push(sql`quote_tax_amt = ${data.quote_tax_amt}`);
      if (data.quote_total_amt !== undefined) updateFields.push(sql`quote_total_amt = ${data.quote_total_amt}`);
      if (data.valid_until_date !== undefined) updateFields.push(sql`valid_until_date = ${data.valid_until_date}`);
      if (data.customer_name !== undefined) updateFields.push(sql`customer_name = ${data.customer_name}`);
      if (data.customer_email !== undefined) updateFields.push(sql`customer_email = ${data.customer_email}`);
      if (data.customer_phone !== undefined) updateFields.push(sql`customer_phone = ${data.customer_phone}`);
      if (data.internal_notes !== undefined) updateFields.push(sql`internal_notes = ${data.internal_notes}`);
      if (data.customer_notes !== undefined) updateFields.push(sql`customer_notes = ${data.customer_notes}`);

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated_ts = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.fact_quote
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      return filterUniversalColumns(result[0], {
        canSeePII: true, canSeeFinancial: true, canSeeSystemFields: true, canSeeSafetyInfo: true
      });
    } catch (error) {
      fastify.log.error('Error updating quote:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ✨ Factory-generated DELETE endpoint
  createEntityDeleteEndpoint(fastify, ENTITY_TYPE);

  // ✨ Factory-generated child entity endpoints
  await createChildEntityEndpointsFromMetadata(fastify, ENTITY_TYPE);
}
