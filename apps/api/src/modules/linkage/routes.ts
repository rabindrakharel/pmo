import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';

// ============================================================================
// SCHEMAS
// ============================================================================

const LinkageParamsSchema = Type.Object({
  id: Type.String({ format: 'uuid' })
});

const CreateLinkageSchema = Type.Object({
  parent_entity_type: Type.String({ minLength: 1, maxLength: 20 }),
  parent_entity_id: Type.String({ format: 'uuid' }),
  child_entity_type: Type.String({ minLength: 1, maxLength: 20 }),
  child_entity_id: Type.String({ format: 'uuid' }),
  relationship_type: Type.Optional(Type.String({ maxLength: 50, default: 'contains' }))
});

const UpdateLinkageSchema = Type.Object({
  relationship_type: Type.Optional(Type.String({ maxLength: 50 })),
  active_flag: Type.Optional(Type.Boolean())
});

const LinkageQuerySchema = Type.Object({
  parent_entity_type: Type.Optional(Type.String()),
  parent_entity_id: Type.Optional(Type.String({ format: 'uuid' })),
  child_entity_type: Type.Optional(Type.String()),
  child_entity_id: Type.Optional(Type.String({ format: 'uuid' })),
  active_flag: Type.Optional(Type.Boolean({ default: true }))
});

// ============================================================================
// ROUTES
// ============================================================================

