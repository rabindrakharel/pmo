-- =====================================================
-- Product Dimension Table (d_product)
-- =====================================================
--
-- SEMANTICS:
-- Central product catalog for home services materials, supplies, and equipment.
-- Supports multi-tier product hierarchy, pricing, inventory management, and vendor tracking.
-- Products can be materials (lumber, paint), equipment (tools), or services (labor items).
--
-- BUSINESS CONTEXT:
-- - Manages complete product lifecycle from procurement to installation
-- - Supports dynamic pricing with seasonal adjustments and volume discounts
-- - Tracks product availability, reorder points, and supplier relationships
-- - Enables accurate job costing and material estimation
-- - Canadian home services industry focus (HVAC, plumbing, electrical, general contracting)
--
-- RELATIONSHIPS:
-- - Links to fact_order (products ordered by customers)
-- - Links to fact_invoice (products billed to customers)
-- - Links to fact_inventory (product stock levels)
-- - Links to fact_shipment (products in transit)
-- - Links to d_client (preferred products per client)
--
-- =====================================================

DROP TABLE IF EXISTS app.d_product CASCADE;

CREATE TABLE app.d_product (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Product Identification
    sku VARCHAR(50) NOT NULL UNIQUE,                    -- Stock Keeping Unit (e.g., "PLM-2X4-8FT")
    product_name VARCHAR(255) NOT NULL,                 -- Display name (e.g., "2x4 Lumber 8ft")
    product_descr TEXT,                                 -- Detailed description

    -- Product Classification
    product_category VARCHAR(100),                      -- Top-level category (e.g., "Lumber", "Electrical", "Plumbing")
    product_subcategory VARCHAR(100),                   -- Subcategory (e.g., "Dimensional Lumber", "Wire & Cable")
    product_type VARCHAR(50),                           -- Type: 'material', 'equipment', 'service', 'consumable'
    product_family VARCHAR(100),                        -- Product family grouping

    -- Specifications
    unit_of_measure VARCHAR(20) DEFAULT 'each',        -- 'each', 'ft', 'sqft', 'lb', 'gal', 'box', 'bundle'
    units_per_package INTEGER DEFAULT 1,               -- Quantity per package/bundle
    package_type VARCHAR(50),                           -- 'single', 'bundle', 'case', 'pallet'
    weight_kg DECIMAL(10,2),                           -- Product weight (Canadian standard)
    dimensions_cm VARCHAR(50),                          -- LxWxH in centimeters

    -- Pricing (Canadian Dollars)
    list_price_cad DECIMAL(12,2) NOT NULL,             -- Standard retail price
    cost_price_cad DECIMAL(12,2),                      -- Cost from supplier
    markup_percentage DECIMAL(5,2),                    -- Standard markup %
    discount_eligible BOOLEAN DEFAULT true,             -- Can be discounted?
    taxable BOOLEAN DEFAULT true,                       -- Subject to GST/HST?
    tax_category VARCHAR(50) DEFAULT 'standard',       -- 'standard', 'exempt', 'zero-rated'

    -- Supplier Information
    primary_supplier_id UUID,                           -- Link to supplier table (future)
    supplier_sku VARCHAR(100),                          -- Supplier's product code
    lead_time_days INTEGER DEFAULT 7,                   -- Days from order to delivery

    -- Inventory Management
    minimum_order_quantity INTEGER DEFAULT 1,           -- MOQ from supplier
    reorder_point INTEGER DEFAULT 10,                   -- Trigger reorder when stock hits this
    reorder_quantity INTEGER DEFAULT 50,                -- Standard reorder amount
    safety_stock_level INTEGER DEFAULT 5,               -- Buffer inventory

    -- Product Attributes
    manufacturer VARCHAR(255),                          -- Brand/manufacturer name
    model_number VARCHAR(100),                          -- Model/part number
    color VARCHAR(50),                                  -- Product color
    material VARCHAR(100),                              -- Construction material
    warranty_months INTEGER,                            -- Warranty period

    -- Canadian Standards & Certifications
    csa_certified BOOLEAN DEFAULT false,                -- Canadian Standards Association
    energy_star_rated BOOLEAN DEFAULT false,            -- Energy efficiency rating
    ahri_certified BOOLEAN DEFAULT false,               -- Air Conditioning, Heating, Refrigeration Institute
    ul_listed BOOLEAN DEFAULT false,                    -- Underwriters Laboratories
    nrc_rating VARCHAR(20),                             -- National Research Council rating

    -- Digital Assets
    image_url TEXT,                                     -- Product image URL
    product_datasheet_url TEXT,                         -- Technical specifications PDF
    installation_guide_url TEXT,                        -- Installation instructions

    -- Business Flags
    active_flag BOOLEAN DEFAULT true,                   -- Product is active for sale
    featured_flag BOOLEAN DEFAULT false,                -- Featured on quotes/catalogs
    seasonal_flag BOOLEAN DEFAULT false,                -- Seasonal availability
    backordered_flag BOOLEAN DEFAULT false,             -- Currently backordered
    discontinued_flag BOOLEAN DEFAULT false,            -- Being phased out

    -- Tracking
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID,                                    -- Employee who created record
    last_modified_by UUID,                              -- Employee who last updated

    -- Metadata
    notes TEXT,                                         -- Internal notes
    tags TEXT[],                                        -- Searchable tags
    search_vector TSVECTOR                              -- Full-text search optimization
);

