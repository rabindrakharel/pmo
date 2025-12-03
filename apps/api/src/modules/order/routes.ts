/**
 * ============================================================================
 * ORDER ROUTES - Universal Entity Pattern
 * ============================================================================
 *
 * Order management for products and services.
 * Refactored to use universal-entity-crud-factory for consistent CRUD.
 *
 * @module order/routes
 */

import type { FastifyInstance } from 'fastify';
import {
  createUniversalEntityRoutes,
  type EntityRouteConfig,
  type CreateHookContext
} from '../../lib/universal-entity-crud-factory.js';

export async function orderRoutes(fastify: FastifyInstance) {
  // ═══════════════════════════════════════════════════════════════
  // ENTITY CONFIGURATION
  // Uses factory pattern for all standard CRUD operations
  // ═══════════════════════════════════════════════════════════════
  const config: EntityRouteConfig = {
    entityCode: 'order',
    tableAlias: 'o',

    // Search across order fields
    searchFields: ['order_number', 'client_name', 'product_name'],

    // Order by most recent order first
    defaultOrderBy: 'order_date DESC',

    // Default values for new orders
    createDefaults: {
      order_number: () => `ORD-${Date.now()}`,
      order_date: () => new Date().toISOString().split('T')[0],
      order_status: 'pending'
    },

    // Name field for entity registry
    nameField: 'order_number',
    codeField: 'order_number',

    // Order uses hard delete (fact table, no active_flag)
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

  console.log('✅ Order routes registered (Universal Factory)');
}
