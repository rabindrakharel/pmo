/**
 * ============================================================================
 * SERVICE ROUTES MODULE - Universal Entity Pattern with Factory
 * ============================================================================
 *
 * All CRUD endpoints via Universal CRUD Factory:
 *   GET    /api/v1/service              - List services
 *   GET    /api/v1/service/:id          - Get single service
 *   POST   /api/v1/service              - Create service
 *   PATCH  /api/v1/service/:id          - Update service
 *   PUT    /api/v1/service/:id          - Update service alias
 *   DELETE /api/v1/service/:id          - Delete service
 *
 * ============================================================================
 */

import type { FastifyInstance } from 'fastify';
import { createUniversalEntityRoutes } from '../../lib/universal-entity-crud-factory.js';

// ============================================================================
// Module-level constants (DRY - used across all endpoints)
// ============================================================================
const ENTITY_CODE = 'service';

export async function serviceRoutes(fastify: FastifyInstance) {
  // ════════════════════════════════════════════════════════════════════════════
  // UNIVERSAL CRUD ENDPOINTS (FACTORY)
  // ════════════════════════════════════════════════════════════════════════════

  createUniversalEntityRoutes(fastify, {
    entityCode: ENTITY_CODE,
    tableName: 'service',
    tableAlias: 'e',
    searchFields: ['name', 'code', 'descr', 'service_category'],
    createDefaults: {
      name: 'Untitled',
      code: () => `SVC-${Date.now()}`,
      taxable_flag: true,
      requires_certification_flag: false
    }
  });
  // All CRUD endpoints (LIST, GET, POST, PATCH, PUT, DELETE) are created by createUniversalEntityRoutes above
}
