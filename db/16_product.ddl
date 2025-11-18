-- =====================================================
-- PRODUCT ENTITY (d_product) - DIMENSION
-- Product catalog for quotes and work orders
-- =====================================================
--
-- SEMANTICS:
-- Products represent physical items sold or installed by Huron Home Services.
-- Used in quotes and work orders to specify materials and equipment being provided.
-- Each product has pricing, inventory tracking, and supplier information.
--
-- **HIERARCHY CONCEPT**:
-- • d_product: Actual product entity (SKU-level items)
-- • d_product_hierarchy: Product categorization hierarchy (Division → Department → Class → Sub-Class)
-- • Relationship: app.product links to d_product_hierarchy via entity_instance_link
-- • Example: Product "Carrier 3-Ton AC" links to hierarchy "HVAC Equipment > Residential HVAC > Central AC > 3-Ton Units"
--
-- OPERATIONS:
-- • CREATE: POST /api/v1/product, INSERT with version=1, active_flag=true
-- • UPDATE: PUT /api/v1/product/{id}, same ID, version++, updated_ts refreshes
-- • DELETE: active_flag=false, to_ts=now() (soft delete)
-- • LIST: GET /api/v1/product, filters by category/brand, RBAC enforced
--
-- RELATIONSHIPS (NO FOREIGN KEYS):
-- • Parent: d_product_hierarchy (via entity_instance_link)
-- • Children: fact_quote (via rel_quote_product), fact_work_order (via work order details)
--
-- USAGE:
-- • Product catalog: Browse SKU-level products with pricing
-- • Inventory management: Track on-hand quantities and reorder levels
-- • Hierarchy navigation: Products organized by Division → Department → Class → Sub-Class
-- • Quote/Work Order: Select products from catalog
--
-- =====================================================

CREATE TABLE app.product (
    id uuid DEFAULT gen_random_uuid(),
    code varchar(50),
    name text,
    descr text,
    metadata jsonb DEFAULT '{}'::jsonb,
    active_flag boolean DEFAULT true,
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1,

    -- Product-specific fields (NO pricing, inventory, or cost fields)
    style text, -- Product style identifier
    sku text, -- Stock Keeping Unit identifier
    upc text, -- Universal Product Code / barcode
    product_category text, -- May reference hierarchy Sub-Class or Class
    dl__product_brand text, -- Brand label (references app.setting_datalabel: datalabel_name='product__brand')
    item_level text, -- Item classification level
    tran_level text, -- Transaction tracking level
    unit_of_measure text DEFAULT 'each', -- each, box, linear_foot, square_foot, gallon, etc.
    reorder_level_qty integer DEFAULT 0, -- Reorder threshold
    reorder_qty integer DEFAULT 0, -- Standard reorder quantity
    taxable_flag boolean DEFAULT true, -- Is this product taxable?
    supplier_part_number text -- Supplier's part/SKU number
);

COMMENT ON TABLE app.product IS 'Product catalog (SKU-level) with pricing, inventory, and supplier information';

-- =====================================================
-- PRODUCT HIERARCHY (d_product_hierarchy) - CATEGORIZATION
-- 4-level hierarchy: Division → Department → Class → Sub-Class
-- =====================================================
--
-- SEMANTICS:
-- Product hierarchy provides a 4-level categorization structure for organizing products.
-- This hierarchy is separate from actual products (d_product) and linked via entity_instance_link.
--
-- HIERARCHY LEVELS:
-- • Division: Top-level product grouping (e.g., "HVAC Products", "Plumbing Products")
-- • Department: Major category within division (e.g., "Residential HVAC", "Commercial HVAC")
-- • Class: Product class within department (e.g., "Central Air Conditioning", "Furnaces")
-- • Sub-Class: Detailed classification (e.g., "3-Ton Units", "4-Ton Units")
--
-- DATABASE BEHAVIOR:
-- • CREATE: INSERT with parent__product_hierarchy_id pointing to parent hierarchy node
-- • HIERARCHY: Self-referential parent__product_hierarchy_id for tree structure
-- • TRAVERSE: Recursive CTE on parent__product_hierarchy_id for full hierarchy path
--
-- RELATIONSHIPS:
-- • Self: parent__product_hierarchy_id → d_product_hierarchy.id
-- • Children: app.product (via entity_instance_link)
--
-- =====================================================

