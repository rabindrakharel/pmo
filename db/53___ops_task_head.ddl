-- ============================================================================
-- TASK OPERATIONS HEAD
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Task operations master table representing individual work tasks within
--   projects across all service lines. Provides foundation for project
--   execution tracking, resource allocation, time management, and operational
--   coordination at the granular task level.
--
-- Task Categories:
--   - Planning: Project planning and preparation tasks
--   - Design: Creative and technical design tasks
--   - Installation: Physical installation and construction tasks
--   - Maintenance: Ongoing maintenance and service tasks
--   - Emergency: Emergency response and urgent repair tasks
--   - Administrative: Administrative and coordination tasks
--
-- Integration:
--   - Parent relationship to d_project for project hierarchy
--   - Links to d_employee for task assignment and ownership
--   - Supports detailed project execution and resource tracking
--   - Enables time tracking and performance measurement

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.ops_task_head (
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

  -- Task identification
  task_number text NOT NULL,
  task_type text NOT NULL DEFAULT 'installation',
  task_category text NOT NULL DEFAULT 'operational',
  
  -- Project relationship (parent)
  project_id uuid NOT NULL,
  project_name text,
  project_code text,
  
  -- Task status and priority
  task_status text NOT NULL DEFAULT 'planned',
  priority_level text DEFAULT 'medium',
  urgency_level text DEFAULT 'normal',
  
  -- Assignment and responsibility
  assigned_to_employee_id uuid,
  assigned_to_employee_name text,
  assigned_crew_id uuid,
  task_owner_id uuid,
  
  -- Scheduling and timeline
  planned_start_date date,
  planned_end_date date,
  actual_start_date date,
  actual_end_date date,
  estimated_hours numeric(6,2),
  actual_hours numeric(6,2),
  
  -- Location and site information
  biz_id uuid REFERENCES app.d_biz(id) ON DELETE SET NULL,
  worksite_id uuid,
  client_id uuid,
  service_address text,
  location_notes text,
  
  -- Task specifications
  work_scope text,
  materials_required jsonb DEFAULT '[]'::jsonb,
  equipment_required jsonb DEFAULT '[]'::jsonb,
  safety_requirements jsonb DEFAULT '[]'::jsonb,
  
  -- Quality and completion
  completion_percentage numeric(5,2) DEFAULT 0.0,
  quality_score numeric(3,1),
  client_satisfaction_score numeric(3,1),
  rework_required boolean DEFAULT false,
  
  -- Financial tracking
  estimated_cost numeric(10,2),
  actual_cost numeric(10,2),
  billable_hours numeric(6,2),
  billing_rate numeric(8,2),
  
  -- Dependencies and relationships
  predecessor_tasks jsonb DEFAULT '[]'::jsonb,
  successor_tasks jsonb DEFAULT '[]'::jsonb,
  blocking_issues jsonb DEFAULT '[]'::jsonb,
  
  -- Communication and documentation
  client_communication_required boolean DEFAULT false,
  permit_required boolean DEFAULT false,
  inspection_required boolean DEFAULT false,
  documentation_complete boolean DEFAULT false
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Huron Home Services Task Portfolio

-- Fall 2025 Landscaping Campaign Tasks
WITH campaign_project AS (
  SELECT id, name, project_code FROM app.d_project WHERE project_code = 'FALL-2025-LAND'
),
employees AS (
  SELECT 
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-010') AS amanda_foster_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-011') AS tom_richardson_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-014') AS carlos_santos_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-015') AS patricia_lee_id
),
clients AS (
  SELECT 
    (SELECT id FROM app.d_client WHERE client_number = 'CL-RES-001') AS thompson_id,
    (SELECT id FROM app.d_client WHERE client_number = 'CL-RES-002') AS miller_id,
    (SELECT id FROM app.d_client WHERE client_number = 'CL-COM-001') AS square_one_id
)

