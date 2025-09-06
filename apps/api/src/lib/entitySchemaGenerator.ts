import type { TSchema } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';
import { ENTITY_CONFIG, type FieldConfig } from './entityConfig.js';

/**
 * Entity Schema Generator
 * 
 * Generates TypeBox schemas dynamically from EntityConfig
 * Provides type-safe API validation and documentation
 */
export class EntitySchemaGenerator {
  constructor(private entityName: string) {
    if (!ENTITY_CONFIG[entityName]) {
      throw new Error(`Entity config not found for: ${entityName}`);
    }
  }

  private get config() {
    return ENTITY_CONFIG[this.entityName];
  }

  // ==========================================================================
  // Schema Generation Methods
  // ==========================================================================

  /**
   * Generate TypeBox schema for API responses (includes all fields)
   */
  generateResponseSchema(): TSchema {
    const properties: Record<string, TSchema> = {};
    
    Object.entries(this.config.fields).forEach(([fieldName, fieldConfig]) => {
      if (!fieldConfig.hidden) {
        properties[fieldConfig.apiField] = this.generateFieldSchema(fieldConfig, false);
      }
    });
    
    return Type.Object(properties);
  }

  /**
   * Generate TypeBox schema for create requests (excludes generated fields)
   */
  generateCreateSchema(): TSchema {
    const properties: Record<string, TSchema> = {};
    
    Object.entries(this.config.fields).forEach(([fieldName, fieldConfig]) => {
      if (!fieldConfig.generated && !fieldConfig.hidden) {
        properties[fieldConfig.apiField] = this.generateFieldSchema(fieldConfig, !fieldConfig.required);
      }
    });
    
    return Type.Object(properties);
  }

  /**
   * Generate TypeBox schema for update requests (all fields optional except ID)
   */
  generateUpdateSchema(): TSchema {
    const properties: Record<string, TSchema> = {};
    
    Object.entries(this.config.fields).forEach(([fieldName, fieldConfig]) => {
      if (!fieldConfig.generated && !fieldConfig.hidden && fieldConfig.apiField !== 'id') {
        properties[fieldConfig.apiField] = this.generateFieldSchema(fieldConfig, true);
      }
    });
    
    return Type.Object(properties);
  }

  /**
   * Generate TypeBox schema for query parameters (list endpoints)
   */
  generateQuerySchema(): TSchema {
    const properties: Record<string, TSchema> = {
      // Standard query parameters
      limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
      offset: Type.Optional(Type.Number({ minimum: 0 })),
      search: Type.Optional(Type.String()),
    };

    // Add sortable fields
    const sortableFields = Object.entries(this.config.fields)
      .filter(([_, fieldConfig]) => fieldConfig.sortable)
      .map(([_, fieldConfig]) => fieldConfig.apiField);
    
    if (sortableFields.length > 0) {
      properties.sortBy = Type.Optional(Type.Union(
        sortableFields.map(field => Type.Literal(field))
      ));
      properties.sortOrder = Type.Optional(Type.Union([
        Type.Literal('asc'),
        Type.Literal('desc')
      ]));
    }

    // Add filterable fields as query parameters
    Object.entries(this.config.fields).forEach(([fieldName, fieldConfig]) => {
      if (fieldConfig.filterable && !fieldConfig.hidden && !fieldConfig.generated) {
        properties[fieldConfig.apiField] = Type.Optional(
          this.generateFieldSchema(fieldConfig, true)
        );
      }
    });
    
    return Type.Object(properties);
  }

  /**
   * Generate TypeBox schema for paginated list responses
   */
  generateListResponseSchema(): TSchema {
    return Type.Object({
      data: Type.Array(this.generateResponseSchema()),
      total: Type.Number(),
      limit: Type.Number(),
      offset: Type.Number(),
      hasMore: Type.Optional(Type.Boolean())
    });
  }

  /**
   * Generate TypeBox schema for error responses
   */
  generateErrorSchema(): TSchema {
    return Type.Object({
      error: Type.String(),
      message: Type.Optional(Type.String()),
      details: Type.Optional(Type.Any())
    });
  }

  // ==========================================================================
  // Field Schema Generation
  // ==========================================================================

  /**
   * Generate TypeBox schema for individual field
   */
  private generateFieldSchema(fieldConfig: FieldConfig, optional: boolean = false): TSchema {
    let schema = this.getBaseFieldSchema(fieldConfig);
    
    return optional ? Type.Optional(schema) : schema;
  }

