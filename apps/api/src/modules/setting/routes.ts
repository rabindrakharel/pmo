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
});

export async function settingRoutes(fastify: FastifyInstance) {
  // Get all settings for a datalabel (read-only for data table display)
  fastify.get('/api/v1/setting', {
    schema: {
      querystring: Type.Object({
        datalabel: Type.String(),
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
    const { datalabel } = request.query as any;

    try {
      // Convert snake_case to entity__label format
      // e.g., 'task_stage' -> 'task__stage', 'project_stage' -> 'project__stage'
      const datalabelName = datalabel.replace(/_([^_]+)$/, '__$1');

      // Query unified table and expand JSONB metadata array
      const results = await db.execute(sql`
        SELECT
          (elem->>'id')::text as id,
          elem->>'name' as name,
          COALESCE(elem->>'descr', '') as descr,
          CASE
            WHEN elem->>'parent_id' = 'null' THEN NULL
            ELSE (elem->>'parent_id')::integer
          END as parent_id,
          elem->>'color_code' as color_code
        FROM app.setting_datalabel,
          jsonb_array_elements(metadata) as elem
        WHERE datalabel_name = ${datalabelName}
        ORDER BY (elem->>'id')::integer ASC
      `);

      if (results.length === 0) {
        return reply.status(404).send({ error: `Datalabel '${datalabel}' not found` });
      }

      return { data: results, datalabel };
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
      // Convert snake_case to entity__label format
      const datalabelName = datalabel.replace(/_([^_]+)$/, '__$1');

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
}
