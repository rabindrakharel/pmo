-- ============================================================================
-- PROJECT SCOPE (Project Definition and Management)
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
-- 
-- 🎯 **PROJECT EXECUTION BACKBONE**
-- • End-to-end project lifecycle management
-- • Business unit integration and budget management
-- • Multi-dimensional stakeholder coordination
-- • Client collaboration workflows
--
-- 🏗️ **INTEGRATION POINTS**
-- • Business units (ownership & budget)
-- • Geographic locations (execution sites)
-- • HR hierarchy (team assignments) 
-- • Worksite facilities (physical execution)
-- • Client stakeholders (external collaboration)
--
-- 📊 **OPERATIONAL PATTERNS**
-- • Dynamic resource allocation
-- • Cross-functional team matrices
-- • Milestone & quality gates
-- • Automated progress triggers
--
-- 🛡️ **PERMISSION INTEGRATION**
-- • Project-level scope access
-- • Role-based execution rights
-- • Client external access
-- • Cross-scope inheritance
--
-- 💼 **REAL-WORLD SCENARIOS**
-- • Platform modernization (25-person teams across Toronto/Montreal)
-- • Government portals (security clearance + bilingual compliance)
-- • AI research projects (IP protection + university partnerships)
-- • Multi-site infrastructure (coordinated downtime windows)

-- ============================================================================
-- DDL:
-- ============================================================================

