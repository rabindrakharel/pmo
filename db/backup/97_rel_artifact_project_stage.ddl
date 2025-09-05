-- ============================================================================
-- ARTIFACT-PROJECT STAGE RELATIONSHIP TABLE
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Many-to-many relationship between artifacts and project stages, defining
--   which artifacts are applicable, required, or produced at specific stages
--   of project execution. Enables stage-gated artifact management and
--   project lifecycle governance.
--
-- Integration:
--   - Links d_artifact to meta_project_stage for lifecycle management
--   - Supports stage-gated project processes and artifact requirements
--   - Enables project template management and standardization
--   - Facilitates project governance and quality control

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.rel_artifact_project_stage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationship fields
  artifact_id uuid NOT NULL REFERENCES app.d_artifact(id) ON DELETE CASCADE,
  project_stage_id int NOT NULL REFERENCES app.meta_project_stage(level_id),
  
  -- Temporal and audit fields
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  
  -- Stage relationship context
  stage_applicability text DEFAULT 'specific',
  artifact_requirement text DEFAULT 'optional',
  usage_pattern text DEFAULT 'input',
  
  -- Stage governance
  mandatory_for_gate boolean DEFAULT false,
  approval_required boolean DEFAULT false,
  template_artifact boolean DEFAULT false,
  
  -- Version and lifecycle control
  version_requirement text,
  stage_lock_version boolean DEFAULT false,
  inherit_from_previous boolean DEFAULT false,
  
  -- Unique constraint
  UNIQUE(artifact_id, project_stage_id, from_ts) DEFERRABLE INITIALLY DEFERRED
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Artifact-Project Stage Relationships for Huron Home Services

-- Design Artifacts and Project Stages
WITH design_artifacts AS (
  SELECT 
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'DESIGN-LAND-RES-001') AS residential_design_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'DESIGN-LAND-COM-001') AS commercial_design_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'DESIGN-SOLAR-001') AS solar_design_id
),
project_stages AS (
  SELECT 
    (SELECT level_id FROM app.meta_project_stage WHERE level_name = 'Initiation') AS initiation_id,
    (SELECT level_id FROM app.meta_project_stage WHERE level_name = 'Planning') AS planning_id,
    (SELECT level_id FROM app.meta_project_stage WHERE level_name = 'Execution') AS execution_id,
    (SELECT level_id FROM app.meta_project_stage WHERE level_name = 'Monitoring') AS monitoring_id,
    (SELECT level_id FROM app.meta_project_stage WHERE level_name = 'Closure') AS closure_id
)

INSERT INTO app.rel_artifact_project_stage (
  artifact_id, project_stage_id, stage_applicability, artifact_requirement,
  usage_pattern, mandatory_for_gate, approval_required, template_artifact
)
-- Residential Design Template Usage Across Project Stages
SELECT 
  design_artifacts.residential_design_id,
  project_stages.initiation_id,
  'template',
  'recommended',
  'reference',
  false,
  false,
  true
FROM design_artifacts, project_stages

UNION ALL

SELECT 
  design_artifacts.residential_design_id,
  project_stages.planning_id,
  'specific',
  'mandatory',
  'input',
  true,
  true,
  true
FROM design_artifacts, project_stages

UNION ALL

SELECT 
  design_artifacts.residential_design_id,
  project_stages.execution_id,
  'spanning',
  'mandatory',
  'reference',
  false,
  false,
  false
FROM design_artifacts, project_stages

-- Commercial Design Standards Usage
UNION ALL

SELECT 
  design_artifacts.commercial_design_id,
  project_stages.initiation_id,
  'template',
  'recommended',
  'reference',
  false,
  false,
  true
FROM design_artifacts, project_stages

UNION ALL

SELECT 
  design_artifacts.commercial_design_id,
  project_stages.planning_id,
  'specific',
  'mandatory',
  'compliance',
  true,
  true,
  true
FROM design_artifacts, project_stages

UNION ALL

SELECT 
  design_artifacts.commercial_design_id,
  project_stages.execution_id,
  'spanning',
  'mandatory',
  'quality_control',
  false,
  false,
  false
