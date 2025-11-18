import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql, SQL } from 'drizzle-orm';
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';
// ✅ Centralized unified data gate - loosely coupled API
// ✨ Universal auto-filter builder - zero-config query filtering
import { buildAutoFilters } from '../../lib/universal-filter-builder.js';
// ✅ Entity Infrastructure Service - Centralized infrastructure management
import { getEntityInfrastructure } from '../../services/entity-infrastructure.service.js';

const WikiSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  code: Type.String(),
  descr: Type.Optional(Type.String()),
  internal_url: Type.Optional(Type.String()),
  shared_url: Type.Optional(Type.String()),
  summary: Type.Optional(Type.String()),
  content: Type.Optional(Type.Any()),
  content_markdown: Type.Optional(Type.String()),
  content_html: Type.Optional(Type.String()),
  wiki_type: Type.Optional(Type.String()),
  category: Type.Optional(Type.String()),
  page_path: Type.Optional(Type.String()),
  parent_wiki_id: Type.Optional(Type.String()),
  sort_order: Type.Optional(Type.Number()),
  publication_status: Type.Optional(Type.String()),
  published_ts: Type.Optional(Type.String()),
  published_by_employee_id: Type.Optional(Type.String()),
  visibility: Type.Optional(Type.String()),
  read_access_groups: Type.Optional(Type.Array(Type.String())),
  edit_access_groups: Type.Optional(Type.Array(Type.String())),
  keywords: Type.Optional(Type.Array(Type.String())),
  primary_entity_type: Type.Optional(Type.String()),
  primary_entity_id: Type.Optional(Type.String()),
  active_flag: Type.Boolean(),
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.String()),
  created_ts: Type.String(),
  updated_ts: Type.String(),
  version: Type.Optional(Type.Number()),
  metadata: Type.Optional(Type.Any()),
});

const CreateWikiSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1 })),
  code: Type.Optional(Type.String()),
  descr: Type.Optional(Type.String()),
  summary: Type.Optional(Type.String()),
  content: Type.Optional(Type.Any()),
  content_markdown: Type.Optional(Type.String()),
  content_html: Type.Optional(Type.String()),
  wiki_type: Type.Optional(Type.String()),
  category: Type.Optional(Type.String()),
  page_path: Type.Optional(Type.String()),
  parent_wiki_id: Type.Optional(Type.String()),
  sort_order: Type.Optional(Type.Number()),
  publication_status: Type.Optional(Type.String()),
  published_ts: Type.Optional(Type.String()),
  published_by_employee_id: Type.Optional(Type.String()),
  visibility: Type.Optional(Type.String()),
  read_access_groups: Type.Optional(Type.Array(Type.String())),
  edit_access_groups: Type.Optional(Type.Array(Type.String())),
  keywords: Type.Optional(Type.Array(Type.String())),
  primary_entity_type: Type.Optional(Type.String()),
  primary_entity_id: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Union([Type.Object({}), Type.String(), Type.Any()])),
});

const UpdateWikiSchema = Type.Partial(CreateWikiSchema);

// ============================================================================
// Module-level constants (DRY - used across all endpoints)
// ============================================================================
const ENTITY_CODE = 'wiki';
const TABLE_ALIAS = 'w';

