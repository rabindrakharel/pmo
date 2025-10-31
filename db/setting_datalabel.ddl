-- ============================================================================
-- UNIFIED SETTING DATA LABEL TABLE
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Unified table for ALL entity data labels (stages, statuses, priorities, etc.)
--   Replaces 17 separate setting_datalabel_* tables with ONE DRY table.
--   Uses JSONB metadata array to store normalized label data.
--
-- Structure:
--   - datalabel_name: dl__{entity}_{labelname} format (e.g., 'dl__task_stage', 'dl__project_stage')
--   - metadata: JSONB array of label definitions
--   - updated_ts: Last modification timestamp
--
-- Metadata Array Format:
--   [
--     {
--       "id": 0,
--       "name": "Initiation",
--       "descr": "Project concept and initial planning",
--       "parent_id": null,
--       "color_code": "blue",
--       "updated_ts": "2025-10-29T14:00:16.547Z"
--     },
--     ...
--   ]
--
-- Entity-Label Combinations:
--   - dl__task_stage, dl__task_priority, dl__task_update_type
--   - dl__project_stage
--   - dl__form_submission_status, dl__form_approval_status
--   - dl__wiki_publication_status
--   - dl__client_status, dl__client_service
--   - dl__business_level
--   - dl__office_level
--   - dl__position_level
--   - dl__customer_tier
--   - dl__opportunity_funnel_stage
--   - dl__industry_sector
--   - dl__acquisition_channel
--
-- Integration Points:
--   - API endpoint: GET /api/v1/setting?category=dl__task_stage
--   - Frontend: loadOptionsFromSettings('dl__task_stage')
--   - Forms: Auto-populated dropdowns
--   - Tables: Badge rendering with color_code
--
-- Benefits:
--   - DRY: Single table instead of 17 separate tables
--   - Flexible: Easy to add new entity-label combinations
--   - Maintainable: Centralized data label management
--   - Performant: JSONB indexing for fast queries
--

CREATE TABLE app.setting_datalabel (
    datalabel_name VARCHAR(100) PRIMARY KEY,
    ui_label VARCHAR(100) NOT NULL,
    ui_icon VARCHAR(50),
    metadata JSONB NOT NULL,
    updated_ts TIMESTAMPTZ DEFAULT now()
);

-- Index for JSONB queries (for filtering by color_code, searching names, etc.)
CREATE INDEX idx_setting_datalabel_metadata ON app.setting_datalabel USING GIN (metadata);

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
  {"id": 0, "name": "Backlog", "descr": "Tasks in backlog, not yet started", "parent_id": null, "color_code": "gray"},
  {"id": 1, "name": "Planning", "descr": "Tasks in planning phase", "parent_id": null, "color_code": "purple"},
  {"id": 2, "name": "To Do", "descr": "Tasks ready to start", "parent_id": null, "color_code": "blue"},
  {"id": 3, "name": "In Progress", "descr": "Tasks actively being worked on", "parent_id": 2, "color_code": "yellow"},
  {"id": 4, "name": "In Review", "descr": "Tasks under review", "parent_id": 3, "color_code": "cyan"},
  {"id": 5, "name": "Completed", "descr": "Tasks completed successfully", "parent_id": 4, "color_code": "green"},
  {"id": 6, "name": "Blocked", "descr": "Tasks blocked by dependencies", "parent_id": 3, "color_code": "red"}
]'::jsonb),

('dl__task_priority', 'Task Priorities', 'TrendingUp', '[
  {"id": 0, "name": "low", "descr": "Low priority - can be scheduled flexibly", "parent_id": null, "color_code": "green"},
  {"id": 1, "name": "medium", "descr": "Medium priority - normal scheduling", "parent_id": null, "color_code": "yellow"},
  {"id": 2, "name": "high", "descr": "High priority - requires prompt attention", "parent_id": null, "color_code": "orange"},
  {"id": 3, "name": "critical", "descr": "Critical priority - urgent and blocking", "parent_id": null, "color_code": "red"}
]'::jsonb),

