/**
 * Universal CRUD Factory with Built-in RBAC Gating
 *
 * DRY pattern for all entity CRUD operations with automatic permission checks.
 * Use this factory to eliminate repetitive RBAC code in route files.
 *
 * @example Basic Usage
 * ```typescript
 * // In your routes.ts file:
 * import { createUniversalCRUDRoutes } from '@/lib/universal-crud-factory.js';
 *
 * export async function projectRoutes(fastify: FastifyInstance) {
 *   createUniversalCRUDRoutes(fastify, {
 *     entityType: 'project',
 *     tableName: 'd_project'
 *   });
 * }
 * ```
 *
 * This creates all 5 standard routes with RBAC gating:
 * - GET    /api/v1/project        (view permission)
 * - GET    /api/v1/project/:id    (view permission on specific entity)
 * - POST   /api/v1/project        (create permission)
 * - PATCH  /api/v1/project/:id    (edit permission)
 * - DELETE /api/v1/project/:id    (delete permission)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { ENTITY_TABLE_MAP } from './child-entity-route-factory.js';

// ============================================================================
// TYPES
// ============================================================================

export interface CRUDOptions {
  /** Entity type (e.g., 'project', 'task', 'wiki') */
  entityType: string;

  /** Database table name (e.g., 'd_project', 'd_task') */
  tableName?: string;

  /** Optional: Custom validation schema for POST/PATCH */
  createSchema?: any;
  updateSchema?: any;

  /** Optional: Additional WHERE conditions for list endpoint */
  listWhereClause?: (userId: string) => ReturnType<typeof sql>;

  /** Optional: Custom hooks */
  hooks?: {
    beforeCreate?: (data: any, userId: string) => Promise<any>;
    afterCreate?: (entity: any, userId: string) => Promise<void>;
    beforeUpdate?: (id: string, data: any, userId: string) => Promise<any>;
    afterUpdate?: (entity: any, userId: string) => Promise<void>;
    beforeDelete?: (id: string, userId: string) => Promise<void>;
    afterDelete?: (id: string, userId: string) => Promise<void>;
  };

  /** Optional: Disable specific routes */
  disable?: {
    list?: boolean;
    getOne?: boolean;
    create?: boolean;
    update?: boolean;
    delete?: boolean;
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get table name for entity type
 */
function getTableName(entityType: string, providedTableName?: string): string {
  if (providedTableName) return providedTableName;

  const tableName = ENTITY_TABLE_MAP[entityType];
  if (!tableName) {
    throw new Error(`Unknown entity type: ${entityType}. Provide tableName or add to ENTITY_TABLE_MAP.`);
  }
  return tableName;
}

/**
 * Get user ID from request
 */
function getUserId(request: FastifyRequest): string | undefined {
  return (request as any).user?.sub;
}

// ============================================================================
// CRUD ROUTE FACTORIES
// ============================================================================

/**
 * Create GET /api/v1/{entityType} - List all entities (with view permission)
 */
function createListRoute(fastify: FastifyInstance, options: CRUDOptions) {
  if (options.disable?.list) return;

  const { entityType, listWhereClause } = options;
  const tableName = getTableName(entityType, options.tableName);

  fastify.get(`/api/v1/${entityType}`, {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
        offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 }))
      }),
      response: {
        200: Type.Object({
          data: Type.Array(Type.Any()),
          total: Type.Integer(),
          limit: Type.Integer(),
          offset: Type.Integer()
        })
      }
    }
  }, async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { limit = 20, offset = 0 } = request.query as any;

    // Build query
    const tableIdentifier = sql.identifier(tableName);
    const additionalWhere = listWhereClause ? listWhereClause(userId) : sql`TRUE`;
    const idFilter = sql`TRUE`; // No RBAC filtering in universal factory

    // Query entities with RBAC filtering
    const result = await db.execute(sql`
      SELECT e.*
      FROM app.${tableIdentifier} e
      WHERE e.active_flag = true
        AND ${additionalWhere}
        AND ${idFilter}
      ORDER BY e.created_ts DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    // Get total count
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM app.${tableIdentifier} e
      WHERE e.active_flag = true
        AND ${additionalWhere}
        AND ${idFilter}
    `);

    return reply.send({
      data: result,
      total: Number(countResult[0]?.count || 0),
      limit,
      offset
    });
  });
}

/**
 * Create GET /api/v1/{entityType}/:id - Get single entity (with view permission)
 */
function createGetOneRoute(fastify: FastifyInstance, options: CRUDOptions) {
  if (options.disable?.getOne) return;

  const { entityType } = options;
  const tableName = getTableName(entityType, options.tableName);

  fastify.get(`/api/v1/${entityType}/:id`, {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = getUserId(request);

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    // Fetch entity
    const tableIdentifier = sql.identifier(tableName);
    const result = await db.execute(sql`
      SELECT * FROM app.${tableIdentifier}
      WHERE id::text = ${id}
        AND active_flag = true
    `);

    if (result.length === 0) {
      return reply.status(404).send({ error: `${entityType} not found` });
    }

    return reply.send(result[0]);
  });
}

/**
 * Create POST /api/v1/{entityType} - Create entity (with create permission)
 */
