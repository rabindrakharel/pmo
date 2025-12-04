/**
 * ============================================================================
 * CUSTOMER ROUTES MODULE - Universal Entity Pattern with Factory
 * ============================================================================
 *
 * REFACTORED: Uses Universal CRUD Factory for GET (list), GET (single), and UPDATE endpoints.
 * CREATE endpoint remains custom due to entity-specific validation and auto-generation.
 *
 * ENDPOINTS:
 *   GET    /api/v1/customer              - List customers (FACTORY)
 *   GET    /api/v1/customer/:id          - Get single customer (FACTORY)
 *   POST   /api/v1/customer              - Create customer (CUSTOM - auto-generation)
 *   PATCH  /api/v1/customer/:id          - Update customer (FACTORY)
 *   PUT    /api/v1/customer/:id          - Update customer alias (FACTORY)
 *   DELETE /api/v1/customer/:id          - Delete customer (DELETE FACTORY)
 *   GET    /api/v1/customer/:id/{child}  - Child entities (CHILD FACTORY)
 *
 * ============================================================================
 */

import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { filterUniversalColumns } from '../../lib/universal-schema-metadata.js';
import { transformRequestBody } from '../../lib/data-transformers.js';

// ✨ Entity Infrastructure Service - centralized infrastructure operations
import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID } from '../../services/entity-infrastructure.service.js';

// ✨ Universal Entity CRUD Factory - consolidated endpoint generation
import { createUniversalEntityRoutes } from '../../lib/universal-entity-crud-factory.js';

// Schema based on actual customer table structure from db/08_customer.ddl
const CustSchema = Type.Object({
  id: Type.String(),
  code: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.String()),
  active_flag: Type.Boolean(),
  created_ts: Type.String(),
  updated_ts: Type.String(),
  version: Type.Number(),
  // Customer-specific fields - match actual customer table
  cust_number: Type.String(),
  cust_type: Type.String(),
  cust_status: Type.String(),
  // Address and location
  primary_address: Type.Optional(Type.String()),
  city: Type.Optional(Type.String()),
  province: Type.Optional(Type.String()),
  postal_code: Type.Optional(Type.String()),
  country: Type.Optional(Type.String()),
  geo_coordinates: Type.Optional(Type.Any()),
  // Business information
  business_legal_name: Type.Optional(Type.String()),
  business_type: Type.Optional(Type.String()),
  gst_hst_number: Type.Optional(Type.String()),
  business_number: Type.Optional(Type.String()),
  // Sales and marketing fields
  dl__customer_opportunity_funnel: Type.Optional(Type.String()),
  dl__customer_industry_sector: Type.Optional(Type.String()),
  dl__customer_acquisition_channel: Type.Optional(Type.String()),
  dl__customer_tier: Type.Optional(Type.String()),
  // Contact information
  primary_contact_name: Type.Optional(Type.String()),
  primary_email: Type.Optional(Type.String()),
  primary_phone: Type.Optional(Type.String()),
  secondary_contact_name: Type.Optional(Type.String()),
  secondary_email: Type.Optional(Type.String()),
  secondary_phone: Type.Optional(Type.String()),
  // Entity configuration
  entities: Type.Optional(Type.Array(Type.String()))});

const CreateCustSchema = Type.Object({
  name: Type.String({ minLength: 1 }), // Only name is required
  code: Type.Optional(Type.String()),  // Auto-generated if not provided
  cust_number: Type.Optional(Type.String()), // Auto-generated if not provided
  descr: Type.Optional(Type.String()),
  cust_type: Type.Optional(Type.String()),
  cust_status: Type.Optional(Type.String()),
  // Address and location
  primary_address: Type.Optional(Type.String()),
  city: Type.Optional(Type.String()),
  province: Type.Optional(Type.String()),
  postal_code: Type.Optional(Type.String()),
  country: Type.Optional(Type.String()),
  geo_coordinates: Type.Optional(Type.Any()),
  // Business information
  business_legal_name: Type.Optional(Type.String()),
  business_type: Type.Optional(Type.String()),
  gst_hst_number: Type.Optional(Type.String()),
  business_number: Type.Optional(Type.String()),
  // Sales and marketing fields
  dl__customer_opportunity_funnel: Type.Optional(Type.String()),
  dl__customer_industry_sector: Type.Optional(Type.String()),
  dl__customer_acquisition_channel: Type.Optional(Type.String()),
  dl__customer_tier: Type.Optional(Type.String()),
  // Contact information
  primary_contact_name: Type.Optional(Type.String()),
  primary_email: Type.Optional(Type.String()),
  primary_phone: Type.Optional(Type.String()),
  secondary_contact_name: Type.Optional(Type.String()),
  secondary_email: Type.Optional(Type.String()),
  secondary_phone: Type.Optional(Type.String()),
  // Entity configuration
  entities: Type.Optional(Type.Array(Type.String())),
  metadata: Type.Optional(Type.Any()),
  active_flag: Type.Optional(Type.Boolean())});


