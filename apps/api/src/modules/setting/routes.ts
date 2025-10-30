import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

// Simplified setting item schema for data table display
const SettingItemSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  descr: Type.String(),
  parent_id: Type.Union([Type.Number(), Type.Null()]),
  color_code: Type.String(),
  position: Type.Optional(Type.Number()),
});

export async function settingRoutes(fastify: FastifyInstance) {
  // Get all settings for a datalabel (read-only for data table display)
  fastify.get('/api/v1/setting', {
    schema: {
      querystring: Type.Object({
        // Support both 'category' (new standard) and 'datalabel' (legacy)
        category: Type.Optional(Type.String()),
        datalabel: Type.Optional(Type.String()),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(SettingItemSchema),
          datalabel: Type.String(),
        }),
        400: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const query = request.query as any;

    // Support both ?category= (new standard with dl__ prefix) and ?datalabel= (legacy with single underscore)
    const inputParam = query.category || query.datalabel;

    if (!inputParam) {
      return reply.status(400).send({ error: 'Missing required parameter: category or datalabel' });
    }

    try {
      // Convert to database format (entity__attribute with double underscore)
      // Three supported formats:
      // 1. ?category=dl__project__stage (new standard - matches database column name)
      // 2. ?category=project__stage (intermediate - already double underscore)
      // 3. ?datalabel=project_stage (legacy - single underscore, needs conversion)
      let datalabelName: string;

      if (query.category) {
        // New standard: strip dl__ prefix if present, leaving double underscore format
        // Examples: 'dl__project__stage' -> 'project__stage', 'dl__task__priority' -> 'task__priority'
        if (inputParam.startsWith('dl__')) {
          datalabelName = inputParam.substring(4); // Remove 'dl__' prefix
        } else {
          // Already in double underscore format without dl__ prefix
          datalabelName = inputParam;
        }
      } else {
        // Legacy: convert first underscore to double underscore
        // Examples: 'task_stage' -> 'task__stage', 'opportunity_funnel_stage' -> 'opportunity__funnel_stage'
        datalabelName = inputParam.replace(/_/, '__');
      }

      // Query unified table and expand JSONB metadata array
      // IMPORTANT: Use WITH ORDINALITY to preserve array order (not ID order)
      // Array position = display order (set by drag & drop reordering)
      const results = await db.execute(sql.raw(`
        SELECT
          (elem.value->>'id')::text as id,
          elem.value->>'name' as name,
          COALESCE(elem.value->>'descr', '') as descr,
          CASE
            WHEN elem.value->>'parent_id' = 'null' THEN NULL
            ELSE (elem.value->>'parent_id')::integer
          END as parent_id,
          elem.value->>'color_code' as color_code,
          elem.ordinality - 1 as position
        FROM app.setting_datalabel,
          jsonb_array_elements(metadata) WITH ORDINALITY as elem
        WHERE datalabel_name = '${datalabelName}'
        ORDER BY elem.ordinality
      `));

      if (results.length === 0) {
        return reply.status(404).send({ error: `Datalabel '${inputParam}' not found` });
      }

      // Return datalabel in database column name format (dl__entity__label)
      // If input already has dl__ prefix, use as-is
      // Otherwise add dl__ prefix to match database column names
      const columnName = inputParam.startsWith('dl__') ? inputParam : `dl__${inputParam}`;

      return { data: results, datalabel: columnName };
    } catch (error) {
      fastify.log.error('Error fetching settings:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get all categories (list available entity-label combinations)
  fastify.get('/api/v1/setting/categories', {
    schema: {
      response: {
        200: Type.Object({
          data: Type.Array(Type.Object({
            datalabel_name: Type.String(),
            ui_label: Type.String(),
            ui_icon: Type.Union([Type.String(), Type.Null()]),
            item_count: Type.Number(),
          })),
        }),
      },
    },
  }, async (request, reply) => {
    try {
      const results = await db.execute(sql`
        SELECT
          datalabel_name,
          ui_label,
          ui_icon,
          jsonb_array_length(metadata) as item_count
        FROM app.setting_datalabel
        ORDER BY datalabel_name
      `);

      return { data: results };
    } catch (error) {
      fastify.log.error('Error fetching categories:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create a new setting item in metadata array
  fastify.post('/api/v1/setting/:datalabel', {
    schema: {
      params: Type.Object({
        datalabel: Type.String(),
      }),
      body: Type.Object({
        name: Type.String(),
        descr: Type.Optional(Type.String()),
        parent_id: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
        color_code: Type.Optional(Type.String()),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: SettingItemSchema,
        }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { datalabel } = request.params as any;
    const newItem = request.body as any;

    try {
      // Convert snake_case to entity__attribute format
      const datalabelName = datalabel.replace(/_/, '__');

      // Get current metadata
      const current = await db.execute(sql`
        SELECT metadata FROM app.setting_datalabel
        WHERE datalabel_name = ${datalabelName}
      `);

      if (current.length === 0) {
        return reply.status(404).send({ error: `Datalabel '${datalabel}' not found` });
      }

      // Parse metadata array
      const metadata = current[0].metadata as any[];

      // Assign ID based on position in array (0-based)
      // New item will be added to the end, so ID = current length
      const newId = metadata.length;

      // Create the new item
      const itemToAdd = {
        id: newId,
        name: newItem.name,
        descr: newItem.descr || '',
        parent_id: newItem.parent_id ?? null,
        color_code: newItem.color_code || 'blue',
      };

      // Add to the end of the array
      metadata.push(itemToAdd);

      // Update the database
      const metadataJson = JSON.stringify(metadata);
      await db.execute(sql`
        UPDATE app.setting_datalabel
        SET metadata = ${sql.raw(`'${metadataJson.replace(/'/g, "''")}'`)}::jsonb
        WHERE datalabel_name = ${datalabelName}
      `);

      // Return the created item
      return reply.status(200).send({
        success: true,
        data: {
          id: String(newId),
          name: itemToAdd.name,
          descr: itemToAdd.descr,
          parent_id: itemToAdd.parent_id,
          color_code: itemToAdd.color_code,
          position: metadata.length - 1,
        },
      });
    } catch (error) {
      fastify.log.error('Error creating setting:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update a single setting item (for inline editing)
  fastify.put('/api/v1/setting/:datalabel/:id', {
    schema: {
      params: Type.Object({
        datalabel: Type.String(),
        id: Type.String(),
      }),
      body: Type.Object({
        color_code: Type.Optional(Type.String()),
        name: Type.Optional(Type.String()),
        descr: Type.Optional(Type.String()),
        parent_id: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: SettingItemSchema,
        }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { datalabel, id } = request.params as any;
    const updates = request.body as any;

    try {
      // Convert snake_case to entity__attribute format
      // Replace the FIRST underscore with double underscore
      const datalabelName = datalabel.replace(/_/, '__');

      // Get current metadata
      const current = await db.execute(sql`
        SELECT metadata FROM app.setting_datalabel
        WHERE datalabel_name = ${datalabelName}
      `);

      if (current.length === 0) {
        return reply.status(404).send({ error: `Datalabel '${datalabel}' not found` });
      }

      // Parse metadata array and find the item to update
      const metadata = current[0].metadata as any[];
      const itemIndex = metadata.findIndex((item: any) => item.id === parseInt(id));

      if (itemIndex === -1) {
        return reply.status(404).send({ error: `Item with id '${id}' not found` });
      }

      // Update the item
      if (updates.color_code !== undefined) metadata[itemIndex].color_code = updates.color_code;
      if (updates.name !== undefined) metadata[itemIndex].name = updates.name;
      if (updates.descr !== undefined) metadata[itemIndex].descr = updates.descr;
      if (updates.parent_id !== undefined) metadata[itemIndex].parent_id = updates.parent_id;

      // Update the database - use sql.raw to properly insert JSON
      const metadataJson = JSON.stringify(metadata);
      await db.execute(sql`
        UPDATE app.setting_datalabel
        SET metadata = ${sql.raw(`'${metadataJson.replace(/'/g, "''")}'`)}::jsonb
        WHERE datalabel_name = ${datalabelName}
      `);

      // Return updated item
      return {
        success: true,
        data: {
          id: id,
          name: metadata[itemIndex].name,
          descr: metadata[itemIndex].descr || '',
          parent_id: metadata[itemIndex].parent_id,
          color_code: metadata[itemIndex].color_code,
        },
      };
    } catch (error) {
      fastify.log.error('Error updating setting:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete a setting item from metadata array
  fastify.delete('/api/v1/setting/:datalabel/:id', {
    schema: {
      params: Type.Object({
        datalabel: Type.String(),
        id: Type.String(),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          message: Type.String(),
        }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { datalabel, id } = request.params as any;

    try {
      // Convert snake_case to entity__attribute format
      const datalabelName = datalabel.replace(/_/, '__');

      // Get current metadata
      const current = await db.execute(sql`
        SELECT metadata FROM app.setting_datalabel
        WHERE datalabel_name = ${datalabelName}
      `);

      if (current.length === 0) {
        return reply.status(404).send({ error: `Datalabel '${datalabel}' not found` });
      }

      // Parse metadata array and remove the item
      const metadata = current[0].metadata as any[];
      const itemIndex = metadata.findIndex((item: any) => item.id === parseInt(id));

      if (itemIndex === -1) {
        return reply.status(404).send({ error: `Item with id '${id}' not found` });
      }

      // Remove the item from array
      metadata.splice(itemIndex, 1);

      // Reassign IDs to match new positions (0-based)
      // This ensures ID always matches the array position
      metadata.forEach((item: any, index: number) => {
        item.id = index;
      });

      // Update the database
      const metadataJson = JSON.stringify(metadata);
      await db.execute(sql`
        UPDATE app.setting_datalabel
        SET metadata = ${sql.raw(`'${metadataJson.replace(/'/g, "''")}'`)}::jsonb
        WHERE datalabel_name = ${datalabelName}
      `);

      return reply.status(200).send({
        success: true,
        message: `Item ${id} deleted successfully`,
      });
    } catch (error) {
      fastify.log.error('Error deleting setting:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Reorder metadata array
  fastify.put('/api/v1/setting/:datalabel/reorder', {
    schema: {
      params: Type.Object({
        datalabel: Type.String(),
      }),
      body: Type.Object({
        order: Type.Array(Type.Object({
          id: Type.Union([Type.String(), Type.Number()]),
          position: Type.Number(),
        })),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          message: Type.String(),
        }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { datalabel } = request.params as any;
    const { order } = request.body as any;

    try {
      // Convert snake_case to entity__attribute format
      const datalabelName = datalabel.replace(/_/, '__');

      // Get current metadata
      const current = await db.execute(sql`
        SELECT metadata FROM app.setting_datalabel
        WHERE datalabel_name = ${datalabelName}
      `);

      if (current.length === 0) {
        return reply.status(404).send({ error: `Datalabel '${datalabel}' not found` });
      }

      // Parse metadata array
      const metadata = current[0].metadata as any[];

      // Create a map of items by ID for quick lookup
      const itemMap = new Map();
      metadata.forEach(item => {
        itemMap.set(String(item.id), item);
      });

      // Reorder based on the provided order
      const reorderedMetadata = order
        .sort((a: any, b: any) => a.position - b.position)
        .map((orderItem: any) => itemMap.get(String(orderItem.id)))
        .filter(Boolean); // Remove any null/undefined entries

      // Reassign IDs to match new positions (0-based)
      // This ensures ID always matches the array position
      reorderedMetadata.forEach((item: any, index: number) => {
        item.id = index;
      });

      // Update the database
      const metadataJson = JSON.stringify(reorderedMetadata);
      await db.execute(sql`
        UPDATE app.setting_datalabel
        SET metadata = ${sql.raw(`'${metadataJson.replace(/'/g, "''")}'`)}::jsonb
        WHERE datalabel_name = ${datalabelName}
      `);

      return reply.status(200).send({
        success: true,
        message: 'Items reordered successfully',
      });
    } catch (error) {
      fastify.log.error('Error reordering settings:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
