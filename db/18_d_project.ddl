-- =====================================================
-- PROJECT ENTITY (d_project) - CORE ENTITY
-- Project management with budget tracking, timelines, and team assignments
-- =====================================================
--
-- BUSINESS PURPOSE:
-- Tracks projects with budgets, schedules, team assignments, and lifecycle stages.
-- Projects are the primary container for tasks, artifacts, wiki pages, and forms.
-- Supports hierarchical organization through business units and offices.
--
-- API SEMANTICS & LIFECYCLE:
--
-- 1. CREATE PROJECT
--    • Endpoint: POST /api/v1/project
--    • Body: {name, code, slug, project_stage, budget_allocated, planned_start_date, business_id}
--    • Returns: {id: "new-uuid", version: 1, ...}
--    • Database: INSERT with version=1, active_flag=true, created_ts=now()
--    • RBAC: Requires permission 4 (create) on entity='project', entity_id='all'
--    • Business Rule: Creates entity_id_map entries for business/office relationships
--
-- 2. UPDATE PROJECT (Inline Edits, Stage Changes, Budget Updates)
--    • Endpoint: PUT /api/v1/project/{id}
--    • Body: {project_stage, budget_spent, actual_end_date, stakeholder_employee_ids}
--    • Returns: {id: "same-uuid", version: 2, updated_ts: "new-timestamp"}
--    • Database: UPDATE SET [fields], version=version+1, updated_ts=now() WHERE id=$1
--    • SCD Behavior: IN-PLACE UPDATE
--      - Same ID (preserves all child entity relationships)
--      - version increments (audit trail)
--      - updated_ts refreshed
--      - NO archival (dl__project_stage can change: Planning → Execution → Closure)
--    • RBAC: Requires permission 1 (edit) on entity='project', entity_id={id} OR 'all'
--    • Business Rule: Stage changes trigger frontend Kanban column moves
--
-- 3. SOFT DELETE PROJECT
--    • Endpoint: DELETE /api/v1/project/{id}
--    • Database: UPDATE SET active_flag=false, to_ts=now() WHERE id=$1
--    • RBAC: Requires permission 3 (delete)
--    • Business Rule: Hides from lists but preserves all child entities and relationships
--
-- 4. LIST PROJECTS (With RBAC Filtering)
--    • Endpoint: GET /api/v1/project?project_stage=Execution&business_id={uuid}&limit=50
--    • Database:
--      SELECT p.* FROM d_project p
--      WHERE active_flag=true
--        AND EXISTS (
--          SELECT 1 FROM entity_id_rbac_map rbac
--          WHERE rbac.empid=$user_id
--            AND rbac.entity='project'
--            AND (rbac.entity_id=p.id::text OR rbac.entity_id='all')
--            AND 0=ANY(rbac.permission)  -- View permission
--        )
--      ORDER BY name ASC, created_ts DESC
--      LIMIT $1 OFFSET $2
--    • RBAC: User sees ONLY projects they have view access to
--    • Frontend: Renders in EntityMainPage with table/kanban views
--
-- 5. GET SINGLE PROJECT (With Child Entity Counts)
--    • Endpoint: GET /api/v1/project/{id}
--    • Database: SELECT * FROM d_project WHERE id=$1 AND active_flag=true
--    • RBAC: Checks entity_id_rbac_map for view permission
--    • Frontend: EntityDetailPage renders fields + tabs for tasks/wiki/artifacts/forms
--
-- 6. GET PROJECT CHILD ENTITIES
--    • Endpoint: GET /api/v1/project/{id}/task?status=In Progress&limit=20
--    • Database:
--      SELECT t.* FROM d_task t
--      WHERE t.project_id=$1 AND t.active_flag=true
--      ORDER BY t.created_ts DESC
--    • Relationship: Direct FK (t.project_id) OR via entity_id_map
--    • Frontend: Renders in DynamicChildEntityTabs component
--
-- 7. GET PROJECT ACTION SUMMARIES (Tab Counts)
--    • Endpoint: GET /api/v1/project/{id}/dynamic-child-entity-tabs
--    • Returns: {action_entities: [{actionEntity: "task", count: 8, label: "Tasks", icon: "CheckSquare"}, ...]}
--    • Database: Counts via entity_id_map JOINs:
--      SELECT COUNT(*) FROM d_task t
--      INNER JOIN entity_id_map eim ON eim.child_entity_id=t.id
--      WHERE eim.parent_entity_id=$1 AND eim.parent_entity_type='project'
--    • Frontend: Renders tab badges with counts
--
-- KEY SCD FIELDS:
-- • id: Stable UUID (never changes, preserves child relationships)
-- • version: Increments on updates (audit trail of changes)
-- • from_ts: Record creation timestamp (never modified)
-- • to_ts: Soft delete timestamp (NULL=active, timestamptz=deleted)
-- • active_flag: Soft delete flag (true=active, false=deleted/archived)
-- • created_ts: Original creation time (never modified)
-- • updated_ts: Last modification time (refreshed on UPDATE)
--
-- KEY BUSINESS FIELDS:
-- • dl__project_stage: Workflow state (Initiation, Planning, Execution, Monitoring, Closure, On Hold, Cancelled)
--   - Loaded from app.setting_datalabel table (datalabel_name='project__stage') via GET /api/v1/setting?category=project__stage
--   - Drives Kanban column placement in frontend
--   - Updated via inline editing or drag-drop in UI
-- • budget_allocated vs budget_spent: Financial tracking
-- • planned_* vs actual_*: Timeline tracking (start/end dates)
-- • manager_employee_id, sponsor_employee_id, stakeholder_employee_ids[]: Team assignments
--
-- RELATIONSHIPS:
-- • business_id → d_business (which business unit owns this project)
-- • office_id → d_office (which office manages this project)
-- • project_id ← d_task (tasks belong to project via FK)
-- • project_id ← entity_id_map (tasks/wiki/artifacts/forms linked via mapping table)
--
-- =====================================================

CREATE TABLE app.d_project (
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



-- Sample project data for James Miller as CEO/Project Sponsor
-- Strategic Corporate Project
INSERT INTO app.d_project (
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
INSERT INTO app.d_project (
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
INSERT INTO app.d_project (
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
INSERT INTO app.d_project (
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
INSERT INTO app.d_project (
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

COMMENT ON TABLE app.d_project IS 'Core project management entity';