-- =====================================================
-- BUSINESS ENTITY (d_business, alias biz)
-- Represents departments and business units with 3-level hierarchy
-- level[0] → Department, level[1] → Division, level[2] → Corporate
-- =====================================================

CREATE TABLE app.d_business (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug varchar(100) UNIQUE NOT NULL,
    code varchar(50) UNIQUE NOT NULL,
    name varchar(200) NOT NULL,
    descr text,
    tags jsonb DEFAULT '[]'::jsonb,

    -- Hierarchy fields
    parent_id uuid ,
    level_id integer NOT NULL ,
    level_name varchar(50) NOT NULL, -- Department, Division, Corporate

    -- Office relationship
    office_id uuid ,

    -- Business fields
    budget_allocated decimal(15,2),
    manager_employee_id uuid, -- Will be added later when employee system is defined

    -- Temporal fields
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);



-- Sample business unit hierarchy data for PMO company
-- Level 2: Corporate (Top level)
INSERT INTO app.d_business (
    id, slug, code, name, descr, tags,
    parent_id, level_id, level_name, office_id, budget_allocated, manager_employee_id
) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'huron-home-services-corp',
    'HHS-CORP',
    'Huron Home Services Corporation',
    'Corporate parent entity overseeing all divisions and operations. Led by CEO James Miller with comprehensive oversight of strategic direction, financial performance, and operational excellence.',
    '["corporate", "parent", "strategic", "oversight"]'::jsonb,
    NULL, 2, 'Corporate',
    '11111111-1111-1111-1111-111111111111', 5000000.00,
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'
);

-- Level 1: Service Operations Division
INSERT INTO app.d_business (
    id, slug, code, name, descr, tags,
    parent_id, level_id, level_name, office_id, budget_allocated, manager_employee_id
) VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'service-operations-division',
    'SOD-001',
    'Service Operations Division',
    'Primary service delivery division managing all customer-facing operations including landscaping, HVAC, plumbing, and property maintenance services across Ontario.',
    '["service_delivery", "operations", "customer_facing", "field_services"]'::jsonb,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 'Division',
    '22222222-2222-2222-2222-222222222222', 3000000.00,
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'
);

-- Level 1: Corporate Services Division
INSERT INTO app.d_business (
    id, slug, code, name, descr, tags,
    parent_id, level_id, level_name, office_id, budget_allocated, manager_employee_id
) VALUES (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'corporate-services-division',
    'CSD-001',
    'Corporate Services Division',
    'Internal support division providing HR, Finance, IT, Legal, and Administrative services to support business operations. Ensures compliance, efficiency, and strategic support.',
    '["corporate_services", "support", "hr", "finance", "it", "admin"]'::jsonb,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 'Division',
    '11111111-1111-1111-1111-111111111111', 1500000.00,
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'
);

-- Level 0: Landscaping Department
INSERT INTO app.d_business (
    id, slug, code, name, descr, tags,
    parent_id, level_id, level_name, office_id, budget_allocated, manager_employee_id
) VALUES (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'landscaping-department',
    'LAND-DEPT',
    'Landscaping Department',
    'Comprehensive landscaping services including design, installation, maintenance, seasonal cleanup, and grounds management for residential and commercial properties.',
    '["landscaping", "grounds", "seasonal", "maintenance", "design"]'::jsonb,
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 0, 'Department',
    '44444444-4444-4444-4444-444444444444', 800000.00,
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'
);

-- Level 0: HVAC Department
INSERT INTO app.d_business (
    id, slug, code, name, descr, tags,
    parent_id, level_id, level_name, office_id, budget_allocated, manager_employee_id
) VALUES (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'hvac-department',
    'HVAC-DEPT',
    'HVAC Department',
    'Heating, ventilation, and air conditioning services including installation, repair, maintenance, and energy efficiency consulting for residential and commercial clients.',
    '["hvac", "heating", "cooling", "energy_efficiency", "maintenance"]'::jsonb,
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 0, 'Department',
    '44444444-4444-4444-4444-444444444444', 600000.00,
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'
);

-- Level 0: Property Maintenance Department
INSERT INTO app.d_business (
    id, slug, code, name, descr, tags,
    parent_id, level_id, level_name, office_id, budget_allocated, manager_employee_id
) VALUES (
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'property-maintenance-department',
    'PROP-DEPT',
    'Property Maintenance Department',
    'General property maintenance services including repairs, preventive maintenance, emergency response, and facility management for commercial and residential properties.',
    '["property_maintenance", "repairs", "preventive", "emergency", "facility_mgmt"]'::jsonb,
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 0, 'Department',
    '44444444-4444-4444-4444-444444444444', 500000.00,
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'
);

-- Level 0: Human Resources Department
INSERT INTO app.d_business (
    id, slug, code, name, descr, tags,
    parent_id, level_id, level_name, office_id, budget_allocated, manager_employee_id
) VALUES (
    'gggggggg-gggg-gggg-gggg-gggggggggggg',
    'human-resources-department',
    'HR-DEPT',
    'Human Resources Department',
    'Comprehensive HR services including recruitment, employee relations, training, benefits administration, performance management, and compliance oversight.',
    '["human_resources", "recruitment", "training", "benefits", "compliance"]'::jsonb,
    'cccccccc-cccc-cccc-cccc-cccccccccccc', 0, 'Department',
    '11111111-1111-1111-1111-111111111111', 400000.00,
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'
);

COMMENT ON TABLE app.d_business IS 'Business units with 3-level hierarchy: Department → Division → Corporate';