-- =====================================================
-- Customer Order Fact Table (f_order)
-- =====================================================
--
-- SEMANTICS:
-- Transaction-level fact table capturing all customer orders and order line items.
-- Represents the complete order lifecycle from quotation through fulfillment.
-- Grain: One row per order line item (product ordered).
--
-- BUSINESS CONTEXT:
-- - Records all material orders, equipment purchases, and service bookings
-- - Supports sales analytics, demand forecasting, and inventory planning
-- - Tracks order status from quote → confirmed → processing → shipped → delivered
-- - Enables customer buying pattern analysis and product performance metrics
-- - Foundation for revenue recognition and sales reporting
--
-- RELATIONSHIPS:
-- - Links to app.product (product dimension)
-- - Links to d_client (customer dimension)
-- - Links to d_project (associated project, if applicable)
-- - Links to app.employee (sales representative)
-- - Links to app.office (selling office/branch)
-- - Parent-child within table (order header → order lines)
--
-- METRICS:
-- - Order quantity, unit price, extended price, discount amount
-- - Order count, line count, average order value
-- - Order fulfillment time, backorder rate
-- - Sales by product, customer, region, time period
--
-- =====================================================

DROP TABLE IF EXISTS app.order CASCADE;

CREATE TABLE app.order (
    -- Primary Key
    id UUID DEFAULT gen_random_uuid(),

    -- Order Identification
    order_number VARCHAR(50),           -- Human-readable order number (e.g., "ORD-2025-00123")
    order_line_number INTEGER DEFAULT 1,                -- Line item sequence within order
    order_type VARCHAR(50) DEFAULT 'standard',          -- 'quote', 'standard', 'rush', 'backorder', 'standing'
    order_source VARCHAR(50) DEFAULT 'direct',          -- 'direct', 'phone', 'web', 'mobile', 'email'

    -- Date/Time Dimensions
    order_date DATE,                           -- Date order was placed
    order_datetime TIMESTAMP DEFAULT NOW(),    -- Precise order timestamp
    requested_delivery_date DATE,                       -- Customer requested delivery
    promised_delivery_date DATE,                        -- Company promised delivery
    actual_delivery_date DATE,                          -- Actual delivery date
    cancelled_date DATE,                                -- If cancelled, when

    -- Customer Dimension
    cust_id UUID,                                       -- Link to d_cust
    client_name VARCHAR(255),                           -- Denormalized for query performance
    client_type VARCHAR(50),                            -- 'residential', 'commercial', 'government'
    client_tier VARCHAR(50),                            -- Customer tier for analytics

    -- Product Dimension
    product_id UUID,                           -- Link to app.product (REQUIRED)
    product_code VARCHAR(50),                           -- Denormalized product code
    product_name VARCHAR(255),                          -- Denormalized name
    product_category VARCHAR(100),                      -- Denormalized category

    -- Project/Job Association
    project_id UUID,                                    -- Link to d_project (if order is for specific job)
    project_name VARCHAR(255),                          -- Denormalized project name
    worksite_id UUID,                                   -- Link to d_worksite (delivery location)

    -- Sales Team
    sales_rep_id UUID,                                  -- Employee who took the order
    sales_rep_name VARCHAR(255),                        -- Denormalized for reporting
    office_id UUID,                                     -- Selling office/branch
    office_name VARCHAR(255),                           -- Denormalized office

    -- Quantity Metrics
    qty_ordered DECIMAL(12,3),            -- Quantity on this line
    qty_shipped DECIMAL(12,3) DEFAULT 0,           -- Quantity shipped so far
    quantity_backordered DECIMAL(12,3) DEFAULT 0,       -- Quantity on backorder
    quantity_cancelled DECIMAL(12,3) DEFAULT 0,         -- Quantity cancelled
    unit_of_measure VARCHAR(20) DEFAULT 'each',         -- 'each', 'ft', 'sqft', 'lb', 'gal'

    -- Pricing Metrics (Canadian Dollars)
    unit_list_price_cad DECIMAL(12,2),        -- Standard unit price
    unit_sale_price_cad DECIMAL(12,2),        -- Actual selling price (after discounts)
    unit_cost_cad DECIMAL(12,2),                        -- Unit cost from supplier
    discount_percent DECIMAL(5,2) DEFAULT 0,            -- Discount percentage applied
    discount_amount_cad DECIMAL(12,2) DEFAULT 0,        -- Dollar discount per unit

    -- Extended Metrics (Calculated)
    extended_list_price_cad DECIMAL(12,2),              -- quantity * unit_list_price
    extended_sale_price_cad DECIMAL(12,2),              -- quantity * unit_sale_price
    extended_cost_cad DECIMAL(12,2),                    -- quantity * unit_cost
    extended_margin_cad DECIMAL(12,2),                  -- extended_sale_price - extended_cost
    margin_percent DECIMAL(5,2),                        -- (margin / sale_price) * 100

    -- Tax & Shipping
    tax_amount_cad DECIMAL(12,2) DEFAULT 0,             -- GST/HST/PST
    tax_rate DECIMAL(5,2),                              -- Effective tax rate
    shipping_charge_cad DECIMAL(12,2) DEFAULT 0,        -- Shipping/delivery charge
    line_total_cad DECIMAL(12,2),                       -- Sale price + tax + shipping

    -- Order Status & Flags
    order_status VARCHAR(50) DEFAULT 'pending',         -- 'quote', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'
    fulfillment_status VARCHAR(50) DEFAULT 'unfulfilled', -- 'unfulfilled', 'partial', 'fulfilled', 'backordered'
    payment_status VARCHAR(50) DEFAULT 'unpaid',        -- 'unpaid', 'partial', 'paid', 'refunded'
    priority_flag BOOLEAN DEFAULT false,                -- Rush/priority order
    backorder_flag BOOLEAN DEFAULT false,               -- Currently backordered
    dropship_flag BOOLEAN DEFAULT false,                -- Direct from supplier to customer
    tax_exempt_flag BOOLEAN DEFAULT false,              -- Customer is tax exempt

    -- Fulfillment Tracking
    picking_status VARCHAR(50),                         -- 'not_started', 'picking', 'picked', 'packed'
    warehouse_location VARCHAR(50),                     -- Bin/aisle location
    picked_by_employee_id UUID,                         -- Who picked the item
    packed_by_employee_id UUID,                         -- Who packed the item
    picked_datetime TIMESTAMP,                          -- When picked
    packed_datetime TIMESTAMP,                          -- When packed

    -- Payment Information
    payment_method VARCHAR(50),                         -- 'credit_card', 'invoice', 'cash', 'cheque', 'eft'
    payment_terms VARCHAR(50) DEFAULT 'net_30',         -- 'due_on_receipt', 'net_30', 'net_60', 'cod'
    po_number VARCHAR(100),                             -- Customer PO number
    invoice_number VARCHAR(50),                         -- Link to invoice (if generated)

    -- Supplier Information (if dropship)
    supplier_id UUID,                                   -- If dropship, supplier info
    supplier_order_number VARCHAR(100),                 -- Supplier's order number
    supplier_cost_cad DECIMAL(12,2),                    -- Cost from supplier

    -- Delivery Information
    delivery_address_line1 VARCHAR(255),                -- Delivery street address
    delivery_address_line2 VARCHAR(255),
    delivery_city VARCHAR(100),
    delivery_province VARCHAR(2),                       -- 2-letter province code
    delivery_postal_code VARCHAR(7),                    -- Canadian postal code (A1A 1A1)
    delivery_instructions TEXT,                         -- Special delivery notes
    delivery_contact_name VARCHAR(255),                 -- Who to contact on delivery
    delivery_contact_phone VARCHAR(20),

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID,                                    -- Employee who created order
    last_modified_by UUID,

    -- Metadata
    notes TEXT,                                         -- Internal order notes
    customer_notes TEXT                                 -- Notes from customer
);


