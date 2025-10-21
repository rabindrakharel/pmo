-- =====================================================
-- Invoice Fact Table (fact_invoice)
-- =====================================================
--
-- SEMANTICS:
-- Transaction-level fact table capturing all invoices and invoice line items.
-- Represents billing events for products, services, labor, and expenses.
-- Grain: One row per invoice line item.
--
-- BUSINESS CONTEXT:
-- - Records all billable items across projects and standalone orders
-- - Supports revenue recognition, accounts receivable, and financial reporting
-- - Tracks payment status, aging, and collections
-- - Enables profitability analysis by product, customer, project
-- - Foundation for tax reporting (GST/HST/PST remittance)
--
-- RELATIONSHIPS:
-- - Links to d_product (products/services billed)
-- - Links to d_client (customer being invoiced)
-- - Links to d_project (project being billed, if applicable)
-- - Links to fact_order (originating order, if applicable)
-- - Links to d_employee (who generated invoice, project manager)
-- - Parent-child within table (invoice header → invoice lines)
--
-- METRICS:
-- - Billed amount, cost, margin, tax
-- - Payment amount, outstanding balance, days outstanding
-- - Invoice count, average invoice value, collection rate
-- - Revenue by product, customer, project, time period
--
-- =====================================================

DROP TABLE IF EXISTS app.fact_invoice CASCADE;

