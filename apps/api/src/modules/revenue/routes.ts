/**
 * ============================================================================
 * REVENUE ROUTES MODULE - Universal CRUD Factory Pattern
 * ============================================================================
 *
 * ENDPOINTS (via Universal CRUD Factory):
 * - GET    /api/v1/revenue           - List with pagination, RBAC, auto-filters
 * - GET    /api/v1/revenue/:id       - Get single with RBAC, metadata
 * - PATCH  /api/v1/revenue/:id       - Update with RBAC, registry sync
 * - PUT    /api/v1/revenue/:id       - Update (alias for PATCH)
 *
 * CUSTOM ENDPOINTS:
 * - POST   /api/v1/revenue           - Create with custom validation
 * - DELETE /api/v1/revenue/:id       - Soft delete via factory
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
const ENTITY_CODE = 'revenue';

export async function revenueRoutes(fastify: FastifyInstance) {
  // ═══════════════════════════════════════════════════════════════
  // ✨ UNIVERSAL CRUD FACTORY - Generates LIST, GET, PATCH, PUT endpoints
  // ═══════════════════════════════════════════════════════════════
  createUniversalEntityRoutes(fastify, {
    entityCode: ENTITY_CODE,
    tableName: 'f_revenue',
    tableAlias: 'r',
    searchFields: ['revenue_number', 'description', 'client_name'],
    defaultOrderBy: 'revenue_date DESC, created_ts DESC'
  });

  // ═══════════════════════════════════════════════════════════════
  // ✅ ENTITY INFRASTRUCTURE SERVICE - Initialize service instance
  // ═══════════════════════════════════════════════════════════════
  const entityInfra = getEntityInfrastructure(db);

  // ============================================================================
  // Create Revenue (Custom - entity-specific validation)
  // ============================================================================
  fastify.post('/api/v1/revenue', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['revenue'],
      summary: 'Create revenue'
    }
  }, async (request, reply) => {
    const body = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // ═══════════════════════════════════════════════════════════════
      // ✅ RBAC CHECK - Can user CREATE revenue?
      // ═══════════════════════════════════════════════════════════════
      const canCreate = await entityInfra.check_entity_rbac(
        userId,
        ENTITY_CODE,
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
      // ✅ Grant OWNER permission to creator
      // ═══════════════════════════════════════════════════════════════
      await entityInfra.set_entity_rbac_owner(userId, ENTITY_CODE, newRevenue.id);

      return reply.status(201).send(newRevenue);
    } catch (error) {
      fastify.log.error('Error creating revenue:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // DELETE endpoint is automatically created by createUniversalEntityRoutes above
}