-- Trigger to calculate extended values
    NEW.extended_sale_price_cad := NEW.qty_ordered * NEW.unit_sale_price_cad;
    NEW.extended_cost_cad := NEW.qty_ordered * COALESCE(NEW.unit_cost_cad, 0);
    NEW.extended_margin_cad := NEW.extended_sale_price_cad - NEW.extended_cost_cad;

    IF NEW.extended_sale_price_cad > 0 THEN
        NEW.margin_percent := (NEW.extended_margin_cad / NEW.extended_sale_price_cad) * 100;
    ELSE
        NEW.margin_percent := 0;
    END IF;

    NEW.line_total_cad := NEW.extended_sale_price_cad + COALESCE(NEW.tax_amount_cad, 0) + COALESCE(NEW.shipping_charge_cad, 0);
    NEW.updated_at := NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =====================================================
-- SAMPLE DATA: Curated Customer Orders
-- =====================================================

INSERT INTO app.order (
    order_number, order_line_number, order_type, order_date, order_datetime,
    client_name, client_type, product_id, product_code, product_name, product_category,
    sales_rep_name, quantity_ordered, unit_of_measure,
    unit_list_price_cad, unit_sale_price_cad, unit_cost_cad, discount_percent,
    tax_rate, order_status, fulfillment_status, payment_status
) VALUES
-- Order 1: Residential framing materials
('ORD-2025-00001', 1, 'standard', '2025-01-10', '2025-01-10 09:15:00',
 'Smith Residence Renovation', 'residential',
 (SELECT id FROM app.app.product WHERE code = 'LBR-001'), 'LBR-001', '2x4 SPF Stud 8ft KD', 'Lumber',
 'James Miller', 150, 'each',
 6.99, 6.49, 4.20, 7.15,
 13.00, 'delivered', 'fulfilled', 'paid'),

