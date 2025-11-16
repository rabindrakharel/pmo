import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { filterUniversalColumns, createPaginatedResponse } from '../../lib/universal-schema-metadata.js';
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';

const WorkOrderSchema = Type.Object({
  id: Type.String(),
  code: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
  dl__work_order_status: Type.Optional(Type.String()),
  scheduled_date: Type.Optional(Type.String()),
  started_ts: Type.Optional(Type.String()),
  completed_ts: Type.Optional(Type.String()),
  labor_hours: Type.Optional(Type.Number()),
  labor_cost_amt: Type.Optional(Type.Number()),
  materials_cost_amt: Type.Optional(Type.Number()),
  total_cost_amt: Type.Optional(Type.Number()),
  customer_name: Type.Optional(Type.String()),
  customer_signature_flag: Type.Optional(Type.Boolean()),
  active_flag: Type.Optional(Type.Boolean()),
  created_ts: Type.Optional(Type.String()),
  updated_ts: Type.Optional(Type.String()),
});

const CreateWorkOrderSchema = Type.Partial(Type.Object({
  code: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
  descr: Type.String(),
  metadata: Type.Any(),
  dl__work_order_status: Type.String(),
  scheduled_date: Type.String({ format: 'date' }),
  scheduled_start_time: Type.String(),
  scheduled_end_time: Type.String(),
  assigned_technician_name: Type.String(),
  labor_hours: Type.Number(),
  labor_cost_amt: Type.Number(),
  materials_cost_amt: Type.Number(),
  total_cost_amt: Type.Number(),
  customer_name: Type.String(),
  customer_email: Type.String(),
  customer_phone: Type.String(),
  service_address_line1: Type.String(),
  service_city: Type.String(),
  service_postal_code: Type.String(),
  customer_signature_flag: Type.Boolean(),
  customer_satisfaction_rating: Type.Number(),
  completion_notes: Type.String(),
  internal_notes: Type.String(),
}));

const UpdateWorkOrderSchema = Type.Partial(CreateWorkOrderSchema);