('dl__task_update_type', 'Task Update Types', 'Bell', '[
  {"id": 0, "name": "Status Change", "descr": "Task status was changed", "parent_id": null, "color_code": "blue"},
  {"id": 1, "name": "Comment", "descr": "Comment added to task", "parent_id": null, "color_code": "gray"},
  {"id": 2, "name": "Assignment", "descr": "Task assigned to employee", "parent_id": null, "color_code": "purple"},
  {"id": 3, "name": "Due Date", "descr": "Due date changed", "parent_id": null, "color_code": "yellow"}
]'::jsonb),

-- Project Labels
('dl__project_stage', 'Project Stages', 'GitBranch', '[
  {"id": 0, "name": "Initiation", "descr": "Project concept and initial planning. Starting point for all projects.", "parent_id": null, "color_code": "blue"},
  {"id": 1, "name": "Planning", "descr": "Detailed project planning and resource allocation. Follows project approval.", "parent_id": 0, "color_code": "purple"},
  {"id": 2, "name": "Execution", "descr": "Active project execution phase. Work is being performed by the project team.", "parent_id": 1, "color_code": "yellow"},
  {"id": 3, "name": "Monitoring", "descr": "Project monitoring and control. Tracking progress and managing changes.", "parent_id": 2, "color_code": "orange"},
  {"id": 4, "name": "Closure", "descr": "Project completion and closure activities. Final deliverables and documentation.", "parent_id": 3, "color_code": "green"},
  {"id": 5, "name": "On Hold", "descr": "Project temporarily suspended. Can resume to Execution or Planning stages.", "parent_id": 2, "color_code": "gray"},
  {"id": 6, "name": "Cancelled", "descr": "Project cancelled before completion. Terminal state with no forward transitions.", "parent_id": null, "color_code": "red"}
]'::jsonb),

-- Form Labels
('dl__form_submission_status', 'Form Submission Statuses', 'FileCheck', '[
  {"id": 0, "name": "draft", "descr": "Form is in draft state", "parent_id": null, "color_code": "yellow"},
  {"id": 1, "name": "submitted", "descr": "Form has been submitted", "parent_id": 0, "color_code": "blue"},
  {"id": 2, "name": "under_review", "descr": "Form is under review", "parent_id": 1, "color_code": "purple"},
  {"id": 3, "name": "approved", "descr": "Form has been approved", "parent_id": 2, "color_code": "green"},
  {"id": 4, "name": "rejected", "descr": "Form has been rejected", "parent_id": 2, "color_code": "red"},
  {"id": 5, "name": "withdrawn", "descr": "Form has been withdrawn", "parent_id": 1, "color_code": "gray"}
]'::jsonb),

('dl__form_approval_status', 'Form Approval Statuses', 'CheckCircle', '[
  {"id": 0, "name": "pending", "descr": "Awaiting approval", "parent_id": null, "color_code": "yellow"},
  {"id": 1, "name": "approved", "descr": "Approval granted", "parent_id": null, "color_code": "green"},
  {"id": 2, "name": "rejected", "descr": "Approval rejected", "parent_id": null, "color_code": "red"},
  {"id": 3, "name": "conditional", "descr": "Conditionally approved", "parent_id": null, "color_code": "orange"},
  {"id": 4, "name": "escalated", "descr": "Escalated to higher authority", "parent_id": null, "color_code": "purple"}
]'::jsonb),

-- Wiki Labels
('dl__wiki_publication_status', 'Wiki Publication Statuses', 'BookOpen', '[
  {"id": 0, "name": "draft", "descr": "Wiki page in draft", "parent_id": null, "color_code": "yellow"},
  {"id": 1, "name": "review", "descr": "Under review", "parent_id": 0, "color_code": "blue"},
  {"id": 2, "name": "published", "descr": "Published and visible", "parent_id": 1, "color_code": "green"},
  {"id": 3, "name": "archived", "descr": "Archived but accessible", "parent_id": null, "color_code": "gray"},
  {"id": 4, "name": "deprecated", "descr": "Deprecated, should not be used", "parent_id": null, "color_code": "red"},
  {"id": 5, "name": "private", "descr": "Private, restricted access", "parent_id": null, "color_code": "purple"}
]'::jsonb),

