/**
 * ============================================================================
 * CUSTOMER INTERACTION ROUTES - Universal Entity Pattern
 * ============================================================================
 *
 * Handles omnichannel customer interactions with S3 storage support.
 * Refactored to use universal-entity-crud-factory for consistent CRUD.
 *
 * @module interaction/routes
 */

import type { FastifyInstance } from 'fastify';
import {
  createUniversalEntityRoutes,
  type EntityRouteConfig,
  type CreateHookContext
} from '../../lib/universal-entity-crud-factory.js';

/**
 * Register interaction routes using Universal Entity Factory
 */
export async function interactionRoutes(fastify: FastifyInstance) {
  // ═══════════════════════════════════════════════════════════════
  // ENTITY CONFIGURATION
  // Uses factory pattern for all CRUD operations
  // ═══════════════════════════════════════════════════════════════
  const config: EntityRouteConfig = {
    entityCode: 'interaction',
    tableAlias: 'i',

    // Search across interaction content fields
    searchFields: ['code', 'name', 'content_text', 'transcript_text', 'content_summary'],

    // Order by most recent interaction first
    defaultOrderBy: 'interaction_ts DESC NULLS LAST',

    // Required fields for creation
    requiredFields: ['code', 'interaction_type', 'channel_name'],

    // Default values for new interactions
    createDefaults: {
      priority_level: 'normal',
      metadata: {},
      interaction_person_entities: []
    },

    // Name field for entity registry
    nameField: 'name',
    codeField: 'code',

    // Hooks for custom logic
    hooks: {
      // Set interaction timestamp and created_by if not provided
      beforeCreate: async (ctx: CreateHookContext) => {
        if (!ctx.data.interaction_ts) {
          ctx.data.interaction_ts = new Date().toISOString();
        }
        ctx.data.created_by__employee_id = ctx.userId;
        return ctx.data;
      }
    }
  };

  // Generate all CRUD endpoints: LIST, GET, POST, PATCH, PUT, DELETE
  createUniversalEntityRoutes(fastify, config);

  console.log('✅ Interaction routes registered (Universal Factory)');
}

export default interactionRoutes;
