-- =====================================================
-- REVENUE FACT TABLE (f_revenue) - FINANCIAL TRACKING
-- =====================================================
--
-- SEMANTICS:
-- • Revenue tracking: projects, tasks, customers, businesses, offices
-- • Forecasting, actual revenue, multi-currency support
-- • S3-based receipt attachments, auto-links to parents via d_entity_id_map
--
-- OPERATIONS:
-- • CREATE: POST /api/v1/revenue, creates entity_id_map entries to parents
-- • UPDATE: PUT /api/v1/revenue/{id}, version++, adjust amounts/forecasts
-- • DELETE: active_flag=false, to_ts=now()
-- • AGGREGATE: SUM by project_id, customer_id, business_id for reports
--
-- KEY FIELDS:
-- • id: uuid PRIMARY KEY
-- • revenue_code: varchar (receipt number)
-- • revenue_amt, invoice_amt, forecasted_amt: numeric(15,2)
-- • invoice_currency_code: varchar(3) (CAD, USD)
-- • exchange_rate: numeric(10,6)
-- • receipt_url: text (S3 URI)
--
-- RELATIONSHIPS:
-- • Parents: project, task, customer, business, office (via d_entity_id_map)
-- • RBAC: entity_id_rbac_map
--
-- =====================================================

CREATE TABLE app.f_revenue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,
    revenue_code varchar(100),
    name varchar(200) NOT NULL,
    descr text,
    metadata jsonb DEFAULT '{}'::jsonb,
    active_flag boolean DEFAULT true,
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1,

    -- Revenue-specific fields (all amounts end with _amt)
    revenue_amt numeric(15,2),
    invoice_amt numeric(15,2),
    invoice_currency_code varchar(3) DEFAULT 'CAD',
    exchange_rate numeric(10,6) DEFAULT 1.0,
    forecasted_amt numeric(15,2),
    receipt_url text
);

COMMENT ON TABLE app.f_revenue IS 'Revenue fact table for financial tracking';

-- Sample revenue data
-- Fall Landscaping Campaign Revenue
INSERT INTO app.f_revenue (
    id, code, revenue_code, name, descr, metadata,
    revenue_amt, invoice_amt, invoice_currency_code, exchange_rate,
    forecasted_amt, receipt_url
) VALUES (
    '20000001-0001-0001-0001-000000000003',
    'REV-FLC-001',
    'REV-2024-003',
    'Fall Landscaping - Residential Package Sales September',
    'Revenue from residential fall cleanup packages sold in September. Includes leaf removal, lawn aeration, and winterization services for 85 residential properties.',
    '{"revenue_type": "service_package", "month": "2024-09", "properties": 85, "avg_package_price": 450, "project_id": "84215ccb-313d-48f8-9c37-4398f28c0b1f", "business_id": "dddddddd-dddd-dddd-dddd-dddddddddddd", "office_id": "44444444-4444-4444-4444-444444444444"}'::jsonb,
    38250.00, 38250.00, 'CAD', 1.0,
    40000.00, 's3://pmo-attachments/receipts/2024/09/rev-2024-003.pdf'
);

INSERT INTO app.f_revenue (
    id, code, revenue_code, name, descr, metadata,
    revenue_amt, invoice_amt, invoice_currency_code, exchange_rate,
    forecasted_amt, receipt_url
) VALUES (
    '20000001-0001-0001-0001-000000000004',
    'REV-FLC-002',
    'REV-2024-004',
    'Fall Landscaping - Commercial Contracts Q4 2024',
    'Quarterly contract revenue_amt from commercial property maintenance. 12 commercial properties with comprehensive fall services including cleanup, snow preparation, and property management.',
    '{"revenue_type": "contract_revenue", "quarter": "Q4-2024", "properties": 12, "contract_value": 6500, "project_id": "84215ccb-313d-48f8-9c37-4398f28c0b1f", "business_id": "dddddddd-dddd-dddd-dddd-dddddddddddd", "office_id": "44444444-4444-4444-4444-444444444444"}'::jsonb,
    78000.00, 78000.00, 'CAD', 1.0,
    75000.00, 's3://pmo-attachments/receipts/2024/10/rev-2024-004.pdf'
);

-- HVAC Modernization Revenue
INSERT INTO app.f_revenue (
    id, code, revenue_code, name, descr, metadata,
    revenue_amt, invoice_amt, invoice_currency_code, exchange_rate,
    forecasted_amt, receipt_url
) VALUES (
    '20000001-0001-0001-0001-000000000005',
    'REV-HVAC-001',
    'REV-2024-005',
    'Smart HVAC System Sales - Commercial Installations',
    'Revenue from smart HVAC system installations for commercial clients. 8 installations completed with smart controls, IoT integration, and 2-year maintenance contracts.',
    '{"revenue_type": "product_installation", "installations": 8, "avg_installation_value": 18500, "maintenance_contracts_included": true, "project_id": "72304dab-202c-39e7-8a26-3287d26a0c2d", "business_id": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", "office_id": "44444444-4444-4444-4444-444444444444"}'::jsonb,
    148000.00, 143700.00, 'USD', 1.0299,
    150000.00, 's3://pmo-attachments/receipts/2024/10/rev-2024-005.pdf'
);

