-- ============================================================================
-- TASK RECORDS (Task Status, Progress Tracking, and Activity Logging)
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- 📊 **PROGRESS TRACKING ENGINE**
-- • Real-time task status and progress monitoring
-- • Detailed work logging and time tracking
-- • Quality gates and acceptance criteria management
-- • Activity audit trail and compliance reporting
--
-- ⏱️ **TIME TRACKING CAPABILITIES**
-- • Granular time logging per task session
-- • Work session start/end timestamps
-- • Cumulative time aggregation
-- • Effort estimation vs actual tracking
--
-- 📋 **WORK LOG FEATURES**
-- • Structured work entries with metadata
-- • Form-based data collection integration
-- • File attachment management
-- • Rich content and notes support
--
-- 🎯 **QUALITY MANAGEMENT**
-- • Acceptance criteria definition and tracking
-- • Quality gate checkpoint management
-- • Review and approval workflows
-- • Compliance validation processes

-- ============================================================================
-- DDL:
-- ============================================================================

-- Task Records Table (Task Status, Progress Tracking, and Activity Logging)
CREATE TABLE app.ops_task_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  head_id uuid NOT NULL REFERENCES app.d_scope_task(id) ON DELETE CASCADE,
  
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
  form_log_id uuid REFERENCES app.ops_formlog_records(id) ON DELETE SET NULL,
  
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

-- Insert Sample Task Records for Huron Home Services Projects
INSERT INTO app.ops_task_records
  (head_id, name, descr, status_name, stage_name, completion_percentage, actual_start_date, actual_end_date, actual_hours, time_spent, log_owner_id, log_type, log_content, acceptance_status, quality_gate_status, tags, attr)
