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
 * Used by child entity route factories to automatically resolve table names.
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
 * Create Minimal Child Entity Instance with Automatic Linkage
 *
 * Creates a POST endpoint that:
 * 1. Creates a new child entity instance with minimal data (ID + name + defaults)
 * 2. Automatically creates the parent-child linkage in d_entity_id_map
 * 3. Returns the new entity ID for immediate navigation to detail page
 *
 * This implements the create-then-link-then-edit workflow:
 * - Frontend calls: POST /api/v1/:parentType/:parentId/:childType/create-minimal
 * - Backend creates child record + linkage
 * - Frontend navigates to: /:childType/:newId for editing
 *
 * @param fastify - Fastify instance
 * @param parentEntity - Parent entity type (e.g., 'project')
 * @param childEntity - Child entity type (e.g., 'task')
 * @param childTable - Database table name (e.g., 'd_task')
 */
export function createMinimalChildEntityEndpoint(
  fastify: FastifyInstance,
  parentEntity: string,
  childEntity: string,
  childTable: string
) {
  fastify.post(`/api/v1/${parentEntity}/:id/${childEntity}/create-minimal`, {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
      body: Type.Object({
        name: Type.Optional(Type.String())
      }),
      response: {
        201: Type.Object({
          id: Type.String(),
          name: Type.String(),
          message: Type.String()
        }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    try {
      const { id: parentId } = request.params as { id: string };
      const { name } = request.body as { name?: string };
      const userId = (request as any).user?.sub;

      if (!userId) {
        return reply.status(401).send({ error: 'User not authenticated' });
      }

      // Check parent access permission
      const parentAccess = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map rbac
        WHERE rbac.empid = ${userId}
          AND rbac.entity = ${parentEntity}
          AND (rbac.entity_id = ${parentId}::text OR rbac.entity_id = 'all')
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND 0 = ANY(rbac.permission)
      `);

      if (parentAccess.length === 0) {
        return reply.status(403).send({ error: `Access denied for this ${parentEntity}` });
      }

      // Check child entity create permission
      const createAccess = await db.execute(sql`
        SELECT 1 FROM app.entity_id_rbac_map rbac
        WHERE rbac.empid = ${userId}
          AND rbac.entity = ${childEntity}
          AND rbac.entity_id = 'all'
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND 4 = ANY(rbac.permission)
      `);

      if (createAccess.length === 0) {
        return reply.status(403).send({ error: `Insufficient permissions to create ${childEntity}` });
      }

      // Generate default values
      const defaultName = name || `New ${childEntity.charAt(0).toUpperCase() + childEntity.slice(1)}`;
      const timestamp = new Date().toISOString();
      const autoCode = `${childEntity.toUpperCase()}-${Date.now()}`;
      const autoSlug = `${childEntity}-${Date.now()}`;

      const childTableIdentifier = sql.identifier(childTable);

      // STEP 1: Create minimal child entity record
      const createResult = await db.execute(sql`
        INSERT INTO app.${childTableIdentifier} (
          name,
          code,
          slug,
          descr,
          tags,
          metadata,
          active_flag,
          created_ts,
          updated_ts,
          version
        ) VALUES (
          ${defaultName},
          ${autoCode},
          ${autoSlug},
          'Draft - please complete the details',
          '[]'::jsonb,
          '{}'::jsonb,
          true,
          ${timestamp},
          ${timestamp},
          1
        )
        RETURNING id, name
      `);

      const newEntity = createResult[0];
      const newEntityId = newEntity.id;

      // STEP 2: Create parent-child linkage in d_entity_id_map
      await db.execute(sql`
        INSERT INTO app.d_entity_id_map (
          parent_entity_type,
          parent_entity_id,
          child_entity_type,
          child_entity_id,
          relationship_type,
          active_flag,
          created_ts,
          updated_ts
        ) VALUES (
          ${parentEntity},
          ${parentId},
          ${childEntity},
          ${newEntityId}::text,
          'contains',
          true,
          ${timestamp},
          ${timestamp}
        )
      `);

      fastify.log.info(`Created ${childEntity} ${newEntityId} and linked to ${parentEntity} ${parentId}`);

      // STEP 3: Return entity ID for frontend navigation
      return reply.status(201).send({
        id: newEntityId,
        name: defaultName,
        message: `${childEntity} created successfully. Please complete the details.`
      });

    } catch (error: any) {
      fastify.log.error(`Error creating minimal ${childEntity}:`, error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
