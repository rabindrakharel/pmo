/**
 * ============================================================================
 * UNIVERSAL ENTITY CRUD FACTORY - Consolidated REST API Generation
 * ============================================================================
 * Version: 3.0.0
 *
 * PURPOSE:
 * Single source of truth for all entity CRUD endpoint generation.
 * Consolidates all factory patterns (LIST, GET, PATCH, PUT, DELETE) with ZERO boilerplate.
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
 * - Transactional DELETE with infrastructure cleanup
 * - Configurable soft/hard delete per entity
 *
 * USAGE:
 * ```typescript
 * import {
 *   createUniversalEntityRoutes,
 *   createEntityDeleteEndpoint,
 *   createEntityListEndpoint,
 *   createEntityGetEndpoint,
 *   createEntityPatchEndpoint,
 *   createEntityPutEndpoint,
 *   ENTITY_TABLE_MAP
 * } from '@/lib/universal-entity-crud-factory.js';
 *
 * // Minimal - generates ALL endpoints (LIST, GET, PATCH, PUT, DELETE)
 * createUniversalEntityRoutes(fastify, { entityCode: 'role' });
 *
 * // With hard delete (for transactional entities like linkage)
 * createUniversalEntityRoutes(fastify, {
 *   entityCode: 'entity_instance_link',
 *   deleteOptions: { hardDelete: true }
 * });
 *
 * // Skip delete (use custom implementation)
 * createUniversalEntityRoutes(fastify, {
 *   entityCode: 'project',
 *   skip: { delete: true }
 * });
 * createEntityDeleteEndpoint(fastify, 'project', { hardDelete: false });
 *
 * // Mix and match individual factories
 * createEntityListEndpoint(fastify, { entityCode: 'custom' });
 * createEntityGetEndpoint(fastify, { entityCode: 'custom' });
 * // Skip PATCH/PUT/DELETE - use custom handlers
 * ```
 *
 * INDUSTRY PATTERNS APPLIED:
 * - Django REST Framework: ViewSet pattern with list/retrieve/update/destroy
 * - NestJS CRUD: Configuration object with options
 * - Strapi: Hook system for extensibility
 * - Rails: Convention over configuration (entity_code -> table name -> routes)
 *
 * ============================================================================
 */

import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db, client } from '@/db/index.js';
import { sql, SQL } from 'drizzle-orm';
import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID } from '../services/entity-infrastructure.service.js';
import { buildAutoFilters } from './universal-filter-builder.js';
import { generateEntityResponse, getCachedMetadataResponse, cacheMetadataResponse, type ComponentName } from '../services/entity-component-metadata.service.js';
import { getEntityLimit } from './pagination.js';
// v10.0.0: Cursor pagination support for O(1) deep page performance
import {
  decodeCursor,
  buildCursorCondition,
  buildCursorOrderBy,
  buildCursorResponse,
  getCursorPaginationParams,
  shouldUseCursorPagination,
  type CursorPaginationResult
} from './cursor-pagination.js';

// ============================================================================
// ENTITY-TO-TABLE MAPPING
// ============================================================================

/**
 * Entity-to-Table Mapping (ONLY for exceptions)
 *
 * Default: entity_code = table_name (e.g., 'project' -> 'project')
 * This map ONLY contains exceptions where table name differs from entity code.
 *
 * DO NOT add entries where entity_code === table_name.
 */
export const ENTITY_TABLE_MAP: Record<string, string> = {
  // Entity codes where table name differs from entity code
  // These mappings match the db_table column in app.entity table
  // NOTE: Most entities have entity_code === table_name (no entry needed)
  message: 'message_data',
  rbac: 'entity_rbac',
  calendar: 'person_calendar',
  booking: 'entity_event_person_calendar',
};

/**
 * Resolve database table name from entity code
 * @param entityCode - Entity type code (e.g., 'project', 'task')
 * @param customTable - Optional override table name
 * @returns Database table name
 */
