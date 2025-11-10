-- ============================================================================
-- UNIFIED SETTING DATA LABEL TABLE
-- ============================================================================
--
-- SEMANTICS:
-- • DRY table for ALL entity data labels (stages, statuses, priorities)
-- • Replaces 17 separate tables with one JSONB-based structure
-- • Powers dropdowns, badges, workflow transitions
--
-- STRUCTURE:
-- • datalabel_name: dl__{entity}_{label} ('dl__task_stage', 'dl__project_stage')
-- • metadata: JSONB array [{id, name, descr, parent_ids, color_code}]
-- • ui_label, ui_icon: For settings page display
--
-- ENTITY-LABEL COMBOS:
-- • Task: dl__task_stage, dl__task_priority, dl__task_update_type
-- • Project: dl__project_stage
-- • Form: dl__form_submission_status, dl__form_approval_status
-- • Wiki: dl__wiki_publication_status
-- • Customer: dl__customer_tier, dl__customer_opportunity_funnel
-- • Quote/Work: dl__quote_stage, dl__work_order_status
-- • Services: dl__service_category, dl__client_service
-- • Org: dl__business_level, dl__office_level, dl__position_level
-- • Other: dl__industry_sector, dl__acquisition_channel
--
-- API INTEGRATION:
-- • GET /api/v1/setting?category=dl__task_stage
-- • Frontend: loadOptionsFromSettings('dl__task_stage')
-- • Auto-populated dropdowns, badge rendering with color_code
--

CREATE TABLE app.setting_datalabel (
    datalabel_name VARCHAR(100) PRIMARY KEY,
    ui_label VARCHAR(100) NOT NULL,
    ui_icon VARCHAR(50),
    metadata JSONB NOT NULL,
    updated_ts TIMESTAMPTZ DEFAULT now()
);


-- Trigger to update updated_ts on modification
CREATE TRIGGER trg_setting_datalabel_updated_ts
    BEFORE UPDATE ON app.setting_datalabel
    FOR EACH ROW
    EXECUTE FUNCTION app.update_updated_ts_column();

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Task Labels
INSERT INTO app.setting_datalabel (datalabel_name, ui_label, ui_icon, metadata) VALUES
('dl__task_stage', 'Task Stages', 'Target', '[
  {"id": 0, "name": "Backlog", "descr": "Tasks in backlog, not yet started", "parent_ids": [], "entity_name": "task", "terminal_flag": false, "color_code": "gray"},
  {"id": 1, "name": "Planning", "descr": "Tasks in planning phase", "parent_ids": [0], "entity_name": "task", "terminal_flag": false, "color_code": "purple"},
  {"id": 2, "name": "To Do", "descr": "Tasks ready to start", "parent_ids": [1], "entity_name": "task", "terminal_flag": false, "color_code": "blue"},
  {"id": 3, "name": "In Progress", "descr": "Tasks actively being worked on", "parent_ids": [2], "entity_name": "task", "terminal_flag": false, "color_code": "yellow"},
  {"id": 4, "name": "In Review", "descr": "Tasks under review", "parent_ids": [3], "entity_name": "task", "terminal_flag": false, "color_code": "cyan"},
  {"id": 5, "name": "Completed", "descr": "Tasks completed successfully", "parent_ids": [4], "entity_name": "task", "terminal_flag": true, "color_code": "green"},
  {"id": 6, "name": "Blocked", "descr": "Tasks blocked by dependencies", "parent_ids": [2, 3], "entity_name": "task", "terminal_flag": false, "color_code": "red"}
]'::jsonb),

('dl__task_priority', 'Task Priorities', 'TrendingUp', '[
  {"id": 0, "name": "low", "descr": "Low priority - can be scheduled flexibly", "parent_ids": [], "color_code": "green"},
  {"id": 1, "name": "medium", "descr": "Medium priority - normal scheduling", "parent_ids": [], "color_code": "yellow"},
  {"id": 2, "name": "high", "descr": "High priority - requires prompt attention", "parent_ids": [], "color_code": "orange"},
  {"id": 3, "name": "critical", "descr": "Critical priority - urgent and blocking", "parent_ids": [], "color_code": "red"}
]'::jsonb),

