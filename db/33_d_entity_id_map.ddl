-- =====================================================
-- ENTITY INSTANCE LINKAGE MAP (d_entity_id_map)
-- Parent-child relationships between specific entity instances (NO FOREIGN KEYS)
-- =====================================================
--
-- SEMANTICS:
-- Maps parent-child relationships between entity INSTANCES without foreign keys.
-- Enables flexible hierarchies, prevents cascade deletes, powers dynamic tabs and filtered queries.
-- Example: Project A (parent) → Task B (child), Business C → Project A
--
-- WHY NO FOREIGN KEYS?
-- • Flexibility: Link entities across schemas/databases without constraints
-- • Soft Deletes: Parent deletion doesn't cascade-delete children
-- • Temporal: Supports relationship versioning with from_ts/to_ts
-- • Performance: Avoids FK validation overhead on high-volume inserts
--
-- DATABASE BEHAVIOR:
-- • CREATE LINK: INSERT relationship when child entity is created or explicitly linked
--   Example: INSERT INTO d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id)
--            VALUES ('project', '93106ffb-...', 'task', 'a2222222-...')
--
-- • QUERY CHILDREN: JOIN to filter child entities by parent
--   Example: SELECT t.* FROM d_task t
--            INNER JOIN d_entity_id_map eim ON eim.child_entity_id = t.id::text
--            WHERE eim.parent_entity_id = '93106ffb-...' AND eim.parent_entity_type = 'project'
--              AND eim.child_entity_type = 'task' AND eim.active_flag = true
--
-- • COUNT CHILDREN: Aggregate for tab badges
--   Example: SELECT child_entity_type, COUNT(*) FROM d_entity_id_map
--            WHERE parent_entity_id = '93106ffb-...' AND active_flag = true
--            GROUP BY child_entity_type
--            → Results: task: 8, wiki: 3, form: 2
--
-- • UNLINK: Soft delete relationship (child entity remains accessible)
--   Example: UPDATE d_entity_id_map SET active_flag = false, to_ts = now()
--            WHERE parent_entity_id = '93106ffb-...' AND child_entity_id = 'a2222222-...'
--
-- • REASSIGN: Update parent_entity_id to move child to new parent
--   Example: UPDATE d_entity_id_map SET parent_entity_id = 'new-project-uuid', updated_ts = now()
--            WHERE child_entity_id = 'a2222222-...'
--
-- KEY FIELDS:
-- • id: uuid PRIMARY KEY
-- • parent_entity_type: varchar(20) NOT NULL ('project', 'business', 'office', 'client', ...)
-- • parent_entity_id: text NOT NULL (UUID as text: '93106ffb-402e-...')
-- • child_entity_type: varchar(20) NOT NULL ('task', 'wiki', 'artifact', 'form', 'employee', ...)
-- • child_entity_id: text NOT NULL (UUID as text: 'a2222222-2222-...')
-- • relationship_type: varchar(50) ('contains', 'owns', 'hosts', 'documents', 'assigned_to')
-- • active_flag: boolean DEFAULT true (soft delete control)
-- • UNIQUE(parent_entity_type, parent_entity_id, child_entity_type, child_entity_id)
--
-- VALID PARENT-CHILD RELATIONSHIPS:
--   PARENT         → CHILDREN
--   ==================================
--   business       → project
--   project        → task, artifact, wiki, form
--   office         → business, task, artifact, wiki, form
--   client         → project, artifact, form
--   role           → employee
--   task           → form, artifact, employee (assignees)
--   form           → artifact
--
-- FRONTEND INTEGRATION:
-- • EntityDetailPage: Dynamic tabs with child counts (Tasks (8), Wiki (3), Forms (2))
-- • EntityChildListPage: Filtered child list views
-- • LinkagePage: UI for creating/removing relationships
--
-- =====================================================

CREATE TABLE app.d_entity_id_map (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_entity_type varchar(20) NOT NULL,
    parent_entity_id text NOT NULL,
    child_entity_type varchar(20) NOT NULL,
    child_entity_id text NOT NULL,
    relationship_type varchar(50) DEFAULT 'contains',
    from_ts timestamptz NOT NULL DEFAULT now(),
    to_ts timestamptz,
    active_flag boolean NOT NULL DEFAULT true,
    created_ts timestamptz NOT NULL DEFAULT now(),
    updated_ts timestamptz NOT NULL DEFAULT now(),
    UNIQUE(parent_entity_type, parent_entity_id, child_entity_type, child_entity_id)
);

-- Indexes for common query patterns
CREATE INDEX idx_d_entity_id_map_parent ON app.d_entity_id_map(parent_entity_type, parent_entity_id) WHERE active_flag = true;
CREATE INDEX idx_d_entity_id_map_child ON app.d_entity_id_map(child_entity_type, child_entity_id) WHERE active_flag = true;
CREATE INDEX idx_d_entity_id_map_active ON app.d_entity_id_map(active_flag) WHERE active_flag = true;