export async function wikiRoutes(fastify: FastifyInstance) {
  // ═══════════════════════════════════════════════════════════════
  // ✅ ENTITY INFRASTRUCTURE SERVICE - Initialize service instance
  // ═══════════════════════════════════════════════════════════════
  const entityInfra = getEntityInfrastructure(db);

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
      // ═══════════════════════════════════════════════════════════════
      // NEW PATTERN: Route builds SQL, gates augment it
      // ═══════════════════════════════════════════════════════════════

      // Build WHERE conditions array
      const conditions: SQL[] = [];

      // GATE 1: RBAC - Apply security filtering (REQUIRED)
      const rbacWhereClause = await entityInfra.get_entity_rbac_where_condition(userId, ENTITY_CODE, Permission.VIEW, TABLE_ALIAS
      );
      conditions.push(sql.raw(rbacWhereClause));

      // ✅ DEFAULT FILTER: Only show active records (not soft-deleted)
      // Can be overridden with ?active=false to show inactive records
      if (!('active' in (request.query as any))) {
        conditions.push(sql`${sql.raw(TABLE_ALIAS)}.active_flag = true`);
      }

      // ✨ UNIVERSAL AUTO-FILTER SYSTEM
      // Automatically builds filters from ANY query parameter based on field naming conventions
      // Supports: ?search=keyword, ?active_flag=true, ?wiki_type=X, etc.
      // See: apps/api/src/lib/universal-filter-builder.ts
      const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query as any, {
        searchFields: ['name', 'code', 'descr', 'summary']
      });
      conditions.push(...autoFilters);

      // Custom filter: tag search (requires array operator)
      if (tag) {
        conditions.push(sql`${tag} = ANY(${sql.raw(TABLE_ALIAS)}.keywords)`);
      }

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total FROM app.wiki w
        WHERE ${sql.join(conditions, sql` AND `)}
      `);
      const total = Number(countResult[0]?.total || 0);

      const rows = await db.execute(sql`
        SELECT
          w.id,
          w.name,
          w.code,
          w.descr,
          w.internal_url,
          w.shared_url,
          w.metadata,
          w.wiki_type,
          w.category,
          w.page_path,
          w.parent_wiki_id,
          w.sort_order,
          w.publication_status,
          w.published_ts,
          w.published_by_employee_id,
          w.visibility,
          w.read_access_groups,
          w.edit_access_groups,
          w.keywords,
          w.summary,
          w.primary_entity_type,
          w.primary_entity_id,
          w.active_flag,
          w.from_ts,
          w.to_ts,
          w.created_ts,
          w.updated_ts,
          w.version
        FROM app.wiki w
        WHERE ${sql.join(conditions, sql` AND `)}
        ORDER BY w.updated_ts DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      // Parse JSON fields properly for schema validation
      const parsedRows = rows.map((row: any) => ({
        ...row,
        keywords: Array.isArray(row.keywords) ? row.keywords : [],
        metadata: row.metadata || {}
      }));

      const response: any = { data: parsedRows, total, limit };
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
      response: {
        // Removed schema validation - let Fastify serialize naturally
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    // ═══════════════════════════════════════════════════════════════
    // ✅ CENTRALIZED UNIFIED DATA GATE - RBAC gate check
    // Uses: RBAC_GATE only (checkPermission)
    // ═══════════════════════════════════════════════════════════════
    const canView = await entityInfra.check_entity_rbac(
      userId,
      ENTITY_CODE,
      id,
      Permission.VIEW
    );

    if (!canView) {
      return reply.status(403).send({ error: 'Insufficient permissions to view this wiki' });
    }

    try {
      const result = await db.execute(sql`
        SELECT
          w.id,
          w.name,
          w.code,
          w.descr,
          w.internal_url,
          w.shared_url,
          COALESCE(w.metadata, '{}'::jsonb) as metadata,
          w.content,
          w.wiki_type,
          w.category,
          w.page_path,
          w.parent_wiki_id,
          w.sort_order,
          w.publication_status,
          w.published_ts,
          w.published_by_employee_id,
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
        FROM app.wiki w
        LEFT JOIN LATERAL (
          SELECT * FROM app.wiki_data
          WHERE wiki_id = w.id AND stage = 'saved'
          ORDER BY updated_ts DESC
          LIMIT 1
        ) wd ON true
        WHERE w.id = ${id} AND w.active_flag = true
      `);

      if (!result.length) return reply.status(404).send({ error: 'Not found' });

      const wiki = result[0] as any;

      // Parse JSON fields properly like task module
      const parsedWiki = {
        ...wiki,
        keywords: Array.isArray(wiki.keywords) ? wiki.keywords : [],
        metadata: wiki.metadata || {},
        content: wiki.content || null
      };

      return parsedWiki;
    } catch (e) {
      fastify.log.error('Error get wiki: ' + String(e));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create
  fastify.post('/api/v1/wiki', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateWikiSchema,
      response: {
        // Removed schema validation - let Fastify serialize naturally
        400: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    const data = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    // ═══════════════════════════════════════════════════════════════
    // ✅ CENTRALIZED UNIFIED DATA GATE - RBAC GATE
    // Uses: RBAC_GATE only (checkPermission)
    // Check: Can user CREATE wikis?
    // ═══════════════════════════════════════════════════════════════
    const canCreate = await entityInfra.check_entity_rbac(
      userId, ENTITY_CODE, ALL_ENTITIES_ID, Permission.CREATE
    );

    if (!canCreate) {
      return reply.status(403).send({ error: 'Insufficient permissions to create wikis' });
    }

    // Auto-generate required fields if missing
    if (!data.name) data.name = 'Untitled';
    if (!data.code) data.code = `WIKI-${Date.now().toString(36).toUpperCase()}`;

    try {
      // Use auto-generated code
      const code = data.code;

      // Insert into d_wiki (head table)
      const wikiResult = await db.execute(sql`
        INSERT INTO app.wiki (
          code, name, descr, internal_url, shared_url, metadata,
          wiki_type, category, page_path, parent_wiki_id, sort_order,
          publication_status, published_ts, published_by_employee_id,
          visibility, read_access_groups, edit_access_groups, keywords,
          summary, content, primary_entity_type, primary_entity_id,
          active_flag, version
        ) VALUES (
          ${code},
          ${data.name},
          ${data.descr || null},
          ${data.internal_url || null},
          ${data.shared_url || null},
          ${JSON.stringify(data.metadata || {})}::jsonb,
          ${data.wiki_type || 'page'},
          ${data.category || null},
          ${data.page_path || null},
          ${data.parent_wiki_id || null},
          ${data.sort_order || 0},
          ${data.publication_status || 'draft'},
          ${data.published_ts || null},
          ${data.published_by_employee_id || null},
          ${data.visibility || 'internal'},
          ${data.read_access_groups || sql`'{}'::varchar[]`},
          ${data.edit_access_groups || sql`'{}'::varchar[]`},
          ${data.keywords || sql`'{}'::varchar[]`},
          ${data.summary || null},
          ${data.content ? JSON.stringify(data.content) : null}::jsonb,
          ${data.primary_entity_type || null},
          ${data.primary_entity_id || null},
          true,
          1
        )
        RETURNING id, code, name, descr, internal_url, shared_url, metadata,
                  wiki_type, category, page_path, parent_wiki_id, sort_order,
                  publication_status, published_ts, published_by_employee_id,
                  visibility, read_access_groups, edit_access_groups, keywords,
                  summary, content, primary_entity_type, primary_entity_id,
                  active_flag, from_ts, to_ts, created_ts, updated_ts, version
      `);

      const wiki = wikiResult[0] as any;

      // Register the wiki in entity_instance for global entity operations
      await db.execute(sql`
        INSERT INTO app.entity_instance (entity_type, entity_id, entity_name, entity_code)
        VALUES ('wiki', ${wiki.id}::uuid, ${wiki.name}, ${wiki.code})
        ON CONFLICT (entity_type, entity_id) DO UPDATE
        SET entity_name = EXCLUDED.entity_name,
            entity_code = EXCLUDED.entity_code,
            updated_ts = NOW()
      `);

      // Insert into d_wiki_data (content table) if content provided
      if (data.content_markdown || data.content_html) {
        await db.execute(sql`
          INSERT INTO app.d_wiki_data (
            wiki_id, content_markdown, content_html, stage, updated_by_employee_id, update_type
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
    schema: {
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      body: UpdateWikiSchema,
      response: {
        // Removed schema validation - let Fastify serialize naturally
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as any;
    const data = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    // ═══════════════════════════════════════════════════════════════
    // ✅ CENTRALIZED UNIFIED DATA GATE - RBAC GATE
    // Uses: RBAC_GATE only (checkPermission)
    // Check: Can user EDIT this wiki?
    // ═══════════════════════════════════════════════════════════════
    const canEdit = await entityInfra.check_entity_rbac(
      userId, ENTITY_CODE, id, Permission.EDIT
    );

    if (!canEdit) {
      return reply.status(403).send({ error: 'Insufficient permissions to modify this wiki' });
    }

    try {
      // Check if wiki exists
      const existing = await db.execute(sql`
        SELECT id FROM app.wiki WHERE id = ${id} AND active_flag = true
      `);

      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Wiki not found' });
      }

      // Build update clauses using drizzle-orm sql template
      const updateParts: any[] = [];

      if (data.name !== undefined) {
        updateParts.push(sql`name = ${data.name}`);
      }
      if (data.descr !== undefined) {
        updateParts.push(sql`descr = ${data.descr}`);
      }
      if (data.internal_url !== undefined) {
        updateParts.push(sql`internal_url = ${data.internal_url}`);
      }
      if (data.shared_url !== undefined) {
        updateParts.push(sql`shared_url = ${data.shared_url}`);
      }
      if (data.summary !== undefined) {
        updateParts.push(sql`summary = ${data.summary}`);
      }
      if (data.metadata !== undefined) {
        updateParts.push(sql`metadata = ${JSON.stringify(data.metadata)}::jsonb`);
      }
      if (data.wiki_type !== undefined) {
        updateParts.push(sql`wiki_type = ${data.wiki_type}`);
      }
      if (data.category !== undefined) {
        updateParts.push(sql`category = ${data.category}`);
      }
      if (data.page_path !== undefined) {
        updateParts.push(sql`page_path = ${data.page_path}`);
      }
      if (data.parent_wiki_id !== undefined) {
        updateParts.push(sql`parent_wiki_id = ${data.parent_wiki_id}`);
      }
      if (data.sort_order !== undefined) {
        updateParts.push(sql`sort_order = ${data.sort_order}`);
      }
      if (data.publication_status !== undefined) {
        updateParts.push(sql`publication_status = ${data.publication_status}`);
      }
      if (data.published_ts !== undefined) {
        updateParts.push(sql`published_ts = ${data.published_ts}`);
      }
      if (data.published_by_employee_id !== undefined) {
        updateParts.push(sql`published_by_employee_id = ${data.published_by_employee_id}`);
      }
      if (data.visibility !== undefined) {
        updateParts.push(sql`visibility = ${data.visibility}`);
      }
      if (data.read_access_groups !== undefined) {
        updateParts.push(sql`read_access_groups = ${data.read_access_groups}::varchar[]`);
      }
      if (data.edit_access_groups !== undefined) {
        updateParts.push(sql`edit_access_groups = ${data.edit_access_groups}::varchar[]`);
      }
      if (data.keywords !== undefined) {
        updateParts.push(sql`keywords = ${data.keywords}::varchar[]`);
      }
      if (data.primary_entity_type !== undefined) {
        updateParts.push(sql`primary_entity_type = ${data.primary_entity_type}`);
      }
      if (data.primary_entity_id !== undefined) {
        updateParts.push(sql`primary_entity_id = ${data.primary_entity_id}`);
      }
      if (data.content !== undefined) {
        updateParts.push(sql`content = ${JSON.stringify(data.content)}::jsonb`);
      }

      if (updateParts.length === 0 && !data.content_markdown && !data.content_html) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      // Always update timestamp
      updateParts.push(sql`updated_ts = NOW()`);

      // Execute update with proper parameterization
      const updated = await db.execute(sql`
        UPDATE app.wiki
        SET ${sql.join(updateParts, sql`, `)}
        WHERE id = ${id} AND active_flag = true
        RETURNING id, code, name, descr, metadata, content, wiki_type,
                  category, publication_status, visibility, summary,
                  active_flag, from_ts, to_ts,
                  created_ts, updated_ts, version
      `);

      if (!updated.length) return reply.status(404).send({ error: 'Not found' });

      const updatedWiki = updated[0] as any;

      // Sync with entity_instance registry when name/code changes
      if (data.name !== undefined || data.code !== undefined) {
        await db.execute(sql`
          UPDATE app.entity_instance
          SET entity_name = ${updatedWiki.name},
              entity_code = ${updatedWiki.code},
              updated_ts = NOW()
          WHERE entity_type = 'wiki' AND entity_id = ${id}::uuid
        `);
      }

      // Update or insert content in d_wiki_data if provided
      if (data.content_markdown !== undefined || data.content_html !== undefined) {
        await db.execute(sql`
          INSERT INTO app.d_wiki_data (
            wiki_id, content_markdown, content_html, stage, updated_by_employee_id, update_type
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

      return { ...updatedWiki, content: data.content };
    } catch (e) {
      fastify.log.error('Error update wiki: ' + String(e));
      return reply.status(500).send({ error: 'Internal server error', details: String(e) });
    }
  });

  // Delete wiki with cascading cleanup (soft delete)
  // Uses universal delete factory pattern - deletes from:
  // 1. app.wiki (base entity table)
  // 2. app.entity_instance (entity registry)
  // 3. app.entity_instance_link (linkages in both directions)
  createEntityDeleteEndpoint(fastify, 'wiki');
}

