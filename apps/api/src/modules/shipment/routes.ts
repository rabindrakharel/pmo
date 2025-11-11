import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { createFilteredPaginatedResponse } from '../../lib/universal-schema-metadata.js';

export async function shipmentRoutes(fastify: FastifyInstance) {
  // List shipments
  fastify.get('/api/v1/shipment', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['shipment'],
      summary: 'List shipments',
      querystring: Type.Object({
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
        offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
        shipment_status: Type.Optional(Type.String()),
      }),
    },
  }, async (request, reply) => {
    const { limit = 20, offset = 0, shipment_status } = request.query as any;

    try {
      const conditions = [];
      if (shipment_status) {
        conditions.push(sql`shipment_status = ${shipment_status}`);
      }

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM app.f_shipment
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.count || 0);

      const rows = await db.execute(sql`
        SELECT *
        FROM app.f_shipment
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY shipment_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return createFilteredPaginatedResponse(rows, total, limit, offset);
    } catch (error) {
      fastify.log.error('Error listing shipments:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get shipment by ID
  fastify.get('/api/v1/shipment/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['shipment'],
      summary: 'Get shipment by ID',
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
    },
  }, async (request, reply) => {
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

  // Create shipment
  fastify.post('/api/v1/shipment', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['shipment'],
      summary: 'Create shipment',
    },
  }, async (request, reply) => {
    const data = request.body as any;

    try {
      const shipmentNumber = data.shipment_number || `SHIP-${Date.now()}`;
      const shipmentDate = data.shipment_date || new Date().toISOString().split('T')[0];

      const result = await db.execute(sql`
        INSERT INTO app.f_shipment (
          shipment_number, shipment_date, client_name, product_id,
          quantity_shipped, tracking_number, carrier_name,
          shipment_status, notes
        ) VALUES (
          ${shipmentNumber},
          ${shipmentDate},
          ${data.client_name || null},
          ${data.product_id},
          ${data.quantity_shipped},
          ${data.tracking_number || null},
          ${data.carrier_name || null},
          ${data.shipment_status || 'pending'},
          ${data.notes || null}
        ) RETURNING *
      `);

      return result[0];
    } catch (error) {
      fastify.log.error('Error creating shipment:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update shipment
  fastify.put('/api/v1/shipment/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['shipment'],
      summary: 'Update shipment',
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
    },
  }, async (request, reply) => {
    const { id } = request.params as any;
    const data = request.body as any;

    try {
      const updateFields = [];
      if (data.shipment_status !== undefined) {
        updateFields.push(sql`shipment_status = ${data.shipment_status}`);
      }
      if (data.tracking_number !== undefined) {
        updateFields.push(sql`tracking_number = ${data.tracking_number}`);
      }
      if (data.notes !== undefined) {
        updateFields.push(sql`notes = ${data.notes}`);
      }

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

  // Delete shipment
  fastify.delete('/api/v1/shipment/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['shipment'],
      summary: 'Delete shipment',
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
    },
  }, async (request, reply) => {
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
}
