import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import {
  getUniversalColumnMetadata,
  filterUniversalColumns,
  getColumnsByMetadata
} from '../../lib/universal-schema-metadata.js';

// Schema based on d_worksite table structure
const WorksiteSchema = Type.Object({
  id: Type.String(),
  // Standard fields
  code: Type.Optional(Type.String()),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.String()),
  active_flag: Type.Boolean(),
  created_ts: Type.String(),
  updated_ts: Type.String(),
  version: Type.Number(),

  // Entity metadata
  metadata: Type.Optional(Type.Object({})),

  // Worksite-specific fields
  worksite_type: Type.String(),

  // Location and organizational context
  addr: Type.Optional(Type.String()),
  postal_code: Type.Optional(Type.String()),
  latitude: Type.Optional(Type.Number()),
  longitude: Type.Optional(Type.Number()),
  time_zone: Type.Optional(Type.String()),

  // Operational attributes
  capacity_workers: Type.Optional(Type.Number()),
  equipment_storage: Type.Optional(Type.Boolean()),
  vehicle_parking: Type.Optional(Type.Number()),
  security_required: Type.Optional(Type.Boolean()),

  // Facility specifications
  indoor_space_sqft: Type.Optional(Type.Number()),
  outdoor_space_sqft: Type.Optional(Type.Number()),
  office_space: Type.Optional(Type.Boolean()),
  washroom_facilities: Type.Optional(Type.Boolean()),
  power_available: Type.Optional(Type.Boolean()),
  water_available: Type.Optional(Type.Boolean()),

  // Safety and compliance
  safety_rating: Type.Optional(Type.String()),
  safety_last_inspection_date: Type.Optional(Type.String()),
  environmental_permits: Type.Optional(Type.Array(Type.String())),

  // Seasonal operations
  seasonal_use: Type.Optional(Type.Boolean()),
  seasonal_period: Type.Optional(Type.String()),

  // Management and emergency
  emergency_contact: Type.Optional(Type.Object({})),
});

const CreateWorksiteSchema = Type.Object({
  code: Type.Optional(Type.String()),
  name: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Object({})),
  worksite_type: Type.String(),
  addr: Type.Optional(Type.String()),
  postal_code: Type.Optional(Type.String()),
  latitude: Type.Optional(Type.Number()),
  longitude: Type.Optional(Type.Number()),
  time_zone: Type.Optional(Type.String()),
  capacity_workers: Type.Optional(Type.Number()),
  equipment_storage: Type.Optional(Type.Boolean()),
  vehicle_parking: Type.Optional(Type.Number()),
  security_required: Type.Optional(Type.Boolean()),
  indoor_space_sqft: Type.Optional(Type.Number()),
  outdoor_space_sqft: Type.Optional(Type.Number()),
  office_space: Type.Optional(Type.Boolean()),
  washroom_facilities: Type.Optional(Type.Boolean()),
  power_available: Type.Optional(Type.Boolean()),
  water_available: Type.Optional(Type.Boolean()),
  safety_rating: Type.Optional(Type.String()),
  safety_last_inspection_date: Type.Optional(Type.String({ format: 'date' })),
  environmental_permits: Type.Optional(Type.Array(Type.String())),
  seasonal_use: Type.Optional(Type.Boolean()),
  seasonal_period: Type.Optional(Type.String()),
  emergency_contact: Type.Optional(Type.Object({})),
});

const UpdateWorksiteSchema = Type.Partial(CreateWorksiteSchema);

