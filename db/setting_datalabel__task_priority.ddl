-- =====================================================
-- SETTING: TASK PRIORITY
-- Defines available task priority levels
-- =====================================================

CREATE TABLE IF NOT EXISTS app.setting_datalabel_task_priority (
    level_id integer PRIMARY KEY,
    name varchar(50) NOT NULL UNIQUE,
    descr text,
    is_active boolean DEFAULT true,
    sort_order integer,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);

-- Task priority values
INSERT INTO app.setting_datalabel_task_priority (level_id, name, descr, sort_order) VALUES
(0, 'low', 'Low priority - can be scheduled flexibly', 0),
(1, 'medium', 'Medium priority - normal scheduling', 1),
(2, 'high', 'High priority - requires prompt attention', 2),
(3, 'critical', 'Critical priority - urgent and blocking', 3),
(4, 'urgent', 'Urgent - immediate action required', 4);

COMMENT ON TABLE app.setting_datalabel_task_priority IS 'Task priority setting values for d_task.priority_level';
