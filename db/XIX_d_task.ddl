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
    project_id uuid NOT NULL ,
    business_id uuid ,
    office_id uuid ,

    -- Task assignment
    assignee_employee_ids uuid[] DEFAULT '{}',
    stage text, -- Task stage name (denormalized from meta_task_stage)

    -- Task details
    priority_level varchar(20) DEFAULT 'medium', -- low, medium, high, critical
    estimated_hours decimal(8,2),
    actual_hours decimal(8,2) DEFAULT 0,
    story_points integer,

    -- Dependencies
    parent_task_id uuid ,
    dependency_task_ids uuid[] DEFAULT '{}',

    -- Temporal fields
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);



-- Sample task data for projects managed by James Miller
-- Digital Transformation Project Tasks
INSERT INTO app.d_task (
    id, slug, code, name, descr, tags, metadata,
    project_id, business_id, office_id, assignee_employee_ids,
    stage, priority_level, estimated_hours, actual_hours, story_points
) VALUES (
    'a1111111-1111-1111-1111-111111111111',
    'dt-stakeholder-analysis',
    'DT-TASK-001',
    'Digital Transformation Stakeholder Analysis',
    'Comprehensive analysis of all stakeholders across business units to identify requirements, concerns, and success criteria for the digital transformation initiative.',
    '["stakeholder_analysis", "requirements", "strategic_planning"]'::jsonb,
    '{"task_type": "analysis", "deliverable": "stakeholder_matrix", "approval_required": true}'::jsonb,
    '93106ffb-402e-43a7-8b26-5287e37a1b0e',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    ARRAY['8260b1b0-5efc-4611-ad33-ee76c0cf7f13']::uuid[],
    'In Progress', 'high', 40.0, 28.5, 8
);

INSERT INTO app.d_task (
    id, slug, code, name, descr, tags, metadata,
    project_id, business_id, office_id, assignee_employee_ids,
    stage, priority_level, estimated_hours, actual_hours, story_points
) VALUES (
    'a2222222-2222-2222-2222-222222222222',
    'dt-vendor-evaluation',
    'DT-TASK-002',
    'PMO Software Vendor Evaluation',
    'Evaluate and score potential PMO software vendors based on functionality, integration capabilities, cost, and implementation timeline. CEO approval required for final selection.',
    '["vendor_evaluation", "pmo_software", "procurement"]'::jsonb,
    '{"task_type": "evaluation", "deliverable": "vendor_comparison_matrix", "ceo_approval": true}'::jsonb,
    '93106ffb-402e-43a7-8b26-5287e37a1b0e',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    ARRAY['8260b1b0-5efc-4611-ad33-ee76c0cf7f13']::uuid[],
    'Planning', 'critical', 60.0, 15.0, 13
);

-- Fall Landscaping Campaign Tasks
INSERT INTO app.d_task (
    id, slug, code, name, descr, tags, metadata,
    project_id, business_id, office_id, assignee_employee_ids,
    stage, priority_level, estimated_hours, actual_hours, story_points
) VALUES (
    'b1111111-1111-1111-1111-111111111111',
    'flc-campaign-strategy',
    'FLC-TASK-001',
    'Fall Campaign Marketing Strategy',
    'Develop comprehensive marketing strategy for fall landscaping campaign including customer targeting, pricing strategy, service packages, and promotional materials.',
    '["marketing_strategy", "campaign", "pricing", "promotion"]'::jsonb,
    '{"task_type": "strategic_planning", "deliverable": "marketing_plan", "budget_required": 15000}'::jsonb,
    '84215ccb-313d-48f8-9c37-4398f28c0b1f',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    '44444444-4444-4444-4444-444444444444',
    ARRAY['8260b1b0-5efc-4611-ad33-ee76c0cf7f13']::uuid[],
    'Completed', 'high', 32.0, 35.0, 5
);

INSERT INTO app.d_task (
    id, slug, code, name, descr, tags, metadata,
    project_id, business_id, office_id, assignee_employee_ids,
    stage, priority_level, estimated_hours, actual_hours, story_points
) VALUES (
    'b2222222-2222-2222-2222-222222222222',
    'flc-resource-planning',
    'FLC-TASK-002',
    'Fall Campaign Resource Planning',
    'Plan and allocate human resources, equipment, and materials for fall landscaping campaign. Ensure adequate capacity to meet projected demand and service commitments.',
    '["resource_planning", "capacity", "equipment", "staffing"]'::jsonb,
    '{"task_type": "operations_planning", "deliverable": "resource_allocation_plan", "equipment_audit": true}'::jsonb,
    '84215ccb-313d-48f8-9c37-4398f28c0b1f',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    '44444444-4444-4444-4444-444444444444',
    ARRAY['8260b1b0-5efc-4611-ad33-ee76c0cf7f13']::uuid[],
    'In Progress', 'high', 24.0, 18.0, 3
);

