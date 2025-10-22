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
    v_client_id uuid;
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
        SELECT id, name INTO v_client_id, v_client_name
        FROM app.d_cust
        WHERE active_flag = true
        ORDER BY random()
        LIMIT 1;

        -- Fallback if no client found
        IF v_client_id IS NULL THEN
            v_client_name := v_client_names[1 + floor(random() * array_length(v_client_names, 1))::int];
            SELECT id INTO v_client_id FROM app.d_cust LIMIT 1;
        END IF;

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
                    due_date, client_id, client_name, client_type,
                    product_id, product_code, product_name, product_category, line_item_type,
                    project_manager_name, quantity_billed, unit_of_measure,
                    unit_price_cad, unit_cost_cad, tax_rate,
                    invoice_status, payment_status, payment_terms,
                    sent_date, paid_date
                ) VALUES (
                    v_invoice_num, j, 'standard', v_invoice_date, v_invoice_date::timestamp,
                    v_due_date, v_client_id, v_client_name, v_client_type,
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
                    due_date, client_id, client_name, client_type,
                    product_code, product_name, product_category, line_item_type,
                    project_manager_name, quantity_billed, unit_of_measure,
                    unit_price_cad, unit_cost_cad, tax_rate,
                    invoice_status, payment_status, payment_terms,
                    sent_date, paid_date
                ) VALUES (
                    v_invoice_num, j, 'standard', v_invoice_date, v_invoice_date::timestamp,
                    v_due_date, v_client_id, v_client_name, v_client_type,
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
