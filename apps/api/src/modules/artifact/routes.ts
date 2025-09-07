import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

// Artifact schemas aligned with actual app.d_artifact columns
const ArtifactSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Array(Type.String())),
  attr: Type.Optional(Type.Any()),
  artifact_code: Type.Optional(Type.String()),
  artifact_type: Type.String(),
  model_type: Type.Optional(Type.String()),
  version: Type.Optional(Type.String()),
  source_type: Type.String(),
  storage: Type.Optional(Type.String()),
  uri: Type.Optional(Type.String()),
  checksum: Type.Optional(Type.String()),
  file_size_bytes: Type.Optional(Type.Number()),
  mime_type: Type.Optional(Type.String()),
  confidentiality_level: Type.Optional(Type.String()),
  approval_status: Type.Optional(Type.String()),
  language: Type.Optional(Type.String()),
  publication_date: Type.Optional(Type.String()),
  expiry_date: Type.Optional(Type.String()),
  review_date: Type.Optional(Type.String()),
  author_employee_id: Type.Optional(Type.String()),
  owner_employee_id: Type.Optional(Type.String()),
  access_count: Type.Optional(Type.Number()),
  download_count: Type.Optional(Type.Number()),
  last_accessed_ts: Type.Optional(Type.String()),
  active: Type.Boolean(),
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.String()),
  created: Type.String(),
  updated: Type.String(),
});

const CreateArtifactSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Array(Type.String())),
  attr: Type.Optional(Type.Any()),
  artifact_code: Type.Optional(Type.String()),
  artifact_type: Type.String(),
  model_type: Type.Optional(Type.String()),
  version: Type.Optional(Type.String()),
  source_type: Type.Optional(Type.String()),
  storage: Type.Optional(Type.String()),
  uri: Type.Optional(Type.String()),
  checksum: Type.Optional(Type.String()),
  file_size_bytes: Type.Optional(Type.Number()),
  mime_type: Type.Optional(Type.String()),
  confidentiality_level: Type.Optional(Type.String()),
  approval_status: Type.Optional(Type.String()),
  language: Type.Optional(Type.String()),
  publication_date: Type.Optional(Type.String()),
  expiry_date: Type.Optional(Type.String()),
  review_date: Type.Optional(Type.String()),
  author_employee_id: Type.Optional(Type.String()),
});

const UpdateArtifactSchema = Type.Partial(CreateArtifactSchema);

