/**
 * ============================================================================
 * OFFICE ROUTES - Physical Location Management
 * ============================================================================
 *
 * DESIGN PATTERNS: See /docs/api/entity_endpoint_design.md for reusable patterns
 *
 * ENTITY-SPECIFIC DETAILS:
 *
 * Purpose:
 *   Offices represent physical locations (headquarters, branches, facilities) with
 *   address, capacity, and operational details. Offices serve as geographic containers
 *   for business units and employees.
 *
 *   IMPORTANT: This module handles PHYSICAL LOCATIONS only. For organizational
 *   hierarchy (reporting structure), see /api/v1/office-hierarchy routes.
 *
 * Data Model (app.office):
 *   • Core: id, code, name, descr, metadata
 *   • Address: address_line1, address_line2, city, province, postal_code, country
 *   • Contact: phone, email
 *   • Operational: office_type, capacity_employees, square_footage
 *   • Temporal: from_ts, to_ts, active_flag, created_ts, updated_ts, version
 *
 * Relationships:
 *   • Parent entities: None (top-level geographic entity)
 *   • Child entities: business, employee, worksite
 *
 * Endpoints:
 *   GET    /api/v1/office                    - List offices (RBAC filtered)
 *   GET    /api/v1/office/:id                - Get single office
 *   POST   /api/v1/office                    - Create office
 *   PUT    /api/v1/office/:id                - Update office
 *   DELETE /api/v1/office/:id                - Soft delete
 *   GET    /api/v1/office/:id/business       - Child entities (factory)
 *   GET    /api/v1/office/:id/employee       - Child entities (factory)
 *
 * Filterable Fields:
 *   • office_type, city, province, active_flag
 *
 * ============================================================================
 */

import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '../../db/index.js';
import { sql } from 'drizzle-orm';
import {
  getUniversalColumnMetadata,
  filterUniversalColumns,
  getColumnsByMetadata,
  createPaginatedResponse
} from '../../lib/universal-schema-metadata.js';
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';
import { createChildEntityEndpointsFromMetadata } from '../../lib/child-entity-route-factory.js';
// ✅ Centralized unified data gate - loosely coupled API
// ✨ Entity Infrastructure Service - centralized infrastructure operations
import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID } from '../../services/entity-infrastructure.service.js';
// ✨ Universal auto-filter builder - zero-config query filtering
import { buildAutoFilters } from '../../lib/universal-filter-builder.js';
// ✨ Backend Formatter Service - component-aware metadata generation
import { generateEntityResponse, extractDatalabelKeys } from '../../services/backend-formatter.service.js';
// ✨ Datalabel Service - fetch datalabel options for dropdowns and DAG visualization

// Schema based on actual d_office table structure (physical locations only)
// NOTE: Hierarchy fields (parent_id, dl__office_hierarchy_level) are in d_office_hierarchy
// Use /api/v1/office-hierarchy for organizational hierarchy management
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

