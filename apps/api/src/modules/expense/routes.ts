import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';

// Schema based on f_expense table structure from db/LIII_f_expense.ddl
const ExpenseSchema = Type.Object({
  id: Type.String(),
  expense_number: Type.String(),
  expense_type: Type.Optional(Type.String()),
  expense_date: Type.String(),
  expense_datetime: Type.Optional(Type.String()),
  recognition_date: Type.Optional(Type.String()),
  fiscal_year: Type.Optional(Type.Number()),
  accounting_period: Type.Optional(Type.String()),
  dl__expense_category: Type.Optional(Type.String()),
  dl__expense_subcategory: Type.Optional(Type.String()),
  dl__expense_code: Type.Optional(Type.String()),
  cra_line: Type.Optional(Type.String()),
  deductibility_percent: Type.Optional(Type.Number()),
  invoice_id: Type.Optional(Type.String()),
  invoice_number: Type.Optional(Type.String()),
  project_id: Type.Optional(Type.String()),
  project_name: Type.Optional(Type.String()),
  employee_id: Type.Optional(Type.String()),
  employee_name: Type.Optional(Type.String()),
  client_id: Type.Optional(Type.String()),
  client_name: Type.Optional(Type.String()),
  business_id: Type.Optional(Type.String()),
  business_name: Type.Optional(Type.String()),
  office_id: Type.Optional(Type.String()),
  office_name: Type.Optional(Type.String()),
  expense_amount_cad: Type.Number(),
  deductible_amount_cad: Type.Optional(Type.Number()),
  reimbursable_flag: Type.Optional(Type.Boolean()),
  reimbursed_flag: Type.Optional(Type.Boolean()),
  reimbursed_date: Type.Optional(Type.String()),
  tax_amount_cad: Type.Optional(Type.Number()),
  gst_amount_cad: Type.Optional(Type.Number()),
  pst_amount_cad: Type.Optional(Type.Number()),
  hst_amount_cad: Type.Optional(Type.Number()),
  tax_rate: Type.Optional(Type.Number()),
  tax_recoverable_flag: Type.Optional(Type.Boolean()),
  expense_status: Type.Optional(Type.String()),
  payment_status: Type.Optional(Type.String()),
  payment_method: Type.Optional(Type.String()),
  payment_reference: Type.Optional(Type.String()),
  paid_date: Type.Optional(Type.String()),
  attachment: Type.Optional(Type.String()),
  attachment_format: Type.Optional(Type.String()),
  attachment_size_bytes: Type.Optional(Type.Number()),
  attachment_object_bucket: Type.Optional(Type.String()),
  attachment_object_key: Type.Optional(Type.String()),
  notes: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Array(Type.String())),
  vendor_name: Type.Optional(Type.String()),
  created_ts: Type.Optional(Type.String()),
  updated_ts: Type.Optional(Type.String()),
  created_by: Type.Optional(Type.String()),
  last_modified_by: Type.Optional(Type.String()),
  approved_by: Type.Optional(Type.String()),
  approved_date: Type.Optional(Type.String())
});

const CreateExpenseSchema = Type.Object({
  expense_number: Type.String({ minLength: 1 }),
  expense_type: Type.Optional(Type.String()),
  expense_date: Type.String(),
  dl__expense_category: Type.Optional(Type.String()),
  dl__expense_subcategory: Type.Optional(Type.String()),
  dl__expense_code: Type.Optional(Type.String()),
  cra_line: Type.Optional(Type.String()),
  deductibility_percent: Type.Optional(Type.Number()),
  invoice_id: Type.Optional(Type.String()),
  invoice_number: Type.Optional(Type.String()),
  project_id: Type.Optional(Type.String()),
  project_name: Type.Optional(Type.String()),
  employee_id: Type.Optional(Type.String()),
  employee_name: Type.Optional(Type.String()),
  client_id: Type.Optional(Type.String()),
  client_name: Type.Optional(Type.String()),
  business_id: Type.Optional(Type.String()),
  business_name: Type.Optional(Type.String()),
  office_id: Type.Optional(Type.String()),
  office_name: Type.Optional(Type.String()),
  expense_amount_cad: Type.Number(),
  reimbursable_flag: Type.Optional(Type.Boolean()),
  tax_rate: Type.Optional(Type.Number()),
  tax_recoverable_flag: Type.Optional(Type.Boolean()),
  expense_status: Type.Optional(Type.String()),
  payment_status: Type.Optional(Type.String()),
  payment_method: Type.Optional(Type.String()),
  notes: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Array(Type.String())),
  vendor_name: Type.Optional(Type.String())
});

