import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql, SQL } from 'drizzle-orm';
import { filterUniversalColumns, createPaginatedResponse } from '../../lib/universal-schema-metadata.js';
// ✅ Centralized unified data gate - loosely coupled API
// ✨ Entity Infrastructure Service - centralized infrastructure operations
import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID } from '../../services/entity-infrastructure.service.js';
// ✨ Universal auto-filter builder - zero-config query filtering
import { buildAutoFilters } from '../../lib/universal-filter-builder.js';
// ✅ Delete factory for cascading soft deletes
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';

// ============================================================================
// Module-level constants (DRY - used across all endpoints)
// ============================================================================
const ENTITY_CODE = 'product';
const TABLE_ALIAS = 'p';

const ProductSchema = Type.Object({
  id: Type.String(),
  code: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
  product_category: Type.Optional(Type.String()),
  unit_price_amt: Type.Optional(Type.Number()),
  cost_amt: Type.Optional(Type.Number()),
  unit_of_measure: Type.Optional(Type.String()),
  on_hand_qty: Type.Optional(Type.Number()),
  reorder_level_qty: Type.Optional(Type.Number()),
  taxable_flag: Type.Optional(Type.Boolean()),
  supplier_name: Type.Optional(Type.String()),
  active_flag: Type.Optional(Type.Boolean()),
  created_ts: Type.Optional(Type.String()),
  updated_ts: Type.Optional(Type.String()),
});

const CreateProductSchema = Type.Object({
  code: Type.Optional(Type.String({ minLength: 1 })),
  name: Type.Optional(Type.String({ minLength: 1 })),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
  product_category: Type.Optional(Type.String()),
  unit_price_amt: Type.Optional(Type.Number()),
  cost_amt: Type.Optional(Type.Number()),
  unit_of_measure: Type.Optional(Type.String()),
  on_hand_qty: Type.Optional(Type.Number()),
  reorder_level_qty: Type.Optional(Type.Number()),
  taxable_flag: Type.Optional(Type.Boolean()),
  supplier_name: Type.Optional(Type.String()),
  active_flag: Type.Optional(Type.Boolean()),
});

const UpdateProductSchema = Type.Partial(CreateProductSchema);