function createCreateRoute(fastify: FastifyInstance, options: CRUDOptions) {
  if (options.disable?.create) return;

  const { entityType, createSchema, hooks } = options;
  const tableName = getTableName(entityType, options.tableName);

  fastify.post(`/api/v1/${entityType}`, {
    preHandler: [fastify.authenticate],
    schema: createSchema ? {
      body: createSchema
    } : undefined
  }, async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    let data = request.body as any;

    // Before create hook
    if (hooks?.beforeCreate) {
      data = await hooks.beforeCreate(data, userId);
    }

    // Insert entity
    const tableIdentifier = sql.identifier(tableName);
    const columns = Object.keys(data);
    const values = Object.values(data);

    const insertQuery = sql`
      INSERT INTO app.${tableIdentifier} (
        ${sql.join(columns.map(col => sql.identifier(col)), sql`, `)},
        created_ts, updated_ts, active_flag
      ) VALUES (
        ${sql.join(values.map(v => sql`${v}`), sql`, `)},
        NOW(), NOW(), true
      )
      RETURNING *
    `;

    const result = await db.execute(insertQuery);
    const entity = result[0];

    // After create hook
    if (hooks?.afterCreate) {
      await hooks.afterCreate(entity, userId);
    }

    return reply.status(201).send(entity);
  });
}

/**
 * Create PATCH /api/v1/{entityType}/:id - Update entity (with edit permission)
 */
function createUpdateRoute(fastify: FastifyInstance, options: CRUDOptions) {
  if (options.disable?.update) return;

  const { entityType, updateSchema, hooks } = options;
  const tableName = getTableName(entityType, options.tableName);

  fastify.patch(`/api/v1/${entityType}/:id`, {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
      body: updateSchema || Type.Object({}, { additionalProperties: true })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = getUserId(request);

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    let data = request.body as any;

    // Before update hook
    if (hooks?.beforeUpdate) {
      data = await hooks.beforeUpdate(id, data, userId);
    }

    // Update entity
    const tableIdentifier = sql.identifier(tableName);
    const updates = Object.entries(data).map(([key, value]) =>
      sql`${sql.identifier(key)} = ${value}`
    );

    const updateQuery = sql`
      UPDATE app.${tableIdentifier}
      SET ${sql.join(updates, sql`, `)},
          updated_ts = NOW(),
          version = version + 1
      WHERE id::text = ${id}
        AND active_flag = true
      RETURNING *
    `;

    const result = await db.execute(updateQuery);

    if (result.length === 0) {
      return reply.status(404).send({ error: `${entityType} not found` });
    }

    const entity = result[0];

    // After update hook
    if (hooks?.afterUpdate) {
      await hooks.afterUpdate(entity, userId);
    }

    return reply.send(entity);
  });
}

/**
 * Create DELETE /api/v1/{entityType}/:id - Delete entity (with delete permission)
 */
function createDeleteRoute(fastify: FastifyInstance, options: CRUDOptions) {
  if (options.disable?.delete) return;

  const { entityType, hooks } = options;
  const tableName = getTableName(entityType, options.tableName);

  fastify.delete(`/api/v1/${entityType}/:id`, {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = getUserId(request);

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    // Before delete hook
    if (hooks?.beforeDelete) {
      await hooks.beforeDelete(id, userId);
    }

    // Soft delete from main table
    const tableIdentifier = sql.identifier(tableName);
    await db.execute(sql`
      UPDATE app.${tableIdentifier}
      SET active_flag = false,
          to_ts = NOW(),
          updated_ts = NOW()
      WHERE id::text = ${id}
    `);

    // Soft delete from entity instance registry
    await db.execute(sql`
      UPDATE app.d_entity_instance_id
      SET active_flag = false, updated_ts = NOW()
      WHERE entity_type = ${entityType} AND entity_id::text = ${id}
    `);

    // Soft delete linkages
    await db.execute(sql`
      UPDATE app.d_entity_id_map
      SET active_flag = false, updated_ts = NOW()
      WHERE (child_entity_type = ${entityType} AND child_entity_id = ${id})
         OR (parent_entity_type = ${entityType} AND parent_entity_id = ${id})
    `);

    // After delete hook
    if (hooks?.afterDelete) {
      await hooks.afterDelete(id, userId);
    }

    return reply.status(204).send();
  });
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Create all CRUD routes for an entity with automatic RBAC gating
 *
 * @param fastify - Fastify instance
 * @param options - CRUD configuration
 *
 * @example
 * ```typescript
 * createUniversalCRUDRoutes(fastify, {
 *   entityType: 'project',
 *   tableName: 'd_project',
 *   hooks: {
 *     afterCreate: async (project, userId) => {
 *       // Link to entity instance registry
 *       await registerEntityInstance('project', project.id);
 *     }
 *   }
 * });
 * ```
 */
export function createUniversalCRUDRoutes(
  fastify: FastifyInstance,
  options: CRUDOptions
) {
  createListRoute(fastify, options);
  createGetOneRoute(fastify, options);
  createCreateRoute(fastify, options);
  createUpdateRoute(fastify, options);
  createDeleteRoute(fastify, options);
}

// Export individual route creators for fine-grained control
export {
  createListRoute,
  createGetOneRoute,
  createCreateRoute,
  createUpdateRoute,
  createDeleteRoute
};
