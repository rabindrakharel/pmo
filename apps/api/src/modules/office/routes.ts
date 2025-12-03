/**
 * ============================================================================
 * OFFICE ROUTES MODULE - Universal Entity Pattern with Factory
 * ============================================================================
 *
 * REFACTORED: Uses Universal CRUD Factory for GET (list), GET (single), and UPDATE endpoints.
 * CREATE endpoint remains custom due to entity-specific validation.
 *
 * ENDPOINTS:
 *   GET    /api/v1/office                         - List offices (FACTORY)
 *   GET    /api/v1/office/:id                     - Get single office (FACTORY)
 *   POST   /api/v1/office                         - Create office (CUSTOM)
 *   PATCH  /api/v1/office/:id                     - Update office (FACTORY)
 *   PUT    /api/v1/office/:id                     - Update office alias (FACTORY)
 *   DELETE /api/v1/office/:id                     - Delete office (DELETE FACTORY)
 *   GET    /api/v1/office/:id/dynamic-child-entity-tabs - Child tab metadata (CUSTOM)
 *   GET    /api/v1/office/:id/{child}             - Child entities (CHILD FACTORY)
 *
 * ============================================================================
 */

import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '../../db/index.js';
import { sql } from 'drizzle-orm';

// ✨ Entity Infrastructure Service - centralized infrastructure operations
import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID } from '../../services/entity-infrastructure.service.js';

// ✨ Universal Entity CRUD Factory - consolidated endpoint generation
import { createUniversalEntityRoutes, createEntityDeleteEndpoint } from '../../lib/universal-entity-crud-factory.js';

// ============================================================================
// SCHEMA DEFINITIONS
// ============================================================================

const OfficeSchema = Type.Object({
  id: Type.String(),
  code: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
  // Physical location fields
  address_line1: Type.Optional(Type.String()),
  address_line2: Type.Optional(Type.String()),
  city: Type.Optional(Type.String()),
  province: Type.Optional(Type.String()),
  postal_code: Type.Optional(Type.String()),
  country: Type.Optional(Type.String()),
  // Contact and operational fields
  phone: Type.Optional(Type.String()),
  email: Type.Optional(Type.String()),
  office_type: Type.Optional(Type.String()),
  capacity_employees: Type.Optional(Type.Number()),
  square_footage: Type.Optional(Type.Number()),
  // Temporal audit fields
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.String()),
  active_flag: Type.Boolean(),
  created_ts: Type.String(),
  updated_ts: Type.String(),
  version: Type.Number(),
});

const CreateOfficeSchema = Type.Object({
  code: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
  // Physical location fields
  address_line1: Type.Optional(Type.String()),
  address_line2: Type.Optional(Type.String()),
  city: Type.Optional(Type.String()),
  province: Type.Optional(Type.String()),
  postal_code: Type.Optional(Type.String()),
  country: Type.Optional(Type.String()),
  // Contact and operational fields
  phone: Type.Optional(Type.String()),
  email: Type.Optional(Type.String()),
  office_type: Type.Optional(Type.String()),
  capacity_employees: Type.Optional(Type.Number()),
  square_footage: Type.Optional(Type.Number()),
  active_flag: Type.Optional(Type.Boolean()),
});

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
  // Creates:
  // - GET /api/v1/office         - List with RBAC, pagination, auto-filters, metadata
  // - GET /api/v1/office/:id     - Single entity with RBAC, ref_data_entityInstance
  // - PATCH /api/v1/office/:id   - Update with RBAC, registry sync
  // - PUT /api/v1/office/:id     - Update alias
  //
  // Features:
  // - content=metadata support for metadata-only responses
  // - ref_data_entityInstance for entity reference resolution
  // - Universal auto-filters from query parameters
  // - Parent-child filtering via entity_instance_link
  // ════════════════════════════════════════════════════════════════════════════

  createUniversalEntityRoutes(fastify, {
    entityCode: ENTITY_CODE,
    tableName: 'office',
    tableAlias: 'e',
    searchFields: ['name', 'descr', 'code', 'city', 'province', 'address_line1']
  });

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

  // ════════════════════════════════════════════════════════════════════════════
  // CREATE ENDPOINT (CUSTOM - Entity-specific validation)
  // ════════════════════════════════════════════════════════════════════════════
  // Remains custom because:
  // - Entity-specific unique code validation
  // - Custom default values (country = 'Canada')
  // ════════════════════════════════════════════════════════════════════════════

  fastify.post('/api/v1/office', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateOfficeSchema,
      querystring: Type.Object({
        parent_entity_code: Type.Optional(Type.String()),
        parent_entity_instance_id: Type.Optional(Type.String({ format: 'uuid' }))
      }),
      response: {
        201: OfficeSchema,
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    const { parent_entity_code, parent_entity_instance_id } = request.query as any;
    const data = request.body as any;

    try {
      // RBAC CHECK 1: Can user CREATE offices?
      const canCreate = await entityInfra.check_entity_rbac(
        userId, ENTITY_CODE, ALL_ENTITIES_ID, Permission.CREATE
      );
      if (!canCreate) {
        return reply.status(403).send({ error: 'No permission to create offices' });
      }

      // RBAC CHECK 2: If linking to parent, can user EDIT parent?
      if (parent_entity_code && parent_entity_instance_id) {
        const canEditParent = await entityInfra.check_entity_rbac(
          userId, parent_entity_code, parent_entity_instance_id, Permission.EDIT
        );
        if (!canEditParent) {
          return reply.status(403).send({
            error: `No permission to link office to this ${parent_entity_code}`
          });
        }
      }

      // Unique code validation
      if (data.code) {
        const existingOffice = await db.execute(sql`
          SELECT id FROM app.office WHERE code = ${data.code} AND active_flag = true
        `);
        if (existingOffice.length > 0) {
          return reply.status(400).send({ error: 'Office with this code already exists' });
        }
      }

      // Transactional CREATE via Entity Infrastructure Service
      const result = await entityInfra.create_entity({
        entity_code: ENTITY_CODE,
        creator_id: userId,
        parent_entity_code,
        parent_entity_id: parent_entity_instance_id,
        primary_table: 'app.office',
        primary_data: {
          code: data.code,
          name: data.name,
          descr: data.descr || null,
          metadata: data.metadata ? JSON.stringify(data.metadata) : '{}',
          address_line1: data.address_line1 || null,
          address_line2: data.address_line2 || null,
          city: data.city || null,
          province: data.province || null,
          postal_code: data.postal_code || null,
          country: data.country || 'Canada',
          phone: data.phone || null,
          email: data.email || null,
          office_type: data.office_type || null,
          capacity_employees: data.capacity_employees || null,
          square_footage: data.square_footage || null,
          active_flag: data.active_flag !== false
        }
      });

      return reply.status(201).send(result.entity);

    } catch (error) {
      fastify.log.error('Error creating office:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // DELETE ENDPOINT (FACTORY)
  // ════════════════════════════════════════════════════════════════════════════

  createEntityDeleteEndpoint(fastify, ENTITY_CODE);
}
