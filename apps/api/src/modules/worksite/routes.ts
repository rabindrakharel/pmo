/**
 * ============================================================================
 * WORKSITE ROUTES MODULE - Universal Entity Pattern with Factory
 * ============================================================================
 *
 * All CRUD endpoints via Universal CRUD Factory:
 *   GET    /api/v1/worksite              - List worksites
 *   GET    /api/v1/worksite/:id          - Get single worksite
 *   POST   /api/v1/worksite              - Create worksite
 *   PATCH  /api/v1/worksite/:id          - Update worksite
 *   PUT    /api/v1/worksite/:id          - Update worksite alias
 *   DELETE /api/v1/worksite/:id          - Delete worksite
 *
 * ============================================================================
 */

import type { FastifyInstance } from 'fastify';
import { createUniversalEntityRoutes } from '../../lib/universal-entity-crud-factory.js';

// ============================================================================
// Module-level constants (DRY - used across all endpoints)
// ============================================================================
const ENTITY_CODE = 'worksite';

export async function worksiteRoutes(fastify: FastifyInstance) {
  // ════════════════════════════════════════════════════════════════════════════
  // UNIVERSAL CRUD ENDPOINTS (FACTORY)
  // ════════════════════════════════════════════════════════════════════════════

  createUniversalEntityRoutes(fastify, {
    entityCode: ENTITY_CODE,
    tableName: 'worksite',
    tableAlias: 'e',
    searchFields: ['name', 'descr', 'code', 'addr', 'postal_code'],
    requiredFields: ['name'],
    createDefaults: {
      worksite_type: 'project',
      time_zone: 'America/Toronto',
      equipment_storage_flag: false,
      security_required_flag: false,
      office_space_flag: false,
      washroom_facilities_flag: false,
      power_available_flag: false,
      water_available_flag: false,
      seasonal_use_flag: false
    }
  });
  // All CRUD endpoints (LIST, GET, POST, PATCH, PUT, DELETE) are created by createUniversalEntityRoutes above
}