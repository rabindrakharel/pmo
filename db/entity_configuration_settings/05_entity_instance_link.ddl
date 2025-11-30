-- =====================================================
-- ENTITY INSTANCE LINKAGE (entity_instance_link)
-- =====================================================
--
-- SEMANTICS:
-- • Maps parent-child relationships between entity INSTANCES (no FKs)
-- • Enables flexible hierarchies, prevents cascade deletes, powers tabs
-- • Example: Project A → Task B, Business C → Project A
--
-- WHY NO FOREIGN KEYS:
-- • Flexible cross-schema linking without constraints
-- • Hard delete: when parent/child is deleted, linkage is removed
-- • Performance: no FK validation on inserts
-- • Transactional table: records exist = relationship exists
--
-- OPERATIONS:
-- • LINK: INSERT (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id)
-- • QUERY: JOIN to filter children by parent + type
-- • COUNT: GROUP BY child_entity_code for tab badges
-- • UNLINK: DELETE record (hard delete - child remains independent)
-- • REASSIGN: UPDATE entity_instance_id to move child
--
-- RELATIONSHIPS (NO FOREIGN KEYS):
-- • Polymorphic linkage table connecting any entity type to any other
-- • No direct foreign keys - uses text-based entity_code + entity_id pattern
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

CREATE TABLE app.entity_instance_link (
    id uuid DEFAULT gen_random_uuid(),
    entity_code varchar(50), -- References entity.code (parent entity type: project, office, business, etc.)
    entity_instance_id uuid, -- UUID of the parent entity instance
    child_entity_code varchar(50), -- References entity.code (child entity type: task, artifact, wiki, etc.)
    child_entity_instance_id uuid, -- UUID of the child entity instance
    relationship_type varchar(50) DEFAULT 'contains',
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);

COMMENT ON TABLE app.entity_instance_link IS 'Parent-child relationships between specific entity instances for navigation, filtering, and linkage management';
COMMENT ON COLUMN app.entity_instance_link.entity_code IS 'Entity type code of the parent (references entity.code)';
COMMENT ON COLUMN app.entity_instance_link.entity_instance_id IS 'UUID of the parent entity instance';
COMMENT ON COLUMN app.entity_instance_link.child_entity_code IS 'Entity type code of the child (references entity.code)';
COMMENT ON COLUMN app.entity_instance_link.child_entity_instance_id IS 'UUID of the child entity instance';

-- =====================================================
-- DATA CURATION: Port Existing Relationships
-- Populate from existing entity tables with parent-child links
-- =====================================================

-- Business → Project relationships
INSERT INTO app.entity_instance_link (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, relationship_type)
SELECT 'business', p.business_id, 'project', p.id, 'owns'
FROM app.project p
WHERE p.business_id IS NOT NULL AND p.active_flag = true;

-- Office → Business relationships
INSERT INTO app.entity_instance_link (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, relationship_type)
SELECT 'office', b.office_id, 'business', b.id, 'hosts'
FROM app.business b
WHERE b.office_id IS NOT NULL AND b.active_flag = true;

-- Project → Task relationships (Curated mappings based on task codes and project context)
-- Note: Not using task.project_id - tasks are explicitly mapped to relevant projects
INSERT INTO app.entity_instance_link (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, relationship_type)
VALUES
  -- Corporate Office Expansion Project
  ('project', '61203bac-101b-28d6-7a15-2176c15a0b1c', 'task', 'd1111111-1111-1111-1111-111111111111', NULL), -- Corporate Office Space Planning (COE-TASK-001)

  -- Digital Transformation Initiative 2024
  ('project', '93106ffb-402e-43a7-8b26-5287e37a1b0e', 'task', 'a2222222-2222-2222-2222-222222222222', NULL), -- PMO Software Vendor Evaluation (DT-TASK-002)
  ('project', '93106ffb-402e-43a7-8b26-5287e37a1b0e', 'task', 'e1111111-1111-1111-1111-111111111111', NULL), -- Customer Service Process Optimization (CSE-TASK-001)
  ('project', '93106ffb-402e-43a7-8b26-5287e37a1b0e', 'task', 'f1111111-1111-1111-1111-111111111111', NULL), -- Quarterly Business Performance Review (CEO-TASK-001)

  -- Fall 2024 Landscaping Campaign
  ('project', '84215ccb-313d-48f8-9c37-4398f28c0b1f', 'task', 'b1111111-1111-1111-1111-111111111111', NULL), -- Fall Campaign Marketing Strategy (FLC-TASK-001)
  ('project', '84215ccb-313d-48f8-9c37-4398f28c0b1f', 'task', 'b2222222-2222-2222-2222-222222222222', NULL), -- Fall Campaign Resource Planning (FLC-TASK-002)

  -- HVAC Equipment and Service Modernization
  ('project', '72304dab-202c-39e7-8a26-3287d26a0c2d', 'task', 'c1111111-1111-1111-1111-111111111111', NULL); -- Smart HVAC Market Research (HVAC-TASK-001)