export async function workOrderRoutes(fastify: FastifyInstance) {
  // List work orders
  fastify.get('/api/v1/work_order', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        active: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        dl__work_order_status: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(WorkOrderSchema),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number(),
        }),
      },
    },
  }, async (request, reply) => {
    const { active, search, dl__work_order_status, limit = 50, offset = 0 } = request.query as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      const baseConditions = [
        sql`EXISTS (
          SELECT 1 FROM app.d_entity_rbac rbac
          WHERE rbac.person_entity_name = 'employee' AND rbac.person_entity_id = ${userId}
            AND rbac.entity_name = 'work_order'
            AND (rbac.entity_id = w.id OR rbac.entity_id = '11111111-1111-1111-1111-111111111111'::uuid)
            AND rbac.active_flag = true
            AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
            AND rbac.permission >= 0
        )`
      ];

      const conditions = [...baseConditions];

      if (active !== undefined) {
        conditions.push(sql`w.active_flag = ${active}`);
      }

      if (dl__work_order_status) {
        conditions.push(sql`w.dl__work_order_status = ${dl__work_order_status}`);
      }

      if (search) {
        conditions.push(sql`(
          w.name ILIKE ${`%${search}%`} OR
          w.descr ILIKE ${`%${search}%`} OR
          w.code ILIKE ${`%${search}%`} OR
          w.customer_name ILIKE ${`%${search}%`}
        )`);
      }

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.fact_work_order w
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      const workOrders = await db.execute(sql`
        SELECT *
        FROM app.fact_work_order w
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY w.scheduled_date DESC NULLS LAST, w.created_ts DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return createPaginatedResponse(workOrders, total, limit, offset);
    } catch (error) {
      fastify.log.error('Error fetching work orders:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single work order
  fastify.get('/api/v1/work_order/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    const access = await db.execute(sql`
      SELECT 1 FROM app.d_entity_rbac rbac
      WHERE rbac.person_entity_name = 'employee' AND rbac.person_entity_id = ${userId}
        AND rbac.entity_name = 'work_order'
        AND (rbac.entity_id = ${id}::text OR rbac.entity_id = '11111111-1111-1111-1111-111111111111'::uuid)
        AND rbac.active_flag = true
        AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
        AND rbac.permission >= 0
    `);

    if (access.length === 0) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const workOrder = await db.execute(sql`
        SELECT * FROM app.fact_work_order WHERE id = ${id}
      `);

      if (workOrder.length === 0) {
        return reply.status(404).send({ error: 'Work order not found' });
      }

      return workOrder[0];
    } catch (error) {
      fastify.log.error('Error fetching work order:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create work order
  fastify.post('/api/v1/work_order', {
    preHandler: [fastify.authenticate],
    schema: { body: CreateWorkOrderSchema },
  }, async (request, reply) => {
    const data = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    if (!data.name) data.name = 'Untitled';
    if (!data.code) data.code = `WO-${Date.now()}`;

    const access = await db.execute(sql`
      SELECT 1 FROM app.d_entity_rbac rbac
      WHERE rbac.person_entity_name = 'employee' AND rbac.person_entity_id = ${userId}
        AND rbac.entity_name = 'work_order'
        AND rbac.entity_id = '11111111-1111-1111-1111-111111111111'::uuid
        AND rbac.active_flag = true
        AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
        AND rbac.permission >= 4
    `);

    if (access.length === 0) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
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

      await db.execute(sql`
        INSERT INTO app.d_entity_instance_registry (entity_type, entity_id, entity_name, entity_code)
        VALUES ('work_order', ${newWorkOrder.id}::uuid, ${newWorkOrder.name}, ${newWorkOrder.code})
        ON CONFLICT (entity_type, entity_id) DO UPDATE
        SET entity_name = EXCLUDED.entity_name, entity_code = EXCLUDED.entity_code, updated_ts = NOW()
      `);

      return reply.status(201).send(filterUniversalColumns(newWorkOrder, {
        canSeePII: true, canSeeFinancial: true, canSeeSystemFields: true, canSeeSafetyInfo: true
      }));
    } catch (error) {
      fastify.log.error('Error creating work order:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update work order
  fastify.put('/api/v1/work_order/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      body: UpdateWorkOrderSchema,
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    const access = await db.execute(sql`
      SELECT 1 FROM app.d_entity_rbac rbac
      WHERE rbac.person_entity_name = 'employee' AND rbac.person_entity_id = ${userId}
        AND rbac.entity_name = 'work_order'
        AND (rbac.entity_id = ${id}::text OR rbac.entity_id = '11111111-1111-1111-1111-111111111111'::uuid)
        AND rbac.active_flag = true
        AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
        AND rbac.permission >= 1
    `);

    if (access.length === 0) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const existing = await db.execute(sql`SELECT id FROM app.fact_work_order WHERE id = ${id}`);
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Work order not found' });
      }

      const updateFields = [];
      if (data.name !== undefined) updateFields.push(sql`name = ${data.name}`);
      if (data.descr !== undefined) updateFields.push(sql`descr = ${data.descr}`);
      if (data.code !== undefined) updateFields.push(sql`code = ${data.code}`);
      if (data.metadata !== undefined) updateFields.push(sql`metadata = ${JSON.stringify(data.metadata)}::jsonb`);
      if (data.dl__work_order_status !== undefined) updateFields.push(sql`dl__work_order_status = ${data.dl__work_order_status}`);
      if (data.scheduled_date !== undefined) updateFields.push(sql`scheduled_date = ${data.scheduled_date}`);
      if (data.labor_hours !== undefined) updateFields.push(sql`labor_hours = ${data.labor_hours}`);
      if (data.labor_cost_amt !== undefined) updateFields.push(sql`labor_cost_amt = ${data.labor_cost_amt}`);
      if (data.materials_cost_amt !== undefined) updateFields.push(sql`materials_cost_amt = ${data.materials_cost_amt}`);
      if (data.total_cost_amt !== undefined) updateFields.push(sql`total_cost_amt = ${data.total_cost_amt}`);
      if (data.customer_name !== undefined) updateFields.push(sql`customer_name = ${data.customer_name}`);
      if (data.customer_signature_flag !== undefined) updateFields.push(sql`customer_signature_flag = ${data.customer_signature_flag}`);
      if (data.customer_satisfaction_rating !== undefined) updateFields.push(sql`customer_satisfaction_rating = ${data.customer_satisfaction_rating}`);
      if (data.completion_notes !== undefined) updateFields.push(sql`completion_notes = ${data.completion_notes}`);

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated_ts = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.fact_work_order
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      return filterUniversalColumns(result[0], {
        canSeePII: true, canSeeFinancial: true, canSeeSystemFields: true, canSeeSafetyInfo: true
      });
    } catch (error) {
      fastify.log.error('Error updating work order:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete work order
  createEntityDeleteEndpoint(fastify, 'work_order');
}
