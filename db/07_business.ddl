-- =====================================================
-- BUSINESS ENTITY (d_business) - OPERATIONAL UNITS
-- =====================================================
--
-- SEMANTICS:
-- Operational business units that execute day-to-day work and projects.
-- These are working teams/units that map to business hierarchy nodes.
--
-- **HIERARCHY CONCEPT**:
-- • d_business: Operational units (team-level entities doing actual work)
-- • d_business_hierarchy: Organizational hierarchy (Corporate → Division → Department)
-- • Relationship: app.business links to d_business_hierarchy via entity_instance_link
-- • Example: "Landscaping Team Alpha" (d_business) links to "Landscaping Department" (d_business_hierarchy)
--
-- OPERATIONS:
-- • CREATE: POST /api/v1/business, INSERT with version=1, active_flag=true
-- • UPDATE: PUT /api/v1/business/{id}, same ID, version++, in-place
-- • DELETE: active_flag=false, to_ts=now() (preserves projects)
-- • LIST: GET /api/v1/business, filters by office/status, RBAC enforced
--
-- RELATIONSHIPS (NO FOREIGN KEYS):
-- • Parent: d_business_hierarchy (via entity_instance_link)
-- • Parent: app.office (office assignment)
-- • Children: project, task, employee assignments
-- • RBAC: entity_rbac
--
-- =====================================================

CREATE TABLE app.business (
    id uuid DEFAULT gen_random_uuid(),
    code varchar(50),
    name varchar(200),
    descr text,
    metadata jsonb DEFAULT '{}'::jsonb,
    active_flag boolean DEFAULT true,

    -- Operational fields (NO hierarchy fields)
    office_id uuid, -- Office where this unit operates
    current_headcount integer DEFAULT 0, -- Number of employees
    operational_status text DEFAULT 'Active', -- Active, Restructuring, Archived

    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);

COMMENT ON TABLE app.business IS 'Operational business units (team-level) executing day-to-day work and projects';

-- =====================================================
-- BUSINESS HIERARCHY (d_business_hierarchy) - ORGANIZATIONAL STRUCTURE
-- 3-level hierarchy: Corporate → Division → Department
-- =====================================================
--
-- SEMANTICS:
-- Business hierarchy provides a 3-level organizational structure for business management.
-- This hierarchy is separate from operational units (d_business) and linked via entity_instance_link.
--
-- HIERARCHY LEVELS:
-- • Corporate: Top-level corporate entity (e.g., "Huron Home Services Corporation")
-- • Division: Divisional management level (e.g., "Service Operations Division")
-- • Department: Department management level (e.g., "Landscaping Department")
--
-- DATABASE BEHAVIOR:
-- • CREATE: INSERT with parent_business_hierarchy_id pointing to parent hierarchy node
-- • HIERARCHY: Self-referential parent_business_hierarchy_id for tree structure
-- • TRAVERSE: Recursive CTE on parent_business_hierarchy_id for full hierarchy path
--
-- RELATIONSHIPS:
-- • Self: parent_business_hierarchy_id → d_business_hierarchy.id
-- • Children: app.business (via entity_instance_link)
--
-- =====================================================

CREATE TABLE app.business_hierarchy (
    id uuid DEFAULT gen_random_uuid(),
    code varchar(50),
    name varchar(200),
    descr text,
    metadata jsonb DEFAULT '{}'::jsonb,
    active_flag boolean DEFAULT true,

    -- Hierarchy fields
    parent_business_hierarchy_id uuid, -- Self-referential for hierarchy (NULL for Corporate level)
    dl__business_hierarchy_level text, -- References app.setting_datalabel (datalabel_name='dl__business_hierarchy_level')

    -- Organizational fields
    manager_employee_id uuid, -- Manager of this hierarchy node
    budget_allocated_amt decimal(15,2), -- Budget allocated to this node

    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);

COMMENT ON TABLE app.business_hierarchy IS 'Business organizational hierarchy: Corporate → Division → Department';

-- =====================================================
-- DATA CURATION: Business Hierarchy
-- =====================================================

