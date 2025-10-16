import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

// ============================================================================
// SCHEMAS
// ============================================================================

const TypeLinkageParamsSchema = Type.Object({
  id: Type.String({ format: 'uuid' })
});

const CreateTypeLinkageSchema = Type.Object({
  parent_entity_type: Type.String({ minLength: 1, maxLength: 20 }),
  child_entity_type: Type.String({ minLength: 1, maxLength: 20 }),
  relationship_type: Type.Optional(Type.String({ maxLength: 50, default: 'contains' })),
  description: Type.Optional(Type.String())
});

const UpdateTypeLinkageSchema = Type.Object({
  relationship_type: Type.Optional(Type.String({ maxLength: 50 })),
  is_enabled: Type.Optional(Type.Boolean()),
  description: Type.Optional(Type.String())
});

// ============================================================================
// ROUTES - ENTITY TYPE LINKAGE (Type-to-Type Mappings)
// ============================================================================

export async function typeLinkageRoutes(fastify: FastifyInstance) {
  // --------------------------------------------------------------------------
  // GET /api/v1/linkage/types - List all type-to-type linkage rules
  // --------------------------------------------------------------------------
  fastify.get(
    '/api/v1/linkage/types',
    {
      schema: {
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            data: Type.Array(Type.Object({
              id: Type.String(),
              parent_entity_type: Type.String(),
              child_entity_type: Type.String(),
              relationship_type: Type.String(),
              is_enabled: Type.Boolean(),
              description: Type.Union([Type.String(), Type.Null()]),
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
      const result = await db.execute(sql`
        SELECT * FROM app.entity_type_linkage_map
        ORDER BY parent_entity_type, child_entity_type
      `);

      return reply.send({
        success: true,
        data: result,
        total: result.length
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /api/v1/linkage/types/:id - Get single type linkage by ID
  // --------------------------------------------------------------------------
  fastify.get<{ Params: { id: string } }>(
    '/api/v1/linkage/types/:id',
    {
      schema: {
        params: TypeLinkageParamsSchema,
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            data: Type.Object({
              id: Type.String(),
              parent_entity_type: Type.String(),
              child_entity_type: Type.String(),
              relationship_type: Type.String(),
              is_enabled: Type.Boolean(),
              description: Type.Union([Type.String(), Type.Null()]),
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
        SELECT * FROM app.entity_type_linkage_map WHERE id = ${id}
      `);

      if (result.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Type linkage not found'
        });
      }

      return reply.send({
        success: true,
        data: result[0]
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /api/v1/linkage/types - Create new type-to-type linkage rule
  // --------------------------------------------------------------------------
  fastify.post<{ Body: { parent_entity_type: string; child_entity_type: string; relationship_type?: string; description?: string } }>(
    '/api/v1/linkage/types',
    {
      schema: {
        body: CreateTypeLinkageSchema,
        response: {
          201: Type.Object({
            success: Type.Boolean(),
            data: Type.Object({
              id: Type.String(),
              parent_entity_type: Type.String(),
              child_entity_type: Type.String(),
              relationship_type: Type.String(),
              is_enabled: Type.Boolean(),
              description: Type.Union([Type.String(), Type.Null()]),
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
      const { parent_entity_type, child_entity_type, relationship_type, description } = request.body;

      // Check if type linkage already exists
      const existingCheck = await db.execute(sql`
        SELECT id FROM app.entity_type_linkage_map
        WHERE parent_entity_type = ${parent_entity_type}
          AND child_entity_type = ${child_entity_type}
      `);

      if (existingCheck.length > 0) {
        return reply.status(409).send({
          success: false,
          error: 'Type linkage already exists'
        });
      }

      // Create new type linkage
      const result = await db.execute(sql`
        INSERT INTO app.entity_type_linkage_map
        (parent_entity_type, child_entity_type, relationship_type, description, is_enabled)
        VALUES (${parent_entity_type}, ${child_entity_type}, ${relationship_type || 'contains'}, ${description || null}, true)
        RETURNING *
      `);

      return reply.status(201).send({
        success: true,
        data: result[0],
        message: 'Type linkage created successfully'
      });
    }
  );

  // --------------------------------------------------------------------------
  // PUT /api/v1/linkage/types/:id - Update type linkage
  // --------------------------------------------------------------------------
  fastify.put<{ Params: { id: string }; Body: { relationship_type?: string; is_enabled?: boolean; description?: string } }>(
    '/api/v1/linkage/types/:id',
    {
      schema: {
        params: TypeLinkageParamsSchema,
        body: UpdateTypeLinkageSchema,
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            data: Type.Object({
              id: Type.String(),
              parent_entity_type: Type.String(),
              child_entity_type: Type.String(),
              relationship_type: Type.String(),
              is_enabled: Type.Boolean(),
              description: Type.Union([Type.String(), Type.Null()]),
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
      const { relationship_type, is_enabled, description } = request.body;

      // Build dynamic update
      const updates: any[] = [sql`updated_ts = now()`];

      if (relationship_type !== undefined) {
        updates.push(sql`relationship_type = ${relationship_type}`);
      }

      if (is_enabled !== undefined) {
        updates.push(sql`is_enabled = ${is_enabled}`);
      }

      if (description !== undefined) {
        updates.push(sql`description = ${description}`);
      }

      const result = await db.execute(sql`
        UPDATE app.entity_type_linkage_map
        SET ${sql.join(updates, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Type linkage not found'
        });
      }

      return reply.send({
        success: true,
        data: result[0],
        message: 'Type linkage updated successfully'
      });
    }
  );

  // --------------------------------------------------------------------------
  // DELETE /api/v1/linkage/types/:id - Delete type linkage
  // --------------------------------------------------------------------------
  fastify.delete<{ Params: { id: string } }>(
    '/api/v1/linkage/types/:id',
    {
      schema: {
        params: TypeLinkageParamsSchema,
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

      const result = await db.execute(sql`
        DELETE FROM app.entity_type_linkage_map
        WHERE id = ${id}
        RETURNING id
      `);

      if (result.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Type linkage not found'
        });
      }

      return reply.send({
        success: true,
        message: 'Type linkage deleted successfully'
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /api/v1/linkage/types/valid-children/:parent_type - Get valid child types for parent
  // --------------------------------------------------------------------------
  fastify.get<{ Params: { parent_type: string } }>(
    '/api/v1/linkage/types/valid-children/:parent_type',
    {
      preHandler: fastify.authenticate
    },
    async (request, reply) => {
      const { parent_type } = request.params;

      const result = await db.execute(sql`
        SELECT child_entity_type, relationship_type, description
        FROM app.entity_type_linkage_map
        WHERE parent_entity_type = ${parent_type}
          AND is_enabled = true
        ORDER BY child_entity_type
      `);

      return reply.send({
        success: true,
        data: result
      });
    }
  );
}
