-- =====================================================
-- PROJECT ENTITY (d_project)
-- Core project management entity
-- =====================================================

CREATE TABLE app.d_project (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug varchar(100) UNIQUE NOT NULL,
    code varchar(50) UNIQUE NOT NULL,
    name varchar(200) NOT NULL,
    descr text,
    tags jsonb DEFAULT '[]'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,

    -- Project relationships
    business_id uuid REFERENCES app.d_business(id),
    office_id uuid REFERENCES app.d_office(id),

    -- Project fields
    project_stage varchar(50), -- References meta_project_stage.level_name
    budget_allocated decimal(15,2),
    budget_spent decimal(15,2) DEFAULT 0,
    planned_start_date date,
    planned_end_date date,
    actual_start_date date,
    actual_end_date date,

    -- Project team
    manager_employee_id uuid,
    sponsor_employee_id uuid,
    stakeholder_employee_ids uuid[] DEFAULT '{}',

    -- Temporal fields
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);

-- Indexes for project
CREATE INDEX idx_project_business_id ON app.d_project(business_id);
CREATE INDEX idx_project_office_id ON app.d_project(office_id);
CREATE INDEX idx_project_stage ON app.d_project(project_stage);
CREATE INDEX idx_project_active ON app.d_project(active_flag);
CREATE INDEX idx_project_slug ON app.d_project(slug);
CREATE INDEX idx_project_code ON app.d_project(code);
CREATE INDEX idx_project_dates ON app.d_project(planned_start_date, planned_end_date);

-- Update trigger for project
CREATE TRIGGER trg_project_updated_ts BEFORE UPDATE ON app.d_project
    FOR EACH ROW EXECUTE FUNCTION app.update_updated_ts();

COMMENT ON TABLE app.d_project IS 'Core project management entity';