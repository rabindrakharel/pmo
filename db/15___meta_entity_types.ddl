
-- ============================================================================
-- META ENTITY TYPES - FOUNDATIONAL ENTITY TYPE DEFINITIONS
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Master registry of all entity types in the PMO system. Each entity type
--   represents a distinct business concept that gets its own dedicated page
--   in the application sidebar and drives the entire system architecture.
--
-- UI/UX Integration:
--   - Application sidebar contains one entry per entity type (12 total)
--   - Each entity type automatically gets a dedicated management page
--   - Entity hierarchy determines navigation structure and breadcrumbs
--   - Display properties control icons, labels, and sort order in UI
--
-- Entity Categories & Types:
--   Organizational (4): hr, biz, org, client - structural/hierarchical entities
--   Operational (3): project, task, worksite - execution/workflow entities  
--   Personnel (2): employee, role - human resources entities
--   Content (3): wiki, form, artifact - information/knowledge entities
--
-- System Architecture & Table Relationships:
--   - FOUNDATION LAYER: All entity tables reference this for type validation
--   - HIERARCHY LAYER: meta_entity_hierarchy uses entity_type_code values to define parent→child creation relationships  
--   - PERMISSION LAYER: meta_entity_hierarchy_permission_mapping references parent_entity/action_entity from this table
--   - INSTANCE LAYER: entity_id_hierarchy_mapping tracks actual entity instance relationships using these types
--   - ACCESS CONTROL: rel_employee_entity_action_rbac grants specific permissions using these entity types
--   - API GENERATION: Drives dynamic endpoint creation via entity_type_code patterns
--   - UI GENERATION: Display properties control sidebar navigation and page structures
--
-- Entity Behavior:
--   - is_root_capable: Can exist without parent (org roots)
--   - supports_hierarchy: Can have child entities (tree structures)
--   - requires_parent: Must belong to another entity (dependencies)

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.meta_entity_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Standard fields (audit, metadata, SCD type 2) - ALWAYS FIRST
  name text NOT NULL,
  "descr" text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),

  -- Entity type definition
  entity_type text NOT NULL UNIQUE, --Business, Project, HR, Worksite, Client, Org, Role, Employee, Wiki, Form, Task, Artifact
  entity_type_code text NOT NULL UNIQUE, --'biz', 'project', 'hr', 'worksite', 'client', 'org', 'role', 'employee', 'wiki', 'form', 'task', 'artifact'
  entity_category text NOT NULL, -- organizational, operational, content, personnel
  
  -- Entity attributes
  is_root_capable boolean DEFAULT false,
  supports_hierarchy boolean DEFAULT false,
  requires_parent boolean DEFAULT false,
  creation_workflow text,
  
  -- Display and UI attributes
  display_name text NOT NULL,
  icon_name text,
  sort_order int DEFAULT 999,

  -- Constraints
  CONSTRAINT valid_entity_category CHECK (entity_category IN ('organizational', 'operational', 'content', 'personnel')),
  CONSTRAINT valid_entity_type_code CHECK (entity_type_code ~ '^[a-z][a-z_]*[a-z]$|^[a-z]$')
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Organizational entities (structural/hierarchical)
INSERT INTO app.meta_entity_types (name, "descr", entity_type, entity_type_code, entity_category, display_name, is_root_capable, supports_hierarchy, requires_parent, sort_order, tags, attr) VALUES
('Human Resources Department', 'Human resources positions, roles, and personnel management functions within the organization', 'HR', 'hr', 'organizational', 'HR Department', true, false, false, 100, '["hr", "organizational", "personnel", "management"]', '{"department_type": "administrative", "scope": "human_resources", "personnel_management": true, "compliance_oversight": true}'),

('Business Organizational Unit', 'Business organizational units representing departments, divisions, or operational segments', 'Business', 'biz', 'organizational', 'Business Unit', true, true, false, 200, '["business", "organizational", "operational", "department"]', '{"department_type": "operational", "scope": "business_operations", "revenue_generation": true, "cost_center": true}'),

('Geographic Organization', 'Geographic organizational locations representing regions, territories, or location-based structures', 'Org', 'org', 'organizational', 'Geographic Organization', true, true, false, 300, '["geographic", "organizational", "location", "territory"]', '{"location_based": true, "scope": "geographic_operations", "territorial_management": true, "regional_coverage": true}'),

('Client Relationship', 'Client and customer records representing external business relationships and service delivery targets', 'Client', 'client', 'organizational', 'Client', true, false, false, 400, '["client", "external", "relationship", "service"]', '{"external_entity": true, "scope": "client_management", "service_delivery": true, "revenue_source": true}');

