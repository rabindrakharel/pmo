import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql, SQL } from 'drizzle-orm';
import { filterUniversalColumns, createPaginatedResponse } from '../../lib/universal-schema-metadata.js';
// ✅ Centralized unified data gate - loosely coupled API
// ✨ Entity Infrastructure Service - centralized infrastructure operations
import { getEntityInfrastructure } from '../../services/entity-infrastructure.service.js';
// ✨ Universal auto-filter builder - zero-config query filtering
import { buildAutoFilters } from '../../lib/universal-filter-builder.js';
// ✅ Delete factory for cascading soft deletes
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';

// ============================================================================
// Module-level constants (DRY - used across all endpoints)
// ============================================================================
const ENTITY_CODE = 'service';
const TABLE_ALIAS = 's';

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
  // ✨ Initialize Entity Infrastructure Service
  const entityInfra = getEntityInfrastructure(db);

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
        page: Type.Optional(Type.Number({ minimum: 1 })),
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
    const { limit = 20, offset: queryOffset, page } = request.query as any;
    const offset = page ? (page - 1) * limit : (queryOffset !== undefined ? queryOffset : 0);
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Build WHERE conditions array
      const conditions: SQL[] = [];

      // ✨ UNIFIED RBAC - Use centralized RBAC gate for permission filtering
      const rbacWhereClause = await entityInfra.get_entity_rbac_where_condition(userId, ENTITY_CODE, Permission.VIEW, TABLE_ALIAS
      );
      conditions.push(sql.raw(rbacWhereClause));

      // ✨ UNIVERSAL AUTO-FILTER SYSTEM
      // Automatically builds filters from ANY query parameter based on field naming conventions
      // Supports: ?service_category=X, ?active_flag=true, ?search=keyword, etc.
      const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query as any, {
        searchFields: ['name', 'code', 'descr']
      });
      conditions.push(...autoFilters);

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.service s
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      const services = await db.execute(sql`
        SELECT *
        FROM app.service s
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY s.name ASC NULLS LAST
        LIMIT ${limit} OFFSET ${offset}
      `);

      return createPaginatedResponse(services, total, limit, offset);
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

    try {
      // ✨ ENTITY INFRASTRUCTURE - Use centralized RBAC check
      const canView = await entityInfra.check_entity_rbac(userId, ENTITY_CODE, id, Permission.VIEW);
      if (!canView) {
        return reply.status(403).send({ error: 'Insufficient permissions' });
      }

      const service = await db.execute(sql`
        SELECT * FROM app.service WHERE id = ${id}
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
      SELECT 1 FROM app.entity_rbac rbac
      WHERE rbac.person_entity_name = 'employee' AND rbac.person_id = ${userId}
        AND rbac.entity_name = 'service'
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
        INSERT INTO app.service (
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
        INSERT INTO app.entity_instance (entity_type, entity_id, entity_name, entity_code)
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
      SELECT 1 FROM app.entity_rbac rbac
      WHERE rbac.person_entity_name = 'employee' AND rbac.person_id = ${userId}
        AND rbac.entity_name = 'service'
        AND (rbac.entity_id = ${id}::text OR rbac.entity_id = '11111111-1111-1111-1111-111111111111'::uuid)
        AND rbac.active_flag = true
        AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
        AND rbac.permission >= 1
    `);

    if (access.length === 0) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const existing = await db.execute(sql`SELECT id FROM app.service WHERE id = ${id}`);
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
        UPDATE app.service
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

  // ============================================================================
  // ✨ FACTORY-GENERATED ENDPOINTS
  // ============================================================================

  // ✨ Factory-generated DELETE endpoint
  // Provides cascading soft delete for service and linked entities
  createEntityDeleteEndpoint(fastify, ENTITY_CODE);
}