FROM design_artifacts, project_stages

UNION ALL

SELECT 
  design_artifacts.commercial_design_id,
  project_stages.monitoring_id,
  'specific',
  'optional',
  'audit_reference',
  false,
  false,
  false
FROM design_artifacts, project_stages

-- Solar Installation Design Guide Usage  
UNION ALL

SELECT 
  design_artifacts.solar_design_id,
  project_stages.initiation_id,
  'specific',
  'recommended',
  'assessment',
  false,
  false,
  true
FROM design_artifacts, project_stages

UNION ALL

SELECT 
  design_artifacts.solar_design_id,
  project_stages.planning_id,
  'specific',
  'mandatory',
  'design_input',
  true,
  true,
  false
FROM design_artifacts, project_stages

UNION ALL

SELECT 
  design_artifacts.solar_design_id,
  project_stages.execution_id,
  'spanning',
  'mandatory',
  'installation_guide',
  false,
  false,
  false
FROM design_artifacts, project_stages;

-- Policy and Compliance Artifacts
WITH policy_artifacts AS (
  SELECT 
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'POLICY-SAFETY-001') AS safety_policy_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'POLICY-PRIVACY-001') AS privacy_policy_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'MANUAL-QA-001') AS qa_manual_id
)

INSERT INTO app.rel_artifact_project_stage (
  artifact_id, project_stage_id, stage_applicability, artifact_requirement,
  usage_pattern, mandatory_for_gate, approval_required, template_artifact,
  inherit_from_previous
)
-- Safety Policy - Required across all project stages
SELECT 
  policy_artifacts.safety_policy_id,
  project_stages.planning_id,
  'spanning',
  'mandatory',
  'compliance',
  true,
  false,
  false,
  false
FROM policy_artifacts, project_stages

UNION ALL

SELECT 
  policy_artifacts.safety_policy_id,
  project_stages.execution_id,
  'spanning',
  'mandatory',
  'operational_compliance',
  false,
  false,
  false,
  true
FROM policy_artifacts, project_stages

UNION ALL

SELECT 
  policy_artifacts.safety_policy_id,
  project_stages.monitoring_id,
  'specific',
  'mandatory',
  'audit_compliance',
  false,
  false,
  false,
  true
FROM policy_artifacts, project_stages

-- Privacy Policy - Applicable to client-facing projects
UNION ALL

SELECT 
  policy_artifacts.privacy_policy_id,
  project_stages.initiation_id,
  'specific',
  'conditional',
  'compliance_check',
  false,
  false,
  false,
  false
FROM policy_artifacts, project_stages

UNION ALL

SELECT 
  policy_artifacts.privacy_policy_id,
  project_stages.planning_id,
  'specific',
  'conditional',
  'data_governance',
  true,
  false,
  false,
  false
FROM policy_artifacts, project_stages

-- Quality Assurance Manual - Quality control stages
UNION ALL

SELECT 
  policy_artifacts.qa_manual_id,
  project_stages.planning_id,
  'specific',
  'recommended',
  'quality_planning',
  false,
  false,
  true,
  false
FROM policy_artifacts, project_stages

UNION ALL

SELECT 
  policy_artifacts.qa_manual_id,
  project_stages.execution_id,
  'spanning',
  'optional',
  'quality_control',
  false,
  false,
  false,
  false
FROM policy_artifacts, project_stages

UNION ALL

SELECT 
  policy_artifacts.qa_manual_id,
  project_stages.monitoring_id,
  'specific',
  'recommended',
  'quality_assurance',
  false,
  false,
  false,
  false
FROM policy_artifacts, project_stages

UNION ALL

SELECT 
  policy_artifacts.qa_manual_id,
  project_stages.closure_id,
  'specific',
  'optional',
  'lessons_learned',
  false,
  false,
  false,
  false
FROM policy_artifacts, project_stages;

-- Contract and Business Artifacts
WITH business_artifacts AS (
  SELECT 
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'RFP-RESP-MISS-001') AS mississauga_rfp_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'SOW-OAK-LUX-001') AS oakville_sow_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'PROP-HAM-EXP-001') AS hamilton_proposal_id
)

