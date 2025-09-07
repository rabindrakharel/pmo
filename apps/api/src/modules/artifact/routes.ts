import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

// Artifact schemas aligned with app.d_artifact
const ArtifactSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Array(Type.String())),
  attr: Type.Optional(Type.Any()),
  artifact_type: Type.String(),
  model_type: Type.Optional(Type.String()),
  business_id: Type.Optional(Type.String()),
  business_name: Type.Optional(Type.String()),
  project_id: Type.Optional(Type.String()),
  project_name: Type.Optional(Type.String()),
  project_stage: Type.Optional(Type.String()),
  source_type: Type.String(),
  uri: Type.Optional(Type.String()),
  attachments: Type.Optional(Type.Array(Type.Any())),
  owner_emp_id: Type.Optional(Type.String()),
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
  artifact_type: Type.String(),
  model_type: Type.Optional(Type.String()),
  business_id: Type.String({ format: 'uuid' }),
  project_id: Type.Optional(Type.String({ format: 'uuid' })),
  project_stage: Type.Optional(Type.String()),
  source_type: Type.Optional(Type.String()),
  uri: Type.Optional(Type.String()),
  attachments: Type.Optional(Type.Array(Type.Any())),
});

const UpdateArtifactSchema = Type.Partial(CreateArtifactSchema);

export async function artifactRoutes(fastify: FastifyInstance) {
  // List artifacts
  fastify.get('/api/v1/artifact', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['artifact'],
      summary: 'List artifacts',
      description: 'Returns a paginated list of artifacts with business/project context',
      querystring: Type.Object({
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
        offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
        business_id: Type.Optional(Type.String({ format: 'uuid' })),
        project_id: Type.Optional(Type.String({ format: 'uuid' })),
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
    const { limit = 20, offset = 0, business_id, project_id, artifact_type, active = true } = request.query as any;

    try {
      // Build WHERE conditions
      const conditions = ['a.active = true'];
      if (business_id) conditions.push(`a.business_id = '${business_id}'`);
      if (project_id) conditions.push(`a.project_id = '${project_id}'`);
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
          a.id,
          a.name,
          a.descr,
          a.tags,
          a.attr,
          a.artifact_type,
          a.model_type,
          a.business_id,
          b.name AS business_name,
          a.project_id,
          p.name AS project_name,
          a.project_stage,
          a.source_type,
          a.uri,
          a.attachments,
          a.owner_emp_id,
          a.active,
          a.from_ts,
          a.to_ts,
          a.created,
          a.updated
        FROM app.d_artifact a
        LEFT JOIN app.d_biz b ON a.business_id = b.id
        LEFT JOIN app.d_project p ON a.project_id = p.id
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
          a.id,
          a.name,
          a.descr,
          a.tags,
          a.attr,
          a.artifact_type,
          a.model_type,
          a.business_id,
          b.name AS business_name,
          a.project_id,
          p.name AS project_name,
          a.project_stage,
          a.source_type,
          a.uri,
          a.attachments,
          a.owner_emp_id,
          a.active,
          a.from_ts,
          a.to_ts,
          a.created,
          a.updated
        FROM app.d_artifact a
        LEFT JOIN app.d_biz b ON a.business_id = b.id
        LEFT JOIN app.d_project p ON a.project_id = p.id
        WHERE a.id = ${id} AND a.active = true
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
          name, "descr", tags, attr, artifact_type, model_type,
          business_id, project_id, project_stage,
          source_type, uri, attachments, owner_emp_id, active, from_ts
        ) VALUES (
          ${data.name},
          ${data.descr || null},
          ${JSON.stringify(data.tags || [])}::jsonb,
          ${JSON.stringify(data.attr || {})}::jsonb,
          ${data.artifact_type},
          ${data.model_type || null},
          ${data.business_id},
          ${data.project_id || null},
          ${data.project_stage || null},
          ${data.source_type || 'url'},
          ${data.uri || null},
          ${JSON.stringify(data.attachments || [])}::jsonb,
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
      if (data.descr !== undefined) setClauses.push(`"descr" = ${sql.placeholder(data.descr)}`);
      if (data.tags !== undefined) setClauses.push(`tags = ${sql.placeholder(JSON.stringify(data.tags))}::jsonb`);
      if (data.attr !== undefined) setClauses.push(`attr = ${sql.placeholder(JSON.stringify(data.attr))}::jsonb`);
      if (data.artifact_type !== undefined) setClauses.push(`artifact_type = ${sql.placeholder(data.artifact_type)}`);
      if (data.model_type !== undefined) setClauses.push(`model_type = ${sql.placeholder(data.model_type)}`);
      if (data.project_id !== undefined) setClauses.push(`project_id = ${sql.placeholder(data.project_id)}`);
      if (data.project_stage !== undefined) setClauses.push(`project_stage = ${sql.placeholder(data.project_stage)}`);
      if (data.source_type !== undefined) setClauses.push(`source_type = ${sql.placeholder(data.source_type)}`);
      if (data.uri !== undefined) setClauses.push(`uri = ${sql.placeholder(data.uri)}`);
      if (data.attachments !== undefined) setClauses.push(`attachments = ${sql.placeholder(JSON.stringify(data.attachments))}::jsonb`);

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