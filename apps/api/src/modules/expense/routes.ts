/**
 * ============================================================================
 * EXPENSE ROUTES MODULE - Universal CRUD Factory Pattern
 * ============================================================================
 *
 * All CRUD endpoints via Universal CRUD Factory:
 * - GET    /api/v1/expense           - List with pagination, RBAC, auto-filters
 * - GET    /api/v1/expense/:id       - Get single with RBAC, metadata
 * - POST   /api/v1/expense           - Create with RBAC, registry
 * - PATCH  /api/v1/expense/:id       - Update with RBAC, registry sync
 * - PUT    /api/v1/expense/:id       - Update (alias for PATCH)
 * - DELETE /api/v1/expense/:id       - Soft delete via factory
 *
 * ============================================================================
 */

import type { FastifyInstance } from 'fastify';
import { createUniversalEntityRoutes } from '../../lib/universal-entity-crud-factory.js';

// ============================================================================
// Module-level constants (DRY - used across all endpoints)
// ============================================================================
const ENTITY_CODE = 'expense';

export async function expenseRoutes(fastify: FastifyInstance) {
  // ═══════════════════════════════════════════════════════════════
  // ✨ UNIVERSAL CRUD FACTORY - Generates all CRUD endpoints
  // ═══════════════════════════════════════════════════════════════
  createUniversalEntityRoutes(fastify, {
    entityCode: ENTITY_CODE,
    tableName: 'f_expense',
    tableAlias: 'e',
    searchFields: ['expense_number', 'description', 'vendor_name', 'employee_name'],
    defaultOrderBy: 'expense_date DESC, created_ts DESC',
    createDefaults: {
      expense_type: 'standard',
      deductibility_percent: 100,
      reimbursable_flag: false,
      tax_rate: 0,
      tax_recoverable_flag: true,
      expense_status: 'submitted',
      payment_status: 'unpaid'
    }
  });
  // All CRUD endpoints (LIST, GET, POST, PATCH, PUT, DELETE) are created by createUniversalEntityRoutes above
}
