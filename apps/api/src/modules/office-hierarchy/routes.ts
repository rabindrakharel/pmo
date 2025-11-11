import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '../../db/index.js';
import { sql } from 'drizzle-orm';
import {
  getUniversalColumnMetadata,
  filterUniversalColumns,
  getColumnsByMetadata,
  createPaginatedResponse
} from '../../lib/universal-schema-metadata.js';
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';

// Office Hierarchy Schema (4-level: Corporate → Region → District → Office)
const OfficeHierarchySchema = Type.Object({
  id: Type.String(),
  code: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
  parent_id: Type.Optional(Type.String()),
  dl__office_hierarchy_level: Type.String(),
  manager_employee_id: Type.Optional(Type.String()),
  budget_allocated_amt: Type.Optional(Type.Number()),
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.String()),
  active_flag: Type.Boolean(),
  created_ts: Type.String(),
  updated_ts: Type.String(),
  version: Type.Number(),
});

const CreateOfficeHierarchySchema = Type.Object({
  code: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
  parent_id: Type.Optional(Type.String()),
  dl__office_hierarchy_level: Type.String({ minLength: 1 }),
  manager_employee_id: Type.Optional(Type.String()),
  budget_allocated_amt: Type.Optional(Type.Number()),
  active_flag: Type.Optional(Type.Boolean()),
});

const UpdateOfficeHierarchySchema = Type.Partial(CreateOfficeHierarchySchema);

