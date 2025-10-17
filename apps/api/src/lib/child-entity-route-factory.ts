import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

/**
 * Higher-Order Route Factory for Child Entity Endpoints
 *
 * Eliminates 300+ lines of duplicate code across entity modules by creating
 * standardized child entity endpoints following the universal pattern:
 * GET /api/v1/{parentEntity}/:id/{childEntity}
 *
 * @example
 * // Usage in project/routes.ts
 * createChildEntityEndpoint(fastify, 'project', 'task', 'd_task');
 * createChildEntityEndpoint(fastify, 'project', 'form', 'd_form_head');
 * createChildEntityEndpoint(fastify, 'project', 'artifact', 'd_artifact');
 * createChildEntityEndpoint(fastify, 'project', 'wiki', 'd_wiki');
 *
 * @param fastify - Fastify instance
 * @param parentEntity - Parent entity type (e.g., 'project', 'task', 'biz')
 * @param childEntity - Child entity type (e.g., 'task', 'form', 'artifact')
 * @param childTable - Database table name (e.g., 'd_task', 'd_form_head')
 */
export function createChildEntityEndpoint(
  fastify: FastifyInstance,
  parentEntity: string,
  childEntity: string,
  childTable: string
) {
  fastify.get(`/api/v1/${parentEntity}/:id/${childEntity}`, {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
      querystring: Type.Object({
        page: Type.Optional(Type.Integer({ minimum: 1 })),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 }))
      })
    }
  }, async (request, reply) => {
    try {
      const { id: parentId } = request.params as { id: string };
      const { page = 1, limit = 20 } = request.query as any;
      const userId = request.user?.sub;

      if (!userId) {
        return reply.status(401).send({ error: 'User not authenticated' });
      }

      // Universal RBAC check pattern
      const access = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map rbac
        WHERE rbac.empid = ${userId}
          AND rbac.entity = ${parentEntity}
          AND (rbac.entity_id = ${parentId}::text OR rbac.entity_id = 'all')
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND 0 = ANY(rbac.permission)
      `);

      if (access.length === 0) {
        return reply.status(403).send({ error: `Access denied for this ${parentEntity}` });
      }

      // Universal child entity query pattern
      const offset = (page - 1) * limit;
      const childTableIdentifier = sql.identifier(childTable);

      const data = await db.execute(sql`
        SELECT c.*, COALESCE(c.name, 'Untitled') as name, c.descr
        FROM app.${childTableIdentifier} c
        INNER JOIN app.d_entity_id_map eim ON eim.child_entity_id = c.id::text
        WHERE eim.parent_entity_id = ${parentId}
          AND eim.parent_entity_type = ${parentEntity}
          AND eim.child_entity_type = ${childEntity}
          AND eim.active_flag = true
          AND c.active_flag = true
        ORDER BY c.created_ts DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      // Universal count query pattern
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.${childTableIdentifier} c
        INNER JOIN app.d_entity_id_map eim ON eim.child_entity_id = c.id::text
        WHERE eim.parent_entity_id = ${parentId}
          AND eim.parent_entity_type = ${parentEntity}
          AND eim.child_entity_type = ${childEntity}
          AND eim.active_flag = true
          AND c.active_flag = true
      `);

      return {
        data,
        total: Number(countResult[0]?.total || 0),
        page,
        limit
      };
    } catch (error) {
      fastify.log.error(`Error fetching ${parentEntity} ${childEntity}:`, error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}

/**
 * Entity-to-Table Mapping
 *
 * Maps entity type names to their corresponding database table names.
 * Used by createBulkChildEntityEndpoints to automatically resolve table names.
 */
export const ENTITY_TABLE_MAP: Record<string, string> = {
  task: 'd_task',
  form: 'd_form_head',
  artifact: 'd_artifact',
  wiki: 'd_wiki',
  project: 'd_project',
  biz: 'd_business',
  office: 'd_office',
  client: 'd_client',
  employee: 'd_employee',
  role: 'd_role',
  position: 'd_position',
  worksite: 'd_worksite'
};

/**
 * Bulk Child Entity Endpoint Creator
 *
 * Creates multiple child entity endpoints at once using the entity-to-table mapping.
 *
 * @example
 * // Create all project child endpoints
 * createBulkChildEntityEndpoints(fastify, 'project', ['task', 'form', 'artifact', 'wiki']);
 *
 * // Create all task child endpoints
 * createBulkChildEntityEndpoints(fastify, 'task', ['form', 'artifact']);
 *
 * @param fastify - Fastify instance
 * @param parentEntity - Parent entity type
 * @param childEntities - Array of child entity types
 */
export function createBulkChildEntityEndpoints(
  fastify: FastifyInstance,
  parentEntity: string,
  childEntities: string[]
) {
  for (const childEntity of childEntities) {
    const childTable = ENTITY_TABLE_MAP[childEntity];
    if (!childTable) {
      fastify.log.warn(`No table mapping found for entity: ${childEntity}`);
      continue;
    }
    createChildEntityEndpoint(fastify, parentEntity, childEntity, childTable);
  }
}
