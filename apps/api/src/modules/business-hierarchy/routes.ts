import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '../../db/index.js';
import { sql, SQL } from 'drizzle-orm';
import {
  getUniversalColumnMetadata,
  filterUniversalColumns,
  getColumnsByMetadata,
  createPaginatedResponse
} from '../../lib/universal-schema-metadata.js';
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';
import { getEntityInfrastructure, Permission } from '../../services/entity-infrastructure.service.js';

// Business Hierarchy Schema (3-level: Corporate → Division → Department)
const BusinessHierarchySchema = Type.Object({
  id: Type.String(),
  code: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
  parent_id: Type.Optional(Type.String()),
  dl__business_hierarchy_level: Type.String(),
  manager__employee_id: Type.Optional(Type.String()),
  budget_allocated_amt: Type.Optional(Type.Number()),
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.String()),
  active_flag: Type.Boolean(),
  created_ts: Type.String(),
  updated_ts: Type.String(),
  version: Type.Number(),
});

const CreateBusinessHierarchySchema = Type.Object({
  code: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
  parent_id: Type.Optional(Type.String()),
  dl__business_hierarchy_level: Type.String({ minLength: 1 }),
  manager__employee_id: Type.Optional(Type.String()),
  budget_allocated_amt: Type.Optional(Type.Number()),
  active_flag: Type.Optional(Type.Boolean()),
});

const UpdateBusinessHierarchySchema = Type.Partial(CreateBusinessHierarchySchema);

