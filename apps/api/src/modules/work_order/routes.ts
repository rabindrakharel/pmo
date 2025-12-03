/**
 * ============================================================================
 * WORK_ORDER ROUTES MODULE - Universal CRUD Factory Pattern
 * ============================================================================
 *
 * All CRUD endpoints via Universal CRUD Factory:
 * - GET    /api/v1/work_order           - List with pagination, RBAC, auto-filters
 * - GET    /api/v1/work_order/:id       - Get single with RBAC, metadata
 * - POST   /api/v1/work_order           - Create with RBAC, registry
 * - PATCH  /api/v1/work_order/:id       - Update with RBAC, registry sync
 * - PUT    /api/v1/work_order/:id       - Update (alias for PATCH)
 * - DELETE /api/v1/work_order/:id       - Soft delete via factory
 *
 * ============================================================================
 */

import type { FastifyInstance } from 'fastify';
import { createUniversalEntityRoutes } from '../../lib/universal-entity-crud-factory.js';

// ============================================================================
// Module-level constants (DRY - used across all endpoints)
// ============================================================================
const ENTITY_CODE = 'work_order';

export async function workOrderRoutes(fastify: FastifyInstance) {
  // ═══════════════════════════════════════════════════════════════
  // ✨ UNIVERSAL CRUD FACTORY - Generates all CRUD endpoints
  // ═══════════════════════════════════════════════════════════════
  createUniversalEntityRoutes(fastify, {
    entityCode: ENTITY_CODE,
    tableName: 'fact_work_order',
    tableAlias: 'w',
    searchFields: ['name', 'descr', 'code', 'customer_name'],
    defaultOrderBy: 'scheduled_date DESC NULLS LAST, created_ts DESC',
    createDefaults: {
      name: 'Untitled',
      code: () => `WO-${Date.now()}`,
      dl__work_order_status: 'Scheduled',
      labor_hours: 0,
      labor_cost_amt: 0,
      materials_cost_amt: 0,
      total_cost_amt: 0,
      customer_signature_flag: false
    }
  });
  // All CRUD endpoints (LIST, GET, POST, PATCH, PUT, DELETE) are created by createUniversalEntityRoutes above
}
