-- ============================================================================
-- ENTITY ID MAPPING RELATIONSHIP TABLE
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Tracks actual instance-level parent-child relationships between specific entities
--   in the PMO system. While meta_entity_hierarchy defines "what can be created where",
--   this table tracks "what actually exists where" with specific entity IDs and
--   temporal tracking for organizational changes over time.
--
-- DDL Structure:
--   - action_entity_id: UUID of the child entity instance
--   - action_entity: Type of the child entity (from meta_entity_types.entity_type_code)
--   - parent_entity_id: UUID of the parent entity instance (nullable for root entities)
--   - parent_entity: Type of the parent entity (from meta_entity_types.entity_type_code)
--   - Temporal tracking: from_ts, to_ts, active for SCD Type 2 history
--   - Audit fields: created, updated timestamps
--
-- Entity Types (All 12 from meta_entity_types):
--   Organizational: hr, biz, org, client
--   Operational: project, task, worksite  
--   Personnel: employee, role
--   Content: wiki, form, artifact
--
-- Relationship Patterns:
--   - Hierarchical: Parent-child relationships within same entity type (biz→biz, org→org)
--   - Cross-dimensional: Relationships across different entity types (biz→project, project→task)
--   - Temporal: Time-based relationship tracking with SCD Type 2 for organizational changes
--   - Root Entities: Entries with parent_entity_id=NULL and parent_entity=NULL
--
-- Data Validation Rules:
--   - Parent Relationship Rule: If parent_entity_id is specified, parent_entity must also be specified
--   - Temporal Range Rule: If to_ts is specified, it must be greater than from_ts
--   - Entity Type Validation: action_entity and parent_entity must exist in meta_entity_types
--   - Hierarchy Compliance: Relationships should conform to meta_entity_hierarchy rules
--
-- Table Relationships & Integration:
--   - FOUNDATION: Uses action_entity/parent_entity values from meta_entity_types for validation
--   - HIERARCHY RULES: Should conform to relationships defined in meta_entity_hierarchy
--   - PERMISSION VALIDATION: Referenced by rel_employee_entity_action_rbac to ensure permissions apply to valid entity instances
--   - ACCESS SCOPING: Provides the actual parent_entity_id/action_entity_id pairs that define permission boundaries
--   - INSTANCE TRACKING: Maintains temporal record of entity relationships supporting organizational changes over time
--   - QUERY FOUNDATION: Enables breadcrumb navigation, hierarchical filtering, and scope-based data access patterns

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.entity_id_hierarchy_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Entity identification
  action_entity_id uuid NOT NULL,
  action_entity text NOT NULL,
  
  -- Parent relationship
  parent_entity_id uuid,
  parent_entity text,
  
  -- Temporal tracking (SCD Type 2)
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);


-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Comprehensive entity relationship mappings for Huron Home Services
-- These mappings define the actual parent-child relationships between entity instances

-- Business unit hierarchy relationships (biz → biz self-referential)
INSERT INTO app.entity_id_hierarchy_mapping (action_entity_id, action_entity, parent_entity_id, parent_entity)
SELECT 
  biz_child.id, 'biz',
  biz_parent.id, 'biz' 
FROM app.d_biz biz_child
JOIN app.d_biz biz_parent ON biz_child.parent_id = biz_parent.id
WHERE biz_child.active = true AND biz_parent.active = true;

-- Employee to business unit assignments (employee → biz)
INSERT INTO app.entity_id_hierarchy_mapping (action_entity_id, action_entity, parent_entity_id, parent_entity)
SELECT 
  emp.id, 'employee',
  emp.biz_id, 'biz'
FROM app.d_employee emp
WHERE emp.active = true AND emp.biz_id IS NOT NULL;

-- Employee to HR position assignments (employee → hr)
INSERT INTO app.entity_id_hierarchy_mapping (action_entity_id, action_entity, parent_entity_id, parent_entity)
SELECT 
  emp.id, 'employee',
  emp.hr_position_id, 'hr'
FROM app.d_employee emp
WHERE emp.active = true AND emp.hr_position_id IS NOT NULL;

-- Employee to organizational assignments (employee → org)
INSERT INTO app.entity_id_hierarchy_mapping (action_entity_id, action_entity, parent_entity_id, parent_entity)
SELECT 
  emp.id, 'employee',
  emp.primary_org_id, 'org'