  private getBaseFieldSchema(fieldConfig: FieldConfig): TSchema {
    const validation = fieldConfig.validation || {};
    
    switch (fieldConfig.type) {
      case 'uuid':
        return Type.String({ format: 'uuid' });
        
      case 'string':
        const stringOptions: any = {};
        if (validation.minLength) stringOptions.minLength = validation.minLength;
        if (validation.maxLength) stringOptions.maxLength = validation.maxLength;
        if (validation.pattern) {
          if (typeof validation.pattern === 'string') {
            stringOptions.pattern = validation.pattern;
          } else {
            // Convert RegExp to string pattern
            stringOptions.pattern = validation.pattern.source;
          }
        }
        return Type.String(stringOptions);
        
      case 'text':
        const textOptions: any = {};
        if (validation.minLength) textOptions.minLength = validation.minLength;
        if (validation.maxLength) textOptions.maxLength = validation.maxLength;
        return Type.String(textOptions);
        
      case 'email':
        return Type.String({ format: 'email' });
        
      case 'phone':
        return Type.String();
        
      case 'number':
        const numberOptions: any = {};
        if (validation.min !== undefined) numberOptions.minimum = validation.min;
        if (validation.max !== undefined) numberOptions.maximum = validation.max;
        return Type.Number(numberOptions);
        
      case 'currency':
        return Type.Number({ minimum: 0 });
        
      case 'percentage':
        return Type.Number({ minimum: 0, maximum: 100 });
        
      case 'boolean':
        return Type.Boolean();
        
      case 'date':
        return Type.String({ format: 'date' });
        
      case 'datetime':
        return Type.String({ format: 'date-time' });
        
      case 'array':
        if (fieldConfig.itemType) {
          const itemSchema = this.getItemTypeSchema(fieldConfig.itemType);
          return Type.Array(itemSchema);
        }
        return Type.Array(Type.Any());
        
      case 'json':
        return Type.Any(); // Could be more specific based on structure
        
      case 'geometry':
        return Type.Any(); // GeoJSON or similar structure
        
      default:
        return Type.Any();
    }
  }

  private getItemTypeSchema(itemType: string): TSchema {
    switch (itemType) {
      case 'string':
        return Type.String();
      case 'number':
        return Type.Number();
      case 'boolean':
        return Type.Boolean();
      case 'uuid':
        return Type.String({ format: 'uuid' });
      default:
        return Type.Any();
    }
  }

  // ==========================================================================
  // Validation Schema Generation
  // ==========================================================================

  /**
   * Generate validation rules for client-side validation
   */
  generateValidationRules(): Record<string, any> {
    const rules: Record<string, any> = {};
    
    Object.entries(this.config.fields).forEach(([fieldName, fieldConfig]) => {
      if (!fieldConfig.generated && !fieldConfig.hidden) {
        const fieldRules: any = {};
        
        if (fieldConfig.required) {
          fieldRules.required = true;
        }
        
        if (fieldConfig.validation) {
          Object.assign(fieldRules, fieldConfig.validation);
        }
        
        // Add type-specific validation
        switch (fieldConfig.type) {
          case 'email':
            fieldRules.email = true;
            break;
          case 'uuid':
            fieldRules.format = 'uuid';
            break;
          case 'date':
            fieldRules.format = 'date';
            break;
          case 'datetime':
            fieldRules.format = 'date-time';
            break;
        }
        
        if (Object.keys(fieldRules).length > 0) {
          rules[fieldConfig.apiField] = fieldRules;
        }
      }
    });
    
    return rules;
  }

  // ==========================================================================
  // Schema Combinations
  // ==========================================================================

  /**
   * Generate complete API schemas for all endpoints
   */
  generateCompleteApiSchemas() {
    return {
      // Request schemas
      create: this.generateCreateSchema(),
      update: this.generateUpdateSchema(),
      query: this.generateQuerySchema(),
      
      // Response schemas
      item: this.generateResponseSchema(),
      list: this.generateListResponseSchema(),
      error: this.generateErrorSchema(),
      
      // Parameter schemas
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
      
      // Validation rules
      validation: this.generateValidationRules()
    };
  }

  // ==========================================================================
  // OpenAPI/Swagger Documentation
  // ==========================================================================

