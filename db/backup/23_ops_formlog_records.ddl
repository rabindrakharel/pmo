-- ============================================================================
-- FORM LOG RECORDS (FORM SUBMISSIONS)
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Form submission records containing actual data submitted through the
--   dynamic forms system. Each record represents a single form submission
--   linked to its corresponding form definition (ops_formlog_head).
--   Supports audit trails, data analytics, and workflow automation.
--
-- Record Types:
--   - Client Feedback: Customer satisfaction and service feedback submissions
--   - Service Reports: Technical service completion and progress reports
--   - Safety Reports: Incident reports and safety compliance submissions
--   - HR Records: Performance reviews and employee-related form submissions
--   - Maintenance Requests: Equipment and facility maintenance requests
--   - Public Inquiries: Service inquiries and lead generation submissions
--
-- Integration:
--   - Links to ops_formlog_head for form schema and validation
--   - Supports JSON data storage with flexible schema validation
--   - Enables workflow automation and business process integration
--   - Provides audit trail and data analytics capabilities

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.ops_formlog_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference to form definition
  head_id uuid NOT NULL REFERENCES app.ops_formlog_head(id) ON DELETE CASCADE,

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

  -- Form submission data
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Submission metadata
  submitted_by_employee_id uuid REFERENCES app.d_employee(id),
  submitted_by_external text,
  submission_source text DEFAULT 'web',
  ip_address inet,
  user_agent text,
  
  -- Workflow and processing
  status text DEFAULT 'submitted',
  assigned_to_employee_id uuid REFERENCES app.d_employee(id),
  processed_by_employee_id uuid REFERENCES app.d_employee(id),
  processed_date timestamptz,
  
  -- Data quality and validation
  validation_status text DEFAULT 'pending',
  validation_errors jsonb DEFAULT '[]'::jsonb,
  data_quality_score numeric(3,2),
  
  -- Integration and automation
  workflow_stage text DEFAULT 'initial',
  integration_status jsonb DEFAULT '{}'::jsonb,
  notification_status jsonb DEFAULT '{}'::jsonb,
  
  -- Archival and compliance
  archived boolean DEFAULT false,
  archived_date timestamptz,
  retention_date timestamptz,
  
  -- Constraints
  CONSTRAINT valid_temporal_range CHECK (to_ts IS NULL OR to_ts > from_ts),
  CONSTRAINT valid_quality_score CHECK (data_quality_score IS NULL OR (data_quality_score >= 0 AND data_quality_score <= 5))
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Huron Home Services Form Submission Records

-- Client Feedback Submissions - Fall Landscaping Campaign
WITH form_heads AS (
  SELECT 
    (SELECT id FROM app.ops_formlog_head WHERE form_code = 'FORM-FALL-CLIENT-FB') AS fall_feedback_form_id,
    (SELECT id FROM app.ops_formlog_head WHERE form_code = 'FORM-HVAC-MAINT-RPT') AS hvac_report_form_id,
    (SELECT id FROM app.ops_formlog_head WHERE form_code = 'FORM-SOLAR-PROG') AS solar_progress_form_id
),
employees AS (
  SELECT 
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-014') AS carlos_santos_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-012') AS kevin_obrien_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-006') AS jennifer_walsh_id
)

INSERT INTO app.ops_formlog_records (
  head_id, name, "descr", data, submitted_by_external, submission_source,
  status, assigned_to_employee_id, validation_status, data_quality_score,
  workflow_stage, tags, attr
)
SELECT 
  form_heads.fall_feedback_form_id,
  'Thompson Residence - Fall Cleanup Feedback',
  'Client feedback for fall cleanup service at premium residential property',
  '{
    "client_name": "Robert Thompson",
    "service_address": "1847 Sheridan Park Dr, Oakville, ON L6H 7S3",
    "service_date": "2025-10-16",
    "overall_satisfaction": 5,
    "quality_rating": 5,
    "timeliness_rating": 4,
    "crew_professionalism": 5,
    "cleanup_rating": 5,
    "comments": "Exceptional work! The crew was professional, efficient, and left our property immaculate. Very pleased with the attention to detail in preparing our gardens for winter.",
    "recommend_service": true,
    "future_services": ["Spring Cleanup", "Garden Design", "Maintenance Contract"]
  }'::jsonb,
  'robert.thompson@email.com',
  'web',
  'completed',
  employees.jennifer_walsh_id,
  'validated',
  4.8,
  'completed',
  '["client_feedback", "premium", "excellent_rating"]'::jsonb,
  '{"follow_up_required": false, "referral_potential": "high", "upsell_opportunity": true}'::jsonb