INSERT INTO app.ops_task_head (
  name, "descr", task_number, task_type, task_category, project_id, project_name, project_code,
  task_status, priority_level, assigned_to_employee_id, assigned_to_employee_name,
  planned_start_date, planned_end_date, estimated_hours, worksite_id, client_id,
  service_address, work_scope, materials_required, equipment_required, safety_requirements,
  completion_percentage, estimated_cost, billable_hours, billing_rate, tags, attr
)
SELECT 
  'Fall Leaf Cleanup - Thompson Residence',
  'Comprehensive fall leaf cleanup including leaf removal, garden bed preparation, and seasonal plant protection for premium residential client',
  'TASK-FALL-001',
  'maintenance',
  'seasonal',
  campaign_project.id,
  campaign_project.name,
  campaign_project.project_code,
  'in_progress',
  'high',
  employees.carlos_santos_id,
  'Carlos Santos',
  '2025-10-15'::date,
  '2025-10-16'::date,
  12.0,
  NULL,
  clients.thompson_id,
  '1847 Sheridan Park Dr, Oakville, ON L6H 7S3',
  'Complete leaf cleanup from all landscape areas, prepare garden beds for winter, install plant protection for sensitive perennials',
  '["leaf_bags", "mulch", "burlap_wrap", "plant_stakes"]'::jsonb,
  '["leaf_blower", "rake", "hedge_trimmer", "wheelbarrow"]'::jsonb,
  '["safety_vest", "eye_protection", "hearing_protection", "proper_lifting"]'::jsonb,
  75.0,
  850.00,
  12.0,
  70.00,
  '["fall", "residential", "premium", "seasonal"]'::jsonb,
  '{"property_size": "large", "leaf_volume": "high", "garden_specialty": "perennials", "client_requirements": ["minimal_disruption", "quality_focus"]}'::jsonb
FROM campaign_project, employees, clients

UNION ALL

SELECT 
  'Square One Plaza - Fall Landscaping',
  'Commercial fall landscaping maintenance for high-visibility retail plaza including leaf management, seasonal plantings, and decorative elements',
  'TASK-FALL-002',
  'maintenance',
  'commercial',
  campaign_project.id,
  campaign_project.name,
  campaign_project.project_code,
  'planned',
  'critical',
  employees.tom_richardson_id,
  'Tom Richardson',
  '2025-10-20'::date,
  '2025-10-25'::date,
  40.0,
  NULL,
  clients.square_one_id,
  '100 City Centre Dr, Mississauga, ON L5B 2C9',
  'Complete fall maintenance program including leaf management, seasonal flower installation, decorative pumpkin displays, and winter preparation',
  '["seasonal_flowers", "decorative_pumpkins", "mulch", "fertilizer", "winter_protection"]'::jsonb,
  '["commercial_mowers", "leaf_vacuum", "planting_equipment", "irrigation_tools"]'::jsonb,
  '["high_visibility_vests", "traffic_cones", "safety_signage", "team_communication"]'::jsonb,
  15.0,
  3500.00,
  40.0,
  87.50,
  '["fall", "commercial", "high-visibility", "retail"]'::jsonb,
  '{"public_visibility": "maximum", "foot_traffic": "high", "decorative_elements": true, "seasonal_theme": "fall_harvest", "media_attention": "possible"}'::jsonb
FROM campaign_project, employees, clients

UNION ALL

