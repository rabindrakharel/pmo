-- Complex Multi-Parent, Multi-Child DAG Workflow Instance
-- Workflow: WFI-2024-001 - Home Services Standard with parallel paths and convergence
-- Customer: John Smith (aaaaaaaa-0000-0000-0001-111111111111)

-- Delete existing workflow instance data
DELETE FROM app.workflow_data WHERE workflow_instance_id = 'WFI-2024-001';

-- State 0: Customer (Root)
INSERT INTO app.workflow_data (
    id, code, name, descr,
    workflow_instance_id, workflow_template_id,
    state_id, state_name, entity_name, entity_id,
    entity_created_ts, entity_updated_ts,
    current_state_flag, terminal_state_flag,
    state_duration_days, customer_entity_id,
    created_by_employee_id, metadata
) VALUES (
    '660e8400-e29b-41d4-a716-446655440001',
    'WFI-2024-001-S0',
    'Customer Lead - John Smith',
    'Customer lead captured via website',
    'WFI-2024-001', '550e8400-e29b-41d4-a716-446655440001',
    0, 'cust', 'cust', 'aaaaaaaa-0000-0000-0001-111111111111',
    '2024-11-01 09:00:00', '2024-11-01 10:00:00',
    false, false, 1,
    'aaaaaaaa-0000-0000-0001-111111111111',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '{"source": "website", "urgency": "standard"}'::jsonb
);

-- State 1: Site Assessment
INSERT INTO app.workflow_data (
    id, code, name, descr,
    workflow_instance_id, workflow_template_id,
    state_id, state_name, entity_name, entity_id,
    entity_created_ts, entity_updated_ts,
    current_state_flag, terminal_state_flag,
    state_duration_days, customer_entity_id,
    created_by_employee_id, metadata
) VALUES (
    '660e8400-e29b-41d4-a716-446655440002',
    'WFI-2024-001-S1',
    'Site Assessment Task',
    'Technician assessed HVAC requirements on-site',
    'WFI-2024-001', '550e8400-e29b-41d4-a716-446655440001',
    1, 'site_assessment', 'task', 'aaaaaaaa-2222-2222-2222-222222222201',
    '2024-11-01 10:00:00', '2024-11-01 14:00:00',
    false, false, 0,
    'aaaaaaaa-0000-0000-0001-111111111111',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '{"assessment_duration": "4 hours", "findings": "New HVAC system required"}'::jsonb
);

-- State 2: Quote
INSERT INTO app.workflow_data (
    id, code, name, descr,
    workflow_instance_id, workflow_template_id,
    state_id, state_name, entity_name, entity_id,
    entity_created_ts, entity_updated_ts,
    current_state_flag, terminal_state_flag,
    state_duration_days, customer_entity_id,
    created_by_employee_id, metadata
) VALUES (
    '660e8400-e29b-41d4-a716-446655440003',
    'WFI-2024-001-S2',
    'HVAC Installation Quote',
    'Quote approved by customer for $5,650',
    'WFI-2024-001', '550e8400-e29b-41d4-a716-446655440001',
    2, 'quote', 'quote', 'bbbbbbbb-0000-0000-0002-222222222222',
    '2024-11-01 14:00:00', '2024-11-02 10:00:00',
    false, false, 1,
    'aaaaaaaa-0000-0000-0001-111111111111',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '{"quote_amount": 5650.00, "approval_method": "email"}'::jsonb
);

-- State 3: Material Procurement (Parallel Path 1)
INSERT INTO app.workflow_data (
    id, code, name, descr,
    workflow_instance_id, workflow_template_id,
    state_id, state_name, entity_name, entity_id,
    entity_created_ts, entity_updated_ts,
    current_state_flag, terminal_state_flag,
    state_duration_days, customer_entity_id,
    created_by_employee_id, metadata
) VALUES (
    '660e8400-e29b-41d4-a716-446655440004',
    'WFI-2024-001-S3',
    'Material Procurement',
    'HVAC equipment and materials ordered and delivered',
    'WFI-2024-001', '550e8400-e29b-41d4-a716-446655440001',
    3, 'material_procurement', 'task', 'aaaaaaaa-2222-2222-2222-222222222203',
    '2024-11-02 10:00:00', '2024-11-03 09:00:00',
    false, false, 1,
    'aaaaaaaa-0000-0000-0001-111111111111',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '{"supplier": "HVAC Supply Co", "delivery_date": "2024-11-03"}'::jsonb
);