CREATE TABLE app.fact_invoice (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Invoice Identification
    invoice_number VARCHAR(50) NOT NULL UNIQUE,         -- Human-readable invoice number (e.g., "INV-2025-00123")
    invoice_line_number INTEGER DEFAULT 1,              -- Line item sequence within invoice
    invoice_type VARCHAR(50) DEFAULT 'standard',        -- 'standard', 'progress', 'final', 'credit_memo', 'debit_memo'
    billing_cycle VARCHAR(50),                          -- 'one_time', 'monthly', 'milestone', 'completion'

    -- Date/Time Dimensions
    invoice_date DATE NOT NULL,                         -- Date invoice was generated
    invoice_datetime TIMESTAMP NOT NULL DEFAULT NOW(),  -- Precise invoice timestamp
    due_date DATE,                                      -- Payment due date
    payment_terms VARCHAR(50) DEFAULT 'net_30',         -- 'due_on_receipt', 'net_30', 'net_60', 'net_90'
    service_period_start DATE,                          -- Period covered by invoice (start)
    service_period_end DATE,                            -- Period covered by invoice (end)

    -- Customer Dimension
    client_id UUID NOT NULL,                            -- Link to d_client (REQUIRED)
    client_name VARCHAR(255),                           -- Denormalized for query performance
    client_type VARCHAR(50),                            -- 'residential', 'commercial', 'government'
    client_tier VARCHAR(50),                            -- Customer tier for analytics

    -- Product/Service Dimension
    product_id UUID,                                    -- Link to d_product (if product/service item)
    product_sku VARCHAR(50),                            -- Denormalized SKU
    product_name VARCHAR(255),                          -- Denormalized name
    product_category VARCHAR(100),                      -- Denormalized category
    line_item_type VARCHAR(50) DEFAULT 'product',       -- 'product', 'labor', 'service', 'expense', 'discount', 'tax'

    -- Project/Job Association
    project_id UUID,                                    -- Link to d_project (if invoice is for specific job)
    project_name VARCHAR(255),                          -- Denormalized project name
    project_phase VARCHAR(100),                         -- Project phase/milestone being billed

    -- Order Linkage
    order_id UUID,                                      -- Link to fact_order (originating order)
    order_number VARCHAR(50),                           -- Denormalized order number

    -- Sales/Project Team
    project_manager_id UUID,                            -- Project manager responsible
    project_manager_name VARCHAR(255),                  -- Denormalized for reporting
    sales_rep_id UUID,                                  -- Sales representative
    sales_rep_name VARCHAR(255),                        -- Denormalized
    office_id UUID,                                     -- Billing office/branch
    office_name VARCHAR(255),                           -- Denormalized office

    -- Quantity Metrics
    quantity_billed DECIMAL(12,3) NOT NULL,             -- Quantity on this line
    unit_of_measure VARCHAR(20) DEFAULT 'each',         -- 'each', 'hour', 'ft', 'sqft', 'lb'

    -- Pricing Metrics (Canadian Dollars)
    unit_price_cad DECIMAL(12,2) NOT NULL,              -- Unit price charged
    unit_cost_cad DECIMAL(12,2),                        -- Unit cost (for margin calc)
    discount_percent DECIMAL(5,2) DEFAULT 0,            -- Discount percentage applied
    discount_amount_cad DECIMAL(12,2) DEFAULT 0,        -- Dollar discount

    -- Extended Metrics (Calculated)
    extended_price_cad DECIMAL(12,2),                   -- quantity * unit_price
    extended_cost_cad DECIMAL(12,2),                    -- quantity * unit_cost
    extended_margin_cad DECIMAL(12,2),                  -- extended_price - extended_cost
    margin_percent DECIMAL(5,2),                        -- (margin / price) * 100

    -- Tax Calculation
    tax_amount_cad DECIMAL(12,2) DEFAULT 0,             -- GST/HST/PST
    gst_amount_cad DECIMAL(12,2) DEFAULT 0,             -- GST component
    pst_amount_cad DECIMAL(12,2) DEFAULT 0,             -- PST component (if applicable)
    hst_amount_cad DECIMAL(12,2) DEFAULT 0,             -- HST component (if applicable)
    tax_rate DECIMAL(5,2),                              -- Effective tax rate
    tax_exempt_flag BOOLEAN DEFAULT false,              -- Line is tax exempt

    -- Line Total
    line_subtotal_cad DECIMAL(12,2),                    -- Extended price after discount
    line_total_cad DECIMAL(12,2),                       -- Subtotal + tax

    -- Invoice Status & Payment
    invoice_status VARCHAR(50) DEFAULT 'draft',         -- 'draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'void', 'written_off'
    payment_status VARCHAR(50) DEFAULT 'unpaid',        -- 'unpaid', 'partial', 'paid', 'refunded', 'written_off'
    sent_date DATE,                                     -- When invoice was sent to customer
    viewed_date DATE,                                   -- When customer viewed invoice (if electronic)
    paid_date DATE,                                     -- When fully paid
    void_date DATE,                                     -- If voided, when

    -- Payment Tracking
    amount_paid_cad DECIMAL(12,2) DEFAULT 0,            -- Amount paid so far on this line
    amount_outstanding_cad DECIMAL(12,2),               -- Remaining balance
    payment_method VARCHAR(50),                         -- 'credit_card', 'cheque', 'eft', 'cash', 'wire'
    payment_reference VARCHAR(100),                     -- Check number, transaction ID, etc.

    -- Aging Analysis
    days_outstanding INTEGER,                           -- Days since invoice date
    aging_bucket VARCHAR(20),                           -- 'current', '1-30', '31-60', '61-90', '90+'

    -- Customer References
    customer_po_number VARCHAR(100),                    -- Customer's PO number
    customer_reference VARCHAR(100),                    -- Customer's internal reference

    -- Billing Address (snapshot at time of invoice)
    billing_address_line1 VARCHAR(255),
    billing_address_line2 VARCHAR(255),
    billing_city VARCHAR(100),
    billing_province VARCHAR(2),                        -- 2-letter province code
    billing_postal_code VARCHAR(7),                     -- Canadian postal code
    billing_country VARCHAR(2) DEFAULT 'CA',            -- ISO country code

    -- Accounting Integration
    accounting_period VARCHAR(20),                      -- Accounting period (e.g., "2025-01", "Q1-2025")
    fiscal_year INTEGER,                                -- Fiscal year
    revenue_recognition_date DATE,                      -- When revenue is recognized (may differ from invoice date)
    gl_account VARCHAR(50),                             -- General ledger account code
    cost_center VARCHAR(50),                            -- Cost center/department

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID,                                    -- Employee who created invoice
    last_modified_by UUID,
    sent_by UUID,                                       -- Employee who sent invoice

    -- Metadata
    notes TEXT,                                         -- Internal invoice notes
    customer_notes TEXT,                                -- Notes visible to customer
    terms_and_conditions TEXT,                          -- T&C text (snapshot)
    tags TEXT[]                                         -- Searchable tags
);

-- Indexes for performance
CREATE INDEX idx_invoice_number ON app.fact_invoice(invoice_number);
CREATE INDEX idx_invoice_date ON app.fact_invoice(invoice_date);
CREATE INDEX idx_invoice_due_date ON app.fact_invoice(due_date);
CREATE INDEX idx_invoice_status ON app.fact_invoice(invoice_status);
CREATE INDEX idx_invoice_payment_status ON app.fact_invoice(payment_status);
CREATE INDEX idx_invoice_client ON app.fact_invoice(client_id);
CREATE INDEX idx_invoice_product ON app.fact_invoice(product_id);
CREATE INDEX idx_invoice_project ON app.fact_invoice(project_id);
CREATE INDEX idx_invoice_order ON app.fact_invoice(order_id);
CREATE INDEX idx_invoice_aging ON app.fact_invoice(aging_bucket, days_outstanding);
CREATE INDEX idx_invoice_accounting_period ON app.fact_invoice(accounting_period);

