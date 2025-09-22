import type { FastifyInstance } from 'fastify';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

interface TabHierarchyItem {
  action_entity: string;
  parent_entity: string;
}

interface TabResponse {
  id: string;
  label: string;
  path: string;
}

export async function tabHierarchyRoutes(fastify: FastifyInstance) {
  // Get tabs for a specific parent entity
  fastify.get<{
    Params: {
      parentType: string;
      parentId: string;
    };
  }>('/:parentType/:parentId/tabs', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { parentType, parentId } = request.params;

      // Query the meta_entity_hierarchy table to get action entities for this parent
      const hierarchyResult = await db.execute(sql`
        SELECT
          action_entity,
          parent_entity
        FROM app.meta_entity_hierarchy
        WHERE parent_entity = ${parentType}
          AND active = true
        ORDER BY action_entity ASC
      `);

      const hierarchyItems: TabHierarchyItem[] = hierarchyResult as TabHierarchyItem[];

      // Transform to tab format
      const tabs: TabResponse[] = [];

      // Always add Overview tab first
      tabs.push({
        id: 'overview',
        label: 'Overview',
        path: `/${parentType}/${parentId}`,
      });

      // Add action entity tabs
      for (const item of hierarchyItems) {
        // Map entity types to proper routes and labels
        const entityRouteMap: Record<string, string> = {
          'task': 'task',
          'wiki': 'wiki',
          'form': 'form',
          'artifact': 'artifact',
          'project': 'project',
          'employee': 'employee',
          'worksite': 'worksite',
          'role': 'role',
        };

        const entityLabelMap: Record<string, string> = {
          'task': 'Tasks',
          'wiki': 'Wiki',
          'form': 'Forms',
          'artifact': 'Artifacts',
          'project': 'Projects',
          'employee': 'Employees',
          'worksite': 'Worksites',
          'role': 'Roles',
        };

        const routeSegment = entityRouteMap[item.action_entity] || item.action_entity;
        const label = entityLabelMap[item.action_entity] ||
                     item.action_entity.charAt(0).toUpperCase() + item.action_entity.slice(1);

        tabs.push({
          id: routeSegment,
          label: label,
          path: `/${parentType}/${parentId}/${routeSegment}`
        });
      }

      reply.send({
        success: true,
        data: tabs
      });

    } catch (error) {
      console.error('Error fetching tab hierarchy:', error);
      reply.status(500).send({
        success: false,
        message: 'Failed to fetch tab hierarchy',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}