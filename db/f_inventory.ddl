-- =====================================================
-- Inventory Stock Level Table (f_inventory)
-- =====================================================
--
-- SEMANTICS:
-- Simplified inventory snapshot table tracking current stock levels.
-- Grain: One row per product per store location.
--
-- BUSINESS CONTEXT:
-- - Tracks current on-hand inventory quantities across locations
-- - Simple stock level management for order fulfillment
-- - Foundation for stock availability checks and reorder planning
--
-- RELATIONSHIPS:
-- - Links to d_product (product dimension) - NO FK CONSTRAINT
-- - Links to d_office/store (warehouse/location) - NO FK CONSTRAINT
--
-- METRICS:
-- - On-hand quantity by product by location
--
-- =====================================================

DROP TABLE IF EXISTS app.f_inventory CASCADE;

CREATE TABLE app.f_inventory (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Location
    store_id UUID,                                      -- Link to d_office (warehouse/store location)

    -- Product
    product_id UUID,                                    -- Link to d_product

    -- Stock Level
    qty DECIMAL(12,3) DEFAULT 0,                        -- On-hand quantity

    -- Basic Tracking
    active_flag BOOLEAN DEFAULT true,                   -- Record is active
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID,                                    -- Employee who created record
    last_modified_by UUID,                              -- Employee who last updated

    -- Metadata
    notes TEXT                                          -- Optional notes
);

-- Indexes for performance
CREATE INDEX idx_f_inventory_store ON app.f_inventory(store_id);
CREATE INDEX idx_f_inventory_product ON app.f_inventory(product_id);
CREATE INDEX idx_f_inventory_store_product ON app.f_inventory(store_id, product_id);
CREATE INDEX idx_f_inventory_active ON app.f_inventory(active_flag);

-- Trigger to update timestamp
CREATE OR REPLACE FUNCTION app.update_f_inventory_timestamp() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER f_inventory_update_timestamp BEFORE UPDATE ON app.f_inventory
    FOR EACH ROW EXECUTE FUNCTION app.update_f_inventory_timestamp();

-- =====================================================
-- SAMPLE DATA: Current Stock Levels
-- =====================================================

-- Get first office/warehouse ID as default location
DO $$
DECLARE
    default_store_id UUID;
BEGIN
    SELECT id INTO default_store_id FROM app.d_office LIMIT 1;

    -- Insert current stock levels for products
    INSERT INTO app.f_inventory (store_id, product_id, qty, notes) VALUES
    -- Lumber products
    (default_store_id, (SELECT id FROM app.d_product WHERE code = 'LBR-001'), 545, 'Main warehouse stock - 2x4 studs'),
    (default_store_id, (SELECT id FROM app.d_product WHERE code = 'LBR-002'), 320, 'Main warehouse stock - 2x6 studs'),
    (default_store_id, (SELECT id FROM app.d_product WHERE code = 'LBR-003'), 250, 'Main warehouse stock - plywood sheets'),

    -- Electrical products
    (default_store_id, (SELECT id FROM app.d_product WHERE code = 'ELC-001'), 90, 'Main warehouse stock - 14/2 wire'),
    (default_store_id, (SELECT id FROM app.d_product WHERE code = 'ELC-002'), 65, 'Main warehouse stock - 12/2 wire'),
    (default_store_id, (SELECT id FROM app.d_product WHERE code = 'ELC-003'), 600, 'Main warehouse stock - 15A outlets'),
    (default_store_id, (SELECT id FROM app.d_product WHERE code = 'ELC-004'), 85, 'Main warehouse stock - GFCI outlets'),

    -- Plumbing products
    (default_store_id, (SELECT id FROM app.d_product WHERE code = 'PLM-001'), 195, 'Main warehouse stock - copper pipe'),
    (default_store_id, (SELECT id FROM app.d_product WHERE code = 'PLM-002'), 120, 'Main warehouse stock - PEX pipe'),
    (default_store_id, (SELECT id FROM app.d_product WHERE code = 'PLM-003'), 28, 'Main warehouse stock - toilets'),

    -- HVAC products
    (default_store_id, (SELECT id FROM app.d_product WHERE code = 'HVAC-001'), 4, 'Main warehouse stock - gas furnaces'),
    (default_store_id, (SELECT id FROM app.d_product WHERE code = 'HVAC-002'), 3, 'Main warehouse stock - AC units'),
    (default_store_id, (SELECT id FROM app.d_product WHERE code = 'HVAC-003'), 450, 'Main warehouse stock - air filters'),

    -- Paint products
    (default_store_id, (SELECT id FROM app.d_product WHERE code = 'PNT-001'), 140, 'Main warehouse stock - interior white'),
    (default_store_id, (SELECT id FROM app.d_product WHERE code = 'PNT-002'), 95, 'Main warehouse stock - exterior gray'),
    (default_store_id, (SELECT id FROM app.d_product WHERE code = 'PNT-003'), 110, 'Main warehouse stock - primer'),

    -- Flooring products
    (default_store_id, (SELECT id FROM app.d_product WHERE code = 'FLR-001'), 2500, 'Main warehouse stock - oak hardwood (sqft)'),
    (default_store_id, (SELECT id FROM app.d_product WHERE code = 'FLR-002'), 1800, 'Main warehouse stock - laminate (sqft)'),

    -- Hardware products
    (default_store_id, (SELECT id FROM app.d_product WHERE code = 'HRD-001'), 75, 'Main warehouse stock - wood screws (lb)'),
    (default_store_id, (SELECT id FROM app.d_product WHERE code = 'HRD-002'), 45, 'Main warehouse stock - framing nails (5lb boxes)');

END $$;

-- Update timestamps
UPDATE app.f_inventory SET updated_at = NOW();

COMMENT ON TABLE app.f_inventory IS 'Simplified inventory stock levels by product by store location';