// ============================================================================
// Module-level constants (DRY - used across all endpoints)
// ============================================================================
const ENTITY_CODE = 'customer';
const TABLE_ALIAS = 'c';

export async function customerRoutes(fastify: FastifyInstance) {
  // ✨ Initialize Entity Infrastructure Service
  const entityInfra = getEntityInfrastructure(db);

  // ════════════════════════════════════════════════════════════════════════════
  // UNIVERSAL CRUD ENDPOINTS (FACTORY)
  // ════════════════════════════════════════════════════════════════════════════
  // Creates:
  // - GET /api/v1/customer         - List with RBAC, pagination, auto-filters, metadata
  // - GET /api/v1/customer/:id     - Single entity with RBAC, ref_data_entityInstance
  // - PATCH /api/v1/customer/:id   - Update with RBAC, registry sync
  // - PUT /api/v1/customer/:id     - Update alias
  //
  // Features:
  // - content=metadata support for metadata-only responses
  // - ref_data_entityInstance for entity reference resolution
  // - Universal auto-filters from query parameters
  // - Parent-child filtering via entity_instance_link
  // ════════════════════════════════════════════════════════════════════════════

  createUniversalEntityRoutes(fastify, {
    entityCode: ENTITY_CODE,
    tableName: 'customer',
    tableAlias: 'e',
    searchFields: ['name', 'descr', 'cust_number', 'primary_contact_name', 'primary_email', 'code'],
    requiredFields: ['name'],
    createDefaults: {
      cust_type: 'residential',
      cust_status: 'active',
      province: 'ON',
      country: 'Canada'
    },
    hooks: {
      beforeCreate: async (ctx) => {
        const data = ctx.data;

        // Transform request data if needed
        if (typeof data.tags === 'string') {
          data.tags = data.tags.split(',').map((t: string) => t.trim());
        }

        // Auto-generate code from name if not provided
        if (!data.code) {
          data.code = data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || `cust-${Date.now()}`;
        }

        // Auto-generate cust_number if not provided
        if (!data.cust_number) {
          if (data.primary_phone) {
            data.cust_number = data.primary_phone.replace(/\D/g, '');
          } else {
            data.cust_number = `CUST${Date.now()}`;
          }
        }

        // Set primary_contact_name from name if not provided
        if (!data.primary_contact_name && data.name) {
          data.primary_contact_name = data.name;
        }

        // Check for unique customer number
        const existingCust = await db.execute(sql`
          SELECT id FROM app.customer
          WHERE cust_number = ${data.cust_number}
          AND active_flag = true
        `);
        if (existingCust.length > 0) {
          throw new Error('Customer with this customer number already exists');
        }

        return data;
      }
    }
  });
  // All CRUD endpoints (LIST, GET, POST, PATCH, PUT, DELETE) are created by createUniversalEntityRoutes above

  // Get customer hierarchy (parent and children)
  fastify.get('/api/v1/customer/:id/hierarchy', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })}),
      response: {
        200: Type.Object({
          customer: CustSchema,
          parent: Type.Optional(CustSchema),
          children: Type.Array(CustSchema)}),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC check
      // Check: Can user VIEW this customer?
      // ═══════════════════════════════════════════════════════════════
      const canView = await entityInfra.check_entity_rbac(userId, ENTITY_CODE, id, Permission.VIEW);
      if (!canView) {
        return reply.status(403).send({ error: 'No permission to view this customer' });
      }
      // Get the customer
      const customerResult = await db.execute(sql`
        SELECT
          c.id, c.code, c.name, c."descr", c.metadata, c.from_ts, c.to_ts, c.active_flag, c.created_ts, c.updated_ts, c.version,
          c.cust_number, c.cust_type, c.cust_status,
          c.primary_address, c.city, c.province, c.postal_code, c.country, c.geo_coordinates,
          c.business_legal_name, c.business_type, c.gst_hst_number, c.business_number,
          c.dl__customer_opportunity_funnel, c.dl__customer_industry_sector, c.dl__customer_acquisition_channel, c.dl__customer_tier,
          c.primary_contact_name, c.primary_email, c.primary_phone,
          c.secondary_contact_name, c.secondary_email, c.secondary_phone,
          c.entities
        FROM app.customer c
        WHERE c.id = ${id}
      `);

      if (customerResult.length === 0) {
        return reply.status(404).send({ error: 'Customer not found' });
      }

      const customer = customerResult[0];

      if (!customer) {
        return reply.status(404).send({ error: 'Customer not found' });
      }

      // Note: Customer table doesn't have hierarchy - parent/children not applicable
      const parent = null;
      const children = [];

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true};

      return {
        customer: filterUniversalColumns(customer, userPermissions),
        parent: parent ? filterUniversalColumns(parent, userPermissions) : null,
        children: children.map(child => filterUniversalColumns(child, userPermissions))};
    } catch (error) {
      fastify.log.error('Error fetching customer hierarchy:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

}