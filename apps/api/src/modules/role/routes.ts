import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { checkScopeAccess, Permission } from '../rbac/scope-auth.js';
import { db } from '@/db/index.js';
import { eq, and, isNull, desc, asc, sql } from 'drizzle-orm';

const RoleSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  active: Type.Boolean(),
  fromTs: Type.String(),
  toTs: Type.Optional(Type.String()),
  created: Type.String(),
  updated: Type.String(),
});

const CreateRoleSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  active: Type.Optional(Type.Boolean()),
  fromTs: Type.Optional(Type.String({ format: 'date-time' })),
});

const UpdateRoleSchema = Type.Partial(CreateRoleSchema);

export async function roleRoutes(fastify: FastifyInstance) {
  // List roles
  fastify.get('/api/v1/role', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        active: Type.Optional(Type.Boolean()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(RoleSchema),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number(),
        }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { active, limit = 50, offset = 0 } = request.query as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    };

    const scopeAccess = await checkScopeAccess(userId, 'role', 'view', undefined);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      // Build query conditions
      const conditions = [];
      
      if (active !== undefined) {
        conditions.push(sql`active = ${active}`);
      }

      // Get total count
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total 
        FROM app.d_role 
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      // Get paginated results
      const roles = await db.execute(sql`
        SELECT 
          id,
          name,
          "descr",
          active,
          from_ts as "fromTs",
          to_ts as "toTs",
          created,
          updated
        FROM app.d_role 
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY name ASC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return {
        data: roles,
        total,
        limit,
        offset,
      };
    } catch (error) {
      fastify.log.error('Error fetching roles:');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single role
  fastify.get('/api/v1/role/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: RoleSchema,
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

    const scopeAccess = await checkScopeAccess(userId, 'role', 'view', id);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const role = await db.execute(sql`
        SELECT 
          id,
          name,
          "descr",
          active,
          from_ts as "fromTs",
          to_ts as "toTs",
          created,
          updated
        FROM app.d_role 
        WHERE id = ${id} AND active = true
      `);

      if (role.length === 0) {
        return reply.status(404).send({ error: 'Role not found' });
      }

      return role[0];
    } catch (error) {
      fastify.log.error('Error fetching role:');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create role
  fastify.post('/api/v1/role', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateRoleSchema,
      response: {
        201: RoleSchema,
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

    const scopeAccess = await checkScopeAccess(userId, 'role', 'create', undefined);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      // Check for unique name
      const existingRole = await db.execute(sql`
        SELECT id FROM app.d_role WHERE name = ${data.name} AND active = true
      `);
      if (existingRole.length > 0) {
        return reply.status(400).send({ error: 'Role with this name already exists' });
      }

      const fromTs = data.fromTs || new Date().toISOString();
      
      const result = await db.execute(sql`
        INSERT INTO app.d_role (name, "descr", active, from_ts)
        VALUES (${data.name}, ${data.descr || null}, ${data.active !== false}, ${fromTs})
        RETURNING 
          id,
          name,
          "descr",
          active,
          from_ts as "fromTs",
          to_ts as "toTs",
          created,
          updated
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to create role' });
      }

      return reply.status(201).send(result[0]);
    } catch (error) {
      fastify.log.error('Error creating role:');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update role
  fastify.put('/api/v1/role/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      body: UpdateRoleSchema,
      response: {
        200: RoleSchema,
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
    };

    const scopeAccess = await checkScopeAccess(userId, 'role', 'modify', id);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      // Check if role exists
      const existing = await db.execute(sql`
        SELECT id FROM app.d_role WHERE id = ${id} AND active = true
      `);
      
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Role not found' });
      }

      // Check for unique name on update
      if (data.name) {
        const existingName = await db.execute(sql`
          SELECT id FROM app.d_role WHERE name = ${data.name} AND active = true AND id != ${id}
        `);
        if (existingName.length > 0) {
          return reply.status(400).send({ error: 'Role with this name already exists' });
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
      
      if (data.active !== undefined) {
        updateFields.push(sql`active = ${data.active}`);
      }

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.d_role 
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING 
          id,
          name,
          "descr",
          active,
          from_ts as "fromTs",
          to_ts as "toTs",
          created,
          updated
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to update role' });
      }

      return result[0];
    } catch (error) {
      fastify.log.error('Error updating role:');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete role (soft delete)
  fastify.delete('/api/v1/role/:id', {
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

    const scopeAccess = await checkScopeAccess(userId, 'role', 'delete', id);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      // Check if role exists
      const existing = await db.execute(sql`
        SELECT id FROM app.d_role WHERE id = ${id} AND active = true
      `);
      
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Role not found' });
      }

      // Check if role is assigned to any employees
      const assignedEmployees = await db.execute(sql`
        SELECT COUNT(*) as count FROM app.rel_emp_role WHERE role_id = ${id} AND active = true
      `);
      
      if (Number(assignedEmployees[0]?.count || 0) > 0) {
        return reply.status(400).send({ error: 'Cannot delete role that is assigned to employees' });
      }

      // Soft delete
      await db.execute(sql`
        UPDATE app.d_role 
        SET active = false, to_ts = NOW(), updated = NOW()
        WHERE id = ${id}
      `);

      return reply.status(204).send();
    } catch (error) {
      fastify.log.error('Error deleting role:');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get role permissions across scopes
  fastify.get('/api/v1/role/:id/permissions', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          role: RoleSchema,
          permissions: Type.Array(Type.Object({
            scopeType: Type.String(),
            scopeId: Type.String(),
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
    };

    const scopeAccess = await checkScopeAccess(userId, 'role', 'view', id);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      // Get role
      const role = await db.execute(sql`
        SELECT 
          id,
          name,
          "descr",
          active,
          from_ts as "fromTs",
          to_ts as "toTs",
          created,
          updated
        FROM app.d_role 
        WHERE id = ${id} AND active = true
      `);

      if (role.length === 0) {
        return reply.status(404).send({ error: 'Role not found' });
      }

      // Get role permissions
      const permissions = await db.execute(sql`
        SELECT 
          scope_type as "scopeType",
          scope_id as "scopeId",
          scope_name as "scopeName",
          scope_permission as "permissions"
        FROM app.rel_role_scope 
        WHERE role_id = ${id} AND active = true
        ORDER BY scope_type, scope_name
      `);

      return {
        role: role[0],
        permissions,
      };
    } catch (error) {
      fastify.log.error('Error fetching role permissions:');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}