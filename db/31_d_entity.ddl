-- =====================================================
-- ENTITY REGISTRY TABLE (d_entity)
-- Central registry of all entity types and instances with metadata
-- =====================================================
--
-- BUSINESS PURPOSE:
-- Maintains a central registry of all entity instances across the system for unified operations,
-- global search, cross-entity relationships, and dashboard statistics. Acts as the authoritative
-- source of truth for entity existence, metadata, and active status.
--
-- API SEMANTICS & LIFECYCLE:
--
-- 1. REGISTER ENTITY (Auto-created on Entity Creation)
--    • Trigger: When any entity is created (INSERT into d_project, d_task, d_employee, etc.)
--    • Database: INSERT INTO d_entity (entity_type, entity_id, entity_name, entity_slug, entity_code)
--    • Returns: Registry confirmation
--    • Business Rule: Automatic registration via database triggers on entity table INSERTs
--    • RBAC: Inherits from source entity creation permissions
--
-- 2. UPDATE ENTITY METADATA (Auto-synced on Entity Update)
--    • Trigger: When source entity is updated (UPDATE d_project.name, etc.)
--    • Database: UPDATE d_entity SET entity_name=$1, entity_slug=$2, updated_ts=now() WHERE entity_type=$3 AND entity_id=$4
--    • SCD Behavior: IN-PLACE UPDATE
--      - Synchronizes name, slug, code changes from source entity
--      - Maintains referential consistency across entity_id_map and entity_id_rbac_map
--    • Business Rule: Automatic sync via database triggers on entity table UPDATEs
--
-- 3. DEACTIVATE ENTITY (Auto-synced on Soft Delete)
--    • Trigger: When source entity is soft deleted (UPDATE d_project.active_flag=false)
--    • Database: UPDATE d_entity SET active_flag=false, updated_ts=now() WHERE entity_type=$1 AND entity_id=$2
--    • Business Rule: Maintains referential integrity; preserves registry for audit
--    • Cascade Effect: Does NOT cascade delete (preserves entity_id_map and RBAC entries)
--
-- 4. GLOBAL SEARCH ACROSS ENTITIES
--    • Endpoint: GET /api/v1/search?q=landscaping&entity_type=project,task&limit=20
--    • Database:
--      SELECT e.* FROM d_entity e
--      WHERE e.active_flag=true
--        AND e.entity_type = ANY($entity_types)
--        AND to_tsvector('english', e.entity_name) @@ plainto_tsquery('english', $query)
--      ORDER BY ts_rank(to_tsvector('english', e.entity_name), plainto_tsquery('english', $query)) DESC
--      LIMIT $1
--    • RBAC: Post-filters results against entity_id_rbac_map for current user
--    • Frontend: GlobalSearchBar renders unified results across entity types
--
-- 5. LIST ENTITIES BY TYPE
--    • Endpoint: GET /api/v1/entity?entity_type=project&active_flag=true&limit=50
--    • Database:
--      SELECT e.* FROM d_entity e
--      WHERE e.entity_type=$1
--        AND e.active_flag=$2
--      ORDER BY e.updated_ts DESC
--      LIMIT $3 OFFSET $4
--    • Business Rule: Used for entity pickers, dropdown lists, and reference lookups
--
-- 6. VALIDATE ENTITY EXISTENCE
--    • Endpoint: GET /api/v1/entity/:entity_type/:entity_id/exists
--    • Database: SELECT EXISTS(SELECT 1 FROM d_entity WHERE entity_type=$1 AND entity_id=$2 AND active_flag=true)
--    • Business Rule: Used before creating entity_id_map relationships to ensure referential integrity
--    • Example: Before linking task to project, validate project exists in d_entity
--
-- 7. GET ENTITY TYPE COUNTS (Dashboard Stats)
--    • Endpoint: GET /api/v1/entity/stats
--    • Database:
--      SELECT entity_type, COUNT(*) AS count
--      FROM d_entity
--      WHERE active_flag=true
--      GROUP BY entity_type
--      ORDER BY count DESC
--    • Business Rule: Powers dashboard statistics and system health monitoring
--    • Frontend: DashboardStatCard displays entity counts
--
-- PARENT-CHILD ENTITY MAPPING:
--   This registry supports the following parent-child relationships
--   managed by entity_id_map for navigation and hierarchical operations.
--
--   PARENT ENTITY     → CHILD ENTITIES
--   =====================================
--   business (biz)    → project
--   project           → task, artifact, wiki, form
--   office            → task, artifact, wiki, form
--   client            → project, artifact, form
--   role              → employee
--   task              → form, artifact
--   form              → artifact
--   employee          → (no children)
--   wiki              → (no children)
--   artifact          → (no children)
--   worksite          → (no children, standalone)
--   position          → (no children, standalone)
--   reports           → (no children, standalone)
--
-- KEY FIELDS:
-- • entity_type: Entity classification ('office', 'business', 'project', 'task', 'employee', etc.)
-- • entity_id: UUID from source entity table (d_project.id, d_task.id, etc.)
-- • entity_name: Display name (synchronized from source entity)
-- • entity_slug: URL-friendly identifier (synchronized from source entity)
-- • entity_code: Business code/number (synchronized from source entity)
-- • active_flag: Operational status (synchronized from source entity soft delete)
-- • created_ts: Registry creation timestamp (never modified)
-- • updated_ts: Last synchronization timestamp (refreshed on UPDATE)
--
-- RELATIONSHIPS:
-- • (entity_type, entity_id) ← entity_id_map (parent-child relationships)
-- • (entity_type, entity_id) ← entity_id_rbac_map (permission grants)
-- • Source tables: d_office, d_business, d_project, d_task, d_employee, d_client, d_role, d_position,
--                  d_worksite, d_wiki, d_artifact, d_form_head, d_reports
--
-- =====================================================

