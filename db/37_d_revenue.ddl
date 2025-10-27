-- =====================================================
-- REVENUE CENTER ENTITY (d_revenue) - CORE ENTITY
-- Revenue tracking with forecasting, multi-currency support, and receipt management
-- =====================================================
--
-- BUSINESS PURPOSE:
-- Tracks revenue associated with projects, tasks, customers, businesses, and offices.
-- Supports revenue forecasting, actual revenue tracking, multi-currency transactions, and
-- S3-based sales receipt attachment storage. Primary financial tracking entity for revenue analysis.
--
-- API SEMANTICS & LIFECYCLE:
--
-- 1. CREATE REVENUE ENTRY
--    • Endpoint: POST /api/v1/revenue
--    • Body: {revenue_code, descr, customer_id, business_id, project_id, task_id, office_id, revenue_amt_local, revenue_amt_invoice, invoice_currency, exch_rate, revenue_forecasted_amt_lcl, sales_receipt_attachment}
--    • Returns: {id: "new-uuid", version: 1, ...}
--    • Database: INSERT with version=1, active_flag=true, created_ts=now()
--    • RBAC: Requires permission 4 (create) on entity='revenue', entity_id='all'
--    • Business Rule: Creates entity_id_map entries for parent relationships (project/task/customer/business/office)
--    • S3 Integration: sales_receipt_attachment stores S3 URI from S3_ATTACHMENT_SERVICE
--
-- 2. UPDATE REVENUE ENTRY (Receipt Updates, Amount Adjustments, Forecasts)
--    • Endpoint: PUT /api/v1/revenue/{id}
--    • Body: {revenue_amt_local, revenue_amt_invoice, sales_receipt_attachment, revenue_forecasted_amt_lcl}
--    • Returns: {id: "same-uuid", version: 2, updated_ts: "new-timestamp"}
--    • Database: UPDATE SET [fields], version=version+1, updated_ts=now() WHERE id=$1
--    • SCD Behavior: IN-PLACE UPDATE
--      - Same ID (preserves all parent entity relationships)
--      - version increments (audit trail for financial records)
--      - updated_ts refreshed
--      - NO archival (revenue records can be adjusted for corrections)
--    • RBAC: Requires permission 1 (edit) on entity='revenue', entity_id={id} OR 'all'
--    • Business Rule: Amount changes trigger revenue recalculation in parent entities
--
-- 3. SOFT DELETE REVENUE ENTRY
--    • Endpoint: DELETE /api/v1/revenue/{id}
--    • Database: UPDATE SET active_flag=false, to_ts=now() WHERE id=$1
--    • RBAC: Requires permission 3 (delete)
--    • Business Rule: Hides from lists but preserves for financial audit trail
--
-- 4. LIST REVENUE ENTRIES (With RBAC Filtering)
--    • Endpoint: GET /api/v1/revenue?project_id={uuid}&customer_id={uuid}&limit=50
--    • Database:
--      SELECT r.* FROM d_revenue r
--      WHERE active_flag=true
--        AND EXISTS (
--          SELECT 1 FROM entity_id_rbac_map rbac
--          WHERE rbac.empid=$user_id
--            AND rbac.entity='revenue'
--            AND (rbac.entity_id=r.id::text OR rbac.entity_id='all')
--            AND 0=ANY(rbac.permission)  -- View permission
--        )
--      ORDER BY created_ts DESC
--      LIMIT $1 OFFSET $2
--    • RBAC: User sees ONLY revenue entries they have view access to
--    • Frontend: Renders in EntityMainPage with table view
--
-- 5. GET SINGLE REVENUE ENTRY
--    • Endpoint: GET /api/v1/revenue/{id}
--    • Database: SELECT * FROM d_revenue WHERE id=$1 AND active_flag=true
--    • RBAC: Checks entity_id_rbac_map for view permission
--    • Frontend: EntityDetailPage renders fields including S3 attachment links
--
-- 6. GET PARENT ENTITY REVENUES
--    • Endpoint: GET /api/v1/project/{id}/revenue?limit=20
--    • Database:
--      SELECT r.* FROM d_revenue r
--      INNER JOIN entity_id_map eim ON eim.child_entity_id=r.id
--      WHERE eim.parent_entity_id=$1 AND eim.parent_entity_type='project'
--        AND r.active_flag=true
--      ORDER BY r.created_ts DESC
--    • Relationship: Via entity_id_map (parent_entity_type='project', child_entity_type='revenue')
--    • Frontend: Renders in DynamicChildEntityTabs component on project detail page
--
-- 7. GET REVENUE SUMMARIES (Tab Counts)
--    • Endpoint: GET /api/v1/project/{id}/dynamic-child-entity-tabs
--    • Returns: {action_entities: [{actionEntity: "revenue", count: 12, label: "Revenue", icon: "TrendingUp"}, ...]}
--    • Database: Counts via entity_id_map JOINs:
--      SELECT COUNT(*) FROM d_revenue r
--      INNER JOIN entity_id_map eim ON eim.child_entity_id=r.id
--      WHERE eim.parent_entity_id=$1 AND eim.parent_entity_type='project'
--    • Frontend: Renders tab badges with counts
--
-- KEY SCD FIELDS:
-- • id: Stable UUID (never changes, preserves relationships)
-- • version: Increments on updates (audit trail for financial records)
-- • from_ts: Record creation timestamp (never modified)
-- • to_ts: Soft delete timestamp (NULL=active, timestamptz=deleted)
-- • active_flag: Soft delete flag (true=active, false=deleted/archived)
-- • created_ts: Original creation time (never modified)
-- • updated_ts: Last modification time (refreshed on UPDATE)
--
-- KEY BUSINESS FIELDS:
-- • revenue_code: Unique identifier for revenue entry (e.g., "REV-2024-001", "SAL-HVAC-002")
-- • revenue_amt_local: Revenue amount in local currency (primary amount for reporting)
-- • revenue_amt_invoice: Revenue amount as shown on invoice/receipt (may differ from local currency)
-- • invoice_currency: Currency code for invoice amount (e.g., "CAD", "USD")
-- • exch_rate: Exchange rate used for currency conversion (revenue_amt_invoice * exch_rate = revenue_amt_local)
-- • revenue_forecasted_amt_lcl: Forecasted revenue amount for this entry in local currency
-- • sales_receipt_attachment: S3 URI for uploaded sales receipt document (managed via S3_ATTACHMENT_SERVICE)
--
-- RELATIONSHIPS:
-- • customer_id → d_cust (which customer this revenue is from)
-- • business_id → d_business (which business unit this revenue belongs to)
-- • project_id → d_project (which project this revenue is for)
-- • task_id → d_task (which task this revenue is for) [via entity_id_map]
-- • office_id → d_office (which office manages this revenue) [via entity_id_map]
-- • All parent relationships managed via entity_id_map for flexibility
--
-- S3 ATTACHMENT INTEGRATION:
-- • sales_receipt_attachment field stores S3 URI from presigned URL upload flow
-- • Upload process:
--   1. Frontend requests presigned URL via POST /api/v1/artifact/presigned-url
--   2. Frontend uploads file directly to S3/MinIO
--   3. Frontend submits revenue entry with S3 URI in sales_receipt_attachment field
-- • Access process:
--   1. Frontend displays sales_receipt_attachment URI as download link
--   2. User clicks link to download receipt from S3
--
-- =====================================================