const UpdateExpenseSchema = Type.Partial(CreateExpenseSchema);

export async function expenseRoutes(fastify: FastifyInstance) {
  // List expenses with filtering
  fastify.get('/api/v1/expense', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        search: Type.Optional(Type.String()),
        category: Type.Optional(Type.String()),
        subcategory: Type.Optional(Type.String()),
        project_id: Type.Optional(Type.String()),
        employee_id: Type.Optional(Type.String()),
        client_id: Type.Optional(Type.String()),
        fiscal_year: Type.Optional(Type.Number()),
        accounting_period: Type.Optional(Type.String()),
        expense_status: Type.Optional(Type.String()),
        payment_status: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 }))
      }),
      response: {
        200: Type.Object({
          data: Type.Array(ExpenseSchema),
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
      search, category, subcategory, project_id, employee_id, client_id,
      fiscal_year, accounting_period, expense_status, payment_status,
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
              AND rbac.entity_name = 'expense'
              AND (rbac.entity_id = e.id OR rbac.entity_id = '11111111-1111-1111-1111-111111111111'::uuid)
              AND rbac.permission >= 0
          )
        )`
      ];

      const conditions = [...baseConditions];

      if (search) {
        conditions.push(sql`(
          e.expense_number ILIKE ${`%${search}%`} OR
          e.description ILIKE ${`%${search}%`} OR
          e.vendor_name ILIKE ${`%${search}%`} OR
          e.employee_name ILIKE ${`%${search}%`}
        )`);
      }

      if (category) {
        conditions.push(sql`e.dl__expense_category = ${category}`);
      }

      if (subcategory) {
        conditions.push(sql`e.dl__expense_subcategory = ${subcategory}`);
      }

      if (project_id) {
        conditions.push(sql`e.project_id = ${project_id}::uuid`);
      }

      if (employee_id) {
        conditions.push(sql`e.employee_id = ${employee_id}::uuid`);
      }

      if (client_id) {
        conditions.push(sql`e.client_id = ${client_id}::uuid`);
      }

      if (fiscal_year) {
        conditions.push(sql`e.fiscal_year = ${fiscal_year}`);
      }

      if (accounting_period) {
        conditions.push(sql`e.accounting_period = ${accounting_period}`);
      }

      if (expense_status) {
        conditions.push(sql`e.expense_status = ${expense_status}`);
      }

      if (payment_status) {
        conditions.push(sql`e.payment_status = ${payment_status}`);
      }

      const whereClause = sql.join(conditions, sql` AND `);

      // Get total count
      const countQuery = sql`
        SELECT COUNT(*) as total
        FROM app.f_expense e
        WHERE ${whereClause}
      `;

      const countResult = await db.execute(countQuery);
      const total = Number(countResult[0]?.total || 0);

      // Get data
      const dataQuery = sql`
        SELECT *
        FROM app.f_expense e
        WHERE ${whereClause}
        ORDER BY e.expense_date DESC, e.created_ts DESC
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

  // Get single expense by ID
  fastify.get('/api/v1/expense/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String()
      }),
      response: {
        200: ExpenseSchema,
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
        SELECT e.*
        FROM app.f_expense e
        WHERE e.id = ${id}::uuid
          AND EXISTS (
            SELECT 1 FROM app.entity_id_rbac_map rbac
            WHERE rbac.person_entity_name = 'employee' AND rbac.person_entity_id = ${userId}
              AND rbac.entity_name = 'expense'
              AND (rbac.entity_id = e.id OR rbac.entity_id = '11111111-1111-1111-1111-111111111111'::uuid)
              AND rbac.permission >= 0
          )
      `;

      const result = await db.execute(query);

      if (result.length === 0) {
        return reply.code(404).send({ error: 'Expense not found' });
      }

      return reply.code(200).send(result[0]);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: error.message });
    }
  });

  // Create new expense
  fastify.post('/api/v1/expense', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateExpenseSchema,
      response: {
        201: ExpenseSchema,
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
          AND rbac.entity_name = 'expense'
          AND rbac.entity_id = '11111111-1111-1111-1111-111111111111'::uuid
          AND rbac.permission >= 4
      `;

      const permResult = await db.execute(permCheckQuery);
      if (permResult.length === 0) {
        return reply.code(403).send({ error: 'No permission to create expense' });
      }

      // Insert expense
      const insertQuery = sql`
        INSERT INTO app.f_expense (
          expense_number, expense_type, expense_date,
          dl__expense_category, dl__expense_subcategory, dl__expense_code, cra_line, deductibility_percent,
          invoice_id, invoice_number,
          project_id, project_name,
          employee_id, employee_name,
          client_id, client_name,
          business_id, business_name,
          office_id, office_name,
          expense_amount_cad, reimbursable_flag,
          tax_rate, tax_recoverable_flag,
          expense_status, payment_status, payment_method,
          notes, description, tags, vendor_name,
          created_by
        ) VALUES (
          ${body.expense_number}, ${body.expense_type || 'standard'}, ${body.expense_date},
          ${body.dl__expense_category}, ${body.dl__expense_subcategory}, ${body.dl__expense_code}, ${body.cra_line}, ${body.deductibility_percent || 100},
          ${body.invoice_id ? sql`${body.invoice_id}::uuid` : null}, ${body.invoice_number},
          ${body.project_id ? sql`${body.project_id}::uuid` : null}, ${body.project_name},
          ${body.employee_id ? sql`${body.employee_id}::uuid` : null}, ${body.employee_name},
          ${body.client_id ? sql`${body.client_id}::uuid` : null}, ${body.client_name},
          ${body.business_id ? sql`${body.business_id}::uuid` : null}, ${body.business_name},
          ${body.office_id ? sql`${body.office_id}::uuid` : null}, ${body.office_name},
          ${body.expense_amount_cad}, ${body.reimbursable_flag || false},
          ${body.tax_rate || 0}, ${body.tax_recoverable_flag !== false},
          ${body.expense_status || 'submitted'}, ${body.payment_status || 'unpaid'}, ${body.payment_method},
          ${body.notes}, ${body.description}, ${body.tags ? sql`ARRAY[${sql.join(body.tags.map((t: string) => sql`${t}`), sql`, `)}]::text[]` : null}, ${body.vendor_name},
          ${userId}::uuid
        )
        RETURNING *
      `;

      const insertResult = await db.execute(insertQuery);
      const newExpense = insertResult[0];

      return reply.code(201).send(newExpense);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: error.message });
    }
  });

  // Update expense
  fastify.patch('/api/v1/expense/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String()
      }),
      body: UpdateExpenseSchema,
      response: {
        200: ExpenseSchema,
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
          AND rbac.entity_name = 'expense'
          AND (rbac.entity_id = ${id} OR rbac.entity_id = '11111111-1111-1111-1111-111111111111'::uuid)
          AND rbac.permission >= 1
      `;

      const permResult = await db.execute(permCheckQuery);
      if (permResult.length === 0) {
        return reply.code(403).send({ error: 'No permission to edit expense' });
      }

      const updateFields: any[] = [];

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
        UPDATE app.f_expense
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}::uuid
        RETURNING *
      `;

      const updateResult = await db.execute(updateQuery);

      if (updateResult.length === 0) {
        return reply.code(404).send({ error: 'Expense not found' });
      }

      return reply.code(200).send(updateResult[0]);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: error.message });
    }
  });

  // Delete expense
  createEntityDeleteEndpoint(fastify, 'expense');
}
