-- =====================================================
-- Shipment Fact Table (f_shipment)
-- =====================================================
--
-- SEMANTICS:
-- Transaction-level fact table capturing all shipments and deliveries.
-- Records shipment lifecycle from pickup through delivery confirmation.
-- Grain: One row per shipment line item (product shipped).
--
-- BUSINESS CONTEXT:
-- - Tracks all outbound shipments to customers and job sites
-- - Records carrier information, tracking numbers, and delivery status
-- - Supports on-time delivery metrics and carrier performance analysis
-- - Enables delivery route optimization and logistics planning
-- - Foundation for freight cost analysis and delivery SLA reporting
--
-- RELATIONSHIPS:
-- - Links to app.product (products shipped)
-- - Links to d_client (customer receiving shipment)
-- - Links to f_order (originating order)
-- - Links to d_project (project shipment is for)
-- - Links to app.office (shipping warehouse)
-- - Links to d_worksite (delivery location)
-- - Parent-child within table (shipment header → shipment lines)
--
-- METRICS:
-- - Quantity shipped, quantity received, quantity damaged
-- - Shipping cost, freight charges, delivery time
-- - On-time delivery rate, delivery variance
-- - Carrier performance, damage rate
--
-- =====================================================

DROP TABLE IF EXISTS app.shipment CASCADE;