-- Parent → Artifact relationships (using primary_entity_code and primary_entity_id)
INSERT INTO app.entity_instance_link (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, relationship_type)
SELECT a.primary_entity_code, a.primary_entity_id, 'artifact', a.id, 'contains'
FROM app.artifact a
WHERE a.primary_entity_id IS NOT NULL
  AND a.primary_entity_code IS NOT NULL
  AND a.active_flag = true;

-- Parent → Wiki relationships (using primary_entity_code and primary_entity_id)
INSERT INTO app.entity_instance_link (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, relationship_type)
SELECT w.primary_entity_code, w.primary_entity_id, 'wiki', w.id, 'documents'
FROM app.wiki w
WHERE w.primary_entity_id IS NOT NULL
  AND w.primary_entity_code IS NOT NULL
  AND w.active_flag = true;

-- Task → Form relationships (explicit linkages, no FK columns on form)
-- Forms are linked to parent tasks via entity_instance_link only
INSERT INTO app.entity_instance_link (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, relationship_type)
VALUES
  -- Landscaping Service Request Form → Fall Campaign Marketing Strategy task
  ('task', 'b1111111-1111-1111-1111-111111111111', 'form', 'ee8a6cfd-9d31-4705-b8f3-ad2d5589802c', 'uses'),
  -- PMO Vendor Evaluation Scorecard → PMO Software Vendor Evaluation task
  ('task', 'a2222222-2222-2222-2222-222222222222', 'form', 'ff8a7dfe-0e42-5816-c9g4-be3e6690913d', 'uses'),
  -- Customer Service Feedback Survey → Customer Service Process Optimization task
  ('task', 'e1111111-1111-1111-1111-111111111111', 'form', '11111111-aaaa-bbbb-cccc-dddddddddddd', 'uses'),
  -- HVAC Site Assessment Checklist → Smart HVAC Market Research task
  ('task', 'c1111111-1111-1111-1111-111111111111', 'form', '22222222-aaaa-bbbb-cccc-dddddddddddd', 'uses')
ON CONFLICT DO NOTHING;

-- Task → Employee relationships (Task Assignees)
-- All tasks assigned to James Miller
INSERT INTO app.entity_instance_link (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, relationship_type)
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
INSERT INTO app.entity_instance_link (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, relationship_type)
VALUES
    ('task', 'a2222222-2222-2222-2222-222222222222', 'quote', 'q1111111-1111-1111-1111-111111111111', 'contains'),
    ('task', 'b1111111-1111-1111-1111-111111111111', 'quote', 'q1111112-1111-1111-1111-111111111112', 'contains'),
    ('task', 'c1111111-1111-1111-1111-111111111111', 'quote', 'q2222221-2222-2222-2222-222222222221', 'contains'),
    ('task', 'd1111111-1111-1111-1111-111111111111', 'quote', 'q3333331-3333-3333-3333-333333333331', 'contains'),
    ('task', 'b2222222-2222-2222-2222-222222222222', 'quote', 'q4444441-4444-4444-4444-444444444441', 'contains'),
    ('task', 'e1111111-1111-1111-1111-111111111111', 'quote', 'q5555551-5555-5555-5555-555555555551', 'contains');

-- Task → Work Order relationships
-- Work orders are children of tasks
INSERT INTO app.entity_instance_link (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, relationship_type)
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
INSERT INTO app.entity_instance_link (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, relationship_type)
SELECT 'event', e.id, 'project', '93106ffb-402e-43a7-8b26-5287e37a1b0e'::uuid, 'relates_to'
FROM app.d_event e
WHERE e.code = 'EVT-HVAC-001'
ON CONFLICT (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id) DO NOTHING;

INSERT INTO app.entity_instance_link (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, relationship_type)
SELECT 'event', e.id, 'employee', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'::uuid, 'assigned_to'
FROM app.d_event e
WHERE e.code = 'EVT-HVAC-001'
ON CONFLICT (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id) DO NOTHING;

-- Example: Virtual Project Review event linked to project, task
INSERT INTO app.entity_instance_link (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, relationship_type)
SELECT 'event', e.id, 'project', p.id, 'relates_to'
FROM app.d_event e
CROSS JOIN app.d_project p
WHERE e.code = 'EVT-PROJ-002'
  AND p.code = 'PROJ-004'
ON CONFLICT (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id) DO NOTHING;

INSERT INTO app.entity_instance_link (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, relationship_type)
SELECT 'event', e.id, 'task', t.id, 'relates_to'
FROM app.d_event e
CROSS JOIN app.d_task t
WHERE e.code = 'EVT-PROJ-002'
  AND t.code = 'TASK-001'
ON CONFLICT (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id) DO NOTHING;

-- Example: Emergency Service event linked to service (if service entity exists)
-- Note: Add more linkages as services are created
-- INSERT INTO app.entity_instance_link (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, relationship_type)
-- SELECT 'event', e.id::text, 'service', s.id::text, 'provides'
-- FROM app.d_event e
-- CROSS JOIN app.d_service s
-- WHERE e.code = 'EVT-EMERG-003'
--   AND s.code = 'SVC-PLUMBING-001'
-- ON CONFLICT (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id) DO NOTHING;
