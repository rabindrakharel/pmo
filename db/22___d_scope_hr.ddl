-- ============================================================================
-- HR SCOPE DIMENSION
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Human resources hierarchy dimension representing organizational positions
--   from CEO/President (level 0) through Associate Director (level 7).
--   Provides foundation for reporting relationships, authority delegation,
--   compensation planning, and career progression management.
--
-- Scope Levels:
--   Level 0: CEO/President - Chief Executive Officer or President
--   Level 1: C-Level - Chief Officers (CTO, CFO, COO, etc.)
--   Level 2: SVP/EVP - Senior/Executive Vice President
--   Level 3: VP - Vice President
--   Level 4: AVP - Assistant Vice President
--   Level 5: Senior Director - Senior Director Level
--   Level 6: Director - Director Level
--   Level 7: Associate Director - Associate Director Level
--
-- Integration:
--   - References meta_hr_level table for level definitions
--   - Supports organizational reporting chains and authority delegation
--   - Enables career progression planning and succession management
--   - Facilitates compensation planning and performance management

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.d_scope_hr (
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

  -- HR hierarchy fields
  position_code text,
  level_id int NOT NULL REFERENCES app.meta_hr_level(level_id),
  level_name text NOT NULL,
  parent_id uuid REFERENCES app.d_scope_hr(id) ON DELETE SET NULL,
  
  -- Position attributes
  is_leaf_level boolean NOT NULL DEFAULT false,
  job_family text,
  job_level text,
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
  bilingual_req boolean DEFAULT false,
  remote_eligible boolean DEFAULT false
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Canadian Enterprise HR Hierarchy - Huron Home Services

-- Executive Levels (C-Suite)
-- Level 0: CEO/President
INSERT INTO app.d_scope_hr (name, "descr", position_code, level_id, level_name, parent_id, is_leaf_level, job_family, job_level, is_management, is_executive, salary_band_min, salary_band_max, bonus_target_pct, equity_eligible, approval_limit, direct_reports_max, bilingual_req, remote_eligible, tags, attr) VALUES
('Chief Executive Officer', 'Chief Executive Officer responsible for overall strategic direction, board reporting, and enterprise leadership', 'CEO-001', 0, 'CEO/President', NULL, false, 'Executive', 'C-Suite', true, true, 300000.00, 600000.00, 50.00, true, NULL, 8, false, true, '["executive", "ceo", "board-reporting", "strategic"]', '{"board_reporting": true, "public_facing": true, "strategic_planning": true, "investor_relations": true, "ultimate_authority": true, "succession_planning": true}');

-- Level 1: C-Level Officers
WITH ceo AS (SELECT id FROM app.d_scope_hr WHERE position_code = 'CEO-001')
INSERT INTO app.d_scope_hr (name, "descr", position_code, level_id, level_name, parent_id, is_leaf_level, job_family, job_level, is_management, is_executive, salary_band_min, salary_band_max, bonus_target_pct, equity_eligible, approval_limit, direct_reports_max, bilingual_req, remote_eligible, tags, attr)
SELECT 
  'Chief Financial Officer',
  'Chief Financial Officer responsible for financial strategy, reporting, compliance, and investor relations',
  'CFO-001',
  1,
  'C-Level',
  ceo.id,
  false,
  'Executive',
  'C-Suite',
  true,
  true,
  250000.00,
  450000.00,
  40.00,
  true,
  5000000.00,
  6,
  false,
  true,
  '["executive", "cfo", "financial", "compliance"]'::jsonb,
  '{"financial_reporting": true, "regulatory_compliance": true, "investor_relations": true, "risk_management": true, "treasury_management": true}'::jsonb
FROM ceo

UNION ALL

SELECT 
  'Chief Technology Officer',
  'Chief Technology Officer responsible for technology strategy, digital transformation, and innovation leadership',
  'CTO-001',
  1,
  'C-Level',
  ceo.id,
  false,
  'Executive',
  'C-Suite',
  true,
  true,
  250000.00,
  450000.00,
  40.00,
  true,
  3000000.00,
  5,
  false,
  true,
  '["executive", "cto", "technology", "innovation"]'::jsonb,
  '{"technology_strategy": true, "digital_transformation": true, "innovation_leadership": true, "architecture_oversight": true, "vendor_management": true}'::jsonb
FROM ceo

UNION ALL

SELECT 
  'Chief Operating Officer',
  'Chief Operating Officer responsible for day-to-day operations, service delivery, and operational excellence',
  'COO-001',
  1,
  'C-Level',
  ceo.id,
  false,
  'Executive',
  'C-Suite',
  true,
  true,
  250000.00,
  450000.00,
  40.00,
  true,
  10000000.00,
  8,
  false,
  true,
  '["executive", "coo", "operations", "service-delivery"]'::jsonb,
  '{"operational_excellence": true, "service_delivery": true, "quality_management": true, "process_optimization": true, "customer_satisfaction": true}'::jsonb
FROM ceo;

-- Level 2: SVP/EVP Positions
WITH coo AS (SELECT id FROM app.d_scope_hr WHERE position_code = 'COO-001')
INSERT INTO app.d_scope_hr (name, "descr", position_code, level_id, level_name, parent_id, is_leaf_level, job_family, job_level, is_management, is_executive, salary_band_min, salary_band_max, bonus_target_pct, equity_eligible, approval_limit, direct_reports_max, bilingual_req, remote_eligible, tags, attr)
SELECT 
  'Senior Vice President - Business Operations',
  'Senior Vice President overseeing all business operations including landscaping, snow removal, HVAC, and plumbing services',
  'SVP-BOP-001',
  2,
  'SVP/EVP',
  coo.id,
  false,
  'Executive',
  'Senior-VP',
  true,
  true,
  200000.00,
  350000.00,
  35.00,
  true,
  7500000.00,
  6,
  false,
  false,
  '["executive", "svp", "business-operations", "multi-service"]'::jsonb,
  '{"multi_service_oversight": true, "revenue_responsibility": true, "customer_portfolio": true, "seasonal_management": true, "operational_coordination": true}'::jsonb
FROM coo;

-- Level 3: Vice President Positions
WITH svp_bop AS (SELECT id FROM app.d_scope_hr WHERE position_code = 'SVP-BOP-001')
INSERT INTO app.d_scope_hr (name, "descr", position_code, level_id, level_name, parent_id, is_leaf_level, job_family, job_level, is_management, is_executive, salary_band_min, salary_band_max, bonus_target_pct, equity_eligible, approval_limit, direct_reports_max, bilingual_req, remote_eligible, tags, attr)
SELECT 
  'Vice President - Landscaping Services',
  'Vice President responsible for all landscaping operations including residential and commercial services, seasonal planning, and growth strategy',
  'VP-LAND-001',
  3,
  'VP',
  svp_bop.id,
  false,
  'Operations',
  'VP',
  true,
  true,
  150000.00,
  280000.00,
  30.00,
  true,
  5000000.00,
  8,
  false,
  false,
  '["vp", "landscaping", "seasonal", "growth"]'::jsonb,
  '{"seasonal_operations": true, "revenue_target": 12000000, "team_leadership": true, "strategic_growth": true, "client_relationship": true}'::jsonb
FROM svp_bop

UNION ALL

SELECT 
  'Vice President - Technical Services',
  'Vice President overseeing HVAC, plumbing, and technical service delivery with focus on quality, safety, and customer satisfaction',
  'VP-TECH-001',
  3,
  'VP',
  svp_bop.id,
  false,
  'Operations',
  'VP',
  true,
  true,
  150000.00,
  280000.00,
  30.00,
  true,
  3000000.00,
  6,
  false,
  false,
  '["vp", "technical", "hvac", "plumbing"]'::jsonb,
  '{"technical_expertise": true, "safety_oversight": true, "quality_management": true, "emergency_services": true, "certification_management": true}'::jsonb
FROM svp_bop;

-- Level 4: Assistant Vice President Positions
WITH vp_land AS (SELECT id FROM app.d_scope_hr WHERE position_code = 'VP-LAND-001')
INSERT INTO app.d_scope_hr (name, "descr", position_code, level_id, level_name, parent_id, is_leaf_level, job_family, job_level, is_management, is_executive, salary_band_min, salary_band_max, bonus_target_pct, equity_eligible, approval_limit, direct_reports_max, bilingual_req, remote_eligible, tags, attr)
SELECT 
  'Assistant Vice President - Residential Landscaping',
  'Assistant Vice President focused on residential landscaping market development, client relationships, and service delivery excellence',
  'AVP-RES-001',
  4,
  'AVP',
  vp_land.id,
  false,
  'Operations',
  'AVP',
  true,
  false,
  130000.00,
  220000.00,
  25.00,
  true,
  2000000.00,
  6,
  false,
  false,
  '["avp", "residential", "client-focused", "market-development"]'::jsonb,
  '{"residential_focus": true, "client_development": true, "market_penetration": true, "service_excellence": true, "team_development": true}'::jsonb
FROM vp_land

UNION ALL

SELECT 
  'Assistant Vice President - Commercial Landscaping',
  'Assistant Vice President managing commercial and municipal landscaping contracts, large-scale projects, and institutional relationships',
  'AVP-COM-001',
  4,
  'AVP',
  vp_land.id,
  false,
  'Operations',
  'AVP',
  true,
  false,
  130000.00,
  220000.00,
  25.00,
  true,
  3000000.00,
  5,
  false,
  false,
  '["avp", "commercial", "municipal", "large-scale"]'::jsonb,
  '{"commercial_expertise": true, "municipal_contracts": true, "large_scale_projects": true, "institutional_clients": true, "contract_management": true}'::jsonb
FROM vp_land;

-- Level 5: Senior Director Positions
WITH avp_res AS (SELECT id FROM app.d_scope_hr WHERE position_code = 'AVP-RES-001')
INSERT INTO app.d_scope_hr (name, "descr", position_code, level_id, level_name, parent_id, is_leaf_level, job_family, job_level, is_management, is_executive, salary_band_min, salary_band_max, bonus_target_pct, equity_eligible, approval_limit, direct_reports_max, bilingual_req, remote_eligible, tags, attr)
SELECT 
  'Senior Director - Design & Planning',
  'Senior Director responsible for landscape design services, project planning, client consultation, and creative direction',
  'SD-DESIGN-001',
  5,
  'Senior Director',
  avp_res.id,
  false,
  'Operations',
  'Senior-Director',
  true,
  false,
  120000.00,
  190000.00,
  20.00,
  false,
  1000000.00,
  12,
  false,
  true,
  '["senior-director", "design", "planning", "creative"]'::jsonb,
  '{"design_leadership": true, "creative_direction": true, "client_consultation": true, "project_planning": true, "design_standards": true}'::jsonb
FROM avp_res;

-- Level 6: Director Positions
WITH sd_design AS (SELECT id FROM app.d_scope_hr WHERE position_code = 'SD-DESIGN-001')
INSERT INTO app.d_scope_hr (name, "descr", position_code, level_id, level_name, parent_id, is_leaf_level, job_family, job_level, is_management, is_executive, salary_band_min, salary_band_max, bonus_target_pct, equity_eligible, approval_limit, direct_reports_max, bilingual_req, remote_eligible, tags, attr)
SELECT 
  'Director - Residential Design',
  'Director managing residential landscape design team, client relationships, and project quality for residential market segment',
  'DIR-RES-DES-001',
  6,
  'Director',
  sd_design.id,
  false,
  'Operations',
  'Director',
  true,
  false,
  100000.00,
  160000.00,
  18.00,
  false,
  500000.00,
  10,
  false,
  true,
  '["director", "residential", "design", "client-focused"]'::jsonb,
  '{"residential_expertise": true, "design_management": true, "client_relationships": true, "quality_oversight": true, "team_leadership": true}'::jsonb
FROM sd_design

UNION ALL

SELECT 
  'Director - Project Implementation',
  'Director overseeing landscape installation teams, project execution, quality control, and operational efficiency',
  'DIR-IMPL-001',
  6,
  'Director',
  sd_design.id,
  false,
  'Operations',
  'Director',
  true,
  false,
  100000.00,
  160000.00,
  18.00,
  false,
  750000.00,
  12,
  false,
  false,
  '["director", "implementation", "execution", "quality"]'::jsonb,
  '{"project_execution": true, "quality_control": true, "operational_efficiency": true, "team_coordination": true, "safety_management": true}'::jsonb
FROM sd_design;

-- Level 7: Associate Director Positions (Leaf Level)
WITH dir_impl AS (SELECT id FROM app.d_scope_hr WHERE position_code = 'DIR-IMPL-001')
INSERT INTO app.d_scope_hr (name, "descr", position_code, level_id, level_name, parent_id, is_leaf_level, job_family, job_level, is_management, is_executive, salary_band_min, salary_band_max, bonus_target_pct, equity_eligible, approval_limit, direct_reports_max, bilingual_req, remote_eligible, tags, attr)
SELECT 
  'Associate Director - Installation Operations',
  'Associate Director responsible for day-to-day installation operations, crew management, equipment coordination, and project delivery',
  'AD-INSTALL-001',
  7,
  'Associate Director',
  dir_impl.id,
  true,
  'Operations',
  'Associate-Director',
  true,
  false,
  90000.00,
  140000.00,
  15.00,
  false,
  300000.00,
  8,
  false,
  false,
  '["associate-director", "installation", "operations", "delivery"]'::jsonb,
  '{"operational_focus": true, "crew_management": true, "equipment_coordination": true, "project_delivery": true, "hands_on_leadership": true}'::jsonb
FROM dir_impl

UNION ALL

SELECT 
  'Associate Director - Quality Assurance',
  'Associate Director focused on quality management, customer satisfaction, warranty management, and continuous improvement',
  'AD-QA-001',
  7,
  'Associate Director',
  dir_impl.id,
  true,
  'Operations',
  'Associate-Director',
  true,
  false,
  90000.00,
  140000.00,
  15.00,
  false,
  250000.00,
  6,
  false,
  true,
  '["associate-director", "quality", "customer-satisfaction", "improvement"]'::jsonb,
  '{"quality_management": true, "customer_satisfaction": true, "warranty_management": true, "continuous_improvement": true, "process_optimization": true}'::jsonb
FROM dir_impl;

-- Indexes removed for simplified import