('dl__task_update_type', 'Task Update Types', 'Bell', '[
  {"id": 0, "name": "Status Change", "descr": "Task status was changed", "parent_ids": [], "color_code": "blue"},
  {"id": 1, "name": "Comment", "descr": "Comment added to task", "parent_ids": [], "color_code": "gray"},
  {"id": 2, "name": "Assignment", "descr": "Task assigned to employee", "parent_ids": [], "color_code": "purple"},
  {"id": 3, "name": "Due Date", "descr": "Due date changed", "parent_ids": [], "color_code": "yellow"}
]'::jsonb),

-- Project Labels
('dl__project_stage', 'Project Stages', 'GitBranch', '[
  {"id": 0, "name": "Initiation", "descr": "Project concept and initial planning. Starting point for all projects.", "parent_ids": [], "entity_name": "project", "terminal_flag": false, "color_code": "blue"},
  {"id": 1, "name": "Planning", "descr": "Detailed project planning and resource allocation. Follows project approval.", "parent_ids": [0], "entity_name": "project", "terminal_flag": false, "color_code": "purple"},
  {"id": 2, "name": "Execution", "descr": "Active project execution phase. Work is being performed by the project team.", "parent_ids": [1], "entity_name": "project", "terminal_flag": false, "color_code": "yellow"},
  {"id": 3, "name": "Monitoring", "descr": "Project monitoring and control. Tracking progress and managing changes.", "parent_ids": [2], "entity_name": "project", "terminal_flag": false, "color_code": "orange"},
  {"id": 4, "name": "Closure", "descr": "Project completion and closure activities. Final deliverables and documentation.", "parent_ids": [3], "entity_name": "project", "terminal_flag": true, "color_code": "green"},
  {"id": 5, "name": "On Hold", "descr": "Project temporarily suspended. Can resume to Execution or Planning stages.", "parent_ids": [1, 2], "entity_name": "project", "terminal_flag": false, "color_code": "gray"},
  {"id": 6, "name": "Cancelled", "descr": "Project cancelled before completion. Terminal state with no forward transitions.", "parent_ids": [0, 1, 2, 5], "entity_name": "project", "terminal_flag": true, "color_code": "red"}
]'::jsonb),

-- Form Labels
('dl__form_submission_status', 'Form Submission Statuses', 'FileCheck', '[
  {"id": 0, "name": "draft", "descr": "Form is in draft state", "parent_ids": [], "color_code": "yellow"},
  {"id": 1, "name": "submitted", "descr": "Form has been submitted", "parent_ids": [0], "color_code": "blue"},
  {"id": 2, "name": "under_review", "descr": "Form is under review", "parent_ids": [1], "color_code": "purple"},
  {"id": 3, "name": "approved", "descr": "Form has been approved", "parent_ids": [2], "color_code": "green"},
  {"id": 4, "name": "rejected", "descr": "Form has been rejected", "parent_ids": [2], "color_code": "red"},
  {"id": 5, "name": "withdrawn", "descr": "Form has been withdrawn", "parent_ids": [1], "color_code": "gray"}
]'::jsonb),

('dl__form_approval_status', 'Form Approval Statuses', 'CheckCircle', '[
  {"id": 0, "name": "pending", "descr": "Awaiting approval", "parent_ids": [], "color_code": "yellow"},
  {"id": 1, "name": "approved", "descr": "Approval granted", "parent_ids": [], "color_code": "green"},
  {"id": 2, "name": "rejected", "descr": "Approval rejected", "parent_ids": [], "color_code": "red"},
  {"id": 3, "name": "conditional", "descr": "Conditionally approved", "parent_ids": [], "color_code": "orange"},
  {"id": 4, "name": "escalated", "descr": "Escalated to higher authority", "parent_ids": [], "color_code": "purple"}
]'::jsonb),

-- Wiki Labels
('dl__wiki_publication_status', 'Wiki Publication Statuses', 'BookOpen', '[
  {"id": 0, "name": "draft", "descr": "Wiki page in draft", "parent_ids": [], "color_code": "yellow"},
  {"id": 1, "name": "review", "descr": "Under review", "parent_ids": [0], "color_code": "blue"},
  {"id": 2, "name": "published", "descr": "Published and visible", "parent_ids": [1], "color_code": "green"},
  {"id": 3, "name": "archived", "descr": "Archived but accessible", "parent_ids": [], "color_code": "gray"},
  {"id": 4, "name": "deprecated", "descr": "Deprecated, should not be used", "parent_ids": [], "color_code": "red"},
  {"id": 5, "name": "private", "descr": "Private, restricted access", "parent_ids": [], "color_code": "purple"}
]'::jsonb),

