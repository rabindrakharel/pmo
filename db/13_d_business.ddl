-- =====================================================
-- BUSINESS ENTITY (d_business, alias biz) - HIERARCHICAL ENTITY
-- Departments and business units with 3-level organizational hierarchy
-- =====================================================
--
-- BUSINESS PURPOSE:
-- Manages business units across a 3-level hierarchy (Department → Division → Corporate).
-- Business units define organizational structure, budget allocation, manager assignments,
-- and ownership of projects. Each unit is assigned to an office location for operational coordination.
--
-- API SEMANTICS & LIFECYCLE:
--
-- 1. CREATE BUSINESS UNIT
--    • Endpoint: POST /api/v1/biz
--    • Body: {name, code, level_name, parent_id, office_id, budget_allocated_amt, manager_employee_id}
--    • Returns: {id: "new-uuid", version: 1, ...}
--    • Database: INSERT with version=1, active_flag=true, created_ts=now()
--    • RBAC: Requires permission 4 (create) on entity='biz', entity_id='all'
--    • Business Rule: dl__business_level must match app.setting_datalabel (datalabel_name='business__level') entries ("Department", "Division", "Corporate")
--
-- 2. UPDATE BUSINESS UNIT (Budget Changes, Manager Assignment, Office Reassignment)
--    • Endpoint: PUT /api/v1/biz/{id}
--    • Body: {name, parent_id, office_id, budget_allocated_amt, manager_employee_id, tags}
--    • Returns: {id: "same-uuid", version: 2, updated_ts: "new-timestamp"}
--    • Database: UPDATE SET [fields], version=version+1, updated_ts=now() WHERE id=$1
--    • SCD Behavior: IN-PLACE UPDATE
--      - Same ID (preserves project ownership and employee assignments)
--      - version increments (audit trail)
--      - updated_ts refreshed
--      - NO archival (business unit can move from Division A to Division B)
--    • RBAC: Requires permission 1 (edit) on entity='biz', entity_id={id} OR 'all'
--    • Business Rule: Changing parent_id restructures business hierarchy
--
-- 3. SOFT DELETE BUSINESS UNIT
--    • Endpoint: DELETE /api/v1/biz/{id}
--    • Database: UPDATE SET active_flag=false, to_ts=now() WHERE id=$1
--    • RBAC: Requires permission 3 (delete)
--    • Business Rule: Hides from lists; preserves projects and employee assignments
--
-- 4. LIST BUSINESS UNITS (Hierarchical or Flat)
--    • Endpoint: GET /api/v1/biz?level_name=Department&office_id={uuid}&limit=50
--    • Database:
--      SELECT b.* FROM d_business b
--      WHERE b.active_flag=true
--        AND EXISTS (
--          SELECT 1 FROM entity_id_rbac_map rbac
--          WHERE rbac.empid=$user_id
--            AND rbac.entity='biz'
--            AND (rbac.entity_id=b.id::text OR rbac.entity_id='all')
--            AND 0=ANY(rbac.permission)  -- View permission
--        )
--      ORDER BY b.dl__business_level DESC, b.name ASC
--      LIMIT $1 OFFSET $2
--    • RBAC: User sees ONLY business units they have view access to
--    • Frontend: Renders in EntityMainPage with table view (tree structure optional)
--
-- 5. GET SINGLE BUSINESS UNIT
--    • Endpoint: GET /api/v1/biz/{id}
--    • Database: SELECT * FROM d_business WHERE id=$1 AND active_flag=true
--    • RBAC: Checks entity_id_rbac_map for view permission
--    • Frontend: EntityDetailPage renders fields + tabs for child business units/projects
--
-- 6. GET BUSINESS HIERARCHY (Recursive Tree)
--    • Endpoint: GET /api/v1/biz/{id}/hierarchy
--    • Database: Recursive CTE traversing parent_id relationships
--      WITH RECURSIVE business_tree AS (
--        SELECT id, name, parent_id, level_name, 1 AS depth
--        FROM d_business WHERE id=$1
--        UNION ALL
--        SELECT b.id, b.name, b.parent_id, b.level_name, bt.depth+1
--        FROM d_business b
--        INNER JOIN business_tree bt ON b.parent_id = bt.id
--      )
--      SELECT * FROM business_tree ORDER BY depth, name
--    • Frontend: OrgChartView component or nested list
--
-- 7. GET BUSINESS PROJECTS
--    • Endpoint: GET /api/v1/biz/{id}/project?project_stage=Execution&limit=20
--    • Database:
--      SELECT p.* FROM d_project p
--      WHERE p.business_id=$1 AND p.active_flag=true
--      ORDER BY p.created_ts DESC
--    • Relationship: Direct FK (p.business_id) OR via entity_id_map
--    • Frontend: Renders in DynamicChildEntityTabs component
--
-- 8. GET BUDGET ALLOCATION SUMMARY
--    • Endpoint: GET /api/v1/biz/{id}/budget-summary
--    • Database: Aggregates budget_allocated_amt and project budgets
--      SELECT
--        b.budget_allocated_amt,
--        SUM(p.budget_spent_amt) AS total_spent,
--        COUNT(p.id) AS project_count
--      FROM d_business b
--      LEFT JOIN d_project p ON p.business_id=b.id AND p.active_flag=true
--      WHERE b.id=$1
--      GROUP BY b.id
--    • Business Rule: Shows budget allocation vs actual spending across projects
--
-- KEY SCD FIELDS:
-- • id: Stable UUID (never changes, preserves project ownership and hierarchy)
-- • version: Increments on updates (audit trail of budget changes, manager changes)
-- • from_ts: Business unit establishment date (never modified)
-- • to_ts: Business unit closure timestamp (NULL=active, timestamptz=closed)
-- • active_flag: Operational status (true=active, false=closed/archived)
-- • created_ts: Original creation time (never modified)
-- • updated_ts: Last modification time (refreshed on UPDATE)
--
-- KEY BUSINESS FIELDS:
-- • dl__business_level: Hierarchy level ("Department", "Division", "Corporate")
--   - Loaded from app.setting_datalabel table (datalabel_name='business__level') via GET /api/v1/setting?category=business__level
--   - Determines position in organizational tree
--   - Department (level 0) owns projects directly
-- • parent_id: Hierarchical relationship (NULL for Corporate, UUID for all others)
--   - Points to immediate parent business unit in tree
--   - Self-referencing foreign key pattern
-- • office_id: Office location assignment
--   - Links business unit to physical office location
--   - Used for geographic operational coordination
-- • budget_allocated_amt: Financial allocation for business unit
--   - Tracks planned spending capacity
--   - Compared against sum of project budgets
-- • manager_employee_id: Business unit manager
--   - Links to d_employee for leadership accountability
--   - Manager has elevated RBAC permissions for unit
--
-- RELATIONSHIPS:
-- • parent_id → d_business (self-reference for 3-level hierarchy)
-- • office_id → d_office (business unit operates from office)
-- • manager_employee_id → d_employee (business unit manager)
-- • business_id ← d_project (projects owned by business units)
-- • business_id ← entity_id_map (child entities linked via mapping table)
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