-- Entity Records for Complex DAG Workflow
-- Creates all task entities needed for WFI-2024-001

-- State 1: Site Assessment Task
INSERT INTO app.d_task (
    id, code, name, descr,
    dl__task_stage, dl__task_priority,
    estimated_hours, actual_hours,
    story_points, active_flag,
    from_ts, created_ts, updated_ts, version
) VALUES (
    'aaaaaaaa-2222-2222-2222-222222222201',
    'TASK-WF-SITE-ASSESS',
    'Site Assessment - John Smith HVAC',
    'On-site assessment to determine HVAC system requirements',
    'completed', 'high',
    '4.00', '4.00',
    3, true,
    now(), now(), now(), 1
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    descr = EXCLUDED.descr,
    dl__task_stage = EXCLUDED.dl__task_stage,
    actual_hours = EXCLUDED.actual_hours;

-- State 3: Material Procurement Task
INSERT INTO app.d_task (
    id, code, name, descr,
    dl__task_stage, dl__task_priority,
    estimated_hours, actual_hours,
    story_points, active_flag,
    from_ts, created_ts, updated_ts, version
) VALUES (
    'aaaaaaaa-2222-2222-2222-222222222203',
    'TASK-WF-MATERIAL-PROC',
    'Material Procurement - HVAC Equipment',
    'Order and receive HVAC equipment and installation materials',
    'completed', 'high',
    '0.00', '0.00',
    2, true,
    now(), now(), now(), 1
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    descr = EXCLUDED.descr,
    dl__task_stage = EXCLUDED.dl__task_stage;

-- State 4: Schedule Planning Task
INSERT INTO app.d_task (
    id, code, name, descr,
    dl__task_stage, dl__task_priority,
    estimated_hours, actual_hours,
    story_points, active_flag,
    from_ts, created_ts, updated_ts, version
) VALUES (
    'aaaaaaaa-2222-2222-2222-222222222204',
    'TASK-WF-SCHEDULE-PLAN',
    'Schedule Planning - Installation Crew',
    'Schedule technicians, equipment, and installation date',
    'completed', 'high',
    '2.00', '2.00',
    1, true,
    now(), now(), now(), 1
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    descr = EXCLUDED.descr,
    dl__task_stage = EXCLUDED.dl__task_stage,
    actual_hours = EXCLUDED.actual_hours;

-- State 6: HVAC Installation Task
INSERT INTO app.d_task (
    id, code, name, descr,
    dl__task_stage, dl__task_priority,
    estimated_hours, actual_hours,
    story_points, active_flag,
    from_ts, created_ts, updated_ts, version
) VALUES (
    'aaaaaaaa-2222-2222-2222-222222222206',
    'TASK-WF-HVAC-INSTALL',
    'HVAC System Installation',
    'Install main HVAC unit, ductwork, and air handler',
    'completed', 'high',
    '6.00', '6.00',
    5, true,
    now(), now(), now(), 1
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    descr = EXCLUDED.descr,
    dl__task_stage = EXCLUDED.dl__task_stage,
    actual_hours = EXCLUDED.actual_hours;

-- State 7: Electrical Work Task
INSERT INTO app.d_task (
    id, code, name, descr,
    dl__task_stage, dl__task_priority,
    estimated_hours, actual_hours,
    story_points, active_flag,
    from_ts, created_ts, updated_ts, version
) VALUES (
    'aaaaaaaa-2222-2222-2222-222222222207',
    'TASK-WF-ELECTRICAL',
    'Electrical Connections and Wiring',
    'Install electrical connections, breakers, and wiring for HVAC system',
    'completed', 'high',
    '4.00', '4.00',
    3, true,
    now(), now(), now(), 1
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    descr = EXCLUDED.descr,
    dl__task_stage = EXCLUDED.dl__task_stage,
    actual_hours = EXCLUDED.actual_hours;

-- State 8: Final Touches Task
INSERT INTO app.d_task (
    id, code, name, descr,
    dl__task_stage, dl__task_priority,
    estimated_hours, actual_hours,
    story_points, active_flag,
    from_ts, created_ts, updated_ts, version
) VALUES (
    'aaaaaaaa-2222-2222-2222-222222222208',
    'TASK-WF-FINAL-TOUCHES',
    'Final Touches and Site Cleanup',
    'Complete finishing work, cleanup, and site restoration',
    'completed', 'medium',
    '2.00', '2.00',
    2, true,
    now(), now(), now(), 1
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    descr = EXCLUDED.descr,
    dl__task_stage = EXCLUDED.dl__task_stage,
    actual_hours = EXCLUDED.actual_hours;

-- State 9: Inspection Task
INSERT INTO app.d_task (
    id, code, name, descr,
    dl__task_stage, dl__task_priority,
    estimated_hours, actual_hours,
    story_points, active_flag,
    from_ts, created_ts, updated_ts, version
) VALUES (
    'aaaaaaaa-2222-2222-2222-222222222209',
    'TASK-WF-INSPECTION',
    'Quality Inspection and Verification',
    'Comprehensive quality inspection of all work completed',
    'completed', 'critical',
    '1.00', '1.00',
    2, true,
    now(), now(), now(), 1
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    descr = EXCLUDED.descr,
    dl__task_stage = EXCLUDED.dl__task_stage,
    actual_hours = EXCLUDED.actual_hours;
