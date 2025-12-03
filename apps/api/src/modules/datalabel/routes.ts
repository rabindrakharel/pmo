import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

// ============================================================================
// DATALABEL ROUTES
// Unified data label table for all entity labels (stages, statuses, priorities)
// Table: app.datalabel
// ============================================================================

// Simplified setting item schema for data table display
// NOTE: All optional fields allow null (permissive input philosophy)
const DatalabelItemSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  descr: Type.String(),
  parent_id: Type.Union([Type.Number(), Type.Null()]),
  color_code: Type.String(),
  position: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
});

export async function datalabelRoutes(fastify: FastifyInstance) {
  // ============================================================================
  // GET /api/v1/datalabel - Get all items for a specific datalabel
  // ============================================================================
  fastify.get('/api/v1/datalabel', {
    schema: {
      querystring: Type.Object({
        name: Type.String(), // datalabel_name (e.g., 'dl__task_stage')
        raw: Type.Optional(Type.Boolean()), // Return raw metadata for DAG viz
      }),
      response: {
        200: Type.Object({
          data: Type.Union([
            Type.Array(DatalabelItemSchema),
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
    const inputParam = query.name;
    const raw = query.raw === true || query.raw === 'true';

    if (!inputParam) {
      return reply.status(400).send({ error: 'Missing required parameter: name' });
    }

    try {
      // Database stores datalabel_name WITH dl__ prefix
      let datalabelName: string;
      if (inputParam.startsWith('dl__')) {
        datalabelName = inputParam;
      } else {
        datalabelName = `dl__${inputParam}`;
      }

      // Check if datalabel exists
      const checkExists = await db.execute(sql`
        SELECT datalabel_name FROM app.datalabel
        WHERE datalabel_name = ${datalabelName}
      `);

      if (checkExists.length === 0) {
        return reply.status(404).send({ error: `Datalabel '${inputParam}' not found` });
      }

      // If raw=true, return metadata array as-is (for DAG visualization)
      if (raw) {
        const rawResults = await db.execute(sql`
          SELECT metadata FROM app.datalabel
          WHERE datalabel_name = ${datalabelName}
        `);
        const metadata = rawResults[0]?.metadata || [];
        return { data: metadata, datalabel: datalabelName };
      }

      // Query and expand JSONB metadata array with ordinality for position
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
        FROM app.datalabel,
          jsonb_array_elements(metadata) WITH ORDINALITY as elem
        WHERE datalabel_name = '${datalabelName}'
        ORDER BY elem.ordinality
      `));

      return { data: results, datalabel: datalabelName };
    } catch (error) {
      fastify.log.error('Error fetching datalabel:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // GET /api/v1/datalabel/types - List all datalabel types (categories)
  // ============================================================================
  fastify.get('/api/v1/datalabel/types', {
    schema: {
      response: {
        200: Type.Object({
          data: Type.Array(Type.Object({
            datalabel_name: Type.String(),
            entity_code: Type.Union([Type.String(), Type.Null()]),
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
          entity_code,
          ui_label,
          ui_icon,
          jsonb_array_length(metadata) as item_count
        FROM app.datalabel
        ORDER BY datalabel_name
      `);

      return { data: results };
    } catch (error) {
      fastify.log.error('Error fetching datalabel types:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // GET /api/v1/datalabel/all - Get all datalabels with full metadata
  // Used by frontend to pre-fetch all dropdown options at session start
  // ============================================================================
  fastify.get('/api/v1/datalabel/all', {
    preHandler: [fastify.authenticate],
    schema: {
      response: {
        200: Type.Object({
          data: Type.Array(Type.Object({
            name: Type.String(),
            label: Type.String(),
            icon: Type.Union([Type.String(), Type.Null()]),
            options: Type.Array(Type.Object({
              id: Type.Number(),
              name: Type.String(),
              descr: Type.Optional(Type.Union([Type.String(), Type.Null()])),
              parent_id: Type.Union([Type.Number(), Type.Null()]),
              parent_ids: Type.Optional(Type.Array(Type.Number())),  // DAG parent IDs array
              sort_order: Type.Number(),
              color_code: Type.Optional(Type.Union([Type.String(), Type.Null()])),
              active_flag: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
            })),
          })),
          total: Type.Number(),
        }),
      },
    },
  }, async (_request, reply) => {
    try {
      const results = await db.execute(sql`
        SELECT
          datalabel_name,
          ui_label,
          ui_icon,
          metadata
        FROM app.datalabel
        ORDER BY datalabel_name
      `);

      // Transform to entity response format
      const datalabels = results.map((row: any) => {
        const metadata = row.metadata || [];
        return {
          name: row.datalabel_name,
          label: row.ui_label,
          icon: row.ui_icon,
          options: metadata.map((item: any, index: number) => ({
            id: item.id ?? index,
            name: item.name,
            descr: item.descr || '',
            parent_id: item.parent_id ?? null,
            parent_ids: item.parent_ids || [],  // DAG parent IDs array from JSONB
            sort_order: item.sort_order ?? index,
            color_code: item.color_code || null,
            active_flag: item.active_flag !== false,
          })),
        };
      });

      return { data: datalabels, total: datalabels.length };
    } catch (error) {
      fastify.log.error('Error fetching all datalabels:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // POST /api/v1/datalabel - Create a new datalabel type
  // ============================================================================
  fastify.post('/api/v1/datalabel', {
    schema: {
      body: Type.Object({
        entity_code: Type.String(),
        label_name: Type.String(),
        ui_label: Type.String(),
        ui_icon: Type.Optional(Type.Union([Type.String(), Type.Null()])),
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
      const datalabelName = `dl__${entity_code}_${label_name}`;

      // Check if already exists
      const existing = await db.execute(sql`
        SELECT datalabel_name FROM app.datalabel
        WHERE datalabel_name = ${datalabelName}
      `);

      if (existing.length > 0) {
        return reply.status(400).send({ error: `Datalabel '${datalabelName}' already exists` });
      }

      // Create new datalabel with empty metadata array
      await db.execute(sql`
        INSERT INTO app.datalabel (datalabel_name, entity_code, ui_label, ui_icon, metadata)
        VALUES (${datalabelName}, ${entity_code}, ${ui_label}, ${ui_icon || null}, '[]'::jsonb)
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
      fastify.log.error('Error creating datalabel:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // POST /api/v1/datalabel/:name/item - Add item to datalabel metadata array
  // ============================================================================
  fastify.post('/api/v1/datalabel/:name/item', {
    schema: {
      params: Type.Object({
        name: Type.String(),
      }),
      body: Type.Object({
        name: Type.String(),
        descr: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        parent_id: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
        color_code: Type.Optional(Type.Union([Type.String(), Type.Null()])),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: DatalabelItemSchema,
        }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { name: datalabelParam } = request.params as any;
    const newItem = request.body as any;

    try {
      const datalabelName = datalabelParam.startsWith('dl__') ? datalabelParam : `dl__${datalabelParam}`;

      // Get current metadata
      const current = await db.execute(sql`
        SELECT metadata FROM app.datalabel
        WHERE datalabel_name = ${datalabelName}
      `);

      if (current.length === 0) {
        return reply.status(404).send({ error: `Datalabel '${datalabelParam}' not found` });
      }

      const metadata = current[0].metadata as any[];
      const newId = metadata.length;

      const itemToAdd = {
        id: newId,
        name: newItem.name,
        descr: newItem.descr || '',
        parent_id: newItem.parent_id ?? null,
        color_code: newItem.color_code || 'blue',
      };

      metadata.push(itemToAdd);

      const metadataJson = JSON.stringify(metadata);
      await db.execute(sql`
        UPDATE app.datalabel
        SET metadata = ${sql.raw(`'${metadataJson.replace(/'/g, "''")}'`)}::jsonb
        WHERE datalabel_name = ${datalabelName}
      `);

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
      fastify.log.error('Error adding datalabel item:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // PUT /api/v1/datalabel/:name/item/:id - Update item in datalabel metadata
  // ============================================================================
  fastify.put('/api/v1/datalabel/:name/item/:id', {
    schema: {
      params: Type.Object({
        name: Type.String(),
        id: Type.String(),
      }),
      body: Type.Object({
        color_code: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        name: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        descr: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        parent_id: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: DatalabelItemSchema,
        }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { name: datalabelParam, id } = request.params as any;
    const updates = request.body as any;

    try {
      const datalabelName = datalabelParam.startsWith('dl__') ? datalabelParam : `dl__${datalabelParam}`;

      const current = await db.execute(sql`
        SELECT metadata FROM app.datalabel
        WHERE datalabel_name = ${datalabelName}
      `);

      if (current.length === 0) {
        return reply.status(404).send({ error: `Datalabel '${datalabelParam}' not found` });
      }

      const metadata = current[0].metadata as any[];
      const itemIndex = metadata.findIndex((item: any) => item.id === parseInt(id));

      if (itemIndex === -1) {
        return reply.status(404).send({ error: `Item with id '${id}' not found` });
      }

      // Apply updates
      if (updates.color_code !== undefined) metadata[itemIndex].color_code = updates.color_code;
      if (updates.name !== undefined) metadata[itemIndex].name = updates.name;
      if (updates.descr !== undefined) metadata[itemIndex].descr = updates.descr;
      if (updates.parent_id !== undefined) metadata[itemIndex].parent_id = updates.parent_id;

      const metadataJson = JSON.stringify(metadata);
      await db.execute(sql`
        UPDATE app.datalabel
        SET metadata = ${sql.raw(`'${metadataJson.replace(/'/g, "''")}'`)}::jsonb
        WHERE datalabel_name = ${datalabelName}
      `);

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
      fastify.log.error('Error updating datalabel item:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // DELETE /api/v1/datalabel/:name/item/:id - Delete item from datalabel
  // ============================================================================
  fastify.delete('/api/v1/datalabel/:name/item/:id', {
    schema: {
      params: Type.Object({
        name: Type.String(),
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
    const { name: datalabelParam, id } = request.params as any;

    try {
      const datalabelName = datalabelParam.startsWith('dl__') ? datalabelParam : `dl__${datalabelParam}`;

      const current = await db.execute(sql`
        SELECT metadata FROM app.datalabel
        WHERE datalabel_name = ${datalabelName}
      `);

      if (current.length === 0) {
        return reply.status(404).send({ error: `Datalabel '${datalabelParam}' not found` });
      }

      const metadata = current[0].metadata as any[];
      const itemIndex = metadata.findIndex((item: any) => item.id === parseInt(id));

      if (itemIndex === -1) {
        return reply.status(404).send({ error: `Item with id '${id}' not found` });
      }

      // Remove item
      metadata.splice(itemIndex, 1);

      // Reassign IDs to match positions
      metadata.forEach((item: any, index: number) => {
        item.id = index;
      });

      const metadataJson = JSON.stringify(metadata);
      await db.execute(sql`
        UPDATE app.datalabel
        SET metadata = ${sql.raw(`'${metadataJson.replace(/'/g, "''")}'`)}::jsonb
        WHERE datalabel_name = ${datalabelName}
      `);

      return { success: true, message: `Item ${id} deleted successfully` };
    } catch (error) {
      fastify.log.error('Error deleting datalabel item:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // PUT /api/v1/datalabel/:name/reorder - Reorder items in datalabel
  // ============================================================================
  fastify.put('/api/v1/datalabel/:name/reorder', {
    schema: {
      params: Type.Object({
        name: Type.String(),
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
    const { name: datalabelParam } = request.params as any;
    const { order } = request.body as any;

    try {
      const datalabelName = datalabelParam.startsWith('dl__') ? datalabelParam : `dl__${datalabelParam}`;

      const current = await db.execute(sql`
        SELECT metadata FROM app.datalabel
        WHERE datalabel_name = ${datalabelName}
      `);

      if (current.length === 0) {
        return reply.status(404).send({ error: `Datalabel '${datalabelParam}' not found` });
      }

      const metadata = current[0].metadata as any[];

      // Create map for quick lookup
      const itemMap = new Map();
      metadata.forEach(item => {
        itemMap.set(String(item.id), item);
      });

      // Reorder based on provided order
      const reorderedMetadata = order
        .sort((a: any, b: any) => a.position - b.position)
        .map((orderItem: any) => itemMap.get(String(orderItem.id)))
        .filter(Boolean);

      // Reassign IDs to match positions
      reorderedMetadata.forEach((item: any, index: number) => {
        item.id = index;
      });

      const metadataJson = JSON.stringify(reorderedMetadata);
      await db.execute(sql`
        UPDATE app.datalabel
        SET metadata = ${sql.raw(`'${metadataJson.replace(/'/g, "''")}'`)}::jsonb
        WHERE datalabel_name = ${datalabelName}
      `);

      return { success: true, message: 'Items reordered successfully' };
    } catch (error) {
      fastify.log.error('Error reordering datalabel items:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
