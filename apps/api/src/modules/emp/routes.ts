import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { checkScopeAccess } from '../rbac/scope-auth.js';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';

const EmployeeSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  addr: Type.Optional(Type.String()),
  email: Type.Optional(Type.String()),
  passwordHash: Type.Optional(Type.String()),
  phone: Type.Optional(Type.String()),
  mobile: Type.Optional(Type.String()),
  emergencyContact: Type.Optional(Type.Object({})),
  preferredLanguage: Type.Optional(Type.String()),
  dateOfBirth: Type.Optional(Type.String()),
  employeeNumber: Type.Optional(Type.String()),
  sinHash: Type.Optional(Type.String()),
  hireDate: Type.Optional(Type.String()),
  terminationDate: Type.Optional(Type.String()),
  employmentStatus: Type.Optional(Type.String()),
  employmentType: Type.Optional(Type.String()),
  managerEmpId: Type.Optional(Type.String()),
  workLocationPreference: Type.Optional(Type.String()),
  securityClearance: Type.Optional(Type.String()),
  photoUrl: Type.Optional(Type.String()),
  biography: Type.Optional(Type.String()),
  skills: Type.Optional(Type.Array(Type.Any())),
  certifications: Type.Optional(Type.Array(Type.Any())),
  education: Type.Optional(Type.Array(Type.Any())),
  tags: Type.Optional(Type.Array(Type.String())),
  active: Type.Boolean(),
  fromTs: Type.String(),
  toTs: Type.Optional(Type.String()),
  created: Type.String(),
  updated: Type.String(),
});

const CreateEmployeeSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  addr: Type.Optional(Type.String()),
  email: Type.Optional(Type.String({ format: 'email' })),
  password: Type.Optional(Type.String({ minLength: 6 })),
  phone: Type.Optional(Type.String()),
  mobile: Type.Optional(Type.String()),
  emergencyContact: Type.Optional(Type.Object({})),
  preferredLanguage: Type.Optional(Type.String()),
  dateOfBirth: Type.Optional(Type.String({ format: 'date' })),
  employeeNumber: Type.Optional(Type.String()),
  hireDate: Type.Optional(Type.String({ format: 'date' })),
  terminationDate: Type.Optional(Type.String({ format: 'date' })),
  employmentStatus: Type.Optional(Type.String()),
  employmentType: Type.Optional(Type.String()),
  managerEmpId: Type.Optional(Type.String()),
  workLocationPreference: Type.Optional(Type.String()),
  securityClearance: Type.Optional(Type.String()),
  photoUrl: Type.Optional(Type.String()),
  biography: Type.Optional(Type.String()),
  skills: Type.Optional(Type.Array(Type.Any())),
  certifications: Type.Optional(Type.Array(Type.Any())),
  education: Type.Optional(Type.Array(Type.Any())),
  tags: Type.Optional(Type.Array(Type.String())),
  active: Type.Optional(Type.Boolean()),
  fromTs: Type.Optional(Type.String({ format: 'date-time' })),
});

const UpdateEmployeeSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1 })),
  descr: Type.Optional(Type.String()),
  addr: Type.Optional(Type.String()),
  email: Type.Optional(Type.String({ format: 'email' })),
  phone: Type.Optional(Type.String()),
  mobile: Type.Optional(Type.String()),
  emergencyContact: Type.Optional(Type.Object({})),
  preferredLanguage: Type.Optional(Type.String()),
  dateOfBirth: Type.Optional(Type.String({ format: 'date' })),
  employeeNumber: Type.Optional(Type.String()),
  hireDate: Type.Optional(Type.String({ format: 'date' })),
  terminationDate: Type.Optional(Type.String({ format: 'date' })),
  employmentStatus: Type.Optional(Type.String()),
  employmentType: Type.Optional(Type.String()),
  managerEmpId: Type.Optional(Type.String()),
  workLocationPreference: Type.Optional(Type.String()),
  securityClearance: Type.Optional(Type.String()),
  photoUrl: Type.Optional(Type.String()),
  biography: Type.Optional(Type.String()),
  skills: Type.Optional(Type.Array(Type.Any())),
  certifications: Type.Optional(Type.Array(Type.Any())),
  education: Type.Optional(Type.Array(Type.Any())),
  tags: Type.Optional(Type.Array(Type.String())),
  active: Type.Optional(Type.Boolean()),
  fromTs: Type.Optional(Type.String({ format: 'date-time' })),
});

