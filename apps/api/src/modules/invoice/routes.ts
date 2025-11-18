import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql, SQL } from 'drizzle-orm';
import { s3AttachmentService } from '../../lib/s3-attachments.js';
import { createPaginatedResponse } from '../../lib/universal-schema-metadata.js';
// ✅ Centralized unified data gate - loosely coupled API
// ✨ Entity Infrastructure Service - centralized infrastructure operations
import { getEntityInfrastructure } from '../../services/entity-infrastructure.service.js';
// ✨ Universal auto-filter builder - zero-config query filtering
import { buildAutoFilters } from '../../lib/universal-filter-builder.js';

// ============================================================================
// Module-level constants (DRY - used across all endpoints)
// ============================================================================
const ENTITY_CODE = 'invoice';
const TABLE_ALIAS = 'i';

export async function invoiceRoutes(fastify: FastifyInstance) {
  // ✨ Initialize Entity Infrastructure Service
  const entityInfra = getEntityInfrastructure(db);

  // ============================================================================
  // List Invoices
  // ============================================================================
  fastify.get('/api/v1/invoice', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['invoice'],
      summary: 'List invoices',
      querystring: Type.Object({
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
        offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
        page: Type.Optional(Type.Number({ minimum: 1 })),
        invoice_status: Type.Optional(Type.String()),
        payment_status: Type.Optional(Type.String()),
        search: Type.Optional(Type.String())})}}, async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    const { limit = 20, offset: queryOffset, page } = request.query as any;
    const offset = page ? (page - 1) * limit : (queryOffset !== undefined ? queryOffset : 0);

    try {
      // Build WHERE conditions array
      const conditions: SQL[] = [];

      // OPTIONAL: RBAC filtering (if invoice entity has permissions configured)
      // Uncomment if entity_rbac has entries for invoice
      // const rbacWhereClause = await entityInfra.get_entity_rbac_where_condition(//   userId, ENTITY_CODE, Permission.VIEW, TABLE_ALIAS
      // );
      // conditions.push(sql.raw(rbacWhereClause));

      // ✨ UNIVERSAL AUTO-FILTER SYSTEM
      // Automatically builds filters from ANY query parameter based on field naming conventions
      // Supports: ?invoice_status=X, ?payment_status=Y, ?search=keyword, etc.
      const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query as any, {
        searchFields: ['invoice_number', 'client_name', 'product_name']
      });
      conditions.push(...autoFilters);

      // Build WHERE clause
      const whereClause = conditions.length > 0
        ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
        : sql``;

      // Count query
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM app.f_invoice ${sql.raw(TABLE_ALIAS)}
        ${whereClause}
      `);
      const total = Number(countResult[0]?.count || 0);

      // Data query
      const rows = await db.execute(sql`
        SELECT *
        FROM app.f_invoice ${sql.raw(TABLE_ALIAS)}
        ${whereClause}
        ORDER BY ${sql.raw(TABLE_ALIAS)}.invoice_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return createPaginatedResponse(rows, total, limit, offset);
    } catch (error) {
      fastify.log.error('Error listing invoices:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Get Single Invoice
  // ============================================================================
  fastify.get('/api/v1/invoice/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['invoice'],
      summary: 'Get invoice by ID',
      params: Type.Object({ id: Type.String({ format: 'uuid' }) })}}, async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    const { id } = request.params as any;

    try {
      // OPTIONAL: RBAC check (if invoice entity has permissions configured)
      // Uncomment if entity_rbac has entries for invoice
      // const canView = await entityInfra.check_entity_rbac(userId, ENTITY_CODE, id, Permission.VIEW);
      // if (!canView) {
      //   return reply.status(403).send({ error: 'No permission to view this invoice' });
      // }

      const result = await db.execute(sql`
        SELECT *
        FROM app.f_invoice
        WHERE id = ${id}
      `);

      if (!result.length) return reply.status(404).send({ error: 'Not found' });
      return result[0];
    } catch (error) {
      fastify.log.error('Error getting invoice:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Create Invoice
  // ============================================================================
  fastify.post('/api/v1/invoice', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['invoice'],
      summary: 'Create invoice'}}, async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    const data = request.body as any;

    try {
      // OPTIONAL: RBAC CHECK (if invoice entity has permissions configured)
      // Uncomment if entity_rbac has entries for invoice
      // const canCreate = await entityInfra.check_entity_rbac(userId, ENTITY_CODE, ALL_ENTITIES_ID, Permission.CREATE);
      // if (!canCreate) {
      //   return reply.status(403).send({ error: 'No permission to create invoices' });
      // }

      const invoiceNumber = data.invoice_number || `INV-${Date.now()}`;
      const invoiceDate = data.invoice_date || new Date().toISOString().split('T')[0];

      const result = await db.execute(sql`
        INSERT INTO app.f_invoice (
          invoice_number, invoice_date, client_name, product_id,
          qty_billed, unit_price_cad, invoice_status, notes, created_by
        ) VALUES (
          ${invoiceNumber},
          ${invoiceDate},
          ${data.client_name || null},
          ${data.product_id || null},
          ${data.qty_billed || data.quantity_billed},
          ${data.unit_price_cad},
          ${data.invoice_status || 'draft'},
          ${data.notes || null},
          ${userId}::uuid
        ) RETURNING *
      `);

      // NOTE: Invoice is a fact table, not a standard entity
      // If it needs to be tracked in entity_instance, uncomment below:
      // await entityInfra.set_entity_instance_registry({
      //   entity_type: ENTITY_CODE,
      //   entity_id: result[0].id,
      //   entity_name: result[0].invoice_number,
      //   entity_code: result[0].invoice_number
      // });

      return reply.status(201).send(result[0]);
    } catch (error) {
      fastify.log.error('Error creating invoice:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Update Invoice
  // ============================================================================
  fastify.put('/api/v1/invoice/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['invoice'],
      summary: 'Update invoice',
      params: Type.Object({ id: Type.String({ format: 'uuid' }) })}}, async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    const { id } = request.params as any;
    const data = request.body as any;

    try {
      // OPTIONAL: RBAC CHECK (if invoice entity has permissions configured)
      // Uncomment if entity_rbac has entries for invoice
      // const canEdit = await entityInfra.check_entity_rbac(userId, ENTITY_CODE, id, Permission.EDIT);
      // if (!canEdit) {
      //   return reply.status(403).send({ error: 'No permission to edit this invoice' });
      // }

      // Build update fields
      const updateFields: SQL[] = [];
      if (data.invoice_status !== undefined) updateFields.push(sql`invoice_status = ${data.invoice_status}`);
      if (data.payment_status !== undefined) updateFields.push(sql`payment_status = ${data.payment_status}`);
      if (data.qty_billed !== undefined) updateFields.push(sql`qty_billed = ${data.qty_billed}`);
      if (data.quantity_billed !== undefined) updateFields.push(sql`qty_billed = ${data.quantity_billed}`);
      if (data.unit_price_cad !== undefined) updateFields.push(sql`unit_price_cad = ${data.unit_price_cad}`);
      if (data.notes !== undefined) updateFields.push(sql`notes = ${data.notes}`);
      if (data.paid_date !== undefined) updateFields.push(sql`paid_date = ${data.paid_date}`);
      if (data.amount_paid_cad !== undefined) updateFields.push(sql`amount_paid_cad = ${data.amount_paid_cad}`);

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated_at = NOW()`);
      updateFields.push(sql`last_modified_by = ${userId}::uuid`);

      const result = await db.execute(sql`
        UPDATE app.f_invoice
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      if (!result.length) return reply.status(404).send({ error: 'Not found' });
      return result[0];
    } catch (error) {
      fastify.log.error('Error updating invoice:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Presigned Upload URL for Invoice Attachments
  // ============================================================================
  fastify.post('/api/v1/invoice/presigned-upload', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['invoice'],
      summary: 'Generate presigned upload URL for invoice PDF attachment',
      body: Type.Object({
        filename: Type.String(),
        contentType: Type.Optional(Type.String())
      }),
      response: {
        200: Type.Object({
          uploadUrl: Type.String(),
          objectKey: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    try {
      const { filename, contentType } = request.body as { filename: string; contentType?: string };
      const userId = (request as any).user?.sub;

      if (!userId) {
        return reply.status(401).send({ error: 'User not authenticated' });
      }

      // OPTIONAL: Check RBAC permission using entity infrastructure service
      // Uncomment if entity_rbac has entries for invoice
      // const canCreate = await entityInfra.check_entity_rbac(userId, ENTITY_CODE, ALL_ENTITIES_ID, Permission.CREATE);
      // if (!canCreate) {
      //   return reply.code(403).send({ error: 'Permission denied to upload invoice attachments' });
      // }

      // Generate presigned upload URL using s3AttachmentService
      const result = await s3AttachmentService.generatePresignedUploadUrl({
        tenantId: 'demo',
        entityType: ENTITY_CODE,
        entityId: 'temp-' + Date.now(), // Temporary ID, will be replaced when invoice is created
        fileName: filename,
        contentType: contentType || 'application/pdf'
      });

      return reply.send({
        uploadUrl: result.url,
        objectKey: result.objectKey
      });
    } catch (error: any) {
      fastify.log.error(`Presigned upload error: ${error.message}`);
      return reply.code(500).send({ error: 'Failed to generate upload URL' });
    }
  });

  // ============================================================================
  // Delete Invoice (Hard Delete - no active_flag in f_invoice)
  // ============================================================================
  fastify.delete('/api/v1/invoice/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['invoice'],
      summary: 'Delete invoice',
      params: Type.Object({ id: Type.String({ format: 'uuid' }) })}}, async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    const { id } = request.params as any;

    try {
      // OPTIONAL: RBAC CHECK (if invoice entity has permissions configured)
      // Uncomment if entity_rbac has entries for invoice
      // const canDelete = await entityInfra.check_entity_rbac(userId, ENTITY_CODE, id, Permission.DELETE);
      // if (!canDelete) {
      //   return reply.status(403).send({ error: 'No permission to delete this invoice' });
      // }

      const result = await db.execute(sql`
        DELETE FROM app.f_invoice
        WHERE id = ${id}
        RETURNING id
      `);

      if (!result.length) return reply.status(404).send({ error: 'Not found' });

      // NOTE: If invoice needs to be removed from entity_instance, uncomment:
      // await entityInfra.deactivate_entity_instance_registry(ENTITY_CODE, id);

      return reply.status(204).send();
    } catch (error) {
      fastify.log.error('Error deleting invoice:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // NOTE: Invoice is a fact table, not a standard entity with child relationships
  // If it needs child entity endpoints, uncomment below:
  // await createChildEntityEndpointsFromMetadata(fastify, ENTITY_CODE);
}