export function getTableName(entityCode: string, customTable?: string): string {
  if (customTable) return customTable;
  return ENTITY_TABLE_MAP[entityCode] || entityCode;
}

/**
 * Alias for getTableName (for backwards compatibility)
 */
export function getEntityTableName(entityCode: string): string {
  return getTableName(entityCode);
}

/**
 * Alias for getTableName (for backwards compatibility with delete factory)
 */
export function getEntityTable(entityCode: string): string {
  return getTableName(entityCode);
}

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
   * Called before create execution (BEFORE RBAC checks)
   * Use to transform data, add defaults, or validate
   * Return modified data object
   */
  beforeCreate?: (ctx: CreateHookContext) => Promise<Record<string, any>>;

  /**
   * Called after create, before response
   * Use for side effects, additional linkages, or notifications
   */
  afterCreate?: (ctx: CreateHookContext, entity: any) => Promise<any>;

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
    post?: boolean;
    patch?: boolean;
    put?: boolean;
    delete?: boolean;
  };

  /**
   * Delete endpoint options
   * Controls hard/soft delete behavior
   */
  deleteOptions?: DeleteEndpointOptions;

  /**
   * Default ORDER BY clause for list queries
   * Example: 'created_ts DESC' or 'name ASC'
   * Default: 'created_ts DESC'
   */
  defaultOrderBy?: string;

  /**
   * Default values for POST create
   * Applied when field is not provided in request body
   * Supports functions for dynamic values: () => `CODE-${Date.now()}`
   */
  createDefaults?: Record<string, any | (() => any)>;

  /**
   * Fields required for POST create
   * Will return 400 if any are missing
   */
  requiredFields?: string[];

  /**
   * Name field used for entity registry
   * Default: 'name'
   */
  nameField?: string;

  /**
   * Code field used for entity registry
   * Default: 'code'
   */
  codeField?: string;

  /**
   * Use transactional create via entity-infrastructure.service
   * When true, uses create_entity() for atomic INSERT + registry + RBAC + linkage
   * When false, uses direct INSERT (legacy pattern)
   * Default: true
   */
  useTransactionalCreate?: boolean;
}

/**
 * Hook context for create operations
 */
export interface CreateHookContext {
  request: any;
  reply: any;
  userId: string;
  entityCode: string;
  data: Record<string, any>;
  parentEntityCode?: string;
  parentEntityId?: string;
}

/**
 * Delete endpoint configuration options
 */
export interface DeleteEndpointOptions {
  /**
   * Callback to delete from primary table
   * If not provided, only infrastructure tables are cleaned up
   */
  primary_table_callback?: (db: typeof import('@/db/index.js').db, entity_id: string) => Promise<void>;

  /**
   * Enable cascade delete of child entities
   * Default: false
   */
  cascade_delete_children?: boolean;

  /**
   * Remove RBAC entries on delete
   * Default: false (preserves audit trail)
   */
  remove_rbac_entries?: boolean;

  /**
   * Custom RBAC check override
   * Default: uses Entity Infrastructure Service RBAC
   */
  skip_rbac_check?: boolean;

