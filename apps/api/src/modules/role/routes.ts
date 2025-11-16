import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { eq, and, isNull, desc, asc, sql, SQL } from 'drizzle-orm';
import { createPaginatedResponse } from '../../lib/universal-schema-metadata.js';
// ✅ Centralized unified data gate - loosely coupled API
import { unified_data_gate, Permission, ALL_ENTITIES_ID } from '../../lib/unified-data-gate.js';
// ✅ Centralized linkage service - DRY entity relationship management
import { createLinkage } from '../../services/linkage.service.js';
// ✨ Universal auto-filter builder - zero-config query filtering
import { buildAutoFilters } from '../../lib/universal-filter-builder.js';
// ✅ Delete factory for cascading soft deletes
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';
// ✅ Child entity factory for parent-child relationships
import { createChildEntityEndpointsFromMetadata } from '../../lib/child-entity-route-factory.js';

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

// ============================================================================
// Module-level constants (DRY - used across all endpoints)
// ============================================================================
const ENTITY_TYPE = 'role';
const TABLE_ALIAS = 'r';

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

      // ✅ DEFAULT FILTER: Only show active records (not soft-deleted)
      // Can be overridden with ?active=false to show inactive records
      if (!('active' in (request.query as any))) {
        conditions.push(sql`active_flag = true`);
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

      // Return data directly in snake_case format (no transformation needed)
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

      // Return data directly in snake_case format (no transformation needed)
      return reply.status(201).send(result[0]);
    } catch (error) {
      fastify.log.error('Error creating role:');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update role (PATCH)
  fastify.patch('/api/v1/role/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })}),
      body: UpdateRoleSchema,
      response: {
        200: RoleSchema,
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // ═══════════════════════════════════════════════════════════════
      // ✅ CENTRALIZED UNIFIED DATA GATE - RBAC GATE
      // Uses: RBAC_GATE only (checkPermission)
      // Check: Can user EDIT this role?
      // ═══════════════════════════════════════════════════════════════
      const canEdit = await unified_data_gate.rbac_gate.checkPermission(db, userId, ENTITY_TYPE, id, Permission.EDIT);
      if (!canEdit) {
        return reply.status(403).send({ error: 'No permission to edit this role' });
      }

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

      // Always update timestamp and increment version
      updateFields.push(sql`updated_ts = NOW()`);
      updateFields.push(sql`version = version + 1`);

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

      // Return data directly in snake_case format (no transformation needed)
      return result[0];
    } catch (error) {
      fastify.log.error('Error updating role:');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update role (PUT - alias for frontend compatibility)
  fastify.put('/api/v1/role/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })}),
      body: UpdateRoleSchema,
      response: {
        200: RoleSchema,
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // ═══════════════════════════════════════════════════════════════
      // ✅ CENTRALIZED UNIFIED DATA GATE - RBAC GATE
      // Uses: RBAC_GATE only (checkPermission)
      // Check: Can user EDIT this role?
      // ═══════════════════════════════════════════════════════════════
      const canEdit = await unified_data_gate.rbac_gate.checkPermission(db, userId, ENTITY_TYPE, id, Permission.EDIT);
      if (!canEdit) {
        return reply.status(403).send({ error: 'No permission to edit this role' });
      }

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

      // Always update timestamp and increment version
      updateFields.push(sql`updated_ts = NOW()`);
      updateFields.push(sql`version = version + 1`);

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

      // Return data directly in snake_case format (no transformation needed)
      return result[0];
    } catch (error) {
      fastify.log.error('Error updating role:');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Delete Role (Soft Delete via Factory)
  // ============================================================================
  createEntityDeleteEndpoint(fastify, ENTITY_TYPE);

  // ============================================================================
  // Child Entity Endpoints (Auto-Generated from d_entity metadata)
  // ============================================================================
  // Child entity routes auto-generated from d_entity metadata via factory
  await createChildEntityEndpointsFromMetadata(fastify, ENTITY_TYPE);
}