export async function worksiteRoutes(fastify: FastifyInstance) {
  // List worksites
  fastify.get('/api/v1/worksite', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        active: Type.Optional(Type.Boolean()),
        worksite_type: Type.Optional(Type.String()),
        seasonal_use: Type.Optional(Type.Boolean()),
        equipment_storage: Type.Optional(Type.Boolean()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
        search: Type.Optional(Type.String()),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(WorksiteSchema),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number(),
        }),
        401: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const {
        active = true,
        worksite_type,
        seasonal_use,
        equipment_storage,
        limit = 20,
        offset = 0,
        search
      } = request.query as any;

      // Build where conditions
      const conditions = [];
      if (active !== undefined) {
        conditions.push(sql`active_flag = ${active}`);
      }
      if (worksite_type) {
        conditions.push(sql`worksite_type = ${worksite_type}`);
      }
      if (seasonal_use !== undefined) {
        conditions.push(sql`seasonal_use = ${seasonal_use}`);
      }
      if (equipment_storage !== undefined) {
        conditions.push(sql`equipment_storage = ${equipment_storage}`);
      }
      if (search) {
        conditions.push(sql`(name ILIKE ${'%' + search + '%'} OR descr ILIKE ${'%' + search + '%'} OR addr ILIKE ${'%' + search + '%'})`);
      }

      // Get total count
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.d_worksite
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      const worksites = await db.execute(sql`
        SELECT
          id, code, name, "descr", from_ts, to_ts, active_flag,
          created_ts, updated_ts, version, metadata, worksite_type, addr,
          postal_code, latitude, longitude, time_zone, capacity_workers,
          equipment_storage, vehicle_parking, security_required,
          indoor_space_sqft, outdoor_space_sqft, office_space,
          washroom_facilities, power_available, water_available,
          safety_rating, safety_last_inspection_date, environmental_permits,
          seasonal_use, seasonal_period, emergency_contact
        FROM app.d_worksite
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY name ASC NULLS LAST, created_ts DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return {
        data: worksites,
        total,
        limit,
        offset,
      };
    } catch (error) {
      fastify.log.error({ error, stack: (error as Error).stack }, 'Error fetching worksites');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single worksite
  fastify.get('/api/v1/worksite/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      response: {
        200: WorksiteSchema,
        404: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const worksite = await db.execute(sql`
        SELECT
          id, code, name, "descr", from_ts, to_ts, active_flag,
          created_ts, updated_ts, version, metadata, worksite_type, addr,
          postal_code, latitude, longitude, time_zone, capacity_workers,
          equipment_storage, vehicle_parking, security_required,
          indoor_space_sqft, outdoor_space_sqft, office_space,
          washroom_facilities, power_available, water_available,
          safety_rating, safety_last_inspection, environmental_permits,
          seasonal_use, seasonal_period, emergency_contact
        FROM app.d_worksite
        WHERE id = ${id}
      `);

      if (worksite.length === 0) {
        return reply.status(404).send({ error: 'Worksite not found' });
      }

      return worksite[0];
    } catch (error) {
      fastify.log.error('Error fetching worksite:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create worksite
  fastify.post('/api/v1/worksite', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateWorksiteSchema,
      response: {
        201: WorksiteSchema,
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const data = request.body as any;

    try {
      const result = await db.execute(sql`
        INSERT INTO app.d_worksite (
          code, name, "descr", metadata, worksite_type, addr,
          postal_code, latitude, longitude, time_zone, capacity_workers,
          equipment_storage_flag, vehicle_parking, security_required_flag,
          indoor_space_sqft, outdoor_space_sqft, office_space_flag,
          washroom_facilities_flag, power_available_flag, water_available_flag,
          safety_rating, safety_last_inspection_date, environmental_permits,
          seasonal_use_flag, seasonal_period, emergency_contact
        )
        VALUES (
          ${data.code || null},
          ${data.name},
          ${data.descr || null},
          ${JSON.stringify(data.metadata || {})}::jsonb,
          ${data.worksite_type || 'project'},
          ${data.addr || null},
          ${data.postal_code || null},
          ${data.latitude || null},
          ${data.longitude || null},
          ${data.time_zone || 'America/Toronto'},
          ${data.capacity_workers || null},
          ${data.equipment_storage || false},
          ${data.vehicle_parking || null},
          ${data.security_required || false},
          ${data.indoor_space_sqft || null},
          ${data.outdoor_space_sqft || null},
          ${data.office_space || false},
          ${data.washroom_facilities || false},
          ${data.power_available || false},
          ${data.water_available || false},
          ${data.safety_rating || null},
          ${data.safety_last_inspection || null},
          ${JSON.stringify(data.environmental_permits || [])},
          ${data.seasonal_use || false},
          ${data.seasonal_period || null},
          ${JSON.stringify(data.emergency_contact || {})}
        )
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to create worksite' });
      }

      reply.status(201);
      return result[0];
    } catch (error) {
      fastify.log.error('Error creating worksite:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update worksite
  fastify.put('/api/v1/worksite/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      body: UpdateWorksiteSchema,
      response: {
        200: WorksiteSchema,
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;

    try {
      // Check if worksite exists
      const existing = await db.execute(sql`
        SELECT id FROM app.d_worksite WHERE id = ${id}
      `);

      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Worksite not found' });
      }

      // Build update fields
      const updateFields = [];
      if (data.code !== undefined) updateFields.push(sql`code = ${data.code}`);
      if (data.name !== undefined) updateFields.push(sql`name = ${data.name}`);
      if (data.descr !== undefined) updateFields.push(sql`"descr" = ${data.descr}`);
      if (data.metadata !== undefined) updateFields.push(sql`metadata = ${JSON.stringify(data.metadata)}::jsonb`);
      if (data.worksite_type !== undefined) updateFields.push(sql`worksite_type = ${data.worksite_type}`);
      if (data.addr !== undefined) updateFields.push(sql`addr = ${data.addr}`);
      if (data.postal_code !== undefined) updateFields.push(sql`postal_code = ${data.postal_code}`);
      if (data.latitude !== undefined) updateFields.push(sql`latitude = ${data.latitude}`);
      if (data.longitude !== undefined) updateFields.push(sql`longitude = ${data.longitude}`);
      if (data.time_zone !== undefined) updateFields.push(sql`time_zone = ${data.time_zone}`);
      if (data.capacity_workers !== undefined) updateFields.push(sql`capacity_workers = ${data.capacity_workers}`);
      if (data.equipment_storage !== undefined) updateFields.push(sql`equipment_storage = ${data.equipment_storage}`);
      if (data.vehicle_parking !== undefined) updateFields.push(sql`vehicle_parking = ${data.vehicle_parking}`);
      if (data.security_required !== undefined) updateFields.push(sql`security_required = ${data.security_required}`);
      if (data.indoor_space_sqft !== undefined) updateFields.push(sql`indoor_space_sqft = ${data.indoor_space_sqft}`);
      if (data.outdoor_space_sqft !== undefined) updateFields.push(sql`outdoor_space_sqft = ${data.outdoor_space_sqft}`);
      if (data.office_space !== undefined) updateFields.push(sql`office_space = ${data.office_space}`);
      if (data.washroom_facilities !== undefined) updateFields.push(sql`washroom_facilities = ${data.washroom_facilities}`);
      if (data.power_available !== undefined) updateFields.push(sql`power_available = ${data.power_available}`);
      if (data.water_available !== undefined) updateFields.push(sql`water_available = ${data.water_available}`);
      if (data.safety_rating !== undefined) updateFields.push(sql`safety_rating = ${data.safety_rating}`);
      if (data.safety_last_inspection !== undefined) updateFields.push(sql`safety_last_inspection = ${data.safety_last_inspection}`);
      if (data.environmental_permits !== undefined) updateFields.push(sql`environmental_permits = ${JSON.stringify(data.environmental_permits)}`);
      if (data.seasonal_use !== undefined) updateFields.push(sql`seasonal_use = ${data.seasonal_use}`);
      if (data.seasonal_period !== undefined) updateFields.push(sql`seasonal_period = ${data.seasonal_period}`);
      if (data.emergency_contact !== undefined) updateFields.push(sql`emergency_contact = ${JSON.stringify(data.emergency_contact)}`);

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated_ts = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.d_worksite
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to update worksite' });
      }

      return result[0];
    } catch (error) {
      fastify.log.error('Error updating worksite:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete (soft delete) worksite
  fastify.delete('/api/v1/worksite/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      response: {
        204: Type.Object({}),
        401: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      // Check if worksite exists
      const existing = await db.execute(sql`
        SELECT id FROM app.d_worksite WHERE id = ${id}
      `);

      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Worksite not found' });
      }

      // Soft delete (using SCD Type 2 pattern)
      await db.execute(sql`
        UPDATE app.d_worksite
        SET active_flag = false, to_ts = NOW(), updated_ts = NOW()
        WHERE id = ${id}
      `);

      return reply.status(204).send();
    } catch (error) {
      fastify.log.error('Error deleting worksite:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}