import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { s3AttachmentService } from '@/lib/s3-attachments.js';
import { config } from '@/lib/config.js';

// Artifact schemas aligned with actual app.d_artifact columns
const ArtifactSchema = Type.Object({
  id: Type.String(),
  code: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
  artifact_type: Type.Optional(Type.String()),
  attachment: Type.Optional(Type.String()),
  attachment_format: Type.Optional(Type.String()),
  attachment_size_bytes: Type.Optional(Type.Number()),
  entity_type: Type.Optional(Type.String()),
  entity_id: Type.Optional(Type.String()),
  attachment_object_bucket: Type.Optional(Type.String()),
  attachment_object_key: Type.Optional(Type.String()),
  visibility: Type.Optional(Type.String()),
  security_classification: Type.Optional(Type.String()),
  is_latest_version: Type.Optional(Type.Boolean()),
  active_flag: Type.Boolean(),
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.String()),
  created_ts: Type.String(),
  updated_ts: Type.String(),
  version: Type.Optional(Type.Number()),
});

const CreateArtifactSchema = Type.Object({
  // Required fields (will be auto-generated if not provided)
  name: Type.String({ minLength: 1 }),
  code: Type.String({ minLength: 1 }),

  // Optional metadata
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Union([Type.Object({}), Type.String(), Type.Any()])),
  attr: Type.Optional(Type.Union([Type.Object({}), Type.String(), Type.Any()])),

  // Classification
  artifact_type: Type.Optional(Type.String()),
  attachment: Type.Optional(Type.String()),
  attachment_format: Type.Optional(Type.String()),
  attachment_size_bytes: Type.Optional(Type.Number()),

  // S3/Storage
  attachment_object_bucket: Type.Optional(Type.String()),
  attachment_attachment_object_key: Type.Optional(Type.String()),

  // Access control
  visibility: Type.Optional(Type.String()), // public, internal, restricted, private
  security_classification: Type.Optional(Type.String()), // general, confidential, restricted

  // Entity relationship
  entity_type: Type.Optional(Type.String()),
  entity_id: Type.Optional(Type.String()),
  primary_entity_type: Type.Optional(Type.String()),
  primary_entity_id: Type.Optional(Type.String()),

  // Versioning
  parent_artifact_id: Type.Optional(Type.String()),
  is_latest_version: Type.Optional(Type.Boolean()),
  version: Type.Optional(Type.Number()),

  // Status
  active_flag: Type.Optional(Type.Boolean()),
  active: Type.Optional(Type.Boolean()),
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
          id, code, name, descr, metadata,
          artifact_type, attachment_format, attachment_size_bytes, attachment, entity_type, entity_id,
          attachment_object_bucket, attachment_object_key, visibility, security_classification,
          is_latest_version, version, active_flag,
          from_ts, to_ts, created_ts, updated_ts
        FROM app.d_artifact a
        WHERE ${sql.raw(whereClause)}
        ORDER BY a.created_ts DESC
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
          id, code, name, descr, metadata,
          artifact_type, attachment, attachment_format, attachment_size_bytes,
          entity_type, entity_id,
          attachment_object_bucket, attachment_object_key,
          visibility, security_classification,
          is_latest_version, version, active_flag,
          from_ts, to_ts, created_ts, updated_ts
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
          code, name, descr, metadata, artifact_type,
          attachment_format, attachment_size_bytes,
          attachment_object_bucket, attachment_object_key,
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
          ${data.attachment_format || null},
          ${data.attachment_size_bytes || null},
          ${data.attachment_object_bucket || null},
          ${data.attachment_object_key || null},
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
      // Build update object with only provided fields
      const updates: any = {};

      // Basic fields
      if (data.name !== undefined) updates.name = data.name;
      if (data.code !== undefined) updates.code = data.code;
      if (data.slug !== undefined) updates.slug = data.slug;
      if (data.descr !== undefined) updates.descr = data.descr;

      // JSONB fields
      if (data.tags !== undefined) updates.tags = data.tags;
      if (data.metadata !== undefined) updates.metadata = data.metadata;
      if (data.attr !== undefined) updates.metadata = data.attr;

      // Classification
      if (data.artifact_type !== undefined) updates.artifact_type = data.artifact_type;
      if (data.attachment_format !== undefined) updates.attachment_format = data.attachment_format;
      if (data.attachment_size_bytes !== undefined) updates.attachment_size_bytes = data.attachment_size_bytes;

      // Access control
      if (data.visibility !== undefined) updates.visibility = data.visibility;
      if (data.security_classification !== undefined) updates.security_classification = data.security_classification;

      // S3/Storage
      if (data.attachment_object_bucket !== undefined) updates.attachment_object_bucket = data.attachment_object_bucket;
      if (data.attachment_object_key !== undefined) updates.attachment_object_key = data.attachment_object_key;

      // Entity relationship
      if (data.entity_type !== undefined) updates.entity_type = data.entity_type;
      if (data.entity_id !== undefined) updates.entity_id = data.entity_id;

      if (Object.keys(updates).length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      // Always update timestamp
      updates.updated_ts = sql`NOW()`;

      // Build parameterized query
      const setClauses = Object.keys(updates).map((key) => {
        const value = updates[key];
        if (key === 'updated_ts') {
          return sql`updated_ts = NOW()`;
        } else if (typeof value === 'object' && value !== null) {
          // Handle JSONB fields
          return sql`${sql.identifier([key])} = ${JSON.stringify(value)}::jsonb`;
        } else {
          return sql`${sql.identifier([key])} = ${value}`;
        }
      });

      const result = await db.execute(sql`
        UPDATE app.d_artifact
        SET ${sql.join(setClauses, sql`, `)}
        WHERE id = ${id} AND active_flag = true
        RETURNING *
      `);

      if (!result.length) return reply.status(404).send({ error: 'Not found' });
      return result[0];
    } catch (error) {
      fastify.log.error('Error updating artifact:', error);
      return reply.status(500).send({ error: 'Internal server error', details: (error as Error).message });
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
        SET active_flag = false, updated_ts = NOW(), to_ts = NOW()
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
          code, name, descr, metadata,
          artifact_type, attachment_format, attachment_size_bytes,
          entity_type, entity_id,
          attachment_object_bucket, attachment_object_key,
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
          id, name, attachment_format, attachment_size_bytes, attachment_object_key, attachment_object_bucket
        FROM app.d_artifact
        WHERE id = ${id} AND active_flag = true
      `);

      if (!result.length) {
        return reply.status(404).send({ error: 'Artifact not found' });
      }

      const artifact = result[0];

      if (!artifact.attachment_object_key) {
        return reply.status(400).send({ error: 'Artifact has no associated file' });
      }

      // Generate presigned download URL
      const downloadResult = await s3AttachmentService.generatePresignedDownloadUrl(
        artifact.attachment_object_key as string
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
        fileName: `${artifact.name}.${artifact.attachment_format || 'bin'}`,
        fileSize: artifact.attachment_size_bytes,
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

  // Generate presigned URL for preview (for cost/revenue attachments)
  fastify.post('/api/v1/artifact/preview-url', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['artifact'],
      summary: 'Generate preview URL for object key',
      description: 'Generate presigned download URL for any S3 object key (used for cost/revenue attachments)',
      body: Type.Object({
        objectKey: Type.String({ description: 'S3 object key' }),
      }),
      response: {
        200: Type.Object({
          url: Type.String({ description: 'Presigned download URL' }),
          expiresIn: Type.Number({ description: 'URL expiration time in seconds' }),
        }),
      },
    },
  }, async (request, reply) => {
    const { objectKey } = request.body as any;

    try {
      // Generate presigned download URL
      const downloadResult = await s3AttachmentService.generatePresignedDownloadUrl(objectKey);

      fastify.log.info(`Preview URL generated for object key: ${objectKey}`);

      return {
        url: downloadResult.url,
        expiresIn: downloadResult.expiresIn,
      };
    } catch (error) {
      fastify.log.error({ error }, 'Error generating preview URL');
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
        attachment_format: Type.Optional(Type.String()),
        attachment_size_bytes: Type.Optional(Type.Number()),
        attachment_object_key: Type.Optional(Type.String()), // Pre-uploaded object key from frontend
        descr: Type.Optional(Type.String()),
        visibility: Type.Optional(Type.String()),
        security_classification: Type.Optional(Type.String()),
        artifact_type: Type.Optional(Type.String()),
      }),
      response: {
        200: Type.Object({
          oldArtifact: Type.Any(),
          newArtifact: Type.Any(),
          uploadUrl: Type.Union([Type.String(), Type.Null()]),
          expiresIn: Type.Union([Type.Number(), Type.Null()]),
          objectKey: Type.String(),
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

      // Use provided attachment_object_key if frontend already uploaded, otherwise generate presigned URL
      let finalObjectKey: string;
      let uploadUrl: string | null = null;
      let expiresIn: number | null = null;

      if (data.attachment_object_key) {
        // Frontend already uploaded the file, use the provided attachment_object_key
        finalObjectKey = data.attachment_object_key;
        fastify.log.info('Using pre-uploaded attachment_object_key:', finalObjectKey);
      } else {
        // Generate presigned upload URL for backward compatibility
        const uploadResult = await s3AttachmentService.generatePresignedUploadUrl({
          tenantId: 'demo',
          entityType: current.entity_type || 'artifact',
          entityId: id,
          fileName: data.fileName,
          contentType: data.contentType,
        });
        finalObjectKey = uploadResult.objectKey;
        uploadUrl = uploadResult.url;
        expiresIn = uploadResult.expiresIn;
      }

      const ext = data.fileName.split('.').pop() || '';
      const timestamp = Date.now();
      const slug = current.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-v' + nextVersion + '-' + timestamp;
      const code = current.code + '-V' + nextVersion;

      await db.execute(sql`UPDATE app.d_artifact SET active_flag = false, is_latest_version = false, to_ts = NOW(), updated_ts = NOW() WHERE id = ${id}`);

      const newResult = await db.execute(sql`
        INSERT INTO app.d_artifact (
          code, name, descr, metadata, artifact_type, attachment_format, attachment_size_bytes,
          entity_type, entity_id, attachment_object_bucket, attachment_object_key, visibility, security_classification,
          parent_artifact_id, is_latest_version, from_ts, to_ts, active_flag, version
        ) VALUES (
          ${slug}, ${code}, ${current.name}, ${data.descr || current.descr},
          ${data.tags ? JSON.stringify(data.tags) : current.tags}::jsonb,
          ${JSON.stringify({ uploadedBy: userId, uploadedAt: new Date().toISOString(), previousVersion: current.id })}::jsonb,
          ${data.artifact_type || current.artifact_type},
          ${data.attachment_format || ext},
          ${data.attachment_size_bytes || data.fileSize || current.attachment_size_bytes},
          ${current.entity_type}, ${current.entity_id}, ${config.S3_ATTACHMENTS_BUCKET}, ${finalObjectKey},
          ${data.visibility || current.visibility},
          ${data.security_classification || current.security_classification},
          ${rootId}, true, NOW(), NULL, true, ${nextVersion}
        ) RETURNING *
      `);

      return {
        oldArtifact: current,
        newArtifact: newResult[0],
        uploadUrl: uploadUrl,
        expiresIn: expiresIn,
        objectKey: finalObjectKey
      };
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