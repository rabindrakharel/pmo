/**
 * Meta Hierarchy API Routes
 * Provides entity hierarchy information and navigation structure for the UI
 */

import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { 
  getEmployeeEntityIds,
  hasPermissionOnEntityId,
  type EntityAction
} from '../rbac/ui-api-permission-rbac-gate.js';

// Entity type schema
const EntityTypeSchema = Type.Object({
  id: Type.String(),
  entity_type: Type.String(),
  entity_type_code: Type.String(),
  entity_category: Type.String(),
  display_name: Type.String(),
  is_root_capable: Type.Boolean(),
  supports_hierarchy: Type.Boolean(),
  requires_parent: Type.Boolean(),
  sort_order: Type.Number(),
  icon_name: Type.Optional(Type.String()),
});

// Hierarchy relationship schema
const HierarchyRelationshipSchema = Type.Object({
  parent_entity: Type.String(),
  action_entity: Type.String(),
  permission_actions: Type.Array(Type.String()),
  hierarchy_level: Type.Optional(Type.Number()),
});

// Navigation structure schema
const NavigationStructureSchema = Type.Object({
  sidebar_entities: Type.Array(EntityTypeSchema),
  entity_hierarchy: Type.Array(HierarchyRelationshipSchema),
  user_permissions: Type.Record(Type.String(), Type.Array(Type.String())),
});

// Action entity summary for headerTabNavigation
const ActionEntitySummarySchema = Type.Object({
  entity_type_code: Type.String(),
  display_name: Type.String(),
  permission_actions: Type.Array(Type.String()),
  total_accessible: Type.Number(),
});

