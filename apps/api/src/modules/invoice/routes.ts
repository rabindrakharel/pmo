import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { s3AttachmentService } from '../../lib/s3-attachments.js';

export async function invoiceRoutes(fastify: FastifyInstance) {
  // List invoices
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
      }),
    },
  }, async (request, reply) => {
    const { limit = 20, offset: queryOffset, page, invoice_status } = request.query as any;
    const offset = page ? (page - 1) * limit : (queryOffset !== undefined ? queryOffset : 0);

    try {
      const conditions = ['1=1'];
      if (invoice_status) conditions.push(`invoice_status = '${invoice_status}'`);

      const whereClause = conditions.join(' AND ');

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM app.f_invoice
        WHERE ${sql.raw(whereClause)}
      `);
      const total = Number(countResult[0]?.count || 0);

      const rows = await db.execute(sql`
        SELECT *
        FROM app.f_invoice
        WHERE ${sql.raw(whereClause)}
        ORDER BY invoice_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return { data: rows, total, limit, offset };
    } catch (error) {
      fastify.log.error('Error listing invoices:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get invoice by ID
  fastify.get('/api/v1/invoice/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['invoice'],
      summary: 'Get invoice by ID',
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
    },
  }, async (request, reply) => {
    const { id } = request.params as any;

    try {
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

  // Create invoice
  fastify.post('/api/v1/invoice', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['invoice'],
      summary: 'Create invoice',
    },
  }, async (request, reply) => {
    const data = request.body as any;

    try {
      const invoiceNumber = data.invoice_number || `INV-${Date.now()}`;
      const invoiceDate = data.invoice_date || new Date().toISOString().split('T')[0];

      const result = await db.execute(sql`
        INSERT INTO app.f_invoice (
          invoice_number, invoice_date, client_name, product_id,
          quantity_billed, unit_price_cad, invoice_status, notes
        ) VALUES (
          ${invoiceNumber},
          ${invoiceDate},
          ${data.client_name || null},
          ${data.product_id || null},
          ${data.quantity_billed},
          ${data.unit_price_cad},
          ${data.invoice_status || 'draft'},
          ${data.notes || null}
        ) RETURNING *
      `);

      return result[0];
    } catch (error) {
      fastify.log.error('Error creating invoice:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update invoice
  fastify.put('/api/v1/invoice/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['invoice'],
      summary: 'Update invoice',
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
    },
  }, async (request, reply) => {
    const { id } = request.params as any;
    const data = request.body as any;

    try {
      const setClauses = [];
      if (data.invoice_status !== undefined) setClauses.push(`invoice_status = '${data.invoice_status}'`);
      if (data.quantity_billed !== undefined) setClauses.push(`quantity_billed = ${data.quantity_billed}`);
      if (data.unit_price_cad !== undefined) setClauses.push(`unit_price_cad = ${data.unit_price_cad}`);
      if (data.notes !== undefined) setClauses.push(`notes = '${data.notes}'`);

      if (setClauses.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      setClauses.push('updated_at = NOW()');
      const setClause = setClauses.join(', ');

      const result = await db.execute(sql`
        UPDATE app.f_invoice
        SET ${sql.raw(setClause)}
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

  // Presigned upload URL for invoice attachments
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

      // Check RBAC permission for creating invoices
      const rbacCheck = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map
        WHERE empid = ${userId}
          AND entity = 'invoice'
          AND entity_id = 'all'
          AND 4 = ANY(permission)
      `);

      if (rbacCheck.length === 0) {
        return reply.code(403).send({ error: 'Permission denied to upload invoice attachments' });
      }

      // Generate presigned upload URL using s3AttachmentService
      const result = await s3AttachmentService.generatePresignedUploadUrl({
        tenantId: 'demo',
        entityType: 'invoice',
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

  // Delete invoice
  fastify.delete('/api/v1/invoice/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['invoice'],
      summary: 'Delete invoice',
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
    },
  }, async (request, reply) => {
    const { id } = request.params as any;

    try {
      const result = await db.execute(sql`
        DELETE FROM app.f_invoice
        WHERE id = ${id}
        RETURNING id
      `);

      if (!result.length) return reply.status(404).send({ error: 'Not found' });
      return reply.status(204).send();
    } catch (error) {
      fastify.log.error('Error deleting invoice:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
