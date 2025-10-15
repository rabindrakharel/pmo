-- =====================================================
-- SETTING: TASK UPDATE TYPE
-- Defines available task update/activity types
-- =====================================================

CREATE TABLE IF NOT EXISTS app.setting_datalabel_task_update_type (
    level_id integer PRIMARY KEY,
    level_name varchar(50) NOT NULL UNIQUE,
    level_descr text,
    is_active boolean DEFAULT true,
    sort_order integer,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);

-- Task update type values
INSERT INTO app.setting_datalabel_task_update_type (level_id, level_name, level_descr, sort_order) VALUES
(0, 'comment', 'General comment or note', 0),
(1, 'status_change', 'Task status or stage change', 1),
(2, 'assignment', 'Task assignment or reassignment', 2),
(3, 'attachment', 'File or document attachment', 3),
(4, 'description_update', 'Task description modification', 4),
(5, 'deadline_change', 'Deadline or due date change', 5),
(6, 'priority_change', 'Priority level adjustment', 6);

COMMENT ON TABLE app.setting_datalabel_task_update_type IS 'Task update type setting values for d_task_data.update_type';
