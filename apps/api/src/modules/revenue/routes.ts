import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';
import { createChildEntityEndpoint } from '../../lib/child-entity-route-factory.js';

// Schema based on f_revenue table structure from db/LII_f_revenue.ddl
const RevenueSchema = Type.Object({
  id: Type.String(),
  revenue_number: Type.String(),
  revenue_type: Type.Optional(Type.String()),
  revenue_date: Type.String(),
  revenue_datetime: Type.Optional(Type.String()),
  recognition_date: Type.Optional(Type.String()),
  fiscal_year: Type.Optional(Type.Number()),
  accounting_period: Type.Optional(Type.String()),
  dl__revenue_category: Type.Optional(Type.String()),
  dl__revenue_subcategory: Type.Optional(Type.String()),
  dl__revenue_code: Type.Optional(Type.String()),
  cra_line: Type.Optional(Type.String()),
  invoice_id: Type.Optional(Type.String()),
  invoice_number: Type.Optional(Type.String()),
  client_id: Type.Optional(Type.String()),
  client_name: Type.Optional(Type.String()),
  client_type: Type.Optional(Type.String()),
  project_id: Type.Optional(Type.String()),
  project_name: Type.Optional(Type.String()),
  employee_id: Type.Optional(Type.String()),
  employee_name: Type.Optional(Type.String()),
  business_id: Type.Optional(Type.String()),
  business_name: Type.Optional(Type.String()),
  office_id: Type.Optional(Type.String()),
  office_name: Type.Optional(Type.String()),
  revenue_amount_cad: Type.Number(),
  cost_amount_cad: Type.Optional(Type.Number()),
  margin_amount_cad: Type.Optional(Type.Number()),
  margin_percent: Type.Optional(Type.Number()),
  tax_amount_cad: Type.Optional(Type.Number()),
  gst_amount_cad: Type.Optional(Type.Number()),
  pst_amount_cad: Type.Optional(Type.Number()),
  hst_amount_cad: Type.Optional(Type.Number()),
  tax_rate: Type.Optional(Type.Number()),
  tax_exempt_flag: Type.Optional(Type.Boolean()),
  revenue_status: Type.Optional(Type.String()),
  payment_status: Type.Optional(Type.String()),
  notes: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Array(Type.String())),
  created_ts: Type.Optional(Type.String()),
  updated_ts: Type.Optional(Type.String()),
  created_by: Type.Optional(Type.String()),
  last_modified_by: Type.Optional(Type.String())
});

const CreateRevenueSchema = Type.Object({
  revenue_number: Type.String({ minLength: 1 }),
  revenue_type: Type.Optional(Type.String()),
  revenue_date: Type.String(),
  dl__revenue_category: Type.Optional(Type.String()),
  dl__revenue_subcategory: Type.Optional(Type.String()),
  dl__revenue_code: Type.Optional(Type.String()),
  cra_line: Type.Optional(Type.String()),
  invoice_id: Type.Optional(Type.String()),
  invoice_number: Type.Optional(Type.String()),
  client_id: Type.Optional(Type.String()),
  client_name: Type.Optional(Type.String()),
  client_type: Type.Optional(Type.String()),
  project_id: Type.Optional(Type.String()),
  project_name: Type.Optional(Type.String()),
  employee_id: Type.Optional(Type.String()),
  employee_name: Type.Optional(Type.String()),
  business_id: Type.Optional(Type.String()),
  business_name: Type.Optional(Type.String()),
  office_id: Type.Optional(Type.String()),
  office_name: Type.Optional(Type.String()),
  revenue_amount_cad: Type.Number(),
  cost_amount_cad: Type.Optional(Type.Number()),
  tax_rate: Type.Optional(Type.Number()),
  tax_exempt_flag: Type.Optional(Type.Boolean()),
  revenue_status: Type.Optional(Type.String()),
  payment_status: Type.Optional(Type.String()),
  notes: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Array(Type.String()))
});

const UpdateRevenueSchema = Type.Partial(CreateRevenueSchema);

