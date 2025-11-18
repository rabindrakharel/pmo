import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql, SQL } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import {
  getUniversalColumnMetadata,
  filterUniversalColumns,
  getColumnsByMetadata
} from '../../lib/universal-schema-metadata.js';
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

// Schema aligned with DDL: db/11_d_employee.ddl
// ONLY includes fields that exist as table columns
const EmployeeSchema = Type.Object({
  // Standard entity fields
  id: Type.String(),
  code: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  metadata: Type.Any(),  // JSONB - contains skills, certifications, etc.
  active_flag: Type.Boolean(),
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.String()),
  created_ts: Type.String(),
  updated_ts: Type.String(),
  version: Type.Number(),

  // Employee identification (DDL columns)
  email: Type.String(),
  first_name: Type.String(),
  last_name: Type.String(),

  // Contact information (DDL columns)
  phone: Type.Optional(Type.String()),
  mobile: Type.Optional(Type.String()),
  emergency_contact_name: Type.Optional(Type.String()),
  emergency_contact_phone: Type.Optional(Type.String()),

  // Address information (DDL columns)
  address_line1: Type.Optional(Type.String()),
  address_line2: Type.Optional(Type.String()),
  city: Type.Optional(Type.String()),
  province: Type.Optional(Type.String()),
  postal_code: Type.Optional(Type.String()),
  country: Type.Optional(Type.String()),

  // Employment details (DDL columns)
  employee_type: Type.String(),
  department: Type.Optional(Type.String()),
  title: Type.Optional(Type.String()),
  hire_date: Type.Optional(Type.String()),
  termination_date: Type.Optional(Type.String()),

  // Compensation and HR (DDL columns)
  salary_band: Type.Optional(Type.String()),
  pay_grade: Type.Optional(Type.String()),
  manager_employee_id: Type.Optional(Type.String()),

  // Compliance and tracking (DDL columns)
  sin: Type.Optional(Type.String()),
  birth_date: Type.Optional(Type.String()),  // DDL name (not date_of_birth)
  citizenship: Type.Optional(Type.String()),
  security_clearance: Type.Optional(Type.String()),

  // Work preferences (DDL columns)
  remote_work_eligible: Type.Optional(Type.Boolean()),  // DDL name (not remote_eligible)
  time_zone: Type.Optional(Type.String()),
  preferred_language: Type.Optional(Type.String())});

// CREATE schema - accepts DDL columns + metadata JSONB
const CreateEmployeeSchema = Type.Object({
  // Standard fields
  name: Type.Optional(Type.String({ minLength: 1 })),
  code: Type.Optional(Type.String({ minLength: 1 })),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),  // Flexible JSONB for skills, certifications, etc.
  active_flag: Type.Optional(Type.Boolean()),

  // Employee identification (DDL columns)
  email: Type.Optional(Type.String({ format: 'email' })),
  first_name: Type.Optional(Type.String({ minLength: 1 })),
  last_name: Type.Optional(Type.String({ minLength: 1 })),

  // Contact information (DDL columns)
  phone: Type.Optional(Type.String()),
  mobile: Type.Optional(Type.String()),
  emergency_contact_name: Type.Optional(Type.String()),
  emergency_contact_phone: Type.Optional(Type.String()),

  // Address information (DDL columns)
  address_line1: Type.Optional(Type.String()),
  address_line2: Type.Optional(Type.String()),
  city: Type.Optional(Type.String()),
  province: Type.Optional(Type.String()),
  postal_code: Type.Optional(Type.String()),
  country: Type.Optional(Type.String()),

  // Employment details (DDL columns)
  employee_type: Type.Optional(Type.String()),
  department: Type.Optional(Type.String()),
  title: Type.Optional(Type.String()),
  hire_date: Type.Optional(Type.String({ format: 'date' })),
  termination_date: Type.Optional(Type.String({ format: 'date' })),

  // Compensation and HR (DDL columns)
  salary_band: Type.Optional(Type.String()),
  pay_grade: Type.Optional(Type.String()),
  manager_employee_id: Type.Optional(Type.String({ format: 'uuid' })),

  // Compliance and tracking (DDL columns)
  sin: Type.Optional(Type.String()),
  birth_date: Type.Optional(Type.String({ format: 'date' })),  // DDL name
  citizenship: Type.Optional(Type.String()),
  security_clearance: Type.Optional(Type.String()),

  // Work preferences (DDL columns)
  remote_work_eligible: Type.Optional(Type.Boolean()),  // DDL name
  time_zone: Type.Optional(Type.String()),
  preferred_language: Type.Optional(Type.String())});

