import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import {
  getEntityInfrastructure,
  Permission,
  ALL_ENTITIES_ID,
  type InheritanceMode
} from '@/services/entity-infrastructure.service.js';
import { generateEntityResponse } from '@/services/entity-component-metadata.service.js';

/**
 * Access Control Routes Module (v2.1.0 - Role-Only RBAC)
 *
 * Dedicated endpoints for managing:
 * - Role permissions (entity_rbac records) - uses role_id column
 * - Role-person assignments (entity_instance_link records)
 *
 * This is a purpose-built UI for access control administration,
 * separate from the existing entity/settings infrastructure.
 *
 * IMPORTANT: Uses new entity_rbac schema with role_id (not person_code/person_id)
 */

const PERMISSION_LABELS: Record<number, string> = {
  0: 'View',
  1: 'Comment',
  2: 'Contribute',
  3: 'Edit',
  4: 'Share',
  5: 'Delete',
  6: 'Create',
  7: 'Owner',
};

export async function accessControlRoutes(fastify: FastifyInstance) {
  const entityInfra = getEntityInfrastructure(db);

  // ============================================================================
  // GET /api/v1/access-control/role/:roleId/permissions
  // Get all RBAC permissions granted to a specific role
  // ============================================================================
  fastify.get('/api/v1/access-control/role/:roleId/permissions', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        roleId: Type.String({ format: 'uuid' })
      }),
    },
  }, async (request, reply) => {
    const { roleId } = request.params as { roleId: string };

    // Verify role exists
    const roleCheck = await db.execute(sql`
      SELECT id, name, code FROM app.role WHERE id = ${roleId} AND active_flag = true
    `);

    if (roleCheck.length === 0) {
      return reply.status(404).send({ error: 'Role not found' });
    }

    // Get all permissions for this role using the new schema (role_id column)
    const permissions = await db.execute(sql`
      SELECT
        r.id,
        r.role_id,
        r.entity_code,
        r.entity_instance_id,
        r.permission,
        r.inheritance_mode,
        r.child_permissions,
        r.is_deny,
        r.granted_by_person_id,
        r.granted_ts,
        r.expires_ts,
        r.created_ts,
        r.updated_ts,
        e.name as entity_name,
        e.ui_label as entity_ui_label
      FROM app.entity_rbac r
      LEFT JOIN app.entity e ON r.entity_code = e.code
      WHERE r.role_id = ${roleId}::uuid
      ORDER BY r.entity_code ASC, r.permission DESC
    `);

    // Build ref_data_entityInstance for granted_by lookup
    const grantedByIds = [...new Set(
      permissions
        .filter((p: any) => p.granted_by_person_id)
        .map((p: any) => p.granted_by_person_id as string)
    )];

    let refData: Record<string, Record<string, string>> = { person: {} };

    if (grantedByIds.length > 0) {
      const persons = await db.execute(sql`
        SELECT id, name FROM app.person WHERE id = ANY(${grantedByIds}::uuid[])
      `);

      persons.forEach((p: any) => {
        refData.person[p.id] = p.name;
      });
    }

    // Generate response with metadata
    const response = await generateEntityResponse('rbac', Array.from(permissions), {
      resultFields: [
        { name: 'id' },
        { name: 'entity_code' },
        { name: 'entity_instance_id' },
        { name: 'permission' },
        { name: 'inheritance_mode' },
        { name: 'child_permissions' },
        { name: 'is_deny' },
        { name: 'granted_by_person_id' },
        { name: 'granted_ts' },
        { name: 'expires_ts' },
        { name: 'entity_name' },
        { name: 'entity_ui_label' },
      ],
    });

    return reply.send({
      ...response,
      ref_data_entityInstance: refData,
    });
  });

  // ============================================================================
  // GET /api/v1/access-control/role/:roleId/persons
  // Get ALL person types (employee, customer, vendor, supplier, person) assigned to a role
  // ============================================================================
  fastify.get('/api/v1/access-control/role/:roleId/persons', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        roleId: Type.String({ format: 'uuid' })
      }),
    },
  }, async (request, reply) => {
    const { roleId } = request.params as { roleId: string };

    // Verify role exists
    const roleCheck = await db.execute(sql`
      SELECT id FROM app.role WHERE id = ${roleId} AND active_flag = true
    `);

    if (roleCheck.length === 0) {
      return reply.status(404).send({ error: 'Role not found' });
    }

    // Get ALL person types assigned to this role via entity_instance_link
    // Role membership: entity_code='role', child_entity_code='person' (or other person types)
    const persons = await db.execute(sql`
      SELECT
        l.child_entity_code as person_type,
        l.child_entity_instance_id as person_id,
        COALESCE(e.name, c.name, p.name) as name,
        COALESCE(e.code, c.code, '') as code,
        COALESCE(e.email, c.email, p.email) as email,
        l.created_ts as assigned_ts,
        l.id as link_id
      FROM app.entity_instance_link l
      LEFT JOIN app.employee e ON l.child_entity_code = 'employee' AND l.child_entity_instance_id = e.id
      LEFT JOIN app.cust c ON l.child_entity_code = 'cust' AND l.child_entity_instance_id = c.id
      LEFT JOIN app.person p ON l.child_entity_instance_id = p.id
      WHERE l.entity_code = 'role'
        AND l.entity_instance_id = ${roleId}::uuid
        AND l.child_entity_code IN ('employee', 'cust', 'vendor', 'supplier', 'person')
      ORDER BY l.child_entity_code ASC, COALESCE(e.name, c.name, p.name) ASC
    `);

    // Generate response with metadata
    const response = await generateEntityResponse('person', Array.from(persons), {
      resultFields: [
        { name: 'person_type' },
        { name: 'person_id' },
        { name: 'name' },
        { name: 'code' },
        { name: 'email' },
        { name: 'assigned_ts' },
        { name: 'link_id' },
      ],
    });

    return reply.send(response);
  });

  // ============================================================================
  // POST /api/v1/access-control/role/:roleId/persons
  // Assign a person (any type) to a role
  // ============================================================================
  fastify.post('/api/v1/access-control/role/:roleId/persons', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        roleId: Type.String({ format: 'uuid' })
      }),
      body: Type.Object({
        person_type: Type.Union([
          Type.Literal('employee'),
          Type.Literal('cust'),
          Type.Literal('vendor'),
          Type.Literal('supplier'),
          Type.Literal('person')
        ]),
        person_id: Type.String({ format: 'uuid' })
      }),
    },
  }, async (request, reply) => {
    const { roleId } = request.params as { roleId: string };
    const { person_type, person_id } = request.body as {
      person_type: 'employee' | 'cust' | 'vendor' | 'supplier' | 'person';
      person_id: string;
    };

    // Verify role exists
    const roleCheck = await db.execute(sql`
      SELECT id FROM app.role WHERE id = ${roleId} AND active_flag = true
    `);

    if (roleCheck.length === 0) {
      return reply.status(404).send({ error: 'Role not found' });
    }

    // Verify person exists based on type
    let personCheck;
    if (person_type === 'employee') {
      personCheck = await db.execute(sql`
        SELECT id, name FROM app.employee
        WHERE id = ${person_id}::uuid AND active_flag = true
      `);
    } else if (person_type === 'cust') {
      personCheck = await db.execute(sql`
        SELECT id, name FROM app.cust
        WHERE id = ${person_id}::uuid AND active_flag = true
      `);
    } else {
      // For vendor/supplier/person, check the person table
      personCheck = await db.execute(sql`
        SELECT id, name FROM app.person
        WHERE id = ${person_id}::uuid AND active_flag = true
      `);
    }

    if (!personCheck || personCheck.length === 0) {
      return reply.status(400).send({
        error: `${person_type} not found or inactive`
      });
    }

    // Check if assignment already exists
    const existingLink = await db.execute(sql`
      SELECT id FROM app.entity_instance_link
      WHERE entity_code = 'role'
        AND entity_instance_id = ${roleId}::uuid
        AND child_entity_code = ${person_type}
        AND child_entity_instance_id = ${person_id}::uuid
    `);

    if (existingLink.length > 0) {
      return reply.status(400).send({
        error: `${person_type} is already assigned to this role`
      });
    }

    // Create the link using entity infrastructure service
    const link = await entityInfra.set_entity_instance_link({
      parent_entity_code: 'role',
      parent_entity_id: roleId,
      child_entity_code: person_type,
      child_entity_id: person_id,
      relationship_type: 'has_member',
    });

    return reply.status(201).send({
      message: `${person_type} assigned to role successfully`,
      link,
    });
  });

  // ============================================================================
  // DELETE /api/v1/access-control/role/:roleId/persons/:personType/:personId
  // Remove a person (any type) from a role
  // ============================================================================
  fastify.delete('/api/v1/access-control/role/:roleId/persons/:personType/:personId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        roleId: Type.String({ format: 'uuid' }),
        personType: Type.Union([
          Type.Literal('employee'),
          Type.Literal('cust'),
          Type.Literal('vendor'),
          Type.Literal('supplier'),
          Type.Literal('person')
        ]),
        personId: Type.String({ format: 'uuid' })
      }),
    },
  }, async (request, reply) => {
    const { roleId, personType, personId } = request.params as {
      roleId: string;
      personType: 'employee' | 'cust' | 'vendor' | 'supplier' | 'person';
      personId: string;
    };

    // Delete the link (hard delete)
    const result = await db.execute(sql`
      DELETE FROM app.entity_instance_link
      WHERE entity_code = 'role'
        AND entity_instance_id = ${roleId}::uuid
        AND child_entity_code = ${personType}
        AND child_entity_instance_id = ${personId}::uuid
      RETURNING id
    `);

    if (result.length === 0) {
      return reply.status(404).send({ error: 'Assignment not found' });
    }

    return reply.send({ message: 'Person removed from role successfully' });
  });

  // ============================================================================
  // POST /api/v1/access-control/role/:roleId/permissions
  // Grant a permission to a role (uses entity-infrastructure service)
  // ============================================================================
  fastify.post('/api/v1/access-control/role/:roleId/permissions', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        roleId: Type.String({ format: 'uuid' })
      }),
      body: Type.Object({
        entity_code: Type.String(),
        entity_instance_id: Type.Optional(Type.String()),
        permission: Type.Number({ minimum: 0, maximum: 7 }),
        inheritance_mode: Type.Optional(Type.Union([
          Type.Literal('none'),
          Type.Literal('cascade'),
          Type.Literal('mapped')
        ])),
        child_permissions: Type.Optional(Type.Record(Type.String(), Type.Number())),
        is_deny: Type.Optional(Type.Boolean()),
        expires_ts: Type.Optional(Type.Union([Type.String(), Type.Null()])),
      }),
    },
  }, async (request, reply) => {
    const { roleId } = request.params as { roleId: string };
    const {
      entity_code,
      entity_instance_id,
      permission,
      inheritance_mode = 'none',
      child_permissions = {},
      is_deny = false,
      expires_ts
    } = request.body as {
      entity_code: string;
      entity_instance_id?: string;
      permission: number;
      inheritance_mode?: InheritanceMode;
      child_permissions?: Record<string, number>;
      is_deny?: boolean;
      expires_ts?: string | null;
    };
    const userId = (request as any).user?.sub;

    // Verify role exists
    const roleCheck = await db.execute(sql`
      SELECT id, name FROM app.role WHERE id = ${roleId}::uuid AND active_flag = true
    `);

    if (roleCheck.length === 0) {
      return reply.status(404).send({ error: 'Role not found' });
    }

    const targetEntityInstanceId = entity_instance_id || ALL_ENTITIES_ID;

    // Use entity infrastructure service for proper upsert
    const result = await entityInfra.set_entity_rbac(
      roleId,
      entity_code,
      targetEntityInstanceId,
      permission,
      {
        inheritance_mode,
        child_permissions,
        is_deny,
        granted_by_person_id: userId,
        expires_ts: expires_ts || null
      }
    );

    return reply.status(201).send({
      message: 'Permission granted successfully',
      permission: result,
    });
  });

  // ============================================================================
  // POST /api/v1/access-control/role/:roleId/permissions/bulk
  // Bulk grant permissions to a role
  // ============================================================================
  fastify.post('/api/v1/access-control/role/:roleId/permissions/bulk', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        roleId: Type.String({ format: 'uuid' })
      }),
      body: Type.Object({
        permissions: Type.Array(Type.Object({
          entity_code: Type.String(),
          entity_instance_id: Type.Optional(Type.String()),
          permission: Type.Number({ minimum: 0, maximum: 7 }),
          inheritance_mode: Type.Optional(Type.Union([
            Type.Literal('none'),
            Type.Literal('cascade'),
            Type.Literal('mapped')
          ])),
          child_permissions: Type.Optional(Type.Record(Type.String(), Type.Number())),
          is_deny: Type.Optional(Type.Boolean()),
          expires_ts: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        }))
      }),
    },
  }, async (request, reply) => {
    const { roleId } = request.params as { roleId: string };
    const { permissions } = request.body as {
      permissions: Array<{
        entity_code: string;
        entity_instance_id?: string;
        permission: number;
        inheritance_mode?: InheritanceMode;
        child_permissions?: Record<string, number>;
        is_deny?: boolean;
        expires_ts?: string | null;
      }>
    };
    const userId = (request as any).user?.sub;

    // Verify role exists
    const roleCheck = await db.execute(sql`
      SELECT id FROM app.role WHERE id = ${roleId}::uuid AND active_flag = true
    `);

    if (roleCheck.length === 0) {
      return reply.status(404).send({ error: 'Role not found' });
    }

    // Grant each permission using entity infrastructure service
    const results = [];
    for (const perm of permissions) {
      const entityInstanceId = perm.entity_instance_id || ALL_ENTITIES_ID;

      const result = await entityInfra.set_entity_rbac(
        roleId,
        perm.entity_code,
        entityInstanceId,
        perm.permission,
        {
          inheritance_mode: perm.inheritance_mode || 'none',
          child_permissions: perm.child_permissions || {},
          is_deny: perm.is_deny || false,
          granted_by_person_id: userId,
          expires_ts: perm.expires_ts || null
        }
      );

      results.push(result);
    }

    return reply.status(201).send({
      message: `${results.length} permission(s) granted successfully`,
      permissions: results,
    });
  });

  // ============================================================================
  // GET /api/v1/access-control/entities
  // Get all entity types for permission dropdowns (includes ownership info)
  // ============================================================================
  fastify.get('/api/v1/access-control/entities', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const entities = await db.execute(sql`
      SELECT code, name, ui_label, ui_icon, child_entity_codes, root_level_entity_flag
      FROM app.entity
      WHERE active_flag = true
      ORDER BY display_order ASC, ui_label ASC
    `);

    return reply.send({ data: entities });
  });

  // ============================================================================
  // GET /api/v1/access-control/employees
  // Get all employees for person assignment dropdowns
  // ============================================================================
  fastify.get('/api/v1/access-control/employees', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const employees = await db.execute(sql`
      SELECT id, name, code, email
      FROM app.employee
      WHERE active_flag = true
      ORDER BY name ASC
    `);

    return reply.send({ data: employees });
  });

  // ============================================================================
  // GET /api/v1/access-control/customers
  // Get all customers for person assignment dropdowns
  // ============================================================================
  fastify.get('/api/v1/access-control/customers', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const customers = await db.execute(sql`
      SELECT id, name, code, email
      FROM app.cust
      WHERE active_flag = true
      ORDER BY name ASC
    `);

    return reply.send({ data: customers });
  });

  // ============================================================================
  // GET /api/v1/access-control/persons
  // Get all persons (unified - for person picker)
  // ============================================================================
  fastify.get('/api/v1/access-control/persons', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const persons = await db.execute(sql`
      SELECT id, name, email, 'person' as entity_type
      FROM app.person
      WHERE active_flag = true
      ORDER BY name ASC
    `);

    return reply.send({ data: persons });
  });
}
