-- ============================================================================
-- XXVI. CUSTOMER HIERARCHY META LEVELS
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Meta configuration defining customer organization hierarchy levels from
--   CEO (level 0) to Technical Lead (level 4). Represents authority levels
--   and decision-making patterns within customer organizations for proper
--   engagement protocols and escalation management.
--
-- Entity Type: setting_cust_level
-- Entity Classification: Setting Configuration Table
--
-- Hierarchy Structure:
--   Level 0: CEO - Chief Executive Officer with final decision authority
--   Level 1: Director - Director level with departmental authority
--   Level 2: Senior Manager - Senior Manager with program oversight authority
--   Level 3: Manager - Manager with team leadership and operational authority
--   Level 4: Technical Lead - Technical Lead with subject matter expertise (leaf level)
--
-- New Design Integration:
--   - Referenced by d_cust table for hierarchy validation
--   - Supports customer engagement strategy and escalation paths
--   - Enables proper stakeholder management and communication protocols
--   - Facilitates contract authority and approval workflow management
--   - Uses standard setting table structure with common fields
--
-- Legacy Design Elements Retained:
--   - Level-based hierarchy with clear authority definitions
--   - Root and leaf level designations
--   - Slug-based referencing for UI navigation
--   - Temporal tracking for meta configuration changes
--
-- Business Rules:
--   - CEO level (0) is always root, never leaf
--   - Technical Lead level (4) is always leaf, never root
--   - Middle levels (1-3) are neither root nor leaf
--   - Level IDs must be sequential and unique
--   - Level names must be business-meaningful
--
-- UI Integration:
--   - Used for customer contact hierarchy displays
--   - Supports customer escalation path visualization
--   - Enables authority-based workflow routing
--   - Provides context for contract approval workflows

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.setting_datalabel_cust_level (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Standardized setting fields
  level_id int NOT NULL,
  level_name text NOT NULL,
  slug text NOT NULL,
  is_root boolean NOT NULL DEFAULT false,
  is_leaf boolean NOT NULL DEFAULT false,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  created_ts timestamptz NOT NULL DEFAULT now(),
  updated_ts timestamptz NOT NULL DEFAULT now(),
  active_flag boolean NOT NULL DEFAULT true,

  -- Additional setting configuration
  authority_description text,
  typical_responsibilities jsonb DEFAULT '[]'::jsonb,
  escalation_protocols jsonb DEFAULT '{}'::jsonb,
  approval_thresholds jsonb DEFAULT '{}'::jsonb
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Customer Hierarchy Levels (CEO starts at level 0)
-- Comprehensive customer organization authority structure for engagement management

INSERT INTO app.setting_datalabel_cust_level (
  level_id, level_name, slug, is_root, is_leaf, authority_description,
  typical_responsibilities, escalation_protocols, approval_thresholds
) VALUES
(0, 'CEO', 'ceo', true, false,
 'Chief Executive Officer with ultimate decision authority and final approval power for all organizational commitments',
 '["strategic_decision_making", "board_reporting", "ultimate_contract_authority", "organizational_direction", "executive_leadership"]',
 '{"escalate_to": null, "escalate_when": "none", "decision_authority": "ultimate", "override_capability": true}',
 '{"contract_approval": "unlimited", "budget_authority": "unlimited", "policy_changes": "unlimited", "strategic_decisions": "unlimited"}'),

(1, 'Director', 'director', false, false,
 'Director level with departmental authority and significant decision-making power within functional areas',
 '["departmental_leadership", "budget_management", "strategic_planning", "policy_implementation", "cross_functional_coordination"]',
 '{"escalate_to": "CEO", "escalate_when": "major_strategic_decisions", "decision_authority": "departmental", "override_capability": false}',
 '{"contract_approval": 1000000, "budget_authority": 5000000, "policy_changes": "departmental", "hiring_authority": "senior_management"}'),

(2, 'Senior Manager', 'senior-manager', false, false,
 'Senior Manager with program oversight authority and operational decision-making within defined programs',
 '["program_management", "team_leadership", "operational_planning", "performance_management", "vendor_relations"]',
 '{"escalate_to": "Director", "escalate_when": "major_program_changes", "decision_authority": "program_level", "override_capability": false}',
 '{"contract_approval": 500000, "budget_authority": 2000000, "policy_changes": "program_specific", "hiring_authority": "management_roles"}'),

(3, 'Manager', 'manager', false, false,
 'Manager with team leadership and operational authority for day-to-day business decisions',
 '["team_management", "project_oversight", "daily_operations", "process_improvement", "customer_relations"]',
 '{"escalate_to": "Senior Manager", "escalate_when": "budget_overruns", "decision_authority": "operational", "override_capability": false}',
 '{"contract_approval": 100000, "budget_authority": 500000, "policy_changes": "process_level", "hiring_authority": "staff_positions"}'),

(4, 'Technical Lead', 'technical-lead', false, true,
 'Technical Lead with subject matter expertise and technical authority within specialized areas',
 '["technical_expertise", "solution_design", "technical_specifications", "vendor_evaluation", "technical_mentoring"]',
 '{"escalate_to": "Manager", "escalate_when": "technical_decisions_with_business_impact", "decision_authority": "technical", "override_capability": false}',
 '{"contract_approval": 25000, "budget_authority": 100000, "policy_changes": "technical_procedures", "hiring_authority": "technical_staff"}');