import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { s3AttachmentService } from '@/lib/s3-attachments.js';
import { config } from '@/lib/config.js';

// Artifact schemas aligned with actual app.d_artifact columns
const ArtifactSchema = Type.Object({
  id: Type.String(),
  slug: Type.String(),
  code: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  internal_url: Type.Optional(Type.String()),
  shared_url: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Any()),
  metadata: Type.Optional(Type.Any()),
  artifact_type: Type.Optional(Type.String()),
  file_format: Type.Optional(Type.String()),
  file_size_bytes: Type.Optional(Type.Number()),
  entity_type: Type.Optional(Type.String()),
  entity_id: Type.Optional(Type.String()),
  bucket_name: Type.Optional(Type.String()),
  object_key: Type.Optional(Type.String()),
  visibility: Type.Optional(Type.String()),
  security_classification: Type.Optional(Type.String()),
  parent_artifact_id: Type.Optional(Type.String()),
  is_latest_version: Type.Optional(Type.Boolean()),
  active_flag: Type.Boolean(),
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.String()),
  created_ts: Type.String(),
  updated_ts: Type.String(),
  version: Type.Optional(Type.Number()),
});

const CreateArtifactSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1 })),
  descr: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Union([Type.Array(Type.String()), Type.String(), Type.Any()])),
  attr: Type.Optional(Type.Union([Type.Object({}), Type.String(), Type.Any()])),
  artifact_code: Type.Optional(Type.String()),
  artifact_type: Type.Optional(Type.String()),
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
    const { limit = 20, offset = 0, artifact_type, active_flag = true } = request.query as any;

    try {
      // Build WHERE conditions
      const conditions = ['a.active_flag = true'];
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
        WHERE id = ${id} AND active_flag = true
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
      response: {
        // Removed schema validation - let Fastify serialize naturally
        400: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      },
    },
  }, async (request, reply) => {
    const data = request.body as any;
    const userId = (request as any).user?.sub || 'system';

    // Auto-generate required fields if missing
    if (!data.name) data.name = 'Untitled';
    if (!data.artifact_type) data.artifact_type = 'document'; // Default to document type

    // Auto-generate slug and code (required NOT NULL fields)
    const slug = data.slug || `artifact-${Date.now()}`;
    const code = data.code || `ART-${Date.now()}`;

    try {
      const result = await db.execute(sql`
        INSERT INTO app.d_artifact (
          slug, code, name, descr, tags, metadata, artifact_type,
          file_format, file_size_bytes,
          entity_type, entity_id,
          visibility, security_classification,
          parent_artifact_id, is_latest_version,
          active_flag
        ) VALUES (
          ${slug},
          ${code},
          ${data.name},
          ${data.descr || null},
          ${JSON.stringify(data.tags || [])}::jsonb,
          ${JSON.stringify(data.attr || data.metadata || {})}::jsonb,
          ${data.artifact_type},
          ${data.file_format || null},
          ${data.file_size_bytes || null},
          ${data.entity_type || data.primary_entity_type || null},
          ${data.entity_id || data.primary_entity_id || null},
          ${data.visibility || 'internal'},
          ${data.security_classification || 'general'},
          ${data.parent_artifact_id || null},
          ${data.is_latest_version !== false},
          ${data.active_flag !== false && data.active !== false}
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
        WHERE id = ${id} AND active_flag = true
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
        SET active_flag = false, updated = NOW(), to_ts = NOW()
        WHERE id = ${id} AND active_flag = true
        RETURNING id
      `);

      if (!result.length) return reply.status(404).send({ error: 'Not found' });
      return reply.status(204).send();
    } catch (error) {
      fastify.log.error('Error deleting artifact:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Upload artifact file (generates presigned URL and saves metadata)
  fastify.post('/api/v1/artifact/upload', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['artifact'],
      summary: 'Upload artifact file',
      description: 'Generate presigned upload URL and create artifact metadata record',
      body: Type.Object({
        name: Type.String({ minLength: 1, description: 'Artifact name' }),
        descr: Type.Optional(Type.String({ description: 'Description' })),
        entityType: Type.String({ description: 'Entity type (e.g., "project", "task")' }),
        entityId: Type.String({ format: 'uuid', description: 'Entity UUID' }),
        fileName: Type.String({ description: 'File name with extension' }),
        contentType: Type.Optional(Type.String({ description: 'MIME type' })),
        fileSize: Type.Optional(Type.Number({ description: 'File size in bytes' })),
        tags: Type.Optional(Type.Array(Type.String())),
        visibility: Type.Optional(Type.String({ enum: ['public', 'internal', 'restricted', 'private'] })),
        securityClassification: Type.Optional(Type.String({ enum: ['general', 'confidential', 'restricted'] })),
      }),
      response: {
        200: Type.Object({
          artifact: ArtifactSchema,
          uploadUrl: Type.String({ description: 'Presigned URL for file upload' }),
          expiresIn: Type.Number({ description: 'URL expiration time in seconds' }),
        }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.sub || 'system';
    const data = request.body as any;

    try {
      // Generate presigned upload URL
      const uploadResult = await s3AttachmentService.generatePresignedUploadUrl({
        tenantId: 'demo',
        entityType: data.entityType,
        entityId: data.entityId,
        fileName: data.fileName,
        contentType: data.contentType,
      });

      // Extract file extension from filename
      const fileExtension = data.fileName.split('.').pop() || '';

      // Generate unique slug and code
      const slug = `${data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
      const code = `ART-${Date.now()}`;

      // Create artifact metadata record
      const result = await db.execute(sql`
        INSERT INTO app.d_artifact (
          slug, code, name, descr, tags, metadata,
          artifact_type, file_format, file_size_bytes,
          entity_type, entity_id,
          bucket_name, object_key,
          visibility, security_classification,
          is_latest_version, active_flag
        ) VALUES (
          ${slug},
          ${code},
          ${data.name},
          ${data.descr || null},
          ${JSON.stringify(data.tags || [])}::jsonb,
          ${JSON.stringify({ uploadedBy: userId, uploadedAt: new Date().toISOString() })}::jsonb,
          ${data.contentType?.startsWith('image/') ? 'image' : data.contentType?.startsWith('video/') ? 'video' : 'document'},
          ${fileExtension},
          ${data.fileSize || null},
          ${data.entityType},
          ${data.entityId},
          ${config.S3_ATTACHMENTS_BUCKET},
          ${uploadResult.objectKey},
          ${data.visibility || 'internal'},
          ${data.securityClassification || 'general'},
          true,
          true
        ) RETURNING *
      `);

      fastify.log.info(`Artifact created: ${result[0].id}, S3 key: ${uploadResult.objectKey}`);

      return {
        artifact: result[0],
        uploadUrl: uploadResult.url,
        expiresIn: uploadResult.expiresIn,
      };
    } catch (error) {
      fastify.log.error({ error }, 'Error creating artifact upload');
      return reply.status(500).send({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Download artifact file (generates presigned download URL)
  fastify.get('/api/v1/artifact/:id/download', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['artifact'],
      summary: 'Download artifact file',
      description: 'Generate presigned download URL for artifact file',
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          url: Type.String({ description: 'Presigned download URL' }),
          objectKey: Type.String({ description: 'S3 object key' }),
          fileName: Type.String({ description: 'Original file name' }),
          fileSize: Type.Optional(Type.Number({ description: 'File size in bytes' })),
          expiresIn: Type.Number({ description: 'URL expiration time in seconds' }),
        }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as any;

    try {
      // Get artifact metadata
      const result = await db.execute(sql`
        SELECT
          id, name, file_format, file_size_bytes, object_key, bucket_name
        FROM app.d_artifact
        WHERE id = ${id} AND active_flag = true
      `);

      if (!result.length) {
        return reply.status(404).send({ error: 'Artifact not found' });
      }

      const artifact = result[0];

      if (!artifact.object_key) {
        return reply.status(400).send({ error: 'Artifact has no associated file' });
      }

      // Generate presigned download URL
      const downloadResult = await s3AttachmentService.generatePresignedDownloadUrl(
        artifact.object_key as string
      );

      // Update download count (temporarily disabled - TODO: fix jsonb_set issue)
      // await db.execute(sql`
      //   UPDATE app.d_artifact
      //   SET metadata = jsonb_set(
      //     COALESCE(metadata, '{}'::jsonb),
      //     '{downloadCount}',
      //     to_jsonb(COALESCE((metadata->>'downloadCount')::int, 0) + 1)
      //   ),
      //   updated_ts = NOW()
      //   WHERE id = ${id}
      // `);

      fastify.log.info(`Download URL generated for artifact: ${id}`);

      return {
        url: downloadResult.url,
        objectKey: downloadResult.objectKey,
        fileName: `${artifact.name}.${artifact.file_format || 'bin'}`,
        fileSize: artifact.file_size_bytes,
        expiresIn: downloadResult.expiresIn,
      };
    } catch (error) {
      fastify.log.error({ error }, 'Error generating download URL');
      return reply.status(500).send({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // List artifacts by entity
  fastify.get('/api/v1/artifact/entity/:entityType/:entityId', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['artifact'],
      summary: 'List artifacts by entity',
      description: 'Get all artifacts linked to a specific entity',
      params: Type.Object({
        entityType: Type.String({ description: 'Entity type (e.g., "project", "task")' }),
        entityId: Type.String({ format: 'uuid', description: 'Entity UUID' }),
      }),
      querystring: Type.Object({
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 50 })),
        offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(ArtifactSchema),
          total: Type.Integer(),
        }),
      },
    },
  }, async (request, reply) => {
    const { entityType, entityId } = request.params as any;
    const { limit = 50, offset = 0 } = request.query as any;

    try {
      // Get total count
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM app.d_artifact
        WHERE entity_type = ${entityType}
          AND entity_id = ${entityId}
          AND active_flag = true
      `);
      const total = Number(countResult[0]?.count || 0);

      // Get artifacts
      const rows = await db.execute(sql`
        SELECT *
        FROM app.d_artifact
        WHERE entity_type = ${entityType}
          AND entity_id = ${entityId}
          AND active_flag = true
        ORDER BY created_ts DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return { data: rows, total };
    } catch (error) {
      fastify.log.error('Error listing artifacts by entity:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create new version of artifact (upload new file) - SCD Type 2
  fastify.post('/api/v1/artifact/:id/new-version', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['artifact'],
      summary: 'Upload new version of artifact',
      description: 'Creates a new version of an existing artifact with SCD Type 2 pattern',
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      body: Type.Object({
        fileName: Type.String(),
        contentType: Type.Optional(Type.String()),
        fileSize: Type.Optional(Type.Number()),
        descr: Type.Optional(Type.String()),
        tags: Type.Optional(Type.Array(Type.String())),
      }),
      response: {
        200: Type.Object({
          oldArtifact: Type.Any(),
          newArtifact: Type.Any(),
          uploadUrl: Type.String(),
          expiresIn: Type.Number(),
        }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.sub || 'system';
    const { id } = request.params as any;
    const data = request.body as any;

    try {
      const currentResult = await db.execute(sql`SELECT * FROM app.d_artifact WHERE id = ${id} AND active_flag = true`);
      if (!currentResult.length) return reply.status(404).send({ error: 'Not found' });

      const current = currentResult[0] as any;
      const rootId = current.parent_artifact_id || current.id;

      const maxV = await db.execute(sql`SELECT COALESCE(MAX(version), 0) as max_version FROM app.d_artifact WHERE (id = ${rootId} OR parent_artifact_id = ${rootId})`);
      const nextVersion = (maxV[0] as any).max_version + 1;

      const uploadResult = await s3AttachmentService.generatePresignedUploadUrl({
        tenantId: 'demo',
        entityType: current.entity_type || 'artifact',
        entityId: id,
        fileName: data.fileName,
        contentType: data.contentType,
      });

      const ext = data.fileName.split('.').pop() || '';
      const timestamp = Date.now();
      const slug = current.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-v' + nextVersion + '-' + timestamp;
      const code = current.code + '-V' + nextVersion;

      await db.execute(sql`UPDATE app.d_artifact SET active_flag = false, is_latest_version = false, to_ts = NOW(), updated_ts = NOW() WHERE id = ${id}`);

      const newResult = await db.execute(sql`
        INSERT INTO app.d_artifact (
          slug, code, name, descr, tags, metadata, artifact_type, file_format, file_size_bytes,
          entity_type, entity_id, bucket_name, object_key, visibility, security_classification,
          parent_artifact_id, is_latest_version, from_ts, to_ts, active_flag, version
        ) VALUES (
          ${slug}, ${code}, ${current.name}, ${data.descr || current.descr},
          ${data.tags ? JSON.stringify(data.tags) : current.tags}::jsonb,
          ${JSON.stringify({ uploadedBy: userId, uploadedAt: new Date().toISOString(), previousVersion: current.id })}::jsonb,
          ${current.artifact_type}, ${ext}, ${data.fileSize || current.file_size_bytes},
          ${current.entity_type}, ${current.entity_id}, ${config.S3_ATTACHMENTS_BUCKET}, ${uploadResult.objectKey},
          ${current.visibility}, ${current.security_classification}, ${rootId}, true, NOW(), NULL, true, ${nextVersion}
        ) RETURNING *
      `);

      return { oldArtifact: current, newArtifact: newResult[0], uploadUrl: uploadResult.url, expiresIn: uploadResult.expiresIn };
    } catch (error) {
      fastify.log.error('Error creating version:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get artifact version history
  fastify.get('/api/v1/artifact/:id/versions', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['artifact'],
      summary: 'Get version history',
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: {
        200: Type.Object({
          data: Type.Array(Type.Any()),
          rootArtifactId: Type.String(),
          currentVersion: Type.Number(),
        }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as any;

    try {
      const result = await db.execute(sql`SELECT id, parent_artifact_id FROM app.d_artifact WHERE id = ${id}`);
      if (!result.length) return reply.status(404).send({ error: 'Not found' });

      const artifact = result[0] as any;
      const rootId = artifact.parent_artifact_id || artifact.id;

      const versions = await db.execute(sql`
        SELECT * FROM app.d_artifact
        WHERE id = ${rootId} OR parent_artifact_id = ${rootId}
        ORDER BY version DESC, created_ts DESC
      `);

      const currentVer = versions.find((v: any) => v.active_flag === true);

      return { data: versions, rootArtifactId: rootId, currentVersion: currentVer?.version || 1 };
    } catch (error) {
      fastify.log.error('Error fetching versions:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}