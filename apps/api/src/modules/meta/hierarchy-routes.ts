/**
 * Meta Hierarchy API Routes
 * Provides entity hierarchy information and navigation structure for the UI
 */

import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

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
  icon_name: Type.Optional(Type.String())});

// Hierarchy relationship schema
const HierarchyRelationshipSchema = Type.Object({
  parent_entity: Type.String(),
  action_entity: Type.String(),
  permission_actions: Type.Array(Type.String()),
  hierarchy_level: Type.Optional(Type.Number())});

// Navigation structure schema
const NavigationStructureSchema = Type.Object({
  sidebar_entities: Type.Array(EntityTypeSchema),
  entity_hierarchy: Type.Array(HierarchyRelationshipSchema),
  user_permissions: Type.Record(Type.String(), Type.Array(Type.String()))});

// Action entity summary for headerTabNavigation
const ActionEntitySummarySchema = Type.Object({
  entity_type_code: Type.String(),
  display_name: Type.String(),
  permission_actions: Type.Array(Type.String()),
  total_accessible: Type.Number()});

export async function hierarchyRoutes(fastify: FastifyInstance) {

  // Get eligible parent entity types for an action entity type
  fastify.get('/api/v1/meta/entity-hierarchy/eligible-parents', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['meta', 'hierarchy'],
      summary: 'Get eligible parent entity types',
      description: 'Returns valid parent entity types for the specified action entity type',
      querystring: Type.Object({
        action_entity: Type.String()}),
      response: {
        200: Type.Object({
          data: Type.Array(Type.String())}),
        401: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    try {
      const employeeId = (request as any).user?.sub;
      const { action_entity } = request.query as { action_entity: string };

      if (!employeeId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Get eligible parent entity types from meta hierarchy
      const parentTypes = await db.execute(sql`
        SELECT DISTINCT parent_entity
        FROM app.meta_entity_hierarchy
        WHERE action_entity = ${action_entity}
          AND active_flag = true
        ORDER BY parent_entity
      `);

      const eligibleParentTypes = parentTypes.map(row => String(row.parent_entity));

      return {
        data: eligibleParentTypes};
    } catch (error) {
      fastify.log.error('Error fetching eligible parent types:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get dynamic child entity tabs for parent context (for DynamicChildEntityTabs)
  fastify.get('/api/v1/:parentEntity/:parentId/dynamic-child-entity-tabs', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['meta', 'hierarchy'],
      summary: 'Get action entity summaries for parent context',
      description: 'Returns available action entities within parent scope for DynamicChildEntityTabs with counts',
      params: Type.Object({
        parentEntity: Type.String(),
        parentId: Type.String({ format: 'uuid' })}),
      response: {
        200: Type.Object({
          parent_info: Type.Object({
            entity_type: Type.String(),
            entity_id: Type.String(),
            entity_name: Type.String(),
            can_create: Type.Array(Type.String())}),
          action_entities: Type.Array(ActionEntitySummarySchema)}),
        401: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    try {
      const employeeId = (request as any).user?.sub;
      const { parentEntity, parentId } = request.params as { 
        parentEntity: string; 
        parentId: string; 
      };

      if (!employeeId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Get parent entity info (canonical names)
      const parentTableMap: Record<string, string> = {
        'business': 'app.business',
        'project': 'app.project',
        'task': 'app.task',
        'office': 'app.office',
        'customer': 'app.customer',
        'worksite': 'app.worksite'};

      const parentTable = parentTableMap[parentEntity];
      if (!parentTable) {
        return reply.status(400).send({ error: 'Invalid parent entity type' });
      }

      const parentInfo = await db.execute(sql`
        SELECT name FROM ${sql.raw(parentTable)}
        WHERE id = ${parentId}
          AND active_flag = true
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
          AND pm.active_flag = true
          AND et.active_flag = true
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
        
        // Filter by parent context
        let contextFilteredCount = 0;
        {
          const entityTableMap: Record<string, string> = {
            'project': 'app.project',
            'task': 'app.task',
            'wiki': 'app.wiki',
            'form': 'app.form',
            'artifact': 'app.artifact'};

          const actionTable = entityTableMap[entityTypeCode];
          if (actionTable) {
            const parentColumnMap: Record<string, Record<string, string>> = {
              'project': { 'business': 'business_id', 'customer': 'customers' },
              'task': { 'project': 'metadata->\'project_id\'', 'business': 'metadata->\'business_id\'', 'worksite': 'worksite_id' },
              'wiki': { 'business': 'business_id', 'project': 'project_id', 'task': 'task_id' },
              'form': { 'business': 'business_id', 'project': 'project_id', 'task': 'task_id', 'worksite': 'worksite_id' },
              'artifact': { 'business': 'business_id', 'project': 'project_id', 'task': 'task_id' }};

            const parentColumn = parentColumnMap[entityTypeCode]?.[parentEntity];
            if (parentColumn) {
              // Handle JSONB extraction for task metadata
              let countResult;
              if (entityTypeCode === 'task' && parentColumn.includes('metadata')) {
                // Extract from JSONB
                const jsonbField = parentColumn.split('->')[1].replace(/'/g, '');
                countResult = await db.execute(sql`
                  SELECT COUNT(*) as count
                  FROM ${sql.raw(actionTable)}
                  WHERE (metadata->>${jsonbField})::uuid = ${parentId}::uuid
                    AND active_flag = true
                `);
              } else {
                countResult = await db.execute(sql`
                  SELECT COUNT(*) as count
                  FROM ${sql.raw(actionTable)}
                  WHERE ${sql.raw(parentColumn)} = ${parentId}
                    AND active_flag = true
                `);
              }
              contextFilteredCount = parseInt(String(countResult[0]?.count || '0'));
            }
          }
        }

        actionSummaries.push({
          entity_type_code: entityTypeCode,
          display_name: displayName,
          permission_actions: permissionActions,
          total_accessible: contextFilteredCount});
      }

      // Get what user can create in this parent context
      const canCreateQuery = await db.execute(sql`
        SELECT DISTINCT pm.action_entity
        FROM app.meta_entity_hierarchy_permission_mapping pm
        WHERE pm.parent_entity = ${parentEntity}
          AND pm.permission_action = 'create'
          AND pm.active_flag = true
        ORDER BY pm.action_entity
      `);

      const canCreate = canCreateQuery.map(row => String(row.action_entity));

      return {
        parent_info: {
          entity_type: parentEntity,
          entity_id: parentId,
          entity_name: String(parentInfo[0]?.name || ''),
          can_create: canCreate},
        action_entities: actionSummaries};
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
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
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
        WHERE active_flag = true
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
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    try {
      const hierarchyData = await db.execute(sql`
        SELECT 
          parent_entity,
          action_entity,
          array_agg(permission_action ORDER BY permission_action) as permission_actions,
          min(eh.hierarchy_level) as hierarchy_level
        FROM app.meta_entity_hierarchy_permission_mapping pm
        LEFT JOIN app.meta_entity_hierarchy eh ON (
          eh.parent_entity_type = pm.parent_entity AND 
          eh.child_entity_type = pm.action_entity
        )
        WHERE pm.active_flag = true
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
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['meta', 'hierarchy'],
      summary: 'Get complete navigation structure',
      description: 'Returns complete navigation data including user permissions for UI generation',
      response: {
        200: NavigationStructureSchema,
        401: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
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
        WHERE active_flag = true AND is_root_capable = true
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
          eh.parent_entity_type = pm.parent_entity AND 
          eh.child_entity_type = pm.action_entity
        )
        WHERE pm.active_flag = true
        GROUP BY parent_entity, action_entity
        ORDER BY parent_entity, action_entity
      `);

      // Get user permissions for each entity type (canonical names)
      const entityTypes = ['business', 'office', 'customer', 'project', 'task', 'worksite', 'employee', 'role', 'wiki', 'form', 'artifact'];
      return {
        sidebar_entities: sidebarEntities,
        entity_hierarchy: entityHierarchy,
        user_permissions: {}};
    } catch (error) {
      fastify.log.error('Error fetching navigation structure:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get action entities available within a specific parent entity (for headerTabNavigation)
  fastify.get('/api/v1/meta/parent-entity/:parentEntity/action-entities', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['meta', 'hierarchy'],
      summary: 'Get available action entities for parent entity',
      description: 'Returns action entities that can be created/accessed within the specified parent entity',
      params: Type.Object({
        parentEntity: Type.String()}),
      querystring: Type.Object({
        parentEntityId: Type.Optional(Type.String({ format: 'uuid' }))}),
      response: {
        200: Type.Array(ActionEntitySummarySchema),
        401: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
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
        WHERE entity_type_code = ${parentEntity} AND active_flag = true
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
          AND pm.active_flag = true
          AND et.active_flag = true
        GROUP BY pm.action_entity, et.display_name, et.sort_order
        ORDER BY et.sort_order, et.display_name
      `);

      // For each action entity, return metadata
      const result = [];
      for (const actionEntity of actionEntities) {
        result.push({
          entity_type_code: actionEntity.action_entity,
          display_name: actionEntity.display_name,
          permission_actions: actionEntity.permission_actions,
          total_accessible: 0});
      }

      return result;
    } catch (error) {
      fastify.log.error('Error fetching action entities:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get entity instance hierarchy (breadcrumb data)
  fastify.get('/api/v1/meta/entity/:entityCode/:entityId/hierarchy', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['meta', 'hierarchy'],
      summary: 'Get entity instance hierarchy',
      description: 'Returns parent hierarchy chain for a specific entity instance (for breadcrumbs)',
      params: Type.Object({
        entityCode: Type.String(),
        entityId: Type.String({ format: 'uuid' })}),
      response: {
        200: Type.Array(Type.Object({
          entity_type: Type.String(),
          entity_id: Type.String(),
          entity_name: Type.String(),
          level: Type.Number()})),
        401: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    try {
      const employeeId = (request as any).user?.sub;
      const { entityCode, entityId } = request.params as { entityCode: string; entityId: string };

      if (!employeeId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Verify entity exists (canonical names)
      const entityTableMap: Record<string, string> = {
        'business': 'business',
        'project': 'project',
        'task': 'task',
        'office': 'office',
        'customer': 'customer',
        'worksite': 'worksite'
      };

      const entityTable = entityTableMap[entityCode];
      if (entityTable) {
        const entityCheck = await db.execute(sql`
          SELECT id FROM app.${sql.identifier(entityTable)}
          WHERE id::text = ${entityId}
            AND active_flag = true
        `);

        if (entityCheck.length === 0) {
          return reply.status(404).send({ error: 'Entity not found' });
        }
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
          FROM app.entity_id_map eih
          WHERE eih.action_entity_id = ${entityId} 
            AND eih.action_entity = ${entityCode}
            AND eih.active_flag = true
          
          UNION ALL
          
          -- Recursive case: get parents
          SELECT 
            eih.action_entity_id,
            eih.action_entity,
            eih.parent_entity_id,
            eih.parent_entity,
            eh.level + 1
          FROM app.entity_id_map eih
          JOIN entity_hierarchy eh ON eih.action_entity_id = eh.parent_entity_type_id
          WHERE eih.active_flag = true
        )
        SELECT 
          eh.child_entity_type as entity_type,
          eh.child_entity_id as entity_id,
          COALESCE(
            CASE eh.child_entity_type
              WHEN 'business' THEN (SELECT name FROM app.business WHERE id = eh.child_entity_id)
              WHEN 'project' THEN (SELECT name FROM app.project WHERE id = eh.child_entity_id)
              WHEN 'office' THEN (SELECT name FROM app.office WHERE id = eh.child_entity_id)
              WHEN 'customer' THEN (SELECT name FROM app.customer WHERE id = eh.child_entity_id)
              WHEN 'worksite' THEN (SELECT name FROM app.worksite WHERE id = eh.child_entity_id)
              WHEN 'employee' THEN (SELECT name FROM app.employee WHERE id = eh.child_entity_id)
              WHEN 'role' THEN (SELECT name FROM app.role WHERE id = eh.child_entity_id)
              WHEN 'wiki' THEN (SELECT name FROM app.wiki WHERE id = eh.child_entity_id)
              WHEN 'form' THEN (SELECT name FROM app.form WHERE id = eh.child_entity_id)
              WHEN 'task' THEN (SELECT name FROM app.task WHERE id = eh.child_entity_id)
              WHEN 'artifact' THEN (SELECT name FROM app.artifact WHERE id = eh.child_entity_id)
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
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['search', 'global'],
      summary: 'Global omnibox search',
      description: 'Search across all entity types with typeahead support for ⌘K functionality',
      querystring: Type.Object({
        q: Type.String({ minLength: 2 }),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 50 })),
        entity_types: Type.Optional(Type.Array(Type.String())),
        scope_filter: Type.Optional(Type.String())}),
      response: {
        200: Type.Object({
          results: Type.Array(Type.Object({
            entity_type: Type.String(),
            entity_id: Type.String(),
            name: Type.String(),
            description: Type.Optional(Type.String()),
            context: Type.Optional(Type.String()),
            match_score: Type.Number(),
            breadcrumb: Type.Array(Type.String())})),
          total_found: Type.Number(),
          query: Type.String(),
          entity_counts: Type.Record(Type.String(), Type.Number())}),
        400: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
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
          table: 'app.project', 
          name_field: 'name', 
          desc_field: 'descr',
          context_fields: ['project_code', 'project_type']
        },
        'task': { 
          table: 'app.task', 
          name_field: 'name', 
          desc_field: 'descr',
          context_fields: ['task_number', 'task_type']
        },
        'business': {
          table: 'app.business',
          name_field: 'name',
          desc_field: 'descr'
        },
        'customer': {
          table: 'app.customer',
          name_field: 'name',
          desc_field: 'descr'
        },
        'employee': { 
          table: 'app.employee', 
          name_field: 'name', 
          desc_field: 'descr',
          context_fields: ['email', 'job_title']
        },
        'wiki': { 
          table: 'app.wiki', 
          name_field: 'name', 
          desc_field: 'descr'
        }};

      // Filter entity types if specified
      const targetEntityTypes = entity_types.length > 0 
        ? entity_types.filter((type: string) => searchableEntities[type])
        : Object.keys(searchableEntities);

      const allResults = [];
      const entityCounts: Record<string, number> = {};

      for (const entityCode of targetEntityTypes) {
        const config = searchableEntities[entityCode];
        if (!config) continue;

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
            '${entityCode}' as entity_type
          FROM ${sql.raw(config.table)}
          WHERE active_flag = true
            AND (${sql.join(searchConditions, sql` OR `)})
          ORDER BY match_score DESC, ${sql.raw(config.name_field)}
          LIMIT ${Math.ceil(limit / targetEntityTypes.length) + 5}
        `);

        entityCounts[entityCode] = searchResults.length;
        
        // Add breadcrumb context for results
        const resultsWithBreadcrumb = await Promise.all(searchResults.map(async (result) => {
          const breadcrumb = [String(result.entity_type)];
          
          // Add parent context based on entity type
          if (entityCode === 'task' && result.entity_type) {
            const projectContext = await db.execute(sql`
              SELECT p.name FROM app.project p
              JOIN app.task t ON t.project_id = p.id
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
            breadcrumb};
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
        entity_counts};
    } catch (error) {
      fastify.log.error('Error in global search:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Scope filters endpoint (for action bar filtering)
  fastify.get('/api/v1/filters/scopes', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['filters', 'scopes'],
      summary: 'Get available scope filters',
      description: 'Returns available scope filter options for action bar filtering',
      querystring: Type.Object({
        entity_type: Type.String()}),
      response: {
        200: Type.Object({
          scopes: Type.Array(Type.Object({
            scope_type: Type.String(),
            scope_id: Type.String(),
            scope_name: Type.String(),
            entity_count: Type.Number()}))}),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    try {
      const employeeId = (request as any).user?.sub;
      const { entity_type } = request.query as any;

      if (!employeeId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const scopes = [];

      // Get project scopes (parent entities for action entities like task, wiki, artifact, form)
      {
        // Map action entity types to their counting queries
        const getEntityCountQuery = (entityCode: string) => {
          switch (entityCode) {
            case 'task':
              return sql`(SELECT COUNT(*) FROM app.task WHERE project_id = d_project.id AND active_flag = true)`;
            case 'wiki':
              return sql`(SELECT COUNT(*) FROM app.wiki w
                         INNER JOIN app.entity_id_map eh ON eh.child_entity_id = w.id
                         WHERE eh.parent_entity_type_id = d_project.id
                           AND eh.child_entity_type = 'wiki'
                           AND eh.parent_entity_type = 'project'
                           AND eh.active_flag = true
                           AND w.active_flag = true)`;
            case 'artifact':
              return sql`(SELECT COUNT(*) FROM app.artifact a
                         INNER JOIN app.entity_id_map eh ON eh.child_entity_id = a.id
                         WHERE eh.parent_entity_type_id = d_project.id
                           AND eh.child_entity_type = 'artifact'
                           AND eh.parent_entity_type = 'project'
                           AND eh.active_flag = true
                           AND a.active_flag = true)`;
            case 'form':
              return sql`(SELECT COUNT(*) FROM app.form f
                         WHERE f.project_id = d_project.id AND f.active_flag = true)`;
            default:
              return sql`0`;
          }
        };

        const projectScopes = await db.execute(sql`
          SELECT id, name, ${getEntityCountQuery(entity_type)} as entity_count
          FROM app.project
          WHERE active_flag = true
          ORDER BY name
        `);

        projectScopes.forEach(project => {
          scopes.push({
            scope_type: 'project',
            scope_id: String(project.id),
            scope_name: String(project.name),
            entity_count: Number(project.entity_count)});
        });
      }

      // Get business unit scopes (secondary filtering)
      {
        const getBusinessEntityCountQuery = (entityCode: string) => {
          switch (entityCode) {
            case 'task':
              return sql`(SELECT COUNT(*) FROM app.task t
                         INNER JOIN app.project p ON p.id = t.project_id
                         WHERE p.biz_id = d_business.id AND t.active_flag = true AND p.active_flag = true)`;
            case 'wiki':
              return sql`(SELECT COUNT(*) FROM app.wiki w
                         INNER JOIN app.entity_id_map eh ON eh.child_entity_id = w.id
                         INNER JOIN app.project p ON p.id = eh.parent_entity_type_id
                         WHERE p.biz_id = d_business.id
                           AND eh.child_entity_type = 'wiki'
                           AND eh.parent_entity_type = 'project'
                           AND eh.active_flag = true
                           AND w.active_flag = true
                           AND p.active_flag = true)`;
            case 'artifact':
              return sql`(SELECT COUNT(*) FROM app.artifact a
                         INNER JOIN app.entity_id_map eh ON eh.child_entity_id = a.id
                         INNER JOIN app.project p ON p.id = eh.parent_entity_type_id
                         WHERE p.biz_id = d_business.id
                           AND eh.child_entity_type = 'artifact'
                           AND eh.parent_entity_type = 'project'
                           AND eh.active_flag = true
                           AND a.active_flag = true
                           AND p.active_flag = true)`;
            case 'form':
              return sql`(SELECT COUNT(*) FROM app.form f
                         INNER JOIN app.project p ON p.id = f.project_id
                         WHERE p.biz_id = d_business.id AND f.active_flag = true AND p.active_flag = true)`;
            case 'project':
              return sql`(SELECT COUNT(*) FROM app.project WHERE biz_id = d_business.id AND active_flag = true)`;
            default:
              return sql`0`;
          }
        };

        const bizScopes = await db.execute(sql`
          SELECT id, name, ${getBusinessEntityCountQuery(entity_type)} as entity_count
          FROM app.business
          WHERE active_flag = true
          ORDER BY name
        `);

        bizScopes.forEach(biz => {
          scopes.push({
            scope_type: 'business',
            scope_id: String(biz.id),
            scope_name: String(biz.name),
            entity_count: Number(biz.entity_count)});
        });
      }

      return { scopes };
    } catch (error) {
      fastify.log.error('Error fetching scope filters:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}