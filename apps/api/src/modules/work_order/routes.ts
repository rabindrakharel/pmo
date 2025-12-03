/**
 * ============================================================================
 * WORK_ORDER ROUTES MODULE - Universal CRUD Factory Pattern
 * ============================================================================
 *
 * ENDPOINTS (via Universal CRUD Factory):
 * - GET    /api/v1/work_order           - List with pagination, RBAC, auto-filters
 * - GET    /api/v1/work_order/:id       - Get single with RBAC, metadata
 * - PATCH  /api/v1/work_order/:id       - Update with RBAC, registry sync
 * - PUT    /api/v1/work_order/:id       - Update (alias for PATCH)
 *
 * CUSTOM ENDPOINTS:
 * - POST   /api/v1/work_order           - Create with custom validation
 * - DELETE /api/v1/work_order/:id       - Soft delete via factory
 * - GET    /api/v1/work_order/:id/{child} - Child entity endpoints via factory
 *
 * ============================================================================
 */

import type { FastifyInstance } from 'fastify';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { createUniversalEntityRoutes } from '../../lib/universal-crud-factory.js';
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';
import { createChildEntityEndpointsFromMetadata } from '../../lib/child-entity-route-factory.js';
import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID } from '../../services/entity-infrastructure.service.js';

// ============================================================================
// Module-level constants (DRY - used across all endpoints)
// ============================================================================
const ENTITY_CODE = 'work_order';

export async function workOrderRoutes(fastify: FastifyInstance) {
  // ═══════════════════════════════════════════════════════════════
  // ✨ UNIVERSAL CRUD FACTORY - Generates LIST, GET, PATCH, PUT endpoints
  // ═══════════════════════════════════════════════════════════════
  createUniversalEntityRoutes(fastify, {
    entityCode: ENTITY_CODE,
    tableName: 'fact_work_order',
    tableAlias: 'w',
    searchFields: ['name', 'descr', 'code', 'customer_name'],
    defaultOrderBy: 'scheduled_date DESC NULLS LAST, created_ts DESC'
  });

  // ═══════════════════════════════════════════════════════════════
  // ✅ ENTITY INFRASTRUCTURE SERVICE - Initialize service instance
  // ═══════════════════════════════════════════════════════════════
  const entityInfra = getEntityInfrastructure(db);

  // ============================================================================
  // Create Work Order (Custom - entity-specific validation)
  // ============================================================================
  fastify.post('/api/v1/work_order', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['work_order'],
      summary: 'Create work order'
    }
  }, async (request, reply) => {
    const data = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    // Default values
    if (!data.name) data.name = 'Untitled';
    if (!data.code) data.code = `WO-${Date.now()}`;

    try {
      // ═══════════════════════════════════════════════════════════════
      // ✅ RBAC CHECK - Can user CREATE work orders?
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
        INSERT INTO app.fact_work_order (
          code, name, descr, metadata,
          dl__work_order_status, scheduled_date, scheduled_start_time, scheduled_end_time,
          assigned_technician_name, labor_hours, labor_cost_amt, materials_cost_amt, total_cost_amt,
          customer_name, customer_email, customer_phone,
          service_address_line1, service_city, service_postal_code,
          customer_signature_flag, customer_satisfaction_rating, completion_notes, internal_notes,
          active_flag
        )
        VALUES (
          ${data.code}, ${data.name}, ${data.descr || null},
          ${data.metadata ? JSON.stringify(data.metadata) : '{}'}::jsonb,
          ${data.dl__work_order_status || 'Scheduled'}, ${data.scheduled_date || null},
          ${data.scheduled_start_time || null}, ${data.scheduled_end_time || null},
          ${data.assigned_technician_name || null}, ${data.labor_hours || 0},
          ${data.labor_cost_amt || 0}, ${data.materials_cost_amt || 0}, ${data.total_cost_amt || 0},
          ${data.customer_name || null}, ${data.customer_email || null}, ${data.customer_phone || null},
          ${data.service_address_line1 || null}, ${data.service_city || null}, ${data.service_postal_code || null},
          ${data.customer_signature_flag || false}, ${data.customer_satisfaction_rating || null},
          ${data.completion_notes || null}, ${data.internal_notes || null},
          true
        )
        RETURNING *
      `);

      const newWorkOrder = result[0] as any;

      // Register in entity_instance
      await db.execute(sql`
        INSERT INTO app.entity_instance (entity_type, entity_id, entity_name, entity_code)
        VALUES ('work_order', ${newWorkOrder.id}::uuid, ${newWorkOrder.name}, ${newWorkOrder.code})
        ON CONFLICT (entity_type, entity_id) DO UPDATE
        SET entity_name = EXCLUDED.entity_name, entity_code = EXCLUDED.entity_code, updated_ts = NOW()
      `);

      return reply.status(201).send(newWorkOrder);
    } catch (error) {
      fastify.log.error('Error creating work order:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Delete Work Order (Soft Delete via Factory)
  // ============================================================================
  createEntityDeleteEndpoint(fastify, ENTITY_CODE);

  // ============================================================================
  // Child Entity Endpoints (via Factory)
  // ============================================================================
  await createChildEntityEndpointsFromMetadata(fastify, ENTITY_CODE);
}
