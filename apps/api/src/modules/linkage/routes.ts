import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
// ✅ Entity Infrastructure Service - Centralized infrastructure management
import { getEntityInfrastructure, Permission } from '../../services/entity-infrastructure.service.js';

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
  // ═══════════════════════════════════════════════════════════════
  // ✅ ENTITY INFRASTRUCTURE SERVICE - Initialize service instance
  // ═══════════════════════════════════════════════════════════════
  const entityInfra = getEntityInfrastructure(db);

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

      // ═══════════════════════════════════════════════════════════════
      // ✅ ENTITY INFRASTRUCTURE SERVICE - Get all linkages with filters
      // ═══════════════════════════════════════════════════════════════
      const linkages = await entityInfra.get_all_entity_instance_links({
        parent_entity_type,
        parent_entity_id,
        child_entity_type,
        child_entity_id,
        active_flag
      });

      return reply.send({
        success: true,
        data: linkages,
        total: linkages.length
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

      // ═══════════════════════════════════════════════════════════════
      // ✅ ENTITY INFRASTRUCTURE SERVICE - Get single linkage by ID
      // ═══════════════════════════════════════════════════════════════
      const linkage = await entityInfra.get_entity_instance_link_by_id(id);

      if (!linkage) {
        return reply.status(404).send({
          success: false,
          error: 'Linkage not found'
        });
      }

      return reply.send({
        success: true,
        data: linkage
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

      // ═══════════════════════════════════════════════════════════════
      // ✅ ENTITY INFRASTRUCTURE SERVICE - Create linkage
      // Idempotent - handles duplicates & reactivation automatically
      // ═══════════════════════════════════════════════════════════════
      const linkage = await entityInfra.set_entity_instance_link({
        parent_entity_type,
        parent_entity_id,
        child_entity_type,
        child_entity_id,
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

      // ═══════════════════════════════════════════════════════════════
      // ✅ ENTITY INFRASTRUCTURE SERVICE - Update linkage
      // ═══════════════════════════════════════════════════════════════
      const updatedLinkage = await entityInfra.update_entity_instance_link(id, {
        relationship_type,
        active_flag
      });

      if (!updatedLinkage) {
        return reply.status(404).send({
          success: false,
          error: 'Linkage not found'
        });
      }

      return reply.send({
        success: true,
        data: updatedLinkage,
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

      const user = (request as any).user;
      const employee_id = user?.sub;

      if (!employee_id) {
        return reply.status(401).send({
          success: false,
          error: 'User not authenticated'
        });
      }

      // ═══════════════════════════════════════════════════════════════
      // ✅ ENTITY INFRASTRUCTURE SERVICE - Get linkage for permission check
      // ═══════════════════════════════════════════════════════════════
      const linkage = await entityInfra.get_entity_instance_link_by_id(id);

      if (!linkage) {
        return reply.status(404).send({
          success: false,
          error: 'Linkage not found'
        });
      }

      // ═══════════════════════════════════════════════════════════════
      // ✅ ENTITY INFRASTRUCTURE SERVICE - RBAC check
      // Must have DELETE permission on both parent and child entities
      // ═══════════════════════════════════════════════════════════════
      const hasParentPermission = await entityInfra.check_entity_rbac(
        employee_id,
        linkage.parent_entity_type as string,
        linkage.parent_entity_id as string,
        Permission.DELETE
      );
      const hasChildPermission = await entityInfra.check_entity_rbac(
        employee_id,
        linkage.child_entity_type as string,
        linkage.child_entity_id as string,
        Permission.DELETE
      );

      if (!hasParentPermission || !hasChildPermission) {
        return reply.status(403).send({
          success: false,
          error: 'Insufficient permissions to delete this linkage'
        });
      }

      // ═══════════════════════════════════════════════════════════════
      // ✅ ENTITY INFRASTRUCTURE SERVICE - Delete linkage (soft delete)
      // ═══════════════════════════════════════════════════════════════
      const result = await entityInfra.delete_entity_instance_link(id);

      if (!result) {
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

      // ═══════════════════════════════════════════════════════════════
      // ✅ ENTITY INFRASTRUCTURE SERVICE - Get parent entity types
      // Finds all entities that have this entity_type in their child_entity_codes
      // ═══════════════════════════════════════════════════════════════
      const parents = await entityInfra.get_parent_entity_types(entity_type);

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

      // ═══════════════════════════════════════════════════════════════
      // ✅ ENTITY INFRASTRUCTURE SERVICE - Get entity metadata
      // ═══════════════════════════════════════════════════════════════
      const entity = await entityInfra.get_entity(entity_type);

      if (!entity) {
        return reply.send({
          success: true,
          data: []
        });
      }

      // Extract child entity codes from child_entity_codes array
      const children = (entity.child_entity_codes || []).sort();

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

      // ═══════════════════════════════════════════════════════════════
      // ✅ ENTITY INFRASTRUCTURE SERVICE - Get all entities
      // ═══════════════════════════════════════════════════════════════
      const entities = await entityInfra.get_all_entity(false);

      // Build type linkages from entity.child_entity_codes
      const typeLinkages: any[] = [];
      entities.forEach((entity) => {
        const parentType = entity.code;
        const childEntities = entity.child_entity_codes || [];

        childEntities.forEach((childCode) => {
          typeLinkages.push({
            id: `${parentType}-${childCode}`,
            parent_entity_type: parentType,
            child_entity_type: childCode,
            active_flag: true,
            from_ts: new Date().toISOString(),
            created_ts: new Date().toISOString(),
            updated_ts: new Date().toISOString()
          });
        });
      });

      // ═══════════════════════════════════════════════════════════════
      // ✅ ENTITY INFRASTRUCTURE SERVICE - Get all instance linkages
      // ═══════════════════════════════════════════════════════════════
      const instanceLinkages = await entityInfra.get_all_entity_instance_links({
        active_flag: true
      });

      // Group by parent entity type
      const grouped: Record<string, any> = {};

      // Get all entity codes
      const allEntityTypes = entities.map((e) => e.code);

      // Initialize all entity types with empty arrays
      allEntityTypes.forEach(entityCode => {
        grouped[entityCode] = {
          entity_type: entityCode,
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
