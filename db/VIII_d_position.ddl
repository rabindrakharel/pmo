-- ============================================================================
-- POSITION ENTITY (d_position) - HIERARCHICAL
-- ============================================================================
--
-- SEMANTICS:
-- • Organizational hierarchy positions from CEO through Associate Director (8 levels)
-- • Foundation for reporting, authority, compensation, career progression
-- • Self-referencing hierarchy with dl__position_level
--
-- OPERATIONS:
-- • CREATE: POST /api/v1/position, INSERT with version=1, active_flag=true
-- • UPDATE: PUT /api/v1/position/{id}, same ID, version++, updated_ts refreshes
-- • DELETE: DELETE /api/v1/position/{id}, active_flag=false, to_ts=now() (soft delete)
-- • LIST: GET /api/v1/position, filters by dl__position_level, RBAC enforced
-- • HIERARCHY: Recursive CTE on parent_id
--
-- KEY FIELDS:
-- • id: uuid PRIMARY KEY
-- • code: varchar, dl__position_level: text (CEO/President→C-Level→SVP→VP→AVP→Sr Dir→Dir→Assoc Dir)
-- • parent_id: uuid (self-ref for hierarchy)
-- • management_flag, executive_flag: boolean
-- • salary_band_min_amt, salary_band_max_amt, bonus_target_pct: numeric
-- • approval_limit_amt: numeric
--
-- RELATIONSHIPS (NO FOREIGN KEYS):
-- • Self: parent_id → d_position.id (8-level hierarchy)
-- • RBAC: entity_id_rbac_map
--
-- ============================================================================

CREATE TABLE app.d_position (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Standard fields (common across all entities) - ALWAYS FIRST
  code varchar(100),
  name text NOT NULL,
  descr text,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active_flag boolean NOT NULL DEFAULT true,
  created_ts timestamptz NOT NULL DEFAULT now(),
  updated_ts timestamptz NOT NULL DEFAULT now(),
  version integer DEFAULT 1,

  -- Entity metadata (new standard)
  metadata jsonb DEFAULT '{}'::jsonb,

  -- Hierarchical structure (datalabel for position level)
  dl__position_level text NOT NULL, -- References app.setting_datalabel (datalabel_name='position__level')
  leaf_level_flag boolean NOT NULL DEFAULT false,
  root_level_flag boolean NOT NULL DEFAULT false,
  parent_id uuid, -- Self-referencing for position hierarchy (not via entity_id_hierarchy_mapping)

  -- Position attributes (renamed to *_flag pattern)
  management_flag boolean NOT NULL DEFAULT false,
  executive_flag boolean NOT NULL DEFAULT false,

  -- Compensation and authority
  salary_band_min_amt numeric(10,2),
  salary_band_max_amt numeric(10,2),
  bonus_target_pct numeric(5,2),
  equity_eligible_flag boolean DEFAULT false,
  approval_limit_amt numeric(12,2),

  -- Organizational capacity
  direct_reports_max int,
  remote_eligible_flag boolean DEFAULT false
);

COMMENT ON TABLE app.d_position IS 'Organizational positions with 8-level hierarchy, authority limits, and compensation bands';

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Huron Home Services Organizational Position Hierarchy
-- Comprehensive position structure supporting career progression and authority delegation

-- Level 0: CEO/President (Root Level)
INSERT INTO app.d_position (code, name, "descr", dl__position_level, parent_id, leaf_level_flag, root_level_flag,
  management_flag, executive_flag, salary_band_min_amt, salary_band_max_amt, bonus_target_pct,
  equity_eligible_flag, approval_limit_amt, direct_reports_max, remote_eligible_flag, metadata
) VALUES
('CEO-POS', 'Chief Executive Officer',
 'Chief Executive Officer responsible for overall strategic direction, board reporting, and enterprise leadership',
 'CEO/President', NULL, false, true, true, true,
 300000.00, 600000.00, 50.00, true, NULL, 8, true,
 '{"board_reporting": true, "public_facing": true, "strategic_planning": true, "investor_relations": true, "ultimate_authority": true, "succession_planning": true}');