-- Indexes for performance
CREATE INDEX idx_product_sku ON app.d_product(sku);
CREATE INDEX idx_product_name ON app.d_product(product_name);
CREATE INDEX idx_product_category ON app.d_product(product_category, product_subcategory);
CREATE INDEX idx_product_type ON app.d_product(product_type);
CREATE INDEX idx_product_active ON app.d_product(active_flag);
CREATE INDEX idx_product_search ON app.d_product USING GIN(search_vector);
CREATE INDEX idx_product_tags ON app.d_product USING GIN(tags);

-- Full-text search trigger
CREATE OR REPLACE FUNCTION app.product_search_trigger() RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.product_name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.product_descr, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.sku, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.manufacturer, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_search_update BEFORE INSERT OR UPDATE ON app.d_product
    FOR EACH ROW EXECUTE FUNCTION app.product_search_trigger();

-- =====================================================
-- SAMPLE DATA: Curated Product Catalog
-- =====================================================

INSERT INTO app.d_product (
    sku, product_name, product_descr, product_category, product_subcategory, product_type,
    unit_of_measure, list_price_cad, cost_price_cad, markup_percentage,
    manufacturer, model_number, reorder_point, reorder_quantity,
    csa_certified, active_flag, featured_flag, tags
) VALUES
-- Lumber & Building Materials
('LBR-2X4-8', '2x4 Spruce Stud 8ft', 'Kiln-dried SPF dimensional lumber, ideal for framing',
 'Lumber', 'Dimensional Lumber', 'material', 'each', 6.99, 4.20, 66.43,
 'West Fraser', '2X4-8-KD', 100, 500, true, true, true,
 ARRAY['lumber', 'framing', 'construction']),

('LBR-PLY-3/4', '3/4" Plywood Sheet 4x8', 'Canadian softwood plywood, sanded one side',
 'Lumber', 'Sheet Goods', 'material', 'sheet', 45.99, 32.00, 43.72,
 'Tolko', 'PLY-34-48', 50, 200, true, true, true,
 ARRAY['plywood', 'sheeting', 'subflooring']),

-- Electrical Supplies
('ELC-WIRE-14/2', '14/2 NMD90 Wire 75m', 'Non-metallic sheathed cable, 14 AWG 2-conductor',
 'Electrical', 'Wire & Cable', 'material', 'roll', 89.99, 62.00, 45.15,
 'Southwire', 'NMD90-14-2-75', 20, 100, true, true, false,
 ARRAY['electrical', 'wiring', 'residential']),

('ELC-OUTLET-15A', 'Duplex Receptacle 15A White', 'Tamper-resistant 15A 125V outlet, CSA approved',
 'Electrical', 'Devices', 'material', 'each', 2.49, 1.40, 77.86,
 'Leviton', '5320-WMP', 200, 500, true, true, false,
 ARRAY['electrical', 'outlet', 'device']),

-- Plumbing
('PLM-PIPE-3/4', '3/4" Type L Copper Pipe 10ft', 'Type L hard copper water pipe',
 'Plumbing', 'Pipe & Fittings', 'material', 'length', 34.99, 24.50, 42.82,
 'IPEX', 'CU-L-075-10', 30, 150, true, true, false,
 ARRAY['plumbing', 'copper', 'water']),