FROM app.d_employee emp
WHERE emp.active = true AND emp.primary_org_id IS NOT NULL;

-- Client to business unit assignments (client → biz)
INSERT INTO app.entity_id_hierarchy_mapping (action_entity_id, action_entity, parent_entity_id, parent_entity)
SELECT 
  client.id, 'client',
  client.biz_id, 'biz'
FROM app.d_client client
WHERE client.active = true AND client.biz_id IS NOT NULL;

-- Projects to business unit assignments (project → biz)
INSERT INTO app.entity_id_hierarchy_mapping (action_entity_id, action_entity, parent_entity_id, parent_entity)
SELECT 
  proj.id, 'project',
  proj.biz_id, 'biz'
FROM app.d_project proj
WHERE proj.active = true AND proj.biz_id IS NOT NULL;

-- Projects to client assignments (project → client) - SKIPPED: complex jsonb relationship
-- Note: d_project uses clients jsonb array, not direct client_id foreign key
-- TODO: Implement complex client relationship mapping when needed
-- INSERT INTO app.entity_id_hierarchy_mapping (action_entity_id, action_entity, parent_entity_id, parent_entity)
-- SELECT proj.id, 'project', client_uuid, 'client'
-- FROM app.d_project proj, jsonb_array_elements_text(proj.clients) AS client_uuid
-- WHERE proj.active = true AND jsonb_array_length(proj.clients) > 0;

-- Tasks to project assignments (task → project)
INSERT INTO app.entity_id_hierarchy_mapping (action_entity_id, action_entity, parent_entity_id, parent_entity)
SELECT task.id, 'task', task.project_id, 'project'
FROM app.ops_task_head task
WHERE task.active = true AND task.project_id IS NOT NULL;

-- Manual wiki to business unit assignments (wiki → biz)
-- Mapping general/company wikis to appropriate business units
INSERT INTO app.entity_id_hierarchy_mapping (action_entity_id, action_entity, parent_entity_id, parent_entity)
SELECT
  w.id, 'wiki',
  b.id, 'biz'
FROM app.d_wiki w, app.d_biz b
WHERE w.slug = 'company-vision' AND b.name = 'Corporate Operations'
   OR w.slug = 'project-management' AND b.name = 'Corporate Operations'
   OR w.slug = 'welcome' AND b.name = 'Corporate Operations';

-- Manual wiki to project assignments (wiki → project)
-- Creating project-specific wiki relationships based on content relevance
-- Note: These are manual assignments since wiki table doesn't have project_id column
INSERT INTO app.entity_id_hierarchy_mapping (action_entity_id, action_entity, parent_entity_id, parent_entity)
VALUES
-- Assign the project management wiki to the Digital Transformation Initiative
((SELECT id FROM app.d_wiki WHERE slug = 'project-management'), 'wiki',
 (SELECT id FROM app.d_project WHERE name = 'Digital Transformation Initiative'), 'project');

-- Manual artifact to business unit assignments (artifact → biz)
-- Mapping artifacts to appropriate business units based on content and purpose
INSERT INTO app.entity_id_hierarchy_mapping (action_entity_id, action_entity, parent_entity_id, parent_entity)
SELECT
  a.id, 'artifact',
  b.id, 'biz'
FROM app.d_artifact a, app.d_biz b
WHERE a.name LIKE '%HVAC%' AND b.name = 'HVAC & Mechanical Services'
   OR a.name LIKE '%Landscaping%' AND b.name = 'Landscaping & Grounds Maintenance'
   OR a.name LIKE '%Safety%' AND b.name = 'Corporate Operations'
   OR a.name LIKE '%Training%' AND b.name = 'Corporate Operations';

-- Manual artifact to project assignments (artifact → project)
-- Creating project-specific artifact relationships based on relevance
-- Note: These are manual assignments since artifact table doesn't have project_id column
INSERT INTO app.entity_id_hierarchy_mapping (action_entity_id, action_entity, parent_entity_id, parent_entity)
SELECT
  a.id, 'artifact',
  p.id, 'project'
FROM app.d_artifact a, app.d_project p
WHERE a.name LIKE '%HVAC%' AND p.name = 'HVAC Maintenance Contract Initiative'
   OR a.name LIKE '%Digital%' AND p.name = 'Digital Transformation Initiative'
   OR a.name LIKE '%Safety%' AND p.name = 'Safety Training and Certification Program';