-- LEVEL 1: CORPORATE (Top-level)
INSERT INTO app.business_hierarchy (code, name, descr, parent_business_hierarchy_id, dl__business_hierarchy_level, manager_employee_id, budget_allocated_amt) VALUES
('BIZ-HIE-CORP', 'Huron Home Services Corporation', 'Corporate parent entity overseeing all divisions and operations. Led by CEO James Miller with comprehensive oversight of strategic direction, financial performance, and operational excellence.', NULL, 'Corporate', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', 5000000.00);

-- LEVEL 2: DIVISIONS
INSERT INTO app.business_hierarchy (code, name, descr, parent_business_hierarchy_id, dl__business_hierarchy_level, manager_employee_id, budget_allocated_amt)
SELECT 'BIZ-HIE-SOD', 'Service Operations Division', 'Primary service delivery division managing all customer-facing operations including landscaping, HVAC, plumbing, and property maintenance services across Ontario.', id, 'Division', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', 3000000.00
FROM app.business_hierarchy WHERE code = 'BIZ-HIE-CORP';

INSERT INTO app.business_hierarchy (code, name, descr, parent_business_hierarchy_id, dl__business_hierarchy_level, manager_employee_id, budget_allocated_amt)
SELECT 'BIZ-HIE-CSD', 'Corporate Services Division', 'Internal support division providing HR, Finance, IT, Legal, and Administrative services to support business operations. Ensures compliance, efficiency, and strategic support.', id, 'Division', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', 1500000.00
FROM app.business_hierarchy WHERE code = 'BIZ-HIE-CORP';

-- LEVEL 3: DEPARTMENTS (Service Operations Division)
INSERT INTO app.business_hierarchy (code, name, descr, parent_business_hierarchy_id, dl__business_hierarchy_level, manager_employee_id, budget_allocated_amt)
SELECT 'BIZ-HIE-LAND-DEPT', 'Landscaping Department', 'Comprehensive landscaping services including design, installation, maintenance, seasonal cleanup, and grounds management for residential and commercial properties.', id, 'Department', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', 800000.00
FROM app.business_hierarchy WHERE code = 'BIZ-HIE-SOD';

INSERT INTO app.business_hierarchy (code, name, descr, parent_business_hierarchy_id, dl__business_hierarchy_level, manager_employee_id, budget_allocated_amt)
SELECT 'BIZ-HIE-HVAC-DEPT', 'HVAC Department', 'Heating, ventilation, and air conditioning services including installation, repair, maintenance, and energy efficiency consulting for residential and commercial clients.', id, 'Department', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', 600000.00
FROM app.business_hierarchy WHERE code = 'BIZ-HIE-SOD';

INSERT INTO app.business_hierarchy (code, name, descr, parent_business_hierarchy_id, dl__business_hierarchy_level, manager_employee_id, budget_allocated_amt)
SELECT 'BIZ-HIE-PROP-DEPT', 'Property Maintenance Department', 'General property maintenance services including repairs, preventive maintenance, emergency response, and facility management for commercial and residential properties.', id, 'Department', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', 500000.00
FROM app.business_hierarchy WHERE code = 'BIZ-HIE-SOD';

-- LEVEL 3: DEPARTMENTS (Corporate Services Division)
INSERT INTO app.business_hierarchy (code, name, descr, parent_business_hierarchy_id, dl__business_hierarchy_level, manager_employee_id, budget_allocated_amt)
SELECT 'BIZ-HIE-HR-DEPT', 'Human Resources Department', 'Comprehensive HR services including recruitment, employee relations, training, benefits administration, performance management, and compliance oversight.', id, 'Department', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', 400000.00
FROM app.business_hierarchy WHERE code = 'BIZ-HIE-CSD';

INSERT INTO app.business_hierarchy (code, name, descr, parent_business_hierarchy_id, dl__business_hierarchy_level, manager_employee_id, budget_allocated_amt)
SELECT 'BIZ-HIE-FIN-DEPT', 'Finance Department', 'Financial management including accounting, budgeting, financial reporting, treasury management, and strategic financial planning.', id, 'Department', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', 350000.00
FROM app.business_hierarchy WHERE code = 'BIZ-HIE-CSD';

-- =====================================================
-- DATA CURATION: Operational Business Units
-- =====================================================

-- Example operational units (teams doing actual work)
-- These would link to hierarchy nodes via entity_instance_link

-- Landscaping operational teams
INSERT INTO app.business (
    code, name, descr,
    office_id, current_headcount, operational_status
) VALUES (
    'BIZ-LAND-ALPHA',
    'Landscaping Team Alpha',
    'Primary landscaping team operating in London area, specializing in residential property design and maintenance',
    '22222222-2222-2222-2222-222222222222', 8, 'Active'
);

INSERT INTO app.business (
    code, name, descr,
    office_id, current_headcount, operational_status
) VALUES (
    'BIZ-LAND-BETA',
    'Landscaping Team Beta',
    'Commercial landscaping team operating in GTA, focusing on large-scale commercial property maintenance',
    '33333333-3333-3333-3333-333333333333', 12, 'Active'
);

-- HVAC operational teams
INSERT INTO app.business (
    code, name, descr,
    office_id, current_headcount, operational_status
) VALUES (
    'BIZ-HVAC-ALPHA',
    'HVAC Installation Team',
    'Specialized team for new HVAC system installations in residential and light commercial properties',
    '22222222-2222-2222-2222-222222222222', 6, 'Active'
);

INSERT INTO app.business (
    code, name, descr,
    office_id, current_headcount, operational_status
) VALUES (
    'BIZ-HVAC-BETA',
    'HVAC Maintenance Team',
    'Service team specializing in HVAC maintenance, repairs, and emergency response across all service areas',
    '44444444-4444-4444-4444-444444444444', 10, 'Active'
);

-- Property Maintenance operational teams
INSERT INTO app.business (
    code, name, descr,
    office_id, current_headcount, operational_status
) VALUES (
    'BIZ-PROP-ALPHA',
    'Property Maintenance Team',
    'General property maintenance team handling repairs, preventive maintenance, and facility management',
    '22222222-2222-2222-2222-222222222222', 7, 'Active'
);

COMMENT ON TABLE app.business IS 'Operational business units (team-level) executing day-to-day work and projects';
COMMENT ON TABLE app.business_hierarchy IS 'Business organizational hierarchy: Corporate → Division → Department';