  /**
   * Hard delete vs soft delete
   * true = DELETE FROM table (permanent)
   * false = SET active_flag = false (soft delete, default)
   * NOTE: entity_instance, entity_instance_link, entity_rbac are ALWAYS hard-deleted
   */
  hardDelete?: boolean;
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
    filterOverrides = {},
    defaultOrderBy = 'created_ts DESC'
  } = config;

  const TABLE_NAME = getTableName(entityCode, tableName);
  const ENTITY_CODE = entityCode;
  const TABLE_ALIAS = tableAlias;
  const entityInfra = getEntityInfrastructure(db);

  fastify.get(`/api/v1/${ENTITY_CODE}`, {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        // Pagination (offset-based - legacy)
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100000 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
        page: Type.Optional(Type.Number({ minimum: 1 })),
        // Pagination (cursor-based - v10.0.0)
        cursor: Type.Optional(Type.String()),
        sort_field: Type.Optional(Type.String()),
        sort_order: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
        include_total: Type.Optional(Type.String()),
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
          // Offset pagination
          total: Type.Optional(Type.Number()),
          limit: Type.Number(),
          offset: Type.Optional(Type.Number()),
          // Cursor pagination (v10.0.0)
          cursors: Type.Optional(Type.Object({
            next: Type.Union([Type.String(), Type.Null()]),
            prev: Type.Union([Type.String(), Type.Null()]),
            hasMore: Type.Boolean(),
            hasPrev: Type.Boolean(),
          })),
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
      // SCD Type 2: active_flag = true means record is current
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

      // v10.0.0: Determine pagination mode (cursor vs offset)
      const useCursor = shouldUseCursorPagination(query);

      if (useCursor) {
        // ═══════════════════════════════════════════════════════════
        // CURSOR PAGINATION: O(1) performance at any depth
        // ═══════════════════════════════════════════════════════════
        const cursorParams = getCursorPaginationParams(query, {
          limit: defaultLimit ?? 20,
          sortField: defaultOrderBy.split(' ')[0] || 'created_ts',
          sortOrder: (defaultOrderBy.toLowerCase().includes('asc') ? 'asc' : 'desc') as 'asc' | 'desc'
        });

        const cursor = decodeCursor(cursorParams.cursor);
        const cursorCondition = buildCursorCondition(
          cursor,
          cursorParams.sortField,
          cursorParams.sortOrder,
          TABLE_ALIAS
        );

        // Add cursor condition to WHERE clause
        const cursorConditions = cursorCondition
          ? [...conditions, cursorCondition]
          : conditions;

        const cursorWhereClause = cursorConditions.length > 0
          ? sql`WHERE ${sql.join(cursorConditions, sql` AND `)}`
          : sql``;

        // Build ORDER BY for cursor pagination (always includes id for stability)
        const cursorOrderBy = buildCursorOrderBy(
          cursorParams.sortField,
          cursorParams.sortOrder,
          TABLE_ALIAS
        );

        // Fetch limit+1 to detect hasMore without count query
        const cursorDataQuery = sql`
          SELECT DISTINCT ${sql.raw(TABLE_ALIAS)}.*
          FROM app.${sql.raw(TABLE_NAME)} ${sql.raw(TABLE_ALIAS)}
          ${joinClause}
          ${cursorWhereClause}
          ${cursorOrderBy}
          LIMIT ${cursorParams.limit + 1}
        `;

        // Optional: Count query only if requested (expensive for large tables)
        let total: number | undefined;
        if (cursorParams.includeTotal) {
          const countQuery = sql`
            SELECT COUNT(DISTINCT ${sql.raw(TABLE_ALIAS)}.id) as total
            FROM app.${sql.raw(TABLE_NAME)} ${sql.raw(TABLE_ALIAS)}
            ${joinClause}
            ${whereClause}
          `;
          const countResult = await db.execute(countQuery);
          total = Number(countResult[0]?.total || 0);
        }

        const dataResult = await db.execute(cursorDataQuery);
        let data = Array.from(dataResult) as Array<{ id: string; [key: string]: any }>;

        // Hook: afterList - Transform data
        if (hooks.afterList) {
          const hookCtx: ListHookContext = {
            request, reply, userId, entityCode: ENTITY_CODE,
            alias: TABLE_ALIAS, conditions, joins, query
          };
          data = await hooks.afterList(hookCtx, data);
        }

        // Build cursor response
        const cursorResponse = buildCursorResponse(
          data,
          cursorParams.limit,
          cursorParams.sortField,
          cursorParams.sortOrder,
          total,
          cursorParams.cursor
        );

        // Build ref_data_entityInstance for entity reference resolution
        const ref_data_entityInstance = await entityInfra.build_ref_data_entityInstance(
          cursorResponse.data as Record<string, any>[]
        );

        // Generate response with metadata
        const response = await generateEntityResponse(ENTITY_CODE, cursorResponse.data, {
          components: requestedComponents,
          total: cursorResponse.total,
          limit: cursorResponse.limit,
          offset: 0, // Not applicable for cursor pagination
          ref_data_entityInstance,
          metadataOnly: false
        });

        // Add cursor pagination info to response
        return {
          ...response,
          cursors: cursorResponse.cursors
        };

      } else {
        // ═══════════════════════════════════════════════════════════
        // OFFSET PAGINATION: Legacy mode (backward compatible)
        // ═══════════════════════════════════════════════════════════

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
          ORDER BY ${sql.raw(`${TABLE_ALIAS}.${defaultOrderBy}`)}
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
      }

    } catch (error) {
      const err = error as Error;
      fastify.log.error(`Error fetching ${ENTITY_CODE} list: ${err.message || 'Unknown error'}`);
      if (err.stack) fastify.log.error(err.stack);
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

      // Execute query - only active records (SCD Type 2)
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
// CREATE (POST) ENDPOINT FACTORY
// ============================================================================

/**
 * Create POST /api/v1/{entity} endpoint
 *
 * Features:
 * - RBAC permission check (CREATE at type level)
 * - Parent RBAC check (EDIT on parent if linking)
 * - Transactional create via entity-infrastructure.service
 * - Configurable defaults and required fields
 * - Hook system for custom validation/transformation
 *
 * @example
 * // Basic usage
 * createEntityPostEndpoint(fastify, { entityCode: 'role' });
 *
 * // With defaults and required fields
 * createEntityPostEndpoint(fastify, {
 *   entityCode: 'project',
 *   createDefaults: {
 *     code: () => `PROJ-${Date.now()}`,
 *     name: 'Untitled Project',
 *     active_flag: true
 *   },
 *   requiredFields: ['name']
 * });
 *
 * // With custom hooks
 * createEntityPostEndpoint(fastify, {
 *   entityCode: 'invoice',
 *   hooks: {
 *     beforeCreate: async (ctx) => {
 *       // Auto-generate invoice number
 *       ctx.data.invoice_number = `INV-${Date.now()}`;
 *       return ctx.data;
 *     }
 *   }
 * });
 */
export function createEntityPostEndpoint(
  fastify: FastifyInstance,
  config: EntityRouteConfig
): void {
  const {
    entityCode,
    tableName,
    hooks = {},
    createDefaults = {},
    requiredFields = [],
    nameField = 'name',
    codeField = 'code',
    useTransactionalCreate = true
  } = config;

  const TABLE_NAME = getTableName(entityCode, tableName);
  const ENTITY_CODE = entityCode;
  const entityInfra = getEntityInfrastructure(db);

  fastify.post(`/api/v1/${ENTITY_CODE}`, {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        parent_entity_code: Type.Optional(Type.String()),
        parent_entity_instance_id: Type.Optional(Type.String({ format: 'uuid' })),
      }),
      body: Type.Record(Type.String(), Type.Any()),  // Accept any fields
      response: {
        201: Type.Any(),
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    const { parent_entity_code, parent_entity_instance_id } = request.query as any;
    let data = { ...(request.body as Record<string, any>) };

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // ═══════════════════════════════════════════════════════════════
      // APPLY DEFAULTS - Functions are called, values are used directly
      // ═══════════════════════════════════════════════════════════════
      for (const [key, defaultValue] of Object.entries(createDefaults)) {
        if (data[key] === undefined || data[key] === null) {
          data[key] = typeof defaultValue === 'function' ? defaultValue() : defaultValue;
        }
      }

      // ═══════════════════════════════════════════════════════════════
      // HOOK: beforeCreate - Transform data, add computed fields
      // ═══════════════════════════════════════════════════════════════
      if (hooks.beforeCreate) {
        const hookCtx: CreateHookContext = {
          request, reply, userId, entityCode: ENTITY_CODE, data,
          parentEntityCode: parent_entity_code,
          parentEntityId: parent_entity_instance_id
        };
        data = await hooks.beforeCreate(hookCtx);
      }

      // ═══════════════════════════════════════════════════════════════
      // VALIDATE REQUIRED FIELDS
      // ═══════════════════════════════════════════════════════════════
      const missingFields = requiredFields.filter(field => !data[field]);
      if (missingFields.length > 0) {
        return reply.status(400).send({
          error: `Missing required fields: ${missingFields.join(', ')}`
        });
      }

      // ═══════════════════════════════════════════════════════════════
      // RBAC CHECK 1: Can user CREATE this entity type?
      // ═══════════════════════════════════════════════════════════════
      const canCreate = await entityInfra.check_entity_rbac(
        userId, ENTITY_CODE, ALL_ENTITIES_ID, Permission.CREATE
      );
      if (!canCreate) {
        return reply.status(403).send({ error: `No permission to create ${ENTITY_CODE}` });
      }

      // ═══════════════════════════════════════════════════════════════
      // RBAC CHECK 2: If linking to parent, can user EDIT parent?
      // ═══════════════════════════════════════════════════════════════
      if (parent_entity_code && parent_entity_instance_id) {
        const canEditParent = await entityInfra.check_entity_rbac(
          userId, parent_entity_code, parent_entity_instance_id, Permission.EDIT
        );
        if (!canEditParent) {
          return reply.status(403).send({
            error: `No permission to link ${ENTITY_CODE} to this ${parent_entity_code}`
          });
        }
      }

      let entity: any;

      if (useTransactionalCreate) {
        // ═══════════════════════════════════════════════════════════════
        // TRANSACTIONAL CREATE via Entity Infrastructure Service
        // Atomic: INSERT + registry + RBAC (OWNER) + linkage
        // ═══════════════════════════════════════════════════════════════
        const result = await entityInfra.create_entity({
          entity_code: ENTITY_CODE,
          creator_id: userId,
          parent_entity_code: parent_entity_code,
          parent_entity_id: parent_entity_instance_id,
          primary_table: `app.${TABLE_NAME}`,
          primary_data: data
        });
        entity = result.entity;
      } else {
        // ═══════════════════════════════════════════════════════════════
        // LEGACY: Direct INSERT (for entities not using infrastructure)
        // ═══════════════════════════════════════════════════════════════
        const fields = Object.keys(data);
        const values = Object.values(data).map(v => {
          if (v === null) return sql`NULL`;
          if (Array.isArray(v)) return sql`${`{${v.join(',')}}`}`;
          if (typeof v === 'object') return sql`${JSON.stringify(v)}::jsonb`;
          return sql`${v}`;
        });

        const result = await db.execute(sql`
          INSERT INTO app.${sql.raw(TABLE_NAME)} (${sql.raw(fields.join(', '))})
          VALUES (${sql.join(values, sql`, `)})
          RETURNING *
        `);
        entity = result[0];

        // Register in entity_instance for legacy mode
        const entityName = data[nameField] || data[codeField] || entity.id;
        const entityCode = data[codeField] || null;
        await entityInfra.set_entity_instance_registry({
          entity_code: ENTITY_CODE,
          entity_id: entity.id,
          entity_name: entityName,
          instance_code: entityCode
        });
      }

      // ═══════════════════════════════════════════════════════════════
      // HOOK: afterCreate - Side effects, additional linkages
      // ═══════════════════════════════════════════════════════════════
      if (hooks.afterCreate) {
        const hookCtx: CreateHookContext = {
          request, reply, userId, entityCode: ENTITY_CODE, data,
          parentEntityCode: parent_entity_code,
          parentEntityId: parent_entity_instance_id
        };
        entity = await hooks.afterCreate(hookCtx, entity);
      }

      fastify.log.info(`Created ${ENTITY_CODE}: ${entity.id}`);
      return reply.status(201).send(entity);

    } catch (error) {
      fastify.log.error(`Error creating ${ENTITY_CODE}:`, error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}

// ============================================================================
// UPDATE ENDPOINT FACTORIES
// ============================================================================

/**
 * Internal helper: Core update logic shared by PATCH and PUT
 * @internal
 */
async function handleEntityUpdate(
  fastify: FastifyInstance,
  request: any,
  reply: any,
  config: EntityRouteConfig,
  entityInfra: ReturnType<typeof getEntityInfrastructure>
): Promise<any> {
  const { entityCode, tableName, hooks = {} } = config;
  const TABLE_NAME = getTableName(entityCode, tableName);
  const ENTITY_CODE = entityCode;

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
}

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
 * createEntityPatchEndpoint(fastify, { entityCode: 'role' });
 */
export function createEntityPatchEndpoint(
  fastify: FastifyInstance,
  config: EntityRouteConfig
): void {
  const { entityCode } = config;
  const ENTITY_CODE = entityCode;
  const entityInfra = getEntityInfrastructure(db);

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
    return handleEntityUpdate(fastify, request, reply, config, entityInfra);
  });
}

/**
 * Create PUT /api/v1/{entity}/:id endpoint
 *
 * Features:
 * - RBAC permission check (EDIT)
 * - Dynamic field updates (only provided fields)
 * - Registry sync when name/code changes
 * - Version increment
 * - Alias to PATCH for frontend compatibility
 *
 * @example
 * createEntityPutEndpoint(fastify, { entityCode: 'role' });
 */
export function createEntityPutEndpoint(
  fastify: FastifyInstance,
  config: EntityRouteConfig
): void {
  const { entityCode } = config;
  const ENTITY_CODE = entityCode;
  const entityInfra = getEntityInfrastructure(db);

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
    return handleEntityUpdate(fastify, request, reply, config, entityInfra);
  });
}

