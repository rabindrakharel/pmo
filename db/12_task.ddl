-- =====================================================
-- TASK ENTITY (d_task) - WORK ITEMS
-- =====================================================
--
-- SEMANTICS:
-- • Individual work items with stages, priorities, time tracking
-- • Kanban board display with drag-drop stage transitions
-- • Supports assignees, artifacts, forms as children
--
-- OPERATIONS:
-- • CREATE: INSERT with version=1, active_flag=true
-- • UPDATE: Same ID, version++, updated_ts refreshes
-- • DELETE: active_flag=false, to_ts=now()
-- • QUERY: Filter by dl__task_stage, dl__task_priority
--
-- RELATIONSHIPS (NO FOREIGN KEYS):
-- • Parent: project (via entity_instance_link)
-- • Children: artifact, form, employee (assignees), cost, revenue
-- • RBAC: entity_rbac
--
-- =====================================================

CREATE TABLE app.task (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,
    name varchar(200) NOT NULL,
    descr text,
    metadata jsonb DEFAULT '{}'::jsonb,
    active_flag boolean DEFAULT true,
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1,

    -- Task-specific fields
    internal_url text,
    shared_url text,
    dl__task_stage text, -- References app.setting_datalabel (datalabel_name='task__stage')
    dl__task_priority text, -- References app.setting_datalabel (datalabel_name='task__priority')
    estimated_hours numeric(10,2),
    actual_hours numeric(10,2),
    story_points integer
);

COMMENT ON TABLE app.task IS 'Task head table with core task information';

-- =====================================================
-- DATA CURATION
-- =====================================================

-- Sample task data
INSERT INTO app.task (
    id, code, name, descr, internal_url, shared_url, metadata,
    dl__task_stage, dl__task_priority, estimated_hours, actual_hours, story_points
) VALUES (
    'a2222222-2222-2222-2222-222222222222',
    'DT-TASK-002',
    'PMO Software Vendor Evaluation',
    'Evaluate and score potential PMO software vendors based on functionality, integration capabilities, cost, and implementation timeline. CEO approval required for final selection.',
    '/task/a2222222-2222-2222-2222-222222222222',
    '/task/mK7wL3vP',
    '{"task_type": "evaluation", "deliverable": "vendor_comparison_matrix", "ceo_approval": true, "project_id": "93106ffb-402e-43a7-8b26-5287e37a1b0e", "business_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "office_id": "11111111-1111-1111-1111-111111111111"}'::jsonb,
    'Planning', 'critical', 60.0, 15.0, 13
);

-- Fall Landscaping Campaign Tasks
INSERT INTO app.task (
    id, code, name, descr, internal_url, shared_url, metadata,
    dl__task_stage, dl__task_priority, estimated_hours, actual_hours, story_points
) VALUES (
    'b1111111-1111-1111-1111-111111111111',
    'FLC-TASK-001',
    'Fall Campaign Marketing Strategy',
    'Develop comprehensive marketing strategy for fall landscaping campaign including customer targeting, pricing strategy, service packages, and promotional materials.',
    '/task/b1111111-1111-1111-1111-111111111111',
    '/task/zN9hY5cM',
    '{"task_type": "strategic_planning", "deliverable": "marketing_plan", "budget_required": 15000, "project_id": "84215ccb-313d-48f8-9c37-4398f28c0b1f", "business_id": "dddddddd-dddd-dddd-dddd-dddddddddddd", "office_id": "44444444-4444-4444-4444-444444444444"}'::jsonb,
    'Completed', 'high', 32.0, 35.0, 5
);

INSERT INTO app.task (
    id, code, name, descr, internal_url, shared_url, metadata,
    dl__task_stage, dl__task_priority, estimated_hours, actual_hours, story_points
) VALUES (
    'b2222222-2222-2222-2222-222222222222',
    'FLC-TASK-002',
    'Fall Campaign Resource Planning',
    'Plan and allocate human resources, equipment, and materials for fall landscaping campaign. Ensure adequate capacity to meet projected demand and service commitments.',
    '/task/b2222222-2222-2222-2222-222222222222',
    '/task/rF8sB6dQ',
    '{"task_type": "operations_planning", "deliverable": "resource_allocation_plan", "equipment_audit": true, "project_id": "84215ccb-313d-48f8-9c37-4398f28c0b1f", "business_id": "dddddddd-dddd-dddd-dddd-dddddddddddd", "office_id": "44444444-4444-4444-4444-444444444444"}'::jsonb,
    'In Progress', 'high', 24.0, 18.0, 3
);

