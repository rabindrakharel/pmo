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
-- • Services: dl__client_service_category, dl__client_service
-- • Org: dl__business_hierarchy_level, dl__office_hierarchy_level, dl__employee_position_level
-- • Product: dl__product_hierarchy_level
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
('dl__business_hierarchy_level', 'Business Hierarchy Levels', 'Building2', '[
  {"id": 0, "name": "Corporate", "descr": "Corporate headquarters level", "parent_ids": [], "color_code": "purple"},
  {"id": 1, "name": "Division", "descr": "Business division level", "parent_ids": [0], "color_code": "blue"},
  {"id": 2, "name": "Department", "descr": "Department level within division", "parent_ids": [1], "color_code": "green"}
]'::jsonb),

('dl__business_operational_status', 'Business Operational Status', 'Activity', '[
  {"id": 0, "name": "Active", "descr": "Business unit is currently active and operational", "parent_ids": [], "color_code": "green"},
  {"id": 1, "name": "Restructuring", "descr": "Business unit is undergoing restructuring", "parent_ids": [], "color_code": "yellow"},
  {"id": 2, "name": "Archived", "descr": "Business unit is archived and no longer active", "parent_ids": [], "color_code": "gray"}
]'::jsonb),

('dl__office_hierarchy_level', 'Office Hierarchy Levels', 'MapPin', '[
  {"id": 0, "name": "Corporate", "descr": "Corporate headquarters office", "parent_ids": [], "color_code": "purple"},
  {"id": 1, "name": "Region", "descr": "Regional office", "parent_ids": [0], "color_code": "blue"},
  {"id": 2, "name": "District", "descr": "District office", "parent_ids": [1], "color_code": "green"},
  {"id": 3, "name": "Office", "descr": "Local office or branch", "parent_ids": [2], "color_code": "gray"}
]'::jsonb),

-- Product Hierarchy Labels
('dl__product_hierarchy_level', 'Product Hierarchy Levels', 'Package', '[
  {"id": 0, "name": "Division", "descr": "Product division level (top-level categorization)", "parent_ids": [], "color_code": "purple"},
  {"id": 1, "name": "Department", "descr": "Product department within division", "parent_ids": [0], "color_code": "blue"},
  {"id": 2, "name": "Class", "descr": "Product class within department", "parent_ids": [1], "color_code": "green"},
  {"id": 3, "name": "Sub-Class", "descr": "Product sub-class (finest categorization)", "parent_ids": [2], "color_code": "cyan"}
]'::jsonb),