-- State 4: Schedule Planning (Parallel Path 2)
INSERT INTO app.workflow_data (
    id, code, name, descr,
    workflow_instance_id, workflow_template_id,
    state_id, state_name, entity_name, entity_id,
    entity_created_ts, entity_updated_ts,
    current_state_flag, terminal_state_flag,
    state_duration_days, customer_entity_id,
    created_by_employee_id, metadata
) VALUES (
    '660e8400-e29b-41d4-a716-446655440005',
    'WFI-2024-001-S4',
    'Schedule Planning',
    'Technicians and equipment scheduled for installation',
    'WFI-2024-001', '550e8400-e29b-41d4-a716-446655440001',
    4, 'schedule_planning', 'task', 'aaaaaaaa-2222-2222-2222-222222222204',
    '2024-11-02 10:00:00', '2024-11-02 16:00:00',
    false, false, 0,
    'aaaaaaaa-0000-0000-0001-111111111111',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '{"scheduled_date": "2024-11-04", "crew_size": 3, "estimated_hours": 8}'::jsonb
);

-- State 5: Work Order (CONVERGENCE POINT - depends on states 3 & 4)
INSERT INTO app.workflow_data (
    id, code, name, descr,
    workflow_instance_id, workflow_template_id,
    state_id, state_name, entity_name, entity_id,
    entity_created_ts, entity_updated_ts,
    current_state_flag, terminal_state_flag,
    state_duration_days, customer_entity_id,
    created_by_employee_id, metadata
) VALUES (
    '660e8400-e29b-41d4-a716-446655440006',
    'WFI-2024-001-S5',
    'HVAC Installation Work Order',
    'Work order created after materials arrived and crew scheduled',
    'WFI-2024-001', '550e8400-e29b-41d4-a716-446655440001',
    5, 'work_order', 'work_order', 'cccccccc-0000-0000-0002-222222222222',
    '2024-11-03 09:00:00', '2024-11-04 08:00:00',
    false, false, 1,
    'aaaaaaaa-0000-0000-0001-111111111111',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '{"work_date": "2024-11-04", "crew_assigned": true}'::jsonb
);

-- State 6: Installation HVAC (Parallel Task 1)
INSERT INTO app.workflow_data (
    id, code, name, descr,
    workflow_instance_id, workflow_template_id,
    state_id, state_name, entity_name, entity_id,
    entity_created_ts, entity_updated_ts,
    current_state_flag, terminal_state_flag,
    state_duration_days, customer_entity_id,
    created_by_employee_id, metadata
) VALUES (
    '660e8400-e29b-41d4-a716-446655440007',
    'WFI-2024-001-S6',
    'HVAC System Installation',
    'Main HVAC unit installed and connected',
    'WFI-2024-001', '550e8400-e29b-41d4-a716-446655440001',
    6, 'installation_hvac', 'task', 'aaaaaaaa-2222-2222-2222-222222222206',
    '2024-11-04 08:00:00', '2024-11-04 14:00:00',
    false, false, 0,
    'aaaaaaaa-0000-0000-0001-111111111111',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '{"actual_hours": 6, "unit_model": "Carrier 25VNA8"}'::jsonb
);

-- State 7: Electrical Work (Parallel Task 2)
INSERT INTO app.workflow_data (
    id, code, name, descr,
    workflow_instance_id, workflow_template_id,
    state_id, state_name, entity_name, entity_id,
    entity_created_ts, entity_updated_ts,
    current_state_flag, terminal_state_flag,
    state_duration_days, customer_entity_id,
    created_by_employee_id, metadata
) VALUES (
    '660e8400-e29b-41d4-a716-446655440008',
    'WFI-2024-001-S7',
    'Electrical Connections',
    'Electrical wiring and connections completed',
    'WFI-2024-001', '550e8400-e29b-41d4-a716-446655440001',
    7, 'electrical_work', 'task', 'aaaaaaaa-2222-2222-2222-222222222207',
    '2024-11-04 08:00:00', '2024-11-04 12:00:00',
    false, false, 0,
    'aaaaaaaa-0000-0000-0001-111111111111',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '{"actual_hours": 4, "breaker_size": "30 amp", "voltage": "240V"}'::jsonb
);

