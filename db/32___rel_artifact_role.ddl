-- ============================================================================
-- ARTIFACT-ROLE RELATIONSHIP TABLE
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Many-to-many relationship between artifacts and roles, defining role-based
--   access control, permissions, and usage patterns. Enables scalable artifact
--   governance where access rights are inherited through role assignments
--   rather than individual employee grants.
--
-- Integration:
--   - Links d_artifact to d_role for role-based access control
--   - Supports scalable permission management through role inheritance
--   - Enables organizational artifact governance and compliance
--   - Facilitates artifact security and usage tracking by functional role

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.rel_artifact_role (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationship fields
  artifact_id uuid NOT NULL REFERENCES app.d_artifact(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES app.d_role(id) ON DELETE CASCADE,
  
  -- Temporal and audit fields
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  
  -- Access control
  access_type text DEFAULT 'view',
  permission_scope text DEFAULT 'standard',
  usage_context text DEFAULT 'operational',
  
  -- Permission matrix
  can_read boolean DEFAULT true,
  can_edit boolean DEFAULT false,
  can_approve boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  can_share boolean DEFAULT false,
  can_admin boolean DEFAULT false,
  
  -- Role-specific attributes
  mandatory_for_role boolean DEFAULT false,
  default_access boolean DEFAULT false,
  inheritance_enabled boolean DEFAULT true,
  
  -- Usage and governance
  usage_tracking boolean DEFAULT true,
  approval_workflow boolean DEFAULT false,
  audit_logging boolean DEFAULT true,
  
  -- Unique constraint
  UNIQUE(artifact_id, role_id, from_ts) DEFERRABLE INITIALLY DEFERRED
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Artifact-Role Relationships for Huron Home Services

-- Executive Role Access to Strategic and Policy Artifacts
WITH executive_artifacts AS (
  SELECT 
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'POLICY-SAFETY-001') AS safety_policy_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'POLICY-PRIVACY-001') AS privacy_policy_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'MANUAL-QA-001') AS qa_manual_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'PROP-HAM-EXP-001') AS hamilton_proposal_id
),
executive_roles AS (
  SELECT 
    (SELECT id FROM app.d_role WHERE role_code = 'CEO') AS ceo_role_id,
    (SELECT id FROM app.d_role WHERE role_code = 'CFO') AS cfo_role_id,
    (SELECT id FROM app.d_role WHERE role_code = 'CTO') AS cto_role_id,
    (SELECT id FROM app.d_role WHERE role_code = 'COO') AS coo_role_id
)

INSERT INTO app.rel_artifact_role (
  artifact_id, role_id, access_type, permission_scope, usage_context,
  can_read, can_edit, can_approve, can_delete, can_share, can_admin,
  mandatory_for_role, default_access, inheritance_enabled, usage_tracking, audit_logging
)
-- CEO Access - Full access to all strategic and policy artifacts
SELECT 
  executive_artifacts.safety_policy_id,
  executive_roles.ceo_role_id,
  'admin',
  'enterprise',
  'governance',
  true, true, true, true, true, true,
  true, true, true, true, true
FROM executive_artifacts, executive_roles

UNION ALL

SELECT 
  executive_artifacts.privacy_policy_id,
  executive_roles.ceo_role_id,
  'admin',
  'enterprise',
  'governance',
  true, true, true, true, true, true,
  true, true, true, true, true
FROM executive_artifacts, executive_roles

UNION ALL

SELECT 
  executive_artifacts.qa_manual_id,
  executive_roles.ceo_role_id,
  'admin',
  'enterprise',
  'governance',
  true, true, true, true, true, true,
  false, true, true, true, true
FROM executive_artifacts, executive_roles

UNION ALL

SELECT 
  executive_artifacts.hamilton_proposal_id,
  executive_roles.ceo_role_id,
  'admin',
  'strategic',
  'strategic_planning',
  true, true, true, true, true, true,
  true, true, true, true, true
FROM executive_artifacts, executive_roles