('PLM-TOILET-STD', 'Elongated Toilet 2-Piece', 'High-efficiency 4.8L flush, WaterSense certified',
 'Plumbing', 'Fixtures', 'equipment', 'each', 249.99, 175.00, 42.85,
 'American Standard', 'CHAM-ELONG-WHT', 5, 20, true, true, true,
 ARRAY['plumbing', 'toilet', 'fixture', 'bathroom']),

-- HVAC
('HVAC-FURN-80K', 'Gas Furnace 80K BTU 95% AFUE', 'High-efficiency residential gas furnace',
 'HVAC', 'Heating', 'equipment', 'each', 2499.99, 1750.00, 42.86,
 'Lennox', 'ML193UH080V36B', 2, 5, true, true, true,
 ARRAY['hvac', 'furnace', 'heating', 'gas']),

('HVAC-FILTER-16X20', 'MERV 13 Filter 16x20x1', 'High-efficiency pleated air filter',
 'HVAC', 'Filters & Accessories', 'consumable', 'each', 24.99, 14.00, 78.50,
 'Filtrete', '2200-16X20', 50, 200, true, true, false,
 ARRAY['hvac', 'filter', 'air quality']),

-- Paint & Finishing
('PNT-INT-GAL-WHT', 'Interior Latex Paint Gallon White', 'Low-VOC premium interior paint',
 'Paint', 'Interior Paint', 'material', 'gallon', 54.99, 35.00, 57.11,
 'Benjamin Moore', 'REGAL-INT-WHT', 30, 100, false, true, true,
 ARRAY['paint', 'interior', 'latex']),

('PNT-PRIMER-GAL', 'Primer Sealer Gallon', 'Multi-purpose interior/exterior primer',
 'Paint', 'Primers', 'material', 'gallon', 39.99, 24.00, 66.63,
 'Kilz', 'PRIMER-GAL', 25, 80, false, true, false,
 ARRAY['paint', 'primer', 'sealer']),

-- Tools & Equipment
('TLS-DRILL-18V', 'Cordless Drill 18V Kit', 'Brushless motor, 2 batteries, charger, case',
 'Tools', 'Power Tools', 'equipment', 'kit', 299.99, 210.00, 42.86,
 'DeWalt', 'DCD791D2', 3, 10, true, true, true,
 ARRAY['tools', 'drill', 'power tool']),

('TLS-SAW-10', '10" Miter Saw', 'Compound sliding miter saw with laser guide',
 'Tools', 'Power Tools', 'equipment', 'each', 449.99, 315.00, 42.86,
 'Makita', 'LS1018', 2, 5, true, true, true,
 ARRAY['tools', 'saw', 'miter', 'power tool']),

-- Fasteners & Hardware
('HRD-SCREW-3", 'Wood Screws 3" #8 (1lb)', 'Coarse thread deck screws, corrosion resistant',
 'Hardware', 'Fasteners', 'material', 'lb', 12.99, 7.50, 73.20,
 'GRK', 'RSS-3-100', 100, 300, false, true, false,
 ARRAY['hardware', 'screws', 'fasteners']),

('HRD-NAIL-16D', '16D Common Nails (5lb)', 'Bright steel common nails for framing',
 'Hardware', 'Fasteners', 'material', 'box', 18.99, 11.00, 72.64,
 'Grip-Rite', '16D-5LB', 50, 200, false, true, false,
 ARRAY['hardware', 'nails', 'fasteners']),

-- Flooring
('FLR-HARD-OAK', 'Red Oak Hardwood 3/4" x 3.25"', 'Solid hardwood flooring, natural finish',
 'Flooring', 'Hardwood', 'material', 'sqft', 8.99, 6.25, 43.84,
 'Bruce', 'OAK-RED-325', 500, 2000, false, true, true,
 ARRAY['flooring', 'hardwood', 'oak']),

('FLR-LAMI-GRY', 'Laminate Flooring Grey Oak', 'AC4 commercial grade laminate, click-lock',
 'Flooring', 'Laminate', 'material', 'sqft', 3.49, 2.10, 66.19,
 'Pergo', 'OUTLAST-GREY', 1000, 3000, false, true, false,
 ARRAY['flooring', 'laminate', 'grey']);

-- Update timestamps
UPDATE app.d_product SET updated_at = NOW();
