-- ============================================================================
-- ARTIFACT-BUSINESS RELATIONSHIP TABLE
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Many-to-many relationship between artifacts and business organizational units,
--   enabling artifacts to be associated with multiple business organizational levels
--   from corporate-wide policies to department-specific procedures and
--   team-level operational documents.
--
-- Integration:
--   - Links d_artifact to d_scope_biz for business organizational ownership
--   - Supports artifact governance and access control by organizational unit
--   - Enables organizational knowledge management and document libraries
--   - Facilitates compliance and policy management across organizational hierarchy

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.rel_artifact_biz (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationship fields
  artifact_id uuid NOT NULL REFERENCES app.d_artifact(id) ON DELETE CASCADE,
  biz_id uuid NOT NULL REFERENCES app.d_scope_biz(id) ON DELETE CASCADE,
  
  -- Temporal and audit fields
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  
  -- Organizational context
  scope_level text DEFAULT 'unit',
  ownership_type text DEFAULT 'shared',
  access_level text DEFAULT 'department',
  
  -- Governance and compliance
  mandatory_compliance boolean DEFAULT false,
  inheritance_enabled boolean DEFAULT true,
  review_frequency text,
  
  -- Usage tracking
  primary_owner boolean DEFAULT false,
  usage_count int DEFAULT 0,
  last_accessed_date date,
  
  -- Unique constraint
  UNIQUE(artifact_id, biz_id, from_ts) DEFERRABLE INITIALLY DEFERRED
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Artifact-Business Relationships for Huron Home Services

-- Corporate-Level Policy and Procedure Artifacts
WITH corporate_artifacts AS (
  SELECT 
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'POLICY-SAFETY-001') AS safety_policy_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'POLICY-PRIVACY-001') AS privacy_policy_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'MANUAL-QA-001') AS qa_manual_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'ONBOARD-EMP-001') AS employee_onboarding_id
),
organizations AS (
  SELECT 
    (SELECT id FROM app.d_scope_biz WHERE name = 'Huron Home Services') AS corporation_id,
    (SELECT id FROM app.d_scope_biz WHERE name = 'Business Operations Division') AS biz_ops_id,
    (SELECT id FROM app.d_scope_biz WHERE name = 'Corporate Services Division') AS corp_services_id,
    (SELECT id FROM app.d_scope_biz WHERE name = 'Landscaping Department') AS landscaping_dept_id,
    (SELECT id FROM app.d_scope_biz WHERE name = 'HVAC Services Department') AS hvac_dept_id,
    (SELECT id FROM app.d_scope_biz WHERE name = 'Plumbing Services Department') AS plumbing_dept_id
)

INSERT INTO app.rel_artifact_biz (
  artifact_id, biz_id, scope_level, ownership_type, access_level,
  mandatory_compliance, inheritance_enabled, review_frequency, primary_owner
)
-- Corporate-wide Safety Policy
SELECT 
  corporate_artifacts.safety_policy_id,
  organizations.corporation_id,
  'corporate',
  'enterprise',
  'all_employees',
  true,
  true,
  'annually',
  true
FROM corporate_artifacts, organizations

UNION ALL

SELECT 
  corporate_artifacts.safety_policy_id,
  organizations.biz_ops_id,
  'division',
  'inherited',
  'all_division',
  true,
  true,
  'annually',
  false
FROM corporate_artifacts, organizations

UNION ALL

SELECT 
  corporate_artifacts.safety_policy_id,
  organizations.landscaping_dept_id,
  'department',
  'inherited',
  'department',
  true,
  true,
  'quarterly',
  false
FROM corporate_artifacts, organizations

UNION ALL

SELECT 
  corporate_artifacts.safety_policy_id,
  organizations.hvac_dept_id,
  'department',
  'inherited',
  'department',
  true,
  true,
  'quarterly',
  false
FROM corporate_artifacts, organizations

-- Corporate-wide Privacy Policy
UNION ALL

SELECT 
  corporate_artifacts.privacy_policy_id,
  organizations.corporation_id,
  'corporate',
  'enterprise',
  'all_employees',
  true,
  true,
  'annually',
  true
FROM corporate_artifacts, organizations

UNION ALL

SELECT 
  corporate_artifacts.privacy_policy_id,
  organizations.corp_services_id,
  'division',
  'primary',
  'all_division',
  true,
  true,
  'annually',
  false
FROM corporate_artifacts, organizations

-- Quality Assurance Manual - Multi-divisional
UNION ALL

SELECT 
  corporate_artifacts.qa_manual_id,
  organizations.biz_ops_id,
  'division',
  'primary',
  'all_division',
  true,
  true,
  'semi_annually',
  true
FROM corporate_artifacts, organizations

UNION ALL

SELECT 
  corporate_artifacts.qa_manual_id,
  organizations.landscaping_dept_id,
  'department',
  'inherited',
  'department',
  true,
  true,
  'quarterly',
  false
FROM corporate_artifacts, organizations

UNION ALL

SELECT 
  corporate_artifacts.qa_manual_id,
  organizations.hvac_dept_id,
  'department',
  'inherited',
  'department',
  true,
  true,
  'quarterly',
  false
FROM corporate_artifacts, organizations

UNION ALL

SELECT 
  corporate_artifacts.qa_manual_id,
  organizations.plumbing_dept_id,
  'department',
  'inherited',
  'department',
  true,
  true,
  'quarterly',
  false
FROM corporate_artifacts, organizations

