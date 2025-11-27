import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { getEntityInfrastructure, Permission } from '@/services/entity-infrastructure.service.js';

/**
 * Universal Entity Instance API
 *
 * REST endpoints for entity instance lookups:
 *
 * GET  /api/v1/entity/entity-instance           - Bulk load ALL entity types
 * GET  /api/v1/entity/:entityCode/entity-instance     - All instances of ONE type
 * GET  /api/v1/entity/:entityCode/entity-instance/:id - Single instance by UUID
 * POST /api/v1/entity/:entityCode/entity-instance/bulk - Multiple UUIDs lookup
 *
 * Uses Entity Infrastructure Service for RBAC permission filtering.
 */

// Map of entity codes to their database table names
const ENTITY_TABLE_MAP: Record<string, string> = {
  employee: 'employee',
  project: 'project',
  task: 'task',
  biz: 'business',
  business: 'business',
  office: 'office',
  org: 'office',
  client: 'cust',
  cust: 'cust',
  worksite: 'worksite',
  role: 'role',
  position: 'position',
  artifact: 'artifact',
  wiki: 'wiki',
  form: 'form',
};

export async function entityInstanceLookupRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/entity/entity-instance
   *
   * Bulk load ALL entity instances grouped by entity_code
   * Used for initial cache population on login
   *
   * Response: { employee: { uuid: name }, business: { uuid: name }, ... }
   *
   * This is the bulk load endpoint for ref_data_entityInstance cache
   */
  fastify.get('/api/v1/entity/entity-instance', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 5000, default: 1000 })),
      }),
      response: {
        200: Type.Record(Type.String(), Type.Record(Type.String(), Type.String())),
        401: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { limit = 1000 } = request.query as { limit?: number };

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      const entityInfra = getEntityInfrastructure(db);

      // Use service method that returns ALL entities grouped by entity_code
      const allEntityInstances = await entityInfra.getEntityInstances(userId, limit);

      return allEntityInstances;
    } catch (error) {
      fastify.log.error('Error fetching all entity instances:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/v1/entity/:entityCode/entity-instance
   *
   * Returns list of {id, name} for a given entity code
   * Filtered by RBAC permissions
   *
   * Used by EntitySelectDropdown and EntityMultiSelectTags for dropdown options
   */
  fastify.get('/api/v1/entity/:entityCode/entity-instance', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        entityCode: Type.String(),
      }),
      querystring: Type.Object({
        search: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 1000, default: 100 })),
        active_only: Type.Optional(Type.Boolean({ default: true })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(Type.Object({
            id: Type.String(),
            name: Type.String(),
          })),
          total: Type.Number(),
        }),
        400: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { entityCode } = request.params as { entityCode: string };
    const { search, limit = 100 } = request.query as any;

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    // Validate entity code
    const tableName = ENTITY_TABLE_MAP[entityCode];
    if (!tableName) {
      return reply.status(400).send({
        error: `Invalid entity code: ${entityCode}. Supported codes: ${Object.keys(ENTITY_TABLE_MAP).join(', ')}`
      });
    }

    try {
      // Use Entity Infrastructure Service for RBAC-filtered lookup
      const entityInfra = getEntityInfrastructure(db);

      // Use getAllEntityInstanceNames service method with RBAC
      const names = await entityInfra.getAllEntityInstanceNames(entityCode, userId, limit);

      // Transform to array format and apply search filter if provided
      let data = Object.entries(names)
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name));

      // Apply search filter client-side (entity_instance stores names)
      if (search) {
        const searchLower = search.toLowerCase();
        data = data.filter(item => item.name.toLowerCase().includes(searchLower));
      }

      // Apply limit after filtering
      const limitedData = data.slice(0, limit);

      return {
        data: limitedData,
        total: data.length,
      };
    } catch (error) {
      fastify.log.error('Error fetching entity options:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/v1/entity/:entityCode/entity-instance/:id
   *
   * Get name for a single entity instance by UUID
   * Returns { id, name }
   *
   * Uses Entity Infrastructure Service for RBAC permission filtering
   */
  fastify.get('/api/v1/entity/:entityCode/entity-instance/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        entityCode: Type.String(),
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          id: Type.String(),
          name: Type.String(),
        }),
        400: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { entityCode, id } = request.params as { entityCode: string; id: string };

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    // Validate entity code
    const tableName = ENTITY_TABLE_MAP[entityCode];
    if (!tableName) {
      return reply.status(400).send({
        error: `Invalid entity code: ${entityCode}`
      });
    }

    try {
      // Use Entity Infrastructure Service
      const entityInfra = getEntityInfrastructure(db);

      // Use getEntityInstanceNames for single ID lookup
      const names = await entityInfra.getEntityInstanceNames(entityCode, [id], userId);

      if (!names[id]) {
        return reply.status(404).send({ error: `Entity instance not found: ${id}` });
      }

      return { id, name: names[id] };
    } catch (error) {
      fastify.log.error('Error fetching entity instance:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * POST /api/v1/entity/:entityCode/entity-instance/bulk
   *
   * Get names for specific IDs (bulk lookup)
   * Useful for resolving IDs to names
   *
   * Uses Entity Infrastructure Service for RBAC permission filtering
   */
  fastify.post('/api/v1/entity/:entityCode/entity-instance/bulk', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        entityCode: Type.String(),
      }),
      body: Type.Object({
        ids: Type.Array(Type.String({ format: 'uuid' })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(Type.Object({
            id: Type.String(),
            name: Type.String(),
          })),
        }),
        400: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { entityCode } = request.params as { entityCode: string };
    const { ids } = request.body as { ids: string[] };

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    // Validate entity code
    const tableName = ENTITY_TABLE_MAP[entityCode];
    if (!tableName) {
      return reply.status(400).send({
        error: `Invalid entity code: ${entityCode}`
      });
    }

    if (!ids || ids.length === 0) {
      return { data: [] };
    }

    try {
      // Use Entity Infrastructure Service
      const entityInfra = getEntityInfrastructure(db);

      // Use getEntityInstanceNames service method for bulk lookup with RBAC
      const names = await entityInfra.getEntityInstanceNames(entityCode, ids, userId);

      // Transform to array format: [{ id, name }]
      const data = Object.entries(names)
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name));

      return { data };
    } catch (error) {
      fastify.log.error('Error fetching bulk entity options:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/v1/entity/:parentCode/:parentId/children
   *
   * Universal API to get all child entities for a given parent entity.
   * Uses entity_instance_link to find relationships and returns grouped results.
   *
   * Example response:
   * [
   *   {"task": [{"id": "uuid1", "name": "Task 1"}, {"id": "uuid2", "name": "Task 2"}]},
   *   {"employee": [{"id": "uuid3", "name": "John Doe"}, {"id": "uuid4", "name": "Jane Smith"}]}
   * ]
   *
   * Respects RBAC permissions for both parent and child entities.
   */
  fastify.get('/api/v1/entity/:parentCode/:parentId/children', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        parentCode: Type.String(),
        parentId: Type.String({ format: 'uuid' }),
      }),
      querystring: Type.Object({
        active_only: Type.Optional(Type.Boolean({ default: true })),
      }),
      response: {
        200: Type.Array(Type.Record(Type.String(), Type.Array(Type.Object({
          id: Type.String(),
          name: Type.String(),
        })))),
        400: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { parentCode, parentId } = request.params as { parentCode: string; parentId: string };
    const { active_only = true } = request.query as any;

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    // Validate parent entity code
    const parentTableName = ENTITY_TABLE_MAP[parentCode];
    if (!parentTableName) {
      return reply.status(400).send({
        error: `Invalid parent entity code: ${parentCode}. Supported codes: ${Object.keys(ENTITY_TABLE_MAP).join(', ')}`
      });
    }

    try {
      // ═══════════════════════════════════════════════════════════════
      // ✅ ENTITY INFRASTRUCTURE SERVICE - RBAC check for parent entity
      // ═══════════════════════════════════════════════════════════════
      const entityInfra = getEntityInfrastructure(db);

      const canViewParent = await entityInfra.check_entity_rbac(
        userId,
        parentCode,
        parentId,
        Permission.VIEW
      );

      if (!canViewParent) {
        return reply.status(403).send({
          error: 'Access denied to parent entity'
        });
      }

      // Get all child entity codes for this parent from entity_instance_link
      const childCodesResult = await db.execute(sql`
        SELECT DISTINCT child_entity_type
        FROM app.entity_instance_link
        WHERE parent_entity_type = ${parentCode}
          AND parent_entity_id = ${parentId}
          AND active_flag = true
        ORDER BY child_entity_type
      `);

      const childCodes = childCodesResult.map(row => String(row.child_entity_type));

      if (childCodes.length === 0) {
        return [];
      }

      // For each child code, fetch the entities with RBAC filtering
      const results: Record<string, Array<{ id: string; name: string }>>[] = [];

      for (const childCode of childCodes) {
        const childTableName = ENTITY_TABLE_MAP[childCode];
        if (!childTableName) {
          fastify.log.warn(`Skipping unknown child entity code: ${childCode}`);
          continue;
        }

        // ═══════════════════════════════════════════════════════════════
        // ✅ ENTITY INFRASTRUCTURE SERVICE - RBAC filter for child entities
        // ═══════════════════════════════════════════════════════════════
        const rbacCondition = await entityInfra.get_entity_rbac_where_condition(
          userId,
          childCode,
          Permission.VIEW,
          'e'
        );

        // Build conditions
        const conditions = [rbacCondition];
        if (active_only) {
          conditions.push(sql`e.active_flag = true`);
        }

        // Query to get child entities
        const childEntities = await db.execute(sql`
          SELECT
            e.id::text as id,
            e.name
          FROM app.entity_instance_link map
          JOIN app.${sql.identifier(childTableName)} e ON e.id::text = map.child_entity_id
          WHERE map.parent_entity_type = ${parentCode}
            AND map.parent_entity_id = ${parentId}
            AND map.child_entity_type = ${childCode}
            AND map.active_flag = true
            AND ${sql.join(conditions, sql` AND `)}
          ORDER BY e.name ASC
        `);

        const entities = childEntities.map(row => ({
          id: String(row.id),
          name: String(row.name),
        }));

        if (entities.length > 0) {
          results.push({ [childCode]: entities });
        }
      }

      return results;
    } catch (error) {
      fastify.log.error('Error fetching child entities:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