('dl__employee_position_level', 'Employee Position Levels', 'Briefcase', '[
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

('dl__customer_industry_sector', 'Customer Industry Sectors', 'Building', '[
  {"id": 0, "name": "Residential", "descr": "Residential sector", "parent_ids": [], "color_code": "blue"},
  {"id": 1, "name": "Commercial", "descr": "Commercial sector", "parent_ids": [], "color_code": "green"},
  {"id": 2, "name": "Industrial", "descr": "Industrial sector", "parent_ids": [], "color_code": "orange"},
  {"id": 3, "name": "Government", "descr": "Government sector", "parent_ids": [], "color_code": "purple"}
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

-- Client Service Category Labels
('dl__client_service_category', 'Client Service Categories', 'Wrench', '[
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
]'::jsonb),

-- Project Type Labels
('dl__project_type', 'Project Types', 'FolderOpen', '[
  {"id": 0, "name": "Residential Installation", "descr": "Installation projects for residential properties", "parent_ids": [], "color_code": "blue"},
  {"id": 1, "name": "Commercial Installation", "descr": "Installation projects for commercial properties", "parent_ids": [], "color_code": "green"},
  {"id": 2, "name": "Maintenance", "descr": "Ongoing maintenance and service projects", "parent_ids": [], "color_code": "cyan"},
  {"id": 3, "name": "Repair", "descr": "Emergency or scheduled repair projects", "parent_ids": [], "color_code": "orange"},
  {"id": 4, "name": "Renovation", "descr": "Renovation and upgrade projects", "parent_ids": [], "color_code": "purple"},
  {"id": 5, "name": "Consultation", "descr": "Consultation and assessment projects", "parent_ids": [], "color_code": "yellow"}
]'::jsonb),

-- Task Type Labels
('dl__task_type', 'Task Types', 'CheckSquare', '[
  {"id": 0, "name": "Development", "descr": "Development and implementation tasks", "parent_ids": [], "color_code": "blue"},
  {"id": 1, "name": "Testing", "descr": "Testing and quality assurance tasks", "parent_ids": [], "color_code": "cyan"},
  {"id": 2, "name": "Documentation", "descr": "Documentation and knowledge base tasks", "parent_ids": [], "color_code": "purple"},
  {"id": 3, "name": "Review", "descr": "Review and approval tasks", "parent_ids": [], "color_code": "yellow"},
  {"id": 4, "name": "Support", "descr": "Support and maintenance tasks", "parent_ids": [], "color_code": "green"},
  {"id": 5, "name": "Meeting", "descr": "Meeting and coordination tasks", "parent_ids": [], "color_code": "orange"}
]'::jsonb),

-- Employee Type Labels (alias for employment_type for frontend compatibility)
('dl__employee_type', 'Employee Types', 'Users', '[
  {"id": 0, "name": "Full-time", "descr": "Full-time permanent employee", "parent_ids": [], "color_code": "green"},
  {"id": 1, "name": "Part-time", "descr": "Part-time employee with regular schedule", "parent_ids": [], "color_code": "blue"},
  {"id": 2, "name": "Contract", "descr": "Fixed-term contract employee", "parent_ids": [], "color_code": "purple"},
  {"id": 3, "name": "Temporary", "descr": "Temporary employee for specific projects", "parent_ids": [], "color_code": "yellow"},
  {"id": 4, "name": "Intern", "descr": "Student or intern position", "parent_ids": [], "color_code": "cyan"},
  {"id": 5, "name": "Seasonal", "descr": "Seasonal worker for specific periods", "parent_ids": [], "color_code": "orange"}
]'::jsonb),

-- Wiki Type Labels
('dl__wiki_type', 'Wiki Types', 'BookOpen', '[
  {"id": 0, "name": "Documentation", "descr": "Technical documentation and guides", "parent_ids": [], "color_code": "blue"},
  {"id": 1, "name": "Knowledge Base", "descr": "Knowledge base articles", "parent_ids": [], "color_code": "purple"},
  {"id": 2, "name": "Tutorial", "descr": "Step-by-step tutorials and how-tos", "parent_ids": [], "color_code": "green"},
  {"id": 3, "name": "Best Practices", "descr": "Best practices and standards", "parent_ids": [], "color_code": "cyan"},
  {"id": 4, "name": "Policy", "descr": "Company policies and procedures", "parent_ids": [], "color_code": "red"},
  {"id": 5, "name": "FAQ", "descr": "Frequently asked questions", "parent_ids": [], "color_code": "yellow"}
]'::jsonb),

-- Office Type Labels
('dl__office_type', 'Office Types', 'Building', '[
  {"id": 0, "name": "Corporate HQ", "descr": "Corporate headquarters office", "parent_ids": [], "color_code": "purple"},
  {"id": 1, "name": "Regional Office", "descr": "Regional office managing multiple branches", "parent_ids": [], "color_code": "blue"},
  {"id": 2, "name": "Branch Office", "descr": "Local branch office serving specific area", "parent_ids": [], "color_code": "green"},
  {"id": 3, "name": "Service Center", "descr": "Service and support center", "parent_ids": [], "color_code": "cyan"},
  {"id": 4, "name": "Warehouse", "descr": "Warehouse and distribution center", "parent_ids": [], "color_code": "orange"},
  {"id": 5, "name": "Remote", "descr": "Remote or virtual office", "parent_ids": [], "color_code": "gray"}
]'::jsonb),

-- Business Type Labels
('dl__business_type', 'Business Types', 'Briefcase', '[
  {"id": 0, "name": "HVAC Services", "descr": "Heating, ventilation, and air conditioning services", "parent_ids": [], "color_code": "blue"},
  {"id": 1, "name": "Plumbing Services", "descr": "Plumbing installation and repair services", "parent_ids": [], "color_code": "cyan"},
  {"id": 2, "name": "Electrical Services", "descr": "Electrical installation and maintenance", "parent_ids": [], "color_code": "yellow"},
  {"id": 3, "name": "General Contracting", "descr": "General construction and contracting", "parent_ids": [], "color_code": "orange"},
  {"id": 4, "name": "Property Management", "descr": "Property management and maintenance", "parent_ids": [], "color_code": "green"},
  {"id": 5, "name": "Facility Services", "descr": "Facility management and services", "parent_ids": [], "color_code": "purple"}
]'::jsonb),

-- Employee Skill Level Labels
('dl__employee_skill_level', 'Employee Skill Levels', 'Star', '[
  {"id": 0, "name": "Beginner", "descr": "Beginner level, basic understanding", "parent_ids": [], "color_code": "gray"},
  {"id": 1, "name": "Intermediate", "descr": "Intermediate level, practical experience", "parent_ids": [], "color_code": "blue"},
  {"id": 2, "name": "Advanced", "descr": "Advanced level, strong proficiency", "parent_ids": [], "color_code": "cyan"},
  {"id": 3, "name": "Expert", "descr": "Expert level, deep expertise", "parent_ids": [], "color_code": "green"},
  {"id": 4, "name": "Master", "descr": "Master level, industry authority", "parent_ids": [], "color_code": "purple"}
]'::jsonb),

-- Product Category Labels
('dl__product_category', 'Product Categories', 'Package', '[
  {"id": 0, "name": "HVAC Equipment", "descr": "Heating and cooling equipment", "parent_ids": [], "color_code": "blue"},
  {"id": 1, "name": "Plumbing Fixtures", "descr": "Plumbing fixtures and fittings", "parent_ids": [], "color_code": "cyan"},
  {"id": 2, "name": "Electrical Components", "descr": "Electrical components and supplies", "parent_ids": [], "color_code": "yellow"},
  {"id": 3, "name": "Tools", "descr": "Tools and equipment", "parent_ids": [], "color_code": "orange"},
  {"id": 4, "name": "Parts", "descr": "Replacement parts and components", "parent_ids": [], "color_code": "green"},
  {"id": 5, "name": "Materials", "descr": "Construction and installation materials", "parent_ids": [], "color_code": "purple"}
]'::jsonb),

-- Product Brand Labels
('dl__product_brand', 'Product Brands', 'Tag', '[
  {"id": 0, "name": "Carrier", "descr": "Carrier HVAC systems", "parent_ids": [], "color_code": "blue"},
  {"id": 1, "name": "Trane", "descr": "Trane heating and cooling", "parent_ids": [], "color_code": "red"},
  {"id": 2, "name": "Lennox", "descr": "Lennox comfort systems", "parent_ids": [], "color_code": "orange"},
  {"id": 3, "name": "Rheem", "descr": "Rheem water heating", "parent_ids": [], "color_code": "purple"},
  {"id": 4, "name": "Kohler", "descr": "Kohler plumbing fixtures", "parent_ids": [], "color_code": "green"},
  {"id": 5, "name": "Delta", "descr": "Delta faucets and fixtures", "parent_ids": [], "color_code": "cyan"}
]'::jsonb),

-- Product Item Level Labels (for product hierarchy)
('dl__product_item_level', 'Product Item Levels', 'Layers', '[
  {"id": 0, "name": "Category", "descr": "Top-level category classification", "parent_ids": [], "color_code": "purple"},
  {"id": 1, "name": "Subcategory", "descr": "Subcategory within category", "parent_ids": [0], "color_code": "blue"},
  {"id": 2, "name": "Product Line", "descr": "Product line within subcategory", "parent_ids": [1], "color_code": "green"},
  {"id": 3, "name": "SKU", "descr": "Individual SKU item", "parent_ids": [2], "color_code": "cyan"}
]'::jsonb),

-- Financial Transaction Level Labels (for financial transactions)
('dl__financial_transaction_level', 'Financial Transaction Levels', 'DollarSign', '[
  {"id": 0, "name": "Micro", "descr": "Micro transactions under $100", "parent_ids": [], "color_code": "gray"},
  {"id": 1, "name": "Small", "descr": "Small transactions $100-$1,000", "parent_ids": [], "color_code": "blue"},
  {"id": 2, "name": "Medium", "descr": "Medium transactions $1,000-$10,000", "parent_ids": [], "color_code": "green"},
  {"id": 3, "name": "Large", "descr": "Large transactions $10,000-$100,000", "parent_ids": [], "color_code": "yellow"},
  {"id": 4, "name": "Enterprise", "descr": "Enterprise transactions over $100,000", "parent_ids": [], "color_code": "purple"}
]'::jsonb),

-- Event Type Labels
('dl__event_type', 'Event Types', 'Calendar', '[
  {"id": 0, "name": "Meeting", "descr": "Team or client meetings", "parent_ids": [], "color_code": "blue"},
  {"id": 1, "name": "Service Call", "descr": "Scheduled service call", "parent_ids": [], "color_code": "green"},
  {"id": 2, "name": "Training", "descr": "Training session or workshop", "parent_ids": [], "color_code": "purple"},
  {"id": 3, "name": "Inspection", "descr": "Inspection or site visit", "parent_ids": [], "color_code": "orange"},
  {"id": 4, "name": "Consultation", "descr": "Client consultation", "parent_ids": [], "color_code": "cyan"},
  {"id": 5, "name": "Installation", "descr": "Installation appointment", "parent_ids": [], "color_code": "yellow"}
]'::jsonb),

-- Person Entity Type Labels (for person-calendar system)
('dl__person_entity_type', 'Person Entity Types', 'User', '[
  {"id": 0, "name": "Employee", "descr": "Internal employee", "parent_ids": [], "color_code": "blue"},
  {"id": 1, "name": "Client", "descr": "External client or customer", "parent_ids": [], "color_code": "green"},
  {"id": 2, "name": "Contractor", "descr": "External contractor or vendor", "parent_ids": [], "color_code": "purple"},
  {"id": 3, "name": "Partner", "descr": "Business partner", "parent_ids": [], "color_code": "cyan"}
]'::jsonb),

-- Interaction Type Labels
('dl__interaction_type', 'Interaction Types', 'MessageSquare', '[
  {"id": 0, "name": "Phone Call", "descr": "Phone conversation with client", "parent_ids": [], "color_code": "blue"},
  {"id": 1, "name": "Email", "descr": "Email correspondence", "parent_ids": [], "color_code": "cyan"},
  {"id": 2, "name": "Meeting", "descr": "In-person or virtual meeting", "parent_ids": [], "color_code": "purple"},
  {"id": 3, "name": "Site Visit", "descr": "On-site visit to client location", "parent_ids": [], "color_code": "orange"},
  {"id": 4, "name": "SMS", "descr": "Text message communication", "parent_ids": [], "color_code": "green"},
  {"id": 5, "name": "Chat", "descr": "Live chat or instant messaging", "parent_ids": [], "color_code": "yellow"}
]'::jsonb),

-- Interaction Category Labels
('dl__interaction_category', 'Interaction Categories', 'Tag', '[
  {"id": 0, "name": "Sales", "descr": "Sales-related interaction", "parent_ids": [], "color_code": "green"},
  {"id": 1, "name": "Support", "descr": "Customer support interaction", "parent_ids": [], "color_code": "blue"},
  {"id": 2, "name": "Follow-up", "descr": "Follow-up after service or sale", "parent_ids": [], "color_code": "cyan"},
  {"id": 3, "name": "Complaint", "descr": "Customer complaint or issue", "parent_ids": [], "color_code": "red"},
  {"id": 4, "name": "Feedback", "descr": "Customer feedback or review", "parent_ids": [], "color_code": "purple"},
  {"id": 5, "name": "Inquiry", "descr": "General inquiry or question", "parent_ids": [], "color_code": "yellow"}
]'::jsonb),

-- Form Type Labels
('dl__form_type', 'Form Types', 'FileText', '[
  {"id": 0, "name": "Service Request", "descr": "Service request form", "parent_ids": [], "color_code": "blue"},
  {"id": 1, "name": "Quote Request", "descr": "Quote or estimate request", "parent_ids": [], "color_code": "green"},
  {"id": 2, "name": "Work Order", "descr": "Work order form", "parent_ids": [], "color_code": "orange"},
  {"id": 3, "name": "Inspection Report", "descr": "Inspection or assessment report", "parent_ids": [], "color_code": "purple"},
  {"id": 4, "name": "Feedback", "descr": "Customer feedback form", "parent_ids": [], "color_code": "cyan"},
  {"id": 5, "name": "Complaint", "descr": "Complaint or issue report", "parent_ids": [], "color_code": "red"}
]'::jsonb),

-- Customer Type Labels (alias for compatibility)
('dl__cust_type', 'Customer Types', 'Users', '[
  {"id": 0, "name": "Residential", "descr": "Residential homeowner customer", "parent_ids": [], "color_code": "blue"},
  {"id": 1, "name": "Commercial", "descr": "Commercial business customer", "parent_ids": [], "color_code": "green"},
  {"id": 2, "name": "Industrial", "descr": "Industrial or manufacturing customer", "parent_ids": [], "color_code": "orange"},
  {"id": 3, "name": "Government", "descr": "Government or public sector customer", "parent_ids": [], "color_code": "purple"},
  {"id": 4, "name": "Non-Profit", "descr": "Non-profit organization customer", "parent_ids": [], "color_code": "cyan"}
]'::jsonb),

-- Customer Status Labels (alias for compatibility, duplicates dl__client_status)
('dl__cust_status', 'Customer Statuses', 'Users', '[
  {"id": 0, "name": "Lead", "descr": "Potential customer, initial contact", "parent_ids": [], "color_code": "blue"},
  {"id": 1, "name": "Active", "descr": "Active customer with ongoing projects", "parent_ids": [], "color_code": "green"},
  {"id": 2, "name": "Inactive", "descr": "No current projects", "parent_ids": [], "color_code": "gray"},
  {"id": 3, "name": "Churned", "descr": "Lost customer", "parent_ids": [], "color_code": "red"}
]'::jsonb),

-- Customer Acquisition Channel (proper naming with entity prefix)
('dl__customer_acquisition_channel', 'Customer Acquisition Channels', 'Megaphone', '[
  {"id": 0, "name": "Organic Search", "descr": "Found via Google, Bing (SEO)", "parent_ids": [], "color_code": "green"},
  {"id": 1, "name": "Paid Search", "descr": "Google Ads, Bing Ads (PPC)", "parent_ids": [], "color_code": "red"},
  {"id": 2, "name": "Social Media", "descr": "Facebook, Instagram, LinkedIn organic", "parent_ids": [], "color_code": "blue"},
  {"id": 3, "name": "Referral", "descr": "Word-of-mouth from existing clients", "parent_ids": [], "color_code": "purple"},
  {"id": 4, "name": "Direct", "descr": "Typed URL directly, bookmarked site", "parent_ids": [], "color_code": "gray"},
  {"id": 5, "name": "Email Marketing", "descr": "Newsletter, promotional campaigns", "parent_ids": [], "color_code": "cyan"}
]'::jsonb),

-- Project Risk Level Labels
('dl__project_risk_level', 'Project Risk Levels', 'AlertTriangle', '[
  {"id": 0, "name": "Very Low", "descr": "Minimal risk, routine monitoring", "parent_ids": [], "color_code": "green"},
  {"id": 1, "name": "Low", "descr": "Low risk, standard procedures", "parent_ids": [], "color_code": "blue"},
  {"id": 2, "name": "Medium", "descr": "Medium risk, requires attention", "parent_ids": [], "color_code": "yellow"},
  {"id": 3, "name": "High", "descr": "High risk, requires mitigation plan", "parent_ids": [], "color_code": "orange"},
  {"id": 4, "name": "Critical", "descr": "Critical risk, immediate action required", "parent_ids": [], "color_code": "red"}
]'::jsonb),

-- Office Operational Status Labels
('dl__office_operational_status', 'Office Operational Statuses', 'Activity', '[
  {"id": 0, "name": "Active", "descr": "Currently active and operational", "parent_ids": [], "color_code": "green"},
  {"id": 1, "name": "Inactive", "descr": "Temporarily inactive", "parent_ids": [], "color_code": "gray"},
  {"id": 2, "name": "Maintenance", "descr": "Under maintenance", "parent_ids": [], "color_code": "yellow"},
  {"id": 3, "name": "Archived", "descr": "Archived and no longer in use", "parent_ids": [], "color_code": "red"}
]'::jsonb),

-- Document Security Classification Labels
('dl__document_security_classification', 'Document Security Classifications', 'Shield', '[
  {"id": 0, "name": "Public", "descr": "Public information, no restrictions", "parent_ids": [], "color_code": "green"},
  {"id": 1, "name": "Internal", "descr": "Internal use only", "parent_ids": [], "color_code": "blue"},
  {"id": 2, "name": "Confidential", "descr": "Confidential information", "parent_ids": [], "color_code": "yellow"},
  {"id": 3, "name": "Restricted", "descr": "Restricted access", "parent_ids": [], "color_code": "orange"},
  {"id": 4, "name": "Secret", "descr": "Secret classification", "parent_ids": [], "color_code": "red"}
]'::jsonb),

-- Document Publication Status Labels
('dl__document_publication_status', 'Document Publication Statuses', 'FileText', '[
  {"id": 0, "name": "Draft", "descr": "Draft state, not published", "parent_ids": [], "color_code": "gray"},
  {"id": 1, "name": "Review", "descr": "Under review", "parent_ids": [0], "color_code": "yellow"},
  {"id": 2, "name": "Published", "descr": "Published and visible", "parent_ids": [1], "color_code": "green"},
  {"id": 3, "name": "Archived", "descr": "Archived but accessible", "parent_ids": [2], "color_code": "blue"}
]'::jsonb),

-- Project Operational Status Labels
('dl__project_operational_status', 'Project Operational Statuses', 'Activity', '[
  {"id": 0, "name": "Active", "descr": "Currently active and operational", "parent_ids": [], "color_code": "green"},
  {"id": 1, "name": "Inactive", "descr": "Temporarily inactive", "parent_ids": [], "color_code": "gray"},
  {"id": 2, "name": "Maintenance", "descr": "Under maintenance", "parent_ids": [], "color_code": "yellow"},
  {"id": 3, "name": "Archived", "descr": "Archived and no longer in use", "parent_ids": [], "color_code": "red"}
]'::jsonb),

-- Artifact Publication Status Labels
('dl__artifact_publication_status', 'Artifact Publication Statuses', 'FileText', '[
  {"id": 0, "name": "Draft", "descr": "Draft state, not published", "parent_ids": [], "color_code": "gray"},
  {"id": 1, "name": "Review", "descr": "Under review", "parent_ids": [0], "color_code": "yellow"},
  {"id": 2, "name": "Published", "descr": "Published and visible", "parent_ids": [1], "color_code": "green"},
  {"id": 3, "name": "Archived", "descr": "Archived but accessible", "parent_ids": [2], "color_code": "blue"}
]'::jsonb),

-- System Entity Type Labels (for entity registry/metadata)
('dl__system_entity_type', 'System Entity Types', 'Database', '[
  {"id": 0, "name": "Project", "descr": "Project entity type", "parent_ids": [], "color_code": "blue"},
  {"id": 1, "name": "Task", "descr": "Task entity type", "parent_ids": [], "color_code": "green"},
  {"id": 2, "name": "Client", "descr": "Client entity type", "parent_ids": [], "color_code": "purple"},
  {"id": 3, "name": "Employee", "descr": "Employee entity type", "parent_ids": [], "color_code": "cyan"},
  {"id": 4, "name": "Office", "descr": "Office entity type", "parent_ids": [], "color_code": "orange"},
  {"id": 5, "name": "Business", "descr": "Business entity type", "parent_ids": [], "color_code": "indigo"}
]'::jsonb),

-- Project Security Classification Labels
('dl__project_security_classification', 'Project Security Classifications', 'Shield', '[
  {"id": 0, "name": "Public", "descr": "Public information, no restrictions", "parent_ids": [], "color_code": "green"},
  {"id": 1, "name": "Internal", "descr": "Internal use only", "parent_ids": [], "color_code": "blue"},
  {"id": 2, "name": "Confidential", "descr": "Confidential information", "parent_ids": [], "color_code": "yellow"},
  {"id": 3, "name": "Restricted", "descr": "Restricted access", "parent_ids": [], "color_code": "orange"},
  {"id": 4, "name": "Secret", "descr": "Secret classification", "parent_ids": [], "color_code": "red"}
]'::jsonb),

-- Revenue Category Labels (CRA T2125 Based)
('dl__revenue_category', 'Revenue Categories', 'TrendingUp', '[
  {"id": 0, "name": "Sales, Commissions, or Fees", "descr": "Revenue from sales, commissions, or fees for services", "parent_ids": [], "color_code": "green"},
  {"id": 1, "name": "Other Income", "descr": "Miscellaneous income, refunds, rebates, rental income", "parent_ids": [], "color_code": "blue"},
  {"id": 2, "name": "Interest Income", "descr": "Interest earned from bank accounts and investments", "parent_ids": [], "color_code": "cyan"},
  {"id": 3, "name": "Grants or Subsidies", "descr": "Government grants, wage subsidies, training grants", "parent_ids": [], "color_code": "purple"},
  {"id": 4, "name": "Inventory Adjustments", "descr": "Inventory gains and write-down reversals", "parent_ids": [], "color_code": "yellow"}
]'::jsonb),

-- Revenue Subcategory Labels (CRA T2125 Based)
('dl__revenue_subcategory', 'Revenue Subcategories', 'DollarSign', '[
  {"id": 0, "name": "Retail Sales", "descr": "Revenue from selling goods at retail", "parent_ids": [], "color_code": "green"},
  {"id": 1, "name": "Wholesale Sales", "descr": "Revenue from wholesale of goods", "parent_ids": [], "color_code": "green"},
  {"id": 2, "name": "Online Sales", "descr": "Revenue from online channels", "parent_ids": [], "color_code": "green"},
  {"id": 3, "name": "Service Income", "descr": "Fees for services performed", "parent_ids": [], "color_code": "green"},
  {"id": 4, "name": "Project Income", "descr": "Milestone or contract-based revenue", "parent_ids": [], "color_code": "green"},
  {"id": 5, "name": "Commissions Earned", "descr": "Income from commissions", "parent_ids": [], "color_code": "green"},
  {"id": 6, "name": "Miscellaneous Income", "descr": "Non-core income not captured elsewhere", "parent_ids": [], "color_code": "blue"},
  {"id": 7, "name": "Refunds and Rebates", "descr": "Supplier rebates, cashbacks", "parent_ids": [], "color_code": "blue"},
  {"id": 8, "name": "Rental Income", "descr": "Income from leasing property/equipment", "parent_ids": [], "color_code": "blue"},
  {"id": 9, "name": "Bank Interest", "descr": "Interest earned on deposits", "parent_ids": [], "color_code": "cyan"},
  {"id": 10, "name": "Investment Interest", "descr": "Interest from investments", "parent_ids": [], "color_code": "cyan"},
  {"id": 11, "name": "Government Wage Subsidy", "descr": "Government wage or business subsidies", "parent_ids": [], "color_code": "purple"},
  {"id": 12, "name": "Training or Program Grant", "descr": "Government or program training grant", "parent_ids": [], "color_code": "purple"},
  {"id": 13, "name": "Inventory Gain", "descr": "Positive adjustment due to count/valuation", "parent_ids": [], "color_code": "yellow"},
  {"id": 14, "name": "Inventory Write-Down Reversal", "descr": "Reversal of prior write-down", "parent_ids": [], "color_code": "yellow"}
]'::jsonb),

-- Expense Category Labels (CRA T2125 Based)
('dl__expense_category', 'Expense Categories', 'Receipt', '[
  {"id": 0, "name": "Advertising", "descr": "Promotional and advertising costs (CRA Line 8521)", "parent_ids": [], "color_code": "blue"},
  {"id": 1, "name": "Meals and Entertainment (50%)", "descr": "Meals/entertainment with 50% deductibility (CRA Line 8523)", "parent_ids": [], "color_code": "orange"}
]'::jsonb),

-- Expense Subcategory Labels (CRA T2125 Based)
('dl__expense_subcategory', 'Expense Subcategories', 'FileText', '[
  {"id": 0, "name": "Google Ads", "descr": "Google advertising campaigns", "parent_ids": [], "color_code": "blue"},
  {"id": 1, "name": "Facebook/Instagram Ads", "descr": "Social media advertising", "parent_ids": [], "color_code": "blue"},
  {"id": 2, "name": "Print – Flyers/Brochures", "descr": "Print advertising materials", "parent_ids": [], "color_code": "blue"},
  {"id": 3, "name": "Radio Advertising", "descr": "Radio ad campaigns", "parent_ids": [], "color_code": "blue"},
  {"id": 4, "name": "TV Advertising", "descr": "Television advertising", "parent_ids": [], "color_code": "blue"},
  {"id": 5, "name": "Sponsorships", "descr": "Event and organization sponsorships", "parent_ids": [], "color_code": "blue"},
  {"id": 6, "name": "Website Promotions/SEO", "descr": "Website promotion and SEO services", "parent_ids": [], "color_code": "blue"},
  {"id": 7, "name": "Business Meals", "descr": "Business meals with clients/prospects (50% deductible)", "parent_ids": [], "color_code": "orange"},
  {"id": 8, "name": "Client Entertainment", "descr": "Client entertainment events (50% deductible)", "parent_ids": [], "color_code": "orange"},
  {"id": 9, "name": "Staff Functions (50%)", "descr": "Staff functions and team meals (50% deductible)", "parent_ids": [], "color_code": "orange"}
]'::jsonb),

-- Expense Code Labels (CRA T2125 Line Items)
('dl__expense_code', 'Expense Codes (CRA T2125)', 'Hash', '[
  {"id": 8521, "name": "8521 - Advertising", "descr": "Advertising and promotion expenses", "parent_ids": [], "color_code": "blue"},
  {"id": 8523, "name": "8523 - Meals and Entertainment (50%)", "descr": "Business meals and entertainment (50% deductible)", "parent_ids": [], "color_code": "orange"},
  {"id": 8590, "name": "8590 - Bad Debts", "descr": "Bad debts written off", "parent_ids": [], "color_code": "red"},
  {"id": 8690, "name": "8690 - Insurance", "descr": "Business insurance premiums", "parent_ids": [], "color_code": "purple"},
  {"id": 8710, "name": "8710 - Interest and Bank Charges", "descr": "Interest on business loans and bank fees", "parent_ids": [], "color_code": "cyan"},
  {"id": 8750, "name": "8750 - Business Tax, Fees, Licenses", "descr": "Business taxes and licenses", "parent_ids": [], "color_code": "gray"},
  {"id": 8760, "name": "8760 - Office Expenses", "descr": "Office supplies and expenses", "parent_ids": [], "color_code": "blue"},
  {"id": 8810, "name": "8810 - Professional Fees", "descr": "Legal, accounting, consulting fees", "parent_ids": [], "color_code": "purple"},
  {"id": 8871, "name": "8871 - Rent", "descr": "Rent for business premises", "parent_ids": [], "color_code": "green"},
  {"id": 9270, "name": "9270 - Salaries and Wages", "descr": "Employee salaries and wages", "parent_ids": [], "color_code": "yellow"},
  {"id": 9281, "name": "9281 - Subcontractors", "descr": "Payments to subcontractors", "parent_ids": [], "color_code": "orange"},
  {"id": 9945, "name": "9945 - Telephone and Utilities", "descr": "Phone, internet, utilities", "parent_ids": [], "color_code": "cyan"},
  {"id": 9936, "name": "9936 - Travel", "descr": "Business travel expenses", "parent_ids": [], "color_code": "blue"},
  {"id": 8860, "name": "8860 - Property Taxes", "descr": "Property taxes for business property", "parent_ids": [], "color_code": "gray"},
  {"id": 8960, "name": "8960 - Management and Administration", "descr": "Management and administrative fees", "parent_ids": [], "color_code": "purple"},
  {"id": 9200, "name": "9200 - Repairs and Maintenance", "descr": "Repairs and maintenance", "parent_ids": [], "color_code": "orange"},
  {"id": 9220, "name": "9220 - Motor Vehicle Expenses", "descr": "Vehicle fuel, insurance, repairs", "parent_ids": [], "color_code": "red"},
  {"id": 9224, "name": "9224 - Fuel Costs", "descr": "Fuel costs for business vehicles", "parent_ids": [], "color_code": "orange"},
  {"id": 9275, "name": "9275 - Employee Benefits", "descr": "Employee benefits and perks", "parent_ids": [], "color_code": "green"},
  {"id": 9350, "name": "9350 - Delivery, Freight, and Express", "descr": "Shipping and delivery costs", "parent_ids": [], "color_code": "blue"},
  {"id": 9819, "name": "9819 - Other Expenses", "descr": "Miscellaneous business expenses", "parent_ids": [], "color_code": "gray"}
]'::jsonb);

COMMENT ON TABLE app.setting_datalabel IS 'Unified data label table for all entity labels (stages, statuses, priorities, etc.)';
COMMENT ON COLUMN app.setting_datalabel.datalabel_name IS 'Format: dl__{entity}_{labelname} (e.g., dl__task_stage, dl__project_stage) - matches database column names exactly';
COMMENT ON COLUMN app.setting_datalabel.ui_label IS 'UI display label for settings page (e.g., "Project Stages", "Task Priorities")';
COMMENT ON COLUMN app.setting_datalabel.ui_icon IS 'Lucide icon name for UI display (e.g., "GitBranch", "Target", "TrendingUp")';
COMMENT ON COLUMN app.setting_datalabel.metadata IS 'JSONB array of label definitions: [{id, name, descr, parent_id, color_code}, ...]';
COMMENT ON COLUMN app.setting_datalabel.updated_ts IS 'Last modification timestamp';