INSERT INTO app.rel_artifact_project_stage (
  artifact_id, project_stage_id, stage_applicability, artifact_requirement,
  usage_pattern, mandatory_for_gate, approval_required, template_artifact,
  stage_lock_version
)
-- RFP Response - Project initiation and foundation
SELECT 
  business_artifacts.mississauga_rfp_id,
  project_stages.initiation_id,
  'specific',
  'mandatory',
  'project_foundation',
  true,
  true,
  false,
  true
FROM business_artifacts, project_stages

UNION ALL

SELECT 
  business_artifacts.mississauga_rfp_id,
  project_stages.planning_id,
  'spanning',
  'mandatory',
  'planning_reference',
  false,
  false,
  false,
  true
FROM business_artifacts, project_stages

-- Statement of Work - Contract execution
UNION ALL

SELECT 
  business_artifacts.oakville_sow_id,
  project_stages.initiation_id,
  'specific',
  'mandatory',
  'contract_foundation',
  true,
  true,
  false,
  true
FROM business_artifacts, project_stages

UNION ALL

SELECT 
  business_artifacts.oakville_sow_id,
  project_stages.planning_id,
  'spanning',
  'mandatory',
  'scope_definition',
  true,
  false,
  false,
  true
FROM business_artifacts, project_stages

UNION ALL

SELECT 
  business_artifacts.oakville_sow_id,
  project_stages.execution_id,
  'spanning',
  'mandatory',
  'delivery_reference',
  false,
  false,
  false,
  true
FROM business_artifacts, project_stages

-- Strategic Proposal - Market expansion
UNION ALL

SELECT 
  business_artifacts.hamilton_proposal_id,
  project_stages.initiation_id,
  'specific',
  'mandatory',
  'strategic_foundation',
  true,
  true,
  false,
  true
FROM business_artifacts, project_stages

UNION ALL

SELECT 
  business_artifacts.hamilton_proposal_id,
  project_stages.planning_id,
  'specific',
  'mandatory',
  'implementation_planning',
  true,
  false,
  false,
  true
FROM business_artifacts, project_stages;

-- Training and Onboarding Artifacts
WITH training_artifacts AS (
  SELECT 
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'ONBOARD-EMP-001') AS employee_onboarding_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'TRAIN-HVAC-001') AS hvac_training_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'ONBOARD-CLIENT-001') AS client_onboarding_id
)

INSERT INTO app.rel_artifact_project_stage (
  artifact_id, project_stage_id, stage_applicability, artifact_requirement,
  usage_pattern, mandatory_for_gate, approval_required, template_artifact
)
-- Employee Onboarding - Planning and execution phases
SELECT 
  training_artifacts.employee_onboarding_id,
  project_stages.planning_id,
  'specific',
  'optional',
  'resource_preparation',
  false,
  false,
  true
FROM training_artifacts, project_stages

UNION ALL

SELECT 
  training_artifacts.employee_onboarding_id,
  project_stages.execution_id,
  'specific',
  'recommended',
  'team_integration',
  false,
  false,
  false
FROM training_artifacts, project_stages

-- HVAC Technical Training - Execution and quality control
UNION ALL

SELECT 
  training_artifacts.hvac_training_id,
  project_stages.planning_id,
  'specific',
  'conditional',
  'skill_verification',
  false,
  false,
  true
FROM training_artifacts, project_stages

UNION ALL

SELECT 
  training_artifacts.hvac_training_id,
  project_stages.execution_id,
  'spanning',
  'conditional',
  'technical_reference',
  false,
  false,
  false
FROM training_artifacts, project_stages

-- Client Onboarding Process - Project initiation
UNION ALL

SELECT 
  training_artifacts.client_onboarding_id,
  project_stages.initiation_id,
  'template',
  'recommended',
  'client_integration',
  false,
  false,
  true
FROM training_artifacts, project_stages

UNION ALL

SELECT 
  training_artifacts.client_onboarding_id,
  project_stages.planning_id,
  'specific',
  'optional',
  'stakeholder_management',
  false,
  false,
  false
FROM training_artifacts, project_stages;

-- Indexes removed for simplified import