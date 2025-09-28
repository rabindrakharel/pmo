-- =====================================================
-- ENTITY MAP TABLE
-- Central registry of all entity types and instances
-- =====================================================

CREATE TABLE app.entity_map (
    entity_type varchar(20) NOT NULL,
    entity_id uuid NOT NULL,
    entity_name varchar(255) NOT NULL,
    entity_slug varchar(100),
    entity_code varchar(50),
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    PRIMARY KEY (entity_type, entity_id)
);

-- Indexes for entity map
CREATE INDEX idx_entity_map_type ON app.entity_map(entity_type);
CREATE INDEX idx_entity_map_id ON app.entity_map(entity_id);
CREATE INDEX idx_entity_map_active ON app.entity_map(active_flag);
CREATE INDEX idx_entity_map_slug ON app.entity_map(entity_slug);
CREATE INDEX idx_entity_map_code ON app.entity_map(entity_code);

-- Update trigger for entity map
CREATE TRIGGER trg_entity_map_updated_ts BEFORE UPDATE ON app.entity_map
    FOR EACH ROW EXECUTE FUNCTION app.update_updated_ts();

-- Insert initial entity mappings for offices
INSERT INTO app.entity_map (entity_type, entity_id, entity_name, entity_slug, entity_code)
SELECT 'office', id, name, slug, office_code
FROM app.d_office WHERE active_flag = true;

-- Insert initial entity mappings for business units
INSERT INTO app.entity_map (entity_type, entity_id, entity_name, entity_slug, entity_code)
SELECT 'business', id, name, slug, biz_code
FROM app.d_business WHERE active_flag = true;

-- Insert initial entity mappings for projects
INSERT INTO app.entity_map (entity_type, entity_id, entity_name, entity_slug, entity_code)
SELECT 'project', id, name, slug, project_code
FROM app.d_project WHERE active_flag = true;

-- Insert initial entity mappings for tasks
INSERT INTO app.entity_map (entity_type, entity_id, entity_name, entity_slug, entity_code)
SELECT 'task', id, name, slug, task_code
FROM app.d_task WHERE active_flag = true;

COMMENT ON TABLE app.entity_map IS 'Central registry of all entity types and instances for relationship mapping';