-- Trigger to calculate extended values and aging
CREATE OR REPLACE FUNCTION app.calculate_invoice_extended() RETURNS TRIGGER AS $$
BEGIN
    -- Calculate extended amounts
    NEW.extended_price_cad := NEW.quantity_billed * NEW.unit_price_cad;
    NEW.extended_cost_cad := NEW.quantity_billed * COALESCE(NEW.unit_cost_cad, 0);
    NEW.extended_margin_cad := NEW.extended_price_cad - NEW.extended_cost_cad;

    IF NEW.extended_price_cad > 0 THEN
        NEW.margin_percent := (NEW.extended_margin_cad / NEW.extended_price_cad) * 100;
    ELSE
        NEW.margin_percent := 0;
    END IF;

    -- Calculate line subtotal (after discount)
    NEW.line_subtotal_cad := NEW.extended_price_cad - COALESCE(NEW.discount_amount_cad, 0);

    -- Calculate line total (subtotal + tax)
    NEW.line_total_cad := NEW.line_subtotal_cad + COALESCE(NEW.tax_amount_cad, 0);

    -- Calculate outstanding amount
    NEW.amount_outstanding_cad := NEW.line_total_cad - COALESCE(NEW.amount_paid_cad, 0);

    -- Calculate days outstanding
    NEW.days_outstanding := CURRENT_DATE - NEW.invoice_date;

    -- Determine aging bucket
    IF NEW.days_outstanding <= 30 THEN
        NEW.aging_bucket := 'current';
    ELSIF NEW.days_outstanding <= 60 THEN
        NEW.aging_bucket := '1-30';
    ELSIF NEW.days_outstanding <= 90 THEN
        NEW.aging_bucket := '31-60';
    ELSIF NEW.days_outstanding <= 120 THEN
        NEW.aging_bucket := '61-90';
    ELSE
        NEW.aging_bucket := '90+';
    END IF;

    -- Set accounting period
    NEW.accounting_period := TO_CHAR(NEW.invoice_date, 'YYYY-MM');
    NEW.fiscal_year := EXTRACT(YEAR FROM NEW.invoice_date);

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoice_calculate_extended BEFORE INSERT OR UPDATE ON app.fact_invoice
    FOR EACH ROW EXECUTE FUNCTION app.calculate_invoice_extended();

-- =====================================================
-- SAMPLE DATA: Curated Invoices
-- =====================================================

INSERT INTO app.fact_invoice (
    invoice_number, invoice_line_number, invoice_type, invoice_date, invoice_datetime, due_date,
    client_name, client_type, product_id, product_sku, product_name, product_category, line_item_type,
    project_manager_name, quantity_billed, unit_of_measure,
    unit_price_cad, unit_cost_cad, discount_percent, tax_rate,
    invoice_status, payment_status, payment_terms
) VALUES
-- Invoice 1: Completed framing job
('INV-2025-00001', 1, 'final', '2025-01-15', '2025-01-15 16:00:00', '2025-02-14',
 'Smith Residence Renovation', 'residential',
 (SELECT id FROM app.d_product WHERE sku = 'LBR-2X4-8'), 'LBR-2X4-8', '2x4 Spruce Stud 8ft', 'Lumber', 'product',
 'James Miller', 150, 'each',
 6.49, 4.20, 0, 13.00,
 'sent', 'unpaid', 'net_30'),

('INV-2025-00001', 2, 'final', '2025-01-15', '2025-01-15 16:00:00', '2025-02-14',
 'Smith Residence Renovation', 'residential',
 (SELECT id FROM app.d_product WHERE sku = 'LBR-PLY-3/4'), 'LBR-PLY-3/4', '3/4" Plywood Sheet 4x8', 'Lumber', 'product',
 'James Miller', 25, 'sheet',
 43.99, 32.00, 0, 13.00,
 'sent', 'unpaid', 'net_30'),

('INV-2025-00001', 3, 'final', '2025-01-15', '2025-01-15 16:00:00', '2025-02-14',
 'Smith Residence Renovation', 'residential',
 NULL, 'LABOR-FRAMING', 'Framing Labor', 'Labor', 'labor',
 'James Miller', 16, 'hour',
 85.00, 45.00, 0, 13.00,
 'sent', 'unpaid', 'net_30'),

