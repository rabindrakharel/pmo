-- ============================================================================
-- META ENTITY HIERARCHY PERMISSION MAPPING - UNIFIED PERMISSION MATRIX
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Master permission matrix defining what permission_actions are possible between
--   entity types in the PMO system. Expands the parent-child relationships from
--   meta_entity_hierarchy into granular permissions (create/view/edit/share),
--   providing the foundation for role-based access control.
--
-- DDL Structure:
--   - Standard audit fields (name, descr, tags, attr, from_ts, to_ts, active, created, updated)
--   - parent_entity: Entity type that grants the permission (from meta_entity_types.entity_type_code)
--   - action_entity: Entity type that receives the permission (from meta_entity_types.entity_type_code)  
--   - permission_action: The specific permission granted ('create', 'view', 'edit', 'share')
--   - is_self_permission: Generated column (parent_entity = action_entity) for self-permissions
--   - Comprehensive constraints: Entity validation, permission logic validation
--
-- Permission Logic (Enforced by Constraints):
--   - Self-permissions (parent_entity = action_entity): view, edit, share only
--   - Creation permissions (parent_entity ≠ action_entity): create only
--   - All parent_entity and action_entity values must exist in meta_entity_types
--   - Permission actions restricted to: 'create', 'view', 'edit', 'share'
--
-- UI/Application Integration:
--   - Application sidebar contains 12 entity types across 4 categories
--   - Each entity page shows available actions based on these permission mappings
--   - "Create" buttons appear for valid parent->child relationships
--   - Permission checks determine view/edit/share capabilities
--   - Breadcrumb navigation follows hierarchy patterns defined here
--
-- Entity Categories & Permission Patterns:
--   Organizational (4): hr, biz, org, client - structural/hierarchical entities
--   Operational (3): project, task, worksite - execution/workflow entities  
--   Personnel (2): employee, role - human resources entities
--   Content (3): wiki, form, artifact - information/knowledge entities
--