INSERT INTO app.f_revenue (
    id, code, revenue_code, name, descr, metadata,
    revenue_amt, invoice_amt, invoice_currency_code, exchange_rate,
    forecasted_amt, receipt_url
) VALUES (
    '20000001-0001-0001-0001-000000000006',
    'REV-HVAC-002',
    'REV-2024-006',
    'HVAC Preventive Maintenance Contracts - Annual',
    'Annual preventive maintenance contract revenue_amt. 45 commercial clients with quarterly service visits, priority support, and energy efficiency optimization.',
    '{"revenue_type": "maintenance_contract", "clients": 45, "contract_term": "annual", "visits_per_year": 4, "avg_contract_value": 3200, "project_id": "72304dab-202c-39e7-8a26-3287d26a0c2d", "business_id": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", "office_id": "44444444-4444-4444-4444-444444444444"}'::jsonb,
    144000.00, 144000.00, 'CAD', 1.0,
    140000.00, 's3://pmo-attachments/receipts/2024/10/rev-2024-006.pdf'
);

-- Customer Service Excellence Revenue
INSERT INTO app.f_revenue (
    id, code, revenue_code, name, descr, metadata,
    revenue_amt, invoice_amt, invoice_currency_code, exchange_rate,
    forecasted_amt, receipt_url
) VALUES (
    '20000001-0001-0001-0001-000000000007',
    'REV-CSE-001',
    'REV-2024-007',
    'Customer Service Excellence - Consulting Engagement',
    'Consulting revenue_amt from customer service optimization project. Process analysis, training delivery, and implementation support for service excellence initiative.',
    '{"revenue_type": "consulting_services", "engagement_type": "process_optimization", "duration_weeks": 12, "project_id": "50192aab-000a-17c5-6904-1065b04a0a0b", "business_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "office_id": "22222222-2222-2222-2222-222222222222"}'::jsonb,
    85000.00, 85000.00, 'CAD', 1.0,
    80000.00, 's3://pmo-attachments/receipts/2024/08/rev-2024-007.pdf'
);

-- =====================================================
-- REGISTER REVENUES IN d_entity_id_map
-- =====================================================

-- Link all revenues to their parent entities (projects)
INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
SELECT
    'project',
    (r.metadata->>'project_id')::uuid,
    'revenue_amt',
    r.id,
    'has_revenue'
FROM app.d_revenue r
WHERE r.metadata->>'project_id' IS NOT NULL
  AND r.active_flag = true
ON CONFLICT DO NOTHING;

-- Link revenues to businesses
INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
SELECT
    'biz',
    (r.metadata->>'business_id')::uuid,
    'revenue_amt',
    r.id,
    'has_revenue'
FROM app.d_revenue r
WHERE r.metadata->>'business_id' IS NOT NULL
  AND r.active_flag = true
ON CONFLICT DO NOTHING;

-- Link revenues to offices
INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
SELECT
    'office',
    (r.metadata->>'office_id')::uuid,
    'revenue_amt',
    r.id,
    'has_revenue'
FROM app.d_revenue r
WHERE r.metadata->>'office_id' IS NOT NULL
  AND r.active_flag = true
ON CONFLICT DO NOTHING;

-- Link revenues to tasks
INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
SELECT
    'task',
    (r.metadata->>'task_id')::uuid,
    'revenue_amt',
    r.id,
    'has_revenue'
FROM app.d_revenue r
WHERE r.metadata->>'task_id' IS NOT NULL
  AND r.active_flag = true
ON CONFLICT DO NOTHING;

-- Link revenues to customers
INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
SELECT
    'cust',
    (r.metadata->>'customer_id')::uuid,
    'revenue_amt',
    r.id,
    'has_revenue'
FROM app.d_revenue r
WHERE r.metadata->>'customer_id' IS NOT NULL
  AND r.active_flag = true
ON CONFLICT DO NOTHING;

-- =====================================================
-- REGISTER REVENUES IN d_entity_instance_id
-- =====================================================

INSERT INTO app.d_entity_instance_id (entity_type, entity_id, entity_name, entity_code entity_code)
SELECT 'revenue_amt', id, name, code
FROM app.d_revenue
WHERE active_flag = true
ON CONFLICT (entity_type, entity_id) DO UPDATE
SET entity_name = EXCLUDED.entity_name,
    entity_code = EXCLUDED.entity_code
    entity_code = EXCLUDED.entity_code,
    updated_ts = now();

COMMENT ON TABLE app.d_revenue IS 'Revenue center entity for tracking project, task, and business revenue_amt with forecasting and receipt management';
COMMENT ON COLUMN app.d_revenue.revenue_amt_local IS 'Revenue amount in local currency (primary reporting currency)';
COMMENT ON COLUMN app.d_revenue.revenue_amt_invoice IS 'Revenue amount as shown on invoice/receipt (may be in different currency)';
COMMENT ON COLUMN app.d_revenue.invoice_currency IS 'Currency code for invoice amount (ISO 4217 format)';
COMMENT ON COLUMN app.d_revenue.exch_rate IS 'Exchange rate used for conversion: revenue_amt_invoice * exch_rate = revenue_amt_local';
COMMENT ON COLUMN app.d_revenue.revenue_forecasted_amt_lcl IS 'Forecasted revenue_amt amount for this entry in local currency';
COMMENT ON COLUMN app.d_revenue.sales_receipt_attachment IS 'S3 URI for uploaded sales_amt receipt document (managed via S3_ATTACHMENT_SERVICE)';
