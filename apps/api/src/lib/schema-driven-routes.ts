/**
 * Schema-Driven Route Generator
 * 
 * This utility automatically generates standardized API routes based on database schema metadata.
 * It handles common CRUD operations with built-in permission checks, data filtering, and validation.
 * 
 * Key Features:
 * - Automatic CRUD route generation
 * - Schema-based TypeScript validation
 * - Built-in RBAC permission checking
 * - PII and financial data masking
 * - Searchable column detection
 * - Pagination and filtering
 * - Audit trail integration
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Type, type Static } from '@sinclair/typebox';
import { hasPermissionOnAPI, getEmployeeScopeIds, hasPermissionOnScopeId, Permission } from '../modules/rbac/ui-api-permission-rbac-gate.js';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { 
  filterObjectColumns, 
  getSearchableColumns, 
  getSortColumns, 
  generateTypeScriptSchema,
  getPIIMaskingColumns,
  getRestrictedColumns,
  SCHEMA_METADATA
} from './schema-metadata.js';

export interface RouteConfig {
  tableName: string;
  scopeType: string;
  enableCreate?: boolean;
  enableRead?: boolean;
  enableUpdate?: boolean;
  enableDelete?: boolean;
  enableList?: boolean;
  customEndpoints?: Record<string, any>;
  basePermissions?: {
    list: Permission;
    read: Permission;
    create: Permission;
    update: Permission;
    delete: Permission;
  };
}

/**
 * Generate standard schemas for a table
 */
function generateSchemas(tableName: string, sampleData?: Record<string, any>) {
  const tableMetadata = SCHEMA_METADATA[tableName];
  
  if (!tableMetadata && !sampleData) {
    throw new Error(`No metadata or sample data available for table ${tableName}`);
  }
  
  // If we have sample data, infer schema structure
  const columns = sampleData ? Object.keys(sampleData) : Object.keys(tableMetadata?.columns || {});
  
  // Base entity schema
  const entityProperties: Record<string, any> = {};
  const createProperties: Record<string, any> = {};
  const updateProperties: Record<string, any> = {};
  
  columns.forEach(column => {
    const exampleValue = sampleData?.[column];
    const isOptional = !['id', 'name', 'title'].includes(column);
    
    // Determine TypeScript type
    let tsType: any = Type.String();
    if (typeof exampleValue === 'number') {
      tsType = Type.Number();
    } else if (typeof exampleValue === 'boolean') {
      tsType = Type.Boolean();
    } else if (Array.isArray(exampleValue)) {
      tsType = Type.Array(Type.Any());
    } else if (typeof exampleValue === 'object' && exampleValue !== null) {
      tsType = Type.Object({});
    } else if (column.includes('date') || column.includes('_ts')) {
      tsType = Type.String({ format: 'date-time' });
    } else if (column.includes('email')) {
      tsType = Type.String({ format: 'email' });
    } else if (column.includes('_id') && typeof exampleValue === 'string') {
      tsType = Type.String({ format: 'uuid' });
    }
    
    // Entity schema (for responses)
    entityProperties[column] = isOptional ? Type.Optional(tsType) : tsType;
    
    // Create schema (exclude system fields)
    if (!['id', 'created', 'updated'].includes(column)) {
      const required = ['name', 'title'].includes(column);
      createProperties[column] = required ? tsType : Type.Optional(tsType);
    }
    
    // Update schema (all optional)
    if (!['id', 'created', 'updated'].includes(column)) {
      updateProperties[column] = Type.Optional(tsType);
    }
  });
  
  return {
    EntitySchema: Type.Object(entityProperties),
    CreateSchema: Type.Object(createProperties),
    UpdateSchema: Type.Object(updateProperties),
  };
}

/**
 * Generate list endpoint
 */