export async function officeHierarchyRoutes(fastify: FastifyInstance) {
  // List office hierarchy nodes
  fastify.get('/api/v1/office-hierarchy', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        active_flag: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        dl__office_hierarchy_level: Type.Optional(Type.String()),
        parent_id: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
        page: Type.Optional(Type.Number({ minimum: 1 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(OfficeHierarchySchema),
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
      active_flag, search, dl__office_hierarchy_level, parent_id,
      limit = 20, offset: queryOffset, page
    } = request.query as any;
    const offset = page ? (page - 1) * limit : (queryOffset !== undefined ? queryOffset : 0);

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // RBAC filtering
      const baseConditions = [
        sql`(
          EXISTS (
            SELECT 1 FROM app.entity_id_rbac_map rbac
            WHERE rbac.empid = ${userId}::uuid
              AND rbac.entity = 'office_hierarchy'
              AND (rbac.entity_id = oh.id::text OR rbac.entity_id = 'all')
              AND rbac.active_flag = true
              AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
              AND 0 = ANY(rbac.permission)
          )
        )`
      ];

      const conditions = [...baseConditions];

      if (active_flag !== undefined) {
        conditions.push(sql`oh.active_flag = ${active_flag}`);
      }

      if (dl__office_hierarchy_level) {
        conditions.push(sql`oh.dl__office_hierarchy_level = ${dl__office_hierarchy_level}`);
      }

      if (parent_id) {
        if (parent_id === 'null' || parent_id === '') {
          conditions.push(sql`oh.parent_id IS NULL`);
        } else {
          conditions.push(sql`oh.parent_id = ${parent_id}::uuid`);
        }
      }

      if (search) {
        const searchConditions = [
          sql`COALESCE(oh.name, '') ILIKE ${`%${search}%`}`,
          sql`COALESCE(oh."descr", '') ILIKE ${`%${search}%`}`,
          sql`COALESCE(oh.code, '') ILIKE ${`%${search}%`}`
        ];
        conditions.push(sql`(${sql.join(searchConditions, sql` OR `)})`);
      }

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.d_office_hierarchy oh
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      const nodes = await db.execute(sql`
        SELECT
          oh.id, oh.code, oh.name, oh."descr", oh.metadata,
          oh.parent_id, oh.dl__office_hierarchy_level,
          oh.manager_employee_id, oh.budget_allocated_amt,
          oh.from_ts, oh.to_ts, oh.active_flag, oh.created_ts, oh.updated_ts, oh.version,
          emp.name as manager_name,
          parent.name as parent_name
        FROM app.d_office_hierarchy oh
        LEFT JOIN app.d_employee emp ON oh.manager_employee_id = emp.id
        LEFT JOIN app.d_office_hierarchy parent ON oh.parent_id = parent.id
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY oh.dl__office_hierarchy_level ASC, oh.name ASC NULLS LAST
        LIMIT ${limit} OFFSET ${offset}
      `);

      return createPaginatedResponse(nodes, total, limit, offset);
    } catch (error) {
      fastify.log.error({ error, stack: (error as Error).stack }, 'Error fetching office hierarchy');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single office hierarchy node
  fastify.get('/api/v1/office-hierarchy/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: OfficeHierarchySchema,
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
      const results = await db.execute(sql`
        SELECT
          oh.id, oh.code, oh.name, oh."descr", oh.metadata,
          oh.parent_id, oh.dl__office_hierarchy_level,
          oh.manager_employee_id, oh.budget_allocated_amt,
          oh.from_ts, oh.to_ts, oh.active_flag, oh.created_ts, oh.updated_ts, oh.version,
          emp.name as manager_name,
          parent.name as parent_name
        FROM app.d_office_hierarchy oh
        LEFT JOIN app.d_employee emp ON oh.manager_employee_id = emp.id
        LEFT JOIN app.d_office_hierarchy parent ON oh.parent_id = parent.id
        WHERE oh.id = ${id}::uuid
          AND EXISTS (
            SELECT 1 FROM app.entity_id_rbac_map rbac
            WHERE rbac.empid = ${userId}::uuid
              AND rbac.entity = 'office_hierarchy'
              AND (rbac.entity_id = oh.id::text OR rbac.entity_id = 'all')
              AND rbac.active_flag = true
              AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
              AND 0 = ANY(rbac.permission)
          )
      `);

      if (results.length === 0) {
        return reply.status(404).send({ error: 'Office hierarchy node not found' });
      }

      return results[0];
    } catch (error) {
      fastify.log.error({ error, stack: (error as Error).stack }, 'Error fetching office hierarchy node');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create office hierarchy node
  fastify.post('/api/v1/office-hierarchy', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateOfficeHierarchySchema,
      response: {
        201: OfficeHierarchySchema,
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
        INSERT INTO app.d_office_hierarchy (
          code, name, "descr", metadata, parent_id, dl__office_hierarchy_level,
          manager_employee_id, budget_allocated_amt, active_flag
        )
        VALUES (
          ${data.code}, ${data.name}, ${data.descr || null}, ${data.metadata || {}},
          ${data.parent_id ? sql`${data.parent_id}::uuid` : sql`NULL`},
          ${data.dl__office_hierarchy_level},
          ${data.manager_employee_id ? sql`${data.manager_employee_id}::uuid` : sql`NULL`},
          ${data.budget_allocated_amt || null}, ${data.active_flag !== false}
        )
        RETURNING *
      `);

      return reply.status(201).send(result[0]);
    } catch (error) {
      fastify.log.error({ error, stack: (error as Error).stack }, 'Error creating office hierarchy node');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update office hierarchy node
  fastify.patch('/api/v1/office-hierarchy/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      body: UpdateOfficeHierarchySchema,
      response: {
        200: OfficeHierarchySchema,
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
      const fields: any[] = [];

      if (data.code !== undefined) { updates.push(sql`code = ${data.code}`); }
      if (data.name !== undefined) { updates.push(sql`name = ${data.name}`); }
      if (data.descr !== undefined) { updates.push(sql`"descr" = ${data.descr}`); }
      if (data.metadata !== undefined) { updates.push(sql`metadata = ${data.metadata}`); }
      if (data.parent_id !== undefined) {
        updates.push(data.parent_id ? sql`parent_id = ${data.parent_id}::uuid` : sql`parent_id = NULL`);
      }
      if (data.dl__office_hierarchy_level !== undefined) {
        updates.push(sql`dl__office_hierarchy_level = ${data.dl__office_hierarchy_level}`);
      }
      if (data.manager_employee_id !== undefined) {
        updates.push(data.manager_employee_id ? sql`manager_employee_id = ${data.manager_employee_id}::uuid` : sql`manager_employee_id = NULL`);
      }
      if (data.budget_allocated_amt !== undefined) {
        updates.push(sql`budget_allocated_amt = ${data.budget_allocated_amt}`);
      }
      if (data.active_flag !== undefined) { updates.push(sql`active_flag = ${data.active_flag}`); }

      updates.push(sql`updated_ts = NOW()`);
      updates.push(sql`version = version + 1`);

      const result = await db.execute(sql`
        UPDATE app.d_office_hierarchy
        SET ${sql.join(updates, sql`, `)}
        WHERE id = ${id}::uuid
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(404).send({ error: 'Office hierarchy node not found' });
      }

      return result[0];
    } catch (error) {
      fastify.log.error({ error, stack: (error as Error).stack }, 'Error updating office hierarchy node');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete office hierarchy node (factory pattern)
  createEntityDeleteEndpoint(fastify, 'office-hierarchy');
}
