import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { getEntityInfrastructure, Permission } from '@/services/entity-infrastructure.service.js';

/**
 * Universal Entity Instance Lookup API
 *
 * Returns a list of {id, name} pairs for any entity type.
 * Used for populating dropdowns, autocomplete, and selection fields.
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
  form: 'form_head',
};

export async function entityInstanceLookupRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/entity/:entityCode/entity-instance-lookup
   *
   * Returns list of {id, name} for a given entity code
   * Filtered by RBAC permissions
   *
   * Used by EntitySelectDropdown and EntityMultiSelectTags for dropdown options
   */
  fastify.get('/api/v1/entity/:entityCode/entity-instance-lookup', {
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
    const { search, limit = 100, active_only = true } = request.query as any;

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
      // Use Entity Infrastructure Service for RBAC filtering
      const entityInfra = getEntityInfrastructure(db);

      // Build RBAC filter using Entity Infrastructure Service
      const rbacCondition = await entityInfra.get_entity_rbac_where_condition(
        userId,
        entityCode,
        Permission.VIEW,
        'e'
      );

      // Build conditions
      const conditions = [rbacCondition];

      // Add active filter
      if (active_only) {
        conditions.push(sql`e.active_flag = true`);
      }

      // Add search filter
      if (search) {
        conditions.push(sql`e.name ILIKE ${`%${search}%`}`);
      }

      // Get total count
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.${sql.identifier(tableName)} e
        WHERE ${sql.join(conditions, sql` AND `)}
      `);
      const total = Number(countResult[0]?.total || 0);

      // Get options
      const result = await db.execute(sql`
        SELECT
          e.id::text as id,
          e.name
        FROM app.${sql.identifier(tableName)} e
        WHERE ${sql.join(conditions, sql` AND `)}
        ORDER BY e.name ASC
        LIMIT ${limit}
      `);

      const data = result.map(row => ({
        id: String(row.id),
        name: String(row.name),
      }));

      return {
        data,
        total,
      };
    } catch (error) {
      fastify.log.error('Error fetching entity options:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * POST /api/v1/entity/:entityCode/entity-instance-lookup/bulk
   *
   * Get names for specific IDs (bulk lookup)
   * Useful for resolving IDs to names
   *
   * Uses Entity Infrastructure Service for RBAC permission filtering
   */
  fastify.post('/api/v1/entity/:entityCode/entity-instance-lookup/bulk', {
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
      // Use Entity Infrastructure Service for RBAC filtering
      const entityInfra = getEntityInfrastructure(db);

      // Build RBAC filter using Entity Infrastructure Service
      const rbacCondition = await entityInfra.get_entity_rbac_where_condition(
        userId,
        entityCode,
        Permission.VIEW,
        'e'
      );

      // Get names for specific IDs with RBAC filtering
      const result = await db.execute(sql`
        SELECT
          e.id::text as id,
          e.name
        FROM app.${sql.identifier(tableName)} e
        WHERE e.id = ANY(${ids}::uuid[])
          AND ${rbacCondition}
        ORDER BY e.name ASC
      `);

      const data = result.map(row => ({
        id: String(row.id),
        name: String(row.name),
      }));

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
      // First, verify user has access to the parent entity
      const parentAccessCheck = await db.execute(sql`
        SELECT 1
        FROM app.entity_rbac rbac
        WHERE rbac.person_entity_name = 'employee' AND rbac.person_id = ${userId}
          AND rbac.entity_name = ${parentCode}
          AND (rbac.entity_id = ${parentId} OR rbac.entity_id = '11111111-1111-1111-1111-111111111111'::uuid)
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND rbac.permission >= 0
        LIMIT 1
      `);

      if (parentAccessCheck.length === 0) {
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

        // Build RBAC filter for child entities
        const rbacCondition = sql`EXISTS (
          SELECT 1 FROM app.entity_rbac rbac
          WHERE rbac.person_entity_name = 'employee' AND rbac.person_id = ${userId}
            AND rbac.entity_name = ${childCode}
            AND (rbac.entity_id = e.id OR rbac.entity_id = '11111111-1111-1111-1111-111111111111'::uuid)
            AND rbac.active_flag = true
            AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
            AND rbac.permission >= 0
        )`;

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
