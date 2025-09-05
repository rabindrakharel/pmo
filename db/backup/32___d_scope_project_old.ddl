-- ============================================================================
-- PROJECT SCOPE DIMENSION
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Project scope dimension representing enterprise projects from initiation
--   through closure. Provides foundation for project management, resource
--   allocation, governance, and portfolio management across all business
--   operations and organizational units.
--
-- Project Categories:
--   - Service: Customer-facing service delivery projects
--   - Internal: Internal operational and improvement projects  
--   - Infrastructure: Technology and facility infrastructure projects
--   - Compliance: Regulatory and compliance-driven projects
--   - Strategic: Strategic initiative and transformation projects
--
-- Integration:
--   - References meta_project_status and meta_project_stage
--   - Links to organizational, location, and worksite scopes
--   - Supports project portfolio management and governance
--   - Enables resource allocation and performance tracking

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.d_scope_project (
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

  -- Project identification
  project_code text UNIQUE NOT NULL,
  project_type text DEFAULT 'service',
  
  -- Project status and stage
  status_id int REFERENCES app.meta_project_status(level_id),
  status_name text,
  stage_id int REFERENCES app.meta_project_stage(level_id),
  stage_name text,
  
  -- Organizational context
  org_id uuid REFERENCES app.d_scope_org(id),
  org_name text,
  primary_org_id uuid REFERENCES app.d_scope_org(id),
  primary_worksite_id uuid REFERENCES app.d_scope_worksite(id),
  
  -- Project management
  project_manager_id uuid,
  sponsor_id uuid,
  client_id uuid,
  
  -- Timeline and budget
  planned_start_date date,
  planned_end_date date,
  actual_start_date date,
  actual_end_date date,
  budget_allocated numeric(15,2),
  budget_spent numeric(15,2),
  
  -- Project attributes
  priority text DEFAULT 'medium',
  risk_level text DEFAULT 'medium',
  complexity text DEFAULT 'medium',
  
  -- External references
  client_project_code text,
  contract_reference text,
  
  -- Performance metrics
  completion_percentage numeric(5,2) DEFAULT 0.0,
  quality_score numeric(3,1),
  customer_satisfaction numeric(3,1)
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Huron Home Services Project Portfolio

-- Get organizational and location references
WITH org_refs AS (
  SELECT 
    (SELECT id FROM app.d_scope_org WHERE name = 'Landscaping Department') AS land_dept_id,
    (SELECT id FROM app.d_scope_org WHERE name = 'Snow Removal Department') AS snow_dept_id,
    (SELECT id FROM app.d_scope_org WHERE name = 'HVAC Services Department') AS hvac_dept_id,
    (SELECT id FROM app.d_scope_org WHERE name = 'Plumbing Services Department') AS plumb_dept_id
), loc_refs AS (
  SELECT
    (SELECT id FROM app.d_scope_org WHERE name = 'Greater Toronto Area') AS gta_id,
    (SELECT id FROM app.d_scope_org WHERE name = 'Mississauga') AS mississauga_id,
    (SELECT id FROM app.d_scope_org WHERE name = 'Toronto') AS toronto_id,
    (SELECT id FROM app.d_scope_org WHERE name = 'Oakville') AS oakville_id
)

-- Service Delivery Projects
INSERT INTO app.d_scope_project (
  name, "descr", project_code, project_type, status_id, status_name, stage_id, stage_name,
  org_id, org_name, primary_org_id, planned_start_date, planned_end_date, 
  budget_allocated, priority, risk_level, complexity, completion_percentage,
  tags, attr
)
SELECT 
  'Fall 2025 Landscaping Campaign',
  'Comprehensive fall landscaping services campaign covering leaf cleanup, garden preparation, tree maintenance, and winter protection across residential and commercial properties',
  'FALL-2025-LAND',
  'service',
  8, -- Active
  'Active',
  3, -- Execution
  'Execution',
  org_refs.land_dept_id,
  'Landscaping Department',
  loc_refs.gta_id,
  '2025-09-01'::date,
  '2025-11-30'::date,
  2500000.00,
  'high',
  'medium',
  'medium',
  75.0,
  '["seasonal", "landscaping", "fall", "campaign", "multi-client"]'::jsonb,
  '{
    "seasonal_campaign": true, "client_count": 250, "crew_teams": 12, 
    "service_mix": ["leaf_cleanup", "garden_prep", "tree_maintenance", "winter_protection"],
    "revenue_target": 2800000, "margin_target": 0.25, "weather_dependent": true
  }'::jsonb