-- Employee Onboarding Guide - Corporate Services ownership
UNION ALL

SELECT 
  corporate_artifacts.employee_onboarding_id,
  organizations.corp_services_id,
  'division',
  'primary',
  'all_employees',
  true,
  true,
  'annually',
  true
FROM corporate_artifacts, organizations

UNION ALL

SELECT 
  corporate_artifacts.employee_onboarding_id,
  organizations.biz_ops_id,
  'division',
  'shared',
  'all_division',
  true,
  true,
  'annually',
  false
FROM corporate_artifacts, organizations;

-- Department-Specific Design and Technical Artifacts
WITH department_artifacts AS (
  SELECT 
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'DESIGN-LAND-RES-001') AS residential_design_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'DESIGN-LAND-COM-001') AS commercial_design_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'DESIGN-SOLAR-001') AS solar_design_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'TRAIN-HVAC-001') AS hvac_training_id
),
departments AS (
  SELECT 
    (SELECT id FROM app.d_scope_biz WHERE name = 'Landscaping Department') AS landscaping_dept_id,
    (SELECT id FROM app.d_scope_biz WHERE name = 'HVAC Services Department') AS hvac_dept_id,
    (SELECT id FROM app.d_scope_biz WHERE name = 'Residential Landscaping Team') AS residential_team_id,
    (SELECT id FROM app.d_scope_biz WHERE name = 'Commercial Landscaping Team') AS commercial_team_id
)

INSERT INTO app.rel_artifact_biz (
  artifact_id, biz_id, scope_level, ownership_type, access_level,
  mandatory_compliance, inheritance_enabled, review_frequency, primary_owner
)
-- Landscaping Design Templates
SELECT 
  department_artifacts.residential_design_id,
  departments.landscaping_dept_id,
  'department',
  'primary',
  'department',
  false,
  true,
  'semi_annually',
  true
FROM department_artifacts, departments

UNION ALL

SELECT 
  department_artifacts.residential_design_id,
  departments.residential_team_id,
  'team',
  'primary',
  'team',
  false,
  true,
  'quarterly',
  false
FROM department_artifacts, departments

UNION ALL

SELECT 
  department_artifacts.commercial_design_id,
  departments.landscaping_dept_id,
  'department',
  'primary',
  'department',
  false,
  true,
  'semi_annually',
  true
FROM department_artifacts, departments

UNION ALL

SELECT 
  department_artifacts.commercial_design_id,
  departments.commercial_team_id,
  'team',
  'primary',
  'team',
  false,
  true,
  'quarterly',
  false
FROM department_artifacts, departments

-- HVAC Department Technical Artifacts
UNION ALL

SELECT 
  department_artifacts.solar_design_id,
  departments.hvac_dept_id,
  'department',
  'primary',
  'department',
  false,
  true,
  'annually',
  true
FROM department_artifacts, departments

UNION ALL

SELECT 
  department_artifacts.hvac_training_id,
  departments.hvac_dept_id,
  'department',
  'primary',
  'department',
  true,
  false,
  'annually',
  true
FROM department_artifacts, departments;

-- Business Development and Strategic Artifacts
WITH strategic_artifacts AS (
  SELECT 
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'RFP-RESP-MISS-001') AS mississauga_rfp_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'PROP-HAM-EXP-001') AS hamilton_proposal_id,
    (SELECT id FROM app.d_artifact WHERE artifact_code = 'SOW-OAK-LUX-001') AS oakville_sow_id
),
business_units AS (
  SELECT 
    (SELECT id FROM app.d_scope_biz WHERE name = 'Business Operations Division') AS biz_ops_id,
    (SELECT id FROM app.d_scope_biz WHERE name = 'Landscaping Department') AS landscaping_dept_id,
    (SELECT id FROM app.d_scope_biz WHERE name = 'Commercial Landscaping Team') AS commercial_team_id
)

INSERT INTO app.rel_artifact_biz (
  artifact_id, biz_id, scope_level, ownership_type, access_level,
  mandatory_compliance, inheritance_enabled, review_frequency, primary_owner
)
-- Municipal RFP Response - Business Operations Division
SELECT 
  strategic_artifacts.mississauga_rfp_id,
  business_units.biz_ops_id,
  'division',
  'primary',
  'management',
  false,
  false,
  'as_needed',
  true
FROM strategic_artifacts, business_units

UNION ALL

SELECT 
  strategic_artifacts.mississauga_rfp_id,
  business_units.landscaping_dept_id,
  'department',
  'contributor',
  'department',
  false,
  false,
  'as_needed',
  false
FROM strategic_artifacts, business_units

-- Hamilton Expansion Proposal - Strategic level
UNION ALL

SELECT 
  strategic_artifacts.hamilton_proposal_id,
  business_units.biz_ops_id,
  'division',
  'primary',
  'executive',
  false,
  false,
  'quarterly',
  true
FROM strategic_artifacts, business_units

-- Oakville Luxury SOW - Service delivery focused
UNION ALL

SELECT 
  strategic_artifacts.oakville_sow_id,
  business_units.landscaping_dept_id,
  'department',
  'primary',
  'department',
  true,
  false,
  'project_based',
  true
FROM strategic_artifacts, business_units

UNION ALL

SELECT 
  strategic_artifacts.oakville_sow_id,
  business_units.commercial_team_id,
  'team',
  'executor',
  'team',
  true,
  false,
  'project_based',
  false
FROM strategic_artifacts, business_units;

-- Indexes removed for simplified import