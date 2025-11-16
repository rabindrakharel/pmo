/**
 * ============================================================================
 * REVENUE ROUTES MODULE - Universal Entity Pattern with Unified Data Gate
 * ============================================================================
 *
 * SEMANTICS & PURPOSE:
 * Revenue tracking and financial management following the PMO platform's
 * Universal Entity System architecture.
 *
 * ============================================================================
 * DESIGN PATTERNS & ARCHITECTURE
 * ============================================================================
 *
 * 1. UNIFIED DATA GATE PATTERN (Security & Filtering) ✅
 * ───────────────────────────────────────────────────────
 * All endpoints use centralized permission checking via unified-data-gate.ts
 *
 * 2. AUTO-FILTER SYSTEM (Zero-Config Query Filtering) ✅
 * ─────────────────────────────────────────────────────────
 * Uses buildAutoFilters() for automatic query parameter detection and filtering
 *
 * 3. MODULE-LEVEL CONSTANTS (DRY Principle) ✅
 * ──────────────────────────────────────────
 * Single source of truth for entity type and table alias
 *
 * ============================================================================
 */

import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql, SQL } from 'drizzle-orm';
// ✅ Centralized unified data gate - loosely coupled API
import { unified_data_gate, Permission, ALL_ENTITIES_ID } from '../../lib/unified-data-gate.js';
import { grantPermission } from '../../services/rbac-grant.service.js';
// ✨ Universal auto-filter builder - zero-config query filtering
import { buildAutoFilters } from '../../lib/universal-filter-builder.js';
// ✅ Delete factory for cascading soft deletes
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';

// Schema based on f_revenue table structure from db/LII_f_revenue.ddl
const RevenueSchema = Type.Object({
  id: Type.String(),
  revenue_number: Type.String(),
  revenue_type: Type.Optional(Type.String()),
  revenue_date: Type.String(),
  revenue_datetime: Type.Optional(Type.String()),
  recognition_date: Type.Optional(Type.String()),
  fiscal_year: Type.Optional(Type.Number()),
  accounting_period: Type.Optional(Type.String()),
  dl__revenue_category: Type.Optional(Type.String()),
  dl__revenue_subcategory: Type.Optional(Type.String()),
  dl__revenue_code: Type.Optional(Type.String()),
  cra_line: Type.Optional(Type.String()),
  invoice_id: Type.Optional(Type.String()),
  invoice_number: Type.Optional(Type.String()),
  client_id: Type.Optional(Type.String()),
  client_name: Type.Optional(Type.String()),
  client_type: Type.Optional(Type.String()),
  project_id: Type.Optional(Type.String()),
  project_name: Type.Optional(Type.String()),
  employee_id: Type.Optional(Type.String()),
  employee_name: Type.Optional(Type.String()),
  business_id: Type.Optional(Type.String()),
  business_name: Type.Optional(Type.String()),
  office_id: Type.Optional(Type.String()),
  office_name: Type.Optional(Type.String()),
  revenue_amount_cad: Type.Number(),
  cost_amount_cad: Type.Optional(Type.Number()),
  margin_amount_cad: Type.Optional(Type.Number()),
  margin_percent: Type.Optional(Type.Number()),
  tax_amount_cad: Type.Optional(Type.Number()),
  gst_amount_cad: Type.Optional(Type.Number()),
  pst_amount_cad: Type.Optional(Type.Number()),
  hst_amount_cad: Type.Optional(Type.Number()),
  tax_rate: Type.Optional(Type.Number()),
  tax_exempt_flag: Type.Optional(Type.Boolean()),
  revenue_status: Type.Optional(Type.String()),
  payment_status: Type.Optional(Type.String()),
  notes: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Array(Type.String())),
  created_ts: Type.Optional(Type.String()),
  updated_ts: Type.Optional(Type.String()),
  created_by: Type.Optional(Type.String()),
  last_modified_by: Type.Optional(Type.String())
});