export async function linkageRoutes(fastify: FastifyInstance) {
  // --------------------------------------------------------------------------
  // Helper function to check RBAC permissions
  // --------------------------------------------------------------------------
  async function checkEntityPermission(
    empid: string,
    entity: string,
    entityId: string | null,
    requiredPermission: number
  ): Promise<boolean> {
    const result = await db.query(
      `SELECT EXISTS (
        SELECT 1 FROM app.entity_id_rbac_map
        WHERE empid = $1
          AND entity = $2
          AND (entity_id = $3 OR entity_id = 'all')
          AND $4 = ANY(permission)
          AND active_flag = true
      ) AS has_permission`,
      [empid, entity, entityId || 'all', requiredPermission]
    );
    return result.rows[0]?.has_permission || false;
  }

  // --------------------------------------------------------------------------
  // GET /api/v1/linkage - List all linkages (with optional filters)
  // --------------------------------------------------------------------------
  fastify.get(
    '/api/v1/linkage',
    {
      schema: {
        querystring: LinkageQuerySchema,
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            data: Type.Array(Type.Object({
              id: Type.String(),
              parent_entity_type: Type.String(),
              parent_entity_id: Type.String(),
              child_entity_type: Type.String(),
              child_entity_id: Type.String(),
              relationship_type: Type.String(),
              active_flag: Type.Boolean(),
              created_ts: Type.String(),
              updated_ts: Type.String()
            })),
            total: Type.Number()
          })
        }
      },
      preHandler: fastify.authenticate
    },
    async (request, reply) => {
      // Check if user has view permission for entity_id_map (treat as special entity)
      const user = (request as any).user;
      const empid = user?.sub;

      if (!empid) {
        return reply.status(401).send({
          success: false,
          error: 'User not authenticated'
        });
      }

      // Check permission to view entity relationships
      // Permission 0 (View) on entity='linkage' or entity='all'
      const hasPermission = await checkEntityPermission(empid, 'linkage', 'all', 0);

      if (!hasPermission) {
        return reply.status(403).send({
          success: false,
          error: 'Insufficient permissions to view entity linkages'
        });
      }
      const { parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, active_flag } = request.query;

      let query = 'SELECT * FROM app.entity_id_map WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (parent_entity_type) {
        query += ` AND parent_entity_type = $${paramIndex++}`;
        params.push(parent_entity_type);
      }

      if (parent_entity_id) {
        query += ` AND parent_entity_id = $${paramIndex++}`;
        params.push(parent_entity_id);
      }

      if (child_entity_type) {
        query += ` AND child_entity_type = $${paramIndex++}`;
        params.push(child_entity_type);
      }

      if (child_entity_id) {
        query += ` AND child_entity_id = $${paramIndex++}`;
        params.push(child_entity_id);
      }

      if (active_flag !== undefined) {
        query += ` AND active_flag = $${paramIndex++}`;
        params.push(active_flag);
      }

      query += ' ORDER BY created_ts DESC';

      const result = await db.query(query, params);

      return reply.send({
        success: true,
        data: result.rows,
        total: result.rows.length
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /api/v1/linkage/:id - Get single linkage by ID
  // --------------------------------------------------------------------------
  fastify.get<{ Params: LinkageParams }>(
    '/linkage/:id',
    {
      schema: {
        params: LinkageParamsSchema,
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            data: Type.Object({
              id: Type.String(),
              parent_entity_type: Type.String(),
              parent_entity_id: Type.String(),
              child_entity_type: Type.String(),
              child_entity_id: Type.String(),
              relationship_type: Type.String(),
              active_flag: Type.Boolean(),
              created_ts: Type.String(),
              updated_ts: Type.String()
            })
          })
        }
      },
      preHandler: fastify.authenticate
    },
    async (request, reply) => {
      const { id } = request.params;

      const result = await db.query(
        'SELECT * FROM app.entity_id_map WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Linkage not found'
        });
      }

      return reply.send({
        success: true,
        data: result.rows[0]
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /api/v1/linkage - Create new linkage
  // --------------------------------------------------------------------------
  fastify.post<{ Body: CreateLinkage }>(
    '/linkage',
    {
      schema: {
        body: CreateLinkageSchema,
        response: {
          201: Type.Object({
            success: Type.Boolean(),
            data: Type.Object({
              id: Type.String(),
              parent_entity_type: Type.String(),
              parent_entity_id: Type.String(),
              child_entity_type: Type.String(),
              child_entity_id: Type.String(),
              relationship_type: Type.String(),
              active_flag: Type.Boolean(),
              created_ts: Type.String(),
              updated_ts: Type.String()
            }),
            message: Type.String()
          })
        }
      },
      preHandler: fastify.authenticate
    },
    async (request, reply) => {
      const { parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type } = request.body;

      // Check RBAC permissions
      const user = (request as any).user;
      const empid = user?.sub;

      if (!empid) {
        return reply.status(401).send({
          success: false,
          error: 'User not authenticated'
        });
      }

      // Must have edit permission on parent entity and edit permission on child entity
      const hasParentPermission = await checkEntityPermission(empid, parent_entity_type, parent_entity_id, 1);
      const hasChildPermission = await checkEntityPermission(empid, child_entity_type, child_entity_id, 1);

      if (!hasParentPermission || !hasChildPermission) {
        return reply.status(403).send({
          success: false,
          error: 'Insufficient permissions to create linkage between these entities'
        });
      }

      // Check if linkage already exists
      const existingCheck = await db.query(
        `SELECT id FROM app.entity_id_map
         WHERE parent_entity_type = $1
           AND parent_entity_id = $2
           AND child_entity_type = $3
           AND child_entity_id = $4`,
        [parent_entity_type, parent_entity_id, child_entity_type, child_entity_id]
      );

      if (existingCheck.rows.length > 0) {
        return reply.status(409).send({
          success: false,
          error: 'Linkage already exists'
        });
      }

      // Create new linkage
      const result = await db.query(
        `INSERT INTO app.entity_id_map
         (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type, active_flag)
         VALUES ($1, $2, $3, $4, $5, true)
         RETURNING *`,
        [parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type || 'contains']
      );

      return reply.status(201).send({
        success: true,
        data: result.rows[0],
        message: 'Linkage created successfully'
      });
    }
  );

  // --------------------------------------------------------------------------
  // PUT /api/v1/linkage/:id - Update linkage
  // --------------------------------------------------------------------------
  fastify.put<{ Params: LinkageParams; Body: UpdateLinkage }>(
    '/linkage/:id',
    {
      schema: {
        params: LinkageParamsSchema,
        body: UpdateLinkageSchema,
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            data: Type.Object({
              id: Type.String(),
              parent_entity_type: Type.String(),
              parent_entity_id: Type.String(),
              child_entity_type: Type.String(),
              child_entity_id: Type.String(),
              relationship_type: Type.String(),
              active_flag: Type.Boolean(),
              created_ts: Type.String(),
              updated_ts: Type.String()
            }),
            message: Type.String()
          })
        }
      },
      preHandler: fastify.authenticate
    },
    async (request, reply) => {
      const { id } = request.params;
      const { relationship_type, active_flag } = request.body;

      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (relationship_type !== undefined) {
        updates.push(`relationship_type = $${paramIndex++}`);
        params.push(relationship_type);
      }

      if (active_flag !== undefined) {
        updates.push(`active_flag = $${paramIndex++}`);
        params.push(active_flag);
      }

      updates.push(`updated_ts = now()`);
      params.push(id);

      const query = `
        UPDATE app.entity_id_map
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await db.query(query, params);

      if (result.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Linkage not found'
        });
      }

      return reply.send({
        success: true,
        data: result.rows[0],
        message: 'Linkage updated successfully'
      });
    }
  );

  // --------------------------------------------------------------------------
  // DELETE /api/v1/linkage/:id - Delete linkage (soft delete)
  // --------------------------------------------------------------------------
  fastify.delete<{ Params: LinkageParams }>(
    '/linkage/:id',
    {
      schema: {
        params: LinkageParamsSchema,
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            message: Type.String()
          })
        }
      },
      preHandler: fastify.authenticate
    },
    async (request, reply) => {
      const { id } = request.params;

      // Check RBAC permissions - user must have delete permission on linkage entity
      const user = (request as any).user;
      const empid = user?.sub;

      if (!empid) {
        return reply.status(401).send({
          success: false,
          error: 'User not authenticated'
        });
      }

      // Get the linkage to check permissions on parent and child entities
      const linkageResult = await db.query(
        'SELECT * FROM app.entity_id_map WHERE id = $1',
        [id]
      );

      if (linkageResult.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Linkage not found'
        });
      }

      const linkage = linkageResult.rows[0];

      // Must have delete permission on both parent and child entities
      const hasParentPermission = await checkEntityPermission(empid, linkage.parent_entity_type, linkage.parent_entity_id, 3);
      const hasChildPermission = await checkEntityPermission(empid, linkage.child_entity_type, linkage.child_entity_id, 3);

      if (!hasParentPermission || !hasChildPermission) {
        return reply.status(403).send({
          success: false,
          error: 'Insufficient permissions to delete this linkage'
        });
      }

      const result = await db.query(
        'UPDATE app.entity_id_map SET active_flag = false, updated_ts = now() WHERE id = $1 RETURNING id',
        [id]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Linkage not found'
        });
      }

      return reply.send({
        success: true,
        message: 'Linkage deleted successfully'
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /api/v1/linkage/parents/:entity_type - Get all valid parent entities for a child entity type
  // --------------------------------------------------------------------------
  fastify.get<{ Params: { entity_type: string } }>(
    '/linkage/parents/:entity_type',
    {
      preHandler: fastify.authenticate
    },
    async (request, reply) => {
      const { entity_type } = request.params;

      // Define valid parent-child relationships
      const validParents: Record<string, string[]> = {
        business: ['office'],
        project: ['business', 'client'],
        task: ['project', 'worksite'],
        wiki: ['project', 'task', 'office', 'business'],
        artifact: ['project', 'task', 'office', 'business'],
        form: ['project', 'task', 'worksite'],
        worksite: ['office', 'client']
      };

      const parents = validParents[entity_type] || [];

      return reply.send({
        success: true,
        data: parents
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /api/v1/linkage/children/:entity_type - Get all valid child entity types for a parent entity
  // --------------------------------------------------------------------------
  fastify.get<{ Params: { entity_type: string } }>(
    '/linkage/children/:entity_type',
    {
      preHandler: fastify.authenticate
    },
    async (request, reply) => {
      const { entity_type } = request.params;

      // Define valid parent-child relationships
      const validChildren: Record<string, string[]> = {
        office: ['business', 'worksite'],
        business: ['project'],
        client: ['project', 'worksite'],
        project: ['task', 'wiki', 'artifact', 'form'],
        task: ['wiki', 'artifact', 'form'],
        worksite: ['task', 'form']
      };

      const children = validChildren[entity_type] || [];

      return reply.send({
        success: true,
        data: children
      });
    }
  );
}
