-- Task Activity Log Table
-- Stores all activity logs for tasks (comments, work logs, status changes, etc.)

CREATE TABLE IF NOT EXISTS app.ops_task_activity (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES app.ops_task_head(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('comment', 'status_change', 'field_change', 'worklog', 'attachment')),
    author_id UUID NOT NULL, -- References employee/user
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb, -- Store additional data like old/new values, time spent, etc.
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_task_activity_task_id ON app.ops_task_activity(task_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_type ON app.ops_task_activity(type);
CREATE INDEX IF NOT EXISTS idx_task_activity_timestamp ON app.ops_task_activity(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_task_activity_author ON app.ops_task_activity(author_id);

-- Comments and updates to metadata
COMMENT ON TABLE app.ops_task_activity IS 'Activity logs for tasks including comments, work logs, and field changes';
COMMENT ON COLUMN app.ops_task_activity.type IS 'Type of activity: comment, status_change, field_change, worklog, attachment';
COMMENT ON COLUMN app.ops_task_activity.metadata IS 'JSON metadata containing additional context like old/new values, time tracking data, etc.';
COMMENT ON COLUMN app.ops_task_activity.timestamp IS 'When the activity actually occurred (may differ from created for backdated entries)';

-- Example metadata structures:
-- For comments: {}
-- For status_change: {"fieldName": "status", "oldValue": "To Do", "newValue": "In Progress"}
-- For worklog: {"timeSpent": 120, "timeRemaining": 360, "startedAt": "2024-01-01T10:00:00Z"}
-- For field_change: {"fieldName": "assignee", "oldValue": "user-1", "newValue": "user-2"}
-- For attachment: {"fileName": "document.pdf", "fileSize": 1024, "mimeType": "application/pdf"}