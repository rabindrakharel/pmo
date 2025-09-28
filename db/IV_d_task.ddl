-- =====================================================
-- TASK ENTITY (d_task) - HEAD TABLE
-- Task management with head/data pattern
-- =====================================================

CREATE TABLE app.d_task (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug varchar(100) UNIQUE NOT NULL,
    code varchar(50) UNIQUE NOT NULL,
    name varchar(200) NOT NULL,
    descr text,
    tags jsonb DEFAULT '[]'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,

    -- Task relationships (direct FKs as specified)
    project_id uuid NOT NULL REFERENCES app.d_project(id),
    business_id uuid REFERENCES app.d_business(id),
    office_id uuid REFERENCES app.d_office(id),

    -- Task assignment
    assignee_employee_ids uuid[] DEFAULT '{}',
    stage varchar(50), -- References meta_task_stage.level_name

    -- Task details
    priority_level varchar(20) DEFAULT 'medium', -- low, medium, high, critical
    estimated_hours decimal(8,2),
    actual_hours decimal(8,2) DEFAULT 0,
    story_points integer,

    -- Dependencies
    parent_task_id uuid REFERENCES app.d_task(id),
    dependency_task_ids uuid[] DEFAULT '{}',

    -- Temporal fields
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);

-- Indexes for task
CREATE INDEX idx_task_project_id ON app.d_task(project_id);
CREATE INDEX idx_task_business_id ON app.d_task(business_id);
CREATE INDEX idx_task_office_id ON app.d_task(office_id);
CREATE INDEX idx_task_stage ON app.d_task(stage);
CREATE INDEX idx_task_assignees ON app.d_task USING gin(assignee_employee_ids);
CREATE INDEX idx_task_parent ON app.d_task(parent_task_id);
CREATE INDEX idx_task_active ON app.d_task(active_flag);
CREATE INDEX idx_task_slug ON app.d_task(slug);
CREATE INDEX idx_task_code ON app.d_task(code);

-- Update trigger for task
CREATE TRIGGER trg_task_updated_ts BEFORE UPDATE ON app.d_task
    FOR EACH ROW EXECUTE FUNCTION app.update_updated_ts();

COMMENT ON TABLE app.d_task IS 'Task head table with core task information';