// Separate schema for password changes
const ChangePasswordSchema = Type.Object({
  currentPassword: Type.String(),
  newPassword: Type.String({ minLength: 6 }),
});

export async function empRoutes(fastify: FastifyInstance) {
  // List employees
  fastify.get('/api/v1/emp', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        active: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
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
    const { active, search, limit = 50, offset = 0 } = request.query as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    // Check if user has access to view employees - using 'app' scope for general employee access
    const scopeAccess = await checkScopeAccess(userId, 'app', 'view', undefined);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      // Build query conditions
      const conditions = [];
      
      if (active !== undefined) {
        conditions.push(sql`active = ${active}`);
      }
      
      if (search) {
        conditions.push(sql`(
          COALESCE(name, '') ILIKE ${`%${search}%`} OR 
          COALESCE("descr", '') ILIKE ${`%${search}%`} OR 
          COALESCE(addr, '') ILIKE ${`%${search}%`} OR
          COALESCE(email, '') ILIKE ${`%${search}%`} OR
          COALESCE(employee_number, '') ILIKE ${`%${search}%`} OR
          COALESCE(phone, '') ILIKE ${`%${search}%`} OR
          COALESCE(biography, '') ILIKE ${`%${search}%`}
        )`);
      }

      // Get total count
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total 
        FROM app.d_emp 
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      // Get paginated results
      const employees = await db.execute(sql`
        SELECT 
          id,
          name,
          "descr",
          addr,
          email,
          password_hash as "passwordHash",
          phone,
          mobile,
          emergency_contact as "emergencyContact",
          preferred_language as "preferredLanguage",
          date_of_birth as "dateOfBirth",
          employee_number as "employeeNumber",
          sin_hash as "sinHash",
          hire_date as "hireDate",
          termination_date as "terminationDate",
          employment_status as "employmentStatus",
          employment_type as "employmentType",
          manager_emp_id as "managerEmpId",
          work_location_preference as "workLocationPreference",
          security_clearance as "securityClearance",
          photo_url as "photoUrl",
          biography,
          skills,
          certifications,
          education,
          tags,
          active,
          from_ts as "fromTs",
          to_ts as "toTs",
          created,
          updated
        FROM app.d_emp 
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY name ASC NULLS LAST, created DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return {
        data: employees,
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

    const scopeAccess = await checkScopeAccess(userId, 'app', 'view', undefined);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const employee = await db.execute(sql`
        SELECT 
          id,
          name,
          "descr",
          addr,
          email,
          password_hash as "passwordHash",
          phone,
          mobile,
          emergency_contact as "emergencyContact",
          preferred_language as "preferredLanguage",
          date_of_birth as "dateOfBirth",
          employee_number as "employeeNumber",
          sin_hash as "sinHash",
          hire_date as "hireDate",
          termination_date as "terminationDate",
          employment_status as "employmentStatus",
          employment_type as "employmentType",
          manager_emp_id as "managerEmpId",
          work_location_preference as "workLocationPreference",
          security_clearance as "securityClearance",
          photo_url as "photoUrl",
          biography,
          skills,
          certifications,
          education,
          tags,
          active,
          from_ts as "fromTs",
          to_ts as "toTs",
          created,
          updated
        FROM app.d_emp 
        WHERE id = ${id}
      `);

      if (employee.length === 0) {
        return reply.status(404).send({ error: 'Employee not found' });
      }

      return employee[0];
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

    const scopeAccess = await checkScopeAccess(userId, 'app', 'create', undefined);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      // Check for unique employee number if provided
      if (data.employeeNumber) {
        const existingEmpNumber = await db.execute(sql`
          SELECT id FROM app.d_emp WHERE employee_number = ${data.employeeNumber} AND active = true
        `);
        if (existingEmpNumber.length > 0) {
          return reply.status(400).send({ error: 'Employee with this employee number already exists' });
        }
      }
      
      // Check for unique email if provided
      if (data.email) {
        const existingEmail = await db.execute(sql`
          SELECT id FROM app.d_emp WHERE email = ${data.email} AND active = true
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

      const fromTs = data.fromTs || new Date().toISOString();
      const result = await db.execute(sql`
        INSERT INTO app.d_emp (
          name, "descr", addr, email, password_hash, phone, mobile,
          emergency_contact, preferred_language, date_of_birth, employee_number,
          hire_date, termination_date, employment_status, employment_type,
          manager_emp_id, work_location_preference, security_clearance,
          photo_url, biography, skills, certifications, education, tags,
          active, from_ts
        )
        VALUES (
          ${data.name}, ${data.descr || null}, ${data.addr || null}, 
          ${data.email || null}, ${passwordHash}, ${data.phone || null}, ${data.mobile || null},
          ${data.emergencyContact ? JSON.stringify(data.emergencyContact) : '{}'}::jsonb,
          ${data.preferredLanguage || 'en'}, ${data.dateOfBirth || null}, ${data.employeeNumber || null},
          ${data.hireDate || null}, ${data.terminationDate || null}, 
          ${data.employmentStatus || 'active'}, ${data.employmentType || 'full_time'},
          ${data.managerEmpId || null}, ${data.workLocationPreference || 'hybrid'}, 
          ${data.securityClearance || null}, ${data.photoUrl || null}, ${data.biography || null},
          ${data.skills ? JSON.stringify(data.skills) : '[]'}::jsonb,
          ${data.certifications ? JSON.stringify(data.certifications) : '[]'}::jsonb,
          ${data.education ? JSON.stringify(data.education) : '[]'}::jsonb,
          ${data.tags ? JSON.stringify(data.tags) : '[]'}::jsonb,
          ${data.active !== false}, ${fromTs}
        )
        RETURNING 
          id, name, "descr", addr, email, password_hash as "passwordHash",
          phone, mobile, emergency_contact as "emergencyContact",
          preferred_language as "preferredLanguage", date_of_birth as "dateOfBirth",
          employee_number as "employeeNumber", sin_hash as "sinHash",
          hire_date as "hireDate", termination_date as "terminationDate",
          employment_status as "employmentStatus", employment_type as "employmentType",
          manager_emp_id as "managerEmpId", work_location_preference as "workLocationPreference",
          security_clearance as "securityClearance", photo_url as "photoUrl",
          biography, skills, certifications, education, tags,
          active, from_ts as "fromTs", to_ts as "toTs", created, updated
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to create employee' });
      }

      return reply.status(201).send(result[0]);
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

    const scopeAccess = await checkScopeAccess(userId, 'app', 'modify', undefined);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      // Check if employee exists
      const existing = await db.execute(sql`
        SELECT id FROM app.d_emp WHERE id = ${id}
      `);
      
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Employee not found' });
      }

      // Check for unique employee number on update
      if (data.employeeNumber) {
        const existingEmpNumber = await db.execute(sql`
          SELECT id FROM app.d_emp WHERE employee_number = ${data.employeeNumber} AND active = true AND id != ${id}
        `);
        if (existingEmpNumber.length > 0) {
          return reply.status(400).send({ error: 'Employee with this employee number already exists' });
        }
      }
      
      // Check for unique email on update
      if (data.email) {
        const existingEmail = await db.execute(sql`
          SELECT id FROM app.d_emp WHERE email = ${data.email} AND active = true AND id != ${id}
        `);
        if (existingEmail.length > 0) {
          return reply.status(400).send({ error: 'Employee with this email already exists' });
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
      
      if (data.addr !== undefined) {
        updateFields.push(sql`addr = ${data.addr}`);
      }
      
      if (data.email !== undefined) {
        updateFields.push(sql`email = ${data.email}`);
      }
      
      if (data.password !== undefined) {
        const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : null;
        updateFields.push(sql`password_hash = ${passwordHash}`);
      }
      
      if (data.phone !== undefined) {
        updateFields.push(sql`phone = ${data.phone}`);
      }
      
      if (data.mobile !== undefined) {
        updateFields.push(sql`mobile = ${data.mobile}`);
      }
      
      if (data.emergencyContact !== undefined) {
        updateFields.push(sql`emergency_contact = ${data.emergencyContact ? JSON.stringify(data.emergencyContact) : '{}'}::jsonb`);
      }
      
      if (data.preferredLanguage !== undefined) {
        updateFields.push(sql`preferred_language = ${data.preferredLanguage}`);
      }
      
      if (data.dateOfBirth !== undefined) {
        updateFields.push(sql`date_of_birth = ${data.dateOfBirth}`);
      }
      
      if (data.employeeNumber !== undefined) {
        updateFields.push(sql`employee_number = ${data.employeeNumber}`);
      }
      
      if (data.hireDate !== undefined) {
        updateFields.push(sql`hire_date = ${data.hireDate}`);
      }
      
      if (data.terminationDate !== undefined) {
        updateFields.push(sql`termination_date = ${data.terminationDate}`);
      }
      
      if (data.employmentStatus !== undefined) {
        updateFields.push(sql`employment_status = ${data.employmentStatus}`);
      }
      
      if (data.employmentType !== undefined) {
        updateFields.push(sql`employment_type = ${data.employmentType}`);
      }
      
      if (data.managerEmpId !== undefined) {
        updateFields.push(sql`manager_emp_id = ${data.managerEmpId}`);
      }
      
      if (data.workLocationPreference !== undefined) {
        updateFields.push(sql`work_location_preference = ${data.workLocationPreference}`);
      }
      
      if (data.securityClearance !== undefined) {
        updateFields.push(sql`security_clearance = ${data.securityClearance}`);
      }
      
      if (data.photoUrl !== undefined) {
        updateFields.push(sql`photo_url = ${data.photoUrl}`);
      }
      
      if (data.biography !== undefined) {
        updateFields.push(sql`biography = ${data.biography}`);
      }
      
      if (data.skills !== undefined) {
        updateFields.push(sql`skills = ${data.skills ? JSON.stringify(data.skills) : '[]'}::jsonb`);
      }
      
      if (data.certifications !== undefined) {
        updateFields.push(sql`certifications = ${data.certifications ? JSON.stringify(data.certifications) : '[]'}::jsonb`);
      }
      
      if (data.education !== undefined) {
        updateFields.push(sql`education = ${data.education ? JSON.stringify(data.education) : '[]'}::jsonb`);
      }
      
      if (data.tags !== undefined) {
        updateFields.push(sql`tags = ${data.tags ? JSON.stringify(data.tags) : '[]'}::jsonb`);
      }
      
      if (data.active !== undefined) {
        updateFields.push(sql`active = ${data.active}`);
      }

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.d_emp 
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING 
          id, name, "descr", addr, email, password_hash as "passwordHash",
          phone, mobile, emergency_contact as "emergencyContact",
          preferred_language as "preferredLanguage", date_of_birth as "dateOfBirth",
          employee_number as "employeeNumber", sin_hash as "sinHash",
          hire_date as "hireDate", termination_date as "terminationDate",
          employment_status as "employmentStatus", employment_type as "employmentType",
          manager_emp_id as "managerEmpId", work_location_preference as "workLocationPreference",
          security_clearance as "securityClearance", photo_url as "photoUrl",
          biography, skills, certifications, education, tags,
          active, from_ts as "fromTs", to_ts as "toTs", created, updated
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to update employee' });
      }

      return result[0];
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

    const scopeAccess = await checkScopeAccess(userId, 'app', 'delete', undefined);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      // Check if employee exists
      const existing = await db.execute(sql`
        SELECT id FROM app.d_emp WHERE id = ${id}
      `);
      
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Employee not found' });
      }

      // Soft delete
      await db.execute(sql`
        UPDATE app.d_emp 
        SET active = false, to_ts = NOW(), updated = NOW()
        WHERE id = ${id}
      `);

      return reply.status(204).send();
    } catch (error) {
      fastify.log.error('Error deleting employee:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get employee scopes and permissions
  fastify.get('/api/v1/emp/:id/scopes', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          employee: EmployeeSchema,
          scopes: Type.Array(Type.Object({
            scopeType: Type.String(),
            scopeId: Type.Optional(Type.String()),
            scopeName: Type.String(),
            permissions: Type.Array(Type.Number()),
          })),
        }),
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

    const scopeAccess = await checkScopeAccess(userId, 'app', 'view', undefined);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      // Get employee
      const employee = await db.execute(sql`
        SELECT 
          id,
          name,
          "descr",
          addr,
          email,
          tags,
          active,
          from_ts as "fromTs",
          to_ts as "toTs",
          created,
          updated
        FROM app.d_emp 
        WHERE id = ${id}
      `);

      if (employee.length === 0) {
        return reply.status(404).send({ error: 'Employee not found' });
      }

      // Get employee scopes
      const scopes = await db.execute(sql`
        SELECT 
          rus.resource_type as "scopeType",
          rus.scope_id as "scopeId",
          ds.scope_name as "scopeName",
          rus.resource_permission as "permissions"
        FROM app.rel_employee_scope_unified rus
        JOIN app.d_scope_unified ds ON rus.scope_id = ds.id
        WHERE rus.emp_id = ${id} AND rus.active = true
        ORDER BY rus.resource_type, ds.scope_name
      `);

      return {
        employee: employee[0],
        scopes,
      };
    } catch (error) {
      fastify.log.error('Error fetching employee scopes:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Change employee password
  fastify.put('/api/v1/emp/:id/password', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      body: ChangePasswordSchema,
      response: {
        200: Type.Object({ message: Type.String() }),
        400: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { currentPassword, newPassword } = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    // Only allow users to change their own password or admins
    const isOwnPassword = userId === id;
    const scopeAccess = await checkScopeAccess(userId, 'app', 'modify', undefined);
    
    if (!isOwnPassword && !scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      // Get current password hash
      const employee = await db.execute(sql`
        SELECT password_hash FROM app.d_emp WHERE id = ${id} AND active = true
      `);

      if (employee.length === 0) {
        return reply.status(404).send({ error: 'Employee not found' });
      }

      const currentHash = employee[0]?.password_hash as string | null;
      if (!currentHash || !await bcrypt.compare(currentPassword, currentHash)) {
        return reply.status(400).send({ error: 'Current password is incorrect' });
      }

      // Update password
      const newPasswordHash = await bcrypt.hash(newPassword, 10);
      await db.execute(sql`
        UPDATE app.d_emp 
        SET password_hash = ${newPasswordHash}, updated = NOW()
        WHERE id = ${id}
      `);

      return { message: 'Password updated successfully' };
    } catch (error) {
      fastify.log.error('Error changing password:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get employee hierarchy (manager chain)
  fastify.get('/api/v1/emp/:id/hierarchy', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          employee: EmployeeSchema,
          manager: Type.Optional(EmployeeSchema),
          directReports: Type.Array(EmployeeSchema),
          managerChain: Type.Array(EmployeeSchema),
        }),
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

    const scopeAccess = await checkScopeAccess(userId, 'app', 'view', undefined);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      // Get employee
      const employee = await db.execute(sql`
        SELECT 
          id, name, "descr", addr, email, password_hash as "passwordHash",
          phone, mobile, emergency_contact as "emergencyContact",
          preferred_language as "preferredLanguage", date_of_birth as "dateOfBirth",
          employee_number as "employeeNumber", sin_hash as "sinHash",
          hire_date as "hireDate", termination_date as "terminationDate",
          employment_status as "employmentStatus", employment_type as "employmentType",
          manager_emp_id as "managerEmpId", work_location_preference as "workLocationPreference",
          security_clearance as "securityClearance", photo_url as "photoUrl",
          biography, skills, certifications, education, tags,
          active, from_ts as "fromTs", to_ts as "toTs", created, updated
        FROM app.d_emp 
        WHERE id = ${id} AND active = true
      `);

      if (employee.length === 0) {
        return reply.status(404).send({ error: 'Employee not found' });
      }

      const emp = employee[0];
      if (!emp) {
        return reply.status(404).send({ error: 'Employee not found' });
      }

      // Get direct manager
      let manager = null;
      if (emp.managerEmpId) {
        const managerResult = await db.execute(sql`
          SELECT 
            id, name, "descr", addr, email, password_hash as "passwordHash",
            phone, mobile, emergency_contact as "emergencyContact",
            preferred_language as "preferredLanguage", date_of_birth as "dateOfBirth",
            employee_number as "employeeNumber", sin_hash as "sinHash",
            hire_date as "hireDate", termination_date as "terminationDate",
            employment_status as "employmentStatus", employment_type as "employmentType",
            manager_emp_id as "managerEmpId", work_location_preference as "workLocationPreference",
            security_clearance as "securityClearance", photo_url as "photoUrl",
            biography, skills, certifications, education, tags,
            active, from_ts as "fromTs", to_ts as "toTs", created, updated
          FROM app.d_emp 
          WHERE id = ${emp.managerEmpId!} AND active = true
        `);
        manager = managerResult[0] || null;
      }

      // Get direct reports
      const directReports = await db.execute(sql`
        SELECT 
          id, name, "descr", addr, email, password_hash as "passwordHash",
          phone, mobile, emergency_contact as "emergencyContact",
          preferred_language as "preferredLanguage", date_of_birth as "dateOfBirth",
          employee_number as "employeeNumber", sin_hash as "sinHash",
          hire_date as "hireDate", termination_date as "terminationDate",
          employment_status as "employmentStatus", employment_type as "employmentType",
          manager_emp_id as "managerEmpId", work_location_preference as "workLocationPreference",
          security_clearance as "securityClearance", photo_url as "photoUrl",
          biography, skills, certifications, education, tags,
          active, from_ts as "fromTs", to_ts as "toTs", created, updated
        FROM app.d_emp 
        WHERE manager_emp_id = ${id} AND active = true
        ORDER BY name
      `);

      // Get manager chain (recursive query)
      const managerChain = await db.execute(sql`
        WITH RECURSIVE manager_hierarchy AS (
          -- Start with the employee's manager
          SELECT 
            id, name, "descr", addr, email, password_hash as "passwordHash",
            phone, mobile, emergency_contact as "emergencyContact",
            preferred_language as "preferredLanguage", date_of_birth as "dateOfBirth",
            employee_number as "employeeNumber", sin_hash as "sinHash",
            hire_date as "hireDate", termination_date as "terminationDate",
            employment_status as "employmentStatus", employment_type as "employmentType",
            manager_emp_id as "managerEmpId", work_location_preference as "workLocationPreference",
            security_clearance as "securityClearance", photo_url as "photoUrl",
            biography, skills, certifications, education, tags,
            active, from_ts as "fromTs", to_ts as "toTs", created, updated,
            1 as level
          FROM app.d_emp 
          WHERE id = ${emp.managerEmpId || 'null'} AND active = true
          
          UNION ALL
          
          -- Recursively get the manager's manager
          SELECT 
            e.id, e.name, e."descr", e.addr, e.email, e.password_hash as "passwordHash",
            e.phone, e.mobile, e.emergency_contact as "emergencyContact",
            e.preferred_language as "preferredLanguage", e.date_of_birth as "dateOfBirth",
            e.employee_number as "employeeNumber", e.sin_hash as "sinHash",
            e.hire_date as "hireDate", e.termination_date as "terminationDate",
            e.employment_status as "employmentStatus", e.employment_type as "employmentType",
            e.manager_emp_id as "managerEmpId", e.work_location_preference as "workLocationPreference",
            e.security_clearance as "securityClearance", e.photo_url as "photoUrl",
            e.biography, e.skills, e.certifications, e.education, e.tags,
            e.active, e.from_ts as "fromTs", e.to_ts as "toTs", e.created, e.updated,
            mh.level + 1
          FROM app.d_emp e
          INNER JOIN manager_hierarchy mh ON e.id = mh."managerEmpId"
          WHERE e.active = true AND mh.level < 10  -- Prevent infinite recursion
        )
        SELECT * FROM manager_hierarchy ORDER BY level
      `);

      return {
        employee: emp,
        manager,
        directReports,
        managerChain,
      };
    } catch (error) {
      fastify.log.error('Error fetching employee hierarchy:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}