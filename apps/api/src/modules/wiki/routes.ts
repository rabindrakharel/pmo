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
  content_markdown: Type.Optional(Type.String()),
  content_html: Type.Optional(Type.String()),
  wiki_type: Type.Optional(Type.String()),
  category: Type.Optional(Type.String()),
  publication_status: Type.Optional(Type.String()),
  visibility: Type.Optional(Type.String()),
  active_flag: Type.Boolean(),
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.String()),
  created_ts: Type.String(),
  updated_ts: Type.String(),
  version: Type.Optional(Type.Number()),
  metadata: Type.Optional(Type.Any()),
});

const CreateWikiSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  slug: Type.String({ minLength: 1 }),
  code: Type.Optional(Type.String()),
  descr: Type.Optional(Type.String()),
  summary: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Array(Type.String())),
  content: Type.Optional(Type.Any()),
  content_markdown: Type.Optional(Type.String()),
  content_html: Type.Optional(Type.String()),
  wiki_type: Type.Optional(Type.String()),
  category: Type.Optional(Type.String()),
  publication_status: Type.Optional(Type.String()),
  visibility: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
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
        page: Type.Optional(Type.Number({ minimum: 1 })),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(WikiSchema),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Optional(Type.Number()),
          page: Type.Optional(Type.Number()),
        })
      }
    }
  }, async (request, reply) => {
    const { search, tag, page, limit = 20, offset: offsetParam } = request.query as any;

    // Calculate offset: use page if provided, otherwise use offset param, default to 0
    const offset = page ? (page - 1) * limit : (offsetParam || 0);

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // RBAC filtering - only show wiki entries user has access to
      const baseConditions = [
        sql`w.active_flag = true`,
        sql`(
          EXISTS (
            SELECT 1 FROM app.entity_id_rbac_map rbac
            WHERE rbac.empid = ${userId}
              AND rbac.entity = 'wiki'
              AND (rbac.entity_id = w.id::text OR rbac.entity_id = 'all')
              AND rbac.active_flag = true
              AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
              AND 0 = ANY(rbac.permission)
          )
        )`
      ];

      const conditions = [...baseConditions];

      if (search) {
        conditions.push(sql`(w.name ILIKE ${`%${search}%`} OR w.slug ILIKE ${`%${search}%`})`);
      }
      if (tag) {
        conditions.push(sql`${tag} = ANY(w.tags)`);
      }

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total FROM app.d_wiki w
        WHERE ${sql.join(conditions, sql` AND `)}
      `);
      const total = Number(countResult[0]?.total || 0);

      const rows = await db.execute(sql`
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
          w.publication_status,
          w.visibility,
          w.keywords,
          w.summary,
          w.active_flag,
          w.from_ts,
          w.to_ts,
          w.created_ts,
          w.updated_ts,
          w.version
        FROM app.d_wiki w
        WHERE ${sql.join(conditions, sql` AND `)}
        ORDER BY w.updated_ts DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const response: any = { data: rows, total, limit };
      if (page) {
        response.page = page;
      } else {
        response.offset = offset;
      }

      return response;
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
          ${JSON.stringify(data.metadata || {})}::jsonb,
          ${data.wiki_type || 'page'},
          ${data.category || null},
          ${data.publication_status || 'draft'},
          ${data.visibility || 'internal'},
          ${data.summary || null},
          true,
          1
        )
        RETURNING id, slug, code, name, descr, tags, metadata, wiki_type,
                  category, publication_status, visibility, summary,
                  active_flag, from_ts, to_ts,
                  created_ts, updated_ts, version
      `);

      const wiki = wikiResult[0];

      // Insert into d_wiki_data (content table) if content provided
      if (data.content_markdown || data.content_html) {
        await db.execute(sql`
          INSERT INTO app.d_wiki_data (
            wiki_id, content_markdown, content_html, stage, updated_by_empid, update_type
          ) VALUES (
            ${wiki.id},
            ${data.content_markdown || null},
            ${data.content_html || null},
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
      if (data.metadata !== undefined) {
        updateFields.push(`metadata = $${values.length + 1}::jsonb`);
        values.push(JSON.stringify(data.metadata));
      }
      if (data.wiki_type !== undefined) {
        updateFields.push(`wiki_type = $${values.length + 1}`);
        values.push(data.wiki_type);
      }
      if (data.category !== undefined) {
        updateFields.push(`category = $${values.length + 1}`);
        values.push(data.category);
      }
      if (data.publication_status !== undefined) {
        updateFields.push(`publication_status = $${values.length + 1}`);
        values.push(data.publication_status);
      }
      if (data.visibility !== undefined) {
        updateFields.push(`visibility = $${values.length + 1}`);
        values.push(data.visibility);
      }

      updateFields.push(`updated_ts = NOW()`);

      const updated = await db.execute(sql.raw(`
        UPDATE app.d_wiki SET ${updateFields.join(', ')}
        WHERE id = '${id}' AND active_flag = true
        RETURNING id, slug, code, name, descr, tags, metadata, wiki_type,
                  category, publication_status, visibility, summary,
                  active_flag, from_ts, to_ts,
                  created_ts, updated_ts, version
      `));

      if (!updated.length) return reply.status(404).send({ error: 'Not found' });

      // Update or insert content in d_wiki_data if provided
      if (data.content_markdown !== undefined || data.content_html !== undefined) {
        await db.execute(sql`
          INSERT INTO app.d_wiki_data (
            wiki_id, content_markdown, content_html, stage, updated_by_empid, update_type
          ) VALUES (
            ${id},
            ${data.content_markdown || null},
            ${data.content_html || null},
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

