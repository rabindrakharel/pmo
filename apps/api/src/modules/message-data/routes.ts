import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

// Response schema matching message data database structure
const MessageDataResponseSchema = Type.Object({
  id: Type.String(),
  message_schema_id: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  code: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  name: Type.String(),
  subject: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  descr: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  message_delivery_method: Type.String(),
  status: Type.String(),
  template_schema: Type.Any(),
  content_data: Type.Any(),
  preview_text: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  from_name: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  from_email: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  reply_to_email: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  sms_sender_id: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  push_priority: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  push_ttl: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  recipient_email: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  recipient_phone: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  recipient_device_token: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  recipient_name: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  recipient_entity_id: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  scheduled_ts: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  sent_ts: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  delivered_ts: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  error_code: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  error_message: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  retry_count: Type.Number(),
  max_retries: Type.Number(),
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  active_flag: Type.Boolean(),
  created_ts: Type.String(),
  updated_ts: Type.String(),
  metadata: Type.Optional(Type.Any()),
});

// Create/Send message schema
const CreateMessageDataSchema = Type.Object({
  message_schema_id: Type.String(),
  content_data: Type.Object({
    recipient: Type.String(),
    recipientName: Type.Optional(Type.String()),
    variables: Type.Optional(Type.Any()),
  }),
  recipient_email: Type.Optional(Type.String()),
  recipient_phone: Type.Optional(Type.String()),
  recipient_device_token: Type.Optional(Type.String()),
  recipient_name: Type.Optional(Type.String()),
  recipient_entity_id: Type.Optional(Type.String()),
  scheduled_ts: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
});

const UpdateMessageDataSchema = Type.Object({
  status: Type.Optional(Type.String()),
  content_data: Type.Optional(Type.Any()),
  sent_ts: Type.Optional(Type.String()),
  delivered_ts: Type.Optional(Type.String()),
  error_code: Type.Optional(Type.String()),
  error_message: Type.Optional(Type.String()),
  retry_count: Type.Optional(Type.Number()),
  metadata: Type.Optional(Type.Any()),
});

