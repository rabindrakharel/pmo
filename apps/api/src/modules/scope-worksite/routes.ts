import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { hasPermissionOnScopeId } from '../rbac/ui-api-permission-rbac-gate.js';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

const WorksiteSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  worksiteCode: Type.Optional(Type.String()),
  worksiteType: Type.Optional(Type.String()),
  operationalStatus: Type.Optional(Type.String()),
  locId: Type.Optional(Type.String()),
  bizId: Type.Optional(Type.String()),
  physicalAddr: Type.Optional(Type.String()),
  postalCode: Type.Optional(Type.String()),
  floorSpaceSqm: Type.Optional(Type.Number()),
  capacityEmployees: Type.Optional(Type.Number()),
  parkingSpaces: Type.Optional(Type.Number()),
  securityLevel: Type.Optional(Type.String()),
  contactInfo: Type.Optional(Type.Object({})),
  facilityAmenities: Type.Optional(Type.Array(Type.String())),
  emergencyInfo: Type.Optional(Type.Object({})),
  healthSafetyCompliance: Type.Optional(Type.Object({})),
  environmentalCompliance: Type.Optional(Type.Object({})),
  fromTs: Type.String(),
  toTs: Type.Optional(Type.String()),
  active: Type.Boolean(),
  tags: Type.Optional(Type.Array(Type.String())),
  created: Type.String(),
  updated: Type.String(),
});

const CreateWorksiteSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  worksiteCode: Type.Optional(Type.String()),
  worksiteType: Type.Optional(Type.String()),
  operationalStatus: Type.Optional(Type.String()),
  locId: Type.Optional(Type.String({ format: 'uuid' })),
  bizId: Type.Optional(Type.String({ format: 'uuid' })),
  physicalAddr: Type.Optional(Type.String()),
  postalCode: Type.Optional(Type.String()),
  floorSpaceSqm: Type.Optional(Type.Number()),
  capacityEmployees: Type.Optional(Type.Number()),
  parkingSpaces: Type.Optional(Type.Number()),
  securityLevel: Type.Optional(Type.String()),
  contactInfo: Type.Optional(Type.Object({})),
  facilityAmenities: Type.Optional(Type.Array(Type.String())),
  emergencyInfo: Type.Optional(Type.Object({})),
  healthSafetyCompliance: Type.Optional(Type.Object({})),
  environmentalCompliance: Type.Optional(Type.Object({})),
  active: Type.Optional(Type.Boolean()),
  tags: Type.Optional(Type.Array(Type.String())),
  fromTs: Type.Optional(Type.String({ format: 'date-time' })),
});

const UpdateWorksiteSchema = Type.Partial(CreateWorksiteSchema);

