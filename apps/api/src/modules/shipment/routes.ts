/**
 * ============================================================================
 * SHIPMENT ROUTES - Universal Entity Pattern
 * ============================================================================
 *
 * Shipment tracking and management.
 * Refactored to use universal-entity-crud-factory for consistent CRUD.
 *
 * @module shipment/routes
 */

import type { FastifyInstance } from 'fastify';
import {
  createUniversalEntityRoutes,
  type EntityRouteConfig,
  type CreateHookContext
} from '../../lib/universal-entity-crud-factory.js';

export async function shipmentRoutes(fastify: FastifyInstance) {
  // ═══════════════════════════════════════════════════════════════
  // ENTITY CONFIGURATION
  // Uses factory pattern for all standard CRUD operations
  // ═══════════════════════════════════════════════════════════════
  const config: EntityRouteConfig = {
    entityCode: 'shipment',
    tableAlias: 's',

    // Search across shipment fields
    searchFields: ['shipment_number', 'tracking_number', 'client_name'],

    // Order by most recent shipment first
    defaultOrderBy: 'shipment_date DESC',

    // Default values for new shipments
    createDefaults: {
      shipment_number: () => `SHIP-${Date.now()}`,
      shipment_date: () => new Date().toISOString().split('T')[0],
      shipment_status: 'pending'
    },

    // Name field for entity registry
    nameField: 'shipment_number',
    codeField: 'shipment_number',

    // Shipment uses hard delete (fact table, no active_flag)
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

  console.log('✅ Shipment routes registered (Universal Factory)');
}
