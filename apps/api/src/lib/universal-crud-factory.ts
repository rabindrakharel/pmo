/**
 * ============================================================================
 * UNIVERSAL ENTITY CRUD FACTORY - Industry-Standard REST API Generation
 * ============================================================================
 * Version: 1.0.0
 *
 * PURPOSE:
 * Generate standardized CRUD endpoints for any entity type with ZERO boilerplate.
 * Based on industry patterns from Django REST Framework, NestJS CRUD, and Strapi.
 *
 * ARCHITECTURE:
 * - Configuration-driven: Define entity once, generate all endpoints
 * - Hook system: Customize behavior without modification (Open-Closed Principle)
 * - Composable: Use individual factories or combined createUniversalEntityRoutes
 * - Type-safe: Full TypeScript support with generics
 *
 * FEATURES:
 * - RBAC filtering via Entity Infrastructure Service
 * - Metadata-only mode with Redis caching
 * - ref_data_entityInstance for O(1) entity reference resolution
 * - Universal auto-filters from query parameters
 * - Parent-child filtering via entity_instance_link
 * - Pagination with page/offset support
 * - Registry sync on updates
 *
 * USAGE:
 * ```typescript
 * // Minimal configuration - generates all CRUD endpoints
 * createUniversalEntityRoutes(fastify, { entityCode: 'role' });
 *
 * // With customization hooks
 * createUniversalEntityRoutes(fastify, {
 *   entityCode: 'office',
 *   hooks: {
 *     beforeList: async (ctx) => {
 *       ctx.conditions.push(sql`${ctx.alias}.business_id = ${businessId}`);
 *     }
 *   }
 * });
 * ```
 *
 * INDUSTRY PATTERNS APPLIED:
 * - Django REST Framework: ViewSet pattern with list/retrieve/update/destroy
 * - NestJS CRUD: Configuration object with options
 * - Strapi: Hook system for extensibility
 * - Rails: Convention over configuration (entity_code → table name → routes)
 *
 * ============================================================================
 */

import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db, client } from '@/db/index.js';
import { sql, SQL } from 'drizzle-orm';
import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID } from '../services/entity-infrastructure.service.js';
import { buildAutoFilters } from './universal-filter-builder.js';
import { generateEntityResponse, getCachedMetadataResponse, cacheMetadataResponse, type ComponentName } from '../services/backend-formatter.service.js';
import { getEntityLimit } from './pagination.js';
import { ENTITY_TABLE_MAP } from './child-entity-route-factory.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Hook context for list operations
 * Provides access to modify query building
 */
export interface ListHookContext {
  request: any;
  reply: any;
  userId: string;
  entityCode: string;
  alias: string;
  conditions: SQL[];
  joins: SQL[];
  query: Record<string, any>;
}

/**
 * Hook context for get operations
 */
export interface GetHookContext {
  request: any;
  reply: any;
  userId: string;
  entityCode: string;
  entityId: string;
}

/**
 * Hook context for update operations
 */
export interface UpdateHookContext {
  request: any;
  reply: any;
  userId: string;
  entityCode: string;
  entityId: string;
  updates: Record<string, any>;
}

/**
 * Hooks for customizing endpoint behavior
 * Inspired by Django signals and Express middleware
 */
export interface EntityHooks {
  /**
   * Called before list query execution
   * Use to add custom conditions, joins, or modify query
   */
  beforeList?: (ctx: ListHookContext) => Promise<void>;

  /**
   * Called after list query, before response
   * Use to transform data or add computed fields
   */
  afterList?: (ctx: ListHookContext, data: any[]) => Promise<any[]>;

  /**
   * Called before get query
   * Use for additional validation or context setup
   */
  beforeGet?: (ctx: GetHookContext) => Promise<void>;

  /**
   * Called after get query, before response
   * Use to transform single entity data
   */
  afterGet?: (ctx: GetHookContext, entity: any) => Promise<any>;

  /**
   * Called before update execution
   * Use to transform updates or add computed fields
   * Return modified updates object
   */
  beforeUpdate?: (ctx: UpdateHookContext) => Promise<Record<string, any>>;

  /**
   * Called after update, before response
   * Use for side effects or additional updates
   */
  afterUpdate?: (ctx: UpdateHookContext, entity: any) => Promise<any>;
}

