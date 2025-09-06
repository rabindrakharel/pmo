-- ============================================================================
-- ENTITY HIERARCHY - PARENT-CHILD RELATIONSHIPS
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Defines parent-child creation relationships between entity types. Shows which
--   entities can create other entities within their scope. Each relationship defines
--   what can be created inside what parent entity, supporting the UI sidebar structure
--   and permission system architecture.
--
-- DDL Structure:
--   - Standard audit fields (name, descr, tags, attr, from_ts, to_ts, active, created, updated)
--   - action_entity: The entity type that can be created (child)
--   - parent_entity: The entity type that can create the action_entity (parent)
--   - hierarchy_level: Depth level in the hierarchy (1=direct, 2=nested, 3=deep)
--   - inheritance_enabled: Whether permissions cascade down the hierarchy
--   - creation_rights: Whether this relationship enables creation permissions
--   - management_rights: Whether parent can manage the child entities
--
-- UI/Application Integration:
--   - Application sidebar contains 12 entity types (4 organizational, 3 operational, 2 personnel, 3 content)
--   - Each entity type has dedicated management pages with creation capabilities
--   - Parent entities show "Create Child" buttons based on these relationships
--   - Breadcrumb navigation follows parent-child hierarchy patterns
--
-- Entity Categories & Creation Rights:
--   Organizational (4): hr, biz, org, client - can create operational/personnel/content entities
--   Operational (3): project, task, worksite - can create content entities and sub-operations
--   Personnel (2): employee, role - support organizational assignment relationships
--   Content (3): wiki, form, artifact - created within organizational/operational scopes
--
-- Relationships Captured:
--   - Business → wiki, form, task, project, artifact (create)
--   - Project → wiki, form, task, artifact (create)
--   - HR → employee, role (create)
--   - Worksite → task, form (create)
--   - Client → project, task (create)
--   - Organization → worksite, employee (create)
--   - Role → employee (create)
--   - Self-referential hierarchies: biz→biz, project→project, org→org (create)
--
-- Table Relationships & Integration:
--   - FOUNDATION: Uses entity_type_code values from meta_entity_types for parent_entity/action_entity validation
--   - PERMISSION MAPPING: Feeds into meta_entity_hierarchy_permission_mapping to define what permission_actions are possible
--   - INSTANCE MAPPING: Works with entity_id_hierarchy_mapping to track actual parent-child entity instance relationships
--   - ACCESS CONTROL: Enables rel_employee_entity_action_rbac to grant specific users creation rights within parent scopes
--   - UI GENERATION: Determines which "Create Child Entity" buttons appear on each entity management page
--   - API ENDPOINTS: Supports dynamic endpoint creation for nested entity operations (e.g., /biz/{id}/wiki/create)

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.meta_entity_hierarchy (
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

  -- Hierarchy definition
  action_entity text NOT NULL,
  parent_entity text NOT NULL,

  -- Hierarchy attributes
  hierarchy_level int DEFAULT 1,
  inheritance_enabled boolean DEFAULT true,
  creation_rights boolean DEFAULT true,
  management_rights boolean DEFAULT true
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Project-scoped entity hierarchy (Project heads can create project-related content)
INSERT INTO app.meta_entity_hierarchy (name, "descr", action_entity, parent_entity, hierarchy_level, tags, attr) VALUES
('Project Wiki Creation', 'Project managers can create and manage wiki content for project documentation, knowledge sharing, and team collaboration', 'wiki', 'project', 2, '["project", "wiki", "documentation", "knowledge"]', '{"scope": "project_specific", "content_type": "documentation", "collaboration": true, "version_control": true, "access_inheritance": "project_team"}'),
('Project Form Creation', 'Project managers can create forms for project data collection, status reporting, and stakeholder feedback', 'form', 'project', 2, '["project", "form", "data_collection", "reporting"]', '{"scope": "project_specific", "data_collection": true, "reporting": true, "workflow_integration": true, "stakeholder_feedback": true}'),
('Project Task Creation', 'Project managers can create and assign tasks for project execution, milestone tracking, and deliverable management', 'task', 'project', 2, '["project", "task", "execution", "milestone"]', '{"scope": "project_specific", "task_assignment": true, "milestone_tracking": true, "deliverable_management": true, "resource_allocation": true}'),
('Project Artifact Creation', 'Project managers can create artifacts for project deliverables, documentation, and asset management', 'artifact', 'project', 2, '["project", "artifact", "deliverables", "assets"]', '{"scope": "project_specific", "deliverable_storage": true, "version_management": true, "asset_tracking": true, "compliance_documentation": true}'),

-- Business-scoped entity hierarchy (Business heads can create operational entities)
('Business Wiki Management', 'Business managers can create departmental wiki content for process documentation, training materials, and knowledge management', 'wiki', 'biz', 2, '["business", "wiki", "process", "training"]', '{"scope": "business_unit", "process_documentation": true, "training_materials": true, "knowledge_management": true, "departmental_standards": true}'),
('Business Form Management', 'Business managers can create operational forms for data collection, process workflows, and business intelligence', 'form', 'biz', 2, '["business", "form", "operations", "intelligence"]', '{"scope": "business_unit", "operational_data": true, "process_workflows": true, "business_intelligence": true, "performance_metrics": true}'),
('Business Task Management', 'Business managers can create operational tasks for departmental workflows, process improvement, and resource management', 'task', 'biz', 2, '["business", "task", "operations", "improvement"]', '{"scope": "business_unit", "departmental_workflows": true, "process_improvement": true, "resource_management": true, "efficiency_optimization": true}'),
('Business Project Creation', 'Business managers can initiate projects for business development, process improvement, and strategic initiatives', 'project', 'biz', 2, '["business", "project", "development", "strategic"]', '{"scope": "business_unit", "business_development": true, "process_improvement": true, "strategic_initiatives": true, "budget_authority": true}'),
('Business Artifact Management', 'Business managers can create artifacts for business documentation, compliance records, and process assets', 'artifact', 'biz', 2, '["business", "artifact", "compliance", "process"]', '{"scope": "business_unit", "compliance_records": true, "process_assets": true, "business_documentation": true, "audit_trails": true}'),

-- HR-scoped entity hierarchy (HR heads manage personnel and roles)
('HR Employee Management', 'HR managers can create and manage employee records for recruitment, onboarding, and personnel administration', 'employee', 'hr', 2, '["hr", "employee", "recruitment", "personnel"]', '{"scope": "hr_department", "recruitment_management": true, "onboarding_process": true, "personnel_administration": true, "compliance_tracking": true}'),
('HR Role Management', 'HR managers can create and manage role definitions for organizational structure, permission assignment, and career development', 'role', 'hr', 2, '["hr", "role", "organizational", "career"]', '{"scope": "hr_department", "role_definitions": true, "organizational_structure": true, "permission_management": true, "career_development": true}'),

-- Worksite-scoped entity hierarchy (Worksite managers handle operational tasks)
('Worksite Task Management', 'Worksite managers can create operational tasks for facility management, safety compliance, and maintenance workflows', 'task', 'worksite', 2, '["worksite", "task", "facility", "safety"]', '{"scope": "worksite_specific", "facility_management": true, "safety_compliance": true, "maintenance_workflows": true, "operational_efficiency": true}'),
('Worksite Form Management', 'Worksite managers can create forms for safety reporting, maintenance logs, and operational data collection', 'form', 'worksite', 2, '["worksite", "form", "safety", "maintenance"]', '{"scope": "worksite_specific", "safety_reporting": true, "maintenance_logs": true, "operational_data": true, "compliance_documentation": true}'),

-- Client-scoped entity hierarchy (Client managers handle service delivery)
('Client Project Creation', 'Client managers can create projects for service delivery, client engagement, and relationship management', 'project', 'client', 2, '["client", "project", "service", "relationship"]', '{"scope": "client_specific", "service_delivery": true, "client_engagement": true, "relationship_management": true, "service_quality": true}'),
('Client Task Management', 'Client managers can create tasks for service coordination, client support, and relationship activities', 'task', 'client', 2, '["client", "task", "service", "support"]', '{"scope": "client_specific", "service_coordination": true, "client_support": true, "relationship_activities": true, "satisfaction_management": true}'),

-- Organizational hierarchy (Org managers handle geographic and location-based entities)
('Organization Worksite Management', 'Organization managers can create worksites for geographic expansion, facility establishment, and operational presence', 'worksite', 'org', 2, '["org", "worksite", "expansion", "facility"]', '{"scope": "geographic_region", "facility_establishment": true, "operational_presence": true, "geographic_expansion": true, "resource_allocation": true}'),
('Organization Employee Assignment', 'Organization managers can assign employees to geographic locations for regional operations and market coverage', 'employee', 'org', 2, '["org", "employee", "regional", "coverage"]', '{"scope": "geographic_region", "regional_operations": true, "market_coverage": true, "location_assignment": true, "territorial_management": true}'),

-- Role-based hierarchical relationships
('Role Employee Assignment', 'Role administrators can assign employees to roles for permission management and organizational structure', 'employee', 'role', 2, '["role", "employee", "assignment", "permissions"]', '{"scope": "role_administration", "permission_management": true, "role_assignment": true, "organizational_structure": true, "access_control": true}'),

-- Self-referential hierarchies (Complex organizational structures)
('Business Unit Hierarchy', 'Senior business managers can create sub-business units for organizational scaling and departmental management', 'biz', 'biz', 3, '["business", "hierarchy", "scaling", "departmental"]', '{"scope": "senior_management", "organizational_scaling": true, "departmental_management": true, "hierarchy_creation": true, "cost_center_management": true}'),
('Project Sub-Project Creation', 'Project managers can create sub-projects for complex initiatives, phase management, and resource allocation', 'project', 'project', 3, '["project", "sub_project", "complex", "phase"]', '{"scope": "project_management", "complex_initiatives": true, "phase_management": true, "resource_allocation": true, "milestone_dependencies": true}'),
('Geographic Sub-Organization', 'Regional managers can create sub-organizational units for territory management and local operations', 'org', 'org', 3, '["org", "sub_organization", "territory", "local"]', '{"scope": "regional_management", "territory_management": true, "local_operations": true, "geographic_subdivision": true, "market_segmentation": true}');