export async function worksiteRoutes(fastify: FastifyInstance) {
  // List worksites with filtering
  fastify.get('/api/v1/worksite', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        locId: Type.Optional(Type.String()),
        bizId: Type.Optional(Type.String()),
        active: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(WorksiteSchema),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number(),
        }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { locId, bizId, active, search, limit = 50, offset = 0 } = request.query as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    };

    try {
      // Build query conditions
      const conditions = [];
      
      if (locId !== undefined) {
        conditions.push(sql`loc_id = ${locId}`);
      }
      
      if (bizId !== undefined) {
        conditions.push(sql`biz_id = ${bizId}`);
      }
      
      if (active !== undefined) {
        conditions.push(sql`active = ${active}`);
      }
      
      if (search) {
        conditions.push(sql`(
          COALESCE(name, '') ILIKE ${`%${search}%`} OR 
          COALESCE("descr", '') ILIKE ${`%${search}%`} OR
          COALESCE(worksite_code, '') ILIKE ${`%${search}%`} OR
          COALESCE(physical_addr, '') ILIKE ${`%${search}%`}
        )`);
      }

      // Get total count
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total 
        FROM app.d_scope_worksite 
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      // Get paginated results
      const worksites = await db.execute(sql`
        SELECT 
          id, name, "descr", worksite_code as "worksiteCode",
          worksite_type as "worksiteType", operational_status as "operationalStatus",
          loc_id as "locId", biz_id as "bizId", physical_addr as "physicalAddr",
          postal_code as "postalCode", floor_space_sqm as "floorSpaceSqm",
          capacity_employees as "capacityEmployees", parking_spaces as "parkingSpaces",
          security_level as "securityLevel", contact_info as "contactInfo",
          facility_amenities as "facilityAmenities", emergency_info as "emergencyInfo",
          health_safety_compliance as "healthSafetyCompliance",
          environmental_compliance as "environmentalCompliance",
          from_ts as "fromTs", to_ts as "toTs", active, tags, created, updated
        FROM app.d_scope_worksite 
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY name ASC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return {
        data: worksites,
        total,
        limit,
        offset,
      };
    } catch (error) {
      fastify.log.error('Error fetching worksites:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single worksite
  fastify.get('/api/v1/worksite/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: WorksiteSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    };

    try {
      const worksite = await db.execute(sql`
        SELECT 
          id, name, "descr", worksite_code as "worksiteCode",
          worksite_type as "worksiteType", operational_status as "operationalStatus",
          loc_id as "locId", biz_id as "bizId", physical_addr as "physicalAddr",
          postal_code as "postalCode", floor_space_sqm as "floorSpaceSqm",
          capacity_employees as "capacityEmployees", parking_spaces as "parkingSpaces",
          security_level as "securityLevel", contact_info as "contactInfo",
          facility_amenities as "facilityAmenities", emergency_info as "emergencyInfo",
          health_safety_compliance as "healthSafetyCompliance",
          environmental_compliance as "environmentalCompliance",
          from_ts as "fromTs", to_ts as "toTs", active, tags, created, updated
        FROM app.d_scope_worksite 
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
        403: Type.Object({ error: Type.String() }),
        400: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const data = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    };


    try {
      // Validate location scope access if specified
      if (data.locId) {
        const locationAccess = await hasPermissionOnScopeId(userId, 'location', data.locId, 'view');
        if (!locationAccess) {
          return reply.status(403).send({ error: 'Insufficient location permissions' });
        }
        
        // Verify location exists
        const locationExists = await db.execute(sql`
          SELECT id FROM app.d_scope_location WHERE id = ${data.locId} AND active = true
        `);
        if (locationExists.length === 0) {
          return reply.status(400).send({ error: 'Referenced location does not exist' });
        }
      }

      // Validate business scope access if specified
      if (data.bizId) {
        const businessAccess = await hasPermissionOnScopeId(userId, 'business', data.bizId, 'view');
        if (!businessAccess) {
          return reply.status(403).send({ error: 'Insufficient business permissions' });
        }
        
        // Verify business unit exists
        const businessExists = await db.execute(sql`
          SELECT id FROM app.d_scope_business WHERE id = ${data.bizId} AND active = true
        `);
        if (businessExists.length === 0) {
          return reply.status(400).send({ error: 'Referenced business unit does not exist' });
        }
      }

      const fromTs = data.fromTs || new Date().toISOString();
      const result = await db.execute(sql`
        INSERT INTO app.d_scope_worksite (
          name, "descr", worksite_code, worksite_type, operational_status,
          loc_id, biz_id, physical_addr, postal_code, floor_space_sqm,
          capacity_employees, parking_spaces, security_level, contact_info,
          facility_amenities, emergency_info, health_safety_compliance,
          environmental_compliance, from_ts, active, tags
        )
        VALUES (
          ${data.name}, ${data.descr || null}, ${data.worksiteCode || null},
          ${data.worksiteType || 'office'}, ${data.operationalStatus || 'active'},
          ${data.locId || null}, ${data.bizId || null}, ${data.physicalAddr || null},
          ${data.postalCode || null}, ${data.floorSpaceSqm || null},
          ${data.capacityEmployees || null}, ${data.parkingSpaces || null},
          ${data.securityLevel || 'standard'}, 
          ${data.contactInfo ? JSON.stringify(data.contactInfo) : '{}'}::jsonb,
          ${data.facilityAmenities ? JSON.stringify(data.facilityAmenities) : '[]'}::jsonb,
          ${data.emergencyInfo ? JSON.stringify(data.emergencyInfo) : '{}'}::jsonb,
          ${data.healthSafetyCompliance ? JSON.stringify(data.healthSafetyCompliance) : '{}'}::jsonb,
          ${data.environmentalCompliance ? JSON.stringify(data.environmentalCompliance) : '{}'}::jsonb,
          ${fromTs}, ${data.active !== false}, ${data.tags ? JSON.stringify(data.tags) : '[]'}::jsonb
        )
        RETURNING 
          id, name, "descr", worksite_code as "worksiteCode",
          worksite_type as "worksiteType", operational_status as "operationalStatus",
          loc_id as "locId", biz_id as "bizId", physical_addr as "physicalAddr",
          postal_code as "postalCode", floor_space_sqm as "floorSpaceSqm",
          capacity_employees as "capacityEmployees", parking_spaces as "parkingSpaces",
          security_level as "securityLevel", contact_info as "contactInfo",
          facility_amenities as "facilityAmenities", emergency_info as "emergencyInfo",
          health_safety_compliance as "healthSafetyCompliance",
          environmental_compliance as "environmentalCompliance",
          from_ts as "fromTs", to_ts as "toTs", active, tags, created, updated
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to create worksite' });
      }

      return reply.status(201).send(result[0]);
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
        id: Type.String({ format: 'uuid' }),
      }),
      body: UpdateWorksiteSchema,
      response: {
        200: WorksiteSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        400: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    };


    try {
      // Check if worksite exists
      const existing = await db.execute(sql`
        SELECT id FROM app.d_scope_worksite WHERE id = ${id}
      `);
      
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Worksite not found' });
      }

      // Validate location scope access for updated fields
      if (data.locId) {
        const locationAccess = await hasPermissionOnScopeId(userId, 'location', data.locId, 'view');
        if (!locationAccess) {
          return reply.status(403).send({ error: 'Insufficient location permissions' });
        }
        
        const locationExists = await db.execute(sql`
          SELECT id FROM app.d_scope_location WHERE id = ${data.locId} AND active = true
        `);
        if (locationExists.length === 0) {
          return reply.status(400).send({ error: 'Referenced location does not exist' });
        }
      }

      // Validate business scope access for updated fields
      if (data.bizId) {
        const businessAccess = await hasPermissionOnScopeId(userId, 'business', data.bizId, 'view');
        if (!businessAccess) {
          return reply.status(403).send({ error: 'Insufficient business permissions' });
        }
        
        const businessExists = await db.execute(sql`
          SELECT id FROM app.d_scope_business WHERE id = ${data.bizId} AND active = true
        `);
        if (businessExists.length === 0) {
          return reply.status(400).send({ error: 'Referenced business unit does not exist' });
        }
      }

      // Build update fields
      const updateFields = [];
      
      if (data.name !== undefined) {
        updateFields.push(sql`name = ${data.name}`);
      }
      
      if (data.descr !== undefined) {
        updateFields.push(sql`"descr" = ${data.descr}`);
      }
      
      if (data.worksiteCode !== undefined) {
        updateFields.push(sql`worksite_code = ${data.worksiteCode}`);
      }
      
      if (data.worksiteType !== undefined) {
        updateFields.push(sql`worksite_type = ${data.worksiteType}`);
      }
      
      if (data.operationalStatus !== undefined) {
        updateFields.push(sql`operational_status = ${data.operationalStatus}`);
      }
      
      if (data.locId !== undefined) {
        updateFields.push(sql`loc_id = ${data.locId}`);
      }
      
      if (data.bizId !== undefined) {
        updateFields.push(sql`biz_id = ${data.bizId}`);
      }
      
      if (data.physicalAddr !== undefined) {
        updateFields.push(sql`physical_addr = ${data.physicalAddr}`);
      }
      
      if (data.postalCode !== undefined) {
        updateFields.push(sql`postal_code = ${data.postalCode}`);
      }
      
      if (data.floorSpaceSqm !== undefined) {
        updateFields.push(sql`floor_space_sqm = ${data.floorSpaceSqm}`);
      }
      
      if (data.capacityEmployees !== undefined) {
        updateFields.push(sql`capacity_employees = ${data.capacityEmployees}`);
      }
      
      if (data.parkingSpaces !== undefined) {
        updateFields.push(sql`parking_spaces = ${data.parkingSpaces}`);
      }
      
      if (data.securityLevel !== undefined) {
        updateFields.push(sql`security_level = ${data.securityLevel}`);
      }
      
      if (data.contactInfo !== undefined) {
        updateFields.push(sql`contact_info = ${data.contactInfo ? JSON.stringify(data.contactInfo) : '{}'}::jsonb`);
      }
      
      if (data.facilityAmenities !== undefined) {
        updateFields.push(sql`facility_amenities = ${data.facilityAmenities ? JSON.stringify(data.facilityAmenities) : '[]'}::jsonb`);
      }
      
      if (data.emergencyInfo !== undefined) {
        updateFields.push(sql`emergency_info = ${data.emergencyInfo ? JSON.stringify(data.emergencyInfo) : '{}'}::jsonb`);
      }
      
      if (data.healthSafetyCompliance !== undefined) {
        updateFields.push(sql`health_safety_compliance = ${data.healthSafetyCompliance ? JSON.stringify(data.healthSafetyCompliance) : '{}'}::jsonb`);
      }
      
      if (data.environmentalCompliance !== undefined) {
        updateFields.push(sql`environmental_compliance = ${data.environmentalCompliance ? JSON.stringify(data.environmentalCompliance) : '{}'}::jsonb`);
      }
      
      if (data.active !== undefined) {
        updateFields.push(sql`active = ${data.active}`);
      }
      
      if (data.tags !== undefined) {
        updateFields.push(sql`tags = ${data.tags ? JSON.stringify(data.tags) : '[]'}::jsonb`);
      }

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.d_scope_worksite 
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING 
          id, name, "descr", worksite_code as "worksiteCode",
          worksite_type as "worksiteType", operational_status as "operationalStatus",
          loc_id as "locId", biz_id as "bizId", physical_addr as "physicalAddr",
          postal_code as "postalCode", floor_space_sqm as "floorSpaceSqm",
          capacity_employees as "capacityEmployees", parking_spaces as "parkingSpaces",
          security_level as "securityLevel", contact_info as "contactInfo",
          facility_amenities as "facilityAmenities", emergency_info as "emergencyInfo",
          health_safety_compliance as "healthSafetyCompliance",
          environmental_compliance as "environmentalCompliance",
          from_ts as "fromTs", to_ts as "toTs", active, tags, created, updated
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

  // Delete worksite (soft delete)
  fastify.delete('/api/v1/worksite/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        204: Type.Null(),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    };


    try {
      // Check if worksite exists
      const existing = await db.execute(sql`
        SELECT id FROM app.d_scope_worksite WHERE id = ${id}
      `);
      
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Worksite not found' });
      }

      // Check if worksite has active projects
      const activeProjects = await db.execute(sql`
        SELECT COUNT(*) as count FROM app.ops_project_head 
        WHERE worksite_id = ${id} AND active = true
      `);
      
      if (Number(activeProjects[0]?.count || 0) > 0) {
        return reply.status(400).send({ error: 'Cannot delete worksite with active projects' });
      }

      // Soft delete
      await db.execute(sql`
        UPDATE app.d_scope_worksite 
        SET active = false, to_ts = NOW(), updated = NOW()
        WHERE id = ${id}
      `);

      return reply.status(204).send();
    } catch (error) {
      fastify.log.error('Error deleting worksite:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}