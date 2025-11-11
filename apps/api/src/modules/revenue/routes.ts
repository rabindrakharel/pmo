import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';
import { createChildEntityEndpoint } from '../../lib/child-entity-route-factory.js';
import { s3AttachmentService } from '../../lib/s3-attachments.js';
import { createPaginatedResponse } from '../../lib/universal-schema-metadata.js';

// Schema based on d_revenue table structure from db/37_d_revenue.ddl
const RevenueSchema = Type.Object({
  id: Type.String(),
  slug: Type.String(),
  code: Type.String(),
  revenue_code: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Any()),
  metadata: Type.Optional(Type.Any()),
  revenue_amt_local: Type.Number(),
  revenue_amt_invoice: Type.Optional(Type.Number()),
  invoice_currency: Type.Optional(Type.String()),
  exch_rate: Type.Optional(Type.Number()),
  revenue_forecasted_amt_lcl: Type.Optional(Type.Number()),
  attachment: Type.Optional(Type.String()),
  attachment_format: Type.Optional(Type.String()),
  attachment_size_bytes: Type.Optional(Type.Number()),
  attachment_object_bucket: Type.Optional(Type.String()),
  attachment_object_key: Type.Optional(Type.String()),
  from_ts: Type.Optional(Type.String()),
  to_ts: Type.Optional(Type.String()),
  active_flag: Type.Optional(Type.Boolean()),
  created_ts: Type.Optional(Type.String()),
  updated_ts: Type.Optional(Type.String()),
  version: Type.Optional(Type.Number()),
});

const CreateRevenueSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1 })),
  slug: Type.Optional(Type.String({ minLength: 1 })),
  code: Type.Optional(Type.String({ minLength: 1 })),
  revenue_code: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Union([Type.Array(Type.String()), Type.String()])),
  metadata: Type.Optional(Type.Union([Type.Object({}), Type.String()])),
  revenue_amt_local: Type.Number(),
  revenue_amt_invoice: Type.Optional(Type.Number()),
  invoice_currency: Type.Optional(Type.String()),
  exch_rate: Type.Optional(Type.Number()),
  revenue_forecasted_amt_lcl: Type.Optional(Type.Number()),
  attachment: Type.Optional(Type.String()),
  attachment_format: Type.Optional(Type.String()),
  attachment_size_bytes: Type.Optional(Type.Number()),
  attachment_object_bucket: Type.Optional(Type.String()),
  attachment_object_key: Type.Optional(Type.String()),
  active_flag: Type.Optional(Type.Boolean()),
});

const UpdateRevenueSchema = Type.Partial(CreateRevenueSchema);

