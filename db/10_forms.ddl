-- ============================================================================
-- FORMS (HEAD + RECORDS) - FIXED VERSION
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- 📝 **DYNAMIC FORMS ENGINE**
-- • Configurable form schemas with validation
-- • Project, task, and scope-specific forms  
-- • Multi-tenant form isolation
-- • Version-controlled form definitions
--
-- 🔄 **FORM LIFECYCLE**
-- Form Head (schema definition) → Form Records (submissions) → Analytics
--
-- 🎯 **SCOPING MECHANISMS**
-- • Project-specific forms (task updates, deliverables)
-- • Task-specific forms (time logs, status reports)
-- • Location-specific forms (office feedback, resources)
-- • Business-specific forms (budget requests, approvals)
-- • HR-specific forms (performance reviews, onboarding)
-- • Worksite-specific forms (safety reports, maintenance)
--
-- 🔗 **INTEGRATION CAPABILITIES**
-- • Global public links for external submissions
-- • Project task integration (task_records references)
-- • Permission-based form access control
-- • Real-time data collection and reporting
--
-- 📊 **OPERATIONAL USE CASES**
-- • Daily standup reports (task-specific)
-- • Client feedback forms (project-specific) 
-- • Employee satisfaction surveys (hr-specific)
-- • Safety incident reports (worksite-specific)
-- • Budget allocation requests (business-specific)
-- • Resource booking forms (location-specific)
--
-- 🛡️ **SECURITY & COMPLIANCE**
-- • Tenant data isolation
-- • Permission-based form access
-- • Audit trail for all submissions
-- • GDPR-compliant data handling

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.ops_formlog_head (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Form global access  
  form_global_link text UNIQUE,
  
  -- Project scoping
  project_specific boolean NOT NULL DEFAULT false,
  project_id uuid,
  project_permission jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Task scoping
  task_specific boolean NOT NULL DEFAULT false,
  task_id uuid,
  task_permission jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Location scoping
  location_specific boolean NOT NULL DEFAULT false,
  location_id uuid,
  location_permission jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Business scoping
  business_specific boolean NOT NULL DEFAULT false,
  business_id uuid,
  business_permission jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- HR scoping
  hr_specific boolean NOT NULL DEFAULT false,
  hr_id uuid,
  hr_permission jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Worksite scoping
  worksite_specific boolean NOT NULL DEFAULT false,
  worksite_id uuid,
  worksite_permission jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Standard metadata fields
  name text NOT NULL,
  descr text,
  schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamp with time zone NOT NULL DEFAULT now(),
  to_ts timestamp with time zone,
  active boolean NOT NULL DEFAULT true,
  created timestamp with time zone NOT NULL DEFAULT now(),
  updated timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_active_form_name UNIQUE (name, active),
  CONSTRAINT valid_schema_version CHECK (version > 0),
  CONSTRAINT valid_temporal_range CHECK (to_ts IS NULL OR to_ts > from_ts)
);

CREATE TABLE app.ops_formlog_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reference to form definition
  head_id uuid NOT NULL REFERENCES app.ops_formlog_head(id) ON DELETE CASCADE,
  
  -- Standard metadata fields
  name text NOT NULL,
  descr text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamp with time zone NOT NULL DEFAULT now(),
  to_ts timestamp with time zone,
  active boolean NOT NULL DEFAULT true,
  created timestamp with time zone NOT NULL DEFAULT now(),
  updated timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT valid_temporal_range CHECK (to_ts IS NULL OR to_ts > from_ts)
);

-- Insert Form Definitions
INSERT INTO app.ops_formlog_head (name, descr, form_global_link, project_specific, task_specific, location_specific, business_specific, hr_specific, worksite_specific, schema, version, tags, attr) VALUES
('Daily Task Status Report', 'Daily task progress and status update form for project teams', 'https://forms.techcorp.ca/daily-status-001', true, true, false, false, false, false,
  '{"fields": [{"name": "task_progress", "type": "number", "label": "Progress %", "required": true, "min": 0, "max": 100}]}'::jsonb, 1,
  '["task", "daily", "status", "project"]',
  '{"frequency": "daily", "reminder_time": "09:00", "auto_archive": 30}'),

