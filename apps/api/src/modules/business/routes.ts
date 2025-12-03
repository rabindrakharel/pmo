/**
 * ============================================================================
 * BUSINESS ROUTES MODULE - Universal Entity Pattern with Entity Infrastructure Service
 * ============================================================================
 *
 * SEMANTICS & PURPOSE:
 * This module implements CRUD operations and metadata endpoints for the Business
 * entity following the PMO platform's Universal Entity System architecture.
 *
 * Business units represent organizational divisions, departments, or teams with
 * operational autonomy. They track headcount, operational status, and can be
 * linked to office locations. Business units serve as parent containers for
 * projects, employees, and other operational entities.
 *
 * ============================================================================
 * DESIGN PATTERNS & ARCHITECTURE
 * ============================================================================
 *
 * 1. ENTITY INFRASTRUCTURE SERVICE PATTERN (Security & Infrastructure) ✅
 * ────────────────────────────────────────────────────────────────────────
 * All endpoints use centralized infrastructure management via entity-infrastructure.service.ts:
 *
 *   • check_entity_rbac() - Person-based permission checking
 *     - Direct employee permissions (via entity_rbac table)
 *     - Permission levels: 0=VIEW, 1=COMMENT, 3=EDIT, 4=SHARE, 5=DELETE, 6=CREATE, 7=OWNER
 *
 *   • set_entity_instance_link() - Parent-child relationship management
 *     - Links entities via entity_instance_link table
 *     - Enables create-link-edit pattern (create child, link to parent)
 *
 * Usage Example:
 *   const canView = await entityInfra.check_entity_rbac(
 *     userId, ENTITY_CODE, id, Permission.VIEW
 *   );
 *
 * 2. CREATE-LINK-EDIT PATTERN (Parent-Child Relationships)
 * ─────────────────────────────────────────────────────────
 * Instead of nested creation endpoints, we use:
 *   1. Create entity independently: POST /api/v1/business
 *   2. Link to parent via entity_instance_link (automatic if parent_entity_code/parent_entity_instance_id provided)
 *   3. Edit/view in context: GET /api/v1/business?parent_entity_code=office&parent_entity_instance_id={id}
 *
 * Benefits:
 *   • Entities exist independently (no orphans when parent deleted)
 *   • Many-to-many relationships supported naturally
 *   • Simpler API surface (no custom nested endpoints)
 *
 * 3. MODULE-LEVEL CONSTANTS (DRY Principle)
 * ──────────────────────────────────────────
 *   const ENTITY_CODE = 'business';  // Used in all DB queries and gates
 *   const TABLE_ALIAS = 'e';         // Consistent SQL alias
 *
 * ============================================================================
 * DATA MODEL
 * ============================================================================
 *
 * Primary Table: app.business
 *   • Core fields: id, code, name, descr, metadata
 *   • Business-specific: office_id, current_headcount, operational_status
 *   • Temporal: from_ts, to_ts, active_flag, created_ts, updated_ts, version
 *
 * Relationships (via entity_instance_link):
 *   • Parent entities: office
 *   • Child entities: project, employee, client
 *
 * Hierarchy (via d_business_hierarchy):
 *   • Organizational structure separate from physical office locations
 *   • See /api/v1/business-hierarchy for hierarchy management
 *
 * Permissions (via entity_rbac):
 *   • Supports both entity-level (entity_id = 'all') and instance-level permissions
 *   • Permission levels: 0=VIEW, 1=EDIT, 2=SHARE, 3=DELETE, 4=CREATE, 5=OWNER
 *
 * ============================================================================
 * ENDPOINT CATALOG
 * ============================================================================
 *
 * CORE CRUD:
 *   GET    /api/v1/business                    - List businesses (with RBAC + optional parent filter)
 *   GET    /api/v1/business/:id                - Get single business (RBAC checked)
 *   POST   /api/v1/business                    - Create business (with optional parent linking)
 *   PATCH  /api/v1/business/:id                - Update business (RBAC checked)
 *   DELETE /api/v1/business/:id                - Soft delete business (factory endpoint)
 *
 * PARENT-FILTERED QUERIES:
 *   GET    /api/v1/business?parent_entity_code=office&parent_entity_instance_id={id}  - Businesses in specific office
 *
 * ============================================================================
 * PERMISSION FLOW EXAMPLES
 * ============================================================================
 *
 * Example 1: List Businesses with RBAC
 *   1. User requests GET /api/v1/business
 *   2. entityInfra.get_entity_rbac_where_condition() generates SQL WHERE condition
 *   3. SQL query includes RBAC filtering via entity_rbac table
 *   4. Returns only businesses user can view
 *
 * Example 2: Create Business in Office Context
 *   1. User requests POST /api/v1/business?parent_entity_code=office&parent_entity_instance_id={id}
 *   2. Check: Can user CREATE businesses? (type-level permission via entity_rbac)
 *   3. Check: Can user EDIT parent office? (required to link child)
 *   4. Create business in business table
 *   5. Register in entity_instance via entityInfra.set_entity_instance_registry()
 *   6. Link to office via entityInfra.set_entity_instance_link()
 *   7. Auto-grant OWNER permission via entityInfra.set_entity_rbac_owner()
 *
 * Example 3: Filter Businesses by Parent Office
 *   1. User requests GET /api/v1/business?parent_entity_code=office&parent_entity_instance_id={id}
 *   2. RBAC filtering via entityInfra.get_entity_rbac_where_condition()
 *   3. Parent-child filtering via SQL JOIN with entity_instance_link table
 *   4. Returns intersection: businesses user can see AND linked to office
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
import { createUniversalEntityRoutes } from '../../lib/universal-entity-crud-factory.js';

// Schema based on actual d_business table structure
const BizSchema = Type.Object({
  id: Type.String(),
  code: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
  office_id: Type.Optional(Type.String()),
  current_headcount: Type.Optional(Type.Number()),
  operational_status: Type.Optional(Type.String()),
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.String()),
  active_flag: Type.Boolean(),
  created_ts: Type.String(),
  updated_ts: Type.String(),
  version: Type.Number(),
});

const CreateBizSchema = Type.Object({
  code: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
  office_id: Type.Optional(Type.String({ format: 'uuid' })),
  current_headcount: Type.Optional(Type.Number()),
  operational_status: Type.Optional(Type.String()),
  active_flag: Type.Optional(Type.Boolean()),
});

// ============================================================================
// Module-level constants (DRY - used across all endpoints)
// ============================================================================
const ENTITY_CODE = 'business';
const TABLE_ALIAS = 'e';

export async function businessRoutes(fastify: FastifyInstance) {
  // ✨ Initialize Entity Infrastructure Service
  const entityInfra = getEntityInfrastructure(db);

  // ════════════════════════════════════════════════════════════════════════════
  // UNIVERSAL CRUD ENDPOINTS (FACTORY)
  // ════════════════════════════════════════════════════════════════════════════
  // Creates:
  // - GET /api/v1/business         - List with RBAC, pagination, auto-filters, metadata
  // - GET /api/v1/business/:id     - Single entity with RBAC, ref_data_entityInstance
  // - PATCH /api/v1/business/:id   - Update with RBAC, registry sync
  // - PUT /api/v1/business/:id     - Update alias
  //
  // Features:
  // - content=metadata support for metadata-only responses
  // - ref_data_entityInstance for entity reference resolution
  // - Universal auto-filters from query parameters
  // - Parent-child filtering via entity_instance_link
  // ════════════════════════════════════════════════════════════════════════════

  createUniversalEntityRoutes(fastify, {
    entityCode: ENTITY_CODE,
    tableName: 'business',
    tableAlias: 'e',
    searchFields: ['name', 'descr', 'code', 'operational_status']
  });

  // ============================================================================
  // NOTE: /api/v1/business/:id/project endpoint REMOVED
  // ============================================================================
  // Use create-link-edit pattern instead:
  // GET /api/v1/project?parent_entity_code=business&parent_entity_instance_id={id}
  // ============================================================================

  // ============================================================================
  // Get Dynamic Child Entity Tabs (Metadata)
  // ============================================================================

  fastify.get('/api/v1/business/:id/dynamic-child-entity-tabs', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    const { id } = request.params as { id: string };

    // ═══════════════════════════════════════════════════════════════
    // ✅ ENTITY INFRASTRUCTURE SERVICE - RBAC check
    // ═══════════════════════════════════════════════════════════════
    const canView = await entityInfra.check_entity_rbac(userId, ENTITY_CODE, id, Permission.VIEW);
    if (!canView) {
      return reply.status(403).send({ error: 'No permission to view this business' });
    }

    // ═══════════════════════════════════════════════════════════════
    // ✅ ENTITY INFRASTRUCTURE SERVICE - Get child entity metadata
    // Returns child entity types with labels/icons from entity
    // ═══════════════════════════════════════════════════════════════
    const tabs = await entityInfra.get_dynamic_child_entity_tabs(ENTITY_CODE);
    return reply.send({ tabs });
  });

  // ============================================================================
  // Get Creatable Entities (Metadata)
  // ============================================================================

  fastify.get('/api/v1/business/:id/creatable', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    const { id } = request.params as { id: string };

    // ═══════════════════════════════════════════════════════════════
    // ✅ ENTITY INFRASTRUCTURE SERVICE - RBAC check
    // Uses: entityInfra.check_entity_rbac() (4 params, db is pre-bound)
    // ═══════════════════════════════════════════════════════════════
    const canView = await entityInfra.check_entity_rbac(userId, ENTITY_CODE, id, Permission.VIEW);
    if (!canView) {
      return reply.status(403).send({ error: 'No permission to view this business' });
    }

    // Get entity configuration
    const entityConfig = await db.execute(sql`
      SELECT child_entity_codes
      FROM app.entity
      WHERE code = ${ENTITY_CODE}
        AND active_flag = true
    `);

    if (entityConfig.length === 0) {
      return reply.send({ creatable: [] });
    }

    const childEntities = entityConfig[0].child_entity_codes || [];

    // ═══════════════════════════════════════════════════════════════
    // ✅ ENTITY INFRASTRUCTURE SERVICE - Check CREATE permissions
    // Uses: entityInfra.check_entity_rbac() (4 params, db is pre-bound)
    // ═══════════════════════════════════════════════════════════════
    const creatableEntities = await Promise.all(
      childEntities.map(async (childType: string) => {
        const canCreate = await entityInfra.check_entity_rbac(userId, childType, ALL_ENTITIES_ID, Permission.CREATE);
        return canCreate ? childType : null;
      })
    );

    return reply.send({
      creatable: creatableEntities.filter(Boolean)
    });
  });


  // ============================================================================
  // Create Business Unit
  // ============================================================================
  // URL: POST /api/v1/business
  // URL: POST /api/v1/business?parent_entity_code=office&parent_entity_instance_id={id}
  // ============================================================================

  fastify.post('/api/v1/business', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        parent_entity_code: Type.Optional(Type.String()),
        parent_entity_instance_id: Type.Optional(Type.String({ format: 'uuid' }))
      }),
      body: CreateBizSchema,
      response: {
        201: BizSchema,
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    const { parent_entity_code, parent_entity_instance_id } = request.query as any;
    const bizData = request.body as any;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC CHECK 1
      // Check: Can user CREATE business units?
      // ═══════════════════════════════════════════════════════════════
      const canCreate = await entityInfra.check_entity_rbac(userId, ENTITY_CODE, ALL_ENTITIES_ID, Permission.CREATE);
      if (!canCreate) {
        return reply.status(403).send({ error: 'No permission to create business units' });
      }

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC CHECK 2
      // Check: If linking to parent, can user EDIT parent?
      // ═══════════════════════════════════════════════════════════════
      if (parent_entity_code && parent_entity_instance_id) {
        const canEditParent = await entityInfra.check_entity_rbac(userId, parent_entity_code, parent_entity_instance_id, Permission.EDIT);
        if (!canEditParent) {
          return reply.status(403).send({ error: `No permission to link business to this ${parent_entity_code}` });
        }
      }

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - TRANSACTIONAL CREATE
      // All 4 steps (INSERT + registry + RBAC + linkage) in ONE transaction
      // ═══════════════════════════════════════════════════════════════
      const result = await entityInfra.create_entity({
        entity_code: ENTITY_CODE,
        creator_id: userId,
        parent_entity_code: parent_entity_code,
        parent_entity_id: parent_entity_instance_id,
        primary_table: 'app.business',
        primary_data: {
          code: bizData.code,
          name: bizData.name,
          descr: bizData.descr || null,
          metadata: bizData.metadata || null,
          office_id: bizData.office_id || null,
          current_headcount: bizData.current_headcount || null,
          operational_status: bizData.operational_status || null,
          active_flag: bizData.active_flag !== undefined ? bizData.active_flag : true
        }
      });

      return reply.status(201).send(result.entity);
    } catch (error) {
      fastify.log.error('Error creating business:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // DELETE endpoint is automatically created by createUniversalEntityRoutes above
}
