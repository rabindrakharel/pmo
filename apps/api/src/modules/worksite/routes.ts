import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql, SQL } from 'drizzle-orm';
import {
  getUniversalColumnMetadata,
  filterUniversalColumns,
  getColumnsByMetadata,
  createPaginatedResponse
} from '../../lib/universal-schema-metadata.js';
// ✅ Centralized unified data gate - loosely coupled API
// ✨ Entity Infrastructure Service - centralized infrastructure operations
import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID } from '../../services/entity-infrastructure.service.js';
// ✨ Universal auto-filter builder - zero-config query filtering
import { buildAutoFilters } from '../../lib/universal-filter-builder.js';
// ✨ Backend Formatter Service - component-aware metadata generation
import { generateEntityResponse, extractDatalabelKeys } from '../../services/backend-formatter.service.js';
// ✨ Datalabel Service - fetch datalabel options for dropdowns and DAG visualization
import { fetchDatalabels } from '../../services/datalabel.service.js';
// ✅ Delete factory for cascading soft deletes
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';
// ✅ Child entity factory for parent-child relationships
import { createChildEntityEndpointsFromMetadata } from '../../lib/child-entity-route-factory.js';

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
  worksite_type: Type.Optional(Type.String()),
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

// Response schema for metadata-driven endpoints (single entity)
const WorksiteWithMetadataSchema = Type.Object({
  data: WorksiteSchema,
  fields: Type.Array(Type.String()),  // Field names list
  metadata: Type.Any(),  // EntityMetadata - component-specific field metadata
  datalabels: Type.Array(Type.Any()),  // DatalabelData[] - options for dl__* fields (not optional!)
  globalSettings: Type.Any()  // GlobalSettings - currency, date, timestamp formatting
});

// ============================================================================
// Module-level constants (DRY - used across all endpoints)
// ============================================================================
const ENTITY_CODE = 'worksite';
const TABLE_ALIAS = 'w';

