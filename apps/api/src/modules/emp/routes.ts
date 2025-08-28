import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { checkScopeAccess, Permission } from '../rbac/scope-auth.js';
import { db } from '@/db/index.js';
import { eq, and, isNull, desc, asc, sql, like } from 'drizzle-orm';
import bcrypt from 'bcrypt';

const EmployeeSchema = Type.Object({
  id: Type.String(),
  name: Type.Optional(Type.String()),
  descr: Type.Optional(Type.String()),
  addr: Type.Optional(Type.String()),
  email: Type.Optional(Type.String()),
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
  tags: Type.Optional(Type.Array(Type.String())),
  active: Type.Optional(Type.Boolean()),
  fromTs: Type.Optional(Type.String({ format: 'date-time' })),
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
          COALESCE(email, '') ILIKE ${`%${search}%`}
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
      // Check for unique name within active employees
      if (data.name) {
        const existingName = await db.execute(sql`
          SELECT id FROM app.d_emp WHERE name = ${data.name} AND active = true
        `);
        if (existingName.length > 0) {
          return reply.status(400).send({ error: 'Employee with this name already exists' });
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
        INSERT INTO app.d_emp (name, "descr", addr, email, password_hash, tags, active, from_ts)
        VALUES (${data.name}, ${data.descr || null}, ${data.addr || null}, ${data.email || null}, ${passwordHash}, ${data.tags ? JSON.stringify(data.tags) : '[]'}::jsonb, ${data.active !== false}, ${fromTs})
        RETURNING 
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

      // Check for unique name on update
      if (data.name) {
        const existingName = await db.execute(sql`
          SELECT id FROM app.d_emp WHERE name = ${data.name} AND active = true AND id != ${id}
        `);
        if (existingName.length > 0) {
          return reply.status(400).send({ error: 'Employee with this name already exists' });
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
          scope_type as "scopeType",
          scope_id as "scopeId",
          scope_name as "scopeName",
          scope_permission as "permissions"
        FROM app.rel_user_scope 
        WHERE emp_id = ${id} AND active = true
        ORDER BY scope_type, scope_name
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
}