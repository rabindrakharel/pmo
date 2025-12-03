/**
 * ============================================================================
 * INVOICE ROUTES - Universal Entity Pattern
 * ============================================================================
 *
 * Financial invoice management with S3 attachment support.
 * Refactored to use universal-entity-crud-factory for consistent CRUD.
 *
 * Special endpoints:
 * - POST /api/v1/invoice/presigned-upload - Generate presigned URL for attachments
 *
 * @module invoice/routes
 */

import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { s3AttachmentService } from '../../lib/s3-attachments.js';
import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID } from '../../services/entity-infrastructure.service.js';
import {
  createUniversalEntityRoutes,
  type EntityRouteConfig,
  type CreateHookContext
} from '../../lib/universal-entity-crud-factory.js';

// Module-level constants
const ENTITY_CODE = 'invoice';

export async function invoiceRoutes(fastify: FastifyInstance) {
  const entityInfra = getEntityInfrastructure(db);

  // ═══════════════════════════════════════════════════════════════
  // ENTITY CONFIGURATION
  // Uses factory pattern for all standard CRUD operations
  // ═══════════════════════════════════════════════════════════════
  const config: EntityRouteConfig = {
    entityCode: ENTITY_CODE,
    tableAlias: 'i',

    // Search across invoice fields
    searchFields: ['invoice_number', 'client_name', 'product_name'],

    // Order by most recent invoice first
    defaultOrderBy: 'invoice_date DESC',

    // Default values for new invoices
    createDefaults: {
      invoice_number: () => `INV-${Date.now()}`,
      invoice_date: () => new Date().toISOString().split('T')[0],
      invoice_status: 'draft'
    },

    // Name field for entity registry
    nameField: 'invoice_number',
    codeField: 'invoice_number',

    // Invoice uses hard delete (fact table, no active_flag)
    deleteOptions: { hardDelete: true },

    // Hooks for custom logic
    hooks: {
      // Set created_by on creation
      beforeCreate: async (ctx: CreateHookContext) => {
        ctx.data.created_by = ctx.userId;
        return ctx.data;
      }
    }
  };

  // Generate all CRUD endpoints: LIST, GET, POST, PATCH, PUT, DELETE
  createUniversalEntityRoutes(fastify, config);

  // ═══════════════════════════════════════════════════════════════
  // SPECIAL ENDPOINT: Presigned Upload URL for Invoice Attachments
  // ═══════════════════════════════════════════════════════════════
  fastify.post('/api/v1/invoice/presigned-upload', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['invoice'],
      summary: 'Generate presigned upload URL for invoice PDF attachment',
      body: Type.Object({
        filename: Type.String(),
        contentType: Type.Optional(Type.String())
      }),
      response: {
        200: Type.Object({
          uploadUrl: Type.String(),
          objectKey: Type.String()
        }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    try {
      const { filename, contentType } = request.body as { filename: string; contentType?: string };
      const userId = (request as any).user?.sub;

      if (!userId) {
        return reply.status(401).send({ error: 'User not authenticated' });
      }

      // RBAC check - Can user CREATE invoices (upload attachments)?
      const canCreate = await entityInfra.check_entity_rbac(userId, ENTITY_CODE, ALL_ENTITIES_ID, Permission.CREATE);
      if (!canCreate) {
        return reply.code(403).send({ error: 'Permission denied to upload invoice attachments' });
      }

      // Generate presigned upload URL using s3AttachmentService
      const result = await s3AttachmentService.generatePresignedUploadUrl({
        tenantId: 'demo',
        entityCode: ENTITY_CODE,
        entityInstanceId: 'temp-' + Date.now(),
        fileName: filename,
        contentType: contentType || 'application/pdf'
      });

      return reply.send({
        uploadUrl: result.url,
        objectKey: result.objectKey
      });
    } catch (error: any) {
      fastify.log.error(`Presigned upload error: ${error.message}`);
      return reply.code(500).send({ error: 'Failed to generate upload URL' });
    }
  });

  console.log('✅ Invoice routes registered (Universal Factory + Presigned Upload)');
}