CREATE TABLE app.product_hierarchy (
    id uuid DEFAULT gen_random_uuid(),
    code varchar(50),
    name varchar(200),
    descr text,
    metadata jsonb DEFAULT '{}'::jsonb,
    active_flag boolean DEFAULT true,

    -- Hierarchy fields
    parent__product_hierarchy_id uuid, -- Self-referential for hierarchy (NULL for Division level)
    dl__product_hierarchy_level text, -- References app.setting_datalabel (datalabel_name='dl__product_hierarchy_level')

    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);

COMMENT ON TABLE app.product_hierarchy IS 'Product categorization hierarchy: Division → Department → Class → Sub-Class';

-- =====================================================
-- DATA CURATION: Product Hierarchy
-- =====================================================

-- LEVEL 1: DIVISION (Top-level groupings)
INSERT INTO app.product_hierarchy (code, name, descr, parent__product_hierarchy_id, dl__product_hierarchy_level) VALUES
('PROD-HIE-HVAC-DIV', 'HVAC Products', 'Heating, ventilation, and air conditioning equipment and supplies', NULL, 'Division'),
('PROD-HIE-PLUMB-DIV', 'Plumbing Products', 'Plumbing equipment, fixtures, and materials', NULL, 'Division'),
('PROD-HIE-ELEC-DIV', 'Electrical Products', 'Electrical equipment, fixtures, and materials', NULL, 'Division'),
('PROD-HIE-LAND-DIV', 'Landscaping Products', 'Landscaping materials, supplies, and irrigation equipment', NULL, 'Division'),
('PROD-HIE-GEN-DIV', 'General Materials', 'General construction and finishing materials', NULL, 'Division');

-- LEVEL 2: DEPARTMENT (Major categories within divisions)
-- HVAC Departments
INSERT INTO app.product_hierarchy (code, name, descr, parent__product_hierarchy_id, dl__product_hierarchy_level)
SELECT 'PROD-HIE-HVAC-RES', 'Residential HVAC', 'HVAC equipment and supplies for residential applications', id, 'Department'
FROM app.product_hierarchy WHERE code = 'PROD-HIE-HVAC-DIV';

INSERT INTO app.product_hierarchy (code, name, descr, parent__product_hierarchy_id, dl__product_hierarchy_level)
SELECT 'PROD-HIE-HVAC-SUPP', 'HVAC Supplies', 'Consumable supplies and accessories for HVAC systems', id, 'Department'
FROM app.product_hierarchy WHERE code = 'PROD-HIE-HVAC-DIV';

-- Plumbing Departments
INSERT INTO app.product_hierarchy (code, name, descr, parent__product_hierarchy_id, dl__product_hierarchy_level)
SELECT 'PROD-HIE-PLUMB-EQP', 'Plumbing Equipment', 'Major plumbing equipment and appliances', id, 'Department'
FROM app.product_hierarchy WHERE code = 'PROD-HIE-PLUMB-DIV';

INSERT INTO app.product_hierarchy (code, name, descr, parent__product_hierarchy_id, dl__product_hierarchy_level)
SELECT 'PROD-HIE-PLUMB-FIX', 'Plumbing Fixtures', 'Faucets, sinks, and plumbing fixtures', id, 'Department'
FROM app.product_hierarchy WHERE code = 'PROD-HIE-PLUMB-DIV';

INSERT INTO app.product_hierarchy (code, name, descr, parent__product_hierarchy_id, dl__product_hierarchy_level)
SELECT 'PROD-HIE-PLUMB-MAT', 'Plumbing Materials', 'Pipes, fittings, and plumbing materials', id, 'Department'
FROM app.product_hierarchy WHERE code = 'PROD-HIE-PLUMB-DIV';