export async function hierarchyRoutes(fastify: FastifyInstance) {
  
  // Get action entity summaries for parent context (for HeaderTabNavigation)
  fastify.get('/api/v1/:parentEntity/:parentId/action-summaries', {
    
    schema: {
      tags: ['meta', 'hierarchy'],
      summary: 'Get action entity summaries for parent context',
      description: 'Returns available action entities within parent scope for HeaderTabNavigation with counts',
      params: Type.Object({
        parentEntity: Type.String(),
        parentId: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          parent_info: Type.Object({
            entity_type: Type.String(),
            entity_id: Type.String(),
            entity_name: Type.String(),
            can_create: Type.Array(Type.String()),
          }),
          action_entities: Type.Array(ActionEntitySummarySchema),
        }),
        401: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const employeeId = (request as any).user?.sub;
      const { parentEntity, parentId } = request.params as { 
        parentEntity: string; 
        parentId: string; 
      };

      if (!employeeId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Check user has access to parent entity
      const hasParentAccess = await hasPermissionOnEntityId(employeeId, parentEntity, parentId, 'view');
      if (!hasParentAccess) {
        return reply.status(404).send({ error: 'Parent entity not found or access denied' });
      }

      // Get parent entity info
      const parentTableMap: Record<string, string> = {
        'biz': 'app.d_biz',
        'project': 'app.d_project',
        'hr': 'app.d_hr',
        'org': 'app.d_org',
        'client': 'app.d_client',
        'worksite': 'app.d_worksite',
      };

      const parentTable = parentTableMap[parentEntity];
      if (!parentTable) {
        return reply.status(400).send({ error: 'Invalid parent entity type' });
      }

      const parentInfo = await db.execute(sql`
        SELECT name FROM ${sql.raw(parentTable)} WHERE id = ${parentId} AND active = true
      `);

      if (!parentInfo.length) {
        return reply.status(404).send({ error: 'Parent entity not found' });
      }

      // Get available action entities for this parent with permission check
      const actionEntitiesQuery = await db.execute(sql`
        SELECT DISTINCT
          pm.action_entity as entity_type_code,
          et.display_name,
          array_agg(DISTINCT pm.permission_action ORDER BY pm.permission_action) as permission_actions
        FROM app.meta_entity_hierarchy_permission_mapping pm
        JOIN app.meta_entity_types et ON et.entity_type_code = pm.action_entity
        WHERE pm.parent_entity = ${parentEntity}
          AND pm.active = true
          AND et.active = true
        GROUP BY pm.action_entity, et.display_name, et.sort_order
        ORDER BY et.sort_order, et.display_name
      `);

      // Get counts for each action entity that user can access
      const actionSummaries = [];
      for (const actionEntity of actionEntitiesQuery) {
        const entityTypeCode = String(actionEntity.entity_type_code);
        const displayName = String(actionEntity.display_name);
        const permissionActions = Array.isArray(actionEntity.permission_actions) 
          ? actionEntity.permission_actions.map(String) 
          : [];
        
        // Get accessible entity IDs for this action entity type
        const accessibleIds = await getEmployeeEntityIds(employeeId, entityTypeCode, 'view');
        
        // Filter by parent context
        let contextFilteredCount = 0;
        if (accessibleIds.length > 0) {
          const entityTableMap: Record<string, string> = {
            'project': 'app.d_project',
            'task': 'app.ops_task_head', 
            'wiki': 'app.d_wiki',
            'form': 'app.ops_formlog_head',
            'artifact': 'app.d_artifact',
          };

          const actionTable = entityTableMap[entityTypeCode];
          if (actionTable) {
            const parentColumnMap: Record<string, Record<string, string>> = {
              'project': { 'biz': 'biz_id', 'client': 'clients' },
              'task': { 'project': 'project_id', 'biz': 'biz_id', 'worksite': 'worksite_id' },
              'wiki': { 'biz': 'biz_id', 'project': 'project_id' },
              'form': { 'biz': 'biz_id', 'project': 'project_id', 'worksite': 'worksite_id' },
              'artifact': { 'biz': 'biz_id', 'project': 'project_id' },
            };

            const parentColumn = parentColumnMap[entityTypeCode]?.[parentEntity];
            if (parentColumn) {
              const countResult = await db.execute(sql`
                SELECT COUNT(*) as count 
                FROM ${sql.raw(actionTable)} 
                WHERE id = ANY(${accessibleIds}) 
                  AND ${sql.raw(parentColumn)} = ${parentId}
                  AND active = true
              `);
              contextFilteredCount = parseInt(String(countResult[0]?.count || '0'));
            }
          }
        }

        actionSummaries.push({
          entity_type_code: entityTypeCode,
          display_name: displayName,
          permission_actions: permissionActions,
          total_accessible: contextFilteredCount,
        });
      }

      // Get what user can create in this parent context
      const canCreateQuery = await db.execute(sql`
        SELECT DISTINCT pm.action_entity
        FROM app.meta_entity_hierarchy_permission_mapping pm
        WHERE pm.parent_entity = ${parentEntity}
          AND pm.permission_action = 'create'
          AND pm.active = true
        ORDER BY pm.action_entity
      `);

      const canCreate = canCreateQuery.map(row => String(row.action_entity));

      return {
        parent_info: {
          entity_type: parentEntity,
          entity_id: parentId,
          entity_name: String(parentInfo[0]?.name || ''),
          can_create: canCreate,
        },
        action_entities: actionSummaries,
      };
    } catch (error) {
      fastify.log.error('Error fetching action summaries:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get all entity types (for sidebar generation)
  fastify.get('/api/v1/meta/entity-types', {
    
    schema: {
      tags: ['meta', 'hierarchy'],
      summary: 'Get all entity types',
      description: 'Returns all entity types for sidebar navigation generation',
      response: {
        200: Type.Array(EntityTypeSchema),
        401: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const entityTypes = await db.execute(sql`
        SELECT 
          id,
          entity_type,
          entity_type_code,
          entity_category,
          display_name,
          is_root_capable,
          supports_hierarchy,
          requires_parent,
          sort_order,
          icon_name
        FROM app.meta_entity_types
        WHERE active = true
        ORDER BY sort_order, display_name
      `);

      return entityTypes;
    } catch (error) {
      fastify.log.error('Error fetching entity types:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get entity hierarchy relationships (what can be created where)
  fastify.get('/api/v1/meta/entity-hierarchy', {
    
    schema: {
      tags: ['meta', 'hierarchy'],
      summary: 'Get entity hierarchy relationships',
      description: 'Returns parent-child entity creation relationships',
      response: {
        200: Type.Array(HierarchyRelationshipSchema),
        401: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const hierarchyData = await db.execute(sql`
        SELECT 
          parent_entity,
          action_entity,
          array_agg(permission_action ORDER BY permission_action) as permission_actions,
          min(eh.hierarchy_level) as hierarchy_level
        FROM app.meta_entity_hierarchy_permission_mapping pm
        LEFT JOIN app.meta_entity_hierarchy eh ON (
          eh.parent_entity = pm.parent_entity AND 
          eh.action_entity = pm.action_entity
        )
        WHERE pm.active = true
        GROUP BY parent_entity, action_entity
        ORDER BY parent_entity, action_entity
      `);

      return hierarchyData;
    } catch (error) {
      fastify.log.error('Error fetching entity hierarchy:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get complete navigation structure for user (combines entity types + permissions)
  fastify.get('/api/v1/meta/navigation', {
    
    schema: {
      tags: ['meta', 'hierarchy'],
      summary: 'Get complete navigation structure',
      description: 'Returns complete navigation data including user permissions for UI generation',
      response: {
        200: NavigationStructureSchema,
        401: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const employeeId = (request as any).user?.sub;
      if (!employeeId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Get sidebar entities (root-capable entities)
      const sidebarEntities = await db.execute(sql`
        SELECT 
          id,
          entity_type,
          entity_type_code,
          entity_category,
          display_name,
          is_root_capable,
          supports_hierarchy,
          requires_parent,
          sort_order,
          icon_name
        FROM app.meta_entity_types
        WHERE active = true AND is_root_capable = true
        ORDER BY sort_order, display_name
      `);

      // Get hierarchy relationships
      const entityHierarchy = await db.execute(sql`
        SELECT 
          parent_entity,
          action_entity,
          array_agg(permission_action ORDER BY permission_action) as permission_actions,
          min(eh.hierarchy_level) as hierarchy_level
        FROM app.meta_entity_hierarchy_permission_mapping pm
        LEFT JOIN app.meta_entity_hierarchy eh ON (
          eh.parent_entity = pm.parent_entity AND 
          eh.action_entity = pm.action_entity
        )
        WHERE pm.active = true
        GROUP BY parent_entity, action_entity
        ORDER BY parent_entity, action_entity
      `);

      // Get user permissions for each entity type
      const entityTypes = ['biz', 'hr', 'org', 'client', 'project', 'task', 'worksite', 'employee', 'role', 'wiki', 'form', 'artifact'];
      const userPermissions: Record<string, string[]> = {};
      
      for (const entityType of entityTypes) {
        const accessibleIds = await getEmployeeEntityIds(employeeId, entityType, 'view');
        userPermissions[entityType] = accessibleIds;
      }

      return {
        sidebar_entities: sidebarEntities,
        entity_hierarchy: entityHierarchy,
        user_permissions: userPermissions,
      };
    } catch (error) {
      fastify.log.error('Error fetching navigation structure:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get action entities available within a specific parent entity (for headerTabNavigation)
  fastify.get('/api/v1/meta/parent-entity/:parentEntity/action-entities', {
    
    schema: {
      tags: ['meta', 'hierarchy'],
      summary: 'Get available action entities for parent entity',
      description: 'Returns action entities that can be created/accessed within the specified parent entity',
      params: Type.Object({
        parentEntity: Type.String(),
      }),
      querystring: Type.Object({
        parentEntityId: Type.Optional(Type.String({ format: 'uuid' })),
      }),
      response: {
        200: Type.Array(ActionEntitySummarySchema),
        401: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const employeeId = (request as any).user?.sub;
      const { parentEntity } = request.params as { parentEntity: string };
      const { parentEntityId } = request.query as { parentEntityId?: string };

      if (!employeeId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Validate parent entity exists
      const entityTypeCheck = await db.execute(sql`
        SELECT entity_type_code 
        FROM app.meta_entity_types 
        WHERE entity_type_code = ${parentEntity} AND active = true
      `);

      if (entityTypeCheck.length === 0) {
        return reply.status(404).send({ error: 'Parent entity type not found' });
      }

      // Get available action entities for this parent
      const actionEntities = await db.execute(sql`
        SELECT DISTINCT
          pm.action_entity,
          et.display_name,
          array_agg(pm.permission_action ORDER BY pm.permission_action) as permission_actions
        FROM app.meta_entity_hierarchy_permission_mapping pm
        JOIN app.meta_entity_types et ON et.entity_type_code = pm.action_entity
        WHERE pm.parent_entity = ${parentEntity} 
          AND pm.active = true
          AND et.active = true
        GROUP BY pm.action_entity, et.display_name, et.sort_order
        ORDER BY et.sort_order, et.display_name
      `);

      // For each action entity, get count of accessible entities for this user
      const result = [];
      for (const actionEntity of actionEntities) {
        const accessibleIds = await getEmployeeEntityIds(
          employeeId, 
          actionEntity.action_entity, 
          'view'
        );

        result.push({
          entity_type_code: actionEntity.action_entity,
          display_name: actionEntity.display_name,
          permission_actions: actionEntity.permission_actions,
          total_accessible: accessibleIds.length,
        });
      }

      return result;
    } catch (error) {
      fastify.log.error('Error fetching action entities:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get entity instance hierarchy (breadcrumb data)
  fastify.get('/api/v1/meta/entity/:entityType/:entityId/hierarchy', {
    
    schema: {
      tags: ['meta', 'hierarchy'],
      summary: 'Get entity instance hierarchy',
      description: 'Returns parent hierarchy chain for a specific entity instance (for breadcrumbs)',
      params: Type.Object({
        entityType: Type.String(),
        entityId: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Array(Type.Object({
          entity_type: Type.String(),
          entity_id: Type.String(),
          entity_name: Type.String(),
          level: Type.Number(),
        })),
        401: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const employeeId = (request as any).user?.sub;
      const { entityType, entityId } = request.params as { entityType: string; entityId: string };

      if (!employeeId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Check user has access to this entity
      const hasAccess = await hasPermissionOnEntityId(employeeId, entityType, entityId, 'view');
      if (!hasAccess) {
        return reply.status(404).send({ error: 'Entity not found or access denied' });
      }

      // Get hierarchy chain using recursive CTE
      const hierarchyChain = await db.execute(sql`
        WITH RECURSIVE entity_hierarchy AS (
          -- Base case: start with the requested entity
          SELECT 
            eih.action_entity_id,
            eih.action_entity,
            eih.parent_entity_id,
            eih.parent_entity,
            0 as level
          FROM app.entity_id_hierarchy_mapping eih
          WHERE eih.action_entity_id = ${entityId} 
            AND eih.action_entity = ${entityType}
            AND eih.active = true
          
          UNION ALL
          
          -- Recursive case: get parents
          SELECT 
            eih.action_entity_id,
            eih.action_entity,
            eih.parent_entity_id,
            eih.parent_entity,
            eh.level + 1
          FROM app.entity_id_hierarchy_mapping eih
          JOIN entity_hierarchy eh ON eih.action_entity_id = eh.parent_entity_id
          WHERE eih.active = true
        )
        SELECT 
          eh.action_entity as entity_type,
          eh.action_entity_id as entity_id,
          COALESCE(
            CASE eh.action_entity
              WHEN 'biz' THEN (SELECT name FROM app.d_biz WHERE id = eh.action_entity_id)
              WHEN 'project' THEN (SELECT name FROM app.d_project WHERE id = eh.action_entity_id)
              WHEN 'hr' THEN (SELECT name FROM app.d_hr WHERE id = eh.action_entity_id)
              WHEN 'org' THEN (SELECT name FROM app.d_org WHERE id = eh.action_entity_id)
              WHEN 'client' THEN (SELECT name FROM app.d_client WHERE id = eh.action_entity_id)
              WHEN 'worksite' THEN (SELECT name FROM app.d_worksite WHERE id = eh.action_entity_id)
              WHEN 'employee' THEN (SELECT name FROM app.d_employee WHERE id = eh.action_entity_id)
              WHEN 'role' THEN (SELECT name FROM app.d_role WHERE id = eh.action_entity_id)
              WHEN 'wiki' THEN (SELECT name FROM app.d_wiki WHERE id = eh.action_entity_id)
              WHEN 'form' THEN (SELECT name FROM app.ops_formlog_head WHERE id = eh.action_entity_id)
              WHEN 'task' THEN (SELECT name FROM app.ops_task_head WHERE id = eh.action_entity_id)
              WHEN 'artifact' THEN (SELECT name FROM app.d_artifact WHERE id = eh.action_entity_id)
            END,
            'Unknown'
          ) as entity_name,
          eh.level
        FROM entity_hierarchy eh
        ORDER BY eh.level DESC
      `);

      return hierarchyChain;
    } catch (error) {
      fastify.log.error('Error fetching entity hierarchy:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Global omnibox search endpoint (⌘K functionality)
  fastify.get('/api/v1/search/global', {
    
    schema: {
      tags: ['search', 'global'],
      summary: 'Global omnibox search',
      description: 'Search across all entity types with typeahead support for ⌘K functionality',
      querystring: Type.Object({
        q: Type.String({ minLength: 2 }),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 50 })),
        entity_types: Type.Optional(Type.Array(Type.String())),
        scope_filter: Type.Optional(Type.String()),
      }),
      response: {
        200: Type.Object({
          results: Type.Array(Type.Object({
            entity_type: Type.String(),
            entity_id: Type.String(),
            name: Type.String(),
            description: Type.Optional(Type.String()),
            context: Type.Optional(Type.String()),
            match_score: Type.Number(),
            breadcrumb: Type.Array(Type.String()),
          })),
          total_found: Type.Number(),
          query: Type.String(),
          entity_counts: Type.Record(Type.String(), Type.Number()),
        }),
        400: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const employeeId = (request as any).user?.sub;
      const { 
        q, 
        limit = 20, 
        entity_types = [],
        scope_filter 
      } = request.query as any;

      if (!employeeId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Define searchable entity types with their table mappings and key fields
      const searchableEntities: Record<string, { 
        table: string; 
        name_field: string; 
        desc_field?: string; 
        context_fields?: string[]; 
      }> = {
        'project': { 
          table: 'app.d_project', 
          name_field: 'name', 
          desc_field: 'descr',
          context_fields: ['project_code', 'project_type']
        },
        'task': { 
          table: 'app.ops_task_head', 
          name_field: 'name', 
          desc_field: 'descr',
          context_fields: ['task_number', 'task_type']
        },
        'biz': { 
          table: 'app.d_biz', 
          name_field: 'name', 
          desc_field: 'descr'
        },
        'client': { 
          table: 'app.d_client', 
          name_field: 'name', 
          desc_field: 'descr'
        },
        'employee': { 
          table: 'app.d_employee', 
          name_field: 'name', 
          desc_field: 'descr',
          context_fields: ['email', 'job_title']
        },
        'wiki': { 
          table: 'app.d_wiki', 
          name_field: 'name', 
          desc_field: 'descr'
        },
      };

      // Filter entity types if specified
      const targetEntityTypes = entity_types.length > 0 
        ? entity_types.filter((type: string) => searchableEntities[type])
        : Object.keys(searchableEntities);

      const allResults = [];
      const entityCounts: Record<string, number> = {};

      for (const entityType of targetEntityTypes) {
        const config = searchableEntities[entityType];
        if (!config) continue;

        // Get accessible entity IDs for this type (RBAC filtering)
        const accessibleIds = await getEmployeeEntityIds(employeeId, entityType, 'view');
        if (accessibleIds.length === 0) {
          entityCounts[entityType] = 0;
          continue;
        }

        // Build search query with full-text search and fuzzy matching
        const contextFields = config.context_fields || [];
        const searchFields = [config.name_field, config.desc_field, ...contextFields].filter(Boolean);
        
        const searchConditions = searchFields.map(field => 
          sql`${sql.raw(field)} ILIKE ${'%' + q + '%'}`
        );

        // Execute search with RBAC filtering
        const searchResults = await db.execute(sql`
          SELECT 
            id,
            ${sql.raw(config.name_field)} as name,
            ${config.desc_field ? sql.raw(config.desc_field) : sql`NULL`} as description,
            ${contextFields.length > 0 
              ? sql`CONCAT_WS(' • ', ${sql.join(contextFields.map(f => sql.raw(f)), sql`, `)})` 
              : sql`NULL`} as context,
            CASE 
              WHEN ${sql.raw(config.name_field)} ILIKE ${'%' + q + '%'} THEN 100
              ${config.desc_field ? sql`WHEN ${sql.raw(config.desc_field)} ILIKE ${'%' + q + '%'} THEN 80` : sql``}
              ELSE 60
            END as match_score,
            '${entityType}' as entity_type
          FROM ${sql.raw(config.table)}
          WHERE id = ANY(${accessibleIds})
            AND active = true
            AND (${sql.join(searchConditions, sql` OR `)})
          ORDER BY match_score DESC, ${sql.raw(config.name_field)}
          LIMIT ${Math.ceil(limit / targetEntityTypes.length) + 5}
        `);

        entityCounts[entityType] = searchResults.length;
        
        // Add breadcrumb context for results
        const resultsWithBreadcrumb = await Promise.all(searchResults.map(async (result) => {
          const breadcrumb = [String(result.entity_type)];
          
          // Add parent context based on entity type
          if (entityType === 'task' && result.entity_type) {
            const projectContext = await db.execute(sql`
              SELECT p.name FROM app.d_project p
              JOIN app.ops_task_head t ON t.project_id = p.id
              WHERE t.id = ${result.id}
            `);
            if (projectContext.length > 0) {
              breadcrumb.unshift(`Project: ${projectContext[0].name}`);
            }
          }

          return {
            entity_type: String(result.entity_type),
            entity_id: String(result.id),
            name: String(result.name),
            description: result.description ? String(result.description) : undefined,
            context: result.context ? String(result.context) : undefined,
            match_score: Number(result.match_score),
            breadcrumb,
          };
        }));

        allResults.push(...resultsWithBreadcrumb);
      }

      // Sort all results by match score and limit
      const sortedResults = allResults
        .sort((a, b) => b.match_score - a.match_score)
        .slice(0, limit);

      return {
        results: sortedResults,
        total_found: allResults.length,
        query: q,
        entity_counts,
      };
    } catch (error) {
      fastify.log.error('Error in global search:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Scope filters endpoint (for action bar filtering)
  fastify.get('/api/v1/filters/scopes', {
    
    schema: {
      tags: ['filters', 'scopes'],
      summary: 'Get available scope filters',
      description: 'Returns available scope filter options for action bar filtering',
      querystring: Type.Object({
        entity_type: Type.String(),
      }),
      response: {
        200: Type.Object({
          scopes: Type.Array(Type.Object({
            scope_type: Type.String(),
            scope_id: Type.String(),
            scope_name: Type.String(),
            entity_count: Type.Number(),
          })),
        }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const employeeId = (request as any).user?.sub;
      const { entity_type } = request.query as any;

      if (!employeeId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const scopes = [];

      // Get business unit scopes
      const bizIds = await getEmployeeEntityIds(employeeId, 'biz', 'view');
      if (bizIds.length > 0) {
        const bizScopes = await db.execute(sql`
          SELECT id, name, 
            (SELECT COUNT(*) FROM app.${sql.raw(entity_type === 'project' ? 'd_project' : 'ops_task_head')} 
             WHERE biz_id = d_biz.id AND active = true) as entity_count
          FROM app.d_biz 
          WHERE id = ANY(${bizIds}) AND active = true
          ORDER BY name
        `);
        
        bizScopes.forEach(biz => {
          scopes.push({
            scope_type: 'biz',
            scope_id: String(biz.id),
            scope_name: String(biz.name),
            entity_count: Number(biz.entity_count),
          });
        });
      }

      // Get project scopes (for tasks)
      if (entity_type === 'task') {
        const projectIds = await getEmployeeEntityIds(employeeId, 'project', 'view');
        if (projectIds.length > 0) {
          const projectScopes = await db.execute(sql`
            SELECT id, name,
              (SELECT COUNT(*) FROM app.ops_task_head 
               WHERE project_id = d_project.id AND active = true) as entity_count
            FROM app.d_project 
            WHERE id = ANY(${projectIds}) AND active = true
            ORDER BY name
          `);
          
          projectScopes.forEach(project => {
            scopes.push({
              scope_type: 'project',
              scope_id: String(project.id),
              scope_name: String(project.name),
              entity_count: Number(project.entity_count),
            });
          });
        }
      }

      return { scopes };
    } catch (error) {
      fastify.log.error('Error fetching scope filters:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}