-- ============================================================================
-- ARTIFACT-EMPLOYEE RELATIONSHIP TABLE
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Many-to-many relationship between artifacts and employees, defining
--   ownership, stewardship, collaboration, and access relationships.
--   Supports artifact governance, knowledge management, and accountability
--   throughout the artifact lifecycle.
--
-- Integration:
--   - Links d_artifact to d_employee for ownership and accountability
--   - Supports collaborative artifact development and maintenance
--   - Enables knowledge management and expertise tracking
--   - Facilitates artifact governance and access control

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.rel_artifact_employee (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationship fields
  artifact_id uuid NOT NULL REFERENCES app.d_artifact(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES app.d_employee(id) ON DELETE CASCADE,
  
  -- Temporal and audit fields
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  
  -- Relationship context
  relationship_type text NOT NULL DEFAULT 'owner',
  responsibility_level text DEFAULT 'primary',
  access_level text DEFAULT 'full',
  
  -- Permission and authority
  can_read boolean DEFAULT true,
  can_edit boolean DEFAULT false,
  can_approve boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  can_share boolean DEFAULT false,
  
  -- Collaboration details
  contribution_type text,
  expertise_area text,
  notification_preferences jsonb DEFAULT '{}'::jsonb,
  
  -- Time tracking
  assignment_date date DEFAULT CURRENT_DATE,
  last_contribution_date date,
  total_contribution_hours numeric(6,2),
  
  -- Unique constraint per relationship type
  UNIQUE(artifact_id, employee_id, relationship_type, from_ts) DEFERRABLE INITIALLY DEFERRED
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Artifact-Employee Relationships for Huron Home Services

-- Design Artifact Ownership and Collaboration
WITH design_artifacts AS (
  SELECT 
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'DESIGN-LAND-RES-001') AS residential_design_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'DESIGN-LAND-COM-001') AS commercial_design_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'DESIGN-SOLAR-001') AS solar_design_id
),
design_team AS (
  SELECT 
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-010') AS amanda_foster_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-006') AS jennifer_walsh_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-007') AS michael_patterson_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-012') AS kevin_obrien_id
)

INSERT INTO app.rel_artifact_employee (
  artifact_id, employee_id, relationship_type, responsibility_level, access_level,
  can_read, can_edit, can_approve, can_delete, can_share,
  contribution_type, expertise_area, assignment_date, notification_preferences
)
-- Residential Design Template Ownership
SELECT 
  design_artifacts.residential_design_id,
  design_team.amanda_foster_id,
  'owner',
  'primary',
  'full',
  true, true, true, true, true,
  'creation_and_maintenance',
  'residential_landscape_design',
  '2024-01-15'::date,
  '{"updates": true, "usage": true, "reviews": true}'::jsonb
FROM design_artifacts, design_team

UNION ALL

SELECT 
  design_artifacts.residential_design_id,
  design_team.jennifer_walsh_id,
  'approver',
  'oversight',
  'review',
  true, false, true, false, true,
  'quality_approval',
  'landscaping_standards',
  '2024-01-15'::date,
  '{"approvals": true, "major_updates": true}'::jsonb
FROM design_artifacts, design_team

UNION ALL

SELECT 
  design_artifacts.residential_design_id,
  design_team.amanda_foster_id,
  'collaborator',
  'secondary',
  'edit',
  true, true, false, false, true,
  'template_enhancement',
  'sustainable_design',
  '2024-02-01'::date,
  '{"updates": true, "collaboration": true}'::jsonb
FROM design_artifacts, design_team

-- Commercial Design Standards Ownership
UNION ALL

SELECT 
  design_artifacts.commercial_design_id,
  design_team.amanda_foster_id,
  'owner',
  'primary',
  'full',
  true, true, true, true, true,
  'standards_development',
  'commercial_design_standards',
  '2024-01-20'::date,
  '{"updates": true, "compliance": true, "reviews": true}'::jsonb
FROM design_artifacts, design_team

UNION ALL

