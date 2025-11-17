-- =====================================================
-- Invoice Fact Table (f_invoice)
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
-- - Links to f_order (originating order, if applicable)
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

DROP TABLE IF EXISTS app.f_invoice CASCADE;

CREATE TABLE app.f_invoice (
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
    service_period_start_date DATE,                     -- Period covered by invoice (start)
    service_period_end_date DATE,                       -- Period covered by invoice (end)

    -- Customer Dimension
    cust_id UUID NOT NULL,                              -- Link to d_cust (REQUIRED)
    client_name VARCHAR(255),                           -- Denormalized for query performance
    client_type VARCHAR(50),                            -- 'residential', 'commercial', 'government'
    client_tier VARCHAR(50),                            -- Customer tier for analytics

    -- Product/Service Dimension
    product_id UUID,                                    -- Link to d_product (if product/service item)
    product_code VARCHAR(50),                           -- Denormalized product code
    product_name VARCHAR(255),                          -- Denormalized name
    product_category VARCHAR(100),                      -- Denormalized category
    line_item_type VARCHAR(50) DEFAULT 'product',       -- 'product', 'labor', 'service', 'expense', 'discount', 'tax'

    -- Project/Job Association
    project_id UUID,                                    -- Link to d_project (if invoice is for specific job)
    project_name VARCHAR(255),                          -- Denormalized project name
    project_phase VARCHAR(100),                         -- Project phase/milestone being billed

    -- Order Linkage
    order_id UUID,                                      -- Link to f_order (originating order)
    order_number VARCHAR(50),                           -- Denormalized order number

    -- Sales/Project Team
    project_manager_id UUID,                            -- Project manager responsible
    project_manager_name VARCHAR(255),                  -- Denormalized for reporting
    sales_rep_id UUID,                                  -- Sales representative
    sales_rep_name VARCHAR(255),                        -- Denormalized
    office_id UUID,                                     -- Billing office/branch
    office_name VARCHAR(255),                           -- Denormalized office

    -- Quantity Metrics
    qty_billed DECIMAL(12,3) NOT NULL,             -- Quantity on this line
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

    -- Attachment Reference
    attachment_id UUID,                                  -- Link to d_attachment (no FK for loose coupling)

    -- Standardized S3 Attachment Fields
    attachment TEXT,                                     -- Full S3 URI: s3://bucket/key (invoice PDF)
    attachment_format VARCHAR(20),                       -- File extension: pdf, png, jpg, svg, etc.
    attachment_size_bytes BIGINT,                        -- File size in bytes
    attachment_object_bucket VARCHAR(100),               -- S3 bucket name: 'pmo-attachments'
    attachment_object_key VARCHAR(500),                  -- S3 object key: invoices/{id}/invoice.ext

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID,                                    -- Employee who created invoice
    last_modified_by UUID,
    sent_by UUID,                                       -- Employee who sent invoice

    -- Metadata
    notes TEXT,                                         -- Internal invoice notes
    customer_notes TEXT,                                -- Notes visible to customer
    terms_and_conditions TEXT                           -- T&C text (snapshot)
);


-- Trigger to calculate extended values and aging
CREATE OR REPLACE FUNCTION app.calculate_f_invoice_extended() RETURNS TRIGGER AS $$
BEGIN
    -- Calculate extended amounts
    NEW.extended_price_cad := NEW.qty_billed * NEW.unit_price_cad;
    NEW.extended_cost_cad := NEW.qty_billed * COALESCE(NEW.unit_cost_cad, 0);
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

CREATE TRIGGER f_invoice_calculate_extended BEFORE INSERT OR UPDATE ON app.f_invoice
    FOR EACH ROW EXECUTE FUNCTION app.calculate_f_invoice_extended();

-- =====================================================
-- SAMPLE DATA: Curated Invoices
-- =====================================================