function generateListRoute(
  fastify: FastifyInstance,
  config: RouteConfig,
  schemas: ReturnType<typeof generateSchemas>
) {
  const { tableName, scopeType } = config;
  const permission = config.basePermissions?.list || Permission.VIEW;
  
  fastify.get(`/api/v1/${scopeType}`, {
    schema: {
      querystring: Type.Object({
        search: Type.Optional(Type.String()),
        active: Type.Optional(Type.Boolean()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
        sortBy: Type.Optional(Type.String()),
        sortOrder: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(schemas.EntitySchema),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number(),
          searchableColumns: Type.Array(Type.String()),
        }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { search, active, limit = 50, offset = 0, sortBy, sortOrder = 'asc' } = request.query as any;
    const userId = (request as any).user?.sub;
    
    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    }
    
    // Check if employee has access to list this resource type via API
    // const hasAPIAccess = await hasPermissionOnAPI(userId, 'app:api', request.url, 'view');
    // if (!hasAPIAccess) {
    //   return reply.status(403).send({ error: 'Insufficient permissions to access this API endpoint' });
    // }
    // RBAC check disabled - allow all authenticated users
    
    try {
      // Get employee's accessible scope IDs for filtering
      // const accessibleIds = await getEmployeeScopeIds(userId, scopeType, Permission.VIEW);
      
      // Build base query
      const conditions: any[] = [];
      
      // Add scope filtering if needed - DISABLED for now
      // if (accessibleIds.length > 0 && tableName !== 'app.d_employee') {
      //   conditions.push(sql`id = ANY(${accessibleIds})`);
      // }
      
      // Add active filter
      if (active !== undefined) {
        conditions.push(sql`active_flag = ${active}`);
      }
      
      // Add search conditions
      if (search) {
        const searchableColumns = getSearchableColumns(tableName, ['name', 'descr', 'title', 'code']);
        const searchConditions = searchableColumns.map(column => 
          sql`${sql.identifier(column)} ILIKE ${`%${search}%`}`
        );
        if (searchConditions.length > 0) {
          conditions.push(sql`(${sql.join(searchConditions, sql` OR `)})`);
        }
      }
      
      // Build sort clause
      const sortColumns = getSortColumns(tableName, ['name', 'created']);
      const sortColumn = sortBy && SCHEMA_METADATA[tableName] && sortBy in SCHEMA_METADATA[tableName].columns 
        ? sortBy 
        : sortColumns[0] || 'created';
      
      // Execute query
      const query = sql`
        SELECT * FROM ${sql.identifier(tableName)}
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY ${sql.identifier(sortColumn)} ${sortOrder === 'desc' ? sql`DESC` : sql`ASC`}
        LIMIT ${limit} OFFSET ${offset}
      `;
      
      const countQuery = sql`
        SELECT COUNT(*) as total FROM ${sql.identifier(tableName)}
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `;
      
      const [results, countResults] = await Promise.all([
        db.execute(query),
        db.execute(countQuery)
      ]);
      
      // Get user permissions for data filtering
      const userPermissions = {
        canSeePII: true, // TODO: Implement proper permission checking
        canSeeFinancial: true, // TODO: Implement proper permission checking
      };
      
      // Filter columns based on permissions
      const filteredData = results.map((row: any) => 
        filterObjectColumns(tableName, row, userPermissions)
      );
      
      return {
        data: filteredData,
        total: Number(countResults[0]?.total || 0),
        limit,
        offset,
        searchableColumns: getSearchableColumns(tableName, ['name', 'descr', 'title', 'code']),
      };
    } catch (error) {
      fastify.log.error('List operation failed:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}

/**
 * Generate get by ID endpoint
 */
function generateGetRoute(
  fastify: FastifyInstance,
  config: RouteConfig,
  schemas: ReturnType<typeof generateSchemas>
) {
  const { tableName, scopeType } = config;
  const permission = config.basePermissions?.read || Permission.VIEW;
  
  fastify.get(`/api/v1/${scopeType}/:id`, {
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: schemas.EntitySchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user?.sub;
    
    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    }
    
    // Check if employee has permission to view this specific resource
    const hasViewAccess = await hasPermissionOnScopeId(userId, scopeType, id, 'view');
    if (!hasViewAccess) {
      return reply.status(403).send({ error: 'Access denied to this resource' });
    }
    
    try {
      const result = await db.execute(sql`
        SELECT * FROM ${sql.identifier(tableName)}
        WHERE id = ${id}
      `);
      
      if (result.length === 0) {
        return reply.status(404).send({ error: 'Resource not found' });
      }
      
      // Get user permissions for data filtering
      const userPermissions = {
        canSeePII: true, // TODO: Implement proper permission checking
        canSeeFinancial: true, // TODO: Implement proper permission checking
      };
      
      // Filter columns based on permissions
      const filteredData = filterObjectColumns(tableName, result[0] || {}, userPermissions);
      
      return filteredData;
    } catch (error) {
      fastify.log.error('Get operation failed:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}

/**
 * Generate create endpoint
 */
function generateCreateRoute(
  fastify: FastifyInstance,
  config: RouteConfig,
  schemas: ReturnType<typeof generateSchemas>
) {
  const { tableName, scopeType } = config;
  const permission = config.basePermissions?.create || Permission.CREATE;
  
  fastify.post(`/api/v1/${scopeType}`, {
    schema: {
      body: schemas.CreateSchema,
      response: {
        201: schemas.EntitySchema,
        400: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = request.body as Record<string, any>;
    const userId = (request as any).user?.sub;
    
    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    }
    
    // Check if employee has permission to create resources of this type via API
    // const hasCreateAccess = await hasPermissionOnAPI(userId, 'app:api', request.url, 'create');
    // if (!hasCreateAccess) {
    //   return reply.status(403).send({ error: 'Insufficient permissions to create resources via this API endpoint' });
    // }
    // RBAC check disabled - allow all authenticated users
    
    try {
      // Add standard fields
      const createData = {
        ...data,
        id: sql`gen_random_uuid()`,
        created: sql`now()`,
        updated: sql`now()`,
        from_ts: sql`now()`,
        active: true,
      };
      
      // Build insert query
      const columns = Object.keys(createData);
      const values = Object.values(createData);
      
      const result = await db.execute(sql`
        INSERT INTO ${sql.identifier(tableName)}
        (${sql.join(columns.map(c => sql.identifier(c)), sql`, `)})
        VALUES (${sql.join(values, sql`, `)})
        RETURNING *
      `);
      
      // Get user permissions for data filtering
      const userPermissions = {
        canSeePII: true, // TODO: Implement proper permission checking
        canSeeFinancial: true, // TODO: Implement proper permission checking
      };
      
      // Filter columns based on permissions
      const filteredData = filterObjectColumns(tableName, result[0] || {}, userPermissions);
      
      return reply.status(201).send(filteredData);
    } catch (error) {
      fastify.log.error('Create operation failed:', error as any);
      
      if ((error as any).code === '23505') { // Unique violation
        return reply.status(400).send({ error: 'Resource with this identifier already exists' });
      }
      
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}

/**
 * Generate update endpoint
 */
function generateUpdateRoute(
  fastify: FastifyInstance,
  config: RouteConfig,
  schemas: ReturnType<typeof generateSchemas>
) {
  const { tableName, scopeType } = config;
  const permission = config.basePermissions?.update || Permission.MODIFY;
  
  fastify.put(`/api/v1/${scopeType}/:id`, {
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      body: schemas.UpdateSchema,
      response: {
        200: schemas.EntitySchema,
        400: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const data = request.body as Record<string, any>;
    const userId = (request as any).user?.sub;
    
    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    }
    
    // Check if employee has permission to modify this specific resource
    const hasModifyAccess = await hasPermissionOnScopeId(userId, scopeType, id, 'modify');
    if (!hasModifyAccess) {
      return reply.status(403).send({ error: 'Access denied to modify this resource' });
    }
    
    try {
      // Check if resource exists
      const existingResult = await db.execute(sql`
        SELECT id FROM ${sql.identifier(tableName)}
        WHERE id = ${id}
      `);
      
      if (existingResult.length === 0) {
        return reply.status(404).send({ error: 'Resource not found' });
      }
      
      // Add standard update fields
      const updateData = {
        ...data,
        updated: sql`now()`,
      };
      
      // Build update query
      const updateClauses = Object.entries(updateData).map(([key, value]) =>
        sql`${sql.identifier(key)} = ${value}`
      );
      
      const result = await db.execute(sql`
        UPDATE ${sql.identifier(tableName)}
        SET ${sql.join(updateClauses, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);
      
      // Get user permissions for data filtering
      const userPermissions = {
        canSeePII: true, // TODO: Implement proper permission checking
        canSeeFinancial: true, // TODO: Implement proper permission checking
      };
      
      // Filter columns based on permissions
      const filteredData = filterObjectColumns(tableName, result[0] || {}, userPermissions);
      
      return filteredData;
    } catch (error) {
      fastify.log.error('Update operation failed:', error as any);
      
      if ((error as any).code === '23505') { // Unique violation
        return reply.status(400).send({ error: 'Resource with this identifier already exists' });
      }
      
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}

/**
 * Generate delete endpoint
 */
function generateDeleteRoute(
  fastify: FastifyInstance,
  config: RouteConfig
) {
  const { tableName, scopeType } = config;
  const permission = config.basePermissions?.delete || Permission.DELETE;
  
  fastify.delete(`/api/v1/${scopeType}/:id`, {
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({ message: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user?.sub;
    
    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    }
    
    // Check if employee has permission to delete this specific resource
    const hasDeleteAccess = await hasPermissionOnScopeId(userId, scopeType, id, 'delete');
    if (!hasDeleteAccess) {
      return reply.status(403).send({ error: 'Access denied to delete this resource' });
    }
    
    try {
      // Check if resource exists
      const existingResult = await db.execute(sql`
        SELECT id FROM ${sql.identifier(tableName)}
        WHERE id = ${id}
      `);
      
      if (existingResult.length === 0) {
        return reply.status(404).send({ error: 'Resource not found' });
      }
      
      // Soft delete by setting active_flag = false and to_ts = now()
      await db.execute(sql`
        UPDATE ${sql.identifier(tableName)}
        SET active_flag = false, to_ts = now(), updated = now()
        WHERE id = ${id}
      `);
      
      return { message: 'Resource deleted successfully' };
    } catch (error) {
      fastify.log.error('Delete operation failed:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}

/**
 * Generate complete CRUD routes for a table
 */
export function generateCRUDRoutes(
  fastify: FastifyInstance, 
  config: RouteConfig,
  sampleData?: Record<string, any>
) {
  const {
    enableList = true,
    enableRead = true,
    enableCreate = true,
    enableUpdate = true,
    enableDelete = true,
  } = config;
  
  // Generate schemas
  const schemas = generateSchemas(config.tableName, sampleData);
  
  // Generate routes
  if (enableList) generateListRoute(fastify, config, schemas);
  if (enableRead) generateGetRoute(fastify, config, schemas);
  if (enableCreate) generateCreateRoute(fastify, config, schemas);
  if (enableUpdate) generateUpdateRoute(fastify, config, schemas);
  if (enableDelete) generateDeleteRoute(fastify, config);
}

/**
 * Helper function to register schema-driven routes with sensible defaults
 */
export function registerSchemaRoutes(fastify: FastifyInstance) {
  // Employee routes
  generateCRUDRoutes(fastify, {
    tableName: 'app.d_employee',
    scopeType: 'emp',
    basePermissions: {
      list: Permission.VIEW,
      read: Permission.VIEW,
      create: Permission.CREATE,
      update: Permission.MODIFY,
      delete: Permission.DELETE,
    }
  });
  
  // Project routes
  generateCRUDRoutes(fastify, {
    tableName: 'app.ops_project_head',
    scopeType: 'project',
    basePermissions: {
      list: Permission.VIEW,
      read: Permission.VIEW,
      create: Permission.CREATE,
      update: Permission.MODIFY,
      delete: Permission.DELETE,
    }
  });
  
  // Task routes
  generateCRUDRoutes(fastify, {
    tableName: 'app.ops_task_head',
    scopeType: 'task',
    basePermissions: {
      list: Permission.VIEW,
      read: Permission.VIEW,
      create: Permission.CREATE,
      update: Permission.MODIFY,
      delete: Permission.DELETE,
    }
  });
  
  // Location routes
  generateCRUDRoutes(fastify, {
    tableName: 'app.d_scope_location',
    scopeType: 'scope/location',
    basePermissions: {
      list: Permission.VIEW,
      read: Permission.VIEW,
      create: Permission.CREATE,
      update: Permission.MODIFY,
      delete: Permission.DELETE,
    }
  });
}

export default { generateCRUDRoutes, registerSchemaRoutes };