-- LEVEL 3: CLASS (Product classes within departments)
-- HVAC Classes
INSERT INTO app.product_hierarchy (code, name, descr, parent__product_hierarchy_id, dl__product_hierarchy_level)
SELECT 'PROD-HIE-HVAC-AC', 'Central Air Conditioning', 'Central AC units and systems', id, 'Class'
FROM app.product_hierarchy WHERE code = 'PROD-HIE-HVAC-RES';

INSERT INTO app.product_hierarchy (code, name, descr, parent__product_hierarchy_id, dl__product_hierarchy_level)
SELECT 'PROD-HIE-HVAC-THERM', 'Thermostats', 'HVAC thermostats and controls', id, 'Class'
FROM app.product_hierarchy WHERE code = 'PROD-HIE-HVAC-RES';

INSERT INTO app.product_hierarchy (code, name, descr, parent__product_hierarchy_id, dl__product_hierarchy_level)
SELECT 'PROD-HIE-HVAC-FILT', 'Air Filters', 'HVAC air filters and filtration', id, 'Class'
FROM app.product_hierarchy WHERE code = 'PROD-HIE-HVAC-SUPP';

-- LEVEL 4: SUB-CLASS (Detailed classifications)
-- HVAC Sub-Classes
INSERT INTO app.product_hierarchy (code, name, descr, parent__product_hierarchy_id, dl__product_hierarchy_level)
SELECT 'PROD-HIE-HVAC-AC-3TON', '3-Ton AC Units', '3-ton capacity central air conditioning units', id, 'Sub-Class'
FROM app.product_hierarchy WHERE code = 'PROD-HIE-HVAC-AC';

INSERT INTO app.product_hierarchy (code, name, descr, parent__product_hierarchy_id, dl__product_hierarchy_level)
SELECT 'PROD-HIE-HVAC-THERM-SMART', 'Smart Thermostats', 'WiFi-enabled smart thermostats', id, 'Sub-Class'
FROM app.product_hierarchy WHERE code = 'PROD-HIE-HVAC-THERM';

-- =====================================================
-- DATA CURATION: Sample Products for Huron Home Services
-- =====================================================

-- HVAC Products
INSERT INTO app.product (
    code, name, descr, metadata,
    style, sku, upc,
    product_category, dl__product_brand,
    item_level, tran_level,
    unit_of_measure, reorder_level_qty, reorder_qty,
    taxable_flag, supplier_part_number
) VALUES
(
    'PRD-HVAC-001',
    'Carrier 3-Ton Central Air Conditioner',
    '3-ton 16 SEER central air conditioning unit with installation kit',
    '{"model": "CA-36K3", "seer_rating": 16, "tonnage": 3}'::jsonb,
    'CA-36K3', 'HVAC-CAR-3TON-001', '012345678901',
    '3-Ton AC Units', 'Carrier',
    'SKU', 'TRANSACTION',
    'each', 2, 3,
    true, 'CAR-CA36K3'
),
(
    'PRD-HVAC-002',
    'Honeywell Smart Thermostat',
    'WiFi-enabled smart thermostat with mobile app control and energy saving features',
    '{"model": "T9-WIFI", "smart_features": true}'::jsonb,
    'T9-WIFI', 'HVAC-HON-THERM-001', '012345678902',
    'Smart Thermostats', 'Honeywell',
    'SKU', 'TRANSACTION',
    'each', 5, 10,
    true, 'HON-T9WIFI'
),
(
    'PRD-HVAC-003',
    'HVAC Air Filter 20x25x1',
    'High-efficiency pleated air filter 20x25x1 MERV 11 rating',
    '{"model": "MPR1500", "merv_rating": 11, "size": "20x25x1"}'::jsonb,
    'MPR1500', 'HVAC-FIL-2025-001', '012345678903',
    'Air Filters', 'Filtrete',
    'SKU', 'TRANSACTION',
    'box', 20, 40,
    true, 'FIL-2025-11'
);

