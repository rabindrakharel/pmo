import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { getEntityInfrastructure, Permission } from '@/services/entity-infrastructure.service.js';

/**
 * Entity Instance Link Routes
 *
 * Manages parent-child relationships between entity instances.
 * All operations use Entity Infrastructure Service - NO raw SQL.
 *
 * Table: app.entity_instance_link
 * - entity_code, entity_instance_id (parent)
 * - child_entity_code, child_entity_instance_id (child)
 * - relationship_type (e.g., 'contains', 'assigned_to')
 */

// ============================================================================
// SCHEMAS
// ============================================================================

const LinkParamsSchema = Type.Object({
  id: Type.String({ format: 'uuid' })
});

const CreateLinkSchema = Type.Object({
  parent_entity_type: Type.String({ minLength: 1, maxLength: 50 }),
  parent_entity_id: Type.String({ format: 'uuid' }),
  child_entity_type: Type.String({ minLength: 1, maxLength: 50 }),
  child_entity_id: Type.String({ format: 'uuid' }),
  relationship_type: Type.Optional(Type.String({ maxLength: 50, default: 'contains' }))
});

const UpdateLinkSchema = Type.Object({
  relationship_type: Type.Optional(Type.String({ maxLength: 50 }))
});

const LinkQuerySchema = Type.Object({
  parent_entity_type: Type.Optional(Type.String()),
  parent_entity_id: Type.Optional(Type.String({ format: 'uuid' })),
  child_entity_type: Type.Optional(Type.String()),
  child_entity_id: Type.Optional(Type.String({ format: 'uuid' }))
});

const LinkResponseSchema = Type.Object({
  id: Type.String(),
  entity_code: Type.String(),
  entity_instance_id: Type.String(),
  child_entity_code: Type.String(),
  child_entity_instance_id: Type.String(),
  relationship_type: Type.String(),
  created_ts: Type.String(),
  updated_ts: Type.String()
});

// ============================================================================
// ROUTES
// ============================================================================