SELECT 
  'Garden Bed Winterization - Miller Properties',
  'Multi-property garden bed winterization including perennial cutting back, soil amendment, and protective covering installation',
  'TASK-FALL-003',
  'maintenance',
  'seasonal',
  campaign_project.id,
  campaign_project.name,
  campaign_project.project_code,
  'scheduled',
  'medium',
  employees.patricia_lee_id,
  'Patricia Lee',
  '2025-11-01'::date,
  '2025-11-05'::date,
  32.0,
  NULL,
  clients.miller_id,
  '2450 Lakeshore Blvd W, Mississauga, ON L5J 1K5',
  'Comprehensive winterization of garden beds across multiple properties including perennial maintenance, soil conditioning, and protective installations',
  '["compost", "mulch", "burlap", "tree_guards", "soil_amendments"]'::jsonb,
  '["pruning_shears", "garden_spade", "wheelbarrow", "spreader"]'::jsonb,
  '["knee_pads", "gloves", "eye_protection", "proper_lifting_techniques"]'::jsonb,
  10.0,
  2400.00,
  32.0,
  75.00,
  '["fall", "residential", "multi-property", "winterization"]'::jsonb,
  '{"property_count": 2, "garden_complexity": "high", "plant_diversity": "extensive", "client_requirements": ["organic_methods", "sustainability_focus"]}'::jsonb
FROM campaign_project, employees, clients;

-- Winter 2025 Snow Operations Tasks
WITH winter_project AS (
  SELECT id, name, project_code FROM app.d_project WHERE project_code = 'WIN-2025-SNOW'
),
employees AS (
  SELECT 
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-016') AS mike_wilson_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-020') AS alex_dubois_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-018') AS john_macdonald_id
),
commercial_clients AS (
  SELECT 
    (SELECT id FROM app.d_client WHERE client_number = 'CL-COM-002') AS meadowvale_bp_id,
    (SELECT id FROM app.d_client WHERE client_number = 'CL-COM-003') AS toronto_tower_id,
    (SELECT id FROM app.d_client WHERE client_number = 'CL-MUN-001') AS mississauga_city_id
)

INSERT INTO app.ops_task_head (
  name, "descr", task_number, task_type, task_category, project_id, project_name, project_code,
  task_status, priority_level, urgency_level, assigned_to_employee_id, assigned_to_employee_name,
  planned_start_date, planned_end_date, estimated_hours, client_id, service_address,
  work_scope, materials_required, equipment_required, safety_requirements,
  completion_percentage, estimated_cost, billable_hours, billing_rate,
  client_communication_required, tags, attr
)
SELECT 
  'Equipment Preparation - Winter Fleet',
  'Complete winter equipment preparation including snow plow installation, salt spreader setup, and emergency equipment readiness testing',
  'TASK-WINTER-001',
  'maintenance',
  'preparation',
  winter_project.id,
  winter_project.name,
  winter_project.project_code,
  'scheduled',
  'critical',
  'high',
  employees.john_macdonald_id,
  'John MacDonald',
  '2025-11-15'::date,
  '2025-11-30'::date,
  80.0,
  NULL,
  'Equipment Staging Facility, Hamilton, ON',
  'Comprehensive winter equipment preparation including plow blade installation, hydraulic system testing, salt spreader calibration, and emergency equipment verification',
  '["hydraulic_fluid", "plow_blades", "salt", "equipment_parts", "emergency_supplies"]'::jsonb,
  '["snow_plows", "salt_spreaders", "backup_generators", "communication_radios", "maintenance_tools"]'::jsonb,
  '["lockout_tagout", "hydraulic_safety", "lifting_equipment", "ppe_requirements", "emergency_procedures"]'::jsonb,
  90.0,
  4200.00,
  80.0,
  52.50,
  false,
  '["winter", "equipment", "preparation", "safety-critical"]'::jsonb,
  '{"fleet_size": 25, "equipment_types": ["plows", "spreaders", "generators"], "safety_inspections": true, "emergency_readiness": true, "24_7_availability": true}'::jsonb
FROM winter_project, employees, commercial_clients

UNION ALL

