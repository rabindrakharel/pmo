/**
 * ============================================================================
 * CUSTOMER ROUTES MODULE - Universal Entity Pattern with Factory
 * ============================================================================
 *
 * REFACTORED: Uses Universal CRUD Factory for GET (list), GET (single), and UPDATE endpoints.
 * CREATE endpoint remains custom due to entity-specific validation and auto-generation.
 *
 * ENDPOINTS:
 *   GET    /api/v1/cust              - List customers (FACTORY)
 *   GET    /api/v1/cust/:id          - Get single customer (FACTORY)
 *   POST   /api/v1/cust              - Create customer (CUSTOM - auto-generation)
 *   PATCH  /api/v1/cust/:id          - Update customer (FACTORY)
 *   PUT    /api/v1/cust/:id          - Update customer alias (FACTORY)
 *   DELETE /api/v1/cust/:id          - Delete customer (DELETE FACTORY)
 *   GET    /api/v1/cust/:id/{child}  - Child entities (CHILD FACTORY)
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

// ✨ Universal CRUD Factory - generates standardized endpoints
import { createUniversalEntityRoutes } from '../../lib/universal-crud-factory.js';

// ✅ Delete factory for cascading soft deletes
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';

// ✅ Child entity factory for parent-child relationships
import { createChildEntityEndpointsFromMetadata } from '../../lib/child-entity-route-factory.js';

// Schema based on actual d_cust table structure from db/14_d_cust.ddl
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
  // Customer-specific fields - match actual d_cust table
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
const ENTITY_CODE = 'cust';
const TABLE_ALIAS = 'c';

export async function custRoutes(fastify: FastifyInstance) {
  // ✨ Initialize Entity Infrastructure Service
  const entityInfra = getEntityInfrastructure(db);

  // ════════════════════════════════════════════════════════════════════════════
  // UNIVERSAL CRUD ENDPOINTS (FACTORY)
  // ════════════════════════════════════════════════════════════════════════════
  // Creates:
  // - GET /api/v1/cust         - List with RBAC, pagination, auto-filters, metadata
  // - GET /api/v1/cust/:id     - Single entity with RBAC, ref_data_entityInstance
  // - PATCH /api/v1/cust/:id   - Update with RBAC, registry sync
  // - PUT /api/v1/cust/:id     - Update alias
  //
  // Features:
  // - content=metadata support for metadata-only responses
  // - ref_data_entityInstance for entity reference resolution
  // - Universal auto-filters from query parameters
  // - Parent-child filtering via entity_instance_link
  // ════════════════════════════════════════════════════════════════════════════

  createUniversalEntityRoutes(fastify, {
    entityCode: ENTITY_CODE,
    tableName: 'cust',
    tableAlias: 'e',
    searchFields: ['name', 'descr', 'cust_number', 'primary_contact_name', 'primary_email', 'code']
  });

  // Get customer hierarchy (parent and children)
  fastify.get('/api/v1/cust/:id/hierarchy', {
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
        FROM app.cust c
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

  // Create customer
  fastify.post('/api/v1/cust', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateCustSchema,
      querystring: Type.Object({
        parent_entity_code: Type.Optional(Type.String()),
        parent_entity_instance_id: Type.Optional(Type.String({ format: 'uuid' }))}),
      response: {
        201: CustSchema,
        403: Type.Object({ error: Type.String() }),
        400: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    const { parent_entity_code, parent_entity_instance_id } = request.query as any;

    // Transform request data (tags string → array, etc.)
    const data = transformRequestBody(request.body as any);

    // Auto-generate code from name if not provided
    if (!data.code) {
      data.code = data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || `cust-${Date.now()}`;
    }

    // Auto-generate cust_number if not provided
    if (!data.cust_number) {
      if (data.primary_phone) {
        // Use phone number as cust_number (remove non-digits)
        data.cust_number = data.primary_phone.replace(/\D/g, '');
      } else {
        // Generate from timestamp
        data.cust_number = `CUST${Date.now()}`;
      }
    }

    // Set primary_contact_name from name if not provided
    if (!data.primary_contact_name && data.name) {
      data.primary_contact_name = data.name;
    }

    try {
      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC CHECK 1
      // Check: Can user CREATE customers?
      // ═══════════════════════════════════════════════════════════════
      const canCreate = await entityInfra.check_entity_rbac(userId, ENTITY_CODE, ALL_ENTITIES_ID, Permission.CREATE);
      if (!canCreate) {
        return reply.status(403).send({ error: 'No permission to create customers' });
      }

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC CHECK 2
      // Check: If linking to parent, can user EDIT parent?
      // ═══════════════════════════════════════════════════════════════
      if (parent_entity_code && parent_entity_instance_id) {
        const canEditParent = await entityInfra.check_entity_rbac(userId, parent_entity_code, parent_entity_instance_id, Permission.EDIT);
        if (!canEditParent) {
          return reply.status(403).send({ error: `No permission to link customer to this ${parent_entity_code}` });
        }
      }

      // Check for unique customer number
      const existingCust = await db.execute(sql`
        SELECT id FROM app.cust
        WHERE cust_number = ${data.cust_number}
        AND active_flag = true
      `);
      if (existingCust.length > 0) {
        return reply.status(400).send({ error: 'Customer with this customer number already exists' });
      }

      // ✅ Route owns INSERT query
      const result = await db.execute(sql`
        INSERT INTO app.cust (
          code, name, "descr", cust_number, cust_type, cust_status,
          primary_address, city, province, postal_code, country, geo_coordinates,
          business_legal_name, business_type, gst_hst_number, business_number,
          dl__customer_opportunity_funnel, dl__industry_sector, dl__acquisition_channel, dl__customer_tier,
          primary_contact_name, primary_email, primary_phone,
          secondary_contact_name, secondary_email, secondary_phone,
          entities, metadata, active_flag
        )
        VALUES (
          ${data.code},
          ${data.name},
          ${data.descr || null},
          ${data.cust_number},
          ${data.cust_type || 'residential'},
          ${data.cust_status || 'active'},
          ${data.primary_address || null},
          ${data.city || null},
          ${data.province || 'ON'},
          ${data.postal_code || null},
          ${data.country || 'Canada'},
          ${data.geo_coordinates ? JSON.stringify(data.geo_coordinates) : null}::jsonb,
          ${data.business_legal_name || null},
          ${data.business_type || null},
          ${data.gst_hst_number || null},
          ${data.business_number || null},
          ${data.dl__customer_opportunity_funnel || null},
          ${data.dl__industry_sector || null},
          ${data.dl__acquisition_channel || null},
          ${data.dl__customer_tier || null},
          ${data.primary_contact_name || null},
          ${data.primary_email || null},
          ${data.primary_phone || null},
          ${data.secondary_contact_name || null},
          ${data.secondary_email || null},
          ${data.secondary_phone || null},
          ${data.entities ? sql`${data.entities}::text[]` : sql`ARRAY[]::text[]`},
          ${data.metadata ? JSON.stringify(data.metadata) : '{}'}::jsonb,
          ${data.active_flag !== false}
        )
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to create customer' });
      }

      const newCustomer = result[0] as any;
      const custId = newCustomer.id;

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - Register instance in registry
      // ═══════════════════════════════════════════════════════════════
      await entityInfra.set_entity_instance_registry({
        entity_code: ENTITY_CODE,
        entity_id: custId,
        entity_name: newCustomer.name,
        instance_code: newCustomer.code
      });

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - Grant ownership to creator
      // ═══════════════════════════════════════════════════════════════
      await entityInfra.set_entity_rbac_owner(userId, ENTITY_CODE, custId);

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - Link to parent (if provided)
      // ═══════════════════════════════════════════════════════════════
      if (parent_entity_code && parent_entity_instance_id) {
        await entityInfra.set_entity_instance_link({
          parent_entity_code: parent_entity_code,
          parent_entity_id: parent_entity_instance_id,
          child_entity_code: ENTITY_CODE,
          child_entity_id: custId,
          relationship_type: 'contains'
        });
      }

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true};

      return reply.status(201).send(filterUniversalColumns(newCustomer, userPermissions));
    } catch (error) {
      fastify.log.error('Error creating customer:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // DELETE ENDPOINT (FACTORY)
  // ════════════════════════════════════════════════════════════════════════════

  createEntityDeleteEndpoint(fastify, ENTITY_CODE);

  // ============================================================================
  // Child Entity Endpoints (Auto-Generated from entity metadata)
  // ============================================================================
  // Child entity routes auto-generated from entity metadata via factory
  await createChildEntityEndpointsFromMetadata(fastify, ENTITY_CODE);
}