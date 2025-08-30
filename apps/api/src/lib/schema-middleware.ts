/**
 * Schema-Driven API Middleware
 * 
 * This middleware system automatically applies schema-driven behaviors to API endpoints:
 * - Column filtering and masking based on permissions
 * - Search query optimization using schema metadata  
 * - Response transformation and validation
 * - Audit logging for restricted fields
 * - Rate limiting based on operation type
 * 
 * Usage:
 *   fastify.register(schemaMiddleware, { tables: ['app.d_employee', 'app.ops_project_head'] })
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { 
  filterObjectColumns,
  getSearchableColumns,
  getPIIMaskingColumns,
  getRestrictedColumns,
  SCHEMA_METADATA
} from './schema-metadata.js';
import { checkScopeAccess, Permission } from '../modules/rbac/scope-auth.js';

export interface SchemaMiddlewareOptions {
  tables: string[];
  enableAuditLogging?: boolean;
  enableRateLimiting?: boolean;
  defaultPermissions?: {
    canSeePII: boolean;
    canSeeFinancial: boolean;
  };
}

/**
 * Request context enhancement with schema information
 */
declare module 'fastify' {
  interface FastifyRequest {
    schemaContext?: {
      tableName: string;
      userPermissions: {
        canSeePII: boolean;
        canSeeFinancial: boolean;
        canEdit: boolean;
        canCreate: boolean;
        canDelete: boolean;
      };
      searchableColumns: string[];
      restrictedColumns: string[];
      piiColumns: string[];
    };
  }
}

/**
 * Extract table name from request path
 */
function getTableNameFromPath(path: string): string | null {
  const pathParts = path.split('/');
  const apiIndex = pathParts.indexOf('api');
  
  if (apiIndex === -1 || pathParts.length < apiIndex + 3) {
    return null;
  }
  
  const resource = pathParts[apiIndex + 2];
  
  // Map resource names to table names
  const resourceToTable: Record<string, string> = {
    'emp': 'app.d_employee',
    'employee': 'app.d_employee',
    'project': 'app.ops_project_head',
    'task': 'app.ops_task_head',
    'scope/location': 'app.d_scope_location',
    'scope/business': 'app.d_scope_business',
    'scope/hr': 'app.d_scope_hr',
    'scope/worksite': 'app.d_scope_worksite',
    'meta': 'app.meta_*', // Special case for meta tables
  };
  
  return resourceToTable[resource] || null;
}

/**
 * Determine user permissions based on RBAC scope access
 */
async function getUserPermissions(
  userId: string, 
  tableName: string, 
  resourceId?: string
): Promise<{
  canSeePII: boolean;
  canSeeFinancial: boolean;
  canEdit: boolean;
  canCreate: boolean;
  canDelete: boolean;
}> {
  // Determine scope type from table name
  const scopeType = tableName.includes('employee') ? 'emp' :
                   tableName.includes('project') ? 'project' :
                   tableName.includes('task') ? 'task' :
                   tableName.includes('location') ? 'location' :
                   tableName.includes('business') ? 'business' :
                   tableName.includes('hr') ? 'hr' :
                   tableName.includes('worksite') ? 'worksite' :
                   'meta';
  
  try {
    const [viewAccess, createAccess, modifyAccess, deleteAccess, shareAccess] = await Promise.all([
      checkScopeAccess(userId, scopeType, 'view', resourceId),
      checkScopeAccess(userId, scopeType, 'create', resourceId),
      checkScopeAccess(userId, scopeType, 'modify', resourceId),
      checkScopeAccess(userId, scopeType, 'delete', resourceId),
      checkScopeAccess(userId, scopeType, 'share', resourceId), // Share permission indicates PII access
    ]);
    
    return {
      canSeePII: shareAccess.allowed,
      canSeeFinancial: deleteAccess.allowed, // Using delete as high-privilege indicator for financial data
      canEdit: modifyAccess.allowed,
      canCreate: createAccess.allowed,
      canDelete: deleteAccess.allowed,
    };
  } catch (error) {
    // Default to minimal permissions on error
    return {
      canSeePII: false,
      canSeeFinancial: false,
      canEdit: false,
      canCreate: false,
      canDelete: false,
    };
  }
}

/**
 * Pre-handler to set up schema context
 */
async function schemaPreHandler(
  request: FastifyRequest,
  reply: FastifyReply,
  options: SchemaMiddlewareOptions
) {
  const tableName = getTableNameFromPath(request.url);
  
  if (!tableName || !options.tables.some(t => t === tableName || tableName.startsWith(t))) {
    return; // Skip non-schema routes
  }
  
  const userId = (request as any).user?.sub;
  const resourceId = (request.params as any)?.id;
  
  if (userId) {
    const userPermissions = await getUserPermissions(userId, tableName, resourceId);
    const searchableColumns = getSearchableColumns(tableName, []);
    const restrictedColumns = getRestrictedColumns(tableName, []);
    const piiColumns = getPIIMaskingColumns(tableName, []);
    
    request.schemaContext = {
      tableName,
      userPermissions,
      searchableColumns,
      restrictedColumns,
      piiColumns,
    };
  } else {
    // Unauthenticated request - minimal permissions
    request.schemaContext = {
      tableName,
      userPermissions: options.defaultPermissions || {
        canSeePII: false,
        canSeeFinancial: false,
        canEdit: false,
        canCreate: false,
        canDelete: false,
      },
      searchableColumns: [],
      restrictedColumns: getRestrictedColumns(tableName, []),
      piiColumns: getPIIMaskingColumns(tableName, []),
    };
  }
}

