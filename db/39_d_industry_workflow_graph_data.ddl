-- =====================================================
-- WORKFLOW INSTANCE ENTITY (d_industry_workflow_graph_data) - DIMENSION TABLE
-- Flattened dimension tracking workflow instances and their entity records
-- =====================================================
--
-- SEMANTICS:
-- Tracks individual workflow instances as they progress through business process stages.
-- Each row represents ONE entity created/updated as part of a workflow instance.
-- This is a flattened dimension table enabling easy querying of workflow progress and entity lifecycle.
-- Links workflow templates to actual business entity records (customer, quote, work_order, task, invoice).
--
-- DATABASE BEHAVIOR:
-- • CREATE: INSERT when entity is created as part of workflow
--   Example: INSERT INTO d_industry_workflow_graph_data
--            (workflow_instance_id, workflow_template_id, state_id, entity_name, entity_id, entity_created_ts)
--            VALUES ('wf-inst-001', '550e8400-...', 0, 'customer', 'cust-uuid-123', now())
--
-- • UPDATE: Add new rows as workflow progresses through states (append-only pattern)
--   Example: INSERT INTO d_industry_workflow_graph_data
--            (workflow_instance_id, workflow_template_id, state_id, entity_name, entity_id, entity_created_ts)
--            VALUES ('wf-inst-001', '550e8400-...', 1, 'quote', 'quote-uuid-456', now())
--
-- • SOFT DELETE: Mark entire workflow instance as inactive
--   Example: UPDATE d_industry_workflow_graph_data SET active_flag=false, to_ts=now()
--            WHERE workflow_instance_id='wf-inst-001'
--
-- • QUERY: Track workflow progress for a customer/project
--   Example: SELECT * FROM d_industry_workflow_graph_data
--            WHERE workflow_instance_id='wf-inst-001' AND active_flag=true
--            ORDER BY entity_created_ts ASC
--
-- KEY FIELDS:
-- • id: uuid PRIMARY KEY (stable, never changes)
-- • workflow_instance_id: text NOT NULL (groups all entities in one workflow run)
-- • workflow_template_id: uuid NOT NULL (links to d_industry_workflow_graph_head)
-- • workflow_parent_id: text (parent workflow if this is a sub-workflow)
-- • state_id: integer NOT NULL (current state in workflow graph)
-- • state_name: text (denormalized for quick queries)
-- • entity_name: text NOT NULL (which entity: customer, quote, work_order, task, invoice)
-- • entity_id: text NOT NULL (UUID of the actual entity record)
-- • entity_created_ts: timestamptz (created timestamp from actual entity record)
-- • entity_updated_ts: timestamptz (updated timestamp from actual entity record)
--
-- RELATIONSHIPS (NO FOREIGN KEYS):
-- • Links to: d_industry_workflow_graph_head (workflow_template_id)
-- • Links to: actual entity tables via entity_name + entity_id
-- • Referenced by: f_industry_workflow_events (workflow_instance_id)
--
-- USAGE PATTERN:
-- Each workflow instance creates multiple rows as it progresses:
--   Row 1: workflow_instance_id='WF-001', state_id=0, entity_name='customer', entity_id='cust-123'
--   Row 2: workflow_instance_id='WF-001', state_id=1, entity_name='quote', entity_id='quote-456'
--   Row 3: workflow_instance_id='WF-001', state_id=2, entity_name='work_order', entity_id='wo-789'
--   ...and so on through the entire workflow
--
-- =====================================================

