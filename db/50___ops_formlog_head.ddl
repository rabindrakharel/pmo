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
-- Data Validation Rules (Previously Enforced via CHECK Constraints):
--   - Schema Version Rule: version field must be greater than 0
--   - Temporal Range Rule: If to_ts is specified, it must be greater than from_ts
--   - Scoping Rule: At least one scoping method must be specified (project_specific, 
--     biz_specific, hr_specific, worksite_specific, or form_global_link)
--   - Business Logic: These validations should be enforced at the application layer
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
  form_code text,
  form_global_link text,
  schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  
  -- Project scoping
  project_specific boolean NOT NULL DEFAULT false,
  project_id uuid REFERENCES app.d_project(id),
  project_permission jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  
  -- Business scoping  
  biz_specific boolean NOT NULL DEFAULT false,
  biz_id uuid REFERENCES app.d_biz(id),
  biz_permission jsonb NOT NULL DEFAULT '[]'::jsonb,
  
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
  
  -- HR scoping
  hr_specific boolean NOT NULL DEFAULT false,
  hr_id uuid REFERENCES app.d_hr(id),
  hr_permission jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Worksite scoping
  worksite_specific boolean NOT NULL DEFAULT false,
  worksite_id uuid REFERENCES app.d_worksite(id),
  worksite_permission jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Form builder state persistence
  form_builder_state jsonb DEFAULT '{}'::jsonb,
  is_draft boolean DEFAULT false,
  draft_saved_at timestamptz,
  edit_lock_id uuid,
  edit_lock_user_id uuid REFERENCES app.d_employee(id),
  edit_lock_expires_at timestamptz,
  
  -- Multi-step form configuration
  is_multi_step boolean DEFAULT false,
  total_steps integer DEFAULT 1,
  step_configuration jsonb DEFAULT '[]'::jsonb,
  
  -- Form element sequence and validation
  field_sequence jsonb DEFAULT '[]'::jsonb,
  validation_rules jsonb DEFAULT '{}'::jsonb,
  field_dependencies jsonb DEFAULT '{}'::jsonb,
  
  -- Form state tracking
  form_version_hash text,
  last_modified_by uuid REFERENCES app.d_employee(id),
  modification_reason text

);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Huron Home Services Form Definitions

