/**
 * ============================================================================
 * PERSON ROUTES MODULE - Universal Entity Pattern with Factory
 * ============================================================================
 *
 * Person represents authenticated users in the system. Each person can have
 * associated entity_code: 'employee', 'customer', 'vendor', or 'supplier'.
 *
 * All CRUD endpoints via Universal CRUD Factory:
 *   GET    /api/v1/person              - List persons
 *   GET    /api/v1/person/:id          - Get single person
 *   POST   /api/v1/person              - Create person
 *   PATCH  /api/v1/person/:id          - Update person
 *   PUT    /api/v1/person/:id          - Update person alias
 *   DELETE /api/v1/person/:id          - Delete person (soft delete)
 *
 * ============================================================================
 */

import type { FastifyInstance } from 'fastify';
import { createUniversalEntityRoutes } from '../../lib/universal-entity-crud-factory.js';

// ============================================================================
// MODULE CONSTANTS
// ============================================================================

const ENTITY_CODE = 'person';

// ============================================================================
// ROUTE REGISTRATION
// ============================================================================

export async function personRoutes(fastify: FastifyInstance) {
  // ════════════════════════════════════════════════════════════════════════════
  // UNIVERSAL CRUD ENDPOINTS (FACTORY)
  // ════════════════════════════════════════════════════════════════════════════

  createUniversalEntityRoutes(fastify, {
    entityCode: ENTITY_CODE,
    tableName: 'person',
    tableAlias: 'e',
    searchFields: ['name', 'email', 'code', 'entity_code'],
    codeField: 'code',
    nameField: 'name',
    requiredFields: ['email'],
    createDefaults: {
      active_flag: true,
      mfa_enabled_flag: false,
      email_verified_flag: false,
      phone_verified_flag: false,
      permanent_lock_flag: false,
      force_password_change_flag: false,
      data_processing_consent_flag: true,
      tos_accepted_flag: false,
      privacy_policy_accepted_flag: false,
      passkey_enabled_flag: false,
      biometric_enabled_flag: false,
      recovery_email_verified_flag: false,
      recovery_phone_verified_flag: false,
      failed_login_attempts: 0,
      login_count: 0,
      max_sessions: 5
    }
  });
  // All CRUD endpoints (LIST, GET, POST, PATCH, PUT, DELETE) are created by createUniversalEntityRoutes above
}
