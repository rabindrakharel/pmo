-- ============================================================================
-- FORMS (HEAD + RECORDS)
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
  biz_id uuid,
  business_permission jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- HR scoping
  hr_specific boolean NOT NULL DEFAULT false,
  hr_id uuid,
  hr_permission jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Worksite scoping
  worksite_specific boolean NOT NULL DEFAULT false,
  worksite_id uuid,
  worksite_permission jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Form schema and versioning
  schema jsonb NOT NULL,
  version int NOT NULL DEFAULT 1,
  
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

CREATE TABLE app.ops_formlog_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  head_id uuid NOT NULL REFERENCES app.ops_formlog_head(id) ON DELETE CASCADE,
  
  -- Form submission data
  data jsonb NOT NULL,
  
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

-- Insert Form Definitions
INSERT INTO app.ops_formlog_head 
  (name, descr, form_global_link, project_specific, task_specific, location_specific, business_specific, hr_specific, worksite_specific, schema, version, tags, attr)
VALUES
  ('Daily Task Status Report', 'Daily task progress and status update form for project teams', 'https://forms.techcorp.ca/daily-status-001', true, true, false, false, false, false,
    '{"fields": [{"name": "task_progress", "type": "number", "label": "Progress %", "required": true, "min": 0, "max": 100}, {"name": "blockers", "type": "textarea", "label": "Blockers or Issues", "required": false}, {"name": "next_actions", "type": "textarea", "label": "Next Actions", "required": true}, {"name": "estimated_completion", "type": "date", "label": "Estimated Completion", "required": false}]}'::jsonb, 1,
    '["task", "daily", "status", "project"]',
    '{"frequency": "daily", "reminder_time": "09:00", "auto_archive": 30}'),
    
  ('Client Feedback Survey', 'Post-project client satisfaction and feedback collection form', 'https://forms.techcorp.ca/client-feedback-001', true, false, false, false, false, false,
    '{"fields": [{"name": "overall_satisfaction", "type": "select", "label": "Overall Satisfaction", "required": true, "options": ["Very Dissatisfied", "Dissatisfied", "Neutral", "Satisfied", "Very Satisfied"]}, {"name": "project_quality", "type": "number", "label": "Project Quality (1-10)", "required": true, "min": 1, "max": 10}, {"name": "communication_rating", "type": "number", "label": "Communication Rating (1-10)", "required": true, "min": 1, "max": 10}, {"name": "feedback_comments", "type": "textarea", "label": "Additional Feedback", "required": false}, {"name": "recommend_us", "type": "select", "label": "Would you recommend us?", "required": true, "options": ["Definitely Not", "Probably Not", "Neutral", "Probably Yes", "Definitely Yes"]}]}'::jsonb, 1,
    '["client", "feedback", "satisfaction", "project"]',
    '{"send_after_completion": true, "follow_up_days": 7, "anonymous": false}'),
    
  ('Office Resource Request', 'Request form for office resources, equipment, and space booking', 'https://forms.techcorp.ca/resource-request-001', false, false, true, false, false, false,
    '{"fields": [{"name": "resource_type", "type": "select", "label": "Resource Type", "required": true, "options": ["Meeting Room", "Equipment", "Parking Spot", "Office Supplies", "Software License"]}, {"name": "requested_date", "type": "date", "label": "Requested Date", "required": true}, {"name": "duration", "type": "select", "label": "Duration", "required": true, "options": ["1 Hour", "Half Day", "Full Day", "1 Week", "1 Month", "Permanent"]}, {"name": "justification", "type": "textarea", "label": "Business Justification", "required": true}, {"name": "budget_impact", "type": "number", "label": "Budget Impact (CAD)", "required": false, "min": 0}]}'::jsonb, 1,
    '["location", "resource", "request", "booking"]',
    '{"approval_required": true, "auto_approve_under": 500, "escalation_days": 3}'),
    
  ('Employee Performance Review', 'Quarterly performance review form for HR and management', null, false, false, false, false, true, false,
    '{"fields": [{"name": "review_period", "type": "select", "label": "Review Period", "required": true, "options": ["Q1 2024", "Q2 2024", "Q3 2024", "Q4 2024"]}, {"name": "goal_achievement", "type": "number", "label": "Goal Achievement %", "required": true, "min": 0, "max": 100}, {"name": "technical_skills", "type": "number", "label": "Technical Skills (1-5)", "required": true, "min": 1, "max": 5}, {"name": "communication_skills", "type": "number", "label": "Communication Skills (1-5)", "required": true, "min": 1, "max": 5}, {"name": "leadership_potential", "type": "number", "label": "Leadership Potential (1-5)", "required": true, "min": 1, "max": 5}, {"name": "areas_for_improvement", "type": "textarea", "label": "Areas for Improvement", "required": false}, {"name": "career_goals", "type": "textarea", "label": "Career Development Goals", "required": false}]}'::jsonb, 1,
    '["hr", "performance", "review", "quarterly"]',
    '{"confidential": true, "reviewer_access_only": true, "retention_years": 7}'),
    
  ('Safety Incident Report', 'Workplace safety incident reporting and investigation form', 'https://forms.techcorp.ca/safety-incident-001', false, false, false, false, false, true,
    '{"fields": [{"name": "incident_date", "type": "datetime", "label": "Incident Date & Time", "required": true}, {"name": "incident_type", "type": "select", "label": "Incident Type", "required": true, "options": ["Near Miss", "Minor Injury", "Major Injury", "Property Damage", "Security Breach"]}, {"name": "location_details", "type": "text", "label": "Specific Location", "required": true}, {"name": "description", "type": "textarea", "label": "Incident Description", "required": true}, {"name": "immediate_actions", "type": "textarea", "label": "Immediate Actions Taken", "required": true}, {"name": "witnesses", "type": "textarea", "label": "Witnesses", "required": false}, {"name": "reported_by", "type": "text", "label": "Reported By", "required": true}]}'::jsonb, 1,
    '["worksite", "safety", "incident", "reporting"]',
    '{"priority": "high", "immediate_notification": true, "investigation_required": true}'),
    
  ('Budget Allocation Request', 'Department budget allocation and expense approval request form', null, false, false, false, true, false, false,
    '{"fields": [{"name": "department", "type": "select", "label": "Department", "required": true, "options": ["Engineering", "Sales", "Marketing", "HR", "Operations"]}, {"name": "budget_category", "type": "select", "label": "Budget Category", "required": true, "options": ["Personnel", "Equipment", "Software", "Training", "Travel", "Marketing", "Operations"]}, {"name": "requested_amount", "type": "number", "label": "Requested Amount (CAD)", "required": true, "min": 1}, {"name": "justification", "type": "textarea", "label": "Business Justification", "required": true}, {"name": "expected_roi", "type": "textarea", "label": "Expected ROI/Benefits", "required": false}, {"name": "urgency", "type": "select", "label": "Urgency", "required": true, "options": ["Low", "Medium", "High", "Critical"]}]}'::jsonb, 1,
    '["business", "budget", "allocation", "approval"]',
    '{"approval_workflow": ["manager", "finance", "executive"], "budget_limit_escalation": 10000});

-- Insert Sample Form Records
INSERT INTO app.ops_formlog_records 
  (head_id, name, descr, data, tags, attr)
VALUES
  ((SELECT id FROM app.ops_formlog_head WHERE name = 'Daily Task Status Report' LIMIT 1),
    'Database Migration Progress - Day 15', 'Daily status update for PostgreSQL migration task',
    '{"task_progress": 85, "blockers": "Waiting for DBA approval on stored procedure conversions", "next_actions": "Complete final 3 stored procedures, prepare rollback scripts", "estimated_completion": "2024-06-18", "submitted_by": "Mike Chen", "task_id": "PM-DB-001-A-1"}'::jsonb,
    '["database", "migration", "daily-update"]',
    '{"submission_time": "2024-06-15T09:15:00Z", "task_phase": "implementation"}'),
    
  ((SELECT id FROM app.ops_formlog_head WHERE name = 'Client Feedback Survey' LIMIT 1),
    'Mobile App V2 Project Feedback', 'Post-completion feedback for mobile application project',
    '{"overall_satisfaction": "Very Satisfied", "project_quality": 9, "communication_rating": 8, "feedback_comments": "The team delivered an exceptional mobile app that exceeded our expectations. The user interface is intuitive and the offline functionality works perfectly.", "recommend_us": "Definitely Yes", "client_name": "TechStart Solutions", "project_id": "MA-2024-002"}'::jsonb,
    '["client", "satisfaction", "mobile-app"]',
    '{"submission_time": "2024-10-31T14:30:00Z", "follow_up_scheduled": true}'),
    
  ((SELECT id FROM app.ops_formlog_head WHERE name = 'Office Resource Request' LIMIT 1),
    'Conference Room A Booking', 'Weekly team meeting room reservation request',
    '{"resource_type": "Meeting Room", "requested_date": "2024-07-01", "duration": "Full Day", "justification": "Weekly engineering team retrospective and sprint planning session", "budget_impact": 0, "requested_by": "Jane Doe", "team_size": 12}'::jsonb,
    '["meeting-room", "booking", "weekly"]',
    '{"submission_time": "2024-06-25T11:00:00Z", "auto_approved": true}'),
    
  ((SELECT id FROM app.ops_formlog_head WHERE name = 'Employee Performance Review' LIMIT 1),
    'Q2 2024 Performance Review - John Smith', 'Quarterly performance evaluation for project manager',
    '{"review_period": "Q2 2024", "goal_achievement": 92, "technical_skills": 4, "communication_skills": 5, "leadership_potential": 5, "areas_for_improvement": "Could benefit from additional training in cloud architecture", "career_goals": "Interested in pursuing cloud solutions architect certification", "reviewer": "David Kim", "employee_id": "john.smith"}'::jsonb,
    '["performance", "quarterly", "management"]',
    '{"submission_time": "2024-06-30T16:45:00Z", "confidential": true}'),
    
  ((SELECT id FROM app.ops_formlog_head WHERE name = 'Safety Incident Report' LIMIT 1),
    'Near Miss - Server Room Access', 'Near miss incident in Toronto office server room',
    '{"incident_date": "2024-06-20T14:30:00Z", "incident_type": "Near Miss", "location_details": "Toronto HQ - Server Room B, Rack 7", "description": "Employee entered server room without proper ESD protection while servers were being maintained", "immediate_actions": "Employee was immediately provided with ESD wristband and briefed on proper procedures", "witnesses": "Bob Wilson (DevOps Lead)", "reported_by": "Security Team", "severity": "Low"}'::jsonb,
    '["safety", "near-miss", "server-room"]',
    '{"submission_time": "2024-06-20T15:15:00Z", "investigation_required": false}'),
    
  ((SELECT id FROM app.ops_formlog_head WHERE name = 'Budget Allocation Request' LIMIT 1),
    'Q3 Software License Renewal', 'Quarterly software license renewal budget request',
    '{"department": "Engineering", "budget_category": "Software", "requested_amount": 45000, "justification": "Renewal of development tools, cloud services, and security software licenses for Q3 2024", "expected_roi": "Maintains development productivity and ensures security compliance", "urgency": "High", "requested_by": "Engineering Department", "license_details": "JetBrains, AWS, GitHub Enterprise, SonarQube"}'::jsonb,
    '["budget", "software", "licenses", "quarterly"]',
    '{"submission_time": "2024-06-25T13:20:00Z", "approval_status": "pending"});