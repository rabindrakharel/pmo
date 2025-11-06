-- =====================================================
-- ENTITY INSTANCE REGISTRY (d_entity_instance_id)
-- =====================================================
--
-- SEMANTICS:
-- • Central registry of all entity INSTANCES (not types - see d_entity for types)
-- • Auto-maintained via triggers: INSERT/UPDATE/DELETE on entity tables
-- • Powers global search, entity pickers, dashboard stats
--
-- OPERATIONS:
-- • REGISTER: Auto INSERT on entity creation (triggered)
-- • UPDATE: Auto sync entity_name/entity_code on source entity update (triggered)
-- • DEACTIVATE: Auto active_flag=false on source soft delete (triggered)
-- • SEARCH: GET /api/v1/search, full-text search across entity_name
-- • LIST: GET /api/v1/entity?entity_type=project, used for dropdowns/pickers
-- • VALIDATE: Check EXISTS before creating entity_id_map relationships
-- • STATS: Aggregate counts by entity_type for dashboard
--
-- KEY FIELDS:
-- • entity_type: varchar(50) ('project', 'task', 'employee', etc.)
-- • entity_id: text (UUID from source: d_project.id, d_task.id)
-- • entity_name, entity_code: text (synced from source)
-- • active_flag: boolean (synced from source)
--
-- =====================================================
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

CREATE TABLE app.d_entity_instance_id (
    entity_type varchar(50) NOT NULL,
    entity_id uuid NOT NULL,
    order_id int4 GENERATED ALWAYS AS IDENTITY, --ordering need only, sidebar ordering
    entity_name varchar(255) NOT NULL,
    entity_code varchar(100),
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    PRIMARY KEY (entity_type, entity_id)
);

-- Create indexes for common query patterns
CREATE INDEX idx_d_entity_instance_id_type ON app.d_entity_instance_id(entity_type);
CREATE INDEX idx_d_entity_instance_id_active ON app.d_entity_instance_id(active_flag) WHERE active_flag = true;
CREATE INDEX idx_d_entity_instance_id_name_search ON app.d_entity_instance_id USING gin(to_tsvector('english', entity_name));
CREATE INDEX idx_d_entity_instance_id_code ON app.d_entity_instance_id(entity_code) WHERE entity_code IS NOT NULL;

COMMENT ON TABLE app.d_entity_instance_id IS 'Central registry of all entity INSTANCES with their UUIDs for relationship mapping and global operations';

-- =====================================================
-- DATA CURATION
-- Populate registry from all 13 entity tables
-- =====================================================

-- Register office entities
INSERT INTO app.d_entity_instance_id (entity_type, entity_id, entity_name, entity_code)
SELECT 'office', id, name, code
FROM app.d_office WHERE active_flag = true;

-- Register business entities
INSERT INTO app.d_entity_instance_id (entity_type, entity_id, entity_name, entity_code)
SELECT 'business', id, name, code
FROM app.d_business WHERE active_flag = true;

-- Register project entities
INSERT INTO app.d_entity_instance_id (entity_type, entity_id, entity_name, entity_code)
SELECT 'project', id, name, code
FROM app.d_project WHERE active_flag = true;

-- Register task entities
INSERT INTO app.d_entity_instance_id (entity_type, entity_id, entity_name, entity_code)
SELECT 'task', id, name, code
FROM app.d_task WHERE active_flag = true;

-- Register employee entities
INSERT INTO app.d_entity_instance_id (entity_type, entity_id, entity_name, entity_code)
SELECT 'employee', id, name, code
FROM app.d_employee WHERE active_flag = true;

-- Register customer entities
INSERT INTO app.d_entity_instance_id (entity_type, entity_id, entity_name, entity_code)
SELECT 'cust', id, name, code
FROM app.d_cust WHERE active_flag = true;

-- Register role entities
INSERT INTO app.d_entity_instance_id (entity_type, entity_id, entity_name, entity_code)
SELECT 'role', id, name, code
FROM app.d_role WHERE active_flag = true;

-- Register position entities
INSERT INTO app.d_entity_instance_id (entity_type, entity_id, entity_name, entity_code)
SELECT 'position', id, name, code
FROM app.d_position WHERE active_flag = true;

-- Register worksite entities
INSERT INTO app.d_entity_instance_id (entity_type, entity_id, entity_name, entity_code)
SELECT 'worksite', id, name, code
FROM app.d_worksite WHERE active_flag = true;

-- Register wiki entities
INSERT INTO app.d_entity_instance_id (entity_type, entity_id, entity_name, entity_code)
SELECT 'wiki', id, name, code
FROM app.d_wiki WHERE active_flag = true;

-- Register artifact entities
INSERT INTO app.d_entity_instance_id (entity_type, entity_id, entity_name, entity_code)
SELECT 'artifact', id, name, code
FROM app.d_artifact WHERE active_flag = true;

-- Register form entities
INSERT INTO app.d_entity_instance_id (entity_type, entity_id, entity_name, entity_code)
SELECT 'form', id, name, code
FROM app.d_form_head WHERE active_flag = true;

-- Register reports entities
INSERT INTO app.d_entity_instance_id (entity_type, entity_id, entity_name, entity_code)
SELECT 'reports', id, name, code
FROM app.d_reports WHERE active_flag = true;
