import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { eq, and, isNull, desc, asc, sql } from 'drizzle-orm';
import { createPaginatedResponse } from '../../lib/universal-schema-metadata.js';

const RoleSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  role_code: Type.Optional(Type.String()),
  role_category: Type.Optional(Type.String()),
  reporting_level: Type.Optional(Type.Number()),
  required_experience_years: Type.Optional(Type.Number()),
  management_role_flag: Type.Optional(Type.Boolean()),
  client_facing_flag: Type.Optional(Type.Boolean()),
  safety_critical_flag: Type.Optional(Type.Boolean()),
  background_check_required_flag: Type.Optional(Type.Boolean()),
  bonding_required_flag: Type.Optional(Type.Boolean()),
  licensing_required_flag: Type.Optional(Type.Boolean()),
  active_flag: Type.Boolean(),
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.String()),
  created_ts: Type.String(),
  updated_ts: Type.String(),
  metadata: Type.Optional(Type.Any())});

const CreateRoleSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  role_code: Type.Optional(Type.String()),
  role_category: Type.Optional(Type.String()),
  reporting_level: Type.Optional(Type.Number()),
  required_experience_years: Type.Optional(Type.Number()),
  management_role_flag: Type.Optional(Type.Boolean()),
  client_facing_flag: Type.Optional(Type.Boolean()),
  safety_critical_flag: Type.Optional(Type.Boolean()),
  background_check_required_flag: Type.Optional(Type.Boolean()),
  bonding_required_flag: Type.Optional(Type.Boolean()),
  licensing_required_flag: Type.Optional(Type.Boolean()),
  active_flag: Type.Optional(Type.Boolean()),
  from_ts: Type.Optional(Type.String({ format: 'date-time' })),
  metadata: Type.Optional(Type.Any())});

const UpdateRoleSchema = Type.Partial(CreateRoleSchema);

