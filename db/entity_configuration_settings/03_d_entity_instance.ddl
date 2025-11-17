-- =====================================================
-- ENTITY INSTANCE TABLE (d_entity_instance)
-- Central registry of all entity INSTANCES with their IDs and metadata
-- =====================================================
--
-- BUSINESS PURPOSE:
-- Maintains a central registry of all entity instances across the system for unified operations,
-- global search, cross-entity relationships, and dashboard statistics. Acts as the authoritative
-- source of truth for entity instance existence, metadata, and active status.
--
-- API SEMANTICS & LIFECYCLE:
--
-- 1. REGISTER ENTITY INSTANCE (Auto-created on Entity Creation)
--    • Trigger: When any entity is created (INSERT into d_project, d_task, d_employee, etc.)
--    • Database: INSERT INTO d_entity_instance (entity_code, entity_id, entity_name, code)
--    • Returns: Registry confirmation
--    • Business Rule: Automatic registration via database triggers on entity table INSERTs
--    • RBAC: Inherits from source entity creation permissions
--
-- 2. UPDATE ENTITY INSTANCE METADATA (Auto-synced on Entity Update)
--    • Trigger: When source entity is updated (UPDATE d_project.name, etc.)
--    • Database: UPDATE d_entity_instance SET entity_name=$1, entity_code=$2, updated_ts=now() WHERE entity_code=$3 AND entity_id=$4
--    • SCD Behavior: IN-PLACE UPDATE
--      - Synchronizes name and code changes from source entity
--      - Maintains referential consistency across d_entity_instance_link and d_entity_rbac
--    • Business Rule: Automatic sync via database triggers on entity table UPDATEs
--
-- 3. DEACTIVATE ENTITY INSTANCE (Auto-synced on Soft Delete)
--    • Trigger: When source entity is soft deleted (UPDATE d_project.active_flag=false)
--    • Database: UPDATE d_entity_instance SET active_flag=false, updated_ts=now() WHERE entity_code=$1 AND entity_id=$2
--    • Business Rule: Maintains referential integrity; preserves registry for audit
--    • Cascade Effect: Does NOT cascade delete (preserves d_entity_instance_link and RBAC entries)
--
-- 4. GLOBAL SEARCH ACROSS ENTITY INSTANCES
--    • Endpoint: GET /api/v1/search?q=landscaping&entity_type=project,task&limit=20
--    • Database:
--      SELECT e.* FROM d_entity_instance e
--      WHERE e.active_flag=true
--        AND e.entity_code = ANY($entity_types)
--        AND to_tsvector('english', e.entity_name) @@ plainto_tsquery('english', $query)
--      ORDER BY ts_rank(to_tsvector('english', e.entity_name), plainto_tsquery('english', $query)) DESC
--      LIMIT $1
--    • RBAC: Post-filters results against d_entity_rbac for current user
--    • Frontend: GlobalSearchBar renders unified results across entity types
--
-- 5. LIST ENTITY INSTANCES BY TYPE
--    • Endpoint: GET /api/v1/entity?entity_code=project&active_flag=true&limit=50
--    • Database:
--      SELECT e.* FROM d_entity_instance e
--      WHERE e.entity_code=$1
--        AND e.active_flag=$2
--      ORDER BY e.updated_ts DESC
--      LIMIT $3 OFFSET $4
--    • Business Rule: Used for entity pickers, dropdown lists, and reference lookups
--
-- 6. VALIDATE ENTITY INSTANCE EXISTENCE
--    • Endpoint: GET /api/v1/entity/:entity_type/:entity_id/exists
--    • Database: SELECT EXISTS(SELECT 1 FROM d_entity_instance WHERE entity_code=$1 AND entity_id=$2 AND active_flag=true)
--    • Business Rule: Used before creating d_entity_instance_link relationships to ensure referential integrity
--    • Example: Before linking task to project, validate project exists in d_entity_instance
--
-- 7. GET ENTITY INSTANCE TYPE COUNTS (Dashboard Stats)
--    • Endpoint: GET /api/v1/entity/stats
--    • Database:
--      SELECT entity_type, COUNT(*) AS count
--      FROM d_entity_instance
--      WHERE active_flag=true
--      GROUP BY entity_type
--      ORDER BY count DESC
--    • Business Rule: Powers dashboard statistics and system health monitoring
--    • Frontend: DashboardStatCard displays entity counts
--
-- NOTE: For parent-child entity TYPE relationships and metadata (icons, labels),
--       see d_entity.ddl which stores entity TYPE definitions
--
-- RELATIONSHIPS:
-- • (entity_type, entity_id) ← d_entity_instance_link (parent-child relationships)
-- • (entity_type, entity_id) ← d_entity_rbac (permission grants)
-- • Source tables: d_office, d_business, d_project, d_task, d_employee, d_client, d_role, d_position,
--                  d_worksite, d_wiki, d_artifact, d_form_head, d_reports
--
-- =====================================================

