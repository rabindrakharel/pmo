-- =====================================================
-- TASK ENTITY (d_task) - HEAD TABLE
-- Task management with Kanban workflow, assignments, and estimation
-- =====================================================
--
-- BUSINESS PURPOSE:
-- Tracks individual work items within projects. Supports Kanban workflow (stages),
-- priority levels, time estimation, team assignments, and task dependencies.
-- Primary child entity of projects; displayed in table and Kanban board views.
--
-- API SEMANTICS & LIFECYCLE:
--
-- 1. CREATE TASK
--    • Endpoint: POST /api/v1/task
--    • Body: {name, code, project_id, stage, priority_level, assignee_employee_ids[], estimated_hours}
--    • Returns: {id: "new-uuid", version: 1, ...}
--    • Database: INSERT with version=1, active_flag=true, created_ts=now()
--    • RBAC: Requires permission 4 (create) on entity='task', entity_id='all'
--    • Business Rule: Creates entity_id_map entry linking to project_id
--
-- 2. UPDATE TASK (Stage Changes, Assignments, Hour Tracking)
--    • Endpoint: PUT /api/v1/task/{id}
--    • Body: {stage: "In Progress", actual_hours: 15.5, assignee_employee_ids: ["uuid1", "uuid2"]}
--    • Returns: {id: "same-uuid", version: 2, updated_ts: "new-timestamp"}
--    • Database: UPDATE SET stage=$1, actual_hours=$2, assignee_employee_ids=$3, version=version+1, updated_ts=now() WHERE id=$4
--    • SCD Behavior: IN-PLACE UPDATE
--      - Same ID (preserves relationships to artifacts/forms)
--      - version increments (audit trail)
--      - updated_ts refreshed
--      - stage field drives Kanban column placement
--    • RBAC: Requires permission 1 (edit) on entity='task', entity_id={id} OR 'all'
--    • Business Rule: Stage transitions (Backlog → To Do → In Progress → Done) trigger UI updates
--
-- 3. DRAG-DROP STAGE CHANGE (Kanban Board)
--    • Frontend Action: User drags task card from "To Do" column to "In Progress" column
--    • Endpoint: PUT /api/v1/task/{id}
--    • Body: {stage: "In Progress"}
--    • Database: UPDATE SET stage=$1, updated_ts=now(), version=version+1 WHERE id=$2
--    • Frontend: KanbanBoard component re-renders; card moves to new column
--
-- 4. INLINE EDIT (Table View)
--    • Frontend Action: User clicks priority badge in table row, selects "Critical"
--    • Endpoint: PUT /api/v1/task/{id}
--    • Body: {priority_level: "critical"}
--    • Database: UPDATE SET priority_level=$1, updated_ts=now(), version=version+1 WHERE id=$2
--    • Frontend: FilteredDataTable re-fetches data; badge updates color to red
--
-- 5. LIST TASKS (Project-Filtered, RBAC Applied)
--    • Endpoint: GET /api/v1/project/{project_id}/task?stage=In Progress&limit=50
--    • Database:
--      SELECT t.* FROM d_task t
--      WHERE t.project_id=$1 AND t.stage=$2 AND t.active_flag=true
--      ORDER BY t.priority_level DESC, t.created_ts DESC
--      LIMIT $3
--    • RBAC: Filtered via project-level permissions (if user can view project, can view tasks)
--    • Frontend: Renders in EntityChildListPage with table or Kanban view
--
-- 6. GET TASK DETAILS
--    • Endpoint: GET /api/v1/task/{id}
--    • Database: SELECT * FROM d_task WHERE id=$1 AND active_flag=true
--    • RBAC: Checks entity_id_rbac_map for view permission
--    • Frontend: EntityDetailPage renders fields + tabs for artifacts/forms
--
-- 7. SOFT DELETE TASK
--    • Endpoint: DELETE /api/v1/task/{id}
--    • Database: UPDATE SET active_flag=false, to_ts=now() WHERE id=$1
--    • RBAC: Requires permission 3 (delete)
--    • Business Rule: Hides from Kanban/table views; preserves artifacts/forms
--
-- KEY SCD FIELDS:
-- • id: Stable UUID (never changes, preserves child relationships)
-- • version: Increments on updates (audit trail)
-- • from_ts: Record creation timestamp (never modified)
-- • to_ts: Soft delete timestamp (NULL=active, timestamptz=deleted)
-- • active_flag: Soft delete flag (true=active, false=deleted)
-- • created_ts: Original creation time (never modified)
-- • updated_ts: Last modification time (refreshed on UPDATE)
--
-- KEY BUSINESS FIELDS:
-- • stage: Workflow state (Backlog, To Do, In Progress, In Review, Blocked, Done, Cancelled)
--   - Loaded from setting_datalabel_task_stage via /api/v1/setting?category=task_stage
--   - Drives Kanban column placement
--   - Updated via inline editing or drag-drop
-- • priority_level: Urgency (low, medium, high, critical, urgent)
--   - Loaded from setting_datalabel_task_priority via /api/v1/setting?category=task_priority
--   - Affects sort order in lists
-- • estimated_hours vs actual_hours: Time tracking for project burn-down
-- • assignee_employee_ids[]: Array of UUIDs for multi-user assignment
-- • parent_task_id: Subtask hierarchy support
-- • dependency_task_ids[]: Task dependencies for scheduling
--
-- RELATIONSHIPS:
-- • project_id → d_project (which project owns this task) - DIRECT FK
-- • assignee_employee_ids[] → d_employee (who is assigned)
-- • parent_task_id → d_task (subtask hierarchy)
-- • task_id ← entity_id_map (artifacts/forms linked via mapping table)
--
-- =====================================================

