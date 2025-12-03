/**
 * ============================================================================
 * QUOTE ROUTES MODULE - Universal CRUD Factory Pattern
 * ============================================================================
 *
 * ENDPOINTS (via Universal CRUD Factory):
 * - GET    /api/v1/quote           - List with pagination, RBAC, auto-filters
 * - GET    /api/v1/quote/:id       - Get single with RBAC, metadata
 * - PATCH  /api/v1/quote/:id       - Update with RBAC, registry sync
 * - PUT    /api/v1/quote/:id       - Update (alias for PATCH)
 *
 * CUSTOM ENDPOINTS:
 * - POST   /api/v1/quote           - Create with custom validation
 * - DELETE /api/v1/quote/:id       - Soft delete via factory
 * - GET    /api/v1/quote/:id/{child} - Child entity endpoints via factory
 *
 * ============================================================================
 */

import type { FastifyInstance } from 'fastify';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { createUniversalEntityRoutes } from '../../lib/universal-entity-crud-factory.js';
import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID } from '../../services/entity-infrastructure.service.js';

// ============================================================================
// Module-level constants (DRY - used across all endpoints)
// ============================================================================
const ENTITY_CODE = 'quote';

export async function quoteRoutes(fastify: FastifyInstance) {
  // ═══════════════════════════════════════════════════════════════
  // ✨ UNIVERSAL CRUD FACTORY - Generates LIST, GET, PATCH, PUT endpoints
  // ═══════════════════════════════════════════════════════════════
  createUniversalEntityRoutes(fastify, {
    entityCode: ENTITY_CODE,
    tableName: 'fact_quote',
    tableAlias: 'q',
    searchFields: ['name', 'descr', 'code', 'customer_name'],
    defaultOrderBy: 'created_ts DESC'
  });

  // ═══════════════════════════════════════════════════════════════
  // ✅ ENTITY INFRASTRUCTURE SERVICE - Initialize service instance
  // ═══════════════════════════════════════════════════════════════
  const entityInfra = getEntityInfrastructure(db);

  // ============================================================================
  // Create Quote (Custom - entity-specific validation)
  // ============================================================================
  fastify.post('/api/v1/quote', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['quote'],
      summary: 'Create quote'
    }
  }, async (request, reply) => {
    const data = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    // Default values
    if (!data.name) data.name = 'Untitled';
    if (!data.code) data.code = `QT-${Date.now()}`;

    try {
      // ═══════════════════════════════════════════════════════════════
      // ✅ RBAC CHECK - Can user CREATE quotes?
      // ═══════════════════════════════════════════════════════════════
      const canCreate = await entityInfra.check_entity_rbac(
        userId,
        ENTITY_CODE,
        ALL_ENTITIES_ID,
        Permission.CREATE
      );

      if (!canCreate) {
        return reply.status(403).send({ error: 'Insufficient permissions' });
      }

      const result = await db.execute(sql`
        INSERT INTO app.fact_quote (
          code, name, descr, metadata,
          dl__quote_stage, quote_items,
          subtotal_amt, discount_pct, discount_amt, tax_pct, quote_tax_amt, quote_total_amt,
          valid_until_date, customer_name, customer_email, customer_phone,
          internal_notes, customer_notes, active_flag
        )
        VALUES (
          ${data.code}, ${data.name}, ${data.descr || null},
          ${data.metadata ? JSON.stringify(data.metadata) : '{}'}::jsonb,
          ${data.dl__quote_stage || 'Draft'},
          ${data.quote_items ? JSON.stringify(data.quote_items) : '[]'}::jsonb,
          ${data.subtotal_amt || 0}, ${data.discount_pct || 0}, ${data.discount_amt || 0},
          ${data.tax_pct || 13.00}, ${data.quote_tax_amt || 0}, ${data.quote_total_amt || 0},
          ${data.valid_until_date || null}, ${data.customer_name || null},
          ${data.customer_email || null}, ${data.customer_phone || null},
          ${data.internal_notes || null}, ${data.customer_notes || null},
          true
        )
        RETURNING *
      `);

      const newQuote = result[0] as any;

      // Register in entity_instance
      await db.execute(sql`
        INSERT INTO app.entity_instance (entity_type, entity_id, entity_name, entity_code)
        VALUES ('quote', ${newQuote.id}::uuid, ${newQuote.name}, ${newQuote.code})
        ON CONFLICT (entity_type, entity_id) DO UPDATE
        SET entity_name = EXCLUDED.entity_name, entity_code = EXCLUDED.entity_code, updated_ts = NOW()
      `);

      return reply.status(201).send(newQuote);
    } catch (error) {
      fastify.log.error('Error creating quote:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // DELETE endpoint is automatically created by createUniversalEntityRoutes above
}