CREATE TABLE app.d_entity_instance (
    entity_code varchar(50) NOT NULL, -- References d_entity.code (no FK for loose coupling)
    entity_id uuid NOT NULL,
    order_id int4 GENERATED ALWAYS AS IDENTITY, --ordering need only, sidebar ordering
    entity_name varchar(255) NOT NULL,
    code varchar(100), -- Instance code (e.g., PROJ-001, EMP-123)
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    PRIMARY KEY (entity_code, entity_id)
);


COMMENT ON TABLE app.d_entity_instance IS 'Central registry of all entity INSTANCES with their UUIDs for relationship mapping and global operations';
COMMENT ON COLUMN app.d_entity_instance.entity_code IS 'Entity type code from d_entity.code (project, task, employee, etc.)';
COMMENT ON COLUMN app.d_entity_instance.entity_id IS 'Unique identifier (UUID) of the specific entity instance';
COMMENT ON COLUMN app.d_entity_instance.entity_name IS 'Name of the entity instance (cached from source table)';
COMMENT ON COLUMN app.d_entity_instance.code IS 'Instance code (e.g., PROJ-001, EMP-123) cached from source table';

-- =====================================================
-- DATA CURATION
-- Populate registry from all 13 entity tables
-- =====================================================

-- Register office entities
INSERT INTO app.d_entity_instance (entity_code, entity_id, entity_name, code)
SELECT 'office', id, name, code
FROM app.d_office WHERE active_flag = true;

-- Register business entities
INSERT INTO app.d_entity_instance (entity_code, entity_id, entity_name, code)
SELECT 'business', id, name, code
FROM app.d_business WHERE active_flag = true;

-- Register project entities
INSERT INTO app.d_entity_instance (entity_code, entity_id, entity_name, code)
SELECT 'project', id, name, code
FROM app.d_project WHERE active_flag = true;

-- Register task entities
INSERT INTO app.d_entity_instance (entity_code, entity_id, entity_name, code)
SELECT 'task', id, name, code
FROM app.d_task WHERE active_flag = true;

-- Register employee entities
INSERT INTO app.d_entity_instance (entity_code, entity_id, entity_name, code)
SELECT 'employee', id, name, code
FROM app.d_employee WHERE active_flag = true;

-- Register customer entities
INSERT INTO app.d_entity_instance (entity_code, entity_id, entity_name, code)
SELECT 'cust', id, name, code
FROM app.d_cust WHERE active_flag = true;

-- Register role entities
INSERT INTO app.d_entity_instance (entity_code, entity_id, entity_name, code)
SELECT 'role', id, name, code
FROM app.d_role WHERE active_flag = true;

-- Register position entities
INSERT INTO app.d_entity_instance (entity_code, entity_id, entity_name, code)
SELECT 'position', id, name, code
FROM app.d_position WHERE active_flag = true;

-- Register worksite entities
INSERT INTO app.d_entity_instance (entity_code, entity_id, entity_name, code)
SELECT 'worksite', id, name, code
FROM app.d_worksite WHERE active_flag = true;

-- Register wiki entities
INSERT INTO app.d_entity_instance (entity_code, entity_id, entity_name, code)
SELECT 'wiki', id, name, code
FROM app.d_wiki WHERE active_flag = true;

-- Register artifact entities
INSERT INTO app.d_entity_instance (entity_code, entity_id, entity_name, code)
SELECT 'artifact', id, name, code
FROM app.d_artifact WHERE active_flag = true;

-- Register form entities
INSERT INTO app.d_entity_instance (entity_code, entity_id, entity_name, code)
SELECT 'form', id, name, code
FROM app.d_form_head WHERE active_flag = true;

-- Register reports entities
INSERT INTO app.d_entity_instance (entity_code, entity_id, entity_name, code)
SELECT 'reports', id, name, code
FROM app.d_reports WHERE active_flag = true;