-- COO Access - Operational focus with safety and quality emphasis
UNION ALL

SELECT 
  executive_artifacts.safety_policy_id,
  executive_roles.coo_role_id,
  'admin',
  'operational',
  'safety_governance',
  true, true, true, false, true, true,
  true, true, true, true, true
FROM executive_artifacts, executive_roles

UNION ALL

SELECT 
  executive_artifacts.qa_manual_id,
  executive_roles.coo_role_id,
  'admin',
  'operational',
  'quality_management',
  true, true, true, false, true, true,
  true, true, true, true, true
FROM executive_artifacts, executive_roles

-- CFO Access - Financial and compliance focus
UNION ALL

SELECT 
  executive_artifacts.privacy_policy_id,
  executive_roles.cfo_role_id,
  'edit',
  'compliance',
  'regulatory_oversight',
  true, true, true, false, true, false,
  true, true, true, true, true
FROM executive_artifacts, executive_roles

UNION ALL

SELECT 
  executive_artifacts.hamilton_proposal_id,
  executive_roles.cfo_role_id,
  'edit',
  'financial',
  'financial_review',
  true, true, true, false, true, false,
  true, true, true, true, true
FROM executive_artifacts, executive_roles;

-- Management Role Access to Operational and Technical Artifacts  
WITH operational_artifacts AS (
  SELECT 
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'DESIGN-LAND-RES-001') AS residential_design_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'DESIGN-LAND-COM-001') AS commercial_design_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'DESIGN-SOLAR-001') AS solar_design_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'RFP-RESP-MISS-001') AS mississauga_rfp_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'SOW-OAK-LUX-001') AS oakville_sow_id
),
management_roles AS (
  SELECT 
    (SELECT id FROM app.d_role WHERE role_code = 'SVP') AS svp_role_id,
    (SELECT id FROM app.d_role WHERE role_code = 'VP') AS vp_role_id,
    (SELECT id FROM app.d_role WHERE role_code = 'PM') AS project_manager_role_id,
    (SELECT id FROM app.d_role WHERE role_code = 'DEPT-MGR') AS dept_manager_role_id
)

INSERT INTO app.rel_artifact_role (
  artifact_id, role_id, access_type, permission_scope, usage_context,
  can_read, can_edit, can_approve, can_delete, can_share, can_admin,
  mandatory_for_role, default_access, inheritance_enabled, usage_tracking
)
-- SVP Access - Strategic oversight with approval authority
SELECT 
  operational_artifacts.residential_design_id,
  management_roles.svp_role_id,
  'approve',
  'divisional',
  'strategic_oversight',
  true, false, true, false, true, false,
  false, true, true, true
FROM operational_artifacts, management_roles

UNION ALL

SELECT 
  operational_artifacts.commercial_design_id,
  management_roles.svp_role_id,
  'approve',
  'divisional',
  'strategic_oversight',
  true, false, true, false, true, false,
  false, true, true, true
FROM operational_artifacts, management_roles

UNION ALL

SELECT 
  operational_artifacts.mississauga_rfp_id,
  management_roles.svp_role_id,
  'approve',
  'business_development',
  'contract_oversight',
  true, false, true, false, true, false,
  true, true, true, true
FROM operational_artifacts, management_roles

-- VP Access - Departmental authority with edit and approve permissions
UNION ALL

SELECT 
  operational_artifacts.residential_design_id,
  management_roles.vp_role_id,
  'edit',
  'departmental',
  'service_management',
  true, true, true, false, true, false,
  true, true, true, true
FROM operational_artifacts, management_roles

UNION ALL

SELECT 
  operational_artifacts.commercial_design_id,
  management_roles.vp_role_id,
  'edit',
  'departmental',
  'service_management',
  true, true, true, false, true, false,
  true, true, true, true
FROM operational_artifacts, management_roles

UNION ALL

SELECT 
  operational_artifacts.solar_design_id,
  management_roles.vp_role_id,
  'edit',
  'technical',
  'technical_oversight',
  true, true, true, false, true, false,
  false, true, true, true
