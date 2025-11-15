import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '../../db/index.js';
import { sql } from 'drizzle-orm';
import {
  getUniversalColumnMetadata,
  filterUniversalColumns,
  getColumnsByMetadata,
  createPaginatedResponse
} from '../../lib/universal-schema-metadata.js';
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';

// Product Hierarchy Schema (4-level: Division → Department → Class → Sub-Class)
const ProductHierarchySchema = Type.Object({
  id: Type.String(),
  code: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
  parent_id: Type.Optional(Type.String()),
  dl__product_hierarchy_level: Type.String(),
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.String()),
  active_flag: Type.Boolean(),
  created_ts: Type.String(),
  updated_ts: Type.String(),
  version: Type.Number(),
});

const CreateProductHierarchySchema = Type.Object({
  code: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
  parent_id: Type.Optional(Type.String()),
  dl__product_hierarchy_level: Type.String({ minLength: 1 }),
  active_flag: Type.Optional(Type.Boolean()),
});

const UpdateProductHierarchySchema = Type.Partial(CreateProductHierarchySchema);

export async function productHierarchyRoutes(fastify: FastifyInstance) {
  // List product hierarchy nodes
  fastify.get('/api/v1/product-hierarchy', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        active_flag: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        dl__product_hierarchy_level: Type.Optional(Type.String()),
        parent_id: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
        page: Type.Optional(Type.Number({ minimum: 1 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(ProductHierarchySchema),
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
      active_flag, search, dl__product_hierarchy_level, parent_id,
      limit = 20, offset: queryOffset, page
    } = request.query as any;
    const offset = page ? (page - 1) * limit : (queryOffset !== undefined ? queryOffset : 0);

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // RBAC filtering
      const baseConditions = [
        sql`(
          EXISTS (
            SELECT 1 FROM app.entity_id_rbac_map rbac
            WHERE rbac.person_entity_name = 'employee' AND rbac.person_entity_id = ${userId}::uuid
              AND rbac.entity_name = 'product_hierarchy'
              AND (rbac.entity_id = ph.id OR rbac.entity_id = '11111111-1111-1111-1111-111111111111'::uuid)
              AND rbac.active_flag = true
              AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
              AND rbac.permission >= 0
          )
        )`
      ];

      const conditions = [...baseConditions];

      if (active_flag !== undefined) {
        conditions.push(sql`ph.active_flag = ${active_flag}`);
      }

      if (dl__product_hierarchy_level) {
        conditions.push(sql`ph.dl__product_hierarchy_level = ${dl__product_hierarchy_level}`);
      }

      if (parent_id) {
        if (parent_id === 'null' || parent_id === '') {
          conditions.push(sql`ph.parent_id IS NULL`);
        } else {
          conditions.push(sql`ph.parent_id = ${parent_id}::uuid`);
        }
      }

      if (search) {
        const searchConditions = [
          sql`COALESCE(ph.name, '') ILIKE ${`%${search}%`}`,
          sql`COALESCE(ph."descr", '') ILIKE ${`%${search}%`}`,
          sql`COALESCE(ph.code, '') ILIKE ${`%${search}%`}`
        ];
        conditions.push(sql`(${sql.join(searchConditions, sql` OR `)})`);
      }

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.d_product_hierarchy ph
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      const nodes = await db.execute(sql`
        SELECT
          ph.id, ph.code, ph.name, ph."descr", ph.metadata,
          ph.parent_id, ph.dl__product_hierarchy_level,
          ph.from_ts, ph.to_ts, ph.active_flag, ph.created_ts, ph.updated_ts, ph.version,
          parent.name as parent_name
        FROM app.d_product_hierarchy ph
        LEFT JOIN app.d_product_hierarchy parent ON ph.parent_id = parent.id
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY ph.dl__product_hierarchy_level ASC, ph.name ASC NULLS LAST
        LIMIT ${limit} OFFSET ${offset}
      `);

      return createPaginatedResponse(nodes, total, limit, offset);
    } catch (error) {
      fastify.log.error({ error, stack: (error as Error).stack }, 'Error fetching product hierarchy');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single product hierarchy node
  fastify.get('/api/v1/product-hierarchy/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: ProductHierarchySchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      const results = await db.execute(sql`
        SELECT
          ph.id, ph.code, ph.name, ph."descr", ph.metadata,
          ph.parent_id, ph.dl__product_hierarchy_level,
          ph.from_ts, ph.to_ts, ph.active_flag, ph.created_ts, ph.updated_ts, ph.version,
          parent.name as parent_name
        FROM app.d_product_hierarchy ph
        LEFT JOIN app.d_product_hierarchy parent ON ph.parent_id = parent.id
        WHERE ph.id = ${id}::uuid
          AND EXISTS (
            SELECT 1 FROM app.entity_id_rbac_map rbac
            WHERE rbac.person_entity_name = 'employee' AND rbac.person_entity_id = ${userId}::uuid
              AND rbac.entity_name = 'product_hierarchy'
              AND (rbac.entity_id = ph.id OR rbac.entity_id = '11111111-1111-1111-1111-111111111111'::uuid)
              AND rbac.active_flag = true
              AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
              AND rbac.permission >= 0
          )
      `);

      if (results.length === 0) {
        return reply.status(404).send({ error: 'Product hierarchy node not found' });
      }

      return results[0];
    } catch (error) {
      fastify.log.error({ error, stack: (error as Error).stack }, 'Error fetching product hierarchy node');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create product hierarchy node
  fastify.post('/api/v1/product-hierarchy', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateProductHierarchySchema,
      response: {
        201: ProductHierarchySchema,
        400: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const data = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      const result = await db.execute(sql`
        INSERT INTO app.d_product_hierarchy (
          code, name, "descr", metadata, parent_id, dl__product_hierarchy_level, active_flag
        )
        VALUES (
          ${data.code}, ${data.name}, ${data.descr || null}, ${data.metadata || {}},
          ${data.parent_id ? sql`${data.parent_id}::uuid` : sql`NULL`},
          ${data.dl__product_hierarchy_level}, ${data.active_flag !== false}
        )
        RETURNING *
      `);

      return reply.status(201).send(result[0]);
    } catch (error) {
      fastify.log.error({ error, stack: (error as Error).stack }, 'Error creating product hierarchy node');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update product hierarchy node
  fastify.patch('/api/v1/product-hierarchy/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      body: UpdateProductHierarchySchema,
      response: {
        200: ProductHierarchySchema,
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      const updates: any[] = [];

      if (data.code !== undefined) { updates.push(sql`code = ${data.code}`); }
      if (data.name !== undefined) { updates.push(sql`name = ${data.name}`); }
      if (data.descr !== undefined) { updates.push(sql`"descr" = ${data.descr}`); }
      if (data.metadata !== undefined) { updates.push(sql`metadata = ${data.metadata}`); }
      if (data.parent_id !== undefined) {
        updates.push(data.parent_id ? sql`parent_id = ${data.parent_id}::uuid` : sql`parent_id = NULL`);
      }
      if (data.dl__product_hierarchy_level !== undefined) {
        updates.push(sql`dl__product_hierarchy_level = ${data.dl__product_hierarchy_level}`);
      }
      if (data.active_flag !== undefined) { updates.push(sql`active_flag = ${data.active_flag}`); }

      updates.push(sql`updated_ts = NOW()`);
      updates.push(sql`version = version + 1`);

      const result = await db.execute(sql`
        UPDATE app.d_product_hierarchy
        SET ${sql.join(updates, sql`, `)}
        WHERE id = ${id}::uuid
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(404).send({ error: 'Product hierarchy node not found' });
      }

      return result[0];
    } catch (error) {
      fastify.log.error({ error, stack: (error as Error).stack }, 'Error updating product hierarchy node');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete product hierarchy node (factory pattern)
  createEntityDeleteEndpoint(fastify, 'product-hierarchy');
}