INSERT INTO app.f_invoice (
    invoice_number, invoice_line_number, invoice_type, invoice_date, invoice_datetime, due_date,
    client_name, client_type, product_id, product_code, product_name, product_category, line_item_type,
    project_manager_name, quantity_billed, unit_of_measure,
    unit_price_cad, unit_cost_cad, discount_percent, tax_rate,
    invoice_status, payment_status, payment_terms
) VALUES
-- Invoice 1: Completed framing job
('INV-2025-00001', 1, 'final', '2025-01-15', '2025-01-15 16:00:00', '2025-02-14',
 'Smith Residence Renovation', 'residential',
 (SELECT id FROM app.d_product WHERE code = 'LBR-001'), 'LBR-001', '2x4 SPF Stud 8ft KD', 'Lumber', 'product',
 'James Miller', 150, 'each',
 6.49, 4.20, 0, 13.00,
 'sent', 'unpaid', 'net_30'),

('INV-2025-00001', 2, 'final', '2025-01-15', '2025-01-15 16:00:00', '2025-02-14',
 'Smith Residence Renovation', 'residential',
 (SELECT id FROM app.d_product WHERE code = 'LBR-003'), 'LBR-003', '3/4" Plywood 4x8 Sanded', 'Lumber', 'product',
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
 (SELECT id FROM app.d_product WHERE code = 'ELC-001'), 'ELC-001', '14/2 NMD90 Wire 75m', 'Electrical', 'product',
 'James Miller', 40, 'roll',
 85.00, 62.00, 0, 13.00,
 'paid', 'paid', 'net_30'),

('INV-2025-00002', 2, 'standard', '2025-01-14', '2025-01-14 10:30:00', '2025-02-13',
 'Downtown Office Building', 'commercial',
 (SELECT id FROM app.d_product WHERE code = 'ELC-003'), 'ELC-003', '15A Duplex Receptacle White', 'Electrical', 'product',
 'James Miller', 200, 'each',
 2.25, 1.40, 0, 13.00,
 'paid', 'paid', 'net_30'),

-- Invoice 3: HVAC installation (progress billing)
('INV-2025-00003', 1, 'progress', '2025-01-20', '2025-01-20 14:00:00', '2025-02-19',
 'Johnson Family Home', 'residential',
 (SELECT id FROM app.d_product WHERE code = 'HVAC-001'), 'HVAC-001', 'Gas Furnace 60K BTU 96% AFUE', 'HVAC', 'product',
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
 (SELECT id FROM app.d_product WHERE code = 'PLM-003'), 'PLM-003', 'Elongated Toilet 2-Piece White', 'Plumbing', 'product',
 'James Miller', 2, 'each',
 239.99, 175.00, 0, 13.00,
 'sent', 'partial', 'net_30'),

('INV-2025-00004', 2, 'standard', '2025-01-22', '2025-01-22 15:30:00', '2025-02-21',
 'Brown Bathroom Remodel', 'residential',
 (SELECT id FROM app.d_product WHERE code = 'PLM-001'), 'PLM-001', '3/4" Type L Copper Pipe 10ft', 'Plumbing', 'product',
 'James Miller', 12, 'length',
 32.99, 24.50, 0, 13.00,
 'sent', 'partial', 'net_30'),