-- Client Labels
('dl__client_status', 'Client Statuses', 'Users', '[
  {"id": 0, "name": "Lead", "descr": "Potential client, initial contact", "parent_ids": [], "color_code": "blue"},
  {"id": 1, "name": "Active", "descr": "Active client with ongoing projects", "parent_ids": [], "color_code": "green"},
  {"id": 2, "name": "Inactive", "descr": "No current projects", "parent_ids": [], "color_code": "gray"},
  {"id": 3, "name": "Churned", "descr": "Lost client", "parent_ids": [], "color_code": "red"}
]'::jsonb),

('dl__client_service', 'Client Services', 'Wrench', '[
  {"id": 0, "name": "HVAC", "descr": "Heating, ventilation, and air conditioning services", "parent_ids": [], "color_code": "blue"},
  {"id": 1, "name": "Plumbing", "descr": "Plumbing installation and repair", "parent_ids": [], "color_code": "cyan"},
  {"id": 2, "name": "Electrical", "descr": "Electrical services", "parent_ids": [], "color_code": "yellow"},
  {"id": 3, "name": "General Contracting", "descr": "General construction and contracting", "parent_ids": [], "color_code": "orange"},
  {"id": 4, "name": "Maintenance", "descr": "Ongoing maintenance services", "parent_ids": [], "color_code": "green"}
]'::jsonb),

-- Organizational Labels
('dl__business_level', 'Business Levels', 'Building2', '[
  {"id": 0, "name": "Corporate", "descr": "Corporate headquarters level", "parent_ids": [], "color_code": "purple"},
  {"id": 1, "name": "Division", "descr": "Business division level", "parent_ids": [0], "color_code": "blue"},
  {"id": 2, "name": "Department", "descr": "Department level within division", "parent_ids": [1], "color_code": "green"}
]'::jsonb),

('dl__office_level', 'Office Levels', 'MapPin', '[
  {"id": 0, "name": "Corporate", "descr": "Corporate headquarters office", "parent_ids": [], "color_code": "purple"},
  {"id": 1, "name": "Region", "descr": "Regional office", "parent_ids": [0], "color_code": "blue"},
  {"id": 2, "name": "District", "descr": "District office", "parent_ids": [1], "color_code": "green"},
  {"id": 3, "name": "Office", "descr": "Local office or branch", "parent_ids": [2], "color_code": "gray"}
]'::jsonb),

('dl__position_level', 'Position Levels', 'Briefcase', '[
  {"id": 0, "name": "CEO/President", "descr": "Chief Executive Officer or President level", "parent_ids": [], "color_code": "purple"},
  {"id": 1, "name": "C-Level", "descr": "C-Level executives (CFO, CTO, COO, etc.)", "parent_ids": [0], "color_code": "indigo"},
  {"id": 2, "name": "SVP/EVP", "descr": "Senior/Executive Vice President level", "parent_ids": [1], "color_code": "blue"},
  {"id": 3, "name": "VP", "descr": "Vice President level", "parent_ids": [2], "color_code": "cyan"},
  {"id": 4, "name": "AVP", "descr": "Assistant Vice President level", "parent_ids": [3], "color_code": "green"},
  {"id": 5, "name": "Senior Director", "descr": "Senior Director level", "parent_ids": [4], "color_code": "yellow"},
  {"id": 6, "name": "Director", "descr": "Director level", "parent_ids": [5], "color_code": "orange"},
  {"id": 7, "name": "Associate Director", "descr": "Associate Director level (leaf)", "parent_ids": [6], "color_code": "gray"}
]'::jsonb),

-- Customer Labels
('dl__customer_tier', 'Customer Tiers', 'Award', '[
  {"id": 0, "name": "Bronze", "descr": "Bronze tier customer", "parent_ids": [], "color_code": "amber"},
  {"id": 1, "name": "Silver", "descr": "Silver tier customer", "parent_ids": [], "color_code": "gray"},
  {"id": 2, "name": "Gold", "descr": "Gold tier customer", "parent_ids": [], "color_code": "yellow"},
  {"id": 3, "name": "Platinum", "descr": "Platinum tier customer", "parent_ids": [], "color_code": "purple"}
]'::jsonb),