CREATE TABLE app.shipment (
    -- Primary Key
    id UUID DEFAULT gen_random_uuid(),

    -- Shipment Identification
    shipment_number VARCHAR(50),        -- Human-readable shipment number (e.g., "SHIP-2025-00123")
    shipment_line_number INTEGER DEFAULT 1,             -- Line item sequence within shipment
    shipment_type VARCHAR(50) DEFAULT 'standard',       -- 'standard', 'rush', 'direct', 'partial', 'backorder', 'return'
    shipment_method VARCHAR(50) DEFAULT 'ground',       -- 'ground', 'air', 'freight', 'courier', 'pickup', 'direct'

    -- Date/Time Dimensions
    shipment_date DATE,                        -- Date shipment created
    shipment_datetime TIMESTAMP DEFAULT NOW(), -- Precise shipment timestamp
    picked_date DATE,                                   -- When items were picked from warehouse
    packed_date DATE,                                   -- When shipment was packed
    shipped_date DATE,                                  -- When shipment left warehouse
    estimated_delivery_date DATE,                       -- Carrier's estimated delivery
    promised_delivery_date DATE,                        -- Company promised delivery to customer
    actual_delivery_date DATE,                          -- Actual delivery date
    delivery_datetime TIMESTAMP,                        -- Precise delivery timestamp

    -- Customer Dimension
    customer_id UUID,                          -- Link to customer (REQUIRED)
    client_name VARCHAR(255),                           -- Denormalized for query performance
    client_type VARCHAR(50),                            -- 'residential', 'commercial', 'government'

    -- Product Dimension
    product_id UUID,                           -- Link to app.product (REQUIRED)
    product_code VARCHAR(50),                           -- Denormalized product code
    product_name VARCHAR(255),                          -- Denormalized name
    product_category VARCHAR(100),                      -- Denormalized category

    -- Order Linkage
    order_id UUID,                                      -- Link to f_order (originating order)
    order_number VARCHAR(50),                           -- Denormalized order number
    order_line_number INTEGER,                          -- Which line from order

    -- Project/Job Association
    project_id UUID,                                    -- Link to d_project (if shipment is for specific job)
    project_name VARCHAR(255),                          -- Denormalized project name
    worksite_id UUID,                                   -- Link to d_worksite (delivery location)

    -- Shipping Warehouse
    warehouse_office_id UUID,                           -- Link to app.office (shipping warehouse)
    warehouse_name VARCHAR(255),                        -- Denormalized warehouse name
    warehouse_location VARCHAR(50),                     -- Bin location where picked from

    -- Quantity Metrics
    qty_ordered DECIMAL(12,3),                     -- Original qty ordered
    qty_shipped DECIMAL(12,3),            -- Qty on this shipment line
    quantity_received DECIMAL(12,3),                    -- Qty confirmed received by customer
    quantity_damaged DECIMAL(12,3) DEFAULT 0,           -- Qty received damaged
    quantity_short DECIMAL(12,3) DEFAULT 0,             -- Qty short shipped
    unit_of_measure VARCHAR(20) DEFAULT 'each',         -- 'each', 'ft', 'sqft', 'lb', 'gal'

    -- Package Details
    package_count INTEGER DEFAULT 1,                    -- Number of packages/boxes
    package_type VARCHAR(50),                           -- 'box', 'pallet', 'crate', 'bundle', 'envelope'
    total_weight_kg DECIMAL(10,2),                      -- Total shipment weight (Canadian standard)
    total_volume_m3 DECIMAL(10,3),                      -- Total shipment volume (cubic meters)
    dimensions_cm VARCHAR(50),                          -- LxWxH in centimeters

    -- Carrier Information
    carrier_name VARCHAR(100),                          -- 'Canada Post', 'Purolator', 'UPS', 'FedEx', 'Own Fleet', 'Customer Pickup'
    carrier_service_level VARCHAR(50),                  -- 'standard', 'expedited', 'overnight', 'same_day'
    tracking_number VARCHAR(100),                       -- Carrier tracking number
    tracking_url TEXT,                                  -- Full tracking URL
    bill_of_lading VARCHAR(100),                        -- BOL number (for freight)
    pro_number VARCHAR(100),                            -- PRO number (for LTL freight)

    -- Shipping Costs (Canadian Dollars)
    freight_charge_cad DECIMAL(12,2) DEFAULT 0,         -- Freight/shipping cost
    fuel_surcharge_cad DECIMAL(12,2) DEFAULT 0,         -- Fuel surcharge
    insurance_charge_cad DECIMAL(12,2) DEFAULT 0,       -- Insurance cost
    handling_charge_cad DECIMAL(12,2) DEFAULT 0,        -- Special handling fees
    total_shipping_cost_cad DECIMAL(12,2),              -- Total shipping cost
    freight_billed_to_customer_cad DECIMAL(12,2),       -- Amount charged to customer

    -- Delivery Location (Snapshot)
    delivery_address_line1 VARCHAR(255),                -- Delivery street address
    delivery_address_line2 VARCHAR(255),
    delivery_city VARCHAR(100),
    delivery_province VARCHAR(2),                       -- 2-letter province code
    delivery_postal_code VARCHAR(7),                    -- Canadian postal code (A1A 1A1)
    delivery_country VARCHAR(2) DEFAULT 'CA',           -- ISO country code

    -- Delivery Contact
    delivery_contact_name VARCHAR(255),                 -- Who to contact on delivery
    delivery_contact_phone VARCHAR(20),
    delivery_contact_email VARCHAR(255),
    delivery_instructions TEXT,                         -- Special delivery notes
    signature_required BOOLEAN DEFAULT false,           -- Requires signature
    special_handling_required BOOLEAN DEFAULT false,    -- Requires special handling

    -- Shipment Status
    shipment_status VARCHAR(50) DEFAULT 'pending',      -- 'pending', 'picked', 'packed', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'exception', 'returned', 'cancelled'
    fulfillment_status VARCHAR(50) DEFAULT 'unfulfilled', -- 'unfulfilled', 'partial', 'fulfilled'
    delivery_status VARCHAR(50) DEFAULT 'not_delivered', -- 'not_delivered', 'delivered', 'failed', 'refused', 'lost', 'damaged'

    -- Delivery Performance
    delivery_variance_days INTEGER,                     -- Actual vs promised delivery (negative = early, positive = late)
    on_time_delivery BOOLEAN,                           -- Delivered by promised date
    early_delivery BOOLEAN,                             -- Delivered before promised date
    late_delivery BOOLEAN,                              -- Delivered after promised date

    -- Delivery Confirmation
    delivered_by VARCHAR(255),                          -- Driver/courier name
    received_by VARCHAR(255),                           -- Who signed for delivery
    signature_image_url TEXT,                           -- Digital signature URL
    proof_of_delivery_url TEXT,                         -- POD document URL
    delivery_photo_url TEXT,                            -- Photo of delivered goods
    delivery_notes TEXT,                                -- Notes from driver

    -- Personnel
    picked_by_employee_id UUID,                         -- Who picked the items
    picked_by_name VARCHAR(255),
    packed_by_employee_id UUID,                         -- Who packed the shipment
    packed_by_name VARCHAR(255),
    shipped_by_employee_id UUID,                        -- Who processed shipping
    shipped_by_name VARCHAR(255),

    -- Exception Handling
    exception_code VARCHAR(50),                         -- 'damaged', 'lost', 'delayed', 'address_error', 'refused', 'weather', 'access_issue'
    exception_description TEXT,                         -- Details of exception
    exception_date DATE,                                -- When exception occurred
    resolution_status VARCHAR(50),                      -- 'open', 'resolved', 'escalated'
    resolution_notes TEXT,                              -- How exception was resolved

    -- Returns (if applicable)
    return_requested BOOLEAN DEFAULT false,             -- Customer requested return
    return_authorized BOOLEAN DEFAULT false,            -- Return authorization granted
    rma_number VARCHAR(100),                            -- Return merchandise authorization number
    return_reason VARCHAR(100),                         -- Reason for return
    return_received_date DATE,                          -- When return was received

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID,
    last_modified_by UUID,

    -- Metadata
    notes TEXT                                          -- Internal shipment notes
);