-- Project-Specific Forms
WITH projects AS (
  SELECT 
    (SELECT id FROM app.d_project WHERE project_code = 'FALL-2025-LAND') AS fall_landscaping_id,
    (SELECT id FROM app.d_project WHERE project_code = 'HVAC-2025-MAINT') AS hvac_maintenance_id,
    (SELECT id FROM app.d_project WHERE project_code = 'SOL-2025-EXP') AS solar_expansion_id
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
  NULL::integer,
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
  NULL::integer,
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
  NULL::integer,
  '{"email_notifications": ["project_manager", "safety_coordinator"], "daily_digest": true}'::jsonb,
  '["progress_report", "solar", "installation"]'::jsonb,
  '{"safety_monitoring": true, "progress_tracking": true, "weather_integration": true}'::jsonb
FROM projects;

-- Business/Departmental Forms
WITH departments AS (
  SELECT 
    (SELECT id FROM app.d_biz WHERE name = 'Landscaping Department') AS landscaping_dept_id,
    (SELECT id FROM app.d_biz WHERE name = 'HVAC Services Department') AS hvac_dept_id,
    (SELECT id FROM app.d_biz WHERE name = 'Biz Operations Division') AS biz_ops_id
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
  NULL::date,
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
  NULL::date,
  '["equipment", "maintenance", "request"]'::jsonb,
  '{"workflow_routing": true, "priority_scheduling": true, "parts_inventory_check": true}'::jsonb
FROM departments;

-- HR-Specific Forms
WITH hr_positions AS (
  SELECT 
    (SELECT id FROM app.d_hr WHERE name = 'Chief Operating Officer') AS coo_position_id,
    (SELECT id FROM app.d_hr WHERE name = 'Senior Director - Design & Planning') AS sr_director_id
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
    (SELECT id FROM app.d_worksite WHERE name = 'Huron Home Services HQ') AS headquarters_id,
    (SELECT id FROM app.d_worksite WHERE name = 'Winter Ops - Equipment Staging') AS winter_staging_id
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

-- ============================================================================
-- FALL 2025 LANDSCAPING CAMPAIGN FORMS
-- ============================================================================

-- Enhanced forms specific to the Fall 2025 Landscaping Campaign project
WITH campaign_project AS (
  SELECT id FROM app.d_project WHERE project_code = 'FALL-2025-LAND'
),
james_miller AS (
  SELECT id FROM app.d_employee WHERE name = 'James Miller'
)

INSERT INTO app.ops_formlog_head (
  name, "descr", form_code, form_global_link, schema, version,
  project_specific, project_id, project_permission,
  requires_authentication, submission_limit, notification_rules,
  last_modified_by, tags, attr
)
SELECT
  'Site Assessment and Soil Testing Form',
  'Comprehensive site assessment form for fall landscaping projects including soil testing, drainage evaluation, and site conditions',
  'FORM-FALL-SITE-ASSESS',
  'huron-forms/fall-site-assessment',
  '{
    "title": "Fall Landscaping Site Assessment",
    "fields": [
      {"name": "assessment_date", "type": "date", "required": true, "label": "Assessment Date"},
      {"name": "assessor_name", "type": "select", "required": true, "label": "Site Assessor"},
      {"name": "client_property", "type": "text", "required": true, "label": "Client Property Address"},
      {"name": "property_size", "type": "number", "required": true, "label": "Property Size (sq ft)", "min": 0},
      {"name": "existing_vegetation", "type": "textarea", "required": true, "label": "Existing Vegetation Assessment"},
      {"name": "soil_ph", "type": "number", "required": true, "label": "Soil pH", "min": 0, "max": 14, "step": 0.1},
      {"name": "soil_drainage", "type": "select", "required": true, "label": "Soil Drainage", "options": ["Excellent", "Good", "Fair", "Poor", "Very Poor"]},
      {"name": "compaction_level", "type": "select", "required": true, "label": "Soil Compaction", "options": ["None", "Light", "Moderate", "Heavy", "Severe"]},
      {"name": "sun_exposure", "type": "multiselect", "required": true, "label": "Sun Exposure Areas", "options": ["Full Sun", "Partial Sun", "Partial Shade", "Full Shade"]},
      {"name": "safety_hazards", "type": "textarea", "required": false, "label": "Safety Hazards Identified"},
      {"name": "access_challenges", "type": "textarea", "required": false, "label": "Equipment Access Challenges"},
      {"name": "irrigation_system", "type": "boolean", "required": true, "label": "Existing Irrigation System Present"},
      {"name": "recommended_services", "type": "multiselect", "required": true, "label": "Recommended Services", "options": ["Soil Aeration", "pH Adjustment", "Overseeding", "New Plantings", "Mulching", "Fertilization", "Drainage Improvement"]},
      {"name": "client_preferences", "type": "textarea", "required": false, "label": "Client Preferences and Special Requests"},
      {"name": "photo_documentation", "type": "file", "required": false, "label": "Site Photos", "multiple": true},
      {"name": "assessment_complete", "type": "boolean", "required": true, "label": "Assessment Complete"}
    ],
    "validation": {
      "required_fields": ["assessment_date", "assessor_name", "client_property", "property_size", "existing_vegetation", "soil_ph", "soil_drainage", "compaction_level", "sun_exposure", "irrigation_system", "recommended_services", "assessment_complete"]
    }
  }'::jsonb,
  1,
  true,
  campaign_project.id,
  '["site_assessor", "project_manager", "crew_lead"]'::jsonb,
  true,
  NULL::integer,
  '{"email_notifications": ["project_manager", "crew_supervisor"], "completion_trigger": true}'::jsonb,
  james_miller.id,
  '["site_assessment", "soil_testing", "fall_campaign"]'::jsonb,
  '{"quality_control": true, "photo_required": true, "gps_tracking": true, "weather_conditions": true}'::jsonb
FROM campaign_project, james_miller

UNION ALL

SELECT
  'Daily Work Progress Report',
  'Daily progress tracking form for fall landscaping operations including task completion, quality metrics, and next-day planning',
  'FORM-FALL-DAILY-PROGRESS',
  NULL,
  '{
    "title": "Fall Landscaping Daily Progress Report",
    "fields": [
      {"name": "work_date", "type": "date", "required": true, "label": "Work Date"},
      {"name": "crew_lead", "type": "select", "required": true, "label": "Crew Lead"},
      {"name": "crew_members", "type": "multiselect", "required": true, "label": "Crew Members"},
      {"name": "client_property", "type": "text", "required": true, "label": "Client Property"},
      {"name": "weather_conditions", "type": "select", "required": true, "label": "Weather Conditions", "options": ["Clear", "Partly Cloudy", "Overcast", "Light Rain", "Heavy Rain", "Windy", "Too Cold", "Perfect"]},
      {"name": "tasks_completed", "type": "multiselect", "required": true, "label": "Tasks Completed Today", "options": ["Site Preparation", "Soil Testing", "Aeration", "Soil Amendment", "Seeding", "Overseeding", "Plant Installation", "Mulching", "Fertilizer Application", "Cleanup", "Quality Inspection"]},
      {"name": "hours_worked", "type": "number", "required": true, "label": "Total Hours Worked", "min": 0, "max": 16, "step": 0.5},
      {"name": "completion_percentage", "type": "number", "required": true, "label": "Overall Project Completion %", "min": 0, "max": 100},
      {"name": "quality_rating", "type": "rating", "required": true, "label": "Work Quality Self-Assessment", "scale": 5},
      {"name": "materials_used", "type": "textarea", "required": false, "label": "Materials Used (quantities)"},
      {"name": "equipment_used", "type": "multiselect", "required": true, "label": "Equipment Used", "options": ["Aerator", "Spreader", "Seeder", "Mower", "Blower", "Hand Tools", "Wheelbarrow", "Truck", "Trailer"]},
      {"name": "client_interaction", "type": "textarea", "required": false, "label": "Client Interaction Notes"},
      {"name": "challenges_encountered", "type": "textarea", "required": false, "label": "Challenges Encountered"},
      {"name": "safety_incidents", "type": "boolean", "required": true, "label": "Any Safety Incidents?"},
      {"name": "incident_details", "type": "textarea", "required": false, "label": "Safety Incident Details"},
      {"name": "tomorrow_plan", "type": "textarea", "required": true, "label": "Tomorrow Work Plan"},
      {"name": "additional_notes", "type": "textarea", "required": false, "label": "Additional Notes"}
    ]
  }'::jsonb,
  1,
  true,
  campaign_project.id,
  '["crew_lead", "crew_member", "supervisor"]'::jsonb,
  true,
  1,
  '{"email_notifications": ["project_manager"], "daily_digest": true, "safety_alerts": true}'::jsonb,
  james_miller.id,
  '["daily_progress", "crew_report", "fall_campaign"]'::jsonb,
  '{"daily_requirement": true, "safety_monitoring": true, "progress_tracking": true, "time_tracking": true}'::jsonb
FROM campaign_project, james_miller

UNION ALL

SELECT
  'Client Pre-Service Consultation',
  'Pre-service consultation form to document client expectations, preferences, and project specifications',
  'FORM-FALL-CLIENT-CONSULT',
  'huron-forms/fall-client-consultation',
  '{
    "title": "Fall Landscaping Client Consultation",
    "fields": [
      {"name": "consultation_date", "type": "date", "required": true, "label": "Consultation Date"},
      {"name": "consultant_name", "type": "text", "required": true, "label": "Consultant Name"},
      {"name": "client_name", "type": "text", "required": true, "label": "Client Name"},
      {"name": "property_address", "type": "text", "required": true, "label": "Property Address"},
      {"name": "consultation_type", "type": "select", "required": true, "label": "Consultation Type", "options": ["Initial Consultation", "Follow-up Meeting", "Design Review", "Pre-Service Meeting"]},
      {"name": "service_goals", "type": "textarea", "required": true, "label": "Client Service Goals"},
      {"name": "budget_range", "type": "select", "required": true, "label": "Client Budget Range", "options": ["Under $2,000", "$2,000 - $5,000", "$5,000 - $10,000", "$10,000 - $20,000", "Over $20,000"]},
      {"name": "timeline_preference", "type": "select", "required": true, "label": "Preferred Timeline", "options": ["ASAP", "Within 2 weeks", "Within 1 month", "Flexible", "Specific dates required"]},
      {"name": "preferred_grass_type", "type": "multiselect", "required": false, "label": "Grass Type Preferences", "options": ["Tall Fescue", "Perennial Ryegrass", "Fine Fescue", "Kentucky Bluegrass", "No preference", "Advisor recommendation"]},
      {"name": "plant_preferences", "type": "textarea", "required": false, "label": "Plant and Color Preferences"},
      {"name": "maintenance_commitment", "type": "select", "required": true, "label": "Maintenance Commitment Level", "options": ["Low maintenance preferred", "Moderate maintenance acceptable", "High maintenance welcome", "Professional maintenance contract"]},
      {"name": "special_considerations", "type": "textarea", "required": false, "label": "Special Considerations (pets, allergies, etc.)"},
      {"name": "communication_preference", "type": "select", "required": true, "label": "Preferred Communication", "options": ["Phone calls", "Text messages", "Email", "In-person updates"]},
      {"name": "property_access", "type": "textarea", "required": true, "label": "Property Access Instructions"},
      {"name": "client_approval", "type": "boolean", "required": true, "label": "Client approves proposed service plan"},
      {"name": "client_signature", "type": "signature", "required": true, "label": "Client Signature"}
    ]
  }'::jsonb,
  1,
  true,
  campaign_project.id,
  '["consultant", "project_manager", "sales"]'::jsonb,
  false,
  NULL::integer,
  '{"email_notifications": ["project_manager", "scheduling"], "client_copy": true}'::jsonb,
  james_miller.id,
  '["client_consultation", "pre_service", "fall_campaign"]'::jsonb,
  '{"client_portal": true, "signature_required": true, "follow_up_scheduling": true, "quote_integration": true}'::jsonb
