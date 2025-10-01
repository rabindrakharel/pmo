import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

const WikiSchema = Type.Object({
  id: Type.String(),
  title: Type.String(),
  slug: Type.String(),
  summary: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Array(Type.String())),
  content: Type.Optional(Type.Any()),
  contentHtml: Type.Optional(Type.String()),
  ownerId: Type.Optional(Type.String()),
  ownerName: Type.Optional(Type.String()),
  published: Type.Optional(Type.Boolean()),
  shareLink: Type.Optional(Type.String()),
  version: Type.Optional(Type.Number()),
  active: Type.Boolean(),
  fromTs: Type.String(),
  toTs: Type.Optional(Type.String()),
  created: Type.String(),
  updated: Type.String(),
  attr: Type.Optional(Type.Any()),
});

const CreateWikiSchema = Type.Object({
  title: Type.String({ minLength: 1 }),
  slug: Type.String({ minLength: 1 }),
  summary: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Array(Type.String())),
  content: Type.Optional(Type.Any()),
  contentHtml: Type.Optional(Type.String()),
  published: Type.Optional(Type.Boolean()),
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
        conditions.push(sql`(title ILIKE '%' || ${search} || '%' OR slug ILIKE '%' || ${search} || '%')`);
      }
      if (tag) {
        conditions.push(sql`${tag} = ANY(tags)`);
      }

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total FROM app.d_wiki
        ${conditions.length ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      const rows = await db.execute(sql`
        SELECT 
          id,
          title,
          slug,
          summary,
          tags,
          owner_id as "ownerId",
          owner_name as "ownerName",
          published,
          share_link as "shareLink",
          version,
          active,
          from_ts as "fromTs",
          to_ts as "toTs",
          created,
          updated
        FROM app.d_wiki
        ${conditions.length ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY updated DESC
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
          id,
          title,
          slug,
          summary,
          tags,
          content,
          content_html as "contentHtml",
          owner_id as "ownerId",
          owner_name as "ownerName",
          published,
          share_link as "shareLink",
          version,
          active,
          from_ts as "fromTs",
          to_ts as "toTs",
          created,
          updated,
          attr
        FROM app.d_wiki WHERE id = ${id} AND active_flag = true
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
    schema: { body: CreateWikiSchema, response: { 201: WikiSchema } }
  }, async (request, reply) => {
    const data = request.body as any;
    const userId = '1e58f150-52ed-4963-b137-c1feee3ce8aa'; // Default user
    const user = { name: 'James Miller' };
    try {
      const fromTs = new Date().toISOString();
      const created = await db.execute(sql`
        INSERT INTO app.d_wiki (
          title, slug, summary, tags, content, content_html, owner_id, owner_name, published, share_link, version, active, from_ts, attr
        ) VALUES (
          ${data.title}, ${data.slug}, ${data.summary || null}, ${JSON.stringify(data.tags || [])}, ${JSON.stringify(data.content || {})},
          ${data.contentHtml || null}, ${userId}, ${user?.name || null}, ${data.published === true},
          encode(gen_random_bytes(8), 'hex'), 1, true, ${fromTs}, ${JSON.stringify(data.attr || {})}
        )
        RETURNING id, title, slug, summary, tags, owner_id as "ownerId", owner_name as "ownerName", published, share_link as "shareLink", version, active, from_ts as "fromTs", to_ts as "toTs", created, updated
      `);
      return reply.status(201).send(created[0]);
    } catch (e) {
      fastify.log.error('Error create wiki: ' + String(e));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update
  fastify.put('/api/v1/wiki/:id', {
    preHandler: [fastify.authenticate],
    schema: { params: Type.Object({ id: Type.String({ format: 'uuid' }) }), body: UpdateWikiSchema, response: { 200: WikiSchema } }
  }, async (request, reply) => {
    const { id } = request.params as any;
    const data = request.body as any;
    
    try {
      const updated = await db.execute(sql`
        UPDATE app.d_wiki SET
          title = COALESCE(${data.title}, title),
          slug = COALESCE(${data.slug}, slug),
          summary = COALESCE(${data.summary}, summary),
          tags = COALESCE(${JSON.stringify(data.tags ?? null)}, tags),
          content = COALESCE(${JSON.stringify(data.content ?? null)}, content),
          content_html = COALESCE(${data.contentHtml ?? null}, content_html),
          published = COALESCE(${data.published}, published),
          attr = COALESCE(${JSON.stringify(data.attr ?? null)}, attr),
          updated = NOW()
        WHERE id = ${id} AND active_flag = true
        RETURNING id, title, slug, summary, tags, owner_id as "ownerId", owner_name as "ownerName", published, share_link as "shareLink", version, active, from_ts as "fromTs", to_ts as "toTs", created, updated
      `);
      if (!updated.length) return reply.status(404).send({ error: 'Not found' });
      return updated[0];
    } catch (e) {
      fastify.log.error('Error update wiki: ' + String(e));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete (soft)
  fastify.delete('/api/v1/wiki/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as any;
    
    try {
      const deleted = await db.execute(sql`
        UPDATE app.d_wiki SET active_flag = false, to_ts = NOW(), updated = NOW() WHERE id = ${id} AND active_flag = true
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

