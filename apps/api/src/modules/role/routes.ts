import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { eq, and, isNull, desc, asc, sql } from 'drizzle-orm';

const RoleSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  roleType: Type.Optional(Type.String()),
  roleCategory: Type.Optional(Type.String()),
  authorityLevel: Type.Optional(Type.String()),
  approvalLimit: Type.Optional(Type.Number()),
  delegationAllowed: Type.Optional(Type.Boolean()),
  active: Type.Boolean(),
  fromTs: Type.String(),
  toTs: Type.Optional(Type.String()),
  created: Type.String(),
  updated: Type.String(),
  tags: Type.Optional(Type.Array(Type.String())),
  attr: Type.Optional(Type.Any()),
});

const CreateRoleSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  roleType: Type.Optional(Type.String()),
  roleCategory: Type.Optional(Type.String()),
  authorityLevel: Type.Optional(Type.String()),
  approvalLimit: Type.Optional(Type.Number()),
  delegationAllowed: Type.Optional(Type.Boolean()),
  active: Type.Optional(Type.Boolean()),
  fromTs: Type.Optional(Type.String({ format: 'date-time' })),
  tags: Type.Optional(Type.Array(Type.String())),
  attr: Type.Optional(Type.Any()),
});

const UpdateRoleSchema = Type.Partial(CreateRoleSchema);

export async function roleRoutes(fastify: FastifyInstance) {
  // List roles
  fastify.get('/api/v1/role', {
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


    try {
      // Build query conditions
      const conditions = [];
      
      if (active !== undefined) {
        conditions.push(sql`active_flag = ${active}`);
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
          role_code as "roleType",
          role_category as "roleCategory",
          reporting_level as "authorityLevel",
          required_experience_years as "approvalLimit",
          is_management_role as "delegationAllowed",
          active,
          from_ts as "fromTs",
          to_ts as "toTs",
          created,
          updated,
          tags,
          attr
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


    try {
      const role = await db.execute(sql`
        SELECT 
          id,
          name,
          "descr",
          role_code as "roleType",
          role_category as "roleCategory",
          reporting_level as "authorityLevel",
          required_experience_years as "approvalLimit",
          is_management_role as "delegationAllowed",
          active,
          from_ts as "fromTs",
          to_ts as "toTs",
          created,
          updated,
          tags,
          attr
        FROM app.d_role 
        WHERE id = ${id} AND active_flag = true
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


    try {
      // Check for unique name
      const existingRole = await db.execute(sql`
        SELECT id FROM app.d_role WHERE name = ${data.name} AND active_flag = true
      `);
      if (existingRole.length > 0) {
        return reply.status(400).send({ error: 'Role with this name already exists' });
      }

      const fromTs = data.fromTs || new Date().toISOString();
      
      const result = await db.execute(sql`
        INSERT INTO app.d_role (name, "descr", role_code, role_category, reporting_level, required_experience_years, is_management_role, active, from_ts, tags, attr)
        VALUES (${data.name}, ${data.descr || null}, ${data.roleType || 'functional'}, ${data.roleCategory || null}, ${data.authorityLevel || 'standard'}, ${data.approvalLimit || null}, ${data.delegationAllowed !== undefined ? data.delegationAllowed : false}, ${data.active !== false}, ${fromTs}, ${JSON.stringify(data.tags || [])}, ${JSON.stringify(data.attr || {})})
        RETURNING 
          id,
          name,
          "descr",
          role_code as "roleType",
          role_category as "roleCategory",
          reporting_level as "authorityLevel",
          required_experience_years as "approvalLimit",
          is_management_role as "delegationAllowed",
          active,
          from_ts as "fromTs",
          to_ts as "toTs",
          created,
          updated,
          tags,
          attr
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


    try {
      // Check if role exists
      const existing = await db.execute(sql`
        SELECT id FROM app.d_role WHERE id = ${id} AND active_flag = true
      `);
      
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Role not found' });
      }

      // Check for unique name on update
      if (data.name) {
        const existingName = await db.execute(sql`
          SELECT id FROM app.d_role WHERE name = ${data.name} AND active_flag = true AND id != ${id}
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
      
      if (data.roleType !== undefined) {
        updateFields.push(sql`role_code = ${data.roleType}`);
      }
      
      if (data.roleCategory !== undefined) {
        updateFields.push(sql`role_category = ${data.roleCategory}`);
      }
      
      if (data.authorityLevel !== undefined) {
        updateFields.push(sql`reporting_level = ${data.authorityLevel}`);
      }
      
      if (data.approvalLimit !== undefined) {
        updateFields.push(sql`required_experience_years = ${data.approvalLimit}`);
      }
      
      if (data.delegationAllowed !== undefined) {
        updateFields.push(sql`is_management_role = ${data.delegationAllowed}`);
      }
      
      if (data.tags !== undefined) {
        updateFields.push(sql`tags = ${JSON.stringify(data.tags)}`);
      }
      
      if (data.attr !== undefined) {
        updateFields.push(sql`attr = ${JSON.stringify(data.attr)}`);
      }
      
      if (data.active !== undefined) {
        updateFields.push(sql`active_flag = ${data.active}`);
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
          role_code as "roleType",
          role_category as "roleCategory",
          reporting_level as "authorityLevel",
          required_experience_years as "approvalLimit",
          is_management_role as "delegationAllowed",
          active,
          from_ts as "fromTs",
          to_ts as "toTs",
          created,
          updated,
          tags,
          attr
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


    try {
      // Check if role exists
      const existing = await db.execute(sql`
        SELECT id FROM app.d_role WHERE id = ${id} AND active_flag = true
      `);
      
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Role not found' });
      }

      // Check if role is assigned to any employees
      const assignedEmployees = await db.execute(sql`
        SELECT COUNT(*) as count FROM app.rel_emp_role WHERE role_id = ${id} AND active_flag = true
      `);
      
      if (Number(assignedEmployees[0]?.count || 0) > 0) {
        return reply.status(400).send({ error: 'Cannot delete role that is assigned to employees' });
      }

      // Soft delete
      await db.execute(sql`
        UPDATE app.d_role 
        SET active_flag = false, to_ts = NOW(), updated = NOW()
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


    try {
      // Get role
      const role = await db.execute(sql`
        SELECT 
          id,
          name,
          "descr",
          role_code as "roleType",
          role_category as "roleCategory",
          reporting_level as "authorityLevel",
          required_experience_years as "approvalLimit",
          is_management_role as "delegationAllowed",
          active,
          from_ts as "fromTs",
          to_ts as "toTs",
          created,
          updated,
          tags,
          attr
        FROM app.d_role 
        WHERE id = ${id} AND active_flag = true
      `);

      if (role.length === 0) {
        return reply.status(404).send({ error: 'Role not found' });
      }

      // Get role permissions from entity-based RBAC
      const permissions = await db.execute(sql`
        SELECT 
          'role' as "scopeType",
          r.id as "scopeId",
          r.name as "scopeName",
          ARRAY['view'] as "permissions"
        FROM app.d_role r
        WHERE r.id = ${id} AND r.active_flag = true
        ORDER BY r.name
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