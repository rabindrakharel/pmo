import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { 
  getUniversalColumnMetadata, 
  filterUniversalColumns,
  getColumnsByMetadata 
} from '../../lib/universal-schema-metadata.js';

// Schema based on new normalized d_employee table structure
const EmployeeSchema = Type.Object({
  id: Type.String(),
  
  // Standard fields
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  tags: Type.Array(Type.String()),
  attr: Type.Object({}),
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.String()),
  active: Type.Boolean(),
  created: Type.String(),
  updated: Type.String(),
  
  // Employee identification
  employee_number: Type.String(),
  email: Type.String(),
  phone: Type.Optional(Type.String()),
  
  // Personal information
  first_name: Type.String(),
  last_name: Type.String(),
  preferred_name: Type.Optional(Type.String()),
  date_of_birth: Type.Optional(Type.String()),
  
  // Employment details
  hire_date: Type.String(),
  termination_date: Type.Optional(Type.String()),
  employment_status: Type.String(),
  employee_type: Type.String(),
  
  // Organizational assignment
  hr_position_id: Type.Optional(Type.String()),
  primary_org_id: Type.Optional(Type.String()),
  reports_to_employee_id: Type.Optional(Type.String()),
  
  // Compensation and benefits
  salary_annual: Type.Optional(Type.Number()),
  hourly_rate: Type.Optional(Type.Number()),
  overtime_eligible: Type.Optional(Type.Boolean()),
  benefits_eligible: Type.Optional(Type.Boolean()),
  
  // Skills and qualifications
  certifications: Type.Array(Type.Any()),
  skills: Type.Array(Type.Any()),
  languages: Type.Array(Type.String()),
  education_level: Type.Optional(Type.String()),
  
  // Work preferences and attributes
  remote_eligible: Type.Optional(Type.Boolean()),
  travel_required: Type.Optional(Type.Boolean()),
  security_clearance: Type.Optional(Type.String()),
  emergency_contact: Type.Object({}),
});

const CreateEmployeeSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  
  // Employee identification
  employee_number: Type.String({ minLength: 1 }),
  email: Type.String({ format: 'email' }),
  phone: Type.Optional(Type.String()),
  
  // Personal information
  first_name: Type.String({ minLength: 1 }),
  last_name: Type.String({ minLength: 1 }),
  preferred_name: Type.Optional(Type.String()),
  date_of_birth: Type.Optional(Type.String({ format: 'date' })),
  
  // Employment details
  hire_date: Type.String({ format: 'date' }),
  termination_date: Type.Optional(Type.String({ format: 'date' })),
  employment_status: Type.Optional(Type.String()),
  employee_type: Type.Optional(Type.String()),
  
  // Organizational assignment
  hr_position_id: Type.Optional(Type.String()),
  primary_org_id: Type.Optional(Type.String()),
  reports_to_employee_id: Type.Optional(Type.String()),
  
  // Compensation and benefits
  salary_annual: Type.Optional(Type.Number()),
  hourly_rate: Type.Optional(Type.Number()),
  overtime_eligible: Type.Optional(Type.Boolean()),
  benefits_eligible: Type.Optional(Type.Boolean()),
  
  // Skills and qualifications
  certifications: Type.Optional(Type.Array(Type.Any())),
  skills: Type.Optional(Type.Array(Type.Any())),
  languages: Type.Optional(Type.Array(Type.String())),
  education_level: Type.Optional(Type.String()),
  
  // Work preferences and attributes
  remote_eligible: Type.Optional(Type.Boolean()),
  travel_required: Type.Optional(Type.Boolean()),
  security_clearance: Type.Optional(Type.String()),
  emergency_contact: Type.Optional(Type.Object({})),
  
  // Standard fields
  tags: Type.Optional(Type.Array(Type.String())),
  attr: Type.Optional(Type.Object({})),
  active: Type.Optional(Type.Boolean()),
});

const UpdateEmployeeSchema = Type.Partial(CreateEmployeeSchema);