-- Sales/Marketing Labels
('dl__customer_opportunity_funnel', 'Customer Opportunity Funnel', 'TrendingUp', '[
  {"id": 0, "name": "Lead", "descr": "Initial lead", "parent_ids": [], "color_code": "blue"},
  {"id": 1, "name": "Qualified", "descr": "Qualified lead", "parent_ids": [0], "color_code": "cyan"},
  {"id": 2, "name": "Proposal", "descr": "Proposal sent", "parent_ids": [1], "color_code": "yellow"},
  {"id": 3, "name": "Negotiation", "descr": "Under negotiation", "parent_ids": [2], "color_code": "orange"},
  {"id": 4, "name": "Closed Won", "descr": "Deal won", "parent_ids": [3], "color_code": "green"},
  {"id": 5, "name": "Closed Lost", "descr": "Deal lost", "parent_ids": [3], "color_code": "red"}
]'::jsonb),

('dl__industry_sector', 'Industry Sectors', 'Building', '[
  {"id": 0, "name": "Residential", "descr": "Residential sector", "parent_ids": [], "color_code": "blue"},
  {"id": 1, "name": "Commercial", "descr": "Commercial sector", "parent_ids": [], "color_code": "green"},
  {"id": 2, "name": "Industrial", "descr": "Industrial sector", "parent_ids": [], "color_code": "orange"},
  {"id": 3, "name": "Government", "descr": "Government sector", "parent_ids": [], "color_code": "purple"}
]'::jsonb),

('dl__acquisition_channel', 'Acquisition Channels', 'Megaphone', '[
  {"id": 0, "name": "Organic Search", "descr": "Found via Google, Bing (SEO)", "parent_ids": [], "color_code": "green"},
  {"id": 1, "name": "Paid Search", "descr": "Google Ads, Bing Ads (PPC)", "parent_ids": [], "color_code": "red"},
  {"id": 2, "name": "Social Media", "descr": "Facebook, Instagram, LinkedIn organic", "parent_ids": [], "color_code": "blue"},
  {"id": 3, "name": "Referral", "descr": "Word-of-mouth from existing clients", "parent_ids": [], "color_code": "purple"},
  {"id": 4, "name": "Direct", "descr": "Typed URL directly, bookmarked site", "parent_ids": [], "color_code": "gray"},
  {"id": 5, "name": "Email Marketing", "descr": "Newsletter, promotional campaigns", "parent_ids": [], "color_code": "cyan"}
]'::jsonb),

-- Quote Labels
('dl__quote_stage', 'Quote Stages', 'FileText', '[
  {"id": 0, "name": "Draft", "descr": "Quote is being prepared", "parent_ids": [], "entity_name": "quote", "terminal_flag": false, "color_code": "gray"},
  {"id": 1, "name": "Sent", "descr": "Quote has been sent to customer", "parent_ids": [0], "entity_name": "quote", "terminal_flag": false, "color_code": "blue"},
  {"id": 2, "name": "Under Review", "descr": "Customer is reviewing the quote", "parent_ids": [1], "entity_name": "quote", "terminal_flag": false, "color_code": "purple"},
  {"id": 3, "name": "Negotiating", "descr": "Quote is under negotiation", "parent_ids": [2], "entity_name": "quote", "terminal_flag": false, "color_code": "yellow"},
  {"id": 4, "name": "Accepted", "descr": "Quote has been accepted by customer", "parent_ids": [3], "entity_name": "quote", "terminal_flag": true, "color_code": "green"},
  {"id": 5, "name": "Rejected", "descr": "Quote was rejected by customer", "parent_ids": [2, 3], "entity_name": "quote", "terminal_flag": true, "color_code": "red"},
  {"id": 6, "name": "Expired", "descr": "Quote validity period has expired", "parent_ids": [1, 2], "entity_name": "quote", "terminal_flag": true, "color_code": "orange"},
  {"id": 7, "name": "Cancelled", "descr": "Quote was cancelled before completion", "parent_ids": [0, 1], "entity_name": "quote", "terminal_flag": true, "color_code": "red"}
]'::jsonb),