export async function artifactRoutes(fastify: FastifyInstance) {
  // List artifacts
  fastify.get('/api/v1/artifact', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['artifact'],
      summary: 'List artifacts',
      description: 'Returns a paginated list of artifacts',
      querystring: Type.Object({
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
        offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
        artifact_type: Type.Optional(Type.String()),
        active: Type.Optional(Type.Boolean()),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(ArtifactSchema),
          total: Type.Integer(),
          limit: Type.Integer(),
          offset: Type.Integer(),
        }),
      },
    },
  }, async (request, reply) => {
    const { limit = 20, offset = 0, artifact_type, active = true } = request.query as any;

    try {
      // Build WHERE conditions
      const conditions = ['a.active = true'];
      if (artifact_type) conditions.push(`a.artifact_type = '${artifact_type}'`);
      
      const whereClause = conditions.join(' AND ');

      // Get total count
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as count 
        FROM app.d_artifact a 
        WHERE ${sql.raw(whereClause)}
      `);
      const total = Number(countResult[0]?.count || 0);

      // Get paginated results
      const rows = await db.execute(sql`
        SELECT 
          id, name, descr, tags, attr, artifact_code, artifact_type, model_type,
          version, source_type, storage, uri, checksum, file_size_bytes,
          mime_type, confidentiality_level, approval_status, language,
          publication_date, expiry_date, review_date, author_employee_id,
          owner_employee_id, access_count, download_count, last_accessed_ts,
          active, from_ts, to_ts, created, updated
        FROM app.d_artifact a
        WHERE ${sql.raw(whereClause)}
        ORDER BY a.created DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return { data: rows, total, limit, offset };
    } catch (error) {
      fastify.log.error('Error listing artifacts:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get artifact
  fastify.get('/api/v1/artifact/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['artifact'],
      summary: 'Get artifact by ID',
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: { 200: ArtifactSchema },
    },
  }, async (request, reply) => {
    const { id } = request.params as any;
    
    try {
      const result = await db.execute(sql`
        SELECT 
          id, name, descr, tags, attr, artifact_code, artifact_type, model_type,
          version, source_type, storage, uri, checksum, file_size_bytes,
          mime_type, confidentiality_level, approval_status, language,
          publication_date, expiry_date, review_date, author_employee_id,
          owner_employee_id, access_count, download_count, last_accessed_ts,
          active, from_ts, to_ts, created, updated
        FROM app.d_artifact
        WHERE id = ${id} AND active = true
      `);
      
      if (!result.length) return reply.status(404).send({ error: 'Not found' });
      return result[0];
    } catch (error) {
      fastify.log.error('Error getting artifact:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create artifact  
  fastify.post('/api/v1/artifact', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['artifact'],
      summary: 'Create artifact',
      body: CreateArtifactSchema,
      response: { 201: ArtifactSchema },
    },
  }, async (request, reply) => {
    const data = request.body as any;
    const userId = (request as any).user?.sub || 'system';

    try {
      const result = await db.execute(sql`
        INSERT INTO app.d_artifact (
          name, descr, tags, attr, artifact_code, artifact_type, model_type,
          version, source_type, storage, uri, checksum, file_size_bytes,
          mime_type, confidentiality_level, approval_status, language,
          publication_date, expiry_date, review_date, author_employee_id,
          owner_employee_id, active, from_ts
        ) VALUES (
          ${data.name},
          ${data.descr || null},
          ${JSON.stringify(data.tags || [])}::jsonb,
          ${JSON.stringify(data.attr || {})}::jsonb,
          ${data.artifact_code || null},
          ${data.artifact_type},
          ${data.model_type || null},
          ${data.version || null},
          ${data.source_type || 'url'},
          ${data.storage || null},
          ${data.uri || null},
          ${data.checksum || null},
          ${data.file_size_bytes || null},
          ${data.mime_type || null},
          ${data.confidentiality_level || null},
          ${data.approval_status || null},
          ${data.language || null},
          ${data.publication_date || null},
          ${data.expiry_date || null},
          ${data.review_date || null},
          ${data.author_employee_id || userId},
          ${userId},
          true,
          NOW()
        ) RETURNING *
      `);

      return result[0];
    } catch (error) {
      fastify.log.error('Error creating artifact:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update artifact
  fastify.put('/api/v1/artifact/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['artifact'],
      summary: 'Update artifact',
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      body: UpdateArtifactSchema,
      response: { 200: ArtifactSchema },
    },
  }, async (request, reply) => {
    const { id } = request.params as any;
    const data = request.body as any;

    try {
      // Build SET clause dynamically
      const setClauses = [];
      if (data.name !== undefined) setClauses.push(`name = ${sql.placeholder(data.name)}`);
      if (data.descr !== undefined) setClauses.push(`descr = ${sql.placeholder(data.descr)}`);
      if (data.tags !== undefined) setClauses.push(`tags = ${sql.placeholder(JSON.stringify(data.tags))}::jsonb`);
      if (data.attr !== undefined) setClauses.push(`attr = ${sql.placeholder(JSON.stringify(data.attr))}::jsonb`);
      if (data.artifact_code !== undefined) setClauses.push(`artifact_code = ${sql.placeholder(data.artifact_code)}`);
      if (data.artifact_type !== undefined) setClauses.push(`artifact_type = ${sql.placeholder(data.artifact_type)}`);
      if (data.model_type !== undefined) setClauses.push(`model_type = ${sql.placeholder(data.model_type)}`);
      if (data.version !== undefined) setClauses.push(`version = ${sql.placeholder(data.version)}`);
      if (data.source_type !== undefined) setClauses.push(`source_type = ${sql.placeholder(data.source_type)}`);
      if (data.storage !== undefined) setClauses.push(`storage = ${sql.placeholder(data.storage)}`);
      if (data.uri !== undefined) setClauses.push(`uri = ${sql.placeholder(data.uri)}`);
      if (data.checksum !== undefined) setClauses.push(`checksum = ${sql.placeholder(data.checksum)}`);
      if (data.file_size_bytes !== undefined) setClauses.push(`file_size_bytes = ${sql.placeholder(data.file_size_bytes)}`);
      if (data.mime_type !== undefined) setClauses.push(`mime_type = ${sql.placeholder(data.mime_type)}`);
      if (data.confidentiality_level !== undefined) setClauses.push(`confidentiality_level = ${sql.placeholder(data.confidentiality_level)}`);
      if (data.approval_status !== undefined) setClauses.push(`approval_status = ${sql.placeholder(data.approval_status)}`);
      if (data.language !== undefined) setClauses.push(`language = ${sql.placeholder(data.language)}`);
      if (data.publication_date !== undefined) setClauses.push(`publication_date = ${sql.placeholder(data.publication_date)}`);
      if (data.expiry_date !== undefined) setClauses.push(`expiry_date = ${sql.placeholder(data.expiry_date)}`);
      if (data.review_date !== undefined) setClauses.push(`review_date = ${sql.placeholder(data.review_date)}`);
      if (data.author_employee_id !== undefined) setClauses.push(`author_employee_id = ${sql.placeholder(data.author_employee_id)}`);

      if (setClauses.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      setClauses.push('updated = NOW()');
      const setClause = setClauses.join(', ');

      const result = await db.execute(sql`
        UPDATE app.d_artifact 
        SET ${sql.raw(setClause)}
        WHERE id = ${id} AND active = true
        RETURNING *
      `);

      if (!result.length) return reply.status(404).send({ error: 'Not found' });
      return result[0];
    } catch (error) {
      fastify.log.error('Error updating artifact:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete artifact (soft delete)
  fastify.delete('/api/v1/artifact/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['artifact'],
      summary: 'Delete artifact',
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: { 204: Type.Null() },
    },
  }, async (request, reply) => {
    const { id } = request.params as any;

    try {
      const result = await db.execute(sql`
        UPDATE app.d_artifact 
        SET active = false, updated = NOW(), to_ts = NOW()
        WHERE id = ${id} AND active = true
        RETURNING id
      `);

      if (!result.length) return reply.status(404).send({ error: 'Not found' });
      return reply.status(204).send();
    } catch (error) {
      fastify.log.error('Error deleting artifact:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}