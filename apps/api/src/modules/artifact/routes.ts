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
    schema: {
      querystring: Type.Object({
        search: Type.Optional(Type.String()),
        artifact_type: Type.Optional(Type.String()),
        business_id: Type.Optional(Type.String({ format: 'uuid' })),
        project_id: Type.Optional(Type.String({ format: 'uuid' })),
        project_stage: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Integer({ minimum: 0 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(ArtifactSchema),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number(),
        }),
      },
    },
  }, async (request, reply) => {
    const { search, artifact_type, business_id, project_id, project_stage, limit = 50, offset = 0 } = request.query as any;
    
    try {
      const conditions = [];
      if (artifact_type) conditions.push(sql`a.artifact_type = ${artifact_type}`);
      if (business_id) conditions.push(sql`a.business_id = ${business_id}`);
      if (project_id) conditions.push(sql`a.project_id = ${project_id}`);
      if (project_stage) conditions.push(sql`a.project_stage = ${project_stage}`);
      if (search) {
        conditions.push(sql`(a.name ILIKE '%' || ${search} || '%' OR COALESCE(a.descr, '') ILIKE '%' || ${search} || '%')`);
      }

      const countResult = await db.execute(sql`
        SELECT COUNT(*) AS total
        FROM app.d_artifact a
        ${conditions.length ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

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
        LEFT JOIN app.d_scope_business b ON a.business_id = b.id
        LEFT JOIN app.ops_project_head p ON a.project_id = p.id
        ${conditions.length ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY a.updated DESC
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
    schema: {
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: { 200: ArtifactSchema },
    },
  }, async (request, reply) => {
    const { id } = request.params as any;
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
        LEFT JOIN app.d_scope_business b ON a.business_id = b.id
        LEFT JOIN app.ops_project_head p ON a.project_id = p.id
        WHERE a.id = ${id} AND a.active = true
      `);
      if (!rows.length) return reply.status(404).send({ error: 'Not found' });
      return rows[0];
    } catch (error) {
      fastify.log.error('Error getting artifact:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create artifact
  fastify.post('/api/v1/artifact', {
    schema: {
      body: CreateArtifactSchema,
      response: { 201: ArtifactSchema },
    },
  }, async (request, reply) => {
    const data = request.body as any;
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
        )
        RETURNING id
      `);
      const id = inserted[0]?.id as string;
      const res = await db.execute(sql`
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
        LEFT JOIN app.d_scope_business b ON a.business_id = b.id
        LEFT JOIN app.ops_project_head p ON a.project_id = p.id
        WHERE a.id = ${id}
      `);
      return reply.status(201).send(res[0]);
    } catch (error) {
      fastify.log.error('Error creating artifact:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update artifact
  fastify.put('/api/v1/artifact/:id', {
    schema: {
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      body: UpdateArtifactSchema,
      response: { 200: ArtifactSchema },
    },
  }, async (request, reply) => {
    const { id } = request.params as any;
    const data = request.body as any;
          name = COALESCE(${data.name}, name),
          "descr" = COALESCE(${data.descr}, "descr"),
          tags = COALESCE(${JSON.stringify(data.tags ?? null)}::jsonb, tags),
          attr = COALESCE(${JSON.stringify(data.attr ?? null)}::jsonb, attr),
          artifact_type = COALESCE(${data.artifact_type}, artifact_type),
          model_type = COALESCE(${data.model_type}, model_type),
          business_id = COALESCE(${data.business_id}, business_id),
          project_id = COALESCE(${data.project_id}, project_id),
          project_stage = COALESCE(${data.project_stage}, project_stage),
          source_type = COALESCE(${data.source_type}, source_type),
          uri = COALESCE(${data.uri}, uri),
          attachments = COALESCE(${JSON.stringify(data.attachments ?? null)}::jsonb, attachments),
          updated = NOW()
        WHERE id = ${id} AND active = true
        RETURNING id
      `);
      if (!updated.length) return reply.status(404).send({ error: 'Not found' });

      const res = await db.execute(sql`
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
        LEFT JOIN app.d_scope_business b ON a.business_id = b.id
        LEFT JOIN app.ops_project_head p ON a.project_id = p.id
        WHERE a.id = ${id}
      `);
      return res[0];
    } catch (error) {
      fastify.log.error('Error updating artifact:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete artifact (soft delete)
  fastify.delete('/api/v1/artifact/:id', {
  }, async (request, reply) => {
    const { id } = request.params as any;
    } catch (error) {
      fastify.log.error('Error deleting artifact:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}

