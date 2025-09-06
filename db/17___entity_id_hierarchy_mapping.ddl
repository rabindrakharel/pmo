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

-- Tasks to project assignments (task → project) - DEFERRED: ops_task_head not created yet
-- TODO: Move this to a post-import script or later in dependency chain
-- INSERT INTO app.entity_id_hierarchy_mapping (action_entity_id, action_entity, parent_entity_id, parent_entity)
-- SELECT task.id, 'task', task.project_id, 'project'
-- FROM app.ops_task_head task
-- WHERE task.active = true AND task.project_id IS NOT NULL;

-- Wikis to business unit assignments (wiki → biz) - DEFERRED: d_wiki not created yet
-- TODO: Move this to a post-import script or later in dependency chain
-- INSERT INTO app.entity_id_hierarchy_mapping (action_entity_id, action_entity, parent_entity_id, parent_entity)
-- SELECT wiki.id, 'wiki', wiki.biz_id, 'biz'
-- FROM app.d_wiki wiki
-- WHERE wiki.active = true AND wiki.biz_id IS NOT NULL;

-- Wikis to project assignments (wiki → project) - DEFERRED: d_wiki not created yet
-- TODO: Move this to a post-import script or later in dependency chain
-- INSERT INTO app.entity_id_hierarchy_mapping (action_entity_id, action_entity, parent_entity_id, parent_entity)
-- SELECT wiki.id, 'wiki', wiki.project_id, 'project'
-- FROM app.d_wiki wiki
-- WHERE wiki.active = true AND wiki.project_id IS NOT NULL;

-- Artifacts to business unit assignments (artifact → biz) - SKIPPED: d_artifact lacks biz_id column
-- Note: d_artifact table doesn't have biz_id or project_id foreign key columns
-- TODO: Add relationship columns to d_artifact or implement alternative relationship mapping
-- INSERT INTO app.entity_id_hierarchy_mapping (action_entity_id, action_entity, parent_entity_id, parent_entity)
-- SELECT artifact.id, 'artifact', artifact.biz_id, 'biz'
-- FROM app.d_artifact artifact
-- WHERE artifact.active = true AND artifact.biz_id IS NOT NULL;

-- Artifacts to project assignments (artifact → project) - SKIPPED: d_artifact lacks project_id column
-- Note: d_artifact table doesn't have biz_id or project_id foreign key columns  
-- TODO: Add relationship columns to d_artifact or implement alternative relationship mapping
-- INSERT INTO app.entity_id_hierarchy_mapping (action_entity_id, action_entity, parent_entity_id, parent_entity)
-- SELECT artifact.id, 'artifact', artifact.project_id, 'project'
-- FROM app.d_artifact artifact
-- WHERE artifact.active = true AND artifact.project_id IS NOT NULL;

-- Forms to business unit assignments (form → biz) - DEFERRED: ops_formlog_head not created yet
-- TODO: Move this to a post-import script or later in dependency chain
-- INSERT INTO app.entity_id_hierarchy_mapping (action_entity_id, action_entity, parent_entity_id, parent_entity)
-- SELECT form_head.id, 'form', form_head.biz_id, 'biz'
-- FROM app.ops_formlog_head form_head
-- WHERE form_head.active = true AND form_head.biz_id IS NOT NULL;

-- Forms to project assignments (form → project) - DEFERRED: ops_formlog_head not created yet
-- TODO: Move this to a post-import script or later in dependency chain
-- INSERT INTO app.entity_id_hierarchy_mapping (action_entity_id, action_entity, parent_entity_id, parent_entity)
-- SELECT form_head.id, 'form', form_head.project_id, 'project'
-- FROM app.ops_formlog_head form_head
-- WHERE form_head.active = true AND form_head.project_id IS NOT NULL;

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