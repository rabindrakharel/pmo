import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { createPaginatedResponse } from '../../lib/universal-schema-metadata.js';

export async function inventoryRoutes(fastify: FastifyInstance) {
  // List inventory
  fastify.get('/api/v1/inventory', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['inventory'],
      summary: 'List inventory',
      querystring: Type.Object({
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
        offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 }))})}}, async (request, reply) => {
    const { limit = 20, offset = 0 } = request.query as any;

    try {
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM app.f_inventory
        WHERE active_flag = true
      `);
      const total = Number(countResult[0]?.count || 0);

      const rows = await db.execute(sql`
        SELECT *
        FROM app.f_inventory
        WHERE active_flag = true
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return createPaginatedResponse(rows, total, limit, offset);
    } catch (error) {
      fastify.log.error('Error listing inventory:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get inventory by ID
  fastify.get('/api/v1/inventory/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['inventory'],
      summary: 'Get inventory by ID',
      params: Type.Object({ id: Type.String({ format: 'uuid' }) })}}, async (request, reply) => {
    const { id } = request.params as any;

    try {
      const result = await db.execute(sql`
        SELECT *
        FROM app.f_inventory
        WHERE id = ${id} AND active_flag = true
      `);

      if (!result.length) return reply.status(404).send({ error: 'Not found' });
      return result[0];
    } catch (error) {
      fastify.log.error('Error getting inventory:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create inventory
  fastify.post('/api/v1/inventory', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['inventory'],
      summary: 'Create inventory'}}, async (request, reply) => {
    const data = request.body as any;

    try {
      const result = await db.execute(sql`
        INSERT INTO app.f_inventory (
          store_id, product_id, qty, notes, active_flag
        ) VALUES (
          ${data.store_id || null},
          ${data.product_id || null},
          ${data.qty || 0},
          ${data.notes || null},
          ${data.active_flag !== false}
        ) RETURNING *
      `);

      return result[0];
    } catch (error) {
      fastify.log.error('Error creating inventory:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update inventory
  fastify.put('/api/v1/inventory/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['inventory'],
      summary: 'Update inventory',
      params: Type.Object({ id: Type.String({ format: 'uuid' }) })}}, async (request, reply) => {
    const { id } = request.params as any;
    const data = request.body as any;

    try {
      const updateFields = [];
      if (data.qty !== undefined) {
        updateFields.push(sql`qty = ${data.qty}`);
      }
      if (data.notes !== undefined) {
        updateFields.push(sql`notes = ${data.notes}`);
      }

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated_at = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.f_inventory
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id} AND active_flag = true
        RETURNING *
      `);

      if (!result.length) return reply.status(404).send({ error: 'Not found' });
      return result[0];
    } catch (error) {
      fastify.log.error('Error updating inventory:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete inventory
  fastify.delete('/api/v1/inventory/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['inventory'],
      summary: 'Delete inventory',
      params: Type.Object({ id: Type.String({ format: 'uuid' }) })}}, async (request, reply) => {
    const { id } = request.params as any;

    try {
      const result = await db.execute(sql`
        UPDATE app.f_inventory
        SET active_flag = false, updated_at = NOW()
        WHERE id = ${id} AND active_flag = true
        RETURNING id
      `);

      if (!result.length) return reply.status(404).send({ error: 'Not found' });
      return reply.status(204).send();
    } catch (error) {
      fastify.log.error('Error deleting inventory:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