SELECT 
  design_artifacts.commercial_design_id,
  design_team.jennifer_walsh_id,
  'approver',
  'oversight',
  'review',
  true, false, true, false, true,
  'compliance_approval',
  'commercial_landscaping',
  '2024-01-20'::date,
  '{"approvals": true, "compliance_updates": true}'::jsonb
FROM design_artifacts, design_team

-- Solar Installation Design Guide
UNION ALL

SELECT 
  design_artifacts.solar_design_id,
  design_team.michael_patterson_id,
  'owner',
  'primary',
  'full',
  true, true, true, true, true,
  'technical_authorship',
  'solar_system_design',
  '2024-06-01'::date,
  '{"updates": true, "technical_reviews": true, "installations": true}'::jsonb
FROM design_artifacts, design_team

UNION ALL

SELECT 
  design_artifacts.solar_design_id,
  design_team.kevin_obrien_id,
  'collaborator',
  'secondary',
  'edit',
  true, true, false, false, true,
  'electrical_expertise',
  'electrical_systems',
  '2024-06-05'::date,
  '{"technical_updates": true, "electrical_reviews": true}'::jsonb
FROM design_artifacts, design_team

UNION ALL

SELECT 
  design_artifacts.solar_design_id,
  design_team.jennifer_walsh_id,
  'reviewer',
  'quality_control',
  'review',
  true, false, false, false, true,
  'quality_review',
  'service_integration',
  '2024-06-10'::date,
  '{"quality_reviews": true, "integration_feedback": true}'::jsonb
FROM design_artifacts, design_team;

-- Policy and Compliance Artifact Ownership
WITH policy_artifacts AS (
  SELECT 
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'POLICY-SAFETY-001') AS safety_policy_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'POLICY-PRIVACY-001') AS privacy_policy_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'MANUAL-QA-001') AS qa_manual_id
),
management_team AS (
  SELECT 
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-004') AS maria_rodriguez_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-002') AS sarah_chen_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-011') AS tom_richardson_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-005') AS robert_thompson_id
)

INSERT INTO app.rel_artifact_employee (
  artifact_id, employee_id, relationship_type, responsibility_level, access_level,
  can_read, can_edit, can_approve, can_delete, can_share,
  contribution_type, expertise_area, assignment_date, notification_preferences
)
-- Safety Management System Policy
SELECT 
  policy_artifacts.safety_policy_id,
  management_team.maria_rodriguez_id,
  'owner',
  'primary',
  'full',
  true, true, true, true, true,
  'policy_development',
  'safety_management',
  '2024-01-15'::date,
  '{"policy_updates": true, "incidents": true, "compliance": true}'::jsonb
FROM policy_artifacts, management_team

UNION ALL

SELECT 
  policy_artifacts.safety_policy_id,
  management_team.tom_richardson_id,
  'implementer',
  'operational',
  'edit',
  true, true, false, false, true,
  'field_implementation',
  'operational_safety',
  '2024-01-20'::date,
  '{"field_updates": true, "incident_reports": true}'::jsonb
FROM policy_artifacts, management_team

UNION ALL

SELECT 
  policy_artifacts.safety_policy_id,
  management_team.robert_thompson_id,
  'approver',
  'executive',
  'review',
  true, false, true, false, true,
  'executive_oversight',
  'corporate_governance',
  '2024-01-15'::date,
  '{"major_policy_changes": true, "compliance_issues": true}'::jsonb
FROM policy_artifacts, management_team

-- Customer Privacy Protection Policy
UNION ALL

SELECT 
  policy_artifacts.privacy_policy_id,
  management_team.sarah_chen_id,
  'owner',
  'primary',
  'full',
  true, true, true, true, true,
  'privacy_governance',
  'regulatory_compliance',
  '2024-03-01'::date,
  '{"policy_updates": true, "privacy_incidents": true, "regulatory_changes": true}'::jsonb
FROM policy_artifacts, management_team

UNION ALL

SELECT 
  policy_artifacts.privacy_policy_id,
  management_team.robert_thompson_id,
  'approver',
  'executive',
  'review',
  true, false, true, false, true,
  'executive_approval',
  'corporate_compliance',
  '2024-03-01'::date,
  '{"major_privacy_changes": true, "breach_notifications": true}'::jsonb
