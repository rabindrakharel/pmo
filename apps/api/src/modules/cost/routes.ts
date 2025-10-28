import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';
import { createChildEntityEndpoint } from '../../lib/child-entity-route-factory.js';
import { s3AttachmentService } from '../../lib/s3-attachments.js';

// Schema based on d_cost table structure from db/36_d_cost.ddl
const CostSchema = Type.Object({
  id: Type.String(),
  slug: Type.String(),
  code: Type.String(),
  cost_code: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Any()),
  metadata: Type.Optional(Type.Any()),
  cost_amt_lcl: Type.Number(),
  cost_amt_invoice: Type.Optional(Type.Number()),
  invoice_currency: Type.Optional(Type.String()),
  exch_rate: Type.Optional(Type.Number()),
  cust_budgeted_amt_lcl: Type.Optional(Type.Number()),
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

const CreateCostSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1 })),
  slug: Type.Optional(Type.String({ minLength: 1 })),
  code: Type.Optional(Type.String({ minLength: 1 })),
  cost_code: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Union([Type.Array(Type.String()), Type.String()])),
  metadata: Type.Optional(Type.Union([Type.Object({}), Type.String()])),
  cost_amt_lcl: Type.Number(),
  cost_amt_invoice: Type.Optional(Type.Number()),
  invoice_currency: Type.Optional(Type.String()),
  exch_rate: Type.Optional(Type.Number()),
  cust_budgeted_amt_lcl: Type.Optional(Type.Number()),
  attachment: Type.Optional(Type.String()),
  attachment_format: Type.Optional(Type.String()),
  attachment_size_bytes: Type.Optional(Type.Number()),
  attachment_object_bucket: Type.Optional(Type.String()),
  attachment_object_key: Type.Optional(Type.String()),
  active_flag: Type.Optional(Type.Boolean()),
});

const UpdateCostSchema = Type.Partial(CreateCostSchema);

