-- =====================================================
-- COST FACT TABLE (f_cost) - FACT TABLE
-- Cost tracking with budget management, invoicing, and multi-currency support
-- =====================================================
--
-- BUSINESS PURPOSE:
-- Tracks costs associated with projects, tasks, customers, businesses, and offices.
-- Supports budget tracking, invoice management, multi-currency transactions, and
-- S3-based invoice attachment storage. Primary financial tracking entity for cost analysis.
--
-- API SEMANTICS & LIFECYCLE:
--
-- 1. CREATE COST ENTRY
--    • Endpoint: POST /api/v1/cost
--    • Body: {cost_code, descr, customer_id, business_id, project_id, task_id, office_id, cost_amt_lcl, cost_amt_invoice, invoice_currency, exch_rate, cust_budgeted_amt_lcl, invoice_attachment}
--    • Returns: {id: "new-uuid", version: 1, ...}
--    • Database: INSERT with version=1, active_flag=true, created_ts=now()
--    • RBAC: Requires permission 4 (create) on entity='cost', entity_id='all'
--    • Business Rule: Creates entity_id_map entries for parent relationships (project/task/customer/business/office)
--    • S3 Integration: invoice_attachment stores S3 URI from S3_ATTACHMENT_SERVICE
--
-- 2. UPDATE COST ENTRY (Invoice Updates, Amount Adjustments)
--    • Endpoint: PUT /api/v1/cost/{id}
--    • Body: {cost_amt_lcl, cost_amt_invoice, invoice_attachment, cust_budgeted_amt_lcl}
--    • Returns: {id: "same-uuid", version: 2, updated_ts: "new-timestamp"}
--
-- =====================================================

CREATE TABLE app.f_cost (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,
    cost_code varchar(100),
    name varchar(200) NOT NULL,
    descr text,
    metadata jsonb DEFAULT '{}'::jsonb,
    active_flag boolean DEFAULT true,
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1,

    -- Cost-specific fields (all amounts end with _amt)
    cost_amt numeric(15,2),
    invoice_amt numeric(15,2),
    invoice_currency_code varchar(3) DEFAULT 'CAD',
    exchange_rate numeric(10,6) DEFAULT 1.0,
    budgeted_amt numeric(15,2),
    attachment_url text
);

COMMENT ON TABLE app.f_cost IS 'Cost fact table for financial tracking';

-- Sample cost data
-- Fall Landscaping Campaign Costs
INSERT INTO app.f_cost (
    id, code, cost_code, name, descr, metadata,
    cost_amt, invoice_amt, invoice_currency_code, exchange_rate,
    budgeted_amt, attachment_url
) VALUES (
    '10000001-0001-0001-0001-000000000003',
    'COST-FLC-001',
    'INV-2024-003',
    'Fall Campaign Equipment Rental - September',
    'Commercial landscaping equipment rental for fall campaign including aerators, leaf blowers, mulchers, and transportation trucks.',
    '{"cost_type": "equipment_rental", "month": "2024-09", "vendor": "ProEquip Rentals", "project_id": "84215ccb-313d-48f8-9c37-4398f28c0b1f", "business_id": "dddddddd-dddd-dddd-dddd-dddddddddddd", "office_id": "44444444-4444-4444-4444-444444444444"}'::jsonb,
    8500.00, 8500.00, 'CAD', 1.0,
    9000.00, 's3://pmo-attachments/invoices/2024/09/inv-2024-003.pdf'
);

-- HVAC Modernization Costs
INSERT INTO app.f_cost (
    id, code, cost_code, name, descr, metadata,
    cost_amt, invoice_amt, invoice_currency_code, exchange_rate,
    budgeted_amt, attachment_url
) VALUES (
    '10000001-0001-0001-0001-000000000004',
    'COST-HVAC-001',
    'INV-2024-004',
    'Smart HVAC System Procurement',
    'Purchase of smart HVAC control systems and IoT sensors for modernization project. 25 units with installation kits and 2-year warranty.',
    '{"cost_type": "equipment_purchase", "quantity": 25, "unit_cost": 2800, "warranty_years": 2, "vendor": "SmartClimate Technologies", "project_id": "72304dab-202c-39e7-8a26-3287d26a0c2d", "business_id": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", "office_id": "44444444-4444-4444-4444-444444444444"}'::jsonb,
    70000.00, 68000.00, 'USD', 1.0294,
    75000.00, 's3://pmo-attachments/invoices/2024/10/inv-2024-004.pdf'
);