// ============================================================================
// DELETE ENDPOINT FACTORY
// ============================================================================

/**
 * Create DELETE /api/v1/{entity}/:id endpoint
 *
 * Uses Entity Infrastructure Service for transactional delete:
 * - RBAC permission check (DELETE)
 * - Soft delete primary table
 * - Hard delete entity_instance, entity_instance_link, entity_rbac
 *
 * @example
 * createEntityDeleteEndpoint(fastify, 'task');
 */
export function createEntityDeleteEndpoint(
  fastify: FastifyInstance,
  entityCode: string,
  options?: DeleteEndpointOptions
): void {
  const entityInfra = getEntityInfrastructure(db);

  fastify.delete(`/api/v1/${entityCode}/:id`, {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
      response: {
        204: Type.Null(),
        200: Type.Object({
          success: Type.Boolean(),
          entity_type: Type.String(),
          entity_id: Type.String(),
          registry_deactivated: Type.Boolean(),
          linkages_deactivated: Type.Number(),
          rbac_entries_removed: Type.Number(),
          primary_table_deleted: Type.Boolean(),
          children_deleted: Type.Optional(Type.Number())
        }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // ═══════════════════════════════════════════════════════════════
      // ENTITY INFRASTRUCTURE SERVICE - TRANSACTIONAL DELETE
      // All deletes (primary + registry + linkages + RBAC) in ONE transaction
      // ═══════════════════════════════════════════════════════════════
      const tableName = `app.${getEntityTable(entityCode)}`;
      const result = await entityInfra.delete_entity({
        entity_code: entityCode,
        entity_id: id,
        user_id: userId,
        primary_table: tableName,
        hard_delete: options?.hardDelete ?? false,  // Soft delete by default, configurable per entity
        skip_rbac_check: options?.skip_rbac_check || false
      });

      fastify.log.info(`Deleted ${entityCode} ${id}:`, result);

      // Return detailed result (useful for debugging)
      return reply.status(200).send({
        success: result.success,
        entity_type: entityCode,
        entity_id: id,
        registry_deactivated: result.registry_deleted,
        linkages_deactivated: result.linkages_deleted,
        rbac_entries_removed: result.rbac_entries_deleted,
        primary_table_deleted: result.entity_deleted
      });
    } catch (error: any) {
      // Check for permission error
      if (error.message?.includes('lacks DELETE permission')) {
        return reply.status(403).send({ error: error.message });
      }

      fastify.log.error(`Error deleting ${entityCode}:`, error);
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
 * - POST /api/v1/{entity} - Create with RBAC + transactional infrastructure
 * - PATCH /api/v1/{entity}/:id - Update with RBAC
 * - PUT /api/v1/{entity}/:id - Update alias
 * - DELETE /api/v1/{entity}/:id - Delete with RBAC (physical delete)
 *
 * @example
 * // Minimal - generates ALL endpoints (LIST, GET, POST, PATCH, PUT, DELETE)
 * createUniversalEntityRoutes(fastify, { entityCode: 'role' });
 *
 * // With create defaults and hooks
 * createUniversalEntityRoutes(fastify, {
 *   entityCode: 'project',
 *   createDefaults: {
 *     code: () => `PROJ-${Date.now()}`,
 *     name: 'Untitled Project',
 *     active_flag: true
 *   },
 *   hooks: {
 *     beforeCreate: async (ctx) => {
 *       // Custom validation
 *       if (ctx.data.name?.length < 3) throw new Error('Name too short');
 *       return ctx.data;
 *     },
 *     afterList: async (ctx, data) => {
 *       // Add computed field
 *       return data.map(d => ({ ...d, fullAddress: `${d.city}, ${d.country}` }));
 *     }
 *   }
 * });
 *
 * // Skip certain endpoints (use custom implementations)
 * createUniversalEntityRoutes(fastify, {
 *   entityCode: 'project',
 *   skip: { post: true }  // Use custom POST handler
 * });
 */
export function createUniversalEntityRoutes(
  fastify: FastifyInstance,
  config: EntityRouteConfig
): void {
  const { skip = {}, deleteOptions } = config;

  // Create LIST endpoint
  if (!skip.list) {
    createEntityListEndpoint(fastify, config);
  }

  // Create GET endpoint
  if (!skip.get) {
    createEntityGetEndpoint(fastify, config);
  }

  // Create POST endpoint
  if (!skip.post) {
    createEntityPostEndpoint(fastify, config);
  }

  // Create PATCH endpoint
  if (!skip.patch) {
    createEntityPatchEndpoint(fastify, config);
  }

  // Create PUT endpoint
  if (!skip.put) {
    createEntityPutEndpoint(fastify, config);
  }

  // Create DELETE endpoint
  if (!skip.delete) {
    createEntityDeleteEndpoint(fastify, config.entityCode, deleteOptions);
  }

  // Build log message
  const endpoints: string[] = [];
  if (!skip.list) endpoints.push('LIST');
  if (!skip.get) endpoints.push('GET');
  if (!skip.post) endpoints.push('POST');
  if (!skip.patch) endpoints.push('PATCH');
  if (!skip.put) endpoints.push('PUT');
  if (!skip.delete) endpoints.push('DELETE');

  fastify.log.info(
    `✓ Universal CRUD routes created for '${config.entityCode}' [${endpoints.join(' ')}]`
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Table mapping
  ENTITY_TABLE_MAP,
  getTableName,
  getEntityTableName,
  getEntityTable,

  // Individual factories
  createEntityListEndpoint,
  createEntityGetEndpoint,
  createEntityPostEndpoint,
  createEntityPatchEndpoint,
  createEntityPutEndpoint,
  createEntityDeleteEndpoint,

  // Unified factory
  createUniversalEntityRoutes,
};
