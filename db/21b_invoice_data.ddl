-- =====================================================
-- Invoice Data Table (invoice_data)
-- =====================================================
--
-- SEMANTICS:
-- Invoice line item detail table capturing all invoice line items.
-- Represents individual billable items on each invoice.
-- Grain: One row per invoice line item.
--
-- BUSINESS CONTEXT:
-- - Records all billable items (products, services, labor, expenses)
-- - Supports revenue analysis by product, category, margin
-- - Enables detailed profitability reporting
-- - Links to invoice via invoice_number (no FK)
--
-- RELATIONSHIPS (NO FOREIGN KEYS):
-- - Links to invoice via invoice_number (no FK, loose coupling)
-- - Links to product via product_id (no FK)
-- - Links to order via order_id (no FK)
--
-- =====================================================

CREATE TABLE app.invoice_data (
    -- Primary Key
    id uuid DEFAULT gen_random_uuid(),

    -- Invoice Reference
    invoice_number varchar(50),                         -- References invoice.invoice_number
    invoice_line_number integer DEFAULT 1,              -- Line item sequence within invoice

    -- Product/Service Dimension
    product_id uuid,
    product_code varchar(50),
    product_name varchar(255),
    product_category varchar(100),
    line_item_type varchar(50) DEFAULT 'product',       -- 'product', 'labor', 'service', 'expense', 'discount', 'tax'

    -- Project Phase
    project_phase varchar(100),                         -- Project phase/milestone being billed

    -- Order Linkage
    order_id uuid,
    order_number varchar(50),

    -- Quantity Metrics
    qty_billed decimal(12,3),
    unit_of_measure varchar(20) DEFAULT 'each',         -- 'each', 'hour', 'ft', 'sqft', 'lb'

    -- Pricing Metrics (Canadian Dollars)
    unit_price_cad decimal(12,2),
    unit_cost_cad decimal(12,2),
    discount_percent decimal(5,2) DEFAULT 0,
    discount_amount_cad decimal(12,2) DEFAULT 0,

    -- Extended Metrics (Calculated)
    extended_price_cad decimal(12,2),                   -- quantity * unit_price
    extended_cost_cad decimal(12,2),                    -- quantity * unit_cost
    extended_margin_cad decimal(12,2),                  -- extended_price - extended_cost
    margin_percent decimal(5,2),                        -- (margin / price) * 100

    -- Tax Calculation
    tax_amount_cad decimal(12,2) DEFAULT 0,
    gst_amount_cad decimal(12,2) DEFAULT 0,
    pst_amount_cad decimal(12,2) DEFAULT 0,
    hst_amount_cad decimal(12,2) DEFAULT 0,
    tax_rate decimal(5,2),
    tax_exempt_flag boolean DEFAULT false,

    -- Line Total
    line_subtotal_cad decimal(12,2),                    -- Extended price after discount
    line_total_cad decimal(12,2),                       -- Subtotal + tax

    -- Payment Tracking (Line-level)
    amount_paid_cad decimal(12,2) DEFAULT 0,            -- Amount paid for this line
    amount_outstanding_cad decimal(12,2),               -- Remaining balance for this line

    -- Standard Fields
    metadata jsonb DEFAULT '{}',
    active_flag boolean DEFAULT true,
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);

COMMENT ON TABLE app.invoice_data IS 'Invoice line item detail table with one row per line item';
COMMENT ON COLUMN app.invoice_data.id IS 'Unique identifier (UUID)';
COMMENT ON COLUMN app.invoice_data.invoice_number IS 'References invoice.invoice_number (no FK, loose coupling)';
COMMENT ON COLUMN app.invoice_data.invoice_line_number IS 'Line item sequence within invoice';
COMMENT ON COLUMN app.invoice_data.line_item_type IS 'Type of line item: product, labor, service, expense, discount, tax';
COMMENT ON COLUMN app.invoice_data.qty_billed IS 'Quantity billed on this line';
COMMENT ON COLUMN app.invoice_data.unit_price_cad IS 'Unit price charged (CAD)';
COMMENT ON COLUMN app.invoice_data.unit_cost_cad IS 'Unit cost for margin calculation (CAD)';
COMMENT ON COLUMN app.invoice_data.extended_price_cad IS 'Quantity * unit_price (CAD)';
COMMENT ON COLUMN app.invoice_data.extended_margin_cad IS 'Extended price - extended cost (CAD)';
COMMENT ON COLUMN app.invoice_data.line_total_cad IS 'Line subtotal + tax (CAD)';
