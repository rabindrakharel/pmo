/**
 * ============================================================================
 * ARTIFACT ROUTES MODULE - Universal Entity Pattern with Unified Data Gate
 * ============================================================================
 *
 * SEMANTICS & PURPOSE:
 * This module implements CRUD operations for the Artifact entity following the
 * PMO platform's Universal Entity System architecture.
 *
 * Artifacts represent file attachments (documents, images, videos) with version
 * control, S3 storage, access control, and entity linkage. Artifacts support
 * presigned URL generation for secure upload/download without direct S3 access.
 *
 * ============================================================================
 * DESIGN PATTERNS & ARCHITECTURE
 * ============================================================================
 *
 * 1. UNIFIED DATA GATE PATTERN (Security & Filtering)
 * ───────────────────────────────────────────────────
 * All endpoints use centralized permission checking via unified-data-gate.ts
 * for RBAC enforcement on artifact access.
 *
 * 2. S3 PRESIGNED URL PATTERN (Secure File Upload/Download)
 * ───────────────────────────────────────────────────────────
 * Instead of direct S3 access, use presigned URLs:
 *   • POST /api/v1/artifact/upload - Generate upload URL + create metadata
 *   • GET /api/v1/artifact/:id/download - Generate download URL
 *   • Client uploads/downloads directly to/from S3 using presigned URLs
 *
 * 3. VERSIONING PATTERN (In-Place Updates)
 * ─────────────────────────────────────────
 * New artifact versions update in-place (same ID, version++)
 * with version history stored in metadata.versionHistory array.
 *
 * ============================================================================
 */

import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql, SQL } from 'drizzle-orm';
import { s3AttachmentService } from '@/lib/s3-attachments.js';
import { config } from '@/lib/config.js';
import { createEntityDeleteEndpoint } from '../../lib/universal-entity-crud-factory.js';
import { createPaginatedResponse } from '../../lib/universal-schema-metadata.js';
// ✅ Centralized unified data gate - loosely coupled API
// ✨ Universal auto-filter builder - zero-config query filtering
import { buildAutoFilters } from '../../lib/universal-filter-builder.js';
// ✨ Backend Formatter Service - component-aware metadata generation
import { generateEntityResponse } from '../../services/backend-formatter.service.js';
// ✨ Datalabel Service - fetch datalabel options for dropdowns and DAG visualization
// ✅ Entity Infrastructure Service - Centralized infrastructure management
import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID } from '../../services/entity-infrastructure.service.js';

// Artifact schemas aligned with actual app.artifact columns
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
  latest_version_flag: Type.Optional(Type.Boolean()),
  active_flag: Type.Boolean(),
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.String()),
  created_ts: Type.String(),
  updated_ts: Type.String(),
  version: Type.Optional(Type.Number())});

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
  attachment_object_key: Type.Optional(Type.String()),

  // Access control
  visibility: Type.Optional(Type.String()), // public, internal, restricted, private
  security_classification: Type.Optional(Type.String()), // general, confidential, restricted

  // Entity relationship
  entity_type: Type.Optional(Type.String()),
  entity_id: Type.Optional(Type.String()),
  primary_entity_type: Type.Optional(Type.String()),
  primary_entity_id: Type.Optional(Type.String()),

  // Versioning
  parent__artifact_id: Type.Optional(Type.String()),
  latest_version_flag: Type.Optional(Type.Boolean()),
  version: Type.Optional(Type.Number()),

  // Status
  active_flag: Type.Optional(Type.Boolean()),
  active: Type.Optional(Type.Boolean())});

const UpdateArtifactSchema = Type.Partial(CreateArtifactSchema);

// Response schema for metadata-driven endpoints
const ArtifactWithMetadataSchema = Type.Object({
  data: ArtifactSchema,
  fields: Type.Array(Type.String()),  // Field names list
  metadata: Type.Any(),  // EntityMetadata - component-specific field metadata
});

// ============================================================================
// Module-level constants (DRY - used across all endpoints)
// ============================================================================
const ENTITY_CODE = 'artifact';
const TABLE_ALIAS = 'a';