export async function roleRoutes(fastify: FastifyInstance) {
  // List roles
  fastify.get('/api/v1/role', {
    schema: {
      querystring: Type.Object({
        active: Type.Optional(Type.Boolean()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
        page: Type.Optional(Type.Number({ minimum: 1 }))}),
      response: {
        200: Type.Object({
          data: Type.Array(RoleSchema),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number()}),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    const { active, limit = 20, offset: queryOffset, page } = request.query as any;
    const offset = page ? (page - 1) * limit : (queryOffset !== undefined ? queryOffset : 0);


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
          role_code,
          role_category,
          reporting_level,
          required_experience_years,
          management_role_flag,
          client_facing_flag,
          safety_critical_flag,
          background_check_required_flag,
          bonding_required_flag,
          licensing_required_flag,
          active_flag,
          from_ts,
          to_ts,
          created_ts,
          updated_ts,
          metadata
        FROM app.d_role
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY name ASC
        LIMIT ${limit} OFFSET ${offset}
      `);

      // Return data directly in snake_case format (no transformation needed)
      return createPaginatedResponse(roles, total, limit, offset);
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
        id: Type.String({ format: 'uuid' })}),
      response: {
        200: RoleSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    const { id } = request.params as { id: string };


    try {
      const role = await db.execute(sql`
        SELECT
          id,
          name,
          "descr",
          role_code,
          role_category,
          reporting_level,
          required_experience_years,
          management_role_flag,
          active_flag,
          from_ts,
          to_ts,
          created_ts,
          updated_ts,
          metadata
        FROM app.d_role
        WHERE id = ${id} AND active_flag = true
      `);

      if (role.length === 0) {
        return reply.status(404).send({ error: 'Role not found' });
      }

      // Transform database result to match schema
      const transformedRole = {
        id: role[0].id,
        name: role[0].name,
        descr: role[0].descr,
        roleType: role[0].role_code,
        roleCategory: role[0].role_category,
        authorityLevel: role[0].reporting_level,
        approvalLimit: role[0].required_experience_years,
        delegationAllowed: role[0].management_role_flag,
        active: role[0].active_flag,
        fromTs: role[0].from_ts,
        toTs: role[0].to_ts,
        created: role[0].created_ts,
        updated: role[0].updated_ts,
        attr: role[0].metadata
      };

      return transformedRole;
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
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
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
        INSERT INTO app.d_role (name, "descr", role_code, role_category, reporting_level, required_experience_years, management_role_flag, active_flag, from_ts, metadata)
        VALUES (${data.name}, ${data.descr || null}, ${data.roleType || 'functional'}, ${data.roleCategory || 'operational'}, ${data.authorityLevel || 0}, ${data.approvalLimit || 0}, ${data.delegationAllowed !== undefined ? data.delegationAllowed : false}, ${data.active !== false}, ${fromTs}, ${JSON.stringify(data.attr || {})})
        RETURNING
          id,
          name,
          "descr",
          role_code,
          role_category,
          reporting_level,
          required_experience_years,
          management_role_flag,
          active_flag,
          from_ts,
          to_ts,
          created_ts,
          updated_ts,
          metadata
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to create role' });
      }

      // Transform database result to match schema
      const transformedRole = {
        id: result[0].id,
        name: result[0].name,
        descr: result[0].descr,
        roleType: result[0].role_code,
        roleCategory: result[0].role_category,
        authorityLevel: result[0].reporting_level,
        approvalLimit: result[0].required_experience_years,
        delegationAllowed: result[0].management_role_flag,
        active: result[0].active_flag,
        fromTs: result[0].from_ts,
        toTs: result[0].to_ts,
        created: result[0].created_ts,
        updated: result[0].updated_ts,
        attr: result[0].metadata
      };

      return reply.status(201).send(transformedRole);
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
        id: Type.String({ format: 'uuid' })}),
      body: UpdateRoleSchema,
      response: {
        200: RoleSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
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
        updateFields.push(sql`management_role_flag = ${data.delegationAllowed}`);
      }

      if (data.attr !== undefined) {
        updateFields.push(sql`metadata = ${JSON.stringify(data.attr)}::jsonb`);
      }

      if (data.active !== undefined) {
        updateFields.push(sql`active_flag = ${data.active}`);
      }

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated_ts = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.d_role
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING
          id,
          name,
          "descr",
          role_code,
          role_category,
          reporting_level,
          required_experience_years,
          management_role_flag,
          active_flag,
          from_ts,
          to_ts,
          created_ts,
          updated_ts,
          metadata
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to update role' });
      }

      // Transform database result to match schema
      const transformedRole = {
        id: result[0].id,
        name: result[0].name,
        descr: result[0].descr,
        roleType: result[0].role_code,
        roleCategory: result[0].role_category,
        authorityLevel: result[0].reporting_level,
        approvalLimit: result[0].required_experience_years,
        delegationAllowed: result[0].management_role_flag,
        active: result[0].active_flag,
        fromTs: result[0].from_ts,
        toTs: result[0].to_ts,
        created: result[0].created_ts,
        updated: result[0].updated_ts,
        attr: result[0].metadata
      };

      return transformedRole;
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
        id: Type.String({ format: 'uuid' })}),
      response: {
        204: Type.Null(),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    const { id } = request.params as { id: string };


    try {
      // Check if role exists
      const existing = await db.execute(sql`
        SELECT id FROM app.d_role WHERE id = ${id} AND active_flag = true
      `);
      
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Role not found' });
      }

      // Check if role is assigned to any employees using d_entity_id_map
      const assignedEmployees = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM app.d_entity_id_map
        WHERE parent_entity_type = 'role'
          AND parent_entity_id = ${id}
          AND child_entity_type = 'employee'
          AND active_flag = true
      `);

      if (Number(assignedEmployees[0]?.count || 0) > 0) {
        return reply.status(400).send({ error: 'Cannot delete role that is assigned to employees' });
      }

      // Soft delete
      await db.execute(sql`
        UPDATE app.d_role
        SET active_flag = false, to_ts = NOW(), updated_ts = NOW()
        WHERE id = ${id}
      `);

      return reply.status(204).send();
    } catch (error) {
      fastify.log.error('Error deleting role:');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get role dynamic child entity tabs - for tab navigation
  fastify.get('/api/v1/role/:id/dynamic-child-entity-tabs', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
      response: {
        200: Type.Object({
          action_entities: Type.Array(Type.Object({
            actionEntity: Type.String(),
            count: Type.Number(),
            label: Type.String(),
            icon: Type.Optional(Type.String())
          })),
          role_id: Type.String()
        }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    try {
      const { id: roleId } = request.params as { id: string };
      const userId = (request as any).user?.sub;

      if (!userId) {
        return reply.status(401).send({ error: 'User not authenticated' });
      }

      // Direct RBAC check for role access
      const roleAccess = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map rbac
        WHERE rbac.empid = ${userId}
          AND rbac.entity = 'role'
          AND (rbac.entity_id = ${roleId}::text OR rbac.entity_id = 'all')
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND 0 = ANY(rbac.permission)
      `);

      if (roleAccess.length === 0) {
        return reply.status(403).send({ error: 'Insufficient permissions to view this role' });
      }

      // Check if role exists
      const role = await db.execute(sql`
        SELECT id FROM app.d_role WHERE id = ${roleId} AND active_flag = true
      `);

      if (role.length === 0) {
        return reply.status(404).send({ error: 'Role not found' });
      }

      // Get action summaries for this role
      const actionSummaries = [];

      // Count employees assigned to this role
      const employeeCount = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM app.d_employee e
        INNER JOIN app.d_entity_id_map eim ON eim.child_entity_id = e.id::text
        WHERE eim.parent_entity_id = ${roleId}
          AND eim.parent_entity_type = 'role'
          AND eim.child_entity_type = 'employee'
          AND eim.active_flag = true
          AND e.active_flag = true
      `);
      actionSummaries.push({
        actionEntity: 'employee',
        count: Number(employeeCount[0]?.count || 0),
        label: 'Employees',
        icon: 'Users'
      });

      return {
        action_entities: actionSummaries,
        role_id: roleId
      };
    } catch (error) {
      fastify.log.error('Error fetching role action summaries:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get employees assigned to a role
  fastify.get('/api/v1/role/:id/employee', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
      querystring: Type.Object({
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Integer({ minimum: 0 })),
        active: Type.Optional(Type.Boolean())
      }),
      response: {
        200: Type.Object({
          data: Type.Array(Type.Any()),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number()
        }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    try {
      const { id: roleId } = request.params as { id: string };
      const { limit = 50, offset = 0, active } = request.query as any;
      const userId = (request as any).user?.sub;

      if (!userId) {
        return reply.status(401).send({ error: 'User not authenticated' });
      }

      // Direct RBAC check for role access
      const roleAccess = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map rbac
        WHERE rbac.empid = ${userId}
          AND rbac.entity = 'role'
          AND (rbac.entity_id = ${roleId}::text OR rbac.entity_id = 'all')
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND 0 = ANY(rbac.permission)
      `);

      if (roleAccess.length === 0) {
        return reply.status(403).send({ error: 'Access denied for this role' });
      }

      // Check if role exists
      const role = await db.execute(sql`
        SELECT id FROM app.d_role WHERE id = ${roleId} AND active_flag = true
      `);

      if (role.length === 0) {
        return reply.status(404).send({ error: 'Role not found' });
      }

      // Build conditions for employee filtering
      const conditions = [
        sql`eim.parent_entity_type = 'role'`,
        sql`eim.parent_entity_id = ${roleId}`,
        sql`eim.child_entity_type = 'employee'`,
        sql`eim.active_flag = true`
      ];

      if (active !== undefined) {
        conditions.push(sql`e.active_flag = ${active}`);
      } else {
        conditions.push(sql`e.active_flag = true`);
      }

      // Get employees linked to this role via d_entity_id_map
      const employees = await db.execute(sql`
        SELECT
          e.id,
          e.name,
          e.email,
          e.phone,
          e.employee_number,
          e.employee_type,
          e.title,
          e.department,
          e.hire_date,
          e.termination_date,
          e.active_flag,
          e.from_ts,
          e.to_ts,
          e.created_ts,
          e.updated_ts,
          e.tags,
          e.metadata,
          eim.relationship_type,
          eim.from_ts as relationship_from_ts,
          eim.to_ts as relationship_to_ts
        FROM app.d_entity_id_map eim
        INNER JOIN app.d_employee e ON e.id::text = eim.child_entity_id
        WHERE ${sql.join(conditions, sql` AND `)}
        ORDER BY e.name ASC
        LIMIT ${limit} OFFSET ${offset}
      `);

      // Get total count
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.d_entity_id_map eim
        INNER JOIN app.d_employee e ON e.id::text = eim.child_entity_id
        WHERE ${sql.join(conditions, sql` AND `)}
      `);

      return {
        data: employees,
        total: Number(countResult[0]?.total || 0),
        limit,
        offset
      };
    } catch (error) {
      fastify.log.error('Error fetching role employees:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get role permissions across scopes
  fastify.get('/api/v1/role/:id/permissions', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })}),
      response: {
        200: Type.Object({
          role: RoleSchema,
          permissions: Type.Array(Type.Object({
            scopeType: Type.String(),
            scopeId: Type.String(),
            scopeName: Type.String(),
            permissions: Type.Array(Type.Number())}))}),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    const { id } = request.params as { id: string };


    try {
      // Get role
      const role = await db.execute(sql`
        SELECT
          id,
          name,
          "descr",
          role_code,
          role_category,
          reporting_level,
          required_experience_years,
          management_role_flag,
          active_flag,
          from_ts,
          to_ts,
          created_ts,
          updated_ts,
          metadata
        FROM app.d_role
        WHERE id = ${id} AND active_flag = true
      `);

      if (role.length === 0) {
        return reply.status(404).send({ error: 'Role not found' });
      }

      // Transform database result to match schema
      const transformedRole = {
        id: role[0].id,
        name: role[0].name,
        descr: role[0].descr,
        roleType: role[0].role_code,
        roleCategory: role[0].role_category,
        authorityLevel: role[0].reporting_level,
        approvalLimit: role[0].required_experience_years,
        delegationAllowed: role[0].management_role_flag,
        active: role[0].active_flag,
        fromTs: role[0].from_ts,
        toTs: role[0].to_ts,
        created: role[0].created_ts,
        updated: role[0].updated_ts,
        attr: role[0].metadata
      };

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
        role: transformedRole,
        permissions};
    } catch (error) {
      fastify.log.error('Error fetching role permissions:');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}