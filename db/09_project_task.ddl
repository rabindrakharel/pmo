-- ============================================================================
-- PROJECT AND TASK SCOPE HIERARCHY (Operational Execution and Management)
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
-- 
-- 🎯 **PROJECT EXECUTION BACKBONE**
-- • End-to-end project lifecycle management
-- • Granular task orchestration and assignment
-- • Real-time progress tracking and reporting
-- • Multi-dimensional stakeholder coordination
--
-- 🏗️ **HIERARCHY STRUCTURE**
-- Level 1: Project → Level 2: Task → Level 3: Subtask → Level 4: Sub-subtask
--
-- 🔗 **INTEGRATION POINTS**
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
-- • Client collaboration workflows
-- • Automated progress triggers
--
-- 🛡️ **PERMISSION INTEGRATION**
-- • Project-level scope access
-- • Task-granular permissions
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
CREATE TABLE app.ops_project_head (
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
  business_id uuid,
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

-- Task Head Table (Task Definition and Assignment)
CREATE TABLE app.ops_task_head (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proj_head_id uuid NOT NULL REFERENCES app.ops_project_head(id) ON DELETE CASCADE,
  parent_task_id uuid REFERENCES app.ops_task_head(id) ON DELETE SET NULL,
  
  -- Task identification and metadata
  title text NOT NULL,
  task_code text,
  task_type text DEFAULT 'development',
  priority text DEFAULT 'medium',
  
  -- Task assignment and ownership
  assignee_id uuid REFERENCES app.d_employee(id) ON DELETE SET NULL,
  reporter_id uuid REFERENCES app.d_employee(id) ON DELETE SET NULL,
  
  -- Collaboration and workflow
  reviewers uuid[] NOT NULL DEFAULT '{}'::uuid[],
  approvers uuid[] NOT NULL DEFAULT '{}'::uuid[],
  collaborators uuid[] NOT NULL DEFAULT '{}'::uuid[],
  watchers uuid[] NOT NULL DEFAULT '{}'::uuid[],
  
  -- Client and external stakeholder management
  client_group_id uuid,
  clients uuid[] NOT NULL DEFAULT '{}'::uuid[],
  
  -- Location and worksite context
  worksite_id uuid,
  location_context text,
  
  -- Task planning and estimation
  estimated_hours numeric(8,2),
  story_points int,
  planned_start_date date,
  planned_end_date date,
  
  -- Dependencies and relationships
  depends_on_tasks uuid[] DEFAULT '{}'::uuid[],
  blocks_tasks uuid[] DEFAULT '{}'::uuid[],
  related_tasks uuid[] DEFAULT '{}'::uuid[],
  
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

-- Task Records Table (Task Status, Progress Tracking, and Activity Logging)
CREATE TABLE app.ops_task_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  head_id uuid NOT NULL REFERENCES app.ops_task_head(id) ON DELETE CASCADE,
  
  -- Task status and workflow state
  status_name text,
  stage_name text,
  
  -- Progress tracking
  completion_percentage numeric(5,2) DEFAULT 0.0,
  actual_start_date date,
  actual_end_date date,
  actual_hours numeric(8,2),
  
  -- Work log and time tracking
  work_log jsonb DEFAULT '[]'::jsonb,
  time_spent numeric(8,2) DEFAULT 0.0,
  
  -- Time tracking for specific log entries
  start_ts timestamptz,
  end_ts timestamptz,
  
  -- Log ownership and workflow
  log_owner_id uuid REFERENCES app.d_employee(id) ON DELETE SET NULL,
  
  -- Log content 
  log_type text DEFAULT 'form_data:draft',
  log_content jsonb DEFAULT '{}'::jsonb,
  attachments jsonb DEFAULT '[]'::jsonb,
  form_log_id uuid,
  
  -- Quality and acceptance criteria
  acceptance_criteria jsonb DEFAULT '[]'::jsonb,
  acceptance_status text DEFAULT 'pending',
  quality_gate_status text DEFAULT 'not_started',
  
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
INSERT INTO app.ops_project_head 
  (name, descr, slug, project_code, project_type, priority_level, budget_allocated, budget_currency, planned_start_date, planned_end_date, estimated_hours, security_classification, compliance_requirements, risk_assessment, tenant_id, tags, attr)
VALUES
  ('Fall 2025 Landscaping Campaign', 'Comprehensive fall landscaping services campaign including leaf cleanup, garden preparation, tree care, and lawn winterization across all service areas', 'fall-2025-landscaping', 'FALL-2025-LAND', 'seasonal', 'high', 450000.00, 'CAD',
    '2025-09-01', '2025-11-30', 1800.0, 'internal',
    '["WSIB Safety Standards", "Environmental Protection Act", "Pesticide Application Permits"]'::jsonb,
    '{"weather_risk": "high", "equipment_availability": "medium", "seasonal_staff": "critical", "customer_demand": "high"}'::jsonb,
    gen_random_uuid(),
    '["seasonal", "fall", "landscaping", "campaign"]',
    '{"peak_season": "October", "service_types": ["leaf_cleanup", "garden_prep", "tree_care", "winterization"], "crew_scaling": "3x_normal", "equipment_required": ["leaf_blowers", "mulching_mowers", "tree_equipment"]}'),
    
  ('Winter 2025 Snow Removal Operations', 'Winter snow removal and ice management services for residential, commercial, and municipal clients with 24/7 emergency response capability', 'winter-2025-snow', 'WIN-2025-SNOW', 'seasonal', 'critical', 520000.00, 'CAD',
    '2025-11-15', '2026-03-31', 2200.0, 'internal',
    '["Municipal Snow Removal Standards", "Commercial Driver Licensing", "Environmental Salt Management"]'::jsonb,
    '{"weather_dependency": "critical", "equipment_failure": "high", "salt_supply": "medium", "crew_availability": "high"}'::jsonb,
    gen_random_uuid(),
    '["seasonal", "winter", "snow_removal", "emergency"]',
    '{"coverage_area": "GTA_and_London", "response_time": "2_hours", "equipment_fleet": "15_plows", "salt_capacity": "200_tons", "crew_size": "25_operators", "contract_types": ["residential", "commercial", "municipal"]}'),
    
  ('Tank Water Heater Replacement Program', 'Systematic replacement and upgrade of aging tank water heaters for residential clients with energy-efficient models and extended warranties', 'water-heater-replacement-2025', 'WHR-2025-PLUMB', 'service', 'medium', 180000.00, 'CAD',
    '2025-01-15', '2025-12-15', 960.0, 'internal',
    '["TSSA Gas Installation Standards", "Building Code Compliance", "Manufacturer Warranties"]'::jsonb,
    '{"supply_chain": "medium", "permit_delays": "low", "technical_complexity": "low", "customer_coordination": "medium"}'::jsonb,
    gen_random_uuid(),
    '["plumbing", "replacement", "energy_efficiency"]',
    '{"target_installations": 120, "heater_types": ["gas", "electric", "hybrid"], "warranty_period": "10_years", "energy_rebates": "available", "average_installation_time": "4_hours"}'),
    
  ('Spring 2025 Garden Renewal Initiative', 'Spring landscaping and garden renewal services including soil preparation, planting, irrigation system installation, and landscape design consultations', 'spring-2025-gardens', 'SPR-2025-GARD', 'seasonal', 'high', 320000.00, 'CAD',
    '2025-04-01', '2025-06-30', 1440.0, 'internal',
    '["Nursery Sourcing Standards", "Irrigation Installation Permits", "Landscape Design Certification"]'::jsonb,
    '{"weather_dependency": "high", "plant_sourcing": "medium", "crew_training": "low", "customer_expectations": "high"}'::jsonb,
    gen_random_uuid(),
    '["seasonal", "spring", "landscaping", "design"]',
    '{"peak_months": "April_May", "services": ["soil_prep", "planting", "irrigation", "design"], "plant_sourcing": "local_nurseries", "crew_expansion": "2x_normal", "design_consultations": 75}'),
    
  ('Residential Solar Installation Expansion', 'Expansion of residential solar panel installation services targeting energy-conscious homeowners in the GTA and London markets', 'solar-expansion-2025', 'SOL-2025-EXP', 'expansion', 'medium', 285000.00, 'CAD',
    '2025-03-01', '2025-10-31', 1200.0, 'internal',
    '["Electrical Safety Authority (ESA)", "Solar Panel Certification", "Roof Safety Standards", "Electrical Code Compliance"]'::jsonb,
    '{"technical_expertise": "medium", "permit_processing": "high", "weather_dependency": "medium", "market_competition": "high"}'::jsonb,
    gen_random_uuid(),
    '["solar", "renewable", "expansion", "residential"]',
    '{"target_installations": 85, "system_sizes": ["6kW", "8kW", "10kW"], "warranty": "25_years", "financing_options": true, "team_expansion": "london_office"}'),
    
  ('HVAC Maintenance Contract Initiative', 'Development of comprehensive HVAC maintenance contracts for residential and commercial clients including seasonal tune-ups and emergency service', 'hvac-maintenance-2025', 'HVAC-2025-MAINT', 'service', 'medium', 240000.00, 'CAD',
    '2025-02-01', '2025-12-31', 1080.0, 'internal',
    '["TSSA Gas Technician Certification", "HRAI Standards", "Refrigerant Handling Permits"]'::jsonb,
    '{"technician_availability": "medium", "equipment_costs": "medium", "seasonal_demand": "high", "contract_conversion": "medium"}'::jsonb,
    gen_random_uuid(),
    '["hvac", "maintenance", "contracts", "service"]',
    '{"contract_types": ["residential_annual", "commercial_quarterly"], "services": ["tune_ups", "filter_changes", "emergency_response"], "target_contracts": 200, "service_guarantee": "24_hour_response"}'),
    
  ('Emergency Plumbing Service Enhancement', 'Enhancement of 24/7 emergency plumbing response capabilities with improved dispatch technology and expanded contractor network', 'emergency-plumbing-2025', 'EMER-2025-PLUMB', 'service', 'high', 165000.00, 'CAD',
    '2025-01-01', '2025-06-30', 720.0, 'internal',
    '["Master Plumber Supervision", "Emergency Response Standards", "Contractor Insurance Requirements"]'::jsonb,
    '{"response_time": "critical", "contractor_availability": "high", "equipment_readiness": "medium", "customer_satisfaction": "critical"}'::jsonb,
    gen_random_uuid(),
    '["emergency", "plumbing", "service", "enhancement"]',
    '{"response_guarantee": "2_hours", "coverage_expansion": "london_region", "contractor_network": "+5_partners", "dispatch_technology": "GPS_tracking", "success_metric": "95%_satisfaction"}');

-- Insert Task Hierarchy for Huron Home Services Projects
INSERT INTO app.ops_task_head 
  (proj_head_id, parent_task_id, title, name, descr, task_code, task_type, priority, estimated_hours, story_points, planned_start_date, planned_end_date, tags, attr)
VALUES
  -- Fall 2025 Landscaping Campaign Tasks
  ((SELECT id FROM app.ops_project_head WHERE project_code = 'FALL-2025-LAND'), NULL,
    'Equipment Preparation and Maintenance', 'Equipment Preparation and Maintenance', 'Complete maintenance and preparation of all landscaping equipment including leaf blowers, mulchers, and tree care equipment', 'FALL-EQ-001', 'maintenance', 'high',
    80.0, 13, '2025-08-15', '2025-08-30',
    '["equipment", "maintenance", "seasonal", "preparation"]',
    '{"equipment_count": 45, "maintenance_hours": 80, "safety_inspection": true, "seasonal_setup": "fall_configuration"}'),
    
  ((SELECT id FROM app.ops_project_head WHERE project_code = 'FALL-2025-LAND'), NULL,
    'Seasonal Staff Training Program', 'Seasonal Staff Training Program', 'Train seasonal landscaping staff on fall-specific procedures, safety protocols, and customer service standards', 'FALL-TR-002', 'training', 'high',
    120.0, 21, '2025-08-20', '2025-09-05',
    '["training", "seasonal", "safety", "procedures"]',
    '{"trainees": 45, "training_modules": ["safety", "procedures", "customer_service", "equipment"], "certification_required": true}'),
    
  ((SELECT id FROM app.ops_project_head WHERE project_code = 'FALL-2025-LAND'), NULL,
    'Client Route Planning and Scheduling', 'Client Route Planning and Scheduling', 'Optimize service routes and create efficient scheduling for fall landscaping services across all service areas', 'FALL-SCH-003', 'planning', 'medium',
    40.0, 8, '2025-09-01', '2025-09-15',
    '["scheduling", "routing", "optimization", "efficiency"]',
    '{"client_count": 850, "service_areas": ["mississauga", "toronto", "london"], "route_optimization": "GPS_based", "scheduling_software": "updated"}'),
    
  -- Winter 2025 Snow Removal Operations Tasks  
  ((SELECT id FROM app.ops_project_head WHERE project_code = 'WIN-2025-SNOW'), NULL,
    'Snow Plow Fleet Preparation', 'Snow Plow Fleet Preparation', 'Complete preparation, maintenance, and deployment of snow removal equipment fleet including plows, salt spreaders, and support vehicles', 'WIN-FL-001', 'maintenance', 'critical',
    160.0, 34, '2025-10-15', '2025-11-10',
    '["fleet", "snow_equipment", "maintenance", "critical"]',
    '{"vehicle_count": 15, "plow_attachments": 15, "salt_spreaders": 12, "backup_equipment": 5, "safety_inspection": "mandatory"}'),
    
  ((SELECT id FROM app.ops_project_head WHERE project_code = 'WIN-2025-SNOW'), NULL,
    'Salt and De-icing Supply Management', 'Salt and De-icing Supply Management', 'Secure and manage winter salt supply chain with strategic storage locations and inventory management systems', 'WIN-SALT-002', 'procurement', 'critical',
    60.0, 13, '2025-09-01', '2025-11-01',
    '["supply_chain", "salt", "storage", "inventory"]',
    '{"salt_tons": 200, "storage_locations": 3, "supplier_contracts": "locked_pricing", "inventory_system": "automated"}'),
    
  ((SELECT id FROM app.ops_project_head WHERE project_code = 'WIN-2025-SNOW'), NULL,
    '24/7 Dispatch Center Setup', '24/7 Dispatch Center Setup', 'Establish enhanced dispatch center for winter operations with weather monitoring, GPS tracking, and emergency response coordination', 'WIN-DISP-003', 'operations', 'high',
    80.0, 21, '2025-11-01', '2025-11-15',
    '["dispatch", "monitoring", "gps", "emergency"]',
    '{"weather_integration": "environment_canada", "gps_tracking": "real_time", "response_guarantee": "2_hours", "staff_24_7": true}'),
    
  -- Water Heater Replacement Program Tasks
  ((SELECT id FROM app.ops_project_head WHERE project_code = 'WHR-2025-PLUMB'), NULL,
    'Supplier Partnership and Inventory Setup', 'Supplier Partnership and Inventory Setup', 'Establish partnerships with water heater manufacturers and set up inventory management for energy-efficient models', 'WHR-SUP-001', 'procurement', 'medium',
    40.0, 8, '2025-01-01', '2025-01-31',
    '["suppliers", "inventory", "partnerships", "efficiency"]',
    '{"supplier_count": 3, "heater_models": ["gas", "electric", "hybrid"], "inventory_target": 50, "energy_star_rated": true}'),
    
  ((SELECT id FROM app.ops_project_head WHERE project_code = 'WHR-2025-PLUMB'), NULL,
    'Customer Assessment and Scheduling Program', 'Customer Assessment and Scheduling Program', 'Develop systematic customer assessment process for water heater replacement needs and efficient installation scheduling', 'WHR-ASSESS-002', 'service', 'medium',
    60.0, 13, '2025-02-01', '2025-02-28',
    '["assessment", "customer", "scheduling", "process"]',
    '{"assessment_criteria": ["age", "efficiency", "capacity"], "scheduling_system": "optimized_routing", "customer_communication": "automated"}'),
    
  -- Spring 2025 Garden Renewal Tasks
  ((SELECT id FROM app.ops_project_head WHERE project_code = 'SPR-2025-GARD'), NULL,
    'Nursery Partnership and Plant Sourcing', 'Nursery Partnership and Plant Sourcing', 'Establish partnerships with local nurseries and create plant sourcing strategy for spring garden renewal services', 'SPR-NURS-001', 'procurement', 'high',
    50.0, 13, '2025-02-01', '2025-03-15',
    '["nursery", "sourcing", "partnerships", "plants"]',
    '{"nursery_partners": 5, "plant_varieties": 150, "local_sourcing": "80_percent", "quality_standards": "grade_1"}'),
    
  ((SELECT id FROM app.ops_project_head WHERE project_code = 'SPR-2025-GARD'), NULL,
    'Landscape Design Consultation Program', 'Landscape Design Consultation Program', 'Develop comprehensive landscape design consultation service including site assessment, design plans, and installation coordination', 'SPR-DESIGN-002', 'service', 'high',
    90.0, 21, '2025-03-01', '2025-04-15',
    '["design", "consultation", "landscaping", "professional"]',
    '{"consultation_count": 75, "design_software": "AutoCAD", "site_assessment": "included", "3d_visualization": true}'),
    
  -- Emergency Plumbing Service Enhancement Tasks
  ((SELECT id FROM app.ops_project_head WHERE project_code = 'EMER-2025-PLUMB'), NULL,
    'GPS Dispatch Technology Implementation', 'GPS Dispatch Technology Implementation', 'Implement advanced GPS dispatch technology for optimal emergency response routing and real-time technician tracking', 'EMER-GPS-001', 'technology', 'high',
    80.0, 21, '2025-01-01', '2025-02-28',
    '["gps", "dispatch", "technology", "tracking"]',
    '{"gps_system": "real_time", "response_optimization": "traffic_aware", "technician_tracking": "live", "integration": "dispatch_system"}'),
    
  ((SELECT id FROM app.ops_project_head WHERE project_code = 'EMER-2025-PLUMB'), NULL,
    'Contractor Network Expansion', 'Contractor Network Expansion', 'Expand emergency plumbing contractor network to improve coverage area and reduce response times', 'EMER-CONT-002', 'partnership', 'medium',
    60.0, 13, '2025-02-01', '2025-04-30',
    '["contractors", "network", "expansion", "emergency"]',
    '{"new_contractors": 5, "coverage_expansion": "london_region", "qualification_requirements": ["licensed", "insured", "emergency_certified"], "response_commitment": "2_hours"}');