-- ============================================================================
-- FORM LOG HEAD (FORM DEFINITIONS)
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Dynamic form definition engine supporting configurable form schemas
--   with multi-scope targeting (project, task, location, business, HR, worksite).
--   Provides foundation for data collection, feedback systems, reporting forms,
--   and workflow automation across all organizational dimensions.
--
-- Form Categories:
--   - Project Forms: Project-specific data collection and reporting
--   - Task Forms: Task-level updates, time tracking, and deliverables
--   - Location Forms: Geographic or facility-specific forms
--   - Business Forms: Organizational unit specific forms
--   - HR Forms: Human resources and employee-related forms
--   - Worksite Forms: Physical worksite and safety forms
--   - Global Forms: Organization-wide forms accessible via public links
--
-- Integration:
--   - Multi-scope targeting with permission-based access control
--   - Version-controlled form schemas with validation rules
--   - Tenant isolation and security compliance
--   - Integration with project, task, and operational workflows

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.ops_formlog_head (
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

  -- Form identification and versioning
  form_code text UNIQUE,
  form_global_link text UNIQUE,
  schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  
  -- Project scoping
  project_specific boolean NOT NULL DEFAULT false,
  project_id uuid REFERENCES app.d_scope_project(id),
  project_permission jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Task scoping
  task_specific boolean NOT NULL DEFAULT false,
  task_id uuid REFERENCES app.ops_task_head(id),
  task_permission jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Location scoping
  org_specific boolean NOT NULL DEFAULT false,
  org_id uuid REFERENCES app.d_scope_org(id),
  org_permission jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Business/Organizational scoping
  biz_specific boolean NOT NULL DEFAULT false,
  biz_id uuid REFERENCES app.d_scope_org(id),
  biz_permission jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- HR scoping
  hr_specific boolean NOT NULL DEFAULT false,
  hr_id uuid REFERENCES app.d_scope_hr(id),
  hr_permission jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Worksite scoping
  worksite_specific boolean NOT NULL DEFAULT false,
  worksite_id uuid REFERENCES app.d_scope_worksite(id),
  worksite_permission jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Form configuration and behavior
  is_public boolean DEFAULT false,
  requires_authentication boolean DEFAULT true,
  allow_anonymous boolean DEFAULT false,
  submission_limit int,
  expiry_date date,
  
  -- Workflow and automation
  auto_approve boolean DEFAULT false,
  notification_rules jsonb DEFAULT '[]'::jsonb,
  integration_webhooks jsonb DEFAULT '[]'::jsonb,
  
  -- Data governance
  data_retention_days int DEFAULT 2555, -- 7 years
  gdpr_compliant boolean DEFAULT true,
  encryption_required boolean DEFAULT false,
  
  -- Constraints
  CONSTRAINT unique_active_form_name UNIQUE (name, active),
  CONSTRAINT valid_schema_version CHECK (version > 0),
  CONSTRAINT valid_temporal_range CHECK (to_ts IS NULL OR to_ts > from_ts),
  CONSTRAINT valid_scoping CHECK (
    project_specific OR task_specific OR org_specific OR 
    biz_specific OR hr_specific OR worksite_specific OR 
    form_global_link IS NOT NULL
  )
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Huron Home Services Form Definitions

-- Project-Specific Forms
WITH projects AS (
  SELECT 
    (SELECT id FROM app.d_scope_project WHERE project_code = 'FALL-2025-LAND') AS fall_landscaping_id,
    (SELECT id FROM app.d_scope_project WHERE project_code = 'HVAC-2025-MAINT') AS hvac_maintenance_id,
    (SELECT id FROM app.d_scope_project WHERE project_code = 'SOL-2025-EXP') AS solar_expansion_id
)

INSERT INTO app.ops_formlog_head (
  name, "descr", form_code, form_global_link, schema, version,
  project_specific, project_id, project_permission,
  requires_authentication, submission_limit, notification_rules,
  tags, attr
)
SELECT 
  'Fall Landscaping Client Feedback',
  'Client satisfaction and feedback form for Fall 2025 landscaping campaign projects',
  'FORM-FALL-CLIENT-FB',
  'huron-forms/fall-2025-client-feedback',
  '{
    "title": "Fall Landscaping Service Feedback",
    "fields": [
      {"name": "client_name", "type": "text", "required": true, "label": "Client Name"},
      {"name": "service_address", "type": "text", "required": true, "label": "Service Address"},
      {"name": "service_date", "type": "date", "required": true, "label": "Service Date"},
      {"name": "overall_satisfaction", "type": "rating", "required": true, "label": "Overall Satisfaction", "scale": 5},
      {"name": "quality_rating", "type": "rating", "required": true, "label": "Work Quality", "scale": 5},
      {"name": "timeliness_rating", "type": "rating", "required": true, "label": "Timeliness", "scale": 5},
      {"name": "crew_professionalism", "type": "rating", "required": true, "label": "Crew Professionalism", "scale": 5},
      {"name": "cleanup_rating", "type": "rating", "required": true, "label": "Site Cleanup", "scale": 5},
      {"name": "comments", "type": "textarea", "required": false, "label": "Additional Comments"},
      {"name": "recommend_service", "type": "boolean", "required": true, "label": "Would you recommend our services?"},
      {"name": "future_services", "type": "multiselect", "required": false, "label": "Future Services of Interest", "options": ["Spring Cleanup", "Garden Design", "Maintenance Contract", "Snow Removal", "Irrigation"]}
    ],
    "validation": {
      "required_fields": ["client_name", "service_address", "service_date", "overall_satisfaction", "quality_rating", "timeliness_rating", "crew_professionalism", "cleanup_rating", "recommend_service"]
    }
  }'::jsonb,
  1,
  true,
  projects.fall_landscaping_id,
  '["client_feedback", "post_service"]'::jsonb,
  false,
  NULL,
  '{"email_notifications": ["project_manager", "client_success"], "trigger_threshold": 3}'::jsonb,
  '["client_feedback", "satisfaction", "fall_campaign"]'::jsonb,
  '{"auto_followup": true, "satisfaction_threshold": 4, "escalation_enabled": true}'::jsonb
