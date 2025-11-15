import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

// Response schema matching email template database structure
const EmailTemplateSchema = Type.Object({
  id: Type.String(),
  code: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  name: Type.String(),
  subject: Type.String(),
  descr: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  status: Type.String(),
  template_schema: Type.Any(),
  preview_text: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  from_name: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  from_email: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  reply_to_email: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  active_flag: Type.Boolean(),
  created_ts: Type.String(),
  updated_ts: Type.String(),
  version: Type.Number(),
  metadata: Type.Optional(Type.Any()),
});

// Create schema
const CreateEmailTemplateSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  subject: Type.String({ minLength: 1 }),
  code: Type.Optional(Type.String()),
  descr: Type.Optional(Type.String()),
  status: Type.Optional(Type.String()),
  template_schema: Type.Optional(Type.Any()),
  preview_text: Type.Optional(Type.String()),
  from_name: Type.Optional(Type.String()),
  from_email: Type.Optional(Type.String()),
  reply_to_email: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
});

const UpdateEmailTemplateSchema = Type.Partial(CreateEmailTemplateSchema);

export async function emailTemplateRoutes(fastify: FastifyInstance) {
  // List email templates with RBAC filtering
  fastify.get('/api/v1/email-template', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        active_flag: Type.Optional(Type.Boolean()),
        status: Type.Optional(Type.String()),
        search: Type.Optional(Type.String()),
        page: Type.Optional(Type.Number({ minimum: 1 })),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 }))}),
      response: {
        200: Type.Object({
          data: Type.Array(EmailTemplateSchema),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number()}),
        403: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    try {
      const userId = request.user?.sub;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const {
        active_flag = true,
        status,
        search,
        page = 1,
        limit = 20} = request.query as any;

      const offset = (page - 1) * limit;

      // Build WHERE conditions
      const conditions: any[] = [
        // RBAC check - user must have view permission (0) on marketing entity
        sql`(
          EXISTS (
            SELECT 1 FROM app.entity_id_rbac_map rbac
            WHERE rbac.person_entity_name = 'employee' AND rbac.person_entity_id = ${userId}
              AND rbac.entity_name = 'marketing'
              AND (rbac.entity_id = et.id OR rbac.entity_id = '11111111-1111-1111-1111-111111111111'::uuid)
              AND rbac.active_flag = true
              AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
              AND rbac.permission >= 0
          )
        )`
      ];

      if (active_flag !== undefined) {
        conditions.push(sql`et.active_flag = ${active_flag}`);
      }

      if (status) {
        conditions.push(sql`et.status = ${status}`);
      }

      if (search) {
        conditions.push(sql`(
          et.name ILIKE ${`%${search}%`} OR
          et.subject ILIKE ${`%${search}%`} OR
          et.descr ILIKE ${`%${search}%`}
        )`);
      }

      const whereClause = conditions.length > 0
        ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
        : sql``;

      // Query for templates
      const templates = await db.execute(sql`
        SELECT
          et.id,
          et.slug,
          et.code,
          et.name,
          et.subject,
          et.descr,
          et.tags,
          et.status,
          et.template_schema,
          et.preview_text,
          et.from_name,
          et.from_email,
          et.reply_to_email,
          et.from_ts,
          et.to_ts,
          et.active_flag,
          et.created_ts,
          et.updated_ts,
          et.version,
          et.metadata
        FROM app.d_email_template et
        ${whereClause}
        ORDER BY et.updated_ts DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      // Count total
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.d_email_template et
        ${whereClause}
      `);

      const total = Number(countResult[0]?.total || 0);

      return {
        data: templates,
        total,
        limit,
        offset};
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to fetch email templates' });
    }
  });

  // Get single email template by ID
  fastify.get('/api/v1/email-template/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String()}),
      response: {
        200: EmailTemplateSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    try {
      const userId = request.user?.sub;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params as any;

      const result = await db.execute(sql`
        SELECT
          et.id,
          et.slug,
          et.code,
          et.name,
          et.subject,
          et.descr,
          et.tags,
          et.status,
          et.template_schema,
          et.preview_text,
          et.from_name,
          et.from_email,
          et.reply_to_email,
          et.from_ts,
          et.to_ts,
          et.active_flag,
          et.created_ts,
          et.updated_ts,
          et.version,
          et.metadata
        FROM app.d_email_template et
        WHERE et.id = ${id}
          AND et.active_flag = true
          AND EXISTS (
            SELECT 1 FROM app.entity_id_rbac_map rbac
            WHERE rbac.person_entity_name = 'employee' AND rbac.person_entity_id = ${userId}
              AND rbac.entity_name = 'marketing'
              AND (rbac.entity_id = ${id} OR rbac.entity_id = '11111111-1111-1111-1111-111111111111'::uuid)
              AND rbac.active_flag = true
              AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
              AND rbac.permission >= 0
          )
      `);

      if (result.length === 0) {
        return reply.status(404).send({ error: 'Email template not found' });
      }

      return result[0];
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to fetch email template' });
    }
  });

  // Create new email template
  fastify.post('/api/v1/email-template', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateEmailTemplateSchema,
      response: {
        201: EmailTemplateSchema,
        403: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    try {
      const userId = request.user?.sub;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Check if user has create permission
      const rbacCheck = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map
        WHERE person_entity_name = 'employee' AND person_entity_id = ${userId}
          AND entity = 'marketing'
          AND entity_id = 'all'
          AND active_flag = true
          AND (expires_ts IS NULL OR expires_ts > NOW())
          AND permission >= 4
      `);

      if (rbacCheck.length === 0) {
        return reply.status(403).send({ error: 'Insufficient permissions to create email templates' });
      }

      const data = request.body as any;

      // Prepare template schema with default structure if not provided
      const templateSchema = data.template_schema || {
        blocks: [],
        globalStyles: {
          backgroundColor: '#ffffff',
          fontFamily: 'Arial, sans-serif',
          maxWidth: '600px'
        }
      };

      const result = await db.execute(sql`
        INSERT INTO app.d_email_template (
          name,
          subject,
          code,
          descr,
          status,
          template_schema,
          preview_text,
          from_name,
          from_email,
          reply_to_email,
          metadata
        ) VALUES (
          ${data.name},
          ${data.subject},
          ${data.slug || null},
          ${data.code || null},
          ${data.descr || null},
          ${data.tags ? JSON.stringify(data.tags) : '[]'}::jsonb,
          ${data.status || 'draft'},
          ${JSON.stringify(templateSchema)}::jsonb,
          ${data.preview_text || null},
          ${data.from_name || null},
          ${data.from_email || null},
          ${data.reply_to_email || null},
          ${data.metadata ? JSON.stringify(data.metadata) : '{}'}::jsonb
        )
        RETURNING *
      `);

      reply.status(201);
      return result[0];
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to create email template' });
    }
  });

  // Update email template
  fastify.put('/api/v1/email-template/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String()}),
      body: UpdateEmailTemplateSchema,
      response: {
        200: EmailTemplateSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    try {
      const userId = request.user?.sub;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params as any;

      // Check if user has edit permission
      const rbacCheck = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map
        WHERE person_entity_name = 'employee' AND person_entity_id = ${userId}
          AND entity = 'marketing'
          AND (entity_id = ${id} OR entity_id = 'all')
          AND active_flag = true
          AND (expires_ts IS NULL OR expires_ts > NOW())
          AND permission >= 1
      `);

      if (rbacCheck.length === 0) {
        return reply.status(403).send({ error: 'Insufficient permissions to update email template' });
      }

      const data = request.body as any;
      const updates: any[] = [];
      const values: any[] = [];

      if (data.name !== undefined) {
        updates.push(sql`name = ${data.name}`);
      }
      if (data.subject !== undefined) {
        updates.push(sql`subject = ${data.subject}`);
      }
      if (data.slug !== undefined) {
        updates.push(sql`slug = ${data.slug}`);
      }
      if (data.code !== undefined) {
        updates.push(sql`code = ${data.code}`);
      }
      if (data.descr !== undefined) {
        updates.push(sql`descr = ${data.descr}`);
      }
      if (data.tags !== undefined) {
        updates.push(sql`tags = ${JSON.stringify(data.tags)}::jsonb`);
      }
      if (data.status !== undefined) {
        updates.push(sql`status = ${data.status}`);
      }
      if (data.template_schema !== undefined) {
        updates.push(sql`template_schema = ${JSON.stringify(data.template_schema)}::jsonb`);
        updates.push(sql`version = version + 1`);
      }
      if (data.preview_text !== undefined) {
        updates.push(sql`preview_text = ${data.preview_text}`);
      }
      if (data.from_name !== undefined) {
        updates.push(sql`from_name = ${data.from_name}`);
      }
      if (data.from_email !== undefined) {
        updates.push(sql`from_email = ${data.from_email}`);
      }
      if (data.reply_to_email !== undefined) {
        updates.push(sql`reply_to_email = ${data.reply_to_email}`);
      }
      if (data.metadata !== undefined) {
        updates.push(sql`metadata = ${JSON.stringify(data.metadata)}::jsonb`);
      }

      if (updates.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updates.push(sql`updated_ts = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.d_email_template
        SET ${sql.join(updates, sql`, `)}
        WHERE id = ${id} AND active_flag = true
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(404).send({ error: 'Email template not found' });
      }

      return result[0];
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to update email template' });
    }
  });

  // Delete (soft delete) email template
  fastify.delete('/api/v1/email-template/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String()}),
      response: {
        200: Type.Object({ success: Type.Boolean(), message: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    try {
      const userId = request.user?.sub;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params as any;

      // Check if user has delete permission
      const rbacCheck = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map
        WHERE person_entity_name = 'employee' AND person_entity_id = ${userId}
          AND entity = 'marketing'
          AND (entity_id = ${id} OR entity_id = 'all')
          AND active_flag = true
          AND (expires_ts IS NULL OR expires_ts > NOW())
          AND permission >= 3
      `);

      if (rbacCheck.length === 0) {
        return reply.status(403).send({ error: 'Insufficient permissions to delete email template' });
      }

      const result = await db.execute(sql`
        UPDATE app.d_email_template
        SET active_flag = false, to_ts = NOW()
        WHERE id = ${id} AND active_flag = true
        RETURNING id
      `);

      if (result.length === 0) {
        return reply.status(404).send({ error: 'Email template not found' });
      }

      return { success: true, message: 'Email template deleted successfully' };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to delete email template' });
    }
  });
}