export async function revenueRoutes(fastify: FastifyInstance) {
  // List revenues with filtering
  fastify.get('/api/v1/revenue', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        active: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        revenue_code: Type.Optional(Type.String()),
        invoice_currency: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(RevenueSchema),
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
      active, search, revenue_code, invoice_currency, limit = 50, offset = 0
    } = request.query as any;

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.code(403).send({ error: 'User not authenticated' });
    }

    try {
      // Base RBAC filtering
      const baseConditions = [
        sql`(
          EXISTS (
            SELECT 1 FROM app.entity_id_rbac_map rbac
            WHERE rbac.empid = ${userId}
              AND rbac.entity = 'revenue'
              AND (rbac.entity_id = r.id::text OR rbac.entity_id = 'all')
              AND 0 = ANY(rbac.permission)
          )
        )`
      ];

      const conditions = [...baseConditions];

      if (active !== undefined) {
        conditions.push(sql`r.active_flag = ${active}`);
      } else {
        conditions.push(sql`r.active_flag = true`);
      }

      if (search) {
        conditions.push(sql`(
          r.name ILIKE ${`%${search}%`} OR
          r.revenue_code ILIKE ${`%${search}%`} OR
          r.descr ILIKE ${`%${search}%`}
        )`);
      }

      if (revenue_code) {
        conditions.push(sql`r.revenue_code = ${revenue_code}`);
      }

      if (invoice_currency) {
        conditions.push(sql`r.invoice_currency = ${invoice_currency}`);
      }

      // Count query
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.d_revenue r
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      // Data query
      const revenues = await db.execute(sql`
        SELECT
          r.id, r.code, r.slug, r.revenue_code, r.name, r.descr, r.tags, r.metadata,
          r.revenue_amt_local, r.revenue_amt_invoice, r.invoice_currency, r.exch_rate,
          r.revenue_forecasted_amt_lcl,
          r.attachment, r.attachment_format, r.attachment_size_bytes,
          r.attachment_object_bucket, r.attachment_object_key,
          r.from_ts, r.to_ts, r.active_flag, r.created_ts, r.updated_ts, r.version
        FROM app.d_revenue r
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY r.created_ts DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return createPaginatedResponse(revenues, total, limit, offset);
    } catch (error: any) {
      fastify.log.error(`Revenue list error: ${error.message}`);
      return reply.code(500).send({ error: 'Failed to fetch revenues' });
    }
  });

  // Get single revenue by ID
  fastify.get('/api/v1/revenue/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: RevenueSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.code(403).send({ error: 'User not authenticated' });
    }

    try {
      const result = await db.execute(sql`
        SELECT r.*
        FROM app.d_revenue r
        WHERE r.id = ${id}
          AND r.active_flag = true
          AND EXISTS (
            SELECT 1 FROM app.entity_id_rbac_map rbac
            WHERE rbac.empid = ${userId}
              AND rbac.entity = 'revenue'
              AND (rbac.entity_id = r.id::text OR rbac.entity_id = 'all')
              AND 0 = ANY(rbac.permission)
          )
      `);

      if (result.length === 0) {
        return reply.code(404).send({ error: 'Revenue not found or access denied' });
      }

      return reply.send(result[0]);
    } catch (error: any) {
      fastify.log.error(`Revenue get error: ${error.message}`);
      return reply.code(500).send({ error: 'Failed to fetch revenue' });
    }
  });

  // Create new revenue
  fastify.post('/api/v1/revenue', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateRevenueSchema,
      response: {
        201: RevenueSchema,
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const body = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.code(403).send({ error: 'User not authenticated' });
    }

    try {
      // Check RBAC permission for creating revenue
      const rbacCheck = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map
        WHERE empid = ${userId}
          AND entity = 'revenue'
          AND entity_id = 'all'
          AND 4 = ANY(permission)
      `);

      if (rbacCheck.length === 0) {
        return reply.code(403).send({ error: 'Permission denied to create revenue' });
      }

      // Generate slug and code if not provided
      const slug = body.slug || body.name?.toLowerCase().replace(/\s+/g, '-') || `revenue-${Date.now()}`;
      const code = body.code || `REV-${Date.now()}`;
      const name = body.name || `Revenue ${code}`;

      const result = await db.execute(sql`
        INSERT INTO app.d_revenue (
          slug, code, revenue_code, name, descr, tags, metadata,
          revenue_amt_local, revenue_amt_invoice, invoice_currency, exch_rate,
          revenue_forecasted_amt_lcl,
          attachment, attachment_format, attachment_size_bytes,
          attachment_object_bucket, attachment_object_key,
          active_flag
        ) VALUES (
          ${slug}, ${code}, ${body.revenue_code},
          ${name}, ${body.descr || null},
          ${JSON.stringify(body.tags || [])}, ${JSON.stringify(body.metadata || {})},
          ${body.revenue_amt_local}, ${body.revenue_amt_invoice || null},
          ${body.invoice_currency || 'CAD'}, ${body.exch_rate || 1.0},
          ${body.revenue_forecasted_amt_lcl || null},
          ${body.attachment || null}, ${body.attachment_format || null}, ${body.attachment_size_bytes || null},
          ${body.attachment_object_bucket || null}, ${body.attachment_object_key || null},
          ${body.active_flag !== undefined ? body.active_flag : true}
        )
        RETURNING *
      `);

      return reply.code(201).send(result[0]);
    } catch (error: any) {
      fastify.log.error(`Revenue create error: ${error.message}`);
      return reply.code(500).send({ error: 'Failed to create revenue' });
    }
  });

  // Update revenue
  fastify.put('/api/v1/revenue/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      body: UpdateRevenueSchema,
      response: {
        200: RevenueSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as any;
    const body = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.code(403).send({ error: 'User not authenticated' });
    }

    try {
      // Check RBAC permission for editing revenue
      const rbacCheck = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map
        WHERE empid = ${userId}
          AND entity = 'revenue'
          AND (entity_id = ${id} OR entity_id = 'all')
          AND 1 = ANY(permission)
      `);

      if (rbacCheck.length === 0) {
        return reply.code(403).send({ error: 'Permission denied to update revenue' });
      }

      const updateParts: any[] = [];

      if (body.name !== undefined) updateParts.push(sql`name = ${body.name}`);
      if (body.descr !== undefined) updateParts.push(sql`descr = ${body.descr}`);
      if (body.revenue_code !== undefined) updateParts.push(sql`revenue_code = ${body.revenue_code}`);
      if (body.revenue_amt_local !== undefined) updateParts.push(sql`revenue_amt_local = ${body.revenue_amt_local}`);
      if (body.revenue_amt_invoice !== undefined) updateParts.push(sql`revenue_amt_invoice = ${body.revenue_amt_invoice}`);
      if (body.invoice_currency !== undefined) updateParts.push(sql`invoice_currency = ${body.invoice_currency}`);
      if (body.exch_rate !== undefined) updateParts.push(sql`exch_rate = ${body.exch_rate}`);
      if (body.revenue_forecasted_amt_lcl !== undefined) updateParts.push(sql`revenue_forecasted_amt_lcl = ${body.revenue_forecasted_amt_lcl}`);
      if (body.attachment !== undefined) updateParts.push(sql`attachment = ${body.attachment}`);
      if (body.attachment_format !== undefined) updateParts.push(sql`attachment_format = ${body.attachment_format}`);
      if (body.attachment_size_bytes !== undefined) updateParts.push(sql`attachment_size_bytes = ${body.attachment_size_bytes}`);
      if (body.attachment_object_bucket !== undefined) updateParts.push(sql`attachment_object_bucket = ${body.attachment_object_bucket}`);
      if (body.attachment_object_key !== undefined) updateParts.push(sql`attachment_object_key = ${body.attachment_object_key}`);

      if (updateParts.length === 0) {
        return reply.code(400).send({ error: 'No fields to update' });
      }

      updateParts.push(sql`version = version + 1`);
      updateParts.push(sql`updated_ts = now()`);

      const result = await db.execute(sql`
        UPDATE app.d_revenue
        SET ${sql.join(updateParts, sql`, `)}
        WHERE id = ${id} AND active_flag = true
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.code(404).send({ error: 'Revenue not found' });
      }

      return reply.send(result[0]);
    } catch (error: any) {
      fastify.log.error(`Revenue update error: ${error.message}`);
      return reply.code(500).send({ error: 'Failed to update revenue' });
    }
  });

  // Presigned upload URL for revenue attachments
  fastify.post('/api/v1/revenue/presigned-upload', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['revenue'],
      summary: 'Generate presigned upload URL for revenue receipt attachment',
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

      // Check RBAC permission for creating revenue
      const rbacCheck = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map
        WHERE empid = ${userId}
          AND entity = 'revenue'
          AND entity_id = 'all'
          AND 4 = ANY(permission)
      `);

      if (rbacCheck.length === 0) {
        return reply.code(403).send({ error: 'Permission denied to upload revenue attachments' });
      }

      // Generate presigned upload URL using s3AttachmentService
      const result = await s3AttachmentService.generatePresignedUploadUrl({
        tenantId: 'demo',
        entityType: 'revenue',
        entityId: 'temp-' + Date.now(), // Temporary ID, will be replaced when revenue is created
        fileName: filename,
        contentType: contentType || 'application/octet-stream'
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

  // Delete revenue (soft delete)
  await createEntityDeleteEndpoint(fastify, 'revenue');

  // Child entity endpoints - revenue under parent entities
  // Enables routes like /api/v1/project/{id}/revenue, /api/v1/task/{id}/revenue, etc.
  createChildEntityEndpoint(fastify, 'project', 'revenue', 'd_revenue');
  createChildEntityEndpoint(fastify, 'task', 'revenue', 'd_revenue');
  createChildEntityEndpoint(fastify, 'biz', 'revenue', 'd_revenue');
  createChildEntityEndpoint(fastify, 'cust', 'revenue', 'd_revenue');
  createChildEntityEndpoint(fastify, 'office', 'revenue', 'd_revenue');
}