-- Plumbing Products
INSERT INTO app.product (
    code, name, descr, metadata,
    style, sku, upc,
    product_category, dl__product_brand,
    item_level, tran_level,
    unit_of_measure, reorder_level_qty, reorder_qty,
    taxable_flag, supplier_part_number
) VALUES
(
    'PRD-PLUMB-001',
    'Rheem 50-Gallon Water Heater',
    '50-gallon electric water heater with 6-year warranty',
    '{"model": "XE50T06ST45U1", "capacity_gallons": 50, "energy_star": true}'::jsonb,
    'XE50T06ST45U1', 'PLUMB-RHE-50G-001', '012345678904',
    'Water Heaters', 'Rheem',
    'SKU', 'TRANSACTION',
    'each', 3, 5,
    true, 'RHE-XE50'
),
(
    'PRD-PLUMB-002',
    'Kohler Kitchen Faucet',
    'Single-handle pull-down kitchen faucet with spray head',
    '{"model": "K-596-VS", "finish": "stainless", "spray_head": true}'::jsonb,
    'K-596-VS', 'PLUMB-KOH-FAUC-001', '012345678905',
    'Kitchen Faucets', 'Kohler',
    'SKU', 'TRANSACTION',
    'each', 4, 8,
    true, 'KOH-K596VS'
),
(
    'PRD-PLUMB-003',
    'PEX Tubing 1/2" 100ft Roll',
    '1/2 inch red PEX tubing for hot water lines, 100-foot roll',
    '{"model": "F1060500", "size": "1/2 inch", "color": "red", "length_ft": 100}'::jsonb,
    'F1060500', 'PLUMB-UPO-PEX-001', '012345678906',
    'PEX Tubing', 'Uponor',
    'SKU', 'TRANSACTION',
    'roll', 10, 20,
    true, 'UPO-F1060500'
);

-- Electrical Products
INSERT INTO app.product (
    code, name, descr, metadata,
    style, sku, upc,
    product_category, dl__product_brand,
    item_level, tran_level,
    unit_of_measure, reorder_level_qty, reorder_qty,
    taxable_flag, supplier_part_number
) VALUES
(
    'PRD-ELEC-001',
    'Square D 200A Main Breaker Panel',
    '200-amp main breaker load center with 40 circuit spaces',
    '{"model": "HOM4080M200PQCVP", "amperage": 200, "spaces": 40}'::jsonb,
    'HOM4080M200PQCVP', 'ELEC-SQD-PANEL-001', '012345678907',
    'Breaker Panels', 'Square D',
    'SKU', 'TRANSACTION',
    'each', 2, 4,
    true, 'SQD-HOM4080'
),
(
    'PRD-ELEC-002',
    'LED Recessed Light 6" Kit',
    '6-inch LED recessed lighting retrofit kit, dimmable, 3000K',
    '{"model": "RL560WH6930", "size": "6 inch", "lumens": 650, "kelvin": 3000, "dimmable": true}'::jsonb,
    'RL560WH6930', 'ELEC-HAL-LED-001', '012345678908',
    'LED Lighting', 'Halo',
    'SKU', 'TRANSACTION',
    'each', 15, 30,
    true, 'HAL-RL560'
),
(
    'PRD-ELEC-003',
    'Romex Wire 14/2 250ft Roll',
    '14-gauge 2-conductor NM-B cable with ground, 250-foot roll',
    '{"model": "28827422", "gauge": 14, "conductors": 2, "length_ft": 250}'::jsonb,
    '28827422', 'ELEC-SOU-WIRE-001', '012345678909',
    'Wire & Cable', 'Southwire',
    'SKU', 'TRANSACTION',
    'roll', 8, 15,
    true, 'SOU-28827422'
);

