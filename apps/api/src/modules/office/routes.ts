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
 * Data Model (app.d_office):
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
import { unified_data_gate, Permission, ALL_ENTITIES_ID } from '../../lib/unified-data-gate.js';
// ✨ Universal auto-filter builder - zero-config query filtering
import { buildAutoFilters } from '../../lib/universal-filter-builder.js';

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
const ENTITY_TYPE = 'office';
const TABLE_ALIAS = 'o';

export async function officeRoutes(fastify: FastifyInstance) {
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
      }),
      response: {
        200: Type.Object({
          data: Type.Array(OfficeSchema),
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
      limit = 20, offset: queryOffset, page
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
      const rbacCondition = await unified_data_gate.rbac_gate.getWhereCondition(
        userId,
        ENTITY_TYPE,
        Permission.VIEW,
        TABLE_ALIAS
      );
      conditions.push(rbacCondition);

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
        FROM app.d_office o
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      const offices = await db.execute(sql`
        SELECT
          o.id, o.code, o.name, o."descr", o.metadata,
          o.address_line1, o.address_line2, o.city, o.province, o.postal_code, o.country,
          o.phone, o.email, o.office_type, o.capacity_employees, o.square_footage,
          o.from_ts, o.to_ts, o.active_flag, o.created_ts, o.updated_ts, o.version
        FROM app.d_office o
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY o.name ASC NULLS LAST, o.created_ts DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return createPaginatedResponse(offices, total, limit, offset);
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
      response: {
        200: OfficeSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // ═══════════════════════════════════════════════════════════════
      // ✅ CENTRALIZED UNIFIED DATA GATE - RBAC gate check
      // Uses: RBAC_GATE only (checkPermission)
      // ═══════════════════════════════════════════════════════════════
      const canView = await unified_data_gate.rbac_gate.checkPermission(
        db,
        userId,
        ENTITY_TYPE,
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
        FROM app.d_office
        WHERE id = ${id}
      `);

      if (office.length === 0) {
        return reply.status(404).send({ error: 'Office not found' });
      }

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
        canSeeSafetyInfo: true,
      };

      return filterUniversalColumns(office[0], userPermissions);
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
      response: {
        200: Type.Object({
          action_entities: Type.Array(Type.Object({
            actionEntity: Type.String(),
            count: Type.Number(),
            label: Type.String(),
            icon: Type.Optional(Type.String())
          })),
          organization_id: Type.String()
        }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async function (request, reply) {
    try {
      const { id: orgId } = request.params as { id: string };
      const userId = request.user?.sub;

      if (!userId) {
        return reply.status(401).send({ error: 'User not authenticated' });
      }

      // Direct RBAC check for org access
      const orgAccess = await db.execute(sql`
        SELECT 1 FROM app.d_entity_rbac rbac
        WHERE rbac.person_entity_name = 'employee' AND rbac.person_entity_id = ${userId}::uuid
          AND rbac.entity_name = 'office'
          AND (rbac.entity_id = ${orgId} OR rbac.entity_id = '11111111-1111-1111-1111-111111111111'::uuid)
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND rbac.permission >= 0
      `);

      if (orgAccess.length === 0) {
        return reply.status(403).send({ error: 'Access denied for this organization' });
      }

      // Check if organization exists
      const org = await db.execute(sql`
        SELECT id FROM app.d_office WHERE id = ${orgId} AND active_flag = true
      `);

      if (org.length === 0) {
        return reply.status(404).send({ error: 'Organization not found' });
      }

      // Get action summaries for this organization
      const actionSummaries = [];

      // Count businesses in this office
      const businessCount = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM app.d_business b
        WHERE b.office_id = ${orgId} AND b.active_flag = true
      `);
      actionSummaries.push({
        actionEntity: 'biz',
        count: Number(businessCount[0]?.count || 0),
        label: 'Businesses',
        icon: 'Building'
      });

      // Count projects in this office
      const projectCount = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM app.d_project p
        WHERE (p.metadata->>'office_id')::uuid = ${orgId}::uuid AND p.active_flag = true
      `);
      actionSummaries.push({
        actionEntity: 'project',
        count: Number(projectCount[0]?.count || 0),
        label: 'Projects',
        icon: 'Briefcase'
      });

      // Count tasks assigned to this office
      const taskCount = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM app.d_task t
        WHERE (t.metadata->>'office_id')::uuid = ${orgId}::uuid AND t.active_flag = true
      `);
      actionSummaries.push({
        actionEntity: 'task',
        count: Number(taskCount[0]?.count || 0),
        label: 'Tasks',
        icon: 'CheckSquare'
      });

      return {
        action_entities: actionSummaries,
        organization_id: orgId
      };
    } catch (error) {
      fastify.log.error('Error fetching organization action summaries:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create office location
  fastify.post('/api/v1/office', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateOfficeSchema,
      response: {
        201: OfficeSchema,
        403: Type.Object({ error: Type.String() }),
        400: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const data = request.body as any;

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    // ═══════════════════════════════════════════════════════════════
    // ✅ CENTRALIZED UNIFIED DATA GATE - RBAC GATE
    // Uses: RBAC_GATE only (checkPermission)
    // Check: Can user CREATE offices?
    // ═══════════════════════════════════════════════════════════════
    const canCreate = await unified_data_gate.rbac_gate.checkPermission(
      db,
      userId,
      ENTITY_TYPE,
      ALL_ENTITIES_ID,
      Permission.CREATE
    );
    if (!canCreate) {
      return reply.status(403).send({ error: 'No permission to create offices' });
    }

    try {
      // Check for unique office code if provided
      if (data.code) {
        const existingOffice = await db.execute(sql`
          SELECT id FROM app.d_office WHERE code = ${data.code} AND active_flag = true
        `);
        if (existingOffice.length > 0) {
          return reply.status(400).send({ error: 'Office with this code already exists' });
        }
      }

      const result = await db.execute(sql`
        INSERT INTO app.d_office (
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

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
        canSeeSafetyInfo: true,
      };

      return reply.status(201).send(filterUniversalColumns(result[0], userPermissions));
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
    // ✅ CENTRALIZED UNIFIED DATA GATE - RBAC GATE
    // Uses: RBAC_GATE only (checkPermission)
    // Check: Can user EDIT this office?
    // ═══════════════════════════════════════════════════════════════
    const canEdit = await unified_data_gate.rbac_gate.checkPermission(
      db,
      userId,
      ENTITY_TYPE,
      id,
      Permission.EDIT
    );
    if (!canEdit) {
      return reply.status(403).send({ error: 'No permission to edit this office' });
    }

    try {
      const existing = await db.execute(sql`
        SELECT id FROM app.d_office WHERE id = ${id}
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
        UPDATE app.d_office
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to update office' });
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
    // ✅ CENTRALIZED UNIFIED DATA GATE - RBAC GATE
    // Uses: RBAC_GATE only (checkPermission)
    // Check: Can user EDIT this office?
    // ═══════════════════════════════════════════════════════════════
    const canEdit = await unified_data_gate.rbac_gate.checkPermission(
      db,
      userId,
      ENTITY_TYPE,
      id,
      Permission.EDIT
    );
    if (!canEdit) {
      return reply.status(403).send({ error: 'No permission to edit this office' });
    }

    try {
      const existing = await db.execute(sql`
        SELECT id FROM app.d_office WHERE id = ${id}
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
        UPDATE app.d_office
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to update office' });
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
  // 1. app.d_office (base entity table)
  // 2. app.d_entity_instance_registry (entity registry)
  // 3. app.d_entity_instance_link (linkages in both directions)
  createEntityDeleteEndpoint(fastify, ENTITY_TYPE);

  // ============================================================================
  // Child Entity Endpoints (Auto-Generated from d_entity metadata)
  // ============================================================================
  // Creates: GET /api/v1/office/:id/{child} for each child in d_entity.child_entities
  // Uses unified_data_gate for RBAC + parent_child_filtering_gate for context
  await createChildEntityEndpointsFromMetadata(fastify, ENTITY_TYPE);

  // ========================================
  // CHILD ENTITY CREATION
  // ========================================
  // Child entities (task, artifact, wiki, form) are created using:
  // 1. Universal entity create endpoint: POST /api/v1/:childType
  // 2. Linkage API: POST /api/v1/linkage to link child to parent
  // 3. Navigate to child detail page for editing
  // No special endpoints needed - reuses existing universal APIs
}