export async function entityInstanceLinkRoutes(fastify: FastifyInstance) {
  const entityInfra = getEntityInfrastructure(db);

  // --------------------------------------------------------------------------
  // GET /api/v1/entity_instance_link - List all links with optional filters
  // --------------------------------------------------------------------------
  fastify.get('/api/v1/entity_instance_link', {
    schema: {
      querystring: LinkQuerySchema,
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(LinkResponseSchema),
          total: Type.Number()
        }),
        401: Type.Object({ success: Type.Boolean(), error: Type.String() })
      }
    },
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    const user = (request as any).user;
    if (!user?.sub) {
      return reply.status(401).send({ success: false, error: 'User not authenticated' });
    }

    const { parent_entity_type, parent_entity_id, child_entity_type, child_entity_id } = request.query as {
      parent_entity_type?: string;
      parent_entity_id?: string;
      child_entity_type?: string;
      child_entity_id?: string;
    };

    // Use Entity Infrastructure Service
    const links = await entityInfra.get_all_entity_instance_links({
      parent_entity_code: parent_entity_type,
      parent_entity_id,
      child_entity_code: child_entity_type,
      child_entity_id
    });

    return reply.send({ success: true, data: links, total: links.length });
  });

  // --------------------------------------------------------------------------
  // GET /api/v1/entity_instance_link/:id - Get single link by ID
  // --------------------------------------------------------------------------
  fastify.get<{ Params: { id: string } }>('/api/v1/entity_instance_link/:id', {
    schema: {
      params: LinkParamsSchema,
      response: {
        200: Type.Object({ success: Type.Boolean(), data: LinkResponseSchema }),
        404: Type.Object({ success: Type.Boolean(), error: Type.String() })
      }
    },
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    const { id } = request.params;

    // Use Entity Infrastructure Service
    const link = await entityInfra.get_entity_instance_link_by_id(id);

    if (!link) {
      return reply.status(404).send({ success: false, error: 'Link not found' });
    }

    return reply.send({ success: true, data: link });
  });

  // --------------------------------------------------------------------------
  // POST /api/v1/entity_instance_link - Create new link
  // --------------------------------------------------------------------------
  fastify.post<{ Body: { parent_entity_type: string; parent_entity_id: string; child_entity_type: string; child_entity_id: string; relationship_type?: string } }>(
    '/api/v1/entity_instance_link',
    {
      schema: {
        body: CreateLinkSchema,
        response: {
          201: Type.Object({
            success: Type.Boolean(),
            data: LinkResponseSchema,
            message: Type.String()
          })
        }
      },
      preHandler: fastify.authenticate
    },
    async (request, reply) => {
      const { parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type } = request.body;

      // Use Entity Infrastructure Service (idempotent - handles duplicates)
      const link = await entityInfra.set_entity_instance_link({
        parent_entity_code: parent_entity_type,
        parent_entity_id,
        child_entity_code: child_entity_type,
        child_entity_id,
        relationship_type
      });

      return reply.status(201).send({
        success: true,
        data: link,
        message: 'Link created successfully'
      });
    }
  );

  // --------------------------------------------------------------------------
  // PUT /api/v1/entity_instance_link/:id - Update link
  // --------------------------------------------------------------------------
  fastify.put<{ Params: { id: string }; Body: { relationship_type?: string } }>(
    '/api/v1/entity_instance_link/:id',
    {
      schema: {
        params: LinkParamsSchema,
        body: UpdateLinkSchema,
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            data: LinkResponseSchema,
            message: Type.String()
          }),
          404: Type.Object({ success: Type.Boolean(), error: Type.String() })
        }
      },
      preHandler: fastify.authenticate
    },
    async (request, reply) => {
      const { id } = request.params;
      const { relationship_type } = request.body;

      // Use Entity Infrastructure Service
      const updatedLink = await entityInfra.update_entity_instance_link(id, relationship_type || '');

      if (!updatedLink) {
        return reply.status(404).send({ success: false, error: 'Link not found' });
      }

      return reply.send({
        success: true,
        data: updatedLink,
        message: 'Link updated successfully'
      });
    }
  );

  // --------------------------------------------------------------------------
  // DELETE /api/v1/entity_instance_link/:id - Delete link (hard delete)
  // --------------------------------------------------------------------------
  fastify.delete<{ Params: { id: string } }>(
    '/api/v1/entity_instance_link/:id',
    {
      schema: {
        params: LinkParamsSchema,
        response: {
          200: Type.Object({ success: Type.Boolean(), message: Type.String() }),
          401: Type.Object({ success: Type.Boolean(), error: Type.String() }),
          403: Type.Object({ success: Type.Boolean(), error: Type.String() }),
          404: Type.Object({ success: Type.Boolean(), error: Type.String() })
        }
      },
      preHandler: fastify.authenticate
    },
    async (request, reply) => {
      const { id } = request.params;
      const user = (request as any).user;
      const employee_id = user?.sub;

      if (!employee_id) {
        return reply.status(401).send({ success: false, error: 'User not authenticated' });
      }

      // Get link for permission check
      const link = await entityInfra.get_entity_instance_link_by_id(id);

      if (!link) {
        return reply.status(404).send({ success: false, error: 'Link not found' });
      }

      // RBAC check - must have DELETE permission on both parent and child
      const hasParentPermission = await entityInfra.check_entity_rbac(
        employee_id,
        link.entity_code as string,
        link.entity_instance_id as string,
        Permission.DELETE
      );
      const hasChildPermission = await entityInfra.check_entity_rbac(
        employee_id,
        link.child_entity_code as string,
        link.child_entity_instance_id as string,
        Permission.DELETE
      );

      if (!hasParentPermission || !hasChildPermission) {
        return reply.status(403).send({ success: false, error: 'Insufficient permissions' });
      }

      // Use Entity Infrastructure Service
      await entityInfra.delete_entity_instance_link(id);

      return reply.send({ success: true, message: 'Link deleted successfully' });
    }
  );

  // --------------------------------------------------------------------------
  // GET /api/v1/entity_instance_link/parents/:entity_type - Get valid parent entity types
  // --------------------------------------------------------------------------
  fastify.get<{ Params: { entity_type: string } }>(
    '/api/v1/entity_instance_link/parents/:entity_type',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { entity_type } = request.params;

      // Use Entity Infrastructure Service
      const parents = await entityInfra.get_parent_entity_codes(entity_type);

      return reply.send({ success: true, data: parents });
    }
  );

  // --------------------------------------------------------------------------
  // GET /api/v1/entity_instance_link/children/:entity_type - Get valid child entity types
  // --------------------------------------------------------------------------
  fastify.get<{ Params: { entity_type: string } }>(
    '/api/v1/entity_instance_link/children/:entity_type',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { entity_type } = request.params;

      // Use Entity Infrastructure Service
      const entity = await entityInfra.get_entity(entity_type);

      if (!entity) {
        return reply.send({ success: true, data: [] });
      }

      const children = (entity.child_entity_codes || []).sort();
      return reply.send({ success: true, data: children });
    }
  );

  // --------------------------------------------------------------------------
  // GET /api/v1/entity_instance_link/grouped - Get all mappings grouped by entity type
  // --------------------------------------------------------------------------
  fastify.get('/api/v1/entity_instance_link/grouped', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    const user = (request as any).user;
    if (!user?.sub) {
      return reply.status(401).send({ success: false, error: 'User not authenticated' });
    }

    // Use Entity Infrastructure Service
    const entities = await entityInfra.get_all_entity(false);

    // Build type linkages from entity.child_entity_codes
    const typeLinkages: any[] = [];
    entities.forEach((entity) => {
      const parentType = entity.code;
      const childEntities = entity.child_entity_codes || [];

      childEntities.forEach((childCode) => {
        typeLinkages.push({
          id: `${parentType}-${childCode}`,
          parent_entity_code: parentType,
          child_entity_code: childCode,
          active_flag: true,
          from_ts: new Date().toISOString(),
          created_ts: new Date().toISOString(),
          updated_ts: new Date().toISOString()
        });
      });
    });

    // Get all instance links
    const instanceLinks = await entityInfra.get_all_entity_instance_links({});

    // Group by parent entity type
    const grouped: Record<string, any> = {};
    const allEntityTypes = entities.map((e) => e.code);

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
      const parentType = linkage.parent_entity_code;
      if (grouped[parentType]) {
        grouped[parentType].type_linkages.push(linkage);
        grouped[parentType].type_count++;
      }
    });

    // Populate instance linkages
    instanceLinks.forEach((linkage: any) => {
      const parentType = linkage.entity_code;
      if (grouped[parentType]) {
        grouped[parentType].instance_linkages.push(linkage);
        grouped[parentType].instance_count++;
      }
    });

    const result = Object.values(grouped).sort((a: any, b: any) =>
      a.entity_type.localeCompare(b.entity_type)
    );

    const totals = {
      total_type_linkages: typeLinkages.length,
      total_instance_linkages: instanceLinks.length,
      entity_types: allEntityTypes.length
    };

    return reply.send({ success: true, data: result, totals });
  });
}
