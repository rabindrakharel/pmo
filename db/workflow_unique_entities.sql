-- Update workflow data to have unique entity IDs for each state
-- Then create corresponding unique entity records

-- First, update the workflow data with unique entity IDs
UPDATE app.workflow_data
SET entity_id = 'bbbbbbbb-0000-0000-0002-222222222222'
WHERE id = '660e8400-e29b-41d4-a716-446655440003'; -- State 2: Quote Approved

UPDATE app.workflow_data
SET entity_id = 'aaaaaaaa-1111-1111-1111-111111111111'
WHERE id = '660e8400-e29b-41d4-a716-446655440005'; -- State 4: Task Created

UPDATE app.workflow_data
SET entity_id = 'aaaaaaaa-1111-1111-1111-111111111112'
WHERE id = '660e8400-e29b-41d4-a716-446655440006'; -- State 5: Task In Progress

UPDATE app.workflow_data
SET entity_id = 'cccccccc-0000-0000-0002-222222222222'
WHERE id = '660e8400-e29b-41d4-a716-446655440007'; -- State 6: Work Order Completed

UPDATE app.workflow_data
SET entity_id = 'dddddddd-0000-0000-0002-222222222222'
WHERE id = '660e8400-e29b-41d4-a716-446655440009'; -- State 8: Invoice Paid

-- Now create the new unique entity records

-- State 2: Quote Approved (updated version of original quote)
INSERT INTO app.fact_quote (
  id,
  code,
  name,
  descr,
  dl__quote_stage,
  quote_items,
  subtotal_amt,
  tax_pct,
  quote_tax_amt,
  quote_total_amt,
  valid_until_date,
  sent_date,
  accepted_date,
  customer_name,
  customer_email,
  customer_phone,
  internal_notes,
  created_ts,
  updated_ts
) VALUES (
  'bbbbbbbb-0000-0000-0002-222222222222',
  'QUOTE-WF-001-APPROVED',
  'HVAC Installation Quote - APPROVED',
  'Approved quote for HVAC installation at 123 Main Street',
  'approved',
  '[{"item": "HVAC System", "quantity": 1, "unit_price": 5000.00}]'::jsonb,
  5000.00,
  13.00,
  650.00,
  5650.00,
  (CURRENT_DATE + INTERVAL '30 days')::date,
  CURRENT_DATE - INTERVAL '2 days',
  CURRENT_DATE - INTERVAL '1 day',
  'John Smith',
  'john.smith@example.com',
  '416-555-0001',
  'Quote approved by customer via email',
  now(),
  now()
);

-- State 4: Task Created
INSERT INTO app.d_task (
  id,
  code,
  name,
  descr,
  dl__task_stage,
  dl__task_priority,
  estimated_hours,
  story_points,
  created_ts,
  updated_ts
) VALUES (
  'aaaaaaaa-1111-1111-1111-111111111111',
  'TASK-WF-HVAC-001',
  'HVAC Installation Task - Assigned',
  'Complete HVAC system installation at 123 Main Street',
  'assigned',
  'high',
  8.0,
  5,
  now(),
  now()
);

-- State 5: Task In Progress
INSERT INTO app.d_task (
  id,
  code,
  name,
  descr,
  dl__task_stage,
  dl__task_priority,
  estimated_hours,
  actual_hours,
  story_points,
  created_ts,
  updated_ts
) VALUES (
  'aaaaaaaa-1111-1111-1111-111111111112',
  'TASK-WF-HVAC-002',
  'HVAC Installation Task - In Progress',
  'Installing HVAC system - work started at 123 Main Street',
  'in_progress',
  'high',
  8.0,
  4.5,
  5,
  now(),
  now()
);

-- State 6: Work Order Completed
INSERT INTO app.fact_work_order (
  id,
  code,
  name,
  descr,
  dl__work_order_status,
  scheduled_date,
  scheduled_start_time,
  scheduled_end_time,
  started_ts,
  completed_ts,
  customer_name,
  customer_email,
  customer_phone,
  service_address_line1,
  service_city,
  service_province,
  service_postal_code,
  labor_hours,
  labor_cost_amt,
  materials_cost_amt,
  total_cost_amt,
  customer_signature_flag,
  customer_satisfaction_rating,
  completion_notes,
  internal_notes,
  created_ts,
  updated_ts
) VALUES (
  'cccccccc-0000-0000-0002-222222222222',
  'WO-WF-001-COMPLETED',
  'HVAC Installation - COMPLETED',
  'Completed work order for HVAC installation',
  'completed',
  (CURRENT_DATE + INTERVAL '7 days')::date,
  '09:00:00'::time,
  '17:00:00'::time,
  now() - INTERVAL '8 hours',
  now() - INTERVAL '1 hour',
  'John Smith',
  'john.smith@example.com',
  '416-555-0001',
  '123 Main Street',
  'Toronto',
  'Ontario',
  'M5V 3A8',
  8.0,
  800.00,
  4200.00,
  5000.00,
  true,
  5,
  'Installation completed successfully. Customer very satisfied.',
  'All tests passed. System running efficiently.',
  now(),
  now()
);

-- State 8: Invoice Paid
INSERT INTO app.f_invoice (
  id,
  invoice_number,
  invoice_date,
  invoice_datetime,
  due_date,
  payment_terms,
  client_id,
  client_name,
  client_type,
  product_name,
  line_item_type,
  qty_billed,
  unit_of_measure,
  unit_price_cad,
  discount_percent,
  discount_amount_cad,
  extended_price_cad,
  tax_rate,
  tax_amount_cad,
  hst_amount_cad,
  line_subtotal_cad,
  line_total_cad,
  invoice_status,
  payment_status,
  sent_date,
  paid_date,
  amount_paid_cad,
  amount_outstanding_cad,
  payment_method,
  payment_reference,
  billing_address_line1,
  billing_city,
  billing_province,
  billing_postal_code,
  billing_country,
  notes,
  created_at,
  updated_at
) VALUES (
  'dddddddd-0000-0000-0002-222222222222',
  'INV-WF-001-PAID',
  CURRENT_DATE - INTERVAL '3 days',
  now() - INTERVAL '3 days',
  (CURRENT_DATE + INTERVAL '27 days')::date,
  'net_30',
  'aaaaaaaa-0000-0000-0001-111111111111',
  'John Smith',
  'residential',
  'HVAC Installation Service',
  'service',
  1.0,
  'each',
  5000.00,
  0.00,
  0.00,
  5000.00,
  13.00,
  650.00,
  650.00,
  5000.00,
  5650.00,
  'paid',
  'paid',
  CURRENT_DATE - INTERVAL '3 days',
  CURRENT_DATE,
  5650.00,
  0.00,
  'credit_card',
  'TXN-20241105-001',
  '123 Main Street',
  'Toronto',
  'ON',
  'M5V3A8',
  'CA',
  'Payment received in full. Thank you!',
  now(),
  now()
);
