-- =====================================================
-- PRODUCT ENTITY (d_product) - DIMENSION
-- Product catalog for quotes and work orders
-- =====================================================
--
-- SEMANTICS:
-- Products represent physical items sold or installed by Huron Home Services.
-- Used in quotes and work orders to specify materials and equipment being provided.
-- Each product has pricing, inventory tracking, and supplier information.
-- In-place updates (same ID, version++), soft delete preserves historical data.
--
-- DATABASE BEHAVIOR:
-- • CREATE: INSERT with version=1, active_flag=true
--   Example: INSERT INTO d_product (id, code, name, descr, product_category,
--                                    unit_price_amt, on_hand_qty)
--            VALUES ('p1111111-...', 'PRD-HVAC-001', 'Carrier HVAC Unit 3-Ton',
--                    '3-ton central air conditioning unit', 'HVAC Equipment', 3200.00, 5)
--
-- • UPDATE: Same ID, version++, updated_ts refreshes
--   Example: UPDATE d_product SET unit_price_amt=3350.00, on_hand_qty=3, version=version+1
--            WHERE id='p1111111-...'
--
-- • SOFT DELETE: active_flag=false, to_ts=now()
--   Example: UPDATE d_product SET active_flag=false, to_ts=now() WHERE id='p1111111-...'
--
-- KEY FIELDS:
-- • id: uuid PRIMARY KEY (stable, never changes)
-- • code: varchar(50) UNIQUE NOT NULL (business identifier: 'PRD-HVAC-001', SKU)
-- • name: text NOT NULL (display name: 'Carrier HVAC Unit 3-Ton')
-- • product_category: text ('HVAC Equipment', 'Plumbing Fixtures', 'Electrical Materials', etc.)
-- • unit_price_amt: decimal(15,2) (standard selling price per unit)
-- • cost_amt: decimal(15,2) (cost to acquire/purchase)
-- • on_hand_qty: integer (current inventory quantity)
-- • reorder_level_qty: integer (quantity threshold to trigger reorder)
-- • taxable_flag: boolean (whether product is subject to tax)
-- • supplier_name: text (primary supplier for this product)
--
-- RELATIONSHIPS (NO FOREIGN KEYS):
-- • Parent: None (dimension entity)
-- • Children: fact_quote (via rel_quote_product), fact_work_order (via work order details)
--
-- USAGE:
-- • Quoted products: rel_quote_product links quotes to products
-- • Work order products: Tracks actual materials used
-- • Product catalog: Browse available products with pricing
-- • Inventory management: Track on-hand quantities and reorder levels
--
-- =====================================================

CREATE TABLE app.d_product (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,
    name text NOT NULL,
    descr text,
    metadata jsonb DEFAULT '{}'::jsonb,
    active_flag boolean DEFAULT true,
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1,

    -- Product-specific fields
    product_category text, -- HVAC Equipment, Plumbing Fixtures, Electrical Materials, etc.
    unit_price_amt decimal(15,2), -- Selling price per unit
    cost_amt decimal(15,2), -- Cost to acquire
    unit_of_measure text DEFAULT 'each', -- each, box, linear_foot, square_foot, gallon, etc.
    on_hand_qty integer DEFAULT 0, -- Current inventory
    reorder_level_qty integer DEFAULT 0, -- Reorder threshold
    reorder_qty integer DEFAULT 0, -- Standard reorder quantity
    taxable_flag boolean DEFAULT true, -- Is this product taxable?
    supplier_name text, -- Primary supplier
    supplier_part_number text, -- Supplier's part/SKU number
    warranty_months integer DEFAULT 0 -- Product warranty period in months
);

COMMENT ON TABLE app.d_product IS 'Product catalog for quotes and work orders with pricing and inventory';

-- =====================================================
-- DATA CURATION: Sample Products for Huron Home Services
-- =====================================================

