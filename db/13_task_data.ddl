-- =====================================================
-- TASK DATA (d_task_data) - DATA TABLE
-- Task updates, comments, threading, reactions, and attachments
-- =====================================================
--
-- SEMANTICS:
-- * Data table for task updates, comments, status changes, and attachments
-- * Uses Quill Delta format for rich text content (JSONB storage)
-- * Links to parent task via task_id (no FK - follows platform no-FK pattern)
-- * Supports threaded replies via task_data_id (self-reference)
-- * Supports @mentions, reactions, pinning, resolution
-- * Append-only pattern - no soft deletes, preserves complete audit trail
--
-- NEXT-GEN FEATURES (v2.0):
-- * Threading: task_data_id for parent-child replies
-- * Mentions: mentioned__employee_ids array
-- * Reactions: reactions_data JSONB {"emoji": ["uuid1"], "emoji2": ["uuid2"]}
-- * Pinning: pinned_flag, pinned_by__employee_id, pinned_ts
-- * Resolution: resolved_flag, resolved_by__employee_id, resolved_ts
-- * S3 Attachments: attachments array [{s3_bucket, s3_key, filename, ...}]
-- * Smart Composer: detected_intents_data for auto-detection
--
-- OPERATIONS:
-- * CREATE: INSERT with stage='draft', created_ts=now()
-- * UPDATE: Same ID, updated_ts refreshes (for draft edits)
-- * PUBLISH: UPDATE stage='draft' -> 'saved' (finalize update)
-- * REPLY: INSERT with task_data_id pointing to parent
-- * REACT: UPDATE reactions_data JSONB (toggle emoji)
-- * PIN: UPDATE pinned_flag, pinned_by__employee_id, pinned_ts
-- * RESOLVE: UPDATE resolved_flag, resolved_by__employee_id, resolved_ts
-- * QUERY: Filter by task_id, update_type, threading, date range
--
-- RELATIONSHIPS (NO FOREIGN KEYS - Platform Pattern):
-- * Parent: task (via task_id) - application-level integrity
-- * Threading: d_task_data (via task_data_id) - self-reference for replies
-- * updated_by__employee_id -> employee.id (soft reference)
-- * mentioned__employee_ids -> employee.id[] (soft reference)
-- * pinned_by__employee_id -> employee.id (soft reference)
-- * resolved_by__employee_id -> employee.id (soft reference)
-- * Attachments -> S3 objects via s3_bucket + s3_key
--
-- RICH TEXT FORMAT (Quill Delta):
-- * Supports: bold, italic, underline, strike, code, links, lists, headers, code blocks
-- * Special attributes: mention {id, name, email}, attachment {s3_bucket, s3_key, filename}
--
-- ATTACHMENTS FORMAT (S3):
-- * Array of attachment objects stored in 'attachments' column
-- * Example: [{"s3_bucket": "pmo-attachments", "s3_key": "task-data/2025/01/uuid.pdf",
--              "filename": "report.pdf", "content_type": "application/pdf",
--              "size_bytes": 102400, "uploaded_by__employee_id": "uuid", "uploaded_ts": "..."}]
--
-- REACTIONS FORMAT:
-- * JSONB map of emoji -> array of employee UUIDs who reacted
-- * Example: {"thumbs_up": ["uuid1", "uuid2"], "heart": ["uuid3"]}
--
-- DETECTED INTENTS FORMAT (Smart Composer):
-- * Auto-detected intents from content analysis
-- * Example: {"time_entry": {"hours": 2.5}, "status_change": {"to": "in_progress"},
--             "mentions": ["uuid1", "uuid2"]}
--
-- =====================================================

