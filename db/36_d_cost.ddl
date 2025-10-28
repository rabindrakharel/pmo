-- =====================================================
-- COST CENTER ENTITY (d_cost) - CORE ENTITY
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
--    • Database: UPDATE SET [fields], version=version+1, updated_ts=now() WHERE id=$1
--    • SCD Behavior: IN-PLACE UPDATE
--      - Same ID (preserves all parent entity relationships)
--      - version increments (audit trail for financial records)
--      - updated_ts refreshed
--      - NO archival (cost records can be adjusted for corrections)
--    • RBAC: Requires permission 1 (edit) on entity='cost', entity_id={id} OR 'all'
--    • Business Rule: Amount changes trigger budget recalculation in parent entities
--
-- 3. SOFT DELETE COST ENTRY
--    • Endpoint: DELETE /api/v1/cost/{id}
--    • Database: UPDATE SET active_flag=false, to_ts=now() WHERE id=$1
--    • RBAC: Requires permission 3 (delete)
--    • Business Rule: Hides from lists but preserves for financial audit trail
--
-- 4. LIST COST ENTRIES (With RBAC Filtering)
--    • Endpoint: GET /api/v1/cost?project_id={uuid}&customer_id={uuid}&limit=50
--    • Database:
--      SELECT c.* FROM d_cost c
--      WHERE active_flag=true
--        AND EXISTS (
--          SELECT 1 FROM entity_id_rbac_map rbac
--          WHERE rbac.empid=$user_id
--            AND rbac.entity='cost'
--            AND (rbac.entity_id=c.id::text OR rbac.entity_id='all')
--            AND 0=ANY(rbac.permission)  -- View permission
--        )
--      ORDER BY created_ts DESC
--      LIMIT $1 OFFSET $2
--    • RBAC: User sees ONLY cost entries they have view access to
--    • Frontend: Renders in EntityMainPage with table view
--
-- 5. GET SINGLE COST ENTRY
--    • Endpoint: GET /api/v1/cost/{id}
--    • Database: SELECT * FROM d_cost WHERE id=$1 AND active_flag=true
--    • RBAC: Checks entity_id_rbac_map for view permission
--    • Frontend: EntityDetailPage renders fields including S3 attachment links
--
-- 6. GET PARENT ENTITY COSTS
--    • Endpoint: GET /api/v1/project/{id}/cost?limit=20
--    • Database:
--      SELECT c.* FROM d_cost c
--      INNER JOIN entity_id_map eim ON eim.child_entity_id=c.id
--      WHERE eim.parent_entity_id=$1 AND eim.parent_entity_type='project'
--        AND c.active_flag=true
--      ORDER BY c.created_ts DESC
--    • Relationship: Via entity_id_map (parent_entity_type='project', child_entity_type='cost')
--    • Frontend: Renders in DynamicChildEntityTabs component on project detail page
--
-- 7. GET COST SUMMARIES (Tab Counts)
--    • Endpoint: GET /api/v1/project/{id}/dynamic-child-entity-tabs
--    • Returns: {action_entities: [{actionEntity: "cost", count: 15, label: "Costs", icon: "DollarSign"}, ...]}
--    • Database: Counts via entity_id_map JOINs:
--      SELECT COUNT(*) FROM d_cost c
--      INNER JOIN entity_id_map eim ON eim.child_entity_id=c.id
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
-- • cost_code: Unique identifier for cost entry (e.g., "INV-2024-001", "EXP-HVAC-002")
-- • cost_amt_lcl: Cost amount in local currency (primary amount for reporting)
-- • cost_amt_invoice: Cost amount as shown on invoice (may differ from local currency)
-- • invoice_currency: Currency code for invoice amount (e.g., "CAD", "USD")
-- • exch_rate: Exchange rate used for currency conversion (cost_amt_invoice * exch_rate = cost_amt_lcl)
-- • cust_budgeted_amt_lcl: Customer's budgeted amount for this cost in local currency
-- • invoice_attachment: S3 URI for uploaded invoice document (managed via S3_ATTACHMENT_SERVICE)
--
-- RELATIONSHIPS:
-- • customer_id → d_cust (which customer this cost is associated with)
-- • business_id → d_business (which business unit this cost belongs to)
-- • project_id → d_project (which project this cost is for)
-- • task_id → d_task (which task this cost is for) [via entity_id_map]
-- • office_id → d_office (which office manages this cost) [via entity_id_map]
-- • All parent relationships managed via entity_id_map for flexibility
--
-- S3 ATTACHMENT INTEGRATION:
-- • invoice_attachment field stores S3 URI from presigned URL upload flow
-- • Upload process:
--   1. Frontend requests presigned URL via POST /api/v1/artifact/presigned-url
--   2. Frontend uploads file directly to S3/MinIO
--   3. Frontend submits cost entry with S3 URI in invoice_attachment field
-- • Access process:
--   1. Frontend displays invoice_attachment URI as download link
--   2. User clicks link to download invoice from S3
--
-- =====================================================

