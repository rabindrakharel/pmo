import type { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { s3AttachmentService } from '@/lib/s3-attachments.js';
import { config } from '@/lib/config.js';

/**
 * S3 Backend API Module
 *
 * Provides S3 attachment operations for other services to use:
 * - Generate presigned upload URLs
 * - Generate presigned download URLs
 * - List attachments for entities
 * - Delete attachments
 */

const s3BackendRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/v1/s3-backend/presigned-upload
   * Generate presigned URL for file upload
   */
  fastify.post('/presigned-upload', {
    schema: {
      tags: ['s3-backend'],
      summary: 'Generate presigned upload URL',
      description: 'Create a presigned URL for uploading files to S3 with multi-tenant storage structure',
      body: Type.Object({
        tenantId: Type.Optional(Type.String({ description: 'Tenant ID (defaults to "demo")' })),
        entityCode: Type.String({ description: 'Entity TYPE code (e.g., "project", "task", "artifact")' }),
        entityInstanceId: Type.String({ description: 'Entity instance UUID' }),
        fileName: Type.String({ description: 'Original file name with extension' }),
        contentType: Type.Optional(Type.String({ description: 'MIME type of the file' }))}),
      response: {
        200: Type.Object({
          url: Type.String({ description: 'Presigned upload URL' }),
          objectKey: Type.String({ description: 'S3 object key (save this to database)' }),
          expiresIn: Type.Number({ description: 'URL expiration time in seconds' })})}}}, async (request) => {
    const { tenantId, entityCode, entityInstanceId, fileName, contentType } = request.body as any;

    const result = await s3AttachmentService.generatePresignedUploadUrl({
      tenantId,
      entityCode,
      entityInstanceId,
      fileName,
      contentType});

    return result;
  });

  /**
   * POST /api/v1/s3-backend/presigned-download
   * Generate presigned URL for file download
   */
  fastify.post('/presigned-download', {
    schema: {
      tags: ['s3-backend'],
      summary: 'Generate presigned download URL',
      description: 'Create a presigned URL for downloading files from S3',
      body: Type.Object({
        objectKey: Type.String({ description: 'S3 object key from database' })}),
      response: {
        200: Type.Object({
          url: Type.String({ description: 'Presigned download URL' }),
          objectKey: Type.String({ description: 'S3 object key' }),
          expiresIn: Type.Number({ description: 'URL expiration time in seconds' })})}}}, async (request) => {
    const { objectKey } = request.body as any;

    const result = await s3AttachmentService.generatePresignedDownloadUrl(objectKey);

    return result;
  });

  /**
   * GET /api/v1/s3-backend/list/:entityCode/:entityInstanceId
   * List all attachments for a specific entity instance
   */
  fastify.get('/list/:entityCode/:entityInstanceId', {
    schema: {
      tags: ['s3-backend'],
      summary: 'List entity instance attachments',
      description: 'Retrieve list of all attachments for a specific entity instance',
      params: Type.Object({
        entityCode: Type.String({ description: 'Entity TYPE code (e.g., "project", "task")' }),
        entityInstanceId: Type.String({ description: 'Entity instance UUID' })}),
      querystring: Type.Object({
        tenantId: Type.Optional(Type.String({ description: 'Tenant ID (defaults to "demo")' }))}),
      response: {
        200: Type.Array(Type.Object({
          key: Type.String({ description: 'S3 object key' }),
          size: Type.Number({ description: 'File size in bytes' }),
          lastModified: Type.String({ description: 'Last modified date' })}))}}}, async (request) => {
    const { entityCode, entityInstanceId } = request.params as any;
    const { tenantId } = request.query as any;

    const attachments = await s3AttachmentService.listAttachments(
      tenantId,
      entityCode,
      entityInstanceId
    );

    return attachments;
  });

  /**
   * DELETE /api/v1/s3-backend/attachment
   * Delete an attachment from S3
   */
  fastify.delete('/attachment', {
    schema: {
      tags: ['s3-backend'],
      summary: 'Delete attachment',
      description: 'Delete a file from S3 storage',
      body: Type.Object({
        objectKey: Type.String({ description: 'S3 object key to delete' })}),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          objectKey: Type.String()})}}}, async (request) => {
    const { objectKey } = request.body as any;

    const success = await s3AttachmentService.deleteAttachment(objectKey);

    return { success, objectKey };
  });

  /**
   * GET /api/v1/s3-backend/health
   * Verify S3 connection and bucket access
   */
  fastify.get('/health', {
    schema: {
      tags: ['s3-backend'],
      summary: 'S3 health check',
      description: 'Verify S3 connection and bucket access',
      response: {
        200: Type.Object({
          status: Type.String(),
          bucket: Type.String(),
          connected: Type.Boolean()})}}}, async () => {
    const connected = await s3AttachmentService.verifyConnection();

    return {
      status: connected ? 'healthy' : 'unhealthy',
      bucket: config.S3_ATTACHMENTS_BUCKET,
      connected};
  });
};

export default s3BackendRoutes;