// UPDATE schema - accepts DDL columns (nullable for partial updates)
const UpdateEmployeeSchema = Type.Object({
  // Standard fields
  name: Type.Optional(Type.String({ minLength: 1 })),
  descr: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  metadata: Type.Optional(Type.Any()),
  active_flag: Type.Optional(Type.Boolean()),

  // Employee identification (DDL columns)
  email: Type.Optional(Type.String({ format: 'email' })),
  first_name: Type.Optional(Type.String({ minLength: 1 })),
  last_name: Type.Optional(Type.String({ minLength: 1 })),

  // Contact information (DDL columns)
  phone: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  mobile: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  emergency_contact_name: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  emergency_contact_phone: Type.Optional(Type.Union([Type.String(), Type.Null()])),

  // Address information (DDL columns)
  address_line1: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  address_line2: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  city: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  province: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  postal_code: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  country: Type.Optional(Type.Union([Type.String(), Type.Null()])),

  // Employment details (DDL columns)
  employee_type: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  department: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  title: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  hire_date: Type.Optional(Type.Union([Type.String({ format: 'date' }), Type.Null()])),
  termination_date: Type.Optional(Type.Union([Type.String({ format: 'date' }), Type.Null()])),

  // Compensation and HR (DDL columns)
  salary_band: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  pay_grade: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  manager_employee_id: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),

  // Compliance and tracking (DDL columns)
  sin: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  birth_date: Type.Optional(Type.Union([Type.String({ format: 'date' }), Type.Null()])),  // DDL name
  citizenship: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  security_clearance: Type.Optional(Type.Union([Type.String(), Type.Null()])),

  // Work preferences (DDL columns)
  remote_work_eligible: Type.Optional(Type.Boolean()),  // DDL name
  time_zone: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  preferred_language: Type.Optional(Type.Union([Type.String(), Type.Null()]))});

// ============================================================================
// Module-level constants (DRY - used across all endpoints)
// ============================================================================
const ENTITY_TYPE = 'employee';
const TABLE_ALIAS = 'e';

