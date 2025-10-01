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
    business_id uuid ,
    office_id uuid ,

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



-- Sample project data for James Miller as CEO/Project Sponsor
-- Strategic Corporate Project
INSERT INTO app.d_project (
    id, slug, code, name, descr, tags, metadata,
    business_id, office_id, project_stage,
    budget_allocated, budget_spent,
    planned_start_date, planned_end_date, actual_start_date,
    manager_employee_id, sponsor_employee_id, stakeholder_employee_ids
) VALUES (
    '93106ffb-402e-43a7-8b26-5287e37a1b0e',
    'digital-transformation-2024',
    'DT-2024-001',
    'Digital Transformation Initiative 2024',
    'Comprehensive digital transformation project to modernize operations, implement new PMO systems, and enhance customer service capabilities across all business units. CEO-sponsored strategic initiative.',
    '["digital_transformation", "strategic", "modernization", "pmo", "customer_service"]'::jsonb,
    '{"project_type": "strategic", "priority": "high", "complexity": "high", "risk_level": "medium", "customer_impact": "high"}'::jsonb,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    'In Progress',
    750000.00, 285000.00,
    '2024-01-15', '2024-12-31', '2024-01-20',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    ARRAY['8260b1b0-5efc-4611-ad33-ee76c0cf7f13']::uuid[]
);

-- Landscaping Service Project
INSERT INTO app.d_project (
    id, slug, code, name, descr, tags, metadata,
    business_id, office_id, project_stage,
    budget_allocated, budget_spent,
    planned_start_date, planned_end_date, actual_start_date,
    manager_employee_id, sponsor_employee_id, stakeholder_employee_ids
) VALUES (
    '84215ccb-313d-48f8-9c37-4398f28c0b1f',
    'fall-landscaping-campaign-2024',
    'FLC-2024-001',
    'Fall 2024 Landscaping Campaign',
    'Seasonal landscaping campaign targeting residential and commercial properties for fall cleanup, winterization, and spring preparation services. Focus on customer retention and service expansion.',
    '["landscaping", "seasonal", "campaign", "fall", "cleanup", "winterization"]'::jsonb,
    '{"project_type": "operational", "priority": "high", "complexity": "medium", "risk_level": "low", "seasonal": true}'::jsonb,
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    '44444444-4444-4444-4444-444444444444',
    'Planning',
    150000.00, 45000.00,
    '2024-09-01', '2024-11-30', '2024-09-05',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    ARRAY['8260b1b0-5efc-4611-ad33-ee76c0cf7f13']::uuid[]
);

-- HVAC Modernization Project
INSERT INTO app.d_project (
    id, slug, code, name, descr, tags, metadata,
    business_id, office_id, project_stage,
    budget_allocated, budget_spent,
    planned_start_date, planned_end_date, actual_start_date,
    manager_employee_id, sponsor_employee_id, stakeholder_employee_ids
) VALUES (
    '72304dab-202c-39e7-8a26-3287d26a0c2d',
    'hvac-modernization-project',
    'HVAC-MOD-001',
    'HVAC Equipment and Service Modernization',
    'Comprehensive modernization of HVAC service offerings including smart systems integration, energy efficiency solutions, and preventive maintenance programs for commercial clients.',
    '["hvac", "modernization", "smart_systems", "energy_efficiency", "preventive_maintenance"]'::jsonb,
    '{"project_type": "operational", "priority": "medium", "complexity": "high", "risk_level": "medium", "innovation": true}'::jsonb,
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    '44444444-4444-4444-4444-444444444444',
    'Initiation',
    300000.00, 75000.00,
    '2024-10-01', '2025-03-31', NULL,
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    ARRAY['8260b1b0-5efc-4611-ad33-ee76c0cf7f13']::uuid[]
);

-- Corporate Office Expansion
INSERT INTO app.d_project (
    id, slug, code, name, descr, tags, metadata,
    business_id, office_id, project_stage,
    budget_allocated, budget_spent,
    planned_start_date, planned_end_date, actual_start_date,
    manager_employee_id, sponsor_employee_id, stakeholder_employee_ids
) VALUES (
    '61203bac-101b-28d6-7a15-2176c15a0b1c',
    'corporate-office-expansion',
    'COE-2024-001',
    'Corporate Office Expansion Project',
    'Physical expansion of corporate headquarters to accommodate growing team, enhance collaborative spaces, and implement modern office technologies. Strategic investment in company culture and efficiency.',
    '["corporate", "expansion", "headquarters", "infrastructure", "culture", "efficiency"]'::jsonb,
    '{"project_type": "infrastructure", "priority": "medium", "complexity": "medium", "risk_level": "low", "internal": true}'::jsonb,
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '11111111-1111-1111-1111-111111111111',
    'Planning',
    500000.00, 125000.00,
    '2024-11-01', '2025-04-30', NULL,
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    ARRAY['8260b1b0-5efc-4611-ad33-ee76c0cf7f13']::uuid[]
);

-- Customer Service Excellence Initiative
INSERT INTO app.d_project (
    id, slug, code, name, descr, tags, metadata,
    business_id, office_id, project_stage,
    budget_allocated, budget_spent,
    planned_start_date, planned_end_date, actual_start_date,
    manager_employee_id, sponsor_employee_id, stakeholder_employee_ids
) VALUES (
    '50192aab-000a-17c5-6904-1065b04a0a0b',
    'customer-service-excellence',
    'CSE-2024-001',
    'Customer Service Excellence Initiative',
    'Comprehensive program to enhance customer satisfaction through improved service delivery, response times, communication protocols, and feedback management across all service departments.',
    '["customer_service", "excellence", "satisfaction", "communication", "quality"]'::jsonb,
    '{"project_type": "service_improvement", "priority": "high", "complexity": "medium", "risk_level": "low", "customer_facing": true}'::jsonb,
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '22222222-2222-2222-2222-222222222222',
    'Execution',
    200000.00, 80000.00,
    '2024-08-01', '2024-12-15', '2024-08-05',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    ARRAY['8260b1b0-5efc-4611-ad33-ee76c0cf7f13']::uuid[]
);

COMMENT ON TABLE app.d_project IS 'Core project management entity';