/**
 * Entity route configuration
 * Minimal required: entityCode
 * Everything else derived or optional
 */
export interface EntityRouteConfig {
  /**
   * Entity type code (e.g., 'project', 'task', 'role')
   * REQUIRED - used for RBAC, table name, routes
   */
  entityCode: string;

  /**
   * Database table name
   * Default: Derived from ENTITY_TABLE_MAP or entityCode
   */
  tableName?: string;

  /**
   * SQL table alias for queries
   * Default: 'e'
   */
  tableAlias?: string;

  /**
   * Fields to search when ?search= is provided
   * Default: ['name', 'code', 'descr']
   */
  searchFields?: string[];

  /**
   * Default pagination limit
   * Default: From PAGINATION_CONFIG or 20
   */
  defaultLimit?: number;

  /**
   * Custom hooks for extending behavior
   */
  hooks?: EntityHooks;

  /**
   * Custom query parameter overrides for auto-filter
   * Map query param names to column configurations
   */
  filterOverrides?: Record<string, { column: string; type: string }>;

  /**
   * Skip certain endpoints
   * Useful when entity needs custom implementation for some operations
   */
  skip?: {
    list?: boolean;
    get?: boolean;
    update?: boolean;
  };
}

/**
 * Resolve database table name from entity code
 */
export function getTableName(entityCode: string, customTable?: string): string {
  if (customTable) return customTable;
  return ENTITY_TABLE_MAP[entityCode] || entityCode;
}

// ============================================================================
// LIST ENDPOINT FACTORY
// ============================================================================

/**
 * Create GET /api/v1/{entity} endpoint
 *
 * Features:
 * - RBAC filtering via entity_rbac
 * - Metadata-only mode (?content=metadata) with Redis caching
 * - ref_data_entityInstance for entity reference resolution
 * - Universal auto-filters from query parameters
 * - Parent-child filtering via entity_instance_link
 * - Pagination with page/offset support
 *
 * @example
 * createEntityListEndpoint(fastify, { entityCode: 'role' });
 */