FROM org_refs, loc_refs

UNION ALL

SELECT 
  'Winter 2025 Snow Operations',
  'Comprehensive winter snow removal and ice management operations covering commercial properties, residential complexes, and municipal contracts across the GTA',
  'WIN-2025-SNOW',
  'service',
  7, -- Scheduled
  'Scheduled',
  2, -- Planning
  'Planning',
  org_refs.snow_dept_id,
  'Snow Removal Department',
  loc_refs.gta_id,
  '2025-12-01'::date,
  '2026-03-31'::date,
  3500000.00,
  'critical',
  'high',
  'high',
  90.0,
  '["seasonal", "snow", "winter", "emergency", "24x7"]'::jsonb,
  '{
    "emergency_services": true, "contract_count": 150, "equipment_fleet": 25,
    "salt_capacity_tons": 500, "response_time_hours": 2, "24_7_operations": true,
    "weather_monitoring": true, "municipal_contracts": 8
  }'::jsonb
FROM org_refs, loc_refs

UNION ALL

SELECT 
  'Water Heater Replacement Program',
  'Residential water heater replacement program providing installation, warranty, and maintenance services with focus on energy efficiency and customer satisfaction',
  'WHR-2025-PLUMB',
  'service',
  8, -- Active
  'Active',
  3, -- Execution
  'Execution',
  org_refs.plumb_dept_id,
  'Plumbing Services Department',
  loc_refs.mississauga_id,
  '2025-03-01'::date,
  '2025-12-31'::date,
  1800000.00,
  'medium',
  'low',
  'low',
  45.0,
  '["plumbing", "water-heater", "residential", "energy-efficiency"]'::jsonb,
  '{
    "installation_count_target": 300, "energy_efficiency_focus": true, 
    "warranty_years": 5, "customer_satisfaction_target": 4.5,
    "certified_technicians": 8, "emergency_support": true
  }'::jsonb
FROM org_refs, loc_refs

UNION ALL

SELECT 
  'Spring 2025 Garden Design',
  'Premium garden design and installation services for residential clients focusing on native plants, sustainable practices, and aesthetic excellence',
  'SPR-2025-GARD',
  'service',
  4, -- Planning
  'Planning',
  2, -- Planning
  'Planning',
  org_refs.land_dept_id,
  'Landscaping Department',
  loc_refs.gta_id,
  '2025-04-01'::date,
  '2025-07-31'::date,
  1200000.00,
  'medium',
  'medium',
  'high',
  20.0,
  '["garden", "design", "premium", "sustainable", "residential"]'::jsonb,
  '{
    "premium_services": true, "design_consultation": true, "native_plants": true,
    "sustainability_focus": true, "client_count_target": 75, "avg_project_value": 16000,
    "design_team": 6, "installation_team": 12
  }'::jsonb
FROM org_refs, loc_refs

UNION ALL

SELECT 
  'Solar Panel Installation Expansion',
  'Residential solar panel installation service expansion with focus on energy independence, environmental sustainability, and long-term customer relationships',
  'SOL-2025-EXP',
  'service',
  6, -- Approved
  'Approved',
  1, -- Initiation
  'Initiation',
  org_refs.hvac_dept_id,
  'HVAC Services Department',
  loc_refs.oakville_id,
  '2025-05-01'::date,
  '2025-10-31'::date,
  2200000.00,
  'high',
  'high',
  'high',
  15.0,
  '["solar", "renewable", "expansion", "environmental", "residential"]'::jsonb,
  '{
    "new_service_line": true, "environmental_impact": true, "certification_required": true,
    "installation_target": 100, "avg_system_size_kw": 8.5, "roi_customer_years": 7,
    "certified_installers": 4, "partnership_solar_suppliers": 3
  }'::jsonb
FROM org_refs, loc_refs

UNION ALL

SELECT 
  'HVAC Maintenance Contracts 2025',
  'Annual HVAC maintenance contract program providing preventive maintenance, emergency repair, and system optimization services for commercial and residential clients',
  'HVAC-2025-MAINT',
  'service',
  8, -- Active
  'Active',
  3, -- Execution
  'Execution',
  org_refs.hvac_dept_id,
  'HVAC Services Department',
  loc_refs.gta_id,
  '2025-01-01'::date,
  '2025-12-31'::date,
  3200000.00,
  'high',
  'low',
  'medium',
  65.0,
  '["hvac", "maintenance", "contracts", "preventive", "annual"]'::jsonb,
  '{
    "contract_count": 400, "preventive_maintenance": true, "emergency_response": true,
    "commercial_clients": 120, "residential_clients": 280, "technician_count": 15,
    "response_time_hours": 4, "customer_retention_target": 0.95
  }'::jsonb