const CreateRevenueSchema = Type.Object({
  revenue_number: Type.String({ minLength: 1 }),
  revenue_type: Type.Optional(Type.String()),
  revenue_date: Type.String(),
  dl__revenue_category: Type.Optional(Type.String()),
  dl__revenue_subcategory: Type.Optional(Type.String()),
  dl__revenue_code: Type.Optional(Type.String()),
  cra_line: Type.Optional(Type.String()),
  invoice_id: Type.Optional(Type.String()),
  invoice_number: Type.Optional(Type.String()),
  client_id: Type.Optional(Type.String()),
  client_name: Type.Optional(Type.String()),
  client_type: Type.Optional(Type.String()),
  project_id: Type.Optional(Type.String()),
  project_name: Type.Optional(Type.String()),
  employee_id: Type.Optional(Type.String()),
  employee_name: Type.Optional(Type.String()),
  business_id: Type.Optional(Type.String()),
  business_name: Type.Optional(Type.String()),
  office_id: Type.Optional(Type.String()),
  office_name: Type.Optional(Type.String()),
  revenue_amount_cad: Type.Number(),
  cost_amount_cad: Type.Optional(Type.Number()),
  tax_rate: Type.Optional(Type.Number()),
  tax_exempt_flag: Type.Optional(Type.Boolean()),
  revenue_status: Type.Optional(Type.String()),
  payment_status: Type.Optional(Type.String()),
  notes: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Array(Type.String()))
});

const UpdateRevenueSchema = Type.Partial(CreateRevenueSchema);

// ============================================================================
// Module-level constants (DRY - used across all endpoints)
// ============================================================================
const ENTITY_TYPE = 'revenue';
const TABLE_ALIAS = 'r';