-- HVAC Modernization Tasks
INSERT INTO app.task (
    id, code, name, descr, internal_url, shared_url, metadata,
    dl__task_stage, dl__task_priority, estimated_hours, actual_hours, story_points
) VALUES (
    'c1111111-1111-1111-1111-111111111111',
    'HVAC-TASK-001',
    'Smart HVAC Market Research',
    'Research emerging smart HVAC technologies, market trends, and customer demand for energy-efficient solutions. Identify competitive advantages and partnership opportunities.',
    '/task/c1111111-1111-1111-1111-111111111111',
    '/task/pX2jW4kL',
    '{"task_type": "research", "deliverable": "market_analysis_report", "partnership_exploration": true, "project_id": "72304dab-202c-39e7-8a26-3287d26a0c2d", "business_id": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", "office_id": "44444444-4444-4444-4444-444444444444"}'::jsonb,
    'Planning', 'medium', 48.0, 12.0, 8
);

-- Corporate Office Expansion Tasks
INSERT INTO app.task (
    id, code, name, descr, internal_url, shared_url, metadata,
    dl__task_stage, dl__task_priority, estimated_hours, actual_hours, story_points
) VALUES (
    'd1111111-1111-1111-1111-111111111111',
    'COE-TASK-001',
    'Corporate Office Space Planning',
    'Design optimal office layout incorporating collaborative spaces, private offices, meeting rooms, and modern amenities. Focus on employee productivity and company culture enhancement.',
    '/task/d1111111-1111-1111-1111-111111111111',
    '/task/vG5mA1tY',
    '{"task_type": "design", "deliverable": "office_layout_plans", "employee_input": true, "project_id": "61203bac-101b-28d6-7a15-2176c15a0b1c", "business_id": "cccccccc-cccc-cccc-cccc-cccccccccccc", "office_id": "11111111-1111-1111-1111-111111111111"}'::jsonb,
    'Planning', 'medium', 56.0, 20.0, 8
);

-- Customer Service Excellence Tasks
INSERT INTO app.task (
    id, code, name, descr, internal_url, shared_url, metadata,
    dl__task_stage, dl__task_priority, estimated_hours, actual_hours, story_points
) VALUES (
    'e1111111-1111-1111-1111-111111111111',
    'CSE-TASK-001',
    'Customer Service Process Optimization',
    'Analyze and optimize current customer service processes to reduce response times, improve issue resolution, and enhance overall customer satisfaction across all touchpoints.',
    '/task/e1111111-1111-1111-1111-111111111111',
    '/task/qD7nC3xK',
    '{"task_type": "process_improvement", "deliverable": "optimized_service_processes", "training_required": true, "project_id": "50192aab-000a-17c5-6904-1065b04a0a0b", "business_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "office_id": "22222222-2222-2222-2222-222222222222"}'::jsonb,
    'In Progress', 'high', 40.0, 32.0, 5
);

-- Strategic CEO oversight tasks
INSERT INTO app.task (
    id, code, name, descr, internal_url, shared_url, metadata,
    dl__task_stage, dl__task_priority, estimated_hours, actual_hours, story_points
) VALUES (
    'f1111111-1111-1111-1111-111111111111',
    'CEO-TASK-001',
    'Quarterly Business Performance Review',
    'Comprehensive quarterly review of all business units, projects, and key performance indicators. Assess progress against strategic objectives and identify areas for improvement or investment.',
    '/task/f1111111-1111-1111-1111-111111111111',
    '/task/hJ6pR9wV',
    '{"task_type": "executive_review", "deliverable": "quarterly_performance_report", "board_presentation": true, "project_id": "93106ffb-402e-43a7-8b26-5287e37a1b0e", "business_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "office_id": "11111111-1111-1111-1111-111111111111"}'::jsonb,
    'In Progress', 'critical', 20.0, 8.0, 13
);

COMMENT ON TABLE app.task IS 'Task head table with core task information';