-- Level 1: C-Level Executives
INSERT INTO app.d_position (code, name, "descr", dl__position_level, parent_id, leaf_level_flag, root_level_flag,
  management_flag, executive_flag, salary_band_min_amt, salary_band_max_amt, bonus_target_pct,
  equity_eligible_flag, approval_limit_amt, direct_reports_max, remote_eligible_flag, metadata
) VALUES
('CFO-POS', 'Chief Financial Officer',
 'Senior executive responsible for financial strategy, reporting, compliance, and treasury management',
 'C-Level', (SELECT id FROM app.d_position WHERE code = 'CEO-POS'), false, false, true, true,
 250000.00, 450000.00, 40.00, true, 5000000.00, 6, true,
 '{"financial_oversight": true, "regulatory_compliance": true, "investor_relations": true, "risk_management": true}'),

('CTO-POS', 'Chief Technology Officer',
 'Senior executive responsible for technology strategy, digital transformation, and innovation leadership',
 'C-Level', (SELECT id FROM app.d_position WHERE code = 'CEO-POS'), false, false, true, true,
 250000.00, 450000.00, 40.00, true, 3000000.00, 5, true,
 '{"technology_strategy": true, "digital_transformation": true, "innovation_leadership": true, "vendor_management": true}'),

('COO-POS', 'Chief Operating Officer',
 'Senior executive responsible for daily operations, service delivery, and operational excellence',
 'C-Level', (SELECT id FROM app.d_position WHERE code = 'CEO-POS'), false, false, true, true,
 250000.00, 450000.00, 40.00, true, 8000000.00, 8, true,
 '{"operational_excellence": true, "service_quality": true, "safety_oversight": true, "performance_management": true}');

-- Level 2: SVP/EVP Positions
INSERT INTO app.d_position (code, name, "descr", dl__position_level, parent_id, leaf_level_flag, root_level_flag,
  management_flag, executive_flag, salary_band_min_amt, salary_band_max_amt, bonus_target_pct,
  equity_eligible_flag, approval_limit_amt, direct_reports_max, remote_eligible_flag, metadata
) VALUES
('SVP-OPS', 'Senior Vice President - Operations',
 'Senior executive responsible for multiple operational divisions and strategic business unit management',
 'SVP/EVP', (SELECT id FROM app.d_position WHERE code = 'COO-POS'), false, false, true, true,
 200000.00, 350000.00, 35.00, true, 5000000.00, 10, true,
 '{"multi_division_oversight": true, "p_and_l_responsibility": true, "strategic_planning": true, "operational_leadership": true}');

-- Level 3: VP Positions
INSERT INTO app.d_position (code, name, "descr", dl__position_level, parent_id, leaf_level_flag, root_level_flag,
  management_flag, executive_flag, salary_band_min_amt, salary_band_max_amt, bonus_target_pct,
  equity_eligible_flag, approval_limit_amt, direct_reports_max, remote_eligible_flag, metadata
) VALUES
('VP-HR-POS', 'Vice President - Human Resources',
 'Executive responsible for talent management, organizational development, and employee relations',
 'VP', (SELECT id FROM app.d_position WHERE code = 'CEO-POS'), false, false, true, true,
 180000.00, 320000.00, 30.00, true, 2000000.00, 8, true,
 '{"talent_strategy": true, "organizational_development": true, "employee_relations": true, "compensation_planning": true}'),

('VP-TECH', 'Vice President - Technology',
 'Executive responsible for technology operations, systems management, and digital initiatives',
 'VP', (SELECT id FROM app.d_position WHERE code = 'CTO-POS'), false, false, true, true,
 180000.00, 320000.00, 30.00, true, 1500000.00, 6, true,
 '{"technology_operations": true, "systems_management": true, "digital_projects": true, "vendor_relations": true}');

-- Level 4: AVP Positions
INSERT INTO app.d_position (code, name, "descr", dl__position_level, parent_id, leaf_level_flag, root_level_flag,
  management_flag, executive_flag, salary_band_min_amt, salary_band_max_amt, bonus_target_pct,
  equity_eligible_flag, approval_limit_amt, direct_reports_max, remote_eligible_flag, metadata
) VALUES
('AVP-OPS', 'Assistant Vice President - Operations',
 'Senior management role responsible for operational coordination and performance management',
 'AVP', (SELECT id FROM app.d_position WHERE code = 'SVP-OPS'), false, false, true, false,
 150000.00, 280000.00, 25.00, false, 1000000.00, 8, true,
 '{"operational_coordination": true, "performance_oversight": true, "process_improvement": true, "team_development": true}');