CREATE TABLE app.d_cost (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug varchar(100) UNIQUE NOT NULL,
    code varchar(50) UNIQUE NOT NULL,
    cost_code varchar(50) NOT NULL,
    name varchar(200) NOT NULL,
    descr text,
    tags jsonb DEFAULT '[]'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,

    -- Cost relationships to parent entities are managed via entity_id_map so no FK needed
    -- Parent entities: customer, business, project, task, office

    -- Financial fields
    cost_amt_lcl decimal(15,2) NOT NULL,                    -- Cost amount in local currency
    cost_amt_invoice decimal(15,2),                         -- Cost amount on invoice (may differ)
    invoice_currency varchar(3) DEFAULT 'CAD',              -- Currency code (ISO 4217)
    exch_rate decimal(10,6) DEFAULT 1.0,                    -- Exchange rate for conversion
    cust_budgeted_amt_lcl decimal(15,2),                    -- Customer budgeted amount (local)

    -- Standardized S3 Attachment Fields
    attachment text,                                         -- Full S3 URI: s3://bucket/key
    attachment_format varchar(20),                           -- File extension: pdf, png, jpg, svg, etc.
    attachment_size_bytes bigint,                            -- File size in bytes
    attachment_object_bucket varchar(100),                   -- S3 bucket name: 'pmo-attachments'
    attachment_object_key varchar(500),                      -- S3 object key: costs/{id}/invoice.ext

    -- Temporal fields
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);

CREATE INDEX idx_d_cost_active ON app.d_cost(active_flag) WHERE active_flag = true;
CREATE INDEX idx_d_cost_created_ts ON app.d_cost(created_ts DESC);
CREATE INDEX idx_d_cost_cost_code ON app.d_cost(cost_code);
CREATE INDEX idx_d_cost_invoice_currency ON app.d_cost(invoice_currency);

-- Sample cost data for Digital Transformation Project
INSERT INTO app.d_cost (
    id, slug, code, cost_code, name, descr, tags, metadata,
    cost_amt_lcl, cost_amt_invoice, invoice_currency, exch_rate,
    cust_budgeted_amt_lcl, invoice_attachment
) VALUES (
    '10000001-0001-0001-0001-000000000001',
    'dt-software-license-q1',
    'COST-DT-001',
    'INV-2024-001',
    'PMO Software License - Q1 2024',
    'Quarterly software licensing costs for PMO platform implementation. Includes user licenses, API access, and premium support package.',
    '["software", "licensing", "pmo", "digital_transformation"]'::jsonb,
    '{"cost_type": "software_license", "quarter": "Q1-2024", "department": "IT", "approved_by": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13", "project_id": "93106ffb-402e-43a7-8b26-5287e37a1b0e", "business_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "office_id": "11111111-1111-1111-1111-111111111111", "customer_id": "5e8b4c71-6f2a-4d3b-9e1f-8a7c6b5d4e3f"}'::jsonb,
    45000.00, 45000.00, 'CAD', 1.0,
    50000.00, 's3://pmo-attachments/invoices/2024/q1/inv-2024-001.pdf'
);

INSERT INTO app.d_cost (
    id, slug, code, cost_code, name, descr, tags, metadata,
    cost_amt_lcl, cost_amt_invoice, invoice_currency, exch_rate,
    cust_budgeted_amt_lcl, invoice_attachment
) VALUES (
    '10000001-0001-0001-0001-000000000002',
    'dt-consulting-services-jan',
    'COST-DT-002',
    'INV-2024-002',
    'Digital Transformation Consulting - January 2024',
    'Professional consulting services for digital transformation strategy, implementation planning, and stakeholder workshops. 120 hours at $850/hour.',
    '["consulting", "professional_services", "strategy", "planning"]'::jsonb,
    '{"cost_type": "professional_services", "month": "2024-01", "hours": 120, "rate": 850, "consultant": "TechVision Consulting Inc.", "project_id": "93106ffb-402e-43a7-8b26-5287e37a1b0e", "business_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "office_id": "11111111-1111-1111-1111-111111111111", "task_id": "a1111111-1111-1111-1111-111111111111"}'::jsonb,
    102000.00, 102000.00, 'CAD', 1.0,
    110000.00, 's3://pmo-attachments/invoices/2024/01/inv-2024-002.pdf'
);