-- HVAC Products
INSERT INTO app.d_product (code, name, descr, metadata,
    product_category, unit_price_amt, cost_amt, unit_of_measure,
    on_hand_qty, reorder_level_qty, reorder_qty,
    taxable_flag, supplier_name, supplier_part_number, warranty_months
) VALUES
(
    'PRD-HVAC-001',
    'Carrier 3-Ton Central Air Conditioner',
    '3-ton 16 SEER central air conditioning unit with installation kit',
    '{"brand": "Carrier", "model": "CA-36K3", "seer_rating": 16, "tonnage": 3}'::jsonb,
    'HVAC Equipment', 3200.00, 2400.00, 'each',
    5, 2, 3, true, 'HVAC Wholesale Supply', 'CAR-CA36K3', 24
),
(
    'PRD-HVAC-002',
    'Honeywell Smart Thermostat',
    'WiFi-enabled smart thermostat with mobile app control and energy saving features',
    '{"brand": "Honeywell", "model": "T9-WIFI", "smart_features": true}'::jsonb,
    'HVAC Equipment', 220.00, 150.00, 'each',
    15, 5, 10, true, 'HVAC Wholesale Supply', 'HON-T9WIFI', 12
),
(
    'PRD-HVAC-003',
    'HVAC Air Filter 20x25x1',
    'High-efficiency pleated air filter 20x25x1 MERV 11 rating',
    '{"brand": "Filtrete", "model": "MPR1500", "merv_rating": 11, "size": "20x25x1"}'::jsonb,
    'HVAC Supplies', 28.00, 18.00, 'box',
    50, 20, 40, true, 'HVAC Wholesale Supply', 'FIL-2025-11', 0
);

-- Plumbing Products
INSERT INTO app.d_product (code, name, descr, metadata,
    product_category, unit_price_amt, cost_amt, unit_of_measure,
    on_hand_qty, reorder_level_qty, reorder_qty,
    taxable_flag, supplier_name, supplier_part_number, warranty_months
) VALUES
(
    'PRD-PLUMB-001',
    'Rheem 50-Gallon Water Heater',
    '50-gallon electric water heater with 6-year warranty',
    '{"brand": "Rheem", "model": "XE50T06ST45U1", "capacity_gallons": 50, "energy_star": true}'::jsonb,
    'Plumbing Equipment', 650.00, 480.00, 'each',
    8, 3, 5, true, 'Plumbing Supply Co', 'RHE-XE50', 72
),
(
    'PRD-PLUMB-002',
    'Kohler Kitchen Faucet',
    'Single-handle pull-down kitchen faucet with spray head',
    '{"brand": "Kohler", "model": "K-596-VS", "finish": "stainless", "spray_head": true}'::jsonb,
    'Plumbing Fixtures', 285.00, 195.00, 'each',
    12, 4, 8, true, 'Plumbing Supply Co', 'KOH-K596VS', 24
),
(
    'PRD-PLUMB-003',
    'PEX Tubing 1/2" 100ft Roll',
    '1/2 inch red PEX tubing for hot water lines, 100-foot roll',
    '{"brand": "Uponor", "model": "F1060500", "size": "1/2 inch", "color": "red", "length_ft": 100}'::jsonb,
    'Plumbing Materials', 85.00, 60.00, 'roll',
    25, 10, 20, true, 'Plumbing Supply Co', 'UPO-F1060500', 0
);

-- Electrical Products
INSERT INTO app.d_product (code, name, descr, metadata,
    product_category, unit_price_amt, cost_amt, unit_of_measure,
    on_hand_qty, reorder_level_qty, reorder_qty,
    taxable_flag, supplier_name, supplier_part_number, warranty_months
) VALUES
(
    'PRD-ELEC-001',
    'Square D 200A Main Breaker Panel',
    '200-amp main breaker load center with 40 circuit spaces',
    '{"brand": "Square D", "model": "HOM4080M200PQCVP", "amperage": 200, "spaces": 40}'::jsonb,
    'Electrical Equipment', 420.00, 290.00, 'each',
    6, 2, 4, true, 'Electrical Distributors Inc', 'SQD-HOM4080', 12
),
(
    'PRD-ELEC-002',
    'LED Recessed Light 6" Kit',
    '6-inch LED recessed lighting retrofit kit, dimmable, 3000K',
    '{"brand": "Halo", "model": "RL560WH6930", "size": "6 inch", "lumens": 650, "kelvin": 3000, "dimmable": true}'::jsonb,
    'Lighting Fixtures', 42.00, 28.00, 'each',
    40, 15, 30, true, 'Electrical Distributors Inc', 'HAL-RL560', 60
),
(
    'PRD-ELEC-003',
    'Romex Wire 14/2 250ft Roll',
    '14-gauge 2-conductor NM-B cable with ground, 250-foot roll',
    '{"brand": "Southwire", "model": "28827422", "gauge": 14, "conductors": 2, "length_ft": 250}'::jsonb,
    'Electrical Materials', 95.00, 68.00, 'roll',
    20, 8, 15, true, 'Electrical Distributors Inc', 'SOU-28827422', 0
);

