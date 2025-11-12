-- =====================================================
-- TASK DATA (d_task_data) - DATA TABLE
-- Task updates, comments, and attachments
-- =====================================================
--
-- SEMANTICS:
-- • Data table for task updates, comments, status changes, and attachments
-- • Uses Quill Delta format for rich text content (JSONB storage)
-- • Links to parent task and project via foreign keys (exception to no-FK pattern for data integrity)
-- • Supports versioned updates with stage (draft, saved)
-- • Append-only pattern - no soft deletes, preserves complete audit trail
--
-- OPERATIONS:
-- • CREATE: INSERT with stage='draft', created_ts=now()
-- • UPDATE: Same ID, updated_ts refreshes (for draft edits)
-- • PUBLISH: UPDATE stage='draft' → 'saved' (finalize update)
-- • QUERY: Filter by task_id, project_id, update_type, date range
--
-- KEY FIELDS:
-- • id: uuid PRIMARY KEY (stable identifier)
-- • task_id: uuid NOT NULL REFERENCES d_task(id) - parent task
-- • project_id: uuid NOT NULL REFERENCES d_project(id) - parent project
-- • stage: varchar(20) DEFAULT 'draft' - draft|saved (workflow state)
-- • updated_by_empid: uuid NOT NULL - employee who created this update
-- • data_richtext: jsonb - Quill Delta format rich text content
-- • update_type: varchar(50) - comment|status_change|assignment|attachment|form
-- • hours_logged: decimal(8,2) - time tracking for this update
-- • status_change_from/to: varchar(50) - captures status transitions
-- • metadata: jsonb - additional context (form submissions, attachments, etc.)
--
-- RELATIONSHIPS (WITH FOREIGN KEYS):
-- • Parent: task (via task_id FK) - CASCADE DELETE
-- • Parent: project (via project_id FK) - CASCADE DELETE
-- • updated_by_empid → d_employee.id (no FK, soft reference)
-- • Mentions in data_richtext → d_employee records
-- • Attachments in data_richtext → S3/MinIO objects
--
-- RICH TEXT FORMAT (Quill Delta):
-- • Supports: bold, italic, underline, strike, code, links, lists, headers, code blocks
-- • Special attributes: mention {id, name, email}, attachment {id, name, format, uri, size}
-- • See inline examples in CREATE TABLE comments
--
-- =====================================================

CREATE TABLE app.d_task_data (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Required FKs as specified
    task_id uuid NOT NULL REFERENCES app.d_task(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES app.d_project(id) ON DELETE CASCADE,

    -- Data stage
    stage varchar(20) NOT NULL DEFAULT 'draft', -- draft, saved

    -- Update information
    updated_by_empid uuid NOT NULL,

    -- Rich content in Quill Delta format
    -- Supported attributes:
    --   Text formatting: bold, italic, underline, strike, code
    --   Links: link (URL string)
    --   Lists: list (bullet | ordered)
    --   Headers: header (1-6)
    --   Code blocks: code-block (boolean)
    --   Mentions: mention {id, name, email}
    --   Attachments: attachment {id, name, format, uri, size}
    --
    -- EXAMPLE WITH ALL ELEMENTS:
    -- {
    --   "ops": [
    --     {"insert": "Task Update - Progress Report\n", "attributes": {"header": 2}},
    --     {"insert": "\nThis is plain text describing the current status of the task. I've completed the initial phase and moving forward with implementation.\n\n"},
    --     {"insert": "Important: ", "attributes": {"bold": true}},
    --     {"insert": "The deadline has been moved to next Friday. Please review the "},
    --     {"insert": "documentation link", "attributes": {"link": "https://docs.example.com/task-guidelines"}},
    --     {"insert": " for more details.\n\n"},
    --     {"insert": "Mentioning "},
    --     {"insert": "@James Miller", "attributes": {"mention": {"id": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13", "name": "James Miller", "email": "james.miller@huronhome.ca"}}},
    --     {"insert": " for review and approval.\n\n"},
    --     {"insert": "Completed Steps:", "attributes": {"bold": true}},
    --     {"insert": "\n"},
    --     {"insert": "Initial setup and configuration", "attributes": {"list": "bullet"}},
    --     {"insert": "\n"},
    --     {"insert": "Database schema implementation", "attributes": {"list": "bullet"}},
    --     {"insert": "\n"},
    --     {"insert": "API endpoint creation", "attributes": {"list": "bullet"}},
    --     {"insert": "\n"},
    --     {"insert": "Unit testing", "attributes": {"list": "bullet"}},
    --     {"insert": "\n\n"},
    --     {"insert": "Next Steps:", "attributes": {"bold": true}},
    --     {"insert": "\n"},
    --     {"insert": "Integration testing", "attributes": {"list": "ordered"}},
    --     {"insert": "\n"},
    --     {"insert": "Performance optimization", "attributes": {"list": "ordered"}},
    --     {"insert": "\n"},
    --     {"insert": "Documentation update", "attributes": {"list": "ordered"}},
    --     {"insert": "\n"},
    --     {"insert": "Final review", "attributes": {"list": "ordered"}},
    --     {"insert": "\n\n"},
    --     {"insert": "Attached Files:\n", "attributes": {"bold": true}},
    --     {"insert": "📎 design-mockups.pdf", "attributes": {"attachment": {"id": "att-001", "name": "design-mockups.pdf", "format": "pdf", "uri": "/uploads/attachments/design-mockups.pdf", "size": 2048576}}},
    --     {"insert": "\n"},
    --     {"insert": "📎 test-results.xlsx", "attributes": {"attachment": {"id": "att-002", "name": "test-results.xlsx", "format": "xlsx", "uri": "/uploads/attachments/test-results.xlsx", "size": 1024000}}},
    --     {"insert": "\n\n"},
    --     {"insert": "Code snippet for reference:\n", "attributes": {"italic": true}},
    --     {"insert": "const result = await taskApi.update(taskId, data);", "attributes": {"code-block": true}},
    --     {"insert": "\n"}
    --   ]
    -- }
    data_richtext jsonb DEFAULT '{}'::jsonb,


    -- Additional data fields
    update_type varchar(50) DEFAULT 'comment', -- comment, status_change, assignment, attachment, form
    hours_logged decimal(8,2),
    status_change_from varchar(50),
    status_change_to varchar(50),

    -- Metadata for storing additional context (e.g., form submissions)
    -- For form updates: {form_id, form_name, submission_id, submission_data, submission_timestamp}
    metadata jsonb DEFAULT '{}'::jsonb,

    -- Temporal fields
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);



COMMENT ON TABLE app.d_task_data IS 'Task data table for updates, comments, and temporal tracking';