-- Work Order Labels
('dl__work_order_status', 'Work Order Statuses', 'Wrench', '[
  {"id": 0, "name": "Scheduled", "descr": "Work order is scheduled", "parent_ids": [], "color_code": "blue"},
  {"id": 1, "name": "Confirmed", "descr": "Work order confirmed with customer", "parent_ids": [0], "color_code": "cyan"},
  {"id": 2, "name": "In Progress", "descr": "Work is actively in progress", "parent_ids": [1], "color_code": "yellow"},
  {"id": 3, "name": "On Hold", "descr": "Work temporarily on hold", "parent_ids": [2], "color_code": "orange"},
  {"id": 4, "name": "Completed", "descr": "Work has been completed", "parent_ids": [2], "color_code": "green"},
  {"id": 5, "name": "Cancelled", "descr": "Work order was cancelled", "parent_ids": [], "color_code": "red"},
  {"id": 6, "name": "Rescheduled", "descr": "Work order has been rescheduled", "parent_ids": [0], "color_code": "purple"}
]'::jsonb),

-- Service Category Labels
('dl__service_category', 'Service Categories', 'Wrench', '[
  {"id": 0, "name": "HVAC", "descr": "Heating, Ventilation, and Air Conditioning services", "parent_ids": [], "color_code": "blue"},
  {"id": 1, "name": "Plumbing", "descr": "Plumbing installation, repair, and maintenance services", "parent_ids": [], "color_code": "cyan"},
  {"id": 2, "name": "Electrical", "descr": "Electrical installation, wiring, and repair services", "parent_ids": [], "color_code": "yellow"},
  {"id": 3, "name": "Landscaping", "descr": "Landscaping, lawn care, and outdoor maintenance services", "parent_ids": [], "color_code": "green"},
  {"id": 4, "name": "General Contracting", "descr": "General contracting, renovation, and construction services", "parent_ids": [], "color_code": "orange"}
]'::jsonb),

-- Employee Labels
('dl__employee_employment_type', 'Employment Types', 'Briefcase', '[
  {"id": 0, "name": "Full-time", "descr": "Full-time permanent employee", "parent_ids": [], "color_code": "green"},
  {"id": 1, "name": "Part-time", "descr": "Part-time employee with regular schedule", "parent_ids": [], "color_code": "blue"},
  {"id": 2, "name": "Contract", "descr": "Fixed-term contract employee", "parent_ids": [], "color_code": "purple"},
  {"id": 3, "name": "Temporary", "descr": "Temporary employee for specific projects", "parent_ids": [], "color_code": "yellow"},
  {"id": 4, "name": "Intern", "descr": "Student or intern position", "parent_ids": [], "color_code": "cyan"},
  {"id": 5, "name": "Seasonal", "descr": "Seasonal worker for specific periods", "parent_ids": [], "color_code": "orange"}
]'::jsonb),

('dl__employee_security_clearance', 'Security Clearance Levels', 'Shield', '[
  {"id": 0, "name": "None", "descr": "No security clearance required", "parent_ids": [], "color_code": "gray"},
  {"id": 1, "name": "Basic", "descr": "Basic security screening completed", "parent_ids": [], "color_code": "blue"},
  {"id": 2, "name": "Standard", "descr": "Standard background check and clearance", "parent_ids": [], "color_code": "cyan"},
  {"id": 3, "name": "Enhanced", "descr": "Enhanced security clearance with detailed verification", "parent_ids": [], "color_code": "green"},
  {"id": 4, "name": "Top Secret", "descr": "Top secret clearance for sensitive operations", "parent_ids": [], "color_code": "red"},
  {"id": 5, "name": "Confidential", "descr": "Confidential level security clearance", "parent_ids": [], "color_code": "purple"}
]'::jsonb),

('dl__employee_citizenship_status', 'Citizenship Status', 'Globe', '[
  {"id": 0, "name": "Canadian Citizen", "descr": "Canadian citizen by birth or naturalization", "parent_ids": [], "color_code": "green"},
  {"id": 1, "name": "Permanent Resident", "descr": "Canadian permanent resident", "parent_ids": [], "color_code": "blue"},
  {"id": 2, "name": "Work Permit", "descr": "Work permit holder", "parent_ids": [], "color_code": "yellow"},
  {"id": 3, "name": "Temporary Foreign Worker", "descr": "Temporary foreign worker program participant", "parent_ids": [], "color_code": "orange"},
  {"id": 4, "name": "Dual Citizen", "descr": "Dual citizenship (Canada and another country)", "parent_ids": [], "color_code": "purple"}
]'::jsonb),