export async function productRoutes(fastify: FastifyInstance) {
  // ✨ Initialize Entity Infrastructure Service
  const entityInfra = getEntityInfrastructure(db);

  // List products
  fastify.get('/api/v1/product', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        active: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        product_category: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
        page: Type.Optional(Type.Number({ minimum: 1 })),
        parent_entity_code: Type.Optional(Type.String()),
        parent_entity_instance_id: Type.Optional(Type.String({ format: 'uuid' })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(ProductSchema),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number(),
        }),
      },
    },
  }, async (request, reply) => {
    const { limit = 20, offset: queryOffset, page, parent_entity_code, parent_entity_instance_id } = request.query as any;
    const offset = page ? (page - 1) * limit : (queryOffset !== undefined ? queryOffset : 0);
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // ═══════════════════════════════════════════════════════════════
      // BUILD JOINs - Parent filtering via entity_instance_link
      // ═══════════════════════════════════════════════════════════════
      const joins: SQL[] = [];

      if (parent_entity_code && parent_entity_instance_id) {
        joins.push(sql`
          INNER JOIN app.entity_instance_link eil
            ON eil.child_entity_code = ${ENTITY_CODE}
            AND eil.child_entity_instance_id = ${sql.raw(TABLE_ALIAS)}.id
            AND eil.entity_code = ${parent_entity_code}
            AND eil.entity_instance_id = ${parent_entity_instance_id}::uuid
        `);
      }

      // Build WHERE conditions array
      const conditions: SQL[] = [];

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC filtering
      // Only return products user has VIEW permission for
      // ═══════════════════════════════════════════════════════════════
      const rbacWhereClause = await entityInfra.get_entity_rbac_where_condition(userId, ENTITY_CODE, Permission.VIEW, TABLE_ALIAS);
      conditions.push(rbacWhereClause);

      // ✨ UNIVERSAL AUTO-FILTER SYSTEM
      // Automatically builds filters from ANY query parameter based on field naming conventions
      // Supports: ?product_category=X, ?active_flag=true, ?search=keyword, etc.
      const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query as any, {
        searchFields: ['name', 'code', 'descr', 'supplier_name']
      });
      conditions.push(...autoFilters);

      // Compose JOIN and WHERE clauses
      const joinClause = joins.length > 0 ? sql.join(joins, sql` `) : sql``;
      const whereClause = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;

      const countResult = await db.execute(sql`
        SELECT COUNT(DISTINCT ${sql.raw(TABLE_ALIAS)}.id) as total
        FROM app.product ${sql.raw(TABLE_ALIAS)}
        ${joinClause}
        ${whereClause}
      `);
      const total = Number(countResult[0]?.total || 0);

      const products = await db.execute(sql`
        SELECT DISTINCT ${sql.raw(TABLE_ALIAS)}.*
        FROM app.product ${sql.raw(TABLE_ALIAS)}
        ${joinClause}
        ${whereClause}
        ORDER BY ${sql.raw(TABLE_ALIAS)}.name ASC NULLS LAST
        LIMIT ${limit} OFFSET ${offset}
      `);

      return createPaginatedResponse(products, total, limit, offset);
    } catch (error) {
      fastify.log.error('Error fetching products:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single product
  fastify.get('/api/v1/product/:id', {
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

    try {
      // ✨ ENTITY INFRASTRUCTURE - Use centralized RBAC check
      const canView = await entityInfra.check_entity_rbac(userId, ENTITY_CODE, id, Permission.VIEW);
      if (!canView) {
        return reply.status(403).send({ error: 'Insufficient permissions' });
      }

      const product = await db.execute(sql`
        SELECT * FROM app.product WHERE id = ${id}
      `);

      if (product.length === 0) {
        return reply.status(404).send({ error: 'Product not found' });
      }

      return product[0];
    } catch (error) {
      fastify.log.error('Error fetching product:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create product
  fastify.post('/api/v1/product', {
    preHandler: [fastify.authenticate],
    schema: { body: CreateProductSchema },
  }, async (request, reply) => {
    const data = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    if (!data.name) data.name = 'Untitled';
    if (!data.code) data.code = `PRD-${Date.now()}`;

    // ═══════════════════════════════════════════════════════════════
    // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC CHECK
    // Check: Can user CREATE products?
    // ═══════════════════════════════════════════════════════════════
    const canCreate = await entityInfra.check_entity_rbac(userId, ENTITY_CODE, ALL_ENTITIES_ID, Permission.CREATE);
    if (!canCreate) {
      return reply.status(403).send({ error: 'No permission to create products' });
    }

    try {
      const result = await db.execute(sql`
        INSERT INTO app.d_product (
          code, name, descr, metadata,
          product_category, unit_price_amt, cost_amt, unit_of_measure,
          on_hand_qty, reorder_level_qty, taxable_flag, supplier_name,
          active_flag
        )
        VALUES (
          ${data.code}, ${data.name}, ${data.descr || null},
          ${data.metadata ? JSON.stringify(data.metadata) : '{}'}::jsonb,
          ${data.product_category || null}, ${data.unit_price_amt || null},
          ${data.cost_amt || null}, ${data.unit_of_measure || 'each'},
          ${data.on_hand_qty || 0}, ${data.reorder_level_qty || 0},
          ${data.taxable_flag !== false}, ${data.supplier_name || null},
          true
        )
        RETURNING *
      `);

      const newProduct = result[0] as any;

      await db.execute(sql`
        INSERT INTO app.entity_instance (entity_type, entity_id, entity_name, entity_code)
        VALUES ('product', ${newProduct.id}::uuid, ${newProduct.name}, ${newProduct.code})
        ON CONFLICT (entity_type, entity_id) DO UPDATE
        SET entity_name = EXCLUDED.entity_name, entity_code = EXCLUDED.entity_code, updated_ts = NOW()
      `);

      return reply.status(201).send(filterUniversalColumns(newProduct, {
        canSeePII: true, canSeeFinancial: true, canSeeSystemFields: true, canSeeSafetyInfo: true
      }));
    } catch (error) {
      fastify.log.error('Error creating product:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update product
  fastify.put('/api/v1/product/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      body: UpdateProductSchema,
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    // ═══════════════════════════════════════════════════════════════
    // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC CHECK
    // Check: Can user EDIT this product?
    // ═══════════════════════════════════════════════════════════════
    const canEdit = await entityInfra.check_entity_rbac(userId, ENTITY_CODE, id, Permission.EDIT);
    if (!canEdit) {
      return reply.status(403).send({ error: 'No permission to edit this product' });
    }

    try {
      const existing = await db.execute(sql`SELECT id FROM app.product WHERE id = ${id}`);
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Product not found' });
      }

      const updateFields = [];
      if (data.name !== undefined) updateFields.push(sql`name = ${data.name}`);
      if (data.descr !== undefined) updateFields.push(sql`descr = ${data.descr}`);
      if (data.code !== undefined) updateFields.push(sql`code = ${data.code}`);
      if (data.metadata !== undefined) updateFields.push(sql`metadata = ${JSON.stringify(data.metadata)}::jsonb`);
      if (data.product_category !== undefined) updateFields.push(sql`product_category = ${data.product_category}`);
      if (data.unit_price_amt !== undefined) updateFields.push(sql`unit_price_amt = ${data.unit_price_amt}`);
      if (data.cost_amt !== undefined) updateFields.push(sql`cost_amt = ${data.cost_amt}`);
      if (data.unit_of_measure !== undefined) updateFields.push(sql`unit_of_measure = ${data.unit_of_measure}`);
      if (data.on_hand_qty !== undefined) updateFields.push(sql`on_hand_qty = ${data.on_hand_qty}`);
      if (data.reorder_level_qty !== undefined) updateFields.push(sql`reorder_level_qty = ${data.reorder_level_qty}`);
      if (data.taxable_flag !== undefined) updateFields.push(sql`taxable_flag = ${data.taxable_flag}`);
      if (data.supplier_name !== undefined) updateFields.push(sql`supplier_name = ${data.supplier_name}`);
      if (data.active_flag !== undefined) updateFields.push(sql`active_flag = ${data.active_flag}`);

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated_ts = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.d_product
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      return filterUniversalColumns(result[0], {
        canSeePII: true, canSeeFinancial: true, canSeeSystemFields: true, canSeeSafetyInfo: true
      });
    } catch (error) {
      fastify.log.error('Error updating product:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // ✨ FACTORY-GENERATED ENDPOINTS
  // ============================================================================

  // ✨ Factory-generated DELETE endpoint
  // Provides cascading soft delete for product and linked entities
  createEntityDeleteEndpoint(fastify, ENTITY_CODE);
}
