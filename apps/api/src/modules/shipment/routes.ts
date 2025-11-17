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
const ENTITY_TYPE = 'shipment';
const TABLE_ALIAS = 's';

export async function shipmentRoutes(fastify: FastifyInstance) {
  // ✨ Initialize Entity Infrastructure Service
  const entityInfra = getEntityInfrastructure(db);

  // ============================================================================
  // List Shipments
  // ============================================================================
  fastify.get('/api/v1/shipment', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['shipment'],
      summary: 'List shipments',
      querystring: Type.Object({
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
        offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
        page: Type.Optional(Type.Number({ minimum: 1 })),
        shipment_status: Type.Optional(Type.String()),
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
      // Supports: ?shipment_status=X, ?search=keyword, etc.
      const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query as any, {
        searchFields: ['shipment_number', 'tracking_number', 'client_name']
      });
      conditions.push(...autoFilters);

      // Build WHERE clause
      const whereClause = conditions.length > 0
        ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
        : sql``;

      // Count query
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM app.f_shipment ${sql.raw(TABLE_ALIAS)}
        ${whereClause}
      `);
      const total = Number(countResult[0]?.count || 0);

      // Data query
      const rows = await db.execute(sql`
        SELECT *
        FROM app.f_shipment ${sql.raw(TABLE_ALIAS)}
        ${whereClause}
        ORDER BY ${sql.raw(TABLE_ALIAS)}.shipment_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return createPaginatedResponse(rows, total, limit, offset);
    } catch (error) {
      fastify.log.error('Error listing shipments:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Get Single Shipment
  // ============================================================================
  fastify.get('/api/v1/shipment/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['shipment'],
      summary: 'Get shipment by ID',
      params: Type.Object({ id: Type.String({ format: 'uuid' }) })}}, async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    const { id } = request.params as any;

    try {
      const result = await db.execute(sql`
        SELECT *
        FROM app.f_shipment
        WHERE id = ${id}
      `);

      if (!result.length) return reply.status(404).send({ error: 'Not found' });
      return result[0];
    } catch (error) {
      fastify.log.error('Error getting shipment:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Create Shipment
  // ============================================================================
  fastify.post('/api/v1/shipment', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['shipment'],
      summary: 'Create shipment'}}, async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    const data = request.body as any;

    try {
      const shipmentNumber = data.shipment_number || `SHIP-${Date.now()}`;
      const shipmentDate = data.shipment_date || new Date().toISOString().split('T')[0];

      const result = await db.execute(sql`
        INSERT INTO app.f_shipment (
          shipment_number, shipment_date, client_name, product_id,
          qty_shipped, tracking_number, carrier_name,
          shipment_status, notes
        ) VALUES (
          ${shipmentNumber},
          ${shipmentDate},
          ${data.client_name || null},
          ${data.product_id},
          ${data.qty_shipped || data.quantity_shipped},
          ${data.tracking_number || null},
          ${data.carrier_name || null},
          ${data.shipment_status || 'pending'},
          ${data.notes || null}
        ) RETURNING *
      `);

      return reply.status(201).send(result[0]);
    } catch (error) {
      fastify.log.error('Error creating shipment:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Update Shipment
  // ============================================================================
  fastify.put('/api/v1/shipment/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['shipment'],
      summary: 'Update shipment',
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
      if (data.shipment_status !== undefined) updateFields.push(sql`shipment_status = ${data.shipment_status}`);
      if (data.tracking_number !== undefined) updateFields.push(sql`tracking_number = ${data.tracking_number}`);
      if (data.carrier_name !== undefined) updateFields.push(sql`carrier_name = ${data.carrier_name}`);
      if (data.delivered_date !== undefined) updateFields.push(sql`delivered_date = ${data.delivered_date}`);
      if (data.notes !== undefined) updateFields.push(sql`notes = ${data.notes}`);

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated_at = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.f_shipment
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      if (!result.length) return reply.status(404).send({ error: 'Not found' });
      return result[0];
    } catch (error) {
      fastify.log.error('Error updating shipment:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Delete Shipment (Hard Delete - no active_flag in f_shipment)
  // ============================================================================
  fastify.delete('/api/v1/shipment/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['shipment'],
      summary: 'Delete shipment',
      params: Type.Object({ id: Type.String({ format: 'uuid' }) })}}, async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    const { id } = request.params as any;

    try {
      const result = await db.execute(sql`
        DELETE FROM app.f_shipment
        WHERE id = ${id}
        RETURNING id
      `);

      if (!result.length) return reply.status(404).send({ error: 'Not found' });
      return reply.status(204).send();
    } catch (error) {
      fastify.log.error('Error deleting shipment:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // NOTE: Shipment is a fact table, not a standard entity with child relationships
  // If it needs child entity endpoints, uncomment below:
  // await createChildEntityEndpointsFromMetadata(fastify, ENTITY_TYPE);
}
