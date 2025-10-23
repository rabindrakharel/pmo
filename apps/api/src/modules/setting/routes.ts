import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
// Removed API permission gating
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

// Setting data schemas
const SettingItemSchema = Type.Object({
  id: Type.String(),
  name: Type.Optional(Type.String()),
  descr: Type.Optional(Type.String()),
  code: Type.Optional(Type.String()),
  level_id: Type.Optional(Type.Number()),
  stage_id: Type.Optional(Type.Number()), // For stage-based settings
  sort_id: Type.Optional(Type.Number()),
  sort_order: Type.Optional(Type.Number()),
  parent_id: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
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
  active: Type.Optional(Type.Boolean()),
  active_flag: Type.Optional(Type.Boolean()),
  created: Type.String(),
  updated: Type.String(),
});

const CreateSettingItemSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  code: Type.Optional(Type.String()),
  level_id: Type.Optional(Type.Number()),
  sort_id: Type.Optional(Type.Number()),
  sort_order: Type.Optional(Type.Number()),
  parent_id: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
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

const UpdateSettingItemSchema = Type.Partial(CreateSettingItemSchema);

export async function settingRoutes(fastify: FastifyInstance) {
  // Get all setting data or filter by category
  fastify.get('/api/v1/setting', {
    
    schema: {
      querystring: Type.Object({
        category: Type.Optional(Type.String()),
        active: Type.Optional(Type.Boolean()),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(SettingItemSchema),
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

      if (category === 'task_status') {
        query = sql`
          SELECT
            id::text,
            name,
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
          FROM app.setting_task_status
          WHERE active_flag = ${active !== false}
          ORDER BY level_id ASC, name ASC
        `;
        categoryName = 'task_status';
      } else if (category === 'task_stage') {
        query = sql`
          SELECT
            level_id::text as id,
            name,
            descr,
            level_id,
            sort_order,
            parent_id,
            null as tags,
            null as attr,
            created_ts as from_ts,
            null as to_ts,
            active_flag,
            created_ts as created,
            created_ts as updated
          FROM app.setting_datalabel_task_stage
          WHERE active_flag = ${active !== false}
          ORDER BY level_id ASC, name ASC
        `;
        categoryName = 'task_stage';
      } else if (category === 'project_status') {
        query = sql`
          SELECT
            id::text,
            name,
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
          FROM app.setting_project_status
          WHERE active_flag = ${active !== false}
          ORDER BY level_id ASC, name ASC
        `;
        categoryName = 'project_status';
      } else if (category === 'project_stage') {
        query = sql`
          SELECT
            level_id::text as id,
            name,
            descr,
            level_id,
            sort_order,
            parent_id,
            null as tags,
            null as attr,
            created_ts as from_ts,
            null as to_ts,
            active_flag,
            created_ts as created,
            created_ts as updated
          FROM app.setting_datalabel_project_stage
          WHERE active_flag = ${active !== false}
          ORDER BY level_id ASC, name ASC
        `;
        categoryName = 'project_stage';
      } else if (category === 'business_level') {
        query = sql`
          SELECT
            level_id::text as id,
            name,
            descr,
            level_id,
            level_id as sort_order,
            null as tags,
            null as attr,
            created_ts as from_ts,
            null as to_ts,
            active_flag,
            created_ts as created,
            created_ts as updated
          FROM app.setting_datalabel_business_level
          WHERE active_flag = ${active !== false}
          ORDER BY level_id ASC
        `;
        categoryName = 'business_level';
      } else if (category === 'office_level') {
        query = sql`
          SELECT
            level_id::text as id,
            name,
            descr,
            level_id,
            level_id as sort_order,
            null as tags,
            null as attr,
            created_ts as from_ts,
            null as to_ts,
            active_flag,
            created_ts as created,
            created_ts as updated
          FROM app.setting_datalabel_office_level
          WHERE active_flag = ${active !== false}
          ORDER BY level_id ASC
        `;
        categoryName = 'office_level';
      } else if (category === 'hr_level') {
        query = sql`
          SELECT
            id::text,
            name,
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
          FROM app.setting_hr_level
          WHERE active_flag = ${active !== false}
          ORDER BY level_id ASC
        `;
        categoryName = 'hr_level';
      } else if (category === 'client_level') {
        query = sql`
          SELECT
            id::text,
            name,
            slug,
            level_id,
            is_root,
            is_leaf,
            authority_description,
            level_id as sort_order,
            null as tags,
            null as attr,
            from_ts,
            to_ts,
            active_flag as active,
            created_ts as created,
            updated_ts as updated
          FROM app.setting_datalabel_client_level
          WHERE active_flag = ${active !== false}
          ORDER BY level_id ASC
        `;
        categoryName = 'client_level';
      } else if (category === 'position_level') {
        query = sql`
          SELECT
            id::text,
            name,
            slug,
            level_id,
            is_root,
            is_leaf,
            authority_description,
            level_id as sort_order,
            null as tags,
            null as attr,
            from_ts,
            to_ts,
            active_flag as active,
            created_ts as created,
            updated_ts as updated
          FROM app.setting_datalabel_position_level
          WHERE active_flag = ${active !== false}
          ORDER BY level_id ASC
        `;
        categoryName = 'position_level';
      } else if (category === 'opportunity_funnel_stage') {
        query = sql`
          SELECT
            stage_id::text as id,
            stage_name as name,
            stage_name,
            stage_descr as descr,
            stage_id,
            sort_order,
            parent_id,
            null as tags,
            null as attr,
            created_ts as from_ts,
            null as to_ts,
            active_flag,
            created_ts as created,
            created_ts as updated
          FROM app.setting_datalabel_opportunity_funnel_stage
          WHERE active_flag = ${active !== false}
          ORDER BY sort_order ASC, stage_name ASC
        `;
        categoryName = 'opportunity_funnel_stage';
      } else if (category === 'industry_sector') {
        query = sql`
          SELECT
            level_id::text as id,
            name,
            descr,
            level_id,
            sort_order,
            null as tags,
            null as attr,
            created_ts as from_ts,
            null as to_ts,
            active_flag,
            created_ts as created,
            created_ts as updated
          FROM app.setting_datalabel_industry_sector
          WHERE active_flag = ${active !== false}
          ORDER BY sort_order ASC, name ASC
        `;
        categoryName = 'industry_sector';
      } else if (category === 'acquisition_channel') {
        query = sql`
          SELECT
            level_id::text as id,
            name,
            descr,
            level_id,
            sort_order,
            null as tags,
            null as attr,
            created_ts as from_ts,
            null as to_ts,
            active_flag,
            created_ts as created,
            created_ts as updated
          FROM app.setting_datalabel_acquisition_channel
          WHERE active_flag = ${active !== false}
          ORDER BY sort_order ASC, name ASC
        `;
        categoryName = 'acquisition_channel';
      } else if (category === 'customer_tier') {
        query = sql`
          SELECT
            level_id::text as id,
            name,
            descr,
            level_id,
            sort_order,
            null as tags,
            null as attr,
            created_ts as from_ts,
            null as to_ts,
            active_flag,
            created_ts as created,
            created_ts as updated
          FROM app.setting_datalabel_customer_tier
          WHERE active_flag = ${active !== false}
          ORDER BY sort_order ASC, name ASC
        `;
        categoryName = 'customer_tier';
      } else if (category === 'client_status') {
        query = sql`
          SELECT
            level_id::text as id,
            name,
            descr,
            level_id,
            sort_order,
            parent_id,
            null as tags,
            null as attr,
            created_ts as from_ts,
            null as to_ts,
            is_active as active,
            created_ts as created,
            updated_ts as updated
          FROM app.setting_datalabel_client_status
          WHERE is_active = ${active !== false}
          ORDER BY sort_order ASC, name ASC
        `;
        categoryName = 'client_status';
      } else if (category === 'client_service') {
        query = sql`
          SELECT
            level_id::text as id,
            name,
            slug,
            descr,
            level_id,
            sort_order,
            null as tags,
            null as attr,
            created_ts as from_ts,
            null as to_ts,
            active_flag as active,
            created_ts as created,
            updated_ts as updated
          FROM app.setting_datalabel_client_service
          WHERE active_flag = ${active !== false}
          ORDER BY sort_order ASC, name ASC
        `;
        categoryName = 'client_service';
      } else if (category === 'task_priority') {
        query = sql`
          SELECT
            level_id::text as id,
            name,
            descr,
            level_id,
            sort_order,
            null as tags,
            null as attr,
            created_ts as from_ts,
            null as to_ts,
            is_active as active,
            created_ts as created,
            updated_ts as updated
          FROM app.setting_datalabel_task_priority
          WHERE is_active = ${active !== false}
          ORDER BY sort_order ASC, name ASC
        `;
        categoryName = 'task_priority';
      } else if (category === 'task_update_type') {
        query = sql`
          SELECT
            level_id::text as id,
            name,
            descr,
            level_id,
            sort_order,
            null as tags,
            null as attr,
            created_ts as from_ts,
            null as to_ts,
            is_active as active,
            created_ts as created,
            updated_ts as updated
          FROM app.setting_datalabel_task_update_type
          WHERE is_active = ${active !== false}
          ORDER BY sort_order ASC, name ASC
        `;
        categoryName = 'task_update_type';
      } else if (category === 'form_submission_status') {
        query = sql`
          SELECT
            level_id::text as id,
            name,
            descr,
            level_id,
            sort_order,
            parent_id,
            null as tags,
            null as attr,
            created_ts as from_ts,
            null as to_ts,
            is_active as active,
            created_ts as created,
            updated_ts as updated
          FROM app.setting_datalabel_form_submission_status
          WHERE is_active = ${active !== false}
          ORDER BY sort_order ASC, name ASC
        `;
        categoryName = 'form_submission_status';
      } else if (category === 'form_approval_status') {
        query = sql`
          SELECT
            level_id::text as id,
            name,
            descr,
            level_id,
            sort_order,
            parent_id,
            null as tags,
            null as attr,
            created_ts as from_ts,
            null as to_ts,
            is_active as active,
            created_ts as created,
            updated_ts as updated
          FROM app.setting_datalabel_form_approval_status
          WHERE is_active = ${active !== false}
          ORDER BY sort_order ASC, name ASC
        `;
        categoryName = 'form_approval_status';
      } else if (category === 'wiki_publication_status') {
        query = sql`
          SELECT
            level_id::text as id,
            name,
            descr,
            level_id,
            sort_order,
            parent_id,
            null as tags,
            null as attr,
            created_ts as from_ts,
            null as to_ts,
            is_active as active,
            created_ts as created,
            updated_ts as updated
          FROM app.setting_datalabel_wiki_publication_status
          WHERE is_active = ${active !== false}
          ORDER BY sort_order ASC, name ASC
        `;
        categoryName = 'wiki_publication_status';
      } else {
        // Return all categories or empty if unknown category
        if (category && !['all', undefined].includes(category)) {
          return {
            data: [],
            category: category,
          };
        }
        
        // Get all setting data (simplified for now)
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
          FROM app.setting_task_status
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
      fastify.log.error('Error fetching setting data:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get specific setting item
  fastify.get('/api/v1/setting/:category/:id', {
    
    schema: {
      params: Type.Object({
        category: Type.String(),
        id: Type.String(),
      }),
      response: {
        200: SettingItemSchema,
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
          tableName = 'app.setting_task_status';
          break;
        case 'task_stage':
        case 'task-stage':
          tableName = 'app.setting_task_stage';
          break;
        case 'project_status':
        case 'project-status':
          tableName = 'app.setting_project_status';
          break;
        case 'project_stage':
        case 'project-stage':
          tableName = 'app.setting_project_stage';
          break;
        default:
          return reply.status(404).send({ error: 'Unknown setting category' });
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
        return reply.status(404).send({ error: 'Setting item not found' });
      }

      return results[0];
    } catch (error) {
      fastify.log.error('Error fetching setting item:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create setting item (admin only)
  fastify.post('/api/v1/setting/:category', {
    
    schema: {
      params: Type.Object({
        category: Type.String(),
      }),
      body: CreateSettingItemSchema,
      response: {
        201: SettingItemSchema,
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
          tableName = 'app.setting_task_status';
          insertFields = 'name, code, description, color, icon, is_default, wip_limit, active';
          returnFields = `
            id::text, name, code, description, level_id, null as parent_id,
            level_id as "order", color, icon, is_default, wip_limit, active, created, updated
          `;
          break;
        case 'task_stage':
        case 'task-stage':
          tableName = 'app.setting_task_stage';
          insertFields = 'name, code, description, color, icon, is_default, active';
          returnFields = `
            id::text, name, code, description, level_id, parent_id,
            level_id as "order", color, icon, is_default, null as wip_limit, active, created, updated
          `;
          break;
        default:
          return reply.status(400).send({ error: 'Invalid setting category' });
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
        return reply.status(500).send({ error: 'Failed to create setting item' });
      }

      return reply.status(201).send(result[0]);
    } catch (error) {
      fastify.log.error('Error creating setting item:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update setting item (admin only)
  fastify.put('/api/v1/setting/:category/:id', {
    
    schema: {
      params: Type.Object({
        category: Type.String(),
        id: Type.String(),
      }),
      body: UpdateSettingItemSchema,
      response: {
        200: SettingItemSchema,
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
      let idField = 'id'; // Most tables use 'id', some use 'level_id'

      switch (category) {
        case 'task_status':
          tableName = 'app.setting_task_status';
          break;
        case 'task_stage':
          tableName = 'app.setting_task_stage';
          idField = 'level_id';
          break;
        case 'project_status':
          tableName = 'app.setting_project_status';
          break;
        case 'project_stage':
          tableName = 'app.setting_project_stage';
          idField = 'level_id';
          break;
        case 'business_level':
          tableName = 'app.setting_business_level';
          idField = 'level_id';
          break;
        case 'office_level':
          tableName = 'app.setting_office_level';
          idField = 'level_id';
          break;
        case 'hr_level':
          tableName = 'app.setting_hr_level';
          break;
        case 'client_level':
          tableName = 'app.setting_datalabel_client_level';
          break;
        case 'position_level':
          tableName = 'app.setting_datalabel_position_level';
          break;
        case 'opportunity_funnel_stage':
          tableName = 'app.setting_datalabel_opportunity_funnel_stage';
          idField = 'stage_id';
          break;
        case 'industry_sector':
          tableName = 'app.setting_datalabel_industry_sector';
          idField = 'level_id';
          break;
        case 'acquisition_channel':
          tableName = 'app.setting_datalabel_acquisition_channel';
          idField = 'level_id';
          break;
        case 'customer_tier':
          tableName = 'app.setting_datalabel_customer_tier';
          idField = 'level_id';
          break;
        case 'client_service':
          tableName = 'app.setting_datalabel_client_service';
          idField = 'level_id';
          break;
        default:
          return reply.status(400).send({ error: 'Invalid setting category' });
      }

      // Build update fields
      const updateFields = [];

      // All tables now use standardized name/descr columns
      if (data.name !== undefined) updateFields.push(sql`name = ${data.name}`);
      if (data.descr !== undefined) updateFields.push(sql`descr = ${data.descr}`);
      if (data.code !== undefined) updateFields.push(sql`code = ${data.code}`);
      if (data.description !== undefined) updateFields.push(sql`description = ${data.description}`);
      if (data.color !== undefined) updateFields.push(sql`color = ${data.color}`);
      if (data.icon !== undefined) updateFields.push(sql`icon = ${data.icon}`);
      if (data.is_default !== undefined) updateFields.push(sql`is_default = ${data.is_default}`);
      if (data.wip_limit !== undefined && category.includes('status')) updateFields.push(sql`wip_limit = ${data.wip_limit}`);
      if (data.sort_order !== undefined) updateFields.push(sql`sort_order = ${data.sort_order}`);
      if (data.parent_id !== undefined) updateFields.push(sql`parent_id = ${data.parent_id}`);
      if (data.active !== undefined) updateFields.push(sql`active_flag = ${data.active}`);

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      // Only add updated_ts if the table has it (most status/position tables have it, new level tables don't)
      const hasUpdatedTs = !['opportunity_funnel_stage', 'industry_sector', 'acquisition_channel', 'office_level', 'business_level', 'project_stage', 'task_stage'].some(t => tableName.includes(t));
      if (hasUpdatedTs) {
        updateFields.push(sql`updated_ts = NOW()`);
      }

      const result = await db.execute(sql`
        UPDATE ${sql.raw(tableName)}
        SET ${sql.join(updateFields, sql`, `)}
        WHERE ${sql.raw(idField)} = ${id}
        RETURNING
          ${sql.raw(idField)}::text as id,
          name,
          descr,
          active_flag as active,
          created_ts as created,
          ${hasUpdatedTs ? sql.raw('updated_ts') : sql.raw('created_ts')} as updated
      `);

      if (result.length === 0) {
        return reply.status(404).send({ error: 'Setting item not found' });
      }

      return result[0];
    } catch (error) {
      fastify.log.error('Error updating setting item:', error);
      console.error('Full error details:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete setting item (admin only)
  fastify.delete('/api/v1/setting/:category/:id', {

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

    // Check if user has permission to delete setting data (admin-level)

    try {
      let tableName = '';
      let idField = 'id';

      switch (category) {
        case 'task_status':
          tableName = 'app.setting_task_status';
          break;
        case 'task_stage':
          tableName = 'app.setting_task_stage';
          idField = 'level_id';
          break;
        case 'project_status':
          tableName = 'app.setting_project_status';
          break;
        case 'project_stage':
          tableName = 'app.setting_project_stage';
          idField = 'level_id';
          break;
        case 'business_level':
          tableName = 'app.setting_business_level';
          idField = 'level_id';
          break;
        case 'office_level':
          tableName = 'app.setting_office_level';
          idField = 'level_id';
          break;
        case 'hr_level':
          tableName = 'app.setting_hr_level';
          break;
        case 'client_level':
          tableName = 'app.setting_datalabel_client_level';
          break;
        case 'position_level':
          tableName = 'app.setting_datalabel_position_level';
          break;
        case 'opportunity_funnel_stage':
          tableName = 'app.setting_datalabel_opportunity_funnel_stage';
          idField = 'stage_id';
          break;
        case 'industry_sector':
          tableName = 'app.setting_datalabel_industry_sector';
          idField = 'level_id';
          break;
        case 'acquisition_channel':
          tableName = 'app.setting_datalabel_acquisition_channel';
          idField = 'level_id';
          break;
        case 'customer_tier':
          tableName = 'app.setting_datalabel_customer_tier';
          idField = 'level_id';
          break;
        case 'client_service':
          tableName = 'app.setting_datalabel_client_service';
          idField = 'level_id';
          break;
        default:
          return reply.status(400).send({ error: 'Invalid setting category' });
      }

      // Soft delete by setting active_flag = false
      // Only update to_ts and updated_ts if they exist (new tables don't have updated_ts or to_ts)
      const hasTimestamps = !['opportunity_funnel_stage', 'industry_sector', 'acquisition_channel', 'customer_tier'].some(t => tableName.includes(t));

      let updateQuery;
      if (hasTimestamps) {
        updateQuery = sql`
          UPDATE ${sql.raw(tableName)}
          SET
            active_flag = false,
            to_ts = NOW(),
            updated_ts = NOW()
          WHERE ${sql.raw(idField)} = ${id} AND active_flag = true
          RETURNING ${sql.raw(idField)} as id
        `;
      } else {
        updateQuery = sql`
          UPDATE ${sql.raw(tableName)}
          SET active_flag = false
          WHERE ${sql.raw(idField)} = ${id} AND active_flag = true
          RETURNING ${sql.raw(idField)} as id
        `;
      }

      const result = await db.execute(updateQuery);

      if (result.length === 0) {
        return reply.status(404).send({ error: 'Setting item not found or already deleted' });
      }

      return reply.status(204).send();
    } catch (error) {
      fastify.log.error('Error deleting setting item:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}