CREATE TABLE app.d_revenue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug varchar(100) UNIQUE NOT NULL,
    code varchar(50) UNIQUE NOT NULL,
    revenue_code varchar(50) NOT NULL,
    name varchar(200) NOT NULL,
    descr text,
    tags jsonb DEFAULT '[]'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,

    -- Revenue relationships to parent entities are managed via entity_id_map so no FK needed
    -- Parent entities: customer, business, project, task, office

    -- Financial fields
    revenue_amt_local decimal(15,2) NOT NULL,                -- Revenue amount in local currency
    revenue_amt_invoice decimal(15,2),                       -- Revenue amount on invoice/receipt (may differ)
    invoice_currency varchar(3) DEFAULT 'CAD',               -- Currency code (ISO 4217)
    exch_rate decimal(10,6) DEFAULT 1.0,                     -- Exchange rate for conversion
    revenue_forecasted_amt_lcl decimal(15,2),                -- Forecasted revenue amount (local)

    -- Attachment fields
    sales_receipt_attachment text,                            -- S3 URI for sales receipt document

    -- Temporal fields
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);

CREATE INDEX idx_d_revenue_active ON app.d_revenue(active_flag) WHERE active_flag = true;
CREATE INDEX idx_d_revenue_created_ts ON app.d_revenue(created_ts DESC);
CREATE INDEX idx_d_revenue_revenue_code ON app.d_revenue(revenue_code);
CREATE INDEX idx_d_revenue_invoice_currency ON app.d_revenue(invoice_currency);