-- Landscaping Products
INSERT INTO app.product (
    code, name, descr, metadata,
    style, sku, upc,
    product_category, dl__product_brand,
    item_level, tran_level,
    unit_of_measure, reorder_level_qty, reorder_qty,
    taxable_flag, supplier_part_number
) VALUES
(
    'PRD-LAND-001',
    'Premium Mulch - Cubic Yard',
    'Premium hardwood mulch, dark brown color, per cubic yard',
    '{"type": "hardwood", "color": "dark_brown", "coverage_sqft": 100}'::jsonb,
    'DB-MULCH', 'LAND-NW-MULCH-001', '012345678910',
    'Mulch & Soil', 'Nature''s Way',
    'SKU', 'TRANSACTION',
    'cubic_yard', 50, 100,
    true, 'NW-MULCH-DB'
),
(
    'PRD-LAND-002',
    'Lawn Fertilizer 50lb Bag',
    '50-pound bag of professional-grade lawn fertilizer, 24-8-16 formula',
    '{"model": "TM-24816", "weight_lbs": 50, "npk_ratio": "24-8-16", "coverage_sqft": 15000}'::jsonb,
    'TM-24816', 'LAND-TM-FERT-001', '012345678911',
    'Fertilizers', 'TurfMaster',
    'SKU', 'TRANSACTION',
    'bag', 30, 60,
    true, 'TM-24816-50'
),
(
    'PRD-LAND-003',
    'Irrigation Sprinkler Head - Pop-up 4"',
    '4-inch pop-up spray head with adjustable pattern, commercial grade',
    '{"model": "1804-PRS30", "type": "pop_up", "height": "4 inch", "adjustable": true}'::jsonb,
    '1804-PRS30', 'LAND-RB-SPRINK-001', '012345678912',
    'Irrigation Equipment', 'Rain Bird',
    'SKU', 'TRANSACTION',
    'each', 40, 80,
    true, 'RB-1804PRS'
);

-- General Materials
INSERT INTO app.product (
    code, name, descr, metadata,
    style, sku, upc,
    product_category, dl__product_brand,
    item_level, tran_level,
    unit_of_measure, reorder_level_qty, reorder_qty,
    taxable_flag, supplier_part_number
) VALUES
(
    'PRD-GEN-001',
    'Premium Paint Gallon - Interior',
    'Premium interior latex paint, eggshell finish, per gallon',
    '{"model": "SW-PREM-INT", "finish": "eggshell", "coverage_sqft": 400}'::jsonb,
    'SW-PREM-INT', 'GEN-SW-PAINT-001', '012345678913',
    'Paint & Coatings', 'Sherwin Williams',
    'SKU', 'TRANSACTION',
    'gallon', 20, 40,
    true, 'SW-PINT-EG'
),
(
    'PRD-GEN-002',
    'Treated Lumber 2x6x12',
    'Pressure-treated lumber 2x6x12 for outdoor construction',
    '{"dimensions": "2x6x12", "treatment": "pressure_treated", "outdoor_use": true}'::jsonb,
    '2X6X12-PT', 'GEN-YW-LUMBER-001', '012345678914',
    'Lumber', 'YellaWood',
    'SKU', 'TRANSACTION',
    'each', 75, 150,
    true, 'YW-2612PT'
),
(
    'PRD-GEN-003',
    'Ceramic Tile 12x12 Box',
    '12x12 inch ceramic floor tile, box of 12 tiles (12 sq ft coverage)',
    '{"dimensions": "12x12", "material": "ceramic", "tiles_per_box": 12, "coverage_sqft": 12}'::jsonb,
    '1212CER', 'GEN-DT-TILE-001', '012345678915',
    'Flooring & Tile', 'DalTile',
    'SKU', 'TRANSACTION',
    'box', 35, 70,
    true, 'DT-1212CER'
);

COMMENT ON TABLE app.product IS 'Product catalog (SKU-level) with pricing, inventory, and supplier information';
COMMENT ON TABLE app.product_hierarchy IS 'Product categorization hierarchy: Division → Department → Class → Sub-Class';
