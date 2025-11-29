import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { eq, and, isNull, desc, asc, sql, SQL } from 'drizzle-orm';
import { createPaginatedResponse } from '../../lib/universal-schema-metadata.js';
// ✅ Centralized unified data gate - loosely coupled API
// ✨ Entity Infrastructure Service - centralized infrastructure operations
import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID } from '../../services/entity-infrastructure.service.js';
// ✨ Universal auto-filter builder - zero-config query filtering
import { buildAutoFilters } from '../../lib/universal-filter-builder.js';
// ✨ Backend Formatter Service - component-aware metadata generation
import { generateEntityResponse } from '../../services/backend-formatter.service.js';
// ✨ Datalabel Service - fetch datalabel options for dropdowns and DAG visualization
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

// Response schema for metadata-driven endpoints (single entity)
const RoleWithMetadataSchema = Type.Object({
  data: RoleSchema,
  fields: Type.Array(Type.String()),  // Field names list
  metadata: Type.Any(),  // EntityMetadata - component-specific field metadata
});

// ============================================================================
// Module-level constants (DRY - used across all endpoints)
// ============================================================================
const ENTITY_CODE = 'role';
const TABLE_ALIAS = 'r';

export async function roleRoutes(fastify: FastifyInstance) {
  // ✨ Initialize Entity Infrastructure Service
  const entityInfra = getEntityInfrastructure(db);

  // List roles
  fastify.get('/api/v1/role', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        active: Type.Optional(Type.Boolean()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
        page: Type.Optional(Type.Number({ minimum: 1 }))}),
      response: {
        200: Type.Object({
          data: Type.Array(RoleSchema),
          fields: Type.Array(Type.String()),
          metadata: Type.Any(),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number()}),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    const { active, limit = 20, offset: queryOffset, page } = request.query as any;
    const offset = page ? (page - 1) * limit : (queryOffset !== undefined ? queryOffset : 0);

    try {
      // Build query conditions
      const conditions: SQL[] = [];

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC filtering
      // Only return roles user has VIEW permission for
      // ═══════════════════════════════════════════════════════════════
      const rbacWhereClause = await entityInfra.get_entity_rbac_where_condition(
        userId, ENTITY_CODE, Permission.VIEW, TABLE_ALIAS
      );
      conditions.push(rbacWhereClause);

      if (active !== undefined) {
        conditions.push(sql`${sql.raw(TABLE_ALIAS)}.active_flag = ${active}`);
      }

      // ✅ DEFAULT FILTER: Only show active records (not soft-deleted)
      // Can be overridden with ?active=false to show inactive records
      if (!('active' in (request.query as any))) {
        conditions.push(sql`${sql.raw(TABLE_ALIAS)}.active_flag = true`);
      }

      // Build WHERE clause
      const whereClause = conditions.length > 0
        ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
        : sql``;

      // Get total count
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.role ${sql.raw(TABLE_ALIAS)}
        ${whereClause}
      `);
      const total = Number(countResult[0]?.total || 0);

      // Get paginated results
      const roles = await db.execute(sql`
        SELECT
          ${sql.raw(TABLE_ALIAS)}.id,
          ${sql.raw(TABLE_ALIAS)}.name,
          ${sql.raw(TABLE_ALIAS)}."descr",
          ${sql.raw(TABLE_ALIAS)}.role_code,
          ${sql.raw(TABLE_ALIAS)}.role_category,
          ${sql.raw(TABLE_ALIAS)}.reporting_level,
          ${sql.raw(TABLE_ALIAS)}.required_experience_years,
          ${sql.raw(TABLE_ALIAS)}.management_role_flag,
          ${sql.raw(TABLE_ALIAS)}.client_facing_flag,
          ${sql.raw(TABLE_ALIAS)}.safety_critical_flag,
          ${sql.raw(TABLE_ALIAS)}.background_check_required_flag,
          ${sql.raw(TABLE_ALIAS)}.bonding_required_flag,
          ${sql.raw(TABLE_ALIAS)}.licensing_required_flag,
          ${sql.raw(TABLE_ALIAS)}.active_flag,
          ${sql.raw(TABLE_ALIAS)}.from_ts,
          ${sql.raw(TABLE_ALIAS)}.to_ts,
          ${sql.raw(TABLE_ALIAS)}.created_ts,
          ${sql.raw(TABLE_ALIAS)}.updated_ts,
          ${sql.raw(TABLE_ALIAS)}.metadata
        FROM app.role ${sql.raw(TABLE_ALIAS)}
        ${whereClause}
        ORDER BY ${sql.raw(TABLE_ALIAS)}.name ASC
        LIMIT ${limit} OFFSET ${offset}
      `);

      // ✨ Generate component-aware metadata using Backend Formatter Service
      const response = generateEntityResponse(ENTITY_CODE, roles);

      // ✅ Explicitly return all fields (Fastify strips fields not in schema)
      return {
        data: response.data,
        fields: response.fields,
        metadata: response.metadata,
        total,
        limit,
        offset
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
        id: Type.String({ format: 'uuid' })}),
      response: {
        200: RoleWithMetadataSchema,
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
        FROM app.role
        WHERE id = ${id} AND active_flag = true
      `);

      if (role.length === 0) {
        return reply.status(404).send({ error: 'Role not found' });
      }

      // ✨ Generate component-aware metadata using Backend Formatter Service
      const response = generateEntityResponse(ENTITY_CODE, role);

      // ✅ Explicitly return all fields (Fastify strips fields not in schema)
      return {
        data: response.data[0],
        fields: response.fields,
        metadata: response.metadata,
      };
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
      querystring: Type.Object({
        parent_entity_code: Type.Optional(Type.String()),
        parent_entity_instance_id: Type.Optional(Type.String({ format: 'uuid' }))}),
      response: {
        201: RoleSchema,
        403: Type.Object({ error: Type.String() }),
        400: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    const { parent_entity_code, parent_entity_instance_id } = request.query as any;
    const data = request.body as any;

    try {
      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC CHECK 1
      // Check: Can user CREATE roles?
      // ═══════════════════════════════════════════════════════════════
      const canCreate = await entityInfra.check_entity_rbac(userId, ENTITY_CODE, ALL_ENTITIES_ID, Permission.CREATE);
      if (!canCreate) {
        return reply.status(403).send({ error: 'No permission to create roles' });
      }

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC CHECK 2
      // Check: If linking to parent, can user EDIT parent?
      // ═══════════════════════════════════════════════════════════════
      if (parent_entity_code && parent_entity_instance_id) {
        const canEditParent = await entityInfra.check_entity_rbac(userId, parent_entity_code, parent_entity_instance_id, Permission.EDIT);
        if (!canEditParent) {
          return reply.status(403).send({ error: `No permission to link role to this ${parent_entity_code}` });
        }
      }

      // Check for unique name
      const existingRole = await db.execute(sql`
        SELECT id FROM app.role WHERE name = ${data.name} AND active_flag = true
      `);
      if (existingRole.length > 0) {
        return reply.status(400).send({ error: 'Role with this name already exists' });
      }

      const fromTs = data.fromTs || new Date().toISOString();

      // ✅ Route owns INSERT query
      const result = await db.execute(sql`
        INSERT INTO app.role (name, "descr", role_code, role_category, reporting_level, required_experience_years, management_role_flag, active_flag, from_ts, metadata)
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

      const newRole = result[0] as any;
      const roleId = newRole.id;

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - Register instance in registry
      // ═══════════════════════════════════════════════════════════════
      await entityInfra.set_entity_instance_registry({
        entity_code: ENTITY_CODE,
        entity_id: roleId,
        entity_name: newRole.name,
        instance_code: newRole.role_code || null
      });

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - Grant ownership to creator
      // ═══════════════════════════════════════════════════════════════
      await entityInfra.set_entity_rbac_owner(userId, ENTITY_CODE, roleId);

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - Link to parent (if provided)
      // ═══════════════════════════════════════════════════════════════
      if (parent_entity_code && parent_entity_instance_id) {
        await entityInfra.set_entity_instance_link({
          parent_entity_code: parent_entity_code,
          parent_entity_id: parent_entity_instance_id,
          child_entity_code: ENTITY_CODE,
          child_entity_id: roleId,
          relationship_type: 'contains'
        });
      }

      // Return data directly in snake_case format (no transformation needed)
      return reply.status(201).send(newRole);
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
      // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC CHECK
      // Check: Can user EDIT this role?
      // ═══════════════════════════════════════════════════════════════
      const canEdit = await entityInfra.check_entity_rbac(userId, ENTITY_CODE, id, Permission.EDIT);
      if (!canEdit) {
        return reply.status(403).send({ error: 'No permission to edit this role' });
      }

      // Check if role exists
      const existing = await db.execute(sql`
        SELECT id FROM app.role WHERE id = ${id} AND active_flag = true
      `);

      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Role not found' });
      }

      // Check for unique name on update
      if (data.name) {
        const existingName = await db.execute(sql`
          SELECT id FROM app.role WHERE name = ${data.name} AND active_flag = true AND id != ${id}
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
        UPDATE app.role
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

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - Sync registry if name/code changed
      // ═══════════════════════════════════════════════════════════════
      if (data.name !== undefined || data.roleType !== undefined) {
        await entityInfra.update_entity_instance_registry(ENTITY_CODE, id, {
          entity_name: data.name,
          instance_code: data.roleType
        });
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
      // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC CHECK
      // Check: Can user EDIT this role?
      // ═══════════════════════════════════════════════════════════════
      const canEdit = await entityInfra.check_entity_rbac(userId, ENTITY_CODE, id, Permission.EDIT);
      if (!canEdit) {
        return reply.status(403).send({ error: 'No permission to edit this role' });
      }

      // Check if role exists
      const existing = await db.execute(sql`
        SELECT id FROM app.role WHERE id = ${id} AND active_flag = true
      `);

      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Role not found' });
      }

      // Check for unique name on update
      if (data.name) {
        const existingName = await db.execute(sql`
          SELECT id FROM app.role WHERE name = ${data.name} AND active_flag = true AND id != ${id}
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
        UPDATE app.role
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

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - Sync registry if name/code changed
      // ═══════════════════════════════════════════════════════════════
      if (data.name !== undefined || data.roleType !== undefined) {
        await entityInfra.update_entity_instance_registry(ENTITY_CODE, id, {
          entity_name: data.name,
          instance_code: data.roleType
        });
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
  createEntityDeleteEndpoint(fastify, ENTITY_CODE);

  // ============================================================================
  // Child Entity Endpoints (Auto-Generated from entity metadata)
  // ============================================================================
  // Child entity routes auto-generated from entity metadata via factory
  await createChildEntityEndpointsFromMetadata(fastify, ENTITY_CODE);
}