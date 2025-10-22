-- =====================================================
-- COMPREHENSIVE INVENTORY DATA (50+ Inventory Items)
-- Stock levels across multiple store locations
-- =====================================================
--
-- This script generates realistic inventory data for:
-- - All 20 products in d_product
-- - Multiple store locations (from d_office)
-- - Realistic stock quantities with variations
-- - Seasonal adjustments
--
-- TO APPEND TO: f_inventory.ddl (after existing INSERT statements)
-- =====================================================

DO $$
DECLARE
    v_store_ids uuid[];
    v_product_ids uuid[];
    v_store_id uuid;
    v_product_id uuid;
    v_qty decimal;
    v_product_code text;
    v_store_name text;
    i int;
    j int;
BEGIN
    -- Get all store/office IDs
    SELECT array_agg(id) INTO v_store_ids FROM app.d_office WHERE active_flag = true;

    -- Get all product IDs with codes
    IF array_length(v_store_ids, 1) IS NULL OR array_length(v_store_ids, 1) = 0 THEN
        RAISE NOTICE 'No stores found! Creating default store...';
        -- Create a default warehouse if none exists
        INSERT INTO app.d_office (slug, code, name, descr, office_type, city, province, country)
        VALUES ('main-warehouse', 'WH-001', 'Main Warehouse', 'Central distribution warehouse', 'warehouse', 'London', 'Ontario', 'Canada')
        RETURNING id INTO v_store_id;
        v_store_ids := ARRAY[v_store_id];
    END IF;

    SELECT array_agg(id) INTO v_product_ids FROM app.d_product WHERE active_flag = true;

    RAISE NOTICE 'Found % stores and % products', array_length(v_store_ids, 1), array_length(v_product_ids, 1);

    -- Generate inventory for each store-product combination
    FOR i IN 1..array_length(v_store_ids, 1) LOOP
        v_store_id := v_store_ids[i];

        SELECT name INTO v_store_name FROM app.d_office WHERE id = v_store_id;

        FOR j IN 1..array_length(v_product_ids, 1) LOOP
            v_product_id := v_product_ids[j];

            SELECT code INTO v_product_code FROM app.d_product WHERE id = v_product_id;

            -- Generate realistic stock quantities based on product type
            v_qty := CASE
                -- Lumber: High volume
                WHEN v_product_code LIKE 'LBR-%' THEN 200 + floor(random() * 800)::int

                -- Electrical wire: Medium-high volume (in meters/feet)
                WHEN v_product_code IN ('ELC-001', 'ELC-002') THEN 50 + floor(random() * 150)::int

                -- Electrical devices: Medium volume
                WHEN v_product_code LIKE 'ELC-%' THEN 100 + floor(random() * 500)::int

                -- Plumbing pipes: Medium volume
                WHEN v_product_code LIKE 'PLM-%' AND v_product_code != 'PLM-003' THEN 50 + floor(random() * 200)::int

                -- Toilets: Low volume
                WHEN v_product_code = 'PLM-003' THEN 5 + floor(random() * 25)::int

                -- HVAC major equipment: Very low volume
                WHEN v_product_code IN ('HVAC-001', 'HVAC-002') THEN 1 + floor(random() * 8)::int

                -- HVAC filters: High volume
                WHEN v_product_code = 'HVAC-003' THEN 100 + floor(random() * 500)::int

                -- Paint: Medium volume
                WHEN v_product_code LIKE 'PNT-%' THEN 50 + floor(random() * 200)::int

                -- Flooring: High volume (square feet)
                WHEN v_product_code LIKE 'FLR-%' THEN 500 + floor(random() * 2500)::int

                -- Fasteners: Medium-high volume
                WHEN v_product_code LIKE 'HRD-%' THEN 30 + floor(random() * 150)::int

                ELSE 10 + floor(random() * 100)::int
            END;

            -- Insert or update inventory record
            INSERT INTO app.f_inventory (store_id, product_id, qty, notes, created_by, last_modified_by)
            VALUES (
                v_store_id,
                v_product_id,
                v_qty,
                'Stock level for ' || v_product_code || ' at ' || v_store_name,
                (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
                (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca')
            )
            ON CONFLICT DO NOTHING;

        END LOOP;
    END LOOP;

    RAISE NOTICE 'Inventory data generated successfully!';

END $$;

-- =====================================================
-- ADDITIONAL INVENTORY RECORDS FOR SPECIFIC SCENARIOS
-- =====================================================

-- Low stock items (reorder alerts)
DO $$
DECLARE
    v_store_id uuid;
BEGIN
    SELECT id INTO v_store_id FROM app.d_office WHERE active_flag = true LIMIT 1;

    INSERT INTO app.f_inventory (store_id, product_id, qty, notes)
    VALUES
    (v_store_id, (SELECT id FROM app.d_product WHERE code = 'HVAC-001'), 2, 'Low stock - reorder pending'),
    (v_store_id, (SELECT id FROM app.d_product WHERE code = 'HVAC-002'), 1, 'Low stock - reorder pending'),
    (v_store_id, (SELECT id FROM app.d_product WHERE code = 'PLM-003'), 8, 'Low stock - seasonal demand'),
    (v_store_id, (SELECT id FROM app.d_product WHERE code = 'ELC-004'), 15, 'Low stock - high demand item')
    ON CONFLICT DO NOTHING;
END $$;

-- High stock items (overstocked)
DO $$
DECLARE
    v_store_id uuid;
BEGIN
    SELECT id INTO v_store_id FROM app.d_office WHERE active_flag = true LIMIT 1;

    INSERT INTO app.f_inventory (store_id, product_id, qty, notes)
    VALUES
    (v_store_id, (SELECT id FROM app.d_product WHERE code = 'LBR-001'), 1200, 'Bulk purchase - promotional pricing'),
    (v_store_id, (SELECT id FROM app.d_product WHERE code = 'HVAC-003'), 850, 'Seasonal stock - filter promotion'),
    (v_store_id, (SELECT id FROM app.d_product WHERE code = 'FLR-002'), 4500, 'Special order overstock')
    ON CONFLICT DO NOTHING;
END $$;

-- Zero stock items (out of stock)
DO $$
DECLARE
    v_store_id uuid;
BEGIN
    SELECT id INTO v_store_id FROM app.d_office WHERE active_flag = true LIMIT 1;

    INSERT INTO app.f_inventory (store_id, product_id, qty, notes)
    VALUES
    (v_store_id, (SELECT id FROM app.d_product WHERE code = 'PNT-002'), 0, 'Out of stock - backorder expected next week'),
    (v_store_id, (SELECT id FROM app.d_product WHERE code = 'FLR-001'), 0, 'Out of stock - discontinued style')
    ON CONFLICT DO NOTHING;
END $$;

-- Update all inventory timestamps
UPDATE app.f_inventory SET updated_at = NOW();

-- Show inventory summary
SELECT
    p.department,
    COUNT(*) as item_count,
    SUM(i.qty) as total_units,
    AVG(i.qty) as avg_stock_level,
    MIN(i.qty) as min_stock,
    MAX(i.qty) as max_stock
FROM app.f_inventory i
INNER JOIN app.d_product p ON p.id = i.product_id
WHERE i.active_flag = true
GROUP BY p.department
ORDER BY p.department;

COMMENT ON TABLE app.f_inventory IS 'Inventory stock levels with realistic quantities across multiple locations';