FROM form_heads, employees

UNION ALL

SELECT 
  form_heads.fall_feedback_form_id,
  'Miller Properties - Fall Service Feedback',
  'Multi-property client feedback for comprehensive fall landscaping services',
  '{
    "client_name": "Sarah Miller",
    "service_address": "2450 Lakeshore Blvd W, Mississauga, ON L5J 1K5",
    "service_date": "2025-11-05",
    "overall_satisfaction": 4,
    "quality_rating": 4,
    "timeliness_rating": 5,
    "crew_professionalism": 4,
    "cleanup_rating": 4,
    "comments": "Good work overall. Crew was punctual and completed work efficiently. Minor issue with some plant protection installation but was quickly resolved when brought to attention.",
    "recommend_service": true,
    "future_services": ["Maintenance Contract", "Snow Removal", "Spring Cleanup"]
  }'::jsonb,
  'sarah.miller@email.com',
  'web',
  'completed',
  employees.jennifer_walsh_id,
  'validated',
  4.2,
  'completed',
  '["client_feedback", "multi_property", "good_rating"]'::jsonb,
  '{"follow_up_required": false, "contract_renewal": true, "quality_improvement_note": "plant protection training"}'::jsonb
FROM form_heads, employees

UNION ALL

SELECT 
  form_heads.fall_feedback_form_id,
  'Square One Plaza - Commercial Feedback',
  'High-visibility commercial client feedback for fall landscaping services',
  '{
    "client_name": "Jennifer Walsh",
    "service_address": "100 City Centre Dr, Mississauga, ON L5B 2C9",
    "service_date": "2025-10-25",
    "overall_satisfaction": 3,
    "quality_rating": 4,
    "timeliness_rating": 2,
    "crew_professionalism": 4,
    "cleanup_rating": 3,
    "comments": "Quality of landscaping work was good, but there were delays due to coordination issues with mall security and timing conflicts with customer peak hours. Need better planning for high-traffic commercial properties.",
    "recommend_service": true,
    "future_services": ["Maintenance Contract", "Snow Removal"]
  }'::jsonb,
  'jennifer.walsh@squareone.com',
  'web',
  'under_review',
  employees.jennifer_walsh_id,
  'validated',
  3.2,
  'process_improvement',
  '["client_feedback", "commercial", "improvement_needed"]'::jsonb,
  '{"follow_up_required": true, "process_improvement": "commercial scheduling", "account_risk": "low"}'::jsonb
FROM form_heads, employees;

-- HVAC Service Reports
INSERT INTO app.ops_formlog_records (
  head_id, name, "descr", data, submitted_by_employee_id, submission_source,
  status, assigned_to_employee_id, validation_status, data_quality_score,
  workflow_stage, tags, attr
)
SELECT 
  form_heads.hvac_report_form_id,
  'Toronto Tower - Quarterly HVAC Inspection Report',
  'Comprehensive quarterly HVAC system inspection for 45-story office tower',
  '{
    "technician_id": "EMP-012",
    "client_property": "Toronto Premium Office Tower - 200 Bay St",
    "service_date": "2025-02-12T14:30:00",
    "system_type": "Commercial RTU",
    "maintenance_type": ["Filter Replacement", "Coil Cleaning", "Refrigerant Check", "Electrical Inspection", "Calibration"],
    "parts_used": "HVAC filters (24 units - HEPA grade), Coil cleaning solution (2 gallons), Refrigerant R-410A (3 lbs)",
    "labor_hours": 8.5,
    "system_condition": 4,
    "client_signature": "data:image/png;base64,iVBORw0KGgoAAAANSUhEU...",
    "follow_up_required": true,
    "follow_up_notes": "Zone 12A showing slightly elevated temperature variance. Recommend monitoring and potential damper adjustment within 30 days."
  }'::jsonb,
  employees.kevin_obrien_id,
  'mobile_app',
  'completed',
  employees.kevin_obrien_id,
  'validated',
  4.6,
  'invoicing',
  '["service_report", "hvac", "commercial", "quarterly"]'::jsonb,
  '{"invoice_generated": true, "follow_up_scheduled": "2025-03-15", "client_satisfaction": "high", "system_performance": "good"}'::jsonb