FROM operational_artifacts, management_roles

-- Project Manager Access - Project-specific with full operational access
UNION ALL

SELECT 
  operational_artifacts.mississauga_rfp_id,
  management_roles.project_manager_role_id,
  'edit',
  'project',
  'project_execution',
  true, true, false, false, true, false,
  true, true, true, true
FROM operational_artifacts, management_roles

UNION ALL

SELECT 
  operational_artifacts.oakville_sow_id,
  management_roles.project_manager_role_id,
  'edit',
  'project',
  'contract_management',
  true, true, false, false, true, false,
  true, true, true, true
FROM operational_artifacts, management_roles

-- Department Manager Access - Operational management with edit authority
UNION ALL

SELECT 
  operational_artifacts.residential_design_id,
  management_roles.dept_manager_role_id,
  'edit',
  'team',
  'team_management',
  true, true, false, false, true, false,
  true, true, true, true
FROM operational_artifacts, management_roles

UNION ALL

SELECT 
  operational_artifacts.commercial_design_id,
  management_roles.dept_manager_role_id,
  'edit',
  'team',
  'team_management',
  true, true, false, false, true, false,
  true, true, true, true
FROM operational_artifacts, management_roles;

-- Professional and Technical Role Access
WITH technical_artifacts AS (
  SELECT 
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'DESIGN-SOLAR-001') AS solar_design_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'TRAIN-HVAC-001') AS hvac_training_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'MANUAL-QA-001') AS qa_manual_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'POLICY-SAFETY-001') AS safety_policy_id
),
technical_roles AS (
  SELECT 
    (SELECT id FROM app.d_role WHERE role_code = 'LARCH') AS landscape_architect_id,
    (SELECT id FROM app.d_role WHERE role_code = 'HVAC-TECH') AS hvac_tech_id,
    (SELECT id FROM app.d_role WHERE role_code = 'PLUMBER') AS plumber_id,
    (SELECT id FROM app.d_role WHERE role_code = 'INSTALL-SPEC') AS installer_id,
    (SELECT id FROM app.d_role WHERE role_code = 'CREW-SUP') AS crew_supervisor_id
)

INSERT INTO app.rel_artifact_role (
  artifact_id, role_id, access_type, permission_scope, usage_context,
  can_read, can_edit, can_approve, can_delete, can_share, can_admin,
  mandatory_for_role, default_access, inheritance_enabled, usage_tracking
)
-- Landscape Architect Access - Design artifacts with edit authority
SELECT 
  technical_artifacts.solar_design_id,
  technical_roles.landscape_architect_id,
  'edit',
  'technical',
  'design_integration',
  true, true, false, false, true, false,
  false, true, true, true
FROM technical_artifacts, technical_roles

-- HVAC Technician Access - Technical training and safety materials
UNION ALL

SELECT 
  technical_artifacts.hvac_training_id,
  technical_roles.hvac_tech_id,
  'view',
  'professional',
  'skill_development',
  true, false, false, false, false, false,
  true, true, true, true
FROM technical_artifacts, technical_roles

UNION ALL

SELECT 
  technical_artifacts.solar_design_id,
  technical_roles.hvac_tech_id,
  'view',
  'technical',
  'technical_reference',
  true, false, false, false, false, false,
  true, true, true, true
FROM technical_artifacts, technical_roles

UNION ALL

SELECT 
  technical_artifacts.safety_policy_id,
  technical_roles.hvac_tech_id,
  'view',
  'operational',
  'safety_compliance',
  true, false, false, false, false, false,
  true, true, true, true
FROM technical_artifacts, technical_roles

-- Plumber Access - Safety and technical reference materials
UNION ALL

SELECT 
  technical_artifacts.safety_policy_id,
  technical_roles.plumber_id,
  'view',
  'operational',
  'safety_compliance',
  true, false, false, false, false, false,
  true, true, true, true
FROM technical_artifacts, technical_roles

-- Installation Specialist Access - Quality and safety materials
UNION ALL

