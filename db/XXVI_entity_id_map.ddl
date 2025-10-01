-- =====================================================
-- ENTITY ID MAP TABLE
-- Parent-child relationships between entity instances
-- =====================================================

CREATE TABLE app.entity_id_map (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_entity_type varchar(20) NOT NULL,
    parent_entity_id uuid NOT NULL,
    child_entity_type varchar(20) NOT NULL,
    child_entity_id uuid NOT NULL,
    relationship_type varchar(50) DEFAULT 'contains',
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    UNIQUE(parent_entity_type, parent_entity_id, child_entity_type, child_entity_id)
);



-- Insert business-project relationships
INSERT INTO app.entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
SELECT 'business', p.biz_id, 'project', p.id, 'owns'
FROM app.d_project p
WHERE p.biz_id IS NOT NULL AND p.active_flag = true;

-- Insert office-business relationships
INSERT INTO app.entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
SELECT 'office', b.office_id, 'business', b.id, 'hosts'
FROM app.d_business b
WHERE b.office_id IS NOT NULL AND b.active_flag = true;

-- Insert project-task relationships
INSERT INTO app.entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
SELECT 'project', t.project_id, 'task', t.id, 'contains'
FROM app.d_task t
WHERE t.project_id IS NOT NULL AND t.active_flag = true;

-- Insert project-artifact relationships
INSERT INTO app.entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
SELECT 'project', a.project_id, 'artifact', a.id, 'contains'
FROM app.d_artifact a
WHERE a.project_id IS NOT NULL AND a.active_flag = true;

-- Insert project-wiki relationships
INSERT INTO app.entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
SELECT 'project', w.project_id, 'wiki', w.id, 'contains'
FROM app.d_wiki w
WHERE w.project_id IS NOT NULL AND w.active_flag = true;

-- Insert project-form relationships
INSERT INTO app.entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
SELECT 'project', f.project_id, 'form', f.id, 'contains'
FROM app.d_formlog f
WHERE f.project_id IS NOT NULL AND f.active_flag = true;

COMMENT ON TABLE app.entity_id_map IS 'Parent-child relationships between entity instances for navigation and filtering';