export async function costRoutes(fastify: FastifyInstance) {
  // List costs with filtering
  fastify.get('/api/v1/cost', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        active: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        cost_code: Type.Optional(Type.String()),
        invoice_currency: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(CostSchema),
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
      active, search, cost_code, invoice_currency, limit = 50, offset = 0
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
              AND rbac.entity = 'cost'
              AND (rbac.entity_id = c.id::text OR rbac.entity_id = 'all')
              AND 0 = ANY(rbac.permission)
          )
        )`
      ];

      const conditions = [...baseConditions];

      if (active !== undefined) {
        conditions.push(sql`c.active_flag = ${active}`);
      } else {
        conditions.push(sql`c.active_flag = true`);
      }

      if (search) {
        conditions.push(sql`(
          c.name ILIKE ${`%${search}%`} OR
          c.cost_code ILIKE ${`%${search}%`} OR
          c.descr ILIKE ${`%${search}%`}
        )`);
      }

      if (cost_code) {
        conditions.push(sql`c.cost_code = ${cost_code}`);
      }

      if (invoice_currency) {
        conditions.push(sql`c.invoice_currency = ${invoice_currency}`);
      }

      // Count query
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.d_cost c
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      // Data query
      const costs = await db.execute(sql`
        SELECT
          c.id, c.code, c.slug, c.cost_code, c.name, c.descr, c.tags, c.metadata,
          c.cost_amt_lcl, c.cost_amt_invoice, c.invoice_currency, c.exch_rate,
          c.cust_budgeted_amt_lcl,
          c.attachment, c.attachment_format, c.attachment_size_bytes,
          c.attachment_object_bucket, c.attachment_object_key,
          c.from_ts, c.to_ts, c.active_flag, c.created_ts, c.updated_ts, c.version
        FROM app.d_cost c
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY c.created_ts DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return { data: costs, total, limit, offset };
    } catch (error: any) {
      fastify.log.error(`Cost list error: ${error.message}`);
      return reply.code(500).send({ error: 'Failed to fetch costs' });
    }
  });

  // Get single cost by ID
  fastify.get('/api/v1/cost/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: CostSchema,
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
        SELECT c.*
        FROM app.d_cost c
        WHERE c.id = ${id}
          AND c.active_flag = true
          AND EXISTS (
            SELECT 1 FROM app.entity_id_rbac_map rbac
            WHERE rbac.empid = ${userId}
              AND rbac.entity = 'cost'
              AND (rbac.entity_id = c.id::text OR rbac.entity_id = 'all')
              AND 0 = ANY(rbac.permission)
          )
      `);

      if (result.length === 0) {
        return reply.code(404).send({ error: 'Cost not found or access denied' });
      }

      return reply.send(result[0]);
    } catch (error: any) {
      fastify.log.error(`Cost get error: ${error.message}`);
      return reply.code(500).send({ error: 'Failed to fetch cost' });
    }
  });

  // Create new cost
  fastify.post('/api/v1/cost', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateCostSchema,
      response: {
        201: CostSchema,
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
      // Check RBAC permission for creating cost
      const rbacCheck = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map
        WHERE empid = ${userId}
          AND entity = 'cost'
          AND entity_id = 'all'
          AND 4 = ANY(permission)
      `);

      if (rbacCheck.length === 0) {
        return reply.code(403).send({ error: 'Permission denied to create cost' });
      }

      // Generate slug and code if not provided
      const slug = body.slug || body.name?.toLowerCase().replace(/\s+/g, '-') || `cost-${Date.now()}`;
      const code = body.code || `COST-${Date.now()}`;
      const name = body.name || `Cost ${code}`;

      const result = await db.execute(sql`
        INSERT INTO app.d_cost (
          slug, code, cost_code, name, descr, tags, metadata,
          cost_amt_lcl, cost_amt_invoice, invoice_currency, exch_rate,
          cust_budgeted_amt_lcl,
          attachment, attachment_format, attachment_size_bytes,
          attachment_object_bucket, attachment_object_key,
          active_flag
        ) VALUES (
          ${slug}, ${code}, ${body.cost_code},
          ${name}, ${body.descr || null},
          ${JSON.stringify(body.tags || [])}, ${JSON.stringify(body.metadata || {})},
          ${body.cost_amt_lcl}, ${body.cost_amt_invoice || null},
          ${body.invoice_currency || 'CAD'}, ${body.exch_rate || 1.0},
          ${body.cust_budgeted_amt_lcl || null},
          ${body.attachment || null}, ${body.attachment_format || null}, ${body.attachment_size_bytes || null},
          ${body.attachment_object_bucket || null}, ${body.attachment_object_key || null},
          ${body.active_flag !== undefined ? body.active_flag : true}
        )
        RETURNING *
      `);

      return reply.code(201).send(result[0]);
    } catch (error: any) {
      fastify.log.error(`Cost create error: ${error.message}`);
      return reply.code(500).send({ error: 'Failed to create cost' });
    }
  });

  // Update cost
  fastify.put('/api/v1/cost/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      body: UpdateCostSchema,
      response: {
        200: CostSchema,
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
      // Check RBAC permission for editing cost
      const rbacCheck = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map
        WHERE empid = ${userId}
          AND entity = 'cost'
          AND (entity_id = ${id} OR entity_id = 'all')
          AND 1 = ANY(permission)
      `);

      if (rbacCheck.length === 0) {
        return reply.code(403).send({ error: 'Permission denied to update cost' });
      }

      const updateParts: any[] = [];

      if (body.name !== undefined) updateParts.push(sql`name = ${body.name}`);
      if (body.descr !== undefined) updateParts.push(sql`descr = ${body.descr}`);
      if (body.cost_code !== undefined) updateParts.push(sql`cost_code = ${body.cost_code}`);
      if (body.cost_amt_lcl !== undefined) updateParts.push(sql`cost_amt_lcl = ${body.cost_amt_lcl}`);
      if (body.cost_amt_invoice !== undefined) updateParts.push(sql`cost_amt_invoice = ${body.cost_amt_invoice}`);
      if (body.invoice_currency !== undefined) updateParts.push(sql`invoice_currency = ${body.invoice_currency}`);
      if (body.exch_rate !== undefined) updateParts.push(sql`exch_rate = ${body.exch_rate}`);
      if (body.cust_budgeted_amt_lcl !== undefined) updateParts.push(sql`cust_budgeted_amt_lcl = ${body.cust_budgeted_amt_lcl}`);
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
        UPDATE app.d_cost
        SET ${sql.join(updateParts, sql`, `)}
        WHERE id = ${id} AND active_flag = true
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.code(404).send({ error: 'Cost not found' });
      }

      return reply.send(result[0]);
    } catch (error: any) {
      fastify.log.error(`Cost update error: ${error.message}`);
      return reply.code(500).send({ error: 'Failed to update cost' });
    }
  });

  // Presigned upload URL for cost attachments
  fastify.post('/api/v1/cost/presigned-upload', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['cost'],
      summary: 'Generate presigned upload URL for cost invoice attachment',
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

      // Check RBAC permission for creating costs
      const rbacCheck = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map
        WHERE empid = ${userId}
          AND entity = 'cost'
          AND entity_id = 'all'
          AND 4 = ANY(permission)
      `);

      if (rbacCheck.length === 0) {
        return reply.code(403).send({ error: 'Permission denied to upload cost attachments' });
      }

      // Generate presigned upload URL using s3AttachmentService
      const result = await s3AttachmentService.generatePresignedUploadUrl({
        tenantId: 'demo',
        entityType: 'cost',
        entityId: 'temp-' + Date.now(), // Temporary ID, will be replaced when cost is created
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

  // Delete cost (soft delete)
  await createEntityDeleteEndpoint(fastify, 'cost');

  // Child entity endpoints - costs under parent entities
  // Enables routes like /api/v1/project/{id}/cost, /api/v1/task/{id}/cost, etc.
  createChildEntityEndpoint(fastify, 'project', 'cost', 'd_cost');
  createChildEntityEndpoint(fastify, 'task', 'cost', 'd_cost');
  createChildEntityEndpoint(fastify, 'biz', 'cost', 'd_cost');
  createChildEntityEndpoint(fastify, 'cust', 'cost', 'd_cost');
  createChildEntityEndpoint(fastify, 'office', 'cost', 'd_cost');
}
