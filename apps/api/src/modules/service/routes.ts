/**
 * ============================================================================
 * SERVICE ROUTES MODULE - Universal Entity Pattern with Factory
 * ============================================================================
 *
 * REFACTORED: Uses Universal CRUD Factory for GET (list), GET (single), and UPDATE endpoints.
 * CREATE endpoint remains custom due to entity-specific validation.
 *
 * ENDPOINTS:
 *   GET    /api/v1/service              - List services (FACTORY)
 *   GET    /api/v1/service/:id          - Get single service (FACTORY)
 *   POST   /api/v1/service              - Create service (CUSTOM)
 *   PATCH  /api/v1/service/:id          - Update service (FACTORY)
 *   PUT    /api/v1/service/:id          - Update service alias (FACTORY)
 *   DELETE /api/v1/service/:id          - Delete service (DELETE FACTORY)
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
import { createUniversalEntityRoutes, createEntityDeleteEndpoint } from '../../lib/universal-entity-crud-factory.js';

// ============================================================================
// Module-level constants (DRY - used across all endpoints)
// ============================================================================
const ENTITY_CODE = 'service';

const CreateServiceSchema = Type.Object({
  code: Type.Optional(Type.String({ minLength: 1 })),
  name: Type.Optional(Type.String({ minLength: 1 })),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
  service_category: Type.Optional(Type.String()),
  standard_rate_amt: Type.Optional(Type.Number()),
  estimated_hours: Type.Optional(Type.Number()),
  minimum_charge_amt: Type.Optional(Type.Number()),
  taxable_flag: Type.Optional(Type.Boolean()),
  requires_certification_flag: Type.Optional(Type.Boolean()),
  active_flag: Type.Optional(Type.Boolean()),
});

export async function serviceRoutes(fastify: FastifyInstance) {
  // ✨ Initialize Entity Infrastructure Service
  const entityInfra = getEntityInfrastructure(db);

  // ════════════════════════════════════════════════════════════════════════════
  // UNIVERSAL CRUD ENDPOINTS (FACTORY)
  // ════════════════════════════════════════════════════════════════════════════
  // Creates:
  // - GET /api/v1/service         - List with RBAC, pagination, auto-filters, metadata
  // - GET /api/v1/service/:id     - Single entity with RBAC, ref_data_entityInstance
  // - PATCH /api/v1/service/:id   - Update with RBAC, registry sync
  // - PUT /api/v1/service/:id     - Update alias
  //
  // Features:
  // - content=metadata support for metadata-only responses
  // - ref_data_entityInstance for entity reference resolution
  // - Universal auto-filters from query parameters
  // - Parent-child filtering via entity_instance_link
  // ════════════════════════════════════════════════════════════════════════════

  createUniversalEntityRoutes(fastify, {
    entityCode: ENTITY_CODE,
    tableName: 'service',
    tableAlias: 'e',
    searchFields: ['name', 'code', 'descr', 'service_category']
  });

  // ════════════════════════════════════════════════════════════════════════════
  // CREATE ENDPOINT (CUSTOM - Entity-specific validation)
  // ════════════════════════════════════════════════════════════════════════════

  fastify.post('/api/v1/service', {
    preHandler: [fastify.authenticate],
    schema: { body: CreateServiceSchema },
  }, async (request, reply) => {
    const data = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    if (!data.name) data.name = 'Untitled';
    if (!data.code) data.code = `SVC-${Date.now()}`;

    // ═══════════════════════════════════════════════════════════════
    // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC CHECK
    // Check: Can user CREATE services?
    // ═══════════════════════════════════════════════════════════════
    const canCreate = await entityInfra.check_entity_rbac(userId, ENTITY_CODE, ALL_ENTITIES_ID, Permission.CREATE);
    if (!canCreate) {
      return reply.status(403).send({ error: 'No permission to create services' });
    }

    try {
      const result = await db.execute(sql`
        INSERT INTO app.service (
          code, name, descr, metadata,
          service_category, standard_rate_amt, estimated_hours,
          minimum_charge_amt, taxable_flag, requires_certification_flag,
          active_flag
        )
        VALUES (
          ${data.code}, ${data.name}, ${data.descr || null},
          ${data.metadata ? JSON.stringify(data.metadata) : '{}'}::jsonb,
          ${data.service_category || null}, ${data.standard_rate_amt || null},
          ${data.estimated_hours || null}, ${data.minimum_charge_amt || null},
          ${data.taxable_flag !== false}, ${data.requires_certification_flag || false},
          true
        )
        RETURNING *
      `);

      const newService = result[0] as any;

      await db.execute(sql`
        INSERT INTO app.entity_instance (entity_type, entity_id, entity_name, entity_code)
        VALUES ('service', ${newService.id}::uuid, ${newService.name}, ${newService.code})
        ON CONFLICT (entity_type, entity_id) DO UPDATE
        SET entity_name = EXCLUDED.entity_name, entity_code = EXCLUDED.entity_code, updated_ts = NOW()
      `);

      return reply.status(201).send(filterUniversalColumns(newService, {
        canSeePII: true, canSeeFinancial: true, canSeeSystemFields: true, canSeeSafetyInfo: true
      }));
    } catch (error) {
      fastify.log.error('Error creating service:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // DELETE ENDPOINT (FACTORY)
  // ════════════════════════════════════════════════════════════════════════════

  createEntityDeleteEndpoint(fastify, ENTITY_CODE);
}