COMMENT ON TABLE app.d_entity_id_map IS 'Parent-child relationships between specific entity instances for navigation, filtering, and linkage management';

-- =====================================================
-- DATA CURATION: Port Existing Relationships
-- Populate from existing entity tables with parent-child links
-- =====================================================

-- Business → Project relationships
INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
SELECT 'business', p.business_id::text, 'project', p.id::text, 'owns'
FROM app.d_project p
WHERE p.business_id IS NOT NULL AND p.active_flag = true;

-- Office → Business relationships
INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
SELECT 'office', b.office_id::text, 'business', b.id::text, 'hosts'
FROM app.d_business b
WHERE b.office_id IS NOT NULL AND b.active_flag = true;

-- Project → Task relationships
INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
SELECT 'project', t.project_id::text, 'task', t.id::text, 'contains'
FROM app.d_task t
WHERE t.project_id IS NOT NULL AND t.active_flag = true;

-- Parent → Artifact relationships (using primary_entity_type and primary_entity_id)
INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
SELECT a.primary_entity_type, a.primary_entity_id::text, 'artifact', a.id::text, 'contains'
FROM app.d_artifact a
WHERE a.primary_entity_id IS NOT NULL
  AND a.primary_entity_type IS NOT NULL
  AND a.active_flag = true;

-- Parent → Wiki relationships (using primary_entity_type and primary_entity_id)
INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
SELECT w.primary_entity_type, w.primary_entity_id::text, 'wiki', w.id::text, 'documents'
FROM app.d_wiki w
WHERE w.primary_entity_id IS NOT NULL
  AND w.primary_entity_type IS NOT NULL
  AND w.active_flag = true;

-- Parent → Form relationships (using primary_entity_type and primary_entity_id)
INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
SELECT f.primary_entity_type, f.primary_entity_id::text, 'form', f.id::text, 'uses'
FROM app.d_form_head f
WHERE f.primary_entity_id IS NOT NULL
  AND f.primary_entity_type IS NOT NULL
  AND f.active_flag = true;

-- Task → Employee relationships (Task Assignees)
-- All tasks assigned to James Miller
INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
VALUES
    ('task', 'a1111111-1111-1111-1111-111111111111', 'employee', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', 'assigned_to'),
    ('task', 'a2222222-2222-2222-2222-222222222222', 'employee', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', 'assigned_to'),
    ('task', 'b1111111-1111-1111-1111-111111111111', 'employee', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', 'assigned_to'),
    ('task', 'b2222222-2222-2222-2222-222222222222', 'employee', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', 'assigned_to'),
    ('task', 'c1111111-1111-1111-1111-111111111111', 'employee', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', 'assigned_to'),
    ('task', 'd1111111-1111-1111-1111-111111111111', 'employee', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', 'assigned_to'),
    ('task', 'e1111111-1111-1111-1111-111111111111', 'employee', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', 'assigned_to'),
    ('task', 'f1111111-1111-1111-1111-111111111111', 'employee', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', 'assigned_to');

-- Task → Quote relationships
-- Quotes are children of tasks
INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
VALUES
    ('task', 'a2222222-2222-2222-2222-222222222222', 'quote', 'q1111111-1111-1111-1111-111111111111', 'contains'),
    ('task', 'b1111111-1111-1111-1111-111111111111', 'quote', 'q1111112-1111-1111-1111-111111111112', 'contains'),
    ('task', 'c1111111-1111-1111-1111-111111111111', 'quote', 'q2222221-2222-2222-2222-222222222221', 'contains'),
    ('task', 'd1111111-1111-1111-1111-111111111111', 'quote', 'q3333331-3333-3333-3333-333333333331', 'contains'),
    ('task', 'b2222222-2222-2222-2222-222222222222', 'quote', 'q4444441-4444-4444-4444-444444444441', 'contains'),
    ('task', 'e1111111-1111-1111-1111-111111111111', 'quote', 'q5555551-5555-5555-5555-555555555551', 'contains');

-- Task → Work Order relationships
-- Work orders are children of tasks
INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
VALUES
    ('task', 'a2222222-2222-2222-2222-222222222222', 'work_order', 'w1111111-1111-1111-1111-111111111111', 'contains'),
    ('task', 'b1111111-1111-1111-1111-111111111111', 'work_order', 'w1111112-1111-1111-1111-111111111112', 'contains'),
    ('task', 'c1111111-1111-1111-1111-111111111111', 'work_order', 'w2222221-2222-2222-2222-222222222221', 'contains'),
    ('task', 'd1111111-1111-1111-1111-111111111111', 'work_order', 'w3333331-3333-3333-3333-333333333331', 'contains'),
    ('task', 'e1111111-1111-1111-1111-111111111111', 'work_order', 'w4444441-4444-4444-4444-444444444441', 'contains'),
    ('task', 'b2222222-2222-2222-2222-222222222222', 'work_order', 'w5555551-5555-5555-5555-555555555551', 'contains');