-- Fall Landscaping Campaign Costs
INSERT INTO app.d_cost (
    id, slug, code, cost_code, name, descr, tags, metadata,
    cost_amt_lcl, cost_amt_invoice, invoice_currency, exch_rate,
    cust_budgeted_amt_lcl, invoice_attachment
) VALUES (
    '10000001-0001-0001-0001-000000000003',
    'flc-equipment-rental-sept',
    'COST-FLC-001',
    'INV-2024-003',
    'Fall Campaign Equipment Rental - September',
    'Commercial landscaping equipment rental for fall campaign including aerators, leaf blowers, mulchers, and transportation trucks.',
    '["equipment_rental", "landscaping", "fall_campaign", "operational"]'::jsonb,
    '{"cost_type": "equipment_rental", "month": "2024-09", "vendor": "ProEquip Rentals", "project_id": "84215ccb-313d-48f8-9c37-4398f28c0b1f", "business_id": "dddddddd-dddd-dddd-dddd-dddddddddddd", "office_id": "44444444-4444-4444-4444-444444444444"}'::jsonb,
    8500.00, 8500.00, 'CAD', 1.0,
    9000.00, 's3://pmo-attachments/invoices/2024/09/inv-2024-003.pdf'
);

-- HVAC Modernization Costs
INSERT INTO app.d_cost (
    id, slug, code, cost_code, name, descr, tags, metadata,
    cost_amt_lcl, cost_amt_invoice, invoice_currency, exch_rate,
    cust_budgeted_amt_lcl, invoice_attachment
) VALUES (
    '10000001-0001-0001-0001-000000000004',
    'hvac-smart-system-procurement',
    'COST-HVAC-001',
    'INV-2024-004',
    'Smart HVAC System Procurement',
    'Purchase of smart HVAC control systems and IoT sensors for modernization project. 25 units with installation kits and 2-year warranty.',
    '["procurement", "smart_systems", "hvac", "technology", "iot"]'::jsonb,
    '{"cost_type": "equipment_purchase", "quantity": 25, "unit_cost": 2800, "warranty_years": 2, "vendor": "SmartClimate Technologies", "project_id": "72304dab-202c-39e7-8a26-3287d26a0c2d", "business_id": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", "office_id": "44444444-4444-4444-4444-444444444444"}'::jsonb,
    70000.00, 68000.00, 'USD', 1.0294,
    75000.00, 's3://pmo-attachments/invoices/2024/10/inv-2024-004.pdf'
);

-- Corporate Office Expansion Costs
INSERT INTO app.d_cost (
    id, slug, code, cost_code, name, descr, tags, metadata,
    cost_amt_lcl, cost_amt_invoice, invoice_currency, exch_rate,
    cust_budgeted_amt_lcl, invoice_attachment
) VALUES (
    '10000001-0001-0001-0001-000000000005',
    'coe-furniture-procurement',
    'COST-COE-001',
    'INV-2024-005',
    'Corporate Office Furniture Procurement',
    'Modern office furniture including ergonomic workstations, collaborative seating, meeting room furniture, and reception area upgrades.',
    '["furniture", "office_expansion", "ergonomic", "interior"]'::jsonb,
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

INSERT INTO app.d_entity_instance_id (entity_type, entity_id, entity_name, entity_slug, entity_code)
SELECT 'cost', id, name, slug, code
FROM app.d_cost
WHERE active_flag = true
ON CONFLICT (entity_type, entity_id) DO UPDATE
SET entity_name = EXCLUDED.entity_name,
    entity_slug = EXCLUDED.entity_slug,
    entity_code = EXCLUDED.entity_code,
    updated_ts = now();

COMMENT ON TABLE app.d_cost IS 'Cost center entity for tracking project, task, and business costs with invoice management';
COMMENT ON COLUMN app.d_cost.cost_amt_lcl IS 'Cost amount in local currency (primary reporting currency)';
COMMENT ON COLUMN app.d_cost.cost_amt_invoice IS 'Cost amount as shown on invoice (may be in different currency)';
COMMENT ON COLUMN app.d_cost.invoice_currency IS 'Currency code for invoice amount (ISO 4217 format)';
COMMENT ON COLUMN app.d_cost.exch_rate IS 'Exchange rate used for conversion: cost_amt_invoice * exch_rate = cost_amt_lcl';
COMMENT ON COLUMN app.d_cost.cust_budgeted_amt_lcl IS 'Customer budgeted amount for this cost in local currency';
COMMENT ON COLUMN app.d_cost.invoice_attachment IS 'S3 URI for uploaded invoice document (managed via S3_ATTACHMENT_SERVICE)';
