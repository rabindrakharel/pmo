-- =====================================================
-- ENTITY INSTANCE LINKAGE (d_entity_id_map)
-- =====================================================
--
-- SEMANTICS:
-- • Maps parent-child relationships between entity INSTANCES (no FKs)
-- • Enables flexible hierarchies, prevents cascade deletes, powers tabs
-- • Example: Project A → Task B, Business C → Project A
--
-- WHY NO FOREIGN KEYS:
-- • Flexible cross-schema linking without constraints
-- • Soft deletes: parent deletion preserves children
-- • Temporal versioning (from_ts/to_ts)
-- • Performance: no FK validation on inserts
--
-- OPERATIONS:
-- • LINK: INSERT (parent_type, parent_id, child_type, child_id)
-- • QUERY: JOIN to filter children by parent + type
-- • COUNT: GROUP BY child_entity_type for tab badges
-- • UNLINK: active_flag=false, to_ts=now() (child remains)
-- • REASSIGN: UPDATE parent_entity_id to move child
--
-- KEY FIELDS:
-- • id: uuid PRIMARY KEY
-- • parent_entity_type, parent_entity_id: varchar(20), text
-- • child_entity_type, child_entity_id: varchar(20), text
-- • relationship_type: varchar(50) (contains, owns, assigned_to)
-- • relationship_nature_id: integer (5 = owner/creator)
-- • active_flag: boolean (soft delete)
--
-- RELATIONSHIPS (NO FOREIGN KEYS):
-- • Polymorphic linkage table connecting any entity type to any other
-- • No direct foreign keys - uses text-based entity_type + entity_id pattern
--
-- VALID RELATIONSHIP EXAMPLES:
-- • event → task, project, service, cust, employee, business, artifact, form, wiki, office
-- • business → project
-- • project → task, wiki, artifact, form, cost, revenue
-- • office → business, task, artifact, wiki, form, cost, revenue
-- • cust → project, artifact, form, cost, revenue
-- • role → employee
-- • task → form, artifact, employee, cost, revenue
-- • form → artifact
-- • quote → work_order
-- • order → invoice, shipment
--
-- =====================================================

CREATE TABLE app.d_entity_id_map (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_entity_type varchar(20) NOT NULL,
    parent_entity_id text NOT NULL,
    child_entity_type varchar(20) NOT NULL,
    child_entity_id text NOT NULL,
    relationship_type varchar(50) DEFAULT 'contains',
    relationship_nature_id integer,
    metadata jsonb DEFAULT '{}'::jsonb,
    from_ts timestamptz NOT NULL DEFAULT now(),
    to_ts timestamptz,
    active_flag boolean NOT NULL DEFAULT true,
    created_ts timestamptz NOT NULL DEFAULT now(),
    updated_ts timestamptz NOT NULL DEFAULT now(),
    version integer DEFAULT 1
);

COMMENT ON TABLE app.d_entity_id_map IS 'Parent-child relationships between specific entity instances for navigation, filtering, and linkage management';
COMMENT ON COLUMN app.d_entity_id_map.relationship_nature_id IS 'Nature of relationship: 5 = owner/creator (event → employee means employee owns/created the event)';

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

-- Event → Entity relationships
-- Events are universal parent entities that can be linked to multiple entity types
-- Example: HVAC Consultation event linked to project, customer, employee
INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
SELECT 'event', e.id::text, 'project', '93106ffb-402e-43a7-8b26-5287e37a1b0e'::text, 'relates_to'
FROM app.d_event e
WHERE e.code = 'EVT-HVAC-001'
ON CONFLICT (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id) DO NOTHING;

INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
SELECT 'event', e.id::text, 'employee', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'::text, 'assigned_to'
FROM app.d_event e
WHERE e.code = 'EVT-HVAC-001'
ON CONFLICT (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id) DO NOTHING;

-- Example: Virtual Project Review event linked to project, task
INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
SELECT 'event', e.id::text, 'project', p.id::text, 'relates_to'
FROM app.d_event e
CROSS JOIN app.d_project p
WHERE e.code = 'EVT-PROJ-002'
  AND p.code = 'PROJ-004'
ON CONFLICT (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id) DO NOTHING;

INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
SELECT 'event', e.id::text, 'task', t.id::text, 'relates_to'
FROM app.d_event e
CROSS JOIN app.d_task t
WHERE e.code = 'EVT-PROJ-002'
  AND t.code = 'TASK-001'
ON CONFLICT (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id) DO NOTHING;

-- Example: Emergency Service event linked to service (if service entity exists)
-- Note: Add more linkages as services are created
-- INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
-- SELECT 'event', e.id::text, 'service', s.id::text, 'provides'
-- FROM app.d_event e
-- CROSS JOIN app.d_service s
-- WHERE e.code = 'EVT-EMERG-003'
--   AND s.code = 'SVC-PLUMBING-001'
-- ON CONFLICT (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id) DO NOTHING;
