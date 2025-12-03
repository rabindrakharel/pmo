/**
 * ============================================================================
 * WORKSITE ROUTES MODULE - Universal Entity Pattern with Factory
 * ============================================================================
 *
 * REFACTORED: Uses Universal CRUD Factory for GET (list), GET (single), and UPDATE endpoints.
 * CREATE endpoint remains custom due to entity-specific validation.
 *
 * ENDPOINTS:
 *   GET    /api/v1/worksite              - List worksites (FACTORY)
 *   GET    /api/v1/worksite/:id          - Get single worksite (FACTORY)
 *   POST   /api/v1/worksite              - Create worksite (CUSTOM)
 *   PATCH  /api/v1/worksite/:id          - Update worksite (FACTORY)
 *   PUT    /api/v1/worksite/:id          - Update worksite alias (FACTORY)
 *   DELETE /api/v1/worksite/:id          - Delete worksite (DELETE FACTORY)
 *   GET    /api/v1/worksite/:id/{child}  - Child entities (CHILD FACTORY)
 *
 * ============================================================================
 */

import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

// ✨ Universal CRUD Factory - generates standardized endpoints
import { createUniversalEntityRoutes } from '../../lib/universal-crud-factory.js';

// ✅ Delete factory for cascading soft deletes
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';

// ✅ Child entity factory for parent-child relationships
import { createChildEntityEndpointsFromMetadata } from '../../lib/child-entity-route-factory.js';

// Schema based on d_worksite table structure
const WorksiteSchema = Type.Object({
  id: Type.String(),
  // Standard fields
  code: Type.Optional(Type.String()),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.String()),
  active_flag: Type.Boolean(),
  created_ts: Type.String(),
  updated_ts: Type.String(),
  version: Type.Number(),

  // Entity metadata
  metadata: Type.Optional(Type.Object({})),

  // Worksite-specific fields
  worksite_type: Type.String(),

  // Location and organizational context
  addr: Type.Optional(Type.String()),
  postal_code: Type.Optional(Type.String()),
  latitude: Type.Optional(Type.Number()),
  longitude: Type.Optional(Type.Number()),
  time_zone: Type.Optional(Type.String()),

  // Operational attributes
  capacity_workers: Type.Optional(Type.Number()),
  equipment_storage: Type.Optional(Type.Boolean()),
  vehicle_parking: Type.Optional(Type.Number()),
  security_required: Type.Optional(Type.Boolean()),

  // Facility specifications
  indoor_space_sqft: Type.Optional(Type.Number()),
  outdoor_space_sqft: Type.Optional(Type.Number()),
  office_space: Type.Optional(Type.Boolean()),
  washroom_facilities: Type.Optional(Type.Boolean()),
  power_available: Type.Optional(Type.Boolean()),
  water_available: Type.Optional(Type.Boolean()),

  // Safety and compliance
  safety_rating: Type.Optional(Type.String()),
  safety_last_inspection_date: Type.Optional(Type.String()),
  environmental_permits: Type.Optional(Type.Array(Type.String())),

  // Seasonal operations
  seasonal_use: Type.Optional(Type.Boolean()),
  seasonal_period: Type.Optional(Type.String()),

  // Management and emergency
  emergency_contact: Type.Optional(Type.Object({})),
});

const CreateWorksiteSchema = Type.Object({
  code: Type.Optional(Type.String()),
  name: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Object({})),
  worksite_type: Type.Optional(Type.String()),
  addr: Type.Optional(Type.String()),
  postal_code: Type.Optional(Type.String()),
  latitude: Type.Optional(Type.Number()),
  longitude: Type.Optional(Type.Number()),
  time_zone: Type.Optional(Type.String()),
  capacity_workers: Type.Optional(Type.Number()),
  equipment_storage: Type.Optional(Type.Boolean()),
  vehicle_parking: Type.Optional(Type.Number()),
  security_required: Type.Optional(Type.Boolean()),
  indoor_space_sqft: Type.Optional(Type.Number()),
  outdoor_space_sqft: Type.Optional(Type.Number()),
  office_space: Type.Optional(Type.Boolean()),
  washroom_facilities: Type.Optional(Type.Boolean()),
  power_available: Type.Optional(Type.Boolean()),
  water_available: Type.Optional(Type.Boolean()),
  safety_rating: Type.Optional(Type.String()),
  safety_last_inspection_date: Type.Optional(Type.String({ format: 'date' })),
  environmental_permits: Type.Optional(Type.Array(Type.String())),
  seasonal_use: Type.Optional(Type.Boolean()),
  seasonal_period: Type.Optional(Type.String()),
  emergency_contact: Type.Optional(Type.Object({})),
});