FROM projects

UNION ALL

SELECT 
  'HVAC Maintenance Service Report',
  'Technical service report form for HVAC maintenance contract activities',
  'FORM-HVAC-MAINT-RPT',
  NULL,
  '{
    "title": "HVAC Maintenance Service Report",
    "fields": [
      {"name": "technician_id", "type": "select", "required": true, "label": "Technician"},
      {"name": "client_property", "type": "text", "required": true, "label": "Client Property"},
      {"name": "service_date", "type": "datetime", "required": true, "label": "Service Date & Time"},
      {"name": "system_type", "type": "select", "required": true, "label": "HVAC System Type", "options": ["Central Air", "Heat Pump", "Boiler", "Furnace", "Ductless Mini-Split", "Commercial RTU"]},
      {"name": "maintenance_type", "type": "multiselect", "required": true, "label": "Maintenance Performed", "options": ["Filter Replacement", "Coil Cleaning", "Refrigerant Check", "Electrical Inspection", "Calibration", "Belt Replacement", "Preventive Maintenance", "Emergency Repair"]},
      {"name": "parts_used", "type": "textarea", "required": false, "label": "Parts Used (List with quantities)"},
      {"name": "labor_hours", "type": "number", "required": true, "label": "Labor Hours", "min": 0, "step": 0.25},
      {"name": "system_condition", "type": "rating", "required": true, "label": "System Condition", "scale": 5},
      {"name": "client_signature", "type": "signature", "required": true, "label": "Client Signature"},
      {"name": "follow_up_required", "type": "boolean", "required": true, "label": "Follow-up Required?"},
      {"name": "follow_up_notes", "type": "textarea", "required": false, "label": "Follow-up Notes"}
    ]
  }'::jsonb,
  1,
  true,
  projects.hvac_maintenance_id,
  '["technician", "service_report"]'::jsonb,
  true,
  NULL,
  '{"email_notifications": ["project_manager", "client"], "sms_client": true}'::jsonb,
  '["service_report", "hvac", "maintenance"]'::jsonb,
  '{"invoice_integration": true, "parts_inventory_update": true, "scheduling_integration": true}'::jsonb
FROM projects

UNION ALL

