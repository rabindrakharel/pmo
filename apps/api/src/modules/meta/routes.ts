import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { checkScopeAccess } from '../rbac/scope-auth.js';
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
    preHandler: [fastify.authenticate],
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
            name,
            "descr",
            code,
            sort_id,
            color,
            workflow_sequence,
            is_terminal_state,
            is_success_state,
            tags,
            attr,
            from_ts,
            to_ts,
            active,
            created,
            updated
          FROM app.meta_task_status
          ${active !== undefined ? sql`WHERE active = ${active}` : sql``}
          ORDER BY sort_id ASC, name ASC
        `;
        categoryName = 'task_status';
      } else if (category === 'task_stage' || category === 'task-stage') {
        query = sql`
          SELECT 
            id::text,
            name,
            "descr",
            code,
            sort_id,
            color,
            workflow_sequence,
            is_terminal_state,
            is_success_state,
            tags,
            attr,
            from_ts,
            to_ts,
            active,
            created,
            updated
          FROM app.meta_task_stage
          ${active !== undefined ? sql`WHERE active = ${active}` : sql``}
          ORDER BY sort_id ASC, name ASC
        `;
        categoryName = 'task_stage';
      } else if (category === 'project_status' || category === 'project-status') {
        query = sql`
          SELECT 
            id::text,
            name,
            "descr",
            code,
            sort_id,
            color,
            workflow_sequence,
            is_terminal_state,
            is_success_state,
            tags,
            attr,
            from_ts,
            to_ts,
            active,
            created,
            updated
          FROM app.meta_project_status
          ${active !== undefined ? sql`WHERE active = ${active}` : sql``}
          ORDER BY sort_id ASC, name ASC
        `;
        categoryName = 'project_status';
      } else if (category === 'project_stage' || category === 'project-stage') {
        query = sql`
          SELECT 
            id::text,
            name,
            "descr",
            level_id,
            duration_weeks,
            sort_order,
            tags,
            attr,
            from_ts,
            to_ts,
            active,
            created,
            updated
          FROM app.meta_project_stage
          ${active !== undefined ? sql`WHERE active = ${active}` : sql``}
          ORDER BY level_id ASC, name ASC
        `;
        categoryName = 'project_stage';
      } else if (category === 'biz_level' || category === 'business-level') {
        query = sql`
          SELECT 
            id::text,
            name,
            "descr",
            level_id,
            sort_order,
            tags,
            attr,
            from_ts,
            to_ts,
            active,
            created,
            updated
          FROM app.meta_biz_level
          ${active !== undefined ? sql`WHERE active = ${active}` : sql``}
          ORDER BY level_id ASC
        `;
        categoryName = 'biz_level';
      } else if (category === 'loc_level' || category === 'location-level') {
        query = sql`
          SELECT 
            id::text,
            name,
            "descr",
            level_id,
            country_code,
            sort_order,
            tags,
            attr,
            from_ts,
            to_ts,
            active,
            created,
            updated
          FROM app.meta_loc_level
          ${active !== undefined ? sql`WHERE active = ${active}` : sql``}
          ORDER BY level_id ASC
        `;
        categoryName = 'loc_level';
      } else if (category === 'hr_level' || category === 'hr-level') {
        query = sql`
          SELECT 
            id::text,
            name,
            "descr",
            level_id,
            salary_band_min,
            salary_band_max,
            is_management_level,
            is_executive_level,
            sort_order,
            tags,
            attr,
            from_ts,
            to_ts,
            active,
            created,
            updated
          FROM app.meta_hr_level
          ${active !== undefined ? sql`WHERE active = ${active}` : sql``}
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
          ${active !== undefined ? sql`WHERE active = ${active}` : sql``}
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
    preHandler: [fastify.authenticate],
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
    preHandler: [fastify.authenticate],
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
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    // Check if user has permission to create meta data (admin-level)
    const scopeAccess = await checkScopeAccess(userId, 'app', 'create');
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions - admin required' });
    }

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
    preHandler: [fastify.authenticate],
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
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    // Check if user has permission to modify meta data (admin-level)
    const scopeAccess = await checkScopeAccess(userId, 'app', 'modify');
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions - admin required' });
    }

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
      if (data.active !== undefined) updateFields.push(sql`active = ${data.active}`);

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
    preHandler: [fastify.authenticate],
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
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    // Check if user has permission to delete meta data (admin-level)
    const scopeAccess = await checkScopeAccess(userId, 'app', 'delete');
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions - admin required' });
    }

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

      // Soft delete by setting active = false
      const result = await db.execute(sql`
        UPDATE ${sql.raw(tableName)}
        SET active = false, updated = NOW()
        WHERE id = ${id}
      `);

      if (result.length === 0) {
        return reply.status(404).send({ error: 'Meta item not found' });
      }

      return reply.status(204).send();
    } catch (error) {
      fastify.log.error('Error deleting meta item:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}