FROM form_heads, employees

UNION ALL

SELECT 
  form_heads.hvac_report_form_id,
  'CAM Portfolio - Emergency HVAC Response',
  'Emergency HVAC repair response for commercial asset management portfolio',
  '{
    "technician_id": "EMP-007",
    "client_property": "CAM Assets - 5000 Yonge St Office Complex",
    "service_date": "2025-01-23T09:15:00",
    "system_type": "Heat Pump",
    "maintenance_type": ["Emergency Repair"],
    "parts_used": "Heat pump compressor relay (1 unit), Electrical contactor (1 unit), Refrigerant leak seal (1 tube)",
    "labor_hours": 4.75,
    "system_condition": 3,
    "client_signature": "data:image/png;base64,iVBORw0KGgoAAAANSUhEU...",
    "follow_up_required": true,
    "follow_up_notes": "Temporary repair completed. Full compressor replacement recommended within 60 days. System operational but monitoring required."
  }'::jsonb,
  (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-007'),
  'mobile_app',
  'completed',
  employees.kevin_obrien_id,
  'validated',
  4.1,
  'follow_up_scheduled',
  '["service_report", "hvac", "emergency", "commercial"]'::jsonb,
  '{"emergency_response": true, "response_time_hours": 3.5, "temporary_fix": true, "replacement_quote_required": true}'::jsonb
FROM form_heads, employees;

-- Solar Installation Progress Reports
INSERT INTO app.ops_formlog_records (
  head_id, name, "descr", data, submitted_by_employee_id, submission_source,
  status, processed_by_employee_id, validation_status, data_quality_score,
  workflow_stage, tags, attr
)
SELECT 
  form_heads.solar_progress_form_id,
  'Thompson Solar - Day 3 Progress Report',
  'Solar panel installation progress report for Thompson residence premium system',
  '{
    "installation_date": "2025-05-18",
    "lead_installer": "EMP-012",
    "crew_size": 4,
    "installation_phase": "Panel Mounting",
    "completion_percentage": 65,
    "panels_installed": 8,
    "weather_conditions": "Clear",
    "safety_incidents": false,
    "incident_details": "",
    "client_interaction": "Client very pleased with progress. Requested minor adjustment to panel positioning for aesthetic reasons - accommodated without delay.",
    "tomorrow_plan": "Complete panel mounting (remaining 12 panels), begin DC wiring connections, install micro-inverters on completed panels."
  }'::jsonb,
  employees.kevin_obrien_id,
  'mobile_app',
  'completed',
  (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-007'),
  'validated',
  4.8,
  'project_tracking',
  '["progress_report", "solar", "installation", "on_schedule"]'::jsonb,
  '{"project_health": "green", "client_satisfaction": "high", "weather_favorable": true, "ahead_of_schedule": false}'::jsonb
FROM form_heads, employees

UNION ALL

SELECT 
  form_heads.solar_progress_form_id,
  'Chen Estate Solar - Day 7 Progress Report',
  'Solar installation progress for luxury residential estate with complex roof design',
  '{
    "installation_date": "2025-06-15",
    "lead_installer": "EMP-012",
    "crew_size": 6,
    "installation_phase": "System Testing",
    "completion_percentage": 95,
    "panels_installed": 0,
    "weather_conditions": "Partly Cloudy",
    "safety_incidents": false,
    "incident_details": "",
    "client_interaction": "Client requested walkthrough of system monitoring capabilities. Provided comprehensive training on mobile app and web portal. Very satisfied with system performance metrics.",
    "tomorrow_plan": "Final inspection preparation, documentation completion, utility interconnection paperwork, client final walkthrough and system handover."
  }'::jsonb,
  employees.kevin_obrien_id,
  'mobile_app',
  'completed',
  (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-007'),
  'validated',
  4.9,
  'final_inspection',
  '["progress_report", "solar", "installation", "near_completion"]'::jsonb,
  '{"project_health": "green", "client_satisfaction": "excellent", "inspection_ready": true, "system_performance": "optimal"}'::jsonb
FROM form_heads, employees;

-- Safety and Operational Reports
WITH safety_forms AS (
  SELECT 
    (SELECT id FROM app.ops_formlog_head WHERE form_code = 'FORM-SAFETY-INCIDENT') AS safety_incident_form_id,
    (SELECT id FROM app.ops_formlog_head WHERE form_code = 'FORM-EQUIP-MAINT') AS equipment_maint_form_id,
    (SELECT id FROM app.ops_formlog_head WHERE form_code = 'FORM-DAILY-SAFETY') AS daily_safety_form_id
),
field_staff AS (
  SELECT 
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-016') AS mike_wilson_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-018') AS john_macdonald_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-011') AS tom_richardson_id
)