-- Trigger to calculate shipping costs and delivery performance

    -- Calculate delivery variance and performance flags
    IF NEW.actual_delivery_date IS AND NEW.promised_delivery_date IS THEN
        NEW.delivery_variance_days := NEW.actual_delivery_date - NEW.promised_delivery_date;

        IF NEW.delivery_variance_days <= 0 THEN
            NEW.on_time_delivery := true;
            IF NEW.delivery_variance_days < 0 THEN
                NEW.early_delivery := true;
                NEW.late_delivery := false;
            ELSE
                NEW.early_delivery := false;
                NEW.late_delivery := false;
            END IF;
        ELSE
            NEW.on_time_delivery := false;
            NEW.early_delivery := false;
            NEW.late_delivery := true;
        END IF;
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =====================================================
-- SAMPLE DATA: Curated Shipments
-- =====================================================

INSERT INTO app.shipment (
    shipment_number, shipment_line_number, shipment_type, shipment_method,
    shipment_date, shipment_datetime, shipped_date, estimated_delivery_date, promised_delivery_date, actual_delivery_date,
    client_name, client_type, product_id, product_code, product_name, product_category,
    order_number, warehouse_name, quantity_ordered, quantity_shipped, unit_of_measure,
    carrier_name, carrier_service_level, tracking_number,
    freight_charge_cad, shipment_status, delivery_status, picked_by_name, packed_by_name,
    delivery_address_line1, delivery_city, delivery_province, delivery_postal_code
) VALUES
-- Shipment 1: Smith Residence lumber delivery (on-time)
('SHIP-2025-00001', 1, 'standard', 'freight',
 '2025-01-10', '2025-01-10 14:00:00', '2025-01-10', '2025-01-12', '2025-01-12', '2025-01-12',
 'Smith Residence Renovation', 'residential',
 (SELECT id FROM app.app.product WHERE code = 'LBR-001'), 'LBR-001', '2x4 SPF Stud 8ft KD', 'Lumber',
 'ORD-2025-00001', 'Main Warehouse', 150, 150, 'each',
 'Own Fleet', 'standard', 'FLEET-2025-001',
 75.00, 'delivered', 'delivered', 'James Miller', 'James Miller',
 '123 Elm Street', 'Toronto', 'ON', 'M5V 2T6'),

('SHIP-2025-00001', 2, 'standard', 'freight',
 '2025-01-10', '2025-01-10 14:00:00', '2025-01-10', '2025-01-12', '2025-01-12', '2025-01-12',
 'Smith Residence Renovation', 'residential',
 (SELECT id FROM app.app.product WHERE code = 'LBR-003'), 'LBR-003', '3/4" Plywood 4x8 Sanded', 'Lumber',
 'ORD-2025-00001', 'Main Warehouse', 25, 25, 'sheet',
 'Own Fleet', 'standard', 'FLEET-2025-001',
 75.00, 'delivered', 'delivered', 'James Miller', 'James Miller',
 '123 Elm Street', 'Toronto', 'ON', 'M5V 2T6'),

-- Shipment 2: Electrical supplies (delivered early)
('SHIP-2025-00002', 1, 'standard', 'courier',
 '2025-01-12', '2025-01-12 16:00:00', '2025-01-13', '2025-01-16', '2025-01-17', '2025-01-15',
 'Downtown Office Building', 'commercial',
 (SELECT id FROM app.app.product WHERE code = 'ELC-001'), 'ELC-001', '14/2 NMD90 Wire 75m', 'Electrical',
 'ORD-2025-00002', 'Main Warehouse', 40, 40, 'roll',
 'Purolator', 'expedited', 'PUR-123456789',
 125.50, 'delivered', 'delivered', 'James Miller', 'James Miller',
 '789 Bay Street, Suite 1200', 'Toronto', 'ON', 'M5H 2Y2'),

('SHIP-2025-00002', 2, 'standard', 'courier',
 '2025-01-12', '2025-01-12 16:00:00', '2025-01-13', '2025-01-16', '2025-01-17', '2025-01-15',
 'Downtown Office Building', 'commercial',
 (SELECT id FROM app.app.product WHERE code = 'ELC-003'), 'ELC-003', '15A Duplex Receptacle White', 'Electrical',
 'ORD-2025-00002', 'Main Warehouse', 200, 200, 'each',
 'Purolator', 'expedited', 'PUR-123456789',
 125.50, 'delivered', 'delivered', 'James Miller', 'James Miller',
 '789 Bay Street, Suite 1200', 'Toronto', 'ON', 'M5H 2Y2'),

