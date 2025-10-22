import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

const ProductSchema = Type.Object({
  id: Type.String(),
  code: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  level: Type.Optional(Type.Number()),
  department: Type.Optional(Type.String()),
  class: Type.Optional(Type.String()),
  subclass: Type.Optional(Type.String()),
  unit_of_measure: Type.Optional(Type.String()),
  active_flag: Type.Boolean(),
  tags: Type.Optional(Type.Array(Type.String())),
  metadata: Type.Optional(Type.Any()),
  created_at: Type.String(),
  updated_at: Type.String(),
});

const CreateProductSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  code: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  department: Type.Optional(Type.String()),
  class: Type.Optional(Type.String()),
  subclass: Type.Optional(Type.String()),
  unit_of_measure: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Union([Type.Array(Type.String()), Type.String(), Type.Any()])),
  metadata: Type.Optional(Type.Union([Type.Object({}), Type.String(), Type.Any()])),
});

const UpdateProductSchema = Type.Partial(CreateProductSchema);

export async function productRoutes(fastify: FastifyInstance) {
  // List products
  fastify.get('/api/v1/product', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['product'],
      summary: 'List products',
      querystring: Type.Object({
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
        offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
        department: Type.Optional(Type.String()),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(ProductSchema),
          total: Type.Integer(),
          limit: Type.Integer(),
          offset: Type.Integer(),
        }),
      },
    },
  }, async (request, reply) => {
    const { limit = 20, offset = 0, department } = request.query as any;

    try {
      const conditions = ['active_flag = true'];
      if (department) conditions.push(`department = '${department}'`);

      const whereClause = conditions.join(' AND ');

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM app.d_product
        WHERE ${sql.raw(whereClause)}
      `);
      const total = Number(countResult[0]?.count || 0);

      const rows = await db.execute(sql`
        SELECT *
        FROM app.d_product
        WHERE ${sql.raw(whereClause)}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return { data: rows, total, limit, offset };
    } catch (error) {
      fastify.log.error('Error listing products:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get product by ID
  fastify.get('/api/v1/product/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['product'],
      summary: 'Get product by ID',
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: { 200: ProductSchema },
    },
  }, async (request, reply) => {
    const { id } = request.params as any;

    try {
      const result = await db.execute(sql`
        SELECT *
        FROM app.d_product
        WHERE id = ${id} AND active_flag = true
      `);

      if (!result.length) return reply.status(404).send({ error: 'Not found' });
      return result[0];
    } catch (error) {
      fastify.log.error('Error getting product:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create product
  fastify.post('/api/v1/product', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['product'],
      summary: 'Create product',
      body: CreateProductSchema,
    },
  }, async (request, reply) => {
    const data = request.body as any;

    const slug = data.slug || `product-${Date.now()}`;

    try {
      const result = await db.execute(sql`
        INSERT INTO app.d_product (
          slug, code, name, descr, tags, metadata,
          department, class, subclass, unit_of_measure,
          active_flag
        ) VALUES (
          ${slug},
          ${data.code},
          ${data.name},
          ${data.descr || null},
          ${JSON.stringify(data.tags || [])}::jsonb,
          ${JSON.stringify(data.metadata || {})}::jsonb,
          ${data.department || null},
          ${data.class || null},
          ${data.subclass || null},
          ${data.unit_of_measure || 'each'},
          ${data.active_flag !== false}
        ) RETURNING *
      `);

      return result[0];
    } catch (error) {
      fastify.log.error('Error creating product:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update product
  fastify.put('/api/v1/product/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['product'],
      summary: 'Update product',
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      body: UpdateProductSchema,
      response: { 200: ProductSchema },
    },
  }, async (request, reply) => {
    const { id } = request.params as any;
    const data = request.body as any;

    try {
      const setClauses = [];
      if (data.name !== undefined) setClauses.push(`name = '${data.name}'`);
      if (data.code !== undefined) setClauses.push(`code = '${data.code}'`);
      if (data.descr !== undefined) setClauses.push(`descr = '${data.descr}'`);
      if (data.department !== undefined) setClauses.push(`department = '${data.department}'`);
      if (data.class !== undefined) setClauses.push(`class = '${data.class}'`);
      if (data.subclass !== undefined) setClauses.push(`subclass = '${data.subclass}'`);
      if (data.unit_of_measure !== undefined) setClauses.push(`unit_of_measure = '${data.unit_of_measure}'`);
      if (data.tags !== undefined) setClauses.push(`tags = '${JSON.stringify(data.tags)}'::jsonb`);
      if (data.metadata !== undefined) setClauses.push(`metadata = '${JSON.stringify(data.metadata)}'::jsonb`);

      if (setClauses.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      setClauses.push('updated_at = NOW()');
      const setClause = setClauses.join(', ');

      const result = await db.execute(sql`
        UPDATE app.d_product
        SET ${sql.raw(setClause)}
        WHERE id = ${id} AND active_flag = true
        RETURNING *
      `);

      if (!result.length) return reply.status(404).send({ error: 'Not found' });
      return result[0];
    } catch (error) {
      fastify.log.error('Error updating product:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete product (soft delete)
  fastify.delete('/api/v1/product/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['product'],
      summary: 'Delete product',
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: { 204: Type.Null() },
    },
  }, async (request, reply) => {
    const { id } = request.params as any;

    try {
      const result = await db.execute(sql`
        UPDATE app.d_product
        SET active_flag = false, updated_at = NOW()
        WHERE id = ${id} AND active_flag = true
        RETURNING id
      `);

      if (!result.length) return reply.status(404).send({ error: 'Not found' });
      return reply.status(204).send();
    } catch (error) {
      fastify.log.error('Error deleting product:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