export async function worksiteRoutes(fastify: FastifyInstance) {
  // ✨ Initialize Entity Infrastructure Service
  const entityInfra = getEntityInfrastructure(db);

  // List worksites
  fastify.get('/api/v1/worksite', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        active: Type.Optional(Type.Boolean()),
        worksite_type: Type.Optional(Type.String()),
        seasonal_use: Type.Optional(Type.Boolean()),
        equipment_storage: Type.Optional(Type.Boolean()),
        page: Type.Optional(Type.Number({ minimum: 1 })),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
        search: Type.Optional(Type.String()),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(WorksiteSchema),
          fields: Type.Array(Type.String()),
          metadata: Type.Any(),
          datalabels: Type.Array(Type.Any()),
          globalSettings: Type.Any(),
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
        page = 1,
        limit = 20,
        search
      } = request.query as any;

      const offset = (page - 1) * limit;

      // Build where conditions
      const conditions = [];
      if (active !== undefined) {
        conditions.push(sql`active_flag = ${active}`);
      }
      if (worksite_type) {
        conditions.push(sql`worksite_type = ${worksite_type}`);
      }
      if (seasonal_use !== undefined) {
        conditions.push(sql`seasonal_use_flag = ${seasonal_use}`);
      }
      if (equipment_storage !== undefined) {
        conditions.push(sql`equipment_storage_flag = ${equipment_storage}`);
      }
      if (search) {
        conditions.push(sql`(name ILIKE ${'%' + search + '%'} OR descr ILIKE ${'%' + search + '%'} OR addr ILIKE ${'%' + search + '%'})`);
      }

      // ✅ DEFAULT FILTER: Only show active records (not soft-deleted)
      // Can be overridden with ?active=false to show inactive records
      if (!('active' in (request.query as any))) {
        conditions.push(sql`active_flag = true`);
      }

      // Get total count
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.worksite
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      const worksites = await db.execute(sql`
        SELECT
          id, code, name, "descr", from_ts, to_ts, active_flag,
          created_ts, updated_ts, version, metadata, worksite_type, addr,
          postal_code, latitude, longitude, time_zone, capacity_workers,
          equipment_storage_flag as equipment_storage, vehicle_parking, security_required_flag as security_required,
          indoor_space_sqft, outdoor_space_sqft, office_space_flag as office_space,
          washroom_facilities_flag as washroom_facilities, power_available_flag as power_available, water_available_flag as water_available,
          dl__worksite_safety_rating as safety_rating, safety_last_inspection_date, environmental_permits,
          seasonal_use_flag as seasonal_use, seasonal_period, emergency_contact
        FROM app.worksite
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY name ASC NULLS LAST, created_ts DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      // ✨ Generate component-aware metadata using Backend Formatter Service
      const response = generateEntityResponse(ENTITY_CODE, worksites);

      // ✅ Explicitly return all fields (Fastify strips fields not in schema)
      return {
        data: response.data,
        fields: response.fields,
        metadata: response.metadata,
        datalabels: response.datalabels,
        globalSettings: response.globalSettings,
        total,
        limit,
        offset
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
        200: WorksiteWithMetadataSchema,
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
          equipment_storage_flag as equipment_storage, vehicle_parking, security_required_flag as security_required,
          indoor_space_sqft, outdoor_space_sqft, office_space_flag as office_space,
          washroom_facilities_flag as washroom_facilities, power_available_flag as power_available, water_available_flag as water_available,
          dl__worksite_safety_rating as safety_rating, safety_last_inspection_date, environmental_permits,
          seasonal_use_flag as seasonal_use, seasonal_period, emergency_contact
        FROM app.worksite
        WHERE id = ${id}
      `);

      if (worksite.length === 0) {
        return reply.status(404).send({ error: 'Worksite not found' });
      }

      // ✨ Generate component-aware metadata using Backend Formatter Service
      const response = generateEntityResponse(ENTITY_CODE, worksite);

      // ✅ Explicitly return all fields (Fastify strips fields not in schema)
      return {
        data: response.data[0],
        fields: response.fields,
        metadata: response.metadata,
        datalabels: response.datalabels,
        globalSettings: response.globalSettings
      };
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
        INSERT INTO app.worksite (
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

  // Update worksite (PATCH)
  fastify.patch('/api/v1/worksite/:id', {
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
        SELECT id FROM app.worksite WHERE id = ${id}
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
      if (data.safety_last_inspection_date !== undefined) updateFields.push(sql`safety_last_inspection_date = ${data.safety_last_inspection_date}`);
      if (data.environmental_permits !== undefined) updateFields.push(sql`environmental_permits = ${JSON.stringify(data.environmental_permits)}`);
      if (data.seasonal_use !== undefined) updateFields.push(sql`seasonal_use = ${data.seasonal_use}`);
      if (data.seasonal_period !== undefined) updateFields.push(sql`seasonal_period = ${data.seasonal_period}`);
      if (data.emergency_contact !== undefined) updateFields.push(sql`emergency_contact = ${JSON.stringify(data.emergency_contact)}`);

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated_ts = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.worksite
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

  // Update worksite (PUT - alias for frontend compatibility)
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
        SELECT id FROM app.worksite WHERE id = ${id}
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
      if (data.safety_last_inspection_date !== undefined) updateFields.push(sql`safety_last_inspection_date = ${data.safety_last_inspection_date}`);
      if (data.environmental_permits !== undefined) updateFields.push(sql`environmental_permits = ${JSON.stringify(data.environmental_permits)}`);
      if (data.seasonal_use !== undefined) updateFields.push(sql`seasonal_use = ${data.seasonal_use}`);
      if (data.seasonal_period !== undefined) updateFields.push(sql`seasonal_period = ${data.seasonal_period}`);
      if (data.emergency_contact !== undefined) updateFields.push(sql`emergency_contact = ${JSON.stringify(data.emergency_contact)}`);

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated_ts = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.worksite
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

  // ============================================================================
  // DELETE Worksite (Soft Delete via Factory)
  // ============================================================================
  createEntityDeleteEndpoint(fastify, ENTITY_CODE);

  // ============================================================================
  // Child Entity Endpoints (Auto-Generated from entity metadata)
  // ============================================================================
  await createChildEntityEndpointsFromMetadata(fastify, ENTITY_CODE);
}