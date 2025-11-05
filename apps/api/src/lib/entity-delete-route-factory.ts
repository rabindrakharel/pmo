import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

/**
 * Universal Entity Delete Factory
 *
 * Provides both route factory and utility functions for consistent entity deletion.
 * Automatically handles cascading cleanup of:
 * 1. Main entity table (soft delete: active_flag=false)
 * 2. Entity instance registry (d_entity_instance_id)
 * 3. Parent-child linkages (d_entity_id_map)
 *
 * Route Factory Usage:
 *   createEntityDeleteEndpoint(fastify, 'task');
 *   createEntityDeleteEndpoint(fastify, 'project');
 *
 * Utility Function Usage:
 *   await universalEntityDelete('task', taskId);
 *   await universalEntityDelete('project', projectId);
 */

// ============================================================================
// ENTITY TYPE TO TABLE MAPPING
// Imported from child-entity-route-factory for consistency
// ============================================================================

import { ENTITY_TABLE_MAP } from './child-entity-route-factory.js';

/**
 * Get database table name for an entity type
 */
export function getEntityTable(entityType: string): string {
  const table = ENTITY_TABLE_MAP[entityType];
  if (!table) {
    throw new Error(`Unknown entity type: ${entityType}. Add mapping to ENTITY_TABLE_MAP.`);
  }
  return table;
}

/**
 * Universal entity soft-delete with cascading cleanup
 *
 * Performs the following operations in order:
 * 1. Soft-delete from main entity table (SET active_flag=false, to_ts=NOW())
 * 2. Soft-delete from entity instance registry (d_entity_instance_id)
 * 3. Soft-delete child linkages (where entity is child in d_entity_id_map)
 * 4. Soft-delete parent linkages (where entity is parent in d_entity_id_map)
 *
 * @param entityType - Entity type (e.g., 'task', 'project', 'wiki')
 * @param entityId - UUID of the entity to delete
 * @param options - Optional configuration
 * @throws Error if entity type is not recognized or delete fails
 */
export async function universalEntityDelete(
  entityType: string,
  entityId: string,
  options?: {
    skipRegistry?: boolean;
    skipLinkages?: boolean;
    customCleanup?: () => Promise<void>;
  }
): Promise<void> {
  const table = getEntityTable(entityType);

  try {
    // Optional: Run custom cleanup before delete (e.g., delete S3 files for artifacts)
    if (options?.customCleanup) {
      await options.customCleanup();
    }

    // Use sql.identifier for table name (matching child-entity-route-factory pattern)
    const tableIdentifier = sql.identifier(table);

    // STEP 1: Soft-delete from main entity table
    await db.execute(sql`
      UPDATE app.${tableIdentifier}
      SET active_flag = false,
          to_ts = NOW(),
          updated_ts = NOW()
      WHERE id::text = ${entityId}
    `);

    // STEP 2: Soft-delete from entity instance registry
    if (!options?.skipRegistry) {
      await db.execute(sql`
        UPDATE app.d_entity_instance_id
        SET active_flag = false,
            updated_ts = NOW()
        WHERE entity_type = ${entityType}
          AND entity_id::text = ${entityId}
      `);
    }

    // STEP 3 & 4: Soft-delete all linkages (both as parent and child)
    if (!options?.skipLinkages) {
      // Soft-delete linkages where this entity is a child
      await db.execute(sql`
        UPDATE app.d_entity_id_map
        SET active_flag = false,
            updated_ts = NOW()
        WHERE child_entity_type = ${entityType}
          AND child_entity_id = ${entityId}
      `);

      // Soft-delete linkages where this entity is a parent
      await db.execute(sql`
        UPDATE app.d_entity_id_map
        SET active_flag = false,
            updated_ts = NOW()
        WHERE parent_entity_type = ${entityType}
          AND parent_entity_id = ${entityId}
      `);
    }
  } catch (error) {
    console.error(`Universal delete failed for ${entityType}/${entityId}:`, error);
    throw error;
  }
}

/**
 * Check if an entity exists and is active
 */
export async function entityExists(
  entityType: string,
  entityId: string
): Promise<boolean> {
  const table = getEntityTable(entityType);
  const tableIdentifier = sql.identifier(table);

  const result = await db.execute(sql`
    SELECT 1
    FROM app.${tableIdentifier}
    WHERE id::text = ${entityId}
      AND active_flag = true
    LIMIT 1
  `);

  return result.length > 0;
}

/**
 * Get entity count for a specific type
 */
export async function getEntityCount(
  entityType: string,
  activeOnly: boolean = true
): Promise<number> {
  const table = getEntityTable(entityType);
  const tableIdentifier = sql.identifier(table);

  const whereClause = activeOnly ? sql`WHERE active_flag = true` : sql``;

  const result = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM app.${tableIdentifier}
    ${whereClause}
  `);

  return Number(result[0]?.count || 0);
}

// ============================================================================
// ROUTE FACTORY (Consistent with child-entity-route-factory.ts pattern)
// ============================================================================

/**
 * Create DELETE endpoint for an entity type
 *
 * Follows the same pattern as createChildEntityEndpoint() and createMinimalChildEntityEndpoint()
 * Creates standardized delete endpoint: DELETE /api/v1/{entityType}/:id
 *
 * @example
 * // Usage in task/routes.ts
 * import { createEntityDeleteEndpoint } from '../../lib/universal-entity-delete.js';
 * createEntityDeleteEndpoint(fastify, 'task');
 *
 * @param fastify - Fastify instance
 * @param entityType - Entity type (e.g., 'task', 'project', 'wiki')
 * @param options - Optional configuration for custom cleanup
 */
export function createEntityDeleteEndpoint(
  fastify: FastifyInstance,
  entityType: string,
  options?: {
    customCleanup?: (entityId: string) => Promise<void>;
  }
) {
  fastify.delete(`/api/v1/${entityType}/:id`, {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
      response: {
        204: Type.Null(),
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

    // RBAC check: Does user have delete permission?
    const deleteAccess = await db.execute(sql`
      SELECT 1 FROM app.entity_id_rbac_map rbac
      WHERE rbac.empid = ${userId}
        AND rbac.entity = ${entityType}
        AND (rbac.entity_id = ${id} OR rbac.entity_id = 'all')
        AND rbac.active_flag = true
        AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
        AND 3 = ANY(rbac.permission)
    `);

    if (deleteAccess.length === 0) {
      return reply.status(403).send({ error: `Insufficient permissions to delete this ${entityType}` });
    }

    try {
      // Check if entity exists
      const exists = await entityExists(entityType, id);
      if (!exists) {
        return reply.status(404).send({ error: `${entityType} not found` });
      }

      // Perform universal cascading delete
      await universalEntityDelete(entityType, id, {
        customCleanup: options?.customCleanup ? () => options.customCleanup!(id) : undefined
      });

      fastify.log.info(`Deleted ${entityType} ${id} with cascading cleanup`);

      return reply.status(204).send();
    } catch (error) {
      fastify.log.error(`Error deleting ${entityType}:`, error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