-- Forms to business unit assignments (form → biz)
INSERT INTO app.entity_id_hierarchy_mapping (action_entity_id, action_entity, parent_entity_id, parent_entity)
SELECT
  form_head.id, 'form',
  form_head.biz_id, 'biz'
FROM app.ops_formlog_head form_head
WHERE form_head.active = true AND form_head.biz_id IS NOT NULL;

-- Forms to project assignments (form → project)
INSERT INTO app.entity_id_hierarchy_mapping (action_entity_id, action_entity, parent_entity_id, parent_entity)
SELECT
  form_head.id, 'form',
  form_head.project_id, 'project'
FROM app.ops_formlog_head form_head
WHERE form_head.active = true AND form_head.project_id IS NOT NULL;

-- Forms to HR assignments (form → hr)
INSERT INTO app.entity_id_hierarchy_mapping (action_entity_id, action_entity, parent_entity_id, parent_entity)
SELECT
  form_head.id, 'form',
  form_head.hr_id, 'hr'
FROM app.ops_formlog_head form_head
WHERE form_head.active = true AND form_head.hr_id IS NOT NULL;

-- Forms to worksite assignments (form → worksite)
INSERT INTO app.entity_id_hierarchy_mapping (action_entity_id, action_entity, parent_entity_id, parent_entity)
SELECT
  form_head.id, 'form',
  form_head.worksite_id, 'worksite'
FROM app.ops_formlog_head form_head
WHERE form_head.active = true AND form_head.worksite_id IS NOT NULL;

-- Worksites to organizational assignments (worksite → org)
INSERT INTO app.entity_id_hierarchy_mapping (action_entity_id, action_entity, parent_entity_id, parent_entity)
SELECT 
  worksite.id, 'worksite',
  worksite.org_id, 'org'
FROM app.d_worksite worksite
WHERE worksite.active = true AND worksite.org_id IS NOT NULL;

-- Root entities (entities without parents)
-- Corporation level entities
INSERT INTO app.entity_id_hierarchy_mapping (action_entity_id, action_entity, parent_entity_id, parent_entity)
SELECT 
  biz.id, 'biz',
  NULL, NULL
FROM app.d_biz biz
WHERE biz.active = true AND biz.parent_id IS NULL;

-- ============================================================================
-- FALL 2025 LANDSCAPING CAMPAIGN ENTITY HIERARCHY MAPPINGS
-- ============================================================================

-- Enhanced entity hierarchy mappings for Fall 2025 Landscaping Campaign action entities
-- These mappings connect all the action entities (tasks, wiki, artifacts, forms) to the project

-- Wiki entries to Fall 2025 Landscaping Campaign project mappings (wiki → project)
WITH campaign_project AS (
  SELECT id FROM app.d_project WHERE project_code = 'FALL-2025-LAND'
)
INSERT INTO app.entity_id_hierarchy_mapping (action_entity_id, action_entity, parent_entity_id, parent_entity)
SELECT
  w.id, 'wiki',
  campaign_project.id, 'project'
FROM app.d_wiki w, campaign_project
WHERE w.slug IN (
  'fall-2025-landscaping-overview',
  'fall-soil-preparation-guide',
  'cool-season-grass-seeding',
  'seasonal-plant-installation',
  'client-communication-standards'
);

-- Artifacts to Fall 2025 Landscaping Campaign project mappings (artifact → project)
WITH campaign_project AS (
  SELECT id FROM app.d_project WHERE project_code = 'FALL-2025-LAND'
)
INSERT INTO app.entity_id_hierarchy_mapping (action_entity_id, action_entity, parent_entity_id, parent_entity)
SELECT
  a.id, 'artifact',
  campaign_project.id, 'project'
FROM app.d_artifact a, campaign_project
WHERE a.artifact_code IN (
  'CHARTER-FALL-2025-LAND-001',
  'PROTOCOL-SOIL-TEST-001',
  'INVENTORY-FALL-EQUIP-001',
  'CHECKLIST-SITE-ASSESS-001',
  'GUIDE-GRASS-SEED-001',
  'TEMPLATE-PLANT-DESIGN-001',
  'FORM-QC-INSPECT-001',
  'TEMPLATE-COMM-TIMELINE-001',
  'SCHEDULE-FERTILIZER-001',
  'GUIDE-WINTER-PROTECT-001',
  'DASHBOARD-PROGRESS-001',
  'PROTOCOL-SAFETY-FALL-001'
);

