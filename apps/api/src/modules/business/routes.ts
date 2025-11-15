import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql, SQL } from 'drizzle-orm';
// ✅ Centralized unified data gate - loosely coupled API
import { unified_data_gate, Permission } from '../../lib/unified-data-gate.js';
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';

// Schema based on actual d_business table structure
const BizSchema = Type.Object({
  id: Type.String(),
  code: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
  office_id: Type.Optional(Type.String()),
  current_headcount: Type.Optional(Type.Number()),
  operational_status: Type.Optional(Type.String()),
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.String()),
  active_flag: Type.Boolean(),
  created_ts: Type.String(),
  updated_ts: Type.String(),
  version: Type.Number(),
});

const CreateBizSchema = Type.Object({
  code: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
  office_id: Type.Optional(Type.String({ format: 'uuid' })),
  current_headcount: Type.Optional(Type.Number()),
  operational_status: Type.Optional(Type.String()),
  active_flag: Type.Optional(Type.Boolean()),
});

const UpdateBizSchema = Type.Partial(CreateBizSchema);

// ============================================================================
// Module-level constants (DRY - used across all endpoints)
// ============================================================================
const ENTITY_TYPE = 'business';
const TABLE_ALIAS = 'e';

export async function businessRoutes(fastify: FastifyInstance) {

  // ============================================================================
  // List Business Units (Main Page or Child Tab)
  // ============================================================================
  // URL: GET /api/v1/business
  // URL: GET /api/v1/business?parent_type=office&parent_id={id}
  // ============================================================================

  fastify.get('/api/v1/business', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        // Parent filtering (create-link-edit pattern)
        parent_type: Type.Optional(Type.String()),
        parent_id: Type.Optional(Type.String({ format: 'uuid' })),

        // Standard filters
        active_flag: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        operational_status: Type.Optional(Type.String()),

        // Pagination
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
        page: Type.Optional(Type.Number({ minimum: 1 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(BizSchema),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number(),
          appliedFilters: Type.Object({
            rbac: Type.Boolean(),
            parent: Type.Boolean(),
            search: Type.Boolean(),
            active: Type.Boolean()
          })
        }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    const {
      parent_type,
      parent_id,
      active_flag,
      search,
      operational_status,
      limit: queryLimit,
      offset: queryOffset,
      page
    } = request.query as any;

    // Calculate pagination with defaults
    const limit = queryLimit || 50;
    const offset = page ? (page - 1) * limit : (queryOffset || 0);

    try {
      // ═══════════════════════════════════════════════════════════════
      // NEW PATTERN: Route builds SQL, gates augment it
      // ═══════════════════════════════════════════════════════════════

      // Build WHERE conditions array
      const conditions: SQL[] = [];

      // GATE 1: RBAC - Apply security filtering (REQUIRED)
      const rbacCondition = await unified_data_gate.rbac_gate.getWhereCondition(
        userId,
        ENTITY_TYPE,
        Permission.VIEW,
        TABLE_ALIAS
      );
      conditions.push(rbacCondition);

      // Additional filters
      if (operational_status) {
        conditions.push(sql`${sql.raw(TABLE_ALIAS)}.operational_status = ${operational_status}`);
      }

      if (active_flag !== undefined) {
        conditions.push(sql`${sql.raw(TABLE_ALIAS)}.active_flag = ${active_flag}`);
      }

      if (search) {
        const searchPattern = `%${search}%`;
        conditions.push(sql`(
          COALESCE(${sql.raw(TABLE_ALIAS)}.name, '') ILIKE ${searchPattern} OR
          COALESCE(${sql.raw(TABLE_ALIAS)}.code, '') ILIKE ${searchPattern} OR
          COALESCE(${sql.raw(TABLE_ALIAS)}."descr", '') ILIKE ${searchPattern}
        )`);
      }

      // GATE 2: PARENT_CHILD_FILTERING - Apply parent context (OPTIONAL)
      const parentJoin = parent_type && parent_id
        ? unified_data_gate.parent_child_filtering_gate.getJoinClause(
            ENTITY_TYPE,
            parent_type,
            parent_id,
            TABLE_ALIAS
          )
        : sql``;

      // Build WHERE clause
      const whereClause = conditions.length > 0
        ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
        : sql``;

      // Count query
      const countQuery = sql`
        SELECT COUNT(DISTINCT ${sql.raw(TABLE_ALIAS)}.id) as total
        FROM app.d_${sql.raw(ENTITY_TYPE)} ${sql.raw(TABLE_ALIAS)}
        ${parentJoin}
        ${whereClause}
      `;

      // Data query (route owns this!)
      const dataQuery = sql`
        SELECT DISTINCT ${sql.raw(TABLE_ALIAS)}.*
        FROM app.d_${sql.raw(ENTITY_TYPE)} ${sql.raw(TABLE_ALIAS)}
        ${parentJoin}
        ${whereClause}
        ORDER BY ${sql.raw(TABLE_ALIAS)}.created_ts DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      // Execute queries in parallel
      const [countResult, dataResult] = await Promise.all([
        db.execute(countQuery),
        db.execute(dataQuery)
      ]);

      const total = Number(countResult[0]?.total || 0);

      return reply.send({
        data: dataResult,
        total,
        limit,
        offset,
        appliedFilters: {
          rbac: true,
          parent: Boolean(parent_type && parent_id),
          search: Boolean(search),
          active: Boolean(active_flag)
        }
      });
    } catch (error) {
      fastify.log.error('Error fetching business units:', error as any);
      console.error('Full error details:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // NOTE: /api/v1/business/:id/project endpoint REMOVED
  // ============================================================================
  // Use create-link-edit pattern instead:
  // GET /api/v1/project?parent_type=business&parent_id={id}
  // ============================================================================

  // ============================================================================
  // Get Dynamic Child Entity Tabs (Metadata)
  // ============================================================================

  fastify.get('/api/v1/business/:id/dynamic-child-entity-tabs', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    const { id } = request.params as { id: string };

    // ═══════════════════════════════════════════════════════════════
    // ✅ CENTRALIZED UNIFIED DATA GATE - Permission Check
    // Uses: RBAC_GATE only (checkPermission)
    // ═══════════════════════════════════════════════════════════════
    const canView = await unified_data_gate.rbac_gate.checkPermission(db, userId, ENTITY_TYPE, id, Permission.VIEW);
    if (!canView) {
      return reply.status(403).send({ error: 'No permission to view this business' });
    }

    // Get entity configuration
    const entityConfig = await db.execute(sql`
      SELECT child_entities
      FROM app.d_entity
      WHERE code = ${ENTITY_TYPE}
        AND active_flag = true
    `);

    if (entityConfig.length === 0) {
      return reply.send({ tabs: [] });
    }

    const childEntities = entityConfig[0].child_entities || [];

    // For each child entity, count how many are linked
    const tabsWithCounts = await Promise.all(
      childEntities.map(async (childType: string) => {
        const countResult = await db.execute(sql`
          SELECT COUNT(*) as count
          FROM app.d_entity_id_map
          WHERE parent_entity_type = ${ENTITY_TYPE}
            AND parent_entity_id = ${id}
            AND child_entity_type = ${childType}
            AND active_flag = true
        `);

        return {
          entity_type: childType,
          count: Number(countResult[0]?.count || 0)
        };
      })
    );

    return reply.send({ tabs: tabsWithCounts });
  });

  // ============================================================================
  // Get Creatable Entities (Metadata)
  // ============================================================================

  fastify.get('/api/v1/business/:id/creatable', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    const { id } = request.params as { id: string };

    // ═══════════════════════════════════════════════════════════════
    // ✅ CENTRALIZED UNIFIED DATA GATE - Permission Check
    // Uses: RBAC_GATE only (checkPermission)
    // ═══════════════════════════════════════════════════════════════
    const canView = await unified_data_gate.rbac_gate.checkPermission(db, userId, ENTITY_TYPE, id, Permission.VIEW);
    if (!canView) {
      return reply.status(403).send({ error: 'No permission to view this business' });
    }

    // Get entity configuration
    const entityConfig = await db.execute(sql`
      SELECT child_entities
      FROM app.d_entity
      WHERE code = ${ENTITY_TYPE}
        AND active_flag = true
    `);

    if (entityConfig.length === 0) {
      return reply.send({ creatable: [] });
    }

    const childEntities = entityConfig[0].child_entities || [];

    // ═══════════════════════════════════════════════════════════════
    // ✅ CENTRALIZED UNIFIED DATA GATE - Check CREATE permissions
    // Uses: RBAC_GATE only (checkPermission for each child type)
    // ═══════════════════════════════════════════════════════════════
    const creatableEntities = await Promise.all(
      childEntities.map(async (childType: string) => {
        const canCreate = await unified_data_gate.rbac_gate.checkPermission(db, userId, childType, 'all', Permission.CREATE);
        return canCreate ? childType : null;
      })
    );

    return reply.send({
      creatable: creatableEntities.filter(Boolean)
    });
  });

  // ============================================================================
  // Get Single Business Unit
  // ============================================================================

  fastify.get('/api/v1/business/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
      response: {
        200: BizSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    const { id } = request.params as { id: string };

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // ═══════════════════════════════════════════════════════════════
      // NEW PATTERN: RBAC gate check, then simple SELECT
      // ═══════════════════════════════════════════════════════════════

      // GATE: RBAC - Check permission
      const canView = await unified_data_gate.rbac_gate.checkPermission(
        db,
        userId,
        ENTITY_TYPE,
        id,
        Permission.VIEW
      );

      if (!canView) {
        return reply.status(403).send({ error: 'No permission to view this business' });
      }

      // Route owns the query
      const result = await db.execute(sql`
        SELECT *
        FROM app.d_business
        WHERE id = ${id}::uuid
          AND active_flag = true
      `);

      if (result.length === 0) {
        return reply.status(404).send({ error: 'Business not found' });
      }

      return reply.send(result[0]);
    } catch (error) {
      fastify.log.error('Error fetching business:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Create Business Unit
  // ============================================================================
  // URL: POST /api/v1/business
  // URL: POST /api/v1/business?parent_type=office&parent_id={id}
  // ============================================================================

  fastify.post('/api/v1/business', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        parent_type: Type.Optional(Type.String()),
        parent_id: Type.Optional(Type.String({ format: 'uuid' }))
      }),
      body: CreateBizSchema,
      response: {
        201: BizSchema,
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    const { parent_type, parent_id } = request.query as any;
    const bizData = request.body as any;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // ═══════════════════════════════════════════════════════════════
      // ✅ CENTRALIZED UNIFIED DATA GATE - RBAC GATE 1
      // Uses: RBAC_GATE only (checkPermission)
      // Check: Can user CREATE business units?
      // ═══════════════════════════════════════════════════════════════
      const canCreate = await unified_data_gate.rbac_gate.checkPermission(db, userId, ENTITY_TYPE, 'all', Permission.CREATE);
      if (!canCreate) {
        return reply.status(403).send({ error: 'No permission to create business units' });
      }

      // ═══════════════════════════════════════════════════════════════
      // ✅ CENTRALIZED UNIFIED DATA GATE - RBAC GATE 2
      // Uses: RBAC_GATE only (checkPermission)
      // Check: If linking to parent, can user EDIT parent?
      // ═══════════════════════════════════════════════════════════════
      if (parent_type && parent_id) {
        const canEditParent = await unified_data_gate.rbac_gate.checkPermission(db, userId, parent_type, parent_id, Permission.EDIT);
        if (!canEditParent) {
          return reply.status(403).send({ error: `No permission to link business to this ${parent_type}` });
        }
      }

      // ═══════════════════════════════════════════════════════════════
      // CREATE business unit
      // ═══════════════════════════════════════════════════════════════
      const newBiz = await db.execute(sql`
        INSERT INTO app.d_business (
          code, name, "descr", metadata,
          office_id, current_headcount, operational_status,
          active_flag, created_ts, updated_ts
        ) VALUES (
          ${bizData.code},
          ${bizData.name},
          ${bizData.descr || null},
          ${bizData.metadata || null},
          ${bizData.office_id || null},
          ${bizData.current_headcount || null},
          ${bizData.operational_status || null},
          ${bizData.active_flag !== undefined ? bizData.active_flag : true},
          now(),
          now()
        )
        RETURNING *
      `);

      const bizId = newBiz[0].id;

      // ═══════════════════════════════════════════════════════════════
      // LINK to parent (if parent context provided)
      // ═══════════════════════════════════════════════════════════════
      if (parent_type && parent_id) {
        await db.execute(sql`
          INSERT INTO app.d_entity_id_map (
            parent_entity_type,
            parent_entity_id,
            child_entity_type,
            child_entity_id,
            relationship_type,
            active_flag
          ) VALUES (
            ${parent_type},
            ${parent_id},
            ENTITY_TYPE,
            ${bizId},
            'contains',
            true
          )
        `);
      }

      // ═══════════════════════════════════════════════════════════════
      // AUTO-GRANT: Creator gets full permissions
      // ═══════════════════════════════════════════════════════════════
      await db.execute(sql`
        INSERT INTO app.entity_id_rbac_map (
          person_entity_id,
          entity_name,
          entity_id,
          permission,
          active_flag
        ) VALUES (
          ${userId},
          ENTITY_TYPE,
          ${bizId}::text,
          ${Permission.DELETE},
          true
        )
      `);

      return reply.status(201).send(newBiz[0]);
    } catch (error) {
      fastify.log.error('Error creating business:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Update Business Unit
  // ============================================================================

  fastify.patch('/api/v1/business/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
      body: UpdateBizSchema,
      response: {
        200: BizSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    const { id } = request.params as { id: string };
    const updates = request.body as any;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // ═══════════════════════════════════════════════════════════════
      // ✅ CENTRALIZED UNIFIED DATA GATE - RBAC GATE
      // Uses: RBAC_GATE only (checkPermission)
      // Check: Can user EDIT this business?
      // ═══════════════════════════════════════════════════════════════
      const canEdit = await unified_data_gate.rbac_gate.checkPermission(db, userId, ENTITY_TYPE, id, Permission.EDIT);
      if (!canEdit) {
        return reply.status(403).send({ error: 'No permission to edit this business' });
      }

      // Build update fields
      const updateFields: any[] = [];
      if (updates.code !== undefined) updateFields.push(sql`code = ${updates.code}`);
      if (updates.name !== undefined) updateFields.push(sql`name = ${updates.name}`);
      if (updates.descr !== undefined) updateFields.push(sql`"descr" = ${updates.descr}`);
      if (updates.metadata !== undefined) updateFields.push(sql`metadata = ${updates.metadata}`);
      if (updates.office_id !== undefined) updateFields.push(sql`office_id = ${updates.office_id}`);
      if (updates.current_headcount !== undefined) updateFields.push(sql`current_headcount = ${updates.current_headcount}`);
      if (updates.operational_status !== undefined) updateFields.push(sql`operational_status = ${updates.operational_status}`);
      if (updates.active_flag !== undefined) updateFields.push(sql`active_flag = ${updates.active_flag}`);

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated_ts = now()`);
      updateFields.push(sql`version = version + 1`);

      // Update business
      const updated = await db.execute(sql`
        UPDATE app.d_business
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      if (updated.length === 0) {
        return reply.status(404).send({ error: 'Business not found' });
      }

      return reply.send(updated[0]);
    } catch (error) {
      fastify.log.error('Error updating business:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Delete Business Unit (Soft Delete via Factory)
  // ============================================================================
  createEntityDeleteEndpoint(fastify, ENTITY_TYPE);
}