-- State 8: Final Touches (Parallel Task 3)
INSERT INTO app.workflow_data (
    id, code, name, descr,
    workflow_instance_id, workflow_template_id,
    state_id, state_name, entity_name, entity_id,
    entity_created_ts, entity_updated_ts,
    current_state_flag, terminal_state_flag,
    state_duration_days, customer_entity_id,
    created_by_employee_id, metadata
) VALUES (
    '660e8400-e29b-41d4-a716-446655440009',
    'WFI-2024-001-S8',
    'Final Touches and Cleanup',
    'Site cleanup and finishing work completed',
    'WFI-2024-001', '550e8400-e29b-41d4-a716-446655440001',
    8, 'final_touches', 'task', 'aaaaaaaa-2222-2222-2222-222222222208',
    '2024-11-04 14:00:00', '2024-11-04 16:00:00',
    false, false, 0,
    'aaaaaaaa-0000-0000-0001-111111111111',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '{"actual_hours": 2, "areas_cleaned": ["basement", "exterior"]}'::jsonb
);

-- State 9: Inspection (CONVERGENCE POINT - depends on states 6, 7, 8)
INSERT INTO app.workflow_data (
    id, code, name, descr,
    workflow_instance_id, workflow_template_id,
    state_id, state_name, entity_name, entity_id,
    entity_created_ts, entity_updated_ts,
    current_state_flag, terminal_state_flag,
    state_duration_days, customer_entity_id,
    created_by_employee_id, metadata
) VALUES (
    '660e8400-e29b-41d4-a716-446655440020',
    'WFI-2024-001-S9',
    'Quality Inspection',
    'Quality inspection passed - all work verified',
    'WFI-2024-001', '550e8400-e29b-41d4-a716-446655440001',
    9, 'inspection', 'task', 'aaaaaaaa-2222-2222-2222-222222222209',
    '2024-11-04 16:00:00', '2024-11-04 17:00:00',
    false, false, 0,
    'aaaaaaaa-0000-0000-0001-111111111111',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '{"inspection_result": "passed", "inspector": "John Doe", "checklist_completed": true}'::jsonb
);

-- State 10: Invoice
INSERT INTO app.workflow_data (
    id, code, name, descr,
    workflow_instance_id, workflow_template_id,
    state_id, state_name, entity_name, entity_id,
    entity_created_ts, entity_updated_ts,
    current_state_flag, terminal_state_flag,
    state_duration_days, customer_entity_id,
    created_by_employee_id, metadata
) VALUES (
    '660e8400-e29b-41d4-a716-446655440021',
    'WFI-2024-001-S10',
    'Invoice Generated and Paid',
    'Invoice paid by customer via credit card',
    'WFI-2024-001', '550e8400-e29b-41d4-a716-446655440001',
    10, 'invoice', 'invoice', 'dddddddd-0000-0000-0002-222222222222',
    '2024-11-04 17:00:00', '2024-11-05 10:00:00',
    false, false, 1,
    'aaaaaaaa-0000-0000-0001-111111111111',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '{"invoice_amount": 5650.00, "payment_date": "2024-11-05", "payment_method": "credit_card"}'::jsonb
);

-- State 11: Completed (Terminal)
INSERT INTO app.workflow_data (
    id, code, name, descr,
    workflow_instance_id, workflow_template_id,
    state_id, state_name, entity_name, entity_id,
    entity_created_ts, entity_updated_ts,
    current_state_flag, terminal_state_flag,
    state_duration_days, customer_entity_id,
    created_by_employee_id, metadata
) VALUES (
    '660e8400-e29b-41d4-a716-446655440022',
    'WFI-2024-001-S11',
    'Workflow Completed Successfully',
    'All work completed, inspected, and paid',
    'WFI-2024-001', '550e8400-e29b-41d4-a716-446655440001',
    11, 'completed', 'invoice', 'dddddddd-0000-0000-0002-222222222222',
    '2024-11-05 10:00:00', NULL,
    true, true, NULL,
    'aaaaaaaa-0000-0000-0001-111111111111',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '{"project_duration_days": 4, "customer_satisfaction": 5, "transaction_id": "TXN-20241105-001"}'::jsonb
);