-- Corporate Office Expansion Costs
INSERT INTO app.f_cost (
    id, code, cost_code, name, descr, metadata,
    cost_amt, invoice_amt, invoice_currency_code, exchange_rate,
    budgeted_amt, attachment_url
) VALUES (
    '10000001-0001-0001-0001-000000000005',
    'COST-COE-001',
    'INV-2024-005',
    'Corporate Office Furniture Procurement',
    'Modern office furniture including ergonomic workstations, collaborative seating, meeting room furniture, and reception area upgrades.',
    '{"cost_type": "furniture_purchase", "vendor": "ModernSpace Office Solutions", "delivery_date": "2024-11-15", "installation_included": true, "project_id": "61203bac-101b-28d6-7a15-2176c15a0b1c", "business_id": "cccccccc-cccc-cccc-cccc-cccccccccccc", "office_id": "11111111-1111-1111-1111-111111111111"}'::jsonb,
    125000.00, 125000.00, 'CAD', 1.0,
    130000.00, 's3://pmo-attachments/invoices/2024/10/inv-2024-005.pdf'
);

-- =====================================================
-- REGISTER COSTS IN d_entity_id_map
-- =====================================================

-- Link all costs to their parent entities (projects)
INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
SELECT
    'project',
    (c.metadata->>'project_id')::uuid,
    'cost',
    c.id,
    'has_cost'
FROM app.d_cost c
WHERE c.metadata->>'project_id' IS NOT NULL
  AND c.active_flag = true
ON CONFLICT DO NOTHING;

-- Link costs to businesses
INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
SELECT
    'biz',
    (c.metadata->>'business_id')::uuid,
    'cost',
    c.id,
    'has_cost'
FROM app.d_cost c
WHERE c.metadata->>'business_id' IS NOT NULL
  AND c.active_flag = true
ON CONFLICT DO NOTHING;

-- Link costs to offices
INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
SELECT
    'office',
    (c.metadata->>'office_id')::uuid,
    'cost',
    c.id,
    'has_cost'
FROM app.d_cost c
WHERE c.metadata->>'office_id' IS NOT NULL
  AND c.active_flag = true
ON CONFLICT DO NOTHING;

-- Link costs to tasks
INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
SELECT
    'task',
    (c.metadata->>'task_id')::uuid,
    'cost',
    c.id,
    'has_cost'
FROM app.d_cost c
WHERE c.metadata->>'task_id' IS NOT NULL
  AND c.active_flag = true
ON CONFLICT DO NOTHING;

-- Link costs to customers
INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
SELECT
    'cust',
    (c.metadata->>'customer_id')::uuid,
    'cost',
    c.id,
    'has_cost'
FROM app.d_cost c
WHERE c.metadata->>'customer_id' IS NOT NULL
  AND c.active_flag = true
ON CONFLICT DO NOTHING;

-- =====================================================
-- REGISTER COSTS IN d_entity_instance_id
-- =====================================================

INSERT INTO app.d_entity_instance_id (entity_type, entity_id, entity_name, entity_code)
SELECT 'cost', id, name, code
FROM app.d_cost
WHERE active_flag = true
ON CONFLICT (entity_type, entity_id) DO UPDATE
SET entity_name = EXCLUDED.entity_name,
    entity_code = EXCLUDED.entity_code,
    updated_ts = now();

COMMENT ON TABLE app.d_cost IS 'Cost center entity for tracking project, task, and business costs with invoice management';
COMMENT ON COLUMN app.d_cost.cost_amt_lcl IS 'Cost amount in local currency (primary reporting currency)';
COMMENT ON COLUMN app.d_cost.cost_amt_invoice IS 'Cost amount as shown on invoice (may be in different currency)';
COMMENT ON COLUMN app.d_cost.invoice_currency IS 'Currency code for invoice amount (ISO 4217 format)';
COMMENT ON COLUMN app.d_cost.exch_rate IS 'Exchange rate used for conversion: cost_amt_invoice * exch_rate = cost_amt_lcl';
COMMENT ON COLUMN app.d_cost.cust_budgeted_amt_lcl IS 'Customer budgeted amount for this cost in local currency';
COMMENT ON COLUMN app.d_cost.invoice_attachment IS 'S3 URI for uploaded invoice document (managed via S3_ATTACHMENT_SERVICE)';
