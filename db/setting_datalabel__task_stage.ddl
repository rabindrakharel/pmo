-- =====================================================
-- SETTING TASK STAGE TABLE
-- Task workflow stages with UI color coding
-- =====================================================

CREATE TABLE app.setting_datalabel_task_stage (
    level_id integer PRIMARY KEY,
    level_name varchar(50) NOT NULL UNIQUE,
    level_descr text,
    sort_order integer,
    color_code varchar(7), -- Hex color for UI
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now()
);

-- Index for setting task stage

-- Initial data for task stages
INSERT INTO app.setting_datalabel_task_stage (level_id, level_name, level_descr, sort_order, color_code) VALUES
(0, 'Backlog', 'Task identified but not started', 1, '#6B7280'),
(1, 'To Do', 'Task ready to be started', 2, '#3B82F6'),
(2, 'In Progress', 'Task currently being worked on', 3, '#F59E0B'),
(3, 'In Review', 'Task completed, awaiting review', 4, '#8B5CF6'),
(4, 'Blocked', 'Task blocked by external dependency', 5, '#EF4444'),
(5, 'Done', 'Task completed successfully', 6, '#10B981'),
(6, 'Cancelled', 'Task cancelled before completion', 7, '#6B7280');

-- Add foreign key constraint to reference setting tables
ALTER TABLE app.d_task
ADD CONSTRAINT fk_task_stage
FOREIGN KEY (stage) ;

COMMENT ON TABLE app.setting_datalabel_task_stage IS 'Task workflow stages with UI color coding';