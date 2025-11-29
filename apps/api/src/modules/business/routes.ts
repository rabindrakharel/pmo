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
import { sql, SQL } from 'drizzle-orm';
// ✨ Entity Infrastructure Service - centralized infrastructure operations
import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID } from '../../services/entity-infrastructure.service.js';
// ✨ Universal auto-filter builder - zero-config query filtering
import { buildAutoFilters } from '../../lib/universal-filter-builder.js';
// ✨ Backend Formatter Service - component-aware metadata generation
import { generateEntityResponse } from '../../services/backend-formatter.service.js';
// ✨ Datalabel Service - fetch datalabel options for dropdowns and DAG visualization
// ✅ Delete factory for cascading soft deletes
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';
// ✅ Child entity factory for parent-child relationships
import { createChildEntityEndpointsFromMetadata } from '../../lib/child-entity-route-factory.js';

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

// Response schema for metadata-driven endpoints (single entity)
const BizWithMetadataSchema = Type.Object({
  data: BizSchema,
  fields: Type.Array(Type.String()),  // Field names list
  metadata: Type.Any(),  // EntityMetadata - component-specific field metadata
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

const UpdateBizSchema = Type.Partial(CreateBizSchema);

// ============================================================================
// Module-level constants (DRY - used across all endpoints)
// ============================================================================
const ENTITY_CODE = 'business';
const TABLE_ALIAS = 'e';

export async function businessRoutes(fastify: FastifyInstance) {
  // ✨ Initialize Entity Infrastructure Service
  const entityInfra = getEntityInfrastructure(db);

  // ============================================================================
  // List Business Units (Main Page or Child Tab)
  // ============================================================================
  // URL: GET /api/v1/business
  // URL: GET /api/v1/business?parent_entity_code=office&parent_entity_instance_id={id}
  // ============================================================================

  fastify.get('/api/v1/business', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        // Parent filtering (create-link-edit pattern)
        parent_entity_code: Type.Optional(Type.String()),
        parent_entity_instance_id: Type.Optional(Type.String({ format: 'uuid' })),

        // Standard filters
        active_flag: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        operational_status: Type.Optional(Type.String()),

        // Pagination
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
        page: Type.Optional(Type.Number({ minimum: 1 })),

        // Component-aware metadata
        view: Type.Optional(Type.String()),  // 'entityListOfInstancesTable,kanbanView' or 'entityInstanceFormContainer'
      }),
      response: {
        200: Type.Object({
          data: Type.Array(BizSchema),
          fields: Type.Array(Type.String()),
          metadata: Type.Any(),  // EntityMetadata - component-specific field metadata
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number(),
          appliedFilters: Type.Optional(Type.Object({
            rbac: Type.Boolean(),
            parent: Type.Boolean(),
            search: Type.Boolean(),
            active: Type.Boolean()
          }))
        }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    const {
      parent_entity_code,
      parent_entity_instance_id,
      active_flag,
      search,
      operational_status,
      limit: queryLimit,
      offset: queryOffset,
      page,
      view
    } = request.query as any;

    // Calculate pagination with defaults
    const limit = queryLimit || 50;
    const offset = page ? (page - 1) * limit : (queryOffset || 0);

    try {
      // ═══════════════════════════════════════════════════════════════
      // NEW PATTERN: Route builds SQL, gates augment it
      // ═══════════════════════════════════════════════════════════════

      // Build WHERE conditions array
      const conditions: SQL[] = [];

      // GATE 1: RBAC - Apply security filtering (REQUIRED)
      const rbacWhereClause = await entityInfra.get_entity_rbac_where_condition(userId, ENTITY_CODE, Permission.VIEW, TABLE_ALIAS
      );
      conditions.push(rbacWhereClause);

      // ✅ DEFAULT FILTER: Only show active records (not soft-deleted)
      // Can be overridden with ?active=false to show inactive records
      if (!('active' in (request.query as any))) {
        conditions.push(sql`${sql.raw(TABLE_ALIAS)}.active_flag = true`);
      }

      // ✨ UNIVERSAL AUTO-FILTER SYSTEM
      // Automatically builds filters from ANY query parameter based on field naming conventions
      // Supports: ?name=X, ?operational_status=Y, ?active_flag=true, ?search=Z, etc.
      // See: apps/api/src/lib/universal-filter-builder.ts
      const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query as any, {
        overrides: {
          active: { column: 'active_flag', type: 'boolean' }
        }
      });
      conditions.push(...autoFilters);

      // Build JOINs array
      const joins: SQL[] = [];

      // GATE 2: PARENT-CHILD FILTERING (OPTIONAL when parent context provided)
      if (parent_entity_code && parent_entity_instance_id) {
        const parentJoin = sql`
          INNER JOIN app.entity_instance_link eil
            ON eil.child_entity_code = ${ENTITY_CODE}
            AND eil.child_entity_instance_id = ${sql.raw(TABLE_ALIAS)}.id
            AND eil.entity_code = ${parent_entity_code}
            AND eil.entity_instance_id = ${parent_entity_instance_id}
        `;
        joins.push(parentJoin);
      }

      // Build WHERE clause
      const whereClause = conditions.length > 0
        ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
        : sql``;

      // Build JOINs clause
      const joinsClause = joins.length > 0
        ? sql.join(joins, sql` `)
        : sql``;

      // Count query
      const countQuery = sql`
        SELECT COUNT(DISTINCT ${sql.raw(TABLE_ALIAS)}.id) as total
        FROM app.${sql.raw(ENTITY_CODE)} ${sql.raw(TABLE_ALIAS)}
        ${joinsClause}
        ${whereClause}
      `;

      // Data query (route owns this!)
      const dataQuery = sql`
        SELECT DISTINCT ${sql.raw(TABLE_ALIAS)}.*
        FROM app.${sql.raw(ENTITY_CODE)} ${sql.raw(TABLE_ALIAS)}
        ${joinsClause}
        ${whereClause}
        ORDER BY ${sql.raw(TABLE_ALIAS)}.created_ts DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      // Execute queries in parallel
      const [countResult, dataResult] = await Promise.all([
        db.execute(countQuery),
        db.execute(dataQuery)
      ]);

      const total = Number(countResult[0]?.total || 0);

      // ═══════════════════════════════════════════════════════════════
      // ✨ BACKEND FORMATTER SERVICE V5.0 - Component-aware metadata
      // Parse requested view (convert view names to component names)
      // ═══════════════════════════════════════════════════════════════
      const requestedComponents = view
        ? view.split(',').map((v: string) => v.trim())
        : ['entityListOfInstancesTable', 'entityInstanceFormContainer', 'kanbanView'];

      // Generate response with metadata for requested components only
      const response = generateEntityResponse(ENTITY_CODE, dataResult, {
        components: requestedComponents,
        total,
        limit,
        offset
      });

      // Add applied filters for debugging
      (response as any).appliedFilters = {
        rbac: true,
        parent: Boolean(parent_entity_code && parent_entity_instance_id),
        search: Boolean(search),
        active: Boolean(active_flag)
      };

      return reply.send(response);
    } catch (error) {
      fastify.log.error('Error fetching business units:', error as any);
      console.error('Full error details:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
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
  // Get Single Business Unit
  // ============================================================================

  fastify.get('/api/v1/business/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
      querystring: Type.Object({
        view: Type.Optional(Type.String()),  // 'entityInstanceFormContainer' or 'entityListOfInstancesTable'
      }),
      response: {
        200: BizWithMetadataSchema,  // ✅ Fixed: Use metadata-driven schema
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    const { id } = request.params as { id: string };
    const { view } = request.query as any;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // ═══════════════════════════════════════════════════════════════
      // NEW PATTERN: RBAC gate check, then simple SELECT
      // ═══════════════════════════════════════════════════════════════

      // GATE: RBAC - Check permission
      const canView = await entityInfra.check_entity_rbac(
        userId,
        ENTITY_CODE,
        id,
        Permission.VIEW
      );

      if (!canView) {
        return reply.status(403).send({ error: 'No permission to view this business' });
      }

      // Route owns the query
      const result = await db.execute(sql`
        SELECT *
        FROM app.business
        WHERE id = ${id}::uuid
          AND active_flag = true
      `);

      if (result.length === 0) {
        return reply.status(404).send({ error: 'Business not found' });
      }

      // ═══════════════════════════════════════════════════════════════
      // ✨ BACKEND FORMATTER SERVICE V5.0 - Component-aware metadata
      // Parse requested view (default to formContainer)
      // ═══════════════════════════════════════════════════════════════
      const requestedComponents = view
        ? view.split(',').map((v: string) => v.trim())
        : ['entityInstanceFormContainer'];

      const response = generateEntityResponse(ENTITY_CODE, [result[0]], {
        components: requestedComponents,
        total: 1,
        limit: 1,
        offset: 0
      });

      // Return first item (single entity)
      return reply.send({
        data: response.data[0],
        fields: response.fields,
        metadata: response.metadata,
      });
    } catch (error) {
      fastify.log.error('Error fetching business:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
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

  // ============================================================================
  // Update Business Unit
  // ============================================================================

  fastify.patch('/api/v1/business/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
      body: UpdateBizSchema,
      response: {
        200: BizSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    const { id } = request.params as { id: string };
    const updates = request.body as any;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC CHECK
      // Check: Can user EDIT this business?
      // ═══════════════════════════════════════════════════════════════
      const canEdit = await entityInfra.check_entity_rbac(userId, ENTITY_CODE, id, Permission.EDIT);
      if (!canEdit) {
        return reply.status(403).send({ error: 'No permission to edit this business' });
      }

      // ═══════════════════════════════════════════════════════════════
      // ✅ ROUTE OWNS: Update business in primary table
      // ═══════════════════════════════════════════════════════════════
      // Build update fields
      const updateFields: any[] = [];
      if (updates.code !== undefined) updateFields.push(sql`code = ${updates.code}`);
      if (updates.name !== undefined) updateFields.push(sql`name = ${updates.name}`);
      if (updates.descr !== undefined) updateFields.push(sql`"descr" = ${updates.descr}`);
      if (updates.metadata !== undefined) updateFields.push(sql`metadata = ${updates.metadata}`);
      if (updates.office_id !== undefined) updateFields.push(sql`office_id = ${updates.office_id}`);
      if (updates.current_headcount !== undefined) updateFields.push(sql`current_headcount = ${updates.current_headcount}`);
      if (updates.operational_status !== undefined) updateFields.push(sql`operational_status = ${updates.operational_status}`);
      if (updates.active_flag !== undefined) updateFields.push(sql`active_flag = ${updates.active_flag}`);

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated_ts = now()`);
      updateFields.push(sql`version = version + 1`);

      // Update business
      const updated = await db.execute(sql`
        UPDATE app.business
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      if (updated.length === 0) {
        return reply.status(404).send({ error: 'Business not found' });
      }

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - Sync registry if name/code changed
      // ═══════════════════════════════════════════════════════════════
      if (updates.name !== undefined || updates.code !== undefined) {
        await entityInfra.update_entity_instance_registry(ENTITY_CODE, id, {
          entity_name: updates.name,
          instance_code: updates.code
        });
      }

      return reply.send(updated[0]);
    } catch (error) {
      fastify.log.error('Error updating business:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Update Business Unit (PUT - alias to PATCH for frontend compatibility)
  // ============================================================================

  fastify.put('/api/v1/business/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
      body: UpdateBizSchema,
      response: {
        200: BizSchema,
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    const { id } = request.params as { id: string };
    const updates = request.body as any;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC CHECK
      // Check: Can user EDIT this business?
      // ═══════════════════════════════════════════════════════════════
      const canEdit = await entityInfra.check_entity_rbac(userId, ENTITY_CODE, id, Permission.EDIT);
      if (!canEdit) {
        return reply.status(403).send({ error: 'No permission to edit this business' });
      }

      // ═══════════════════════════════════════════════════════════════
      // ✅ ROUTE OWNS: Update business in primary table
      // ═══════════════════════════════════════════════════════════════
      // Build update fields
      const updateFields: any[] = [];
      if (updates.code !== undefined) updateFields.push(sql`code = ${updates.code}`);
      if (updates.name !== undefined) updateFields.push(sql`name = ${updates.name}`);
      if (updates.descr !== undefined) updateFields.push(sql`"descr" = ${updates.descr}`);
      if (updates.metadata !== undefined) updateFields.push(sql`metadata = ${updates.metadata}`);
      if (updates.office_id !== undefined) updateFields.push(sql`office_id = ${updates.office_id}`);
      if (updates.current_headcount !== undefined) updateFields.push(sql`current_headcount = ${updates.current_headcount}`);
      if (updates.operational_status !== undefined) updateFields.push(sql`operational_status = ${updates.operational_status}`);
      if (updates.active_flag !== undefined) updateFields.push(sql`active_flag = ${updates.active_flag}`);

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated_ts = now()`);
      updateFields.push(sql`version = version + 1`);

      // Update business
      const updated = await db.execute(sql`
        UPDATE app.business
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      if (updated.length === 0) {
        return reply.status(404).send({ error: 'Business not found' });
      }

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - Sync registry if name/code changed
      // ═══════════════════════════════════════════════════════════════
      if (updates.name !== undefined || updates.code !== undefined) {
        await entityInfra.update_entity_instance_registry(ENTITY_CODE, id, {
          entity_name: updates.name,
          instance_code: updates.code
        });
      }

      return reply.send(updated[0]);
    } catch (error) {
      fastify.log.error('Error updating business:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Delete Business Unit (Soft Delete via Factory)
  // ============================================================================
  createEntityDeleteEndpoint(fastify, ENTITY_CODE);

  // ============================================================================
  // Child Entity Endpoints (Auto-Generated from entity metadata)
  // ============================================================================
  // Creates: GET /api/v1/business/:id/{child} for each child in entity table.child_entity_codes
  // Uses Entity Infrastructure Service for RBAC + entity_instance_link for parent-child filtering
  await createChildEntityEndpointsFromMetadata(fastify, ENTITY_CODE);
}
