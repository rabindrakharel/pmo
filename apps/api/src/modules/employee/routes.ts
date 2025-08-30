import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { checkScopeAccess } from '../rbac/scope-auth.js';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { 
  getUniversalColumnMetadata, 
  filterUniversalColumns,
  getColumnsByMetadata 
} from '../../lib/universal-schema-metadata.js';

// Schema based on actual d_employee table structure from db/06_employee.ddl
const EmployeeSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  tags: Type.Array(Type.String()),
  attr: Type.Object({}),
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.String()),
  active: Type.Boolean(),
  created: Type.String(),
  updated: Type.String(),
  // Employee-specific fields
  addr: Type.Optional(Type.String()),
  email: Type.Optional(Type.String()),
  phone: Type.Optional(Type.String()),
  mobile: Type.Optional(Type.String()),
  emergency_contact: Type.Object({}),
  lang: Type.String(),
  birth_date: Type.Optional(Type.String()),
  emp_code: Type.Optional(Type.String()),
  hire_date: Type.Optional(Type.String()),
  status: Type.String(),
  employment_type: Type.String(),
  work_mode: Type.String(),
  security_clearance: Type.String(),
  skills: Type.Array(Type.Any()),
  certifications: Type.Array(Type.Any()),
  education: Type.Array(Type.Any()),
  labels: Type.Array(Type.String()),
});

const CreateEmployeeSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  addr: Type.Optional(Type.String()),
  email: Type.Optional(Type.String({ format: 'email' })),
  password: Type.Optional(Type.String({ minLength: 6 })),
  phone: Type.Optional(Type.String()),
  mobile: Type.Optional(Type.String()),
  emergency_contact: Type.Optional(Type.Object({})),
  lang: Type.Optional(Type.String()),
  birth_date: Type.Optional(Type.String({ format: 'date' })),
  emp_code: Type.Optional(Type.String()),
  hire_date: Type.Optional(Type.String({ format: 'date' })),
  status: Type.Optional(Type.String()),
  employment_type: Type.Optional(Type.String()),
  work_mode: Type.Optional(Type.String()),
  security_clearance: Type.Optional(Type.String()),
  skills: Type.Optional(Type.Array(Type.Any())),
  certifications: Type.Optional(Type.Array(Type.Any())),
  education: Type.Optional(Type.Array(Type.Any())),
  labels: Type.Optional(Type.Array(Type.String())),
  tags: Type.Optional(Type.Array(Type.String())),
  attr: Type.Optional(Type.Object({})),
  active: Type.Optional(Type.Boolean()),
});

const UpdateEmployeeSchema = Type.Partial(CreateEmployeeSchema);