INSERT INTO app.ops_formlog_records (
  head_id, name, "descr", data, submitted_by_employee_id, submission_source,
  status, assigned_to_employee_id, validation_status, data_quality_score,
  workflow_stage, tags, attr
)
SELECT 
  safety_forms.safety_incident_form_id,
  'Equipment Storage - Minor Safety Incident',
  'Near miss incident report from Meadowvale equipment storage facility',
  '{
    "incident_date": "2025-01-15T10:30:00",
    "location_type": "Storage Facility",
    "location_details": "Equipment Storage - Meadowvale, Bay 3",
    "incident_type": "Near Miss",
    "severity": "Low",
    "injured_person": "",
    "witness_names": "Carlos Santos, Patricia Lee",
    "incident_description": "While moving lawn mower from storage, unit almost tipped due to uneven floor surface and loose equipment tie-down. No injury occurred but could have caused equipment damage and potential injury.",
    "immediate_actions": "Secured equipment properly, identified uneven floor area with cones, reported to maintenance for floor leveling.",
    "preventive_measures": "Recommend floor leveling in Bay 3, review equipment tie-down procedures, consider equipment dollies for heavy units.",
    "reporter_name": "Mike Wilson",
    "anonymous_report": false
  }'::jsonb,
  field_staff.mike_wilson_id,
  'web',
  'under_investigation',
  field_staff.tom_richardson_id,
  'validated',
  4.5,
  'corrective_action',
  '["safety", "incident", "near_miss", "equipment"]'::jsonb,
  '{"investigation_required": true, "facility_improvement": true, "training_update": false, "priority": "medium"}'::jsonb
FROM safety_forms, field_staff

UNION ALL

SELECT 
  safety_forms.equipment_maint_form_id,
  'Mower #M-007 - Maintenance Request',
  'Routine maintenance request for commercial zero-turn mower showing performance issues',
  '{
    "equipment_id": "M-007",
    "equipment_type": "Mower",
    "issue_type": "Performance Issue",
    "urgency": "Medium",
    "problem_description": "Zero-turn mower experiencing intermittent engine hesitation under load, reduced cutting quality, and increased fuel consumption. Noticed over past week of operation.",
    "last_maintenance": "2024-12-15",
    "requested_by": "Carlos Santos",
    "preferred_date": "2025-02-01"
  }'::jsonb,
  employees.carlos_santos_id,
  'web',
  'approved',
  field_staff.john_macdonald_id,
  'validated',
  4.3,
  'scheduled',
  '["equipment", "maintenance", "mower", "performance"]'::jsonb,
  '{"maintenance_scheduled": "2025-01-30", "parts_ordered": true, "estimated_hours": 4, "rental_equipment": false}'::jsonb