export async function artifactRoutes(fastify: FastifyInstance) {
  // ═══════════════════════════════════════════════════════════════
  // ✅ ENTITY INFRASTRUCTURE SERVICE - Initialize service instance
  // ═══════════════════════════════════════════════════════════════
  const entityInfra = getEntityInfrastructure(db);

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
        page: Type.Optional(Type.Number({ minimum: 1 })),
        artifact_type: Type.Optional(Type.String()),
        active: Type.Optional(Type.Boolean()),
        view: Type.Optional(Type.String())}),  // 'entityListOfInstancesTable,kanbanView' or 'entityInstanceFormContainer'
      response: {
        200: Type.Object({
          data: Type.Array(ArtifactSchema),
          fields: Type.Array(Type.String()),
          metadata: Type.Any(),  // EntityMetadata - component-specific field metadata
          total: Type.Integer(),
          limit: Type.Integer(),
          offset: Type.Integer()})}}}, async (request, reply) => {
    const { limit = 20, offset: queryOffset, page, artifact_type, active_flag = true, view } = request.query as any;
    const offset = page ? (page - 1) * limit : (queryOffset !== undefined ? queryOffset : 0);

    try {
      const userId = (request as any).user?.sub;
      if (!userId) {
        return reply.status(401).send({ error: 'User not authenticated' });
      }

      // ═══════════════════════════════════════════════════════════════
      // NEW PATTERN: Route builds SQL, gates augment it
      // ═══════════════════════════════════════════════════════════════

      // Build WHERE conditions array
      const conditions: SQL[] = [];

      // GATE 1: RBAC - Apply security filtering (REQUIRED)
      const rbacWhereClause = await entityInfra.get_entity_rbac_where_condition(userId, ENTITY_CODE, Permission.VIEW, TABLE_ALIAS
      );
      conditions.push(rbacWhereClause);

      // ✅ DEFAULT FILTER: Only show active records (not soft-deleted)
      // Can be overridden with ?active=false to show inactive records
      if (!('active' in (request.query as any))) {
        conditions.push(sql`${sql.raw(TABLE_ALIAS)}.active_flag = true`);
      }

      // ✨ UNIVERSAL AUTO-FILTER SYSTEM
      // Automatically builds filters from ANY query parameter based on field naming conventions
      // Supports: ?artifact_type=X, ?active=true, ?search=keyword, etc.
      // See: apps/api/src/lib/universal-filter-builder.ts
      const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query as any, {
        overrides: {
          active: { column: 'active_flag', type: 'boolean' },
          active_flag: { column: 'active_flag', type: 'boolean' },
          artifact_type: { column: 'dl__artifact_type', type: 'text' }
        }
      });
      conditions.push(...autoFilters);

      // Build WHERE clause
      const whereClause = conditions.length > 0
        ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
        : sql``;

      // Get total count
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM app.artifact ${sql.raw(TABLE_ALIAS)}
        ${whereClause}
      `);
      const total = Number(countResult[0]?.count || 0);

      // Get paginated results
      const rows = await db.execute(sql`
        SELECT
          ${sql.raw(TABLE_ALIAS)}.id, ${sql.raw(TABLE_ALIAS)}.code, ${sql.raw(TABLE_ALIAS)}.name, ${sql.raw(TABLE_ALIAS)}.descr, ${sql.raw(TABLE_ALIAS)}.metadata,
          ${sql.raw(TABLE_ALIAS)}.dl__artifact_type as artifact_type, ${sql.raw(TABLE_ALIAS)}.attachment_format, ${sql.raw(TABLE_ALIAS)}.attachment_size_bytes,
          ${sql.raw(TABLE_ALIAS)}.attachment, ${sql.raw(TABLE_ALIAS)}.entity_type, ${sql.raw(TABLE_ALIAS)}.entity_id,
          ${sql.raw(TABLE_ALIAS)}.attachment_object_bucket, ${sql.raw(TABLE_ALIAS)}.attachment_object_key, ${sql.raw(TABLE_ALIAS)}.visibility,
          ${sql.raw(TABLE_ALIAS)}.dl__artifact_security_classification as security_classification,
          ${sql.raw(TABLE_ALIAS)}.latest_version_flag, ${sql.raw(TABLE_ALIAS)}.version, ${sql.raw(TABLE_ALIAS)}.active_flag,
          ${sql.raw(TABLE_ALIAS)}.from_ts, ${sql.raw(TABLE_ALIAS)}.to_ts, ${sql.raw(TABLE_ALIAS)}.created_ts, ${sql.raw(TABLE_ALIAS)}.updated_ts
        FROM app.artifact ${sql.raw(TABLE_ALIAS)}
        ${whereClause}
        ORDER BY ${sql.raw(TABLE_ALIAS)}.created_ts DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const artifacts = rows;

      // ═══════════════════════════════════════════════════════════════
      // ✨ BACKEND FORMATTER SERVICE V5.0 - Component-aware metadata
      // Parse requested view (convert view names to component names)
      // ═══════════════════════════════════════════════════════════════
      const requestedComponents = view
        ? view.split(',').map((v: string) => v.trim())
        : ['entityListOfInstancesTable', 'entityInstanceFormContainer', 'kanbanView'];

      // Generate response with metadata for requested components only
      const response = await generateEntityResponse(ENTITY_CODE, artifacts, {
        components: requestedComponents,
        total,
        limit,
        offset
      });

      return response;
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
      querystring: Type.Object({
        view: Type.Optional(Type.String()),  // 'entityInstanceFormContainer' or 'entityListOfInstancesTable'
      }),
      response: {
        200: ArtifactWithMetadataSchema,  // ✅ Use metadata-driven schema
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }}}, async (request, reply) => {
    const { id } = request.params as any;
    const { view } = request.query as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // ═══════════════════════════════════════════════════════════════
      // ✅ ENTITY INFRASTRUCTURE SERVICE - RBAC check
      // Uses: entityInfra.check_entity_rbac() (4 params, db is pre-bound)
      // ═══════════════════════════════════════════════════════════════
      const canView = await entityInfra.check_entity_rbac(
        userId,
        ENTITY_CODE,
        id,
        Permission.VIEW
      );

      if (!canView) {
        return reply.status(403).send({ error: 'No permission to view this artifact' });
      }

      const result = await db.execute(sql`
        SELECT
          id, code, name, descr, metadata,
          dl__artifact_type as artifact_type, attachment, attachment_format, attachment_size_bytes,
          entity_type, entity_id,
          attachment_object_bucket, attachment_object_key,
          visibility, dl__artifact_security_classification as security_classification,
          latest_version_flag, version, active_flag,
          from_ts, to_ts, created_ts, updated_ts
        FROM app.artifact
        WHERE id = ${id} AND active_flag = true
      `);

      if (!result.length) return reply.status(404).send({ error: 'Artifact not found' });

      const artifact = result[0];

      // ═══════════════════════════════════════════════════════════════
      // ✨ BACKEND FORMATTER SERVICE V5.0 - Component-aware metadata
      // Parse requested view (default to formContainer)
      // ═══════════════════════════════════════════════════════════════
      const requestedComponents = view
        ? view.split(',').map((v: string) => v.trim())
        : ['entityInstanceFormContainer'];

      const response = await generateEntityResponse(ENTITY_CODE, [artifact], {
        components: requestedComponents,
        total: 1,
        limit: 1,
        offset: 0
      });

      // Return single item (not array)
      return reply.send({
        data: response.data[0],  // Single object, not array
        fields: response.fields,
        metadata: response.metadata,
      });
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
      }}}, async (request, reply) => {
    const data = request.body as any;
    const userId = (request as any).user?.sub || 'system';

    // Auto-generate required fields if missing
    if (!data.name) data.name = 'Untitled';
    if (!data.artifact_type) data.artifact_type = 'document'; // Default to document type

    // Auto-generate code if not provided (required NOT NULL field)
    const code = data.code || `ART-${Date.now()}`;

    try {
      const result = await db.execute(sql`
        INSERT INTO app.artifact (
          code, name, descr, metadata, dl__artifact_type,
          attachment_format, attachment_size_bytes,
          attachment_object_bucket, attachment_object_key,
          entity_type, entity_id,
          visibility, dl__artifact_security_classification,
          active_flag
        ) VALUES (
          ${code},
          ${data.name},
          ${data.descr || null},
          ${JSON.stringify(data.metadata || {})}::jsonb,
          ${data.artifact_type},
          ${data.attachment_format || null},
          ${data.attachment_size_bytes || null},
          ${data.attachment_object_bucket || null},
          ${data.attachment_object_key || null},
          ${data.entity_type || data.primary_entity_type || null},
          ${data.entity_id || data.primary_entity_id || null},
          ${data.visibility || 'internal'},
          ${data.security_classification || 'general'},
          ${data.active_flag !== false && data.active !== false}
        ) RETURNING *
      `);

      return result[0];
    } catch (error) {
      fastify.log.error('Error creating artifact:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update artifact (PATCH)
  fastify.patch('/api/v1/artifact/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['artifact'],
      summary: 'Update artifact',
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      body: UpdateArtifactSchema,
      response: {
        200: ArtifactSchema,
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      }}}, async (request, reply) => {
    const { id } = request.params as any;
    const data = request.body as any;

    try {
      // Build update object with only provided fields
      const updates: any = {};

      // Basic fields
      if (data.name !== undefined) updates.name = data.name;
      if (data.code !== undefined) updates.code = data.code;
      if (data.descr !== undefined) updates.descr = data.descr;

      // JSONB fields
      if (data.metadata !== undefined) updates.metadata = data.metadata;
      if (data.attr !== undefined) updates.metadata = data.attr;

      // Classification
      if (data.artifact_type !== undefined) updates.dl__artifact_type = data.artifact_type;
      if (data.attachment_format !== undefined) updates.attachment_format = data.attachment_format;
      if (data.attachment_size_bytes !== undefined) updates.attachment_size_bytes = data.attachment_size_bytes;

      // Access control
      if (data.visibility !== undefined) updates.visibility = data.visibility;
      if (data.security_classification !== undefined) updates.dl__artifact_security_classification = data.security_classification;

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
        UPDATE app.artifact
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

  // ============================================================================
  // Update Artifact (PUT - alias to PATCH for frontend compatibility)
  // ============================================================================

  fastify.put('/api/v1/artifact/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['artifact'],
      summary: 'Update artifact',
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      body: UpdateArtifactSchema,
      response: {
        200: ArtifactSchema,
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      }}}, async (request, reply) => {
    const { id } = request.params as any;
    const data = request.body as any;

    try {
      // Build update object with only provided fields
      const updates: any = {};

      // Basic fields
      if (data.name !== undefined) updates.name = data.name;
      if (data.code !== undefined) updates.code = data.code;
      if (data.descr !== undefined) updates.descr = data.descr;

      // JSONB fields
      if (data.metadata !== undefined) updates.metadata = data.metadata;
      if (data.attr !== undefined) updates.metadata = data.attr;

      // Classification
      if (data.artifact_type !== undefined) updates.dl__artifact_type = data.artifact_type;
      if (data.attachment_format !== undefined) updates.attachment_format = data.attachment_format;
      if (data.attachment_size_bytes !== undefined) updates.attachment_size_bytes = data.attachment_size_bytes;

      // Access control
      if (data.visibility !== undefined) updates.visibility = data.visibility;
      if (data.security_classification !== undefined) updates.dl__artifact_security_classification = data.security_classification;

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
        UPDATE app.artifact
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

  // ============================================================================
  // Delete Artifact (Soft Delete via Factory)
  // ============================================================================
  // Delete artifact with cascading cleanup (soft delete)
  // Uses universal delete factory pattern - deletes from:
  // 1. app.artifact (base entity table)
  // 2. app.entity_instance (entity registry)
  // 3. app.entity_instance_link (linkages in both directions)
  // Adds proper RBAC checks and entity existence validation
  createEntityDeleteEndpoint(fastify, ENTITY_CODE);

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
        entityCode: Type.String({ description: 'Entity type (e.g., "project", "task")' }),
        entityId: Type.String({ format: 'uuid', description: 'Entity UUID' }),
        fileName: Type.String({ description: 'File name with extension' }),
        contentType: Type.Optional(Type.String({ description: 'MIME type' })),
        fileSize: Type.Optional(Type.Number({ description: 'File size in bytes' })),
        visibility: Type.Optional(Type.String({ enum: ['public', 'internal', 'restricted', 'private'] })),
        securityClassification: Type.Optional(Type.String({ enum: ['general', 'confidential', 'restricted'] }))}),
      response: {
        200: Type.Object({
          artifact: ArtifactSchema,
          uploadUrl: Type.String({ description: 'Presigned URL for file upload' }),
          expiresIn: Type.Number({ description: 'URL expiration time in seconds' })})}}}, async (request, reply) => {
    const userId = (request as any).user?.sub || 'system';
    const data = request.body as any;

    try {
      // Generate presigned upload URL
      const uploadResult = await s3AttachmentService.generatePresignedUploadUrl({
        tenantId: 'demo',
        entityCode: data.entityCode,
        entityId: data.entityId,
        fileName: data.fileName,
        contentType: data.contentType});

      // Extract file extension from filename
      const fileExtension = data.fileName.split('.').pop() || '';

      // Generate unique code
      const code = `ART-${Date.now()}`;

      // Create artifact metadata record
      const result = await db.execute(sql`
        INSERT INTO app.artifact (
          code, name, descr, metadata,
          dl__artifact_type, attachment_format, attachment_size_bytes,
          entity_type, entity_id,
          attachment_object_bucket, attachment_object_key,
          visibility, dl__artifact_security_classification,
          latest_version_flag, active_flag
        ) VALUES (
          ${code},
          ${data.name},
          ${data.descr || null},
          ${JSON.stringify({ uploadedBy: userId, uploadedAt: new Date().toISOString() })}::jsonb,
          ${data.contentType?.startsWith('image/') ? 'image' : data.contentType?.startsWith('video/') ? 'video' : 'document'},
          ${fileExtension},
          ${data.fileSize || null},
          ${data.entityCode},
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
        expiresIn: uploadResult.expiresIn};
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
        id: Type.String({ format: 'uuid' })}),
      response: {
        200: Type.Object({
          url: Type.String({ description: 'Presigned download URL' }),
          objectKey: Type.String({ description: 'S3 object key' }),
          fileName: Type.String({ description: 'Original file name' }),
          fileSize: Type.Optional(Type.Number({ description: 'File size in bytes' })),
          expiresIn: Type.Number({ description: 'URL expiration time in seconds' })})}}}, async (request, reply) => {
    const { id } = request.params as any;

    try {
      // Get artifact metadata
      const result = await db.execute(sql`
        SELECT
          id, name, attachment_format, attachment_size_bytes, attachment_object_key, attachment_object_bucket
        FROM app.artifact
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
      //   UPDATE app.artifact
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
        expiresIn: downloadResult.expiresIn};
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
        objectKey: Type.String({ description: 'S3 object key' })}),
      response: {
        200: Type.Object({
          url: Type.String({ description: 'Presigned download URL' }),
          expiresIn: Type.Number({ description: 'URL expiration time in seconds' })})}}}, async (request, reply) => {
    const { objectKey } = request.body as any;

    try {
      // Generate presigned download URL
      const downloadResult = await s3AttachmentService.generatePresignedDownloadUrl(objectKey);

      fastify.log.info(`Preview URL generated for object key: ${objectKey}`);

      return {
        url: downloadResult.url,
        expiresIn: downloadResult.expiresIn};
    } catch (error) {
      fastify.log.error({ error }, 'Error generating preview URL');
      return reply.status(500).send({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // List artifacts by entity
  fastify.get('/api/v1/artifact/entity/:entityCode/:entityId', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['artifact'],
      summary: 'List artifacts by entity',
      description: 'Get all artifacts linked to a specific entity',
      params: Type.Object({
        entityCode: Type.String({ description: 'Entity type (e.g., "project", "task")' }),
        entityId: Type.String({ format: 'uuid', description: 'Entity UUID' })}),
      querystring: Type.Object({
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 50 })),
        offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 }))}),
      response: {
        200: Type.Object({
          data: Type.Array(ArtifactSchema),
          total: Type.Integer()})}}}, async (request, reply) => {
    const { entityCode, entityId } = request.params as any;
    const { limit = 50, offset = 0 } = request.query as any;

    try {
      // Get total count
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM app.artifact
        WHERE entity_type = ${entityCode}
          AND entity_id = ${entityId}
          AND active_flag = true
      `);
      const total = Number(countResult[0]?.count || 0);

      // Get artifacts
      const rows = await db.execute(sql`
        SELECT *
        FROM app.artifact
        WHERE entity_type = ${entityCode}
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
        id: Type.String({ format: 'uuid' })}),
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
        artifact_type: Type.Optional(Type.String())}),
      response: {
        200: Type.Object({
          oldArtifact: Type.Any(),
          newArtifact: Type.Any(),
          uploadUrl: Type.Union([Type.String(), Type.Null()]),
          expiresIn: Type.Union([Type.Number(), Type.Null()]),
          objectKey: Type.String()})}}}, async (request, reply) => {
    const userId = (request as any).user?.sub || 'system';
    const { id } = request.params as any;
    const data = request.body as any;

    try {
      const currentResult = await db.execute(sql`SELECT * FROM app.artifact WHERE id = ${id} AND active_flag = true`);
      if (!currentResult.length) return reply.status(404).send({ error: 'Not found' });

      const current = currentResult[0] as any;
      const nextVersion = current.version + 1;

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
          entityCode: current.entity_type || 'artifact',
          entityId: id,
          fileName: data.fileName,
          contentType: data.contentType});
        finalObjectKey = uploadResult.objectKey;
        uploadUrl = uploadResult.url;
        expiresIn = uploadResult.expiresIn;
      }

      const ext = data.fileName.split('.').pop() || '';

      // In-place update: same ID, version++, new file (like form pattern)
      const updatedResult = await db.execute(sql`
        UPDATE app.artifact SET
          attachment_object_key = ${finalObjectKey},
          attachment_object_bucket = ${config.S3_ATTACHMENTS_BUCKET},
          attachment_format = ${data.attachment_format || ext},
          attachment_size_bytes = ${data.attachment_size_bytes || data.fileSize || null},
          descr = ${data.descr || current.descr},
          dl__artifact_type = ${data.artifact_type || current.dl__artifact_type},
          visibility = ${data.visibility || current.visibility},
          dl__artifact_security_classification = ${data.security_classification || current.dl__artifact_security_classification},
          metadata = ${JSON.stringify({
            ...current.metadata,
            uploadedBy: userId,
            uploadedAt: new Date().toISOString(),
            versionHistory: [...(current.metadata?.versionHistory || []), {
              version: current.version,
              uploadedAt: current.updated_ts,
              objectKey: current.attachment_object_key
            }]
          })}::jsonb,
          version = ${nextVersion},
          updated_ts = NOW()
        WHERE id = ${id}
        RETURNING *
      `);

      return {
        oldArtifact: current,
        newArtifact: updatedResult[0],
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
          currentVersion: Type.Number()})}}}, async (request, reply) => {
    const { id } = request.params as any;

    try {
      const result = await db.execute(sql`SELECT * FROM app.artifact WHERE id = ${id}`);
      if (!result.length) return reply.status(404).send({ error: 'Not found' });

      const artifact = result[0] as any;

      // Version history is stored in metadata.versionHistory (in-place versioning pattern)
      const versionHistory = artifact.metadata?.versionHistory || [];

      // Build complete version list: historical versions + current version
      const allVersions = [
        ...versionHistory.map((v: any) => ({
          version: v.version,
          uploadedAt: v.uploadedAt,
          objectKey: v.objectKey,
          isCurrent: false
        })),
        {
          version: artifact.version,
          uploadedAt: artifact.updated_ts,
          objectKey: artifact.attachment_object_key,
          attachment_format: artifact.attachment_format,
          attachment_size_bytes: artifact.attachment_size_bytes,
          isCurrent: true
        }
      ].sort((a, b) => b.version - a.version);

      return {
        data: allVersions,
        rootArtifactId: id,
        currentVersion: artifact.version
      };
    } catch (error) {
      fastify.log.error('Error fetching versions:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

}