-- Invoice 2: Electrical materials (paid)
('INV-2025-00002', 1, 'standard', '2025-01-14', '2025-01-14 10:30:00', '2025-02-13',
 'Downtown Office Building', 'commercial',
 (SELECT id FROM app.d_product WHERE sku = 'ELC-WIRE-14/2'), 'ELC-WIRE-14/2', '14/2 NMD90 Wire 75m', 'Electrical', 'product',
 'James Miller', 40, 'roll',
 85.00, 62.00, 0, 13.00,
 'paid', 'paid', 'net_30'),

('INV-2025-00002', 2, 'standard', '2025-01-14', '2025-01-14 10:30:00', '2025-02-13',
 'Downtown Office Building', 'commercial',
 (SELECT id FROM app.d_product WHERE sku = 'ELC-OUTLET-15A'), 'ELC-OUTLET-15A', 'Duplex Receptacle 15A White', 'Electrical', 'product',
 'James Miller', 200, 'each',
 2.25, 1.40, 0, 13.00,
 'paid', 'paid', 'net_30'),

-- Invoice 3: HVAC installation (progress billing)
('INV-2025-00003', 1, 'progress', '2025-01-20', '2025-01-20 14:00:00', '2025-02-19',
 'Johnson Family Home', 'residential',
 (SELECT id FROM app.d_product WHERE sku = 'HVAC-FURN-80K'), 'HVAC-FURN-80K', 'Gas Furnace 80K BTU 95% AFUE', 'HVAC', 'product',
 'James Miller', 1, 'each',
 2299.99, 1750.00, 0, 13.00,
 'sent', 'unpaid', 'net_30'),

('INV-2025-00003', 2, 'progress', '2025-01-20', '2025-01-20 14:00:00', '2025-02-19',
 'Johnson Family Home', 'residential',
 NULL, 'LABOR-HVAC-INSTALL', 'HVAC Installation Labor', 'Labor', 'labor',
 'James Miller', 12, 'hour',
 125.00, 65.00, 0, 13.00,
 'sent', 'unpaid', 'net_30'),

-- Invoice 4: Bathroom renovation (partial payment)
('INV-2025-00004', 1, 'standard', '2025-01-22', '2025-01-22 15:30:00', '2025-02-21',
 'Brown Bathroom Remodel', 'residential',
 (SELECT id FROM app.d_product WHERE sku = 'PLM-TOILET-STD'), 'PLM-TOILET-STD', 'Elongated Toilet 2-Piece', 'Plumbing', 'product',
 'James Miller', 2, 'each',
 239.99, 175.00, 0, 13.00,
 'sent', 'partial', 'net_30'),

('INV-2025-00004', 2, 'standard', '2025-01-22', '2025-01-22 15:30:00', '2025-02-21',
 'Brown Bathroom Remodel', 'residential',
 (SELECT id FROM app.d_product WHERE sku = 'PLM-PIPE-3/4'), 'PLM-PIPE-3/4', '3/4" Type L Copper Pipe 10ft', 'Plumbing', 'product',
 'James Miller', 12, 'length',
 32.99, 24.50, 0, 13.00,
 'sent', 'partial', 'net_30'),

-- Invoice 5: Paint job completed
('INV-2025-00005', 1, 'final', '2025-01-25', '2025-01-25 11:00:00', '2025-02-24',
 'Wilson Interior Refresh', 'residential',
 (SELECT id FROM app.d_product WHERE sku = 'PNT-INT-GAL-WHT'), 'PNT-INT-GAL-WHT', 'Interior Latex Paint Gallon White', 'Paint', 'product',
 'James Miller', 15, 'gallon',
 49.99, 35.00, 0, 13.00,
 'draft', 'unpaid', 'net_30'),

('INV-2025-00005', 2, 'final', '2025-01-25', '2025-01-25 11:00:00', '2025-02-24',
 'Wilson Interior Refresh', 'residential',
 NULL, 'LABOR-PAINTING', 'Painting Labor', 'Labor', 'labor',
 'James Miller', 32, 'hour',
 75.00, 40.00, 0, 13.00,
 'draft', 'unpaid', 'net_30');

-- Update paid amounts for partial payment example
UPDATE app.fact_invoice
SET amount_paid_cad = line_total_cad * 0.5
WHERE invoice_number = 'INV-2025-00004';

-- Mark invoice 2 as fully paid
UPDATE app.fact_invoice
SET amount_paid_cad = line_total_cad, paid_date = '2025-01-20'
WHERE invoice_number = 'INV-2025-00002';

-- Update timestamps
UPDATE app.fact_invoice SET updated_at = NOW();