-- Sample revenue data for Digital Transformation Project
INSERT INTO app.d_revenue (
    id, slug, code, revenue_code, name, descr, tags, metadata,
    revenue_amt_local, revenue_amt_invoice, invoice_currency, exch_rate,
    revenue_forecasted_amt_lcl, sales_receipt_attachment
) VALUES (
    '20000001-0001-0001-0001-000000000001',
    'dt-milestone-payment-phase1',
    'REV-DT-001',
    'REV-2024-001',
    'Digital Transformation - Phase 1 Milestone Payment',
    'First milestone payment for digital transformation project completion. Includes stakeholder analysis, vendor evaluation, and implementation planning deliverables.',
    '["milestone_payment", "digital_transformation", "phase1"]'::jsonb,
    '{"revenue_type": "milestone_payment", "phase": 1, "deliverables": ["stakeholder_analysis", "vendor_evaluation", "implementation_plan"], "project_id": "93106ffb-402e-43a7-8b26-5287e37a1b0e", "business_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "office_id": "11111111-1111-1111-1111-111111111111", "customer_id": "5e8b4c71-6f2a-4d3b-9e1f-8a7c6b5d4e3f"}'::jsonb,
    250000.00, 250000.00, 'CAD', 1.0,
    250000.00, 's3://pmo-attachments/receipts/2024/q1/rev-2024-001.pdf'
);

INSERT INTO app.d_revenue (
    id, slug, code, revenue_code, name, descr, tags, metadata,
    revenue_amt_local, revenue_amt_invoice, invoice_currency, exch_rate,
    revenue_forecasted_amt_lcl, sales_receipt_attachment
) VALUES (
    '20000001-0001-0001-0001-000000000002',
    'dt-training-services-q1',
    'REV-DT-002',
    'REV-2024-002',
    'Digital Transformation Training Services - Q1 2024',
    'Employee training services for new PMO system. 5-day training program for 30 employees including materials, certification, and follow-up support.',
    '["training", "professional_services", "employee_development"]'::jsonb,
    '{"revenue_type": "training_services", "quarter": "Q1-2024", "attendees": 30, "days": 5, "rate_per_attendee": 1200, "project_id": "93106ffb-402e-43a7-8b26-5287e37a1b0e", "business_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "office_id": "11111111-1111-1111-1111-111111111111", "customer_id": "5e8b4c71-6f2a-4d3b-9e1f-8a7c6b5d4e3f"}'::jsonb,
    36000.00, 36000.00, 'CAD', 1.0,
    35000.00, 's3://pmo-attachments/receipts/2024/q1/rev-2024-002.pdf'
);

-- Fall Landscaping Campaign Revenue
INSERT INTO app.d_revenue (
    id, slug, code, revenue_code, name, descr, tags, metadata,
    revenue_amt_local, revenue_amt_invoice, invoice_currency, exch_rate,
    revenue_forecasted_amt_lcl, sales_receipt_attachment
) VALUES (
    '20000001-0001-0001-0001-000000000003',
    'flc-residential-package-sept',
    'REV-FLC-001',
    'REV-2024-003',
    'Fall Landscaping - Residential Package Sales September',
    'Revenue from residential fall cleanup packages sold in September. Includes leaf removal, lawn aeration, and winterization services for 85 residential properties.',
    '["landscaping", "residential", "fall_cleanup", "package_sales"]'::jsonb,
    '{"revenue_type": "service_package", "month": "2024-09", "properties": 85, "avg_package_price": 450, "project_id": "84215ccb-313d-48f8-9c37-4398f28c0b1f", "business_id": "dddddddd-dddd-dddd-dddd-dddddddddddd", "office_id": "44444444-4444-4444-4444-444444444444"}'::jsonb,
    38250.00, 38250.00, 'CAD', 1.0,
    40000.00, 's3://pmo-attachments/receipts/2024/09/rev-2024-003.pdf'
);

INSERT INTO app.d_revenue (
    id, slug, code, revenue_code, name, descr, tags, metadata,
    revenue_amt_local, revenue_amt_invoice, invoice_currency, exch_rate,
    revenue_forecasted_amt_lcl, sales_receipt_attachment
) VALUES (
    '20000001-0001-0001-0001-000000000004',
    'flc-commercial-contracts-q4',
    'REV-FLC-002',
    'REV-2024-004',
    'Fall Landscaping - Commercial Contracts Q4 2024',
    'Quarterly contract revenue from commercial property maintenance. 12 commercial properties with comprehensive fall services including cleanup, snow preparation, and property management.',
    '["landscaping", "commercial", "contract_revenue", "quarterly"]'::jsonb,
    '{"revenue_type": "contract_revenue", "quarter": "Q4-2024", "properties": 12, "contract_value": 6500, "project_id": "84215ccb-313d-48f8-9c37-4398f28c0b1f", "business_id": "dddddddd-dddd-dddd-dddd-dddddddddddd", "office_id": "44444444-4444-4444-4444-444444444444"}'::jsonb,
    78000.00, 78000.00, 'CAD', 1.0,
    75000.00, 's3://pmo-attachments/receipts/2024/10/rev-2024-004.pdf'
);

