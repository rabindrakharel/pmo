/**
 * ============================================================================
 * PRODUCT ROUTES MODULE - Universal Entity Pattern with Factory
 * ============================================================================
 *
 * REFACTORED: Uses Universal CRUD Factory for GET (list), GET (single), and UPDATE endpoints.
 * CREATE endpoint remains custom due to entity-specific validation.
 *
 * ENDPOINTS:
 *   GET    /api/v1/product              - List products (FACTORY)
 *   GET    /api/v1/product/:id          - Get single product (FACTORY)
 *   POST   /api/v1/product              - Create product (CUSTOM)
 *   PATCH  /api/v1/product/:id          - Update product (FACTORY)
 *   PUT    /api/v1/product/:id          - Update product alias (FACTORY)
 *   DELETE /api/v1/product/:id          - Delete product (DELETE FACTORY)
 *
 * ============================================================================
 */

import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { filterUniversalColumns } from '../../lib/universal-schema-metadata.js';

// ✨ Entity Infrastructure Service - centralized infrastructure operations
import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID } from '../../services/entity-infrastructure.service.js';

// ✨ Universal Entity CRUD Factory - consolidated endpoint generation
import { createUniversalEntityRoutes } from '../../lib/universal-entity-crud-factory.js';

// ============================================================================
// Module-level constants (DRY - used across all endpoints)
// ============================================================================
const ENTITY_CODE = 'product';

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

export async function productRoutes(fastify: FastifyInstance) {
  // ✨ Initialize Entity Infrastructure Service
  const entityInfra = getEntityInfrastructure(db);

  // ════════════════════════════════════════════════════════════════════════════
  // UNIVERSAL CRUD ENDPOINTS (FACTORY)
  // ════════════════════════════════════════════════════════════════════════════
  // Creates:
  // - GET /api/v1/product         - List with RBAC, pagination, auto-filters, metadata
  // - GET /api/v1/product/:id     - Single entity with RBAC, ref_data_entityInstance
  // - PATCH /api/v1/product/:id   - Update with RBAC, registry sync
  // - PUT /api/v1/product/:id     - Update alias
  //
  // Features:
  // - content=metadata support for metadata-only responses
  // - ref_data_entityInstance for entity reference resolution
  // - Universal auto-filters from query parameters
  // - Parent-child filtering via entity_instance_link
  // ════════════════════════════════════════════════════════════════════════════

  createUniversalEntityRoutes(fastify, {
    entityCode: ENTITY_CODE,
    tableName: 'product',
    tableAlias: 'e',
    searchFields: ['name', 'code', 'descr', 'supplier_name', 'product_category']
  });

  // ════════════════════════════════════════════════════════════════════════════
  // CREATE ENDPOINT (CUSTOM - Entity-specific validation)
  // ════════════════════════════════════════════════════════════════════════════

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
        INSERT INTO app.product (
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

  // DELETE endpoint is automatically created by createUniversalEntityRoutes above
}
