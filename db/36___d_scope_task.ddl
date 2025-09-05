-- ============================================================================
-- TASK SCOPE (Task Definition and Assignment)
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- 🎯 **GRANULAR TASK ORCHESTRATION**
-- • Individual task definition and assignment
-- • Hierarchical task relationships (parent-child)
-- • Cross-functional collaboration workflows
-- • Real-time progress tracking
--
-- 🔗 **RELATIONSHIP HIERARCHY**
-- Level 1: Project → Level 2: Task → Level 3: Subtask → Level 4: Sub-subtask
--
-- 👥 **COLLABORATION FEATURES**
-- • Multi-role assignment (assignee, reviewers, approvers)
-- • Client and external stakeholder integration
-- • Worksite and location context
-- • Dependency management and blocking relationships
--
-- 📊 **PLANNING CAPABILITIES**
-- • Story point estimation and hour tracking
-- • Timeline planning with dependencies
-- • Resource allocation and workload management
-- • Quality gates and acceptance criteria

-- ============================================================================
-- DDL:
-- ============================================================================

-- Task Head Table (Task Definition and Assignment)
CREATE TABLE app.d_scope_task (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proj_head_id uuid NOT NULL REFERENCES app.d_scope_project(id) ON DELETE CASCADE,
  parent_task_id uuid REFERENCES app.d_scope_task(id) ON DELETE SET NULL,
  
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
  worksite_id uuid REFERENCES app.d_scope_worksite(id) ON DELETE SET NULL,
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

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Insert Task Hierarchy for Huron Home Services Projects
INSERT INTO app.d_scope_task 
  (proj_head_id, parent_task_id, title, name, descr, task_code, task_type, priority, estimated_hours, story_points, planned_start_date, planned_end_date, tags, attr)
VALUES
  -- Fall 2025 Landscaping Campaign Tasks
  ((SELECT id FROM app.d_scope_project WHERE project_code = 'FALL-2025-LAND'), NULL,
    'Equipment Preparation and Maintenance', 'Equipment Preparation and Maintenance', 'Complete maintenance and preparation of all landscaping equipment including leaf blowers, mulchers, and tree care equipment', 'FALL-EQ-001', 'maintenance', 'high',
    80.0, 13, '2025-08-15', '2025-08-30',
    '["equipment", "maintenance", "seasonal", "preparation"]',
    '{"equipment_count": 45, "maintenance_hours": 80, "safety_inspection": true, "seasonal_setup": "fall_configuration"}'),
    
  ((SELECT id FROM app.d_scope_project WHERE project_code = 'FALL-2025-LAND'), NULL,
    'Seasonal Staff Training Program', 'Seasonal Staff Training Program', 'Train seasonal landscaping staff on fall-specific procedures, safety protocols, and customer service standards', 'FALL-TR-002', 'training', 'high',
    120.0, 21, '2025-08-20', '2025-09-05',
    '["training", "seasonal", "safety", "procedures"]',
    '{"trainees": 45, "training_modules": ["safety", "procedures", "customer_service", "equipment"], "certification_required": true}'),
    
  ((SELECT id FROM app.d_scope_project WHERE project_code = 'FALL-2025-LAND'), NULL,
    'Client Route Planning and Scheduling', 'Client Route Planning and Scheduling', 'Optimize service routes and create efficient scheduling for fall landscaping services across all service areas', 'FALL-SCH-003', 'planning', 'medium',
    40.0, 8, '2025-09-01', '2025-09-15',
    '["scheduling", "routing", "optimization", "efficiency"]',
    '{"client_count": 850, "service_areas": ["mississauga", "toronto", "london"], "route_optimization": "GPS_based", "scheduling_software": "updated"}'),
    
  -- Winter 2025 Snow Removal Operations Tasks  
  ((SELECT id FROM app.d_scope_project WHERE project_code = 'WIN-2025-SNOW'), NULL,
    'Snow Plow Fleet Preparation', 'Snow Plow Fleet Preparation', 'Complete preparation, maintenance, and deployment of snow removal equipment fleet including plows, salt spreaders, and support vehicles', 'WIN-FL-001', 'maintenance', 'critical',
    160.0, 34, '2025-10-15', '2025-11-10',
    '["fleet", "snow_equipment", "maintenance", "critical"]',
    '{"vehicle_count": 15, "plow_attachments": 15, "salt_spreaders": 12, "backup_equipment": 5, "safety_inspection": "mandatory"}'),
    
  ((SELECT id FROM app.d_scope_project WHERE project_code = 'WIN-2025-SNOW'), NULL,
    'Salt and De-icing Supply Management', 'Salt and De-icing Supply Management', 'Secure and manage winter salt supply chain with strategic storage locations and inventory management systems', 'WIN-SALT-002', 'procurement', 'critical',
    60.0, 13, '2025-09-01', '2025-11-01',
    '["supply_chain", "salt", "storage", "inventory"]',
    '{"salt_tons": 200, "storage_locations": 3, "supplier_contracts": "locked_pricing", "inventory_system": "automated"}'),
    
  ((SELECT id FROM app.d_scope_project WHERE project_code = 'WIN-2025-SNOW'), NULL,
    '24/7 Dispatch Center Setup', '24/7 Dispatch Center Setup', 'Establish enhanced dispatch center for winter operations with weather monitoring, GPS tracking, and emergency response coordination', 'WIN-DISP-003', 'operations', 'high',
    80.0, 21, '2025-11-01', '2025-11-15',
    '["dispatch", "monitoring", "gps", "emergency"]',
    '{"weather_integration": "environment_canada", "gps_tracking": "real_time", "response_guarantee": "2_hours", "staff_24_7": true}'),
    
  -- Water Heater Replacement Program Tasks
  ((SELECT id FROM app.d_scope_project WHERE project_code = 'WHR-2025-PLUMB'), NULL,
    'Supplier Partnership and Inventory Setup', 'Supplier Partnership and Inventory Setup', 'Establish partnerships with water heater manufacturers and set up inventory management for energy-efficient models', 'WHR-SUP-001', 'procurement', 'medium',
    40.0, 8, '2025-01-01', '2025-01-31',
    '["suppliers", "inventory", "partnerships", "efficiency"]',
    '{"supplier_count": 3, "heater_models": ["gas", "electric", "hybrid"], "inventory_target": 50, "energy_star_rated": true}'),
    
  ((SELECT id FROM app.d_scope_project WHERE project_code = 'WHR-2025-PLUMB'), NULL,
    'Customer Assessment and Scheduling Program', 'Customer Assessment and Scheduling Program', 'Develop systematic customer assessment process for water heater replacement needs and efficient installation scheduling', 'WHR-ASSESS-002', 'service', 'medium',
    60.0, 13, '2025-02-01', '2025-02-28',
    '["assessment", "customer", "scheduling", "process"]',
    '{"assessment_criteria": ["age", "efficiency", "capacity"], "scheduling_system": "optimized_routing", "customer_communication": "automated"}'),
    
  -- Spring 2025 Garden Renewal Tasks
  ((SELECT id FROM app.d_scope_project WHERE project_code = 'SPR-2025-GARD'), NULL,
    'Nursery Partnership and Plant Sourcing', 'Nursery Partnership and Plant Sourcing', 'Establish partnerships with local nurseries and create plant sourcing strategy for spring garden renewal services', 'SPR-NURS-001', 'procurement', 'high',
    50.0, 13, '2025-02-01', '2025-03-15',
    '["nursery", "sourcing", "partnerships", "plants"]',
    '{"nursery_partners": 5, "plant_varieties": 150, "local_sourcing": "80_percent", "quality_standards": "grade_1"}'),
    
  ((SELECT id FROM app.d_scope_project WHERE project_code = 'SPR-2025-GARD'), NULL,
    'Landscape Design Consultation Program', 'Landscape Design Consultation Program', 'Develop comprehensive landscape design consultation service including site assessment, design plans, and installation coordination', 'SPR-DESIGN-002', 'service', 'high',
    90.0, 21, '2025-03-01', '2025-04-15',
    '["design", "consultation", "landscaping", "professional"]',
    '{"consultation_count": 75, "design_software": "AutoCAD", "site_assessment": "included", "3d_visualization": true}'),
    
  -- Emergency Plumbing Service Enhancement Tasks
  ((SELECT id FROM app.d_scope_project WHERE project_code = 'EMER-2025-PLUMB'), NULL,
    'GPS Dispatch Technology Implementation', 'GPS Dispatch Technology Implementation', 'Implement advanced GPS dispatch technology for optimal emergency response routing and real-time technician tracking', 'EMER-GPS-001', 'technology', 'high',
    80.0, 21, '2025-01-01', '2025-02-28',
    '["gps", "dispatch", "technology", "tracking"]',
    '{"gps_system": "real_time", "response_optimization": "traffic_aware", "technician_tracking": "live", "integration": "dispatch_system"}'),
    
  ((SELECT id FROM app.d_scope_project WHERE project_code = 'EMER-2025-PLUMB'), NULL,
    'Contractor Network Expansion', 'Contractor Network Expansion', 'Expand emergency plumbing contractor network to improve coverage area and reduce response times', 'EMER-CONT-002', 'partnership', 'medium',
    60.0, 13, '2025-02-01', '2025-04-30',
    '["contractors", "network", "expansion", "emergency"]',
    '{"new_contractors": 5, "coverage_expansion": "london_region", "qualification_requirements": ["licensed", "insured", "emergency_certified"], "response_commitment": "2_hours"}');