FROM safety_forms, field_staff

UNION ALL

SELECT 
  safety_forms.daily_safety_form_id,
  'HQ Daily Safety - January 20, 2025',
  'Daily safety inspection checklist for headquarters facility',
  '{
    "inspector_name": "Tom Richardson",
    "inspection_date": "2025-01-20",
    "emergency_exits": true,
    "fire_extinguishers": true,
    "first_aid_kits": true,
    "walkways_clear": true,
    "spill_cleanup": true,
    "equipment_stored": true,
    "ppe_available": true,
    "safety_issues": "",
    "corrective_actions": "",
    "overall_status": "Satisfactory"
  }'::jsonb,
  field_staff.tom_richardson_id,
  'web',
  'completed',
  field_staff.tom_richardson_id,
  'validated',
  5.0,
  'archived',
  '["safety", "daily", "checklist", "satisfactory"]'::jsonb,
  '{"compliance_status": "full", "follow_up_required": false, "streak_days": 45, "perfect_score": true}'::jsonb
FROM safety_forms, field_staff;

-- Public Service Inquiries
WITH public_form AS (
  SELECT 
    (SELECT id FROM app.ops_formlog_head WHERE form_code = 'FORM-SERVICE-INQ') AS service_inquiry_form_id
)

INSERT INTO app.ops_formlog_records (
  head_id, name, "descr", data, submitted_by_external, submission_source,
  status, assigned_to_employee_id, validation_status, data_quality_score,
  workflow_stage, tags, attr
)
SELECT 
  public_form.service_inquiry_form_id,
  'Service Inquiry - Hamilton Residential',
  'New client inquiry for comprehensive landscaping services in Hamilton expansion area',
  '{
    "contact_name": "Michael Chen",
    "email": "michael.chen@email.com",
    "phone": "905-555-0156",
    "property_address": "234 Main St E, Hamilton, ON L8N 1H4",
    "service_interest": ["Landscaping Design", "Landscape Maintenance", "Snow Removal"],
    "property_type": "Residential",
    "urgency": "Within 1 month",
    "project_description": "New home purchase, need complete landscape design for front and back yards. Property has mature trees but needs garden beds, walkways, and ongoing maintenance plan. Also interested in snow removal service for upcoming winter.",
    "budget_range": "$15,000 - $50,000",
    "preferred_contact": "Phone",
    "marketing_consent": true
  }'::jsonb,
  'michael.chen@email.com',
  'web',
  'qualified_lead',
  (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-008'),
  'validated',
  4.7,
  'sales_follow_up',
  '["public_inquiry", "qualified_lead", "hamilton", "multi_service"]'::jsonb,
  '{"lead_score": 85, "market_expansion": true, "follow_up_priority": "high", "estimated_value": 35000}'::jsonb
FROM public_form

UNION ALL

SELECT 
  public_form.service_inquiry_form_id,
  'Service Inquiry - Commercial HVAC',
  'Commercial client inquiry for ongoing HVAC maintenance contract',
  '{
    "contact_name": "Janet Morrison",
    "email": "janet.morrison@yorkofficepark.com",
    "phone": "416-555-0198",
    "property_address": "1500 York Mills Rd, North York, ON M3A 3S1",
    "service_interest": ["HVAC Services"],
    "property_type": "Commercial",
    "urgency": "Within 2 weeks",
    "project_description": "50,000 sq ft office building needs reliable HVAC maintenance contractor. Current provider not meeting service levels. Need preventive maintenance program and emergency response capability.",
    "budget_range": "Over $50,000",
    "preferred_contact": "Email",
    "marketing_consent": false
  }'::jsonb,
  'janet.morrison@yorkofficepark.com',
  'web',
  'qualified_lead',
  (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-007'),
  'validated',
  4.8,
  'technical_consultation',
  '["public_inquiry", "qualified_lead", "commercial", "hvac", "high_value"]'::jsonb,
  '{"lead_score": 92, "contract_opportunity": true, "technical_consultation_required": true, "estimated_annual_value": 75000}'::jsonb
FROM public_form;

-- Indexes removed for simplified import