import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

// Response schema matching message schema database structure
const MessageSchemaResponseSchema = Type.Object({
  id: Type.String(),
  code: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  name: Type.String(),
  subject: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  descr: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  message_delivery_method: Type.String(),
  status: Type.String(),
  template_schema: Type.Any(),
  preview_text: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  from_name: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  from_email: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  reply_to_email: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  sms_sender_id: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  push_priority: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  push_ttl: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  active_flag: Type.Boolean(),
  created_ts: Type.String(),
  updated_ts: Type.String(),
  version: Type.Number(),
  metadata: Type.Optional(Type.Any()),
});

// Create schema
const CreateMessageSchemaSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  message_delivery_method: Type.String({ enum: ['EMAIL', 'SMS', 'PUSH'] }),
  subject: Type.Optional(Type.String()),
  code: Type.Optional(Type.String()),
  descr: Type.Optional(Type.String()),
  status: Type.Optional(Type.String()),
  template_schema: Type.Optional(Type.Any()),
  preview_text: Type.Optional(Type.String()),
  from_name: Type.Optional(Type.String()),
  from_email: Type.Optional(Type.String()),
  reply_to_email: Type.Optional(Type.String()),
  sms_sender_id: Type.Optional(Type.String()),
  push_priority: Type.Optional(Type.String()),
  push_ttl: Type.Optional(Type.Number()),
  metadata: Type.Optional(Type.Any()),
});

const UpdateMessageSchemaSchema = Type.Partial(CreateMessageSchemaSchema);

