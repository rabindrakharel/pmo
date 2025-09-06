-- ============================================================================
-- BUSINESS ORGANIZATIONAL SCOPE DIMENSION
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Business organizational hierarchy dimension representing the complete biz
--   structure from Corporation (level 0) through Sub-teams (level 5).
--   Provides the foundation for organizational reporting, resource allocation,
--   and governance structures across the enterprise.
--
-- Scope Levels:
--   Level 0: Corporation - Top-level corporate entity with board governance
--   Level 1: Division - Major biz division with P&L responsibility
--   Level 2: Department - Functional department with operational focus
--
-- Integration:
--   - References entity_org_level table for level definitions
--   - Supports hierarchical organizational reporting chains
--   - Enables role-based access control and permission inheritance
--   - Facilitates organizational change management and restructuring

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.d_biz (
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

  -- Org hierarchy fields
  slug text,
  code text,
  level_id int NOT NULL REFERENCES app.meta_entity_org_level(level_id),
  level_name text NOT NULL,
  is_leaf_level boolean NOT NULL DEFAULT false,
  is_root_level boolean NOT NULL DEFAULT false,
  parent_id uuid REFERENCES app.d_biz(id) ON DELETE SET NULL,

  cost_center_code text,
  
  -- Biz attributes
  biz_unit_type text DEFAULT 'operational',
  profit_center boolean DEFAULT false
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Canadian Enterprise Organizational Structure
-- Huron Home Services - Comprehensive organizational hierarchy

-- Corporation Level (Level 0)
INSERT INTO app.d_biz (name, "descr", level_id, level_name, cost_center_code, biz_unit_type, profit_center, tags, attr) VALUES
('Huron Home Services', 'Integrated home services provider serving residential and commercial markets across Ontario and surrounding regions', 0, 'Corp-Region', 'CC-000', 'enterprise', true, '["corporation", "canadian", "home-services", "integrated"]'::jsonb, '{"incorporation_year": 2020, "headquarters": "Mississauga, ON", "stock_symbol": null, "public_company": false, "regulatory_compliance": ["WSIB", "ESA", "CRA"], "service_areas": ["residential", "commercial"], "geography": ["Ontario", "GTA"]}'::jsonb);

-- Division Level (Level 1)  
WITH corp AS (SELECT id FROM app.d_biz WHERE name = 'Huron Home Services')
INSERT INTO app.d_biz (name, "descr", level_id, level_name, parent_id, cost_center_code, biz_unit_type, profit_center, tags, attr) 
SELECT 
  'Biz Operations Division', 
  'Primary biz operations including all service delivery, customer relations, and revenue generation activities', 
  1, 'Division', corp.id, 'CC-100', 'operational', true, 
  '["division", "operations", "revenue-generating", "customer-facing"]'::jsonb, 
  '{"established_year": 2020, "primary_revenue": true, "customer_segments": ["residential", "commercial"], "service_portfolio": ["landscaping", "snow", "hvac", "plumbing", "solar"], "market_focus": "GTA"}'::jsonb
FROM corp

UNION ALL

SELECT 
  'Corporate Services Division', 
  'Corporate support functions including HR, Finance, IT, Legal, and Strategic Planning', 
  1, 'Division', corp.id, 'CC-200', 'support', false, 
  '["division", "corporate", "support", "shared-services"]'::jsonb, 
  '{"established_year": 2020, "cost_center": true, "shared_services": true, "functions": ["hr", "finance", "it", "legal", "strategy"], "internal_focus": true}'::jsonb
FROM corp;

-- Department Level (Level 2) - Biz Operations
WITH biz_ops AS (SELECT id FROM app.d_biz WHERE name = 'Biz Operations Division')
INSERT INTO app.d_biz (name, "descr", level_id, level_name, parent_id, cost_center_code, biz_unit_type, profit_center, tags, attr) 
SELECT 
  'Landscaping Department', 
  'Comprehensive landscaping services including design, installation, maintenance, and seasonal cleanup for residential and commercial properties', 
  2, 'Department', biz_ops.id, 'CC-110', 'operational', true, 
  '["department", "landscaping", "seasonal", "design-build"]'::jsonb, 
  '{"peak_season": "spring_summer", "services": ["design", "installation", "maintenance", "cleanup"], "equipment_intensive": true, "seasonal_workforce": true, "client_types": ["residential", "commercial", "municipal"]}'::jsonb
FROM biz_ops

UNION ALL

SELECT 
  'Snow Removal Department', 
  'Professional snow removal and ice management services for commercial properties, residential complexes, and municipal contracts', 
  2, 'Department', biz_ops.id, 'CC-120', 'operational', true, 
  '["department", "snow-removal", "winter", "commercial"]'::jsonb, 
  '{"peak_season": "winter", "services": ["snow_clearing", "de_icing", "salting", "equipment_rental"], "emergency_response": true, "contract_based": true, "24_7_operations": true}'::jsonb
FROM biz_ops

UNION ALL

SELECT 
  'HVAC Services Department', 
  'Heating, ventilation, and air conditioning installation, maintenance, and emergency repair services', 
  2, 'Department', biz_ops.id, 'CC-130', 'operational', true, 
  '["department", "hvac", "technical", "emergency"]'::jsonb, 
  '{"year_round": true, "services": ["installation", "maintenance", "repair", "emergency"], "certified_technicians": true, "warranty_support": true, "energy_efficiency_focus": true}'::jsonb
FROM biz_ops

UNION ALL

SELECT 
  'Plumbing Services Department', 
  'Comprehensive plumbing services including installation, maintenance, emergency repairs, and water system management', 
  2, 'Department', biz_ops.id, 'CC-140', 'operational', true, 
  '["department", "plumbing", "technical", "emergency"]'::jsonb, 
  '{"emergency_services": true, "services": ["installation", "repair", "water_systems", "drainage"], "licensed_plumbers": true, "code_compliance": true, "warranty_coverage": true}'::jsonb
FROM biz_ops

UNION ALL

SELECT 
  'Solar Energy Department', 
  'Solar panel installation, maintenance, and energy management solutions for residential and commercial properties', 
  2, 'Department', biz_ops.id, 'CC-150', 'operational', true, 
  '["department", "solar", "renewable", "installation"]'::jsonb, 
  '{"growth_focus": true, "services": ["consultation", "installation", "maintenance", "monitoring"], "certified_installers": true, "warranty_support": true, "government_incentives": true, "sustainable_focus": true}'::jsonb
FROM biz_ops;

-- Department Level (Level 2) - Corporate Services
WITH corp_services AS (SELECT id FROM app.d_biz WHERE name = 'Corporate Services Division')
INSERT INTO app.d_biz (name, "descr", level_id, level_name, parent_id, cost_center_code, biz_unit_type, profit_center, tags, attr) 
SELECT 
  'Human Resources Department', 
  'Employee lifecycle management, talent acquisition, performance management, and organizational development', 
  2, 'Department', corp_services.id, 'CC-210', 'support', false, 
  '["department", "hr", "talent", "compliance"]'::jsonb, 
  '{"functions": ["recruitment", "performance", "training", "compliance"], "employee_count_supported": 500, "payroll_management": true, "benefits_administration": true}'::jsonb
FROM corp_services

UNION ALL

SELECT 
  'Finance & Accounting Department', 
  'Financial planning, accounting, reporting, and business intelligence for enterprise operations', 
  2, 'Department', corp_services.id, 'CC-220', 'support', false, 
  '["department", "finance", "accounting", "reporting"]'::jsonb, 
  '{"functions": ["accounting", "budgeting", "reporting", "analysis"], "erp_systems": true, "regulatory_reporting": true, "investor_relations": false}'::jsonb
FROM corp_services

UNION ALL

SELECT 
  'Information Technology Department', 
  'Enterprise technology infrastructure, applications, cybersecurity, and digital transformation initiatives', 
  2, 'Department', corp_services.id, 'CC-230', 'support', false, 
  '["department", "it", "technology", "digital"]'::jsonb, 
  '{"functions": ["infrastructure", "applications", "security", "support"], "cloud_first": true, "cybersecurity_focus": true, "digital_transformation": true}'::jsonb
FROM corp_services

UNION ALL

SELECT 
  'Legal & Compliance Department', 
  'Legal counsel, regulatory compliance, risk management, and contract administration', 
  2, 'Department', corp_services.id, 'CC-240', 'support', false, 
  '["department", "legal", "compliance", "risk"]'::jsonb, 
  '{"functions": ["legal_counsel", "compliance", "contracts", "risk"], "regulatory_expertise": true, "insurance_management": true, "litigation_support": true}'::jsonb
FROM corp_services;

-- Indexes removed for simplified import