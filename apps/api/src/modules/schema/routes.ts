import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { ENTITY_CONFIG, getEntityConfig, getAllEntityNames } from '../../../../../shared/entityConfig.js';

// Schema response types
const FieldConfigSchema = Type.Object({
  ddlColumn: Type.String(),
  apiField: Type.String(),
  type: Type.String(),
  required: Type.Optional(Type.Boolean()),
  generated: Type.Optional(Type.Boolean()),
  hidden: Type.Optional(Type.Boolean()),
  label: Type.String(),
  placeholder: Type.Optional(Type.String()),
  inputType: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  validation: Type.Optional(Type.Any()),
  options: Type.Optional(Type.Array(Type.Any())),
  relationshipConfig: Type.Optional(Type.Any()),
  defaultValue: Type.Optional(Type.Any()),
  itemType: Type.Optional(Type.String()),
  sortable: Type.Optional(Type.Boolean()),
  filterable: Type.Optional(Type.Boolean()),
  searchable: Type.Optional(Type.Boolean())
});

const EntityConfigSchema = Type.Object({
  table: Type.String(),
  primaryKey: Type.String(),
  apiEndpoint: Type.String(),
  displayName: Type.String(),
  displayNamePlural: Type.Optional(Type.String()),
  icon: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  fields: Type.Record(Type.String(), FieldConfigSchema),
  listView: Type.Optional(Type.Any()),
  createForm: Type.Optional(Type.Any()),
  permissions: Type.Optional(Type.Any())
});