SELECT 
  'Solar Installation Progress Report',
  'Progress tracking and milestone reporting form for solar panel installation projects',
  'FORM-SOLAR-PROG',
  NULL,
  '{
    "title": "Solar Installation Progress Report",
    "fields": [
      {"name": "installation_date", "type": "date", "required": true, "label": "Installation Date"},
      {"name": "lead_installer", "type": "select", "required": true, "label": "Lead Installer"},
      {"name": "crew_size", "type": "number", "required": true, "label": "Crew Size", "min": 1, "max": 8},
      {"name": "installation_phase", "type": "select", "required": true, "label": "Installation Phase", "options": ["Site Preparation", "Electrical Rough-In", "Racking Installation", "Panel Mounting", "DC Wiring", "Inverter Installation", "AC Connection", "System Testing", "Inspection Ready", "Final Commissioning"]},
      {"name": "completion_percentage", "type": "number", "required": true, "label": "Phase Completion %", "min": 0, "max": 100},
      {"name": "panels_installed", "type": "number", "required": true, "label": "Panels Installed Today", "min": 0},
      {"name": "weather_conditions", "type": "select", "required": true, "label": "Weather Conditions", "options": ["Clear", "Partly Cloudy", "Overcast", "Light Rain", "Heavy Rain", "Windy", "Snow"]},
      {"name": "safety_incidents", "type": "boolean", "required": true, "label": "Any Safety Incidents?"},
      {"name": "incident_details", "type": "textarea", "required": false, "label": "Incident Details"},
      {"name": "client_interaction", "type": "textarea", "required": false, "label": "Client Interaction Notes"},
      {"name": "tomorrow_plan", "type": "textarea", "required": true, "label": "Tomorrow''s Work Plan"}
    ]
  }'::jsonb,
  1,
  true,
  projects.solar_expansion_id,
  '["installer", "project_manager"]'::jsonb,
  true,
  1,
  '{"email_notifications": ["project_manager", "safety_coordinator"], "daily_digest": true}'::jsonb,
  '["progress_report", "solar", "installation"]'::jsonb,
  '{"safety_monitoring": true, "progress_tracking": true, "weather_integration": true}'::jsonb
FROM projects;

-- Business/Departmental Forms
WITH departments AS (
  SELECT 
    (SELECT id FROM app.d_scope_org WHERE name = 'Landscaping Department') AS landscaping_dept_id,
    (SELECT id FROM app.d_scope_org WHERE name = 'HVAC Services Department') AS hvac_dept_id,
    (SELECT id FROM app.d_scope_org WHERE name = 'Business Operations Division') AS biz_ops_id
)

INSERT INTO app.ops_formlog_head (
  name, "descr", form_code, schema, version,
  biz_specific, biz_id, biz_permission,
  requires_authentication, is_public, expiry_date,
  tags, attr
)
SELECT 
  'Employee Safety Incident Report',
  'Confidential safety incident reporting form for all business operations staff',
  'FORM-SAFETY-INCIDENT',
  '{
    "title": "Safety Incident Report - Confidential",
    "fields": [
      {"name": "incident_date", "type": "datetime", "required": true, "label": "Incident Date & Time"},
      {"name": "location_type", "type": "select", "required": true, "label": "Incident Location", "options": ["Client Property", "Company Vehicle", "Headquarters", "Storage Facility", "En Route", "Other"]},
      {"name": "location_details", "type": "text", "required": true, "label": "Specific Location"},
      {"name": "incident_type", "type": "select", "required": true, "label": "Incident Type", "options": ["Near Miss", "First Aid", "Medical Treatment", "Property Damage", "Environmental", "Vehicle Accident", "Equipment Failure"]},
      {"name": "severity", "type": "select", "required": true, "label": "Severity Level", "options": ["Low", "Medium", "High", "Critical"]},
      {"name": "injured_person", "type": "text", "required": false, "label": "Injured Person (if applicable)"},
      {"name": "witness_names", "type": "textarea", "required": false, "label": "Witness Names"},
      {"name": "incident_description", "type": "textarea", "required": true, "label": "Detailed Description"},
      {"name": "immediate_actions", "type": "textarea", "required": true, "label": "Immediate Actions Taken"},
      {"name": "preventive_measures", "type": "textarea", "required": false, "label": "Suggested Preventive Measures"},
      {"name": "reporter_name", "type": "text", "required": true, "label": "Reporter Name"},
      {"name": "anonymous_report", "type": "boolean", "required": false, "label": "Submit Anonymously?"}
    ]
  }'::jsonb,
  1,
  true,
  departments.biz_ops_id,
  '["employee", "safety_coordinator", "manager"]'::jsonb,
  true,
  false,
  NULL,
  '["safety", "incident", "confidential"]'::jsonb,
  '{"confidential": true, "priority_escalation": true, "investigation_workflow": true}'::jsonb
FROM departments

UNION ALL

