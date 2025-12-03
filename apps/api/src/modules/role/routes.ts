/**
 * ============================================================================
 * ROLE ROUTES MODULE - Universal Entity Pattern with Factory
 * ============================================================================
 *
 * REFACTORED: Uses Universal CRUD Factory for GET (list), GET (single), and UPDATE endpoints.
 * CREATE endpoint remains custom due to entity-specific validation and field mapping.
 *
 * ENDPOINTS:
 *   GET    /api/v1/role              - List roles (FACTORY)
 *   GET    /api/v1/role/:id          - Get single role (FACTORY)
 *   POST   /api/v1/role              - Create role (CUSTOM - entity-specific validation)
 *   PATCH  /api/v1/role/:id          - Update role (FACTORY)
 *   PUT    /api/v1/role/:id          - Update role alias (FACTORY)
 *   DELETE /api/v1/role/:id          - Delete role (DELETE FACTORY)
 *   GET    /api/v1/role/:id/{child}  - Child entities (CHILD FACTORY)
 *
 * ============================================================================
 */

import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

// ✨ Entity Infrastructure Service - centralized infrastructure operations
import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID } from '../../services/entity-infrastructure.service.js';

// ✨ Universal Entity CRUD Factory - consolidated endpoint generation
import { createUniversalEntityRoutes, createEntityDeleteEndpoint } from '../../lib/universal-entity-crud-factory.js';

// ============================================================================
// SCHEMA DEFINITIONS
// ============================================================================

const RoleSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  role_code: Type.Optional(Type.String()),
  role_category: Type.Optional(Type.String()),
  reporting_level: Type.Optional(Type.Number()),
  required_experience_years: Type.Optional(Type.Number()),
  management_role_flag: Type.Optional(Type.Boolean()),
  client_facing_flag: Type.Optional(Type.Boolean()),
  safety_critical_flag: Type.Optional(Type.Boolean()),
  background_check_required_flag: Type.Optional(Type.Boolean()),
  bonding_required_flag: Type.Optional(Type.Boolean()),
  licensing_required_flag: Type.Optional(Type.Boolean()),
  active_flag: Type.Boolean(),
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.String()),
  created_ts: Type.String(),
  updated_ts: Type.String(),
  metadata: Type.Optional(Type.Any())
});

const CreateRoleSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  role_code: Type.Optional(Type.String()),
  role_category: Type.Optional(Type.String()),
  reporting_level: Type.Optional(Type.Number()),
  required_experience_years: Type.Optional(Type.Number()),
  management_role_flag: Type.Optional(Type.Boolean()),
  client_facing_flag: Type.Optional(Type.Boolean()),
  safety_critical_flag: Type.Optional(Type.Boolean()),
  background_check_required_flag: Type.Optional(Type.Boolean()),
  bonding_required_flag: Type.Optional(Type.Boolean()),
  licensing_required_flag: Type.Optional(Type.Boolean()),
  active_flag: Type.Optional(Type.Boolean()),
  from_ts: Type.Optional(Type.String({ format: 'date-time' })),
  metadata: Type.Optional(Type.Any())
});

// ============================================================================
// MODULE CONSTANTS
// ============================================================================

const ENTITY_CODE = 'role';

// ============================================================================
// ROUTE REGISTRATION
// ============================================================================

export async function roleRoutes(fastify: FastifyInstance) {
  const entityInfra = getEntityInfrastructure(db);

  // ════════════════════════════════════════════════════════════════════════════
  // UNIVERSAL CRUD ENDPOINTS (FACTORY)
  // ════════════════════════════════════════════════════════════════════════════
  // Creates:
  // - GET /api/v1/role         - List with RBAC, pagination, auto-filters, metadata
  // - GET /api/v1/role/:id     - Single entity with RBAC, ref_data_entityInstance
  // - PATCH /api/v1/role/:id   - Update with RBAC, registry sync
  // - PUT /api/v1/role/:id     - Update alias
  //
  // Features:
  // - content=metadata support for metadata-only responses
  // - ref_data_entityInstance for entity reference resolution
  // - Universal auto-filters from query parameters
  // - Parent-child filtering via entity_instance_link
  // ════════════════════════════════════════════════════════════════════════════

  createUniversalEntityRoutes(fastify, {
    entityCode: ENTITY_CODE,
    tableName: 'role',
    tableAlias: 'e',
    searchFields: ['name', 'descr', 'role_code', 'role_category']
  });

  // ════════════════════════════════════════════════════════════════════════════
  // CREATE ENDPOINT (CUSTOM - Entity-specific validation)
  // ════════════════════════════════════════════════════════════════════════════
  // Remains custom because:
  // - Entity-specific unique name validation
  // - Custom field mapping (roleType → role_code, etc.)
  // - Manual registry and RBAC setup
  // ════════════════════════════════════════════════════════════════════════════

  fastify.post('/api/v1/role', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateRoleSchema,
      querystring: Type.Object({
        parent_entity_code: Type.Optional(Type.String()),
        parent_entity_instance_id: Type.Optional(Type.String({ format: 'uuid' }))
      }),
      response: {
        201: RoleSchema,
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    const { parent_entity_code, parent_entity_instance_id } = request.query as any;
    const data = request.body as any;

    try {
      // RBAC CHECK 1: Can user CREATE roles?
      const canCreate = await entityInfra.check_entity_rbac(
        userId, ENTITY_CODE, ALL_ENTITIES_ID, Permission.CREATE
      );
      if (!canCreate) {
        return reply.status(403).send({ error: 'No permission to create roles' });
      }

      // RBAC CHECK 2: If linking to parent, can user EDIT parent?
      if (parent_entity_code && parent_entity_instance_id) {
        const canEditParent = await entityInfra.check_entity_rbac(
          userId, parent_entity_code, parent_entity_instance_id, Permission.EDIT
        );
        if (!canEditParent) {
          return reply.status(403).send({ error: `No permission to link role to this ${parent_entity_code}` });
        }
      }

      // Unique name validation
      const existingRole = await db.execute(sql`
        SELECT id FROM app.role WHERE name = ${data.name} AND active_flag = true
      `);
      if (existingRole.length > 0) {
        return reply.status(400).send({ error: 'Role with this name already exists' });
      }

      const fromTs = data.from_ts || new Date().toISOString();

      // Transactional CREATE via Entity Infrastructure Service
      const result = await entityInfra.create_entity({
        entity_code: ENTITY_CODE,
        creator_id: userId,
        parent_entity_code,
        parent_entity_id: parent_entity_instance_id,
        primary_table: 'app.role',
        primary_data: {
          name: data.name,
          descr: data.descr || null,
          role_code: data.role_code || null,
          role_category: data.role_category || null,
          reporting_level: data.reporting_level || null,
          required_experience_years: data.required_experience_years || null,
          management_role_flag: data.management_role_flag || false,
          client_facing_flag: data.client_facing_flag || false,
          safety_critical_flag: data.safety_critical_flag || false,
          background_check_required_flag: data.background_check_required_flag || false,
          bonding_required_flag: data.bonding_required_flag || false,
          licensing_required_flag: data.licensing_required_flag || false,
          active_flag: data.active_flag !== false,
          from_ts: fromTs,
          metadata: data.metadata ? JSON.stringify(data.metadata) : '{}'
        },
        code_field: 'role_code'
      });

      return reply.status(201).send(result.entity);

    } catch (error) {
      fastify.log.error('Error creating role:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // DELETE ENDPOINT (FACTORY)
  // ════════════════════════════════════════════════════════════════════════════

  createEntityDeleteEndpoint(fastify, ENTITY_CODE);
}