export async function businessHierarchyRoutes(fastify: FastifyInstance) {
  // List business hierarchy nodes
  fastify.get('/api/v1/business-hierarchy', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        active_flag: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        dl__business_hierarchy_level: Type.Optional(Type.String()),
        parent_id: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
        page: Type.Optional(Type.Number({ minimum: 1 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(BusinessHierarchySchema),
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
      active_flag, search, dl__business_hierarchy_level, parent_id,
      limit = 20, offset: queryOffset, page
    } = request.query as any;
    const offset = page ? (page - 1) * limit : (queryOffset !== undefined ? queryOffset : 0);

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // ═══════════════════════════════════════════════════════════════
      // ✅ ENTITY INFRASTRUCTURE SERVICE - RBAC filtering
      // ═══════════════════════════════════════════════════════════════
      const entityInfra = getEntityInfrastructure(db);
      const rbacWhereClause = await entityInfra.get_entity_rbac_where_condition(
        userId,
        'business_hierarchy',
        Permission.VIEW,
        'bh'
      );

      const conditions: SQL[] = [rbacWhereClause];

      if (active_flag !== undefined) {
        conditions.push(sql`bh.active_flag = ${active_flag}`);
      }

      if (dl__business_hierarchy_level) {
        conditions.push(sql`bh.dl__business_hierarchy_level = ${dl__business_hierarchy_level}`);
      }

      if (parent_id) {
        if (parent_id === 'null' || parent_id === '') {
          conditions.push(sql`bh.parent_id IS NULL`);
        } else {
          conditions.push(sql`bh.parent_id = ${parent_id}::uuid`);
        }
      }

      if (search) {
        const searchConditions = [
          sql`COALESCE(bh.name, '') ILIKE ${`%${search}%`}`,
          sql`COALESCE(bh."descr", '') ILIKE ${`%${search}%`}`,
          sql`COALESCE(bh.code, '') ILIKE ${`%${search}%`}`
        ];
        conditions.push(sql`(${sql.join(searchConditions, sql` OR `)})`);
      }

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.d_business_hierarchy bh
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      const nodes = await db.execute(sql`
        SELECT
          bh.id, bh.code, bh.name, bh."descr", bh.metadata,
          bh.parent_id, bh.dl__business_hierarchy_level,
          bh.manager__employee_id, bh.budget_allocated_amt,
          bh.from_ts, bh.to_ts, bh.active_flag, bh.created_ts, bh.updated_ts, bh.version,
          emp.name as manager_name,
          parent.name as parent_name
        FROM app.d_business_hierarchy bh
        LEFT JOIN app.employee emp ON bh.manager__employee_id = emp.id
        LEFT JOIN app.d_business_hierarchy parent ON bh.parent_id = parent.id
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY bh.dl__business_hierarchy_level ASC, bh.name ASC NULLS LAST
        LIMIT ${limit} OFFSET ${offset}
      `);

      return createPaginatedResponse(nodes, total, limit, offset);
    } catch (error) {
      fastify.log.error({ error, stack: (error as Error).stack }, 'Error fetching business hierarchy');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single business hierarchy node
  fastify.get('/api/v1/business-hierarchy/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: BusinessHierarchySchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // ═══════════════════════════════════════════════════════════════
      // ✅ ENTITY INFRASTRUCTURE SERVICE - RBAC check
      // ═══════════════════════════════════════════════════════════════
      const entityInfra = getEntityInfrastructure(db);
      const canView = await entityInfra.check_entity_rbac(
        userId,
        'business_hierarchy',
        id,
        Permission.VIEW
      );

      if (!canView) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const results = await db.execute(sql`
        SELECT
          bh.id, bh.code, bh.name, bh."descr", bh.metadata,
          bh.parent_id, bh.dl__business_hierarchy_level,
          bh.manager__employee_id, bh.budget_allocated_amt,
          bh.from_ts, bh.to_ts, bh.active_flag, bh.created_ts, bh.updated_ts, bh.version,
          emp.name as manager_name,
          parent.name as parent_name
        FROM app.d_business_hierarchy bh
        LEFT JOIN app.employee emp ON bh.manager__employee_id = emp.id
        LEFT JOIN app.d_business_hierarchy parent ON bh.parent_id = parent.id
        WHERE bh.id = ${id}::uuid
      `);

      if (results.length === 0) {
        return reply.status(404).send({ error: 'Business hierarchy node not found' });
      }

      return results[0];
    } catch (error) {
      fastify.log.error({ error, stack: (error as Error).stack }, 'Error fetching business hierarchy node');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create business hierarchy node
  fastify.post('/api/v1/business-hierarchy', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateBusinessHierarchySchema,
      response: {
        201: BusinessHierarchySchema,
        400: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const data = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      const result = await db.execute(sql`
        INSERT INTO app.d_business_hierarchy (
          code, name, "descr", metadata, parent_id, dl__business_hierarchy_level,
          manager__employee_id, budget_allocated_amt, active_flag
        )
        VALUES (
          ${data.code}, ${data.name}, ${data.descr || null}, ${data.metadata || {}},
          ${data.parent_id ? sql`${data.parent_id}::uuid` : sql`NULL`},
          ${data.dl__business_hierarchy_level},
          ${data.manager__employee_id ? sql`${data.manager__employee_id}::uuid` : sql`NULL`},
          ${data.budget_allocated_amt || null}, ${data.active_flag !== false}
        )
        RETURNING *
      `);

      return reply.status(201).send(result[0]);
    } catch (error) {
      fastify.log.error({ error, stack: (error as Error).stack }, 'Error creating business hierarchy node');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update business hierarchy node
  fastify.patch('/api/v1/business-hierarchy/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      body: UpdateBusinessHierarchySchema,
      response: {
        200: BusinessHierarchySchema,
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      const updates: any[] = [];

      if (data.code !== undefined) { updates.push(sql`code = ${data.code}`); }
      if (data.name !== undefined) { updates.push(sql`name = ${data.name}`); }
      if (data.descr !== undefined) { updates.push(sql`"descr" = ${data.descr}`); }
      if (data.metadata !== undefined) { updates.push(sql`metadata = ${data.metadata}`); }
      if (data.parent_id !== undefined) {
        updates.push(data.parent_id ? sql`parent_id = ${data.parent_id}::uuid` : sql`parent_id = NULL`);
      }
      if (data.dl__business_hierarchy_level !== undefined) {
        updates.push(sql`dl__business_hierarchy_level = ${data.dl__business_hierarchy_level}`);
      }
      if (data.manager__employee_id !== undefined) {
        updates.push(data.manager__employee_id ? sql`manager__employee_id = ${data.manager__employee_id}::uuid` : sql`manager__employee_id = NULL`);
      }
      if (data.budget_allocated_amt !== undefined) {
        updates.push(sql`budget_allocated_amt = ${data.budget_allocated_amt}`);
      }
      if (data.active_flag !== undefined) { updates.push(sql`active_flag = ${data.active_flag}`); }

      updates.push(sql`updated_ts = NOW()`);
      updates.push(sql`version = version + 1`);

      const result = await db.execute(sql`
        UPDATE app.d_business_hierarchy
        SET ${sql.join(updates, sql`, `)}
        WHERE id = ${id}::uuid
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(404).send({ error: 'Business hierarchy node not found' });
      }

      return result[0];
    } catch (error) {
      fastify.log.error({ error, stack: (error as Error).stack }, 'Error updating business hierarchy node');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete business hierarchy node (factory pattern)
  createEntityDeleteEndpoint(fastify, 'business-hierarchy');
}