FROM org_refs, loc_refs;

-- Internal Infrastructure Projects
WITH org_refs AS (
  SELECT 
    (SELECT id FROM app.d_scope_org WHERE name = 'Corporate Services Division') AS corp_services_id,
    (SELECT id FROM app.d_scope_org WHERE name = 'Business Operations Division') AS biz_ops_id
), loc_refs AS (
  SELECT
    (SELECT id FROM app.d_scope_org WHERE name = 'Mississauga') AS mississauga_id
)

INSERT INTO app.d_scope_project (
  name, "descr", project_code, project_type, status_id, status_name, stage_id, stage_name,
  org_id, org_name, primary_org_id, planned_start_date, planned_end_date,
  budget_allocated, priority, risk_level, complexity, completion_percentage,
  tags, attr
)
SELECT 
  'ERP System Implementation Phase 1',
  'Enterprise Resource Planning system implementation covering finance, HR, project management, and customer relationship management modules',
  'ERP-2025-P1',
  'infrastructure',
  8, -- Active
  'Active',
  3, -- Execution
  'Execution',
  org_refs.corp_services_id,
  'Corporate Services Division',
  loc_refs.mississauga_id,
  '2025-02-01'::date,
  '2025-08-31'::date,
  850000.00,
  'critical',
  'high',
  'high',
  55.0,
  '["erp", "infrastructure", "digital-transformation", "integration"]'::jsonb,
  '{
    "system_integration": true, "modules": ["finance", "hr", "project_mgmt", "crm"],
    "user_count": 200, "training_required": true, "data_migration": true,
    "go_live_phases": 3, "vendor": "SAP", "consultant_team": 6
  }'::jsonb
FROM org_refs, loc_refs

UNION ALL

SELECT 
  'Fleet Management System Upgrade',
  'Vehicle and equipment fleet management system upgrade with GPS tracking, maintenance scheduling, and fuel management capabilities',
  'FLEET-2025-UPG',
  'infrastructure',
  4, -- Planning
  'Planning',
  2, -- Planning
  'Planning',
  org_refs.biz_ops_id,
  'Business Operations Division',
  loc_refs.mississauga_id,
  '2025-06-01'::date,
  '2025-10-31'::date,
  320000.00,
  'medium',
  'medium',
  'medium',
  25.0,
  '["fleet", "gps", "tracking", "maintenance", "efficiency"]'::jsonb,
  '{
    "vehicle_count": 85, "equipment_count": 150, "gps_tracking": true,
    "maintenance_scheduling": true, "fuel_monitoring": true, "route_optimization": true,
    "mobile_app": true, "integration_erp": true
  }'::jsonb
FROM org_refs, loc_refs;

-- Strategic Initiative Projects
INSERT INTO app.d_scope_project (
  name, "descr", project_code, project_type, status_id, status_name, stage_id, stage_name,
  org_id, org_name, primary_org_id, planned_start_date, planned_end_date,
  budget_allocated, priority, risk_level, complexity, completion_percentage,
  tags, attr
) VALUES
('Market Expansion - Hamilton Region',
 'Strategic market expansion into Hamilton and surrounding regions including market analysis, competitive positioning, service offering adaptation, and local partnership development',
 'MKT-EXP-HAM-2025',
 'strategic',
 3, -- Under Review
 'Under Review',
 1, -- Initiation
 'Initiation',
 (SELECT id FROM app.d_scope_org WHERE name = 'Business Operations Division'),
 'Business Operations Division',
 (SELECT id FROM app.d_scope_org WHERE name = 'Hamilton CMA'),
 '2025-07-01'::date,
 '2026-03-31'::date,
 750000.00,
 'high',
 'high',
 'high',
 10.0,
 '["strategic", "expansion", "market-entry", "hamilton"]'::jsonb,
 '{
   "market_research": true, "competitive_analysis": true, "local_partnerships": true,
   "service_adaptation": true, "regulatory_compliance": true, "revenue_projection": 2000000,
   "market_size": "medium", "competition_level": "moderate"
 }'::jsonb);

-- Indexes removed for simplified import