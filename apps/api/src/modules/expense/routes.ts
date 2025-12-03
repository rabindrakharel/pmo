/**
 * ============================================================================
 * EXPENSE ROUTES MODULE - Universal CRUD Factory Pattern
 * ============================================================================
 *
 * ENDPOINTS (via Universal CRUD Factory):
 * - GET    /api/v1/expense           - List with pagination, RBAC, auto-filters
 * - GET    /api/v1/expense/:id       - Get single with RBAC, metadata
 * - PATCH  /api/v1/expense/:id       - Update with RBAC, registry sync
 * - PUT    /api/v1/expense/:id       - Update (alias for PATCH)
 *
 * CUSTOM ENDPOINTS:
 * - POST   /api/v1/expense           - Create with custom validation
 * - DELETE /api/v1/expense/:id       - Soft delete via factory
 *
 * ============================================================================
 */

import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { createUniversalEntityRoutes } from '../../lib/universal-entity-crud-factory.js';
import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID } from '../../services/entity-infrastructure.service.js';

// ============================================================================
// Module-level constants (DRY - used across all endpoints)
// ============================================================================
const ENTITY_CODE = 'expense';

export async function expenseRoutes(fastify: FastifyInstance) {
  // ═══════════════════════════════════════════════════════════════
  // ✨ UNIVERSAL CRUD FACTORY - Generates LIST, GET, PATCH, PUT endpoints
  // ═══════════════════════════════════════════════════════════════
  createUniversalEntityRoutes(fastify, {
    entityCode: ENTITY_CODE,
    tableName: 'f_expense',
    tableAlias: 'e',
    searchFields: ['expense_number', 'description', 'vendor_name', 'employee_name'],
    defaultOrderBy: 'expense_date DESC, created_ts DESC'
  });

  // ═══════════════════════════════════════════════════════════════
  // ✅ ENTITY INFRASTRUCTURE SERVICE - Initialize service instance
  // ═══════════════════════════════════════════════════════════════
  const entityInfra = getEntityInfrastructure(db);

  // ============================================================================
  // Create Expense (Custom - entity-specific validation)
  // ============================================================================
  fastify.post('/api/v1/expense', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['expense'],
      summary: 'Create expense'
    }
  }, async (request, reply) => {
    const body = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // ═══════════════════════════════════════════════════════════════
      // ✅ RBAC CHECK - Can user CREATE expenses?
      // ═══════════════════════════════════════════════════════════════
      const canCreate = await entityInfra.check_entity_rbac(
        userId,
        ENTITY_CODE,
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
      // ✅ Grant OWNER permission to creator
      // ═══════════════════════════════════════════════════════════════
      await entityInfra.set_entity_rbac_owner(userId, ENTITY_CODE, newExpense.id);

      return reply.status(201).send(newExpense);
    } catch (error) {
      fastify.log.error('Error creating expense:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // DELETE endpoint is automatically created by createUniversalEntityRoutes above
}