CREATE TABLE app.d_task (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug varchar(100) UNIQUE NOT NULL,
    code varchar(50) UNIQUE NOT NULL,
    name varchar(200) NOT NULL,
    descr text,
    tags jsonb DEFAULT '[]'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,

    -- Task to parent entity relationships no FK needed as the relationships are managed via entity_id_map

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
    assignee_employee_ids,
    stage, priority_level, estimated_hours, actual_hours, story_points
) VALUES (
    'a1111111-1111-1111-1111-111111111111',
    'dt-stakeholder-analysis',
    'DT-TASK-001',
    'Digital Transformation Stakeholder Analysis',
    'Comprehensive analysis of all stakeholders across business units to identify requirements, concerns, and success criteria for the digital transformation initiative.',
    '["stakeholder_analysis", "requirements", "strategic_planning"]'::jsonb,
    '{"task_type": "analysis", "deliverable": "stakeholder_matrix", "approval_required": true, "project_id": "93106ffb-402e-43a7-8b26-5287e37a1b0e", "business_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "office_id": "11111111-1111-1111-1111-111111111111"}'::jsonb,
    ARRAY['8260b1b0-5efc-4611-ad33-ee76c0cf7f13']::uuid[],
    'In Progress', 'high', 40.0, 28.5, 8
);

INSERT INTO app.d_task (
    id, slug, code, name, descr, tags, metadata,
    assignee_employee_ids,
    stage, priority_level, estimated_hours, actual_hours, story_points
) VALUES (
    'a2222222-2222-2222-2222-222222222222',
    'dt-vendor-evaluation',
    'DT-TASK-002',
    'PMO Software Vendor Evaluation',
    'Evaluate and score potential PMO software vendors based on functionality, integration capabilities, cost, and implementation timeline. CEO approval required for final selection.',
    '["vendor_evaluation", "pmo_software", "procurement"]'::jsonb,
    '{"task_type": "evaluation", "deliverable": "vendor_comparison_matrix", "ceo_approval": true, "project_id": "93106ffb-402e-43a7-8b26-5287e37a1b0e", "business_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "office_id": "11111111-1111-1111-1111-111111111111"}'::jsonb,
    ARRAY['8260b1b0-5efc-4611-ad33-ee76c0cf7f13']::uuid[],
    'Planning', 'critical', 60.0, 15.0, 13
);

-- Fall Landscaping Campaign Tasks
INSERT INTO app.d_task (
    id, slug, code, name, descr, tags, metadata,
    assignee_employee_ids,
    stage, priority_level, estimated_hours, actual_hours, story_points
) VALUES (
    'b1111111-1111-1111-1111-111111111111',
    'flc-campaign-strategy',
    'FLC-TASK-001',
    'Fall Campaign Marketing Strategy',
    'Develop comprehensive marketing strategy for fall landscaping campaign including customer targeting, pricing strategy, service packages, and promotional materials.',
    '["marketing_strategy", "campaign", "pricing", "promotion"]'::jsonb,
    '{"task_type": "strategic_planning", "deliverable": "marketing_plan", "budget_required": 15000, "project_id": "84215ccb-313d-48f8-9c37-4398f28c0b1f", "business_id": "dddddddd-dddd-dddd-dddd-dddddddddddd", "office_id": "44444444-4444-4444-4444-444444444444"}'::jsonb,
    ARRAY['8260b1b0-5efc-4611-ad33-ee76c0cf7f13']::uuid[],
    'Completed', 'high', 32.0, 35.0, 5
);

INSERT INTO app.d_task (
    id, slug, code, name, descr, tags, metadata,
    assignee_employee_ids,
    stage, priority_level, estimated_hours, actual_hours, story_points
) VALUES (
    'b2222222-2222-2222-2222-222222222222',
    'flc-resource-planning',
    'FLC-TASK-002',
    'Fall Campaign Resource Planning',
    'Plan and allocate human resources, equipment, and materials for fall landscaping campaign. Ensure adequate capacity to meet projected demand and service commitments.',
    '["resource_planning", "capacity", "equipment", "staffing"]'::jsonb,
    '{"task_type": "operations_planning", "deliverable": "resource_allocation_plan", "equipment_audit": true, "project_id": "84215ccb-313d-48f8-9c37-4398f28c0b1f", "business_id": "dddddddd-dddd-dddd-dddd-dddddddddddd", "office_id": "44444444-4444-4444-4444-444444444444"}'::jsonb,
    ARRAY['8260b1b0-5efc-4611-ad33-ee76c0cf7f13']::uuid[],
    'In Progress', 'high', 24.0, 18.0, 3
);

