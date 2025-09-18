import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { META_CONFIGS } from '../entityConfig/meta/index.js';
import type { MetaEntityType } from '../entityConfig/meta/index.js';
import { transformSimpleConfigForFrontend } from '../lib/simpleConfigTransformer.js';

const EntityTypeParams = Type.Object({
  entityType: Type.String()
});

export async function configRoutes(fastify: FastifyInstance): Promise<void> {
  
  // GET /api/v1/config/entity/:entityType
  // Returns frontend-safe entity configuration
  fastify.get('/api/v1/config/entity/:entityType', {
    schema: {
      params: EntityTypeParams,
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Any(), // Frontend config schema
          entityType: Type.String(),
          timestamp: Type.String()
        }),
        400: Type.Object({
          error: Type.String(),
          message: Type.String(),
          availableTypes: Type.Array(Type.String())
        }),
        500: Type.Object({
          error: Type.String(),
          message: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    try {
      const { entityType } = request.params;

      // Validate entity type
      if (!entityType || !(entityType in META_CONFIGS)) {
        return reply.status(400).send({
          error: 'Invalid entity type',
          message: `Entity type '${entityType}' is not supported. Available types: ${Object.keys(META_CONFIGS).join(', ')}`,
          availableTypes: Object.keys(META_CONFIGS)
        });
      }

      const config = META_CONFIGS[entityType as MetaEntityType];
      const frontendConfig = transformSimpleConfigForFrontend(config);

      return {
        success: true,
        data: frontendConfig,
        entityType,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      fastify.log.error('Error fetching entity configuration:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to fetch entity configuration'
      });
    }
  });

  // GET /api/v1/config/entities
  // Returns list of available entity types
  fastify.get('/api/v1/config/entities', {
    schema: {
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Object({
            entityType: Type.String(),
            displayName: Type.String(),
            displayNamePlural: Type.String(),
            description: Type.String(),
            icon: Type.String(),
            endpoint: Type.String()
          })),
          total: Type.Number(),
          timestamp: Type.String()
        }),
        500: Type.Object({
          error: Type.String(),
          message: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    try {
      const entityTypes = Object.keys(META_CONFIGS).map(key => {
        const config = META_CONFIGS[key as MetaEntityType];
        return {
          entityType: key,
          displayName: config.displayName,
          displayNamePlural: config.displayNamePlural,
          description: config.description,
          icon: config.ui.sidebarIcon,
          endpoint: `/api/v1/config/entity/${key}`
        };
      });

      return {
        success: true,
        data: entityTypes,
        total: entityTypes.length,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      fastify.log.error('Error fetching entity types:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to fetch entity types'
      });
    }
  });

  // GET /api/v1/config/schema/:entityType (backend only - includes DDL info)
  // This endpoint is for backend use and includes database schema information
  fastify.get('/api/v1/config/schema/:entityType', {
    schema: {
      params: EntityTypeParams,
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Any(), // Full config schema
          entityType: Type.String(),
          timestamp: Type.String()
        }),
        400: Type.Object({
          error: Type.String(),
          message: Type.String(),
          availableTypes: Type.Array(Type.String())
        }),
        500: Type.Object({
          error: Type.String(),
          message: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    try {
      const { entityType } = request.params;

      // Validate entity type
      if (!entityType || !(entityType in META_CONFIGS)) {
        return reply.status(400).send({
          error: 'Invalid entity type',
          message: `Entity type '${entityType}' is not supported. Available types: ${Object.keys(META_CONFIGS).join(', ')}`,
          availableTypes: Object.keys(META_CONFIGS)
        });
      }

      const config = META_CONFIGS[entityType as MetaEntityType];

      // Return full config including DDL information for backend use
      return {
        success: true,
        data: config,
        entityType,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      fastify.log.error('Error fetching entity schema:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to fetch entity schema'
      });
    }
  });
}