SELECT 
  'Meadowvale Business Park - Snow Route Setup',
  'Establish snow removal routes and procedures for Meadowvale Business Park including priority areas, timing, and coordination protocols',
  'TASK-WINTER-002',
  'planning',
  'operational',
  winter_project.id,
  winter_project.name,
  winter_project.project_code,
  'in_progress',
  'high',
  'normal',
  employees.mike_wilson_id,
  'Mike Wilson',
  '2025-11-20'::date,
  '2025-11-25'::date,
  16.0,
  commercial_clients.meadowvale_bp_id,
  '6750 Mississauga Rd, Mississauga, ON L5N 2L3',
  'Comprehensive route planning including priority area identification, timing optimization, salt application rates, and tenant communication protocols',
  '["route_maps", "signage", "salt", "communication_materials"]'::jsonb,
  '["route_planning_software", "measuring_equipment", "communication_radios", "cameras"]'::jsonb,
  '["site_familiarization", "hazard_identification", "emergency_procedures", "communication_protocols"]'::jsonb,
  60.0,
  1200.00,
  16.0,
  75.00,
  true,
  '["winter", "commercial", "route-planning", "coordination"]'::jsonb,
  '{"buildings": 8, "parking_areas": 12, "priority_zones": 3, "tenant_coordination": true, "business_hours_focus": true, "professional_standards": "high"}'::jsonb
FROM winter_project, employees, commercial_clients;

-- HVAC Maintenance Contract Tasks
WITH hvac_project AS (
  SELECT id, name, project_code FROM app.d_project WHERE project_code = 'HVAC-2025-MAINT'
),
technicians AS (
  SELECT 
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-012') AS kevin_obrien_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-007') AS michael_patterson_id
),
hvac_clients AS (
  SELECT 
    (SELECT id FROM app.d_client WHERE client_number = 'CL-COM-003') AS toronto_tower_id,
    (SELECT id FROM app.d_client WHERE client_number = 'CL-PM-002') AS cam_assets_id
)

INSERT INTO app.ops_task_head (
  name, "descr", task_number, task_type, task_category, project_id, project_name, project_code,
  task_status, priority_level, assigned_to_employee_id, assigned_to_employee_name,
  planned_start_date, planned_end_date, estimated_hours, client_id, service_address,
  work_scope, materials_required, equipment_required, safety_requirements,
  completion_percentage, estimated_cost, billable_hours, billing_rate,
  permit_required, inspection_required, documentation_complete, tags, attr
)
SELECT 
  'Toronto Tower - Quarterly HVAC Inspection',
  'Comprehensive quarterly HVAC system inspection and maintenance for 45-story office tower including all mechanical rooms and tenant systems',
  'TASK-HVAC-001',
  'maintenance',
  'preventive',
  hvac_project.id,
  hvac_project.name,
  hvac_project.project_code,
  'scheduled',
  'high',
  technicians.kevin_obrien_id,
  'Kevin O\'Brien',
  '2025-02-10'::date,
  '2025-02-14'::date,
  40.0,
  hvac_clients.toronto_tower_id,
  '200 Bay St, Toronto, ON M5J 2J3',
  'Complete quarterly maintenance including filter replacement, system calibration, performance testing, and preventive maintenance on all HVAC systems across 120 zones',
  '["hvac_filters", "refrigerant", "belts", "cleaning_supplies", "calibration_tools"]'::jsonb,
  '["diagnostic_equipment", "calibration_tools", "vacuum_pumps", "pressure_gauges", "safety_equipment"]'::jsonb,
  '["confined_space", "electrical_safety", "refrigerant_handling", "fall_protection", "lockout_tagout"]'::jsonb,
  25.0,
  3500.00,
  40.0,
  87.50,
  false,
  true,
  false,
  '["hvac", "maintenance", "commercial", "high-rise"]'::jsonb,
  '{"floors": 45, "hvac_zones": 120, "system_complexity": "high", "tenant_coordination": true, "emergency_systems": true, "sustainability_focus": true}'::jsonb
FROM hvac_project, technicians, hvac_clients

UNION ALL

