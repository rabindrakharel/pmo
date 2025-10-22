-- =====================================================
-- PRODUCT DIMENSION (d_product) - DIMENSION TABLE
-- =====================================================
--
-- SEMANTICS:
-- Central product catalog for home services materials, supplies, equipment, and service items.
-- Supports multi-level product hierarchy (Department → Class → Subclass → Item).
-- Products can be transacted at different levels (e.g., sell by color, buy by style).
--
-- BUSINESS CONTEXT:
-- - Manages complete product lifecycle from procurement to customer billing
-- - Supports hierarchical product structures (e.g., Paint → Interior Paint → Latex → White Eggshell)
-- - Tracks inventory across multiple warehouses/stores
-- - Enables accurate job costing, material estimation, and vendor management
-- - Canadian home services focus: HVAC, plumbing, electrical, general contracting, renovation
--
-- PRODUCT HIERARCHY:
-- Level 1 = Department (e.g., "Lumber", "Electrical", "Plumbing")
-- Level 2 = Class (e.g., "Dimensional Lumber", "Wire & Cable", "Copper Pipe")
-- Level 3 = Subclass (e.g., "SPF Studs", "NMD90 Wire", "Type L Copper")
-- Level 4 = Item/SKU (e.g., "2x4x8 KD Stud", "14/2 NMD90 75m", "3/4\" Type L 10ft")
--
-- TRANSACTION LEVEL:
-- - Defines at which hierarchy level transactions (orders, invoices, inventory) occur
-- - Example: Buy paint by "Gallon" (level 4), but track inventory by "Color" (level 3)
--
-- RELATIONSHIPS:
-- - Links to f_order (products ordered by customers)
-- - Links to f_invoice (products billed to customers)
-- - Links to f_inventory (product stock levels across stores)
-- - Links to f_shipment (products in transit from suppliers)
--
-- =====================================================

DROP TABLE IF EXISTS app.d_product CASCADE;

CREATE TABLE app.d_product (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,                  -- Internal product code (SKU)

    -- Hierarchy
    level INTEGER DEFAULT 1,                            -- Hierarchy level (1=Department, 2=Class, 3=Subclass, 4=Item)
    transaction_level INTEGER DEFAULT 4,                -- Level at which transactions occur (1-4)

    -- Identification
    name VARCHAR(255) NOT NULL,                         -- Product name
    descr TEXT,                                         -- Detailed description
    specifications TEXT,                                -- Technical specifications

    -- Product Classification (Hierarchy)
    department VARCHAR(100),                            -- Level 1: Top category (e.g., "Lumber", "Electrical")
    class VARCHAR(100),                                 -- Level 2: Class (e.g., "Dimensional Lumber", "Wire & Cable")
    subclass VARCHAR(100),                              -- Level 3: Subclass (e.g., "SPF Studs", "NMD90 Residential")

    -- Measurement
    unit_of_measure VARCHAR(20) DEFAULT 'each',        -- 'each', 'ft', 'sqft', 'lb', 'gal', 'box', 'roll', 'bundle'
    units_per_package INTEGER DEFAULT 1,               -- Quantity per package/bundle
    package_type VARCHAR(50),                           -- 'single', 'bundle', 'case', 'pallet', 'roll'
    weight_kg DECIMAL(10,2),                           -- Product weight in kg (Canadian standard)
    dimensions_cm VARCHAR(50),                          -- LxWxH in centimeters

    -- Digital Assets
    image_url TEXT,                                     -- Product image URL
    datasheet_url TEXT,                                 -- Technical specifications PDF
    guide_url TEXT,                                     -- Installation/usage guide

    -- Business Flags
    active_flag BOOLEAN DEFAULT true,                   -- Product is active for transactions
    featured_flag BOOLEAN DEFAULT false,                -- Featured in catalogs/quotes
    seasonal_flag BOOLEAN DEFAULT false,                -- Seasonal availability
    backordered_flag BOOLEAN DEFAULT false,             -- Currently backordered
    discontinued_flag BOOLEAN DEFAULT false,            -- Being phased out

    -- Tracking
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID,                                    -- Employee who created
    last_modified_by UUID,                              -- Employee who last updated

    -- Metadata
    notes TEXT,                                         -- Internal notes
    tags TEXT[],                                        -- Searchable tags
    search_vector TSVECTOR                              -- Full-text search optimization
);

