import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { filterUniversalColumns } from '../../lib/universal-schema-metadata.js';
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';

const ServiceSchema = Type.Object({
  id: Type.String(),
  code: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
  service_category: Type.Optional(Type.String()),
  standard_rate_amt: Type.Optional(Type.Number()),
  estimated_hours: Type.Optional(Type.Number()),
  minimum_charge_amt: Type.Optional(Type.Number()),
  taxable_flag: Type.Optional(Type.Boolean()),
  requires_certification_flag: Type.Optional(Type.Boolean()),
  active_flag: Type.Optional(Type.Boolean()),
  created_ts: Type.Optional(Type.String()),
  updated_ts: Type.Optional(Type.String()),
  version: Type.Optional(Type.Number()),
});

const CreateServiceSchema = Type.Object({
  code: Type.Optional(Type.String({ minLength: 1 })),
  name: Type.Optional(Type.String({ minLength: 1 })),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
  service_category: Type.Optional(Type.String()),
  standard_rate_amt: Type.Optional(Type.Number()),
  estimated_hours: Type.Optional(Type.Number()),
  minimum_charge_amt: Type.Optional(Type.Number()),
  taxable_flag: Type.Optional(Type.Boolean()),
  requires_certification_flag: Type.Optional(Type.Boolean()),
  active_flag: Type.Optional(Type.Boolean()),
});

const UpdateServiceSchema = Type.Partial(CreateServiceSchema);