-- Client Labels
('dl__client_status', 'Client Statuses', 'Users', '[
  {"id": 0, "name": "Lead", "descr": "Potential client, initial contact", "parent_id": null, "color_code": "blue"},
  {"id": 1, "name": "Active", "descr": "Active client with ongoing projects", "parent_id": null, "color_code": "green"},
  {"id": 2, "name": "Inactive", "descr": "No current projects", "parent_id": null, "color_code": "gray"},
  {"id": 3, "name": "Churned", "descr": "Lost client", "parent_id": null, "color_code": "red"}
]'::jsonb),

('dl__client_service', 'Client Services', 'Wrench', '[
  {"id": 0, "name": "HVAC", "descr": "Heating, ventilation, and air conditioning services", "parent_id": null, "color_code": "blue"},
  {"id": 1, "name": "Plumbing", "descr": "Plumbing installation and repair", "parent_id": null, "color_code": "cyan"},
  {"id": 2, "name": "Electrical", "descr": "Electrical services", "parent_id": null, "color_code": "yellow"},
  {"id": 3, "name": "General Contracting", "descr": "General construction and contracting", "parent_id": null, "color_code": "orange"},
  {"id": 4, "name": "Maintenance", "descr": "Ongoing maintenance services", "parent_id": null, "color_code": "green"}
]'::jsonb),

-- Organizational Labels
('dl__business_level', 'Business Levels', 'Building2', '[
  {"id": 0, "name": "Corporate", "descr": "Corporate headquarters level", "parent_id": null, "color_code": "purple"},
  {"id": 1, "name": "Division", "descr": "Business division level", "parent_id": 0, "color_code": "blue"},
  {"id": 2, "name": "Department", "descr": "Department level within division", "parent_id": 1, "color_code": "green"}
]'::jsonb),

('dl__office_level', 'Office Levels', 'MapPin', '[
  {"id": 0, "name": "Corporate", "descr": "Corporate headquarters office", "parent_id": null, "color_code": "purple"},
  {"id": 1, "name": "Region", "descr": "Regional office", "parent_id": 0, "color_code": "blue"},
  {"id": 2, "name": "District", "descr": "District office", "parent_id": 1, "color_code": "green"},
  {"id": 3, "name": "Office", "descr": "Local office or branch", "parent_id": 2, "color_code": "gray"}
]'::jsonb),

('dl__position_level', 'Position Levels', 'Briefcase', '[
  {"id": 0, "name": "CEO/President", "descr": "Chief Executive Officer or President level", "parent_id": null, "color_code": "purple"},
  {"id": 1, "name": "C-Level", "descr": "C-Level executives (CFO, CTO, COO, etc.)", "parent_id": 0, "color_code": "indigo"},
  {"id": 2, "name": "SVP/EVP", "descr": "Senior/Executive Vice President level", "parent_id": 1, "color_code": "blue"},
  {"id": 3, "name": "VP", "descr": "Vice President level", "parent_id": 2, "color_code": "cyan"},
  {"id": 4, "name": "AVP", "descr": "Assistant Vice President level", "parent_id": 3, "color_code": "green"},
  {"id": 5, "name": "Senior Director", "descr": "Senior Director level", "parent_id": 4, "color_code": "yellow"},
  {"id": 6, "name": "Director", "descr": "Director level", "parent_id": 5, "color_code": "orange"},
  {"id": 7, "name": "Associate Director", "descr": "Associate Director level (leaf)", "parent_id": 6, "color_code": "gray"}
]'::jsonb),