SELECT 
  'Emergency HVAC Response - CAM Portfolio',
  'Emergency HVAC response and repair services for CAM Assets commercial portfolio with 4-hour response commitment',
  'TASK-HVAC-002',
  'emergency',
  'reactive',
  hvac_project.id,
  hvac_project.name,
  hvac_project.project_code,
  'on_call',
  'critical',
  technicians.michael_patterson_id,
  'Michael Patterson',
  '2025-01-01'::date,
  '2025-12-31'::date,
  200.0,
  hvac_clients.cam_assets_id,
  'Multiple Locations - CAM Portfolio',
  'On-call emergency HVAC response service covering 25 commercial properties with guaranteed 4-hour response time and 24/7 availability',
  '["emergency_parts_inventory", "refrigerant", "emergency_supplies", "replacement_units"]'::jsonb,
  '["mobile_service_vehicle", "diagnostic_equipment", "emergency_tools", "communication_equipment"]'::jsonb,
  '["emergency_response", "electrical_safety", "confined_space", "after_hours_protocols", "tenant_safety"]'::jsonb,
  0.0,
  15000.00,
  200.0,
  125.00,
  false,
  false,
  true,
  '["hvac", "emergency", "portfolio", "24x7"]'::jsonb,
  '{"properties": 25, "response_time_hours": 4, "availability": "24_7", "tenant_impact": "critical", "service_level": "premium", "contract_value": "high"}'::jsonb
FROM hvac_project, technicians, hvac_clients;

-- Solar Installation Project Tasks  
WITH solar_project AS (
  SELECT id, name, project_code FROM app.d_project WHERE project_code = 'SOL-2025-EXP'
),
solar_team AS (
  SELECT 
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-012') AS kevin_obrien_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-007') AS michael_patterson_id
),
residential_clients AS (
  SELECT 
    (SELECT id FROM app.d_client WHERE client_number = 'CL-RES-001') AS thompson_id,
    (SELECT id FROM app.d_client WHERE client_number = 'CL-RES-003') AS chen_id
)

INSERT INTO app.ops_task_head (
  name, "descr", task_number, task_type, task_category, project_id, project_name, project_code,
  task_status, priority_level, assigned_to_employee_id, assigned_to_employee_name,
  planned_start_date, planned_end_date, estimated_hours, client_id, service_address,
  work_scope, materials_required, equipment_required, safety_requirements,
  completion_percentage, estimated_cost, billable_hours, billing_rate,
  permit_required, inspection_required, client_communication_required, tags, attr
)
SELECT 
  'Solar System Design - Thompson Residence',
  'Complete solar system design including site assessment, energy analysis, permit applications, and installation planning for residential solar installation',
  'TASK-SOLAR-001',
  'design',
  'planning',
  solar_project.id,
  solar_project.name,
  solar_project.project_code,
  'in_progress',
  'high',
  solar_team.michael_patterson_id,
  'Michael Patterson',
  '2025-05-15'::date,
  '2025-05-25'::date,
  24.0,
  residential_clients.thompson_id,
  '1847 Sheridan Park Dr, Oakville, ON L6H 7S3',
  'Comprehensive solar system design including roof assessment, shading analysis, electrical design, permit preparation, and installation planning for 8.5kW residential system',
  '["design_software", "measuring_equipment", "permit_applications", "documentation_materials"]'::jsonb,
  '["site_assessment_tools", "solar_irradiance_meter", "design_software", "safety_equipment"]'::jsonb,
  '["roof_safety", "electrical_safety", "fall_protection", "measurement_accuracy", "client_safety"]'::jsonb,
  70.0,
  2400.00,
  24.0,
  100.00,
  true,
  true,
  true,
  '["solar", "design", "residential", "permits"]'::jsonb,
  '{"system_size_kw": 8.5, "roof_complexity": "moderate", "shading_issues": "minimal", "electrical_upgrade": "required", "permit_type": ["building", "electrical"], "client_education": true}'::jsonb
FROM solar_project, solar_team, residential_clients;

-- Indexes removed for simplified import