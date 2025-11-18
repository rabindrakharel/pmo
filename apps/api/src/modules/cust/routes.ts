import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql, SQL } from 'drizzle-orm';
import {
  getUniversalColumnMetadata,
  filterUniversalColumns,
  getColumnsByMetadata,
  createPaginatedResponse
} from '../../lib/universal-schema-metadata.js';
import { transformRequestBody } from '../../lib/data-transformers.js';
// ✅ Centralized unified data gate - loosely coupled API
import { unified_data_gate, Permission, ALL_ENTITIES_ID } from '../../lib/unified-data-gate.js';
// ✨ Entity Infrastructure Service - centralized infrastructure operations
import { getEntityInfrastructure } from '../../services/entity-infrastructure.service.js';
// ✨ Universal auto-filter builder - zero-config query filtering
import { buildAutoFilters } from '../../lib/universal-filter-builder.js';
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

const UpdateCustSchema = Type.Partial(CreateCustSchema);

// ============================================================================
// Module-level constants (DRY - used across all endpoints)
// ============================================================================
const ENTITY_TYPE = 'cust';
const TABLE_ALIAS = 'c';

export async function custRoutes(fastify: FastifyInstance) {
  // ✨ Initialize Entity Infrastructure Service
  const entityInfra = getEntityInfrastructure(db);

  // Test endpoint
  fastify.get('/api/v1/cust/test', async (request, reply) => {
    try {
      const result = await db.execute(sql`SELECT id, name FROM app.d_cust LIMIT 2`);
      return { success: true, count: result.length, data: result };
    } catch (error) {
      return { error: String(error) };
    }
  });

  // List customers with filtering
  fastify.get('/api/v1/cust', {
    schema: {
      querystring: Type.Object({
        active: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        cust_type: Type.Optional(Type.String()),
        biz_id: Type.Optional(Type.String()),
        page: Type.Optional(Type.Number({ minimum: 1 })),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 }))})}}, async (request, reply) => {
    const { active, search, cust_type, biz_id, page, limit = 20, offset } = request.query as any;

    // Calculate offset from page if page is provided
    const actualOffset = page !== undefined ? (page - 1) * limit : (offset || 0);


    try {
      const conditions = [];

      if (active !== undefined) {
        conditions.push(sql`c.active_flag = ${active}`);
      }

      if (search) {
        conditions.push(sql`(
          c.name ILIKE ${`%${search}%`} OR
          c."descr" ILIKE ${`%${search}%`} OR
          c.cust_number ILIKE ${`%${search}%`} OR
          c.primary_contact_name ILIKE ${`%${search}%`} OR
          c.primary_email ILIKE ${`%${search}%`}
        )`);
      }

      // ✅ DEFAULT FILTER: Only show active records (not soft-deleted)
      // Can be overridden with ?active=false to show inactive records
      if (!('active' in (request.query as any))) {
        conditions.push(sql`c.active_flag = true`);
      }

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.d_cust c
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      const customers = await db.execute(sql`
        SELECT
          c.id, c.code, c.name, c."descr", c.metadata, c.from_ts, c.to_ts, c.active_flag, c.created_ts, c.updated_ts, c.version,
          c.cust_number, c.cust_type, c.cust_status,
          c.primary_address, c.city, c.province, c.postal_code, c.country, c.geo_coordinates,
          c.business_legal_name, c.business_type, c.gst_hst_number, c.business_number,
          c.dl__customer_opportunity_funnel, c.dl__customer_industry_sector, c.dl__customer_acquisition_channel, c.dl__customer_tier,
          c.primary_contact_name, c.primary_email, c.primary_phone,
          c.secondary_contact_name, c.secondary_email, c.secondary_phone,
          c.entities
        FROM app.d_cust c
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY c.name ASC NULLS LAST, c.created_ts DESC
        LIMIT ${limit} OFFSET ${actualOffset}
      `);

      return createPaginatedResponse(customers, total, limit, actualOffset);
    } catch (error) {
      fastify.log.error('Error fetching customers:', error);
      console.error('CUST API ERROR:', error);
      return reply.status(500).send({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Get single customer
  fastify.get('/api/v1/cust/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })}),
      response: {
        200: CustSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    const { id } = request.params as { id: string };


    try {
      const customer = await db.execute(sql`
        SELECT
          c.id, c.code, c.name, c."descr", c.metadata, c.from_ts, c.to_ts, c.active_flag, c.created_ts, c.updated_ts, c.version,
          c.cust_number, c.cust_type, c.cust_status,
          c.primary_address, c.city, c.province, c.postal_code, c.country, c.geo_coordinates,
          c.business_legal_name, c.business_type, c.gst_hst_number, c.business_number,
          c.dl__customer_opportunity_funnel, c.dl__customer_industry_sector, c.dl__customer_acquisition_channel, c.dl__customer_tier,
          c.primary_contact_name, c.primary_email, c.primary_phone,
          c.secondary_contact_name, c.secondary_email, c.secondary_phone,
          c.entities
        FROM app.d_cust c
        WHERE c.id = ${id}
      `);

      if (customer.length === 0) {
        return reply.status(404).send({ error: 'Customer not found' });
      }

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true};

      return filterUniversalColumns(customer[0], userPermissions);
    } catch (error) {
      fastify.log.error('Error fetching customer:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
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
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    const { id } = request.params as { id: string };


    try {
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
        FROM app.d_cust c
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
        parent_type: Type.Optional(Type.String()),
        parent_id: Type.Optional(Type.String({ format: 'uuid' }))}),
      response: {
        201: CustSchema,
        403: Type.Object({ error: Type.String() }),
        400: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    const { parent_type, parent_id } = request.query as any;

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
      const canCreate = await entityInfra.check_entity_rbac(userId, ENTITY_TYPE, ALL_ENTITIES_ID, Permission.CREATE);
      if (!canCreate) {
        return reply.status(403).send({ error: 'No permission to create customers' });
      }

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC CHECK 2
      // Check: If linking to parent, can user EDIT parent?
      // ═══════════════════════════════════════════════════════════════
      if (parent_type && parent_id) {
        const canEditParent = await entityInfra.check_entity_rbac(userId, parent_type, parent_id, Permission.EDIT);
        if (!canEditParent) {
          return reply.status(403).send({ error: `No permission to link customer to this ${parent_type}` });
        }
      }

      // Check for unique customer number
      const existingCust = await db.execute(sql`
        SELECT id FROM app.d_cust
        WHERE cust_number = ${data.cust_number}
        AND active_flag = true
      `);
      if (existingCust.length > 0) {
        return reply.status(400).send({ error: 'Customer with this customer number already exists' });
      }

      // ✅ Route owns INSERT query
      const result = await db.execute(sql`
        INSERT INTO app.d_cust (
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
        entity_type: ENTITY_TYPE,
        entity_id: custId,
        entity_name: newCustomer.name,
        entity_code: newCustomer.code
      });

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - Grant ownership to creator
      // ═══════════════════════════════════════════════════════════════
      await entityInfra.set_entity_rbac_owner(userId, ENTITY_TYPE, custId);

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - Link to parent (if provided)
      // ═══════════════════════════════════════════════════════════════
      if (parent_type && parent_id) {
        await entityInfra.set_entity_instance_link({
          parent_entity_type: parent_type,
          parent_entity_id: parent_id,
          child_entity_type: ENTITY_TYPE,
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

  // Update customer (PATCH)
  fastify.patch('/api/v1/cust/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })}),
      body: UpdateCustSchema,
      response: {
        200: CustSchema,
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    const { id } = request.params as { id: string };
    // Transform request data (tags string → array, etc.)
    const data = transformRequestBody(request.body as any);

    try {
      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC CHECK
      // Check: Can user EDIT this customer?
      // ═══════════════════════════════════════════════════════════════
      const canEdit = await entityInfra.check_entity_rbac(userId, ENTITY_TYPE, id, Permission.EDIT);
      if (!canEdit) {
        return reply.status(403).send({ error: 'No permission to edit this customer' });
      }

      const existing = await db.execute(sql`
        SELECT id FROM app.d_cust WHERE id = ${id}
      `);

      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Customer not found' });
      }

      // Check for unique customer number on update
      if (data.cust_number !== undefined) {
        const existingNumber = await db.execute(sql`
          SELECT id FROM app.d_cust
          WHERE cust_number = ${data.cust_number}
          AND id != ${id}
          AND active_flag = true
        `);
        if (existingNumber.length > 0) {
          return reply.status(400).send({ error: 'Customer with this customer number already exists' });
        }
      }

      const updateFields = [];

      if (data.code !== undefined) updateFields.push(sql`code = ${data.code}`);
      if (data.name !== undefined) updateFields.push(sql`name = ${data.name}`);
      if (data.descr !== undefined) updateFields.push(sql`"descr" = ${data.descr}`);
      if (data.cust_number !== undefined) updateFields.push(sql`cust_number = ${data.cust_number}`);
      if (data.cust_type !== undefined) updateFields.push(sql`cust_type = ${data.cust_type}`);
      if (data.cust_status !== undefined) updateFields.push(sql`cust_status = ${data.cust_status}`);
      // Address and location
      if (data.primary_address !== undefined) updateFields.push(sql`primary_address = ${data.primary_address}`);
      if (data.city !== undefined) updateFields.push(sql`city = ${data.city}`);
      if (data.province !== undefined) updateFields.push(sql`province = ${data.province}`);
      if (data.postal_code !== undefined) updateFields.push(sql`postal_code = ${data.postal_code}`);
      if (data.country !== undefined) updateFields.push(sql`country = ${data.country}`);
      if (data.geo_coordinates !== undefined) updateFields.push(sql`geo_coordinates = ${JSON.stringify(data.geo_coordinates)}::jsonb`);
      // Business information
      if (data.business_legal_name !== undefined) updateFields.push(sql`business_legal_name = ${data.business_legal_name}`);
      if (data.business_type !== undefined) updateFields.push(sql`business_type = ${data.business_type}`);
      if (data.gst_hst_number !== undefined) updateFields.push(sql`gst_hst_number = ${data.gst_hst_number}`);
      if (data.business_number !== undefined) updateFields.push(sql`business_number = ${data.business_number}`);
      // Sales and marketing
      if (data.dl__customer_opportunity_funnel !== undefined) updateFields.push(sql`dl__customer_opportunity_funnel = ${data.dl__customer_opportunity_funnel}`);
      if (data.dl__industry_sector !== undefined) updateFields.push(sql`dl__industry_sector = ${data.dl__industry_sector}`);
      if (data.dl__acquisition_channel !== undefined) updateFields.push(sql`dl__acquisition_channel = ${data.dl__acquisition_channel}`);
      if (data.dl__customer_tier !== undefined) updateFields.push(sql`dl__customer_tier = ${data.dl__customer_tier}`);
      // Contact information
      if (data.primary_contact_name !== undefined) updateFields.push(sql`primary_contact_name = ${data.primary_contact_name}`);
      if (data.primary_email !== undefined) updateFields.push(sql`primary_email = ${data.primary_email}`);
      if (data.primary_phone !== undefined) updateFields.push(sql`primary_phone = ${data.primary_phone}`);
      if (data.secondary_contact_name !== undefined) updateFields.push(sql`secondary_contact_name = ${data.secondary_contact_name}`);
      if (data.secondary_email !== undefined) updateFields.push(sql`secondary_email = ${data.secondary_email}`);
      if (data.secondary_phone !== undefined) updateFields.push(sql`secondary_phone = ${data.secondary_phone}`);
      // Entity configuration
      if (data.entities !== undefined) updateFields.push(sql`entities = ${data.entities}::text[]`);
      if (data.metadata !== undefined) updateFields.push(sql`metadata = ${JSON.stringify(data.metadata)}::jsonb`);
      if (data.active_flag !== undefined) updateFields.push(sql`active_flag = ${data.active_flag}`);

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated_ts = NOW()`);

      // ✅ Route owns UPDATE query
      const result = await db.execute(sql`
        UPDATE app.d_cust
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to update customer' });
      }

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - Sync registry if name/code changed
      // ═══════════════════════════════════════════════════════════════
      if (data.name !== undefined || data.code !== undefined) {
        await entityInfra.update_entity_instance_registry(ENTITY_TYPE, id, {
          entity_name: data.name,
          entity_code: data.code
        });
      }

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true};

      return filterUniversalColumns(result[0], userPermissions);
    } catch (error) {
      fastify.log.error('Error updating customer:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update customer (PUT - alias for frontend compatibility)
  fastify.put('/api/v1/cust/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })}),
      body: UpdateCustSchema,
      response: {
        200: CustSchema,
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    const { id } = request.params as { id: string };
    // Transform request data (tags string → array, etc.)
    const data = transformRequestBody(request.body as any);

    try {
      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC CHECK
      // Check: Can user EDIT this customer?
      // ═══════════════════════════════════════════════════════════════
      const canEdit = await entityInfra.check_entity_rbac(userId, ENTITY_TYPE, id, Permission.EDIT);
      if (!canEdit) {
        return reply.status(403).send({ error: 'No permission to edit this customer' });
      }

      const existing = await db.execute(sql`
        SELECT id FROM app.d_cust WHERE id = ${id}
      `);

      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Customer not found' });
      }

      // Check for unique customer number on update
      if (data.cust_number !== undefined) {
        const existingNumber = await db.execute(sql`
          SELECT id FROM app.d_cust
          WHERE cust_number = ${data.cust_number}
          AND id != ${id}
          AND active_flag = true
        `);
        if (existingNumber.length > 0) {
          return reply.status(400).send({ error: 'Customer with this customer number already exists' });
        }
      }

      const updateFields = [];

      if (data.code !== undefined) updateFields.push(sql`code = ${data.code}`);
      if (data.name !== undefined) updateFields.push(sql`name = ${data.name}`);
      if (data.descr !== undefined) updateFields.push(sql`"descr" = ${data.descr}`);
      if (data.cust_number !== undefined) updateFields.push(sql`cust_number = ${data.cust_number}`);
      if (data.cust_type !== undefined) updateFields.push(sql`cust_type = ${data.cust_type}`);
      if (data.cust_status !== undefined) updateFields.push(sql`cust_status = ${data.cust_status}`);
      // Address and location
      if (data.primary_address !== undefined) updateFields.push(sql`primary_address = ${data.primary_address}`);
      if (data.city !== undefined) updateFields.push(sql`city = ${data.city}`);
      if (data.province !== undefined) updateFields.push(sql`province = ${data.province}`);
      if (data.postal_code !== undefined) updateFields.push(sql`postal_code = ${data.postal_code}`);
      if (data.country !== undefined) updateFields.push(sql`country = ${data.country}`);
      if (data.geo_coordinates !== undefined) updateFields.push(sql`geo_coordinates = ${JSON.stringify(data.geo_coordinates)}::jsonb`);
      // Business information
      if (data.business_legal_name !== undefined) updateFields.push(sql`business_legal_name = ${data.business_legal_name}`);
      if (data.business_type !== undefined) updateFields.push(sql`business_type = ${data.business_type}`);
      if (data.gst_hst_number !== undefined) updateFields.push(sql`gst_hst_number = ${data.gst_hst_number}`);
      if (data.business_number !== undefined) updateFields.push(sql`business_number = ${data.business_number}`);
      // Sales and marketing
      if (data.dl__customer_opportunity_funnel !== undefined) updateFields.push(sql`dl__customer_opportunity_funnel = ${data.dl__customer_opportunity_funnel}`);
      if (data.dl__industry_sector !== undefined) updateFields.push(sql`dl__industry_sector = ${data.dl__industry_sector}`);
      if (data.dl__acquisition_channel !== undefined) updateFields.push(sql`dl__acquisition_channel = ${data.dl__acquisition_channel}`);
      if (data.dl__customer_tier !== undefined) updateFields.push(sql`dl__customer_tier = ${data.dl__customer_tier}`);
      // Contact information
      if (data.primary_contact_name !== undefined) updateFields.push(sql`primary_contact_name = ${data.primary_contact_name}`);
      if (data.primary_email !== undefined) updateFields.push(sql`primary_email = ${data.primary_email}`);
      if (data.primary_phone !== undefined) updateFields.push(sql`primary_phone = ${data.primary_phone}`);
      if (data.secondary_contact_name !== undefined) updateFields.push(sql`secondary_contact_name = ${data.secondary_contact_name}`);
      if (data.secondary_email !== undefined) updateFields.push(sql`secondary_email = ${data.secondary_email}`);
      if (data.secondary_phone !== undefined) updateFields.push(sql`secondary_phone = ${data.secondary_phone}`);
      // Entity configuration
      if (data.entities !== undefined) updateFields.push(sql`entities = ${data.entities}::text[]`);
      if (data.metadata !== undefined) updateFields.push(sql`metadata = ${JSON.stringify(data.metadata)}::jsonb`);
      if (data.active_flag !== undefined) updateFields.push(sql`active_flag = ${data.active_flag}`);

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated_ts = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.d_cust
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to update customer' });
      }

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - Sync registry if name/code changed
      // ═══════════════════════════════════════════════════════════════
      if (data.name !== undefined || data.code !== undefined) {
        await entityInfra.update_entity_instance_registry(ENTITY_TYPE, id, {
          entity_name: data.name,
          entity_code: data.code
        });
      }

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true};

      return filterUniversalColumns(result[0], userPermissions);
    } catch (error) {
      fastify.log.error('Error updating customer:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Delete Customer (Soft Delete via Factory)
  // ============================================================================
  createEntityDeleteEndpoint(fastify, ENTITY_TYPE);

  // ============================================================================
  // Child Entity Endpoints (Auto-Generated from entity metadata)
  // ============================================================================
  // Child entity routes auto-generated from entity metadata via factory
  await createChildEntityEndpointsFromMetadata(fastify, ENTITY_TYPE);
}