export async function revenueRoutes(fastify: FastifyInstance) {
  // List revenue with filtering
  fastify.get('/api/v1/revenue', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        search: Type.Optional(Type.String()),
        category: Type.Optional(Type.String()),
        subcategory: Type.Optional(Type.String()),
        client_id: Type.Optional(Type.String()),
        project_id: Type.Optional(Type.String()),
        employee_id: Type.Optional(Type.String()),
        fiscal_year: Type.Optional(Type.Number()),
        accounting_period: Type.Optional(Type.String()),
        revenue_status: Type.Optional(Type.String()),
        payment_status: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 }))
      }),
      response: {
        200: Type.Object({
          data: Type.Array(RevenueSchema),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number()
        }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    const {
      search, category, subcategory, client_id, project_id, employee_id,
      fiscal_year, accounting_period, revenue_status, payment_status,
      limit = 50, offset = 0
    } = request.query as any;

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.code(403).send({ error: 'User not authenticated' });
    }

    try {
      // Base RBAC filtering
      const baseConditions = [
        sql`(
          EXISTS (
            SELECT 1 FROM app.entity_id_rbac_map rbac
            WHERE rbac.person_entity_name = 'employee' AND rbac.person_entity_id = ${userId}
              AND rbac.entity_name = 'revenue'
              AND (rbac.entity_id = r.id OR rbac.entity_id = '11111111-1111-1111-1111-111111111111'::uuid)
              AND rbac.permission >= 0
          )
        )`
      ];

      const conditions = [...baseConditions];

      if (search) {
        conditions.push(sql`(
          r.revenue_number ILIKE ${`%${search}%`} OR
          r.description ILIKE ${`%${search}%`} OR
          r.client_name ILIKE ${`%${search}%`}
        )`);
      }

      if (category) {
        conditions.push(sql`r.dl__revenue_category = ${category}`);
      }

      if (subcategory) {
        conditions.push(sql`r.dl__revenue_subcategory = ${subcategory}`);
      }

      if (client_id) {
        conditions.push(sql`r.client_id = ${client_id}::uuid`);
      }

      if (project_id) {
        conditions.push(sql`r.project_id = ${project_id}::uuid`);
      }

      if (employee_id) {
        conditions.push(sql`r.employee_id = ${employee_id}::uuid`);
      }

      if (fiscal_year) {
        conditions.push(sql`r.fiscal_year = ${fiscal_year}`);
      }

      if (accounting_period) {
        conditions.push(sql`r.accounting_period = ${accounting_period}`);
      }

      if (revenue_status) {
        conditions.push(sql`r.revenue_status = ${revenue_status}`);
      }

      if (payment_status) {
        conditions.push(sql`r.payment_status = ${payment_status}`);
      }

      const whereClause = sql.join(conditions, sql` AND `);

      // Get total count
      const countQuery = sql`
        SELECT COUNT(*) as total
        FROM app.f_revenue r
        WHERE ${whereClause}
      `;

      const countResult = await db.execute(countQuery);
      const total = Number(countResult[0]?.total || 0);

      // Get data
      const dataQuery = sql`
        SELECT *
        FROM app.f_revenue r
        WHERE ${whereClause}
        ORDER BY r.revenue_date DESC, r.created_ts DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const dataResult = await db.execute(dataQuery);

      return reply.code(200).send({
        data: dataResult,
        total,
        limit,
        offset
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: error.message });
    }
  });

  // Get single revenue by ID
  fastify.get('/api/v1/revenue/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String()
      }),
      response: {
        200: RevenueSchema,
        404: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.code(403).send({ error: 'User not authenticated' });
    }

    try {
      const query = sql`
        SELECT r.*
        FROM app.f_revenue r
        WHERE r.id = ${id}::uuid
          AND EXISTS (
            SELECT 1 FROM app.entity_id_rbac_map rbac
            WHERE rbac.person_entity_name = 'employee' AND rbac.person_entity_id = ${userId}
              AND rbac.entity_name = 'revenue'
              AND (rbac.entity_id = r.id OR rbac.entity_id = '11111111-1111-1111-1111-111111111111'::uuid)
              AND rbac.permission >= 0
          )
      `;

      const result = await db.execute(query);

      if (result.length === 0) {
        return reply.code(404).send({ error: 'Revenue not found' });
      }

      return reply.code(200).send(result[0]);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: error.message });
    }
  });

  // Create new revenue
  fastify.post('/api/v1/revenue', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateRevenueSchema,
      response: {
        201: RevenueSchema,
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    const body = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.code(403).send({ error: 'User not authenticated' });
    }

    try {
      // Check if user has create permission
      const permCheckQuery = sql`
        SELECT 1 FROM app.entity_id_rbac_map rbac
        WHERE rbac.person_entity_name = 'employee' AND rbac.person_entity_id = ${userId}
          AND rbac.entity_name = 'revenue'
          AND rbac.entity_id = '11111111-1111-1111-1111-111111111111'::uuid
          AND rbac.permission >= 4
      `;

      const permResult = await db.execute(permCheckQuery);
      if (permResult.length === 0) {
        return reply.code(403).send({ error: 'No permission to create revenue' });
      }

      // Insert revenue
      const insertQuery = sql`
        INSERT INTO app.f_revenue (
          revenue_number, revenue_type, revenue_date,
          dl__revenue_category, dl__revenue_subcategory, dl__revenue_code, cra_line,
          invoice_id, invoice_number,
          client_id, client_name, client_type,
          project_id, project_name,
          employee_id, employee_name,
          business_id, business_name,
          office_id, office_name,
          revenue_amount_cad, cost_amount_cad,
          tax_rate, tax_exempt_flag,
          revenue_status, payment_status,
          notes, description, tags,
          created_by
        ) VALUES (
          ${body.revenue_number}, ${body.revenue_type || 'standard'}, ${body.revenue_date},
          ${body.dl__revenue_category}, ${body.dl__revenue_subcategory}, ${body.dl__revenue_code}, ${body.cra_line},
          ${body.invoice_id ? sql`${body.invoice_id}::uuid` : null}, ${body.invoice_number},
          ${body.client_id ? sql`${body.client_id}::uuid` : null}, ${body.client_name}, ${body.client_type},
          ${body.project_id ? sql`${body.project_id}::uuid` : null}, ${body.project_name},
          ${body.employee_id ? sql`${body.employee_id}::uuid` : null}, ${body.employee_name},
          ${body.business_id ? sql`${body.business_id}::uuid` : null}, ${body.business_name},
          ${body.office_id ? sql`${body.office_id}::uuid` : null}, ${body.office_name},
          ${body.revenue_amount_cad}, ${body.cost_amount_cad || 0},
          ${body.tax_rate || 0}, ${body.tax_exempt_flag || false},
          ${body.revenue_status || 'recognized'}, ${body.payment_status},
          ${body.notes}, ${body.description}, ${body.tags ? sql`ARRAY[${sql.join(body.tags.map((t: string) => sql`${t}`), sql`, `)}]::text[]` : null},
          ${userId}::uuid
        )
        RETURNING *
      `;

      const insertResult = await db.execute(insertQuery);
      const newRevenue = insertResult[0];

      return reply.code(201).send(newRevenue);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: error.message });
    }
  });

  // Update revenue
  fastify.patch('/api/v1/revenue/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String()
      }),
      body: UpdateRevenueSchema,
      response: {
        200: RevenueSchema,
        404: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as any;
    const body = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.code(403).send({ error: 'User not authenticated' });
    }

    try {
      // Check edit permission
      const permCheckQuery = sql`
        SELECT 1 FROM app.entity_id_rbac_map rbac
        WHERE rbac.person_entity_name = 'employee' AND rbac.person_entity_id = ${userId}
          AND rbac.entity_name = 'revenue'
          AND (rbac.entity_id = ${id} OR rbac.entity_id = '11111111-1111-1111-1111-111111111111'::uuid)
          AND rbac.permission >= 1
      `;

      const permResult = await db.execute(permCheckQuery);
      if (permResult.length === 0) {
        return reply.code(403).send({ error: 'No permission to edit revenue' });
      }

      const updateFields: any[] = [];
      const updateValues: any[] = [];

      Object.keys(body).forEach((key) => {
        if (body[key] !== undefined) {
          if (key.endsWith('_id') && body[key]) {
            updateFields.push(sql`${sql.identifier([key])} = ${body[key]}::uuid`);
          } else if (key === 'tags' && Array.isArray(body[key])) {
            updateFields.push(sql`tags = ARRAY[${sql.join(body[key].map((t: string) => sql`${t}`), sql`, `)}]::text[]`);
          } else {
            updateFields.push(sql`${sql.identifier([key])} = ${body[key]}`);
          }
        }
      });

      if (updateFields.length === 0) {
        return reply.code(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`last_modified_by = ${userId}::uuid`);
      updateFields.push(sql`updated_ts = NOW()`);

      const updateQuery = sql`
        UPDATE app.f_revenue
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}::uuid
        RETURNING *
      `;

      const updateResult = await db.execute(updateQuery);

      if (updateResult.length === 0) {
        return reply.code(404).send({ error: 'Revenue not found' });
      }

      return reply.code(200).send(updateResult[0]);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: error.message });
    }
  });

  // Delete revenue
  createEntityDeleteEndpoint(fastify, 'revenue');
}
