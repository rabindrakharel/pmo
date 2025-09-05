-- ============================================================================
-- ARTIFACT-PROJECT RELATIONSHIP TABLE
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Many-to-many relationship between artifacts and projects, enabling flexible
--   artifact assignment where single artifacts may be referenced across multiple
--   projects, or projects may utilize multiple artifacts for documentation,
--   design, and process management.
--
-- Integration:
--   - Links d_artifact to d_scope_project for project documentation
--   - Supports artifact reuse across multiple projects
--   - Enables project knowledge management and artifact libraries
--   - Facilitates project documentation standardization

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.rel_artifact_project (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationship fields
  artifact_id uuid NOT NULL REFERENCES app.d_artifact(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES app.d_scope_project(id) ON DELETE CASCADE,
  
  -- Temporal and audit fields
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  
  -- Relationship context
  relationship_type text DEFAULT 'primary',
  usage_context text,
  artifact_role text DEFAULT 'documentation',
  
  -- Project lifecycle association
  applicable_stages jsonb DEFAULT '[]'::jsonb,
  mandatory boolean DEFAULT false,
  version_locked boolean DEFAULT false,
  
  -- Unique constraint
  UNIQUE(artifact_id, project_id, from_ts) DEFERRABLE INITIALLY DEFERRED
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Artifact-Project Relationships for Huron Home Services

-- Service Delivery Project Artifacts
WITH artifacts AS (
  SELECT 
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'DESIGN-LAND-RES-001') AS residential_template_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'DESIGN-LAND-COM-001') AS commercial_standards_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'DESIGN-SOLAR-001') AS solar_guide_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'SOW-OAK-LUX-001') AS oakville_sow_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'POLICY-SAFETY-001') AS safety_policy_id
),
projects AS (
  SELECT 
    (SELECT id FROM app.d_scope_project WHERE project_code = 'FALL-2025-LAND') AS fall_landscaping_id,
    (SELECT id FROM app.d_scope_project WHERE project_code = 'SPR-2025-GARD') AS spring_garden_id,
    (SELECT id FROM app.d_scope_project WHERE project_code = 'SOL-2025-EXP') AS solar_expansion_id,
    (SELECT id FROM app.d_scope_project WHERE project_code = 'HVAC-2025-MAINT') AS hvac_maintenance_id
)

INSERT INTO app.rel_artifact_project (
  artifact_id, project_id, relationship_type, usage_context, artifact_role,
  applicable_stages, mandatory, version_locked
)
-- Fall 2025 Landscaping Campaign Artifacts
SELECT 
  artifacts.residential_template_id,
  projects.fall_landscaping_id,
  'template',
  'residential_client_design',
  'design_template',
  '["Planning", "Design", "Execution"]'::jsonb,
  true,
  true
FROM artifacts, projects

UNION ALL

SELECT 
  artifacts.commercial_standards_id,
  projects.fall_landscaping_id,
  'reference',
  'commercial_client_compliance',
  'standards_document',
  '["Planning", "Design", "Quality_Control"]'::jsonb,
  true,
  false
FROM artifacts, projects

UNION ALL

SELECT 
  artifacts.safety_policy_id,
  projects.fall_landscaping_id,
  'mandatory',
  'safety_compliance',
  'policy_document',
  '["Planning", "Execution", "Closure"]'::jsonb,
  true,
  false
FROM artifacts, projects

-- Spring 2025 Garden Design Project Artifacts
UNION ALL

SELECT 
  artifacts.residential_template_id,
  projects.spring_garden_id,
  'template',
  'premium_residential_design',
  'design_template',
  '["Initiation", "Planning", "Design", "Execution"]'::jsonb,
  true,
  true
FROM artifacts, projects

UNION ALL

SELECT 
  artifacts.oakville_sow_id,
  projects.spring_garden_id,
  'primary',
  'oakville_luxury_market',
  'contract_document',
  '["Initiation", "Planning"]'::jsonb,
  true,
  true
FROM artifacts, projects

-- Solar Panel Installation Expansion Artifacts
UNION ALL

