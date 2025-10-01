import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
// Removed API permission gating
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

// Meta data schemas
const MetaItemSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  code: Type.Optional(Type.String()),
  level_id: Type.Optional(Type.Number()),
  sort_id: Type.Optional(Type.Number()),
  sort_order: Type.Optional(Type.Number()),
  country_code: Type.Optional(Type.String()),
  salary_band_min: Type.Optional(Type.Number()),
  salary_band_max: Type.Optional(Type.Number()),
  is_management_level: Type.Optional(Type.Boolean()),
  is_executive_level: Type.Optional(Type.Boolean()),
  duration_weeks: Type.Optional(Type.Number()),
  color: Type.Optional(Type.String()),
  workflow_sequence: Type.Optional(Type.Number()),
  is_terminal_state: Type.Optional(Type.Boolean()),
  is_success_state: Type.Optional(Type.Boolean()),
  tags: Type.Optional(Type.Array(Type.String())),
  attr: Type.Optional(Type.Object({})),
  from_ts: Type.Optional(Type.String()),
  to_ts: Type.Optional(Type.String()),
  active: Type.Boolean(),
  created: Type.String(),
  updated: Type.String(),
});

const CreateMetaItemSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  code: Type.Optional(Type.String()),
  level_id: Type.Optional(Type.Number()),
  sort_id: Type.Optional(Type.Number()),
  sort_order: Type.Optional(Type.Number()),
  country_code: Type.Optional(Type.String()),
  salary_band_min: Type.Optional(Type.Number()),
  salary_band_max: Type.Optional(Type.Number()),
  is_management_level: Type.Optional(Type.Boolean()),
  is_executive_level: Type.Optional(Type.Boolean()),
  duration_weeks: Type.Optional(Type.Number()),
  color: Type.Optional(Type.String()),
  workflow_sequence: Type.Optional(Type.Number()),
  is_terminal_state: Type.Optional(Type.Boolean()),
  is_success_state: Type.Optional(Type.Boolean()),
  tags: Type.Optional(Type.Array(Type.String())),
  attr: Type.Optional(Type.Object({})),
  active: Type.Optional(Type.Boolean()),
});

const UpdateMetaItemSchema = Type.Partial(CreateMetaItemSchema);

