/**
 * ============================================================================
 * REVENUE ROUTES MODULE - Universal CRUD Factory Pattern
 * ============================================================================
 *
 * All CRUD endpoints via Universal CRUD Factory:
 * - GET    /api/v1/revenue           - List with pagination, RBAC, auto-filters
 * - GET    /api/v1/revenue/:id       - Get single with RBAC, metadata
 * - POST   /api/v1/revenue           - Create with RBAC, registry
 * - PATCH  /api/v1/revenue/:id       - Update with RBAC, registry sync
 * - PUT    /api/v1/revenue/:id       - Update (alias for PATCH)
 * - DELETE /api/v1/revenue/:id       - Soft delete via factory
 *
 * ============================================================================
 */

import type { FastifyInstance } from 'fastify';
import { createUniversalEntityRoutes } from '../../lib/universal-entity-crud-factory.js';

// ============================================================================
// Module-level constants (DRY - used across all endpoints)
// ============================================================================
const ENTITY_CODE = 'revenue';

export async function revenueRoutes(fastify: FastifyInstance) {
  // ═══════════════════════════════════════════════════════════════
  // ✨ UNIVERSAL CRUD FACTORY - Generates all CRUD endpoints
  // ═══════════════════════════════════════════════════════════════
  createUniversalEntityRoutes(fastify, {
    entityCode: ENTITY_CODE,
    tableName: 'f_revenue',
    tableAlias: 'r',
    searchFields: ['revenue_number', 'description', 'client_name'],
    defaultOrderBy: 'revenue_date DESC, created_ts DESC',
    createDefaults: {
      revenue_type: 'standard',
      cost_amount_cad: 0,
      tax_rate: 0,
      tax_exempt_flag: false,
      revenue_status: 'recognized'
    }
  });
  // All CRUD endpoints (LIST, GET, POST, PATCH, PUT, DELETE) are created by createUniversalEntityRoutes above
}