/**
 * Response handler to filter data based on schema permissions
 */
async function schemaResponseHandler(
  request: FastifyRequest,
  reply: FastifyReply,
  payload: any
) {
  if (!request.schemaContext) {
    return payload; // No schema context, return as-is
  }
  
  const { tableName, userPermissions } = request.schemaContext;
  
  try {
    // Handle different response types
    if (payload && typeof payload === 'object') {
      if (Array.isArray(payload)) {
        // Array of objects - filter each item
        return payload.map(item => filterObjectColumns(tableName, item, userPermissions));
      } else if (payload.data && Array.isArray(payload.data)) {
        // Paginated response with data array
        return {
          ...payload,
          data: payload.data.map((item: any) => filterObjectColumns(tableName, item, userPermissions)),
        };
      } else if (payload.id || payload.name) {
        // Single object response
        return filterObjectColumns(tableName, payload, userPermissions);
      }
    }
    
    return payload;
  } catch (error) {
    request.log.error('Schema response filtering failed:', error);
    return payload; // Return original on error to avoid breaking the response
  }
}

/**
 * Audit logger for sensitive operations
 */
async function logSensitiveOperation(
  request: FastifyRequest,
  operation: string,
  resourceId?: string,
  data?: any
) {
  if (!request.schemaContext) return;
  
  const { tableName, userPermissions, piiColumns, restrictedColumns } = request.schemaContext;
  const userId = (request as any).user?.sub;
  
  // Check if operation involves sensitive data
  const involvesPII = data && piiColumns.some(col => data[col] !== undefined);
  const involvesRestricted = data && restrictedColumns.some(col => data[col] !== undefined);
  
  if (involvesPII || involvesRestricted || operation === 'delete') {
    const auditLog = {
      timestamp: new Date().toISOString(),
      userId,
      operation,
      tableName,
      resourceId,
      userPermissions,
      involvesPII,
      involvesRestricted,
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
      path: request.url,
      method: request.method,
    };
    
    // In a real implementation, this would write to an audit log table
    request.log.info('Sensitive operation audit:', auditLog);
  }
}

/**
 * Rate limiting based on operation sensitivity
 */
function getRateLimitKey(request: FastifyRequest): string {
  const userId = (request as any).user?.sub || request.ip;
  const context = request.schemaContext;
  
  if (!context) {
    return `general:${userId}`;
  }
  
  // Higher rate limits for sensitive operations
  const { userPermissions } = context;
  const isSensitiveUser = userPermissions.canSeePII || userPermissions.canSeeFinancial;
  const isWriteOperation = ['POST', 'PUT', 'DELETE'].includes(request.method);
  
  if (isSensitiveUser && isWriteOperation) {
    return `sensitive-write:${userId}`;
  } else if (isSensitiveUser) {
    return `sensitive-read:${userId}`;
  } else if (isWriteOperation) {
    return `write:${userId}`;
  } else {
    return `read:${userId}`;
  }
}

/**
 * Enhanced search query builder using schema metadata
 */
function buildSchemaSearch(
  request: FastifyRequest,
  searchTerm: string
): string | null {
  if (!request.schemaContext || !searchTerm) {
    return null;
  }
  
  const { searchableColumns } = request.schemaContext;
  
  if (searchableColumns.length === 0) {
    return null;
  }
  
  // Build SQL search conditions
  const conditions = searchableColumns.map(column => 
    `${column} ILIKE '%${searchTerm.replace(/'/g, "''")}%'`
  );
  
  return `(${conditions.join(' OR ')})`;
}

/**
 * Main plugin registration
 */
async function schemaMiddlewarePlugin(
  fastify: FastifyInstance,
  options: SchemaMiddlewareOptions
) {
  // Register pre-handler to set up schema context
  fastify.addHook('preHandler', async (request, reply) => {
    await schemaPreHandler(request, reply, options);
  });
  
  // Register response transformer
  fastify.addHook('preSerialization', async (request, reply, payload) => {
    return await schemaResponseHandler(request, reply, payload);
  });
  
  // Register audit logging for sensitive operations
  if (options.enableAuditLogging !== false) {
    fastify.addHook('onSend', async (request, reply, payload) => {
      const method = request.method;
      const resourceId = (request.params as any)?.id;
      let operation = 'unknown';
      
      if (method === 'GET' && resourceId) operation = 'read';
      else if (method === 'GET') operation = 'list';
      else if (method === 'POST') operation = 'create';
      else if (method === 'PUT' || method === 'PATCH') operation = 'update';
      else if (method === 'DELETE') operation = 'delete';
      
      await logSensitiveOperation(request, operation, resourceId, request.body);
    });
  }
  
  // Add helper methods to fastify instance
  fastify.decorate('getSchemaMetadata', (tableName: string) => {
    return SCHEMA_METADATA[tableName];
  });
  
  fastify.decorate('buildSchemaSearch', (request: FastifyRequest, searchTerm: string) => {
    return buildSchemaSearch(request, searchTerm);
  });
  
  fastify.decorate('filterSchemaResponse', (
    tableName: string, 
    data: any, 
    permissions: any
  ) => {
    if (Array.isArray(data)) {
      return data.map(item => filterObjectColumns(tableName, item, permissions));
    } else {
      return filterObjectColumns(tableName, data, permissions);
    }
  });
}

// Export as fastify plugin
export default fp(schemaMiddlewarePlugin, {
  name: 'schema-middleware',
  fastify: '>= 4.0.0'
});

// Export utility functions
export {
  getUserPermissions,
  buildSchemaSearch,
  logSensitiveOperation,
  getRateLimitKey
};