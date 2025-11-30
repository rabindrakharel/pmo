-- ============================================================================
-- ENTITY ID RBAC MAP - PERSON-BASED PERMISSION CONTROL SYSTEM
-- ============================================================================
--
-- TABLE TYPE: TRANSACTIONAL - HARD DELETE
-- This table uses HARD DELETE semantics (no active_flag column).
-- When permissions are revoked, records are physically deleted.
-- Record existence = permission granted. No record = no permission.
--
-- SEMANTICS:
-- Row-level RBAC system supporting BOTH role-based and employee-specific permissions.
-- Uses simple INTEGER permission level (0-5) with automatic hierarchical inheritance.
-- Permissions resolve via UNION of role permissions (via entity_instance_link) and direct employee permissions.
-- Higher permission levels automatically inherit all lower permissions (Owner [5] includes all permissions <=5).
--
-- PERMISSION RESOLUTION MODEL:
-- When checking permissions for employee_id, the system resolves via UNION and takes MAX:
--   1. Role-based permissions: employee → roles (via entity_instance_link) → permissions
--   2. Direct employee permissions: employee → permissions
--   Result: MAX(role permissions, employee permissions) - highest level wins
--
-- PERMISSION LEVEL MODEL (Integer 0-7):
--   permission = 0  → View:        Read access to entity data
--   permission = 1  → Comment:     Add comments on entities (INHERITS View)
--   permission = 3  → Contribute:  Form submission, task updates, wiki edits (INHERITS Comment + View)
--   permission = 3  → Edit:        Modify existing entity (same as Contribute)
--   permission = 4  → Share:       Share entity with others (INHERITS Edit + Contribute + Comment + View)
--   permission = 5  → Delete:      Soft delete entity (INHERITS Share + Edit + Contribute + Comment + View)
--   permission = 6  → Create:      Create new entities - requires entity_instance_id='11111111-1111-1111-1111-111111111111' (INHERITS all lower permissions)
--   permission = 7  → Owner:       Full control including permission management (INHERITS ALL permissions)
--
-- PERMISSION HIERARCHY (Automatic Inheritance):
--   Owner [7] >= Create [6] >= Delete [5] >= Share [4] >= Edit/Contribute [3] >= Comment [1] >= View [0]
--   Higher levels automatically include all lower permissions via >= comparison
--
-- PERMISSION CHECKS (using >= operator):
--   View:        permission >= 0  (everyone with any permission)
--   Comment:     permission >= 1  (everyone with any permission)
--   Contribute:  permission >= 3  (Edit, Share, Delete, Create, or Owner) -- Used for form submission, task updates, wiki edits
--   Edit:        permission >= 3  (Edit, Share, Delete, Create, or Owner)
--   Share:       permission >= 4  (Share, Delete, Create, or Owner)
--   Delete:      permission >= 5  (Delete, Create, or Owner)
--   Create:      permission >= 6  (Create or Owner)
--   Owner:       permission >= 7  (Only Owner)
--
-- ============================================================================

CREATE TABLE app.entity_rbac (
  id uuid DEFAULT gen_random_uuid(),

  -- Person-based permission mapping (supports employee, customer, vendor, supplier)
  person_code varchar(20), -- 'employee', 'customer', 'vendor', 'supplier'
  person_id uuid, -- References person.id

  -- Entity target
  entity_code varchar(50), -- Entity code (references entity.code): project, task, employee, office, business, worksite, customer, etc.
  entity_instance_id uuid, -- Specific entity instance UUID or '11111111-1111-1111-1111-111111111111' for type-level permissions

  -- Permission level (single integer 0-7 with hierarchical inheritance)
  permission integer DEFAULT 0,
  -- 0=View, 1=Comment, 3=Edit/Contribute, 4=Share, 5=Delete, 6=Create, 7=Owner (higher levels inherit all lower permissions)

  -- Permission lifecycle management
  granted_by__employee_id uuid, -- References employee.id (who granted this permission - delegation tracking)
  granted_ts timestamptz DEFAULT now(),
  expires_ts timestamptz, -- Optional expiration for temporary permissions

  -- Standard temporal fields
  created_ts timestamptz DEFAULT now(),
  updated_ts timestamptz DEFAULT now()
);

COMMENT ON TABLE app.entity_rbac IS 'Person-based RBAC system with integer permission levels: 0=View, 1=Comment, 3=Edit/Contribute, 4=Share, 5=Delete, 6=Create, 7=Owner. Higher levels automatically inherit all lower permissions via >= comparison. Supports employee, customer, vendor, and supplier permissions.';
COMMENT ON COLUMN app.entity_rbac.person_code IS 'Type of person: employee, customer, vendor, supplier';
COMMENT ON COLUMN app.entity_rbac.person_id IS 'UUID of person (references person.id)';
COMMENT ON COLUMN app.entity_rbac.entity_code IS 'Target entity code (references entity.code): project, task, employee, office, business, worksite, customer, service, product, order, invoice, etc.';
COMMENT ON COLUMN app.entity_rbac.entity_instance_id IS 'Target entity instance UUID for instance-level permissions, or "11111111-1111-1111-1111-111111111111" for type-level permissions granting access to ALL instances of the entity type';
COMMENT ON COLUMN app.entity_rbac.permission IS 'Permission level with automatic inheritance: 0=View, 1=Comment (implies View), 3=Edit/Contribute (implies Comment+View), 4=Share (implies Edit+Comment+View), 5=Delete (implies Share+Edit+Comment+View), 6=Create (implies all lower), 7=Owner (implies all permissions). Check using: permission >= required_level';
COMMENT ON COLUMN app.entity_rbac.granted_by__employee_id IS 'Employee who granted this permission - enables delegation tracking and audit trail';
COMMENT ON COLUMN app.entity_rbac.expires_ts IS 'Optional expiration timestamp for temporary permissions (contractor access, time-limited delegation)';

-- ============================================================================
-- RBAC PERMISSION FUNCTIONS
-- ============================================================================
--
-- ✅ DEPRECATED: SQL functions removed - replaced by API-based RBAC service
-- ✅ Location: /apps/api/src/lib/rbac.service.ts
--
-- ✅ Migration: SQL functions → TypeScript API functions
--   OLD: SELECT app.has_permission_on_entity_id(...)
--   NEW: import { hasPermissionOnEntityId } from '@/lib/rbac.service.js'
--
--   OLD: SELECT app.get_all_scope_by_entity_employee(...)
--   NEW: import { getAllScopeByEntityEmployee } from '@/lib/rbac.service.js'
--
-- ✅ Benefits:
--   - Reusable across all API routes (no code duplication)
--   - Type-safe TypeScript functions
--   - Easy to unit test and mock
--   - Consistent permission resolution logic
--   - Middleware pattern for operation gating
--
-- ✅ See documentation:
--   - /docs/entity_design_pattern/RBAC_API_MIGRATION_GUIDE.md
--   - /docs/entity_design_pattern/rbac.md
--
-- ============================================================================
-- DATA CURATION
-- ============================================================================
--
-- ⚠️  SEED DATA MOVED: RBAC permission seed data now located in:
--     db/48_rbac_seed_data.ddl
--
-- Reason: This file runs BEFORE d_role and d_employee tables are created,
--         so INSERT statements referencing those tables would fail.
--         Seed data file runs at the END of the import sequence.
--
-- ============================================================================
