import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

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
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM app.entity_id_rbac_map
        WHERE empid = ${empid}
          AND entity = ${entity}
          AND (entity_id = ${entityId || 'all'} OR entity_id = 'all')
          AND ${requiredPermission} = ANY(permission)
          AND active_flag = true
      ) AS has_permission
    `);
    return result[0]?.has_permission || false;
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

      // Build dynamic query using sql template
      let conditions = sql`1=1`;

      if (parent_entity_type) {
        conditions = sql`${conditions} AND parent_entity_type = ${parent_entity_type}`;
      }

      if (parent_entity_id) {
        conditions = sql`${conditions} AND parent_entity_id = ${parent_entity_id}`;
      }

      if (child_entity_type) {
        conditions = sql`${conditions} AND child_entity_type = ${child_entity_type}`;
      }

      if (child_entity_id) {
        conditions = sql`${conditions} AND child_entity_id = ${child_entity_id}`;
      }

      if (active_flag !== undefined) {
        conditions = sql`${conditions} AND active_flag = ${active_flag}`;
      }

      const result = await db.execute(sql`
        SELECT * FROM app.d_entity_id_map
        WHERE ${conditions}
        ORDER BY created_ts DESC
      `);

      return reply.send({
        success: true,
        data: result,
        total: result.length
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /api/v1/linkage/:id - Get single linkage by ID
  // --------------------------------------------------------------------------
  fastify.get<{ Params: { id: string } }>(
    '/api/v1/linkage/:id',
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

      const result = await db.execute(sql`
        SELECT * FROM app.d_entity_id_map WHERE id = ${id}
      `);

      if (result.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Linkage not found'
        });
      }

      return reply.send({
        success: true,
        data: result[0]
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /api/v1/linkage - Create new linkage
  // --------------------------------------------------------------------------
  fastify.post<{ Body: { parent_entity_type: string; parent_entity_id: string; child_entity_type: string; child_entity_id: string; relationship_type?: string } }>(
    '/api/v1/linkage',
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
      const existingCheck = await db.execute(sql`
        SELECT * FROM app.d_entity_id_map
        WHERE parent_entity_type = ${parent_entity_type}
          AND parent_entity_id = ${parent_entity_id}
          AND child_entity_type = ${child_entity_type}
          AND child_entity_id = ${child_entity_id}
      `);

      if (existingCheck.length > 0) {
        // If linkage exists but is inactive, reactivate it
        if (!existingCheck[0].active_flag) {
          const reactivated = await db.execute(sql`
            UPDATE app.d_entity_id_map
            SET active_flag = true, updated_ts = now()
            WHERE id = ${existingCheck[0].id}
            RETURNING *
          `);
          return reply.status(200).send({
            success: true,
            data: reactivated[0],
            message: 'Linkage reactivated successfully'
          });
        }
        // If already active, return the existing linkage
        return reply.status(200).send({
          success: true,
          data: existingCheck[0],
          message: 'Linkage already exists'
        });
      }

      // Create new linkage
      const result = await db.execute(sql`
        INSERT INTO app.d_entity_id_map
        (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type, active_flag)
        VALUES (${parent_entity_type}, ${parent_entity_id}, ${child_entity_type}, ${child_entity_id}, ${relationship_type || 'contains'}, true)
        RETURNING *
      `);

      return reply.status(201).send({
        success: true,
        data: result[0],
        message: 'Linkage created successfully'
      });
    }
  );

  // --------------------------------------------------------------------------
  // PUT /api/v1/linkage/:id - Update linkage
  // --------------------------------------------------------------------------
  fastify.put<{ Params: { id: string }; Body: { relationship_type?: string; active_flag?: boolean } }>(
    '/api/v1/linkage/:id',
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

      // Build dynamic update using sql template
      const updates: any[] = [sql`updated_ts = now()`];

      if (relationship_type !== undefined) {
        updates.push(sql`relationship_type = ${relationship_type}`);
      }

      if (active_flag !== undefined) {
        updates.push(sql`active_flag = ${active_flag}`);
      }

      const result = await db.execute(sql`
        UPDATE app.d_entity_id_map
        SET ${sql.join(updates, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Linkage not found'
        });
      }

      return reply.send({
        success: true,
        data: result[0],
        message: 'Linkage updated successfully'
      });
    }
  );

  // --------------------------------------------------------------------------
  // DELETE /api/v1/linkage/:id - Delete linkage (soft delete)
  // --------------------------------------------------------------------------
  fastify.delete<{ Params: { id: string } }>(
    '/api/v1/linkage/:id',
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
      const linkageResult = await db.execute(sql`
        SELECT * FROM app.d_entity_id_map WHERE id = ${id}
      `);

      if (linkageResult.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Linkage not found'
        });
      }

      const linkage = linkageResult[0];

      // Must have delete permission on both parent and child entities
      const hasParentPermission = await checkEntityPermission(empid, linkage.parent_entity_type as string, linkage.parent_entity_id as string, 3);
      const hasChildPermission = await checkEntityPermission(empid, linkage.child_entity_type as string, linkage.child_entity_id as string, 3);

      if (!hasParentPermission || !hasChildPermission) {
        return reply.status(403).send({
          success: false,
          error: 'Insufficient permissions to delete this linkage'
        });
      }

      const result = await db.execute(sql`
        UPDATE app.d_entity_id_map
        SET active_flag = false, updated_ts = now()
        WHERE id = ${id}
        RETURNING id
      `);

      if (result.length === 0) {
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
    '/api/v1/linkage/parents/:entity_type',
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
    '/api/v1/linkage/children/:entity_type',
    {
      preHandler: fastify.authenticate
    },
    async (request, reply) => {
      const { entity_type } = request.params;

      // Query d_entity_map for valid child entity types
      const result = await db.execute(sql`
        SELECT DISTINCT child_entity_type
        FROM app.d_entity_map
        WHERE parent_entity_type = ${entity_type}
          AND active_flag = true
        ORDER BY child_entity_type
      `);

      const children = result.map((row: any) => row.child_entity_type);

      return reply.send({
        success: true,
        data: children
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /api/v1/linkage/grouped - Get all mappings grouped by entity type
  // --------------------------------------------------------------------------
  fastify.get(
    '/api/v1/linkage/grouped',
    {
      preHandler: fastify.authenticate
    },
    async (request, reply) => {
      // Check if user has view permission for linkage
      const user = (request as any).user;
      const empid = user?.sub;

      if (!empid) {
        return reply.status(401).send({
          success: false,
          error: 'User not authenticated'
        });
      }

      const hasPermission = await checkEntityPermission(empid, 'linkage', 'all', 0);

      if (!hasPermission) {
        return reply.status(403).send({
          success: false,
          error: 'Insufficient permissions to view entity linkages'
        });
      }

      // Get all type linkages
      const typeLinkages = await db.execute(sql`
        SELECT * FROM app.d_entity_map
        WHERE active_flag = true
        ORDER BY parent_entity_type, child_entity_type
      `);

      // Get all instance linkages
      const instanceLinkages = await db.execute(sql`
        SELECT * FROM app.d_entity_id_map
        WHERE active_flag = true
        ORDER BY parent_entity_type, child_entity_type
      `);

      // Group by parent entity type
      const grouped: Record<string, any> = {};

      // All possible entity types
      const allEntityTypes = ['office', 'business', 'client', 'project', 'task', 'worksite',
                              'employee', 'role', 'position', 'wiki', 'artifact', 'form'];

      // Initialize all entity types with empty arrays
      allEntityTypes.forEach(entityType => {
        grouped[entityType] = {
          entity_type: entityType,
          type_linkages: [],
          instance_linkages: [],
          type_count: 0,
          instance_count: 0
        };
      });

      // Populate type linkages
      typeLinkages.forEach((linkage: any) => {
        const parentType = linkage.parent_entity_type;
        if (grouped[parentType]) {
          grouped[parentType].type_linkages.push(linkage);
          grouped[parentType].type_count++;
        }
      });

      // Populate instance linkages
      instanceLinkages.forEach((linkage: any) => {
        const parentType = linkage.parent_entity_type;
        if (grouped[parentType]) {
          grouped[parentType].instance_linkages.push(linkage);
          grouped[parentType].instance_count++;
        }
      });

      // Convert to array and sort by entity type
      const result = Object.values(grouped).sort((a: any, b: any) =>
        a.entity_type.localeCompare(b.entity_type)
      );

      // Calculate totals
      const totals = {
        total_type_linkages: typeLinkages.length,
        total_instance_linkages: instanceLinkages.length,
        entity_types: allEntityTypes.length
      };

      return reply.send({
        success: true,
        data: result,
        totals
      });
    }
  );
}
