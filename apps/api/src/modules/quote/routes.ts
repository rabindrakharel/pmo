/**
 * ============================================================================
 * QUOTE ROUTES MODULE - Universal CRUD Factory Pattern
 * ============================================================================
 *
 * All CRUD endpoints via Universal CRUD Factory:
 * - GET    /api/v1/quote           - List with pagination, RBAC, auto-filters
 * - GET    /api/v1/quote/:id       - Get single with RBAC, metadata
 * - POST   /api/v1/quote           - Create with RBAC, registry
 * - PATCH  /api/v1/quote/:id       - Update with RBAC, registry sync
 * - PUT    /api/v1/quote/:id       - Update (alias for PATCH)
 * - DELETE /api/v1/quote/:id       - Soft delete via factory
 *
 * ============================================================================
 */

import type { FastifyInstance } from 'fastify';
import { createUniversalEntityRoutes } from '../../lib/universal-entity-crud-factory.js';

// ============================================================================
// Module-level constants (DRY - used across all endpoints)
// ============================================================================
const ENTITY_CODE = 'quote';

export async function quoteRoutes(fastify: FastifyInstance) {
  // ═══════════════════════════════════════════════════════════════
  // ✨ UNIVERSAL CRUD FACTORY - Generates all CRUD endpoints
  // ═══════════════════════════════════════════════════════════════
  createUniversalEntityRoutes(fastify, {
    entityCode: ENTITY_CODE,
    tableName: 'quote',
    tableAlias: 'q',
    searchFields: ['name', 'descr', 'code', 'customer_name'],
    defaultOrderBy: 'created_ts DESC',
    createDefaults: {
      name: 'Untitled',
      code: () => `QT-${Date.now()}`,
      dl__quote_stage: 'Draft',
      quote_items: [],
      subtotal_amt: 0,
      discount_pct: 0,
      discount_amt: 0,
      tax_pct: 13.00,
      quote_tax_amt: 0,
      quote_total_amt: 0
    }
  });
  // All CRUD endpoints (LIST, GET, POST, PATCH, PUT, DELETE) are created by createUniversalEntityRoutes above
}
