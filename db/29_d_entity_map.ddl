-- =====================================================
-- ENTITY TYPE LINKAGE MAP TABLE (d_entity_map)
-- Valid parent-child entity TYPE relationships
-- Defines which entity types can be linked together
-- =====================================================
--
-- BUSINESS PURPOSE:
-- Maintains a registry of valid parent-child entity type relationships.
-- Acts as a reference table for validating entity_id_map entries and
-- ensuring only valid entity relationships are created in the system.
--
-- PARENT-CHILD ENTITY RELATIONSHIPS:
--   PARENT ENTITY     → CHILD ENTITIES
--   =====================================
--   business (biz)    → project
--   project           → task, artifact, wiki, form
--   office            → task, artifact, wiki, form
--   cust              → project, artifact, form
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
-- =====================================================

CREATE TABLE app.d_entity_map (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_entity_type varchar(20) NOT NULL,
    child_entity_type varchar(20) NOT NULL,
    from_ts timestamptz NOT NULL DEFAULT now(),
    to_ts timestamptz,
    active_flag boolean NOT NULL DEFAULT true,
    created_ts timestamptz NOT NULL DEFAULT now(),
    updated_ts timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE app.d_entity_map IS 'Defines valid parent-child entity TYPE relationships (e.g., "project" can contain "task")';

-- =====================================================
-- DATA CURATION: Valid Entity Type Relationships
-- Populated based on canonical parent-child mappings
-- =====================================================

-- Business → Project
INSERT INTO app.d_entity_map (id, parent_entity_type, child_entity_type) VALUES
('11111111-0000-0000-0000-000000000001', 'business', 'project'),
('11111111-0000-0000-0000-000000000002', 'biz', 'project');

-- Project → Task, Artifact, Wiki, Form
INSERT INTO app.d_entity_map (id, parent_entity_type, child_entity_type) VALUES
('22222222-0000-0000-0000-000000000001', 'project', 'task'),
('22222222-0000-0000-0000-000000000002', 'project', 'artifact'),
('22222222-0000-0000-0000-000000000003', 'project', 'wiki'),
('22222222-0000-0000-0000-000000000004', 'project', 'form');

-- Office → Task, Artifact, Wiki, Form
INSERT INTO app.d_entity_map (id, parent_entity_type, child_entity_type) VALUES
('33333333-0000-0000-0000-000000000001', 'office', 'task'),
('33333333-0000-0000-0000-000000000002', 'office', 'artifact'),
('33333333-0000-0000-0000-000000000003', 'office', 'wiki'),
('33333333-0000-0000-0000-000000000004', 'office', 'form');

-- Customer → Project, Artifact, Form
INSERT INTO app.d_entity_map (id, parent_entity_type, child_entity_type) VALUES
('44444444-0000-0000-0000-000000000001', 'cust', 'project'),
('44444444-0000-0000-0000-000000000002', 'cust', 'artifact'),
('44444444-0000-0000-0000-000000000003', 'cust', 'form');

-- Role → Employee
INSERT INTO app.d_entity_map (id, parent_entity_type, child_entity_type) VALUES
('55555555-0000-0000-0000-000000000001', 'role', 'employee');

-- Task → Form, Artifact
INSERT INTO app.d_entity_map (id, parent_entity_type, child_entity_type) VALUES
('66666666-0000-0000-0000-000000000001', 'task', 'form'),
('66666666-0000-0000-0000-000000000002', 'task', 'artifact');

-- Form → Artifact
INSERT INTO app.d_entity_map (id, parent_entity_type, child_entity_type) VALUES
('77777777-0000-0000-0000-000000000001', 'form', 'artifact');