('ORD-2025-00001', 2, 'standard', '2025-01-10', '2025-01-10 09:15:00',
 'Smith Residence Renovation', 'residential',
 (SELECT id FROM app.app.product WHERE code = 'LBR-003'), 'LBR-003', '3/4" Plywood 4x8 Sanded', 'Lumber',
 'James Miller', 25, 'sheet',
 45.99, 43.99, 32.00, 4.35,
 13.00, 'delivered', 'fulfilled', 'paid'),

-- Order 2: Commercial electrical project
('ORD-2025-00002', 1, 'standard', '2025-01-12', '2025-01-12 14:30:00',
 'Downtown Office Building', 'commercial',
 (SELECT id FROM app.app.product WHERE code = 'ELC-001'), 'ELC-001', '14/2 NMD90 Wire 75m', 'Electrical',
 'James Miller', 40, 'roll',
 89.99, 85.00, 62.00, 5.54,
 13.00, 'shipped', 'fulfilled', 'paid'),

('ORD-2025-00002', 2, 'standard', '2025-01-12', '2025-01-12 14:30:00',
 'Downtown Office Building', 'commercial',
 (SELECT id FROM app.app.product WHERE code = 'ELC-003'), 'ELC-003', '15A Duplex Receptacle White', 'Electrical',
 'James Miller', 200, 'each',
 2.49, 2.25, 1.40, 9.64,
 13.00, 'shipped', 'fulfilled', 'paid'),

-- Order 3: HVAC installation quote (pending)
('ORD-2025-00003', 1, 'quote', '2025-01-15', '2025-01-15 10:00:00',
 'Johnson Family Home', 'residential',
 (SELECT id FROM app.app.product WHERE code = 'HVAC-001'), 'HVAC-001', 'Gas Furnace 60K BTU 96% AFUE', 'HVAC',
 'James Miller', 1, 'each',
 2499.99, 2299.99, 1750.00, 8.00,
 13.00, 'quote', 'unfulfilled', 'unpaid'),

-- Order 4: Plumbing renovation materials
('ORD-2025-00004', 1, 'standard', '2025-01-18', '2025-01-18 11:20:00',
 'Brown Bathroom Remodel', 'residential',
 (SELECT id FROM app.app.product WHERE code = 'PLM-003'), 'PLM-003', 'Elongated Toilet 2-Piece White', 'Plumbing',
 'James Miller', 2, 'each',
 249.99, 239.99, 175.00, 4.00,
 13.00, 'processing', 'unfulfilled', 'unpaid'),

('ORD-2025-00004', 2, 'standard', '2025-01-18', '2025-01-18 11:20:00',
 'Brown Bathroom Remodel', 'residential',
 (SELECT id FROM app.app.product WHERE code = 'PLM-001'), 'PLM-001', '3/4" Type L Copper Pipe 10ft', 'Plumbing',
 'James Miller', 12, 'length',
 34.99, 32.99, 24.50, 5.72,
 13.00, 'processing', 'unfulfilled', 'unpaid'),

-- Order 5: Paint and finishing supplies
('ORD-2025-00005', 1, 'standard', '2025-01-20', '2025-01-20 15:45:00',
 'Wilson Interior Refresh', 'residential',
 (SELECT id FROM app.app.product WHERE code = 'PNT-001'), 'PNT-001', 'Interior Latex Paint 1 Gal White', 'Paint',
 'James Miller', 15, 'gallon',
 54.99, 49.99, 35.00, 9.09,
 13.00, 'confirmed', 'unfulfilled', 'unpaid'),

('ORD-2025-00005', 2, 'standard', '2025-01-20', '2025-01-20 15:45:00',
 'Wilson Interior Refresh', 'residential',
 (SELECT id FROM app.app.product WHERE code = 'PNT-003'), 'PNT-003', 'Primer Sealer 1 Gal', 'Paint',
 'James Miller', 8, 'gallon',
 39.99, 37.99, 24.00, 5.00,
 13.00, 'confirmed', 'unfulfilled', 'unpaid'),

-- Order 6: Flooring materials (large order with discount)
('ORD-2025-00006', 1, 'standard', '2025-01-25', '2025-01-25 13:30:00',
 'Heritage Home Restoration', 'residential',
 (SELECT id FROM app.app.product WHERE code = 'FLR-001'), 'FLR-001', 'Red Oak Hardwood 3/4" x 3.25"', 'Flooring',
 'James Miller', 850, 'sqft',
 8.99, 7.99, 6.25, 11.12,
 13.00, 'processing', 'partial', 'paid'),

-- Order 7: HVAC filter bulk order
('ORD-2025-00007', 1, 'standard', '2025-01-28', '2025-01-28 10:15:00',
 'Maple Grove Apartments', 'commercial',
 (SELECT id FROM app.app.product WHERE code = 'HVAC-003'), 'HVAC-003', 'MERV 13 Filter 16x20x1', 'HVAC',
 'James Miller', 50, 'each',
 19.99, 17.99, 12.50, 10.01,
 13.00, 'delivered', 'fulfilled', 'paid');

-- Update timestamps
UPDATE app.order SET updated_at = NOW();

COMMENT ON TABLE app.order IS 'Customer order fact table with grain at order line item level';
