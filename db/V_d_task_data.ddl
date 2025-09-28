-- =====================================================
-- TASK DATA (d_task_data) - DATA TABLE
-- Task updates, comments, and attachments
-- =====================================================

CREATE TABLE app.d_task_data (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Required FKs as specified
    task_id uuid NOT NULL REFERENCES app.d_task(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES app.d_project(id),

    -- Data stage
    stage varchar(20) NOT NULL DEFAULT 'draft', -- draft, saved

    -- Update information
    updated_by_empid uuid NOT NULL,

    -- Rich content
    data_richtext jsonb DEFAULT '{}'::jsonb,

    -- Attachments array of objects: {id, name, format, uri}
    data_attachments jsonb DEFAULT '[]'::jsonb,

    -- Additional data fields
    update_type varchar(50) DEFAULT 'comment', -- comment, status_change, assignment, attachment
    hours_logged decimal(8,2),
    status_change_from varchar(50),
    status_change_to varchar(50),

    -- Temporal fields
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);

-- Indexes for task data
CREATE INDEX idx_task_data_task_id ON app.d_task_data(task_id);
CREATE INDEX idx_task_data_project_id ON app.d_task_data(project_id);
CREATE INDEX idx_task_data_updated_by ON app.d_task_data(updated_by_empid);
CREATE INDEX idx_task_data_stage ON app.d_task_data(stage);
CREATE INDEX idx_task_data_created ON app.d_task_data(created_ts DESC);
CREATE INDEX idx_task_data_attachments ON app.d_task_data USING gin(data_attachments);

-- Update trigger for task data
CREATE TRIGGER trg_task_data_updated_ts BEFORE UPDATE ON app.d_task_data
    FOR EACH ROW EXECUTE FUNCTION app.update_updated_ts();

COMMENT ON TABLE app.d_task_data IS 'Task data table for updates, comments, and temporal tracking';