import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

const WikiSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  code: Type.String(),
  slug: Type.String(),
  descr: Type.Optional(Type.String()),
  summary: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Array(Type.String())),
  content: Type.Optional(Type.Any()),
  contentMarkdown: Type.Optional(Type.String()),
  contentHtml: Type.Optional(Type.String()),
  wikiType: Type.Optional(Type.String()),
  category: Type.Optional(Type.String()),
  publicationStatus: Type.Optional(Type.String()),
  visibility: Type.Optional(Type.String()),
  active: Type.Boolean(),
  fromTs: Type.String(),
  toTs: Type.Optional(Type.String()),
  createdTs: Type.String(),
  updatedTs: Type.String(),
  version: Type.Optional(Type.Number()),
  attr: Type.Optional(Type.Any()),
});

const CreateWikiSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  slug: Type.String({ minLength: 1 }),
  code: Type.Optional(Type.String()),
  descr: Type.Optional(Type.String()),
  summary: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Array(Type.String())),
  content: Type.Optional(Type.Any()),
  contentMarkdown: Type.Optional(Type.String()),
  contentHtml: Type.Optional(Type.String()),
  wikiType: Type.Optional(Type.String()),
  category: Type.Optional(Type.String()),
  publicationStatus: Type.Optional(Type.String()),
  visibility: Type.Optional(Type.String()),
  attr: Type.Optional(Type.Any()),
});

const UpdateWikiSchema = Type.Partial(CreateWikiSchema);