// Response schema for metadata-driven endpoints (single entity)
const OfficeWithMetadataSchema = Type.Object({
  data: OfficeSchema,
  fields: Type.Array(Type.String()),  // Field names list
  metadata: Type.Any(),  // EntityMetadata - component-specific field metadata
  datalabels: Type.Array(Type.Any()),  // DatalabelData[] - options for dl__* fields (not optional!)
  globalSettings: Type.Any()  // GlobalSettings - currency, date, timestamp formatting
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

const UpdateOfficeSchema = Type.Partial(CreateOfficeSchema);

// ============================================================================
// Module-level constants (DRY - used across all endpoints)
// ============================================================================
const ENTITY_CODE = 'office';
const TABLE_ALIAS = 'o';

export async function officeRoutes(fastify: FastifyInstance) {
  // ✨ Initialize Entity Infrastructure Service
  const entityInfra = getEntityInfrastructure(db);

  // List physical office locations with filtering
  fastify.get('/api/v1/office', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        active_flag: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        office_type: Type.Optional(Type.String()),
        city: Type.Optional(Type.String()),
        province: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
        page: Type.Optional(Type.Number({ minimum: 1 })),
        view: Type.Optional(Type.String()),  // Component-aware metadata filtering: 'entityDataTable,kanbanView'
      }),
      response: {
        200: Type.Object({
          data: Type.Array(OfficeSchema),
          fields: Type.Array(Type.String()),
          metadata: Type.Any(),  // EntityMetadata - component-specific field metadata
          datalabels: Type.Array(Type.Any()),  // DatalabelData[] - always an array (empty if no datalabels)
          globalSettings: Type.Any(),  // GlobalSettings - currency, date, timestamp formatting
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number(),
        }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const {
      active_flag, search, office_type, city, province,
      limit = 20, offset: queryOffset, page, view
    } = request.query as any;
    const offset = page ? (page - 1) * limit : (queryOffset !== undefined ? queryOffset : 0);

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // ═══════════════════════════════════════════════════════════════
      // NEW PATTERN: Route builds SQL, gates augment it
      // ═══════════════════════════════════════════════════════════════

      // Build WHERE conditions array
      const conditions: any[] = [];

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
      // Supports: ?office_type=X, ?city=Y, ?province=Z, ?active_flag=true, ?search=keyword, etc.
      // See: apps/api/src/lib/universal-filter-builder.ts
      const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query as any, {
        searchFields: ['name', 'descr', 'code', 'city', 'province', 'address_line1']
      });
      conditions.push(...autoFilters);

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.office o
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      const offices = await db.execute(sql`
        SELECT
          o.id, o.code, o.name, o."descr", o.metadata,
          o.address_line1, o.address_line2, o.city, o.province, o.postal_code, o.country,
          o.phone, o.email, o.office_type, o.capacity_employees, o.square_footage,
          o.from_ts, o.to_ts, o.active_flag, o.created_ts, o.updated_ts, o.version
        FROM app.office o
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY o.name ASC NULLS LAST, o.created_ts DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      // ✨ Generate component-aware metadata using backend-formatter
      // Parse requested components from view parameter (e.g., 'entityDataTable,kanbanView')
      const requestedComponents = view
        ? view.split(',').map((v: string) => v.trim())
        : ['entityDataTable', 'entityFormContainer', 'kanbanView'];

      const response = generateEntityResponse(ENTITY_CODE, offices, {
        components: requestedComponents,
        total, limit, offset
      });

      // ✨ Extract and fetch datalabel definitions (for dl__* fields like dl__office_type)
      if (datalabelKeys.length > 0) {
      }

      return response;
    } catch (error) {
      fastify.log.error({ error, stack: (error as Error).stack }, 'Error fetching offices');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single office location
  fastify.get('/api/v1/office/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      querystring: Type.Object({
        view: Type.Optional(Type.String()),  // Component-aware metadata: 'entityDetailView,entityFormContainer'
      }),
      response: {
        200: OfficeWithMetadataSchema,  // ✅ Fixed: Use metadata-driven schema
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { view } = request.query as any;

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC CHECK
      // Check: Can user VIEW this office?
      // ═══════════════════════════════════════════════════════════════
      const canView = await entityInfra.check_entity_rbac(
        userId,
        ENTITY_CODE,
        id,
        Permission.VIEW
      );

      if (!canView) {
        return reply.status(403).send({ error: 'No permission to view this office' });
      }

      const office = await db.execute(sql`
        SELECT
          id, code, name, "descr", metadata,
          address_line1, address_line2, city, province, postal_code, country,
          phone, email, office_type, capacity_employees, square_footage,
          from_ts, to_ts, active_flag, created_ts, updated_ts, version
        FROM app.office
        WHERE id = ${id}
      `);

      if (office.length === 0) {
        return reply.status(404).send({ error: 'Office not found' });
      }

      // ✨ Generate component-aware metadata using backend-formatter
      // For single entity GET, default to detailView and formContainer
      const requestedComponents = view
        ? view.split(',').map((v: string) => v.trim())
        : ['entityDetailView', 'entityFormContainer'];

      const response = generateEntityResponse(ENTITY_CODE, [office[0]], {
        components: requestedComponents,
        total: 1, limit: 1, offset: 0
      });

      // ✨ Extract and fetch datalabel definitions
      if (datalabelKeys.length > 0) {
      }

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
        canSeeSafetyInfo: true,
      };

      return {
        data: filterUniversalColumns(office[0], userPermissions),
        fields: response.fields,
        metadata: response.metadata,
        datalabels: response.datalabels,
        globalSettings: response.globalSettings
      };
    } catch (error) {
      fastify.log.error('Error fetching office:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get organization dynamic child entity tabs - for tab navigation
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

    // ═══════════════════════════════════════════════════════════════
    // ✅ ENTITY INFRASTRUCTURE SERVICE - RBAC check
    // ═══════════════════════════════════════════════════════════════
    const canView = await entityInfra.check_entity_rbac(userId, ENTITY_CODE, id, Permission.VIEW);
    if (!canView) {
      return reply.status(403).send({ error: 'No permission to view this office' });
    }

    // ═══════════════════════════════════════════════════════════════
    // ✅ ENTITY INFRASTRUCTURE SERVICE - Get child entity metadata
    // Returns child entity types with labels/icons from entity
    // ═══════════════════════════════════════════════════════════════
    const tabs = await entityInfra.get_dynamic_child_entity_tabs(ENTITY_CODE);
    return reply.send({ tabs });
  });

  // Create office location
  fastify.post('/api/v1/office', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateOfficeSchema,
      querystring: Type.Object({
        parent_type: Type.Optional(Type.String()),
        parent_id: Type.Optional(Type.String({ format: 'uuid' }))
      }),
      response: {
        201: OfficeSchema,
        403: Type.Object({ error: Type.String() }),
        400: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    const { parent_type, parent_id } = request.query as any;
    const data = request.body as any;

    try {
      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC CHECK 1
      // Check: Can user CREATE offices?
      // ═══════════════════════════════════════════════════════════════
      const canCreate = await entityInfra.check_entity_rbac(
        userId,
        ENTITY_CODE,
        ALL_ENTITIES_ID,
        Permission.CREATE
      );
      if (!canCreate) {
        return reply.status(403).send({ error: 'No permission to create offices' });
      }

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC CHECK 2
      // Check: If linking to parent, can user EDIT parent?
      // ═══════════════════════════════════════════════════════════════
      if (parent_type && parent_id) {
        const canEditParent = await entityInfra.check_entity_rbac(
          userId,
          parent_type,
          parent_id,
          Permission.EDIT
        );
        if (!canEditParent) {
          return reply.status(403).send({
            error: `No permission to link office to this ${parent_type}`
          });
        }
      }

      // Check for unique office code if provided
      if (data.code) {
        const existingOffice = await db.execute(sql`
          SELECT id FROM app.office WHERE code = ${data.code} AND active_flag = true
        `);
        if (existingOffice.length > 0) {
          return reply.status(400).send({ error: 'Office with this code already exists' });
        }
      }

      // ✅ ROUTE OWNS - INSERT into primary table
      const result = await db.execute(sql`
        INSERT INTO app.office (
          code, name, "descr", metadata,
          address_line1, address_line2, city, province, postal_code, country,
          phone, email, office_type, capacity_employees, square_footage,
          active_flag
        )
        VALUES (
          ${data.code},
          ${data.name},
          ${data.descr || null},
          ${data.metadata ? JSON.stringify(data.metadata) : '{}'}::jsonb,
          ${data.address_line1 || null},
          ${data.address_line2 || null},
          ${data.city || null},
          ${data.province || null},
          ${data.postal_code || null},
          ${data.country || 'Canada'},
          ${data.phone || null},
          ${data.email || null},
          ${data.office_type || null},
          ${data.capacity_employees || null},
          ${data.square_footage || null},
          ${data.active_flag !== false}
        )
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to create office' });
      }

      const newOffice = result[0] as any;
      const officeId = newOffice.id;

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - Register instance in registry
      // ═══════════════════════════════════════════════════════════════
      await entityInfra.set_entity_instance_registry({
        entity_type: ENTITY_CODE,
        entity_id: officeId,
        entity_name: newOffice.name,
        entity_code: newOffice.code
      });

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - Grant ownership to creator
      // ═══════════════════════════════════════════════════════════════
      await entityInfra.set_entity_rbac_owner(userId, ENTITY_CODE, officeId);

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - Link to parent (if provided)
      // ═══════════════════════════════════════════════════════════════
      if (parent_type && parent_id) {
        await entityInfra.set_entity_instance_link({
          parent_entity_type: parent_type,
          parent_entity_id: parent_id,
          child_entity_type: ENTITY_CODE,
          child_entity_id: officeId,
          relationship_type: 'contains'
        });
      }

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
        canSeeSafetyInfo: true,
      };

      return reply.status(201).send(filterUniversalColumns(newOffice, userPermissions));
    } catch (error) {
      (fastify.log as any).error('Error creating organization:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update office location (PATCH)
  fastify.patch('/api/v1/office/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      body: UpdateOfficeSchema,
      response: {
        200: OfficeSchema,
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    // ═══════════════════════════════════════════════════════════════
    // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC CHECK
    // Check: Can user EDIT this office?
    // ═══════════════════════════════════════════════════════════════
    const canEdit = await entityInfra.check_entity_rbac(
      userId,
      ENTITY_CODE,
      id,
      Permission.EDIT
    );
    if (!canEdit) {
      return reply.status(403).send({ error: 'No permission to edit this office' });
    }

    try {
      const existing = await db.execute(sql`
        SELECT id FROM app.office WHERE id = ${id}
      `);

      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Organization not found' });
      }

      const updateFields = [];

      if (data.name !== undefined) updateFields.push(sql`name = ${data.name}`);
      if (data.descr !== undefined) updateFields.push(sql`"descr" = ${data.descr}`);
      if (data.code !== undefined) updateFields.push(sql`code = ${data.code}`);
      if (data.metadata !== undefined) updateFields.push(sql`metadata = ${JSON.stringify(data.metadata)}::jsonb`);
      if (data.address_line1 !== undefined) updateFields.push(sql`address_line1 = ${data.address_line1}`);
      if (data.address_line2 !== undefined) updateFields.push(sql`address_line2 = ${data.address_line2}`);
      if (data.city !== undefined) updateFields.push(sql`city = ${data.city}`);
      if (data.province !== undefined) updateFields.push(sql`province = ${data.province}`);
      if (data.postal_code !== undefined) updateFields.push(sql`postal_code = ${data.postal_code}`);
      if (data.country !== undefined) updateFields.push(sql`country = ${data.country}`);
      if (data.phone !== undefined) updateFields.push(sql`phone = ${data.phone}`);
      if (data.email !== undefined) updateFields.push(sql`email = ${data.email}`);
      if (data.office_type !== undefined) updateFields.push(sql`office_type = ${data.office_type}`);
      if (data.capacity_employees !== undefined) updateFields.push(sql`capacity_employees = ${data.capacity_employees}`);
      if (data.square_footage !== undefined) updateFields.push(sql`square_footage = ${data.square_footage}`);
      if (data.active_flag !== undefined) updateFields.push(sql`active_flag = ${data.active_flag}`);

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated_ts = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.office
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to update office' });
      }

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - Sync registry if name/code changed
      // ═══════════════════════════════════════════════════════════════
      if (data.name !== undefined || data.code !== undefined) {
        await entityInfra.update_entity_instance_registry(ENTITY_CODE, id, {
          entity_name: data.name,
          entity_code: data.code
        });
      }

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
        canSeeSafetyInfo: true,
      };

      return filterUniversalColumns(result[0], userPermissions);
    } catch (error) {
      (fastify.log as any).error('Error updating organization:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Update Office Location (PUT - alias to PATCH for frontend compatibility)
  // ============================================================================

  fastify.put('/api/v1/office/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      body: UpdateOfficeSchema,
      response: {
        200: OfficeSchema,
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    // ═══════════════════════════════════════════════════════════════
    // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC CHECK
    // Check: Can user EDIT this office?
    // ═══════════════════════════════════════════════════════════════
    const canEdit = await entityInfra.check_entity_rbac(
      userId,
      ENTITY_CODE,
      id,
      Permission.EDIT
    );
    if (!canEdit) {
      return reply.status(403).send({ error: 'No permission to edit this office' });
    }

    try {
      const existing = await db.execute(sql`
        SELECT id FROM app.office WHERE id = ${id}
      `);

      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Organization not found' });
      }

      const updateFields = [];

      if (data.name !== undefined) updateFields.push(sql`name = ${data.name}`);
      if (data.descr !== undefined) updateFields.push(sql`"descr" = ${data.descr}`);
      if (data.code !== undefined) updateFields.push(sql`code = ${data.code}`);
      if (data.metadata !== undefined) updateFields.push(sql`metadata = ${JSON.stringify(data.metadata)}::jsonb`);
      if (data.address_line1 !== undefined) updateFields.push(sql`address_line1 = ${data.address_line1}`);
      if (data.address_line2 !== undefined) updateFields.push(sql`address_line2 = ${data.address_line2}`);
      if (data.city !== undefined) updateFields.push(sql`city = ${data.city}`);
      if (data.province !== undefined) updateFields.push(sql`province = ${data.province}`);
      if (data.postal_code !== undefined) updateFields.push(sql`postal_code = ${data.postal_code}`);
      if (data.country !== undefined) updateFields.push(sql`country = ${data.country}`);
      if (data.phone !== undefined) updateFields.push(sql`phone = ${data.phone}`);
      if (data.email !== undefined) updateFields.push(sql`email = ${data.email}`);
      if (data.office_type !== undefined) updateFields.push(sql`office_type = ${data.office_type}`);
      if (data.capacity_employees !== undefined) updateFields.push(sql`capacity_employees = ${data.capacity_employees}`);
      if (data.square_footage !== undefined) updateFields.push(sql`square_footage = ${data.square_footage}`);
      if (data.active_flag !== undefined) updateFields.push(sql`active_flag = ${data.active_flag}`);

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated_ts = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.office
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to update office' });
      }

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - Sync registry if name/code changed
      // ═══════════════════════════════════════════════════════════════
      if (data.name !== undefined || data.code !== undefined) {
        await entityInfra.update_entity_instance_registry(ENTITY_CODE, id, {
          entity_name: data.name,
          entity_code: data.code
        });
      }

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
        canSeeSafetyInfo: true,
      };

      return filterUniversalColumns(result[0], userPermissions);
    } catch (error) {
      (fastify.log as any).error('Error updating organization:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Delete Office (Soft Delete via Factory)
  // ============================================================================
  // Delete office with cascading cleanup (soft delete)
  // Uses universal delete factory pattern - deletes from:
  // 1. app.office (base entity table)
  // 2. app.entity_instance (entity registry)
  // 3. app.entity_instance_link (linkages in both directions)
  createEntityDeleteEndpoint(fastify, ENTITY_CODE);

  // ============================================================================
  // Child Entity Endpoints (Auto-Generated from entity metadata)
  // ============================================================================
  // Creates: GET /api/v1/office/:id/{child} for each child in entity table.child_entity_codes
  // Uses Entity Infrastructure Service for RBAC + entity_instance_link for parent-child filtering
  await createChildEntityEndpointsFromMetadata(fastify, ENTITY_CODE);

  // ========================================
  // CHILD ENTITY CREATION
  // ========================================
  // Child entities (task, artifact, wiki, form) are created using:
  // 1. Universal entity create endpoint: POST /api/v1/:childType
  // 2. Linkage API: POST /api/v1/linkage to link child to parent
  // 3. Navigate to child detail page for editing
  // No special endpoints needed - reuses existing universal APIs
}