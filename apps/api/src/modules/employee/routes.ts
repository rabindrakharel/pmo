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
    searchFields: ['name', 'descr', 'email', 'code'],
    // Auto-generate defaults for required fields
    createDefaults: {
      code: () => {
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return `EMP-${timestamp}${random}`;
      },
      hire_date: () => new Date().toISOString().split('T')[0],
      dl__employee_employment_type: 'full-time'
    },
    hooks: {
      beforeCreate: async (ctx) => {
        const data = ctx.data;

        // Auto-generate email from code if not provided
        if (!data.email && data.code) {
          data.email = `employee-${data.code}@temp.huronhome.ca`;
        }

        // Generate name if not provided
        if (!data.name) {
          data.name = 'New Employee';
        }

        // Check for unique email
        if (data.email) {
          const existingEmail = await db.execute(sql`
            SELECT id FROM app.employee WHERE email = ${data.email} AND active_flag = true
          `);
          if (existingEmail.length > 0) {
            throw new Error('Employee with this email already exists');
          }
        }

        return data;
      }
    }
  });

  // All CRUD endpoints (LIST, GET, POST, PATCH, PUT, DELETE) are created by createUniversalEntityRoutes above
}