-- HVAC Modernization Tasks
INSERT INTO app.d_task (
    id, slug, code, name, descr, tags, metadata,
    assignee_employee_ids,
    stage, priority_level, estimated_hours, actual_hours, story_points
) VALUES (
    'c1111111-1111-1111-1111-111111111111',
    'hvac-market-research',
    'HVAC-TASK-001',
    'Smart HVAC Market Research',
    'Research emerging smart HVAC technologies, market trends, and customer demand for energy-efficient solutions. Identify competitive advantages and partnership opportunities.',
    '["market_research", "smart_technology", "energy_efficiency", "competitive_analysis"]'::jsonb,
    '{"task_type": "research", "deliverable": "market_analysis_report", "partnership_exploration": true, "project_id": "72304dab-202c-39e7-8a26-3287d26a0c2d", "business_id": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", "office_id": "44444444-4444-4444-4444-444444444444"}'::jsonb,
    ARRAY['8260b1b0-5efc-4611-ad33-ee76c0cf7f13']::uuid[],
    'Planning', 'medium', 48.0, 12.0, 8
);

-- Corporate Office Expansion Tasks
INSERT INTO app.d_task (
    id, slug, code, name, descr, tags, metadata,
    assignee_employee_ids,
    stage, priority_level, estimated_hours, actual_hours, story_points
) VALUES (
    'd1111111-1111-1111-1111-111111111111',
    'coe-space-planning',
    'COE-TASK-001',
    'Corporate Office Space Planning',
    'Design optimal office layout incorporating collaborative spaces, private offices, meeting rooms, and modern amenities. Focus on employee productivity and company culture enhancement.',
    '["space_planning", "office_design", "productivity", "culture", "collaboration"]'::jsonb,
    '{"task_type": "design", "deliverable": "office_layout_plans", "employee_input": true, "project_id": "61203bac-101b-28d6-7a15-2176c15a0b1c", "business_id": "cccccccc-cccc-cccc-cccc-cccccccccccc", "office_id": "11111111-1111-1111-1111-111111111111"}'::jsonb,
    ARRAY['8260b1b0-5efc-4611-ad33-ee76c0cf7f13']::uuid[],
    'Planning', 'medium', 56.0, 20.0, 8
);

-- Customer Service Excellence Tasks
INSERT INTO app.d_task (
    id, slug, code, name, descr, tags, metadata,
    assignee_employee_ids,
    stage, priority_level, estimated_hours, actual_hours, story_points
) VALUES (
    'e1111111-1111-1111-1111-111111111111',
    'cse-process-optimization',
    'CSE-TASK-001',
    'Customer Service Process Optimization',
    'Analyze and optimize current customer service processes to reduce response times, improve issue resolution, and enhance overall customer satisfaction across all touchpoints.',
    '["process_optimization", "response_time", "customer_satisfaction", "touchpoint_analysis"]'::jsonb,
    '{"task_type": "process_improvement", "deliverable": "optimized_service_processes", "training_required": true, "project_id": "50192aab-000a-17c5-6904-1065b04a0a0b", "business_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "office_id": "22222222-2222-2222-2222-222222222222"}'::jsonb,
    ARRAY['8260b1b0-5efc-4611-ad33-ee76c0cf7f13']::uuid[],
    'In Progress', 'high', 40.0, 32.0, 5
);

-- Strategic CEO oversight tasks
INSERT INTO app.d_task (
    id, slug, code, name, descr, tags, metadata,
    assignee_employee_ids,
    stage, priority_level, estimated_hours, actual_hours, story_points
) VALUES (
    'f1111111-1111-1111-1111-111111111111',
    'ceo-quarterly-review',
    'CEO-TASK-001',
    'Quarterly Business Performance Review',
    'Comprehensive quarterly review of all business units, projects, and key performance indicators. Assess progress against strategic objectives and identify areas for improvement or investment.',
    '["quarterly_review", "performance", "kpi_analysis", "strategic_assessment"]'::jsonb,
    '{"task_type": "executive_review", "deliverable": "quarterly_performance_report", "board_presentation": true, "project_id": "93106ffb-402e-43a7-8b26-5287e37a1b0e", "business_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "office_id": "11111111-1111-1111-1111-111111111111"}'::jsonb,
    ARRAY['8260b1b0-5efc-4611-ad33-ee76c0cf7f13']::uuid[],
    'In Progress', 'critical', 20.0, 8.0, 13
);

COMMENT ON TABLE app.d_task IS 'Task head table with core task information';