export async function metaRoutes(fastify: FastifyInstance) {
  // Get all meta data or filter by category
  fastify.get('/api/v1/meta', {
    
    schema: {
      querystring: Type.Object({
        category: Type.Optional(Type.String()),
        active: Type.Optional(Type.Boolean()),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(MetaItemSchema),
          category: Type.Optional(Type.String()),
        }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { category, active } = request.query as any;


    try {
      let query;
      let categoryName = category;

      if (category === 'task_status' || category === 'task-status') {
        query = sql`
          SELECT
            id::text,
            level_name as name,
            null as descr,
            slug as code,
            level_id as sort_id,
            null as color,
            is_root as is_initial,
            is_leaf as is_final,
            false as is_blocked,
            null as icon,
            null as tags,
            null as attr,
            from_ts,
            to_ts,
            active,
            created,
            updated
          FROM app.meta_entity_task_status
          WHERE active_flag = ${active !== false}
          ORDER BY level_id ASC, level_name ASC
        `;
        categoryName = 'task_status';
      } else if (category === 'task_stage' || category === 'task-stage') {
        query = sql`
          SELECT
            id::text,
            level_name as name,
            null as descr,
            slug as code,
            level_id as sort_id,
            null as color,
            is_root as is_default,
            is_leaf as is_done,
            false as is_blocked,
            null as wip_limit,
            null as icon,
            null as tags,
            null as attr,
            from_ts,
            to_ts,
            active,
            created,
            updated
          FROM app.meta_entity_task_stage
          WHERE active_flag = ${active !== false}
          ORDER BY level_id ASC, level_name ASC
        `;
        categoryName = 'task_stage';
      } else if (category === 'project_status' || category === 'project-status') {
        query = sql`
          SELECT
            id::text,
            level_name as name,
            null as descr,
            slug as code,
            level_id as sort_id,
            null as color,
            level_id as workflow_sequence,
            is_leaf as is_terminal_state,
            is_leaf as is_success_state,
            null as tags,
            null as attr,
            from_ts,
            to_ts,
            active,
            created,
            updated
          FROM app.meta_entity_project_status
          WHERE active_flag = ${active !== false}
          ORDER BY level_id ASC, level_name ASC
        `;
        categoryName = 'project_status';
      } else if (category === 'project_stage' || category === 'project-stage') {
        query = sql`
          SELECT
            id::text,
            level_name as name,
            null as descr,
            level_id,
            null as duration_weeks,
            level_id as sort_order,
            null as tags,
            null as attr,
            from_ts,
            to_ts,
            active,
            created,
            updated
          FROM app.meta_entity_project_stage
          WHERE active_flag = ${active !== false}
          ORDER BY level_id ASC, level_name ASC
        `;
        categoryName = 'project_stage';
      } else if (category === 'biz_level' || category === 'business-level') {
        query = sql`
          SELECT
            id::text,
            level_name as name,
            null as descr,
            level_id,
            level_id as sort_order,
            null as tags,
            null as attr,
            from_ts,
            to_ts,
            active,
            created,
            updated
          FROM app.meta_entity_org_level
          WHERE active_flag = ${active !== false}
          ORDER BY level_id ASC
        `;
        categoryName = 'biz_level';
      } else if (category === 'org_level' || category === 'orgLevel') {
        query = sql`
          SELECT
            id::text,
            level_name as name,
            null as descr,
            level_id,
            null as country_code,
            level_id as sort_order,
            null as tags,
            null as attr,
            from_ts,
            to_ts,
            active,
            created,
            updated
          FROM app.meta_entity_org_level
          WHERE active_flag = ${active !== false}
          ORDER BY level_id ASC
        `;
        categoryName = 'org_level';
      } else if (category === 'hr_level' || category === 'hr-level') {
        query = sql`
          SELECT
            id::text,
            level_name as name,
            null as descr,
            level_id,
            null as salary_band_min,
            null as salary_band_max,
            false as is_management_level,
            false as is_executive_level,
            level_id as sort_order,
            null as tags,
            null as attr,
            from_ts,
            to_ts,
            active,
            created,
            updated
          FROM app.meta_entity_hr_level
          WHERE active_flag = ${active !== false}
          ORDER BY level_id ASC
        `;
        categoryName = 'hr_level';
      } else {
        // Return all categories or empty if unknown category
        if (category && !['all', undefined].includes(category)) {
          return {
            data: [],
            category: category,
          };
        }
        
        // Get all meta data (simplified for now)
        query = sql`
          SELECT 
            id::text,
            name,
            code,
            description,
            level_id,
            null as parent_id,
            level_id as "order",
            color,
            icon,
            is_default,
            null as wip_limit,
            active,
            created,
            updated
          FROM app.meta_task_status
          WHERE active_flag = ${active !== false}
          ORDER BY level_id ASC, name ASC
        `;
      }

      const results = await db.execute(query);

      return {
        data: results,
        category: categoryName,
      };
    } catch (error) {
      fastify.log.error('Error fetching meta data:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get specific meta item
  fastify.get('/api/v1/meta/:category/:id', {
    
    schema: {
      params: Type.Object({
        category: Type.String(),
        id: Type.String(),
      }),
      response: {
        200: MetaItemSchema,
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { category, id } = request.params as { category: string; id: string };

    try {
      let query;
      let tableName = '';

      switch (category) {
        case 'task_status':
        case 'task-status':
          tableName = 'app.meta_task_status';
          break;
        case 'task_stage':
        case 'task-stage':
          tableName = 'app.meta_task_stage';
          break;
        case 'project_status':
        case 'project-status':
          tableName = 'app.meta_project_status';
          break;
        case 'project_stage':
        case 'project-stage':
          tableName = 'app.meta_project_stage';
          break;
        default:
          return reply.status(404).send({ error: 'Unknown meta category' });
      }

      const results = await db.execute(sql`
        SELECT 
          id::text,
          name,
          code,
          description,
          level_id,
          parent_id,
          level_id as "order",
          color,
          icon,
          is_default,
          wip_limit,
          active,
          created,
          updated
        FROM ${sql.raw(tableName)}
        WHERE id = ${id}
      `);

      if (results.length === 0) {
        return reply.status(404).send({ error: 'Meta item not found' });
      }

      return results[0];
    } catch (error) {
      fastify.log.error('Error fetching meta item:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create meta item (admin only)
  fastify.post('/api/v1/meta/:category', {
    
    schema: {
      params: Type.Object({
        category: Type.String(),
      }),
      body: CreateMetaItemSchema,
      response: {
        201: MetaItemSchema,
        403: Type.Object({ error: Type.String() }),
        400: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { category } = request.params as { category: string };
    const data = request.body as any;


    try {
      let tableName = '';
      let insertFields = '';
      let returnFields = '';

      switch (category) {
        case 'task_status':
        case 'task-status':
          tableName = 'app.meta_task_status';
          insertFields = 'name, code, description, color, icon, is_default, wip_limit, active';
          returnFields = `
            id::text, name, code, description, level_id, null as parent_id,
            level_id as "order", color, icon, is_default, wip_limit, active, created, updated
          `;
          break;
        case 'task_stage':
        case 'task-stage':
          tableName = 'app.meta_task_stage';
          insertFields = 'name, code, description, color, icon, is_default, active';
          returnFields = `
            id::text, name, code, description, level_id, parent_id,
            level_id as "order", color, icon, is_default, null as wip_limit, active, created, updated
          `;
          break;
        default:
          return reply.status(400).send({ error: 'Invalid meta category' });
      }

      const result = await db.execute(sql`
        INSERT INTO ${sql.raw(tableName)} (${sql.raw(insertFields)})
        VALUES (
          ${data.name}, 
          ${data.code || null}, 
          ${data.description || null}, 
          ${data.color || null}, 
          ${data.icon || null}, 
          ${data.is_default || false}, 
          ${category.includes('status') ? data.wip_limit || null : sql``}${category.includes('status') ? sql`,` : sql``}
          ${data.active !== false}
        )
        RETURNING ${sql.raw(returnFields)}
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to create meta item' });
      }

      return reply.status(201).send(result[0]);
    } catch (error) {
      fastify.log.error('Error creating meta item:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update meta item (admin only)
  fastify.put('/api/v1/meta/:category/:id', {
    
    schema: {
      params: Type.Object({
        category: Type.String(),
        id: Type.String(),
      }),
      body: UpdateMetaItemSchema,
      response: {
        200: MetaItemSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { category, id } = request.params as { category: string; id: string };
    const data = request.body as any;


    try {
      let tableName = '';
      
      switch (category) {
        case 'task_status':
        case 'task-status':
          tableName = 'app.meta_task_status';
          break;
        case 'task_stage':
        case 'task-stage':
          tableName = 'app.meta_task_stage';
          break;
        default:
          return reply.status(400).send({ error: 'Invalid meta category' });
      }

      // Build update fields
      const updateFields = [];
      
      if (data.name !== undefined) updateFields.push(sql`name = ${data.name}`);
      if (data.code !== undefined) updateFields.push(sql`code = ${data.code}`);
      if (data.description !== undefined) updateFields.push(sql`description = ${data.description}`);
      if (data.color !== undefined) updateFields.push(sql`color = ${data.color}`);
      if (data.icon !== undefined) updateFields.push(sql`icon = ${data.icon}`);
      if (data.is_default !== undefined) updateFields.push(sql`is_default = ${data.is_default}`);
      if (data.wip_limit !== undefined && category.includes('status')) updateFields.push(sql`wip_limit = ${data.wip_limit}`);
      if (data.active !== undefined) updateFields.push(sql`active_flag = ${data.active}`);

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated = NOW()`);

      const result = await db.execute(sql`
        UPDATE ${sql.raw(tableName)}
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING 
          id::text, name, code, description, level_id, parent_id,
          level_id as "order", color, icon, is_default, 
          ${category.includes('status') ? sql`wip_limit,` : sql`null as wip_limit,`}
          active, created, updated
      `);

      if (result.length === 0) {
        return reply.status(404).send({ error: 'Meta item not found' });
      }

      return result[0];
    } catch (error) {
      fastify.log.error('Error updating meta item:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete meta item (admin only)
  fastify.delete('/api/v1/meta/:category/:id', {

    schema: {
      params: Type.Object({
        category: Type.String(),
        id: Type.String(),
      }),
      response: {
        204: Type.Null(),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { category, id } = request.params as { category: string; id: string };

    // Check if user has permission to delete meta data (admin-level)

    try {
      let tableName = '';

      switch (category) {
        case 'task_status':
        case 'task-status':
          tableName = 'app.meta_entity_task_status';
          break;
        case 'task_stage':
        case 'task-stage':
          tableName = 'app.meta_entity_task_stage';
          break;
        case 'project_status':
        case 'project-status':
          tableName = 'app.meta_entity_project_status';
          break;
        case 'project_stage':
        case 'project-stage':
          tableName = 'app.meta_entity_project_stage';
          break;
        case 'biz_level':
        case 'business-level':
          tableName = 'app.meta_entity_org_level';
          break;
        case 'org_level':
        case 'orgLevel':
          tableName = 'app.meta_entity_org_level';
          break;
        case 'hr_level':
        case 'hr-level':
          tableName = 'app.meta_entity_hr_level';
          break;
        default:
          return reply.status(400).send({ error: 'Invalid meta category' });
      }

      // Soft delete by setting active_flag = false and closing SCD record with to_ts
      const result = await db.execute(sql`
        UPDATE ${sql.raw(tableName)}
        SET
          active_flag = false,
          to_ts = NOW(),
          updated = NOW()
        WHERE id = ${id} AND active_flag = true
        RETURNING id
      `);

      if (result.length === 0) {
        return reply.status(404).send({ error: 'Meta item not found or already deleted' });
      }

      return reply.status(204).send();
    } catch (error) {
      fastify.log.error('Error deleting meta item:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}