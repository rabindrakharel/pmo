-- =====================================================
-- ENTITY INSTANCE TABLE (entity_instance)
-- Central registry of all entity INSTANCES with their IDs and metadata
-- =====================================================
--
-- BUSINESS PURPOSE:
-- Maintains a central registry of all entity instances across the system for unified operations,
-- global search, cross-entity relationships, and dashboard statistics. Acts as the authoritative
-- source of truth for entity instance existence and metadata. This is a TRANSACTIONAL TABLE with
-- HARD DELETE semantics - records are physically deleted when the source entity is deleted.
--
-- API SEMANTICS & LIFECYCLE:
--
-- 1. REGISTER ENTITY INSTANCE (Auto-created on Entity Creation)
--    • Trigger: When any entity is created (INSERT into d_project, d_task, d_employee, etc.)
--    • Database: INSERT INTO entity_instance (entity_code, entity_id, entity_name, code)
--    • Returns: Registry confirmation
--    • Business Rule: Automatic registration via database triggers on entity table INSERTs
--    • RBAC: Inherits from source entity creation permissions
--
-- 2. UPDATE ENTITY INSTANCE METADATA (Auto-synced on Entity Update)
--    • Trigger: When source entity is updated (UPDATE project.name, etc.)
--    • Database: UPDATE entity_instance SET entity_instance_name=$1, code=$2, updated_ts=now() WHERE entity_code=$3 AND entity_instance_id=$4
--    • SCD Behavior: IN-PLACE UPDATE
--      - Synchronizes name and code changes from source entity
--      - Maintains referential consistency across entity_instance_link and entity_rbac
--    • Business Rule: Automatic sync via database triggers on entity table UPDATEs
--
-- 3. DELETE ENTITY INSTANCE (Hard Delete on Source Entity Delete)
--    • Trigger: When source entity is deleted (DELETE from d_project, d_task, etc.)
--    • Database: DELETE FROM entity_instance WHERE entity_code=$1 AND entity_instance_id=$2
--    • Business Rule: Transactional table with hard delete; no audit trail in registry
--    • Cascade Effect: Cascades delete to entity_instance_link and entity_rbac entries
--
-- 4. GLOBAL SEARCH ACROSS ENTITY INSTANCES
--    • Endpoint: GET /api/v1/search?q=landscaping&entity_type=project,task&limit=20
--    • Database:
--      SELECT e.* FROM entity_instance e
--      WHERE e.entity_code = ANY($entity_types)
--        AND to_tsvector('english', e.entity_instance_name) @@ plainto_tsquery('english', $query)
--      ORDER BY ts_rank(to_tsvector('english', e.entity_instance_name), plainto_tsquery('english', $query)) DESC
--      LIMIT $1
--    • RBAC: Post-filters results against entity_rbac for current user
--    • Frontend: GlobalSearchBar renders unified results across entity types
--
-- 5. LIST ENTITY INSTANCES BY TYPE
--    • Endpoint: GET /api/v1/entity?entity_code=project&limit=50
--    • Database:
--      SELECT e.* FROM entity_instance e
--      WHERE e.entity_code=$1
--      ORDER BY e.updated_ts DESC
--      LIMIT $2 OFFSET $3
--    • Business Rule: Used for entity pickers, dropdown lists, and reference lookups
--    • Note: No active_flag filter needed - registry uses hard delete (records exist = active)
--
-- 6. VALIDATE ENTITY INSTANCE EXISTENCE
--    • Endpoint: GET /api/v1/entity/:entity_type/:entity_instance_id/exists
--    • Database: SELECT EXISTS(SELECT 1 FROM entity_instance WHERE entity_code=$1 AND entity_instance_id=$2)
--    • Business Rule: Used before creating entity_instance_link relationships to ensure referential integrity
--    • Example: Before linking task to project, validate project exists in entity_instance
--    • Note: No active_flag check needed - registry uses hard delete (existence = active)
--
-- 7. GET ENTITY INSTANCE TYPE COUNTS (Dashboard Stats)
--    • Endpoint: GET /api/v1/entity/stats
--    • Database:
--      SELECT entity_code, COUNT(*) AS count
--      FROM entity_instance
--      GROUP BY entity_code
--      ORDER BY count DESC
--    • Business Rule: Powers dashboard statistics and system health monitoring
--    • Frontend: DashboardStatCard displays entity counts
--    • Note: No active_flag filter needed - registry uses hard delete (all records are active)
--
-- NOTE: For parent-child entity TYPE relationships and metadata (icons, labels),
--       see entity.ddl which stores entity TYPE definitions
--
-- RELATIONSHIPS:
-- • (entity_code, entity_instance_id) ← entity_instance_link (parent-child relationships)
-- • (entity_code, entity_instance_id) ← entity_rbac (permission grants)
-- • Source tables: office, business, project, task, employee, cust, role, position,
--                  worksite, wiki, artifact, form, reports
--
-- =====================================================

--always current view, no scd
CREATE TABLE app.entity_instance (
    order_id int4 GENERATED ALWAYS AS IDENTITY, -- Ordering for sidebar display
    entity_code varchar(50), -- References entity.code (entity type: project, task, employee, etc.)
    entity_instance_id uuid, -- UUID of the specific entity instance, eg. project ID, task ID
    entity_instance_name varchar(255), -- Name of the instance (cached from source table)
    code varchar(100), -- Instance code (e.g., PROJ-001, EMP-123)
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);


COMMENT ON TABLE app.entity_instance IS 'Central registry of all entity INSTANCES with their UUIDs for relationship mapping and global operations';
COMMENT ON COLUMN app.entity_instance.entity_code IS 'Entity type code from entity.code (project, task, employee, etc.) - References entity table';
COMMENT ON COLUMN app.entity_instance.entity_instance_id IS 'Unique identifier (UUID) of the specific entity instance';
COMMENT ON COLUMN app.entity_instance.entity_instance_name IS 'Name of the entity instance (cached from source table for quick reference)';
COMMENT ON COLUMN app.entity_instance.code IS 'Instance code (e.g., PROJ-001, EMP-123) cached from source table for quick reference';

-- =====================================================
-- DATA CURATION
-- Populate registry from all 13 entity tables
-- =====================================================

-- Register office entities
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'office', id, name, code
FROM app.office;

-- Register business entities
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'business', id, name, code
FROM app.business;

-- Register project entities
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'project', id, name, code
FROM app.project;

-- Register task entities
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'task', id, name, code
FROM app.task;

-- Register employee entities
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'employee', id, name, code
FROM app.employee;

-- Register customer entities
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'customer', id, name, code
FROM app.cust;

-- Register role entities
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'role', id, name, code
FROM app.role;

-- Register position entities
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'position', id, name, code
FROM app.position;

-- Register worksite entities
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'worksite', id, name, code
FROM app.worksite;

-- Register wiki entities
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'wiki', id, name, code
FROM app.wiki;

-- Register artifact entities
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'artifact', id, name, code
FROM app.artifact;

-- Register form entities
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'form', id, name, code
FROM app.form;