-- Invoice 5: Paint job completed
('INV-2025-00005', 1, 'final', '2025-01-25', '2025-01-25 11:00:00', '2025-02-24',
 'Wilson Interior Refresh', 'residential',
 (SELECT id FROM app.d_product WHERE code = 'PNT-001'), 'PNT-001', 'Interior Latex Paint 1 Gal White', 'Paint', 'product',
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
UPDATE app.f_invoice
SET amount_paid_cad = line_total_cad * 0.5
WHERE invoice_number = 'INV-2025-00004';

-- Mark invoice 2 as fully paid
UPDATE app.f_invoice
SET amount_paid_cad = line_total_cad, paid_date = '2025-01-20'
WHERE invoice_number = 'INV-2025-00002';

-- Update timestamps
UPDATE app.f_invoice SET updated_at = NOW();

COMMENT ON TABLE app.f_invoice IS 'Invoice fact table with grain at invoice line item level';
-- =====================================================
-- COMPREHENSIVE INVOICE DATA (100+ Invoices)
-- Realistic billing transactions across customers and projects
-- =====================================================
--
-- This script generates realistic invoice data with:
-- - 100+ invoices spanning multiple months
-- - Multiple line items per invoice
-- - Various payment statuses (paid, unpaid, partial, overdue)
-- - Realistic product mixes and labor charges
-- - Proper tax calculations
--
-- TO APPEND TO: f_invoice.ddl (after existing INSERT statements)
-- =====================================================

DO $$
DECLARE
    v_invoice_count int := 100;
    v_invoice_num text;
    v_invoice_date date;
    v_due_date date;
    v_client_names text[] := ARRAY[
        'Anderson Family Home', 'Brown Residence', 'Chen Commercial Plaza', 'Davis Property Management',
        'Edwards Estate', 'Foster Home Renovation', 'Garcia Developments', 'Harrison Building Corp',
        'Irving Construction', 'Jackson Commercial', 'Khan Properties', 'Lee Holdings',
        'Martinez Investments', 'Nguyen Family Trust', 'O''Brien Real Estate', 'Patel Group',
        'Quinn Enterprises', 'Robinson Associates', 'Singh Development', 'Thompson Holdings',
        'Underwood Properties', 'Valdez Construction', 'Williams Commercial', 'Xavier Developments',
        'Young Properties', 'Zhang Investments', 'Baker Family Home', 'Cooper Residence'
    ];
    v_client_name text;
    v_client_type text;
    v_project_manager text;
    v_payment_status text;
    v_invoice_status text;
    v_payment_terms text;
    v_product_id uuid;
    v_product_code text;
    v_product_name text;
    v_product_category text;
    v_line_items int;
    v_unit_price decimal;
    v_unit_cost decimal;
    v_qty decimal;
    v_tax_rate decimal := 13.00; -- HST for Ontario
    v_sent_date date;
    v_paid_date date;
    i int;
    j int;
BEGIN
    -- Generate invoices
    FOR i IN 1..v_invoice_count LOOP
        -- Generate invoice number
        v_invoice_num := 'INV-2025-' || lpad(i::text, 5, '0');

        -- Random invoice date in last 6 months
        v_invoice_date := CURRENT_DATE - (floor(random() * 180)::int || ' days')::interval;
        v_due_date := v_invoice_date + 30; -- Net 30

        -- Random client
        v_client_name := v_client_names[1 + floor(random() * array_length(v_client_names, 1))::int];
        v_client_type := CASE floor(random() * 3)::int
            WHEN 0 THEN 'residential'
            WHEN 1 THEN 'commercial'
            ELSE 'government'
        END;

        -- Random payment status based on age
        IF v_invoice_date < CURRENT_DATE - 45 THEN
            -- Older invoices more likely to be paid
            v_payment_status := CASE floor(random() * 10)::int
                WHEN 0 THEN 'unpaid'
                WHEN 1 THEN 'unpaid'
                WHEN 2 THEN 'partial'
                ELSE 'paid'
            END;
        ELSIF v_invoice_date < CURRENT_DATE - 30 THEN
            -- Recent past due
            v_payment_status := CASE floor(random() * 4)::int
                WHEN 0 THEN 'paid'
                WHEN 1 THEN 'partial'
                ELSE 'unpaid'
            END;
        ELSE
            -- Current invoices mostly unpaid
            v_payment_status := CASE floor(random() * 5)::int
                WHEN 0 THEN 'paid'
                WHEN 1 THEN 'partial'
                ELSE 'unpaid'
            END;
        END IF;

        v_invoice_status := CASE v_payment_status
            WHEN 'paid' THEN 'paid'
            WHEN 'unpaid' THEN CASE WHEN v_due_date < CURRENT_DATE THEN 'overdue' ELSE 'sent' END
            ELSE 'partial'
        END;

        v_payment_terms := 'net_30';
        v_project_manager := 'James Miller';

        v_sent_date := v_invoice_date + (1 + floor(random() * 3)::int || ' days')::interval;
        v_paid_date := CASE WHEN v_payment_status = 'paid'
            THEN v_sent_date + (5 + floor(random() * 25)::int || ' days')::interval
            ELSE NULL
        END;

        -- Generate 2-5 line items per invoice
        v_line_items := 2 + floor(random() * 4)::int;

        FOR j IN 1..v_line_items LOOP
            -- Select random product (80% products, 20% labor)
            IF random() < 0.8 THEN
                -- Product line item
                SELECT id, code, name, department INTO v_product_id, v_product_code, v_product_name, v_product_category
                FROM app.d_product
                WHERE active_flag = true
                ORDER BY random()
                LIMIT 1;

                -- Realistic pricing based on product type
                SELECT
                    CASE
                        WHEN code LIKE 'LBR-%' THEN 5.00 + random() * 50
                        WHEN code LIKE 'ELC-%' THEN 2.00 + random() * 100
                        WHEN code LIKE 'PLM-%' THEN 10.00 + random() * 250
                        WHEN code LIKE 'HVAC-%' THEN 100.00 + random() * 2000
                        WHEN code LIKE 'PNT-%' THEN 30.00 + random() * 70
                        WHEN code LIKE 'FLR-%' THEN 3.00 + random() * 12
                        ELSE 10.00 + random() * 100
                    END INTO v_unit_price
                FROM app.d_product WHERE id = v_product_id;

                v_unit_cost := v_unit_price * (0.55 + random() * 0.15); -- 55-70% cost

                -- Realistic quantities
                v_qty := CASE
                    WHEN v_product_code LIKE 'LBR-%' THEN 10 + floor(random() * 100)::int
                    WHEN v_product_code LIKE 'ELC-%' THEN 5 + floor(random() * 50)::int
                    WHEN v_product_code LIKE 'PLM-%' THEN 3 + floor(random() * 20)::int
                    WHEN v_product_code IN ('HVAC-001', 'HVAC-002') THEN 1
                    WHEN v_product_code = 'HVAC-003' THEN 5 + floor(random() * 20)::int
                    WHEN v_product_code LIKE 'PNT-%' THEN 3 + floor(random() * 25)::int
                    WHEN v_product_code LIKE 'FLR-%' THEN 100 + floor(random() * 500)::int
                    ELSE 1 + floor(random() * 10)::int
                END;

                INSERT INTO app.f_invoice (
                    invoice_number, invoice_line_number, invoice_type, invoice_date, invoice_datetime,
                    due_date, client_name, client_type,
                    product_id, product_code, product_name, product_category, line_item_type,
                    project_manager_name, quantity_billed, unit_of_measure,
                    unit_price_cad, unit_cost_cad, tax_rate,
                    invoice_status, payment_status, payment_terms,
                    sent_date, paid_date
                ) VALUES (
                    v_invoice_num, j, 'standard', v_invoice_date, v_invoice_date::timestamp,
                    v_due_date, v_client_name, v_client_type,
                    v_product_id, v_product_code, v_product_name, v_product_category, 'product',
                    v_project_manager, v_qty, 'each',
                    v_unit_price::decimal(12,2), v_unit_cost::decimal(12,2), v_tax_rate,
                    v_invoice_status, v_payment_status, v_payment_terms,
                    v_sent_date, v_paid_date
                );

            ELSE
                -- Labor line item
                v_product_code := CASE floor(random() * 6)::int
                    WHEN 0 THEN 'LABOR-FRAMING'
                    WHEN 1 THEN 'LABOR-ELECTRICAL'
                    WHEN 2 THEN 'LABOR-PLUMBING'
                    WHEN 3 THEN 'LABOR-HVAC-INSTALL'
                    WHEN 4 THEN 'LABOR-PAINTING'
                    ELSE 'LABOR-FLOORING'
                END;

                v_product_name := CASE v_product_code
                    WHEN 'LABOR-FRAMING' THEN 'Framing Labor'
                    WHEN 'LABOR-ELECTRICAL' THEN 'Electrical Installation Labor'
                    WHEN 'LABOR-PLUMBING' THEN 'Plumbing Labor'
                    WHEN 'LABOR-HVAC-INSTALL' THEN 'HVAC Installation Labor'
                    WHEN 'LABOR-PAINTING' THEN 'Painting Labor'
                    ELSE 'Flooring Installation Labor'
                END;

                v_product_category := 'Labor';

                -- Labor rates
                v_unit_price := 65.00 + random() * 85; -- $65-$150/hr
                v_unit_cost := 40.00 + random() * 35; -- $40-$75/hr (employee cost)
                v_qty := 4 + floor(random() * 32)::int; -- 4-36 hours

                INSERT INTO app.f_invoice (
                    invoice_number, invoice_line_number, invoice_type, invoice_date, invoice_datetime,
                    due_date, client_name, client_type,
                    product_code, product_name, product_category, line_item_type,
                    project_manager_name, quantity_billed, unit_of_measure,
                    unit_price_cad, unit_cost_cad, tax_rate,
                    invoice_status, payment_status, payment_terms,
                    sent_date, paid_date
                ) VALUES (
                    v_invoice_num, j, 'standard', v_invoice_date, v_invoice_date::timestamp,
                    v_due_date, v_client_name, v_client_type,
                    v_product_code, v_product_name, v_product_category, 'labor',
                    v_project_manager, v_qty, 'hour',
                    v_unit_price::decimal(12,2), v_unit_cost::decimal(12,2), v_tax_rate,
                    v_invoice_status, v_payment_status, v_payment_terms,
                    v_sent_date, v_paid_date
                );
            END IF;
        END LOOP;
    END LOOP;

    RAISE NOTICE '% invoices with multiple line items generated successfully!', v_invoice_count;
END $$;

-- =====================================================
-- UPDATE PAYMENT AMOUNTS FOR PARTIAL/PAID INVOICES
-- =====================================================

-- Set payment amounts for fully paid invoices
UPDATE app.f_invoice
SET amount_paid_cad = line_total_cad,
    payment_method = CASE floor(random() * 4)::int
        WHEN 0 THEN 'credit_card'
        WHEN 1 THEN 'eft'
        WHEN 2 THEN 'cheque'
        ELSE 'wire'
    END,
    payment_reference = 'PAY-' || lpad(floor(random() * 100000)::int::text, 6, '0')
WHERE payment_status = 'paid';

-- Set partial payment amounts (50-90% paid)
UPDATE app.f_invoice
SET amount_paid_cad = line_total_cad * (0.5 + random() * 0.4),
    payment_method = CASE floor(random() * 3)::int
        WHEN 0 THEN 'credit_card'
        WHEN 1 THEN 'eft'
        ELSE 'cheque'
    END,
    payment_reference = 'PAY-' || lpad(floor(random() * 100000)::int::text, 6, '0')
WHERE payment_status = 'partial';

-- Calculate tax amounts for all invoices
UPDATE app.f_invoice
SET
    gst_amount_cad = 0,
    pst_amount_cad = 0,
    hst_amount_cad = line_subtotal_cad * (tax_rate / 100),
    tax_amount_cad = line_subtotal_cad * (tax_rate / 100);

-- Update timestamps
UPDATE app.f_invoice SET updated_at = NOW();

-- =====================================================
-- INVOICE STATISTICS AND SUMMARY
-- =====================================================

-- Show invoice summary by status
SELECT
    invoice_status,
    COUNT(DISTINCT invoice_number) as invoice_count,
    SUM(line_total_cad) as total_amount,
    AVG(line_total_cad) as avg_line_amount
FROM app.f_invoice
GROUP BY invoice_status
ORDER BY invoice_status;

-- Show payment summary
SELECT
    payment_status,
    COUNT(DISTINCT invoice_number) as invoice_count,
    SUM(line_total_cad) as billed_amount,
    SUM(amount_paid_cad) as paid_amount,
    SUM(amount_outstanding_cad) as outstanding_amount
FROM app.f_invoice
GROUP BY payment_status
ORDER BY payment_status;

-- Show revenue by product category
SELECT
    product_category,
    COUNT(*) as line_items,
    SUM(quantity_billed) as total_qty,
    SUM(line_total_cad) as total_revenue,
    SUM(extended_margin_cad) as total_margin,
    AVG(margin_percent) as avg_margin_pct
FROM app.f_invoice
WHERE product_category IS NOT NULL
GROUP BY product_category
ORDER BY total_revenue DESC;

-- Show aging analysis
SELECT
    aging_bucket,
    COUNT(DISTINCT invoice_number) as invoice_count,
    SUM(amount_outstanding_cad) as outstanding_amount
FROM app.f_invoice
WHERE payment_status IN ('unpaid', 'partial')
GROUP BY aging_bucket
ORDER BY aging_bucket;

COMMENT ON TABLE app.f_invoice IS 'Invoice fact table with 100+ realistic transactions across customers and time periods';