  /**
   * Generate OpenAPI documentation for the entity
   */
  generateOpenAPISpec(): any {
    const schemas = this.generateCompleteApiSchemas();
    
    return {
      components: {
        schemas: {
          [`${this.entityName}Response`]: schemas.item,
          [`${this.entityName}ListResponse`]: schemas.list,
          [`${this.entityName}CreateRequest`]: schemas.create,
          [`${this.entityName}UpdateRequest`]: schemas.update,
          [`${this.entityName}QueryParams`]: schemas.query,
          'ErrorResponse': schemas.error
        }
      },
      paths: {
        [`${this.config.apiEndpoint}`]: {
          get: {
            summary: `List ${this.config.displayNamePlural || this.config.displayName}`,
            parameters: this.generateQueryParameters(),
            responses: {
              200: { 
                description: 'Success',
                schema: { $ref: `#/components/schemas/${this.entityName}ListResponse` }
              },
              400: { 
                description: 'Bad Request',
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              },
              401: { 
                description: 'Unauthorized',
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              },
              500: { 
                description: 'Internal Server Error',
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          },
          post: {
            summary: `Create ${this.config.displayName}`,
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: { $ref: `#/components/schemas/${this.entityName}CreateRequest` }
                }
              }
            },
            responses: {
              201: { 
                description: 'Created',
                schema: { $ref: `#/components/schemas/${this.entityName}Response` }
              },
              400: { 
                description: 'Bad Request',
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          }
        },
        [`${this.config.apiEndpoint}/{id}`]: {
          get: {
            summary: `Get ${this.config.displayName}`,
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string', format: 'uuid' }
              }
            ],
            responses: {
              200: { 
                description: 'Success',
                schema: { $ref: `#/components/schemas/${this.entityName}Response` }
              },
              404: { 
                description: 'Not Found',
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          },
          put: {
            summary: `Update ${this.config.displayName}`,
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string', format: 'uuid' }
              }
            ],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: { $ref: `#/components/schemas/${this.entityName}UpdateRequest` }
                }
              }
            },
            responses: {
              200: { 
                description: 'Updated',
                schema: { $ref: `#/components/schemas/${this.entityName}Response` }
              },
              404: { 
                description: 'Not Found',
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          },
          delete: {
            summary: `Delete ${this.config.displayName}`,
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string', format: 'uuid' }
              }
            ],
            responses: {
              204: { description: 'No Content' },
              404: { 
                description: 'Not Found',
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          }
        }
      }
    };
  }

  private generateQueryParameters(): any[] {
    const params: any[] = [
      { name: 'limit', in: 'query', schema: { type: 'number', minimum: 1, maximum: 100 } },
      { name: 'offset', in: 'query', schema: { type: 'number', minimum: 0 } },
      { name: 'search', in: 'query', schema: { type: 'string' } }
    ];

    // Add filterable fields as query parameters
    Object.entries(this.config.fields).forEach(([fieldName, fieldConfig]) => {
      if (fieldConfig.filterable && !fieldConfig.hidden && !fieldConfig.generated) {
        params.push({
          name: fieldConfig.apiField,
          in: 'query',
          schema: this.getOpenAPIFieldType(fieldConfig)
        });
      }
    });

    return params;
  }

  private getOpenAPIFieldType(fieldConfig: FieldConfig): any {
    switch (fieldConfig.type) {
      case 'string':
      case 'text':
      case 'email':
      case 'phone':
      case 'uuid':
        return { type: 'string' };
      case 'number':
      case 'currency':
      case 'percentage':
        return { type: 'number' };
      case 'boolean':
        return { type: 'boolean' };
      case 'date':
        return { type: 'string', format: 'date' };
      case 'datetime':
        return { type: 'string', format: 'date-time' };
      case 'array':
        return { type: 'array', items: { type: 'string' } };
      default:
        return { type: 'string' };
    }
  }
}

// ==========================================================================
// Convenience Functions
// ==========================================================================

/**
 * Generate TypeBox schema for entity (convenience function)
 */
export function generateEntitySchema(entityName: string, schemaType: 'create' | 'update' | 'response' | 'query' | 'list'): TSchema {
  const generator = new EntitySchemaGenerator(entityName);
  
  switch (schemaType) {
    case 'create':
      return generator.generateCreateSchema();
    case 'update':
      return generator.generateUpdateSchema();
    case 'response':
      return generator.generateResponseSchema();
    case 'query':
      return generator.generateQuerySchema();
    case 'list':
      return generator.generateListResponseSchema();
    default:
      throw new Error(`Unknown schema type: ${schemaType}`);
  }
}

/**
 * Generate all schemas for entity (convenience function)
 */
export function generateAllEntitySchemas(entityName: string) {
  const generator = new EntitySchemaGenerator(entityName);
  return generator.generateCompleteApiSchemas();
}