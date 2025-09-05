-- ============================================================================
-- ORGANIZATIONAL SCOPE DIMENSION
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Organizational hierarchy dimension representing the complete business
--   structure from Corporation (level 0) through Sub-teams (level 5).
--   Provides the foundation for organizational reporting, resource allocation,
--   and governance structures across the enterprise.
--
-- Scope Levels:
--   Level 0: Corporation - Top-level corporate entity with board governance
--   Level 1: Division - Major business division with P&L responsibility
--   Level 2: Department - Functional department with operational focus
--   Level 3: Team - Working team unit with specific deliverables
--   Level 4: Squad - Agile squad with cross-functional capabilities
--   Level 5: Sub-team - Specialized sub-team for specific functions
--
-- Integration:
--   - References meta_org_level table for level definitions
--   - Supports hierarchical organizational reporting chains
--   - Enables role-based access control and permission inheritance
--   - Facilitates organizational change management and restructuring

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.d_scope_org (
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

  -- Organizational hierarchy fields
  org_code text,
  level_id int NOT NULL REFERENCES app.meta_org_level(level_id),
  level_name text NOT NULL,
  parent_id uuid REFERENCES app.d_scope_org(id) ON DELETE SET NULL,
  
  -- Organizational attributes
  is_leaf_level boolean NOT NULL DEFAULT false,
  budget_allocated numeric(15,2),
  cost_center_code text,
  
  -- Geographic and operational context
  primary_location_id uuid,
  time_zone text DEFAULT 'America/Toronto',
  
  -- Business attributes
  business_unit_type text DEFAULT 'operational',
  profit_center boolean DEFAULT false,
  external_facing boolean DEFAULT false
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Canadian Enterprise Organizational Structure
-- Huron Home Services - Comprehensive organizational hierarchy

-- Corporation Level (Level 0)
INSERT INTO app.d_scope_org (name, "descr", org_code, level_id, level_name, parent_id, is_leaf_level, budget_allocated, cost_center_code, business_unit_type, profit_center, external_facing, tags, attr) VALUES
('Huron Home Services', 'Integrated home services provider serving residential and commercial markets across Ontario and surrounding regions', 'HHS', 0, 'Corporation', NULL, false, 50000000.00, 'CC-000', 'enterprise', true, true, '["corporation", "canadian", "home-services", "integrated"]', '{"incorporation_year": 2020, "headquarters": "Mississauga, ON", "stock_symbol": null, "public_company": false, "regulatory_compliance": ["WSIB", "ESA", "CRA"], "service_areas": ["residential", "commercial"], "geography": ["Ontario", "GTA"]}');

-- Division Level (Level 1)
WITH corp AS (SELECT id FROM app.d_scope_org WHERE name = 'Huron Home Services')
INSERT INTO app.d_scope_org (name, "descr", org_code, level_id, level_name, parent_id, is_leaf_level, budget_allocated, cost_center_code, business_unit_type, profit_center, external_facing, tags, attr)
SELECT 
  'Business Operations Division',
  'Primary business operations including all service delivery, customer relations, and revenue generation activities',
  'HHS-BOD',
  1,
  'Division',
  corp.id,
  false,
  35000000.00,
  'CC-100',
  'operational',
  true,
  true,
  '["division", "operations", "revenue-generating", "customer-facing"]'::jsonb,
  '{"established_year": 2020, "primary_revenue": true, "customer_segments": ["residential", "commercial"], "service_portfolio": ["landscaping", "snow", "hvac", "plumbing", "solar"], "market_focus": "GTA"}'::jsonb
FROM corp

UNION ALL

SELECT 
  'Corporate Services Division',
  'Corporate support functions including HR, Finance, IT, Legal, and Strategic Planning',
  'HHS-CSD',
  1,
  'Division',
  corp.id,
  false,
  15000000.00,
  'CC-200',
  'support',
  false,
  false,
  '["division", "corporate", "support", "shared-services"]'::jsonb,
  '{"established_year": 2020, "cost_center": true, "shared_services": true, "functions": ["hr", "finance", "it", "legal", "strategy"], "internal_focus": true}'::jsonb
FROM corp;

-- Department Level (Level 2) - Business Operations
WITH bod AS (SELECT id FROM app.d_scope_org WHERE name = 'Business Operations Division')
INSERT INTO app.d_scope_org (name, "descr", org_code, level_id, level_name, parent_id, is_leaf_level, budget_allocated, cost_center_code, business_unit_type, profit_center, external_facing, tags, attr)
SELECT 
  'Landscaping Department',
  'Comprehensive landscaping services including design, installation, maintenance, and seasonal cleanup for residential and commercial properties',
  'HHS-LAND',
  2,
  'Department',
  bod.id,
  false,
  12000000.00,
  'CC-110',
  'operational',
  true,
  true,
  '["department", "landscaping", "seasonal", "design-build"]'::jsonb,
  '{"peak_season": "spring_summer", "services": ["design", "installation", "maintenance", "cleanup"], "equipment_intensive": true, "seasonal_workforce": true, "client_types": ["residential", "commercial", "municipal"]}'::jsonb
FROM bod

UNION ALL

SELECT 
  'Snow Removal Department',
  'Professional snow removal and ice management services for commercial properties, residential complexes, and municipal contracts',
  'HHS-SNOW',
  2,
  'Department',
  bod.id,
  false,
  8000000.00,
  'CC-120',
  'operational',
  true,
  true,
  '["department", "snow-removal", "winter", "commercial"]'::jsonb,
  '{"peak_season": "winter", "services": ["snow_clearing", "de_icing", "salting", "equipment_rental"], "emergency_response": true, "contract_based": true, "24_7_operations": true}'::jsonb
FROM bod

UNION ALL

SELECT 
  'HVAC Services Department',
  'Heating, ventilation, and air conditioning installation, maintenance, and emergency repair services',
  'HHS-HVAC',
  2,
  'Department',
  bod.id,
  false,
  10000000.00,
  'CC-130',
  'operational',
  true,
  true,
  '["department", "hvac", "technical", "emergency"]'::jsonb,
  '{"year_round": true, "services": ["installation", "maintenance", "repair", "emergency"], "certified_technicians": true, "warranty_support": true, "energy_efficiency_focus": true}'::jsonb
FROM bod

UNION ALL

SELECT 
  'Plumbing Services Department',
  'Comprehensive plumbing services including installation, maintenance, emergency repairs, and water system management',
  'HHS-PLUMB',
  2,
  'Department',
  bod.id,
  false,
  5000000.00,
  'CC-140',
  'operational',
  true,
  true,
  '["department", "plumbing", "technical", "emergency"]'::jsonb,
  '{"emergency_services": true, "services": ["installation", "repair", "water_systems", "drainage"], "licensed_plumbers": true, "code_compliance": true, "warranty_coverage": true}'::jsonb
FROM bod;

-- Team Level (Level 3) - Landscaping Teams
WITH land_dept AS (SELECT id FROM app.d_scope_org WHERE name = 'Landscaping Department')
INSERT INTO app.d_scope_org (name, "descr", org_code, level_id, level_name, parent_id, is_leaf_level, budget_allocated, cost_center_code, business_unit_type, profit_center, external_facing, tags, attr)
SELECT 
  'Residential Landscaping Team',
  'Specialized team focused on residential landscaping projects including front/back yard design, garden installation, and homeowner maintenance services',
  'HHS-LAND-RES',
  3,
  'Team',
  land_dept.id,
  false,
  4000000.00,
  'CC-111',
  'operational',
  true,
  true,
  '["team", "residential", "landscaping", "design"]'::jsonb,
  '{"client_focus": "residential", "avg_project_size": "small_medium", "seasonal_patterns": true, "design_capability": true, "maintenance_contracts": true}'::jsonb
FROM land_dept

UNION ALL

SELECT 
  'Commercial Landscaping Team',
  'Commercial and municipal landscaping team handling large-scale projects, property management contracts, and institutional clients',
  'HHS-LAND-COM',
  3,
  'Team',
  land_dept.id,
  false,
  8000000.00,
  'CC-112',
  'operational',
  true,
  true,
  '["team", "commercial", "landscaping", "large-scale"]'::jsonb,
  '{"client_focus": "commercial", "avg_project_size": "large", "contract_based": true, "equipment_heavy": true, "municipal_contracts": true}'::jsonb
FROM land_dept;

-- Squad Level (Level 4) - Agile Squads within Teams
WITH res_team AS (SELECT id FROM app.d_scope_org WHERE name = 'Residential Landscaping Team')
INSERT INTO app.d_scope_org (name, "descr", org_code, level_id, level_name, parent_id, is_leaf_level, budget_allocated, cost_center_code, business_unit_type, profit_center, external_facing, tags, attr)
SELECT 
  'Garden Design Squad',
  'Cross-functional squad specializing in residential garden design, plant selection, and aesthetic landscaping solutions',
  'HHS-LAND-RES-GD',
  4,
  'Squad',
  res_team.id,
  false,
  1500000.00,
  'CC-111A',
  'operational',
  true,
  true,
  '["squad", "design", "gardens", "aesthetic"]'::jsonb,
  '{"specialization": "design", "cross_functional": true, "creative_focus": true, "plant_expertise": true, "client_consultation": true}'::jsonb
FROM res_team

UNION ALL

SELECT 
  'Installation Squad',
  'Installation-focused squad handling physical implementation of landscaping projects including hardscaping and construction elements',
  'HHS-LAND-RES-IN',
  4,
  'Squad',
  res_team.id,
  false,
  2500000.00,
  'CC-111B',
  'operational',
  true,
  true,
  '["squad", "installation", "construction", "hardscape"]'::jsonb,
  '{"specialization": "installation", "construction_skills": true, "equipment_operation": true, "safety_focus": true, "project_execution": true}'::jsonb
FROM res_team;

-- Sub-team Level (Level 5) - Specialized Sub-teams (Leaf Level)
WITH design_squad AS (SELECT id FROM app.d_scope_org WHERE name = 'Garden Design Squad')
INSERT INTO app.d_scope_org (name, "descr", org_code, level_id, level_name, parent_id, is_leaf_level, budget_allocated, cost_center_code, business_unit_type, profit_center, external_facing, tags, attr)
SELECT 
  'Native Plant Specialists',
  'Specialized sub-team focusing on native Canadian plant species, sustainable landscaping, and ecological garden design',
  'HHS-LAND-RES-GD-NP',
  5,
  'Sub-team',
  design_squad.id,
  true,
  500000.00,
  'CC-111A1',
  'specialized',
  true,
  true,
  '["subteam", "native-plants", "sustainability", "ecological"]'::jsonb,
  '{"specialization": "native_plants", "sustainability_focus": true, "ecological_expertise": true, "environmental_compliance": true, "education_component": true}'::jsonb
FROM design_squad

UNION ALL

SELECT 
  'Water Feature Specialists',
  'Specialized sub-team for water feature design, installation, and maintenance including ponds, fountains, and irrigation systems',
  'HHS-LAND-RES-GD-WF',
  5,
  'Sub-team',
  design_squad.id,
  true,
  400000.00,
  'CC-111A2',
  'specialized',
  true,
  true,
  '["subteam", "water-features", "technical", "specialized"]'::jsonb,
  '{"specialization": "water_features", "technical_expertise": true, "electrical_knowledge": true, "maintenance_contracts": true, "luxury_market": true}'::jsonb
FROM design_squad;

-- Indexes removed for simplified import