-- HVAC Modernization Revenue
INSERT INTO app.d_revenue (
    id, slug, code, revenue_code, name, descr, tags, metadata,
    revenue_amt_local, revenue_amt_invoice, invoice_currency, exch_rate,
    revenue_forecasted_amt_lcl, sales_receipt_attachment
) VALUES (
    '20000001-0001-0001-0001-000000000005',
    'hvac-smart-system-sales',
    'REV-HVAC-001',
    'REV-2024-005',
    'Smart HVAC System Sales - Commercial Installations',
    'Revenue from smart HVAC system installations for commercial clients. 8 installations completed with smart controls, IoT integration, and 2-year maintenance contracts.',
    '["hvac", "smart_systems", "commercial", "installation", "recurring_revenue"]'::jsonb,
    '{"revenue_type": "product_installation", "installations": 8, "avg_installation_value": 18500, "maintenance_contracts_included": true, "project_id": "72304dab-202c-39e7-8a26-3287d26a0c2d", "business_id": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", "office_id": "44444444-4444-4444-4444-444444444444"}'::jsonb,
    148000.00, 143700.00, 'USD', 1.0299,
    150000.00, 's3://pmo-attachments/receipts/2024/10/rev-2024-005.pdf'
);

INSERT INTO app.d_revenue (
    id, slug, code, revenue_code, name, descr, tags, metadata,
    revenue_amt_local, revenue_amt_invoice, invoice_currency, exch_rate,
    revenue_forecasted_amt_lcl, sales_receipt_attachment
) VALUES (
    '20000001-0001-0001-0001-000000000006',
    'hvac-preventive-maintenance-contracts',
    'REV-HVAC-002',
    'REV-2024-006',
    'HVAC Preventive Maintenance Contracts - Annual',
    'Annual preventive maintenance contract revenue. 45 commercial clients with quarterly service visits, priority support, and energy efficiency optimization.',
    '["hvac", "preventive_maintenance", "contract_revenue", "recurring"]'::jsonb,
    '{"revenue_type": "maintenance_contract", "clients": 45, "contract_term": "annual", "visits_per_year": 4, "avg_contract_value": 3200, "project_id": "72304dab-202c-39e7-8a26-3287d26a0c2d", "business_id": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", "office_id": "44444444-4444-4444-4444-444444444444"}'::jsonb,
    144000.00, 144000.00, 'CAD', 1.0,
    140000.00, 's3://pmo-attachments/receipts/2024/10/rev-2024-006.pdf'
);

-- Customer Service Excellence Revenue
INSERT INTO app.d_revenue (
    id, slug, code, revenue_code, name, descr, tags, metadata,
    revenue_amt_local, revenue_amt_invoice, invoice_currency, exch_rate,
    revenue_forecasted_amt_lcl, sales_receipt_attachment
) VALUES (
    '20000001-0001-0001-0001-000000000007',
    'cse-consulting-engagement',
    'REV-CSE-001',
    'REV-2024-007',
    'Customer Service Excellence - Consulting Engagement',
    'Consulting revenue from customer service optimization project. Process analysis, training delivery, and implementation support for service excellence initiative.',
    '["consulting", "customer_service", "process_optimization", "training"]'::jsonb,
    '{"revenue_type": "consulting_services", "engagement_type": "process_optimization", "duration_weeks": 12, "project_id": "50192aab-000a-17c5-6904-1065b04a0a0b", "business_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "office_id": "22222222-2222-2222-2222-222222222222"}'::jsonb,
    85000.00, 85000.00, 'CAD', 1.0,
    80000.00, 's3://pmo-attachments/receipts/2024/08/rev-2024-007.pdf'
);

COMMENT ON TABLE app.d_revenue IS 'Revenue center entity for tracking project, task, and business revenue with forecasting and receipt management';
COMMENT ON COLUMN app.d_revenue.revenue_amt_local IS 'Revenue amount in local currency (primary reporting currency)';
COMMENT ON COLUMN app.d_revenue.revenue_amt_invoice IS 'Revenue amount as shown on invoice/receipt (may be in different currency)';
COMMENT ON COLUMN app.d_revenue.invoice_currency IS 'Currency code for invoice amount (ISO 4217 format)';
COMMENT ON COLUMN app.d_revenue.exch_rate IS 'Exchange rate used for conversion: revenue_amt_invoice * exch_rate = revenue_amt_local';
COMMENT ON COLUMN app.d_revenue.revenue_forecasted_amt_lcl IS 'Forecasted revenue amount for this entry in local currency';
COMMENT ON COLUMN app.d_revenue.sales_receipt_attachment IS 'S3 URI for uploaded sales receipt document (managed via S3_ATTACHMENT_SERVICE)';