FROM policy_artifacts, management_team

-- Quality Assurance Standards Manual
UNION ALL

SELECT 
  policy_artifacts.qa_manual_id,
  management_team.tom_richardson_id,
  'owner',
  'primary',
  'full',
  true, true, true, true, true,
  'quality_standards_development',
  'quality_management',
  '2024-06-15'::date,
  '{"quality_updates": true, "process_improvements": true, "audits": true}'::jsonb
FROM policy_artifacts, management_team

UNION ALL

SELECT 
  policy_artifacts.qa_manual_id,
  management_team.maria_rodriguez_id,
  'approver',
  'oversight',
  'review',
  true, false, true, false, true,
  'operational_approval',
  'operational_excellence',
  '2024-06-15'::date,
  '{"quality_approvals": true, "operational_alignment": true}'::jsonb
FROM policy_artifacts, management_team;

-- Business and Contract Artifacts
WITH business_artifacts AS (
  SELECT 
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'RFP-RESP-MISS-001') AS mississauga_rfp_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'SOW-OAK-LUX-001') AS oakville_sow_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'PROP-HAM-EXP-001') AS hamilton_proposal_id
),
business_team AS (
  SELECT 
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-008') AS lisa_chang_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-009') AS paul_martineau_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-005') AS robert_thompson_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-006') AS jennifer_walsh_id
)

INSERT INTO app.rel_artifact_employee (
  artifact_id, employee_id, relationship_type, responsibility_level, access_level,
  can_read, can_edit, can_approve, can_delete, can_share,
  contribution_type, expertise_area, assignment_date, last_contribution_date,
  notification_preferences
)
-- City of Mississauga Parks RFP Response
SELECT 
  business_artifacts.mississauga_rfp_id,
  business_team.paul_martineau_id,
  'owner',
  'primary',
  'full',
  true, true, true, true, true,
  'rfp_development',
  'municipal_contracts',
  '2024-07-01'::date,
  '2024-08-15'::date,
  '{"rfp_updates": true, "municipal_communications": true, "award_notifications": true}'::jsonb
FROM business_artifacts, business_team

UNION ALL

SELECT 
  business_artifacts.mississauga_rfp_id,
  business_team.jennifer_walsh_id,
  'collaborator',
  'technical',
  'edit',
  true, true, false, false, true,
  'technical_specifications',
  'landscaping_expertise',
  '2024-07-05'::date,
  '2024-08-10'::date,
  '{"technical_updates": true, "specification_reviews": true}'::jsonb
FROM business_artifacts, business_team

UNION ALL

SELECT 
  business_artifacts.mississauga_rfp_id,
  business_team.robert_thompson_id,
  'approver',
  'executive',
  'review',
  true, false, true, false, true,
  'executive_approval',
  'strategic_oversight',
  '2024-08-12'::date,
  '2024-08-15'::date,
  '{"final_approvals": true, "strategic_alignment": true}'::jsonb
FROM business_artifacts, business_team

-- Oakville Luxury Residential SOW
UNION ALL

SELECT 
  business_artifacts.oakville_sow_id,
  business_team.lisa_chang_id,
  'owner',
  'primary',
  'full',
  true, true, true, true, true,
  'sow_development',
  'luxury_residential',
  '2024-06-15'::date,
  '2024-07-20'::date,
  '{"sow_updates": true, "client_communications": true, "contract_changes": true}'::jsonb
FROM business_artifacts, business_team

UNION ALL

SELECT 
  business_artifacts.oakville_sow_id,
  business_team.jennifer_walsh_id,
  'collaborator',
  'technical',
  'edit',
  true, true, false, false, true,
  'service_specifications',
  'premium_landscaping',
  '2024-06-20'::date,
  '2024-07-15'::date,
  '{"service_updates": true, "quality_standards": true}'::jsonb
FROM business_artifacts, business_team

-- Hamilton Market Expansion Proposal
UNION ALL

