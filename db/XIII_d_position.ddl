-- ============================================================================
-- XXIV. POSITION ENTITIES
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Position entities representing organizational hierarchy positions and
--   authority levels from CEO/President through Associate Director.
--   Provides foundation for reporting relationships, authority delegation,
--   compensation planning, and career progression management.
--
-- Entity Type: position
-- Entity Classification: Hierarchical Entity (supports organizational structure)
--
-- Parent Entities:
--   - biz (business units define position structures)
--   - org (geographic position assignments and responsibilities)
--
-- Action Entities:
--   - employee (employees are assigned to positions)
--   - role (positions can encompass multiple roles)
--   - project (positions can have project responsibilities)
--   - task (positions can be assigned specific tasks)
--   - form (position-based form approvals and workflows)
--
-- Position Hierarchy Levels:
--   - Level 0: CEO/President - Chief Executive Officer or President
--   - Level 1: C-Level - Chief Officers (CTO, CFO, COO, etc.)
--   - Level 2: SVP/EVP - Senior/Executive Vice President
--   - Level 3: VP - Vice President
--   - Level 4: AVP - Assistant Vice President
--   - Level 5: Senior Director - Senior Director Level
--   - Level 6: Director - Director Level
--   - Level 7: Associate Director - Associate Director Level (leaf level)
--
-- New Design Integration:
--   - Maps to entity_id_hierarchy_mapping for parent-child relationships
--   - No direct foreign keys to other entities (follows new standard)
--   - Supports RBAC via entity_id_rbac_map table
--   - Uses common field structure across all entities
--   - Includes metadata jsonb field for extensibility
--   - References meta_position_level for hierarchy validation
--
-- Legacy Design Elements Retained:
--   - Hierarchical structure with level_id references
--   - Management and executive classifications
--   - Compensation bands and authority limits
--   - Organizational capacity planning
--   - Remote work eligibility
--
-- UI Navigation Model:
--   - Appears in sidebar menu as "Position"
--   - Main page shows FilteredDataTable with searchable/filterable positions
--   - Row click navigates to Position Detail Page
--   - Detail page shows Overview tab + child entity tabs (employees, roles, etc.)
--   - Inline editing available on detail page with RBAC permission checks
--   - Hierarchical tree view available for organizational chart display

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.d_position (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Standard fields (common across all entities) - ALWAYS FIRST
  slug varchar(255),
  code varchar(100),
  name text NOT NULL,
  descr text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active_flag boolean NOT NULL DEFAULT true,
  created_ts timestamptz NOT NULL DEFAULT now(),
  updated_ts timestamptz NOT NULL DEFAULT now(),
  version int DEFAULT 1,

  -- Entity metadata (new standard)
  metadata jsonb DEFAULT '{}'::jsonb,

  -- Hierarchical structure (references meta_position_level)
  level_id int NOT NULL,
  level_name text NOT NULL,
  is_leaf_level boolean NOT NULL DEFAULT false,
  is_root_level boolean NOT NULL DEFAULT false,
  parent_id uuid, -- Self-referencing for position hierarchy (not via entity_id_hierarchy_mapping)

  -- Position attributes
  is_management boolean NOT NULL DEFAULT false,
  is_executive boolean NOT NULL DEFAULT false,

  -- Compensation and authority
  salary_band_min numeric(10,2),
  salary_band_max numeric(10,2),
  bonus_target_pct numeric(5,2),
  equity_eligible boolean DEFAULT false,
  approval_limit numeric(12,2),

  -- Organizational capacity
  direct_reports_max int,
  remote_eligible boolean DEFAULT false
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Huron Home Services Organizational Position Hierarchy
-- Comprehensive position structure supporting career progression and authority delegation

-- Level 0: CEO/President (Root Level)
INSERT INTO app.d_position (
  slug, code, name, "descr", level_id, level_name, parent_id, is_leaf_level, is_root_level,
  is_management, is_executive, salary_band_min, salary_band_max, bonus_target_pct,
  equity_eligible, approval_limit, direct_reports_max, remote_eligible, tags, metadata
) VALUES
('chief-executive-officer-pos', 'CEO-POS', 'Chief Executive Officer',
 'Chief Executive Officer responsible for overall strategic direction, board reporting, and enterprise leadership',
 0, 'CEO/President', NULL, false, true, true, true,
 300000.00, 600000.00, 50.00, true, NULL, 8, true,
 '["executive", "ceo", "board-reporting", "strategic"]',
 '{"board_reporting": true, "public_facing": true, "strategic_planning": true, "investor_relations": true, "ultimate_authority": true, "succession_planning": true}');

-- Level 1: C-Level Executives
INSERT INTO app.d_position (
  slug, code, name, "descr", level_id, level_name, parent_id, is_leaf_level, is_root_level,
  is_management, is_executive, salary_band_min, salary_band_max, bonus_target_pct,
  equity_eligible, approval_limit, direct_reports_max, remote_eligible, tags, metadata
) VALUES
('chief-financial-officer-pos', 'CFO-POS', 'Chief Financial Officer',
 'Senior executive responsible for financial strategy, reporting, compliance, and treasury management',
 1, 'C-Level', (SELECT id FROM app.d_position WHERE code = 'CEO-POS'), false, false, true, true,
 250000.00, 450000.00, 40.00, true, 5000000.00, 6, true,
 '["executive", "c-level", "financial", "compliance"]',
 '{"financial_oversight": true, "regulatory_compliance": true, "investor_relations": true, "risk_management": true}'),

('chief-technology-officer-pos', 'CTO-POS', 'Chief Technology Officer',
 'Senior executive responsible for technology strategy, digital transformation, and innovation leadership',
 1, 'C-Level', (SELECT id FROM app.d_position WHERE code = 'CEO-POS'), false, false, true, true,
 250000.00, 450000.00, 40.00, true, 3000000.00, 5, true,
 '["executive", "c-level", "technology", "innovation"]',
 '{"technology_strategy": true, "digital_transformation": true, "innovation_leadership": true, "vendor_management": true}'),

('chief-operating-officer-pos', 'COO-POS', 'Chief Operating Officer',
 'Senior executive responsible for daily operations, service delivery, and operational excellence',
 1, 'C-Level', (SELECT id FROM app.d_position WHERE code = 'CEO-POS'), false, false, true, true,
 250000.00, 450000.00, 40.00, true, 8000000.00, 8, true,
 '["executive", "c-level", "operations", "service-delivery"]',
 '{"operational_excellence": true, "service_quality": true, "safety_oversight": true, "performance_management": true}');

-- Level 2: SVP/EVP Positions
INSERT INTO app.d_position (
  slug, code, name, "descr", level_id, level_name, parent_id, is_leaf_level, is_root_level,
  is_management, is_executive, salary_band_min, salary_band_max, bonus_target_pct,
  equity_eligible, approval_limit, direct_reports_max, remote_eligible, tags, metadata
) VALUES
('senior-vice-president-ops', 'SVP-OPS', 'Senior Vice President - Operations',
 'Senior executive responsible for multiple operational divisions and strategic business unit management',
 2, 'SVP/EVP', (SELECT id FROM app.d_position WHERE code = 'COO-POS'), false, false, true, true,
 200000.00, 350000.00, 35.00, true, 5000000.00, 10, true,
 '["senior-executive", "svp", "operations", "multi-division"]',
 '{"multi_division_oversight": true, "p_and_l_responsibility": true, "strategic_planning": true, "operational_leadership": true}');

-- Level 3: VP Positions
INSERT INTO app.d_position (
  slug, code, name, "descr", level_id, level_name, parent_id, is_leaf_level, is_root_level,
  is_management, is_executive, salary_band_min, salary_band_max, bonus_target_pct,
  equity_eligible, approval_limit, direct_reports_max, remote_eligible, tags, metadata
) VALUES
('vice-president-hr-pos', 'VP-HR-POS', 'Vice President - Human Resources',
 'Executive responsible for talent management, organizational development, and employee relations',
 3, 'VP', (SELECT id FROM app.d_position WHERE code = 'CEO-POS'), false, false, true, true,
 180000.00, 320000.00, 30.00, true, 2000000.00, 8, true,
 '["vp", "human-resources", "talent-management", "organizational-development"]',
 '{"talent_strategy": true, "organizational_development": true, "employee_relations": true, "compensation_planning": true}'),

('vice-president-technology', 'VP-TECH', 'Vice President - Technology',
 'Executive responsible for technology operations, systems management, and digital initiatives',
 3, 'VP', (SELECT id FROM app.d_position WHERE code = 'CTO-POS'), false, false, true, true,
 180000.00, 320000.00, 30.00, true, 1500000.00, 6, true,
 '["vp", "technology", "systems", "digital-initiatives"]',
 '{"technology_operations": true, "systems_management": true, "digital_projects": true, "vendor_relations": true}');

-- Level 4: AVP Positions
INSERT INTO app.d_position (
  slug, code, name, "descr", level_id, level_name, parent_id, is_leaf_level, is_root_level,
  is_management, is_executive, salary_band_min, salary_band_max, bonus_target_pct,
  equity_eligible, approval_limit, direct_reports_max, remote_eligible, tags, metadata
) VALUES
('assistant-vp-operations', 'AVP-OPS', 'Assistant Vice President - Operations',
 'Senior management role responsible for operational coordination and performance management',
 4, 'AVP', (SELECT id FROM app.d_position WHERE code = 'SVP-OPS'), false, false, true, false,
 150000.00, 280000.00, 25.00, false, 1000000.00, 8, true,
 '["avp", "operations", "coordination", "performance-management"]',
 '{"operational_coordination": true, "performance_oversight": true, "process_improvement": true, "team_development": true}');

-- Level 5: Senior Director Positions
INSERT INTO app.d_position (
  slug, code, name, "descr", level_id, level_name, parent_id, is_leaf_level, is_root_level,
  is_management, is_executive, salary_band_min, salary_band_max, bonus_target_pct,
  equity_eligible, approval_limit, direct_reports_max, remote_eligible, tags, metadata
) VALUES
('senior-director-finance', 'SR-DIR-FIN', 'Senior Director - Finance',
 'Senior management role responsible for financial planning, analysis, and strategic financial initiatives',
 5, 'Senior Director', (SELECT id FROM app.d_position WHERE code = 'CFO-POS'), false, false, true, false,
 130000.00, 250000.00, 20.00, false, 750000.00, 6, true,
 '["senior-director", "finance", "planning", "analysis"]',
 '{"financial_planning": true, "strategic_analysis": true, "budget_oversight": true, "financial_reporting": true}'),

('senior-director-operations', 'SR-DIR-OPS', 'Senior Director - Operations',
 'Senior management role responsible for operational excellence and service delivery management',
 5, 'Senior Director', (SELECT id FROM app.d_position WHERE code = 'AVP-OPS'), false, false, true, false,
 130000.00, 250000.00, 20.00, false, 500000.00, 8, false,
 '["senior-director", "operations", "service-delivery", "excellence"]',
 '{"service_excellence": true, "operational_oversight": true, "quality_management": true, "customer_satisfaction": true}');

-- Level 6: Director Positions
INSERT INTO app.d_position (
  slug, code, name, "descr", level_id, level_name, parent_id, is_leaf_level, is_root_level,
  is_management, is_executive, salary_band_min, salary_band_max, bonus_target_pct,
  equity_eligible, approval_limit, direct_reports_max, remote_eligible, tags, metadata
) VALUES
('director-finance-pos', 'DIR-FIN-POS', 'Director - Finance',
 'Management role responsible for financial operations, reporting, and departmental management',
 6, 'Director', (SELECT id FROM app.d_position WHERE code = 'SR-DIR-FIN'), false, false, true, false,
 110000.00, 200000.00, 15.00, false, 250000.00, 5, true,
 '["director", "finance", "operations", "reporting"]',
 '{"financial_operations": true, "team_management": true, "reporting_oversight": true, "process_management": true}'),

('director-it-pos', 'DIR-IT-POS', 'Director - Information Technology',
 'Management role responsible for IT operations, system administration, and technology team leadership',
 6, 'Director', (SELECT id FROM app.d_position WHERE code = 'VP-TECH'), false, false, true, false,
 110000.00, 200000.00, 15.00, false, 200000.00, 6, true,
 '["director", "it", "systems", "technology"]',
 '{"it_operations": true, "system_administration": true, "technology_leadership": true, "infrastructure_management": true}'),

('director-landscaping', 'DIR-LAND', 'Director - Landscaping Services',
 'Management role responsible for landscaping operations, project management, and service delivery',
 6, 'Director', (SELECT id FROM app.d_position WHERE code = 'SR-DIR-OPS'), false, false, true, false,
 110000.00, 200000.00, 15.00, false, 300000.00, 8, false,
 '["director", "landscaping", "services", "operations"]',
 '{"landscaping_operations": true, "project_oversight": true, "service_quality": true, "team_leadership": true}');

-- Level 7: Associate Director Positions (Leaf Level)
INSERT INTO app.d_position (
  slug, code, name, "descr", level_id, level_name, parent_id, is_leaf_level, is_root_level,
  is_management, is_executive, salary_band_min, salary_band_max, bonus_target_pct,
  equity_eligible, approval_limit, direct_reports_max, remote_eligible, tags, metadata
) VALUES
('associate-director-finance', 'ASSOC-DIR-FIN', 'Associate Director - Finance',
 'Management role responsible for financial analysis, reporting support, and specialized financial functions',
 7, 'Associate Director', (SELECT id FROM app.d_position WHERE code = 'DIR-FIN-POS'), true, false, true, false,
 90000.00, 160000.00, 10.00, false, 100000.00, 4, true,
 '["associate-director", "finance", "analysis", "support"]',
 '{"financial_analysis": true, "reporting_support": true, "specialized_functions": true, "process_improvement": true}'),

('associate-director-it', 'ASSOC-DIR-IT', 'Associate Director - Information Technology',
 'Management role responsible for specialized IT functions, project coordination, and technical leadership',
 7, 'Associate Director', (SELECT id FROM app.d_position WHERE code = 'DIR-IT-POS'), true, false, true, false,
 90000.00, 160000.00, 10.00, false, 75000.00, 4, true,
 '["associate-director", "it", "projects", "technical"]',
 '{"technical_leadership": true, "project_coordination": true, "specialized_systems": true, "innovation_support": true}'),

('associate-director-operations', 'ASSOC-DIR-OPS', 'Associate Director - Operations',
 'Management role responsible for operational support, process improvement, and team coordination',
 7, 'Associate Director', (SELECT id FROM app.d_position WHERE code = 'DIR-LAND'), true, false, true, false,
 90000.00, 160000.00, 10.00, false, 50000.00, 6, false,
 '["associate-director", "operations", "support", "coordination"]',
 '{"operational_support": true, "process_improvement": true, "team_coordination": true, "quality_assurance": true}');