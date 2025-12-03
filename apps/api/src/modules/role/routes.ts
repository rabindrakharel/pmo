/**
 * ============================================================================
 * ROLE ROUTES MODULE - Universal Entity Pattern with Factory
 * ============================================================================
 *
 * All CRUD endpoints via Universal CRUD Factory:
 *   GET    /api/v1/role              - List roles
 *   GET    /api/v1/role/:id          - Get single role
 *   POST   /api/v1/role              - Create role
 *   PATCH  /api/v1/role/:id          - Update role
 *   PUT    /api/v1/role/:id          - Update role alias
 *   DELETE /api/v1/role/:id          - Delete role (soft delete)
 *
 * ============================================================================
 */

import type { FastifyInstance } from 'fastify';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { createUniversalEntityRoutes } from '../../lib/universal-entity-crud-factory.js';

// ============================================================================
// MODULE CONSTANTS
// ============================================================================

const ENTITY_CODE = 'role';

// ============================================================================
// ROUTE REGISTRATION
// ============================================================================

export async function roleRoutes(fastify: FastifyInstance) {
  // ════════════════════════════════════════════════════════════════════════════
  // UNIVERSAL CRUD ENDPOINTS (FACTORY)
  // ════════════════════════════════════════════════════════════════════════════

  createUniversalEntityRoutes(fastify, {
    entityCode: ENTITY_CODE,
    tableName: 'role',
    tableAlias: 'e',
    searchFields: ['name', 'descr', 'role_code', 'role_category'],
    codeField: 'role_code',
    requiredFields: ['name'],
    createDefaults: {
      management_role_flag: false,
      client_facing_flag: false,
      safety_critical_flag: false,
      background_check_required_flag: false,
      bonding_required_flag: false,
      licensing_required_flag: false
    },
    hooks: {
      beforeCreate: async (ctx) => {
        const data = ctx.data;

        // Unique name validation
        const existingRole = await db.execute(sql`
          SELECT id FROM app.role WHERE name = ${data.name} AND active_flag = true
        `);
        if (existingRole.length > 0) {
          throw new Error('Role with this name already exists');
        }

        return data;
      }
    }
  });
  // All CRUD endpoints (LIST, GET, POST, PATCH, PUT, DELETE) are created by createUniversalEntityRoutes above
}