-- Landscaping Products
INSERT INTO app.d_product (code, name, descr, metadata,
    product_category, unit_price_amt, cost_amt, unit_of_measure,
    on_hand_qty, reorder_level_qty, reorder_qty,
    taxable_flag, supplier_name, supplier_part_number, warranty_months
) VALUES
(
    'PRD-LAND-001',
    'Premium Mulch - Cubic Yard',
    'Premium hardwood mulch, dark brown color, per cubic yard',
    '{"brand": "Nature''s Way", "type": "hardwood", "color": "dark_brown", "coverage_sqft": 100}'::jsonb,
    'Landscaping Materials', 65.00, 40.00, 'cubic_yard',
    150, 50, 100, true, 'Landscape Supply Depot', 'NW-MULCH-DB', 0
),
(
    'PRD-LAND-002',
    'Lawn Fertilizer 50lb Bag',
    '50-pound bag of professional-grade lawn fertilizer, 24-8-16 formula',
    '{"brand": "TurfMaster", "model": "TM-24816", "weight_lbs": 50, "npk_ratio": "24-8-16", "coverage_sqft": 15000}'::jsonb,
    'Landscaping Supplies', 48.00, 32.00, 'bag',
    80, 30, 60, true, 'Landscape Supply Depot', 'TM-24816-50', 0
),
(
    'PRD-LAND-003',
    'Irrigation Sprinkler Head - Pop-up 4"',
    '4-inch pop-up spray head with adjustable pattern, commercial grade',
    '{"brand": "Rain Bird", "model": "1804-PRS30", "type": "pop_up", "height": "4 inch", "adjustable": true}'::jsonb,
    'Irrigation Equipment', 18.00, 11.00, 'each',
    120, 40, 80, true, 'Landscape Supply Depot', 'RB-1804PRS', 24
);

-- General Materials
INSERT INTO app.d_product (code, name, descr, metadata,
    product_category, unit_price_amt, cost_amt, unit_of_measure,
    on_hand_qty, reorder_level_qty, reorder_qty,
    taxable_flag, supplier_name, supplier_part_number, warranty_months
) VALUES
(
    'PRD-GEN-001',
    'Premium Paint Gallon - Interior',
    'Premium interior latex paint, eggshell finish, per gallon',
    '{"brand": "Sherwin Williams", "model": "SW-PREM-INT", "finish": "eggshell", "coverage_sqft": 400}'::jsonb,
    'General Materials', 58.00, 38.00, 'gallon',
    50, 20, 40, true, 'Paint Supply Warehouse', 'SW-PINT-EG', 0
),
(
    'PRD-GEN-002',
    'Treated Lumber 2x6x12',
    'Pressure-treated lumber 2x6x12 for outdoor construction',
    '{"brand": "YellaWood", "dimensions": "2x6x12", "treatment": "pressure_treated", "outdoor_use": true}'::jsonb,
    'General Materials', 22.00, 14.00, 'each',
    200, 75, 150, true, 'Lumber & Building Supply', 'YW-2612PT', 0
),
(
    'PRD-GEN-003',
    'Ceramic Tile 12x12 Box',
    '12x12 inch ceramic floor tile, box of 12 tiles (12 sq ft coverage)',
    '{"brand": "DalTile", "dimensions": "12x12", "material": "ceramic", "tiles_per_box": 12, "coverage_sqft": 12}'::jsonb,
    'General Materials', 45.00, 28.00, 'box',
    100, 35, 70, true, 'Tile & Stone Distributors', 'DT-1212CER', 0
);

COMMENT ON TABLE app.d_product IS 'Product catalog with pricing, inventory, and supplier information';
