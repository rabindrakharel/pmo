-- ============================================================================
-- ENTITY INFRASTRUCTURE INDEXES
-- ============================================================================
-- Performance indexes for entity_instance, entity_instance_link, entity_rbac,
-- and entity tables based on query patterns in entity-infrastructure.service.ts
--
-- QUERY PATTERNS OPTIMIZED:
--   1. entity_instance lookups by (entity_code, entity_instance_id)
--   2. entity_instance_link parent→child and child→parent queries
--   3. entity_rbac permission checks (employee + role inheritance)
--   4. entity JSONB child_entity_codes containment queries
--
-- DATA VOLUMES (as of big_data.sql):
--   - entity_instance: ~34K records
--   - entity_instance_link: ~156K records
--   - entity_rbac: ~200K records
--   - entity: ~50 records
--
-- ============================================================================

-- ============================================================================
-- SECTION 1: entity_instance INDEXES
-- ============================================================================
-- Used by: validate_entity_instance_registry(), getEntityInstanceNames(),
--          getAllEntityInstanceNames(), set_entity_instance_registry()

-- Primary lookup pattern: (entity_code, entity_instance_id) - used in ~15 methods
-- CRITICAL: This is the most frequently hit pattern
CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_instance_code_id
ON app.entity_instance (entity_code, entity_instance_id);

-- Name lookups for dropdowns and search (getAllEntityInstanceNames)
-- ORDER BY entity_instance_name ASC
CREATE INDEX IF NOT EXISTS idx_entity_instance_code_name
ON app.entity_instance (entity_code, entity_instance_name);

-- Entity code only (for getEntityInstances grouped query)
CREATE INDEX IF NOT EXISTS idx_entity_instance_entity_code
ON app.entity_instance (entity_code);

-- ============================================================================
-- SECTION 2: entity_instance_link INDEXES
-- ============================================================================
-- Used by: get_entity_instance_link_children(), getAccessibleEntityIds(),
--          delete_entity(), role membership queries in RBAC CTEs

-- Parent → Child lookups (most common pattern)
-- Query: WHERE entity_code = X AND entity_instance_id = Y AND child_entity_code = Z
CREATE INDEX IF NOT EXISTS idx_entity_instance_link_parent
ON app.entity_instance_link (entity_code, entity_instance_id, child_entity_code);

-- Child → Parent lookups (for delete cascades and reverse navigation)
-- Query: WHERE child_entity_code = X AND child_entity_instance_id = Y
CREATE INDEX IF NOT EXISTS idx_entity_instance_link_child
ON app.entity_instance_link (child_entity_code, child_entity_instance_id);

-- Role → Employee membership (heavily used in RBAC CTEs)
-- Query: WHERE entity_code = 'role' AND child_entity_code = 'employee' AND child_entity_instance_id = ?
-- Partial index for this specific high-frequency pattern
CREATE INDEX IF NOT EXISTS idx_entity_instance_link_role_employee
ON app.entity_instance_link (entity_instance_id, child_entity_instance_id)
WHERE entity_code = 'role' AND child_entity_code = 'employee';

-- Unique constraint to prevent duplicate links
CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_instance_link_unique
ON app.entity_instance_link (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id);

-- ============================================================================
-- SECTION 3: entity_rbac INDEXES
-- ============================================================================
-- Used by: check_entity_rbac(), getMaxPermissionLevel(), getAccessibleEntityIds(),
--          delete_entity(), set_entity_rbac()
--
-- NOTE: idx_entity_rbac_unique_permission already exists (see 06_entity_rbac.ddl)
--       It handles: (person_code, person_id, entity_code, entity_instance_id)

-- Direct employee permission lookups (CTE: direct_emp)
-- Query: WHERE person_code = 'employee' AND person_id = ? AND entity_code = ?
CREATE INDEX IF NOT EXISTS idx_entity_rbac_employee_entity
ON app.entity_rbac (person_id, entity_code, entity_instance_id)
WHERE person_code = 'employee';

-- Role permission lookups (CTE: role_based)
-- Query: WHERE person_code = 'role' AND entity_code = ?
CREATE INDEX IF NOT EXISTS idx_entity_rbac_role_entity
ON app.entity_rbac (entity_code, entity_instance_id, person_id)
WHERE person_code = 'role';

-- Entity instance cleanup (for delete operations)
-- Query: WHERE entity_code = X AND entity_instance_id = Y
CREATE INDEX IF NOT EXISTS idx_entity_rbac_entity_instance
ON app.entity_rbac (entity_code, entity_instance_id);

-- Permission expiration filtering (commonly used in WHERE clauses)
-- Query: WHERE expires_ts IS NULL OR expires_ts > NOW()
-- Partial index for active (non-expired) permissions only
CREATE INDEX IF NOT EXISTS idx_entity_rbac_active_permissions
ON app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission)
WHERE expires_ts IS NULL;

-- ============================================================================
-- SECTION 4: entity TABLE INDEXES
-- ============================================================================
-- Used by: get_parent_entity_codes(), get_entity(), get_all_entity()
--
-- NOTE: entity_pkey (code) already exists as primary key

-- JSONB containment queries for child_entity_codes
-- Query: WHERE child_entity_codes @> '["task"]'::jsonb
-- GIN index for efficient JSONB containment operations
CREATE INDEX IF NOT EXISTS idx_entity_child_codes_gin
ON app.entity USING GIN (child_entity_codes jsonb_path_ops);

-- Active entities filter (used in most entity queries)
-- Query: WHERE active_flag = true ORDER BY display_order
CREATE INDEX IF NOT EXISTS idx_entity_active_order
ON app.entity (display_order, code)
WHERE active_flag = true;

-- ============================================================================
-- VERIFY INDEX CREATION
-- ============================================================================

DO $$
DECLARE
  idx_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO idx_count
  FROM pg_indexes
  WHERE schemaname = 'app'
    AND tablename IN ('entity', 'entity_instance', 'entity_instance_link', 'entity_rbac');

  RAISE NOTICE '============================================';
  RAISE NOTICE 'ENTITY INFRASTRUCTURE INDEXES CREATED';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Total indexes on infrastructure tables: %', idx_count;
  RAISE NOTICE '============================================';
END $$;