SELECT 
  technical_artifacts.qa_manual_id,
  technical_roles.installer_id,
  'view',
  'operational',
  'quality_reference',
  true, false, false, false, false, false,
  true, true, true, true
FROM technical_artifacts, technical_roles

UNION ALL

SELECT 
  technical_artifacts.safety_policy_id,
  technical_roles.installer_id,
  'view',
  'operational',
  'safety_compliance',
  true, false, false, false, false, false,
  true, true, true, true
FROM technical_artifacts, technical_roles

-- Crew Supervisor Access - Enhanced access for team leadership
UNION ALL

SELECT 
  technical_artifacts.qa_manual_id,
  technical_roles.crew_supervisor_id,
  'edit',
  'supervisory',
  'quality_management',
  true, true, false, false, true, false,
  true, true, true, true
FROM technical_artifacts, technical_roles

UNION ALL

SELECT 
  technical_artifacts.safety_policy_id,
  technical_roles.crew_supervisor_id,
  'edit',
  'supervisory',
  'safety_management',
  true, true, false, false, true, false,
  true, true, true, true
FROM technical_artifacts, technical_roles;

-- Support and Administrative Role Access
WITH support_artifacts AS (
  SELECT 
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'ONBOARD-EMP-001') AS employee_onboarding_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'ONBOARD-CLIENT-001') AS client_onboarding_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'POLICY-PRIVACY-001') AS privacy_policy_id
),
support_roles AS (
  SELECT 
    (SELECT id FROM app.d_role WHERE role_code = 'CSR') AS customer_service_id,
    (SELECT id FROM app.d_role WHERE role_code = 'SYSADMIN') AS system_admin_id,
    (SELECT id FROM app.d_role WHERE role_code = 'API-SPEC') AS api_specialist_id,
    (SELECT id FROM app.d_role WHERE role_code = 'FIN-ANALYST') AS financial_analyst_id
)

INSERT INTO app.rel_artifact_role (
  artifact_id, role_id, access_type, permission_scope, usage_context,
  can_read, can_edit, can_approve, can_delete, can_share, can_admin,
  mandatory_for_role, default_access, inheritance_enabled, usage_tracking
)
-- Customer Service Representative Access - Client-facing materials
SELECT 
  support_artifacts.client_onboarding_id,
  support_roles.customer_service_id,
  'edit',
  'client_facing',
  'client_support',
  true, true, false, false, true, false,
  true, true, true, true
FROM support_artifacts, support_roles

UNION ALL

SELECT 
  support_artifacts.employee_onboarding_id,
  support_roles.customer_service_id,
  'view',
  'reference',
  'process_understanding',
  true, false, false, false, false, false,
  true, true, true, true
FROM support_artifacts, support_roles

-- System Administrator Access - Technical and policy materials
UNION ALL

SELECT 
  support_artifacts.privacy_policy_id,
  support_roles.system_admin_id,
  'view',
  'technical',
  'system_compliance',
  true, false, false, false, false, false,
  true, true, true, true
FROM support_artifacts, support_roles

UNION ALL

SELECT 
  support_artifacts.employee_onboarding_id,
  support_roles.system_admin_id,
  'edit',
  'technical',
  'system_setup',
  true, true, false, false, false, false,
  false, true, true, true
FROM support_artifacts, support_roles

-- API Integration Specialist Access - Technical documentation
UNION ALL

SELECT 
  support_artifacts.client_onboarding_id,
  support_roles.api_specialist_id,
  'view',
  'technical',
  'integration_reference',
  true, false, false, false, false, false,
  false, true, true, true
FROM support_artifacts, support_roles

-- Financial Analyst Access - Business and financial materials
UNION ALL

SELECT 
  support_artifacts.privacy_policy_id,
  support_roles.financial_analyst_id,
  'view',
  'compliance',
  'data_governance',
  true, false, false, false, false, false,
  true, true, true, true
FROM support_artifacts, support_roles;

-- Indexes removed for simplified import