-- Shipment 3: HVAC furnace (in transit)
('SHIP-2025-00003', 1, 'rush', 'freight',
 '2025-01-20', '2025-01-20 10:00:00', '2025-01-21', '2025-01-24', '2025-01-24', NULL,
 'Johnson Family Home', 'residential',
 (SELECT id FROM app.app.product WHERE code = 'HVAC-001'), 'HVAC-001', 'Gas Furnace 60K BTU 96% AFUE', 'HVAC',
 'ORD-2025-00003', 'Main Warehouse', 1, 1, 'each',
 'UPS Freight', 'expedited', 'UPS-FRT-789012345',
 189.99, 'in_transit', 'not_delivered', 'James Miller', 'James Miller',
 '456 Maple Avenue', 'Mississauga', 'ON', 'L5B 1M2'),

-- Shipment 4: Plumbing fixtures (scheduled)
('SHIP-2025-00004', 1, 'standard', 'ground',
 '2025-01-22', '2025-01-22 09:00:00', '2025-01-23', '2025-01-26', '2025-01-27', NULL,
 'Brown Bathroom Remodel', 'residential',
 (SELECT id FROM app.app.product WHERE code = 'PLM-003'), 'PLM-003', 'Elongated Toilet 2-Piece White', 'Plumbing',
 'ORD-2025-00004', 'Main Warehouse', 2, 2, 'each',
 'Canada Post', 'standard', 'CP-234567890123',
 45.00, 'shipped', 'not_delivered', 'James Miller', 'James Miller',
 '321 Oak Drive', 'Brampton', 'ON', 'L6R 2K9'),

('SHIP-2025-00004', 2, 'standard', 'ground',
 '2025-01-22', '2025-01-22 09:00:00', '2025-01-23', '2025-01-26', '2025-01-27', NULL,
 'Brown Bathroom Remodel', 'residential',
 (SELECT id FROM app.app.product WHERE code = 'PLM-001'), 'PLM-001', '3/4" Type L Copper Pipe 10ft', 'Plumbing',
 'ORD-2025-00004', 'Main Warehouse', 12, 12, 'length',
 'Canada Post', 'standard', 'CP-234567890123',
 45.00, 'shipped', 'not_delivered', 'James Miller', 'James Miller',
 '321 Oak Drive', 'Brampton', 'ON', 'L6R 2K9'),

-- Shipment 5: Paint supplies (being packed)
('SHIP-2025-00005', 1, 'standard', 'ground',
 '2025-01-24', '2025-01-24 13:00:00', NULL, '2025-01-28', '2025-01-28', NULL,
 'Wilson Interior Refresh', 'residential',
 (SELECT id FROM app.app.product WHERE code = 'PNT-001'), 'PNT-001', 'Interior Latex Paint 1 Gal White', 'Paint',
 'ORD-2025-00005', 'Main Warehouse', 15, 15, 'gallon',
 'Own Fleet', 'standard', NULL,
 NULL, 'packed', 'not_delivered', 'James Miller', 'James Miller',
 '654 Pine Road', 'Oakville', 'ON', 'L6H 5V4'),

('SHIP-2025-00005', 2, 'standard', 'ground',
 '2025-01-24', '2025-01-24 13:00:00', NULL, '2025-01-28', '2025-01-28', NULL,
 'Wilson Interior Refresh', 'residential',
 (SELECT id FROM app.app.product WHERE code = 'PNT-003'), 'PNT-003', 'Primer Sealer 1 Gal', 'Paint',
 'ORD-2025-00005', 'Main Warehouse', 8, 8, 'gallon',
 'Own Fleet', 'standard', NULL,
 NULL, 'packed', 'not_delivered', 'James Miller', 'James Miller',
 '654 Pine Road', 'Oakville', 'ON', 'L6H 5V4'),

-- Shipment 6: Flooring delivery (delivered on time)
('SHIP-2025-00006', 1, 'standard', 'freight',
 '2025-01-25', '2025-01-25 11:00:00', '2025-01-26', '2025-01-28', '2025-01-28', '2025-01-28',
 'Heritage Home Restoration', 'residential',
 (SELECT id FROM app.app.product WHERE code = 'FLR-001'), 'FLR-001', 'Red Oak Hardwood 3/4" x 3.25"', 'Flooring',
 'ORD-2025-00006', 'Main Warehouse', 850, 850, 'sqft',
 'Own Fleet', 'standard', 'FLEET-2025-002',
 150.00, 'delivered', 'delivered', 'James Miller', 'James Miller',
 '987 Heritage Lane', 'Burlington', 'ON', 'L7M 4Y8');

-- Update timestamps
UPDATE app.shipment SET updated_at = NOW();

COMMENT ON TABLE app.shipment IS 'Shipment fact table with grain at shipment line item level';