-- Worksite Labels
('dl__worksite_safety_rating', 'Safety Ratings', 'ShieldCheck', '[
  {"id": 0, "name": "Excellent", "descr": "Excellent safety record with no incidents", "parent_ids": [], "color_code": "green"},
  {"id": 1, "name": "Very Good", "descr": "Very good safety practices maintained", "parent_ids": [], "color_code": "blue"},
  {"id": 2, "name": "Good", "descr": "Good safety standards with minor issues", "parent_ids": [], "color_code": "cyan"},
  {"id": 3, "name": "Satisfactory", "descr": "Satisfactory but needs improvement", "parent_ids": [], "color_code": "yellow"},
  {"id": 4, "name": "Needs Improvement", "descr": "Safety practices need significant improvement", "parent_ids": [], "color_code": "orange"},
  {"id": 5, "name": "Unsatisfactory", "descr": "Unsatisfactory safety conditions", "parent_ids": [], "color_code": "red"},
  {"id": 6, "name": "Critical", "descr": "Critical safety issues requiring immediate attention", "parent_ids": [], "color_code": "red"}
]'::jsonb),

-- Artifact Labels
('dl__artifact_type', 'Artifact Types', 'FileText', '[
  {"id": 0, "name": "Document", "descr": "General document or report", "parent_ids": [], "color_code": "blue"},
  {"id": 1, "name": "Template", "descr": "Reusable template document", "parent_ids": [], "color_code": "purple"},
  {"id": 2, "name": "Image", "descr": "Image or photo file", "parent_ids": [], "color_code": "cyan"},
  {"id": 3, "name": "Video", "descr": "Video file or recording", "parent_ids": [], "color_code": "pink"},
  {"id": 4, "name": "Spreadsheet", "descr": "Spreadsheet or data file", "parent_ids": [], "color_code": "green"},
  {"id": 5, "name": "Presentation", "descr": "Presentation or slide deck", "parent_ids": [], "color_code": "orange"},
  {"id": 6, "name": "Drawing", "descr": "Technical drawing or CAD file", "parent_ids": [], "color_code": "indigo"},
  {"id": 7, "name": "Specification", "descr": "Technical specification document", "parent_ids": [], "color_code": "yellow"},
  {"id": 8, "name": "Report", "descr": "Formal report or analysis", "parent_ids": [], "color_code": "blue"},
  {"id": 9, "name": "Contract", "descr": "Legal contract or agreement", "parent_ids": [], "color_code": "red"},
  {"id": 10, "name": "Training Material", "descr": "Training documentation or materials", "parent_ids": [], "color_code": "cyan"}
]'::jsonb),

('dl__artifact_security_classification', 'Security Classifications', 'Lock', '[
  {"id": 0, "name": "General", "descr": "General information, no restrictions", "parent_ids": [], "color_code": "gray"},
  {"id": 1, "name": "Confidential", "descr": "Confidential company information", "parent_ids": [], "color_code": "yellow"},
  {"id": 2, "name": "Restricted", "descr": "Restricted access, authorized personnel only", "parent_ids": [], "color_code": "orange"},
  {"id": 3, "name": "Secret", "descr": "Secret classification, limited distribution", "parent_ids": [], "color_code": "red"},
  {"id": 4, "name": "Top Secret", "descr": "Top secret, highest level of restriction", "parent_ids": [], "color_code": "red"},
  {"id": 5, "name": "Company Confidential", "descr": "Internal company confidential information", "parent_ids": [], "color_code": "purple"}
]'::jsonb);

COMMENT ON TABLE app.setting_datalabel IS 'Unified data label table for all entity labels (stages, statuses, priorities, etc.)';
COMMENT ON COLUMN app.setting_datalabel.datalabel_name IS 'Format: dl__{entity}_{labelname} (e.g., dl__task_stage, dl__project_stage) - matches database column names exactly';
COMMENT ON COLUMN app.setting_datalabel.ui_label IS 'UI display label for settings page (e.g., "Project Stages", "Task Priorities")';
COMMENT ON COLUMN app.setting_datalabel.ui_icon IS 'Lucide icon name for UI display (e.g., "GitBranch", "Target", "TrendingUp")';
COMMENT ON COLUMN app.setting_datalabel.metadata IS 'JSONB array of label definitions: [{id, name, descr, parent_id, color_code}, ...]';
COMMENT ON COLUMN app.setting_datalabel.updated_ts IS 'Last modification timestamp';