export async function empRoutes(fastify: FastifyInstance) {
  // ✨ Initialize Entity Infrastructure Service
  const entityInfra = getEntityInfrastructure(db);

  // List employees
  fastify.get('/api/v1/employee', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        active_flag: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        employee_type: Type.Optional(Type.String()),
        department: Type.Optional(Type.String()),
        remote_work_eligible: Type.Optional(Type.Boolean()),
        parent_type: Type.Optional(Type.String()),
        parent_id: Type.Optional(Type.String({ format: 'uuid' })),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 10000 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
        page: Type.Optional(Type.Number({ minimum: 1 }))}),
      response: {
        200: Type.Object({
          data: Type.Array(Type.Any()),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number()}),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    const { active_flag, search, employee_type, department, remote_work_eligible, parent_type, parent_id, limit = 50, offset: queryOffset, page } = request.query as any;

    // Support both page (new) and offset (legacy) parameters
    const offset = page ? (page - 1) * limit : (queryOffset || 0);

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // RBAC check - only show employees user has access to
      // No RBAC filtering - allow all authenticated users
      const conditions = [];

      // Parent filtering (create-link-edit pattern)
      if (parent_type && parent_id) {
        conditions.push(sql`eim.parent_entity_type = ${parent_type}`);
        conditions.push(sql`eim.parent_entity_id = ${parent_id}`);
        conditions.push(sql`eim.child_entity_type = 'employee'`);
        conditions.push(sql`eim.active_flag = true`);
      }

      if (active_flag !== undefined) {
        conditions.push(sql`e.active_flag = ${active_flag}`);
      }

      if (employee_type) {
        conditions.push(sql`e.dl__employee_employment_type = ${employee_type}`);
      }

      if (department) {
        conditions.push(sql`e.department = ${department}`);
      }

      if (remote_work_eligible !== undefined) {
        conditions.push(sql`e.remote_work_eligible_flag = ${remote_work_eligible}`);
      }

      if (search) {
        const searchConditions = [
          sql`COALESCE(e.name, '') ILIKE ${`%${search}%`}`,
          sql`COALESCE(e."descr", '') ILIKE ${`%${search}%`}`,
          sql`COALESCE(e.email, '') ILIKE ${`%${search}%`}`,
          sql`COALESCE(e.first_name, '') ILIKE ${`%${search}%`}`,
          sql`COALESCE(e.last_name, '') ILIKE ${`%${search}%`}`
        ];

        conditions.push(sql`(${sql.join(searchConditions, sql` OR `)})`);
      }

      // ✅ DEFAULT FILTER: Only show active records (not soft-deleted)
      // Can be overridden with ?active_flag=false to show inactive records
      if (!('active_flag' in (request.query as any))) {
        conditions.push(sql`e.active_flag = true`);
      }

      // Build queries with conditional JOIN (create-link-edit pattern)
      let countResult;
      let employees;

      if (parent_type && parent_id) {
        // Query WITH JOIN for parent filtering
        countResult = await db.execute(sql`
          SELECT COUNT(*) as total
          FROM app.employee e
          INNER JOIN app.entity_instance_link eim ON eim.child_entity_id = e.id
          ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        `);

        employees = await db.execute(sql`
          SELECT
            e.id, e.code, e.name, e."descr",
            COALESCE(e.metadata->'tags', '[]'::jsonb) as tags,
            e.from_ts, e.to_ts, e.active_flag, e.created_ts, e.updated_ts, e.version,
            e.email, e.phone, e.mobile, e.first_name, e.last_name,
            e.address_line1, e.address_line2, e.city, e.province, e.postal_code, e.country,
            e.dl__employee_employment_type as employee_type, e.department, e.title, e.hire_date, e.termination_date,
            e.salary_band, e.pay_grade, e.manager_employee_id,
            e.emergency_contact_name, e.emergency_contact_phone,
            e.sin, e.birth_date, e.dl__employee_citizenship_status as citizenship, e.dl__employee_security_clearance as security_clearance,
            e.remote_work_eligible_flag as remote_work_eligible, e.time_zone, e.preferred_language,
            COALESCE(e.metadata, '{}'::jsonb) as metadata
          FROM app.employee e
          INNER JOIN app.entity_instance_link eim ON eim.child_entity_id = e.id
          ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
          ORDER BY e.name ASC NULLS LAST, e.created_ts DESC
          LIMIT ${limit} OFFSET ${offset}
        `);
      } else {
        // Query WITHOUT JOIN for normal listing
        countResult = await db.execute(sql`
          SELECT COUNT(*) as total
          FROM app.employee e
          ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        `);

        employees = await db.execute(sql`
          SELECT
            e.id, e.code, e.name, e."descr",
            COALESCE(e.metadata->'tags', '[]'::jsonb) as tags,
            e.from_ts, e.to_ts, e.active_flag, e.created_ts, e.updated_ts, e.version,
            e.email, e.phone, e.mobile, e.first_name, e.last_name,
            e.address_line1, e.address_line2, e.city, e.province, e.postal_code, e.country,
            e.dl__employee_employment_type as employee_type, e.department, e.title, e.hire_date, e.termination_date,
            e.salary_band, e.pay_grade, e.manager_employee_id,
            e.emergency_contact_name, e.emergency_contact_phone,
            e.sin, e.birth_date, e.dl__employee_citizenship_status as citizenship, e.dl__employee_security_clearance as security_clearance,
            e.remote_work_eligible_flag as remote_work_eligible, e.time_zone, e.preferred_language,
            COALESCE(e.metadata, '{}'::jsonb) as metadata
          FROM app.employee e
          ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
          ORDER BY e.name ASC NULLS LAST, e.created_ts DESC
          LIMIT ${limit} OFFSET ${offset}
        `);
      }

      const total = Number(countResult[0]?.total || 0);

      // Ensure JSON fields are properly parsed and filter system columns
      const filteredData = employees.map(emp => ({
        ...emp,
        tags: Array.isArray(emp.tags) ? emp.tags : (emp.tags ? JSON.parse(emp.tags) : []),
        metadata: emp.metadata || {}
      }));

      return {
        data: filteredData,
        total,
        limit,
        offset};
    } catch (error) {
      fastify.log.error('Error fetching employees:', error);
      console.error('Employee endpoint error details:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single employee
  fastify.get('/api/v1/employee/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })}),
      response: {
        // Removed Type.Any() - let Fastify serialize naturally without schema validation
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    const { id } = request.params as { id: string };

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    // No RBAC check - allow all authenticated users

    try {
      const employee = await db.execute(sql`
        SELECT
          id, code, name, "descr",
          from_ts, to_ts, active_flag, created_ts, updated_ts, version,
          email, phone, mobile, first_name, last_name,
          address_line1, address_line2, city, province, postal_code, country,
          dl__employee_employment_type as employee_type, department, title, hire_date, termination_date,
          salary_band, pay_grade, manager_employee_id,
          emergency_contact_name, emergency_contact_phone,
          sin, birth_date, dl__employee_citizenship_status as citizenship, dl__employee_security_clearance as security_clearance,
          remote_work_eligible_flag as remote_work_eligible, time_zone, preferred_language,
          COALESCE(metadata, '{}'::jsonb) as metadata
        FROM app.employee
        WHERE id = ${id}
      `);

      fastify.log.info(`Employee query returned ${employee.length} results`);
      if (employee.length > 0) {
        fastify.log.info(`Employee data keys: ${Object.keys(employee[0]).join(', ')}`);
        fastify.log.info(`Employee raw data: ${JSON.stringify(employee[0]).substring(0, 200)}`);
      }

      if (employee.length === 0) {
        return reply.status(404).send({ error: 'Employee not found' });
      }

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
        canSeeSafetyInfo: true};

      const filtered = filterUniversalColumns(employee[0], userPermissions);
      fastify.log.info(`Filtered data keys: ${Object.keys(filtered).join(', ')}`);
      fastify.log.info(`Filtered data: ${JSON.stringify(filtered).substring(0, 200)}`);

      return reply.send(filtered);
    } catch (error) {
      fastify.log.error('Error fetching employee:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create employee
  fastify.post('/api/v1/employee', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateEmployeeSchema,
      querystring: Type.Object({
        parent_type: Type.Optional(Type.String()),
        parent_id: Type.Optional(Type.String({ format: 'uuid' }))
      }),
      response: {
        201: Type.Any(),
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String(), details: Type.Optional(Type.String()) })
      }
    }
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    const { parent_type, parent_id } = request.query as any;
    const data = request.body as any;
    fastify.log.info('CREATE EMPLOYEE ENDPOINT CALLED with data:', data);

    try {
      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC CHECK 1
      // Check: Can user CREATE employees?
      // ═══════════════════════════════════════════════════════════════
      const canCreate = await entityInfra.check_entity_rbac(
        userId,
        ENTITY_TYPE,
        ALL_ENTITIES_ID,
        Permission.CREATE
      );
      if (!canCreate) {
        return reply.status(403).send({ error: 'No permission to create employees' });
      }

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC CHECK 2
      // Check: If linking to parent, can user EDIT parent?
      // ═══════════════════════════════════════════════════════════════
      if (parent_type && parent_id) {
        const canEditParent = await entityInfra.check_entity_rbac(
          userId,
          parent_type,
          parent_id,
          Permission.EDIT
        );
        if (!canEditParent) {
          return reply.status(403).send({
            error: `No permission to link employee to this ${parent_type}`
          });
        }
      }

      // Auto-generate missing required fields
      if (!data.code) {
        // Generate unique employee code using timestamp to avoid collisions
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        data.code = `EMP-${timestamp}${random}`;
      }

      if (!data.email) {
        // Generate temporary email using code
        data.email = `employee-${data.code}@temp.huronhome.ca`;
      }

      if (!data.hire_date) {
        // Default to today
        data.hire_date = new Date().toISOString().split('T')[0];
      }

      if (!data.first_name || !data.last_name) {
        // Try to split name if provided
        if (data.name) {
          const nameParts = data.name.trim().split(' ');
          data.first_name = data.first_name || nameParts[0] || 'New';
          data.last_name = data.last_name || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Employee');
        } else {
          data.first_name = data.first_name || 'New';
          data.last_name = data.last_name || 'Employee';
        }
      }

      if (!data.name) {
        // Generate name from first_name and last_name
        data.name = `${data.first_name} ${data.last_name}`;
      }

      // Check for unique email if provided
      if (data.email) {
        const existingEmail = await db.execute(sql`
          SELECT id FROM app.employee WHERE email = ${data.email} AND active_flag = true
        `);
        if (existingEmail.length > 0) {
          return reply.status(400).send({ error: 'Employee with this email already exists' });
        }
      }

      console.log('=== About to INSERT employee ===');
      console.log('Code:', data.code);
      console.log('Name:', data.name);
      console.log('Email:', data.email);
      console.log('Hire date:', data.hire_date);
      console.log('Employment type:', data.employee_type || 'full-time');

      // ✅ ROUTE OWNS - INSERT into primary table
      const result = await db.execute(sql`
        INSERT INTO app.employee (
          code, name, "descr", email, phone,
          first_name, last_name, title, department,
          hire_date, termination_date, dl__employee_employment_type,
          manager_employee_id,
          metadata, active_flag
        )
        VALUES (
          ${data.code},
          ${data.name},
          ${data.descr || null},
          ${data.email},
          ${data.phone || null},
          ${data.first_name},
          ${data.last_name},
          ${data.title || null},
          ${data.department || null},
          ${data.hire_date},
          ${data.termination_date || null},
          ${data.employee_type || 'full-time'},
          ${data.manager_employee_id || null},
          ${data.metadata ? JSON.stringify(data.metadata) : '{}'}::jsonb,
          ${data.active_flag !== false}
        )
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to create employee' });
      }

      const newEmployee = result[0] as any;
      const employeeId = newEmployee.id;

      fastify.log.info('Employee created successfully:', newEmployee);

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - Register instance in registry
      // ═══════════════════════════════════════════════════════════════
      await entityInfra.set_entity_instance_registry({
        entity_type: ENTITY_TYPE,
        entity_id: employeeId,
        entity_name: newEmployee.name,
        entity_code: newEmployee.code
      });

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - Grant ownership to creator
      // ═══════════════════════════════════════════════════════════════
      await entityInfra.set_entity_rbac_owner(userId, ENTITY_TYPE, employeeId);

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - Link to parent (if provided)
      // ═══════════════════════════════════════════════════════════════
      if (parent_type && parent_id) {
        await entityInfra.set_entity_instance_link({
          parent_entity_type: parent_type,
          parent_entity_id: parent_id,
          child_entity_type: ENTITY_TYPE,
          child_entity_id: employeeId,
          relationship_type: 'contains'
        });
      }

      return reply.status(201).send(newEmployee);
    } catch (error) {
      fastify.log.error('Error creating employee:', error);
      console.error('EMPLOYEE CREATE ERROR:', error);
      return reply.status(500).send({ error: 'Internal server error', details: (error as any).message });
    }
  });

  // Update employee (PATCH)
  fastify.patch('/api/v1/employee/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })}),
      body: UpdateEmployeeSchema,
      response: {
        200: Type.Any(),
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
    const data = request.body as any;

    try {
      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC CHECK
      // Check: Can user EDIT this employee?
      // ═══════════════════════════════════════════════════════════════
      const canEdit = await entityInfra.check_entity_rbac(
        userId,
        ENTITY_TYPE,
        id,
        Permission.EDIT
      );
      if (!canEdit) {
        return reply.status(403).send({ error: 'No permission to edit this employee' });
      }

      const existing = await db.execute(sql`
        SELECT id FROM app.employee WHERE id = ${id}
      `);

      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Employee not found' });
      }

      const updateFields = [];

      // Standard fields
      if (data.name !== undefined) updateFields.push(sql`name = ${data.name}`);
      if (data.descr !== undefined) updateFields.push(sql`"descr" = ${data.descr}`);
      if (data.active_flag !== undefined) updateFields.push(sql`active_flag = ${data.active_flag}`);

      // Employee identification
      if (data.email !== undefined) updateFields.push(sql`email = ${data.email}`);
      if (data.first_name !== undefined) updateFields.push(sql`first_name = ${data.first_name}`);
      if (data.last_name !== undefined) updateFields.push(sql`last_name = ${data.last_name}`);

      // Contact information
      if (data.phone !== undefined) updateFields.push(sql`phone = ${data.phone}`);
      if (data.mobile !== undefined) updateFields.push(sql`mobile = ${data.mobile}`);
      if (data.emergency_contact_name !== undefined) updateFields.push(sql`emergency_contact_name = ${data.emergency_contact_name}`);
      if (data.emergency_contact_phone !== undefined) updateFields.push(sql`emergency_contact_phone = ${data.emergency_contact_phone}`);

      // Address information
      if (data.address_line1 !== undefined) updateFields.push(sql`address_line1 = ${data.address_line1}`);
      if (data.address_line2 !== undefined) updateFields.push(sql`address_line2 = ${data.address_line2}`);
      if (data.city !== undefined) updateFields.push(sql`city = ${data.city}`);
      if (data.province !== undefined) updateFields.push(sql`province = ${data.province}`);
      if (data.postal_code !== undefined) updateFields.push(sql`postal_code = ${data.postal_code}`);
      if (data.country !== undefined) updateFields.push(sql`country = ${data.country}`);

      // Employment details
      if (data.employee_type !== undefined) updateFields.push(sql`dl__employee_employment_type = ${data.employee_type}`);
      if (data.department !== undefined) updateFields.push(sql`department = ${data.department}`);
      if (data.title !== undefined) updateFields.push(sql`title = ${data.title}`);
      if (data.hire_date !== undefined) updateFields.push(sql`hire_date = ${data.hire_date}`);
      if (data.termination_date !== undefined) updateFields.push(sql`termination_date = ${data.termination_date}`);

      // Compensation and HR
      if (data.salary_band !== undefined) updateFields.push(sql`salary_band = ${data.salary_band}`);
      if (data.pay_grade !== undefined) updateFields.push(sql`pay_grade = ${data.pay_grade}`);
      if (data.manager_employee_id !== undefined) updateFields.push(sql`manager_employee_id = ${data.manager_employee_id}`);

      // Compliance and tracking
      if (data.sin !== undefined) updateFields.push(sql`sin = ${data.sin}`);
      if (data.birth_date !== undefined) updateFields.push(sql`birth_date = ${data.birth_date}`);
      if (data.citizenship !== undefined) updateFields.push(sql`dl__employee_citizenship_status = ${data.citizenship}`);
      if (data.security_clearance !== undefined) updateFields.push(sql`dl__employee_security_clearance = ${data.security_clearance}`);

      // Work preferences
      if (data.remote_work_eligible !== undefined) updateFields.push(sql`remote_work_eligible_flag = ${data.remote_work_eligible}`);
      if (data.time_zone !== undefined) updateFields.push(sql`time_zone = ${data.time_zone}`);
      if (data.preferred_language !== undefined) updateFields.push(sql`preferred_language = ${data.preferred_language}`);

      // Handle metadata - can be object or JSON string
      if (data.metadata !== undefined) {
        const metadataValue = typeof data.metadata === 'string' ? data.metadata : JSON.stringify(data.metadata);
        updateFields.push(sql`metadata = ${metadataValue}::jsonb`);
      }

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated_ts = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.employee
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to update employee' });
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
      fastify.log.error('Error updating employee:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update employee (PUT - alias for frontend compatibility)
  fastify.put('/api/v1/employee/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })}),
      body: UpdateEmployeeSchema,
      response: {
        200: Type.Any(),
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
    const data = request.body as any;

    try {
      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC CHECK
      // Check: Can user EDIT this employee?
      // ═══════════════════════════════════════════════════════════════
      const canEdit = await entityInfra.check_entity_rbac(
        userId,
        ENTITY_TYPE,
        id,
        Permission.EDIT
      );
      if (!canEdit) {
        return reply.status(403).send({ error: 'No permission to edit this employee' });
      }

      const existing = await db.execute(sql`
        SELECT id FROM app.employee WHERE id = ${id}
      `);

      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Employee not found' });
      }

      const updateFields = [];

      // Standard fields
      if (data.name !== undefined) updateFields.push(sql`name = ${data.name}`);
      if (data.descr !== undefined) updateFields.push(sql`"descr" = ${data.descr}`);
      if (data.active_flag !== undefined) updateFields.push(sql`active_flag = ${data.active_flag}`);

      // Employee identification
      if (data.email !== undefined) updateFields.push(sql`email = ${data.email}`);
      if (data.first_name !== undefined) updateFields.push(sql`first_name = ${data.first_name}`);
      if (data.last_name !== undefined) updateFields.push(sql`last_name = ${data.last_name}`);

      // Contact information
      if (data.phone !== undefined) updateFields.push(sql`phone = ${data.phone}`);
      if (data.mobile !== undefined) updateFields.push(sql`mobile = ${data.mobile}`);
      if (data.emergency_contact_name !== undefined) updateFields.push(sql`emergency_contact_name = ${data.emergency_contact_name}`);
      if (data.emergency_contact_phone !== undefined) updateFields.push(sql`emergency_contact_phone = ${data.emergency_contact_phone}`);

      // Address information
      if (data.address_line1 !== undefined) updateFields.push(sql`address_line1 = ${data.address_line1}`);
      if (data.address_line2 !== undefined) updateFields.push(sql`address_line2 = ${data.address_line2}`);
      if (data.city !== undefined) updateFields.push(sql`city = ${data.city}`);
      if (data.province !== undefined) updateFields.push(sql`province = ${data.province}`);
      if (data.postal_code !== undefined) updateFields.push(sql`postal_code = ${data.postal_code}`);
      if (data.country !== undefined) updateFields.push(sql`country = ${data.country}`);

      // Employment details
      if (data.employee_type !== undefined) updateFields.push(sql`dl__employee_employment_type = ${data.employee_type}`);
      if (data.department !== undefined) updateFields.push(sql`department = ${data.department}`);
      if (data.title !== undefined) updateFields.push(sql`title = ${data.title}`);
      if (data.hire_date !== undefined) updateFields.push(sql`hire_date = ${data.hire_date}`);
      if (data.termination_date !== undefined) updateFields.push(sql`termination_date = ${data.termination_date}`);

      // Compensation and HR
      if (data.salary_band !== undefined) updateFields.push(sql`salary_band = ${data.salary_band}`);
      if (data.pay_grade !== undefined) updateFields.push(sql`pay_grade = ${data.pay_grade}`);
      if (data.manager_employee_id !== undefined) updateFields.push(sql`manager_employee_id = ${data.manager_employee_id}`);

      // Compliance and tracking
      if (data.sin !== undefined) updateFields.push(sql`sin = ${data.sin}`);
      if (data.birth_date !== undefined) updateFields.push(sql`birth_date = ${data.birth_date}`);
      if (data.citizenship !== undefined) updateFields.push(sql`dl__employee_citizenship_status = ${data.citizenship}`);
      if (data.security_clearance !== undefined) updateFields.push(sql`dl__employee_security_clearance = ${data.security_clearance}`);

      // Work preferences
      if (data.remote_work_eligible !== undefined) updateFields.push(sql`remote_work_eligible_flag = ${data.remote_work_eligible}`);
      if (data.time_zone !== undefined) updateFields.push(sql`time_zone = ${data.time_zone}`);
      if (data.preferred_language !== undefined) updateFields.push(sql`preferred_language = ${data.preferred_language}`);

      // Handle metadata - can be object or JSON string
      if (data.metadata !== undefined) {
        const metadataValue = typeof data.metadata === 'string' ? data.metadata : JSON.stringify(data.metadata);
        updateFields.push(sql`metadata = ${metadataValue}::jsonb`);
      }

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated_ts = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.employee 
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to update employee' });
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
      fastify.log.error('Error updating employee:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // DELETE Employee (Soft Delete via Factory)
  // ============================================================================
  createEntityDeleteEndpoint(fastify, ENTITY_TYPE);

  // ============================================================================
  // Child Entity Endpoints (Auto-Generated from entity metadata)
  // ============================================================================
  await createChildEntityEndpointsFromMetadata(fastify, ENTITY_TYPE);
}