-- Project Head Table (Project Definition and Scope)
CREATE TABLE app.d_scope_project (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  
  -- Project identification and metadata
  project_code text UNIQUE,
  project_type text DEFAULT 'development',
  priority_level text DEFAULT 'medium',
  slug text UNIQUE,
  
  -- Business and operational context
  budget_allocated numeric(15,2),
  budget_currency text DEFAULT 'CAD',
  
  -- Scope relationships (integrated with d_scope_ tables)
  biz_id uuid REFERENCES app.d_scope_org(id) ON DELETE SET NULL,
  locations uuid[],
  worksites uuid[],
  
  -- Project team and stakeholders
  project_managers uuid[] NOT NULL DEFAULT '{}'::uuid[],
  project_sponsors uuid[] NOT NULL DEFAULT '{}'::uuid[],
  project_leads uuid[] NOT NULL DEFAULT '{}'::uuid[],
  clients jsonb DEFAULT '[]'::jsonb,
  approvers uuid[] DEFAULT '{}'::uuid[],
  
  -- Project timeline and planning
  planned_start_date date,
  planned_end_date date,
  actual_start_date date,
  actual_end_date date,
  milestones jsonb DEFAULT '[]'::jsonb,
  deliverables jsonb DEFAULT '[]'::jsonb,
  estimated_hours numeric(10,2),
  actual_hours numeric(10,2),
  project_stage text,
  project_status text,
  
  -- Compliance and governance
  security_classification text DEFAULT 'internal',
  compliance_requirements jsonb DEFAULT '[]'::jsonb,
  risk_assessment jsonb DEFAULT '{}'::jsonb,
  
  -- Standard fields (audit, metadata, SCD type 2)
  name text NOT NULL,
  descr text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Insert Huron Home Services Seasonal and Service Projects
INSERT INTO app.d_scope_project
  (name, descr, slug, project_code, project_type, priority_level, budget_allocated, budget_currency, biz_id, planned_start_date, planned_end_date, estimated_hours, security_classification, compliance_requirements, risk_assessment, tenant_id, tags, attr)
VALUES
  ('Fall 2025 Landscaping Campaign', 'Comprehensive fall landscaping services campaign including leaf cleanup, garden preparation, tree care, and lawn winterization across all service areas', 'fall-2025-landscaping', 'FALL-2025-LAND', 'seasonal', 'high', 450000.00, 'CAD',
    (SELECT id FROM app.d_scope_org WHERE name = 'Huron Home Services'),
    '2025-09-01', '2025-11-30', 1800.0, 'internal',
    '["WSIB Safety Standards", "Environmental Protection Act", "Pesticide Application Permits"]'::jsonb,
    '{"weather_risk": "high", "equipment_availability": "medium", "seasonal_staff": "critical", "customer_demand": "high"}'::jsonb,
    gen_random_uuid(),
    '["seasonal", "fall", "landscaping", "campaign"]',
    '{"peak_season": "October", "service_types": ["leaf_cleanup", "garden_prep", "tree_care", "winterization"], "crew_scaling": "3x_normal", "equipment_required": ["leaf_blowers", "mulching_mowers", "tree_equipment"]}'),
    
  ('Winter 2025 Snow Removal Operations', 'Winter snow removal and ice management services for residential, commercial, and municipal clients with 24/7 emergency response capability', 'winter-2025-snow', 'WIN-2025-SNOW', 'seasonal', 'critical', 520000.00, 'CAD',
    (SELECT id FROM app.d_scope_org WHERE name = 'Huron Home Services'),
    '2025-11-15', '2026-03-31', 2200.0, 'internal',
    '["Municipal Snow Removal Standards", "Commercial Driver Licensing", "Environmental Salt Management"]'::jsonb,
    '{"weather_dependency": "critical", "equipment_failure": "high", "salt_supply": "medium", "crew_availability": "high"}'::jsonb,
    gen_random_uuid(),
    '["seasonal", "winter", "snow_removal", "emergency"]',
    '{"coverage_area": "GTA_and_London", "response_time": "2_hours", "equipment_fleet": "15_plows", "salt_capacity": "200_tons", "crew_size": "25_operators", "contract_types": ["residential", "commercial", "municipal"]}'),
    
  ('Tank Water Heater Replacement Program', 'Systematic replacement and upgrade of aging tank water heaters for residential clients with energy-efficient models and extended warranties', 'water-heater-replacement-2025', 'WHR-2025-PLUMB', 'service', 'medium', 180000.00, 'CAD',
    (SELECT id FROM app.d_scope_org WHERE name = 'Huron Home Services'),
    '2025-01-15', '2025-12-15', 960.0, 'internal',
    '["TSSA Gas Installation Standards", "Building Code Compliance", "Manufacturer Warranties"]'::jsonb,
    '{"supply_chain": "medium", "permit_delays": "low", "technical_complexity": "low", "customer_coordination": "medium"}'::jsonb,
    gen_random_uuid(),
    '["plumbing", "replacement", "energy_efficiency"]',
    '{"target_installations": 120, "heater_types": ["gas", "electric", "hybrid"], "warranty_period": "10_years", "energy_rebates": "available", "average_installation_time": "4_hours"}'),
    
  ('Spring 2025 Garden Renewal Initiative', 'Spring landscaping and garden renewal services including soil preparation, planting, irrigation system installation, and landscape design consultations', 'spring-2025-gardens', 'SPR-2025-GARD', 'seasonal', 'high', 320000.00, 'CAD',
    (SELECT id FROM app.d_scope_org WHERE name = 'Huron Home Services'),
    '2025-04-01', '2025-06-30', 1440.0, 'internal',
    '["Nursery Sourcing Standards", "Irrigation Installation Permits", "Landscape Design Certification"]'::jsonb,
    '{"weather_dependency": "high", "plant_sourcing": "medium", "crew_training": "low", "customer_expectations": "high"}'::jsonb,
    gen_random_uuid(),
    '["seasonal", "spring", "landscaping", "design"]',
    '{"peak_months": "April_May", "services": ["soil_prep", "planting", "irrigation", "design"], "plant_sourcing": "local_nurseries", "crew_expansion": "2x_normal", "design_consultations": 75}'),
    
  ('Residential Solar Installation Expansion', 'Expansion of residential solar panel installation services targeting energy-conscious homeowners in the GTA and London markets', 'solar-expansion-2025', 'SOL-2025-EXP', 'expansion', 'medium', 285000.00, 'CAD',
    (SELECT id FROM app.d_scope_org WHERE name = 'Huron Home Services'),
    '2025-03-01', '2025-10-31', 1200.0, 'internal',
    '["Electrical Safety Authority (ESA)", "Solar Panel Certification", "Roof Safety Standards", "Electrical Code Compliance"]'::jsonb,
    '{"technical_expertise": "medium", "permit_processing": "high", "weather_dependency": "medium", "market_competition": "high"}'::jsonb,
    gen_random_uuid(),
    '["solar", "renewable", "expansion", "residential"]',
    '{"target_installations": 85, "system_sizes": ["6kW", "8kW", "10kW"], "warranty": "25_years", "financing_options": true, "team_expansion": "london_office"}'),
    
  ('HVAC Maintenance Contract Initiative', 'Development of comprehensive HVAC maintenance contracts for residential and commercial clients including seasonal tune-ups and emergency service', 'hvac-maintenance-2025', 'HVAC-2025-MAINT', 'service', 'medium', 240000.00, 'CAD',
    (SELECT id FROM app.d_scope_org WHERE name = 'Huron Home Services'),
    '2025-02-01', '2025-12-31', 1080.0, 'internal',
    '["TSSA Gas Technician Certification", "HRAI Standards", "Refrigerant Handling Permits"]'::jsonb,
    '{"technician_availability": "medium", "equipment_costs": "medium", "seasonal_demand": "high", "contract_conversion": "medium"}'::jsonb,
    gen_random_uuid(),
    '["hvac", "maintenance", "contracts", "service"]',
    '{"contract_types": ["residential_annual", "commercial_quarterly"], "services": ["tune_ups", "filter_changes", "emergency_response"], "target_contracts": 200, "service_guarantee": "24_hour_response"}'),
    
  ('Emergency Plumbing Service Enhancement', 'Enhancement of 24/7 emergency plumbing response capabilities with improved dispatch technology and expanded contractor network', 'emergency-plumbing-2025', 'EMER-2025-PLUMB', 'service', 'high', 165000.00, 'CAD',
    (SELECT id FROM app.d_scope_org WHERE name = 'Huron Home Services'),
    '2025-01-01', '2025-06-30', 720.0, 'internal',
    '["Master Plumber Supervision", "Emergency Response Standards", "Contractor Insurance Requirements"]'::jsonb,
    '{"response_time": "critical", "contractor_availability": "high", "equipment_readiness": "medium", "customer_satisfaction": "critical"}'::jsonb,
    gen_random_uuid(),
    '["emergency", "plumbing", "service", "enhancement"]',
    '{"response_guarantee": "2_hours", "coverage_expansion": "london_region", "contractor_network": "+5_partners", "dispatch_technology": "GPS_tracking", "success_metric": "95%_satisfaction"}');