export async function empRoutes(fastify: FastifyInstance) {
  // List employees
  fastify.get('/api/v1/employee', {
    
    schema: {
      querystring: Type.Object({
        active: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        employment_status: Type.Optional(Type.String()),
        employee_type: Type.Optional(Type.String()),
        remote_eligible: Type.Optional(Type.Boolean()),
        benefits_eligible: Type.Optional(Type.Boolean()),
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
    const { active, search, employment_status, employee_type, remote_eligible, benefits_eligible, limit = 50, offset = 0 } = request.query as any;

    try {
      const conditions = [];
      
      if (active !== undefined) {
        conditions.push(sql`active_flag = ${active}`);
      }
      
      if (employment_status) {
        conditions.push(sql`employment_status = ${employment_status}`);
      }
      
      if (employee_type) {
        conditions.push(sql`employee_type = ${employee_type}`);
      }
      
      if (remote_eligible !== undefined) {
        conditions.push(sql`remote_eligible = ${remote_eligible}`);
      }
      
      if (benefits_eligible !== undefined) {
        conditions.push(sql`benefits_eligible = ${benefits_eligible}`);
      }
      
      if (search) {
        const searchableColumns = getColumnsByMetadata([
          'name', 'descr', 'email', 'employee_number', 'phone', 'first_name', 'last_name'
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
          employee_number, email, phone, first_name, last_name, preferred_name, date_of_birth,
          hire_date, termination_date, employment_status, employee_type,
          hr_position_id, primary_org_id, reports_to_employee_id,
          salary_annual, hourly_rate, overtime_eligible, benefits_eligible,
          COALESCE(certifications, '[]'::jsonb) as certifications,
          COALESCE(skills, '[]'::jsonb) as skills,
          COALESCE(languages, '["en"]'::jsonb) as languages,
          education_level, remote_eligible, travel_required, security_clearance,
          COALESCE(emergency_contact, '{}'::jsonb) as emergency_contact
        FROM app.d_employee 
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY name ASC NULLS LAST, created DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
      };
      
      const filteredData = employees.map(emp => {
        // Ensure JSON fields are properly parsed as JavaScript arrays
        const parsedEmp = {
          ...emp,
          tags: Array.isArray(emp.tags) ? emp.tags : (emp.tags ? JSON.parse(emp.tags) : []),
          skills: Array.isArray(emp.skills) ? emp.skills : (emp.skills ? JSON.parse(emp.skills) : []),
          certifications: Array.isArray(emp.certifications) ? emp.certifications : (emp.certifications ? JSON.parse(emp.certifications) : []),
          languages: Array.isArray(emp.languages) ? emp.languages : (emp.languages ? JSON.parse(emp.languages) : ['en']),
          emergency_contact: emp.emergency_contact || {},
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
  fastify.get('/api/v1/employee/:id', {
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

    try {
      const employee = await db.execute(sql`
        SELECT 
          id, name, "descr", tags, attr, from_ts, to_ts, active, created, updated,
          employee_number, email, phone, first_name, last_name, preferred_name, date_of_birth,
          hire_date, termination_date, employment_status, employee_type,
          hr_position_id, primary_org_id, reports_to_employee_id,
          salary_annual, hourly_rate, overtime_eligible, benefits_eligible,
          certifications, skills, languages, education_level, 
          remote_eligible, travel_required, security_clearance, emergency_contact
        FROM app.d_employee 
        WHERE id = ${id}
      `);

      if (employee.length === 0) {
        return reply.status(404).send({ error: 'Employee not found' });
      }

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
      };
      
      return filterUniversalColumns(employee[0], userPermissions);
    } catch (error) {
      fastify.log.error('Error fetching employee:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create employee
  fastify.post('/api/v1/employee', {
    
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


    try {
      // Check for unique employee number if provided
      if (data.employee_number) {
        const existingEmpNumber = await db.execute(sql`
          SELECT id FROM app.d_employee WHERE employee_number = ${data.employee_number} AND active_flag = true
        `);
        if (existingEmpNumber.length > 0) {
          return reply.status(400).send({ error: 'Employee with this employee number already exists' });
        }
      }
      
      // Check for unique email if provided
      if (data.email) {
        const existingEmail = await db.execute(sql`
          SELECT id FROM app.d_employee WHERE email = ${data.email} AND active_flag = true
        `);
        if (existingEmail.length > 0) {
          return reply.status(400).send({ error: 'Employee with this email already exists' });
        }
      }
      
      const result = await db.execute(sql`
        INSERT INTO app.d_employee (
          name, "descr", employee_number, email, phone, 
          first_name, last_name, preferred_name, date_of_birth,
          hire_date, termination_date, employment_status, employee_type,
          hr_position_id, primary_org_id, reports_to_employee_id,
          salary_annual, hourly_rate, overtime_eligible, benefits_eligible,
          certifications, skills, languages, education_level,
          remote_eligible, travel_required, security_clearance, emergency_contact,
          tags, attr, active
        )
        VALUES (
          ${data.name}, 
          ${data.descr || null}, 
          ${data.employee_number},
          ${data.email}, 
          ${data.phone || null}, 
          ${data.first_name},
          ${data.last_name},
          ${data.preferred_name || null},
          ${data.date_of_birth || null},
          ${data.hire_date}, 
          ${data.termination_date || null},
          ${data.employment_status || 'active'}, 
          ${data.employee_type || 'full-time'},
          ${data.hr_position_id || null},
          ${data.primary_org_id || null},
          ${data.reports_to_employee_id || null},
          ${data.salary_annual || null},
          ${data.hourly_rate || null},
          ${data.overtime_eligible !== false},
          ${data.benefits_eligible !== false},
          ${data.certifications ? JSON.stringify(data.certifications) : '[]'}::jsonb,
          ${data.skills ? JSON.stringify(data.skills) : '[]'}::jsonb,
          ${data.languages ? JSON.stringify(data.languages) : '["en"]'}::jsonb,
          ${data.education_level || null},
          ${data.remote_eligible || false},
          ${data.travel_required || false},
          ${data.security_clearance || null},
          ${data.emergency_contact ? JSON.stringify(data.emergency_contact) : '{}'}::jsonb,
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
        canSeeFinancial: true,
        canSeeSystemFields: true,
      };
      
      return reply.status(201).send(filterUniversalColumns(result[0], userPermissions));
    } catch (error) {
      fastify.log.error('Error creating employee:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update employee
  fastify.put('/api/v1/employee/:id', {
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
      if (data.employee_number !== undefined) updateFields.push(sql`employee_number = ${data.employee_number}`);
      if (data.email !== undefined) updateFields.push(sql`email = ${data.email}`);
      if (data.phone !== undefined) updateFields.push(sql`phone = ${data.phone}`);
      if (data.first_name !== undefined) updateFields.push(sql`first_name = ${data.first_name}`);
      if (data.last_name !== undefined) updateFields.push(sql`last_name = ${data.last_name}`);
      if (data.preferred_name !== undefined) updateFields.push(sql`preferred_name = ${data.preferred_name}`);
      if (data.date_of_birth !== undefined) updateFields.push(sql`date_of_birth = ${data.date_of_birth}`);
      if (data.hire_date !== undefined) updateFields.push(sql`hire_date = ${data.hire_date}`);
      if (data.termination_date !== undefined) updateFields.push(sql`termination_date = ${data.termination_date}`);
      if (data.employment_status !== undefined) updateFields.push(sql`employment_status = ${data.employment_status}`);
      if (data.employee_type !== undefined) updateFields.push(sql`employee_type = ${data.employee_type}`);
      if (data.hr_position_id !== undefined) updateFields.push(sql`hr_position_id = ${data.hr_position_id}`);
      if (data.primary_org_id !== undefined) updateFields.push(sql`primary_org_id = ${data.primary_org_id}`);
      if (data.reports_to_employee_id !== undefined) updateFields.push(sql`reports_to_employee_id = ${data.reports_to_employee_id}`);
      if (data.salary_annual !== undefined) updateFields.push(sql`salary_annual = ${data.salary_annual}`);
      if (data.hourly_rate !== undefined) updateFields.push(sql`hourly_rate = ${data.hourly_rate}`);
      if (data.overtime_eligible !== undefined) updateFields.push(sql`overtime_eligible = ${data.overtime_eligible}`);
      if (data.benefits_eligible !== undefined) updateFields.push(sql`benefits_eligible = ${data.benefits_eligible}`);
      if (data.certifications !== undefined) updateFields.push(sql`certifications = ${JSON.stringify(data.certifications)}::jsonb`);
      if (data.skills !== undefined) updateFields.push(sql`skills = ${JSON.stringify(data.skills)}::jsonb`);
      if (data.languages !== undefined) updateFields.push(sql`languages = ${JSON.stringify(data.languages)}::jsonb`);
      if (data.education_level !== undefined) updateFields.push(sql`education_level = ${data.education_level}`);
      if (data.remote_eligible !== undefined) updateFields.push(sql`remote_eligible = ${data.remote_eligible}`);
      if (data.travel_required !== undefined) updateFields.push(sql`travel_required = ${data.travel_required}`);
      if (data.security_clearance !== undefined) updateFields.push(sql`security_clearance = ${data.security_clearance}`);
      if (data.emergency_contact !== undefined) {
        updateFields.push(sql`emergency_contact = ${JSON.stringify(data.emergency_contact)}::jsonb`);
      }
      if (data.tags !== undefined) updateFields.push(sql`tags = ${JSON.stringify(data.tags)}::jsonb`);
      if (data.attr !== undefined) updateFields.push(sql`attr = ${JSON.stringify(data.attr)}::jsonb`);
      if (data.active !== undefined) updateFields.push(sql`active_flag = ${data.active}`);

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
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
      };
      
      return filterUniversalColumns(result[0], userPermissions);
    } catch (error) {
      fastify.log.error('Error updating employee:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete employee (soft delete)
  fastify.delete('/api/v1/employee/:id', {
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


    try {
      const existing = await db.execute(sql`
        SELECT id FROM app.d_employee WHERE id = ${id}
      `);
      
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Employee not found' });
      }

      await db.execute(sql`
        UPDATE app.d_employee 
        SET active_flag = false, to_ts = NOW(), updated = NOW()
        WHERE id = ${id}
      `);

      return reply.status(204).send();
    } catch (error) {
      fastify.log.error('Error deleting employee:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}