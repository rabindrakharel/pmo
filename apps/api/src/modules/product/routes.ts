/**
 * ============================================================================
 * PRODUCT ROUTES MODULE - Universal Entity Pattern with Factory
 * ============================================================================
 *
 * All CRUD endpoints via Universal CRUD Factory:
 *   GET    /api/v1/product              - List products
 *   GET    /api/v1/product/:id          - Get single product
 *   POST   /api/v1/product              - Create product
 *   PATCH  /api/v1/product/:id          - Update product
 *   PUT    /api/v1/product/:id          - Update product alias
 *   DELETE /api/v1/product/:id          - Delete product
 *
 * ============================================================================
 */

import type { FastifyInstance } from 'fastify';
import { createUniversalEntityRoutes } from '../../lib/universal-entity-crud-factory.js';

// ============================================================================
// Module-level constants (DRY - used across all endpoints)
// ============================================================================
const ENTITY_CODE = 'product';

export async function productRoutes(fastify: FastifyInstance) {
  // ════════════════════════════════════════════════════════════════════════════
  // UNIVERSAL CRUD ENDPOINTS (FACTORY)
  // ════════════════════════════════════════════════════════════════════════════

  createUniversalEntityRoutes(fastify, {
    entityCode: ENTITY_CODE,
    tableName: 'product',
    tableAlias: 'e',
    searchFields: ['name', 'code', 'descr', 'supplier_name', 'product_category'],
    createDefaults: {
      name: 'Untitled',
      code: () => `PRD-${Date.now()}`,
      unit_of_measure: 'each',
      on_hand_qty: 0,
      reorder_level_qty: 0,
      taxable_flag: true
    }
  });
  // All CRUD endpoints (LIST, GET, POST, PATCH, PUT, DELETE) are created by createUniversalEntityRoutes above
}