SELECT 
  'Equipment Maintenance Request',
  'Equipment maintenance and repair request form for landscaping department',
  'FORM-EQUIP-MAINT',
  '{
    "title": "Equipment Maintenance Request",
    "fields": [
      {"name": "equipment_id", "type": "text", "required": true, "label": "Equipment ID/Serial Number"},
      {"name": "equipment_type", "type": "select", "required": true, "label": "Equipment Type", "options": ["Mower", "Blower", "Trimmer", "Chainsaw", "Truck", "Trailer", "Hand Tools", "Safety Equipment", "Other"]},
      {"name": "issue_type", "type": "select", "required": true, "label": "Issue Type", "options": ["Routine Maintenance", "Repair Needed", "Safety Concern", "Performance Issue", "Replacement Request"]},
      {"name": "urgency", "type": "select", "required": true, "label": "Urgency", "options": ["Low", "Medium", "High", "Emergency"]},
      {"name": "problem_description", "type": "textarea", "required": true, "label": "Problem Description"},
      {"name": "last_maintenance", "type": "date", "required": false, "label": "Last Maintenance Date"},
      {"name": "requested_by", "type": "text", "required": true, "label": "Requested By"},
      {"name": "preferred_date", "type": "date", "required": false, "label": "Preferred Service Date"}
    ]
  }'::jsonb,
  1,
  true,
  departments.landscaping_dept_id,
  '["crew_member", "supervisor", "maintenance"]'::jsonb,
  true,
  false,
  NULL,
  '["equipment", "maintenance", "request"]'::jsonb,
  '{"workflow_routing": true, "priority_scheduling": true, "parts_inventory_check": true}'::jsonb
FROM departments;

-- HR-Specific Forms
WITH hr_positions AS (
  SELECT 
    (SELECT id FROM app.d_scope_hr WHERE name = 'Chief Operating Officer') AS coo_position_id,
    (SELECT id FROM app.d_scope_hr WHERE name = 'Senior Director - Design & Planning') AS sr_director_id
)

INSERT INTO app.ops_formlog_head (
  name, "descr", form_code, form_global_link, schema, version,
  hr_specific, hr_id, hr_permission,
  requires_authentication, data_retention_days, gdpr_compliant,
  tags, attr
)
SELECT 
  'Employee Performance Review',
  'Quarterly performance review form for all staff levels with goal setting and development planning',
  'FORM-PERF-REVIEW',
  NULL,
  '{
    "title": "Quarterly Performance Review",
    "fields": [
      {"name": "employee_name", "type": "text", "required": true, "label": "Employee Name"},
      {"name": "position_title", "type": "text", "required": true, "label": "Position Title"},
      {"name": "review_period", "type": "text", "required": true, "label": "Review Period"},
      {"name": "reviewer_name", "type": "text", "required": true, "label": "Reviewer Name"},
      {"name": "job_knowledge", "type": "rating", "required": true, "label": "Job Knowledge", "scale": 5},
      {"name": "quality_of_work", "type": "rating", "required": true, "label": "Quality of Work", "scale": 5},
      {"name": "productivity", "type": "rating", "required": true, "label": "Productivity", "scale": 5},
      {"name": "teamwork", "type": "rating", "required": true, "label": "Teamwork & Collaboration", "scale": 5},
      {"name": "communication", "type": "rating", "required": true, "label": "Communication Skills", "scale": 5},
      {"name": "safety_compliance", "type": "rating", "required": true, "label": "Safety Compliance", "scale": 5},
      {"name": "accomplishments", "type": "textarea", "required": true, "label": "Key Accomplishments"},
      {"name": "areas_improvement", "type": "textarea", "required": true, "label": "Areas for Improvement"},
      {"name": "development_goals", "type": "textarea", "required": true, "label": "Development Goals"},
      {"name": "training_needs", "type": "textarea", "required": false, "label": "Training Needs"},
      {"name": "overall_rating", "type": "select", "required": true, "label": "Overall Rating", "options": ["Exceeds Expectations", "Meets Expectations", "Below Expectations", "Needs Improvement"]},
      {"name": "employee_comments", "type": "textarea", "required": false, "label": "Employee Comments"}
    ]
  }'::jsonb,
  1,
  true,
  hr_positions.sr_director_id,
  '["manager", "hr", "employee"]'::jsonb,
  true,
  2555, -- 7 years retention
  true,
  '["hr", "performance", "review", "confidential"]'::jsonb,
  '{"confidential": true, "development_tracking": true, "goal_integration": true}'::jsonb
FROM hr_positions;

-- Worksite-Specific Forms
WITH worksites AS (
  SELECT 
    (SELECT id FROM app.d_scope_worksite WHERE name = 'Huron Home Services HQ') AS headquarters_id,
    (SELECT id FROM app.d_scope_worksite WHERE name = 'Winter Ops - Equipment Staging') AS winter_staging_id
)