export async function wikiRoutes(fastify: FastifyInstance) {
  // List
  fastify.get('/api/v1/wiki', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        search: Type.Optional(Type.String()),
        tag: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(WikiSchema),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number(),
        })
      }
    }
  }, async (request, reply) => {
    const { search, tag, limit = 50, offset = 0 } = request.query as any;
    
    try {
      const conditions = [];
      
      if (search) {
        conditions.push(sql`(name ILIKE '%' || ${search} || '%' OR slug ILIKE '%' || ${search} || '%')`);
      }
      if (tag) {
        conditions.push(sql`${tag} = ANY(tags)`);
      }

      // Always filter for active records in count too
      const countBaseCondition = sql`active_flag = true`;
      const countAllConditions = conditions.length > 0
        ? sql`WHERE ${countBaseCondition} AND ${sql.join(conditions, sql` AND `)}`
        : sql`WHERE ${countBaseCondition}`;

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total FROM app.d_wiki
        ${countAllConditions}
      `);
      const total = Number(countResult[0]?.total || 0);

      // Always filter for active records
      const baseCondition = sql`active_flag = true`;
      const allConditions = conditions.length > 0
        ? sql`WHERE ${baseCondition} AND ${sql.join(conditions, sql` AND `)}`
        : sql`WHERE ${baseCondition}`;

      const rows = await db.execute(sql`
        SELECT
          id,
          name,
          code,
          slug,
          descr,
          tags,
          metadata,
          wiki_type,
          category,
          publication_status,
          visibility,
          keywords,
          summary,
          active_flag,
          created_ts,
          updated_ts,
          version,
          metadata as attr
        FROM app.d_wiki
        ${allConditions}
        ORDER BY updated_ts DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return { data: rows, total, limit, offset };
    } catch (e) {
      fastify.log.error('Error listing wiki: ' + String(e));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get
  fastify.get('/api/v1/wiki/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: { 200: WikiSchema }
    }
  }, async (request, reply) => {
    const { id } = request.params as any;
    
    try {
      const result = await db.execute(sql`
        SELECT
          w.id,
          w.name,
          w.code,
          w.slug,
          w.descr,
          w.tags,
          w.metadata,
          w.wiki_type,
          w.category,
          w.page_path,
          w.parent_wiki_id,
          w.sort_order,
          w.publication_status,
          w.published_at,
          w.published_by_empid,
          w.visibility,
          w.read_access_groups,
          w.edit_access_groups,
          w.keywords,
          w.summary,
          w.primary_entity_type,
          w.primary_entity_id,
          w.from_ts,
          w.to_ts,
          w.active_flag,
          w.created_ts,
          w.updated_ts,
          w.version,
          w.metadata as attr,
          wd.content_markdown,
          wd.content_html,
          wd.content_metadata,
          wd.word_count,
          wd.reading_time_minutes,
          wd.internal_links,
          wd.external_links,
          wd.attached_artifacts
        FROM app.d_wiki w
        LEFT JOIN LATERAL (
          SELECT * FROM app.d_wiki_data
          WHERE wiki_id = w.id AND stage = 'saved'
          ORDER BY updated_ts DESC
          LIMIT 1
        ) wd ON true
        WHERE w.id = ${id} AND w.active_flag = true
      `);
      if (!result.length) return reply.status(404).send({ error: 'Not found' });
      return result[0];
    } catch (e) {
      fastify.log.error('Error get wiki: ' + String(e));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create
  fastify.post('/api/v1/wiki', {
    preHandler: [fastify.authenticate],
    schema: { body: CreateWikiSchema, response: { 201: WikiSchema } }
  }, async (request, reply) => {
    const data = request.body as any;
    const userId = (request as any).user?.sub || '8260b1b0-5efc-4611-ad33-ee76c0cf7f13';

    try {
      // Generate code if not provided
      const code = data.code || `WIKI-${Date.now().toString(36).toUpperCase()}`;

      // Insert into d_wiki (head table)
      const wikiResult = await db.execute(sql`
        INSERT INTO app.d_wiki (
          slug, code, name, descr, tags, metadata, wiki_type, category,
          publication_status, visibility, summary, active_flag, version
        ) VALUES (
          ${data.slug},
          ${code},
          ${data.name},
          ${data.descr || null},
          ${JSON.stringify(data.tags || [])}::jsonb,
          ${JSON.stringify(data.attr || {})}::jsonb,
          ${data.wikiType || 'page'},
          ${data.category || null},
          ${data.publicationStatus || 'draft'},
          ${data.visibility || 'internal'},
          ${data.summary || null},
          true,
          1
        )
        RETURNING id, slug, code, name, descr, tags, metadata as attr, wiki_type as "wikiType",
                  category, publication_status as "publicationStatus", visibility, summary,
                  active_flag as active, from_ts as "fromTs", to_ts as "toTs",
                  created_ts as "createdTs", updated_ts as "updatedTs", version
      `);

      const wiki = wikiResult[0];

      // Insert into d_wiki_data (content table) if content provided
      if (data.contentMarkdown || data.contentHtml) {
        await db.execute(sql`
          INSERT INTO app.d_wiki_data (
            wiki_id, content_markdown, content_html, stage, updated_by_empid, update_type
          ) VALUES (
            ${wiki.id},
            ${data.contentMarkdown || null},
            ${data.contentHtml || null},
            'saved',
            ${userId},
            'content_edit'
          )
        `);
      }

      return reply.status(201).send({ ...wiki, content: data.content });
    } catch (e) {
      fastify.log.error('Error create wiki: ' + String(e));
      return reply.status(500).send({ error: 'Internal server error', details: String(e) });
    }
  });

  // Update
  fastify.put('/api/v1/wiki/:id', {
    preHandler: [fastify.authenticate],
    schema: { params: Type.Object({ id: Type.String({ format: 'uuid' }) }), body: UpdateWikiSchema, response: { 200: WikiSchema } }
  }, async (request, reply) => {
    const { id } = request.params as any;
    const data = request.body as any;
    const userId = (request as any).user?.sub || '8260b1b0-5efc-4611-ad33-ee76c0cf7f13';

    try {
      // Update d_wiki (head table)
      const updateFields: string[] = [];
      const values: any[] = [];

      if (data.name !== undefined) {
        updateFields.push(`name = $${values.length + 1}`);
        values.push(data.name);
      }
      if (data.slug !== undefined) {
        updateFields.push(`slug = $${values.length + 1}`);
        values.push(data.slug);
      }
      if (data.descr !== undefined) {
        updateFields.push(`descr = $${values.length + 1}`);
        values.push(data.descr);
      }
      if (data.summary !== undefined) {
        updateFields.push(`summary = $${values.length + 1}`);
        values.push(data.summary);
      }
      if (data.tags !== undefined) {
        updateFields.push(`tags = $${values.length + 1}::jsonb`);
        values.push(JSON.stringify(data.tags));
      }
      if (data.attr !== undefined) {
        updateFields.push(`metadata = $${values.length + 1}::jsonb`);
        values.push(JSON.stringify(data.attr));
      }
      if (data.wikiType !== undefined) {
        updateFields.push(`wiki_type = $${values.length + 1}`);
        values.push(data.wikiType);
      }
      if (data.category !== undefined) {
        updateFields.push(`category = $${values.length + 1}`);
        values.push(data.category);
      }
      if (data.publicationStatus !== undefined) {
        updateFields.push(`publication_status = $${values.length + 1}`);
        values.push(data.publicationStatus);
      }
      if (data.visibility !== undefined) {
        updateFields.push(`visibility = $${values.length + 1}`);
        values.push(data.visibility);
      }

      updateFields.push(`updated_ts = NOW()`);

      const updated = await db.execute(sql.raw(`
        UPDATE app.d_wiki SET ${updateFields.join(', ')}
        WHERE id = '${id}' AND active_flag = true
        RETURNING id, slug, code, name, descr, tags, metadata as attr, wiki_type as "wikiType",
                  category, publication_status as "publicationStatus", visibility, summary,
                  active_flag as active, from_ts as "fromTs", to_ts as "toTs",
                  created_ts as "createdTs", updated_ts as "updatedTs", version
      `));

      if (!updated.length) return reply.status(404).send({ error: 'Not found' });

      // Update or insert content in d_wiki_data if provided
      if (data.contentMarkdown !== undefined || data.contentHtml !== undefined) {
        await db.execute(sql`
          INSERT INTO app.d_wiki_data (
            wiki_id, content_markdown, content_html, stage, updated_by_empid, update_type
          ) VALUES (
            ${id},
            ${data.contentMarkdown || null},
            ${data.contentHtml || null},
            'saved',
            ${userId},
            'content_edit'
          )
        `);
      }

      return { ...updated[0], content: data.content };
    } catch (e) {
      fastify.log.error('Error update wiki: ' + String(e));
      return reply.status(500).send({ error: 'Internal server error', details: String(e) });
    }
  });

  // Delete (soft)
  fastify.delete('/api/v1/wiki/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as any;

    try {
      const deleted = await db.execute(sql`
        UPDATE app.d_wiki SET active_flag = false, to_ts = NOW(), updated_ts = NOW()
        WHERE id = ${id} AND active_flag = true
        RETURNING id
      `);
      if (!deleted.length) return reply.status(404).send({ error: 'Not found' });
      return reply.status(200).send({ message: 'Wiki deleted successfully' });
    } catch (e) {
      fastify.log.error('Error delete wiki: ' + String(e));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}