('Client Feedback Survey', 'Post-project client satisfaction and feedback collection form', 'https://forms.techcorp.ca/client-feedback-001', true, false, false, false, false, false,
  '{"fields": [{"name": "overall_satisfaction", "type": "select", "label": "Overall Satisfaction", "required": true, "options": ["Very Dissatisfied", "Dissatisfied", "Neutral", "Satisfied", "Very Satisfied"]}]}'::jsonb, 1,
  '["client", "feedback", "satisfaction", "project"]',
  '{"send_after_completion": true, "follow_up_days": 7, "anonymous": false}'),

('Office Resource Request', 'Request form for office resources, equipment, and space booking', 'https://forms.techcorp.ca/resource-request-001', false, false, true, false, false, false,
  '{"fields": [{"name": "resource_type", "type": "select", "label": "Resource Type", "required": true, "options": ["Meeting Room", "Equipment", "Parking Spot", "Office Supplies", "Software License"]}]}'::jsonb, 1,
  '["location", "resource", "request", "booking"]',
  '{"approval_required": true, "auto_approve_under": 500, "escalation_days": 3}'),

('Employee Performance Review', 'Quarterly performance review form for HR and management', null, false, false, false, false, true, false,
  '{"fields": [{"name": "review_period", "type": "select", "label": "Review Period", "required": true, "options": ["Q1 2024", "Q2 2024", "Q3 2024", "Q4 2024"]}]}'::jsonb, 1,
  '["hr", "performance", "review", "quarterly"]',
  '{"confidential": true, "reviewer_access_only": true, "retention_years": 7}'),

('Safety Incident Report', 'Workplace safety incident reporting and investigation form', 'https://forms.techcorp.ca/safety-incident-001', false, false, false, false, false, true,
  '{"fields": [{"name": "incident_date", "type": "datetime", "label": "Incident Date & Time", "required": true}, {"name": "incident_type", "type": "select", "label": "Incident Type", "required": true, "options": ["Near Miss", "Minor Injury", "Major Injury", "Property Damage", "Security Breach"]}]}'::jsonb, 1,
  '["worksite", "safety", "incident", "reporting"]',
  '{"priority": "high", "immediate_notification": true, "investigation_required": true}'),

('Budget Allocation Request', 'Department budget allocation and expense approval request form', null, false, false, false, true, false, false,
  '{"fields": [{"name": "department", "type": "select", "label": "Department", "required": true, "options": ["Engineering", "Sales", "Marketing", "HR", "Operations"]}]}'::jsonb, 1,
  '["business", "budget", "allocation", "approval"]',
  '{"approval_workflow": ["manager", "finance", "executive"], "budget_limit_escalation": 10000}');

-- Insert Sample Form Records (simplified)
INSERT INTO app.ops_formlog_records (head_id, name, descr, data, tags, attr) VALUES
((SELECT id FROM app.ops_formlog_head WHERE name = 'Daily Task Status Report' LIMIT 1),
  'Database Migration Progress - Day 15', 'Daily status update for PostgreSQL migration task',
  '{"task_progress": 85, "blockers": "Waiting for DBA approval", "submitted_by": "Mike Chen"}'::jsonb,
  '["database", "migration", "daily-update"]',
  '{"submission_time": "2024-06-15T09:15:00Z", "task_phase": "implementation"}'),

((SELECT id FROM app.ops_formlog_head WHERE name = 'Client Feedback Survey' LIMIT 1),
  'Mobile App V2 Project Feedback', 'Post-completion feedback for mobile application project',
  '{"overall_satisfaction": "Very Satisfied", "project_quality": 9, "client_name": "TechStart Solutions"}'::jsonb,
  '["client", "satisfaction", "mobile-app"]',
  '{"submission_time": "2024-10-31T14:30:00Z", "follow_up_scheduled": true}'),

((SELECT id FROM app.ops_formlog_head WHERE name = 'Office Resource Request' LIMIT 1),
  'Conference Room A Booking', 'Weekly team meeting room reservation request',
  '{"resource_type": "Meeting Room", "requested_date": "2024-07-01", "requested_by": "Jane Doe"}'::jsonb,
  '["meeting-room", "booking", "weekly"]',
  '{"submission_time": "2024-06-25T11:00:00Z", "auto_approved": true}');