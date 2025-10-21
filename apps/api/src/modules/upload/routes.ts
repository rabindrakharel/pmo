import type { FastifyInstance, FastifyRequest } from 'fastify';
import { uploadFile } from '../../lib/storage.js';

/**
 * Upload Routes
 * Handles file uploads to MinIO/S3 storage
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
              key: { type: 'string' },
            },
          },
        },
      },
    },
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
            error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.',
          });
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        const buffer = await data.toBuffer();

        if (buffer.length > maxSize) {
          return reply.status(400).send({
            error: 'File too large. Maximum size is 10MB.',
          });
        }

        // Upload to storage
        const result = await uploadFile(buffer, data.filename, data.mimetype);

        return reply.send(result);
      } catch (error) {
        console.error('Upload error:', error);
        return reply.status(500).send({
          error: 'Failed to upload file',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
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
                    filename: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply) => {
      try {
        const files = await request.saveRequestFiles();

        if (!files || files.length === 0) {
          return reply.status(400).send({ error: 'No files uploaded' });
        }

        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        const maxSize = 10 * 1024 * 1024; // 10MB

        const uploadedFiles = [];

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

          // Upload
          const result = await uploadFile(buffer, file.filename, file.mimetype);
          uploadedFiles.push({
            ...result,
            filename: file.filename,
          });

          // Clean up temp file
          await fs.unlink(file.filepath);
        }

        return reply.send({ files: uploadedFiles });
      } catch (error) {
        console.error('Upload error:', error);
        return reply.status(500).send({
          error: 'Failed to upload files',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );
}