export async function empRoutes(fastify: FastifyInstance) {
  // List employees
  fastify.get('/api/v1/emp', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        active: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        status: Type.Optional(Type.String()),
        employment_type: Type.Optional(Type.String()),
        work_mode: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(EmployeeSchema),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number(),
        }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { active, search, status, employment_type, work_mode, limit = 50, offset = 0 } = request.query as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    const scopeAccess = await checkScopeAccess(userId, 'app:api', 'view', undefined);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const conditions = [];
      
      if (active !== undefined) {
        conditions.push(sql`active = ${active}`);
      }
      
      if (status) {
        conditions.push(sql`status = ${status}`);
      }
      
      if (employment_type) {
        conditions.push(sql`employment_type = ${employment_type}`);
      }
      
      if (work_mode) {
        conditions.push(sql`work_mode = ${work_mode}`);
      }
      
      if (search) {
        const searchableColumns = getColumnsByMetadata([
          'name', 'descr', 'addr', 'email', 'emp_code', 'phone'
        ], 'ui:search');
        
        const searchConditions = searchableColumns.map(col => 
          sql`COALESCE(${sql.identifier(col)}, '') ILIKE ${`%${search}%`}`
        );
        
        if (searchConditions.length > 0) {
          conditions.push(sql`(${sql.join(searchConditions, sql` OR `)})`);
        }
      }

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total 
        FROM app.d_employee 
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      const employees = await db.execute(sql`
        SELECT 
          id, name, "descr", 
          COALESCE(tags, '[]'::jsonb) as tags,
          attr, from_ts, to_ts, active, created, updated,
          addr, email, phone, mobile, emergency_contact, lang, birth_date,
          emp_code, hire_date, status, employment_type, work_mode, 
          security_clearance, 
          COALESCE(skills, '[]'::jsonb) as skills,
          COALESCE(certifications, '[]'::jsonb) as certifications,
          COALESCE(education, '[]'::jsonb) as education,
          COALESCE(labels, '[]'::jsonb) as labels
        FROM app.d_employee 
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY name ASC NULLS LAST, created DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const userPermissions = {
        canSeePII: scopeAccess.permissions?.includes(4) || false,
        canSeeFinancial: scopeAccess.permissions?.includes(4) || false,
        canSeeSystemFields: scopeAccess.permissions?.includes(4) || false,
      };
      
      const filteredData = employees.map(emp => {
        // Ensure JSON fields are properly parsed as JavaScript arrays
        const parsedEmp = {
          ...emp,
          tags: Array.isArray(emp.tags) ? emp.tags : (emp.tags ? JSON.parse(emp.tags) : []),
          skills: Array.isArray(emp.skills) ? emp.skills : (emp.skills ? JSON.parse(emp.skills) : []),
          certifications: Array.isArray(emp.certifications) ? emp.certifications : (emp.certifications ? JSON.parse(emp.certifications) : []),
          education: Array.isArray(emp.education) ? emp.education : (emp.education ? JSON.parse(emp.education) : []),
          labels: Array.isArray(emp.labels) ? emp.labels : (emp.labels ? JSON.parse(emp.labels) : []),
        };
        return filterUniversalColumns(parsedEmp, userPermissions);
      });

      return {
        data: filteredData,
        total,
        limit,
        offset,
      };
    } catch (error) {
      fastify.log.error('Error fetching employees:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single employee
  fastify.get('/api/v1/emp/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: EmployeeSchema,
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
    }

    const scopeAccess = await checkScopeAccess(userId, 'app:api', 'view', undefined);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const employee = await db.execute(sql`
        SELECT 
          id, name, "descr", tags, attr, from_ts, to_ts, active, created, updated,
          addr, email, phone, mobile, emergency_contact, lang, birth_date,
          emp_code, hire_date, status, employment_type, work_mode, 
          security_clearance, skills, certifications, education, labels
        FROM app.d_employee 
        WHERE id = ${id}
      `);

      if (employee.length === 0) {
        return reply.status(404).send({ error: 'Employee not found' });
      }

      const userPermissions = {
        canSeePII: scopeAccess.permissions?.includes(4) || false,
        canSeeFinancial: scopeAccess.permissions?.includes(4) || false,
        canSeeSystemFields: scopeAccess.permissions?.includes(4) || false,
      };
      
      return filterUniversalColumns(employee[0], userPermissions);
    } catch (error) {
      fastify.log.error('Error fetching employee:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create employee
  fastify.post('/api/v1/emp', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateEmployeeSchema,
      response: {
        201: EmployeeSchema,
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
    }

    const scopeAccess = await checkScopeAccess(userId, 'app:api', 'create', undefined);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      // Check for unique employee code if provided
      if (data.emp_code) {
        const existingEmpCode = await db.execute(sql`
          SELECT id FROM app.d_employee WHERE emp_code = ${data.emp_code} AND active = true
        `);
        if (existingEmpCode.length > 0) {
          return reply.status(400).send({ error: 'Employee with this code already exists' });
        }
      }
      
      // Check for unique email if provided
      if (data.email) {
        const existingEmail = await db.execute(sql`
          SELECT id FROM app.d_employee WHERE email = ${data.email} AND active = true
        `);
        if (existingEmail.length > 0) {
          return reply.status(400).send({ error: 'Employee with this email already exists' });
        }
      }
      
      // Hash password if provided
      let passwordHash = null;
      if (data.password) {
        passwordHash = await bcrypt.hash(data.password, 10);
      }

      const result = await db.execute(sql`
        INSERT INTO app.d_employee (
          name, "descr", addr, email, password_hash, phone, mobile,
          emergency_contact, lang, birth_date, emp_code,
          hire_date, status, employment_type, work_mode, security_clearance,
          skills, certifications, education, labels, tags, attr, active
        )
        VALUES (
          ${data.name}, 
          ${data.descr || null}, 
          ${data.addr || null}, 
          ${data.email || null}, 
          ${passwordHash}, 
          ${data.phone || null}, 
          ${data.mobile || null},
          ${data.emergency_contact ? JSON.stringify(data.emergency_contact) : '{}'}::jsonb,
          ${data.lang || 'en'}, 
          ${data.birth_date || null}, 
          ${data.emp_code || null},
          ${data.hire_date || null}, 
          ${data.status || 'active'}, 
          ${data.employment_type || 'full_time'}, 
          ${data.work_mode || 'office'}, 
          ${data.security_clearance || 'internal'},
          ${data.skills ? JSON.stringify(data.skills) : '[]'}::jsonb,
          ${data.certifications ? JSON.stringify(data.certifications) : '[]'}::jsonb,
          ${data.education ? JSON.stringify(data.education) : '[]'}::jsonb,
          ${data.labels ? JSON.stringify(data.labels) : '[]'}::jsonb,
          ${data.tags ? JSON.stringify(data.tags) : '[]'}::jsonb,
          ${data.attr ? JSON.stringify(data.attr) : '{}'}::jsonb,
          ${data.active !== false}
        )
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to create employee' });
      }

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: scopeAccess.permissions?.includes(4) || false,
        canSeeSystemFields: scopeAccess.permissions?.includes(4) || false,
      };
      
      return reply.status(201).send(filterUniversalColumns(result[0], userPermissions));
    } catch (error) {
      fastify.log.error('Error creating employee:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update employee  
  fastify.put('/api/v1/emp/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      body: UpdateEmployeeSchema,
      response: {
        200: EmployeeSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    const scopeAccess = await checkScopeAccess(userId, 'app:api', 'modify', undefined);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const existing = await db.execute(sql`
        SELECT id FROM app.d_employee WHERE id = ${id}
      `);
      
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Employee not found' });
      }

      const updateFields = [];
      
      if (data.name !== undefined) updateFields.push(sql`name = ${data.name}`);
      if (data.descr !== undefined) updateFields.push(sql`"descr" = ${data.descr}`);
      if (data.addr !== undefined) updateFields.push(sql`addr = ${data.addr}`);
      if (data.email !== undefined) updateFields.push(sql`email = ${data.email}`);
      if (data.phone !== undefined) updateFields.push(sql`phone = ${data.phone}`);
      if (data.mobile !== undefined) updateFields.push(sql`mobile = ${data.mobile}`);
      if (data.emergency_contact !== undefined) {
        updateFields.push(sql`emergency_contact = ${JSON.stringify(data.emergency_contact)}::jsonb`);
      }
      if (data.lang !== undefined) updateFields.push(sql`lang = ${data.lang}`);
      if (data.birth_date !== undefined) updateFields.push(sql`birth_date = ${data.birth_date}`);
      if (data.emp_code !== undefined) updateFields.push(sql`emp_code = ${data.emp_code}`);
      if (data.hire_date !== undefined) updateFields.push(sql`hire_date = ${data.hire_date}`);
      if (data.status !== undefined) updateFields.push(sql`status = ${data.status}`);
      if (data.employment_type !== undefined) updateFields.push(sql`employment_type = ${data.employment_type}`);
      if (data.work_mode !== undefined) updateFields.push(sql`work_mode = ${data.work_mode}`);
      if (data.security_clearance !== undefined) updateFields.push(sql`security_clearance = ${data.security_clearance}`);
      if (data.skills !== undefined) updateFields.push(sql`skills = ${JSON.stringify(data.skills)}::jsonb`);
      if (data.certifications !== undefined) updateFields.push(sql`certifications = ${JSON.stringify(data.certifications)}::jsonb`);
      if (data.education !== undefined) updateFields.push(sql`education = ${JSON.stringify(data.education)}::jsonb`);
      if (data.labels !== undefined) updateFields.push(sql`labels = ${JSON.stringify(data.labels)}::jsonb`);
      if (data.tags !== undefined) updateFields.push(sql`tags = ${JSON.stringify(data.tags)}::jsonb`);
      if (data.attr !== undefined) updateFields.push(sql`attr = ${JSON.stringify(data.attr)}::jsonb`);
      if (data.active !== undefined) updateFields.push(sql`active = ${data.active}`);

      if (data.password) {
        const passwordHash = await bcrypt.hash(data.password, 10);
        updateFields.push(sql`password_hash = ${passwordHash}`);
      }

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.d_employee 
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to update employee' });
      }

      const userPermissions = {
        canSeePII: scopeAccess.permissions?.includes(4) || false,
        canSeeFinancial: scopeAccess.permissions?.includes(4) || false,
        canSeeSystemFields: scopeAccess.permissions?.includes(4) || false,
      };
      
      return filterUniversalColumns(result[0], userPermissions);
    } catch (error) {
      fastify.log.error('Error updating employee:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete employee (soft delete)
  fastify.delete('/api/v1/emp/:id', {
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
    }

    const scopeAccess = await checkScopeAccess(userId, 'app:api', 'delete', undefined);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const existing = await db.execute(sql`
        SELECT id FROM app.d_employee WHERE id = ${id}
      `);
      
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Employee not found' });
      }

      await db.execute(sql`
        UPDATE app.d_employee 
        SET active = false, to_ts = NOW(), updated = NOW()
        WHERE id = ${id}
      `);

      return reply.status(204).send();
    } catch (error) {
      fastify.log.error('Error deleting employee:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}