export function createEntityListEndpoint(
  fastify: FastifyInstance,
  config: EntityRouteConfig
): void {
  const {
    entityCode,
    tableName,
    tableAlias = 'e',
    searchFields = ['name', 'code', 'descr'],
    defaultLimit,
    hooks = {},
    filterOverrides = {}
  } = config;

  const TABLE_NAME = getTableName(entityCode, tableName);
  const ENTITY_CODE = entityCode;
  const TABLE_ALIAS = tableAlias;
  const entityInfra = getEntityInfrastructure(db);

  fastify.get(`/api/v1/${ENTITY_CODE}`, {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        // Pagination
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100000 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
        page: Type.Optional(Type.Number({ minimum: 1 })),
        // Filtering
        search: Type.Optional(Type.String()),
        active: Type.Optional(Type.Boolean()),
        // Parent context
        parent_entity_code: Type.Optional(Type.String()),
        parent_entity_instance_id: Type.Optional(Type.String({ format: 'uuid' })),
        // Metadata
        view: Type.Optional(Type.String()),
        content: Type.Optional(Type.String()),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(Type.Any()),
          fields: Type.Array(Type.String()),
          metadata: Type.Any(),
          datalabels: Type.Optional(Type.Any()),
          ref_data_entityInstance: Type.Optional(Type.Record(Type.String(), Type.Record(Type.String(), Type.String()))),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number(),
        }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const query = request.query as Record<string, any>;
    const limit = query.limit ?? defaultLimit ?? getEntityLimit(ENTITY_CODE);
    const offset = query.page ? (query.page - 1) * limit : (query.offset ?? 0);
    const { parent_entity_code, parent_entity_instance_id, view, content } = query;

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    const metadataOnly = content === 'metadata';

    try {
      // ═══════════════════════════════════════════════════════════════
      // BUILD QUERY COMPONENTS
      // ═══════════════════════════════════════════════════════════════

      const joins: SQL[] = [];
      const conditions: SQL[] = [];

      // GATE 1: RBAC - Security filtering (REQUIRED)
      const rbacWhereClause = await entityInfra.get_entity_rbac_where_condition(
        userId, ENTITY_CODE, Permission.VIEW, TABLE_ALIAS
      );
      conditions.push(rbacWhereClause);

      // GATE 2: Parent-child filtering (when parent context provided)
      if (parent_entity_code && parent_entity_instance_id) {
        const parentJoin = sql`
          INNER JOIN app.entity_instance_link eil
            ON eil.child_entity_code = ${ENTITY_CODE}
            AND eil.child_entity_instance_id = ${sql.raw(TABLE_ALIAS)}.id
            AND eil.entity_code = ${parent_entity_code}
            AND eil.entity_instance_id = ${parent_entity_instance_id}
        `;
        joins.push(parentJoin);
      }

      // Default: Only active records (unless explicitly querying inactive)
      if (!('active' in query)) {
        conditions.push(sql`${sql.raw(TABLE_ALIAS)}.active_flag = true`);
      }

      // Universal auto-filters
      const autoFilters = buildAutoFilters(TABLE_ALIAS, query, {
        searchFields,
        overrides: {
          active: { column: 'active_flag', type: 'boolean' },
          ...filterOverrides
        }
      });
      conditions.push(...autoFilters);

      // Hook: beforeList - Allow customization
      if (hooks.beforeList) {
        const hookCtx: ListHookContext = {
          request, reply, userId, entityCode: ENTITY_CODE,
          alias: TABLE_ALIAS, conditions, joins, query
        };
        await hooks.beforeList(hookCtx);
      }

      // Compose query parts
      const joinClause = joins.length > 0 ? sql.join(joins, sql` `) : sql``;
      const whereClause = conditions.length > 0
        ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
        : sql``;

      // Parse requested components
      const requestedComponents = (view
        ? view.split(',').map((v: string) => v.trim())
        : ['entityListOfInstancesTable', 'entityInstanceFormContainer', 'kanbanView']) as ComponentName[];

      // ═══════════════════════════════════════════════════════════════
      // METADATA-ONLY MODE: Redis cached, same query with WHERE 1=0
      // ═══════════════════════════════════════════════════════════════
      if (metadataOnly) {
        const cacheKey = `/api/v1/${ENTITY_CODE}?content=metadata`;

        // Check Redis cache
        const cachedResponse = await getCachedMetadataResponse(cacheKey);
        if (cachedResponse) {
          return reply.send(cachedResponse);
        }

        // Cache miss - execute with WHERE 1=0 for column metadata
        const metadataWhereClause = conditions.length > 0
          ? sql`WHERE 1=0 AND ${sql.join(conditions, sql` AND `)}`
          : sql`WHERE 1=0`;

        const metadataQuery = sql`
          SELECT DISTINCT ${sql.raw(TABLE_ALIAS)}.*
          FROM app.${sql.raw(TABLE_NAME)} ${sql.raw(TABLE_ALIAS)}
          ${joinClause}
          ${metadataWhereClause}
        `;

        const columnsResult = await db.execute(metadataQuery);
        const resultFields = (columnsResult as any).columns?.map((col: any) => ({ name: col.name })) || [];

        const response = await generateEntityResponse(ENTITY_CODE, [], {
          components: requestedComponents,
          metadataOnly: true,
          resultFields
        });

        await cacheMetadataResponse(cacheKey, response);
        return reply.send(response);
      }

      // ═══════════════════════════════════════════════════════════════
      // NORMAL DATA MODE: Execute full query with pagination
      // ═══════════════════════════════════════════════════════════════

      // Count query
      const countQuery = sql`
        SELECT COUNT(DISTINCT ${sql.raw(TABLE_ALIAS)}.id) as total
        FROM app.${sql.raw(TABLE_NAME)} ${sql.raw(TABLE_ALIAS)}
        ${joinClause}
        ${whereClause}
      `;

      // Data query
      const dataQuery = sql`
        SELECT DISTINCT ${sql.raw(TABLE_ALIAS)}.*
        FROM app.${sql.raw(TABLE_NAME)} ${sql.raw(TABLE_ALIAS)}
        ${joinClause}
        ${whereClause}
        ORDER BY ${sql.raw(TABLE_ALIAS)}.created_ts DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      // Execute in parallel
      const [countResult, dataResult] = await Promise.all([
        db.execute(countQuery),
        db.execute(dataQuery)
      ]);

      const total = Number(countResult[0]?.total || 0);
      let data = Array.from(dataResult);

      // Hook: afterList - Transform data
      if (hooks.afterList) {
        const hookCtx: ListHookContext = {
          request, reply, userId, entityCode: ENTITY_CODE,
          alias: TABLE_ALIAS, conditions, joins, query
        };
        data = await hooks.afterList(hookCtx, data);
      }

      // Build ref_data_entityInstance for entity reference resolution
      const ref_data_entityInstance = await entityInfra.build_ref_data_entityInstance(data as Record<string, any>[]);

      // Generate response with metadata
      const response = await generateEntityResponse(ENTITY_CODE, data, {
        components: requestedComponents,
        total,
        limit,
        offset,
        ref_data_entityInstance,
        metadataOnly: false
      });

      return response;

    } catch (error) {
      fastify.log.error(`Error fetching ${ENTITY_CODE} list:`, error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}

// ============================================================================
// GET SINGLE ENDPOINT FACTORY
// ============================================================================

/**
 * Create GET /api/v1/{entity}/:id endpoint
 *
 * Features:
 * - RBAC permission check
 * - ref_data_entityInstance for entity reference resolution
 * - Component-aware metadata generation
 *
 * @example
 * createEntityGetEndpoint(fastify, { entityCode: 'role' });
 */
export function createEntityGetEndpoint(
  fastify: FastifyInstance,
  config: EntityRouteConfig
): void {
  const {
    entityCode,
    tableName,
    tableAlias = 'e',
    hooks = {}
  } = config;

  const TABLE_NAME = getTableName(entityCode, tableName);
  const ENTITY_CODE = entityCode;
  const TABLE_ALIAS = tableAlias;
  const entityInfra = getEntityInfrastructure(db);

  fastify.get(`/api/v1/${ENTITY_CODE}/:id`, {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
      querystring: Type.Object({
        view: Type.Optional(Type.String()),
      }),
      response: {
        200: Type.Object({
          data: Type.Any(),
          fields: Type.Array(Type.String()),
          metadata: Type.Any(),
          ref_data_entityInstance: Type.Optional(Type.Record(Type.String(), Type.Record(Type.String(), Type.String()))),
        }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { view } = request.query as { view?: string };
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Hook: beforeGet
      if (hooks.beforeGet) {
        const hookCtx: GetHookContext = {
          request, reply, userId, entityCode: ENTITY_CODE, entityId: id
        };
        await hooks.beforeGet(hookCtx);
      }

      // RBAC check
      const canView = await entityInfra.check_entity_rbac(
        userId, ENTITY_CODE, id, Permission.VIEW
      );

      if (!canView) {
        return reply.status(403).send({ error: `No permission to view this ${ENTITY_CODE}` });
      }

      // Execute query
      const result = await db.execute(sql`
        SELECT *
        FROM app.${sql.raw(TABLE_NAME)}
        WHERE id = ${id}::uuid
          AND active_flag = true
      `);

      if (result.length === 0) {
        return reply.status(404).send({ error: `${ENTITY_CODE} not found` });
      }

      let entity = result[0];

      // Hook: afterGet
      if (hooks.afterGet) {
        const hookCtx: GetHookContext = {
          request, reply, userId, entityCode: ENTITY_CODE, entityId: id
        };
        entity = await hooks.afterGet(hookCtx, entity);
      }

      // Build ref_data_entityInstance
      const ref_data_entityInstance = await entityInfra.build_ref_data_entityInstance([entity as Record<string, any>]);

      // Parse requested components
      const requestedComponents = (view
        ? view.split(',').map((v: string) => v.trim())
        : ['entityInstanceFormContainer']) as ComponentName[];

      // Generate response
      const response = await generateEntityResponse(ENTITY_CODE, [entity], {
        components: requestedComponents,
        total: 1,
        limit: 1,
        offset: 0
      });

      return reply.send({
        data: response.data[0],  // Single object, not array
        fields: response.fields,
        metadata: response.metadata,
        ref_data_entityInstance,
      });

    } catch (error) {
      fastify.log.error(`Error fetching ${ENTITY_CODE}:`, error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}

// ============================================================================
// UPDATE ENDPOINT FACTORY
// ============================================================================

/**
 * Create PATCH /api/v1/{entity}/:id endpoint
 *
 * Features:
 * - RBAC permission check (EDIT)
 * - Dynamic field updates (only provided fields)
 * - Registry sync when name/code changes
 * - Version increment
 *
 * @example
 * createEntityUpdateEndpoint(fastify, { entityCode: 'role' });
 */
export function createEntityUpdateEndpoint(
  fastify: FastifyInstance,
  config: EntityRouteConfig
): void {
  const {
    entityCode,
    tableName,
    hooks = {}
  } = config;

  const TABLE_NAME = getTableName(entityCode, tableName);
  const ENTITY_CODE = entityCode;
  const entityInfra = getEntityInfrastructure(db);

  // PATCH endpoint
  fastify.patch(`/api/v1/${ENTITY_CODE}/:id`, {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
      body: Type.Record(Type.String(), Type.Any()),  // Accept any fields
      response: {
        200: Type.Any(),
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    let updates = request.body as Record<string, any>;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // RBAC check
      const canEdit = await entityInfra.check_entity_rbac(
        userId, ENTITY_CODE, id, Permission.EDIT
      );

      if (!canEdit) {
        return reply.status(403).send({ error: `No permission to edit this ${ENTITY_CODE}` });
      }

      // Hook: beforeUpdate
      if (hooks.beforeUpdate) {
        const hookCtx: UpdateHookContext = {
          request, reply, userId, entityCode: ENTITY_CODE, entityId: id, updates
        };
        updates = await hooks.beforeUpdate(hookCtx);
      }

      // Filter out system fields that shouldn't be updated directly
      const systemFields = ['id', 'created_ts', 'version'];
      const filteredUpdates = Object.entries(updates)
        .filter(([key, value]) => !systemFields.includes(key) && value !== undefined);

      if (filteredUpdates.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      // Build update fields dynamically
      const updateFields: SQL[] = filteredUpdates.map(([key, value]) => {
        // Handle special types
        if (value === null) {
          return sql`${sql.identifier(key)} = NULL`;
        }
        if (Array.isArray(value)) {
          // Handle arrays (e.g., stakeholder__employee_ids)
          if (value.length === 0) {
            return sql`${sql.identifier(key)} = '{}'`;
          }
          return sql`${sql.identifier(key)} = ${`{${value.join(',')}}`}`;
        }
        if (typeof value === 'object') {
          // Handle JSONB
          return sql`${sql.identifier(key)} = ${JSON.stringify(value)}::jsonb`;
        }
        return sql`${sql.identifier(key)} = ${value}`;
      });

      // Always update timestamp and version
      updateFields.push(sql`updated_ts = now()`);
      updateFields.push(sql`version = version + 1`);

      // Execute update
      const updated = await db.execute(sql`
        UPDATE app.${sql.raw(TABLE_NAME)}
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      if (updated.length === 0) {
        return reply.status(404).send({ error: `${ENTITY_CODE} not found` });
      }

      let entity = updated[0];

      // Sync registry if name/code changed
      if (updates.name !== undefined || updates.code !== undefined) {
        await entityInfra.update_entity_instance_registry(ENTITY_CODE, id, {
          entity_name: updates.name,
          instance_code: updates.code
        });
      }

      // Hook: afterUpdate
      if (hooks.afterUpdate) {
        const hookCtx: UpdateHookContext = {
          request, reply, userId, entityCode: ENTITY_CODE, entityId: id, updates
        };
        entity = await hooks.afterUpdate(hookCtx, entity);
      }

      return reply.send(entity);

    } catch (error) {
      fastify.log.error(`Error updating ${ENTITY_CODE}:`, error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // PUT endpoint (alias to PATCH for frontend compatibility)
  fastify.put(`/api/v1/${ENTITY_CODE}/:id`, {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
      body: Type.Record(Type.String(), Type.Any()),
      response: {
        200: Type.Any(),
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    // Delegate to PATCH handler logic (same implementation)
    const { id } = request.params as { id: string };
    let updates = request.body as Record<string, any>;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      const canEdit = await entityInfra.check_entity_rbac(
        userId, ENTITY_CODE, id, Permission.EDIT
      );

      if (!canEdit) {
        return reply.status(403).send({ error: `No permission to edit this ${ENTITY_CODE}` });
      }

      if (hooks.beforeUpdate) {
        const hookCtx: UpdateHookContext = {
          request, reply, userId, entityCode: ENTITY_CODE, entityId: id, updates
        };
        updates = await hooks.beforeUpdate(hookCtx);
      }

      const systemFields = ['id', 'created_ts', 'version'];
      const filteredUpdates = Object.entries(updates)
        .filter(([key, value]) => !systemFields.includes(key) && value !== undefined);

      if (filteredUpdates.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      const updateFields: SQL[] = filteredUpdates.map(([key, value]) => {
        if (value === null) {
          return sql`${sql.identifier(key)} = NULL`;
        }
        if (Array.isArray(value)) {
          if (value.length === 0) {
            return sql`${sql.identifier(key)} = '{}'`;
          }
          return sql`${sql.identifier(key)} = ${`{${value.join(',')}}`}`;
        }
        if (typeof value === 'object') {
          return sql`${sql.identifier(key)} = ${JSON.stringify(value)}::jsonb`;
        }
        return sql`${sql.identifier(key)} = ${value}`;
      });

      updateFields.push(sql`updated_ts = now()`);
      updateFields.push(sql`version = version + 1`);

      const updated = await db.execute(sql`
        UPDATE app.${sql.raw(TABLE_NAME)}
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      if (updated.length === 0) {
        return reply.status(404).send({ error: `${ENTITY_CODE} not found` });
      }

      let entity = updated[0];

      if (updates.name !== undefined || updates.code !== undefined) {
        await entityInfra.update_entity_instance_registry(ENTITY_CODE, id, {
          entity_name: updates.name,
          instance_code: updates.code
        });
      }

      if (hooks.afterUpdate) {
        const hookCtx: UpdateHookContext = {
          request, reply, userId, entityCode: ENTITY_CODE, entityId: id, updates
        };
        entity = await hooks.afterUpdate(hookCtx, entity);
      }

      return reply.send(entity);

    } catch (error) {
      fastify.log.error(`Error updating ${ENTITY_CODE}:`, error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}

// ============================================================================
// UNIFIED FACTORY - Creates All CRUD Endpoints
// ============================================================================

/**
 * Create all standard CRUD endpoints for an entity
 *
 * Creates:
 * - GET /api/v1/{entity} - List with pagination, filtering, RBAC
 * - GET /api/v1/{entity}/:id - Single entity with RBAC
 * - PATCH /api/v1/{entity}/:id - Update with RBAC
 * - PUT /api/v1/{entity}/:id - Update alias
 *
 * Note: DELETE is handled by createEntityDeleteEndpoint (separate factory)
 * Note: POST (create) remains entity-specific due to field variations
 *
 * @example
 * // Minimal - generates all endpoints
 * createUniversalEntityRoutes(fastify, { entityCode: 'role' });
 *
 * // With hooks for customization
 * createUniversalEntityRoutes(fastify, {
 *   entityCode: 'office',
 *   hooks: {
 *     afterList: async (ctx, data) => {
 *       // Add computed field
 *       return data.map(d => ({ ...d, fullAddress: `${d.city}, ${d.country}` }));
 *     }
 *   }
 * });
 *
 * // Skip certain endpoints
 * createUniversalEntityRoutes(fastify, {
 *   entityCode: 'project',
 *   skip: { list: true }  // Use custom list endpoint
 * });
 */
export function createUniversalEntityRoutes(
  fastify: FastifyInstance,
  config: EntityRouteConfig
): void {
  const { skip = {} } = config;

  // Create LIST endpoint
  if (!skip.list) {
    createEntityListEndpoint(fastify, config);
  }

  // Create GET endpoint
  if (!skip.get) {
    createEntityGetEndpoint(fastify, config);
  }

  // Create UPDATE endpoints (PATCH + PUT)
  if (!skip.update) {
    createEntityUpdateEndpoint(fastify, config);
  }

  fastify.log.info(
    `✓ Universal CRUD routes created for '${config.entityCode}' ` +
    `[${!skip.list ? 'LIST' : ''}${!skip.get ? ' GET' : ''}${!skip.update ? ' UPDATE' : ''}]`
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  createEntityListEndpoint,
  createEntityGetEndpoint,
  createEntityUpdateEndpoint,
  createUniversalEntityRoutes,
  getTableName
};