-- Operational entities (execution/workflow)
INSERT INTO app.meta_entity_types (name, "descr", entity_type, entity_type_code, entity_category, display_name, is_root_capable, supports_hierarchy, requires_parent, sort_order, tags, attr) VALUES
('Project Definition', 'Project definitions and scope representing structured initiatives with defined objectives, timelines, and deliverables', 'Project', 'project', 'operational', 'Project', false, true, true, 500, '["project", "operational", "initiative", "deliverable"]', '{"execution_tracking": true, "milestone_management": true, "resource_allocation": true, "timeline_driven": true}'),

('Operational Task', 'Operational tasks and work items representing discrete units of work within projects or business processes', 'Task', 'task', 'operational', 'Task', false, false, true, 600, '["task", "operational", "work", "execution"]', '{"work_unit": true, "assignment_tracking": true, "progress_monitoring": true, "completion_criteria": true}'),

('Physical Worksite', 'Physical work locations and facilities representing operational sites where work is performed', 'Worksite', 'worksite', 'operational', 'Worksite', false, false, true, 700, '["worksite", "facility", "location", "operational"]', '{"physical_location": true, "facility_management": true, "safety_compliance": true, "operational_site": true}');

-- Personnel entities (human resources)
INSERT INTO app.meta_entity_types (name, "descr", entity_type, entity_type_code, entity_category, display_name, is_root_capable, supports_hierarchy, requires_parent, sort_order, tags, attr) VALUES
('Employee Profile', 'Employee profile and data access representing individual personnel records and organizational assignments', 'Employee', 'employee', 'personnel', 'Employee', false, false, true, 800, '["employee", "personnel", "individual", "assignment"]', '{"personnel_record": true, "assignment_tracking": true, "performance_monitoring": true, "compliance_data": true}'),

('Organizational Role', 'Organizational roles representing job functions, permission sets, and hierarchical positions within the organization', 'Role', 'role', 'personnel', 'Role', false, false, true, 900, '["role", "personnel", "permissions", "hierarchy"]', '{"permission_set": true, "hierarchical_position": true, "job_function": true, "access_control": true}');

-- Content entities (information/knowledge)
INSERT INTO app.meta_entity_types (name, "descr", entity_type, entity_type_code, entity_category, display_name, is_root_capable, supports_hierarchy, requires_parent, sort_order, tags, attr) VALUES
('Knowledge Wiki', 'Knowledge base and documentation representing collaborative content, process documentation, and institutional knowledge', 'Wiki', 'wiki', 'content', 'Wiki', false, false, true, 1000, '["wiki", "content", "knowledge", "documentation"]', '{"collaborative_content": true, "knowledge_management": true, "version_control": true, "search_indexing": true}'),

('Dynamic Form', 'Dynamic forms and data collection representing configurable input mechanisms for structured data gathering', 'Form', 'form', 'content', 'Form', false, false, true, 1100, '["form", "content", "data", "collection"]', '{"data_collection": true, "configurable_fields": true, "validation_rules": true, "workflow_integration": true}'),

('Knowledge Artifact', 'Documents, designs, and knowledge assets representing stored information, deliverables, and institutional assets', 'Artifact', 'artifact', 'content', 'Artifact', false, false, true, 1200, '["artifact", "content", "document", "asset"]', '{"document_storage": true, "version_management": true, "metadata_tracking": true, "access_controlled": true}');

-- ============================================================================
-- HELPER VIEWS:
-- ============================================================================

-- Active entity types by category
CREATE VIEW app.v_entity_types_by_category AS
SELECT 
  entity_category,
  count(*) as entity_count,
  array_agg(entity_type_code ORDER BY sort_order) as entity_types,
  array_agg(display_name ORDER BY sort_order) as display_names
FROM app.meta_entity_types
WHERE active = true
GROUP BY entity_category
ORDER BY min(sort_order);

-- Root-capable entities  
CREATE VIEW app.v_root_capable_entities AS
SELECT 
  entity_type_code,
  display_name,
  name,
  "descr",
  entity_category,
  sort_order
FROM app.meta_entity_types
WHERE active = true 
  AND is_root_capable = true
ORDER BY sort_order;

-- Hierarchical entities
CREATE VIEW app.v_hierarchical_entities AS
SELECT 
  entity_type_code,
  display_name,
  name,
  "descr", 
  entity_category,
  sort_order
FROM app.meta_entity_types
WHERE active = true
  AND supports_hierarchy = true
ORDER BY sort_order;

-- ============================================================================
-- INDEXES:
-- ============================================================================

CREATE INDEX idx_meta_entity_types_code ON app.meta_entity_types(entity_type_code);
CREATE INDEX idx_meta_entity_types_category ON app.meta_entity_types(entity_category);
CREATE INDEX idx_meta_entity_types_root_capable ON app.meta_entity_types(is_root_capable) WHERE is_root_capable = true;
CREATE INDEX idx_meta_entity_types_hierarchical ON app.meta_entity_types(supports_hierarchy) WHERE supports_hierarchy = true;
CREATE INDEX idx_meta_entity_types_sort_order ON app.meta_entity_types(sort_order);