/**
 * Shared URL Routes
 *
 * Universal endpoint for resolving shared URLs across all entity types.
 * Public access endpoint - no authentication required.
 *
 * Endpoint: GET /api/v1/shared/:entityCode/:code
 * Example: GET /api/v1/shared/task/aB3xK9mZ
 * Example: GET /api/v1/shared/form/pQ7wM2nX
 */

import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { resolveSharedUrl } from '../../lib/shared-url-factory.js';
import { db } from '@/db/index.js';
import { getEntityInfrastructure, Permission } from '../../services/entity-infrastructure.service.js';

export async function sharedRoutes(fastify: FastifyInstance) {
  /**
   * Resolve shared URL code to entity data
   * PUBLIC ENDPOINT - No authentication required
   */
  fastify.get('/api/v1/shared/:entityCode/:code', {
    schema: {
      params: Type.Object({
        entityCode: Type.String({
          description: 'Entity type (task, form, wiki, artifact)',
          examples: ['task', 'form', 'wiki', 'artifact'],
        }),
        code: Type.String({
          minLength: 8,
          maxLength: 8,
          pattern: '^[A-Za-z0-9]{8}$',
          description: '8-character alphanumeric shared code',
          examples: ['aB3xK9mZ', 'pQ7wM2nX'],
        }),
      }),
      response: {
        200: Type.Object({
          entityCode: Type.String(),
          entityId: Type.String(),
          data: Type.Any(),
        }),
        404: Type.Object({
          error: Type.String(),
          message: Type.String(),
        }),
        500: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const { entityCode, code } = request.params as { entityCode: string; code: string };

    try {
      // Resolve shared URL to entity data
      const entity = await resolveSharedUrl(entityCode, code);

      if (!entity) {
        return reply.status(404).send({
          error: 'Not Found',
          message: `Shared URL not found: /${entityCode}/shared/${code}`,
        });
      }

      // Return entity data with metadata
      return {
        entityCode,
        entityId: entity.id,
        data: entity,
      };
    } catch (error) {
      fastify.log.error('Error resolving shared URL:', error);
      return reply.status(500).send({
        error: 'Internal server error',
      });
    }
  });

  /**
   * Generate shared URL for an entity
   * AUTHENTICATED ENDPOINT - Requires edit permission
   */
  fastify.post('/api/v1/shared/:entityCode/:id/generate', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        entityCode: Type.String({
          description: 'Entity type (task, form, wiki, artifact)',
        }),
        id: Type.String({
          format: 'uuid',
          description: 'Entity UUID',
        }),
      }),
      response: {
        200: Type.Object({
          sharedUrl: Type.String(),
          sharedCode: Type.String(),
          internalUrl: Type.String(),
        }),
        403: Type.Object({ error: Type.String() }),
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

    // Check RBAC permissions using centralized service
    const entityInfra = getEntityInfrastructure(db);
    const canEdit = await entityInfra.check_entity_rbac(userId, entityCode, id, Permission.EDIT);

    if (!canEdit) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const { createSharedUrl } = await import('../../lib/shared-url-factory.js');
      const result = await createSharedUrl(entityCode, id);
      return result;
    } catch (error) {
      fastify.log.error('Error generating shared URL:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
