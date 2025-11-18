-- =====================================================
-- PROJECT ENTITY (d_project) - CORE WORK CONTAINER
-- =====================================================
--
-- SEMANTICS:
-- • Primary work containers with budget, schedule, and team tracking
-- • Stable UUID preserves child relationships, in-place updates (version++)
-- • Workflow stages drive Kanban view and colored badges
--
-- OPERATIONS:
-- • CREATE: INSERT with version=1, active_flag=true
-- • UPDATE: Same ID, version++, updated_ts refreshes
-- • DELETE: active_flag=false, to_ts=now() (preserves children)
-- • QUERY: Filter by dl__project_stage, business, RBAC enforced
--
-- RELATIONSHIPS (NO FOREIGN KEYS):
-- • Parent: business (via entity_instance_link)
-- • Children: task, artifact, wiki, form, cost, revenue
-- • RBAC: entity_rbac
--
-- =====================================================

CREATE TABLE app.project (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,
    name varchar(200) NOT NULL,
    descr text,
    metadata jsonb DEFAULT '{}'::jsonb,

    -- Project relationships to parent entity are managed via entity_id_map so no FK needed

    -- Project fields
    dl__project_stage text, -- References app.setting_datalabel (datalabel_name='project__stage')
    budget_allocated_amt decimal(15,2),
    budget_spent_amt decimal(15,2) DEFAULT 0,
    planned_start_date date,
    planned_end_date date,
    actual_start_date date,
    actual_end_date date,

    -- Project team
    manager_employee_id uuid,
    sponsor_employee_id uuid,
    stakeholder_employee_ids uuid[] DEFAULT '{}',

    -- Temporal fields
    active_flag boolean DEFAULT true,
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);

COMMENT ON TABLE app.project IS 'Project entities with budget tracking, schedule management, and team assignments';

-- =====================================================
-- DATA CURATION
-- =====================================================

-- Sample project data for James Miller as CEO/Project Sponsor
-- Strategic Corporate Project
INSERT INTO app.project (
    id, code, name, descr, metadata,
    dl__project_stage,
    budget_allocated_amt, budget_spent_amt,
    planned_start_date, planned_end_date, actual_start_date,
    manager_employee_id, sponsor_employee_id, stakeholder_employee_ids
) VALUES (
    '93106ffb-402e-43a7-8b26-5287e37a1b0e',
    'DT-2024-001',
    'Digital Transformation Initiative 2024',
    'Comprehensive digital transformation project to modernize operations, implement new PMO systems, and enhance customer service capabilities across all business units. CEO-sponsored strategic initiative.',
    '{"project_type": "strategic", "priority": "high", "complexity": "high", "risk_level": "medium", "customer_impact": "high", "business_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "office_id": "11111111-1111-1111-1111-111111111111"}'::jsonb,
    'In Progress',
    750000.00, 285000.00,
    '2024-01-15', '2024-12-31', '2024-01-20',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    ARRAY['8260b1b0-5efc-4611-ad33-ee76c0cf7f13']::uuid[]
);

-- Landscaping Service Project
INSERT INTO app.project (
    id, code, name, descr, metadata,
    dl__project_stage,
    budget_allocated_amt, budget_spent_amt,
    planned_start_date, planned_end_date, actual_start_date,
    manager_employee_id, sponsor_employee_id, stakeholder_employee_ids
) VALUES (
    '84215ccb-313d-48f8-9c37-4398f28c0b1f',
    'FLC-2024-001',
    'Fall 2024 Landscaping Campaign',
    'Seasonal landscaping campaign targeting residential and commercial properties for fall cleanup, winterization, and spring preparation services. Focus on customer retention and service expansion.',
    '{"project_type": "operational", "priority": "high", "complexity": "medium", "risk_level": "low", "seasonal": true, "business_id": "dddddddd-dddd-dddd-dddd-dddddddddddd", "office_id": "44444444-4444-4444-4444-444444444444"}'::jsonb,
    'Planning',
    150000.00, 45000.00,
    '2024-09-01', '2024-11-30', '2024-09-05',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    ARRAY['8260b1b0-5efc-4611-ad33-ee76c0cf7f13']::uuid[]
);

-- HVAC Modernization Project
INSERT INTO app.project (
    id, code, name, descr, metadata,
    dl__project_stage,
    budget_allocated_amt, budget_spent_amt,
    planned_start_date, planned_end_date, actual_start_date,
    manager_employee_id, sponsor_employee_id, stakeholder_employee_ids
) VALUES (
    '72304dab-202c-39e7-8a26-3287d26a0c2d',
    'HVAC-MOD-001',
    'HVAC Equipment and Service Modernization',
    'Comprehensive modernization of HVAC service offerings including smart systems integration, energy efficiency solutions, and preventive maintenance programs for commercial clients.',
    '{"project_type": "operational", "priority": "medium", "complexity": "high", "risk_level": "medium", "innovation": true, "business_id": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", "office_id": "44444444-4444-4444-4444-444444444444"}'::jsonb,
    'Initiation',
    300000.00, 75000.00,
    '2024-10-01', '2025-03-31', NULL,
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    ARRAY['8260b1b0-5efc-4611-ad33-ee76c0cf7f13']::uuid[]
);

-- Corporate Office Expansion
INSERT INTO app.project (
    id, code, name, descr, metadata,
    dl__project_stage,
    budget_allocated_amt, budget_spent_amt,
    planned_start_date, planned_end_date, actual_start_date,
    manager_employee_id, sponsor_employee_id, stakeholder_employee_ids
) VALUES (
    '61203bac-101b-28d6-7a15-2176c15a0b1c',
    'COE-2024-001',
    'Corporate Office Expansion Project',
    'Physical expansion of corporate headquarters to accommodate growing team, enhance collaborative spaces, and implement modern office technologies. Strategic investment in company culture and efficiency.',
    '{"project_type": "infrastructure", "priority": "medium", "complexity": "medium", "risk_level": "low", "internal": true, "business_id": "cccccccc-cccc-cccc-cccc-cccccccccccc", "office_id": "11111111-1111-1111-1111-111111111111"}'::jsonb,
    'Planning',
    500000.00, 125000.00,
    '2024-11-01', '2025-04-30', NULL,
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    ARRAY['8260b1b0-5efc-4611-ad33-ee76c0cf7f13']::uuid[]
);

-- Customer Service Excellence Initiative
INSERT INTO app.project (
    id, code, name, descr, metadata,
    dl__project_stage,
    budget_allocated_amt, budget_spent_amt,
    planned_start_date, planned_end_date, actual_start_date,
    manager_employee_id, sponsor_employee_id, stakeholder_employee_ids
) VALUES (
    '50192aab-000a-17c5-6904-1065b04a0a0b',
    'CSE-2024-001',
    'Customer Service Excellence Initiative',
    'Comprehensive program to enhance customer satisfaction through improved service delivery, response times, communication protocols, and feedback management across all service departments.',
    '{"project_type": "service_improvement", "priority": "high", "complexity": "medium", "risk_level": "low", "customer_facing": true, "business_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "office_id": "22222222-2222-2222-2222-222222222222"}'::jsonb,
    'Execution',
    200000.00, 80000.00,
    '2024-08-01', '2024-12-15', '2024-08-05',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    ARRAY['8260b1b0-5efc-4611-ad33-ee76c0cf7f13']::uuid[]
);

COMMENT ON TABLE app.project IS 'Core project management entity';