export async function messageDataRoutes(fastify: FastifyInstance) {
  // List message data (sent/scheduled messages) with RBAC filtering
  fastify.get('/api/v1/message-data', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        active_flag: Type.Optional(Type.Boolean()),
        status: Type.Optional(Type.String()),
        message_delivery_method: Type.Optional(Type.String({ enum: ['EMAIL', 'SMS', 'PUSH'] })),
        message_schema_id: Type.Optional(Type.String()),
        recipient_email: Type.Optional(Type.String()),
        recipient_phone: Type.Optional(Type.String()),
        recipient_entity_id: Type.Optional(Type.String()),
        search: Type.Optional(Type.String()),
        page: Type.Optional(Type.Number({ minimum: 1 })),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(MessageDataResponseSchema),
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
        message_schema_id,
        recipient_email,
        recipient_phone,
        recipient_entity_id,
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
            SELECT 1 FROM app.entity_id_rbac_map rbac
            WHERE rbac.empid = ${userId}
              AND rbac.entity = 'marketing'
              AND (rbac.entity_id = md.id::text OR rbac.entity_id = 'all')
              AND rbac.active_flag = true
              AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
              AND 0 = ANY(rbac.permission)
          )
        )`
      ];

      if (active_flag !== undefined) {
        conditions.push(sql`md.active_flag = ${active_flag}`);
      }

      if (status) {
        conditions.push(sql`md.status = ${status}`);
      }

      if (message_delivery_method) {
        conditions.push(sql`md.message_delivery_method = ${message_delivery_method}`);
      }

      if (message_schema_id) {
        conditions.push(sql`md.message_schema_id = ${message_schema_id}::uuid`);
      }

      if (recipient_email) {
        conditions.push(sql`md.recipient_email = ${recipient_email}`);
      }

      if (recipient_phone) {
        conditions.push(sql`md.recipient_phone = ${recipient_phone}`);
      }

      if (recipient_entity_id) {
        conditions.push(sql`md.recipient_entity_id = ${recipient_entity_id}::uuid`);
      }

      if (search) {
        conditions.push(sql`(
          md.name ILIKE ${`%${search}%`} OR
          md.subject ILIKE ${`%${search}%`} OR
          md.recipient_name ILIKE ${`%${search}%`} OR
          md.recipient_email ILIKE ${`%${search}%`}
        )`);
      }

      const whereClause = conditions.length > 0
        ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
        : sql``;

      // Query for message data
      const messageData = await db.execute(sql`
        SELECT
          md.id,
          md.message_schema_id,
          md.code,
          md.name,
          md.subject,
          md.descr,
          md.message_delivery_method,
          md.status,
          md.template_schema,
          md.content_data,
          md.preview_text,
          md.from_name,
          md.from_email,
          md.reply_to_email,
          md.sms_sender_id,
          md.push_priority,
          md.push_ttl,
          md.recipient_email,
          md.recipient_phone,
          md.recipient_device_token,
          md.recipient_name,
          md.recipient_entity_id,
          md.scheduled_ts,
          md.sent_ts,
          md.delivered_ts,
          md.error_code,
          md.error_message,
          md.retry_count,
          md.max_retries,
          md.from_ts,
          md.to_ts,
          md.active_flag,
          md.created_ts,
          md.updated_ts,
          md.metadata
        FROM app.f_message_data md
        ${whereClause}
        ORDER BY md.created_ts DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      // Count total
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.f_message_data md
        ${whereClause}
      `);

      const total = Number(countResult[0]?.total || 0);

      return {
        data: messageData,
        total,
        limit,
        offset,
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to fetch message data' });
    }
  });

  // Get single message data by ID
  fastify.get('/api/v1/message-data/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      response: {
        200: MessageDataResponseSchema,
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
          md.id,
          md.message_schema_id,
          md.code,
          md.name,
          md.subject,
          md.descr,
          md.message_delivery_method,
          md.status,
          md.template_schema,
          md.content_data,
          md.preview_text,
          md.from_name,
          md.from_email,
          md.reply_to_email,
          md.sms_sender_id,
          md.push_priority,
          md.push_ttl,
          md.recipient_email,
          md.recipient_phone,
          md.recipient_device_token,
          md.recipient_name,
          md.recipient_entity_id,
          md.scheduled_ts,
          md.sent_ts,
          md.delivered_ts,
          md.error_code,
          md.error_message,
          md.retry_count,
          md.max_retries,
          md.from_ts,
          md.to_ts,
          md.active_flag,
          md.created_ts,
          md.updated_ts,
          md.metadata
        FROM app.f_message_data md
        WHERE md.id = ${id}
          AND md.active_flag = true
          AND EXISTS (
            SELECT 1 FROM app.entity_id_rbac_map rbac
            WHERE rbac.empid = ${userId}
              AND rbac.entity = 'marketing'
              AND (rbac.entity_id = ${id} OR rbac.entity_id = 'all')
              AND rbac.active_flag = true
              AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
              AND 0 = ANY(rbac.permission)
          )
      `);

      if (result.length === 0) {
        return reply.status(404).send({ error: 'Message data not found' });
      }

      return result[0];
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to fetch message data' });
    }
  });

  // Send or schedule a message (create message instance)
  fastify.post('/api/v1/message-data', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateMessageDataSchema,
      response: {
        201: MessageDataResponseSchema,
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

      // Check if user has create permission
      const rbacCheck = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map
        WHERE empid = ${userId}
          AND entity = 'marketing'
          AND entity_id = 'all'
          AND active_flag = true
          AND (expires_ts IS NULL OR expires_ts > NOW())
          AND 4 = ANY(permission)
      `);

      if (rbacCheck.length === 0) {
        return reply.status(403).send({ error: 'Insufficient permissions to send messages' });
      }

      const data = request.body as any;

      // Fetch the message schema template
      const schemaResult = await db.execute(sql`
        SELECT * FROM app.d_message_schema
        WHERE id = ${data.message_schema_id}::uuid
          AND active_flag = true
      `);

      if (schemaResult.length === 0) {
        return reply.status(404).send({ error: 'Message schema not found' });
      }

      const schema = schemaResult[0] as any;

      // Determine status: scheduled if scheduled_ts provided, otherwise sent
      const status = data.scheduled_ts ? 'scheduled' : 'sent';
      const sent_ts = data.scheduled_ts ? null : new Date().toISOString();

      // Determine recipient fields based on delivery method
      const recipient_email = schema.message_delivery_method === 'EMAIL' ? data.content_data.recipient : data.recipient_email;
      const recipient_phone = schema.message_delivery_method === 'SMS' ? data.content_data.recipient : data.recipient_phone;
      const recipient_device_token = schema.message_delivery_method === 'PUSH' ? data.content_data.recipient : data.recipient_device_token;

      const result = await db.execute(sql`
        INSERT INTO app.f_message_data (
          message_schema_id,
          code,
          name,
          subject,
          descr,
          message_delivery_method,
          status,
          template_schema,
          content_data,
          preview_text,
          from_name,
          from_email,
          reply_to_email,
          sms_sender_id,
          push_priority,
          push_ttl,
          recipient_email,
          recipient_phone,
          recipient_device_token,
          recipient_name,
          recipient_entity_id,
          scheduled_ts,
          sent_ts,
          metadata
        ) VALUES (
          ${data.message_schema_id}::uuid,
          ${schema.code},
          ${schema.name},
          ${schema.subject},
          ${schema.descr},
          ${schema.message_delivery_method},
          ${status},
          ${JSON.stringify(schema.template_schema)}::jsonb,
          ${JSON.stringify(data.content_data)}::jsonb,
          ${schema.preview_text},
          ${schema.from_name},
          ${schema.from_email},
          ${schema.reply_to_email},
          ${schema.sms_sender_id},
          ${schema.push_priority},
          ${schema.push_ttl},
          ${recipient_email || null},
          ${recipient_phone || null},
          ${recipient_device_token || null},
          ${data.recipient_name || data.content_data.recipientName || null},
          ${data.recipient_entity_id ? `${data.recipient_entity_id}::uuid` : null},
          ${data.scheduled_ts || null},
          ${sent_ts},
          ${data.metadata ? JSON.stringify(data.metadata) : '{}'}::jsonb
        )
        RETURNING *
      `);

      reply.status(201);
      return result[0];
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to send message' });
    }
  });

  // Update message data (update delivery status, tracking info, etc.)
  fastify.put('/api/v1/message-data/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      body: UpdateMessageDataSchema,
      response: {
        200: MessageDataResponseSchema,
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
        SELECT 1 FROM app.entity_id_rbac_map
        WHERE empid = ${userId}
          AND entity = 'marketing'
          AND (entity_id = ${id} OR entity_id = 'all')
          AND active_flag = true
          AND (expires_ts IS NULL OR expires_ts > NOW())
          AND 1 = ANY(permission)
      `);

      if (rbacCheck.length === 0) {
        return reply.status(403).send({ error: 'Insufficient permissions to update message data' });
      }

      const data = request.body as any;
      const updates: any[] = [];

      if (data.status !== undefined) {
        updates.push(sql`status = ${data.status}`);
      }
      if (data.content_data !== undefined) {
        updates.push(sql`content_data = ${JSON.stringify(data.content_data)}::jsonb`);
      }
      if (data.sent_ts !== undefined) {
        updates.push(sql`sent_ts = ${data.sent_ts}`);
      }
      if (data.delivered_ts !== undefined) {
        updates.push(sql`delivered_ts = ${data.delivered_ts}`);
      }
      if (data.error_code !== undefined) {
        updates.push(sql`error_code = ${data.error_code}`);
      }
      if (data.error_message !== undefined) {
        updates.push(sql`error_message = ${data.error_message}`);
      }
      if (data.retry_count !== undefined) {
        updates.push(sql`retry_count = ${data.retry_count}`);
      }
      if (data.metadata !== undefined) {
        updates.push(sql`metadata = ${JSON.stringify(data.metadata)}::jsonb`);
      }

      if (updates.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updates.push(sql`updated_ts = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.f_message_data
        SET ${sql.join(updates, sql`, `)}
        WHERE id = ${id} AND active_flag = true
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(404).send({ error: 'Message data not found' });
      }

      return result[0];
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to update message data' });
    }
  });

  // Delete (soft delete) message data
  fastify.delete('/api/v1/message-data/:id', {
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
        SELECT 1 FROM app.entity_id_rbac_map
        WHERE empid = ${userId}
          AND entity = 'marketing'
          AND (entity_id = ${id} OR entity_id = 'all')
          AND active_flag = true
          AND (expires_ts IS NULL OR expires_ts > NOW())
          AND 3 = ANY(permission)
      `);

      if (rbacCheck.length === 0) {
        return reply.status(403).send({ error: 'Insufficient permissions to delete message data' });
      }

      const result = await db.execute(sql`
        UPDATE app.f_message_data
        SET active_flag = false, to_ts = NOW()
        WHERE id = ${id} AND active_flag = true
        RETURNING id
      `);

      if (result.length === 0) {
        return reply.status(404).send({ error: 'Message data not found' });
      }

      return { success: true, message: 'Message data deleted successfully' };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to delete message data' });
    }
  });
}