export async function schemaRoutes(fastify: FastifyInstance) {
  // Get all available entity schemas
  fastify.get('/api/v1/schema', {
    preHandler: [fastify.authenticate],
    schema: {
      response: {
        200: Type.Object({
          entities: Type.Array(Type.String()),
          total: Type.Number()
        }),
        401: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    try {
      const entities = getAllEntityNames();
      
      return {
        entities,
        total: entities.length
      };
    } catch (error) {
      fastify.log.error('Error fetching schema list:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get specific entity schema
  fastify.get('/api/v1/schema/:entityType', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        entityType: Type.String()
      }),
      response: {
        200: EntityConfigSchema,
        401: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    const { entityType } = request.params as { entityType: string };
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    try {
      const entityConfig = getEntityConfig(entityType);
      
      if (!entityConfig) {
        return reply.status(404).send({ 
          error: `Entity schema '${entityType}' not found` 
        });
      }

      return entityConfig;
    } catch (error) {
      fastify.log.error(`Error fetching schema for ${entityType}:`, error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get field configuration for specific entity and field
  fastify.get('/api/v1/schema/:entityType/field/:fieldName', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        entityType: Type.String(),
        fieldName: Type.String()
      }),
      response: {
        200: FieldConfigSchema,
        401: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    const { entityType, fieldName } = request.params as { 
      entityType: string; 
      fieldName: string; 
    };
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    try {
      const entityConfig = getEntityConfig(entityType);
      
      if (!entityConfig) {
        return reply.status(404).send({ 
          error: `Entity schema '${entityType}' not found` 
        });
      }

      const fieldConfig = entityConfig.fields[fieldName];
      
      if (!fieldConfig) {
        return reply.status(404).send({ 
          error: `Field '${fieldName}' not found in entity '${entityType}'` 
        });
      }

      return fieldConfig;
    } catch (error) {
      fastify.log.error(`Error fetching field config for ${entityType}.${fieldName}:`, error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get form configuration for creating new entity
  fastify.get('/api/v1/schema/:entityType/create-form', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        entityType: Type.String()
      }),
      response: {
        200: Type.Object({
          entityType: Type.String(),
          displayName: Type.String(),
          sections: Type.Optional(Type.Array(Type.Any())),
          fields: Type.Array(Type.String()),
          fieldConfigs: Type.Record(Type.String(), FieldConfigSchema)
        }),
        401: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    const { entityType } = request.params as { entityType: string };
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    try {
      const entityConfig = getEntityConfig(entityType);
      
      if (!entityConfig) {
        return reply.status(404).send({ 
          error: `Entity schema '${entityType}' not found` 
        });
      }

      // Get fields that should be included in create form
      const createFields = Object.keys(entityConfig.fields).filter(fieldName => {
        const field = entityConfig.fields[fieldName];
        return !field.generated && !field.hidden;
      });

      // Get field configurations for create form fields
      const fieldConfigs: Record<string, any> = {};
      createFields.forEach(fieldName => {
        fieldConfigs[fieldName] = entityConfig.fields[fieldName];
      });

      return {
        entityType,
        displayName: entityConfig.displayName,
        sections: entityConfig.createForm?.sections,
        fields: createFields,
        fieldConfigs
      };
    } catch (error) {
      fastify.log.error(`Error fetching create form schema for ${entityType}:`, error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get list view configuration for entity
  fastify.get('/api/v1/schema/:entityType/list-view', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        entityType: Type.String()
      }),
      response: {
        200: Type.Object({
          entityType: Type.String(),
          displayName: Type.String(),
          displayNamePlural: Type.Optional(Type.String()),
          defaultSort: Type.Optional(Type.String()),
          defaultSortOrder: Type.Optional(Type.String()),
          searchFields: Type.Optional(Type.Array(Type.String())),
          filterFields: Type.Optional(Type.Array(Type.String())),
          displayFields: Type.Array(Type.String()),
          itemsPerPage: Type.Optional(Type.Number()),
          fieldConfigs: Type.Record(Type.String(), FieldConfigSchema)
        }),
        401: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    const { entityType } = request.params as { entityType: string };
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    try {
      const entityConfig = getEntityConfig(entityType);
      
      if (!entityConfig) {
        return reply.status(404).send({ 
          error: `Entity schema '${entityType}' not found` 
        });
      }

      const listView = entityConfig.listView || {};
      const displayFields = listView.displayFields || Object.keys(entityConfig.fields).slice(0, 5);

      // Get field configurations for display fields
      const fieldConfigs: Record<string, any> = {};
      displayFields.forEach(fieldName => {
        if (entityConfig.fields[fieldName]) {
          fieldConfigs[fieldName] = entityConfig.fields[fieldName];
        }
      });

      return {
        entityType,
        displayName: entityConfig.displayName,
        displayNamePlural: entityConfig.displayNamePlural,
        defaultSort: listView.defaultSort,
        defaultSortOrder: listView.defaultSortOrder,
        searchFields: listView.searchFields,
        filterFields: listView.filterFields,
        displayFields,
        itemsPerPage: listView.itemsPerPage,
        fieldConfigs
      };
    } catch (error) {
      fastify.log.error(`Error fetching list view schema for ${entityType}:`, error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get validation rules for entity
  fastify.get('/api/v1/schema/:entityType/validation', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        entityType: Type.String()
      }),
      response: {
        200: Type.Object({
          entityType: Type.String(),
          validationRules: Type.Record(Type.String(), Type.Any())
        }),
        401: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    const { entityType } = request.params as { entityType: string };
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    try {
      const entityConfig = getEntityConfig(entityType);
      
      if (!entityConfig) {
        return reply.status(404).send({ 
          error: `Entity schema '${entityType}' not found` 
        });
      }

      const validationRules: Record<string, any> = {};
      
      Object.entries(entityConfig.fields).forEach(([fieldName, fieldConfig]) => {
        const rules: any = {};
        
        if (fieldConfig.required) {
          rules.required = true;
        }
        
        if (fieldConfig.validation) {
          Object.assign(rules, fieldConfig.validation);
        }
        
        if (Object.keys(rules).length > 0) {
          validationRules[fieldConfig.apiField] = rules;
        }
      });

      return {
        entityType,
        validationRules
      };
    } catch (error) {
      fastify.log.error(`Error fetching validation rules for ${entityType}:`, error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}