-- Customer Labels
('dl__customer_tier', 'Customer Tiers', 'Award', '[
  {"id": 0, "name": "Bronze", "descr": "Bronze tier customer", "parent_id": null, "color_code": "amber"},
  {"id": 1, "name": "Silver", "descr": "Silver tier customer", "parent_id": null, "color_code": "gray"},
  {"id": 2, "name": "Gold", "descr": "Gold tier customer", "parent_id": null, "color_code": "yellow"},
  {"id": 3, "name": "Platinum", "descr": "Platinum tier customer", "parent_id": null, "color_code": "purple"}
]'::jsonb),

-- Sales/Marketing Labels
('dl__opportunity_funnel_stage', 'Opportunity Funnel Stages', 'TrendingUp', '[
  {"id": 0, "name": "Lead", "descr": "Initial lead", "parent_id": null, "color_code": "blue"},
  {"id": 1, "name": "Qualified", "descr": "Qualified lead", "parent_id": 0, "color_code": "cyan"},
  {"id": 2, "name": "Proposal", "descr": "Proposal sent", "parent_id": 1, "color_code": "yellow"},
  {"id": 3, "name": "Negotiation", "descr": "Under negotiation", "parent_id": 2, "color_code": "orange"},
  {"id": 4, "name": "Closed Won", "descr": "Deal won", "parent_id": 3, "color_code": "green"},
  {"id": 5, "name": "Closed Lost", "descr": "Deal lost", "parent_id": 3, "color_code": "red"}
]'::jsonb),

('dl__industry_sector', 'Industry Sectors', 'Building', '[
  {"id": 0, "name": "Residential", "descr": "Residential sector", "parent_id": null, "color_code": "blue"},
  {"id": 1, "name": "Commercial", "descr": "Commercial sector", "parent_id": null, "color_code": "green"},
  {"id": 2, "name": "Industrial", "descr": "Industrial sector", "parent_id": null, "color_code": "orange"},
  {"id": 3, "name": "Government", "descr": "Government sector", "parent_id": null, "color_code": "purple"}
]'::jsonb),

('dl__acquisition_channel', 'Acquisition Channels', 'Megaphone', '[
  {"id": 0, "name": "Organic Search", "descr": "Found via Google, Bing (SEO)", "parent_id": null, "color_code": "green"},
  {"id": 1, "name": "Paid Search", "descr": "Google Ads, Bing Ads (PPC)", "parent_id": null, "color_code": "red"},
  {"id": 2, "name": "Social Media", "descr": "Facebook, Instagram, LinkedIn organic", "parent_id": null, "color_code": "blue"},
  {"id": 3, "name": "Referral", "descr": "Word-of-mouth from existing clients", "parent_id": null, "color_code": "purple"},
  {"id": 4, "name": "Direct", "descr": "Typed URL directly, bookmarked site", "parent_id": null, "color_code": "gray"},
  {"id": 5, "name": "Email Marketing", "descr": "Newsletter, promotional campaigns", "parent_id": null, "color_code": "cyan"}
]'::jsonb);

COMMENT ON TABLE app.setting_datalabel IS 'Unified data label table for all entity labels (stages, statuses, priorities, etc.)';
COMMENT ON COLUMN app.setting_datalabel.datalabel_name IS 'Format: dl__{entity}_{labelname} (e.g., dl__task_stage, dl__project_stage) - matches database column names exactly';
COMMENT ON COLUMN app.setting_datalabel.ui_label IS 'UI display label for settings page (e.g., "Project Stages", "Task Priorities")';
COMMENT ON COLUMN app.setting_datalabel.ui_icon IS 'Lucide icon name for UI display (e.g., "GitBranch", "Target", "TrendingUp")';
COMMENT ON COLUMN app.setting_datalabel.metadata IS 'JSONB array of label definitions: [{id, name, descr, parent_id, color_code}, ...]';
COMMENT ON COLUMN app.setting_datalabel.updated_ts IS 'Last modification timestamp';