INSERT INTO app.ops_formlog_head (
  name, "descr", form_code, form_global_link, schema, version,
  worksite_specific, worksite_id, worksite_permission,
  requires_authentication, is_public, submission_limit,
  tags, attr
)
SELECT 
  'Daily Safety Checklist',
  'Daily safety inspection and compliance checklist for headquarters facility',
  'FORM-DAILY-SAFETY',
  NULL,
  '{
    "title": "Daily Safety Checklist - HQ",
    "fields": [
      {"name": "inspector_name", "type": "text", "required": true, "label": "Inspector Name"},
      {"name": "inspection_date", "type": "date", "required": true, "label": "Inspection Date"},
      {"name": "emergency_exits", "type": "boolean", "required": true, "label": "Emergency exits clear and accessible"},
      {"name": "fire_extinguishers", "type": "boolean", "required": true, "label": "Fire extinguishers accessible and charged"},
      {"name": "first_aid_kits", "type": "boolean", "required": true, "label": "First aid kits stocked and accessible"},
      {"name": "walkways_clear", "type": "boolean", "required": true, "label": "Walkways and aisles clear"},
      {"name": "spill_cleanup", "type": "boolean", "required": true, "label": "All spills cleaned up"},
      {"name": "equipment_stored", "type": "boolean", "required": true, "label": "Equipment properly stored"},
      {"name": "ppe_available", "type": "boolean", "required": true, "label": "PPE available and in good condition"},
      {"name": "safety_issues", "type": "textarea", "required": false, "label": "Safety Issues Identified"},
      {"name": "corrective_actions", "type": "textarea", "required": false, "label": "Corrective Actions Taken"},
      {"name": "overall_status", "type": "select", "required": true, "label": "Overall Safety Status", "options": ["Satisfactory", "Needs Attention", "Unsafe Conditions"]}
    ]
  }'::jsonb,
  1,
  true,
  worksites.headquarters_id,
  '["safety_coordinator", "supervisor", "employee"]'::jsonb,
  true,
  false,
  1,
  '["safety", "daily", "checklist", "compliance"]'::jsonb,
  '{"daily_requirement": true, "escalation_enabled": true, "compliance_tracking": true}'::jsonb
FROM worksites;

-- Global/Public Forms  
INSERT INTO app.ops_formlog_head (
  name, "descr", form_code, form_global_link, schema, version,
  is_public, requires_authentication, allow_anonymous, submission_limit,
  tags, attr
) VALUES
('General Service Inquiry', 'Public inquiry form for potential clients to request service information and quotes', 'FORM-SERVICE-INQ', 'huron-forms/service-inquiry', 
'{
  "title": "Service Inquiry - Huron Home Services",
  "fields": [
    {"name": "contact_name", "type": "text", "required": true, "label": "Your Name"},
    {"name": "email", "type": "email", "required": true, "label": "Email Address"},
    {"name": "phone", "type": "tel", "required": true, "label": "Phone Number"},
    {"name": "property_address", "type": "text", "required": true, "label": "Property Address"},
    {"name": "service_interest", "type": "multiselect", "required": true, "label": "Services of Interest", "options": ["Landscaping Design", "Landscape Maintenance", "Snow Removal", "HVAC Services", "Plumbing Services", "Solar Installation", "Seasonal Cleanup"]},
    {"name": "property_type", "type": "select", "required": true, "label": "Property Type", "options": ["Residential", "Commercial", "Municipal", "Industrial"]},
    {"name": "urgency", "type": "select", "required": true, "label": "Timeline", "options": ["Immediate", "Within 2 weeks", "Within 1 month", "Within 3 months", "Planning for next season"]},
    {"name": "project_description", "type": "textarea", "required": true, "label": "Project Description"},
    {"name": "budget_range", "type": "select", "required": false, "label": "Budget Range", "options": ["Under $1,000", "$1,000 - $5,000", "$5,000 - $15,000", "$15,000 - $50,000", "Over $50,000", "Prefer not to specify"]},
    {"name": "preferred_contact", "type": "select", "required": true, "label": "Preferred Contact Method", "options": ["Phone", "Email", "Text Message"]},
    {"name": "marketing_consent", "type": "boolean", "required": false, "label": "I consent to receive marketing communications"}
  ]
}'::jsonb, 1, true, false, true, NULL, 
'["public", "inquiry", "lead-generation"]', 
'{"lead_scoring": true, "auto_response": true, "crm_integration": true, "follow_up_workflow": true}');

-- Indexes removed for simplified import