-- Design Session Context:
--   User requested to merge entity_hierarchy table with permission concepts,
--   specifically wanting to know "what can be created inside what entity."
--   Key requirements identified:
--   - Remove role_name dependency from hierarchy (user: "Remove role name I only want what can be created inside what entity")  
--   - Implement permission logic: parent_entity=action_entity → view/edit/share, parent_entity≠action_entity → create
--   - Support scoped permissions: parent_entity_id links to specific entity instances (e.g., biz_id from d_biz table)
--   - Unify scattered permission concepts into single authoritative mapping table
--
-- Key Features:
--   1. Self-permissions (parent_entity = action_entity): view, edit, share
--   2. Creation permissions (parent_entity ≠ action_entity): create
--   3. Generated column is_self_permission for automatic detection
--   4. Constraint validation to enforce the permission logic rules
--   5. Comprehensive data covering all entity relationships from the hierarchy
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
--   - All entities get self-permissions: view, edit, share
--
-- Benefits:
--   This unified table replaces the need for the entity_hierarchy table and 
--   provides a single source of truth for permission mappings that can be 
--   easily queried by the RBAC system.
--
-- Business Rules:
--   - Self-permissions: When parent_entity = action_entity → view, edit, share
--   - Creation permissions: When parent_entity ≠ action_entity → create
--   - Scope-based access: Permissions are scoped to specific parent entity instances
--   - Hierarchical inheritance: Parent entity permissions enable child entity management
--   - Permission enforcement: Used by rel_employee_entity_rbac for actual access control
--
-- Permission Levels:
--   - create: Ability to create new instances of the action_entity within parent scope
--   - view: Ability to read/view instances of the action_entity within parent scope
--   - edit: Ability to modify instances of the action_entity within parent scope
--   - share: Ability to grant access to instances of the action_entity within parent scope
--
-- Examples from User Requirements:
--   - parent_entity='biz', action_entity='wiki', permission_action='create' 
--     (Business managers can create wiki content within business scope)
--   - parent_entity='project', action_entity='project', permission_action='edit'
--     (Project managers can edit their own projects - self-permission)
--   - parent_entity_id would reference specific biz.id or project.id for scoped access
--
-- Table Relationships & Integration:
--   - FOUNDATION: Uses parent_entity/action_entity values from meta_entity_types for validation
--   - HIERARCHY RULES: Derived from relationships defined in meta_entity_hierarchy (inherits parent→child patterns)
--   - PERMISSION EXPANSION: Expands hierarchy relationships into granular permission_action possibilities (create/view/edit/share)
--   - RBAC VALIDATION: Serves as validation layer for rel_employee_entity_action_rbac (ensures only valid permissions are granted)
--   - TWO-LAYER DESIGN: This table defines \"what's possible\", RBAC table defines \"who can do what on which entities\"
--   - INSTANCE MAPPING: Works with entity_id_hierarchy_mapping to scope permissions to specific entity instances
--   - UI AUTHORIZATION: Determines which action buttons (Create/Edit/Share) appear based on user's effective permissions
--   - API AUTHORIZATION: Provides permission matrix for dynamic endpoint access control and validation

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.meta_entity_hierarchy_permission_mapping (
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

  -- Permission mapping definition
  parent_entity text NOT NULL,
  action_entity text NOT NULL,
  permission_action text NOT NULL,

  -- Computed properties for permission logic
  is_self_permission boolean GENERATED ALWAYS AS (parent_entity = action_entity) STORED,

  -- Constraints
  CONSTRAINT valid_parent_entity CHECK (parent_entity IN ('biz', 'project', 'hr', 'worksite', 'client', 'org', 'role', 'employee', 'wiki', 'form', 'task', 'artifact')),
  CONSTRAINT valid_action_entity CHECK (action_entity IN ('biz', 'project', 'hr', 'worksite', 'client', 'org', 'role', 'employee', 'wiki', 'form', 'task', 'artifact')),
  CONSTRAINT valid_permission_action CHECK (permission_action IN ('create', 'view', 'edit', 'share')),
  CONSTRAINT valid_permission_logic CHECK (
    (parent_entity = action_entity AND permission_action IN ('view', 'edit', 'share')) OR
    (parent_entity != action_entity AND permission_action = 'create') OR
    (parent_entity = action_entity AND permission_action = 'create' AND parent_entity IN ('biz', 'project', 'org'))
  )
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Self-permissions: Entity managers can view, edit, and share their own entities
INSERT INTO app.meta_entity_hierarchy_permission_mapping (name, "descr", parent_entity, action_entity, permission_action, tags, attr) VALUES

-- Business entity self-permissions
('Business View Permission', 'Business managers can view business unit details, metrics, and operational data', 'biz', 'biz', 'view', '["biz", "self", "view", "operational"]', '{"permission_type": "self", "data_access": "full", "operational_metrics": true, "financial_visibility": true}'),
('Business Edit Permission', 'Business managers can edit business unit configuration, settings, and operational parameters', 'biz', 'biz', 'edit', '["biz", "self", "edit", "configuration"]', '{"permission_type": "self", "configuration_access": true, "settings_management": true, "operational_control": true}'),
('Business Share Permission', 'Business managers can share business unit access and delegate permissions to team members', 'biz', 'biz', 'share', '["biz", "self", "share", "delegation"]', '{"permission_type": "self", "delegation_rights": true, "team_management": true, "access_control": true}'),

-- Project entity self-permissions  
('Project View Permission', 'Project managers can view project details, progress, and team activities', 'project', 'project', 'view', '["project", "self", "view", "progress"]', '{"permission_type": "self", "project_visibility": true, "progress_tracking": true, "team_activities": true}'),
('Project Edit Permission', 'Project managers can edit project configuration, milestones, and resource allocation', 'project', 'project', 'edit', '["project", "self", "edit", "management"]', '{"permission_type": "self", "project_management": true, "milestone_control": true, "resource_allocation": true}'),
('Project Share Permission', 'Project managers can share project access and assign team member permissions', 'project', 'project', 'share', '["project", "self", "share", "team"]', '{"permission_type": "self", "team_access": true, "permission_delegation": true, "collaboration_control": true}'),

-- HR entity self-permissions
('HR View Permission', 'HR managers can view HR department data, employee records, and organizational structure', 'hr', 'hr', 'view', '["hr", "self", "view", "personnel"]', '{"permission_type": "self", "personnel_data": true, "org_structure": true, "compliance_records": true}'),
('HR Edit Permission', 'HR managers can edit HR policies, organizational structure, and department configuration', 'hr', 'hr', 'edit', '["hr", "self", "edit", "policies"]', '{"permission_type": "self", "policy_management": true, "structure_control": true, "department_config": true}'),
('HR Share Permission', 'HR managers can share HR access and delegate personnel management permissions', 'hr', 'hr', 'share', '["hr", "self", "share", "personnel"]', '{"permission_type": "self", "personnel_delegation": true, "access_management": true, "compliance_oversight": true}'),

-- Worksite entity self-permissions
('Worksite View Permission', 'Worksite managers can view worksite operations, safety data, and facility information', 'worksite', 'worksite', 'view', '["worksite", "self", "view", "operations"]', '{"permission_type": "self", "operational_data": true, "safety_records": true, "facility_info": true}'),
('Worksite Edit Permission', 'Worksite managers can edit worksite configuration, safety protocols, and operational parameters', 'worksite', 'worksite', 'edit', '["worksite", "self", "edit", "safety"]', '{"permission_type": "self", "safety_management": true, "operational_control": true, "facility_management": true}'),
('Worksite Share Permission', 'Worksite managers can share worksite access and delegate operational permissions', 'worksite', 'worksite', 'share', '["worksite", "self", "share", "operations"]', '{"permission_type": "self", "operational_delegation": true, "safety_oversight": true, "team_coordination": true}'),

-- Client entity self-permissions
('Client View Permission', 'Client managers can view client information, service history, and relationship data', 'client', 'client', 'view', '["client", "self", "view", "relationship"]', '{"permission_type": "self", "client_data": true, "service_history": true, "relationship_metrics": true}'),
('Client Edit Permission', 'Client managers can edit client information, service configuration, and relationship settings', 'client', 'client', 'edit', '["client", "self", "edit", "service"]', '{"permission_type": "self", "client_management": true, "service_config": true, "relationship_control": true}'),
('Client Share Permission', 'Client managers can share client access and delegate service management permissions', 'client', 'client', 'share', '["client", "self", "share", "service"]', '{"permission_type": "self", "service_delegation": true, "team_access": true, "relationship_sharing": true}'),

-- Organization entity self-permissions
('Organization View Permission', 'Organization managers can view geographic data, territorial information, and regional metrics', 'org', 'org', 'view', '["org", "self", "view", "geographic"]', '{"permission_type": "self", "geographic_data": true, "territorial_info": true, "regional_metrics": true}'),
('Organization Edit Permission', 'Organization managers can edit geographic configuration, territorial boundaries, and regional settings', 'org', 'org', 'edit', '["org", "self", "edit", "territorial"]', '{"permission_type": "self", "geographic_control": true, "territorial_management": true, "regional_config": true}'),
('Organization Share Permission', 'Organization managers can share geographic access and delegate territorial permissions', 'org', 'org', 'share', '["org", "self", "share", "regional"]', '{"permission_type": "self", "territorial_delegation": true, "regional_access": true, "geographic_sharing": true}'),

-- Role entity self-permissions
('Role View Permission', 'Role administrators can view role definitions, permissions, and assignment data', 'role', 'role', 'view', '["role", "self", "view", "permissions"]', '{"permission_type": "self", "role_data": true, "permission_matrix": true, "assignment_info": true}'),
('Role Edit Permission', 'Role administrators can edit role definitions, permissions, and organizational structure', 'role', 'role', 'edit', '["role", "self", "edit", "definitions"]', '{"permission_type": "self", "role_management": true, "permission_control": true, "structure_editing": true}'),
('Role Share Permission', 'Role administrators can share role access and delegate permission management rights', 'role', 'role', 'share', '["role", "self", "share", "administration"]', '{"permission_type": "self", "admin_delegation": true, "permission_sharing": true, "role_oversight": true}'),

-- Employee entity self-permissions
('Employee View Permission', 'Employee managers can view employee records, performance data, and personal information', 'employee', 'employee', 'view', '["employee", "self", "view", "records"]', '{"permission_type": "self", "employee_data": true, "performance_records": true, "personal_info": true}'),
('Employee Edit Permission', 'Employee managers can edit employee information, assignments, and performance records', 'employee', 'employee', 'edit', '["employee", "self", "edit", "management"]', '{"permission_type": "self", "employee_management": true, "assignment_control": true, "record_editing": true}'),
('Employee Share Permission', 'Employee managers can share employee access and delegate personnel permissions', 'employee', 'employee', 'share', '["employee", "self", "share", "personnel"]', '{"permission_type": "self", "personnel_sharing": true, "access_delegation": true, "team_coordination": true}'),

-- Content entity self-permissions (Wiki, Form, Task, Artifact)
('Wiki View Permission', 'Wiki managers can view wiki content, documentation, and knowledge base articles', 'wiki', 'wiki', 'view', '["wiki", "self", "view", "content"]', '{"permission_type": "self", "content_access": true, "documentation_view": true, "knowledge_base": true}'),
('Wiki Edit Permission', 'Wiki managers can edit wiki content, documentation, and knowledge management structure', 'wiki', 'wiki', 'edit', '["wiki", "self", "edit", "documentation"]', '{"permission_type": "self", "content_editing": true, "documentation_control": true, "knowledge_management": true}'),
('Wiki Share Permission', 'Wiki managers can share wiki access and delegate content management permissions', 'wiki', 'wiki', 'share', '["wiki", "self", "share", "knowledge"]', '{"permission_type": "self", "content_sharing": true, "collaboration": true, "knowledge_delegation": true}'),

('Form View Permission', 'Form managers can view form configurations, submitted data, and response analytics', 'form', 'form', 'view', '["form", "self", "view", "data"]', '{"permission_type": "self", "form_data": true, "response_analytics": true, "configuration_view": true}'),
('Form Edit Permission', 'Form managers can edit form structure, validation rules, and data processing workflows', 'form', 'form', 'edit', '["form", "self", "edit", "configuration"]', '{"permission_type": "self", "form_design": true, "validation_control": true, "workflow_management": true}'),
('Form Share Permission', 'Form managers can share form access and delegate data collection permissions', 'form', 'form', 'share', '["form", "self", "share", "data"]', '{"permission_type": "self", "form_sharing": true, "data_delegation": true, "collection_rights": true}'),

('Task View Permission', 'Task managers can view task details, progress tracking, and assignment information', 'task', 'task', 'view', '["task", "self", "view", "progress"]', '{"permission_type": "self", "task_visibility": true, "progress_tracking": true, "assignment_view": true}'),
('Task Edit Permission', 'Task managers can edit task configuration, assignments, and progress tracking', 'task', 'task', 'edit', '["task", "self", "edit", "management"]', '{"permission_type": "self", "task_management": true, "assignment_control": true, "progress_editing": true}'),
('Task Share Permission', 'Task managers can share task access and delegate task management permissions', 'task', 'task', 'share', '["task", "self", "share", "management"]', '{"permission_type": "self", "task_delegation": true, "team_coordination": true, "assignment_sharing": true}'),

('Artifact View Permission', 'Artifact managers can view artifact content, version history, and metadata', 'artifact', 'artifact', 'view', '["artifact", "self", "view", "content"]', '{"permission_type": "self", "artifact_access": true, "version_history": true, "metadata_view": true}'),
('Artifact Edit Permission', 'Artifact managers can edit artifact content, metadata, and version control', 'artifact', 'artifact', 'edit', '["artifact", "self", "edit", "content"]', '{"permission_type": "self", "content_control": true, "version_management": true, "metadata_editing": true}'),
('Artifact Share Permission', 'Artifact managers can share artifact access and delegate content management permissions', 'artifact', 'artifact', 'share', '["artifact", "self", "share", "content"]', '{"permission_type": "self", "content_sharing": true, "access_delegation": true, "collaboration": true}'),

-- Cross-entity creation permissions: Parent entities can create child entities
-- Business scope creation permissions
('Business Wiki Creation', 'Business managers can create wiki content for departmental documentation and knowledge management', 'biz', 'wiki', 'create', '["biz", "wiki", "create", "documentation"]', '{"permission_type": "creation", "content_creation": true, "departmental_docs": true, "knowledge_base": true}'),
('Business Form Creation', 'Business managers can create forms for business processes, data collection, and workflow management', 'biz', 'form', 'create', '["biz", "form", "create", "process"]', '{"permission_type": "creation", "process_forms": true, "data_collection": true, "workflow_integration": true}'),
('Business Task Creation', 'Business managers can create tasks for operational workflows, process improvement, and team coordination', 'biz', 'task', 'create', '["biz", "task", "create", "operations"]', '{"permission_type": "creation", "operational_tasks": true, "process_improvement": true, "team_coordination": true}'),
('Business Project Creation', 'Business managers can create projects for business development, strategic initiatives, and departmental goals', 'biz', 'project', 'create', '["biz", "project", "create", "strategic"]', '{"permission_type": "creation", "business_projects": true, "strategic_initiatives": true, "departmental_goals": true}'),
('Business Artifact Creation', 'Business managers can create artifacts for business documentation, process assets, and compliance records', 'biz', 'artifact', 'create', '["biz", "artifact", "create", "compliance"]', '{"permission_type": "creation", "business_docs": true, "process_assets": true, "compliance_records": true}'),

-- Project scope creation permissions  
('Project Wiki Creation', 'Project managers can create wiki content for project documentation, team collaboration, and knowledge sharing', 'project', 'wiki', 'create', '["project", "wiki", "create", "collaboration"]', '{"permission_type": "creation", "project_docs": true, "team_collaboration": true, "knowledge_sharing": true}'),
('Project Form Creation', 'Project managers can create forms for project data collection, status reporting, and stakeholder feedback', 'project', 'form', 'create', '["project", "form", "create", "reporting"]', '{"permission_type": "creation", "project_forms": true, "status_reporting": true, "stakeholder_feedback": true}'),
('Project Task Creation', 'Project managers can create tasks for project execution, milestone tracking, and deliverable management', 'project', 'task', 'create', '["project", "task", "create", "execution"]', '{"permission_type": "creation", "project_tasks": true, "milestone_tracking": true, "deliverable_management": true}'),
('Project Artifact Creation', 'Project managers can create artifacts for project deliverables, documentation, and asset management', 'project', 'artifact', 'create', '["project", "artifact", "create", "deliverables"]', '{"permission_type": "creation", "project_deliverables": true, "documentation": true, "asset_management": true}'),

-- HR scope creation permissions
('HR Employee Creation', 'HR managers can create employee records for recruitment, onboarding, and personnel management', 'hr', 'employee', 'create', '["hr", "employee", "create", "recruitment"]', '{"permission_type": "creation", "employee_onboarding": true, "recruitment_process": true, "personnel_management": true}'),
('HR Role Creation', 'HR managers can create role definitions for organizational structure, permissions, and career development', 'hr', 'role', 'create', '["hr", "role", "create", "organizational"]', '{"permission_type": "creation", "role_definitions": true, "org_structure": true, "career_development": true}'),

-- Worksite scope creation permissions
('Worksite Task Creation', 'Worksite managers can create tasks for facility management, safety compliance, and maintenance workflows', 'worksite', 'task', 'create', '["worksite", "task", "create", "facility"]', '{"permission_type": "creation", "facility_tasks": true, "safety_compliance": true, "maintenance_workflows": true}'),
('Worksite Form Creation', 'Worksite managers can create forms for safety reporting, maintenance logs, and operational data collection', 'worksite', 'form', 'create', '["worksite", "form", "create", "safety"]', '{"permission_type": "creation", "safety_forms": true, "maintenance_logs": true, "operational_data": true}'),

-- Client scope creation permissions
('Client Project Creation', 'Client managers can create projects for service delivery, client engagement, and relationship management', 'client', 'project', 'create', '["client", "project", "create", "service"]', '{"permission_type": "creation", "client_projects": true, "service_delivery": true, "relationship_management": true}'),
('Client Task Creation', 'Client managers can create tasks for service coordination, client support, and relationship activities', 'client', 'task', 'create', '["client", "task", "create", "service"]', '{"permission_type": "creation", "service_tasks": true, "client_support": true, "relationship_activities": true}'),

-- Organization scope creation permissions
('Organization Worksite Creation', 'Organization managers can create worksites for geographic expansion, facility establishment, and regional operations', 'org', 'worksite', 'create', '["org", "worksite", "create", "expansion"]', '{"permission_type": "creation", "geographic_expansion": true, "facility_establishment": true, "regional_operations": true}'),
('Organization Employee Assignment', 'Organization managers can create employee assignments for geographic locations, regional coverage, and territorial management', 'org', 'employee', 'create', '["org", "employee", "create", "regional"]', '{"permission_type": "creation", "regional_assignments": true, "geographic_coverage": true, "territorial_management": true}'),

-- Role scope creation permissions
('Role Employee Assignment', 'Role administrators can create employee role assignments for permission management and organizational structure', 'role', 'employee', 'create', '["role", "employee", "create", "assignment"]', '{"permission_type": "creation", "role_assignments": true, "permission_management": true, "organizational_structure": true}'),

-- Self-referential creation permissions (Hierarchical structures)
('Business Sub-Unit Creation', 'Senior business managers can create sub-business units for organizational scaling and departmental management', 'biz', 'biz', 'create', '["biz", "hierarchy", "create", "scaling"]', '{"permission_type": "creation", "organizational_scaling": true, "departmental_management": true, "hierarchy_creation": true}'),
('Project Sub-Project Creation', 'Project managers can create sub-projects for complex initiatives, phase management, and resource allocation', 'project', 'project', 'create', '["project", "hierarchy", "create", "phase"]', '{"permission_type": "creation", "complex_initiatives": true, "phase_management": true, "resource_allocation": true}'),
('Organization Sub-Organization Creation', 'Regional managers can create sub-organizational units for territory management and local operations', 'org', 'org', 'create', '["org", "hierarchy", "create", "territory"]', '{"permission_type": "creation", "territory_management": true, "local_operations": true, "geographic_subdivision": true}');

-- ============================================================================
-- INDEXES:
-- ============================================================================

CREATE INDEX idx_meta_entity_hierarchy_permission_mapping_parent_action ON app.meta_entity_hierarchy_permission_mapping(parent_entity, action_entity);
CREATE INDEX idx_meta_entity_hierarchy_permission_mapping_permission_action ON app.meta_entity_hierarchy_permission_mapping(permission_action);
CREATE INDEX idx_meta_entity_hierarchy_permission_mapping_self_permission ON app.meta_entity_hierarchy_permission_mapping(is_self_permission);
CREATE INDEX idx_meta_entity_hierarchy_permission_mapping_active ON app.meta_entity_hierarchy_permission_mapping(active) WHERE active = true;