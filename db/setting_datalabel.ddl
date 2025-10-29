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
--   - datalabel_name: {entity}__{labelname} format (e.g., 'task__status', 'project__stage')
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
--   - task__stage, task__priority, task__update_type
--   - project__stage
--   - form__submission_status, form__approval_status
--   - wiki__publication_status
--   - client__status, client__service
--   - business__level
--   - office__level
--   - position__level
--   - customer__tier
--   - opportunity__funnel_stage
--   - industry__sector
--   - acquisition__channel
--
-- Integration Points:
--   - API endpoint: GET /api/v1/setting?category=task__stage
--   - Frontend: loadOptionsFromSettings('task__stage')
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
INSERT INTO app.setting_datalabel (datalabel_name, metadata) VALUES
('task__stage', '[
  {"id": 0, "name": "Backlog", "descr": "Tasks in backlog, not yet started", "parent_id": null, "color_code": "gray"},
  {"id": 1, "name": "To Do", "descr": "Tasks ready to start", "parent_id": null, "color_code": "blue"},
  {"id": 2, "name": "In Progress", "descr": "Tasks actively being worked on", "parent_id": 1, "color_code": "yellow"},
  {"id": 3, "name": "In Review", "descr": "Tasks under review", "parent_id": 2, "color_code": "purple"},
  {"id": 4, "name": "Done", "descr": "Tasks completed", "parent_id": 3, "color_code": "green"},
  {"id": 5, "name": "Blocked", "descr": "Tasks blocked by dependencies", "parent_id": 2, "color_code": "red"}
]'::jsonb),

('task__priority', '[
  {"id": 0, "name": "Low", "descr": "Low priority - can be scheduled flexibly", "parent_id": null, "color_code": "green"},
  {"id": 1, "name": "Medium", "descr": "Medium priority - normal scheduling", "parent_id": null, "color_code": "yellow"},
  {"id": 2, "name": "High", "descr": "High priority - requires prompt attention", "parent_id": null, "color_code": "red"},
  {"id": 3, "name": "Critical", "descr": "Critical priority - urgent and blocking", "parent_id": null, "color_code": "red"},
  {"id": 4, "name": "Urgent", "descr": "Urgent - immediate action required", "parent_id": null, "color_code": "red"}
]'::jsonb),

('task__update_type', '[
  {"id": 0, "name": "Status Change", "descr": "Task status was changed", "parent_id": null, "color_code": "blue"},
  {"id": 1, "name": "Comment", "descr": "Comment added to task", "parent_id": null, "color_code": "gray"},
  {"id": 2, "name": "Assignment", "descr": "Task assigned to employee", "parent_id": null, "color_code": "purple"},
  {"id": 3, "name": "Due Date", "descr": "Due date changed", "parent_id": null, "color_code": "yellow"}
]'::jsonb),

-- Project Labels
('project__stage', '[
  {"id": 0, "name": "Initiation", "descr": "Project concept and initial planning. Starting point for all projects.", "parent_id": null, "color_code": "blue"},
  {"id": 1, "name": "Planning", "descr": "Detailed project planning and resource allocation. Follows project approval.", "parent_id": 0, "color_code": "purple"},
  {"id": 2, "name": "Execution", "descr": "Active project execution phase. Work is being performed by the project team.", "parent_id": 1, "color_code": "yellow"},
  {"id": 3, "name": "Monitoring", "descr": "Project monitoring and control. Tracking progress and managing changes.", "parent_id": 2, "color_code": "orange"},
  {"id": 4, "name": "Closure", "descr": "Project completion and closure activities. Final deliverables and documentation.", "parent_id": 3, "color_code": "green"},
  {"id": 5, "name": "On Hold", "descr": "Project temporarily suspended. Can resume to Execution or Planning stages.", "parent_id": 2, "color_code": "gray"},
  {"id": 6, "name": "Cancelled", "descr": "Project cancelled before completion. Terminal state with no forward transitions.", "parent_id": null, "color_code": "red"}
]'::jsonb),

