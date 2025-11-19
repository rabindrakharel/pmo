import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { getEntityInfrastructure, Permission } from '../services/entity-infrastructure.service.js';

/**
 * Universal Entity Delete Factory (v2.0)
 *
 * Thin wrapper around Entity Infrastructure Service for DELETE endpoint generation.
 * Creates standardized DELETE /api/v1/{entityCode}/:id endpoints.
 *
 * ARCHITECTURE:
 * - Uses Entity Infrastructure Service (single source of truth)
 * - Supports RBAC permission checking
 * - Supports cascade delete (optional)
 * - Supports primary table callbacks
 *
 * Route Factory Usage:
 *   createEntityDeleteEndpoint(fastify, 'task', {
 *     primary_table_callback: async (db, id) => {
 *       await db.execute(sql`DELETE FROM app.task WHERE id = ${id}`);
 *     }
 *   });
 */

// ============================================================================
// ENTITY TYPE TO TABLE MAPPING (for primary table deletion)
// ============================================================================

import { ENTITY_TABLE_MAP } from './child-entity-route-factory.js';

/**
 * Get database table name for an entity type
 */
export function getEntityTable(entityCode: string): string {
  return ENTITY_TABLE_MAP[entityCode] || entityCode;
}

// ============================================================================
// ROUTE FACTORY (Uses Entity Infrastructure Service)
// ============================================================================

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
}

/**
 * Create DELETE endpoint for an entity type
 *
 * Uses Entity Infrastructure Service for all infrastructure operations.
 * Creates standardized delete endpoint: DELETE /api/v1/{entityCode}/:id
 *
 * @example
 * // Basic usage (infrastructure cleanup only)
 * createEntityDeleteEndpoint(fastify, 'task');
 *
 * // With primary table deletion
 * createEntityDeleteEndpoint(fastify, 'project', {
 *   primary_table_callback: async (db, id) => {
 *     await db.execute(sql`DELETE FROM app.project WHERE id = ${id}`);
 *   }
 * });
 *
 * // With cascade delete
 * createEntityDeleteEndpoint(fastify, 'business', {
 *   cascade_delete_children: true,
 *   primary_table_callback: async (db, id) => {
 *     await db.execute(sql`DELETE FROM app.business WHERE id = ${id}`);
 *   }
 * });
 *
 * @param fastify - Fastify instance
 * @param entityCode - Entity type code (e.g., 'task', 'project', 'wiki')
 * @param options - Delete endpoint configuration
 */
export function createEntityDeleteEndpoint(
  fastify: FastifyInstance,
  entityCode: string,
  options?: DeleteEndpointOptions
) {
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
      // Use Entity Infrastructure Service for unified delete
      const result = await entityInfra.delete_all_entity_infrastructure(
        entityCode,
        id,
        {
          user_id: userId,
          cascade_delete_children: options?.cascade_delete_children || false,
          remove_rbac_entries: options?.remove_rbac_entries || false,
          skip_rbac_check: options?.skip_rbac_check || false,
          primary_table_callback: options?.primary_table_callback
        }
      );

      fastify.log.info(`Deleted ${entityCode} ${id}:`, result);

      // Return detailed result (useful for debugging)
      return reply.status(200).send(result);
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
// LEGACY EXPORTS (Deprecated - use Entity Infrastructure Service directly)
// ============================================================================

/**
 * @deprecated Use Entity Infrastructure Service directly:
 *   const entityInfra = getEntityInfrastructure(db);
 *   await entityInfra.delete_all_entity_infrastructure(entityCode, entityId, options);
 */
export async function universalEntityDelete(
  entityCode: string,
  entityId: string,
  options?: {
    skipRegistry?: boolean;
    skipLinkages?: boolean;
    customCleanup?: () => Promise<void>;
  }
): Promise<void> {
  console.warn('universalEntityDelete is deprecated - use Entity Infrastructure Service directly');

  const entityInfra = getEntityInfrastructure(db);

  await entityInfra.delete_all_entity_infrastructure(entityCode, entityId, {
    user_id: 'SYSTEM', // Legacy calls don't have user context
    skip_rbac_check: true,
    primary_table_callback: options?.customCleanup
      ? async () => await options.customCleanup!()
      : undefined
  });
}

/**
 * @deprecated Use Entity Infrastructure Service directly:
 *   const entityInfra = getEntityInfrastructure(db);
 *   await entityInfra.validate_entity_instance_registry(entityCode, entityId);
 */
export async function entityExists(
  entityCode: string,
  entityId: string
): Promise<boolean> {
  console.warn('entityExists is deprecated - use Entity Infrastructure Service directly');

  const entityInfra = getEntityInfrastructure(db);
  return await entityInfra.validate_entity_instance_registry(entityCode, entityId);
}

/**
 * @deprecated Query database directly or use Entity Infrastructure Service
 */
export async function getEntityCount(
  entityCode: string,
  activeOnly: boolean = true
): Promise<number> {
  console.warn('getEntityCount is deprecated - query database directly');

  const table = getEntityTable(entityCode);
  const tableIdentifier = sql.identifier(table);
  const whereClause = activeOnly ? sql`WHERE active_flag = true` : sql``;

  const result = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM app.${tableIdentifier}
    ${whereClause}
  `);

  return Number(result[0]?.count || 0);
}