VALUES
  -- Fall 2025 Landscaping Campaign Task Records
  ((SELECT id FROM app.d_scope_task WHERE task_code = 'FALL-EQ-001'), 
   'Equipment Maintenance Completion Log', 'Final equipment maintenance completion record for fall 2025 landscaping campaign', 
   'completed', 'maintenance_complete', 100.0, '2025-08-15', '2025-08-29', 78.5, 78.5,
   (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
   'completion_report', 
   '{"equipment_serviced": 45, "issues_found": 3, "repairs_completed": 3, "safety_checks": "passed", "certifications": ["WSIB_compliant", "manufacturer_approved"], "next_service_date": "2026-03-15"}'::jsonb,
   'approved', 'passed',
   '["equipment", "maintenance", "completed", "approved"]',
   '{"maintenance_checklist": "completed", "service_technician": "Mike Rodriguez", "supervisor_approval": "James Miller", "warranty_updates": "recorded"}'),

  ((SELECT id FROM app.d_scope_task WHERE task_code = 'FALL-TR-002'),
   'Seasonal Staff Training Progress - Week 2', 'Training progress report for seasonal landscaping staff - safety and equipment modules completed',
   'in_progress', 'training_delivery', 75.0, '2025-08-20', null, 45.0, 45.0,
   (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
   'progress_update',
   '{"trainees_enrolled": 45, "modules_completed": ["safety_protocols", "equipment_operation"], "modules_remaining": ["customer_service", "quality_standards"], "certification_rate": "100%", "feedback_score": 4.7}'::jsonb,
   'in_review', 'in_progress',
   '["training", "seasonal", "in_progress", "safety"]',
   '{"training_location": "mississauga_headquarters", "instructor": "Safety Training Corp", "next_session": "2025-08-27", "certification_deadline": "2025-09-05"}'),

  ((SELECT id FROM app.d_scope_task WHERE task_code = 'FALL-SCH-003'),
   'Route Optimization Analysis Complete', 'Completed route optimization analysis for 850 clients across three service areas',
   'completed', 'optimization_complete', 100.0, '2025-09-01', '2025-09-12', 38.0, 38.0,
   (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
   'analysis_report',
   '{"clients_analyzed": 850, "routes_created": 15, "efficiency_improvement": "23%", "fuel_savings": "$12,400", "service_areas": ["mississauga", "toronto", "london"], "gps_integration": "completed"}'::jsonb,
   'approved', 'passed',
   '["scheduling", "routing", "completed", "optimized"]',
   '{"optimization_software": "RouteXpert Pro", "analyst": "Operations Team", "implementation_date": "2025-09-15", "driver_training_required": true}'),

  -- Winter 2025 Snow Removal Task Records
  ((SELECT id FROM app.d_scope_task WHERE task_code = 'WIN-FL-001'),
   'Snow Plow Fleet Preparation - Phase 1', 'Initial fleet preparation phase covering vehicle maintenance and plow attachment installation',
   'in_progress', 'vehicle_maintenance', 60.0, '2025-10-15', null, 96.0, 96.0,
   (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
   'progress_update',
   '{"vehicles_serviced": 9, "vehicles_remaining": 6, "plow_attachments_installed": 9, "salt_spreader_tests": "passed", "backup_equipment_ready": 3, "inspection_status": "ongoing"}'::jsonb,
   'in_review', 'in_progress',
   '["fleet", "maintenance", "snow_removal", "in_progress"]',
   '{"service_location": "equipment_yard_mississauga", "lead_mechanic": "Tony Silva", "estimated_completion": "2025-11-05", "critical_path": "hydraulic_system_upgrades"}'),

  ((SELECT id FROM app.d_scope_task WHERE task_code = 'WIN-SALT-002'),
   'Salt Supply Contracts Finalized', 'Completed salt supply procurement with locked-in pricing for winter 2025-2026 season',
   'completed', 'procurement_complete', 100.0, '2025-09-01', '2025-10-15', 52.0, 52.0,
   (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
   'procurement_report',
   '{"salt_tons_contracted": 200, "suppliers": ["Canadian Salt Company", "Windsor Salt"], "storage_locations": ["mississauga_yard", "toronto_depot", "london_warehouse"], "price_per_ton": "$89.50", "delivery_schedule": "weekly_shipments"}'::jsonb,
   'approved', 'passed',
   '["procurement", "salt", "contracts", "completed"]',
   '{"contract_manager": "Procurement Team", "budget_under": "$3,200", "quality_specifications": "road_salt_grade_1", "delivery_guarantee": "24_hours"}'),

  -- Water Heater Replacement Task Records  
  ((SELECT id FROM app.d_scope_task WHERE task_code = 'WHR-SUP-001'),
   'Manufacturer Partnership Agreements', 'Established partnerships with three major water heater manufacturers with volume discounting',
   'completed', 'partnerships_established', 100.0, '2025-01-01', '2025-01-25', 35.0, 35.0,
   (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
   'partnership_report',
   '{"partners": ["AO Smith Canada", "Bradford White", "Rheem Canada"], "volume_discount": "15-22%", "inventory_commitment": 50, "warranty_terms": "enhanced_10_year", "energy_rebate_support": "included"}'::jsonb,
   'approved', 'passed',
   '["suppliers", "partnerships", "water_heaters", "completed"]',
   '{"negotiation_lead": "Procurement Manager", "legal_review": "completed", "first_delivery": "2025-02-01", "payment_terms": "net_30"}'),

  ((SELECT id FROM app.d_scope_task WHERE task_code = 'WHR-ASSESS-002'),
   'Customer Assessment Process Development', 'Developed comprehensive customer assessment workflow for water heater replacement needs',
   'completed', 'process_documented', 100.0, '2025-02-01', '2025-02-22', 58.0, 58.0,
   (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
   'process_documentation',
   '{"assessment_criteria": ["current_age", "efficiency_rating", "capacity_needs", "installation_complexity"], "digital_forms": "created", "scheduling_integration": "automated", "customer_communication": "email_sms_templates"}'::jsonb,
   'approved', 'passed',
   '["process", "customer_assessment", "workflow", "completed"]',
   '{"process_designer": "Operations Team", "quality_review": "passed", "pilot_testing": "scheduled_march_2025", "training_materials": "created"}'),

  -- Emergency Plumbing Enhancement Task Records
  ((SELECT id FROM app.d_scope_task WHERE task_code = 'EMER-GPS-001'),
   'GPS Dispatch System Implementation', 'Successfully implemented real-time GPS dispatch system for emergency plumbing response optimization',
   'completed', 'system_deployed', 100.0, '2025-01-01', '2025-02-15', 72.0, 72.0,
   (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
   'implementation_report',
   '{"system_provider": "FleetTrack Solutions", "technician_devices": 15, "response_optimization": "30%_improvement", "real_time_tracking": "active", "integration_status": "complete", "training_completion": "100%"}'::jsonb,
   'approved', 'passed',
   '["gps", "dispatch", "technology", "implemented"]',
   '{"project_manager": "IT Operations", "go_live_date": "2025-02-15", "user_feedback": "excellent", "roi_projection": "18_months"}'),

  ((SELECT id FROM app.d_scope_task WHERE task_code = 'EMER-CONT-002'),
   'Contractor Network Expansion - Phase 1', 'Added 3 new emergency plumbing contractors to London region network with full qualification verification',
   'in_progress', 'contractor_onboarding', 60.0, '2025-02-01', null, 36.0, 36.0,
   (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
   'expansion_progress',
   '{"contractors_added": 3, "contractors_pending": 2, "qualification_verified": ["licensed", "insured", "emergency_certified"], "coverage_areas": ["london_central", "london_east", "london_west"], "response_testing": "in_progress"}'::jsonb,
   'in_review', 'in_progress',
   '["contractors", "network", "expansion", "london"]',
   '{"onboarding_manager": "Partner Relations", "target_completion": "2025-04-15", "performance_metrics": "defined", "customer_feedback": "tracking_setup"}')
ON CONFLICT DO NOTHING;