FROM campaign_project, james_miller

UNION ALL

SELECT
  'Quality Control Inspection Checklist',
  'Comprehensive quality control inspection form for completed fall landscaping work phases',
  'FORM-FALL-QC-INSPECT',
  NULL,
  '{
    "title": "Fall Landscaping Quality Control Inspection",
    "fields": [
      {"name": "inspection_date", "type": "date", "required": true, "label": "Inspection Date"},
      {"name": "inspector_name", "type": "select", "required": true, "label": "Quality Inspector"},
      {"name": "client_property", "type": "text", "required": true, "label": "Client Property"},
      {"name": "inspection_phase", "type": "select", "required": true, "label": "Inspection Phase", "options": ["Site Preparation", "Soil Work", "Seeding", "Planting", "Final Completion", "Client Walkthrough"]},
      {"name": "site_preparation_score", "type": "rating", "required": false, "label": "Site Preparation Quality", "scale": 10},
      {"name": "soil_work_score", "type": "rating", "required": false, "label": "Soil Work Quality", "scale": 10},
      {"name": "seeding_score", "type": "rating", "required": false, "label": "Seeding Quality", "scale": 10},
      {"name": "planting_score", "type": "rating", "required": false, "label": "Planting Quality", "scale": 10},
      {"name": "cleanup_score", "type": "rating", "required": true, "label": "Site Cleanup Quality", "scale": 10},
      {"name": "overall_workmanship", "type": "rating", "required": true, "label": "Overall Workmanship", "scale": 10},
      {"name": "meets_specifications", "type": "boolean", "required": true, "label": "Work meets project specifications"},
      {"name": "client_satisfaction", "type": "rating", "required": false, "label": "Client Satisfaction (if present)", "scale": 5},
      {"name": "deficiencies_noted", "type": "textarea", "required": false, "label": "Deficiencies or Issues Noted"},
      {"name": "corrective_actions", "type": "textarea", "required": false, "label": "Required Corrective Actions"},
      {"name": "photo_documentation", "type": "file", "required": true, "label": "Quality Photos", "multiple": true},
      {"name": "reinspection_required", "type": "boolean", "required": true, "label": "Reinspection Required"},
      {"name": "client_signoff", "type": "signature", "required": false, "label": "Client Sign-off (if present)"},
      {"name": "inspector_recommendation", "type": "select", "required": true, "label": "Inspector Recommendation", "options": ["Approve - Excellent Work", "Approve - Good Work", "Approve with Minor Items", "Conditional Approval", "Reject - Rework Required"]},
      {"name": "inspection_notes", "type": "textarea", "required": false, "label": "Additional Inspection Notes"}
    ]
  }'::jsonb,
  1,
  true,
  campaign_project.id,
  '["quality_inspector", "project_manager", "supervisor"]'::jsonb,
  true,
  NULL::integer,
  '{"email_notifications": ["project_manager", "crew_lead"], "quality_alerts": true, "escalation_enabled": true}'::jsonb,
  james_miller.id,
  '["quality_control", "inspection", "fall_campaign"]'::jsonb,
  '{"photo_required": true, "quality_scoring": true, "corrective_action_tracking": true, "client_portal_integration": true}'::jsonb