-- Forms to Fall 2025 Landscaping Campaign project mappings are already handled
-- by the existing form → project mapping above since forms have project_id column

-- Additional manual artifact to business unit assignments for Fall 2025 campaign artifacts
INSERT INTO app.entity_id_hierarchy_mapping (action_entity_id, action_entity, parent_entity_id, parent_entity)
SELECT
  a.id, 'artifact',
  b.id, 'biz'
FROM app.d_artifact a, app.d_biz b
WHERE (a.name LIKE '%Fall 2025%' OR a.name LIKE '%Fall Landscaping%' OR a.name LIKE '%Cool-Season%' OR a.name LIKE '%Seasonal Plant%')
  AND b.name = 'Landscaping & Grounds Maintenance';

-- Wiki to business unit assignments for Fall 2025 campaign wikis
INSERT INTO app.entity_id_hierarchy_mapping (action_entity_id, action_entity, parent_entity_id, parent_entity)
SELECT
  w.id, 'wiki',
  b.id, 'biz'
FROM app.d_wiki w, app.d_biz b
WHERE w.slug IN (
  'fall-2025-landscaping-overview',
  'fall-soil-preparation-guide',
  'cool-season-grass-seeding',
  'seasonal-plant-installation'
) AND b.name = 'Landscaping & Grounds Maintenance';

-- Task to business unit assignments for Fall 2025 campaign tasks
INSERT INTO app.entity_id_hierarchy_mapping (action_entity_id, action_entity, parent_entity_id, parent_entity)
SELECT
  t.id, 'task',
  b.id, 'biz'
FROM app.ops_task_head t, app.d_biz b
WHERE t.task_number LIKE 'FALL-2025-LAND-%'
  AND b.name = 'Landscaping & Grounds Maintenance';

-- Employee assignments to Fall 2025 Landscaping Campaign tasks
-- Note: These create employee → task relationships for task assignments
INSERT INTO app.entity_id_hierarchy_mapping (action_entity_id, action_entity, parent_entity_id, parent_entity)
SELECT
  emp.id, 'employee',
  t.id, 'task'
FROM app.d_employee emp, app.ops_task_head t
WHERE emp.name = 'James Miller'
  AND t.task_number IN ('FALL-2025-LAND-010', 'FALL-2025-LAND-011', 'FALL-2025-LAND-012')
  AND t.active = true

UNION ALL

SELECT
  emp.id, 'employee',
  t.id, 'task'
FROM app.d_employee emp, app.ops_task_head t
WHERE emp.name = 'Amanda Foster'
  AND t.task_number IN ('FALL-2025-LAND-001', 'FALL-2025-LAND-008')
  AND t.active = true

UNION ALL

SELECT
  emp.id, 'employee',
  t.id, 'task'
FROM app.d_employee emp, app.ops_task_head t
WHERE emp.name = 'Tom Richardson'
  AND t.task_number IN ('FALL-2025-LAND-002', 'FALL-2025-LAND-006')
  AND t.active = true

UNION ALL

SELECT
  emp.id, 'employee',
  t.id, 'task'
FROM app.d_employee emp, app.ops_task_head t
WHERE emp.name = 'Carlos Santos'
  AND t.task_number IN ('FALL-2025-LAND-003', 'FALL-2025-LAND-005', 'FALL-2025-LAND-009')
  AND t.active = true

UNION ALL

SELECT
  emp.id, 'employee',
  t.id, 'task'
FROM app.d_employee emp, app.ops_task_head t
WHERE emp.name = 'Patricia Lee'
  AND t.task_number IN ('FALL-2025-LAND-004', 'FALL-2025-LAND-007')
  AND t.active = true;

-- Project to client assignments (project → client) for Fall 2025 Landscaping Campaign
-- Note: Since d_project uses clients jsonb array, we need to extract each client UUID
INSERT INTO app.entity_id_hierarchy_mapping (action_entity_id, action_entity, parent_entity_id, parent_entity)
SELECT
  client_uuid::uuid, 'client',
  proj.id, 'project'
FROM app.d_project proj, jsonb_array_elements_text(proj.clients) AS client_uuid
WHERE proj.project_code = 'FALL-2025-LAND'
  AND proj.active = true
  AND jsonb_array_length(proj.clients) > 0;