CREATE TABLE app.d_industry_workflow_graph_data (
    -- Standard identity fields
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,
    name text NOT NULL,
    descr text,
    metadata jsonb DEFAULT '{}'::jsonb,

    -- Workflow identification
    workflow_instance_id text NOT NULL,
    workflow_template_id uuid NOT NULL,
    workflow_parent_id text,

    -- State tracking
    state_id integer NOT NULL,
    state_name text NOT NULL,

    -- Entity tracking
    entity_name text NOT NULL,
    entity_id text NOT NULL,
    entity_created_ts timestamptz,
    entity_updated_ts timestamptz,

    -- Workflow progress flags
    current_state_flag boolean DEFAULT true,
    terminal_state_flag boolean DEFAULT false,

    -- Duration tracking
    state_duration_days integer,

    -- Business context
    customer_entity_id text,
    project_entity_id text,

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
-- CURATED SEED DATA
-- =====================================================

-- Home Services Workflow Instance 1: Complete residential service cycle
-- Customer: John Smith Residential Service (Nov 2024)
-- SIMPLIFIED: One state per entity type, entity tracks its own stage

-- State 0: Customer (tracks stage internally)
INSERT INTO app.d_industry_workflow_graph_data (
    id,
    code,
    name,
    descr,
    workflow_instance_id,
    workflow_template_id,
    state_id,
    state_name,
    entity_name,
    entity_id,
    entity_created_ts,
    entity_updated_ts,
    current_state_flag,
    terminal_state_flag,
    state_duration_days,
    customer_entity_id,
    created_by_employee_id,
    metadata
) VALUES (
    '660e8400-e29b-41d4-a716-446655440001',
    'WFI-2024-001-S0',
    'WF Instance: John Smith Service - Customer',
    'Customer entity with stage: qualified_lead',
    'WFI-2024-001',
    '550e8400-e29b-41d4-a716-446655440001',
    0,
    'cust',
    'cust',
    'aaaaaaaa-0000-0000-0001-111111111111',
    '2024-11-01 09:15:00',
    '2024-11-01 10:30:00',
    false,
    false,
    1,
    'aaaaaaaa-0000-0000-0001-111111111111',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '{"lead_source": "phone_call", "service_type": "hvac_repair", "urgency": "standard"}'::jsonb
);

-- State 1: Quote
INSERT INTO app.d_industry_workflow_graph_data (
    id,
    code,
    name,
    descr,
    workflow_instance_id,
    workflow_template_id,
    state_id,
    state_name,
    entity_name,
    entity_id,
    entity_created_ts,
    entity_updated_ts,
    current_state_flag,
    terminal_state_flag,
    state_duration_days,
    customer_entity_id,
    created_by_employee_id,
    metadata
) VALUES (
    '660e8400-e29b-41d4-a716-446655440002',
    'WFI-2024-001-S1',
    'WF Instance: John Smith Service - Quote',
    'Quote entity with stage: approved',
    'WFI-2024-001',
    '550e8400-e29b-41d4-a716-446655440001',
    1,
    'quote',
    'quote',
    'bbbbbbbb-0000-0000-0002-222222222222',
    '2024-11-01 10:30:00',
    '2024-11-02 14:15:00',
    false,
    false,
    1,
    'aaaaaaaa-0000-0000-0001-111111111111',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '{"quote_amount": 5000.00, "approval_method": "email"}'::jsonb
);

-- State 2: Work Order
INSERT INTO app.d_industry_workflow_graph_data (
    id,
    code,
    name,
    descr,
    workflow_instance_id,
    workflow_template_id,
    state_id,
    state_name,
    entity_name,
    entity_id,
    entity_created_ts,
    entity_updated_ts,
    current_state_flag,
    terminal_state_flag,
    state_duration_days,
    customer_entity_id,
    created_by_employee_id,
    metadata
) VALUES (
    '660e8400-e29b-41d4-a716-446655440003',
    'WFI-2024-001-S2',
    'WF Instance: John Smith Service - Work Order',
    'Work order entity with status: completed',
    'WFI-2024-001',
    '550e8400-e29b-41d4-a716-446655440001',
    2,
    'work_order',
    'work_order',
    'cccccccc-0000-0000-0002-222222222222',
    '2024-11-02 14:15:00',
    '2024-11-03 12:30:00',
    false,
    false,
    1,
    'aaaaaaaa-0000-0000-0001-111111111111',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '{"scheduled_date": "2024-11-03", "actual_hours": 8.0}'::jsonb
);

-- State 3: Task
INSERT INTO app.d_industry_workflow_graph_data (
    id,
    code,
    name,
    descr,
    workflow_instance_id,
    workflow_template_id,
    state_id,
    state_name,
    entity_name,
    entity_id,
    entity_created_ts,
    entity_updated_ts,
    current_state_flag,
    terminal_state_flag,
    state_duration_days,
    customer_entity_id,
    created_by_employee_id,
    metadata
) VALUES (
    '660e8400-e29b-41d4-a716-446655440004',
    'WFI-2024-001-S3',
    'WF Instance: John Smith Service - Task',
    'Task entity with stage: in_progress',
    'WFI-2024-001',
    '550e8400-e29b-41d4-a716-446655440001',
    3,
    'task',
    'task',
    'aaaaaaaa-1111-1111-1111-111111111112',
    '2024-11-03 08:00:00',
    '2024-11-03 12:00:00',
    false,
    false,
    0,
    'aaaaaaaa-0000-0000-0001-111111111111',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '{"task_type": "hvac_installation", "actual_hours": 4.5, "priority": "high"}'::jsonb
);

-- State 4: Invoice
INSERT INTO app.d_industry_workflow_graph_data (
    id,
    code,
    name,
    descr,
    workflow_instance_id,
    workflow_template_id,
    state_id,
    state_name,
    entity_name,
    entity_id,
    entity_created_ts,
    entity_updated_ts,
    current_state_flag,
    terminal_state_flag,
    state_duration_days,
    customer_entity_id,
    created_by_employee_id,
    metadata
) VALUES (
    '660e8400-e29b-41d4-a716-446655440005',
    'WFI-2024-001-S4',
    'WF Instance: John Smith Service - Invoice',
    'Invoice entity with status: paid',
    'WFI-2024-001',
    '550e8400-e29b-41d4-a716-446655440001',
    4,
    'invoice',
    'invoice',
    'dddddddd-0000-0000-0002-222222222222',
    '2024-11-03 12:30:00',
    '2024-11-05 10:00:00',
    false,
    false,
    2,
    'aaaaaaaa-0000-0000-0001-111111111111',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '{"invoice_amount": 5650.00, "payment_date": "2024-11-05"}'::jsonb
);

-- State 5: Completed (Terminal)
INSERT INTO app.d_industry_workflow_graph_data (
    id,
    code,
    name,
    descr,
    workflow_instance_id,
    workflow_template_id,
    state_id,
    state_name,
    entity_name,
    entity_id,
    entity_created_ts,
    entity_updated_ts,
    current_state_flag,
    terminal_state_flag,
    state_duration_days,
    customer_entity_id,
    created_by_employee_id,
    metadata
) VALUES (
    '660e8400-e29b-41d4-a716-446655440006',
    'WFI-2024-001-S5',
    'WF Instance: John Smith Service - Completed',
    'Workflow completed successfully',
    'WFI-2024-001',
    '550e8400-e29b-41d4-a716-446655440001',
    5,
    'completed',
    'invoice',
    'dddddddd-0000-0000-0002-222222222222',
    '2024-11-05 10:00:00',
    NULL,
    true,
    true,
    NULL,
    'aaaaaaaa-0000-0000-0001-111111111111',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '{"payment_method": "credit_card", "transaction_id": "TXN-20241105-001"}'::jsonb
);

-- Second Workflow Instance: HVAC Emergency Service (using HVAC_EMERG template)
-- Customer: Emergency Commercial HVAC Repair (Nov 2024)

-- State 0: Emergency Call
INSERT INTO app.d_industry_workflow_graph_data (
    id,
    code,
    name,
    descr,
    workflow_instance_id,
    workflow_template_id,
    state_id,
    state_name,
    entity_name,
    entity_id,
    entity_created_ts,
    entity_updated_ts,
    current_state_flag,
    terminal_state_flag,
    customer_entity_id,
    created_by_employee_id,
    metadata
) VALUES (
    '660e8400-e29b-41d4-a716-446655440010',
    'WFI-2024-002-S0',
    'WF Instance: Emergency HVAC - Emergency Call',
    'Emergency HVAC call from commercial client',
    'WFI-2024-002',
    '550e8400-e29b-41d4-a716-446655440002',
    0,
    'emergency_call',
    'cust',
    'aaaaaaaa-0000-0000-0002-222222222222',
    '2024-11-10 14:30:00',
    '2024-11-10 14:35:00',
    false,
    false,
    'aaaaaaaa-0000-0000-0002-222222222222',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '{"emergency_type": "no_heat", "building_type": "commercial_office", "priority": "critical"}'::jsonb
);

-- State 7: Payment Collected (Current State - Terminal)
INSERT INTO app.d_industry_workflow_graph_data (
    id,
    code,
    name,
    descr,
    workflow_instance_id,
    workflow_template_id,
    state_id,
    state_name,
    entity_name,
    entity_id,
    entity_created_ts,
    current_state_flag,
    terminal_state_flag,
    customer_entity_id,
    created_by_employee_id,
    metadata
) VALUES (
    '660e8400-e29b-41d4-a716-446655440011',
    'WFI-2024-002-S7',
    'WF Instance: Emergency HVAC - Payment Collected',
    'Emergency service completed and paid on-site',
    'WFI-2024-002',
    '550e8400-e29b-41d4-a716-446655440002',
    7,
    'payment_collected',
    'invoice',
    'dddddddd-0000-0000-0002-222222222222',
    '2024-11-10 18:00:00',
    true,
    true,
    'aaaaaaaa-0000-0000-0002-222222222222',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '{"service_duration_hours": 3.5, "payment_method": "company_check", "amount": 1250.00, "same_day_completion": true}'::jsonb
);