CREATE TABLE app.d_entity (
    entity_type varchar(50) NOT NULL,
    entity_id uuid NOT NULL,
    order_id int4 GENERATED ALWAYS AS IDENTITY, --ordering need only, sidebar ordering
    entity_name varchar(255) NOT NULL,
    entity_slug varchar(100),
    entity_code varchar(100),
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    PRIMARY KEY (entity_type, entity_id)
);

-- Create indexes for common query patterns
CREATE INDEX idx_d_entity_type ON app.d_entity(entity_type);
CREATE INDEX idx_d_entity_active ON app.d_entity(active_flag) WHERE active_flag = true;
CREATE INDEX idx_d_entity_name_search ON app.d_entity USING gin(to_tsvector('english', entity_name));
CREATE INDEX idx_d_entity_code ON app.d_entity(entity_code) WHERE entity_code IS NOT NULL;

COMMENT ON TABLE app.d_entity IS 'Central registry of all entity types and instances for relationship mapping and global operations';

-- =====================================================
-- DATA CURATION
-- Populate registry from all 13 entity tables
-- =====================================================

-- Register office entities
INSERT INTO app.d_entity (entity_type, entity_id, entity_name, entity_slug, entity_code)
SELECT 'office', id, name, slug, code
FROM app.d_office WHERE active_flag = true;

-- Register business entities
INSERT INTO app.d_entity (entity_type, entity_id, entity_name, entity_slug, entity_code)
SELECT 'business', id, name, slug, code
FROM app.d_business WHERE active_flag = true;

-- Register project entities
INSERT INTO app.d_entity (entity_type, entity_id, entity_name, entity_slug, entity_code)
SELECT 'project', id, name, slug, code
FROM app.d_project WHERE active_flag = true;

-- Register task entities
INSERT INTO app.d_entity (entity_type, entity_id, entity_name, entity_slug, entity_code)
SELECT 'task', id, name, slug, code
FROM app.d_task WHERE active_flag = true;

-- Register employee entities
INSERT INTO app.d_entity (entity_type, entity_id, entity_name, entity_slug, entity_code)
SELECT 'employee', id, name, slug, code
FROM app.d_employee WHERE active_flag = true;

-- Register client entities
INSERT INTO app.d_entity (entity_type, entity_id, entity_name, entity_slug, entity_code)
SELECT 'client', id, name, slug, code
FROM app.d_client WHERE active_flag = true;

-- Register role entities
INSERT INTO app.d_entity (entity_type, entity_id, entity_name, entity_slug, entity_code)
SELECT 'role', id, name, slug, code
FROM app.d_role WHERE active_flag = true;

-- Register position entities
INSERT INTO app.d_entity (entity_type, entity_id, entity_name, entity_slug, entity_code)
SELECT 'position', id, name, slug, code
FROM app.d_position WHERE active_flag = true;

-- Register worksite entities
INSERT INTO app.d_entity (entity_type, entity_id, entity_name, entity_slug, entity_code)
SELECT 'worksite', id, name, slug, code
FROM app.d_worksite WHERE active_flag = true;

-- Register wiki entities
INSERT INTO app.d_entity (entity_type, entity_id, entity_name, entity_slug, entity_code)
SELECT 'wiki', id, name, slug, code
FROM app.d_wiki WHERE active_flag = true;

-- Register artifact entities
INSERT INTO app.d_entity (entity_type, entity_id, entity_name, entity_slug, entity_code)
SELECT 'artifact', id, name, slug, code
FROM app.d_artifact WHERE active_flag = true;

-- Register form entities
INSERT INTO app.d_entity (entity_type, entity_id, entity_name, entity_slug, entity_code)
SELECT 'form', id, name, slug, code
FROM app.d_form_head WHERE active_flag = true;

-- Register reports entities
INSERT INTO app.d_entity (entity_type, entity_id, entity_name, entity_slug, entity_code)
SELECT 'reports', id, name, slug, code
FROM app.d_reports WHERE active_flag = true;