FROM campaign_project, james_miller

UNION ALL

SELECT
  'Material and Equipment Tracking',
  'Daily tracking form for materials consumed and equipment usage during fall landscaping operations',
  'FORM-FALL-MATERIAL-TRACK',
  NULL,
  '{
    "title": "Fall Landscaping Material & Equipment Tracking",
    "fields": [
      {"name": "tracking_date", "type": "date", "required": true, "label": "Date"},
      {"name": "crew_lead", "type": "select", "required": true, "label": "Crew Lead"},
      {"name": "client_property", "type": "text", "required": true, "label": "Client Property"},
      {"name": "grass_seed_used", "type": "number", "required": false, "label": "Grass Seed Used (lbs)", "min": 0, "step": 0.5},
      {"name": "fertilizer_used", "type": "number", "required": false, "label": "Fertilizer Used (lbs)", "min": 0, "step": 0.5},
      {"name": "mulch_used", "type": "number", "required": false, "label": "Mulch Used (cubic yards)", "min": 0, "step": 0.25},
      {"name": "compost_used", "type": "number", "required": false, "label": "Compost Used (cubic yards)", "min": 0, "step": 0.25},
      {"name": "plants_installed", "type": "number", "required": false, "label": "Plants Installed (count)", "min": 0},
      {"name": "bulbs_planted", "type": "number", "required": false, "label": "Bulbs Planted (count)", "min": 0},
      {"name": "fuel_consumed", "type": "number", "required": false, "label": "Fuel Consumed (gallons)", "min": 0, "step": 0.1},
      {"name": "equipment_hours", "type": "textarea", "required": false, "label": "Equipment Usage Hours (list equipment and hours)"},
      {"name": "material_waste", "type": "textarea", "required": false, "label": "Material Waste/Loss Notes"},
      {"name": "equipment_issues", "type": "textarea", "required": false, "label": "Equipment Issues or Maintenance Needs"},
      {"name": "inventory_check", "type": "boolean", "required": true, "label": "End-of-day inventory check completed"},
      {"name": "materials_secured", "type": "boolean", "required": true, "label": "Materials properly secured"},
      {"name": "tomorrow_materials", "type": "textarea", "required": false, "label": "Materials needed for tomorrow"}
    ]
  }'::jsonb,
  1,
  true,
  campaign_project.id,
  '["crew_lead", "supervisor", "inventory_manager"]'::jsonb,
  true,
  1,
  '{"email_notifications": ["inventory_manager", "project_manager"], "daily_requirement": true}'::jsonb,
  james_miller.id,
  '["material_tracking", "equipment_usage", "inventory"]'::jsonb,
  '{"cost_tracking": true, "inventory_integration": true, "usage_analytics": true, "waste_monitoring": true}'::jsonb
FROM campaign_project, james_miller;