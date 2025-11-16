import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
// ✅ Centralized linkage service
import { createLinkage as createLinkageService, deleteLinkage as deleteLinkageService } from '../../services/linkage.service.js';

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
    employeeId: string,
    entity: string,
    entityId: string | null,
    requiredPermission: number
  ): Promise<boolean> {
    // Use special UUID for "all" entities permission (universal RBAC pattern)
    const ALL_ENTITIES_UUID = '11111111-1111-1111-1111-111111111111';
    const targetEntityId = entityId || ALL_ENTITIES_UUID;

    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM app.entity_id_rbac_map
        WHERE person_entity_id = ${employeeId}::uuid
          AND entity_name = ${entity}
          AND (entity_id = ${targetEntityId}::uuid OR entity_id = ${ALL_ENTITIES_UUID}::uuid)
          AND permission >= ${requiredPermission}
          AND active_flag = true
      ) AS has_permission
    `);
    return Boolean(result[0]?.has_permission) || false;
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
          }),
          401: Type.Object({ success: Type.Boolean(), error: Type.String() })
        }
      },
      preHandler: fastify.authenticate
    },
    async (request, reply) => {
      // Linkage is infrastructure - allow all authenticated users to view
      const user = (request as any).user;
      const employee_id = user?.sub;

      if (!employee_id) {
        return reply.status(401).send({
          success: false,
          error: 'User not authenticated'
        });
      }

      const { parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, active_flag } = request.query as {
        parent_entity_type?: string;
        parent_entity_id?: string;
        child_entity_type?: string;
        child_entity_id?: string;
        active_flag?: boolean;
      };

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

      // No RBAC check - allow all authenticated users to create linkages

      // Use centralized linkage service (idempotent - handles duplicates & reactivation)
      const linkage = await createLinkageService(db, {
        parent_entity_type,
        parent_entity_id,
        child_entity_id,
        child_entity_type,
        relationship_type
      });

      return reply.status(201).send({
        success: true,
        data: linkage,
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
      const employee_id = user?.sub;

      if (!employee_id) {
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
      const hasParentPermission = await checkEntityPermission(employee_id, linkage.parent_entity_type as string, linkage.parent_entity_id as string, 3);
      const hasChildPermission = await checkEntityPermission(employee_id, linkage.child_entity_type as string, linkage.child_entity_id as string, 3);

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

      // Query d_entity for child_entities from parent entity
      const result = await db.execute(sql`
        SELECT child_entities
        FROM app.d_entity
        WHERE code = ${entity_type}
          AND active_flag = true
      `);

      // Extract child entity codes from JSONB array
      // Handle both formats: ["task", "wiki"] and [{entity: "task"}, {entity: "wiki"}]
      const children = result[0]?.child_entities
        ? (result[0].child_entities as any[]).map((child: any) =>
            typeof child === 'string' ? child : child.entity
          ).sort()
        : [];

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
      // Linkage is infrastructure - allow all authenticated users to view
      const user = (request as any).user;
      const employee_id = user?.sub;

      if (!employee_id) {
        return reply.status(401).send({
          success: false,
          error: 'User not authenticated'
        });
      }

      // Get all entities with their child_entities from d_entity
      const entities = await db.execute(sql`
        SELECT code, child_entities
        FROM app.d_entity
        WHERE active_flag = true
        ORDER BY code
      `);

      // Build type linkages from d_entity.child_entities
      const typeLinkages: any[] = [];
      entities.forEach((entity: any) => {
        const parentType = entity.code;
        const childEntities = entity.child_entities || [];

        childEntities.forEach((child: any) => {
          typeLinkages.push({
            id: `${parentType}-${child.entity}`,
            parent_entity_type: parentType,
            child_entity_type: child.entity,
            active_flag: true,
            from_ts: new Date().toISOString(),
            created_ts: new Date().toISOString(),
            updated_ts: new Date().toISOString()
          });
        });
      });

      // Get all instance linkages
      const instanceLinkages = await db.execute(sql`
        SELECT * FROM app.d_entity_id_map
        WHERE active_flag = true
        ORDER BY parent_entity_type, child_entity_type
      `);

      // Group by parent entity type
      const grouped: Record<string, any> = {};

      // Get all entity codes from d_entity
      const allEntityTypes = entities.map((e: any) => e.code);

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