export async function messageSchemaRoutes(fastify: FastifyInstance) {
  // List message schemas with RBAC filtering
  fastify.get('/api/v1/message-schema', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        active_flag: Type.Optional(Type.Boolean()),
        status: Type.Optional(Type.String()),
        message_delivery_method: Type.Optional(Type.String({ enum: ['EMAIL', 'SMS', 'PUSH'] })),
        search: Type.Optional(Type.String()),
        page: Type.Optional(Type.Number({ minimum: 1 })),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(MessageSchemaResponseSchema),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number(),
        }),
        403: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const userId = request.user?.sub;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const {
        active_flag = true,
        status,
        message_delivery_method,
        search,
        page = 1,
        limit = 20,
      } = request.query as any;

      const offset = (page - 1) * limit;

      // Build WHERE conditions
      const conditions: any[] = [
        // RBAC check - user must have view permission (0) on marketing entity
        sql`(
          EXISTS (
            SELECT 1 FROM app.entity_rbac rbac
            WHERE rbac.person_entity_name = 'employee' AND rbac.person_id = ${userId}
              AND rbac.entity_name = 'marketing'
              AND (rbac.entity_id = ms.id OR rbac.entity_id = '11111111-1111-1111-1111-111111111111'::uuid)
              AND rbac.active_flag = true
              AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
              AND rbac.permission >= 0
          )
        )`
      ];

      if (active_flag !== undefined) {
        conditions.push(sql`ms.active_flag = ${active_flag}`);
      }

      if (status) {
        conditions.push(sql`ms.status = ${status}`);
      }

      if (message_delivery_method) {
        conditions.push(sql`ms.message_delivery_method = ${message_delivery_method}`);
      }

      if (search) {
        conditions.push(sql`(
          ms.name ILIKE ${`%${search}%`} OR
          ms.subject ILIKE ${`%${search}%`} OR
          ms.descr ILIKE ${`%${search}%`}
        )`);
      }

      const whereClause = conditions.length > 0
        ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
        : sql``;

      // Query for message schemas
      const messageSchemas = await db.execute(sql`
        SELECT
          ms.id,
          ms.code,
          ms.name,
          ms.subject,
          ms.descr,
          ms.message_delivery_method,
          ms.status,
          ms.template_schema,
          ms.preview_text,
          ms.from_name,
          ms.from_email,
          ms.reply_to_email,
          ms.sms_sender_id,
          ms.push_priority,
          ms.push_ttl,
          ms.from_ts,
          ms.to_ts,
          ms.active_flag,
          ms.created_ts,
          ms.updated_ts,
          ms.version,
          ms.metadata
        FROM app.d_message_schema ms
        ${whereClause}
        ORDER BY ms.updated_ts DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      // Count total
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.d_message_schema ms
        ${whereClause}
      `);

      const total = Number(countResult[0]?.total || 0);

      return {
        data: messageSchemas,
        total,
        limit,
        offset,
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to fetch message schemas' });
    }
  });

  // Get single message schema by ID
  fastify.get('/api/v1/message-schema/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      response: {
        200: MessageSchemaResponseSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const userId = request.user?.sub;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params as any;

      const result = await db.execute(sql`
        SELECT
          ms.id,
          ms.code,
          ms.name,
          ms.subject,
          ms.descr,
          ms.message_delivery_method,
          ms.status,
          ms.template_schema,
          ms.preview_text,
          ms.from_name,
          ms.from_email,
          ms.reply_to_email,
          ms.sms_sender_id,
          ms.push_priority,
          ms.push_ttl,
          ms.from_ts,
          ms.to_ts,
          ms.active_flag,
          ms.created_ts,
          ms.updated_ts,
          ms.version,
          ms.metadata
        FROM app.d_message_schema ms
        WHERE ms.id = ${id}
          AND ms.active_flag = true
          AND EXISTS (
            SELECT 1 FROM app.entity_rbac rbac
            WHERE rbac.person_entity_name = 'employee' AND rbac.person_id = ${userId}
              AND rbac.entity_name = 'marketing'
              AND (rbac.entity_id = ${id} OR rbac.entity_id = '11111111-1111-1111-1111-111111111111'::uuid)
              AND rbac.active_flag = true
              AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
              AND rbac.permission >= 0
          )
      `);

      if (result.length === 0) {
        return reply.status(404).send({ error: 'Message schema not found' });
      }

      return result[0];
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to fetch message schema' });
    }
  });

  // Create new message schema
  fastify.post('/api/v1/message-schema', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateMessageSchemaSchema,
      response: {
        201: MessageSchemaResponseSchema,
        403: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const userId = request.user?.sub;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Check if user has create permission
      const rbacCheck = await db.execute(sql`
        SELECT 1 FROM app.entity_rbac
        WHERE person_entity_name = 'employee' AND person_id = ${userId}
          AND entity = 'marketing'
          AND entity_id = 'all'
          AND active_flag = true
          AND (expires_ts IS NULL OR expires_ts > NOW())
          AND permission >= 4
      `);

      if (rbacCheck.length === 0) {
        return reply.status(403).send({ error: 'Insufficient permissions to create message schemas' });
      }

      const data = request.body as any;

      // Prepare template schema with default structure if not provided
      let templateSchema = data.template_schema;
      if (!templateSchema) {
        if (data.message_delivery_method === 'EMAIL') {
          templateSchema = {
            blocks: [],
            globalStyles: {
              backgroundColor: '#ffffff',
              fontFamily: 'Arial, sans-serif',
              maxWidth: '600px'
            }
          };
        } else if (data.message_delivery_method === 'SMS') {
          templateSchema = {
            message: '',
            maxLength: 160,
            encoding: 'GSM-7',
            variables: []
          };
        } else if (data.message_delivery_method === 'PUSH') {
          templateSchema = {
            title: '',
            body: '',
            sound: 'default',
            data: {}
          };
        } else {
          templateSchema = {};
        }
      }

      const result = await db.execute(sql`
        INSERT INTO app.d_message_schema (
          name,
          message_delivery_method,
          subject,
          code,
          descr,
          status,
          template_schema,
          preview_text,
          from_name,
          from_email,
          reply_to_email,
          sms_sender_id,
          push_priority,
          push_ttl,
          metadata
        ) VALUES (
          ${data.name},
          ${data.message_delivery_method},
          ${data.subject || null},
          ${data.code || null},
          ${data.descr || null},
          ${data.status || 'draft'},
          ${JSON.stringify(templateSchema)}::jsonb,
          ${data.preview_text || null},
          ${data.from_name || null},
          ${data.from_email || null},
          ${data.reply_to_email || null},
          ${data.sms_sender_id || null},
          ${data.push_priority || null},
          ${data.push_ttl || null},
          ${data.metadata ? JSON.stringify(data.metadata) : '{}'}::jsonb
        )
        RETURNING *
      `);

      reply.status(201);
      return result[0];
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to create message schema' });
    }
  });

  // Update message schema
  fastify.put('/api/v1/message-schema/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      body: UpdateMessageSchemaSchema,
      response: {
        200: MessageSchemaResponseSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const userId = request.user?.sub;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params as any;

      // Check if user has edit permission
      const rbacCheck = await db.execute(sql`
        SELECT 1 FROM app.entity_rbac
        WHERE person_entity_name = 'employee' AND person_id = ${userId}
          AND entity = 'marketing'
          AND (entity_id = ${id} OR entity_id = 'all')
          AND active_flag = true
          AND (expires_ts IS NULL OR expires_ts > NOW())
          AND permission >= 1
      `);

      if (rbacCheck.length === 0) {
        return reply.status(403).send({ error: 'Insufficient permissions to update message schema' });
      }

      const data = request.body as any;
      const updates: any[] = [];

      if (data.name !== undefined) {
        updates.push(sql`name = ${data.name}`);
      }
      if (data.message_delivery_method !== undefined) {
        updates.push(sql`message_delivery_method = ${data.message_delivery_method}`);
      }
      if (data.subject !== undefined) {
        updates.push(sql`subject = ${data.subject}`);
      }
      if (data.code !== undefined) {
        updates.push(sql`code = ${data.code}`);
      }
      if (data.descr !== undefined) {
        updates.push(sql`descr = ${data.descr}`);
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
      if (data.sms_sender_id !== undefined) {
        updates.push(sql`sms_sender_id = ${data.sms_sender_id}`);
      }
      if (data.push_priority !== undefined) {
        updates.push(sql`push_priority = ${data.push_priority}`);
      }
      if (data.push_ttl !== undefined) {
        updates.push(sql`push_ttl = ${data.push_ttl}`);
      }
      if (data.metadata !== undefined) {
        updates.push(sql`metadata = ${JSON.stringify(data.metadata)}::jsonb`);
      }

      if (updates.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updates.push(sql`updated_ts = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.d_message_schema
        SET ${sql.join(updates, sql`, `)}
        WHERE id = ${id} AND active_flag = true
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(404).send({ error: 'Message schema not found' });
      }

      return result[0];
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to update message schema' });
    }
  });

  // Delete (soft delete) message schema
  fastify.delete('/api/v1/message-schema/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      response: {
        200: Type.Object({ success: Type.Boolean(), message: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const userId = request.user?.sub;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params as any;

      // Check if user has delete permission
      const rbacCheck = await db.execute(sql`
        SELECT 1 FROM app.entity_rbac
        WHERE person_entity_name = 'employee' AND person_id = ${userId}
          AND entity = 'marketing'
          AND (entity_id = ${id} OR entity_id = 'all')
          AND active_flag = true
          AND (expires_ts IS NULL OR expires_ts > NOW())
          AND permission >= 3
      `);

      if (rbacCheck.length === 0) {
        return reply.status(403).send({ error: 'Insufficient permissions to delete message schema' });
      }

      const result = await db.execute(sql`
        UPDATE app.d_message_schema
        SET active_flag = false, to_ts = NOW()
        WHERE id = ${id} AND active_flag = true
        RETURNING id
      `);

      if (result.length === 0) {
        return reply.status(404).send({ error: 'Message schema not found' });
      }

      return { success: true, message: 'Message schema deleted successfully' };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to delete message schema' });
    }
  });
}
