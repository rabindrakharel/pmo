/**
 * ============================================================================
 * EMPLOYEE ROUTES MODULE - Universal Entity Pattern with Factory
 * ============================================================================
 *
 * REFACTORED: Uses Universal CRUD Factory for GET (list), GET (single), and UPDATE endpoints.
 * CREATE endpoint remains custom due to entity-specific validation and auto-generation.
 *
 * ENDPOINTS:
 *   GET    /api/v1/employee              - List employees (FACTORY)
 *   GET    /api/v1/employee/:id          - Get single employee (FACTORY)
 *   POST   /api/v1/employee              - Create employee (CUSTOM - auto-generation)
 *   PATCH  /api/v1/employee/:id          - Update employee (FACTORY)
 *   PUT    /api/v1/employee/:id          - Update employee alias (FACTORY)
 *   DELETE /api/v1/employee/:id          - Delete employee (DELETE FACTORY)
 *   GET    /api/v1/employee/:id/{child}  - Child entities (CHILD FACTORY)
 *
 * ============================================================================
 */

import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

// ✨ Entity Infrastructure Service - centralized infrastructure operations
import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID } from '../../services/entity-infrastructure.service.js';

// ✨ Universal Entity CRUD Factory - consolidated endpoint generation
import { createUniversalEntityRoutes } from '../../lib/universal-entity-crud-factory.js';

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
  manager__employee_id: Type.Optional(Type.String()),

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
  manager__employee_id: Type.Optional(Type.String({ format: 'uuid' })),

  // Compliance and tracking (DDL columns)
  sin: Type.Optional(Type.String()),
  birth_date: Type.Optional(Type.String({ format: 'date' })),  // DDL name
  citizenship: Type.Optional(Type.String()),
  security_clearance: Type.Optional(Type.String()),

  // Work preferences (DDL columns)
  remote_work_eligible: Type.Optional(Type.Boolean()),  // DDL name
  time_zone: Type.Optional(Type.String()),
  preferred_language: Type.Optional(Type.String())});


// ============================================================================
// Module-level constants (DRY - used across all endpoints)
// ============================================================================
const ENTITY_CODE = 'employee';
const TABLE_ALIAS = 'e';

export async function empRoutes(fastify: FastifyInstance) {
  // ✨ Initialize Entity Infrastructure Service
  const entityInfra = getEntityInfrastructure(db);

  // ════════════════════════════════════════════════════════════════════════════
  // UNIVERSAL CRUD ENDPOINTS (FACTORY)
  // ════════════════════════════════════════════════════════════════════════════
  // Creates:
  // - GET /api/v1/employee         - List with RBAC, pagination, auto-filters, metadata
  // - GET /api/v1/employee/:id     - Single entity with RBAC, ref_data_entityInstance
  // - PATCH /api/v1/employee/:id   - Update with RBAC, registry sync
  // - PUT /api/v1/employee/:id     - Update alias
  //
  // Features:
  // - content=metadata support for metadata-only responses
  // - ref_data_entityInstance for entity reference resolution
  // - Universal auto-filters from query parameters
  // - Parent-child filtering via entity_instance_link
  // ════════════════════════════════════════════════════════════════════════════

  createUniversalEntityRoutes(fastify, {
    entityCode: ENTITY_CODE,
    tableName: 'employee',
    tableAlias: 'e',
    searchFields: ['name', 'descr', 'email', 'first_name', 'last_name', 'code']
  });

  // Create employee
  fastify.post('/api/v1/employee', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateEmployeeSchema,
      querystring: Type.Object({
        parent_entity_code: Type.Optional(Type.String()),
        parent_entity_instance_id: Type.Optional(Type.String({ format: 'uuid' }))
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

    const { parent_entity_code, parent_entity_instance_id } = request.query as any;
    const data = request.body as any;
    fastify.log.info('CREATE EMPLOYEE ENDPOINT CALLED with data:', data);

    try {
      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC CHECK 1
      // Check: Can user CREATE employees?
      // ═══════════════════════════════════════════════════════════════
      const canCreate = await entityInfra.check_entity_rbac(
        userId,
        ENTITY_CODE,
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
      if (parent_entity_code && parent_entity_instance_id) {
        const canEditParent = await entityInfra.check_entity_rbac(
          userId,
          parent_entity_code,
          parent_entity_instance_id,
          Permission.EDIT
        );
        if (!canEditParent) {
          return reply.status(403).send({
            error: `No permission to link employee to this ${parent_entity_code}`
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
          manager__employee_id,
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
          ${data.manager__employee_id || null},
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
        entity_code: ENTITY_CODE,
        entity_id: employeeId,
        entity_name: newEmployee.name,
        instance_code: newEmployee.code
      });

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - Grant ownership to creator
      // ═══════════════════════════════════════════════════════════════
      await entityInfra.set_entity_rbac_owner(userId, ENTITY_CODE, employeeId);

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - Link to parent (if provided)
      // ═══════════════════════════════════════════════════════════════
      if (parent_entity_code && parent_entity_instance_id) {
        await entityInfra.set_entity_instance_link({
          parent_entity_code: parent_entity_code,
          parent_entity_id: parent_entity_instance_id,
          child_entity_code: ENTITY_CODE,
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

  // DELETE endpoint is automatically created by createUniversalEntityRoutes above
}