CREATE TABLE app.d_task_data (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Parent task reference (no FK - platform pattern)
    task_id uuid NOT NULL,

    -- Threading: Self-reference for replies (NULL = top-level comment)
    task_data_id uuid,  -- References app.d_task_data(id)

    -- Data stage
    stage varchar(20) DEFAULT 'draft', -- draft, saved

    -- Update information
    updated_by__employee_id uuid,

    -- Rich content in Quill Delta format
    -- Supported attributes:
    --   Text formatting: bold, italic, underline, strike, code
    --   Links: link (URL string)
    --   Lists: list (bullet | ordered)
    --   Headers: header (1-6)
    --   Code blocks: code-block (boolean)
    --   Mentions: mention {id, name, email}
    --   Attachments: attachment {s3_bucket, s3_key, filename}
    data_richtext jsonb DEFAULT '{}'::jsonb,

    -- Update type
    update_type varchar(50) DEFAULT 'comment', -- comment, status_change, assignment, attachment, form, time_entry, reply

    -- Time tracking
    hours_logged decimal(8,2),

    -- Status change tracking
    status_change_from varchar(50),
    status_change_to varchar(50),

    -- Metadata for storing additional context (e.g., form submissions)
    -- For form updates: {form_id, form_name, submission_id, submission_data, submission_timestamp}
    metadata jsonb DEFAULT '{}'::jsonb,

    -- =====================================================
    -- NEXT-GEN COLUMNS (v2.0) - Threading, Reactions, etc.
    -- =====================================================

    -- @Mentions: Array of employee UUIDs mentioned in this update
    -- Extracted from data_richtext for efficient querying
    mentioned__employee_ids uuid[] DEFAULT '{}',

    -- Reactions: JSONB map of emoji -> array of employee UUIDs
    -- Example: {"thumbs_up": ["uuid1", "uuid2"], "heart": ["uuid3"]}
    reactions_data jsonb DEFAULT '{}',

    -- Pinning: Mark important updates to show at top
    pinned_flag boolean DEFAULT false,
    pinned_by__employee_id uuid,
    pinned_ts timestamptz,

    -- Resolution: Mark questions/threads as resolved
    resolved_flag boolean DEFAULT false,
    resolved_by__employee_id uuid,
    resolved_ts timestamptz,

    -- S3 Attachments: Normalized attachment storage (replaces base64 in data_richtext)
    -- Example: [{"s3_bucket": "pmo-attachments", "s3_key": "task-data/2025/01/uuid.pdf",
    --            "filename": "report.pdf", "content_type": "application/pdf",
    --            "size_bytes": 102400, "uploaded_by__employee_id": "uuid", "uploaded_ts": "..."}]
    attachments jsonb DEFAULT '[]',

    -- Smart Composer: Auto-detected intents from content
    -- Example: {"time_entry": {"hours": 2.5}, "status_change": {"to": "in_progress"},
    --           "mentions": ["uuid1", "uuid2"]}
    detected_intents_data jsonb DEFAULT '{}',

    -- Temporal fields
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Core indexes
CREATE INDEX idx_d_task_data_task_id ON app.d_task_data(task_id);
CREATE INDEX idx_d_task_data_stage ON app.d_task_data(stage);

-- Threading index (for finding replies)
CREATE INDEX idx_d_task_data_parent ON app.d_task_data(task_data_id) WHERE task_data_id IS NOT NULL;

-- Pinned items index (partial - only pinned, for pinned section query)
CREATE INDEX idx_d_task_data_pinned ON app.d_task_data(task_id, pinned_flag) WHERE pinned_flag = true;

-- Unresolved threads index (for "open questions" view)
CREATE INDEX idx_d_task_data_unresolved ON app.d_task_data(task_id, resolved_flag) WHERE resolved_flag = false AND task_data_id IS NULL;

-- Mentions GIN index for "mentioned in" queries
CREATE INDEX idx_d_task_data_mentions ON app.d_task_data USING gin(mentioned__employee_ids);

-- Reactions GIN index for JSONB search (e.g., find all with specific emoji)
CREATE INDEX idx_d_task_data_reactions ON app.d_task_data USING gin(reactions_data);

-- Attachments GIN index for attachment queries
CREATE INDEX idx_d_task_data_attachments ON app.d_task_data USING gin(attachments);

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE app.d_task_data IS 'Task data table for updates, comments, threading, reactions, and activity tracking (v2.0)';
COMMENT ON COLUMN app.d_task_data.task_data_id IS 'Parent comment ID for threading (NULL = top-level)';
COMMENT ON COLUMN app.d_task_data.mentioned__employee_ids IS 'Array of @mentioned employee UUIDs';
COMMENT ON COLUMN app.d_task_data.reactions_data IS 'JSONB map: emoji -> [employee_uuids]';
COMMENT ON COLUMN app.d_task_data.pinned_flag IS 'Pinned updates appear at top of activity feed';
COMMENT ON COLUMN app.d_task_data.resolved_flag IS 'Resolved threads are collapsed/hidden';
COMMENT ON COLUMN app.d_task_data.attachments IS 'S3 attachment array: [{s3_bucket, s3_key, filename, ...}]';
COMMENT ON COLUMN app.d_task_data.detected_intents_data IS 'Smart Composer auto-detected intents';