-- Level 5: Senior Director Positions
INSERT INTO app.d_position (code, name, "descr", dl__position_level, parent_id, leaf_level_flag, root_level_flag,
  management_flag, executive_flag, salary_band_min_amt, salary_band_max_amt, bonus_target_pct,
  equity_eligible_flag, approval_limit_amt, direct_reports_max, remote_eligible_flag, metadata
) VALUES
('SR-DIR-FIN', 'Senior Director - Finance',
 'Senior management role responsible for financial planning, analysis, and strategic financial initiatives',
 'Senior Director', (SELECT id FROM app.d_position WHERE code = 'CFO-POS'), false, false, true, false,
 130000.00, 250000.00, 20.00, false, 750000.00, 6, true,
 '{"financial_planning": true, "strategic_analysis": true, "budget_oversight": true, "financial_reporting": true}'),

('SR-DIR-OPS', 'Senior Director - Operations',
 'Senior management role responsible for operational excellence and service delivery management',
 'Senior Director', (SELECT id FROM app.d_position WHERE code = 'AVP-OPS'), false, false, true, false,
 130000.00, 250000.00, 20.00, false, 500000.00, 8, false,
 '{"service_excellence": true, "operational_oversight": true, "quality_management": true, "customer_satisfaction": true}');

-- Level 6: Director Positions
INSERT INTO app.d_position (code, name, "descr", dl__position_level, parent_id, leaf_level_flag, root_level_flag,
  management_flag, executive_flag, salary_band_min_amt, salary_band_max_amt, bonus_target_pct,
  equity_eligible_flag, approval_limit_amt, direct_reports_max, remote_eligible_flag, metadata
) VALUES
('DIR-FIN-POS', 'Director - Finance',
 'Management role responsible for financial operations, reporting, and departmental management',
 'Director', (SELECT id FROM app.d_position WHERE code = 'SR-DIR-FIN'), false, false, true, false,
 110000.00, 200000.00, 15.00, false, 250000.00, 5, true,
 '{"financial_operations": true, "team_management": true, "reporting_oversight": true, "process_management": true}'),

('DIR-IT-POS', 'Director - Information Technology',
 'Management role responsible for IT operations, system administration, and technology team leadership',
 'Director', (SELECT id FROM app.d_position WHERE code = 'VP-TECH'), false, false, true, false,
 110000.00, 200000.00, 15.00, false, 200000.00, 6, true,
 '{"it_operations": true, "system_administration": true, "technology_leadership": true, "infrastructure_management": true}'),

('DIR-LAND', 'Director - Landscaping Services',
 'Management role responsible for landscaping operations, project management, and service delivery',
 'Director', (SELECT id FROM app.d_position WHERE code = 'SR-DIR-OPS'), false, false, true, false,
 110000.00, 200000.00, 15.00, false, 300000.00, 8, false,
 '{"landscaping_operations": true, "project_oversight": true, "service_quality": true, "team_leadership": true}');

-- Level 7: Associate Director Positions (Leaf Level)
INSERT INTO app.d_position (code, name, "descr", dl__position_level, parent_id, leaf_level_flag, root_level_flag,
  management_flag, executive_flag, salary_band_min_amt, salary_band_max_amt, bonus_target_pct,
  equity_eligible_flag, approval_limit_amt, direct_reports_max, remote_eligible_flag, metadata
) VALUES
('ASSOC-DIR-FIN', 'Associate Director - Finance',
 'Management role responsible for financial analysis, reporting support, and specialized financial functions',
 'Associate Director', (SELECT id FROM app.d_position WHERE code = 'DIR-FIN-POS'), true, false, true, false,
 90000.00, 160000.00, 10.00, false, 100000.00, 4, true,
 '{"financial_analysis": true, "reporting_support": true, "specialized_functions": true, "process_improvement": true}'),

('ASSOC-DIR-IT', 'Associate Director - Information Technology',
 'Management role responsible for specialized IT functions, project coordination, and technical leadership',
 'Associate Director', (SELECT id FROM app.d_position WHERE code = 'DIR-IT-POS'), true, false, true, false,
 90000.00, 160000.00, 10.00, false, 75000.00, 4, true,
 '{"technical_leadership": true, "project_coordination": true, "specialized_systems": true, "innovation_support": true}'),

('ASSOC-DIR-OPS', 'Associate Director - Operations',
 'Management role responsible for operational support, process improvement, and team coordination',
 'Associate Director', (SELECT id FROM app.d_position WHERE code = 'DIR-LAND'), true, false, true, false,
 90000.00, 160000.00, 10.00, false, 50000.00, 6, false,
 '{"operational_support": true, "process_improvement": true, "team_coordination": true, "quality_assurance": true}');