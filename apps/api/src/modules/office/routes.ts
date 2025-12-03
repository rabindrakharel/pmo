/**
 * ============================================================================
 * OFFICE ROUTES MODULE - Universal Entity Pattern with Factory
 * ============================================================================
 *
 * All CRUD endpoints via Universal CRUD Factory:
 *   GET    /api/v1/office                         - List offices
 *   GET    /api/v1/office/:id                     - Get single office
 *   POST   /api/v1/office                         - Create office
 *   PATCH  /api/v1/office/:id                     - Update office
 *   PUT    /api/v1/office/:id                     - Update office alias
 *   DELETE /api/v1/office/:id                     - Delete office
 *
 * Custom endpoints:
 *   GET    /api/v1/office/:id/dynamic-child-entity-tabs - Child tab metadata
 *
 * ============================================================================
 */

import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '../../db/index.js';
import { sql } from 'drizzle-orm';

// ✨ Entity Infrastructure Service - centralized infrastructure operations
import { getEntityInfrastructure, Permission } from '../../services/entity-infrastructure.service.js';

// ✨ Universal Entity CRUD Factory - consolidated endpoint generation
import { createUniversalEntityRoutes } from '../../lib/universal-entity-crud-factory.js';

// ============================================================================
// MODULE CONSTANTS
// ============================================================================

const ENTITY_CODE = 'office';

// ============================================================================
// ROUTE REGISTRATION
// ============================================================================

export async function officeRoutes(fastify: FastifyInstance) {
  const entityInfra = getEntityInfrastructure(db);

  // ════════════════════════════════════════════════════════════════════════════
  // UNIVERSAL CRUD ENDPOINTS (FACTORY)
  // ════════════════════════════════════════════════════════════════════════════

  createUniversalEntityRoutes(fastify, {
    entityCode: ENTITY_CODE,
    tableName: 'office',
    tableAlias: 'e',
    searchFields: ['name', 'descr', 'code', 'city', 'province', 'address_line1'],
    requiredFields: ['code', 'name'],
    createDefaults: {
      country: 'Canada'
    },
    hooks: {
      beforeCreate: async (ctx) => {
        const data = ctx.data;

        // Unique code validation
        if (data.code) {
          const existingOffice = await db.execute(sql`
            SELECT id FROM app.office WHERE code = ${data.code} AND active_flag = true
          `);
          if (existingOffice.length > 0) {
            throw new Error('Office with this code already exists');
          }
        }

        return data;
      }
    }
  });
  // All CRUD endpoints (LIST, GET, POST, PATCH, PUT, DELETE) are created by createUniversalEntityRoutes above

  // ════════════════════════════════════════════════════════════════════════════
  // DYNAMIC CHILD ENTITY TABS (CUSTOM - Metadata Endpoint)
  // ════════════════════════════════════════════════════════════════════════════

  fastify.get('/api/v1/office/:id/dynamic-child-entity-tabs', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    const { id } = request.params as { id: string };

    const canView = await entityInfra.check_entity_rbac(userId, ENTITY_CODE, id, Permission.VIEW);
    if (!canView) {
      return reply.status(403).send({ error: 'No permission to view this office' });
    }

    const tabs = await entityInfra.get_dynamic_child_entity_tabs(ENTITY_CODE);
    return reply.send({ tabs });
  });
}
