/**
 * ============================================================================
 * CUSTOMER INTERACTION ROUTES - Universal Entity Pattern
 * ============================================================================
 *
 * Handles omnichannel customer interactions with S3 storage support.
 * Refactored to use universal-entity-crud-factory for consistent CRUD.
 *
 * Uses `deleted_ts` soft delete pattern instead of `active_flag`.
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

    // Interaction uses deleted_ts for soft delete (not active_flag)
    softDeleteStyle: 'deleted_ts',

    // Search across interaction content fields
    searchFields: ['interaction_number', 'content_text', 'transcript_text', 'content_summary'],

    // Order by most recent interaction first
    defaultOrderBy: 'interaction_ts DESC NULLS LAST',

    // Required fields for creation
    requiredFields: ['interaction_number', 'interaction_type', 'channel'],

    // Default values for new interactions
    createDefaults: {
      priority_level: 'normal',
      metadata: {},
      interaction_person_entities: []
    },

    // Name field for entity registry (interactions use interaction_number)
    nameField: 'interaction_number',
    codeField: 'interaction_number',

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
