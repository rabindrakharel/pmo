-- =====================================================
-- META PROJECT STAGE TABLE
-- Project lifecycle stages with UI color coding
-- =====================================================

CREATE TABLE app.meta_project_stage (
    level_id integer PRIMARY KEY,
    level_name varchar(50) NOT NULL UNIQUE,
    level_descr text,
    sort_order integer,
    color_code varchar(7), -- Hex color for UI
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now()
);

-- Index for meta project stage

-- Initial data for project stages
INSERT INTO app.meta_project_stage (level_id, level_name, level_descr, sort_order, color_code) VALUES
(0, 'Initiation', 'Project concept and initial planning', 1, '#6B7280'),
(1, 'Planning', 'Detailed project planning and resource allocation', 2, '#3B82F6'),
(2, 'Execution', 'Active project execution phase', 3, '#10B981'),
(3, 'Monitoring', 'Project monitoring and control', 4, '#F59E0B'),
(4, 'Closure', 'Project completion and closure activities', 5, '#8B5CF6'),
(5, 'On Hold', 'Project temporarily suspended', 6, '#EF4444'),
(6, 'Cancelled', 'Project cancelled before completion', 7, '#6B7280');

-- Add foreign key constraint to reference meta tables
ALTER TABLE app.d_project
ADD CONSTRAINT fk_project_stage
FOREIGN KEY (project_stage) ;

COMMENT ON TABLE app.meta_project_stage IS 'Project lifecycle stages with UI color coding';