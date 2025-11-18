-- =====================================================
-- WORKFLOW INSTANCE DATA (d_industry_workflow_graph_data) - CORE ENTITY
-- Stores workflow instances with entity graph in JSONB format
-- =====================================================
--
-- SEMANTICS:
-- Each row represents ONE workflow instance containing all participating entities in JSONB.
-- Follows the same structure as workflow_graph_head but with actual entity IDs and stages.
-- Links workflow templates (graph structure) to actual business entity records.
--
-- OPERATIONS:
-- • CREATE: POST /api/v1/workflow-instance, INSERT with workflow_graph_data, version=1, active_flag=true
-- • UPDATE: PUT /api/v1/workflow-instance/{id}, update workflow_graph_data, version++, updated_ts refreshes
-- • DELETE: DELETE /api/v1/workflow-instance/{id}, active_flag=false, to_ts=now() (soft delete)
-- • LIST: GET /api/v1/workflow-instance, filters by workflow_head_id/terminal_state_flag, RBAC enforced
--
-- RELATIONSHIPS (NO FOREIGN KEYS):
-- • Links to: d_industry_workflow_graph_head (workflow_head_id)
-- • Links to: actual entity tables via entities in workflow_graph_data
-- • Referenced by: f_industry_workflow_events (workflow instance tracking)
--
-- WORKFLOW_GRAPH_DATA STRUCTURE (JSONB):
-- Array of entity nodes following template structure but with actual entity IDs:
-- [{
--   "id": 0,                                    // Node ID matching template
--   "entity_name": "cust",                      // Entity type (from template)
--   "entity_id": "aaaaaaaa-0000-...",          // Actual entity UUID
--   "entity_label": "John Smith",              // Display name from entity
--   "entity_stage": "qualified_lead",          // Current stage from entity's dl__%stage
--   "parent_ids": [],                          // Parent node IDs (from template)
--   "entity_created_ts": "2024-11-01T09:15:00Z",
--   "entity_updated_ts": "2024-11-01T10:30:00Z",
--   "current_flag": false,                     // Is this the current node?
--   "terminal_flag": false                     // Is this a terminal node?
-- }]
--
-- USAGE PATTERN:
-- One row per workflow instance with all entities in JSONB array:
--   workflow_instance_id='WFI-2024-001',
--   workflow_graph_data=[
--     {"id": 0, "entity_name": "cust", "entity_id": "cust-123", "parent_ids": []},
--     {"id": 1, "entity_name": "quote", "entity_id": "quote-456", "parent_ids": [0]},
--     {"id": 2, "entity_name": "work_order", "entity_id": "wo-789", "parent_ids": [1]}
--   ]
--
-- =====================================================

CREATE TABLE app.industry_workflow_graph_data (
    -- Standard identity fields
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_instance_id text UNIQUE NOT NULL,
    code varchar(50) UNIQUE NOT NULL,
    name text NOT NULL,
    descr text,
    metadata jsonb DEFAULT '{}'::jsonb,

    -- Workflow template reference
    workflow_head_id uuid NOT NULL,

    -- Entity graph data (JSONB array following template structure with actual entity IDs)
    workflow_graph_data jsonb NOT NULL,

    -- Current state tracking
    current_state_id integer,
    terminal_state_flag boolean DEFAULT false,

    -- Audit fields
    created_by_employee_id uuid,
    updated_by_employee_id uuid,

    -- Standard temporal fields
    active_flag boolean DEFAULT true,
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);

-- =====================================================
-- DATA CURATION:
-- =====================================================

-- Home Services Workflow Instance 1: Complete residential service cycle
-- Uses actual customer and task from database
INSERT INTO app.d_industry_workflow_graph_data (
    id,
    workflow_instance_id,
    code,
    name,
    descr,
    workflow_head_id,
    workflow_graph_data,
    current_state_id,
    terminal_state_flag,
    created_by_employee_id
)
SELECT
    '660e8400-e29b-41d4-a716-446655440001',
    'WFI-2024-001',
    'WFI-2024-001',
    'Home Services - Standard Project - ' || c.name,
    'Complete workflow: Customer → Task',
    '550e8400-e29b-41d4-a716-446655440001',
    jsonb_build_array(
        jsonb_build_object(
            'id', 0,
            'entity_name', 'cust',
            'entity_id', c.id::text,
            'parent_ids', '[]'::jsonb,
            'current_flag', false,
            'terminal_flag', false
        ),
        jsonb_build_object(
            'id', 3,
            'entity_name', 'task',
            'entity_id', t.id::text,
            'parent_ids', '[0]'::jsonb,
            'current_flag', true,
            'terminal_flag', true
        )
    ),
    3,
    true,
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'
FROM app.d_cust c
CROSS JOIN app.task t
WHERE c.code = 'CL-RES-002'  -- Martinez Family Home
  AND t.code = 'CEO-TASK-001'  -- Quarterly Business Performance Review
LIMIT 1;

-- Home Services Workflow Instance 2: Commercial Service
-- Uses actual customer and task from database
INSERT INTO app.d_industry_workflow_graph_data (
    id,
    workflow_instance_id,
    code,
    name,
    descr,
    workflow_head_id,
    workflow_graph_data,
    current_state_id,
    terminal_state_flag,
    created_by_employee_id
)
SELECT
    '660e8400-e29b-41d4-a716-446655440002',
    'WFI-2024-002',
    'WFI-2024-002',
    'Commercial Service - ' || c.name,
    'Workflow: Customer → Task',
    '550e8400-e29b-41d4-a716-446655440002',
    jsonb_build_array(
        jsonb_build_object(
            'id', 0,
            'entity_name', 'cust',
            'entity_id', c.id::text,
            'parent_ids', '[]'::jsonb,
            'current_flag', false,
            'terminal_flag', false
        ),
        jsonb_build_object(
            'id', 1,
            'entity_name', 'task',
            'entity_id', t.id::text,
            'parent_ids', '[0]'::jsonb,
            'current_flag', true,
            'terminal_flag', true
        )
    ),
    1,
    true,
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'
FROM app.d_cust c
CROSS JOIN app.task t
WHERE c.code = 'CL-COM-007'  -- Amica Senior Living
  AND t.code = 'CSE-TASK-001'  -- Customer Service Process Optimization
LIMIT 1;