SELECT 
  artifacts.solar_guide_id,
  projects.solar_expansion_id,
  'primary',
  'installation_guidance',
  'technical_guide',
  '["Planning", "Design", "Execution"]'::jsonb,
  true,
  true
FROM artifacts, projects

UNION ALL

SELECT 
  artifacts.safety_policy_id,
  projects.solar_expansion_id,
  'mandatory',
  'electrical_safety_compliance',
  'policy_document',
  '["Planning", "Execution", "Quality_Control"]'::jsonb,
  true,
  false
FROM artifacts, projects

-- HVAC Maintenance Contracts Project Artifacts
UNION ALL

SELECT 
  artifacts.safety_policy_id,
  projects.hvac_maintenance_id,
  'mandatory',
  'hvac_safety_protocols',
  'policy_document',
  '["Planning", "Execution", "Monitoring"]'::jsonb,
  true,
  false
FROM artifacts, projects;

-- Training and Onboarding Project Associations
WITH training_artifacts AS (
  SELECT 
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'ONBOARD-EMP-001') AS employee_onboarding_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'TRAIN-HVAC-001') AS hvac_training_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'ONBOARD-CLIENT-001') AS client_onboarding_id
),
infrastructure_projects AS (
  SELECT 
    (SELECT id FROM app.d_scope_project WHERE project_code = 'ERP-2025-P1') AS erp_project_id,
    (SELECT id FROM app.d_scope_project WHERE project_code = 'FLEET-2025-UPG') AS fleet_project_id
)

INSERT INTO app.rel_artifact_project (
  artifact_id, project_id, relationship_type, usage_context, artifact_role,
  applicable_stages, mandatory, version_locked
)
-- ERP Implementation Project Training Artifacts
SELECT 
  training_artifacts.employee_onboarding_id,
  infrastructure_projects.erp_project_id,
  'reference',
  'change_management_support',
  'training_material',
  '["Planning", "Execution", "Closure"]'::jsonb,
  false,
  false
FROM training_artifacts, infrastructure_projects

UNION ALL

SELECT 
  training_artifacts.client_onboarding_id,
  infrastructure_projects.erp_project_id,
  'reference',
  'process_integration',
  'process_model',
  '["Planning", "Design", "Execution"]'::jsonb,
  false,
  false
FROM training_artifacts, infrastructure_projects

-- Fleet Management System Upgrade Project
UNION ALL

SELECT 
  training_artifacts.employee_onboarding_id,
  infrastructure_projects.fleet_project_id,
  'reference',
  'user_training_preparation',
  'training_material',
  '["Planning", "Execution"]'::jsonb,
  false,
  false
FROM training_artifacts, infrastructure_projects;

-- Strategic Initiative Project Artifacts
WITH strategy_artifacts AS (
  SELECT 
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'PROP-HAM-EXP-001') AS hamilton_proposal_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'POLICY-PRIVACY-001') AS privacy_policy_id
),
strategic_projects AS (
  SELECT 
    (SELECT id FROM app.d_scope_project WHERE project_code = 'MKT-EXP-HAM-2025') AS hamilton_expansion_id
)

INSERT INTO app.rel_artifact_project (
  artifact_id, project_id, relationship_type, usage_context, artifact_role,
  applicable_stages, mandatory, version_locked
)
-- Hamilton Market Expansion Project
SELECT 
  strategy_artifacts.hamilton_proposal_id,
  strategic_projects.hamilton_expansion_id,
  'primary',
  'business_case_foundation',
  'proposal_document',
  '["Initiation", "Planning"]'::jsonb,
  true,
  true
FROM strategy_artifacts, strategic_projects

UNION ALL

SELECT 
  strategy_artifacts.privacy_policy_id,
  strategic_projects.hamilton_expansion_id,
  'mandatory',
  'regulatory_compliance',
  'policy_document',
  '["Planning", "Execution"]'::jsonb,
  true,
  false
FROM strategy_artifacts, strategic_projects;

-- Indexes removed for simplified import