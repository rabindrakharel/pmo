/**
 * ============================================================================
 * EXPENSE ROUTES MODULE - Universal Entity Pattern with Unified Data Gate
 * ============================================================================
 *
 * SEMANTICS & PURPOSE:
 * Expense tracking and financial management following the PMO platform's
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
// ✨ Universal auto-filter builder - zero-config query filtering
import { buildAutoFilters } from '../../lib/universal-filter-builder.js';
// ✅ Delete factory for cascading soft deletes
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';

// Schema based on f_expense table structure from db/LIII_f_expense.ddl
const ExpenseSchema = Type.Object({
  id: Type.String(),
  expense_number: Type.String(),
  expense_type: Type.Optional(Type.String()),
  expense_date: Type.String(),
  expense_datetime: Type.Optional(Type.String()),
  recognition_date: Type.Optional(Type.String()),
  fiscal_year: Type.Optional(Type.Number()),
  accounting_period: Type.Optional(Type.String()),
  dl__expense_category: Type.Optional(Type.String()),
  dl__expense_subcategory: Type.Optional(Type.String()),
  dl__expense_code: Type.Optional(Type.String()),
  cra_line: Type.Optional(Type.String()),
  deductibility_percent: Type.Optional(Type.Number()),
  invoice_id: Type.Optional(Type.String()),
  invoice_number: Type.Optional(Type.String()),
  project_id: Type.Optional(Type.String()),
  project_name: Type.Optional(Type.String()),
  employee_id: Type.Optional(Type.String()),
  employee_name: Type.Optional(Type.String()),
  client_id: Type.Optional(Type.String()),
  client_name: Type.Optional(Type.String()),
  business_id: Type.Optional(Type.String()),
  business_name: Type.Optional(Type.String()),
  office_id: Type.Optional(Type.String()),
  office_name: Type.Optional(Type.String()),
  expense_amount_cad: Type.Number(),
  deductible_amount_cad: Type.Optional(Type.Number()),
  reimbursable_flag: Type.Optional(Type.Boolean()),
  reimbursed_flag: Type.Optional(Type.Boolean()),
  reimbursed_date: Type.Optional(Type.String()),
  tax_amount_cad: Type.Optional(Type.Number()),
  gst_amount_cad: Type.Optional(Type.Number()),
  pst_amount_cad: Type.Optional(Type.Number()),
  hst_amount_cad: Type.Optional(Type.Number()),
  tax_rate: Type.Optional(Type.Number()),
  tax_recoverable_flag: Type.Optional(Type.Boolean()),
  expense_status: Type.Optional(Type.String()),
  payment_status: Type.Optional(Type.String()),
  payment_method: Type.Optional(Type.String()),
  payment_reference: Type.Optional(Type.String()),
  paid_date: Type.Optional(Type.String()),
  attachment: Type.Optional(Type.String()),
  attachment_format: Type.Optional(Type.String()),
  attachment_size_bytes: Type.Optional(Type.Number()),
  attachment_object_bucket: Type.Optional(Type.String()),
  attachment_object_key: Type.Optional(Type.String()),
  notes: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Array(Type.String())),
  vendor_name: Type.Optional(Type.String()),
  created_ts: Type.Optional(Type.String()),
  updated_ts: Type.Optional(Type.String()),
  created_by: Type.Optional(Type.String()),
  last_modified_by: Type.Optional(Type.String()),
  approved_by: Type.Optional(Type.String()),
  approved_date: Type.Optional(Type.String())
});

const CreateExpenseSchema = Type.Object({
  expense_number: Type.String({ minLength: 1 }),
  expense_type: Type.Optional(Type.String()),
  expense_date: Type.String(),
  dl__expense_category: Type.Optional(Type.String()),
  dl__expense_subcategory: Type.Optional(Type.String()),
  dl__expense_code: Type.Optional(Type.String()),
  cra_line: Type.Optional(Type.String()),
  deductibility_percent: Type.Optional(Type.Number()),
  invoice_id: Type.Optional(Type.String()),
  invoice_number: Type.Optional(Type.String()),
  project_id: Type.Optional(Type.String()),
  project_name: Type.Optional(Type.String()),
  employee_id: Type.Optional(Type.String()),
  employee_name: Type.Optional(Type.String()),
  client_id: Type.Optional(Type.String()),
  client_name: Type.Optional(Type.String()),
  business_id: Type.Optional(Type.String()),
  business_name: Type.Optional(Type.String()),
  office_id: Type.Optional(Type.String()),
  office_name: Type.Optional(Type.String()),
  expense_amount_cad: Type.Number(),
  reimbursable_flag: Type.Optional(Type.Boolean()),
  tax_rate: Type.Optional(Type.Number()),
  tax_recoverable_flag: Type.Optional(Type.Boolean()),
  expense_status: Type.Optional(Type.String()),
  payment_status: Type.Optional(Type.String()),
  payment_method: Type.Optional(Type.String()),
  notes: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Array(Type.String())),
  vendor_name: Type.Optional(Type.String())
});

const UpdateExpenseSchema = Type.Partial(CreateExpenseSchema);

// ============================================================================
// Module-level constants (DRY - used across all endpoints)
// ============================================================================
const ENTITY_TYPE = 'expense';
const TABLE_ALIAS = 'e';

export async function expenseRoutes(fastify: FastifyInstance) {
  // ============================================================================
  // List Expenses (Main Page)
  // ============================================================================
  // URL: GET /api/v1/expense
  // ============================================================================

  fastify.get('/api/v1/expense', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        // Standard filters (auto-detected by buildAutoFilters)
        search: Type.Optional(Type.String()),
        category: Type.Optional(Type.String()),
        subcategory: Type.Optional(Type.String()),
        project_id: Type.Optional(Type.String()),
        employee_id: Type.Optional(Type.String()),
        client_id: Type.Optional(Type.String()),
        fiscal_year: Type.Optional(Type.Number()),
        accounting_period: Type.Optional(Type.String()),
        expense_status: Type.Optional(Type.String()),
        payment_status: Type.Optional(Type.String()),

        // Pagination
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
        page: Type.Optional(Type.Number({ minimum: 1 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(ExpenseSchema),
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

      // ✨ UNIVERSAL AUTO-FILTER SYSTEM
      // Automatically builds filters from ANY query parameter based on field naming conventions
      // Supports: ?search=X, ?category=Y, ?project_id=Z, ?fiscal_year=N, etc.
      const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query as any, {
        searchFields: ['expense_number', 'description', 'vendor_name', 'employee_name']
      });
      conditions.push(...autoFilters);

      // Build WHERE clause
      const whereClause = conditions.length > 0
        ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
        : sql``;

      // Count query
      const countQuery = sql`
        SELECT COUNT(*) as total
        FROM app.f_expense ${sql.raw(TABLE_ALIAS)}
        ${whereClause}
      `;

      // Data query
      const dataQuery = sql`
        SELECT ${sql.raw(TABLE_ALIAS)}.*
        FROM app.f_expense ${sql.raw(TABLE_ALIAS)}
        ${whereClause}
        ORDER BY ${sql.raw(TABLE_ALIAS)}.expense_date DESC, ${sql.raw(TABLE_ALIAS)}.created_ts DESC
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
      fastify.log.error('Error fetching expenses:', error as any);
      console.error('Full error details:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Get Single Expense
  // ============================================================================

  fastify.get('/api/v1/expense/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String()
      }),
      response: {
        200: ExpenseSchema,
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
      const canView = await unified_data_gate.rbac_gate.checkPermission(
        db,
        userId,
        ENTITY_TYPE,
        id,
        Permission.VIEW
      );

      if (!canView) {
        return reply.status(403).send({ error: 'No permission to view this expense' });
      }

      // Route owns the query
      const result = await db.execute(sql`
        SELECT *
        FROM app.f_expense
        WHERE id = ${id}::uuid
      `);

      if (result.length === 0) {
        return reply.status(404).send({ error: 'Expense not found' });
      }

      return reply.send(result[0]);
    } catch (error) {
      fastify.log.error('Error fetching expense:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Create Expense
  // ============================================================================

  fastify.post('/api/v1/expense', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateExpenseSchema,
      response: {
        201: ExpenseSchema,
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
      // Check: Can user CREATE expenses?
      // ═══════════════════════════════════════════════════════════════
      const canCreate = await unified_data_gate.rbac_gate.checkPermission(
        db,
        userId,
        ENTITY_TYPE,
        ALL_ENTITIES_ID,
        Permission.CREATE
      );

      if (!canCreate) {
        return reply.status(403).send({ error: 'No permission to create expense' });
      }

      // Insert expense
      const insertQuery = sql`
        INSERT INTO app.f_expense (
          expense_number, expense_type, expense_date,
          dl__expense_category, dl__expense_subcategory, dl__expense_code, cra_line, deductibility_percent,
          invoice_id, invoice_number,
          project_id, project_name,
          employee_id, employee_name,
          client_id, client_name,
          business_id, business_name,
          office_id, office_name,
          expense_amount_cad, reimbursable_flag,
          tax_rate, tax_recoverable_flag,
          expense_status, payment_status, payment_method,
          notes, description, tags, vendor_name,
          created_by
        ) VALUES (
          ${body.expense_number}, ${body.expense_type || 'standard'}, ${body.expense_date},
          ${body.dl__expense_category}, ${body.dl__expense_subcategory}, ${body.dl__expense_code}, ${body.cra_line}, ${body.deductibility_percent || 100},
          ${body.invoice_id ? sql`${body.invoice_id}::uuid` : null}, ${body.invoice_number},
          ${body.project_id ? sql`${body.project_id}::uuid` : null}, ${body.project_name},
          ${body.employee_id ? sql`${body.employee_id}::uuid` : null}, ${body.employee_name},
          ${body.client_id ? sql`${body.client_id}::uuid` : null}, ${body.client_name},
          ${body.business_id ? sql`${body.business_id}::uuid` : null}, ${body.business_name},
          ${body.office_id ? sql`${body.office_id}::uuid` : null}, ${body.office_name},
          ${body.expense_amount_cad}, ${body.reimbursable_flag || false},
          ${body.tax_rate || 0}, ${body.tax_recoverable_flag !== false},
          ${body.expense_status || 'submitted'}, ${body.payment_status || 'unpaid'}, ${body.payment_method},
          ${body.notes}, ${body.description}, ${body.tags ? sql`ARRAY[${sql.join(body.tags.map((t: string) => sql`${t}`), sql`, `)}]::text[]` : null}, ${body.vendor_name},
          ${userId}::uuid
        )
        RETURNING *
      `;

      const insertResult = await db.execute(insertQuery);
      const newExpense = insertResult[0];

      // ═══════════════════════════════════════════════════════════════
      // AUTO-GRANT: Creator gets DELETE permission (implies all lower)
      // ═══════════════════════════════════════════════════════════════
      await db.execute(sql`
        INSERT INTO app.entity_id_rbac_map (
          person_entity_id,
          entity_name,
          entity_id,
          permission,
          active_flag
        ) VALUES (
          ${userId},
          ${ENTITY_TYPE},
          ${newExpense.id}::text,
          ${Permission.DELETE},
          true
        )
      `);

      return reply.status(201).send(newExpense);
    } catch (error) {
      fastify.log.error('Error creating expense:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Update Expense (PATCH)
  // ============================================================================

  fastify.patch('/api/v1/expense/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String()
      }),
      body: UpdateExpenseSchema,
      response: {
        200: ExpenseSchema,
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
      // Check: Can user EDIT this expense?
      // ═══════════════════════════════════════════════════════════════
      const canEdit = await unified_data_gate.rbac_gate.checkPermission(
        db,
        userId,
        ENTITY_TYPE,
        id,
        Permission.EDIT
      );

      if (!canEdit) {
        return reply.status(403).send({ error: 'No permission to edit expense' });
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
        UPDATE app.f_expense
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}::uuid
        RETURNING *
      `;

      const updateResult = await db.execute(updateQuery);

      if (updateResult.length === 0) {
        return reply.status(404).send({ error: 'Expense not found' });
      }

      return reply.send(updateResult[0]);
    } catch (error) {
      fastify.log.error('Error updating expense:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Update Expense (PUT - alias to PATCH for frontend compatibility)
  // ============================================================================

  fastify.put('/api/v1/expense/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String()
      }),
      body: UpdateExpenseSchema,
      response: {
        200: ExpenseSchema,
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
      // Check: Can user EDIT this expense?
      // ═══════════════════════════════════════════════════════════════
      const canEdit = await unified_data_gate.rbac_gate.checkPermission(
        db,
        userId,
        ENTITY_TYPE,
        id,
        Permission.EDIT
      );

      if (!canEdit) {
        return reply.status(403).send({ error: 'No permission to edit expense' });
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
        UPDATE app.f_expense
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}::uuid
        RETURNING *
      `;

      const updateResult = await db.execute(updateQuery);

      if (updateResult.length === 0) {
        return reply.status(404).send({ error: 'Expense not found' });
      }

      return reply.send(updateResult[0]);
    } catch (error) {
      fastify.log.error('Error updating expense:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Delete Expense (Soft Delete via Factory)
  // ============================================================================
  createEntityDeleteEndpoint(fastify, ENTITY_TYPE);
}
