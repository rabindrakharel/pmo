import type { FastifyInstance, FastifyRequest } from 'fastify';
import { s3AttachmentService } from '../../lib/s3-attachments.js';
import { randomUUID } from 'crypto';

/**
 * Upload Routes
 * Handles file uploads to S3 storage using unified S3AttachmentService
 *
 * DEPRECATED: Consider using /api/v1/s3-backend endpoints directly for new code
 * This module is maintained for backward compatibility
 */
export async function uploadRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/upload/image
   * Upload an image file
   */
  fastify.post(
    '/api/v1/upload/image',
    {
      preHandler: fastify.authenticate,
      schema: {
        description: 'Upload an image file',
        tags: ['upload'],
        consumes: ['multipart/form-data'],
        response: {
          200: {
            type: 'object',
            properties: {
              url: { type: 'string' },
              key: { type: 'string' }}}}}},
    async (request: FastifyRequest, reply) => {
      try {
        // Get the uploaded file
        const data = await request.file();

        if (!data) {
          return reply.status(400).send({ error: 'No file uploaded' });
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(data.mimetype)) {
          return reply.status(400).send({
            error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'});
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        const buffer = await data.toBuffer();

        if (buffer.length > maxSize) {
          return reply.status(400).send({
            error: 'File too large. Maximum size is 10MB.'});
        }

        // Generate unique entity ID for this upload
        const uploadId = randomUUID();

        // Upload to S3 using unified S3AttachmentService
        const uploadResult = await s3AttachmentService.generatePresignedUploadUrl({
          tenantId: 'demo',
          entityType: 'upload',
          entityId: uploadId,
          fileName: data.filename,
          contentType: data.mimetype});

        // Upload file content to S3 using presigned URL (simulated - in real use, client does this)
        // For server-side upload, we use the S3 client directly
        const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
        const { fromIni } = await import('@aws-sdk/credential-providers');
        const { config } = await import('../../lib/config.js');

        const s3Client = new S3Client({
          region: config.AWS_REGION,
          credentials: config.AWS_PROFILE ? fromIni({ profile: config.AWS_PROFILE }) : undefined});

        await s3Client.send(
          new PutObjectCommand({
            Bucket: config.S3_ATTACHMENTS_BUCKET,
            Key: uploadResult.objectKey,
            Body: buffer,
            ContentType: data.mimetype})
        );

        // Generate download URL
        const downloadResult = await s3AttachmentService.generatePresignedDownloadUrl(uploadResult.objectKey);

        return reply.send({
          url: downloadResult.url,
          key: uploadResult.objectKey});
      } catch (error) {
        console.error('Upload error:', error);
        return reply.status(500).send({
          error: 'Failed to upload file',
          message: error instanceof Error ? error.message : 'Unknown error'});
      }
    }
  );

  /**
   * POST /api/v1/upload/images (multiple)
   * Upload multiple image files
   */
  fastify.post(
    '/api/v1/upload/images',
    {
      preHandler: fastify.authenticate,
      schema: {
        description: 'Upload multiple image files',
        tags: ['upload'],
        consumes: ['multipart/form-data'],
        response: {
          200: {
            type: 'object',
            properties: {
              files: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    url: { type: 'string' },
                    key: { type: 'string' },
                    filename: { type: 'string' }}}}}}}}},
    async (request: FastifyRequest, reply) => {
      try {
        const files = await request.saveRequestFiles();

        if (!files || files.length === 0) {
          return reply.status(400).send({ error: 'No files uploaded' });
        }

        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        const maxSize = 10 * 1024 * 1024; // 10MB

        const uploadedFiles = [];

        // Import S3 dependencies
        const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
        const { fromIni } = await import('@aws-sdk/credential-providers');
        const { config } = await import('../../lib/config.js');

        const s3Client = new S3Client({
          region: config.AWS_REGION,
          credentials: config.AWS_PROFILE ? fromIni({ profile: config.AWS_PROFILE }) : undefined});

        for (const file of files) {
          // Validate file type
          if (!allowedTypes.includes(file.mimetype)) {
            continue; // Skip invalid files
          }

          // Read file buffer
          const fs = await import('fs/promises');
          const buffer = await fs.readFile(file.filepath);

          // Validate size
          if (buffer.length > maxSize) {
            continue; // Skip large files
          }

          // Generate unique ID for this upload
          const uploadId = randomUUID();

          // Upload to S3 using unified S3AttachmentService
          const uploadResult = await s3AttachmentService.generatePresignedUploadUrl({
            tenantId: 'demo',
            entityType: 'upload',
            entityId: uploadId,
            fileName: file.filename,
            contentType: file.mimetype});

          // Upload file content to S3
          await s3Client.send(
            new PutObjectCommand({
              Bucket: config.S3_ATTACHMENTS_BUCKET,
              Key: uploadResult.objectKey,
              Body: buffer,
              ContentType: file.mimetype})
          );

          // Generate download URL
          const downloadResult = await s3AttachmentService.generatePresignedDownloadUrl(uploadResult.objectKey);

          uploadedFiles.push({
            url: downloadResult.url,
            key: uploadResult.objectKey,
            filename: file.filename});

          // Clean up temp file
          await fs.unlink(file.filepath);
        }

        return reply.send({ files: uploadedFiles });
      } catch (error) {
        console.error('Upload error:', error);
        return reply.status(500).send({
          error: 'Failed to upload files',
          message: error instanceof Error ? error.message : 'Unknown error'});
      }
    }
  );
}