-- Form Labels
('form__submission_status', '[
  {"id": 0, "name": "draft", "descr": "Form is in draft state", "parent_id": null, "color_code": "yellow"},
  {"id": 1, "name": "submitted", "descr": "Form has been submitted", "parent_id": 0, "color_code": "blue"},
  {"id": 2, "name": "under_review", "descr": "Form is under review", "parent_id": 1, "color_code": "purple"},
  {"id": 3, "name": "approved", "descr": "Form has been approved", "parent_id": 2, "color_code": "green"},
  {"id": 4, "name": "rejected", "descr": "Form has been rejected", "parent_id": 2, "color_code": "red"},
  {"id": 5, "name": "withdrawn", "descr": "Form has been withdrawn", "parent_id": 1, "color_code": "gray"}
]'::jsonb),

('form__approval_status', '[
  {"id": 0, "name": "pending", "descr": "Awaiting approval", "parent_id": null, "color_code": "yellow"},
  {"id": 1, "name": "approved", "descr": "Approval granted", "parent_id": null, "color_code": "green"},
  {"id": 2, "name": "rejected", "descr": "Approval rejected", "parent_id": null, "color_code": "red"},
  {"id": 3, "name": "conditional", "descr": "Conditionally approved", "parent_id": null, "color_code": "orange"},
  {"id": 4, "name": "escalated", "descr": "Escalated to higher authority", "parent_id": null, "color_code": "purple"}
]'::jsonb),

-- Wiki Labels
('wiki__publication_status', '[
  {"id": 0, "name": "draft", "descr": "Wiki page in draft", "parent_id": null, "color_code": "yellow"},
  {"id": 1, "name": "review", "descr": "Under review", "parent_id": 0, "color_code": "blue"},
  {"id": 2, "name": "published", "descr": "Published and visible", "parent_id": 1, "color_code": "green"},
  {"id": 3, "name": "archived", "descr": "Archived but accessible", "parent_id": null, "color_code": "gray"},
  {"id": 4, "name": "deprecated", "descr": "Deprecated, should not be used", "parent_id": null, "color_code": "red"},
  {"id": 5, "name": "private", "descr": "Private, restricted access", "parent_id": null, "color_code": "purple"}
]'::jsonb),

-- Client Labels
('client__status', '[
  {"id": 0, "name": "Lead", "descr": "Potential client, initial contact", "parent_id": null, "color_code": "blue"},
  {"id": 1, "name": "Active", "descr": "Active client with ongoing projects", "parent_id": null, "color_code": "green"},
  {"id": 2, "name": "Inactive", "descr": "No current projects", "parent_id": null, "color_code": "gray"},
  {"id": 3, "name": "Churned", "descr": "Lost client", "parent_id": null, "color_code": "red"}
]'::jsonb),

('client__service', '[
  {"id": 0, "name": "HVAC", "descr": "Heating, ventilation, and air conditioning services", "parent_id": null, "color_code": "blue"},
  {"id": 1, "name": "Plumbing", "descr": "Plumbing installation and repair", "parent_id": null, "color_code": "cyan"},
  {"id": 2, "name": "Electrical", "descr": "Electrical services", "parent_id": null, "color_code": "yellow"},
  {"id": 3, "name": "General Contracting", "descr": "General construction and contracting", "parent_id": null, "color_code": "orange"},
  {"id": 4, "name": "Maintenance", "descr": "Ongoing maintenance services", "parent_id": null, "color_code": "green"}
]'::jsonb),

-- Organizational Labels
('business__level', '[
  {"id": 0, "name": "Division", "descr": "Top-level business division", "parent_id": null, "color_code": "purple"},
  {"id": 1, "name": "Department", "descr": "Department within division", "parent_id": 0, "color_code": "blue"},
  {"id": 2, "name": "Team", "descr": "Team within department", "parent_id": 1, "color_code": "green"}
]'::jsonb),

('office__level', '[
  {"id": 0, "name": "Corporate", "descr": "Corporate headquarters", "parent_id": null, "color_code": "purple"},
  {"id": 1, "name": "Regional", "descr": "Regional office", "parent_id": 0, "color_code": "blue"},
  {"id": 2, "name": "District", "descr": "District office", "parent_id": 1, "color_code": "green"},
  {"id": 3, "name": "Branch", "descr": "Branch office", "parent_id": 2, "color_code": "gray"}
]'::jsonb),

