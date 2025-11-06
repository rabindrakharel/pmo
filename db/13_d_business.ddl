-- =====================================================
-- BUSINESS ENTITY (d_business, alias biz) - ORG HIERARCHY
-- =====================================================
--
-- SEMANTICS:
-- • Business units with 3-level hierarchy (Department→Division→Corporate)
-- • Defines org structure, budget, manager assignments, project ownership
-- • Each unit assigned to office for operational coordination
--
-- OPERATIONS:
-- • CREATE: POST /api/v1/biz, INSERT with version=1, active_flag=true
-- • UPDATE: PUT /api/v1/biz/{id}, same ID, version++, in-place
-- • DELETE: active_flag=false, to_ts=now() (preserves projects)
-- • LIST: GET /api/v1/biz, filters by level/office, RBAC enforced
-- • HIERARCHY: Recursive CTE on parent_id, budget summaries
--
-- KEY FIELDS:
-- • id: uuid PRIMARY KEY (stable)
-- • code: varchar(50) UNIQUE ('BIZ-001')
-- • dl__business_level: text (Department, Division, Corporate)
-- • parent_id: uuid (self-ref for hierarchy, NULL for Corporate)
-- • office_id: uuid (office assignment)
-- • budget_allocated_amt: decimal(15,2)
-- • manager_employee_id: uuid
-- • version: integer (audit trail)
--
-- RELATIONSHIPS:
-- • Self: parent_id → d_business.id (3-level hierarchy)
-- • Parent: office (via office_id)
-- • Children: project, cost, revenue
-- • RBAC: entity_id_rbac_map
--
-- =====================================================

CREATE TABLE app.d_business (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,
    name varchar(200) NOT NULL,
    descr text,
    metadata jsonb DEFAULT '{}'::jsonb,
    active_flag boolean DEFAULT true,

    -- Hierarchy fields
    parent_id uuid ,
    dl__business_level text NOT NULL, -- References app.setting_datalabel (datalabel_name='business__level')

    -- Office relationship
    office_id uuid ,

    -- Business fields
    budget_allocated_amt decimal(15,2),
    manager_employee_id uuid,

    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);



-- Sample business unit hierarchy data for PMO company
-- Level 2: Corporate (Top level)
INSERT INTO app.d_business (
    code, name, descr,
    parent_id, dl__business_level, office_id, budget_allocated_amt, manager_employee_id
) VALUES (
    'HHS-CORP',
    'Huron Home Services Corporation',
    'Corporate parent entity overseeing all divisions and operations. Led by CEO James Miller with comprehensive oversight of strategic direction, financial performance, and operational excellence.',
    NULL, 'Corporate',
    '11111111-1111-1111-1111-111111111111', 5000000.00,
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'
);

-- Level 1: Service Operations Division
INSERT INTO app.d_business (
    code, name, descr,
    parent_id, dl__business_level, office_id, budget_allocated_amt, manager_employee_id
) VALUES (
    'SOD-001',
    'Service Operations Division',
    'Primary service delivery division managing all customer-facing operations including landscaping, HVAC, plumbing, and property maintenance services across Ontario.',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Division',
    '22222222-2222-2222-2222-222222222222', 3000000.00,
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'
);

-- Level 1: Corporate Services Division
INSERT INTO app.d_business (
    code, name, descr,
    parent_id, dl__business_level, office_id, budget_allocated_amt, manager_employee_id
) VALUES (
    'CSD-001',
    'Corporate Services Division',
    'Internal support division providing HR, Finance, IT, Legal, and Administrative services to support business operations. Ensures compliance, efficiency, and strategic support.',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Division',
    '11111111-1111-1111-1111-111111111111', 1500000.00,
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'
);

-- Level 0: Landscaping Department
INSERT INTO app.d_business (
    code, name, descr,
    parent_id, dl__business_level, office_id, budget_allocated_amt, manager_employee_id
) VALUES (
    'LAND-DEPT',
    'Landscaping Department',
    'Comprehensive landscaping services including design, installation, maintenance, seasonal cleanup, and grounds management for residential and commercial properties.',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Department',
    '44444444-4444-4444-4444-444444444444', 800000.00,
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'
);

-- Level 0: HVAC Department
INSERT INTO app.d_business (
    code, name, descr,
    parent_id, dl__business_level, office_id, budget_allocated_amt, manager_employee_id
) VALUES (
    'HVAC-DEPT',
    'HVAC Department',
    'Heating, ventilation, and air conditioning services including installation, repair, maintenance, and energy efficiency consulting for residential and commercial clients.',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Department',
    '44444444-4444-4444-4444-444444444444', 600000.00,
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'
);

-- Level 0: Property Maintenance Department
INSERT INTO app.d_business (
    code, name, descr,
    parent_id, dl__business_level, office_id, budget_allocated_amt, manager_employee_id
) VALUES (
    'PROP-DEPT',
    'Property Maintenance Department',
    'General property maintenance services including repairs, preventive maintenance, emergency response, and facility management for commercial and residential properties.',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Department',
    '44444444-4444-4444-4444-444444444444', 500000.00,
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'
);

-- Level 0: Human Resources Department
INSERT INTO app.d_business (
    code, name, descr,
    parent_id, dl__business_level, office_id, budget_allocated_amt, manager_employee_id
) VALUES (
    'HR-DEPT',
    'Human Resources Department',
    'Comprehensive HR services including recruitment, employee relations, training, benefits administration, performance management, and compliance oversight.',
    'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Department',
    '11111111-1111-1111-1111-111111111111', 400000.00,
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'
);

COMMENT ON TABLE app.d_business IS 'Business units with 3-level hierarchy: Department → Division → Corporate';