export async function revenueRoutes(fastify: FastifyInstance) {
  // ============================================================================
  // List Revenue (Main Page)
  // ============================================================================
  // URL: GET /api/v1/revenue
  // ============================================================================

  fastify.get('/api/v1/revenue', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        // Standard filters (auto-detected by buildAutoFilters)
        search: Type.Optional(Type.String()),
        category: Type.Optional(Type.String()),
        subcategory: Type.Optional(Type.String()),
        client_id: Type.Optional(Type.String()),
        project_id: Type.Optional(Type.String()),
        employee_id: Type.Optional(Type.String()),
        fiscal_year: Type.Optional(Type.Number()),
        accounting_period: Type.Optional(Type.String()),
        revenue_status: Type.Optional(Type.String()),
        payment_status: Type.Optional(Type.String()),

        // Pagination
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
        page: Type.Optional(Type.Number({ minimum: 1 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(RevenueSchema),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number()
        }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    const {
      limit: queryLimit,
      offset: queryOffset,
      page
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
      // Supports: ?search=X, ?category=Y, ?client_id=Z, ?fiscal_year=N, etc.
      const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query as any, {
        searchFields: ['revenue_number', 'description', 'client_name']
      });
      conditions.push(...autoFilters);

      // Build WHERE clause
      const whereClause = conditions.length > 0
        ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
        : sql``;

      // Count query
      const countQuery = sql`
        SELECT COUNT(*) as total
        FROM app.f_revenue ${sql.raw(TABLE_ALIAS)}
        ${whereClause}
      `;

      // Data query
      const dataQuery = sql`
        SELECT ${sql.raw(TABLE_ALIAS)}.*
        FROM app.f_revenue ${sql.raw(TABLE_ALIAS)}
        ${whereClause}
        ORDER BY ${sql.raw(TABLE_ALIAS)}.revenue_date DESC, ${sql.raw(TABLE_ALIAS)}.created_ts DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      // Execute queries in parallel
      const [countResult, dataResult] = await Promise.all([
        db.execute(countQuery),
        db.execute(dataQuery)
      ]);

      const total = Number(countResult[0]?.total || 0);

      return reply.send({
        data: dataResult,
        total,
        limit,
        offset
      });
    } catch (error) {
      fastify.log.error('Error fetching revenue:', error as any);
      console.error('Full error details:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Get Single Revenue
  // ============================================================================

  fastify.get('/api/v1/revenue/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String()
      }),
      response: {
        200: RevenueSchema,
        404: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // ═══════════════════════════════════════════════════════════════
      // NEW PATTERN: RBAC gate check, then simple SELECT
      // ═══════════════════════════════════════════════════════════════

      // GATE: RBAC - Check permission
      const canView = await unified_data_gate.rbac_gate.check_entity_rbac(
        db,
        userId,
        ENTITY_TYPE,
        id,
        Permission.VIEW
      );

      if (!canView) {
        return reply.status(403).send({ error: 'No permission to view this revenue' });
      }

      // Route owns the query
      const result = await db.execute(sql`
        SELECT *
        FROM app.f_revenue
        WHERE id = ${id}::uuid
      `);

      if (result.length === 0) {
        return reply.status(404).send({ error: 'Revenue not found' });
      }

      return reply.send(result[0]);
    } catch (error) {
      fastify.log.error('Error fetching revenue:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Create Revenue
  // ============================================================================

  fastify.post('/api/v1/revenue', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateRevenueSchema,
      response: {
        201: RevenueSchema,
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    const body = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // ═══════════════════════════════════════════════════════════════
      // ✅ CENTRALIZED UNIFIED DATA GATE - RBAC CHECK
      // Check: Can user CREATE revenue?
      // ═══════════════════════════════════════════════════════════════
      const canCreate = await unified_data_gate.rbac_gate.check_entity_rbac(
        db,
        userId,
        ENTITY_TYPE,
        ALL_ENTITIES_ID,
        Permission.CREATE
      );

      if (!canCreate) {
        return reply.status(403).send({ error: 'No permission to create revenue' });
      }

      // Insert revenue
      const insertQuery = sql`
        INSERT INTO app.f_revenue (
          revenue_number, revenue_type, revenue_date,
          dl__revenue_category, dl__revenue_subcategory, dl__revenue_code, cra_line,
          invoice_id, invoice_number,
          client_id, client_name, client_type,
          project_id, project_name,
          employee_id, employee_name,
          business_id, business_name,
          office_id, office_name,
          revenue_amount_cad, cost_amount_cad,
          tax_rate, tax_exempt_flag,
          revenue_status, payment_status,
          notes, description, tags,
          created_by
        ) VALUES (
          ${body.revenue_number}, ${body.revenue_type || 'standard'}, ${body.revenue_date},
          ${body.dl__revenue_category}, ${body.dl__revenue_subcategory}, ${body.dl__revenue_code}, ${body.cra_line},
          ${body.invoice_id ? sql`${body.invoice_id}::uuid` : null}, ${body.invoice_number},
          ${body.client_id ? sql`${body.client_id}::uuid` : null}, ${body.client_name}, ${body.client_type},
          ${body.project_id ? sql`${body.project_id}::uuid` : null}, ${body.project_name},
          ${body.employee_id ? sql`${body.employee_id}::uuid` : null}, ${body.employee_name},
          ${body.business_id ? sql`${body.business_id}::uuid` : null}, ${body.business_name},
          ${body.office_id ? sql`${body.office_id}::uuid` : null}, ${body.office_name},
          ${body.revenue_amount_cad}, ${body.cost_amount_cad || 0},
          ${body.tax_rate || 0}, ${body.tax_exempt_flag || false},
          ${body.revenue_status || 'recognized'}, ${body.payment_status},
          ${body.notes}, ${body.description}, ${body.tags ? sql`ARRAY[${sql.join(body.tags.map((t: string) => sql`${t}`), sql`, `)}]::text[]` : null},
          ${userId}::uuid
        )
        RETURNING *
      `;

      const insertResult = await db.execute(insertQuery);
      const newRevenue = insertResult[0];

      // ═══════════════════════════════════════════════════════════════
      // AUTO-GRANT: Creator gets full permissions (OWNER)
      // ═══════════════════════════════════════════════════════════════
      await grantPermission(db, {
        personEntityName: 'employee',
        personEntityId: userId,
        entityName: ENTITY_TYPE,
        entityId: newRevenue.id,
        permission: Permission.OWNER
      });

      return reply.status(201).send(newRevenue);
    } catch (error) {
      fastify.log.error('Error creating revenue:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Update Revenue (PATCH)
  // ============================================================================

  fastify.patch('/api/v1/revenue/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String()
      }),
      body: UpdateRevenueSchema,
      response: {
        200: RevenueSchema,
        404: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as any;
    const body = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // ═══════════════════════════════════════════════════════════════
      // ✅ CENTRALIZED UNIFIED DATA GATE - RBAC CHECK
      // Check: Can user EDIT this revenue?
      // ═══════════════════════════════════════════════════════════════
      const canEdit = await unified_data_gate.rbac_gate.check_entity_rbac(
        db,
        userId,
        ENTITY_TYPE,
        id,
        Permission.EDIT
      );

      if (!canEdit) {
        return reply.status(403).send({ error: 'No permission to edit revenue' });
      }

      const updateFields: any[] = [];

      Object.keys(body).forEach((key) => {
        if (body[key] !== undefined) {
          if (key.endsWith('_id') && body[key]) {
            updateFields.push(sql`${sql.identifier([key])} = ${body[key]}::uuid`);
          } else if (key === 'tags' && Array.isArray(body[key])) {
            updateFields.push(sql`tags = ARRAY[${sql.join(body[key].map((t: string) => sql`${t}`), sql`, `)}]::text[]`);
          } else {
            updateFields.push(sql`${sql.identifier([key])} = ${body[key]}`);
          }
        }
      });

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`last_modified_by = ${userId}::uuid`);
      updateFields.push(sql`updated_ts = NOW()`);

      const updateQuery = sql`
        UPDATE app.f_revenue
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}::uuid
        RETURNING *
      `;

      const updateResult = await db.execute(updateQuery);

      if (updateResult.length === 0) {
        return reply.status(404).send({ error: 'Revenue not found' });
      }

      return reply.send(updateResult[0]);
    } catch (error) {
      fastify.log.error('Error updating revenue:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Update Revenue (PUT - alias to PATCH for frontend compatibility)
  // ============================================================================

  fastify.put('/api/v1/revenue/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String()
      }),
      body: UpdateRevenueSchema,
      response: {
        200: RevenueSchema,
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as any;
    const body = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // ═══════════════════════════════════════════════════════════════
      // ✅ CENTRALIZED UNIFIED DATA GATE - RBAC CHECK
      // Check: Can user EDIT this revenue?
      // ═══════════════════════════════════════════════════════════════
      const canEdit = await unified_data_gate.rbac_gate.check_entity_rbac(
        db,
        userId,
        ENTITY_TYPE,
        id,
        Permission.EDIT
      );

      if (!canEdit) {
        return reply.status(403).send({ error: 'No permission to edit revenue' });
      }

      const updateFields: any[] = [];

      Object.keys(body).forEach((key) => {
        if (body[key] !== undefined) {
          if (key.endsWith('_id') && body[key]) {
            updateFields.push(sql`${sql.identifier([key])} = ${body[key]}::uuid`);
          } else if (key === 'tags' && Array.isArray(body[key])) {
            updateFields.push(sql`tags = ARRAY[${sql.join(body[key].map((t: string) => sql`${t}`), sql`, `)}]::text[]`);
          } else {
            updateFields.push(sql`${sql.identifier([key])} = ${body[key]}`);
          }
        }
      });

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`last_modified_by = ${userId}::uuid`);
      updateFields.push(sql`updated_ts = NOW()`);

      const updateQuery = sql`
        UPDATE app.f_revenue
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}::uuid
        RETURNING *
      `;

      const updateResult = await db.execute(updateQuery);

      if (updateResult.length === 0) {
        return reply.status(404).send({ error: 'Revenue not found' });
      }

      return reply.send(updateResult[0]);
    } catch (error) {
      fastify.log.error('Error updating revenue:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Delete Revenue (Soft Delete via Factory)
  // ============================================================================
  createEntityDeleteEndpoint(fastify, ENTITY_TYPE);
}