('position__level', '[
  {"id": 0, "name": "Executive", "descr": "Executive level position", "parent_id": null, "color_code": "purple"},
  {"id": 1, "name": "Management", "descr": "Management level", "parent_id": 0, "color_code": "blue"},
  {"id": 2, "name": "Staff", "descr": "Staff level", "parent_id": 1, "color_code": "green"},
  {"id": 3, "name": "Entry", "descr": "Entry level", "parent_id": 2, "color_code": "gray"}
]'::jsonb),

-- Customer Labels
('customer__tier', '[
  {"id": 0, "name": "Bronze", "descr": "Bronze tier customer", "parent_id": null, "color_code": "amber"},
  {"id": 1, "name": "Silver", "descr": "Silver tier customer", "parent_id": null, "color_code": "gray"},
  {"id": 2, "name": "Gold", "descr": "Gold tier customer", "parent_id": null, "color_code": "yellow"},
  {"id": 3, "name": "Platinum", "descr": "Platinum tier customer", "parent_id": null, "color_code": "purple"}
]'::jsonb),

-- Sales/Marketing Labels
('opportunity__funnel_stage', '[
  {"id": 0, "name": "Lead", "descr": "Initial lead", "parent_id": null, "color_code": "blue"},
  {"id": 1, "name": "Qualified", "descr": "Qualified lead", "parent_id": 0, "color_code": "cyan"},
  {"id": 2, "name": "Proposal", "descr": "Proposal sent", "parent_id": 1, "color_code": "yellow"},
  {"id": 3, "name": "Negotiation", "descr": "Under negotiation", "parent_id": 2, "color_code": "orange"},
  {"id": 4, "name": "Closed Won", "descr": "Deal won", "parent_id": 3, "color_code": "green"},
  {"id": 5, "name": "Closed Lost", "descr": "Deal lost", "parent_id": 3, "color_code": "red"}
]'::jsonb),

('industry__sector', '[
  {"id": 0, "name": "Residential", "descr": "Residential sector", "parent_id": null, "color_code": "blue"},
  {"id": 1, "name": "Commercial", "descr": "Commercial sector", "parent_id": null, "color_code": "green"},
  {"id": 2, "name": "Industrial", "descr": "Industrial sector", "parent_id": null, "color_code": "orange"},
  {"id": 3, "name": "Government", "descr": "Government sector", "parent_id": null, "color_code": "purple"}
]'::jsonb),

('acquisition__channel', '[
  {"id": 0, "name": "Organic Search", "descr": "Found via Google, Bing (SEO)", "parent_id": null, "color_code": "green"},
  {"id": 1, "name": "Paid Search", "descr": "Google Ads, Bing Ads (PPC)", "parent_id": null, "color_code": "red"},
  {"id": 2, "name": "Social Media", "descr": "Facebook, Instagram, LinkedIn organic", "parent_id": null, "color_code": "blue"},
  {"id": 3, "name": "Referral", "descr": "Word-of-mouth from existing clients", "parent_id": null, "color_code": "purple"},
  {"id": 4, "name": "Direct", "descr": "Typed URL directly, bookmarked site", "parent_id": null, "color_code": "gray"},
  {"id": 5, "name": "Email Marketing", "descr": "Newsletter, promotional campaigns", "parent_id": null, "color_code": "cyan"}
]'::jsonb);

COMMENT ON TABLE app.setting_datalabel IS 'Unified data label table for all entity labels (stages, statuses, priorities, etc.)';
COMMENT ON COLUMN app.setting_datalabel.datalabel_name IS 'Format: {entity}__{labelname} (e.g., task__stage, project__stage)';
COMMENT ON COLUMN app.setting_datalabel.metadata IS 'JSONB array of label definitions: [{id, name, descr, parent_id, color_code}, ...]';
COMMENT ON COLUMN app.setting_datalabel.updated_ts IS 'Last modification timestamp';