export async function serviceRoutes(fastify: FastifyInstance) {
  // List services
  fastify.get('/api/v1/service', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        active: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        service_category: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(ServiceSchema),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number(),
        }),
      },
    },
  }, async (request, reply) => {
    const { active, search, service_category, limit = 50, offset = 0 } = request.query as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      const baseConditions = [
        sql`EXISTS (
          SELECT 1 FROM app.entity_id_rbac_map rbac
          WHERE rbac.empid = ${userId}
            AND rbac.entity = 'service'
            AND (rbac.entity_id = s.id::text OR rbac.entity_id = 'all')
            AND rbac.active_flag = true
            AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
            AND 0 = ANY(rbac.permission)
        )`
      ];

      const conditions = [...baseConditions];

      if (active !== undefined) {
        conditions.push(sql`s.active_flag = ${active}`);
      }

      if (service_category) {
        conditions.push(sql`s.service_category = ${service_category}`);
      }

      if (search) {
        conditions.push(sql`(
          s.name ILIKE ${`%${search}%`} OR
          s.descr ILIKE ${`%${search}%`} OR
          s.code ILIKE ${`%${search}%`}
        )`);
      }

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.d_service s
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      const services = await db.execute(sql`
        SELECT *
        FROM app.d_service s
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY s.name ASC NULLS LAST
        LIMIT ${limit} OFFSET ${offset}
      `);

      return { data: services, total, limit, offset };
    } catch (error) {
      fastify.log.error('Error fetching services:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single service
  fastify.get('/api/v1/service/:id', {
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
      SELECT 1 FROM app.entity_id_rbac_map rbac
      WHERE rbac.empid = ${userId}
        AND rbac.entity = 'service'
        AND (rbac.entity_id = ${id}::text OR rbac.entity_id = 'all')
        AND rbac.active_flag = true
        AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
        AND 0 = ANY(rbac.permission)
    `);

    if (access.length === 0) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const service = await db.execute(sql`
        SELECT * FROM app.d_service WHERE id = ${id}
      `);

      if (service.length === 0) {
        return reply.status(404).send({ error: 'Service not found' });
      }

      return service[0];
    } catch (error) {
      fastify.log.error('Error fetching service:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create service
  fastify.post('/api/v1/service', {
    preHandler: [fastify.authenticate],
    schema: { body: CreateServiceSchema },
  }, async (request, reply) => {
    const data = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    if (!data.name) data.name = 'Untitled';
    if (!data.code) data.code = `SVC-${Date.now()}`;

    const access = await db.execute(sql`
      SELECT 1 FROM app.entity_id_rbac_map rbac
      WHERE rbac.empid = ${userId}
        AND rbac.entity = 'service'
        AND rbac.entity_id = 'all'
        AND rbac.active_flag = true
        AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
        AND 4 = ANY(rbac.permission)
    `);

    if (access.length === 0) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const result = await db.execute(sql`
        INSERT INTO app.d_service (
          code, name, descr, metadata,
          service_category, standard_rate_amt, estimated_hours,
          minimum_charge_amt, taxable_flag, requires_certification_flag,
          active_flag
        )
        VALUES (
          ${data.code}, ${data.name}, ${data.descr || null},
          ${data.metadata ? JSON.stringify(data.metadata) : '{}'}::jsonb,
          ${data.service_category || null}, ${data.standard_rate_amt || null},
          ${data.estimated_hours || null}, ${data.minimum_charge_amt || null},
          ${data.taxable_flag !== false}, ${data.requires_certification_flag || false},
          true
        )
        RETURNING *
      `);

      const newService = result[0] as any;

      await db.execute(sql`
        INSERT INTO app.d_entity_instance_id (entity_type, entity_id, entity_name, entity_code)
        VALUES ('service', ${newService.id}::uuid, ${newService.name}, ${newService.code})
        ON CONFLICT (entity_type, entity_id) DO UPDATE
        SET entity_name = EXCLUDED.entity_name, entity_code = EXCLUDED.entity_code, updated_ts = NOW()
      `);

      return reply.status(201).send(filterUniversalColumns(newService, {
        canSeePII: true, canSeeFinancial: true, canSeeSystemFields: true, canSeeSafetyInfo: true
      }));
    } catch (error) {
      fastify.log.error('Error creating service:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update service
  fastify.put('/api/v1/service/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      body: UpdateServiceSchema,
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    const access = await db.execute(sql`
      SELECT 1 FROM app.entity_id_rbac_map rbac
      WHERE rbac.empid = ${userId}
        AND rbac.entity = 'service'
        AND (rbac.entity_id = ${id}::text OR rbac.entity_id = 'all')
        AND rbac.active_flag = true
        AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
        AND 1 = ANY(rbac.permission)
    `);

    if (access.length === 0) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const existing = await db.execute(sql`SELECT id FROM app.d_service WHERE id = ${id}`);
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Service not found' });
      }

      const updateFields = [];
      if (data.name !== undefined) updateFields.push(sql`name = ${data.name}`);
      if (data.descr !== undefined) updateFields.push(sql`descr = ${data.descr}`);
      if (data.code !== undefined) updateFields.push(sql`code = ${data.code}`);
      if (data.metadata !== undefined) updateFields.push(sql`metadata = ${JSON.stringify(data.metadata)}::jsonb`);
      if (data.service_category !== undefined) updateFields.push(sql`service_category = ${data.service_category}`);
      if (data.standard_rate_amt !== undefined) updateFields.push(sql`standard_rate_amt = ${data.standard_rate_amt}`);
      if (data.estimated_hours !== undefined) updateFields.push(sql`estimated_hours = ${data.estimated_hours}`);
      if (data.minimum_charge_amt !== undefined) updateFields.push(sql`minimum_charge_amt = ${data.minimum_charge_amt}`);
      if (data.taxable_flag !== undefined) updateFields.push(sql`taxable_flag = ${data.taxable_flag}`);
      if (data.requires_certification_flag !== undefined) updateFields.push(sql`requires_certification_flag = ${data.requires_certification_flag}`);
      if (data.active_flag !== undefined) updateFields.push(sql`active_flag = ${data.active_flag}`);

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated_ts = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.d_service
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      return filterUniversalColumns(result[0], {
        canSeePII: true, canSeeFinancial: true, canSeeSystemFields: true, canSeeSafetyInfo: true
      });
    } catch (error) {
      fastify.log.error('Error updating service:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete service
  createEntityDeleteEndpoint(fastify, 'service');
}