-- Indexes for performance
CREATE INDEX idx_product_code ON app.d_product(code);
CREATE INDEX idx_product_name ON app.d_product(name);
CREATE INDEX idx_product_hierarchy ON app.d_product(department, class, subclass);
CREATE INDEX idx_product_level ON app.d_product(level, transaction_level);
CREATE INDEX idx_product_active ON app.d_product(active_flag);
CREATE INDEX idx_product_search ON app.d_product USING GIN(search_vector);
CREATE INDEX idx_product_tags ON app.d_product USING GIN(tags);

-- Full-text search trigger
CREATE OR REPLACE FUNCTION app.product_search_trigger() RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.descr, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.code, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.department, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(NEW.class, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_search_update BEFORE INSERT OR UPDATE ON app.d_product
    FOR EACH ROW EXECUTE FUNCTION app.product_search_trigger();

COMMENT ON TABLE app.d_product IS 'Product dimension with hierarchical structure for home services materials and equipment';

-- =====================================================
-- DATA CURATION: Canadian Home Services Product Catalog
-- 20 products across key categories
-- =====================================================

INSERT INTO app.d_product (
    code, level, transaction_level, name, descr, specifications,
    department, class, subclass,
    unit_of_measure, units_per_package, package_type, weight_kg, dimensions_cm,
    active_flag, featured_flag, seasonal_flag, tags
) VALUES

-- ====================
-- LUMBER & BUILDING MATERIALS
-- ====================

('LBR-001', 4, 4, '2x4 SPF Stud 8ft KD',
 'Kiln-dried spruce-pine-fir dimensional lumber for residential framing',
 'Grade: #2 or better, Moisture content: 19% or less, CSA O141 certified',
 'Lumber', 'Dimensional Lumber', 'SPF Studs',
 'each', 1, 'single', 1.8, '38x89x244',
 true, true, false,
 ARRAY['lumber', 'framing', '2x4', 'stud', 'construction']),

('LBR-002', 4, 4, '2x6 SPF Stud 10ft KD',
 'Kiln-dried spruce-pine-fir dimensional lumber for walls and floors',
 'Grade: #2 or better, Moisture content: 19% or less, CSA O141 certified',
 'Lumber', 'Dimensional Lumber', 'SPF Studs',
 'each', 1, 'single', 3.2, '38x140x305',
 true, true, false,
 ARRAY['lumber', 'framing', '2x6', 'stud', 'floor']),

('LBR-003', 4, 4, '3/4" Plywood 4x8 Sanded',
 'Canadian softwood plywood sheet, sanded one side for subflooring',
 'Grade: Good one side, CSA O121 certified, Exposure 1',
 'Lumber', 'Sheet Goods', 'Plywood',
 'sheet', 1, 'single', 22.5, '244x122x1.9',
 true, true, false,
 ARRAY['plywood', 'sheeting', 'subflooring', '4x8']),

-- ====================
-- ELECTRICAL
-- ====================

('ELC-001', 4, 4, '14/2 NMD90 Wire 75m',
 'Non-metallic sheathed cable for residential branch circuits',
 '14 AWG 2-conductor with ground, 90°C rated, CSA C22.2 certified',
 'Electrical', 'Wire & Cable', 'NMD90 Residential',
 'roll', 75, 'roll', 12.5, '30x30x15',
 true, true, false,
 ARRAY['electrical', 'wire', 'nmd90', '14/2', 'residential']),

('ELC-002', 4, 4, '12/2 NMD90 Wire 75m',
 'Non-metallic sheathed cable for 20A residential circuits',
 '12 AWG 2-conductor with ground, 90°C rated, CSA C22.2 certified',
 'Electrical', 'Wire & Cable', 'NMD90 Residential',
 'roll', 75, 'roll', 18.0, '30x30x15',
 true, true, false,
 ARRAY['electrical', 'wire', 'nmd90', '12/2', '20amp']),

('ELC-003', 4, 4, '15A Duplex Receptacle White',
 'Tamper-resistant 15A 125V outlet for residential use',
 'CSA certified, tamper-resistant shutters, back & side wired',
 'Electrical', 'Devices & Outlets', 'Receptacles',
 'each', 1, 'single', 0.1, '7x7x4',
 true, false, false,
 ARRAY['electrical', 'outlet', 'receptacle', '15amp', 'tr']),

('ELC-004', 4, 4, '20A GFCI Receptacle White',
 'Ground fault circuit interrupter outlet for wet locations',
 'CSA certified, 20A 125V, self-test, tamper-resistant',
 'Electrical', 'Devices & Outlets', 'GFCI',
 'each', 1, 'single', 0.3, '11x7x6',
 true, true, false,
 ARRAY['electrical', 'gfci', 'outlet', '20amp', 'safety']),

-- ====================
-- PLUMBING
-- ====================

('PLM-001', 4, 4, '3/4" Type L Copper Pipe 10ft',
 'Type L hard copper water pipe for residential plumbing',
 'ASTM B88, NSF 61 certified, 3/4" nominal diameter',
 'Plumbing', 'Pipe & Tubing', 'Copper Type L',
 'length', 1, 'single', 2.8, '305x2x2',
 true, true, false,
 ARRAY['plumbing', 'copper', 'pipe', 'type-l', 'water']),

('PLM-002', 4, 4, '1/2" PEX Pipe 100ft Red',
 'Cross-linked polyethylene pipe for hot water distribution',
 'ASTM F876, NSF 61, CSA B137.5, red for hot water',
 'Plumbing', 'Pipe & Tubing', 'PEX',
 'roll', 100, 'roll', 8.5, '40x40x15',
 true, true, false,
 ARRAY['plumbing', 'pex', 'hot-water', 'flexible']),

('PLM-003', 4, 4, 'Elongated Toilet 2-Piece White',
 'High-efficiency dual-flush toilet, WaterSense certified',
 '4.8L/3L dual flush, elongated bowl, 12" rough-in, soft-close seat',
 'Plumbing', 'Fixtures', 'Toilets',
 'each', 1, 'single', 35.0, '76x42x76',
 true, true, false,
 ARRAY['plumbing', 'toilet', 'dual-flush', 'watersense', 'bathroom']),

-- ====================
-- HVAC
-- ====================

('HVAC-001', 4, 4, 'Gas Furnace 60K BTU 96% AFUE',
 'High-efficiency residential gas furnace for forced air systems',
 '60,000 BTU input, 96% AFUE, modulating, ECM blower, ENERGY STAR',
 'HVAC', 'Heating Equipment', 'Gas Furnaces',
 'each', 1, 'single', 85.0, '86x61x76',
 true, true, false,
 ARRAY['hvac', 'furnace', 'heating', 'gas', 'high-efficiency']),

('HVAC-002', 4, 4, 'Central AC Unit 2.5 Ton 16 SEER',
 'Residential central air conditioning condensing unit',
 '30,000 BTU cooling, 16 SEER, R-410A refrigerant, 10-year warranty',
 'HVAC', 'Cooling Equipment', 'Air Conditioners',
 'each', 1, 'single', 75.0, '81x81x91',
 true, true, true,
 ARRAY['hvac', 'ac', 'cooling', '2.5-ton', 'air-conditioning']),

('HVAC-003', 4, 4, 'MERV 13 Filter 16x20x1',
 'High-efficiency pleated air filter for HVAC systems',
 'MERV 13 rated, electrostatically charged, 3-month lifespan',
 'HVAC', 'Filters & Accessories', 'Air Filters',
 'each', 1, 'single', 0.3, '51x41x2.5',
 true, true, false,
 ARRAY['hvac', 'filter', 'merv13', 'air-quality']),

-- ====================
-- PAINT & FINISHING
-- ====================

('PNT-001', 4, 4, 'Interior Latex Paint 1 Gal White',
 'Premium low-VOC interior latex paint, eggshell finish',
 'Zero VOC, washable, one-coat coverage, mildew resistant',
 'Paint & Coatings', 'Interior Paint', 'Latex',
 'gallon', 1, 'single', 5.0, '18x18x20',
 true, true, false,
 ARRAY['paint', 'interior', 'latex', 'white', 'low-voc']),

('PNT-002', 4, 4, 'Exterior Paint 1 Gal Gray',
 'Premium exterior acrylic latex paint, satin finish',
 'Weather resistant, fade resistant, 10-year warranty',
 'Paint & Coatings', 'Exterior Paint', 'Acrylic Latex',
 'gallon', 1, 'single', 5.2, '18x18x20',
 true, true, true,
 ARRAY['paint', 'exterior', 'gray', 'weather-resistant']),

('PNT-003', 4, 4, 'Primer Sealer 1 Gal',
 'Multi-purpose interior/exterior primer and sealer',
 'Blocks stains, seals porous surfaces, low odor, fast drying',
 'Paint & Coatings', 'Primers & Sealers', 'Universal Primer',
 'gallon', 1, 'single', 4.8, '18x18x20',
 true, false, false,
 ARRAY['paint', 'primer', 'sealer', 'interior', 'exterior']),

-- ====================
-- FLOORING
-- ====================

('FLR-001', 4, 4, 'Red Oak Hardwood 3/4" x 3.25"',
 'Solid red oak hardwood flooring, natural finish, tongue & groove',
 'Grade: Clear, unfinished, 25 sqft per bundle',
 'Flooring', 'Hardwood', 'Oak',
 'sqft', 25, 'bundle', 1.2, '8.3x244',
 true, true, false,
 ARRAY['flooring', 'hardwood', 'oak', 'solid', 'natural']),

('FLR-002', 4, 4, 'Laminate Flooring Grey Oak 12mm',
 'AC4 commercial-grade laminate with click-lock installation',
 '12mm thick, attached underpad, scratch resistant, 20 sqft per box',
 'Flooring', 'Laminate', 'Click-Lock',
 'sqft', 20, 'case', 0.8, '21x127',
 true, true, false,
 ARRAY['flooring', 'laminate', 'grey', 'click-lock', 'ac4']),

-- ====================
-- FASTENERS & HARDWARE
-- ====================

('HRD-001', 4, 4, 'Wood Screws 3" #8 (1lb Box)',
 'Coarse thread deck screws, star drive, corrosion resistant',
 'Yellow zinc coated, star drive, approx 85 screws per pound',
 'Hardware & Fasteners', 'Screws', 'Wood Screws',
 'lb', 1, 'box', 0.45, '10x8x5',
 true, false, false,
 ARRAY['hardware', 'screws', 'deck', '3-inch', 'fasteners']),

('HRD-002', 4, 4, '16D Common Nails 5lb Box',
 'Bright steel common nails for framing and general construction',
 '3.5" length, smooth shank, approx 190 nails per 5lb',
 'Hardware & Fasteners', 'Nails', 'Framing Nails',
 'box', 1, 'box', 2.27, '15x10x8',
 true, false, false,
 ARRAY['hardware', 'nails', '16d', 'framing', 'construction']);

-- Update timestamps
UPDATE app.d_product SET updated_at = NOW();

COMMENT ON COLUMN app.d_product.level IS 'Product hierarchy level: 1=Department, 2=Class, 3=Subclass, 4=Item/SKU';
COMMENT ON COLUMN app.d_product.transaction_level IS 'Level at which inventory transactions occur (buy/sell/stock)';