SELECT 
  business_artifacts.hamilton_proposal_id,
  business_team.robert_thompson_id,
  'owner',
  'primary',
  'full',
  true, true, true, true, true,
  'strategic_development',
  'market_expansion',
  '2024-08-01'::date,
  '2024-09-01'::date,
  '{"strategic_updates": true, "market_intelligence": true, "expansion_progress": true}'::jsonb
FROM business_artifacts, business_team

UNION ALL

SELECT 
  business_artifacts.hamilton_proposal_id,
  business_team.lisa_chang_id,
  'collaborator',
  'analytical',
  'edit',
  true, true, false, false, true,
  'market_analysis',
  'business_development',
  '2024-08-05'::date,
  '2024-08-25'::date,
  '{"market_updates": true, "competitive_intelligence": true}'::jsonb
FROM business_artifacts, business_team;

-- Training and Development Artifacts
WITH training_artifacts AS (
  SELECT 
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'ONBOARD-EMP-001') AS employee_onboarding_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'TRAIN-HVAC-001') AS hvac_training_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'ONBOARD-CLIENT-001') AS client_onboarding_id
),
hr_team AS (
  SELECT 
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-017') AS rachel_kim_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-012') AS kevin_obrien_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-007') AS michael_patterson_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-008') AS lisa_chang_id
)

INSERT INTO app.rel_artifact_employee (
  artifact_id, employee_id, relationship_type, responsibility_level, access_level,
  can_read, can_edit, can_approve, can_delete, can_share,
  contribution_type, expertise_area, assignment_date, notification_preferences
)
-- New Employee Onboarding Guide
SELECT 
  training_artifacts.employee_onboarding_id,
  hr_team.rachel_kim_id,
  'owner',
  'primary',
  'full',
  true, true, true, true, true,
  'content_development',
  'employee_experience',
  '2024-01-15'::date,
  '{"content_updates": true, "feedback": true, "process_improvements": true}'::jsonb
FROM training_artifacts, hr_team

UNION ALL

SELECT 
  training_artifacts.employee_onboarding_id,
  hr_team.lisa_chang_id,
  'reviewer',
  'quality_assurance',
  'review',
  true, false, false, false, true,
  'content_review',
  'process_optimization',
  '2024-01-20'::date,
  '{"content_reviews": true, "process_feedback": true}'::jsonb
FROM training_artifacts, hr_team

-- HVAC Technician Certification Guide
UNION ALL

SELECT 
  training_artifacts.hvac_training_id,
  hr_team.michael_patterson_id,
  'owner',
  'primary',
  'full',
  true, true, true, true, true,
  'technical_content_development',
  'hvac_expertise',
  '2024-04-10'::date,
  '{"technical_updates": true, "certification_changes": true, "training_feedback": true}'::jsonb
FROM training_artifacts, hr_team

UNION ALL

SELECT 
  training_artifacts.hvac_training_id,
  hr_team.kevin_obrien_id,
  'collaborator',
  'technical_input',
  'edit',
  true, true, false, false, true,
  'practical_expertise',
  'field_experience',
  '2024-04-15'::date,
  '{"practical_updates": true, "field_feedback": true}'::jsonb
FROM training_artifacts, hr_team

-- Client Onboarding Process Model
UNION ALL

SELECT 
  training_artifacts.client_onboarding_id,
  hr_team.lisa_chang_id,
  'owner',
  'primary',
  'full',
  true, true, true, true, true,
  'process_design',
  'client_experience',
  '2024-05-15'::date,
  '{"process_updates": true, "client_feedback": true, "system_integration": true}'::jsonb
FROM training_artifacts, hr_team

UNION ALL

SELECT 
  training_artifacts.client_onboarding_id,
  hr_team.rachel_kim_id,
  'implementer',
  'operational',
  'edit',
  true, true, false, false, true,
  'process_execution',
  'customer_service',
  '2024-05-20'::date,
  '{"execution_feedback": true, "client_interactions": true}'::jsonb
FROM training_artifacts, hr_team;

-- Indexes removed for simplified import