import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql, SQL } from 'drizzle-orm';
import { createPaginatedResponse } from '../../lib/universal-schema-metadata.js';
// ✅ Centralized unified data gate - loosely coupled API
import { unified_data_gate, Permission, ALL_ENTITIES_ID } from '../../lib/unified-data-gate.js';
// ✨ Entity Infrastructure Service - centralized infrastructure operations
import { getEntityInfrastructure } from '../../services/entity-infrastructure.service.js';
// ✨ Universal auto-filter builder - zero-config query filtering
import { buildAutoFilters } from '../../lib/universal-filter-builder.js';

// ============================================================================
// Module-level constants (DRY - used across all endpoints)
// ============================================================================
const ENTITY_TYPE = 'order';
const TABLE_ALIAS = 'o';

export async function orderRoutes(fastify: FastifyInstance) {
  // ✨ Initialize Entity Infrastructure Service
  const entityInfra = getEntityInfrastructure(db);

  // ============================================================================
  // List Orders
  // ============================================================================
  fastify.get('/api/v1/order', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['order'],
      summary: 'List orders',
      querystring: Type.Object({
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
        offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
        page: Type.Optional(Type.Number({ minimum: 1 })),
        order_status: Type.Optional(Type.String()),
        search: Type.Optional(Type.String())})}}, async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    const { limit = 20, offset: queryOffset, page } = request.query as any;
    const offset = page ? (page - 1) * limit : (queryOffset !== undefined ? queryOffset : 0);

    try {
      // Build WHERE conditions array
      const conditions: SQL[] = [];

      // ✨ UNIVERSAL AUTO-FILTER SYSTEM
      // Automatically builds filters from ANY query parameter based on field naming conventions
      // Supports: ?order_status=X, ?search=keyword, etc.
      const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query as any, {
        searchFields: ['order_number', 'client_name', 'product_name']
      });
      conditions.push(...autoFilters);

      // Build WHERE clause
      const whereClause = conditions.length > 0
        ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
        : sql``;

      // Count query
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM app.f_order ${sql.raw(TABLE_ALIAS)}
        ${whereClause}
      `);
      const total = Number(countResult[0]?.count || 0);

      // Data query
      const rows = await db.execute(sql`
        SELECT *
        FROM app.f_order ${sql.raw(TABLE_ALIAS)}
        ${whereClause}
        ORDER BY ${sql.raw(TABLE_ALIAS)}.order_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return createPaginatedResponse(rows, total, limit, offset);
    } catch (error) {
      fastify.log.error('Error listing orders:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Get Single Order
  // ============================================================================
  fastify.get('/api/v1/order/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['order'],
      summary: 'Get order by ID',
      params: Type.Object({ id: Type.String({ format: 'uuid' }) })}}, async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    const { id } = request.params as any;

    try {
      const result = await db.execute(sql`
        SELECT *
        FROM app.f_order
        WHERE id = ${id}
      `);

      if (!result.length) return reply.status(404).send({ error: 'Not found' });
      return result[0];
    } catch (error) {
      fastify.log.error('Error getting order:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Create Order
  // ============================================================================
  fastify.post('/api/v1/order', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['order'],
      summary: 'Create order'}}, async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    const data = request.body as any;

    try {
      const orderNumber = data.order_number || `ORD-${Date.now()}`;
      const orderDate = data.order_date || new Date().toISOString().split('T')[0];

      const result = await db.execute(sql`
        INSERT INTO app.f_order (
          order_number, order_date, client_name, product_id,
          qty_ordered, unit_list_price_cad, unit_sale_price_cad,
          order_status, notes
        ) VALUES (
          ${orderNumber},
          ${orderDate},
          ${data.client_name || null},
          ${data.product_id},
          ${data.qty_ordered || data.quantity_ordered},
          ${data.unit_list_price_cad || 0},
          ${data.unit_sale_price_cad || 0},
          ${data.order_status || 'pending'},
          ${data.notes || null}
        ) RETURNING *
      `);

      return reply.status(201).send(result[0]);
    } catch (error) {
      fastify.log.error('Error creating order:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Update Order
  // ============================================================================
  fastify.put('/api/v1/order/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['order'],
      summary: 'Update order',
      params: Type.Object({ id: Type.String({ format: 'uuid' }) })}}, async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    const { id } = request.params as any;
    const data = request.body as any;

    try {
      // Build update fields
      const updateFields: SQL[] = [];
      if (data.order_status !== undefined) updateFields.push(sql`order_status = ${data.order_status}`);
      if (data.qty_ordered !== undefined) updateFields.push(sql`qty_ordered = ${data.qty_ordered}`);
      if (data.quantity_ordered !== undefined) updateFields.push(sql`qty_ordered = ${data.quantity_ordered}`);
      if (data.notes !== undefined) updateFields.push(sql`notes = ${data.notes}`);

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated_at = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.f_order
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      if (!result.length) return reply.status(404).send({ error: 'Not found' });
      return result[0];
    } catch (error) {
      fastify.log.error('Error updating order:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Delete Order (Hard Delete - no active_flag in f_order)
  // ============================================================================
  fastify.delete('/api/v1/order/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['order'],
      summary: 'Delete order',
      params: Type.Object({ id: Type.String({ format: 'uuid' }) })}}, async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    const { id } = request.params as any;

    try {
      const result = await db.execute(sql`
        DELETE FROM app.f_order
        WHERE id = ${id}
        RETURNING id
      `);

      if (!result.length) return reply.status(404).send({ error: 'Not found' });
      return reply.status(204).send();
    } catch (error) {
      fastify.log.error('Error deleting order:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // NOTE: Order is a fact table, not a standard entity with child relationships
  // If it needs child entity endpoints, uncomment below:
  // await createChildEntityEndpointsFromMetadata(fastify, ENTITY_TYPE);
}