-- HVAC Modernization Tasks
INSERT INTO app.d_task (
    id, slug, code, name, descr, tags, metadata,
    project_id, business_id, office_id, assignee_employee_ids,
    stage, priority_level, estimated_hours, actual_hours, story_points
) VALUES (
    'c1111111-1111-1111-1111-111111111111',
    'hvac-market-research',
    'HVAC-TASK-001',
    'Smart HVAC Market Research',
    'Research emerging smart HVAC technologies, market trends, and customer demand for energy-efficient solutions. Identify competitive advantages and partnership opportunities.',
    '["market_research", "smart_technology", "energy_efficiency", "competitive_analysis"]'::jsonb,
    '{"task_type": "research", "deliverable": "market_analysis_report", "partnership_exploration": true}'::jsonb,
    '72304dab-202c-39e7-8a26-3287d26a0c2d',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    '44444444-4444-4444-4444-444444444444',
    ARRAY['8260b1b0-5efc-4611-ad33-ee76c0cf7f13']::uuid[],
    'Planning', 'medium', 48.0, 12.0, 8
);

-- Corporate Office Expansion Tasks
INSERT INTO app.d_task (
    id, slug, code, name, descr, tags, metadata,
    project_id, business_id, office_id, assignee_employee_ids,
    stage, priority_level, estimated_hours, actual_hours, story_points
) VALUES (
    'd1111111-1111-1111-1111-111111111111',
    'coe-space-planning',
    'COE-TASK-001',
    'Corporate Office Space Planning',
    'Design optimal office layout incorporating collaborative spaces, private offices, meeting rooms, and modern amenities. Focus on employee productivity and company culture enhancement.',
    '["space_planning", "office_design", "productivity", "culture", "collaboration"]'::jsonb,
    '{"task_type": "design", "deliverable": "office_layout_plans", "employee_input": true}'::jsonb,
    '61203bac-101b-28d6-7a15-2176c15a0b1c',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '11111111-1111-1111-1111-111111111111',
    ARRAY['8260b1b0-5efc-4611-ad33-ee76c0cf7f13']::uuid[],
    'Planning', 'medium', 56.0, 20.0, 8
);

-- Customer Service Excellence Tasks
INSERT INTO app.d_task (
    id, slug, code, name, descr, tags, metadata,
    project_id, business_id, office_id, assignee_employee_ids,
    stage, priority_level, estimated_hours, actual_hours, story_points
) VALUES (
    'e1111111-1111-1111-1111-111111111111',
    'cse-process-optimization',
    'CSE-TASK-001',
    'Customer Service Process Optimization',
    'Analyze and optimize current customer service processes to reduce response times, improve issue resolution, and enhance overall customer satisfaction across all touchpoints.',
    '["process_optimization", "response_time", "customer_satisfaction", "touchpoint_analysis"]'::jsonb,
    '{"task_type": "process_improvement", "deliverable": "optimized_service_processes", "training_required": true}'::jsonb,
    '50192aab-000a-17c5-6904-1065b04a0a0b',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '22222222-2222-2222-2222-222222222222',
    ARRAY['8260b1b0-5efc-4611-ad33-ee76c0cf7f13']::uuid[],
    'In Progress', 'high', 40.0, 32.0, 5
);

-- Strategic CEO oversight tasks
INSERT INTO app.d_task (
    id, slug, code, name, descr, tags, metadata,
    project_id, business_id, office_id, assignee_employee_ids,
    stage, priority_level, estimated_hours, actual_hours, story_points
) VALUES (
    'f1111111-1111-1111-1111-111111111111',
    'ceo-quarterly-review',
    'CEO-TASK-001',
    'Quarterly Business Performance Review',
    'Comprehensive quarterly review of all business units, projects, and key performance indicators. Assess progress against strategic objectives and identify areas for improvement or investment.',
    '["quarterly_review", "performance", "kpi_analysis", "strategic_assessment"]'::jsonb,
    '{"task_type": "executive_review", "deliverable": "quarterly_performance_report", "board_presentation": true}'::jsonb,
    '93106ffb-402e-43a7-8b26-5287e37a1b0e',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    ARRAY['8260b1b0-5efc-4611-ad33-ee76c0cf7f13']::uuid[],
    'In Progress', 'critical', 20.0, 8.0, 13
);

COMMENT ON TABLE app.d_task IS 'Task head table with core task information';