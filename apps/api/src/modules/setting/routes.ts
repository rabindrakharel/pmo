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
        datalabel: Type.String(),
        raw: Type.Optional(Type.Boolean()), // Return raw metadata for DAG viz
      }),
      response: {
        200: Type.Object({
          data: Type.Union([
            Type.Array(SettingItemSchema),
            Type.Array(Type.Any()), // Raw metadata
          ]),
          datalabel: Type.String(),
        }),
        400: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const query = request.query as any;

    const inputParam = query.datalabel;
    const raw = query.raw === true || query.raw === 'true'; // Support ?raw=true for DAG viz

    if (!inputParam) {
      return reply.status(400).send({ error: 'Missing required parameter: datalabel' });
    }

    try {
      // Database stores datalabel_name WITH dl__ prefix
      // All inputs should now have dl__ prefix for consistency
      let datalabelName: string;

      // If input already has dl__ prefix, use it directly
      if (inputParam.startsWith('dl__')) {
        datalabelName = inputParam;
      } else {
        // Legacy support: add dl__ prefix if missing
        // This ensures backward compatibility during transition
        datalabelName = `dl__${inputParam}`;
      }

      // First check if the datalabel exists in the table
      const checkExists = await db.execute(sql`
        SELECT datalabel_name FROM app.setting_datalabel
        WHERE datalabel_name = ${datalabelName}
      `);

      if (checkExists.length === 0) {
        return reply.status(404).send({ error: `Datalabel '${inputParam}' not found` });
      }

      // If raw=true, return the metadata array as-is (for DAG visualization)
      if (raw) {
        const rawResults = await db.execute(sql`
          SELECT metadata FROM app.setting_datalabel
          WHERE datalabel_name = ${datalabelName}
        `);

        const metadata = rawResults[0]?.metadata || [];
        return { data: metadata, datalabel: datalabelName };
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

      // Return datalabel name exactly as stored in database (with dl__ prefix)
      // Even if results is empty (no metadata items), we return empty array
      return { data: results, datalabel: datalabelName };
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

  // Get all datalabels with full metadata (for visualization)
  fastify.get('/api/v1/setting/datalabels', {
    schema: {
      response: {
        200: Type.Array(Type.Object({
          datalabel_name: Type.String(),
          ui_label: Type.String(),
          ui_icon: Type.Union([Type.String(), Type.Null()]),
          metadata: Type.Array(Type.Any()),
        })),
      },
    },
  }, async (request, reply) => {
    try {
      const results = await db.execute(sql`
        SELECT
          datalabel_name,
          ui_label,
          ui_icon,
          metadata
        FROM app.setting_datalabel
        ORDER BY datalabel_name
      `);

      return results;
    } catch (error) {
      fastify.log.error('Error fetching datalabels:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create a new datalabel category
  fastify.post('/api/v1/setting/category', {
    schema: {
      body: Type.Object({
        entity_code: Type.String(),
        label_name: Type.String(),
        ui_label: Type.String(),
        ui_icon: Type.Optional(Type.String()),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            datalabel_name: Type.String(),
            ui_label: Type.String(),
            ui_icon: Type.Union([Type.String(), Type.Null()]),
          }),
        }),
        400: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { entity_code, label_name, ui_label, ui_icon } = request.body as any;

    try {
      // Construct datalabel_name: dl__{entity}_{label}
      const datalabelName = `dl__${entity_code}_${label_name}`;

      // Check if datalabel already exists
      const existing = await db.execute(sql`
        SELECT datalabel_name FROM app.setting_datalabel
        WHERE datalabel_name = ${datalabelName}
      `);

      if (existing.length > 0) {
        return reply.status(400).send({ error: `Datalabel '${datalabelName}' already exists` });
      }

      // Create new datalabel with empty metadata array
      await db.execute(sql`
        INSERT INTO app.setting_datalabel (datalabel_name, ui_label, ui_icon, metadata)
        VALUES (${datalabelName}, ${ui_label}, ${ui_icon || null}, '[]'::jsonb)
      `);

      return {
        success: true,
        data: {
          datalabel_name: datalabelName,
          ui_label: ui_label,
          ui_icon: ui_icon || null,
        },
      };
    } catch (error) {
      fastify.log.error('Error creating category:', error as any);
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
      // Database stores datalabel_name WITH dl__ prefix
      // Ensure input has dl__ prefix for consistency
      const datalabelName = datalabel.startsWith('dl__') ? datalabel : `dl__${datalabel}`;

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
      return {
        success: true,
        data: {
          id: String(newId),
          name: itemToAdd.name,
          descr: itemToAdd.descr,
          parent_id: itemToAdd.parent_id,
          color_code: itemToAdd.color_code,
          position: metadata.length - 1,
        },
      };
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
      // Database stores datalabel_name WITH dl__ prefix
      // Ensure input has dl__ prefix for consistency
      const datalabelName = datalabel.startsWith('dl__') ? datalabel : `dl__${datalabel}`;

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
      // Database stores datalabel_name WITH dl__ prefix
      // Ensure input has dl__ prefix for consistency
      const datalabelName = datalabel.startsWith('dl__') ? datalabel : `dl__${datalabel}`;

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

      return {
        success: true,
        message: `Item ${id} deleted successfully`,
      };
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
      // Database stores datalabel_name WITH dl__ prefix
      // Ensure input has dl__ prefix for consistency
      const datalabelName = datalabel.startsWith('dl__') ? datalabel : `dl__${datalabel}`;

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

      return {
        success: true,
        message: 'Items reordered successfully',
      };
    } catch (error) {
      fastify.log.error('Error reordering settings:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