// ============================================================================
// Module-level constants (DRY - used across all endpoints)
// ============================================================================
const ENTITY_CODE = 'worksite';
const TABLE_ALIAS = 'w';

export async function worksiteRoutes(fastify: FastifyInstance) {
  // ════════════════════════════════════════════════════════════════════════════
  // UNIVERSAL CRUD ENDPOINTS (FACTORY)
  // ════════════════════════════════════════════════════════════════════════════
  // Creates:
  // - GET /api/v1/worksite         - List with RBAC, pagination, auto-filters, metadata
  // - GET /api/v1/worksite/:id     - Single entity with RBAC, ref_data_entityInstance
  // - PATCH /api/v1/worksite/:id   - Update with RBAC, registry sync
  // - PUT /api/v1/worksite/:id     - Update alias
  //
  // Features:
  // - content=metadata support for metadata-only responses
  // - ref_data_entityInstance for entity reference resolution
  // - Universal auto-filters from query parameters
  // - Parent-child filtering via entity_instance_link
  // ════════════════════════════════════════════════════════════════════════════

  createUniversalEntityRoutes(fastify, {
    entityCode: ENTITY_CODE,
    tableName: 'worksite',
    tableAlias: 'e',
    searchFields: ['name', 'descr', 'code', 'addr', 'postal_code']
  });

  // Create worksite
  fastify.post('/api/v1/worksite', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateWorksiteSchema,
      response: {
        201: WorksiteSchema,
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const data = request.body as any;

    try {
      const result = await db.execute(sql`
        INSERT INTO app.worksite (
          code, name, "descr", metadata, worksite_type, addr,
          postal_code, latitude, longitude, time_zone, capacity_workers,
          equipment_storage_flag, vehicle_parking, security_required_flag,
          indoor_space_sqft, outdoor_space_sqft, office_space_flag,
          washroom_facilities_flag, power_available_flag, water_available_flag,
          safety_rating, safety_last_inspection_date, environmental_permits,
          seasonal_use_flag, seasonal_period, emergency_contact
        )
        VALUES (
          ${data.code || null},
          ${data.name},
          ${data.descr || null},
          ${JSON.stringify(data.metadata || {})}::jsonb,
          ${data.worksite_type || 'project'},
          ${data.addr || null},
          ${data.postal_code || null},
          ${data.latitude || null},
          ${data.longitude || null},
          ${data.time_zone || 'America/Toronto'},
          ${data.capacity_workers || null},
          ${data.equipment_storage || false},
          ${data.vehicle_parking || null},
          ${data.security_required || false},
          ${data.indoor_space_sqft || null},
          ${data.outdoor_space_sqft || null},
          ${data.office_space || false},
          ${data.washroom_facilities || false},
          ${data.power_available || false},
          ${data.water_available || false},
          ${data.safety_rating || null},
          ${data.safety_last_inspection || null},
          ${JSON.stringify(data.environmental_permits || [])},
          ${data.seasonal_use || false},
          ${data.seasonal_period || null},
          ${JSON.stringify(data.emergency_contact || {})}
        )
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to create worksite' });
      }

      reply.status(201);
      return result[0];
    } catch (error) {
      fastify.log.error('Error creating worksite:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // DELETE ENDPOINT (FACTORY)
  // ════════════════════════════════════════════════════════════════════════════

  createEntityDeleteEndpoint(fastify, ENTITY_CODE);

  // ============================================================================
  // Child Entity Endpoints (Auto-Generated from entity metadata)
  // ============================================================================
  await createChildEntityEndpointsFromMetadata(fastify, ENTITY_CODE);
}